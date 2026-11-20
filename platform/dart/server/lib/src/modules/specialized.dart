// Módulos especializados: plantões (saúde), grade e aulas (educação) e ocorrências operacionais.
// Só dados administrativos: nada de paciente, aluno ou informação clínica.
import 'package:sp_core/sp_core.dart' as core;

import '../app.dart';
import '../auth/auth_user.dart';
import '../db.dart';
import '../http.dart';
import '../validate.dart';
import 'schedules.dart' show isoDay;
import 'timesheet.dart';
import 'timesheet_core.dart';

final _hm = Str(pattern: RegExp(r'^([01]\d|2[0-3]):[0-5]\d$'), patternMessage: 'Horário HH:mm');
int _toMin(String v) => int.parse(v.substring(0, 2)) * 60 + int.parse(v.substring(3));
String _brFull(DateTime at) {
  final l = localBr(at);
  return '${l.date.split('-').reversed.join('/')}, ${l.time}:${core.localParts(at, tz).second.toString().padLeft(2, '0')}';
}

// ------------------------------------------------------------------ saúde
final _shift =
    Obj({
      'unitId': uuid,
      'specialtyId': uuid.nullish,
      'kind': const Enum(['DAY', 'NIGHT', 'H12', 'H24', 'ON_CALL', 'EXTRA', 'COVERAGE']),
      'startsAt': const DateTimeS(),
      'endsAt': const DateTimeS(),
      'requiredProfessionals': const Num(int: true, min: 1, max: 50).def(1),
      'notes': const Str(trim: true, max: 500).nullish,
      'repeatDays': const Num(int: true, min: 0, max: 62).def(0),
    }).check(
      (s) {
        final a = s['startsAt']! as DateTime, b = s['endsAt']! as DateTime;
        return b.isAfter(a) && b.difference(a).inMilliseconds <= 36 * 3600000;
      },
      'O fim deve ser depois do início (até 36 horas)',
      path: ['endsAt'],
    );
final _shiftList = Obj({'unitId': uuid.optional, 'from': date, 'to': date});
final _assignStatus = Obj({
  'status': const Enum(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'ABSENT', 'CANCELLED']),
});
final _substitution = Obj({'substituteEmploymentId': uuid, 'reason': const Str(trim: true, min: 5, max: 300)});

// ------------------------------------------------------------------ educação
final _course = Obj({'companyId': uuid, 'name': const Str(trim: true, min: 2, max: 120), 'level': const Str(trim: true, max: 60).nullish});
final _subject = Obj({
  'companyId': uuid,
  'courseId': uuid.nullish,
  'name': const Str(trim: true, min: 2, max: 120),
  'code': const Str(trim: true, max: 20).nullish,
  'weeklyLessons': const Num(int: true, min: 1, max: 60).nullish,
});
final _period = Obj({'companyId': uuid, 'name': const Str(trim: true, min: 2, max: 60), 'startsOn': date, 'endsOn': date})
    .check((p) => (p['endsOn']! as String).compareTo(p['startsOn']! as String) > 0, 'O fim deve ser depois do início', path: ['endsOn']);
final _class = Obj({
  'unitId': uuid,
  'periodId': uuid,
  'courseId': uuid.nullish,
  'name': const Str(trim: true, min: 1, max: 60),
  'grade': const Str(trim: true, max: 30).nullish,
  'shift': const Enum(['MANHA', 'TARDE', 'NOITE', 'INTEGRAL']).nullish,
});
final _teaching = Obj({'employmentId': uuid, 'subjectId': uuid, 'classId': uuid, 'weeklyLessons': const Num(int: true, min: 1, max: 60).nullish, 'validFrom': date, 'validTo': date.nullish});
final _classroom = Obj({'unitId': uuid, 'name': const Str(trim: true, min: 1, max: 60), 'capacity': const Num(int: true, min: 1, max: 1000).nullish});
final _slot = Obj({'assignmentId': uuid, 'classroomId': uuid.nullish, 'weekday': const Num(int: true, min: 0, max: 6), 'startTime': _hm, 'endTime': _hm})
    .check((s) => _toMin(s['endTime']! as String) > _toMin(s['startTime']! as String), 'O fim deve ser depois do início', path: ['endTime']);
final _session = Obj({
  'scheduleId': uuid,
  'date': date,
  'status': const Enum(['HELD', 'NOT_HELD', 'SUBSTITUTED', 'CANCELLED']),
  'substituteEmploymentId': uuid.nullish,
  'notes': const Str(trim: true, max: 300).nullish,
}).check((s) => s['status'] != 'SUBSTITUTED' || s['substituteEmploymentId'] != null, 'Informe o professor substituto', path: ['substituteEmploymentId']);

// ------------------------------------------------------------------ operacional
const occurrenceTypes = [
  'ABSENCE',
  'LATE',
  'EARLY_LEAVE',
  'MISSING_RECORD',
  'OVERTIME',
  'INSUFFICIENT_BREAK',
  'UNCOVERED_SHIFT',
  'SHIFT_NOT_STARTED',
  'SHIFT_NOT_CLOSED',
  'SCHEDULE_CONFLICT',
  'INCOMPLETE_TEAM',
  'OPERATIONAL_ISSUE',
  'PROFESSIONAL_SWAP',
  'SCHEDULE_CHANGE',
  'EQUIPMENT_UNAVAILABLE',
  'OTHER',
];
final _occurrence = Obj({
  'unitId': uuid,
  'type': const Enum(occurrenceTypes),
  'title': const Str(trim: true, min: 3, max: 150),
  'description': const Str(trim: true, max: 2000).nullish,
  'occurredAt': const DateTimeS(),
  'employmentId': uuid.nullish,
  'responsibleId': uuid.nullish,
});
final _occList = Obj({
  'status': const Enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'ACTIVE']).def('ACTIVE'),
  'unitId': uuid.optional,
  'type': const Enum(occurrenceTypes).optional,
});
final _action =
    Obj({
          'action': const Enum(['START', 'RESOLVE', 'DISMISS', 'REOPEN', 'COMMENT']),
          'notes': const Str(trim: true, max: 1000).optional,
          'responsibleId': uuid.nullish,
        })
        .check((a) => a['action'] != 'COMMENT' || ((a['notes'] as String?)?.length ?? 0) > 0, 'Escreva o comentário', path: ['notes'])
        .check((a) => !['RESOLVE', 'DISMISS'].contains(a['action']) || ((a['notes'] as String?)?.length ?? 0) >= 3, 'Explique como foi tratada', path: ['notes']);
const _next = {'START': 'IN_PROGRESS', 'RESOLVE': 'RESOLVED', 'DISMISS': 'DISMISSED', 'REOPEN': 'OPEN', 'COMMENT': null};

class SpecializedModule {
  SpecializedModule(this.app, this.timesheet);
  final App app;
  final TimesheetModule timesheet;
  Db get db => app.db;

  // ------------------------------------------------------------------ plantões
  /// Escala o profissional; recusa vínculo de outra empresa ou plantão no mesmo horário.
  Future<Row> _place(Tx tx, String tenantId, String shiftId, String employmentId) async {
    final s = await tx.one('SELECT s.*, u.company_id AS u_company_id FROM medical_shifts s JOIN company_units u ON u.id = s.unit_id WHERE s.id = @id AND s.deleted_at IS NULL', {'id': shiftId});
    if (s == null) throw notFound('Plantão não encontrado');
    final e = await tx.one("SELECT company_id FROM employment_relationships WHERE id = @e AND deleted_at IS NULL AND status <> 'TERMINATED'", {'e': employmentId});
    if (e == null || e['companyId'] != s['uCompanyId']) throw badRequest('Profissional não encontrado nesta empresa');
    final clash = await tx.one(
      'SELECT ms.starts_at FROM medical_shift_assignments a JOIN medical_shifts ms ON ms.id = a.shift_id WHERE a.employment_id = @e AND a.shift_id <> @s '
      "AND a.status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS') AND ms.deleted_at IS NULL AND ms.starts_at < @end AND ms.ends_at > @start LIMIT 1",
      {'e': employmentId, 's': shiftId, 'start': s['startsAt'], 'end': s['endsAt']},
    );
    if (clash != null) throw conflict('O profissional já está em outro plantão que começa em ${_brFull(clash['startsAt']! as DateTime)}');
    final existing = await tx.one('SELECT id, status::text AS status FROM medical_shift_assignments WHERE shift_id = @s AND employment_id = @e', {'s': shiftId, 'e': employmentId});
    if (existing != null && !['CANCELLED', 'SUBSTITUTED', 'ABSENT'].contains(existing['status'])) throw conflict('Profissional já escalado neste plantão');
    return existing != null
        ? (await tx.one("UPDATE medical_shift_assignments SET status = 'SCHEDULED', check_in_at = NULL, check_out_at = NULL WHERE id = @id RETURNING *, status::text AS status", {
            'id': existing['id'],
          }))!
        : await tx.insert('medical_shift_assignments', {'tenantId': tenantId, 'shiftId': shiftId, 'employmentId': employmentId});
  }

  Future<void> _requireUnit(Tx tx, Object? unitId) async {
    if (await tx.one('SELECT 1 FROM company_units WHERE id = @u AND deleted_at IS NULL', {'u': unitId}) == null) throw notFound('Unidade não encontrada');
  }

  Map<String, Object?> _shiftData(Map<String, Object?> input) => {
    'unitId': input['unitId'],
    'specialtyId': input['specialtyId'],
    'kind': input['kind'],
    'startsAt': input['startsAt'],
    'endsAt': input['endsAt'],
    'requiredProfessionals': input['requiredProfessionals'],
    'notes': input['notes'],
  };

  void routes() {
    final r = app.router;

    r.group('/v1/health', tag: 'saúde', () {
      r.get('/shifts', permission: 'health.shifts:read', (ctx) {
        final q = _shiftList.parse(ctx.query);
        final from = brMidnight(q['from']! as String), to = brMidnight(q['to']! as String).add(const Duration(days: 1));
        if (to.difference(from).inMilliseconds / 86400000 > 62) throw badRequest('Período de até 62 dias');
        return db.forTenant(ctx.tenant, (tx) async {
          final shifts = await tx.query(
            'SELECT s.*, s.kind::text AS kind, u.name AS unit, sp.name AS specialty FROM medical_shifts s JOIN company_units u ON u.id = s.unit_id '
            'LEFT JOIN professional_specialties sp ON sp.id = s.specialty_id WHERE s.deleted_at IS NULL AND s.starts_at < @to AND s.ends_at > @from'
            '${q['unitId'] != null ? ' AND s.unit_id = @u' : ''} ORDER BY s.starts_at ASC',
            {'from': from, 'to': to, 'u': q['unitId']},
          );
          final assigns = shifts.isEmpty
              ? <Row>[]
              : await tx.query(
                  'SELECT a.id, a.shift_id, a.employment_id, a.status::text AS status, e.registration, p.full_name, p.social_name, '
                  "(SELECT x.id FROM shift_substitutions x WHERE x.assignment_id = a.id AND x.status = 'PENDING' LIMIT 1) AS pending "
                  'FROM medical_shift_assignments a JOIN employment_relationships e ON e.id = a.employment_id JOIN people p ON p.id = e.person_id '
                  "WHERE a.shift_id::text = ANY(@ids) AND a.status <> 'CANCELLED' ORDER BY a.created_at ASC",
                  {
                    'ids': [for (final s in shifts) s['id']! as String],
                  },
                );
          return [
            for (final s in shifts)
              () {
                final mine = assigns.where((a) => a['shiftId'] == s['id']).toList();
                final active = mine.where((a) => a['status'] != 'SUBSTITUTED' && a['status'] != 'ABSENT').length;
                final req = s['requiredProfessionals']! as int;
                return {
                  'id': s['id'],
                  'unitId': s['unitId'],
                  'unit': s['unit'],
                  'specialty': s['specialty'],
                  'kind': s['kind'],
                  'startsAt': s['startsAt'],
                  'endsAt': s['endsAt'],
                  'notes': s['notes'],
                  'requiredProfessionals': req,
                  'covered': active,
                  'missing': req - active > 0 ? req - active : 0,
                  'assignments': [
                    for (final a in mine)
                      {
                        'id': a['id'],
                        'employmentId': a['employmentId'],
                        'name': a['socialName'] ?? a['fullName'],
                        'registration': a['registration'],
                        'status': a['status'],
                        'pendingSubstitution': a['pending'],
                      },
                  ],
                };
              }(),
          ];
        });
      });

      // Plantões dos próximos dias do profissional logado.
      r.get('/shifts/mine', permission: 'health.shifts:read', (ctx) async {
        final user = ctx.user;
        if (user.personId == null) return <Object?>[];
        return db.forTenant(ctx.tenant, (tx) async {
          final list = await tx.query(
            'SELECT a.id, a.status::text AS status, a.check_in_at, a.check_out_at, s.kind::text AS kind, s.starts_at, s.ends_at, u.name AS unit FROM medical_shift_assignments a '
            'JOIN medical_shifts s ON s.id = a.shift_id JOIN company_units u ON u.id = s.unit_id JOIN employment_relationships e ON e.id = a.employment_id '
            "WHERE e.person_id = @p AND a.status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS') AND s.deleted_at IS NULL AND s.ends_at > now() ORDER BY s.starts_at ASC LIMIT 60",
            {'p': user.personId},
          );
          final now = DateTime.now();
          return [
            for (final a in list)
              {
                'id': a['id'],
                'status': a['status'],
                'unit': a['unit'],
                'kind': a['kind'],
                'startsAt': a['startsAt'],
                'endsAt': a['endsAt'],
                'checkInAt': a['checkInAt'],
                'checkOutAt': a['checkOutAt'],
                'canCheckIn': a['status'] != 'IN_PROGRESS' && !now.isBefore((a['startsAt']! as DateTime).subtract(const Duration(hours: 2))) && now.isBefore(a['endsAt']! as DateTime),
                'canCheckOut': a['status'] == 'IN_PROGRESS',
              },
          ];
        });
      });

      // Entrada e saída do próprio plantonista (registro administrativo; a jornada oficial continua sendo o ponto).
      Future<Row> selfCheck(Ctx ctx, String kind) {
        final id = ctx.uuidParam('id');
        final user = ctx.user, tenantId = ctx.tenant;
        if (user.personId == null) throw badRequest('Seu usuário não está ligado a um profissional');
        return db.forTenant(tenantId, (tx) async {
          final a = await tx.one(
            'SELECT a.id, a.status::text AS status, s.starts_at, s.ends_at, s.deleted_at FROM medical_shift_assignments a JOIN medical_shifts s ON s.id = a.shift_id '
            'JOIN employment_relationships e ON e.id = a.employment_id WHERE a.id = @id AND e.person_id = @p',
            {'id': id, 'p': user.personId},
          );
          if (a == null || a['deletedAt'] != null) throw notFound('Plantão não encontrado');
          final now = DateTime.now();
          if (kind == 'in') {
            if (!['SCHEDULED', 'CONFIRMED'].contains(a['status'])) throw conflict('Este plantão não está aguardando entrada');
            if (now.isBefore((a['startsAt']! as DateTime).subtract(const Duration(hours: 2))) || !now.isBefore(a['endsAt']! as DateTime)) {
              throw badRequest('A entrada vale de 2 horas antes do início até o fim do plantão');
            }
          } else if (a['status'] != 'IN_PROGRESS') {
            throw conflict('Registre a entrada antes da saída');
          }
          final u = (await tx.one(
            kind == 'in'
                ? "UPDATE medical_shift_assignments SET status = 'IN_PROGRESS', check_in_at = @n WHERE id = @id RETURNING *, status::text AS status"
                : "UPDATE medical_shift_assignments SET status = 'COMPLETED', check_out_at = @n WHERE id = @id RETURNING *, status::text AS status",
            {'n': now, 'id': id},
          ))!;
          await app.audit.record(
            tx,
            tenantId: tenantId,
            actorUserId: user.id,
            action: 'UPDATE',
            entity: 'medical_shift_assignment',
            entityId: id,
            after: {'selfCheck': kind, 'at': now},
            meta: ctx.meta,
          );
          return u;
        });
      }

      r.post('/assignments/:id/check-in', permission: 'health.shifts:read', status: 200, (ctx) => selfCheck(ctx, 'in'));
      r.post('/assignments/:id/check-out', permission: 'health.shifts:read', status: 200, (ctx) => selfCheck(ctx, 'out'));

      r.post('/shifts', permission: 'health.shifts:manage', (ctx) {
        final input = _shift.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await _requireUnit(tx, input['unitId']);
          if (input['specialtyId'] != null && await tx.one('SELECT 1 FROM professional_specialties WHERE id = @s', {'s': input['specialtyId']}) == null) {
            throw notFound('Especialidade não encontrada');
          }
          final ids = <Object?>[];
          for (var i = 0; i <= (input['repeatDays']! as int); i++) {
            final add = Duration(days: i);
            final row = await tx.insert('medical_shifts', {
              'tenantId': tenantId,
              ..._shiftData(input),
              'startsAt': (input['startsAt']! as DateTime).add(add),
              'endsAt': (input['endsAt']! as DateTime).add(add),
            });
            ids.add(row['id']);
          }
          await app.audit.record(
            tx,
            tenantId: tenantId,
            actorUserId: ctx.user.id,
            action: 'CREATE',
            entity: 'medical_shift',
            entityId: ids.first as String?,
            after: {...input, 'created': ids.length},
            meta: ctx.meta,
          );
          return {'created': ids.length, 'ids': ids};
        });
      });

      r.put('/shifts/:id', permission: 'health.shifts:manage', (ctx) {
        final id = ctx.uuidParam('id');
        final input = _shift.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final before = await tx.one('SELECT * FROM medical_shifts WHERE id = @id AND deleted_at IS NULL', {'id': id});
          if (before == null) throw notFound('Plantão não encontrado');
          await _requireUnit(tx, input['unitId']);
          final s = await tx.update('medical_shifts', id, _shiftData(input));
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'medical_shift', entityId: id, before: before, after: s, meta: ctx.meta);
          return s;
        });
      });

      r.delete('/shifts/:id', permission: 'health.shifts:manage', status: 204, (ctx) {
        final id = ctx.uuidParam('id');
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final before = await tx.one('SELECT * FROM medical_shifts WHERE id = @id AND deleted_at IS NULL', {'id': id});
          if (before == null) throw notFound('Plantão não encontrado');
          await tx.update('medical_shifts', id, {'deletedAt': DateTime.now()});
          await tx.execute("UPDATE medical_shift_assignments SET status = 'CANCELLED' WHERE shift_id = @id AND status IN ('SCHEDULED', 'CONFIRMED')", {'id': id});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'medical_shift', entityId: id, before: before, meta: ctx.meta);
          return null;
        });
      });

      r.post('/shifts/:id/assign', permission: 'health.shifts:manage', (ctx) {
        final id = ctx.uuidParam('id');
        final b = Obj({'employmentId': uuid}).parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final a = await _place(tx, tenantId, id, b['employmentId']! as String);
          await app.audit.record(
            tx,
            tenantId: tenantId,
            actorUserId: ctx.user.id,
            action: 'CREATE',
            entity: 'medical_shift_assignment',
            entityId: a['id'] as String?,
            after: {'shiftId': id, 'employmentId': b['employmentId']},
            meta: ctx.meta,
          );
          return a;
        });
      });

      r.post('/assignments/:id/status', permission: 'health.shifts:manage', status: 200, (ctx) {
        final id = ctx.uuidParam('id');
        final status = _assignStatus.parse(ctx.body)['status']! as String;
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final before = await tx.one('SELECT status::text AS status FROM medical_shift_assignments WHERE id = @id', {'id': id});
          if (before == null) throw notFound('Escala não encontrada');
          final now = DateTime.now();
          final a = await tx.one(
            'UPDATE medical_shift_assignments SET status = @s${status == 'IN_PROGRESS' ? ', check_in_at = @n' : ''}${status == 'COMPLETED' ? ', check_out_at = @n' : ''} '
            'WHERE id = @id RETURNING *, status::text AS status',
            {'s': status, 'n': now, 'id': id},
          );
          await app.audit.record(
            tx,
            tenantId: tenantId,
            actorUserId: ctx.user.id,
            action: 'UPDATE',
            entity: 'medical_shift_assignment',
            entityId: id,
            before: {'status': before['status']},
            after: {'status': status},
            meta: ctx.meta,
          );
          return a;
        });
      });

      r.post('/assignments/:id/substitution', permission: 'health.shifts:manage', (ctx) {
        final id = ctx.uuidParam('id');
        final input = _substitution.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final a = await tx.one("SELECT * FROM medical_shift_assignments WHERE id = @id AND status IN ('SCHEDULED', 'CONFIRMED')", {'id': id});
          if (a == null) throw notFound('Escala não encontrada ou já encerrada');
          if (a['employmentId'] == input['substituteEmploymentId']) throw badRequest('O substituto deve ser outro profissional');
          if (await tx.one("SELECT 1 FROM shift_substitutions WHERE assignment_id = @id AND status = 'PENDING'", {'id': id}) != null) throw conflict('Já há uma troca pendente para esta escala');
          final s = await tx.insert('shift_substitutions', {'tenantId': tenantId, 'assignmentId': id, ...input});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: 'shift_substitution', entityId: s['id'] as String?, after: input, meta: ctx.meta);
          return s;
        });
      });

      // Aprovar coloca o substituto (mesmas regras de conflito) e marca o original como substituído.
      r.post('/substitutions/:id/decide', permission: 'health.shifts:manage', status: 200, (ctx) {
        final id = ctx.uuidParam('id');
        final approve = Obj({'approve': const Bool()}).parse(ctx.body)['approve'] == true;
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final s = await tx.one("SELECT x.*, a.shift_id FROM shift_substitutions x JOIN medical_shift_assignments a ON a.id = x.assignment_id WHERE x.id = @id AND x.status = 'PENDING'", {'id': id});
          if (s == null) throw notFound('Troca não encontrada ou já decidida');
          if (approve) {
            await _place(tx, tenantId, s['shiftId']! as String, s['substituteEmploymentId']! as String);
            await tx.execute("UPDATE medical_shift_assignments SET status = 'SUBSTITUTED' WHERE id = @a", {'a': s['assignmentId']});
          }
          final d = await tx.one('UPDATE shift_substitutions SET status = @st, decided_by_id = @u WHERE id = @id RETURNING *, status::text AS status', {
            'st': approve ? 'APPROVED' : 'REJECTED',
            'u': ctx.user.id,
            'id': id,
          });
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: approve ? 'APPROVE' : 'REJECT', entity: 'shift_substitution', entityId: id, meta: ctx.meta);
          return d;
        });
      });
    });

    // ------------------------------------------------------------------ educação
    Future<void> company(Tx tx, Object? id) async {
      if (await tx.one('SELECT 1 FROM companies WHERE id = @c AND deleted_at IS NULL', {'c': id}) == null) throw notFound('Empresa não encontrada');
    }

    Future<List<Map<String, Object?>>> lessonsOfDay(String tenantId, String companyId, String d) => db.forTenant(tenantId, (tx) async {
      await company(tx, companyId);
      final rows = await tx.query(
        'SELECT cs.id, cs.start_time, cs.end_time, cl.name AS class_name, sb.name AS subject, p.full_name, p.social_name, rm.name AS classroom, '
        'ses.status::text AS ses_status, ses.substitute_employment_id, ses.notes, sp.full_name AS sub_full_name, sp.social_name AS sub_social_name '
        'FROM class_schedules cs JOIN teaching_assignments ta ON ta.id = cs.assignment_id JOIN subjects sb ON sb.id = ta.subject_id JOIN classes cl ON cl.id = ta.class_id '
        'JOIN employment_relationships e ON e.id = ta.employment_id JOIN people p ON p.id = e.person_id LEFT JOIN classrooms rm ON rm.id = cs.classroom_id '
        'LEFT JOIN class_sessions ses ON ses.schedule_id = cs.id AND ses.session_date = @d '
        'LEFT JOIN employment_relationships se ON se.id = ses.substitute_employment_id LEFT JOIN people sp ON sp.id = se.person_id '
        'WHERE cs.weekday = @w AND ta.valid_from <= @d AND (ta.valid_to IS NULL OR ta.valid_to >= @d) AND sb.company_id = @c ORDER BY cs.start_time ASC',
        {'d': d, 'w': core.weekday(d), 'c': companyId},
      );
      return [
        for (final x in rows)
          {
            'scheduleId': x['id'],
            'startTime': x['startTime'],
            'endTime': x['endTime'],
            'className': x['className'],
            'subject': x['subject'],
            'teacher': x['socialName'] ?? x['fullName'],
            'classroom': x['classroom'],
            'status': x['sesStatus'] ?? 'SCHEDULED',
            'substitute': x['substituteEmploymentId'] == null ? null : (x['subSocialName'] ?? x['subFullName']),
            'notes': x['notes'],
          },
      ];
    });

    r.group('/v1/education', tag: 'educação', () {
      r.get('', permission: 'education.academic:read', (ctx) {
        final q = Obj({'companyId': uuid}).parse(ctx.query);
        final companyId = q['companyId']! as String;
        return db.forTenant(ctx.tenant, (tx) async {
          await company(tx, companyId);
          final classrooms = await tx.query(
            'SELECT r.id, r.name, r.capacity, r.unit_id FROM classrooms r JOIN company_units u ON u.id = r.unit_id WHERE u.company_id = @c AND u.deleted_at IS NULL AND r.deleted_at IS NULL ORDER BY r.name ASC',
            {'c': companyId},
          );
          final courses = await tx.query('SELECT * FROM courses WHERE company_id = @c AND deleted_at IS NULL ORDER BY name ASC', {'c': companyId});
          final subjects = await tx.query('SELECT * FROM subjects WHERE company_id = @c AND deleted_at IS NULL ORDER BY name ASC', {'c': companyId});
          final periods = await tx.query(
            'SELECT ap.id, ap.name, ap.starts_on, ap.ends_on FROM academic_periods ap JOIN calendars c ON c.id = ap.calendar_id WHERE c.company_id = @c AND c.is_academic AND c.deleted_at IS NULL ORDER BY ap.starts_on DESC',
            {'c': companyId},
          );
          final classes = periods.isEmpty
              ? <Row>[]
              : await tx.query(
                  'SELECT cl.*, co.name AS course FROM classes cl LEFT JOIN courses co ON co.id = cl.course_id WHERE cl.deleted_at IS NULL AND cl.period_id::text = ANY(@p) ORDER BY cl.name ASC',
                  {
                    'p': [for (final p in periods) p['id']! as String],
                  },
                );
          final assigns = classes.isEmpty
              ? <Row>[]
              : await tx.query(
                  'SELECT ta.*, sb.name AS subject, p.full_name, p.social_name FROM teaching_assignments ta JOIN subjects sb ON sb.id = ta.subject_id '
                  'JOIN employment_relationships e ON e.id = ta.employment_id JOIN people p ON p.id = e.person_id WHERE ta.class_id::text = ANY(@c) AND (ta.valid_to IS NULL OR ta.valid_to >= @today)',
                  {
                    'c': [for (final c in classes) c['id']! as String],
                    'today': DateTime.now(),
                  },
                );
          final slots = assigns.isEmpty
              ? <Row>[]
              : await tx.query(
                  'SELECT s.*, r.name AS classroom FROM class_schedules s LEFT JOIN classrooms r ON r.id = s.classroom_id WHERE s.assignment_id::text = ANY(@a) ORDER BY s.weekday ASC, s.start_time ASC',
                  {
                    'a': [for (final a in assigns) a['id']! as String],
                  },
                );
          return {
            'courses': courses,
            'subjects': subjects,
            'periods': [
              for (final p in periods) {'id': p['id'], 'name': p['name'], 'startsOn': isoDay(p['startsOn']), 'endsOn': isoDay(p['endsOn'])},
            ],
            'classrooms': classrooms,
            'classes': [
              for (final c in classes)
                {
                  'id': c['id'],
                  'name': c['name'],
                  'grade': c['grade'],
                  'shift': c['shift'],
                  'unitId': c['unitId'],
                  'periodId': c['periodId'],
                  'courseId': c['courseId'],
                  'course': c['course'],
                  'assignments': [
                    for (final a in assigns.where((a) => a['classId'] == c['id']))
                      {
                        'id': a['id'],
                        'employmentId': a['employmentId'],
                        'teacher': a['socialName'] ?? a['fullName'],
                        'subjectId': a['subjectId'],
                        'subject': a['subject'],
                        'weeklyLessons': a['weeklyLessons'],
                        'slots': [
                          for (final s in slots.where((s) => s['assignmentId'] == a['id']))
                            {'id': s['id'], 'weekday': s['weekday'], 'startTime': s['startTime'], 'endTime': s['endTime'], 'classroom': s['classroom']},
                        ],
                      },
                  ],
                },
            ],
          };
        });
      });

      r.post('/courses', permission: 'education.academic:manage', (ctx) {
        final b = _course.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await company(tx, b['companyId']);
          if (await tx.one('SELECT 1 FROM courses WHERE company_id = @c AND name = @n AND deleted_at IS NULL', {'c': b['companyId'], 'n': b['name']}) != null) {
            throw conflict('Já existe um curso com esse nome');
          }
          final c = await tx.insert('courses', {'tenantId': tenantId, ...b});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: 'course', entityId: c['id'] as String?, after: c, meta: ctx.meta);
          return c;
        });
      });

      r.post('/subjects', permission: 'education.academic:manage', (ctx) {
        final b = _subject.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await company(tx, b['companyId']);
          if (b['courseId'] != null && await tx.one('SELECT 1 FROM courses WHERE id = @id AND company_id = @c AND deleted_at IS NULL', {'id': b['courseId'], 'c': b['companyId']}) == null) {
            throw notFound('Curso não encontrado');
          }
          final s = await tx.insert('subjects', {'tenantId': tenantId, ...b});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: 'subject', entityId: s['id'] as String?, after: s, meta: ctx.meta);
          return s;
        });
      });

      // Período letivo dentro do calendário acadêmico da empresa (criado na primeira vez).
      r.post('/periods', permission: 'education.academic:manage', (ctx) {
        final b = _period.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await company(tx, b['companyId']);
          final cal =
              await tx.one('SELECT id FROM calendars WHERE company_id = @c AND is_academic AND deleted_at IS NULL LIMIT 1', {'c': b['companyId']}) ??
              await tx.insert('calendars', {'tenantId': tenantId, 'companyId': b['companyId'], 'name': 'Calendário letivo', 'isAcademic': true});
          final p = await tx.insert('academic_periods', {'tenantId': tenantId, 'calendarId': cal['id'], 'name': b['name'], 'startsOn': b['startsOn'], 'endsOn': b['endsOn']});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: 'academic_period', entityId: p['id'] as String?, after: b, meta: ctx.meta);
          return p;
        });
      });

      r.post('/classes', permission: 'education.academic:manage', (ctx) {
        final b = _class.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await _requireUnit(tx, b['unitId']);
          if (await tx.one('SELECT 1 FROM academic_periods WHERE id = @p', {'p': b['periodId']}) == null) throw notFound('Período letivo não encontrado');
          final c = await tx.insert('classes', {'tenantId': tenantId, ...b});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: 'school_class', entityId: c['id'] as String?, after: c, meta: ctx.meta);
          return c;
        });
      });

      r.post('/assignments', permission: 'education.academic:manage', (ctx) {
        final b = _teaching.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final e = await tx.one("SELECT 1 FROM employment_relationships WHERE id = @e AND deleted_at IS NULL AND status <> 'TERMINATED'", {'e': b['employmentId']});
          final s = await tx.one('SELECT weekly_lessons FROM subjects WHERE id = @s AND deleted_at IS NULL', {'s': b['subjectId']});
          final c = await tx.one('SELECT 1 FROM classes WHERE id = @c AND deleted_at IS NULL', {'c': b['classId']});
          if (e == null) throw notFound('Professor não encontrado');
          if (s == null || c == null) throw notFound('Disciplina ou turma não encontrada');
          if (await tx.one('SELECT 1 FROM teaching_assignments WHERE class_id = @c AND subject_id = @s AND valid_to IS NULL', {'c': b['classId'], 's': b['subjectId']}) != null) {
            throw conflict('Esta disciplina já tem professor nesta turma: encerre a alocação atual antes');
          }
          final a = await tx.insert('teaching_assignments', {'tenantId': tenantId, ...b, 'weeklyLessons': b['weeklyLessons'] ?? s['weeklyLessons']});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: 'teaching_assignment', entityId: a['id'] as String?, after: b, meta: ctx.meta);
          return a;
        });
      });

      r.post('/assignments/:id/end', permission: 'education.academic:manage', status: 200, (ctx) {
        final id = ctx.uuidParam('id');
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          if (await tx.one('SELECT 1 FROM teaching_assignments WHERE id = @id', {'id': id}) == null) throw notFound('Alocação não encontrada');
          final today = todayUtcDate();
          final u = await tx.update('teaching_assignments', id, {'validTo': today});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'teaching_assignment', entityId: id, after: {'validTo': today}, meta: ctx.meta);
          return u;
        });
      });

      // Horário na grade; recusa quando o professor (ou a sala) já tem aula no mesmo dia e horário.
      r.post('/slots', permission: 'education.academic:manage', (ctx) {
        final b = _slot.parse(ctx.body);
        final tenantId = ctx.tenant;
        bool overlaps(Row x) => _toMin(x['startTime']! as String) < _toMin(b['endTime']! as String) && _toMin(b['startTime']! as String) < _toMin(x['endTime']! as String);
        return db.forTenant(tenantId, (tx) async {
          final a = await tx.one('SELECT employment_id FROM teaching_assignments WHERE id = @id', {'id': b['assignmentId']});
          if (a == null) throw notFound('Alocação não encontrada');
          final mine = await tx.query(
            'SELECT s.start_time, s.end_time, cl.name AS class_name FROM class_schedules s JOIN teaching_assignments ta ON ta.id = s.assignment_id JOIN classes cl ON cl.id = ta.class_id '
            'WHERE s.weekday = @w AND ta.employment_id = @e AND (ta.valid_to IS NULL OR ta.valid_to >= @now)',
            {'w': b['weekday'], 'e': a['employmentId'], 'now': DateTime.now()},
          );
          final clash = mine.where(overlaps).firstOrNull;
          if (clash != null) throw conflict('O professor já tem aula das ${clash['startTime']} às ${clash['endTime']} na turma ${clash['className']}');
          if (b['classroomId'] != null) {
            final room = await tx.one('SELECT name FROM classrooms WHERE id = @r AND deleted_at IS NULL', {'r': b['classroomId']});
            if (room == null) throw notFound('Sala não encontrada');
            final used = await tx.query(
              'SELECT s.start_time, s.end_time, cl.name AS class_name FROM class_schedules s JOIN teaching_assignments ta ON ta.id = s.assignment_id JOIN classes cl ON cl.id = ta.class_id '
              'WHERE s.classroom_id = @r AND s.weekday = @w AND (ta.valid_to IS NULL OR ta.valid_to >= @now)',
              {'r': b['classroomId'], 'w': b['weekday'], 'now': DateTime.now()},
            );
            final busy = used.where(overlaps).firstOrNull;
            if (busy != null) throw conflict('A sala ${room['name']} já está ocupada das ${busy['startTime']} às ${busy['endTime']} (turma ${busy['className']})');
          }
          final s = await tx.insert('class_schedules', {'tenantId': tenantId, ...b});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: 'class_schedule', entityId: s['id'] as String?, after: b, meta: ctx.meta);
          return s;
        });
      });

      r.delete('/slots/:id', permission: 'education.academic:manage', status: 204, (ctx) {
        final id = ctx.uuidParam('id');
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final s = await tx.one('SELECT *, (SELECT count(*)::int FROM class_sessions x WHERE x.schedule_id = class_schedules.id) AS sessions FROM class_schedules WHERE id = @id', {'id': id});
          if (s == null) throw notFound('Horário não encontrado');
          if ((s['sessions']! as int) > 0) throw conflict('Este horário já tem aulas registradas: encerre a alocação em vez de apagar');
          await tx.execute('DELETE FROM class_schedules WHERE id = @id', {'id': id});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'class_schedule', entityId: id, before: s, meta: ctx.meta);
          return null;
        });
      });

      r.post('/classrooms', permission: 'education.academic:manage', (ctx) {
        final b = _classroom.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await _requireUnit(tx, b['unitId']);
          if (await tx.one('SELECT 1 FROM classrooms WHERE unit_id = @u AND name = @n AND deleted_at IS NULL', {'u': b['unitId'], 'n': b['name']}) != null) {
            throw conflict('Já existe uma sala com esse nome nesta unidade');
          }
          final c = await tx.insert('classrooms', {'tenantId': tenantId, ...b});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: 'classroom', entityId: c['id'] as String?, after: b, meta: ctx.meta);
          return c;
        });
      });

      // Grade semanal do professor logado (pelas alocações vigentes).
      r.get('/mine', permission: 'education.academic:read', (ctx) async {
        final user = ctx.user;
        if (user.personId == null) return {'slots': <Object?>[]};
        return db.forTenant(
          ctx.tenant,
          (tx) async => {
            'slots': [
              for (final s in await tx.query(
                'SELECT s.id, s.weekday, s.start_time, s.end_time, sb.name AS subject, cl.name AS class_name, r.name AS classroom FROM class_schedules s '
                'JOIN teaching_assignments ta ON ta.id = s.assignment_id JOIN subjects sb ON sb.id = ta.subject_id JOIN classes cl ON cl.id = ta.class_id '
                'JOIN employment_relationships e ON e.id = ta.employment_id LEFT JOIN classrooms r ON r.id = s.classroom_id '
                'WHERE e.person_id = @p AND (ta.valid_to IS NULL OR ta.valid_to >= @now) ORDER BY s.weekday ASC, s.start_time ASC',
                {'p': user.personId, 'now': DateTime.now()},
              ))
                {'id': s['id'], 'weekday': s['weekday'], 'startTime': s['startTime'], 'endTime': s['endTime'], 'subject': s['subject'], 'className': s['className'], 'classroom': s['classroom']},
            ],
          },
        );
      });

      // Marca como dadas todas as aulas ainda sem registro no dia.
      r.post('/sessions/hold-all', permission: 'education.sessions:manage', status: 200, (ctx) async {
        final b = Obj({'companyId': uuid, 'date': date}).parse(ctx.body);
        final tenantId = ctx.tenant;
        final d = b['date']! as String;
        final lessons = (await lessonsOfDay(tenantId, b['companyId']! as String, d)).where((l) => l['status'] == 'SCHEDULED').toList();
        if (DateTime.parse('${d}T00:00:00Z').isAfter(DateTime.now())) throw badRequest('Não dá para registrar aulas de um dia que ainda não chegou');
        await db.forTenant(tenantId, (tx) async {
          for (final l in lessons) {
            await tx.insert('class_sessions', {'tenantId': tenantId, 'scheduleId': l['scheduleId'], 'sessionDate': d, 'status': 'HELD'});
          }
          await app.audit.record(
            tx,
            tenantId: tenantId,
            actorUserId: ctx.user.id,
            action: 'UPDATE',
            entity: 'class_session_batch',
            after: {'companyId': b['companyId'], 'date': d, 'held': lessons.length},
            meta: ctx.meta,
          );
        });
        return {'held': lessons.length};
      });

      r.get('/day', permission: 'education.academic:read', (ctx) {
        final q = Obj({'companyId': uuid, 'date': date}).parse(ctx.query);
        return lessonsOfDay(ctx.tenant, q['companyId']! as String, q['date']! as String);
      });

      r.post('/sessions', permission: 'education.sessions:manage', status: 200, (ctx) {
        final b = _session.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final s = await tx.one('SELECT s.weekday, ta.employment_id FROM class_schedules s JOIN teaching_assignments ta ON ta.id = s.assignment_id WHERE s.id = @id', {'id': b['scheduleId']});
          if (s == null) throw notFound('Horário não encontrado');
          if (core.weekday(b['date']! as String) != s['weekday']) throw badRequest('Este horário não tem aula nesse dia da semana');
          if (b['substituteEmploymentId'] != null && b['substituteEmploymentId'] == s['employmentId']) throw badRequest('O substituto deve ser outro professor');
          final sub = b['status'] == 'SUBSTITUTED' ? b['substituteEmploymentId'] : null;
          final x = await tx.one(
            'INSERT INTO class_sessions (id, tenant_id, schedule_id, session_date, status, substitute_employment_id, notes) VALUES (gen_random_uuid(), @t, @s, @d, @st, @sub, @n) '
            'ON CONFLICT (schedule_id, session_date) DO UPDATE SET status = EXCLUDED.status, substitute_employment_id = EXCLUDED.substitute_employment_id, notes = EXCLUDED.notes '
            'RETURNING *, status::text AS status',
            {'t': tenantId, 's': b['scheduleId'], 'd': b['date'], 'st': b['status'], 'sub': sub, 'n': b['notes']},
          );
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'class_session', entityId: x!['id'] as String?, after: b, meta: ctx.meta);
          return x;
        });
      });

      // Aulas dadas, não dadas e substituições por professor no período (para conferência e folha).
      r.get('/summary', permission: 'education.academic:read', (ctx) {
        final q = Obj({'companyId': uuid, 'from': date, 'to': date}).parse(ctx.query);
        return db.forTenant(ctx.tenant, (tx) async {
          final sessions = await tx.query(
            'SELECT x.status::text AS status, x.substitute_employment_id, s.start_time, s.end_time, ta.employment_id, e.registration, p.full_name, p.social_name FROM class_sessions x '
            'JOIN class_schedules s ON s.id = x.schedule_id JOIN teaching_assignments ta ON ta.id = s.assignment_id JOIN subjects sb ON sb.id = ta.subject_id '
            'JOIN employment_relationships e ON e.id = ta.employment_id JOIN people p ON p.id = e.person_id WHERE x.session_date BETWEEN @f AND @t AND sb.company_id = @c',
            {'f': q['from'], 't': q['to'], 'c': q['companyId']},
          );
          final subIds = {
            for (final x in sessions)
              if (x['substituteEmploymentId'] != null) x['substituteEmploymentId']! as String,
          }.toList();
          final subs = subIds.isEmpty
              ? <Row>[]
              : await tx.query('SELECT e.id, e.registration, p.full_name, p.social_name FROM employment_relationships e JOIN people p ON p.id = e.person_id WHERE e.id::text = ANY(@ids)', {
                  'ids': subIds,
                });
          final by = <String, Map<String, Object?>>{};
          Map<String, Object?> row(String id, Object? reg, Object? name) =>
              by.putIfAbsent(id, () => {'teacher': name, 'registration': reg, 'held': 0, 'notHeld': 0, 'substitutedOut': 0, 'substitutedIn': 0, 'minutes': 0});
          void inc(Map<String, Object?> r, String k, [int v = 1]) => r[k] = (r[k]! as int) + v;
          for (final x in sessions) {
            final len = _toMin(x['endTime']! as String) - _toMin(x['startTime']! as String);
            final rr = row(x['employmentId']! as String, x['registration'], x['socialName'] ?? x['fullName']);
            if (x['status'] == 'HELD') {
              inc(rr, 'held');
              inc(rr, 'minutes', len);
            }
            if (x['status'] == 'NOT_HELD') inc(rr, 'notHeld');
            if (x['status'] == 'SUBSTITUTED' && x['substituteEmploymentId'] != null) {
              inc(rr, 'substitutedOut');
              final sub = subs.where((e) => e['id'] == x['substituteEmploymentId']).firstOrNull;
              if (sub != null) {
                final q2 = row(sub['id']! as String, sub['registration'], sub['socialName'] ?? sub['fullName']);
                inc(q2, 'substitutedIn');
                inc(q2, 'minutes', len);
              }
            }
          }
          return by.values.toList()..sort((a, b) => a['teacher'].toString().compareTo(b['teacher'].toString()));
        });
      });
    });

    // ------------------------------------------------------------------ operacional
    r.group('/v1/operational/occurrences', tag: 'operacional', () {
      r.get('', permission: 'operational.board:read', (ctx) {
        final q = _occList.parse(ctx.query);
        return db.forTenant(ctx.tenant, (tx) async {
          final list = await tx.query(
            'SELECT o.*, o.type::text AS type, o.status::text AS status, u.name AS unit FROM operational_occurrences o LEFT JOIN company_units u ON u.id = o.unit_id '
            "WHERE ${q['status'] == 'ACTIVE' ? "o.status IN ('OPEN', 'IN_PROGRESS')" : 'o.status = @s'}${q['unitId'] != null ? ' AND o.unit_id = @u' : ''}${q['type'] != null ? ' AND o.type = @t' : ''} "
            'ORDER BY o.occurred_at DESC LIMIT 300',
            {'s': q['status'], 'u': q['unitId'], 't': q['type']},
          );
          final ids = [for (final o in list) o['id']! as String];
          final events = ids.isEmpty
              ? <Row>[]
              : await tx.query(
                  'SELECT ev.*, us.display_name FROM operational_events ev LEFT JOIN users us ON us.id = ev.actor_user_id WHERE ev.occurrence_id::text = ANY(@ids) ORDER BY ev.created_at ASC',
                  {'ids': ids},
                );
          final empIds = {
            for (final o in list) ...[o['employmentId'], o['responsibleId']],
          }.whereType<String>().toList();
          final emps = empIds.isEmpty
              ? <Row>[]
              : await tx.query('SELECT e.id, e.registration, p.full_name FROM employment_relationships e JOIN people p ON p.id = e.person_id WHERE e.id::text = ANY(@ids)', {'ids': empIds});
          String? en(Object? id) {
            final e = emps.where((x) => x['id'] == id).firstOrNull;
            return e == null ? null : '${e['registration']} — ${e['fullName']}';
          }

          return [
            for (final o in list)
              {
                'id': o['id'],
                'unitId': o['unitId'],
                'unit': o['unit'] ?? '',
                'type': o['type'],
                'title': o['title'],
                'description': o['description'],
                'occurredAt': o['occurredAt'],
                'status': o['status'],
                'employmentId': o['employmentId'],
                'employment': en(o['employmentId']),
                'responsibleId': o['responsibleId'],
                'responsible': en(o['responsibleId']),
                'events': [
                  for (final e in events.where((e) => e['occurrenceId'] == o['id'])) {'action': e['action'], 'notes': e['notes'], 'at': e['createdAt'], 'by': e['displayName'] ?? ''},
                ],
              },
          ];
        });
      });

      // Painel: abertas por tipo e unidade, paradas há mais de 24 h e tempo médio de solução (30 dias).
      r.get(
        '/stats',
        permission: 'operational.board:read',
        (ctx) => db.forTenant(ctx.tenant, (tx) async {
          final active = await tx.query(
            'SELECT o.type::text AS type, o.unit_id, o.status::text AS status, o.occurred_at, u.name AS unit FROM operational_occurrences o LEFT JOIN company_units u ON u.id = o.unit_id '
            "WHERE o.status IN ('OPEN', 'IN_PROGRESS')",
          );
          final solved = await tx.query("SELECT occurred_at, updated_at FROM operational_occurrences WHERE status = 'RESOLVED' AND updated_at >= @s", {
            's': DateTime.now().subtract(const Duration(days: 30)),
          });
          List<MapEntry<String, int>> group(String Function(Row) key) {
            final m = <String, int>{};
            for (final a in active) {
              m[key(a)] = (m[key(a)] ?? 0) + 1;
            }
            return m.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
          }

          final hours = [for (final x in solved) (x['updatedAt']! as DateTime).difference(x['occurredAt']! as DateTime).inMilliseconds / 3600000].where((h) => h >= 0).toList();
          final now = DateTime.now();
          final unitNames = {for (final a in active) a['unitId']: a['unit']};
          return {
            'open': active.where((a) => a['status'] == 'OPEN').length,
            'inProgress': active.where((a) => a['status'] == 'IN_PROGRESS').length,
            'stale': active.where((a) => now.difference(a['occurredAt']! as DateTime).inMilliseconds > 24 * 3600000).length,
            'resolved30d': solved.length,
            'avgResolutionHours': hours.isEmpty ? null : core.jsRound(hours.reduce((a, b) => a + b) / hours.length * 10) / 10,
            'byType': [
              for (final e in group((a) => a['type']! as String)) {'type': e.key, 'n': e.value},
            ],
            'byUnit': [
              for (final e in group((a) => a['unitId']! as String)) {'unit': unitNames[e.key] ?? '', 'n': e.value},
            ],
          };
        }),
      );

      r.post('', permission: 'operational.occurrences:manage', (ctx) {
        final input = _occurrence.parse(ctx.body);
        final user = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await _requireUnit(tx, input['unitId']);
          for (final e in [input['employmentId'], input['responsibleId']]) {
            if (e != null && await tx.one('SELECT 1 FROM employment_relationships WHERE id = @e AND deleted_at IS NULL', {'e': e}) == null) throw notFound('Funcionário não encontrado');
          }
          final o = await tx.insert('operational_occurrences', {'tenantId': tenantId, ...input, 'createdById': user.id});
          await tx.insert('operational_events', {'tenantId': tenantId, 'occurrenceId': o['id'], 'action': 'CREATE', 'actorUserId': user.id});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'CREATE', entity: 'operational_occurrence', entityId: o['id'] as String?, after: o, meta: ctx.meta);
          return o;
        });
      });

      // Gera faltas, atrasos e marcações incompletas a partir do espelho diário (rodar de novo não duplica).
      r.post('/generate', permission: 'operational.occurrences:manage', (ctx) async {
        final q = Obj({'companyId': uuid, 'date': date}).parse(ctx.body);
        final user = ctx.user, tenantId = ctx.tenant;
        final d = await timesheet.daily(tenantId, {'companyId': q['companyId'], 'date': q['date']});
        const map = {'ABSENT': ('ABSENCE', 'Falta'), 'LATE': ('LATE', 'Atraso'), 'INCOMPLETE': ('MISSING_RECORD', 'Marcação incompleta')};
        final at = DateTime.parse('${q['date']}T12:00:00-03:00');
        final rows = (d['rows']! as List).cast<Map<String, Object?>>();
        return db.forTenant(tenantId, (tx) async {
          var created = 0, skipped = 0, noUnit = 0;
          final units = {
            for (final e in await tx.query('SELECT id, unit_id FROM employment_relationships WHERE id::text = ANY(@ids)', {
              'ids': [for (final x in rows) x['employmentId']! as String],
            }))
              e['id']: e['unitId'],
          };
          for (final x in rows) {
            final m = map[x['situation']];
            if (m == null) continue;
            final unitId = units[x['employmentId']];
            if (unitId == null) {
              noUnit++;
              continue;
            }
            if (await tx.one('SELECT 1 FROM operational_occurrences WHERE employment_id = @e AND type = @t AND occurred_at = @at', {'e': x['employmentId'], 't': m.$1, 'at': at}) != null) {
              skipped++;
              continue;
            }
            final late = (((x['day'] as Map?)?['result'] as Map?)?['lateMinutes'] as num?)?.toInt();
            final o = await tx.insert('operational_occurrences', {
              'tenantId': tenantId,
              'unitId': unitId,
              'type': m.$1,
              'title': '${m.$2}: ${x['name']}',
              'description': m.$1 == 'LATE' && (late ?? 0) > 0 ? '$late min de atraso' : null,
              'occurredAt': at,
              'employmentId': x['employmentId'],
              'createdById': user.id,
            });
            await tx.insert('operational_events', {'tenantId': tenantId, 'occurrenceId': o['id'], 'action': 'CREATE', 'notes': 'Gerada do espelho diário', 'actorUserId': user.id});
            created++;
          }
          await app.audit.record(
            tx,
            tenantId: tenantId,
            actorUserId: user.id,
            action: 'CREATE',
            entity: 'operational_occurrence_batch',
            after: {...q, 'created': created, 'skipped': skipped, 'noUnit': noUnit},
            meta: ctx.meta,
          );
          return {'created': created, 'skipped': skipped, 'noUnit': noUnit};
        });
      });

      r.post('/:id/actions', permission: 'operational.occurrences:manage', (ctx) {
        final id = ctx.uuidParam('id');
        final input = _action.parse(ctx.body);
        final user = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final o = await tx.one('SELECT *, status::text AS status FROM operational_occurrences WHERE id = @id', {'id': id});
          if (o == null) throw notFound('Ocorrência não encontrada');
          final status = _next[input['action']];
          final data = <String, Object?>{'status': ?status, if (input.containsKey('responsibleId')) 'responsibleId': input['responsibleId']};
          final u = data.isEmpty ? o : (await tx.update('operational_occurrences', id, data))!;
          await tx.insert('operational_events', {'tenantId': tenantId, 'occurrenceId': id, 'action': input['action'], 'notes': input['notes'], 'actorUserId': user.id});
          await app.audit.record(
            tx,
            tenantId: tenantId,
            actorUserId: user.id,
            action: 'UPDATE',
            entity: 'operational_occurrence',
            entityId: id,
            before: {'status': o['status']},
            after: {'status': u['status'], 'action': input['action']},
            meta: ctx.meta,
          );
          return u;
        });
      });
    });
  }
}

/// Data de hoje (UTC) como meia-noite, como o `new Date(hoje + 'T00:00:00Z')` da API em Node.
DateTime todayUtcDate() => DateTime.parse('${isoMs(DateTime.now()).substring(0, 10)}T00:00:00Z');

bool canReadHealth(AuthUser u) => can(u, 'health.shifts:read');
