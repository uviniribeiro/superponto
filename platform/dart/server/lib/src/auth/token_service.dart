// Access token (JWT 15 min) e refresh token rotativo (30 dias, família de até 90 dias; reuso revoga a família).
import '../crypto/tokens.dart';
import '../db.dart';
import '../http.dart';
import 'mfa.dart';

class MfaRequired implements Exception {
  MfaRequired({required this.attempted});
  final bool attempted;
}

class TokenService {
  TokenService(this.db, this.signer, this.mfa);
  final Db db;
  final JwtSigner signer;
  final MfaService mfa;
  static const _ttl = Duration(days: 30), _absolute = Duration(days: 90);

  /// Emite o par de tokens. Com MFA ativo, exige código TOTP ou de recuperação ([MfaRequired] se faltar ou errar).
  Future<Map<String, Object?>> issue(String userId, {Map<String, Object?> claims = const {}, String? code, String? recoveryCode}) async {
    var verified = false;
    if (await mfa.isEnrolled(userId)) {
      final hasCode = (code ?? '').isNotEmpty, hasRecovery = (recoveryCode ?? '').isNotEmpty;
      if (!hasCode && !hasRecovery) throw MfaRequired(attempted: false);
      verified = hasRecovery ? await mfa.verifyRecoveryCode(userId, recoveryCode) : await mfa.verifyTotp(userId, code);
      if (!verified) throw MfaRequired(attempted: true);
    }
    final amr = [...((claims['amr'] as List?) ?? const []), if (verified) 'mfa'];
    final family = {...claims, if (amr.isNotEmpty) 'amr': amr};
    final now = DateTime.now();
    return db.plain((tx) async {
      final token = await _create(tx, userId, randomToken(16), now.add(_absolute), family, now);
      return _pair(token, userId, family);
    });
  }

  Future<String> _create(Tx tx, String userId, String familyId, DateTime familyExpiresAt, Map<String, Object?>? claims, DateTime now) async {
    final token = randomToken();
    final exp = now.add(_ttl).isBefore(familyExpiresAt) ? now.add(_ttl) : familyExpiresAt;
    await tx.execute(
      'INSERT INTO auth_refresh_tokens (id, family_id, user_id, created_at, expires_at, family_expires_at, claims, revoked) '
      'VALUES (@id, @f, @u, @c, @e, @fe, @cl, false)',
      {'id': sha256B64url(token), 'f': familyId, 'u': userId, 'c': now, 'e': exp, 'fe': familyExpiresAt, 'cl': claims == null || claims.isEmpty ? null : jsonb(claims)},
    );
    await tx.execute('DELETE FROM auth_refresh_tokens WHERE family_expires_at <= @n', {'n': now});
    return token;
  }

  Map<String, Object?> _pair(String refresh, String userId, Map<String, Object?>? claims) =>
      {'accessToken': signer.sign({...?claims, 'sub': userId}), 'refreshToken': refresh, 'expiresIn': signer.ttlSeconds};

  static HttpError _refusal(String reason) => HttpError(401, 'Refresh token $reason');

  Future<Map<String, Object?>> refresh(Object? refreshToken) async {
    if (refreshToken is! String || !tokenPattern.hasMatch(refreshToken)) throw _refusal('invalid');
    return db.plain((tx) async {
      final rec = await tx.one('SELECT * FROM auth_refresh_tokens WHERE id = @id', {'id': sha256B64url(refreshToken)});
      if (rec == null) throw _refusal('invalid');
      final revoked = await tx.scalar<bool>('SELECT bool_or(revoked) FROM auth_refresh_tokens WHERE family_id = @f', {'f': rec['familyId']});
      if (revoked == true) throw _refusal('invalid');
      final now = DateTime.now();
      final expired = !now.isBefore(rec['expiresAt']! as DateTime) || !now.isBefore(rec['familyExpiresAt']! as DateTime);
      if (expired && rec['usedAt'] == null) throw _refusal('expired');
      if (rec['usedAt'] != null) throw await _reused(tx, rec);
      final claims = (rec['claims'] as Map?)?.cast<String, Object?>();
      final next = await _create(tx, rec['userId']! as String, rec['familyId']! as String, rec['familyExpiresAt']! as DateTime, claims, now);
      final marked = await tx.execute('UPDATE auth_refresh_tokens SET used_at = @n WHERE id = @id AND used_at IS NULL', {'n': now, 'id': rec['id']});
      if (marked != 1) throw await _reused(tx, rec);
      return _pair(next, rec['userId']! as String, claims);
    });
  }

  Future<HttpError> _reused(Tx tx, Row rec) async {
    await tx.execute('UPDATE auth_refresh_tokens SET revoked = true WHERE family_id = @f', {'f': rec['familyId']});
    return _refusal('reused');
  }

  /// Encerra a família do refresh token (sair do app).
  Future<bool> revoke(Object? refreshToken) async {
    if (refreshToken is! String || !tokenPattern.hasMatch(refreshToken)) return false;
    return db.plain((tx) async {
      final rec = await tx.one('SELECT family_id FROM auth_refresh_tokens WHERE id = @id', {'id': sha256B64url(refreshToken)});
      if (rec == null) return false;
      await tx.execute('UPDATE auth_refresh_tokens SET revoked = true WHERE family_id = @f', {'f': rec['familyId']});
      return true;
    });
  }

  /// Revoga todos os refresh tokens e sessões do usuário (troca ou redefinição de senha).
  Future<void> revokeAll(String userId) => db.plain((tx) async {
        await tx.execute('UPDATE auth_refresh_tokens SET revoked = true WHERE user_id = @u', {'u': userId});
        await tx.execute('DELETE FROM auth_sessions WHERE user_id = @u', {'u': userId});
      });
}
