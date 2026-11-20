// /v1/companies: empresas do cliente (CNPJ numérico ou alfanumérico), logo e exclusão lógica.
import 'dart:convert';
import 'dart:typed_data';

import 'package:sp_core/sp_core.dart' show normalizeCnpj;

import '../app.dart';
import '../auth/auth_user.dart';
import '../db.dart';
import '../http.dart';
import '../validate.dart';

final companyInput = Obj({
  'legalName': const Str(trim: true, min: 2, max: 200),
  'tradeName': const Str(trim: true, max: 200).optional,
  'cnpj': cnpj.optional,
  'segment': const Enum(['GENERAL', 'EDUCATION', 'HEALTH', 'PUBLIC_SECTOR', 'INDUSTRY', 'RETAIL', 'SERVICES']).def('GENERAL'),
  'timezone': const Str(trim: true, min: 3, max: 64).def('America/Sao_Paulo'),
  'zipCode': const Str(trim: true, digitsOnly: true, length: 8, message: 'CEP deve ter 8 dígitos').optional,
  'street': const Str(trim: true, max: 200).optional,
  'number': const Str(trim: true, max: 20).optional,
  'complement': const Str(trim: true, max: 120).optional,
  'district': const Str(trim: true, max: 120).optional,
  'city': const Str(trim: true, max: 120).optional,
  'state': Str(trim: true, upper: true, pattern: RegExp(r'^[A-Z]{2}$'), patternMessage: 'UF inválida').optional,
  'ibgeCode': Str(trim: true, pattern: RegExp(r'^\d{7}$'), patternMessage: 'Código IBGE inválido').optional,
  'phone': const Str(trim: true, digitsOnly: true, min: 10, max: 11).optional,
  'email': email.optional,
  'stateRegistration': const Str(trim: true, upper: true)
      .map((v) => v == 'ISENTO' ? v : (v as String).replaceAll(RegExp('[^0-9A-Z]'), ''))
      .refine((v) => RegExp(r'^(ISENTO|[0-9A-Z]{2,18})$').hasMatch(v as String), 'Inscrição estadual inválida')
      .optional,
  'cno': const Str(trim: true, digitsOnly: true)
      .refine((v) => RegExp(r'^\d{12,14}$').hasMatch(v as String), 'CEI/CNO deve ter de 12 a 14 dígitos')
      .optional,
  'externalCode': const Str(trim: true, max: 30).optional,
});
final companyUpdate = companyInput.partial;
final _logo = Obj({'dataUrl': const Str(max: 800000, message: 'O logo deve ter no máximo 512 KB')});

/// Empresas visíveis: todas (escopo TENANT) ou só as atribuídas (escopo COMPANY). null = todas.
List<String>? companyFilter(AuthUser user, String permission) {
  if (user.isPlatformAdmin) return null;
  final grants = user.grants.where((g) => g.permission == permission);
  if (grants.any((g) => g.scope == 'TENANT' || g.scope == 'PLATFORM')) return null;
  return [for (final g in grants) if (g.scope == 'COMPANY' && g.companyId != null) g.companyId!];
}

/// Tipo real da imagem pelos primeiros bytes.
String? sniffImage(Uint8List b) {
  if (b.length > 8 && b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4e && b[3] == 0x47 && b[4] == 0x0d && b[5] == 0x0a && b[6] == 0x1a && b[7] == 0x0a) return 'image/png';
  if (b.length > 3 && b[0] == 0xff && b[1] == 0xd8 && b[2] == 0xff) return 'image/jpeg';
  if (b.length > 12 && ascii.decode(b.sublist(0, 4), allowInvalid: true) == 'RIFF' && ascii.decode(b.sublist(8, 12), allowInvalid: true) == 'WEBP') return 'image/webp';
  return null;
}

String _like(String s) => '%${s.replaceAll(r'\', r'\\').replaceAll('%', r'\%').replaceAll('_', r'\_')}%';

void companiesRoutes(App app) {
  final r = app.router;
  final db = app.db;

  Future<Row> findCompany(Tx tx, String id, List<String>? allowed, [String message = 'Empresa não encontrada']) async {
    final c = await tx.one('SELECT * FROM companies WHERE id = @id AND deleted_at IS NULL', {'id': id});
    if (c == null || (allowed != null && !allowed.contains(c['id']))) throw notFound(message);
    return c;
  }

  r.group('/v1/companies', tag: 'organização', () {
    r.get('', permission: 'org.companies:read', (ctx) {
      final q = pageSchema.parse(ctx.query);
      final allowed = companyFilter(ctx.user, 'org.companies:read');
      return db.forTenant(ctx.tenant, (tx) async {
        final where = <String>['deleted_at IS NULL'];
        final p = <String, Object?>{};
        if (allowed != null) {
          where.add('id::text = ANY(@allowed)');
          p['allowed'] = allowed;
        }
        final search = q['search'] as String?;
        if (search != null && search.isNotEmpty) {
          final n = normalizeCnpj(search);
          where.add('(legal_name ILIKE @s OR trade_name ILIKE @s OR cnpj ILIKE @c)');
          p['s'] = _like(search);
          p['c'] = _like(n.isEmpty ? search : n);
        }
        final w = where.join(' AND ');
        final page = q['page']! as int, size = q['pageSize']! as int;
        final data = await tx.query('SELECT * FROM companies WHERE $w ORDER BY legal_name ASC LIMIT $size OFFSET ${(page - 1) * size}', p);
        final total = await tx.scalar<int>('SELECT count(*)::int FROM companies WHERE $w', p);
        return {'data': data, 'page': page, 'pageSize': size, 'total': total};
      });
    });

    r.get('/:id', permission: 'org.companies:read', (ctx) {
      final id = ctx.uuidParam('id');
      return db.forTenant(ctx.tenant, (tx) => findCompany(tx, id, companyFilter(ctx.user, 'org.companies:read')));
    });

    r.post('', permission: 'org.companies:create', (ctx) {
      final input = companyInput.parse(ctx.body);
      final tenantId = ctx.tenant;
      return db.forTenant(tenantId, (tx) async {
        if (input['cnpj'] != null && await tx.one('SELECT 1 FROM companies WHERE cnpj = @c', {'c': input['cnpj']}) != null) {
          throw conflict('Já existe uma empresa com este CNPJ nesta organização');
        }
        final company = await tx.insert('companies', {...input, 'tenantId': tenantId});
        await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: 'company', entityId: company['id'] as String?, after: company, meta: ctx.meta);
        return company;
      });
    });

    r.patch('/:id', permission: 'org.companies:update', (ctx) {
      final id = ctx.uuidParam('id');
      final input = companyUpdate.parse(ctx.body);
      final tenantId = ctx.tenant;
      return db.forTenant(tenantId, (tx) async {
        final before = await findCompany(tx, id, companyFilter(ctx.user, 'org.companies:update'));
        if (input['cnpj'] != null && input['cnpj'] != before['cnpj'] && await tx.one('SELECT 1 FROM companies WHERE cnpj = @c', {'c': input['cnpj']}) != null) {
          throw conflict('Já existe uma empresa com este CNPJ nesta organização');
        }
        final after = await tx.update('companies', id, input);
        await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'company', entityId: id, before: before, after: after, meta: ctx.meta);
        return after;
      });
    });

    r.get('/:id/logo', permission: 'org.companies:read', (ctx) {
      final id = ctx.uuidParam('id');
      final allowed = companyFilter(ctx.user, 'org.companies:read');
      return db.forTenant(ctx.tenant, (tx) async {
        if (allowed != null && !allowed.contains(id)) throw notFound('Logo não encontrado');
        final logo = await tx.one(
            'SELECT l.mime, l.data, l.updated_at FROM company_logos l JOIN companies c ON c.id = l.company_id AND c.deleted_at IS NULL WHERE l.company_id = @id',
            {'id': id});
        if (logo == null) throw notFound('Logo não encontrado');
        return {'dataUrl': 'data:${logo['mime']};base64,${base64.encode(logo['data']! as List<int>)}', 'updatedAt': logo['updatedAt']};
      });
    });

    r.put('/:id/logo', permission: 'org.companies:update', (ctx) {
      final id = ctx.uuidParam('id');
      final b = _logo.parse(ctx.body);
      final m = RegExp(r'^data:(image/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$').firstMatch(b['dataUrl']! as String);
      if (m == null) throw badRequest('Envie uma imagem PNG, JPEG ou WebP');
      final Uint8List data;
      try {
        data = base64.decode(m[2]!);
      } catch (_) {
        throw badRequest('Envie uma imagem PNG, JPEG ou WebP');
      }
      if (data.length > 512 * 1024) throw badRequest('O logo deve ter no máximo 512 KB');
      final mime = sniffImage(data);
      if (mime == null) throw badRequest('Arquivo não é uma imagem PNG, JPEG ou WebP válida');
      final tenantId = ctx.tenant;
      return db.forTenant(tenantId, (tx) async {
        await findCompany(tx, id, companyFilter(ctx.user, 'org.companies:update'));
        await tx.execute(
          'INSERT INTO company_logos (company_id, tenant_id, mime, data, updated_at) VALUES (@id, @t, @m, @d, now()) '
          'ON CONFLICT (company_id) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data, updated_at = now()',
          {'id': id, 't': tenantId, 'm': mime, 'd': data},
        );
        final updated = await tx.update('companies', id, {'logoUpdatedAt': DateTime.now()});
        await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'company', entityId: id,
            after: {'logo': {'mime': mime, 'bytes': data.length}}, meta: ctx.meta);
        return {'logoUpdatedAt': updated!['logoUpdatedAt']};
      });
    });

    r.delete('/:id/logo', permission: 'org.companies:update', status: 204, (ctx) {
      final id = ctx.uuidParam('id');
      final tenantId = ctx.tenant;
      final allowed = companyFilter(ctx.user, 'org.companies:update');
      return db.forTenant(tenantId, (tx) async {
        if (allowed != null && !allowed.contains(id)) throw notFound('Empresa não encontrada');
        final n = await tx.execute('DELETE FROM company_logos WHERE company_id = @id', {'id': id});
        if (n == 0) throw notFound('Logo não encontrado');
        await tx.update('companies', id, {'logoUpdatedAt': null});
        await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'company', entityId: id, after: {'logo': null}, meta: ctx.meta);
        return null;
      });
    });

    r.delete('/:id', permission: 'org.companies:delete', status: 204, (ctx) {
      final id = ctx.uuidParam('id');
      final tenantId = ctx.tenant;
      return db.forTenant(tenantId, (tx) async {
        final before = await findCompany(tx, id, companyFilter(ctx.user, 'org.companies:delete'));
        final active = await tx.scalar<int>(
            "SELECT count(*)::int FROM employment_relationships WHERE company_id = @id AND status <> 'TERMINATED' AND deleted_at IS NULL", {'id': id}) ?? 0;
        if (active > 0) throw conflict('A empresa tem $active vínculo(s) ativo(s); desligue-os antes de excluir');
        await tx.execute('UPDATE companies SET deleted_at = now(), updated_at = now() WHERE id = @id', {'id': id});
        await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'company', entityId: id, before: before, meta: ctx.meta);
        return null;
      });
    });
  });
}
