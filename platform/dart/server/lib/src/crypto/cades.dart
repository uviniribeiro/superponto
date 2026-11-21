// Assinatura CAdES (CMS SignedData com o atributo signing-certificate-v2) destacada, em DER (.p7s),
// com o certificado ICP-Brasil A1 (PFX) da empresa. Usa o OpenSSL instalado no servidor: a chave
// privada só existe em claro numa pasta temporária do processo, apagada logo depois.
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

class CertificateError implements Exception {
  CertificateError(this.message);
  final String message;
  @override
  String toString() => message;
}

class CertificateInfo {
  const CertificateInfo({required this.subject, required this.issuer, required this.serialNumber, required this.notBefore, required this.notAfter});
  final String subject, issuer, serialNumber;
  final DateTime notBefore, notAfter;

  /// CNPJ do e-CNPJ ICP-Brasil (o nome comum termina em ":<14 caracteres>").
  String? get cnpj => RegExp(r'CN\s*=\s*[^,]*:([0-9A-Z]{14})').firstMatch(subject)?.group(1);
}

class CadesSigner {
  CadesSigner({String? openssl}) : _bin = openssl ?? Platform.environment['OPENSSL_BIN'] ?? 'openssl';
  final String _bin;

  Future<ProcessResult> _run(List<String> args, String password) =>
      Process.run(_bin, args, environment: {'SP_PFX_PASSWORD': password}, stdoutEncoding: latin1, stderrEncoding: utf8);

  Future<T> _withTemp<T>(Future<T> Function(Directory dir) body) async {
    final dir = await Directory.systemTemp.createTemp('sp-cert-');
    try {
      if (!Platform.isWindows) await Process.run('chmod', ['700', dir.path]);
      return await body(dir);
    } finally {
      await dir.delete(recursive: true);
    }
  }

  /// Extrai do PFX (tenta também o modo legado, de arquivos antigos com RC2/3DES).
  Future<String> _pkcs12(String pfxPath, String password, List<String> what) async {
    for (final legacy in [false, true]) {
      final r = await _run(['pkcs12', '-in', pfxPath, '-passin', 'env:SP_PFX_PASSWORD', ...what, if (legacy) '-legacy'], password);
      if (r.exitCode == 0) return r.stdout as String;
    }
    throw CertificateError('Senha do certificado incorreta ou arquivo PFX inválido');
  }

  Future<void> _requireOpenssl() async {
    try {
      final r = await Process.run(_bin, ['version']);
      if (r.exitCode != 0) throw CertificateError('OpenSSL indisponível no servidor');
    } on ProcessException {
      throw CertificateError('OpenSSL não está instalado no servidor (necessário para a assinatura digital)');
    }
  }

  /// Abre o PFX com a senha e lê os dados do certificado do titular.
  Future<CertificateInfo> inspect(Uint8List pfx, String password) async {
    await _requireOpenssl();
    return _withTemp((dir) async {
      final p = File('${dir.path}/c.pfx');
      await p.writeAsBytes(pfx, flush: true);
      final certPem = await _pkcs12(p.path, password, ['-clcerts', '-nokeys']);
      final keyPem = await _pkcs12(p.path, password, ['-nocerts', '-nodes']);
      if (!keyPem.contains('PRIVATE KEY')) throw CertificateError('O arquivo PFX não tem a chave privada (exporte o certificado A1 com a chave)');
      final cert = File('${dir.path}/c.pem');
      await cert.writeAsString(certPem, encoding: latin1);
      final r = await Process.run(_bin, ['x509', '-in', cert.path, '-noout', '-subject', '-issuer', '-serial', '-startdate', '-enddate', '-nameopt', 'utf8,sep_comma_plus'],
          stdoutEncoding: utf8);
      if (r.exitCode != 0) throw CertificateError('Certificado do titular não encontrado no PFX');
      final out = <String, String>{};
      for (final line in (r.stdout as String).split('\n')) {
        final i = line.indexOf('=');
        if (i > 0) out[line.substring(0, i).trim()] = line.substring(i + 1).trim();
      }
      DateTime date(String? v) {
        // ex.: "Nov 21 04:00:00 2026 GMT"
        final m = RegExp(r'^(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})').firstMatch(v ?? '');
        if (m == null) throw CertificateError('Validade do certificado ilegível');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return DateTime.utc(int.parse(m[6]!), months.indexOf(m[1]!) + 1, int.parse(m[2]!), int.parse(m[3]!), int.parse(m[4]!), int.parse(m[5]!));
      }

      return CertificateInfo(
        subject: out['subject'] ?? '',
        issuer: out['issuer'] ?? '',
        serialNumber: (out['serial'] ?? '').toUpperCase(),
        notBefore: date(out['notBefore']),
        notAfter: date(out['notAfter']),
      );
    });
  }

  /// Assinatura destacada (o arquivo original não vai dentro do .p7s), SHA-256, CAdES-BES.
  Future<Uint8List> sign(Uint8List pfx, String password, Uint8List content) async {
    await _requireOpenssl();
    return _withTemp((dir) async {
      final p = File('${dir.path}/c.pfx');
      await p.writeAsBytes(pfx, flush: true);
      final cert = File('${dir.path}/cert.pem'), key = File('${dir.path}/key.pem'), chain = File('${dir.path}/chain.pem');
      await cert.writeAsString(await _pkcs12(p.path, password, ['-clcerts', '-nokeys']), encoding: latin1);
      await key.writeAsString(await _pkcs12(p.path, password, ['-nocerts', '-nodes']), encoding: latin1);
      final ca = await _pkcs12(p.path, password, ['-cacerts', '-nokeys']);
      final hasChain = ca.contains('BEGIN CERTIFICATE');
      if (hasChain) await chain.writeAsString(ca, encoding: latin1);
      final data = File('${dir.path}/data');
      await data.writeAsBytes(content, flush: true);
      final out = File('${dir.path}/sig.p7s');
      final r = await Process.run(_bin, [
        'cms', '-sign', '-binary', '-cades', '-md', 'sha256', '-nosmimecap',
        '-in', data.path, '-signer', cert.path, '-inkey', key.path,
        if (hasChain) ...['-certfile', chain.path],
        '-outform', 'DER', '-out', out.path,
      ], stderrEncoding: utf8);
      if (r.exitCode != 0) throw CertificateError('Falha ao assinar: ${(r.stderr as String).split('\n').first}');
      return out.readAsBytes();
    });
  }
}
