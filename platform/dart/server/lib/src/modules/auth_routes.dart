// /v1/auth: token (apps e web), refresh, MFA, troca e redefinição de senha.
import 'package:sp_core/sp_core.dart' show normalizeCnpj;

import '../app.dart';
import '../auth/auth_user.dart';
import '../auth/token_service.dart';
import '../http.dart';
import '../validate.dart';

final _code = Obj({'code': Str(pattern: RegExp(r'^\d{6}$'), patternMessage: 'Código de 6 dígitos')});
final _token = Obj({
  // E-mail, ou (como na v1) usuário + CNPJ da empresa.
  'email': const Str(trim: true, max: 320).optional,
  'username': const Str(trim: true, max: 60).optional,
  'cnpj': const Str(trim: true, max: 20).optional,
  'password': const Str(min: 1, max: 256),
  'code': Str(pattern: RegExp(r'^\d{6}$')).optional,
  'recoveryCode': const Str(trim: true, min: 6, max: 40).optional,
});
const _pwMsg = 'A senha precisa de 6 ou mais caracteres, com letra maiúscula, minúscula, número e símbolo';
/// Política de senha: 6+ caracteres com maiúscula, minúscula, número e símbolo.
final strongPassword = const Str(min: 6, max: 128, message: _pwMsg).refine((v) {
  final s = v as String;
  return RegExp(r'[A-Z]').hasMatch(s) && RegExp(r'[a-z]').hasMatch(s) && RegExp(r'\d').hasMatch(s) && RegExp(r'[^A-Za-z0-9]').hasMatch(s);
}, _pwMsg);
final _change = Obj({'currentPassword': const Str(min: 1, max: 256), 'newPassword': strongPassword});
final _refresh = Obj({'refreshToken': const Str(min: 1)});
final _forgot = Obj({'email': email});
final _reset = Obj({'token': const Str(min: 1), 'password': strongPassword});
final _signOut = Obj({'refreshToken': const Str().optional});

void authRoutes(App app) {
  final r = app.router;
  r.group('/v1/auth', tag: 'auth', () {
    // Login dos apps e da web: access token (15 min) + refresh token rotativo.
    r.post('/token', access: Access.public, status: 200, throttle: 10, (ctx) async {
      final b = _token.parse(ctx.body);
      AuthUser? user;
      if (b['email'] != null) {
        user = await app.credentials.verify(b['email']! as String, b['password']! as String, ctx.meta);
        if (user == null) throw unauthorized('E-mail ou senha incorretos');
      } else {
        final username = (b['username'] as String?)?.toLowerCase() ?? '';
        final cnpj = normalizeCnpj((b['cnpj'] as String?) ?? '');
        if (username.isEmpty || cnpj.isEmpty) throw badRequest('Informe o e-mail, ou o usuário e o CNPJ da empresa');
        // Se mais de um cliente tiver esse CNPJ e esse usuário, entra na conta cuja senha confere.
        // Usuário/CNPJ inexistente passa pela mesma verificação de senha (mesmo tempo de resposta).
        final emails = await _emailsFor(app, username, cnpj);
        for (final e in emails.isEmpty ? ['inexistente@login.invalid'] : emails) {
          user = await app.credentials.verify(e, b['password']! as String, ctx.meta);
          if (user != null) break;
        }
        if (user == null) throw unauthorized('Usuário, CNPJ ou senha incorretos');
      }
      try {
        return await app.tokens.issue(
          user.id,
          claims: {
            'amr': ['pwd'],
          },
          code: b['code'] as String?,
          recoveryCode: b['recoveryCode'] as String?,
        );
      } on MfaRequired catch (e) {
        throw HttpError.body(401, {'message': e.attempted ? 'Código incorreto ou expirado' : 'Informe o código do aplicativo autenticador', 'mfaRequired': true});
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

    // Aceite dos documentos legais (LGPD): último aceite e registro com versão, data/hora, IP e aparelho.
    r.get('/legal-consent', (ctx) async {
      final row = await app.db.asPlatform((tx) => tx.one('SELECT version, accepted_at FROM legal_consents WHERE user_id = @u ORDER BY accepted_at DESC LIMIT 1', {'u': ctx.user.id}));
      return {'version': row?['version'], 'acceptedAt': row?['acceptedAt']};
    });
    r.post('/legal-consent', status: 201, (ctx) async {
      final v = Obj({'version': const Str(trim: true, min: 1, max: 40)}).parse(ctx.body)['version'];
      await app.db.asPlatform((tx) => tx.execute(
        'INSERT INTO legal_consents (user_id, tenant_id, version, ip, user_agent) VALUES (@u, @t, @v, @ip, @ua)',
        {'u': ctx.user.id, 't': ctx.user.tenantId, 'v': v, 'ip': ctx.ip, 'ua': ctx.userAgent},
      ));
      return {'version': v};
    });

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

/// E-mails das contas pelo login da v1: usuário dentro do(s) cliente(s) dono(s) da empresa com esse CNPJ.
Future<List<String>> _emailsFor(App app, String username, String cnpj) => app.db.asPlatform((tx) async {
      final rows = await tx.query(
        'SELECT DISTINCT u.email FROM users u JOIN companies c ON c.tenant_id = u.tenant_id AND c.deleted_at IS NULL '
        'WHERE c.cnpj = @c AND u.username = @u AND u.deleted_at IS NULL ORDER BY u.email LIMIT 5',
        {'c': cnpj, 'u': username},
      );
      return [for (final r in rows) r['email']! as String];
    });
