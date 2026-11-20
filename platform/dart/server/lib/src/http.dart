// Roteamento, erros no formato do Nest ({statusCode, message, error}), CORS, limite de taxa e OpenAPI.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:shelf/shelf.dart';

import 'auth/auth_user.dart';
import 'db.dart';

const _phrases = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};

class HttpError implements Exception {
  /// Mensagem simples: corpo `{message, error, statusCode}`.
  HttpError(this.status, Object message, {Map<String, Object?>? extra}) : body = {'message': message, 'error': _phrases[status] ?? 'Error', 'statusCode': status, ...?extra};

  /// Corpo exato (como `new UnauthorizedException({ ... })` no Nest).
  HttpError.body(this.status, this.body);

  final int status;
  final Map<String, Object?> body;
  Map<String, String> headers = const {};

  @override
  String toString() => 'HttpError($status, $body)';
}

HttpError badRequest(Object message) => HttpError(400, message);
HttpError unauthorized([String? message]) => message == null ? HttpError.body(401, {'message': 'Unauthorized', 'statusCode': 401}) : HttpError(401, message);
HttpError forbidden(String message) => HttpError(403, message);
HttpError notFound(String message) => HttpError(404, message);
HttpError conflict(String message) => HttpError(409, message);
HttpError unavailable(String message) => HttpError(503, message);

/// Resposta já pronta (arquivos, texto, cabeçalhos próprios).
class Raw {
  Raw(this.status, this.body, {this.headers = const {}});
  final int status;
  final Object body;
  final Map<String, String> headers;
}

/// Exigência de autenticação da rota.
enum Access { public, user, mfa }

class Ctx {
  Ctx(this.request, this.params, this.body);
  final Request request;
  final Map<String, String> params;
  final Object? body;
  AuthUser? _user;
  Map<String, Object?>? claims;

  AuthUser get user => _user ?? (throw unauthorized());
  AuthUser? get maybeUser => _user;
  set user(AuthUser? u) => _user = u;

  Map<String, String> get query => request.url.queryParameters;
  Map<String, List<String>> get queryAll => request.url.queryParametersAll;
  String? header(String name) => request.headers[name.toLowerCase()];

  String? get ip => request.context['sp.ip'] as String?;
  String? get userAgent => header('user-agent');
  Map<String, Object?> get meta => {'ip': ip, 'userAgent': userAgent};

  /// Cliente ativo: o do usuário; SuperAdmin escolhe com o cabeçalho X-Tenant-Id.
  String get tenant {
    final u = user;
    if (u.isPlatformAdmin) {
      final h = header('x-tenant-id');
      if (h == null || h.isEmpty) throw badRequest('Informe o cabeçalho X-Tenant-Id');
      if (!isUuid(h)) throw badRequest('X-Tenant-Id inválido');
      return h;
    }
    if (u.tenantId == null) throw forbidden('Usuário sem organização vinculada');
    return u.tenantId!;
  }

  Map<String, Object?> get json => body is Map<String, Object?> ? body as Map<String, Object?> : <String, Object?>{};

  String param(String name) {
    final v = params[name] ?? '';
    return v;
  }

  /// Parâmetro de rota que precisa ser UUID (400 como o Nest com z.uuid()).
  String uuidParam(String name) {
    final v = params[name] ?? '';
    if (!isUuid(v)) throw badRequest(['Invalid UUID']);
    return v;
  }
}

final _uuid = RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$|^00000000-0000-0000-0000-000000000000$');
bool isUuid(String v) => _uuid.hasMatch(v);

typedef Handler0 = FutureOr<Object?> Function(Ctx ctx);

class Route {
  Route(this.method, this.path, this.handler, {required this.access, this.permission, this.status, this.throttle, this.tag});
  final String method, path;
  final Handler0 handler;
  final Access access;
  final String? permission;
  final int? status;

  /// limite por minuto e IP desta rota (além do global)
  final int? throttle;
  final String? tag;
  late final RegExp _re = RegExp('^${path.split('/').map((s) => s.startsWith(':') ? '([^/]+)' : RegExp.escape(s)).join('/')}\$');
  late final List<String> _names = [
    for (final s in path.split('/'))
      if (s.startsWith(':')) s.substring(1),
  ];
  late final int _literalScore = path.split('/').where((s) => !s.startsWith(':')).length;

  Map<String, String>? match(String p) {
    final m = _re.firstMatch(p);
    if (m == null) return null;
    return {for (var i = 0; i < _names.length; i++) _names[i]: Uri.decodeComponent(m[i + 1]!)};
  }
}

/// Registro de rotas usado pelos módulos.
class Router {
  final routes = <Route>[];
  String _prefix = '';
  String? _tag;

  void group(String prefix, void Function() body, {String? tag}) {
    final saved = _prefix, savedTag = _tag;
    _prefix = '$_prefix$prefix';
    _tag = tag ?? _tag;
    body();
    _prefix = saved;
    _tag = savedTag;
  }

  void add(String method, String path, Handler0 h, {Access access = Access.user, String? permission, int? status, int? throttle}) {
    routes.add(Route(method, '$_prefix$path', h, access: access, permission: permission, status: status, throttle: throttle, tag: _tag));
  }

  void get(String p, Handler0 h, {Access access = Access.user, String? permission, int? status, int? throttle}) =>
      add('GET', p, h, access: access, permission: permission, status: status, throttle: throttle);
  void post(String p, Handler0 h, {Access access = Access.user, String? permission, int? status, int? throttle}) =>
      add('POST', p, h, access: access, permission: permission, status: status, throttle: throttle);
  void put(String p, Handler0 h, {Access access = Access.user, String? permission, int? status, int? throttle}) =>
      add('PUT', p, h, access: access, permission: permission, status: status, throttle: throttle);
  void patch(String p, Handler0 h, {Access access = Access.user, String? permission, int? status, int? throttle}) =>
      add('PATCH', p, h, access: access, permission: permission, status: status, throttle: throttle);
  void delete(String p, Handler0 h, {Access access = Access.user, String? permission, int? status, int? throttle}) =>
      add('DELETE', p, h, access: access, permission: permission, status: status, throttle: throttle);

  /// Rotas literais antes das com parâmetro (como "/stats" antes de "/:id").
  void sort() => routes.sort((a, b) => b._literalScore.compareTo(a._literalScore) != 0 ? b._literalScore.compareTo(a._literalScore) : b.path.split('/').length.compareTo(a.path.split('/').length));

  Map<String, Object?> openApi() {
    final paths = <String, Map<String, Object?>>{};
    for (final r in routes) {
      final p = r.path.replaceAllMapped(RegExp(r':(\w+)'), (m) => '{${m[1]}}');
      paths.putIfAbsent(p, () => {})[r.method.toLowerCase()] = {
        if (r.tag != null) 'tags': [r.tag],
        if (r.permission != null) 'description': 'Permissão: ${r.permission}',
        if (r.access != Access.public)
          'security': [
            {'bearer': <String>[]},
          ],
        'responses': {
          '${r.status ?? (r.method == 'POST' ? 201 : 200)}': {'description': 'OK'},
        },
      };
    }
    return {
      'openapi': '3.0.0',
      'info': {'title': 'SuperPonto API', 'description': 'Plataforma de gestão de pessoas, jornadas, ponto e equipamentos', 'version': '2.0.0'},
      'components': {
        'securitySchemes': {
          'bearer': {'type': 'http', 'scheme': 'bearer', 'bearerFormat': 'JWT'},
        },
      },
      'paths': paths,
    };
  }
}

/// Janela fixa de 1 minuto por chave (IP + rota).
class RateLimiter {
  final _hits = <String, (int, int)>{};
  bool allow(String key, int limit) {
    final minute = DateTime.now().millisecondsSinceEpoch ~/ 60000;
    final cur = _hits[key];
    final count = cur == null || cur.$1 != minute ? 1 : cur.$2 + 1;
    _hits[key] = (minute, count);
    if (_hits.length > 50000) _hits.removeWhere((_, v) => v.$1 != minute);
    return count <= limit;
  }
}

Response jsonResponse(int status, Object? body, {Map<String, String> headers = const {}}) =>
    Response(status, body: body == null ? null : jsonEncode(toJsonValue(body)), headers: {if (body != null) 'content-type': 'application/json; charset=utf-8', ...headers});

/// Corpo JSON (até 25 MB, como a API em Node).
Future<Object?> readJson(Request req) async {
  if (req.method == 'GET' || req.method == 'HEAD') return null;
  final type = req.headers['content-type'] ?? '';
  final len = req.contentLength;
  if (len != null && len > 25 * 1024 * 1024) throw HttpError(413, 'request entity too large');
  final bytes = <int>[];
  await for (final chunk in req.read()) {
    bytes.addAll(chunk);
    if (bytes.length > 25 * 1024 * 1024) throw HttpError(413, 'request entity too large');
  }
  if (bytes.isEmpty) return null;
  if (!type.contains('json')) return null;
  try {
    return jsonDecode(utf8.decode(bytes));
  } catch (_) {
    throw badRequest('Corpo JSON inválido');
  }
}

String clientIp(Request req, {bool trustProxy = true}) {
  if (trustProxy) {
    final xff = req.headers['x-forwarded-for'];
    if (xff != null && xff.isNotEmpty) return xff.split(',').first.trim();
  }
  final info = req.context['shelf.io.connection_info'];
  if (info is HttpConnectionInfo) {
    final a = info.remoteAddress.address;
    return a.startsWith('::ffff:') || a.contains('.') ? '::ffff:${a.replaceFirst('::ffff:', '')}' : a;
  }
  return 'unknown';
}
