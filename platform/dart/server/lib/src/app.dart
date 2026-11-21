// Montagem do servidor: serviços, pipeline HTTP (CORS → limite → autenticação → permissão → rota) e erros.
import 'dart:async';
import 'dart:io';

import 'package:shelf/shelf.dart';

import 'audit.dart';
import 'auth/auth_service.dart';
import 'auth/auth_user.dart';
import 'auth/mfa.dart';
import 'auth/token_service.dart';
import 'auth/users.dart';
import 'config.dart';
import 'crypto/tokens.dart';
import 'db.dart';
import 'http.dart';
import 'mail.dart';

/// Serviços compartilhados pelos módulos.
class App {
  App(this.config) : db = Db(config.databaseUrl) {
    users = UsersRepository(db);
    signer = JwtSigner(key: config.jwtSecret, issuer: config.apiUrl, audience: 'superponto');
    mfa = MfaService(db, config.mfaEncryptionKey);
    tokens = TokenService(db, signer, mfa);
    mail = MailService(config);
    credentials = CredentialsService(users, hasher);
    passwordReset = PasswordResetService(db, users, hasher, tokens, mail, config.appUrl);
  }

  final AppConfig config;
  final Db db;
  final hasher = const PasswordHasher();
  final audit = const Audit();
  final router = Router();
  final limiter = RateLimiter();
  late final UsersRepository users;
  late final JwtSigner signer;
  late final MfaService mfa;
  late final TokenService tokens;
  late final MailService mail;
  late final CredentialsService credentials;
  late final PasswordResetService passwordReset;

  /// Tarefas de fundo (lembretes, alertas) registradas pelos módulos.
  final _timers = <Timer>[];
  final _onClose = <FutureOr<void> Function()>[];
  void every(Duration d, Future<void> Function() job) {
    _timers.add(Timer.periodic(d, (_) => job().catchError((Object e) => stderr.writeln('Tarefa de fundo falhou: $e'))));
  }

  void onClose(FutureOr<void> Function() fn) => _onClose.add(fn);

  Future<void> close() async {
    for (final t in _timers) {
      t.cancel();
    }
    for (final f in _onClose) {
      await f();
    }
    await passwordReset.drain();
    await db.close();
  }

  Handler get handler => _pipeline;

  Future<Response> _pipeline(Request request) async {
    final origin = request.headers['origin'];
    final cors = origin != null && config.corsOrigins.contains(origin)
        ? {'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'vary': 'Origin'}
        : const <String, String>{};
    if (request.method == 'OPTIONS') {
      return Response(
        204,
        headers: {
          ...cors,
          if (cors.isNotEmpty) 'access-control-allow-methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
          if (cors.isNotEmpty) 'access-control-allow-headers': request.headers['access-control-request-headers'] ?? 'content-type,authorization',
        },
      );
    }
    try {
      final res = await _route(request.change(context: {'sp.ip': clientIp(request)}));
      return cors.isEmpty ? res : res.change(headers: cors);
    } on HttpError catch (e) {
      return jsonResponse(e.status, e.body, headers: {...cors, ...e.headers});
    } catch (e, s) {
      // Regra do banco (ex.: administrador da plataforma irrevogável): recusa com a mensagem do gatilho.
      if (e is DbError && e.code == '42501') return jsonResponse(403, {'statusCode': 403, 'error': 'Forbidden', 'message': e.message}, headers: cors);
      stderr.writeln('Erro não tratado em ${request.method} /${request.url.path}: $e\n$s');
      return jsonResponse(500, {'statusCode': 500, 'message': 'Internal server error'}, headers: cors);
    }
  }

  Future<Response> _route(Request request) async {
    final path = '/${request.url.path}'.replaceFirst(RegExp(r'/$'), '');
    final method = request.method == 'HEAD' ? 'GET' : request.method;
    Route? route;
    Map<String, String>? params;
    for (final r in router.routes) {
      final m = r.match(path.isEmpty ? '/' : path);
      if (m == null) continue;
      if (r.method == method) {
        route = r;
        params = m;
        break;
      }
    }
    if (route == null) {
      throw HttpError(404, 'Cannot ${request.method} $path');
    }
    final ip = request.context['sp.ip'] as String? ?? '';
    if (config.rateLimit) {
      if (!limiter.allow('g:$ip', 300) || (route.throttle != null && !limiter.allow('${route.method}${route.path}:$ip', route.throttle!))) {
        throw HttpError.body(429, {'statusCode': 429, 'message': 'ThrottlerException: Too Many Requests'});
      }
    }
    final body = await readJson(request);
    final ctx = Ctx(request, params!, body);
    if (route.access != Access.public) {
      await _authenticate(ctx);
      if (route.access == Access.mfa && !((ctx.claims?['amr'] as List?)?.contains('mfa') ?? false)) {
        throw HttpError.body(401, {'statusCode': 401, 'error': 'mfa_required', 'message': 'Second factor required', 'errorCode': 'mfa_required'});
      }
      if (route.permission != null && !can(ctx.user, route.permission!)) {
        throw forbidden('Permissão necessária: ${route.permission}');
      }
    }
    final result = await route.handler(ctx);
    if (result is Response) return result;
    if (result is Raw) {
      final b = result.body;
      return Response(result.status, body: b is String || b is List<int> ? b : b.toString(), headers: result.headers);
    }
    final status = route.status ?? (route.method == 'POST' ? 201 : 200);
    if (status == 204 || result == null) return Response(status);
    return jsonResponse(status, result);
  }

  Future<void> _authenticate(Ctx ctx) async {
    final h = ctx.header('authorization');
    if (h == null || !h.toLowerCase().startsWith('bearer ')) {
      throw HttpError.body(401, {'statusCode': 401, 'message': 'Unauthorized', 'errorCode': 'missing_credentials'})..headers = {'www-authenticate': 'Bearer realm="superponto"'};
    }
    final claims = signer.verify(h.substring(7).trim());
    final sub = claims?['sub'];
    final user = sub is String && isUuid(sub) ? await users.findById(sub) : null;
    if (user == null) {
      throw HttpError.body(401, {'statusCode': 401, 'message': 'Unauthorized'})..headers = {'www-authenticate': 'Bearer realm="superponto", error="invalid_token"'};
    }
    ctx.user = user;
    ctx.claims = claims;
  }
}

/// Rótulo comum de auditoria para módulos.
typedef AuditMeta = Map<String, Object?>;
