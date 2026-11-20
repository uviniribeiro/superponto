// /v1/employees: pessoa + vínculo, histórico de mudanças, desligamento, importação por planilha e agrupamentos.
import 'package:sp_core/sp_core.dart' show isValidCpf, isValidPis, onlyDigits;

import '../app.dart';
import '../auth/auth_user.dart';
import '../db.dart';
import '../http.dart';
import '../limits.dart';
import '../validate.dart';
import 'users.dart' show likePattern;

final _cpf = const Str(trim: true, digitsOnly: true).refine((v) => isValidCpf(v as String), 'CPF inválido');
final _pis = const Str(trim: true, digitsOnly: true).refine((v) => isValidPis(v as String), 'PIS/PASEP inválido');
const _phone = Str(trim: true, digitsOnly: true, min: 10, max: 11);

final addressSchema = Obj({
  'zipCode': const Str(trim: true, digitsOnly: true, length: 8, message: 'CEP deve ter 8 dígitos').optional,
  'street': const Str(trim: true, max: 200).optional,
  'number': const Str(trim: true, max: 20).optional,
  'complement': const Str(trim: true, max: 120).optional,
  'district': const Str(trim: true, max: 120).optional,
  'city': const Str(trim: true, max: 120).optional,
  'state': Str(trim: true, upper: true, pattern: RegExp(r'^[A-Z]{2}$')).optional,
  'ibge': Str(trim: true, pattern: RegExp(r'^\d{7}$')).optional,
});

const _contract = Enum(['CLT', 'STATUTORY', 'TEMPORARY', 'INTERN', 'APPRENTICE', 'CONTRACTOR', 'SERVICE_PROVIDER', 'VOLUNTEER', 'OTHER']);
const _refs = ['unitId', 'departmentId', 'sectorId', 'positionId', 'functionId', 'costCenterId', 'employeeTypeId', 'unionId', 'supervisorId'];

final employeeCreate = Obj({
  'companyId': uuid,
  'fullName': const Str(trim: true, min: 3, max: 200, message: 'Informe o nome completo'),
  'socialName': const Str(trim: true, max: 200).optional,
  'cpf': _cpf.optional,
  'pis': _pis.optional,
  'birthDate': date.optional,
  'email': email.optional,
  'phone': _phone.optional,
  'address': addressSchema.optional,
  'registration': const Str(trim: true, min: 1, max: 30, message: 'Informe a matrícula'),
  'hiredAt': date,
  'contractType': _contract.def('CLT'),
  'weeklyHours': const Num(min: 1, max: 80).optional,
  for (final k in _refs) k: uuid.optional,
}).check((v) => v['cpf'] != null || v['pis'] != null, 'Informe o CPF ou o PIS (o relógio da Portaria 671 usa o CPF; o da 1.510, o PIS)', path: ['cpf']);

final employeeUpdate = Obj({
  'fullName': const Str(trim: true, min: 3, max: 200, message: 'Informe o nome completo').optional,
  'socialName': const Str(trim: true, max: 200).nullish,
  'cpf': _cpf.nullish,
  'pis': _pis.nullish,
  'birthDate': date.nullish,
  'email': email.nullish,
  'phone': _phone.nullish,
  'address': addressSchema.nullish,
  'registration': const Str(trim: true, min: 1, max: 30, message: 'Informe a matrícula').optional,
  'contractType': _contract.optional,
  'weeklyHours': const Num(min: 1, max: 80).nullish,
  for (final k in _refs) k: uuid.nullish,
  'effectiveAt': date.optional,
  'reason': const Str(trim: true, max: 300).optional,
});

final _terminate = Obj({'terminatedAt': date, 'reason': const Str(trim: true, min: 3, max: 300)});
final _list = Obj({
  'page': const Num(int: true, min: 1, coerce: true).def(1),
  'pageSize': const Num(int: true, min: 1, max: 500, coerce: true).def(50),
  'search': const Str(trim: true, max: 100).optional,
  'companyId': uuid.optional,
  'departmentId': uuid.optional,
  'includeSubdepartments': const Enum(['true', 'false']).def('true').map((v) => v == 'true'),
  'positionId': uuid.optional,
  'employeeTypeId': uuid.optional,
  'costCenterId': uuid.optional,
  'groupingId': uuid.optional,
  'status': const Enum(['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'ALL']).def('ACTIVE'),
});
final _import = Obj({
  'companyId': uuid,
  'dryRun': const Bool().def(true),
  'createMissing': const Bool().def(false),
  'updateExisting': const Bool().def(false),
  'rows': const Arr(Rec(Str(max: 300)), max: 5000),
});

String? maskCpf(String? v) => v == null ? null : '***.***.${v.substring(6, 9)}-${v.substring(9)}';
String? maskPis(String? v) => v == null ? null : '***.*****.${v.substring(8, 10)}-${v.substring(10)}';
String? _iso(Object? d) => d is DateTime ? isoMs(d).substring(0, 10) : null;

/// Campos do vínculo que geram histórico.
const _tracked = ['departmentId', 'sectorId', 'positionId', 'functionId', 'costCenterId', 'employeeTypeId', 'unionId', 'unitId', 'contractType', 'weeklyHours', 'supervisorId', 'registration'];

const _employmentSelect = '''
SELECT e.*, e.status::text AS status, e.contract_type::text AS contract_type,
  p.id AS p_id, p.full_name AS p_full_name, p.social_name AS p_social_name, p.cpf AS p_cpf, p.pis AS p_pis, p.birth_date AS p_birth_date,
  p.email AS p_email, p.phone AS p_phone, p.address AS p_address, p.created_at AS p_created_at,
  c.legal_name AS c_legal_name, c.trade_name AS c_trade_name,
  un.name AS un_name, d.name AS d_name, s.name AS s_name, jp.name AS jp_name, jp.cbo AS jp_cbo, jf.name AS jf_name, cc.name AS cc_name,
  et.name AS et_name, lu.acronym AS lu_acronym, sp.full_name AS sup_full_name
FROM employment_relationships e
JOIN people p ON p.id = e.person_id
JOIN companies c ON c.id = e.company_id
LEFT JOIN company_units un ON un.id = e.unit_id
LEFT JOIN departments d ON d.id = e.department_id
LEFT JOIN sectors s ON s.id = e.sector_id
LEFT JOIN job_positions jp ON jp.id = e.position_id
LEFT JOIN job_functions jf ON jf.id = e.function_id
LEFT JOIN cost_centers cc ON cc.id = e.cost_center_id
LEFT JOIN employee_types et ON et.id = e.employee_type_id
LEFT JOIN labor_unions lu ON lu.id = e.union_id
LEFT JOIN employment_relationships se ON se.id = e.supervisor_id
LEFT JOIN people sp ON sp.id = se.person_id
''';

Map<String, Object?>? _ref(Row r, String idKey, Map<String, Object?> Function() build) => r[idKey] == null ? null : {'id': r[idKey], ...build()};

class PeopleModule {
  PeopleModule(this.app);
  final App app;
  Db get db => app.db;

  Map<String, Object?> shape(Row r, AuthUser viewer) {
    final sensitive = can(viewer, 'people.sensitive:read');
    final wh = r['weeklyHours'];
    return {
      'id': r['id'],
      'personId': r['pId'],
      'fullName': r['pFullName'],
      'socialName': r['pSocialName'],
      'cpf': sensitive ? r['pCpf'] : maskCpf(r['pCpf'] as String?),
      'pis': sensitive ? r['pPis'] : maskPis(r['pPis'] as String?),
      'sensitiveVisible': sensitive,
      'birthDate': _iso(r['pBirthDate']),
      'email': r['pEmail'],
      'phone': r['pPhone'],
      'address': r['pAddress'],
      'registration': r['registration'],
      'status': r['status'],
      'contractType': r['contractType'],
      'weeklyHours': wh == null ? null : num.parse(wh.toString()),
      'hiredAt': _iso(r['hiredAt']),
      'terminatedAt': _iso(r['terminatedAt']),
      'company': {'id': r['companyId'], 'legalName': r['cLegalName'], 'tradeName': r['cTradeName']},
      'department': _ref(r, 'departmentId', () => {'name': r['dName']}),
      'sector': _ref(r, 'sectorId', () => {'name': r['sName']}),
      'position': _ref(r, 'positionId', () => {'name': r['jpName'], 'cbo': r['jpCbo']}),
      'function': _ref(r, 'functionId', () => {'name': r['jfName']}),
      'costCenter': _ref(r, 'costCenterId', () => {'name': r['ccName']}),
      'employeeType': _ref(r, 'employeeTypeId', () => {'name': r['etName']}),
      'union': _ref(r, 'unionId', () => {'acronym': r['luAcronym']}),
      'supervisor': _ref(r, 'supervisorId', () => {'fullName': r['supFullName']}),
      'unitId': r['unitId'],
      'unit': _ref(r, 'unitId', () => {'name': r['unName']}),
    };
  }

  /// Visão sem dados sensíveis, usada na auditoria (o log nunca guarda CPF/PIS completos).
  static AuthUser _auditView(AuthUser u) => AuthUser(id: u.id, email: u.email, displayName: u.displayName, tenantId: u.tenantId);

  Future<Row> load(Tx tx, String id) async {
    final r = await tx.one('$_employmentSelect WHERE e.id = @id AND e.deleted_at IS NULL', {'id': id});
    if (r == null) throw notFound('Funcionário não encontrado');
    return r;
  }

  Future<List<String>> _departmentTree(Tx tx, String root) async {
    final rows = await tx.query(
      'WITH RECURSIVE t AS (SELECT id FROM departments WHERE id = @r UNION SELECT d.id FROM departments d JOIN t ON d.parent_id = t.id WHERE d.deleted_at IS NULL) SELECT id FROM t',
      {'r': root},
    );
    return [for (final x in rows) x['id']! as String];
  }

  /// Confere que departamento, seção, cargo, unidade e superior existem e são da mesma empresa.
  Future<void> _checkRefs(Tx tx, String companyId, Map<String, Object?> v, [String? selfId]) async {
    Future<Row?> find(String table, Object? id) => tx.one('SELECT * FROM $table WHERE id = @id AND deleted_at IS NULL', {'id': id});
    if (v['departmentId'] != null) {
      final d = await find('departments', v['departmentId']);
      if (d == null || d['companyId'] != companyId) throw badRequest('Departamento não pertence a esta empresa');
    }
    if (v['sectorId'] != null) {
      final s = await find('sectors', v['sectorId']);
      if (s == null) throw badRequest('Seção não encontrada');
      if (v['departmentId'] != null && s['departmentId'] != v['departmentId']) throw badRequest('A seção não pertence ao departamento escolhido');
    }
    if (v['positionId'] != null) {
      final p = await find('job_positions', v['positionId']);
      if (p == null || p['companyId'] != companyId) throw badRequest('Cargo não pertence a esta empresa');
    }
    if (v['unitId'] != null) {
      final u = await find('company_units', v['unitId']);
      if (u == null || u['companyId'] != companyId) throw badRequest('Unidade não pertence a esta empresa');
    }
    for (final (key, table, label) in const [
      ('functionId', 'job_functions', 'Função'),
      ('costCenterId', 'cost_centers', 'Centro de custo'),
      ('employeeTypeId', 'employee_types', 'Tipo de funcionário'),
      ('unionId', 'labor_unions', 'Sindicato'),
    ]) {
      if (v[key] != null && await find(table, v[key]) == null) throw badRequest('$label não encontrado(a)');
    }
    if (v['supervisorId'] != null) {
      if (v['supervisorId'] == selfId) throw badRequest('O funcionário não pode ser o próprio superior');
      if (await tx.one("SELECT 1 FROM employment_relationships WHERE id = @id AND deleted_at IS NULL AND status <> 'TERMINATED'", {'id': v['supervisorId']}) == null) {
        throw badRequest('Superior não encontrado ou desligado');
      }
    }
  }

  HttpError _unique(DbError e) => conflict((e.constraint ?? e.message).contains('cpf') ? 'CPF já cadastrado para outra pessoa' : 'Matrícula já usada nesta empresa');

  Future<Map<String, Object?>> create(String tenantId, AuthUser user, Map<String, Object?> input, Map<String, Object?> meta) async {
    try {
      return await db.forTenant(tenantId, (tx) async {
        if (await tx.one('SELECT 1 FROM companies WHERE id = @id AND deleted_at IS NULL', {'id': input['companyId']}) == null) throw notFound('Empresa não encontrada');
        await _checkRefs(tx, input['companyId']! as String, input);
        await assertLimit(tx, tenantId, 'limit.employments');
        // Mesma pessoa (CPF) pode ter mais de um vínculo: reaproveita o cadastro da pessoa.
        var person = input['cpf'] != null ? await tx.one('SELECT * FROM people WHERE cpf = @c AND deleted_at IS NULL', {'c': input['cpf']}) : null;
        if (person == null && input['pis'] != null) person = await tx.one('SELECT * FROM people WHERE pis = @p AND deleted_at IS NULL', {'p': input['pis']});
        if (person != null && input['cpf'] != null && person['cpf'] != null && person['cpf'] != input['cpf']) {
          throw conflict('Este PIS já pertence a outra pessoa com outro CPF');
        }
        person ??= await tx.insert('people', {
          'tenantId': tenantId,
          for (final k in ['fullName', 'socialName', 'cpf', 'pis', 'birthDate', 'email', 'phone'])
            if (input[k] != null) k: input[k],
          if (input['address'] != null) 'address': jsonb(input['address']),
        });
        final e = await tx.insert('employment_relationships', {
          'tenantId': tenantId,
          'personId': person['id'],
          'companyId': input['companyId'],
          'registration': input['registration'],
          'hiredAt': input['hiredAt'],
          'contractType': input['contractType'],
          if (input['weeklyHours'] != null) 'weeklyHours': untyped(input['weeklyHours'].toString()),
          for (final k in _refs)
            if (input[k] != null) k: input[k],
        });
        final row = await load(tx, e['id']! as String);
        await app.audit.record(
          tx,
          tenantId: tenantId,
          actorUserId: user.id,
          action: 'CREATE',
          entity: 'employment',
          entityId: e['id'] as String?,
          after: {...shape(row, _auditView(user)), 'reusedPerson': (person['createdAt']! as DateTime).isBefore(e['createdAt']! as DateTime)},
          meta: meta,
        );
        return shape(row, user);
      });
    } on DbError catch (e) {
      if (e.uniqueViolation) throw _unique(e);
      rethrow;
    }
  }

  Future<Map<String, Object?>> update(String tenantId, AuthUser user, String id, Map<String, Object?> input, Map<String, Object?> meta) async {
    try {
      return await db.forTenant(tenantId, (tx) async {
        final before = await load(tx, id);
        if (before['status'] == 'TERMINATED') throw badRequest('Funcionário desligado: reative antes de alterar');
        final merged = {'departmentId': input.containsKey('departmentId') ? input['departmentId'] : before['departmentId'], ...input};
        await _checkRefs(tx, before['companyId']! as String, merged, id);
        final personData = <String, Object?>{
          for (final k in ['fullName', 'socialName', 'cpf', 'pis', 'email', 'phone', 'birthDate'])
            if (input.containsKey(k)) k: input[k],
          if (input.containsKey('address') && input['address'] != null) 'address': jsonb(input['address']),
        };
        if (personData.isNotEmpty) await tx.update('people', before['personId']! as String, personData);
        final empData = <String, Object?>{
          for (final k in _tracked)
            if (input.containsKey(k)) k: input[k],
        };
        // seção solta quando muda de departamento sem informar seção
        if (input.containsKey('departmentId') && input['departmentId'] != before['departmentId'] && !input.containsKey('sectorId')) empData['sectorId'] = null;
        if (empData.isNotEmpty) {
          await tx.update('employment_relationships', id, {for (final e in empData.entries) e.key: e.key == 'weeklyHours' && e.value != null ? untyped(e.value.toString()) : e.value});
        }
        String text(Object? v) => v == null ? '' : (v is String && RegExp(r'^-?\d+(\.\d+)?$').hasMatch(v) ? num.parse(v).toString() : v.toString());
        final effectiveAt = input['effectiveAt'] as String? ?? isoMs(DateTime.now()).substring(0, 10);
        for (final field in empData.keys) {
          final old = before[field];
          if (text(old) == text(empData[field])) continue;
          await tx.insert('employment_history', {
            'tenantId': tenantId,
            'employmentId': id,
            'field': field,
            'oldValue': old == null ? null : jsonb(field == 'weeklyHours' ? text(old) : old.toString()),
            'newValue': empData[field] == null ? null : jsonb(empData[field].toString()),
            'effectiveAt': effectiveAt,
            if (input['reason'] != null) 'reason': input['reason'],
            'actorUserId': user.id,
          });
        }
        final after = await load(tx, id);
        await app.audit.record(
          tx,
          tenantId: tenantId,
          actorUserId: user.id,
          action: 'UPDATE',
          entity: 'employment',
          entityId: id,
          before: shape(before, _auditView(user)),
          after: shape(after, _auditView(user)),
          meta: meta,
        );
        return shape(after, user);
      });
    } on DbError catch (e) {
      if (e.uniqueViolation) throw _unique(e);
      rethrow;
    }
  }

  void routes() {
    final r = app.router;
    r.group('/v1/employees', tag: 'pessoas', () {
      r.get('', permission: 'people.employments:read', (ctx) {
        final q = _list.parse(ctx.query);
        final viewer = ctx.user;
        return db.forTenant(ctx.tenant, (tx) async {
          final sensitive = can(viewer, 'people.sensitive:read');
          final where = ['e.deleted_at IS NULL'];
          final p = <String, Object?>{};
          if (q['status'] != 'ALL') {
            where.add('e.status = @status');
            p['status'] = q['status'];
          }
          for (final (k, col) in const [('companyId', 'company_id'), ('positionId', 'position_id'), ('employeeTypeId', 'employee_type_id'), ('costCenterId', 'cost_center_id')]) {
            if (q[k] != null) {
              where.add('e.$col = @$k');
              p[k] = q[k];
            }
          }
          if (q['departmentId'] != null) {
            if (q['includeSubdepartments'] == true) {
              where.add('e.department_id::text = ANY(@deps)');
              p['deps'] = await _departmentTree(tx, q['departmentId']! as String);
            } else {
              where.add('e.department_id = @dep');
              p['dep'] = q['departmentId'];
            }
          }
          if (q['groupingId'] != null) {
            where.add('EXISTS (SELECT 1 FROM grouping_employments ge WHERE ge.employment_id = e.id AND ge.grouping_id = @g)');
            p['g'] = q['groupingId'];
          }
          final s = q['search'] as String?;
          if (s != null && s.isNotEmpty) {
            final digits = s.replaceAll(RegExp(r'\D'), '');
            // buscar por CPF/PIS só com permissão de dados sensíveis (senão seria um jeito de descobri-los)
            final bySensitive = sensitive && digits.length >= 4;
            where.add('(p.full_name ILIKE @s OR p.social_name ILIKE @s OR e.registration ILIKE @s${bySensitive ? ' OR p.cpf LIKE @d OR p.pis LIKE @d' : ''})');
            p['s'] = likePattern(s);
            if (bySensitive) p['d'] = '%$digits%';
          }
          final w = where.join(' AND ');
          final page = q['page']! as int, size = q['pageSize']! as int;
          final rows = await tx.query('$_employmentSelect WHERE $w ORDER BY p.full_name ASC, e.registration ASC LIMIT $size OFFSET ${(page - 1) * size}', p);
          final total = await tx.scalar<int>('SELECT count(*)::int FROM employment_relationships e JOIN people p ON p.id = e.person_id WHERE $w', p);
          return {
            'data': [for (final x in rows) shape(x, viewer)],
            'page': page,
            'pageSize': size,
            'total': total,
          };
        });
      });

      r.get('/:id', permission: 'people.employments:read', (ctx) {
        final id = ctx.uuidParam('id');
        final viewer = ctx.user;
        return db.forTenant(ctx.tenant, (tx) async {
          final row = await load(tx, id);
          final history = await tx.query('SELECT * FROM employment_history WHERE employment_id = @id ORDER BY created_at DESC LIMIT 100', {'id': id});
          final others = await tx.query(
            'SELECT e.id, e.registration, e.status::text AS status, c.legal_name, c.trade_name FROM employment_relationships e JOIN companies c ON c.id = e.company_id '
            'WHERE e.person_id = @p AND e.deleted_at IS NULL AND e.id <> @id',
            {'p': row['personId'], 'id': id},
          );
          return {
            ...shape(row, viewer),
            'history': history,
            'otherEmployments': [
              for (final o in others)
                {
                  'id': o['id'],
                  'registration': o['registration'],
                  'status': o['status'],
                  'company': {'legalName': o['legalName'], 'tradeName': o['tradeName']},
                },
            ],
          };
        });
      });

      r.post('', permission: 'people.employments:manage', (ctx) => create(ctx.tenant, ctx.user, employeeCreate.parse(ctx.body), ctx.meta));

      r.post('/import', permission: 'people.employments:import', (ctx) => _runImport(ctx.tenant, ctx.user, _import.parse(ctx.body), ctx.meta));

      r.patch('/:id', permission: 'people.employments:manage', (ctx) {
        final id = ctx.uuidParam('id');
        return update(ctx.tenant, ctx.user, id, employeeUpdate.parse(ctx.body), ctx.meta);
      });

      r.post('/:id/terminate', permission: 'people.employments:manage', (ctx) {
        final id = ctx.uuidParam('id');
        final input = _terminate.parse(ctx.body);
        final user = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final before = await load(tx, id);
          if (before['status'] == 'TERMINATED') throw badRequest('Funcionário já desligado');
          final at = input['terminatedAt']! as String;
          if (at.compareTo(_iso(before['hiredAt'])!) < 0) throw badRequest('A data de desligamento é anterior à admissão');
          await tx.update('employment_relationships', id, {'status': 'TERMINATED', 'terminatedAt': at});
          await tx.insert('employment_history', {
            'tenantId': tenantId,
            'employmentId': id,
            'field': 'status',
            'oldValue': jsonb(before['status']),
            'newValue': jsonb('TERMINATED'),
            'effectiveAt': at,
            'reason': input['reason'],
            'actorUserId': user.id,
          });
          await app.audit.record(
            tx,
            tenantId: tenantId,
            actorUserId: user.id,
            action: 'UPDATE',
            entity: 'employment',
            entityId: id,
            before: {'status': before['status']},
            after: {'status': 'TERMINATED', 'terminatedAt': at, 'reason': input['reason']},
            meta: ctx.meta,
          );
          return shape(await load(tx, id), user);
        });
      }, status: 201);

      r.post('/:id/reactivate', permission: 'people.employments:manage', (ctx) {
        final id = ctx.uuidParam('id');
        final user = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final before = await load(tx, id);
          if (before['status'] != 'TERMINATED') throw badRequest('Funcionário não está desligado');
          await tx.update('employment_relationships', id, {'status': 'ACTIVE', 'terminatedAt': null});
          await tx.insert('employment_history', {
            'tenantId': tenantId,
            'employmentId': id,
            'field': 'status',
            'oldValue': jsonb('TERMINATED'),
            'newValue': jsonb('ACTIVE'),
            'effectiveAt': isoMs(DateTime.now()).substring(0, 10),
            'reason': 'Reativação',
            'actorUserId': user.id,
          });
          await app.audit.record(
            tx,
            tenantId: tenantId,
            actorUserId: user.id,
            action: 'UPDATE',
            entity: 'employment',
            entityId: id,
            before: {'status': 'TERMINATED'},
            after: {'status': 'ACTIVE'},
            meta: ctx.meta,
          );
          return shape(await load(tx, id), user);
        });
      });
    });

    // ------------------------------------------------------------------ membros do agrupamento
    Future<void> grouping(Tx tx, String id) async {
      if (await tx.one('SELECT 1 FROM groupings WHERE id = @id AND deleted_at IS NULL', {'id': id}) == null) throw notFound('Agrupamento não encontrado');
    }

    Future<Map<String, Object?>> members(String tenantId, String id) => db.forTenant(tenantId, (tx) async {
      await grouping(tx, id);
      final emps = await tx.query(
        'SELECT e.id, e.registration, e.status::text AS status, p.full_name FROM grouping_employments g JOIN employment_relationships e ON e.id = g.employment_id '
        'JOIN people p ON p.id = e.person_id WHERE g.grouping_id = @id',
        {'id': id},
      );
      final positions = await tx.query('SELECT jp.id, jp.name FROM grouping_positions g JOIN job_positions jp ON jp.id = g.position_id WHERE g.grouping_id = @id', {'id': id});
      final units = await tx.query('SELECT u.id, u.name FROM grouping_units g JOIN company_units u ON u.id = g.unit_id WHERE g.grouping_id = @id', {'id': id});
      return {'employments': emps, 'positions': positions, 'units': units};
    });

    final membersSchema = Obj({'employmentIds': const Arr(uuid, max: 10000).optional, 'positionIds': const Arr(uuid, max: 2000).optional, 'unitIds': const Arr(uuid, max: 2000).optional});

    r.group('/v1/groupings', tag: 'estrutura', () {
      r.get('/:id/members', permission: 'org.groupings:read', (ctx) => members(ctx.tenant, ctx.uuidParam('id')));
      r.put('/:id/members', permission: 'org.groupings:manage', (ctx) async {
        final id = ctx.uuidParam('id');
        final input = membersSchema.parse(ctx.body);
        final tenantId = ctx.tenant;
        await db.forTenant(tenantId, (tx) async {
          await grouping(tx, id);
          for (final (key, table, label, link, col) in const [
            ('employmentIds', 'employment_relationships', 'Funcionário', 'grouping_employments', 'employment_id'),
            ('positionIds', 'job_positions', 'Cargo', 'grouping_positions', 'position_id'),
            ('unitIds', 'company_units', 'Unidade', 'grouping_units', 'unit_id'),
          ]) {
            final ids = (input[key] as List?)?.cast<String>().toSet().toList();
            if (ids == null) continue;
            if (ids.isNotEmpty && (await tx.scalar<int>('SELECT count(*)::int FROM $table WHERE id::text = ANY(@ids) AND deleted_at IS NULL', {'ids': ids})) != ids.length) {
              throw notFound('$label não encontrado(a)');
            }
            await tx.execute('DELETE FROM $link WHERE grouping_id = @g', {'g': id});
            if (ids.isNotEmpty) {
              await tx.execute('INSERT INTO $link (grouping_id, $col, tenant_id) SELECT @g, x::uuid, @t FROM unnest(@ids::text[]) AS x', {'g': id, 't': tenantId, 'ids': ids});
            }
          }
          await app.audit.record(
            tx,
            tenantId: tenantId,
            actorUserId: ctx.user.id,
            action: 'UPDATE',
            entity: 'grouping',
            entityId: id,
            after: {'employments': (input['employmentIds'] as List?)?.length, 'positions': (input['positionIds'] as List?)?.length, 'units': (input['unitIds'] as List?)?.length},
            meta: ctx.meta,
          );
        });
        return members(tenantId, id);
      }, status: 200);
    });
  }

  // ------------------------------------------------------------------ importação por planilha
  static const _contracts = {
    'clt': 'CLT',
    'celetista': 'CLT',
    'estatutario': 'STATUTORY',
    'temporario': 'TEMPORARY',
    'estagiario': 'INTERN',
    'estagio': 'INTERN',
    'aprendiz': 'APPRENTICE',
    'terceirizado': 'CONTRACTOR',
    'autonomo': 'SERVICE_PROVIDER',
    'voluntario': 'VOLUNTEER',
  };

  Future<Map<String, Object?>> _runImport(String tenantId, AuthUser user, Map<String, Object?> input, Map<String, Object?> meta) async {
    final rows = (input['rows']! as List).cast<Map<String, Object?>>();
    if (rows.isEmpty) throw badRequest('A planilha está vazia');
    final companyId = input['companyId']! as String;
    final createMissing = input['createMissing'] == true, updateExisting = input['updateExisting'] == true;

    final cat = await db.forTenant(tenantId, (tx) async {
      if (await tx.one('SELECT 1 FROM companies WHERE id = @id AND deleted_at IS NULL', {'id': companyId}) == null) throw badRequest('Empresa não encontrada');
      Map<String, String> index(List<Row> list, List<String> fields) => {
        for (final x in list)
          for (final f in fields)
            if (x[f] != null && x[f].toString().isNotEmpty) importKey(x[f].toString()): x['id']! as String,
      };
      final p = {'c': companyId};
      return (
        departments: index(await tx.query('SELECT id, name, code FROM departments WHERE company_id = @c AND deleted_at IS NULL', p), ['name', 'code']),
        positions: index(await tx.query('SELECT id, name FROM job_positions WHERE company_id = @c AND deleted_at IS NULL', p), ['name']),
        functions: index(await tx.query('SELECT id, name, code FROM job_functions WHERE deleted_at IS NULL'), ['name', 'code']),
        costCenters: index(await tx.query('SELECT id, name, code FROM cost_centers WHERE deleted_at IS NULL'), ['name', 'code']),
        types: index(await tx.query('SELECT id, name, code FROM employee_types WHERE deleted_at IS NULL'), ['name', 'code']),
        unions: index(await tx.query('SELECT id, name, acronym FROM labor_unions WHERE deleted_at IS NULL'), ['acronym', 'name']),
        sectors: await tx.query('SELECT s.id, s.name, s.department_id FROM sectors s JOIN departments d ON d.id = s.department_id WHERE s.deleted_at IS NULL AND d.company_id = @c', p),
        existing: {
          for (final e in await tx.query('SELECT id, registration FROM employment_relationships WHERE company_id = @c AND deleted_at IS NULL', p))
            importKey(e['registration']! as String): e['id']! as String,
        },
      );
    });

    final missing = <String, Set<String>>{'departments': {}, 'positions': {}, 'functions': {}, 'costCenters': {}, 'types': {}};
    final maps = {'departments': cat.departments, 'positions': cat.positions, 'functions': cat.functions, 'costCenters': cat.costCenters, 'types': cat.types};
    final seenReg = <String, int>{};
    final prepared = <({Map<String, Object?> result, Map<String, Object?>? data, String? existingId, Map<String, String> refs})>[];

    for (var i = 0; i < rows.length; i++) {
      final r = rows[i].map((k, v) => MapEntry(k, v as String?));
      String? t(String k) => r[k]?.trim().isEmpty ?? true ? null : r[k]!.trim();
      final line = i + 2;
      final msgs = <String>[];
      final reg = t('matricula'), name = t('nome');
      final cpf = r['cpf'] != null ? onlyDigits(r['cpf']!) : '', pis = r['pis'] != null ? onlyDigits(r['pis']!) : '';
      if (name == null) msgs.add('Nome obrigatório');
      if (reg == null) msgs.add('Matrícula obrigatória');
      if (cpf.isNotEmpty && !isValidCpf(cpf)) msgs.add('CPF inválido (${r['cpf']})');
      if (pis.isNotEmpty && !isValidPis(pis)) msgs.add('PIS inválido (${r['pis']})');
      if (cpf.isEmpty && pis.isEmpty) msgs.add('Informe CPF ou PIS');
      final hired = parseImportDate(r['admissao']);
      if (hired == null) msgs.add(r['admissao'] != null && r['admissao']!.isNotEmpty ? 'Data de admissão inválida (${r['admissao']})' : 'Data de admissão obrigatória');
      final birth = r['nascimento'] != null && r['nascimento']!.isNotEmpty ? parseImportDate(r['nascimento']) : null;
      if (r['nascimento'] != null && r['nascimento']!.isNotEmpty && birth == null) msgs.add('Data de nascimento inválida (${r['nascimento']})');
      if (reg != null) {
        final k = importKey(reg);
        if (seenReg.containsKey(k)) {
          msgs.add('Matrícula repetida na planilha (linha ${seenReg[k]})');
        } else {
          seenReg[k] = line;
        }
      }
      final contract = r['contrato'] != null && r['contrato']!.isNotEmpty ? _contracts[importKey(r['contrato']!)] : 'CLT';
      if (r['contrato'] != null && r['contrato']!.isNotEmpty && contract == null) msgs.add('Tipo de contrato desconhecido (${r['contrato']})');
      num? hours;
      if (r['carga_semanal'] != null && r['carga_semanal']!.isNotEmpty) {
        hours = num.tryParse(r['carga_semanal']!.replaceFirst(',', '.'));
        if (hours == null || hours <= 0 || hours > 80) msgs.add('Carga semanal inválida (${r['carga_semanal']})');
      }
      final refs = <String, String>{};
      void resolve(String field, String bucket, String label, String refKey) {
        final v = t(field);
        if (v == null) return;
        final id = maps[bucket]![importKey(v)];
        if (id != null) {
          refs[refKey] = id;
        } else if (createMissing) {
          missing[bucket]!.add(v);
          refs[refKey] = 'new:${importKey(v)}';
        } else {
          msgs.add('$label "$v" não cadastrado(a)');
        }
      }

      resolve('departamento', 'departments', 'Departamento', 'departmentId');
      resolve('cargo', 'positions', 'Cargo', 'positionId');
      resolve('funcao', 'functions', 'Função', 'functionId');
      resolve('centro_custo', 'costCenters', 'Centro de custo', 'costCenterId');
      resolve('tipo', 'types', 'Tipo de funcionário', 'employeeTypeId');
      if (t('sindicato') != null) {
        final id = cat.unions[importKey(r['sindicato']!)];
        if (id != null) {
          refs['unionId'] = id;
        } else {
          msgs.add('Sindicato "${r['sindicato']}" não cadastrado (sindicatos não são criados automaticamente)');
        }
      }
      if (t('secao') != null) {
        final dep = refs['departmentId'];
        final s = cat.sectors.where((x) => importKey(x['name']! as String) == importKey(r['secao']!) && (dep == null || x['departmentId'] == dep)).firstOrNull;
        if (s != null) {
          refs['sectorId'] = s['id']! as String;
        } else {
          msgs.add('Seção "${r['secao']}" não encontrada${dep != null ? ' no departamento informado' : ''}');
        }
      }
      final existingId = reg == null ? null : cat.existing[importKey(reg)];
      if (existingId != null && !updateExisting) msgs.add('Matrícula já cadastrada nesta empresa (marque "atualizar existentes" para atualizar)');
      final result = <String, Object?>{'line': line, 'registration': reg, 'name': name, 'status': msgs.isEmpty ? 'ok' : 'error', 'messages': msgs};
      if (msgs.isNotEmpty) {
        prepared.add((result: result, data: null, existingId: null, refs: refs));
        continue;
      }
      try {
        final data = employeeCreate.parse({
          'companyId': companyId,
          'fullName': name,
          'socialName': ?t('nome_social'),
          if (cpf.isNotEmpty) 'cpf': cpf,
          if (pis.isNotEmpty) 'pis': pis,
          'birthDate': ?birth,
          'email': ?t('email'),
          if (r['telefone'] != null && onlyDigits(r['telefone']!).isNotEmpty) 'phone': onlyDigits(r['telefone']!),
          if (r['cep'] != null && r['cep']!.isNotEmpty) 'address': {'zipCode': onlyDigits(r['cep']!), 'number': ?t('numero'), 'complement': ?t('complemento')},
          'registration': reg,
          'hiredAt': hired,
          'contractType': contract,
          'weeklyHours': ?hours,
        });
        prepared.add((result: result, data: data, existingId: existingId, refs: refs));
      } on HttpError catch (e) {
        result['status'] = 'error';
        result['messages'] = [
          for (final m in (e.body['message'] as List? ?? [e.body['message']])) m.toString(),
        ];
        prepared.add((result: result, data: null, existingId: null, refs: refs));
      }
    }

    Map<String, Object?> summary() => {
      'total': prepared.length,
      'valid': prepared.where((p) => p.result['status'] != 'error').length,
      'errors': prepared.where((p) => p.result['status'] == 'error').length,
      'created': prepared.where((p) => p.result['status'] == 'created').length,
      'updated': prepared.where((p) => p.result['status'] == 'updated').length,
      'toCreate': {for (final e in missing.entries) e.key: e.value.toList()},
    };
    if (input['dryRun'] == true) {
      return {
        'dryRun': true,
        ...summary(),
        'results': [for (final p in prepared) p.result],
      };
    }

    // O plano precisa comportar todos os novos funcionários antes de gravar qualquer coisa.
    final novos = prepared.where((p) => p.data != null && p.existingId == null).length;
    if (novos > 0) await db.forTenant(tenantId, (tx) => assertLimit(tx, tenantId, 'limit.employments', novos));
    // Cria os cadastros que faltam (uma vez cada) e troca as referências "new:".
    final created = <String, Map<String, String>>{};
    await db.forTenant(tenantId, (tx) async {
      for (final (bucket, table, scoped) in const [
        ('departments', 'departments', true),
        ('positions', 'job_positions', true),
        ('functions', 'job_functions', false),
        ('costCenters', 'cost_centers', false),
        ('types', 'employee_types', false),
      ]) {
        created[bucket] = {};
        for (final n in missing[bucket]!) {
          final row = await tx.insert(table, {'tenantId': tenantId, if (scoped) 'companyId': companyId, 'name': n});
          created[bucket]![importKey(n)] = row['id']! as String;
        }
      }
    });
    const bucketOf = {'departmentId': 'departments', 'positionId': 'positions', 'functionId': 'functions', 'costCenterId': 'costCenters', 'employeeTypeId': 'types'};
    for (final p in prepared) {
      if (p.data == null) continue;
      final refs = {for (final e in p.refs.entries) e.key: e.value.startsWith('new:') ? created[bucketOf[e.key]]![e.value.substring(4)] : e.value};
      try {
        if (p.existingId != null) {
          final rest = {...p.data!}
            ..remove('companyId')
            ..remove('hiredAt');
          await update(tenantId, user, p.existingId!, {...rest, ...refs, 'reason': 'Importação de planilha'}, meta);
          p.result['status'] = 'updated';
        } else {
          await create(tenantId, user, {...p.data!, ...refs}, meta);
          p.result['status'] = 'created';
        }
      } on HttpError catch (e) {
        p.result['status'] = 'error';
        p.result['messages'] = [e.body['message'].toString()];
      } catch (e) {
        p.result['status'] = 'error';
        p.result['messages'] = [e.toString()];
      }
    }
    return {
      'dryRun': false,
      ...summary(),
      'results': [for (final p in prepared) p.result],
    };
  }
}

/// Chave de comparação: sem acentos, minúsculas, sem espaços nas pontas.
String importKey(String v) {
  const from = 'áàâãäéèêëíìîïóòôõöúùûüçñ';
  const to = 'aaaaaeeeeiiiiooooouuuucn';
  final sb = StringBuffer();
  for (final ch in v.trim().toLowerCase().split('')) {
    final i = from.indexOf(ch);
    sb.write(i >= 0 ? to[i] : ch);
  }
  return sb.toString();
}

/// dd/mm/aaaa, dd-mm-aaaa ou aaaa-mm-dd → aaaa-mm-dd (ou null se inválida).
String? parseImportDate(String? v) {
  if (v == null || v.trim().isEmpty) return null;
  final s = v.trim();
  int y, m, d;
  final br = RegExp(r'^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$').firstMatch(s);
  final iso = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(s);
  if (br != null) {
    d = int.parse(br[1]!);
    m = int.parse(br[2]!);
    y = int.parse(br[3]!);
  } else if (iso != null) {
    y = int.parse(iso[1]!);
    m = int.parse(iso[2]!);
    d = int.parse(iso[3]!);
  } else {
    return null;
  }
  final dt = DateTime.utc(y, m, d);
  if (dt.year != y || dt.month != m || dt.day != d) return null;
  return isoMs(dt).substring(0, 10);
}
