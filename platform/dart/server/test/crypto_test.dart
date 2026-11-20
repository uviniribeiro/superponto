import 'dart:convert';
import 'dart:io';

import 'package:sp_server/src/auth/mfa.dart';
import 'package:sp_server/src/crypto/tokens.dart';
import 'package:test/test.dart';

void main() {
  final fx = jsonDecode(File('test/crypto_fixture.json').readAsStringSync()) as Map<String, Object?>;
  const hasher = PasswordHasher();

  test('confere senhas gravadas pela API em Node (scrypt, NFKC e bcrypt da v1)', () async {
    expect(await hasher.verify('Senha-Muito-Forte-2026', fx['hash']! as String), isTrue);
    expect(await hasher.verify('senha-errada', fx['hash']! as String), isFalse);
    expect(await hasher.verify('fi1', fx['hashNfkc']! as String), isTrue);
    expect(await hasher.verify('v1-senha', fx['bcrypt']! as String), isTrue);
    expect(await hasher.verify('x', null), isFalse);
    expect(hasher.needsRehash(fx['hash']! as String), isFalse);
    expect(hasher.needsRehash(fx['bcrypt']! as String), isTrue);
  });

  test('hash novo é verificável e no formato PHC', () async {
    final h = await hasher.hash('Outra-Senha-Forte');
    expect(h, startsWith(r'$scrypt$ln=17,r=8,p=1$'));
    expect(await hasher.verify('Outra-Senha-Forte', h), isTrue);
  });

  test('segredo TOTP cifrado pela API em Node abre aqui, e o inverso tem o mesmo formato', () {
    final c = SecretCipher([fx['key']! as String]);
    expect(c.decrypt(fx['totp']! as String, 'u-1'), 'JBSWY3DPEHPK3PXP');
    expect(c.decrypt(fx['totp']! as String, 'u-2'), isNull);
    final mine = c.encrypt('ABC', 'u-9');
    expect(mine.split('.').take(2).join('.'), (fx['totp']! as String).split('.').take(2).join('.'));
    expect(c.decrypt(mine, 'u-9'), 'ABC');
  });

  test('código de recuperação: mesmo hash da API em Node', () async {
    expect(await hashRecoveryCode('u-1', normalizeRecoveryCode('abcde-23456')), fx['rc']);
  });

  test('HOTP (RFC 4226) e base32', () {
    final key = utf8.encode('12345678901234567890');
    expect([for (var i = 0; i < 4; i++) hotp(key, i)], ['755224', '287082', '359152', '969429']);
    expect(base32Decode(base32Encode(key)), key);
  });

  test('JWT assina e verifica; recusa outro emissor, adulteração e expiração', () {
    final s = JwtSigner(key: 'x' * 40, issuer: 'http://api', audience: 'superponto');
    final t = s.sign({'sub': 'u', 'amr': ['pwd']});
    expect(s.verify(t)?['sub'], 'u');
    expect(JwtSigner(key: 'x' * 40, issuer: 'http://outra', audience: 'superponto').verify(t), isNull);
    expect(s.verify('${t.substring(0, t.length - 2)}aa'), isNull);
    expect(s.verify(s.sign({'sub': 'u'}, now: DateTime.now().subtract(const Duration(hours: 1)))), isNull);
  });
}
