// Certificado digital ICP-Brasil A1 da empresa: envio (PFX + senha, guardados cifrados), consulta e
// remoção; e a assinatura CAdES (.p7s destacada) do AFD do REP-P e do AEJ.
import 'dart:convert';
import 'dart:typed_data';

import 'package:sp_core/sp_core.dart' show normalizeCnpj;

import '../app.dart';
import '../crypto/cades.dart';
import '../crypto/tokens.dart' show FieldCipher;
import '../db.dart';
import '../http.dart';
import '../validate.dart';
import 'companies.dart' show companyFilter;

final _upload = Obj({
  // PFX típico tem 3 a 10 KB; 64 KB cobre cadeias longas.
  'pfxBase64': const Str(min: 100, max: 90000, message: 'Envie o arquivo .pfx do certificado A1 (até 64 KB)'),
  'password': const Str(min: 1, max: 200, message: 'Informe a senha do certificado'),
});

class Certificates {
  Certificates(this.app, {CadesSigner? signer})
      : signer = signer ?? CadesSigner(),
        _cipher = app.config.secretsEncryptionKey == null ? null : FieldCipher(app.config.secretsEncryptionKey!);

  final App app;
  final CadesSigner signer;
  final FieldCipher? _cipher;

  FieldCipher _requireCipher() => _cipher ?? (throw unavailable('Assinatura digital desativada: configure SECRETS_ENCRYPTION_KEY na API'));

  static Map<String, Object?> _public(Row c) {
    final notAfter = c['notAfter']! as DateTime;
    return {
      'subject': c['subject'],
      'issuer': c['issuer'],
      'serialNumber': c['serialNumber'],
      'notBefore': c['notBefore'],
      'notAfter': notAfter,
      'expired': notAfter.isBefore(DateTime.now()),
      'updatedAt': c['updatedAt'],
    };
  }

  void routes() {
    final r = app.router;
    final db = app.db;

    Future<void> checkCompany(Tx tx, String id, List<String>? allowed) async {
      final c = await tx.one('SELECT id FROM companies WHERE id = @id AND deleted_at IS NULL', {'id': id});
      if (c == null || (allowed != null && !allowed.contains(id))) throw notFound('Empresa não encontrada');
    }

    r.group('/v1/companies', tag: 'organização', () {
      r.get('/:id/certificate', permission: 'org.companies:read', (ctx) {
        final id = ctx.uuidParam('id');
        return db.forTenant(ctx.tenant, (tx) async {
          await checkCompany(tx, id, companyFilter(ctx.user, 'org.companies:read'));
          final c = await tx.one('SELECT subject, issuer, serial_number, not_before, not_after, updated_at FROM company_certificates WHERE company_id = @id', {'id': id});
          return {'certificate': c == null ? null : _public(c)};
        });
      });

      r.put('/:id/certificate', permission: 'admin.settings:manage', (ctx) async {
        final id = ctx.uuidParam('id');
        final input = _upload.parse(ctx.body);
        final cipher = _requireCipher();
        final Uint8List pfx;
        try {
          pfx = base64.decode((input['pfxBase64']! as String).replaceAll(RegExp(r'\s'), ''));
        } on FormatException {
          throw badRequest('Arquivo do certificado inválido');
        }
        if (pfx.length > 65536) throw badRequest('Envie o arquivo .pfx do certificado A1 (até 64 KB)');
        final password = input['password']! as String;
        final tenantId = ctx.tenant;
        final company = await db.forTenant(tenantId, (tx) async {
          await checkCompany(tx, id, companyFilter(ctx.user, 'org.companies:update'));
          return (await tx.one('SELECT cnpj FROM companies WHERE id = @id', {'id': id}))!;
        });
        final CertificateInfo info;
        try {
          info = await signer.inspect(pfx, password);
        } on CertificateError catch (e) {
          throw badRequest(e.message);
        }
        final now = DateTime.now();
        if (info.notAfter.isBefore(now)) throw badRequest('Certificado vencido em ${_br(info.notAfter)}');
        if (info.notBefore.isAfter(now)) throw badRequest('Certificado só vale a partir de ${_br(info.notBefore)}');
        final companyCnpj = company['cnpj'] as String?;
        final certCnpj = info.cnpj;
        if (companyCnpj != null && certCnpj != null && normalizeCnpj(certCnpj).substring(0, 8) != normalizeCnpj(companyCnpj).substring(0, 8)) {
          throw badRequest('O certificado é do CNPJ $certCnpj, de outra empresa');
        }
        return db.forTenant(tenantId, (tx) async {
          final before = await tx.one('SELECT serial_number FROM company_certificates WHERE company_id = @id', {'id': id});
          final saved = (await tx.one(
            'INSERT INTO company_certificates (id, tenant_id, company_id, pfx_enc, password_enc, subject, issuer, serial_number, not_before, not_after, uploaded_by_id, updated_at) '
            'VALUES (gen_random_uuid(), @t, @c, @p, @w, @s, @i, @n, @nb, @na, @u, now()) '
            'ON CONFLICT (company_id) DO UPDATE SET pfx_enc = EXCLUDED.pfx_enc, password_enc = EXCLUDED.password_enc, subject = EXCLUDED.subject, issuer = EXCLUDED.issuer, '
            'serial_number = EXCLUDED.serial_number, not_before = EXCLUDED.not_before, not_after = EXCLUDED.not_after, uploaded_by_id = EXCLUDED.uploaded_by_id, updated_at = now() '
            'RETURNING subject, issuer, serial_number, not_before, not_after, updated_at',
            {
              't': tenantId,
              'c': id,
              'p': cipher.encrypt(pfx),
              'w': cipher.encrypt(utf8.encode(password)),
              's': info.subject,
              'i': info.issuer,
              'n': info.serialNumber,
              'nb': info.notBefore,
              'na': info.notAfter,
              'u': ctx.user.id,
            },
          ))!;
          await app.audit.record(
            tx,
            tenantId: tenantId,
            actorUserId: ctx.user.id,
            action: before == null ? 'CREATE' : 'UPDATE',
            entity: 'company_certificate',
            entityId: id,
            before: before == null ? null : {'serialNumber': before['serialNumber']},
            after: {'serialNumber': info.serialNumber, 'subject': info.subject, 'notAfter': info.notAfter.toIso8601String()},
            meta: ctx.meta,
          );
          return {'certificate': _public(saved)};
        });
      });

      r.delete('/:id/certificate', permission: 'admin.settings:manage', status: 204, (ctx) {
        final id = ctx.uuidParam('id');
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await checkCompany(tx, id, companyFilter(ctx.user, 'org.companies:update'));
          final before = await tx.one('DELETE FROM company_certificates WHERE company_id = @id RETURNING serial_number', {'id': id});
          if (before == null) throw notFound('Certificado não encontrado');
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'company_certificate', entityId: id,
              before: {'serialNumber': before['serialNumber']}, meta: ctx.meta);
          return null;
        });
      });
    });
  }

  /// Assina o arquivo exportado com o certificado da empresa. Sem certificado (ou com falha), devolve
  /// signature nula e o aviso para a tela: o arquivo continua sendo entregue.
  Future<({Map<String, Object?>? signature, String? warning})> signExport(String tenantId, String companyId, List<int> content, String filename) async {
    final c = await app.db.forTenant(tenantId, (tx) => tx.one('SELECT pfx_enc, password_enc, not_after FROM company_certificates WHERE company_id = @c', {'c': companyId}));
    if (c == null) return (signature: null, warning: 'Sem certificado digital da empresa (Empresas › Certificado digital): o arquivo saiu sem a assinatura .p7s.');
    if ((c['notAfter']! as DateTime).isBefore(DateTime.now())) {
      return (signature: null, warning: 'O certificado digital da empresa venceu em ${_br(c['notAfter']! as DateTime)}: envie um novo para assinar o arquivo.');
    }
    final cipher = _cipher;
    if (cipher == null) return (signature: null, warning: 'Assinatura digital desativada: configure SECRETS_ENCRYPTION_KEY na API.');
    try {
      final sig = await signer.sign(cipher.decrypt(c['pfxEnc']! as String), utf8.decode(cipher.decrypt(c['passwordEnc']! as String)), Uint8List.fromList(content));
      return (signature: {'filename': '$filename.p7s', 'mime': 'application/pkcs7-signature', 'base64': base64.encode(sig)}, warning: null);
    } on CertificateError catch (e) {
      return (signature: null, warning: 'Não foi possível assinar o arquivo: ${e.message}.');
    }
  }
}

String _br(DateTime d) {
  final l = d.toUtc().subtract(const Duration(hours: 3));
  return '${l.day.toString().padLeft(2, '0')}/${l.month.toString().padLeft(2, '0')}/${l.year}';
}
