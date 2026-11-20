// Formatos de credenciais compatíveis com os dados já gravados pela API (tokens, hash de senha, JWT, segredos).
import 'dart:convert';
import 'dart:typed_data';

import 'package:bcrypt/bcrypt.dart';
import 'package:crypto/crypto.dart' as c;
import 'package:unorm_dart/unorm_dart.dart' as unorm;

import 'openssl.dart';

String b64url(List<int> bytes) => base64Url.encode(bytes).replaceAll('=', '');
Uint8List b64urlDecode(String s) => base64Url.decode(s.padRight((s.length + 3) ~/ 4 * 4, '='));
String b64(List<int> bytes) => base64.encode(bytes).replaceAll('=', '');
Uint8List b64Decode(String s) => base64.decode(s.padRight((s.length + 3) ~/ 4 * 4, '='));

/// Token opaco aleatório (32 bytes → 43 caracteres base64url).
String randomToken([int bytes = 32]) => b64url(randomBytes(bytes));
final tokenPattern = RegExp(r'^[A-Za-z0-9_-]{43}$');
String sha256B64url(String value) => b64url(c.sha256.convert(utf8.encode(value)).bytes);
String sha256Hex(List<int> data) => c.sha256.convert(data).toString();

bool safeEqualBytes(List<int> a, List<int> b) {
  if (a.length != b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff == 0;
}

bool safeEqual(String a, String b) => safeEqualBytes(utf8.encode(a), utf8.encode(b));

String nfkc(String s) => unorm.nfkc(s);
String nfc(String s) => unorm.nfc(s);

/// HKDF-SHA256 (RFC 5869).
Uint8List hkdf(List<int> ikm, List<int> salt, List<int> info, int length) {
  final prk = c.Hmac(c.sha256, salt.isEmpty ? List<int>.filled(32, 0) : salt).convert(ikm).bytes;
  final out = <int>[];
  var t = <int>[];
  for (var i = 1; out.length < length; i++) {
    t = c.Hmac(c.sha256, prk).convert([...t, ...info, i]).bytes;
    out.addAll(t);
  }
  return Uint8List.fromList(out.sublist(0, length));
}

// ---------------------------------------------------------------- senhas

const maxPasswordBytes = 4096;

Uint8List? encodePassword(String password) {
  if (password.length > maxPasswordBytes) return null;
  final input = utf8.encode(nfkc(password));
  if (input.isEmpty || input.length > maxPasswordBytes) return null;
  return Uint8List.fromList(input);
}

bool isHashablePassword(Object? password) => password is String && encodePassword(password) != null;

final _phc = RegExp(r'^\$scrypt\$ln=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$');
final _bcrypt = RegExp(r'^\$2[aby]\$\d{2}\$');
bool isLegacyHash(String hash) => RegExp(r'^\$2[aby]\$').hasMatch(hash);

/// scrypt no formato PHC (`$scrypt$ln=17,r=8,p=1$sal$hash`), igual ao PasswordHasher da API em Node.
class PasswordHasher {
  const PasswordHasher({this.logN = 17, this.r = 8, this.p = 1, this.keyLength = 32, this.saltLength = 16});
  final int logN, r, p, keyLength, saltLength;
  static String? _dummy;

  Future<String> hash(String password) async {
    final input = encodePassword(password);
    if (input == null) throw ArgumentError('Senha vazia ou longa demais');
    final salt = randomBytes(saltLength);
    final key = await scrypt(input, salt, n: 1 << logN, r: r, p: p, keyLength: keyLength);
    return '\$scrypt\$ln=$logN,r=$r,p=$p\$${b64(salt)}\$${b64(key)}';
  }

  /// Confere a senha. Sem hash, gasta o mesmo tempo (não revela se a conta existe). Aceita bcrypt da v1.
  Future<bool> verify(String password, String? encoded) async {
    if (encoded != null && _bcrypt.hasMatch(encoded)) {
      try {
        return BCrypt.checkpw(password, encoded);
      } catch (_) {
        return false;
      }
    }
    final m = encoded == null ? null : _phc.firstMatch(encoded);
    if (m == null) {
      await verify(password, _dummy ??= await hash('dummy password for timing equalisation'));
      return false;
    }
    final input = encodePassword(password);
    if (input == null) return false;
    final ln = int.parse(m[1]!), rr = int.parse(m[2]!), pp = int.parse(m[3]!);
    if (ln < 10 || ln > 22 || rr < 1 || rr > 32 || pp < 1 || pp > 16) return false;
    final salt = b64Decode(m[4]!), expected = b64Decode(m[5]!);
    final actual = await scrypt(input, salt, n: 1 << ln, r: rr, p: pp, keyLength: expected.length);
    return safeEqualBytes(actual, expected);
  }

  bool needsRehash(String encoded) {
    final m = _phc.firstMatch(encoded);
    if (m == null) return true;
    return int.parse(m[1]!) != logN || int.parse(m[2]!) != r || int.parse(m[3]!) != p || b64Decode(m[5]!).length != keyLength || b64Decode(m[4]!).length < saltLength;
  }
}

/// Impressão digital do hash (o link de redefinição perde a validade quando a senha muda).
String passwordFingerprint(String? passwordHash) => sha256B64url('nestjs-authentication password-reset v1 ${passwordHash ?? ""}');

// ---------------------------------------------------------------- JWT HS256

class JwtSigner {
  JwtSigner({required String key, required this.issuer, required this.audience, this.ttlSeconds = 900}) : _key = utf8.encode(key);
  final List<int> _key;
  final String issuer, audience;
  final int ttlSeconds;

  String sign(Map<String, Object?> claims, {DateTime? now}) {
    final iat = (now ?? DateTime.now()).millisecondsSinceEpoch ~/ 1000;
    final payload = {'iss': issuer, 'aud': audience, 'jti': randomToken(16), ...claims, 'iat': iat, 'exp': iat + ttlSeconds};
    final head = b64url(utf8.encode(jsonEncode({'alg': 'HS256', 'typ': 'JWT'})));
    final body = b64url(utf8.encode(jsonEncode(payload)));
    final sig = b64url(c.Hmac(c.sha256, _key).convert(utf8.encode('$head.$body')).bytes);
    return '$head.$body.$sig';
  }

  /// Claims verificadas, ou null (assinatura, algoritmo, emissor, público e validade).
  Map<String, Object?>? verify(String token, {DateTime? now}) {
    final parts = token.split('.');
    if (parts.length != 3) return null;
    try {
      final header = jsonDecode(utf8.decode(b64urlDecode(parts[0])));
      if (header is! Map || header['alg'] != 'HS256') return null;
      final typ = header['typ'];
      if (typ is! String || typ.toLowerCase().replaceFirst('application/', '') != 'jwt') return null;
      final expected = c.Hmac(c.sha256, _key).convert(utf8.encode('${parts[0]}.${parts[1]}')).bytes;
      if (!safeEqualBytes(expected, b64urlDecode(parts[2]))) return null;
      final claims = jsonDecode(utf8.decode(b64urlDecode(parts[1])));
      if (claims is! Map<String, Object?>) return null;
      final t = (now ?? DateTime.now()).millisecondsSinceEpoch / 1000;
      final exp = claims['exp'], nbf = claims['nbf'];
      if (exp is! num || t >= exp) return null;
      if (nbf is num && t < nbf) return null;
      if (claims['iss'] != issuer) return null;
      final aud = claims['aud'];
      if (!(aud == audience || (aud is List && aud.contains(audience)))) return null;
      return claims;
    } catch (_) {
      return null;
    }
  }
}

// ---------------------------------------------------------------- cifras

/// Segredo TOTP cifrado: `v1.<keyId>.<iv>.<dados>.<tag>` (AES-256-GCM, chave via HKDF), compatível com a API em Node.
class SecretCipher {
  SecretCipher(List<String> keys) : _keys = [for (final k in keys) _derive(k)];
  final List<({String id, Uint8List key})> _keys;

  static ({String id, Uint8List key}) _derive(String secret) {
    final key = hkdf(utf8.encode(secret), const [], utf8.encode('nestjs-authentication totp-secret v1'), 32);
    return (id: b64url(c.sha256.convert(key).bytes).substring(0, 8), key: key);
  }

  String encrypt(String plain, String userId) {
    final k = _keys.first;
    final iv = randomBytes(12);
    final r = aesGcmEncrypt(k.key, iv, utf8.encode(plain), aad: utf8.encode('v1.${k.id}.totp.$userId'));
    return 'v1.${k.id}.${b64url(iv)}.${b64url(r.data)}.${b64url(r.tag)}';
  }

  String? decrypt(String stored, String userId) {
    final p = stored.split('.');
    if (p.length != 5 || p[0] != 'v1') return null;
    for (final k in _keys) {
      if (k.id != p[1]) continue;
      try {
        return utf8.decode(aesGcmDecrypt(k.key, b64urlDecode(p[2]), b64urlDecode(p[3]), b64urlDecode(p[4]), aad: utf8.encode('v1.${k.id}.totp.$userId')));
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}

/// Cifra de campos (digitais, senhas de integração): `v1.<iv>.<tag>.<dados>` em base64url.
class FieldCipher {
  FieldCipher(String keyBase64) : _key = base64.decode(keyBase64) {
    if (_key.length != 32) throw ArgumentError('A chave de cifra precisa ter 32 bytes (base64)');
  }
  final Uint8List _key;

  String encrypt(List<int> plain) {
    final iv = randomBytes(12);
    final r = aesGcmEncrypt(_key, iv, plain);
    return ['v1', b64url(iv), b64url(r.tag), b64url(r.data)].join('.');
  }

  Uint8List decrypt(String token) {
    final p = token.split('.');
    if (p.length != 4 || p[0] != 'v1') throw const FormatException('Formato de dado cifrado inválido');
    return aesGcmDecrypt(_key, b64urlDecode(p[1]), b64urlDecode(p[3]), b64urlDecode(p[2]));
  }
}
