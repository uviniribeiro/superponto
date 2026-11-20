// Cliente da API SuperPonto: Bearer + refresh rotativo, organização ativa (X-Tenant-Id) para a equipe da plataforma.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiException implements Exception {
  ApiException(this.status, this.message, [this.body]);
  final int status;
  final String message;
  final Object? body;
  bool get mfaRequired => body is Map && (body! as Map)['mfaRequired'] == true;
  @override
  String toString() => message;
}

class Me {
  Me(this.raw);
  final Map<String, dynamic> raw;
  String get id => raw['id'] as String;
  String get email => raw['email'] as String? ?? '';
  String get displayName => raw['displayName'] as String? ?? email;
  String? get tenantId => raw['tenantId'] as String?;
  bool get isPlatformAdmin => raw['isPlatformAdmin'] == true;
  bool get isSupport => raw['isSupport'] == true;
  bool get mustChangePassword => raw['mustChangePassword'] == true;
  Set<String> get permissions => {...((raw['permissions'] as List?) ?? const []).cast<String>()};
  bool can(String p) => isPlatformAdmin || permissions.contains(p);
}

/// Endereço da API: `--dart-define=API_URL=...` no build; na web, por padrão, a mesma origem que serviu o app.
String defaultApiUrl() {
  const fromBuild = String.fromEnvironment('API_URL');
  if (fromBuild.isNotEmpty) return fromBuild.replaceAll(RegExp(r'/+$'), '');
  if (kIsWeb) return Uri.base.origin;
  return 'http://localhost:3001';
}

class Api extends ChangeNotifier {
  Api._();
  static final Api instance = Api._();

  String baseUrl = defaultApiUrl();
  String? _access, _refresh, _tenant;
  Me? me;
  bool ready = false;
  SharedPreferences? _prefs;
  Future<bool>? _refreshing;
  final _client = http.Client();

  bool get signedIn => me != null;
  String? get activeTenant => me?.isPlatformAdmin == true ? _tenant : me?.tenantId;
  bool can(String p) => me?.can(p) ?? false;

  Future<void> init() async {
    try {
      _prefs = await SharedPreferences.getInstance();
      const fromBuild = String.fromEnvironment('API_URL');
      if (!kIsWeb && fromBuild.isEmpty) baseUrl = _prefs!.getString('sp.server') ?? baseUrl;
      _refresh = _prefs!.getString('sp.refresh');
      _tenant = _prefs!.getString('sp.tenant');
      if (_refresh != null && await _doRefresh()) await loadMe();
    } catch (_) {
      await _clear();
    }
    ready = true;
    notifyListeners();
  }

  Future<void> setServer(String url) async {
    baseUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    await _prefs?.setString('sp.server', baseUrl);
    notifyListeners();
  }

  Future<void> selectTenant(String? id) async {
    _tenant = id;
    if (id == null) {
      await _prefs?.remove('sp.tenant');
    } else {
      await _prefs?.setString('sp.tenant', id);
    }
    notifyListeners();
  }

  Future<void> signIn(String email, String password, {String? code, String? recoveryCode}) async {
    final r = await _send(
      'POST',
      '/v1/auth/token',
      body: {'email': email.trim(), 'password': password, if (code != null && code.isNotEmpty) 'code': code, if (recoveryCode != null && recoveryCode.isNotEmpty) 'recoveryCode': recoveryCode},
      auth: false,
    );
    await _store(r as Map<String, dynamic>);
    await loadMe();
  }

  Future<void> loadMe() async {
    me = Me((await get('/auth/me')) as Map<String, dynamic>);
    if (!me!.isPlatformAdmin) _tenant = null;
    notifyListeners();
  }

  Future<void> signOut() async {
    final rt = _refresh;
    if (rt != null) {
      try {
        await post('/auth/sign-out', {'refreshToken': rt});
      } catch (_) {}
    }
    await _clear();
    notifyListeners();
  }

  Future<void> _store(Map<String, dynamic> t) async {
    _access = t['accessToken'] as String?;
    final rt = t['refreshToken'] as String?;
    if (rt != null) {
      _refresh = rt;
      await _prefs?.setString('sp.refresh', rt);
    }
  }

  Future<void> _clear() async {
    _access = _refresh = null;
    me = null;
    await _prefs?.remove('sp.refresh');
  }

  Future<bool> _doRefresh() {
    return _refreshing ??= () async {
      try {
        final rt = _refresh;
        if (rt == null) return false;
        final res = await _client
            .post(Uri.parse('$baseUrl/v1/auth/token/refresh'), headers: {'content-type': 'application/json'}, body: jsonEncode({'refreshToken': rt}))
            .timeout(const Duration(seconds: 20));
        if (res.statusCode != 200) {
          await _clear();
          return false;
        }
        await _store(jsonDecode(res.body) as Map<String, dynamic>);
        return true;
      } finally {
        scheduleMicrotask(() => _refreshing = null);
      }
    }();
  }

  Uri uri(String path, [Map<String, Object?>? query]) {
    final p = path.startsWith('/v1/') ? path : '/v1$path';
    final q = <String, String>{
      for (final e in (query ?? const {}).entries)
        if (e.value != null && '${e.value}'.isNotEmpty) e.key: '${e.value}',
    };
    final u = Uri.parse('$baseUrl$p');
    return q.isEmpty ? u : u.replace(queryParameters: {...u.queryParameters, ...q});
  }

  Map<String, String> _headers({bool json = true}) => {
    if (json) 'content-type': 'application/json',
    if (_access != null) 'authorization': 'Bearer $_access',
    if (activeTenant != null && me?.isPlatformAdmin == true) 'x-tenant-id': activeTenant!,
  };

  Future<http.Response> _raw(String method, Uri u, {Object? body, bool auth = true}) async {
    Future<http.Response> call() {
      final req = http.Request(method, u)..headers.addAll(_headers());
      if (!auth) req.headers.remove('authorization');
      if (body != null) req.body = jsonEncode(body);
      return _client.send(req).then(http.Response.fromStream).timeout(const Duration(seconds: 60));
    }

    var res = await call();
    if (auth && res.statusCode == 401 && _refresh != null && await _doRefresh()) res = await call();
    if (auth && res.statusCode == 401 && me != null) {
      await _clear();
      notifyListeners();
    }
    return res;
  }

  Future<Object?> _send(String method, String path, {Object? body, Map<String, Object?>? query, bool auth = true}) async {
    final http.Response res;
    try {
      res = await _raw(method, uri(path, query), body: body, auth: auth);
    } on TimeoutException {
      throw ApiException(0, 'O servidor demorou a responder. Tente de novo.');
    } catch (e) {
      throw ApiException(0, 'Sem conexão com o servidor ($baseUrl).');
    }
    final text = utf8.decode(res.bodyBytes);
    Object? data;
    if (text.isNotEmpty) {
      try {
        data = jsonDecode(text);
      } catch (_) {
        data = text;
      }
    }
    if (res.statusCode >= 400) {
      final m = data is Map ? data['message'] : null;
      final msg = m is List ? m.join(', ') : (m?.toString() ?? 'Erro inesperado (${res.statusCode})');
      throw ApiException(res.statusCode, msg, data);
    }
    return data;
  }

  Future<Object?> get(String path, [Map<String, Object?>? query]) => _send('GET', path, query: query);
  Future<Object?> post(String path, [Object? body, Map<String, Object?>? query]) => _send('POST', path, body: body ?? const <String, Object?>{}, query: query);
  Future<Object?> put(String path, Object? body) => _send('PUT', path, body: body);
  Future<Object?> patch(String path, Object? body) => _send('PATCH', path, body: body);
  Future<Object?> delete(String path, [Object? body]) => _send('DELETE', path, body: body);

  Future<Map<String, dynamic>> getMap(String path, [Map<String, Object?>? query]) async => ((await get(path, query)) as Map).cast<String, dynamic>();
  Future<List<Map<String, dynamic>>> getList(String path, [Map<String, Object?>? query]) async {
    final d = await get(path, query);
    final list = d is Map ? (d['data'] as List? ?? const []) : (d as List? ?? const []);
    return [for (final e in list) (e as Map).cast<String, dynamic>()];
  }

  /// Baixa um arquivo (CSV, XLSX, AFD...). Devolve bytes e o nome sugerido.
  Future<(Uint8List, String?)> download(String path, {Map<String, Object?>? query, String method = 'GET', Object? body}) async {
    final res = await _raw(method, uri(path, query), body: body);
    if (res.statusCode >= 400) {
      String msg = 'Erro ${res.statusCode}';
      try {
        final m = (jsonDecode(utf8.decode(res.bodyBytes)) as Map)['message'];
        msg = m is List ? m.join(', ') : '$m';
      } catch (_) {}
      throw ApiException(res.statusCode, msg);
    }
    final cd = res.headers['content-disposition'] ?? '';
    final name = RegExp(r'''filename\*?=(?:UTF-8'')?"?([^";]+)"?''').firstMatch(cd)?.group(1);
    return (res.bodyBytes, name == null ? null : Uri.decodeComponent(name));
  }

  Future<Object?> upload(String path, Uint8List bytes, {String contentType = 'text/plain', Map<String, Object?>? query}) async {
    Future<http.Response> call() => _client.post(uri(path, query), headers: {..._headers(json: false), 'content-type': contentType}, body: bytes);
    var res = await call();
    if (res.statusCode == 401 && await _doRefresh()) res = await call();
    final text = utf8.decode(res.bodyBytes);
    final data = text.isEmpty ? null : jsonDecode(text);
    if (res.statusCode >= 400) {
      final m = data is Map ? data['message'] : null;
      throw ApiException(res.statusCode, m is List ? m.join(', ') : '${m ?? 'Erro ${res.statusCode}'}', data);
    }
    return data;
  }
}

Api get api => Api.instance;
