// Cadastros de estrutura: função, centro de custo, tipo de funcionário, sindicato, competência, cargo,
// unidade (com cerca virtual) e departamentos em árvore com seções.
import 'package:sp_core/sp_core.dart' show isValidCnpj, normalizeCnpj;

import '../app.dart';
import '../db.dart';
import '../http.dart';
import '../validate.dart';
import 'users.dart' show likePattern;

class Catalog {
  const Catalog({
    required this.path,
    required this.table,
    required this.entity,
    required this.label,
    required this.gender,
    required this.read,
    required this.manage,
    required this.create,
    required this.update,
    required this.searchFields,
    required this.orderBy,
    this.companyScoped = false,
    this.usageColumn,
    this.usageSql,
  });
  final String path, table, entity, label, gender, read, manage, orderBy;
  final Obj create, update;
  final List<String> searchFields;
  final bool companyScoped;

  /// coluna do vínculo que usa o registro (bloqueia a exclusão)
  final String? usageColumn;

  /// contagem própria de uso (parâmetro @id)
  final String? usageSql;
}

final _name = const Str(trim: true, min: 3, max: 120, message: 'Mínimo de 3 caracteres');
const _code = Str(trim: true, min: 1, max: 20);
final _simple = Obj({'code': _code.optional, 'name': _name, 'active': const Bool().optional});
final _optCnpj = const Str(trim: true).map((v) => normalizeCnpj(v as String)).refine((v) => (v as String).isEmpty || isValidCnpj(v), 'CNPJ inválido');

final _union = Obj({
  'code': _code.optional,
  'name': _name,
  'acronym': const Str(trim: true, min: 2, max: 20),
  'cnpj': _optCnpj.optional,
  'entityType': const Enum(['SINDICATO', 'FEDERACAO', 'CONFEDERACAO', 'CENTRAL']).def('SINDICATO'),
  'side': const Enum(['EMPREGADOS', 'EMPREGADORES']).def('EMPREGADOS'),
  'baseMonth': const Num(int: true, min: 1, max: 12).optional,
  'active': const Bool().optional,
});

final _competence = Obj({'name': _name, 'startsOn': date, 'endsOn': date});
const _endsAfter = 'A data final deve ser igual ou posterior à inicial';

final _position = Obj({
  'companyId': uuid,
  'name': _name,
  'cbo': Str(trim: true, pattern: RegExp(r'^\d{4}-?\d{2}$'), patternMessage: 'CBO no formato 0000-00').map((v) => (v as String).replaceFirst('-', '')).optional,
  'category': const Enum([
    'GENERAL',
    'TEACHER',
    'PHYSICIAN',
    'NURSE',
    'NURSING_TECHNICIAN',
    'NURSING_ASSISTANT',
    'PHYSIOTHERAPIST',
    'PSYCHOLOGIST',
    'PHARMACIST',
    'DENTIST',
    'NUTRITIONIST',
    'SOCIAL_WORKER',
    'OTHER_HEALTH',
  ]).optional,
});

class _Coord extends S {
  const _Coord(this.min, this.max, this.label);
  final num min, max;
  final String label;
  @override
  Object? run(Object? v, List<Object> path, Issues issues) {
    if (identical(v, absent) || v == null) {
      issues.add(path, 'Invalid input');
      return v;
    }
    final n = v is num
        ? v
        : v is String
        ? num.tryParse(v.trim().replaceFirst(',', '.'))
        : null;
    if (n == null || !n.isFinite || n < min || n > max) {
      issues.add(path, '$label inválida');
      return v;
    }
    return n;
  }
}

final _unit = Obj({
  'companyId': uuid,
  'name': _name,
  'code': _code.optional,
  'type': const Enum(['HEADQUARTERS', 'BRANCH', 'SCHOOL', 'HOSPITAL', 'CLINIC', 'UPA', 'UBS', 'LABORATORY', 'OFFICE', 'OPERATIONAL_SITE', 'OTHER']).def('OFFICE'),
  'cnpj': _optCnpj.optional,
  'latitude': const _Coord(-90, 90, 'Latitude').optional,
  'longitude': const _Coord(-180, 180, 'Longitude').optional,
  'geofenceM': const Num(int: true, coerce: true, min: 20, max: 5000).refine((v) => true, '').optional,
});

final catalogs = <Catalog>[
  Catalog(
    path: 'job-functions',
    table: 'job_functions',
    entity: 'job_function',
    label: 'Função',
    gender: 'a',
    read: 'org.functions:read',
    manage: 'org.functions:manage',
    create: _simple,
    update: _simple.partial,
    searchFields: ['name', 'code'],
    orderBy: 'name ASC',
    usageColumn: 'function_id',
  ),
  Catalog(
    path: 'cost-centers',
    table: 'cost_centers',
    entity: 'cost_center',
    label: 'Centro de custo',
    gender: 'o',
    read: 'org.costcenters:read',
    manage: 'org.costcenters:manage',
    create: _simple,
    update: _simple.partial,
    searchFields: ['name', 'code'],
    orderBy: 'name ASC',
    usageColumn: 'cost_center_id',
  ),
  Catalog(
    path: 'employee-types',
    table: 'employee_types',
    entity: 'employee_type',
    label: 'Tipo de funcionário',
    gender: 'o',
    read: 'org.employeetypes:read',
    manage: 'org.employeetypes:manage',
    create: _simple,
    update: _simple.partial,
    searchFields: ['name', 'code'],
    orderBy: 'name ASC',
    usageColumn: 'employee_type_id',
  ),
  Catalog(
    path: 'labor-unions',
    table: 'labor_unions',
    entity: 'labor_union',
    label: 'Sindicato',
    gender: 'o',
    read: 'org.unions:read',
    manage: 'org.unions:manage',
    create: _union,
    update: _union.partial,
    searchFields: ['name', 'acronym', 'code'],
    orderBy: 'name ASC',
    usageColumn: 'union_id',
  ),
  Catalog(
    path: 'competences',
    table: 'competences',
    entity: 'competence',
    label: 'Competência',
    gender: 'a',
    read: 'org.competences:read',
    manage: 'org.competences:manage',
    create: _competence.check((v) => (v['endsOn']! as String).compareTo(v['startsOn']! as String) >= 0, _endsAfter, path: ['endsOn']),
    update: _competence.partial.check((v) => v['startsOn'] == null || v['endsOn'] == null || (v['endsOn']! as String).compareTo(v['startsOn']! as String) >= 0, _endsAfter, path: ['endsOn']),
    searchFields: ['name'],
    orderBy: 'starts_on DESC',
  ),
  Catalog(
    path: 'job-positions',
    table: 'job_positions',
    entity: 'job_position',
    label: 'Cargo',
    gender: 'o',
    read: 'org.positions:read',
    manage: 'org.positions:manage',
    companyScoped: true,
    create: _position,
    update: _position.omit(['companyId']).partial,
    searchFields: ['name', 'cbo'],
    orderBy: 'name ASC',
    usageColumn: 'position_id',
  ),
  Catalog(
    path: 'units',
    table: 'company_units',
    entity: 'company_unit',
    label: 'Unidade',
    gender: 'a',
    read: 'org.units:read',
    manage: 'org.units:manage',
    companyScoped: true,
    create: _unit.check((v) => v.containsKey('latitude') == v.containsKey('longitude'), 'Informe latitude e longitude juntas', path: ['longitude']),
    update: _unit.omit(['companyId']).partial,
    searchFields: ['name', 'code'],
    orderBy: 'name ASC',
    usageColumn: 'unit_id',
  ),
  Catalog(
    path: 'groupings',
    table: 'groupings',
    entity: 'grouping',
    label: 'Agrupamento',
    gender: 'o',
    read: 'org.groupings:read',
    manage: 'org.groupings:manage',
    create: _simple,
    update: _simple.partial,
    searchFields: ['name', 'code'],
    orderBy: 'name ASC',
    usageSql: 'SELECT count(*)::int FROM grouping_employments WHERE grouping_id = @id',
  ),
];

final _department = Obj({'companyId': uuid, 'name': _name, 'code': _code.optional, 'parentId': uuid.optional});
final _departmentUpdate = Obj({'name': const Str(trim: true, min: 3, max: 120).optional, 'code': _code.optional, 'parentId': uuid.nullish});
final _sector = Obj({'name': const Str(trim: true, min: 3, max: 120)});

Future<void> requireCompany(Tx tx, String? id) async {
  if (id == null || !isUuid(id) || await tx.one('SELECT 1 FROM companies WHERE id = @id AND deleted_at IS NULL', {'id': id}) == null) {
    throw notFound('Empresa não encontrada');
  }
}

/// Converte datas "AAAA-MM-DD" e números de coordenadas para gravar.
Map<String, Object?> _dbValues(Map<String, Object?> input) => {
  for (final e in input.entries) e.key: e.value is num && (e.key == 'latitude' || e.key == 'longitude') ? untyped(e.value.toString()) : e.value,
};

void structureRoutes(App app) {
  final r = app.router;
  final db = app.db;

  for (final c in catalogs) {
    catalogRoutes(app, c);
  }

  // ------------------------------------------------------------------ departamentos
  Future<Row> dept(Tx tx, String id) async {
    final d = await tx.one('SELECT * FROM departments WHERE id = @id AND deleted_at IS NULL', {'id': id});
    if (d == null) throw notFound('Departamento não encontrado');
    return d;
  }

  const deptConflict = 'Já existe um departamento com este código nesta empresa';

  r.group('/v1/departments', tag: 'estrutura', () {
    // Lista plana com nível e caminho ("Saúde › UBS Centro › Recepção"), pronta para desenhar a árvore.
    r.get('', permission: 'org.departments:read', (ctx) {
      final q = Obj({'companyId': uuid}).parse(ctx.query);
      return db.forTenant(ctx.tenant, (tx) async {
        await requireCompany(tx, q['companyId'] as String?);
        final rows = await tx.query(
          'SELECT d.id, d.name, d.code, d.parent_id, d.unit_id, '
          "(SELECT count(*)::int FROM employment_relationships e WHERE e.department_id = d.id AND e.deleted_at IS NULL AND e.status = 'ACTIVE') AS employees "
          'FROM departments d WHERE d.company_id = @co AND d.deleted_at IS NULL ORDER BY d.name ASC',
          {'co': q['companyId']},
        );
        final sectors = await tx.query(
          'SELECT s.id, s.name, s.department_id FROM sectors s JOIN departments d ON d.id = s.department_id WHERE d.company_id = @co AND s.deleted_at IS NULL ORDER BY s.name ASC',
          {'co': q['companyId']},
        );
        List<Map<String, Object?>> sectorsOf(Object? id) => [
          for (final s in sectors)
            if (s['departmentId'] == id) {'id': s['id'], 'name': s['name']},
        ];
        final ids = {for (final x in rows) x['id']};
        final out = <Map<String, Object?>>[];
        void walk(String? parentId, int depth, List<String> trail) {
          for (final x in rows.where((x) => x['parentId'] == parentId)) {
            final path = [...trail, x['name']! as String];
            out.add({
              'id': x['id'],
              'name': x['name'],
              'code': x['code'],
              'parentId': x['parentId'],
              'unitId': x['unitId'],
              'depth': depth,
              'path': path.join(' › '),
              'sectors': sectorsOf(x['id']),
              'employees': x['employees'],
              'children': rows.where((y) => y['parentId'] == x['id']).length,
            });
            walk(x['id']! as String, depth + 1, path);
          }
        }

        walk(null, 0, []);
        // pais excluídos deixam filhos órfãos: aparecem na raiz
        for (final x in rows) {
          if (x['parentId'] != null && !ids.contains(x['parentId']) && !out.any((o) => o['id'] == x['id'])) {
            out.add({
              'id': x['id'],
              'name': x['name'],
              'code': x['code'],
              'parentId': null,
              'unitId': x['unitId'],
              'depth': 0,
              'path': x['name'],
              'sectors': sectorsOf(x['id']),
              'employees': x['employees'],
              'children': 0,
            });
          }
        }
        return out;
      });
    });

    r.post('', permission: 'org.departments:manage', (ctx) async {
      final input = _department.parse(ctx.body);
      final tenantId = ctx.tenant;
      try {
        return await db.forTenant(tenantId, (tx) async {
          await requireCompany(tx, input['companyId'] as String?);
          if (input['parentId'] != null) {
            final parent = await dept(tx, input['parentId']! as String);
            if (parent['companyId'] != input['companyId']) throw badRequest('O departamento pai é de outra empresa');
          }
          final d = await tx.insert('departments', {...input, 'tenantId': tenantId});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: 'department', entityId: d['id'] as String?, after: d, meta: ctx.meta);
          return d;
        });
      } on DbError catch (e) {
        if (e.uniqueViolation) throw conflict(deptConflict);
        rethrow;
      }
    });

    r.patch('/:id', permission: 'org.departments:manage', (ctx) async {
      final id = ctx.uuidParam('id');
      final input = _departmentUpdate.parse(ctx.body);
      final tenantId = ctx.tenant;
      try {
        return await db.forTenant(tenantId, (tx) async {
          final before = await dept(tx, id);
          final parentId = input['parentId'] as String?;
          if (parentId != null) {
            final parent = await dept(tx, parentId);
            if (parent['companyId'] != before['companyId']) throw badRequest('O departamento pai é de outra empresa');
            // Impede ciclos: o novo pai não pode ser o próprio departamento nem um descendente dele.
            String? cur = parentId;
            for (var i = 0; cur != null && i < 100; i++) {
              if (cur == id) throw badRequest('Um departamento não pode ficar dentro dele mesmo ou de um subdepartamento seu');
              cur = await tx.scalar<String>('SELECT parent_id FROM departments WHERE id = @id', {'id': cur});
            }
          }
          final d = await tx.update('departments', id, input);
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'department', entityId: id, before: before, after: d, meta: ctx.meta);
          return d;
        });
      } on DbError catch (e) {
        if (e.uniqueViolation) throw conflict(deptConflict);
        rethrow;
      }
    });

    r.delete('/:id', permission: 'org.departments:manage', status: 204, (ctx) {
      final id = ctx.uuidParam('id');
      final tenantId = ctx.tenant;
      return db.forTenant(tenantId, (tx) async {
        final before = await dept(tx, id);
        if ((await tx.scalar<int>('SELECT count(*)::int FROM departments WHERE parent_id = @id AND deleted_at IS NULL', {'id': id}) ?? 0) > 0) {
          throw conflict('Mova ou exclua os subdepartamentos antes');
        }
        final n = await tx.scalar<int>("SELECT count(*)::int FROM employment_relationships WHERE department_id = @id AND deleted_at IS NULL AND status = 'ACTIVE'", {'id': id}) ?? 0;
        if (n > 0) throw conflict('Departamento com $n funcionário(s) ativo(s): transfira-os antes de excluir');
        await tx.update('departments', id, {'deletedAt': DateTime.now()});
        await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'department', entityId: id, before: before, meta: ctx.meta);
        return null;
      });
    });

    r.post('/:id/sectors', permission: 'org.departments:manage', (ctx) {
      final id = ctx.uuidParam('id');
      final input = _sector.parse(ctx.body);
      final tenantId = ctx.tenant;
      return db.forTenant(tenantId, (tx) async {
        await dept(tx, id);
        if (await tx.one('SELECT 1 FROM sectors WHERE department_id = @d AND deleted_at IS NULL AND lower(name) = lower(@n)', {'d': id, 'n': input['name']}) != null) {
          throw conflict('Já existe uma seção com este nome neste departamento');
        }
        final s = await tx.insert('sectors', {'tenantId': tenantId, 'departmentId': id, 'name': input['name']});
        await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: 'sector', entityId: s['id'] as String?, after: s, meta: ctx.meta);
        return s;
      });
    });

    r.delete('/:id/sectors/:sectorId', permission: 'org.departments:manage', status: 204, (ctx) {
      final id = ctx.uuidParam('id'), sectorId = ctx.uuidParam('sectorId');
      final tenantId = ctx.tenant;
      return db.forTenant(tenantId, (tx) async {
        final s = await tx.one('SELECT * FROM sectors WHERE id = @s AND department_id = @d AND deleted_at IS NULL', {'s': sectorId, 'd': id});
        if (s == null) throw notFound('Seção não encontrada');
        final n = await tx.scalar<int>("SELECT count(*)::int FROM employment_relationships WHERE sector_id = @s AND deleted_at IS NULL AND status = 'ACTIVE'", {'s': sectorId}) ?? 0;
        if (n > 0) throw conflict('Seção com $n funcionário(s) ativo(s)');
        await tx.update('sectors', sectorId, {'deletedAt': DateTime.now()});
        await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'sector', entityId: sectorId, before: s, meta: ctx.meta);
        return null;
      });
    });
  });
}

/// Rotas de um cadastro simples (listar, detalhar, criar, editar, excluir logicamente), sempre com auditoria.
void catalogRoutes(App app, Catalog c) {
  final r = app.router;
  final db = app.db;
  final listQuery = pageSchema.extend({'companyId': uuid.optional});
  HttpError conflictErr() => conflict('Já existe ${c.gender == 'a' ? 'uma' : 'um'} ${c.label.toLowerCase()} com este nome ou código');
  Future<int> usage(Tx tx, String id) async => c.usageSql != null
      ? await tx.scalar<int>(c.usageSql!, {'id': id}) ?? 0
      : c.usageColumn == null
      ? 0
      : await tx.scalar<int>("SELECT count(*)::int FROM employment_relationships WHERE ${c.usageColumn} = @id AND deleted_at IS NULL AND status = 'ACTIVE'", {'id': id}) ?? 0;
  Future<Row> one(Tx tx, String id) async {
    final row = await tx.one('SELECT * FROM ${c.table} WHERE id = @id AND deleted_at IS NULL', {'id': id});
    if (row == null) throw notFound('${c.label} não encontrad${c.gender}');
    return row;
  }

  r.group('/v1/${c.path}', tag: 'estrutura', () {
    r.get('', permission: c.read, (ctx) {
      final q = listQuery.parse(ctx.query);
      if (c.companyScoped && q['companyId'] == null) throw badRequest('Informe a empresa (companyId)');
      return db.forTenant(ctx.tenant, (tx) async {
        if (c.companyScoped) await requireCompany(tx, q['companyId'] as String?);
        final where = ['deleted_at IS NULL'];
        final p = <String, Object?>{};
        if (c.companyScoped) {
          where.add('company_id = @co');
          p['co'] = q['companyId'];
        }
        final s = q['search'] as String?;
        if (s != null && s.isNotEmpty) {
          where.add('(${c.searchFields.map((f) => '${snake(f)} ILIKE @s').join(' OR ')})');
          p['s'] = likePattern(s);
        }
        final w = where.join(' AND ');
        final page = q['page']! as int, size = q['pageSize']! as int;
        final data = await tx.query('SELECT * FROM ${c.table} WHERE $w ORDER BY ${c.orderBy} LIMIT $size OFFSET ${(page - 1) * size}', p);
        final total = await tx.scalar<int>('SELECT count(*)::int FROM ${c.table} WHERE $w', p);
        return {
          'data': c.usageColumn == null && c.usageSql == null
              ? data
              : [
                  for (final row in data) {...row, 'inUse': await usage(tx, row['id']! as String)},
                ],
          'page': page,
          'pageSize': size,
          'total': total,
        };
      });
    });

    r.get('/:id', permission: c.read, (ctx) {
      final id = ctx.uuidParam('id');
      return db.forTenant(ctx.tenant, (tx) => one(tx, id));
    });

    r.post('', permission: c.manage, (ctx) async {
      final input = c.create.parse(ctx.body);
      final tenantId = ctx.tenant;
      try {
        return await db.forTenant(tenantId, (tx) async {
          if (c.companyScoped) await requireCompany(tx, input['companyId'] as String?);
          final row = await tx.insert(c.table, {..._dbValues(input), 'tenantId': tenantId});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: c.entity, entityId: row['id'] as String?, after: row, meta: ctx.meta);
          return row;
        });
      } on DbError catch (e) {
        if (e.uniqueViolation) throw conflictErr();
        rethrow;
      }
    });

    r.patch('/:id', permission: c.manage, (ctx) async {
      final id = ctx.uuidParam('id');
      final input = c.update.parse(ctx.body)..remove('companyId'); // a empresa de um registro não muda
      final tenantId = ctx.tenant;
      try {
        return await db.forTenant(tenantId, (tx) async {
          final before = await one(tx, id);
          final row = await tx.update(c.table, id, _dbValues(input));
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: c.entity, entityId: id, before: before, after: row, meta: ctx.meta);
          return row;
        });
      } on DbError catch (e) {
        if (e.uniqueViolation) throw conflictErr();
        rethrow;
      }
    });

    r.delete('/:id', permission: c.manage, status: 204, (ctx) {
      final id = ctx.uuidParam('id');
      final tenantId = ctx.tenant;
      return db.forTenant(tenantId, (tx) async {
        final before = await one(tx, id);
        final used = await usage(tx, id);
        if (used > 0) throw conflict('${c.label} em uso por $used vínculo(s): troque antes de excluir ou desative');
        await tx.update(c.table, id, {'deletedAt': DateTime.now()});
        await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: c.entity, entityId: id, before: before, meta: ctx.meta);
        return null;
      });
    });
  });
}
