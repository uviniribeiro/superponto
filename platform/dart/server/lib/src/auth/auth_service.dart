// Credenciais (senha local ou LDAP) e redefinição de senha por link de e-mail.
import 'dart:async';
import 'dart:io';

import '../crypto/tokens.dart';
import '../db.dart';
import '../http.dart';
import '../mail.dart';
import 'auth_user.dart';
import 'token_service.dart';
import 'users.dart';

/// Autenticação no diretório LDAP do cliente (implementada no módulo LDAP).
abstract class LdapAuthenticator {
  /// 'ok', 'invalid', 'unreachable' ou 'config'
  Future<String> authenticate(Row config, String email, String password);
}

class CredentialsService {
  CredentialsService(this.users, this.hasher, {this.ldap});
  final UsersRepository users;
  final PasswordHasher hasher;
  LdapAuthenticator? ldap;

  Future<String> hash(String password) => hasher.hash(password);

  /// Usuário ou null. E-mail inexistente e senha errada levam o mesmo tempo (hash fictício).
  Future<AuthUser?> verify(String email, String password, [Map<String, Object?>? meta]) async {
    final found = await users.findCredentials(email);
    if (found?.authSource == 'LDAP') return _verifyLdap(found!, email, password, meta);
    final valid = await hasher.verify(password, found?.passwordHash);
    if (!valid || found?.passwordHash == null) {
      if (found != null) await users.logAccess(found.user.id, 'LOGIN_FAILED', 'session', {'method': 'password'}, meta);
      return null;
    }
    // Só depois da senha correta: não revela a quem não sabe a senha se a conta existe.
    if (found!.denial != null) {
      await users.logAccess(found.user.id, 'LOGIN_FAILED', 'session', {'method': 'password', 'reason': 'access_denied'}, meta);
      throw forbidden(found.denial!);
    }
    if (isLegacyHash(found.passwordHash!) || hasher.needsRehash(found.passwordHash!)) {
      await users.updatePasswordHash(found.user.id, await hasher.hash(password));
    }
    await users.recordLogin(found.user.id);
    await users.logAccess(found.user.id, 'LOGIN', 'session', {'method': 'password'}, meta);
    return found.user;
  }

  Future<AuthUser?> _verifyLdap(Credentials found, String email, String password, Map<String, Object?>? meta) async {
    final cfg = found.user.tenantId == null ? null : await users.findLdapConfig(found.user.tenantId!);
    if (cfg == null || ldap == null) return null;
    final result = await ldap!.authenticate(cfg, email, password);
    if (result != 'ok') {
      if (result == 'unreachable' || result == 'config') {
        throw unavailable('Não foi possível falar com o diretório da sua organização (LDAP). Tente novamente ou fale com o administrador.');
      }
      await users.logAccess(found.user.id, 'LOGIN_FAILED', 'session', {'method': 'ldap'}, meta);
      return null;
    }
    if (found.denial != null) {
      await users.logAccess(found.user.id, 'LOGIN_FAILED', 'session', {'method': 'ldap', 'reason': 'access_denied'}, meta);
      throw forbidden(found.denial!);
    }
    await users.recordLogin(found.user.id);
    await users.logAccess(found.user.id, 'LOGIN', 'session', {'method': 'ldap'}, meta);
    return found.user;
  }

  Future<void> logMfa(String userId, String change) => users.logAccess(userId, 'UPDATE', 'user_mfa', {'change': change});

  /// Troca de senha pelo próprio usuário (confere a atual).
  Future<void> change(String userId, String current, String next, Map<String, Object?> meta) async {
    if (await users.findAuthSource(userId) == 'LDAP') {
      throw badRequest('Sua senha é a mesma da rede da organização (LDAP): troque-a no diretório da empresa');
    }
    final h = await users.findHashById(userId);
    if (h == null || !await hasher.verify(current, h)) throw badRequest('Senha atual incorreta');
    if (current == next) throw badRequest('A nova senha deve ser diferente da atual');
    await users.updatePasswordHash(userId, await hasher.hash(next));
    await users.logAccess(userId, 'UPDATE', 'user_password', {'via': 'change'}, meta);
  }
}

class PasswordResetService {
  PasswordResetService(this.db, this.users, this.hasher, this.tokens, this.mail, this.appUrl);
  final Db db;
  final UsersRepository users;
  final PasswordHasher hasher;
  final TokenService tokens;
  final MailService mail;
  final String appUrl;
  static const _ttl = Duration(hours: 1);
  final _inFlight = <Future<void>>{};

  /// Mesma resposta e tempo exista ou não a conta: o envio acontece depois, fora da requisição.
  void request(String email) {
    final requested = normalizeEmail(email);
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(requested) || requested.length > 320) return;
    late final Future<void> work;
    work = Future<void>(() => _issue(requested))
        .catchError((Object e, StackTrace s) {
          stderr.writeln('Falha ao enviar redefinição de senha: $e');
        })
        .whenComplete(() => _inFlight.remove(work));
    _inFlight.add(work);
  }

  Future<void> drain() => Future.wait(_inFlight.toList());

  Future<({String id, String email, String? hash})?> _findUser(String email) async {
    final found = await users.findCredentials(email);
    // Conta LDAP não tem senha local: a redefinição é feita no diretório da organização.
    if (found == null || found.authSource == 'LDAP') return null;
    return (id: found.user.id, email: found.user.email, hash: found.passwordHash);
  }

  Future<void> _issue(String requested) async {
    final account = await _findUser(requested);
    if (account == null) return;
    final token = randomToken();
    final now = DateTime.now();
    final expiresAt = now.add(_ttl);
    await db.plain((tx) async {
      await tx.execute('INSERT INTO auth_email_tokens (id, purpose, user_id, email, fingerprint, created_at, expires_at) VALUES (@id, @p, @u, @e, @f, @c, @x)', {
        'id': sha256B64url(token),
        'p': 'password-reset',
        'u': account.id,
        'e': account.email,
        'f': passwordFingerprint(account.hash),
        'c': now,
        'x': expiresAt,
      });
      await tx.execute('DELETE FROM auth_email_tokens WHERE expires_at <= @n', {'n': now});
    });
    final url = Uri.parse('$appUrl/reset-password').replace(queryParameters: {'token': token}).toString();
    await mail.send(
      OutgoingMail(
        to: account.email,
        subject: 'SuperPonto — redefinição de senha',
        text: 'Recebemos um pedido para redefinir sua senha.\n\nAbra o link (válido uma vez, por 1 hora):\n$url\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.',
        html:
            '<p>Recebemos um pedido para redefinir sua senha do SuperPonto.</p><p><a href="${escapeHtml(url)}">Definir nova senha</a></p><p>O link funciona uma vez, por 1 hora. Se não foi você, ignore este e-mail.</p>',
      ),
    );
  }

  /// true se a senha foi trocada. O link vale uma vez, por 1 hora, enquanto e-mail e senha não mudarem.
  Future<bool> reset(String token, String password) async {
    if (!tokenPattern.hasMatch(token) || !isHashablePassword(password)) return false;
    final record = await db.plain((tx) => tx.one('DELETE FROM auth_email_tokens WHERE id = @id AND purpose = @p RETURNING *', {'id': sha256B64url(token), 'p': 'password-reset'}));
    if (record == null || !DateTime.now().isBefore(record['expiresAt']! as DateTime)) return false;
    final account = await _findUser(normalizeEmail(record['email']! as String));
    if (account == null || account.id != record['userId'] || account.email != record['email'] || !safeEqual(passwordFingerprint(account.hash), record['fingerprint'] as String? ?? '')) {
      return false;
    }
    final hash = await hasher.hash(password);
    await tokens.revokeAll(account.id);
    await users.updatePasswordHash(account.id, hash);
    await users.logAccess(account.id, 'UPDATE', 'user_password', {'via': 'reset'});
    await db.plain((tx) => tx.execute('DELETE FROM auth_email_tokens WHERE user_id = @u AND purpose = @p', {'u': account.id, 'p': 'password-reset'}));
    await tokens.revokeAll(account.id);
    return true;
  }
}
