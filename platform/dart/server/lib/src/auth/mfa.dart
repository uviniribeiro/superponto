// Verificação em duas etapas (TOTP, RFC 6238) e códigos de recuperação, com os mesmos formatos gravados pela API em Node.
import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:crypto/crypto.dart' as c;

import '../crypto/openssl.dart';
import '../crypto/tokens.dart';
import '../db.dart';

const _alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const _codeAlphabet = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

String base32Encode(List<int> data) {
  var bits = 0, value = 0;
  final out = StringBuffer();
  for (final byte in data) {
    value = ((value << 8) | byte) & 0xFFFFFF;
    bits += 8;
    while (bits >= 5) {
      out.write(_alphabet[(value >> (bits - 5)) & 31]);
      bits -= 5;
    }
  }
  if (bits > 0) out.write(_alphabet[(value << (5 - bits)) & 31]);
  return out.toString();
}

Uint8List? base32Decode(String input) {
  final clean = input.replaceFirst(RegExp(r'=+$'), '').toUpperCase();
  final bytes = <int>[];
  var bits = 0, value = 0;
  for (final ch in clean.split('')) {
    final i = _alphabet.indexOf(ch);
    if (i < 0) return null;
    value = ((value << 5) | i) & 0xFFFFFF;
    bits += 5;
    if (bits >= 8) {
      bytes.add((value >> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8List.fromList(bytes);
}

String hotp(List<int> key, int counter, [int digits = 6]) {
  final msg = ByteData(8)..setUint64(0, counter);
  final mac = c.Hmac(c.sha1, key).convert(msg.buffer.asUint8List()).bytes;
  final o = mac.last & 0x0f;
  final bin = ((mac[o] & 0x7f) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3];
  return (bin % pow(10, digits).toInt()).toString().padLeft(digits, '0');
}

String normalizeRecoveryCode(String code) => code.toUpperCase().replaceAll(RegExp(r'[\s-]'), '');

Future<String> hashRecoveryCode(String userId, String normalized) async {
  final key = await scrypt(utf8.encode(normalized), utf8.encode('nestjs-authentication recovery-code v1 $userId'), n: 1 << 14, r: 8, p: 1, keyLength: 32);
  return 'rc1.${b64url(key)}';
}

class MfaService {
  MfaService(this.db, String encryptionKey, {this.issuer = 'SuperPonto', this.maxAttempts = 5, this.window = 1}) : _cipher = SecretCipher([encryptionKey]);
  final Db db;
  final SecretCipher _cipher;
  final String issuer;
  final int maxAttempts, window;
  static const _lockout = Duration(minutes: 15);
  final _rng = Random.secure();

  Future<Row?> _get(Tx tx, String userId) => tx.one('SELECT * FROM auth_mfa_authenticators WHERE user_id = @u', {'u': userId});

  Future<void> _save(Tx tx, String userId, {required String secret, required bool confirmed, String? pending, int? lastUsedStep}) => tx.execute(
    'INSERT INTO auth_mfa_authenticators (user_id, secret, confirmed, pending_secret, last_used_step) VALUES (@u, @s, @c, @p, @l) '
    'ON CONFLICT (user_id) DO UPDATE SET secret = EXCLUDED.secret, confirmed = EXCLUDED.confirmed, pending_secret = EXCLUDED.pending_secret, '
    'last_used_step = GREATEST(auth_mfa_authenticators.last_used_step, EXCLUDED.last_used_step)',
    {'u': userId, 's': secret, 'c': confirmed, 'p': pending, 'l': lastUsedStep},
  );

  Future<bool> isEnrolled(String userId) => db.plain((tx) async => (await _get(tx, userId))?['confirmed'] == true);

  /// Começa a ativação: chave nova (pendente até confirmar). Já ativado: 409 fica a cargo da rota.
  Future<Map<String, String>?> enroll(String userId, String accountName) => db.plain((tx) async {
    final current = await _get(tx, userId);
    final secret = base32Encode(randomBytes(20));
    final sealed = _cipher.encrypt(secret, userId);
    if (current?['confirmed'] == true) return null;
    await _save(tx, userId, secret: sealed, confirmed: false);
    return {'secret': secret, 'uri': keyUri(secret, accountName)};
  });

  String keyUri(String secret, String account) {
    final label = '${Uri.encodeComponent(issuer)}:${Uri.encodeComponent(account)}';
    final q = {
      'secret': secret,
      'issuer': issuer,
      'algorithm': 'SHA1',
      'digits': '6',
      'period': '30',
    }.entries.map((e) => '${Uri.encodeQueryComponent(e.key)}=${Uri.encodeQueryComponent(e.value)}').join('&').replaceAll('+', '%20');
    return 'otpauth://totp/$label?$q';
  }

  Future<bool> confirm(String userId, String code) => db.plain((tx) async {
    final rec = await _get(tx, userId);
    if (rec == null) return false;
    final confirmed = rec['confirmed'] == true;
    final candidate = (confirmed ? rec['pendingSecret'] : rec['secret']) as String?;
    if (candidate == null) return false;
    final plain = _cipher.decrypt(candidate, userId);
    if (plain == null || !await _check(tx, userId, plain, code)) return false;
    final latest = await _get(tx, userId);
    if (latest == null || (confirmed ? latest['pendingSecret'] : latest['secret']) != candidate) return false;
    await _save(tx, userId, secret: candidate, confirmed: true, lastUsedStep: latest['lastUsedStep'] as int?);
    return true;
  });

  Future<bool> verifyTotp(String userId, String? code) => db.plain((tx) async {
    final rec = await _get(tx, userId);
    if (rec?['confirmed'] != true) return false;
    final plain = _cipher.decrypt(rec!['secret']! as String, userId);
    return plain != null && await _check(tx, userId, plain, code);
  });

  Future<List<String>> generateRecoveryCodes(String userId, [int count = 10]) async {
    final codes = [
      for (var i = 0; i < count; i++)
        () {
          final chars = List.generate(10, (_) => _codeAlphabet[_rng.nextInt(_codeAlphabet.length)]).join();
          return '${chars.substring(0, 5)}-${chars.substring(5)}';
        }(),
    ];
    final hashes = {for (final code in codes) await hashRecoveryCode(userId, normalizeRecoveryCode(code))};
    await db.plain((tx) async {
      await tx.execute('DELETE FROM auth_mfa_recovery_codes WHERE user_id = @u', {'u': userId});
      for (final h in hashes) {
        await tx.execute('INSERT INTO auth_mfa_recovery_codes (user_id, code_hash) VALUES (@u, @h)', {'u': userId, 'h': h});
      }
    });
    return codes;
  }

  Future<bool> verifyRecoveryCode(String userId, String? code) => db.plain((tx) async {
    if (!await _begin(tx, userId)) return false;
    final normalized = code == null ? '' : normalizeRecoveryCode(code);
    if (normalized.length == 10) {
      final hash = await hashRecoveryCode(userId, normalized);
      final n = await tx.execute('DELETE FROM auth_mfa_recovery_codes WHERE user_id = @u AND code_hash = @h', {'u': userId, 'h': hash});
      if (n == 1) {
        await tx.execute('DELETE FROM auth_mfa_failures WHERE user_id = @u', {'u': userId});
        return true;
      }
    }
    return false;
  });

  Future<int> remainingRecoveryCodes(String userId) => db.plain((tx) async => (await tx.scalar<int>('SELECT count(*)::int FROM auth_mfa_recovery_codes WHERE user_id = @u', {'u': userId})) ?? 0);

  Future<void> disable(String userId) => db.plain((tx) async {
    await tx.execute('DELETE FROM auth_mfa_authenticators WHERE user_id = @u', {'u': userId});
    await tx.execute('DELETE FROM auth_mfa_recovery_codes WHERE user_id = @u', {'u': userId});
  });

  /// Conta a tentativa antes de conferir (limite de 5 por 15 minutos).
  Future<bool> _begin(Tx tx, String userId) async {
    final now = DateTime.now();
    final since = now.subtract(_lockout);
    final failures = await tx.scalar<int>('SELECT count(*)::int FROM auth_mfa_failures WHERE user_id = @u AND failed_at > @s', {'u': userId, 's': since}) ?? 0;
    if (failures >= maxAttempts) return false;
    await tx.execute('INSERT INTO auth_mfa_failures (user_id, failed_at) VALUES (@u, @n)', {'u': userId, 'n': now});
    final attempt = await tx.scalar<int>('SELECT count(*)::int FROM auth_mfa_failures WHERE user_id = @u AND failed_at > @s', {'u': userId, 's': since}) ?? 0;
    await tx.execute('DELETE FROM auth_mfa_failures WHERE failed_at <= @s', {'s': since});
    return attempt <= maxAttempts;
  }

  Future<bool> _check(Tx tx, String userId, String secret, String? code) async {
    if (!await _begin(tx, userId)) return false;
    final step = _matchingStep(secret, code);
    if (step != null) {
      final n = await tx.execute('UPDATE auth_mfa_authenticators SET last_used_step = @s WHERE user_id = @u AND (last_used_step IS NULL OR last_used_step < @s)', {'u': userId, 's': step});
      if (n == 1) {
        await tx.execute('DELETE FROM auth_mfa_failures WHERE user_id = @u', {'u': userId});
        return true;
      }
    }
    return false;
  }

  int? _matchingStep(String secret, String? code) {
    if (code == null || !RegExp(r'^\d{6}$').hasMatch(code)) return null;
    final key = base32Decode(secret);
    if (key == null || key.length < 16) return null;
    final current = DateTime.now().millisecondsSinceEpoch ~/ 1000 ~/ 30;
    int? found;
    for (var s = current - window; s <= current + window; s++) {
      if (safeEqual(hotp(key, s), code) && found == null) found = s;
    }
    return found;
  }
}
