// /v1/auth: token (apps e web), refresh, MFA, troca e redefinição de senha.
import '../app.dart';
import '../auth/token_service.dart';
import '../http.dart';
import '../validate.dart';

final _code = Obj({'code': Str(pattern: RegExp(r'^\d{6}$'), patternMessage: 'Código de 6 dígitos')});
final _token = Obj({
  'email': const Str(max: 320),
  'password': const Str(min: 1, max: 256),
  'code': Str(pattern: RegExp(r'^\d{6}$')).optional,
  'recoveryCode': const Str(trim: true, min: 6, max: 40).optional,
});
final _change = Obj({
  'currentPassword': const Str(min: 1, max: 256),
  'newPassword': const Str(min: 12, max: 128, message: 'A nova senha precisa de 12 caracteres ou mais'),
});
final _refresh = Obj({'refreshToken': const Str(min: 1)});
final _forgot = Obj({'email': email});
final _reset = Obj({'token': const Str(min: 1), 'password': const Str(min: 12, max: 128)});
final _signOut = Obj({'refreshToken': const Str().optional});

void authRoutes(App app) {
  final r = app.router;
  r.group('/v1/auth', tag: 'auth', () {
    // Login dos apps e da web: access token (15 min) + refresh token rotativo.
    r.post('/token', access: Access.public, status: 200, throttle: 10, (ctx) async {
      final b = _token.parse(ctx.body);
      final user = await app.credentials.verify(b['email']! as String, b['password']! as String, ctx.meta);
      if (user == null) throw unauthorized('E-mail ou senha incorretos');
      try {
        return await app.tokens.issue(user.id, claims: {'amr': ['pwd']}, code: b['code'] as String?, recoveryCode: b['recoveryCode'] as String?);
      } on MfaRequired catch (e) {
        throw HttpError.body(401, {
          'message': e.attempted ? 'Código incorreto ou expirado' : 'Informe o código do aplicativo autenticador',
          'mfaRequired': true,
        });
      }
    });

    r.post('/token/refresh', access: Access.public, status: 200, throttle: 30, (ctx) {
      final b = _refresh.parse(ctx.body);
      return app.tokens.refresh(b['refreshToken']);
    });

    // Sair: encerra a família do refresh token informado.
    r.post('/sign-out', status: 204, (ctx) async {
      final b = _signOut.parse(ctx.body ?? <String, Object?>{});
      if (b['refreshToken'] != null) await app.tokens.revoke(b['refreshToken']);
      return null;
    });

    r.get('/me', (ctx) => ctx.user.toPublic());

    r.get('/mfa', (ctx) async {
      final enrolled = await app.mfa.isEnrolled(ctx.user.id);
      return {'enrolled': enrolled, 'recoveryCodesLeft': enrolled ? await app.mfa.remainingRecoveryCodes(ctx.user.id) : 0};
    });

    r.post('/mfa/enroll', status: 200, throttle: 10, (ctx) async {
      final res = await app.mfa.enroll(ctx.user.id, ctx.user.email);
      if (res == null) throw HttpError.body(409, {'statusCode': 409, 'error': 'mfa_already_enrolled', 'message': 'MFA is already enrolled', 'errorCode': 'mfa_already_enrolled'});
      return res;
    });

    r.post('/mfa/confirm', status: 200, throttle: 10, (ctx) async {
      final b = _code.parse(ctx.body);
      if (!await app.mfa.confirm(ctx.user.id, b['code']! as String)) {
        throw badRequest('Código incorreto: confira a hora do celular e tente de novo');
      }
      await app.credentials.logMfa(ctx.user.id, 'enabled');
      return {'recoveryCodes': await app.mfa.generateRecoveryCodes(ctx.user.id)};
    });

    r.post('/mfa/recovery-codes', access: Access.mfa, status: 200, (ctx) async => {'recoveryCodes': await app.mfa.generateRecoveryCodes(ctx.user.id)});

    r.post('/mfa/disable', access: Access.mfa, status: 204, (ctx) async {
      final b = _code.parse(ctx.body);
      if (!await app.mfa.verifyTotp(ctx.user.id, b['code'] as String?)) throw badRequest('Código incorreto');
      await app.mfa.disable(ctx.user.id);
      await app.credentials.logMfa(ctx.user.id, 'disabled');
      return null;
    });

    r.post('/password/change', status: 204, throttle: 10, (ctx) async {
      final b = _change.parse(ctx.body);
      await app.credentials.change(ctx.user.id, b['currentPassword']! as String, b['newPassword']! as String, ctx.meta);
      return null;
    });

    // Mesma resposta, no mesmo tempo, exista ou não a conta.
    r.post('/password/forgot', access: Access.public, status: 202, throttle: 5, (ctx) {
      final b = _forgot.parse(ctx.body);
      app.passwordReset.request(b['email']! as String);
      return null;
    });

    r.post('/password/reset', access: Access.public, status: 200, throttle: 10, (ctx) async {
      final b = _reset.parse(ctx.body);
      if (!await app.passwordReset.reset(b['token']! as String, b['password']! as String)) throw badRequest('Link inválido ou expirado');
      return {'ok': true};
    });
  });
}
