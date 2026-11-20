// Ferramentas: painel ao vivo, e-mails agendados (resumo), avisos aos funcionários, aparelhos liberados para o app,
// textos personalizados e ciência eletrônica do espelho.
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:sp_core/sp_core.dart' as core;

import '../app.dart';
import '../auth/auth_user.dart';
import '../crypto/openssl.dart' show randomBytes;
import '../crypto/tokens.dart' show b64url, sha256Hex;
import '../db.dart';
import '../http.dart';
import '../mail.dart';
import '../validate.dart';
import 'reports.dart' show mirrorHashOf;
import 'schedules.dart' show isoDay;
import 'timesheet.dart';
import 'timesheet_core.dart';

int? _toMin(Object? hm) => hm is String && hm.length >= 5 ? int.parse(hm.substring(0, 2)) * 60 + int.parse(hm.substring(3, 5)) : null;
String _brDate(String d) => d.split('-').reversed.join('/');
String _brShort(DateTime at) {
  final l = localBr(at);
  return '${_brDate(l.date)}, ${l.time}';
}

String _brFull(DateTime at) {
  final l = localBr(at);
  return '${_brDate(l.date)}, ${l.time}:${core.localParts(at, tz).second.toString().padLeft(2, '0')}';
}

const liveLabel = {
  'WORKING': 'Trabalhando',
  'ON_BREAK': 'Em intervalo',
  'LEFT': 'Saiu',
  'NOT_YET': 'Ainda não começou',
  'LATE_NOW': 'Atrasado (sem marcação)',
  'ABSENT': 'Não veio',
  'OFF': 'Folga',
  'LEAVE': 'Afastado/abonado',
  'NO_SCHEDULE': 'Marcou sem jornada',
};

/// Situação de cada funcionário AGORA, a partir da apuração do dia e do horário de Brasília.
String liveState(Map<String, Object?> day, int nowMin, int tolerance) {
  final n = ((day['punches'] as List?) ?? const []).where((p) => (p as Map)['status'] == 'ORIGINAL' || p['status'] == 'INCLUDED').length;
  final exp = (day['expected'] as Map?) ?? const {};
  if (day['leave'] != null || (day['allowance'] as Map?)?['fullDay'] == true) return 'LEAVE';
  final start = _toMin(exp['start']);
  var end = _toMin(exp['end']);
  if (start != null && end != null && end <= start) end += 1440;
  if (n == 0) {
    if (exp['isWorkday'] != true || start == null) return 'OFF';
    if (nowMin < start) return 'NOT_YET';
    if (end != null && nowMin >= end) return 'ABSENT';
    return nowMin >= start + tolerance ? 'LATE_NOW' : 'NOT_YET';
  }
  if (exp['isWorkday'] != true && exp['scheduleName'] == null) return n.isOdd ? 'NO_SCHEDULE' : 'LEFT';
  if (n.isOdd) return 'WORKING';
  return n == 2 && ((exp['breakMinutes'] as num?) ?? 0) > 0 && end != null && nowMin < end - 30 ? 'ON_BREAK' : 'LEFT';
}

const notificationKinds = ['ABSENCES', 'LATE', 'PENDING_ADJUSTMENTS', 'PENDING_REQUESTS', 'DEVICES_OFFLINE', 'UNCOVERED_SHIFTS', 'OPEN_OCCURRENCES'];
final _notification = Obj({
  'companyId': uuid,
  'name': const Str(trim: true, min: 2, max: 80),
  'kinds': const Arr(Enum(notificationKinds), min: 1, max: 7).map((k) => (k as List).cast<String>().toSet().toList()),
  'time': Str(pattern: RegExp(r'^([01]\d|2[0-3]):[0-5]\d$'), patternMessage: 'Horário no formato HH:mm'),
  'weekdays': const Arr(Num(int: true, min: 0, max: 6), max: 7).map((w) => (w as List).cast<int>().toSet().toList()..sort()).def(<int>[]),
  'recipients': const Arr(email, min: 1, max: 20),
  'active': const Bool().def(true),
});
final _announcement = Obj({
  'companyId': uuid.nullish,
  'groupingId': uuid.nullish,
  'title': const Str(trim: true, min: 2, max: 120),
  'body': const Str(trim: true, min: 1, max: 5000),
  'level': const Enum(['INFO', 'IMPORTANT']).def('INFO'),
  'startsAt': const DateTimeS(),
  'endsAt': const DateTimeS().nullish,
  'requireAck': const Bool().def(false),
}).check((a) => a['endsAt'] == null || (a['endsAt']! as DateTime).isAfter(a['startsAt']! as DateTime), 'O fim deve ser depois do início', path: ['endsAt']);
const customTexts = {
  'DASHBOARD_MESSAGE': 'Mensagem no painel inicial',
  'PUNCH_RECEIPT_FOOTER': 'Rodapé do comprovante de marcação',
  'MIRROR_FOOTER': 'Rodapé do espelho de ponto impresso',
  'MIRROR_ACK_TERM': 'Termo exibido na ciência do espelho',
};
final _ack = Obj({
  'from': date,
  'to': date,
  'employmentId': uuid.optional,
  'decision': const Enum(['AGREE', 'DISAGREE']).def('AGREE'),
  'comment': const Str(trim: true, max: 1000).optional,
}).check((a) => a['decision'] == 'AGREE' || ((a['comment'] as String?)?.length ?? 0) >= 5, 'Explique a ressalva (mínimo 5 caracteres)', path: ['comment']);
const _deviceCols = 'id, user_id, name, approved_at, last_used_at, revoked_at, created_at, code_expires';

class ToolsModule {
  ToolsModule(this.app, this.timesheet);
  final App app;
  final TimesheetModule timesheet;
  Db get db => app.db;
  final _rng = Random.secure();

  // ------------------------------------------------------------------ painel ao vivo
  Future<Map<String, Object?>> live(String tenantId, Map<String, Object?> q, [DateTime? now]) async {
    final l = localBr(now ?? DateTime.now());
    final nowMin = _toMin(l.time)!;
    final d = await timesheet.daily(tenantId, {'companyId': q['companyId'], 'date': l.date, 'departmentId': q['departmentId'], 'groupingId': q['groupingId']});
    final tolerance = (q['toleranceMinutes'] as int?) ?? 10;
    final rows = [
      for (final r in (d['rows']! as List).cast<Map<String, Object?>>())
        () {
          final day = (r['day']! as Map).cast<String, Object?>();
          final state = liveState(day, nowMin, tolerance);
          final punches = [
            for (final p in (day['punches']! as List).cast<Map<String, Object?>>())
              if (p['status'] == 'ORIGINAL' || p['status'] == 'INCLUDED') p,
          ];
          final exp = (day['expected'] as Map?) ?? const {};
          return <String, Object?>{
            'employmentId': r['employmentId'],
            'registration': r['registration'],
            'name': r['name'],
            'state': state,
            'label': liveLabel[state],
            'lastPunch': punches.isEmpty ? null : punches.last['time'],
            'punches': [for (final p in punches) p['time']],
            'expectedStart': exp['start'],
            'expectedEnd': exp['end'],
            'lateMinutes': state == 'LATE_NOW' && exp['start'] != null ? nowMin - _toMin(exp['start'])! : 0,
          };
        }(),
    ];
    return {
      'date': l.date,
      'time': l.time,
      'rows': rows,
      'totals': {for (final k in liveLabel.keys) k: rows.where((x) => x['state'] == k).length},
    };
  }

  // ------------------------------------------------------------------ e-mails agendados
  Future<Map<String, Object?>> digest(String tenantId, String companyId, List<String> kinds, [DateTime? now]) async {
    final at = now ?? DateTime.now();
    final today = localBr(at).date;
    final sections = <Map<String, Object?>>[];
    final company = await db.forTenant(tenantId, (tx) => tx.one('SELECT legal_name, trade_name FROM companies WHERE id = @c', {'c': companyId}));
    if (company == null) throw notFound('Empresa não encontrada');
    if (kinds.contains('ABSENCES')) {
      final y = core.addDays(today, -1);
      final d = await timesheet.daily(tenantId, {'companyId': companyId, 'date': y});
      sections.add({
        'kind': 'ABSENCES',
        'title': 'Faltas de ontem (${_brDate(y)})',
        'lines': [
          for (final r in (d['rows']! as List).cast<Map<String, Object?>>())
            if (r['situation'] == 'ABSENT') '${r['registration']} — ${r['name']}',
        ],
      });
    }
    if (kinds.contains('LATE')) {
      final l = await live(tenantId, {'companyId': companyId, 'toleranceMinutes': 10}, at);
      sections.add({
        'kind': 'LATE',
        'title': 'Atrasados agora (${l['time']}), sem marcação de entrada',
        'lines': [
          for (final r in (l['rows']! as List).cast<Map<String, Object?>>())
            if (r['state'] == 'LATE_NOW') '${r['registration']} — ${r['name']} (previsto ${r['expectedStart']}, ${r['lateMinutes']} min)',
        ],
      });
    }
    await db.forTenant(tenantId, (tx) async {
      if (kinds.contains('PENDING_ADJUSTMENTS')) {
        final rows = await tx.query(
          'SELECT e.registration, p.full_name, count(*)::int AS n FROM time_record_adjustments a JOIN employment_relationships e ON e.id = a.employment_id JOIN people p ON p.id = e.person_id '
          "WHERE a.status = 'PENDING' AND e.company_id = @c AND e.deleted_at IS NULL GROUP BY e.registration, p.full_name",
          {'c': companyId},
        );
        final total = rows.fold<int>(0, (s, x) => s + (x['n']! as int));
        sections.add({
          'kind': 'PENDING_ADJUSTMENTS',
          'title': 'Ajustes de marcação aguardando aprovação ($total)',
          'lines': [for (final x in rows) '${x['registration']} — ${x['fullName']}: ${x['n']}'],
        });
      }
      if (kinds.contains('PENDING_REQUESTS')) {
        final r = await tx.query(
          'SELECT r.type::text AS type, r.created_at, e.registration, p.full_name FROM time_requests r JOIN employment_relationships e ON e.id = r.employment_id JOIN people p ON p.id = e.person_id '
          "WHERE r.status = 'PENDING' AND e.company_id = @c ORDER BY r.created_at ASC LIMIT 200",
          {'c': companyId},
        );
        sections.add({
          'kind': 'PENDING_REQUESTS',
          'title': 'Solicitações pendentes (${r.length})',
          'lines': [for (final x in r) '${x['registration']} — ${x['fullName']}: ${x['type']} desde ${_brDate(localBr(x['createdAt']! as DateTime).date)}'],
        });
      }
      if (kinds.contains('UNCOVERED_SHIFTS')) {
        final shifts = await tx.query(
          'SELECT s.starts_at, s.required_professionals, u.name AS unit, (SELECT count(*)::int FROM medical_shift_assignments a WHERE a.shift_id = s.id '
          "AND a.status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED')) AS covered FROM medical_shifts s JOIN company_units u ON u.id = s.unit_id "
          'WHERE s.deleted_at IS NULL AND u.company_id = @c AND s.starts_at >= @f AND s.starts_at < @t ORDER BY s.starts_at ASC',
          {'c': companyId, 'f': at, 't': at.add(const Duration(days: 7))},
        );
        final gaps = [
          for (final x in shifts)
            if ((x['covered']! as int) < (x['requiredProfessionals']! as int)) x,
        ];
        sections.add({
          'kind': 'UNCOVERED_SHIFTS',
          'title': 'Plantões sem cobertura nos próximos 7 dias (${gaps.length})',
          'lines': [for (final x in gaps) '${x['unit']}: ${_brShort(x['startsAt']! as DateTime)} — faltam ${(x['requiredProfessionals']! as int) - (x['covered']! as int)}'],
        });
      }
      if (kinds.contains('OPEN_OCCURRENCES')) {
        final occ = await tx.query(
          "SELECT o.title, o.occurred_at FROM operational_occurrences o JOIN company_units u ON u.id = o.unit_id WHERE o.status IN ('OPEN', 'IN_PROGRESS') AND o.occurred_at < @t "
          'AND u.company_id = @c ORDER BY o.occurred_at ASC LIMIT 100',
          {'c': companyId, 't': at.subtract(const Duration(hours: 24))},
        );
        sections.add({
          'kind': 'OPEN_OCCURRENCES',
          'title': 'Ocorrências abertas há mais de 24 horas (${occ.length})',
          'lines': [for (final o in occ) '${o['title']} — desde ${_brShort(o['occurredAt']! as DateTime)}'],
        });
      }
      if (kinds.contains('DEVICES_OFFLINE')) {
        final d = await tx.query("SELECT name, last_seen_at FROM devices WHERE company_id = @c AND deleted_at IS NULL AND status = 'OFFLINE'", {'c': companyId});
        sections.add({
          'kind': 'DEVICES_OFFLINE',
          'title': 'Equipamentos sem comunicação (${d.length})',
          'lines': [for (final x in d) '${x['name']}${x['lastSeenAt'] != null ? ' — último contato ${_brFull(x['lastSeenAt']! as DateTime)}' : ''}'],
        });
      }
    });
    return {'company': company['tradeName'] ?? company['legalName'], 'date': today, 'sections': sections};
  }

  OutgoingMail _render(String name, Map<String, Object?> d, String to) {
    final sections = (d['sections']! as List).cast<Map<String, Object?>>();
    final dt = _brDate(d['date']! as String);
    final text = [
      '$name — ${d['company']} — $dt',
      '',
      for (final s in sections) ...[
        s['title'],
        ...((s['lines']! as List).isEmpty ? ['  Nada a informar.'] : [for (final l in s['lines']! as List) '  • $l']),
        '',
      ],
    ].join('\n');
    final html =
        '<h2>${escapeHtml(name)}</h2><p>${escapeHtml(d['company']!.toString())} — ${escapeHtml(dt)}</p>${sections.map((s) {
          final lines = (s['lines']! as List).cast<String>();
          return '<h3>${escapeHtml(s['title']!.toString())}</h3>${lines.isEmpty ? '<p>Nada a informar.</p>' : '<ul>${lines.map((l) => '<li>${escapeHtml(l)}</li>').join()}</ul>'}';
        }).join()}';
    return OutgoingMail(to: to, subject: 'SuperPonto: $name — ${d['company']}', text: text, html: html);
  }

  Future<Row> _schedule(Tx tx, String id) async {
    final n = await tx.one('SELECT * FROM notification_schedules WHERE id = @id', {'id': id});
    if (n == null) throw notFound('Agendamento não encontrado');
    return n;
  }

  Future<Map<String, Object?>> send(String tenantId, String id, [DateTime? now]) async {
    final at = now ?? DateTime.now();
    final n = await db.forTenant(tenantId, (tx) => _schedule(tx, id));
    final d = await digest(tenantId, n['companyId']! as String, (n['kinds']! as List).cast<String>(), at);
    final recipients = (n['recipients']! as List).cast<String>();
    var sent = 0;
    for (final to in recipients) {
      try {
        await app.mail.send(_render(n['name']! as String, d, to));
        sent++;
      } catch (e) {
        stderr.writeln('Falha ao enviar para $to: $e');
      }
    }
    await db.forTenant(tenantId, (tx) => tx.execute('UPDATE notification_schedules SET last_run_at = @n WHERE id = @id', {'n': at, 'id': id}));
    return {'sent': sent, 'recipients': recipients.length, 'digest': d};
  }

  /// Roda a cada minuto: envia os agendamentos do horário atual (uma vez por dia cada, dentro de 15 minutos).
  Future<int> tick([DateTime? now]) async {
    final at = now ?? DateTime.now();
    final l = localBr(at);
    final weekday = core.weekday(l.date);
    final due = await db.asPlatform((tx) => tx.query('SELECT id, tenant_id, weekdays, last_run_at, time FROM notification_schedules WHERE active AND time <= @t', {'t': l.time}));
    var n = 0;
    for (final s in due) {
      final days = (s['weekdays'] as List?)?.cast<int>() ?? const [];
      if (days.isNotEmpty && !days.contains(weekday)) continue;
      if (s['lastRunAt'] != null && localBr(s['lastRunAt']! as DateTime).date == l.date) continue;
      if (_toMin(l.time)! - _toMin(s['time'])! > 15) continue;
      try {
        await send(s['tenantId']! as String, s['id']! as String, at);
      } catch (e) {
        stderr.writeln('${s['id']}: $e');
      }
      n++;
    }
    return n;
  }

  // ------------------------------------------------------------------ avisos
  Future<List<Map<String, Object?>>> activeAnnouncements(String tenantId, AuthUser user, [DateTime? now]) => db.forTenant(tenantId, (tx) async {
    final at = now ?? DateTime.now();
    final emps = user.personId == null
        ? <Row>[]
        : await tx.query(
            'SELECT e.company_id, (SELECT coalesce(array_agg(g.grouping_id::text), ARRAY[]::text[]) FROM grouping_employments g WHERE g.employment_id = e.id) AS groupings '
            'FROM employment_relationships e WHERE e.person_id = @p AND e.deleted_at IS NULL',
            {'p': user.personId},
          );
    final companies = [for (final e in emps) e['companyId']! as String];
    final groupings = [for (final e in emps) ...(e['groupings']! as List).cast<String>()];
    final list = await tx.query(
      'SELECT a.*, a.level::text AS level, (SELECT r.read_at FROM announcement_reads r WHERE r.announcement_id = a.id AND r.user_id = @u) AS read_at FROM announcements a '
      'WHERE a.deleted_at IS NULL AND a.starts_at <= @n AND (a.ends_at IS NULL OR a.ends_at > @n) '
      'AND (a.company_id IS NULL OR a.company_id::text = ANY(@c)) AND (a.grouping_id IS NULL OR a.grouping_id::text = ANY(@g)) '
      'ORDER BY a.level DESC, a.starts_at DESC LIMIT 20',
      {'u': user.id, 'n': at, 'c': companies, 'g': groupings},
    );
    return [
      for (final a in list)
        {'id': a['id'], 'title': a['title'], 'body': a['body'], 'level': a['level'], 'startsAt': a['startsAt'], 'endsAt': a['endsAt'], 'requireAck': a['requireAck'], 'readAt': a['readAt']},
    ];
  });

  // ------------------------------------------------------------------ ciência do espelho
  Future<Map<String, Object?>> _myMirror(String tenantId, AuthUser user, String from, String to, String? employmentId) async {
    final mine = await db.forTenant(tenantId, (tx) => timesheet.myEmployments(tx, user));
    final e = employmentId != null ? mine.where((m) => m['id'] == employmentId).firstOrNull : mine.firstOrNull;
    if (e == null) throw notFound('Vínculo não encontrado');
    return timesheet.mirror(tenantId, e['id']! as String, from, to);
  }

  ({String hash, Map<String, Object?> summary}) _hash(Map<String, Object?> m) =>
      mirrorHashOf((m['employment']! as Map)['id']! as String, m['from']! as String, m['to']! as String, (m['days']! as List).cast<Map<String, Object?>>());

  void routes() {
    final r = app.router;
    r.get('/v1/live', permission: 'time.calculations:read', (ctx) {
      final q = Obj({'companyId': uuid, 'departmentId': uuid.optional, 'groupingId': uuid.optional, 'toleranceMinutes': const Num(int: true, coerce: true, min: 0, max: 120).def(10)}).parse(ctx.query);
      return live(ctx.tenant, q);
    });

    r.group('/v1/notification-schedules', tag: 'ferramentas', () {
      r.get('', permission: 'tools.notifications:manage', (ctx) {
        final q = Obj({'companyId': uuid.optional}).parse(ctx.query);
        return db.forTenant(
          ctx.tenant,
          (tx) => tx.query('SELECT * FROM notification_schedules${q['companyId'] != null ? ' WHERE company_id = @c' : ''} ORDER BY time ASC, name ASC', {'c': q['companyId']}),
        );
      });
      r.post('', permission: 'tools.notifications:manage', (ctx) {
        final input = _notification.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          if (await tx.one('SELECT 1 FROM companies WHERE id = @c AND deleted_at IS NULL', {'c': input['companyId']}) == null) throw notFound('Empresa não encontrada');
          final n = await tx.insert('notification_schedules', {
            'tenantId': tenantId,
            ...input,
            'kinds': (input['kinds']! as List).cast<String>(),
            'weekdays': (input['weekdays']! as List).cast<int>(),
            'recipients': (input['recipients']! as List).cast<String>(),
          });
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: 'notification_schedule', entityId: n['id'] as String?, after: n, meta: ctx.meta);
          return n;
        });
      });
      r.patch('/:id', permission: 'tools.notifications:manage', (ctx) {
        final id = ctx.uuidParam('id');
        final input = _notification.partial.parse(ctx.body)..remove('companyId');
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final before = await _schedule(tx, id);
          final n = await tx.update('notification_schedules', id, {
            ...input,
            if (input['kinds'] != null) 'kinds': (input['kinds']! as List).cast<String>(),
            if (input['weekdays'] != null) 'weekdays': (input['weekdays']! as List).cast<int>(),
            if (input['recipients'] != null) 'recipients': (input['recipients']! as List).cast<String>(),
          });
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'notification_schedule', entityId: id, before: before, after: n, meta: ctx.meta);
          return n;
        });
      });
      r.delete('/:id', permission: 'tools.notifications:manage', status: 204, (ctx) {
        final id = ctx.uuidParam('id');
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final before = await _schedule(tx, id);
          await tx.execute('DELETE FROM notification_schedules WHERE id = @id', {'id': id});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'notification_schedule', entityId: id, before: before, meta: ctx.meta);
          return null;
        });
      });
      r.get('/:id/preview', permission: 'tools.notifications:manage', (ctx) async {
        final id = ctx.uuidParam('id');
        final tenantId = ctx.tenant;
        final n = await db.forTenant(tenantId, (tx) => _schedule(tx, id));
        return digest(tenantId, n['companyId']! as String, (n['kinds']! as List).cast<String>());
      });
      r.post('/:id/send', permission: 'tools.notifications:manage', status: 200, throttle: 10, (ctx) => send(ctx.tenant, ctx.uuidParam('id')));
    });

    r.group('/v1/announcements', tag: 'ferramentas', () {
      r.get('/active', (ctx) => activeAnnouncements(ctx.tenant, ctx.user));
      r.post('/:id/read', status: 200, (ctx) async {
        final id = ctx.uuidParam('id');
        final tenantId = ctx.tenant, user = ctx.user;
        if (!(await activeAnnouncements(tenantId, user)).any((a) => a['id'] == id)) throw notFound('Aviso não encontrado');
        return db.forTenant(
          tenantId,
          (tx) async => await tx.one(
            'INSERT INTO announcement_reads (id, tenant_id, announcement_id, user_id) VALUES (gen_random_uuid(), @t, @a, @u) '
            'ON CONFLICT (announcement_id, user_id) DO UPDATE SET user_id = EXCLUDED.user_id RETURNING *',
            {'t': tenantId, 'a': id, 'u': user.id},
          ),
        );
      });
      r.get(
        '',
        permission: 'tools.announcements:manage',
        (ctx) => db.forTenant(
          ctx.tenant,
          (tx) => tx.query(
            'SELECT a.*, a.level::text AS level, (SELECT count(*)::int FROM announcement_reads r WHERE r.announcement_id = a.id) AS reads FROM announcements a '
            'WHERE a.deleted_at IS NULL ORDER BY a.starts_at DESC LIMIT 200',
          ),
        ),
      );
      r.get('/:id/reads', permission: 'tools.announcements:manage', (ctx) {
        final id = ctx.uuidParam('id');
        return db.forTenant(
          ctx.tenant,
          (tx) async => [
            for (final x in await tx.query(
              'SELECT r.read_at, u.id, u.display_name, u.email FROM announcement_reads r LEFT JOIN users u ON u.id = r.user_id WHERE r.announcement_id = @a ORDER BY r.read_at ASC',
              {'a': id},
            ))
              {
                'readAt': x['readAt'],
                'user': x['id'] == null ? null : {'id': x['id'], 'displayName': x['displayName'], 'email': x['email']},
              },
          ],
        );
      });
      Future<void> check(Tx tx, Map<String, Object?> input) async {
        if (input['companyId'] != null && await tx.one('SELECT 1 FROM companies WHERE id = @c AND deleted_at IS NULL', {'c': input['companyId']}) == null) throw notFound('Empresa não encontrada');
        if (input['groupingId'] != null && await tx.one('SELECT 1 FROM groupings WHERE id = @g AND deleted_at IS NULL', {'g': input['groupingId']}) == null) {
          throw notFound('Agrupamento não encontrado');
        }
      }

      Map<String, Object?> data(Map<String, Object?> input) => {...input, 'companyId': input['companyId'], 'groupingId': input['groupingId'], 'endsAt': input['endsAt']};
      r.post('', permission: 'tools.announcements:manage', (ctx) {
        final input = _announcement.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await check(tx, input);
          final a = await tx.insert('announcements', {'tenantId': tenantId, ...data(input), 'createdById': ctx.user.id});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: 'announcement', entityId: a['id'] as String?, after: a, meta: ctx.meta);
          return a;
        });
      });
      r.put('/:id', permission: 'tools.announcements:manage', (ctx) {
        final id = ctx.uuidParam('id');
        final input = _announcement.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final before = await tx.one('SELECT * FROM announcements WHERE id = @id AND deleted_at IS NULL', {'id': id});
          if (before == null) throw notFound('Aviso não encontrado');
          await check(tx, input);
          final a = await tx.update('announcements', id, data(input));
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'announcement', entityId: id, before: before, after: a, meta: ctx.meta);
          return a;
        });
      });
      r.delete('/:id', permission: 'tools.announcements:manage', status: 204, (ctx) {
        final id = ctx.uuidParam('id');
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final before = await tx.one('SELECT * FROM announcements WHERE id = @id AND deleted_at IS NULL', {'id': id});
          if (before == null) throw notFound('Aviso não encontrado');
          await tx.update('announcements', id, {'deletedAt': DateTime.now()});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'announcement', entityId: id, before: before, meta: ctx.meta);
          return null;
        });
      });
    });

    r.group('/v1/app-devices', tag: 'ferramentas', () {
      r.get(
        '/mine',
        permission: 'time.records:create',
        (ctx) => db.forTenant(ctx.tenant, (tx) => tx.query('SELECT $_deviceCols FROM app_devices WHERE user_id = @u ORDER BY created_at DESC', {'u': ctx.user.id})),
      );

      // Pede a liberação: manda um código de 6 dígitos para o e-mail do usuário (vale 10 minutos).
      r.post('/request', permission: 'time.records:create', throttle: 5, (ctx) async {
        final b = Obj({'name': const Str(trim: true, min: 2, max: 60)}).parse(ctx.body);
        final user = ctx.user, tenantId = ctx.tenant;
        final code = _rng.nextInt(1000000).toString().padLeft(6, '0');
        final name = b['name']! as String;
        final res = await db.forTenant(tenantId, (tx) async {
          final pending = await tx.scalar<int>('SELECT count(*)::int FROM app_devices WHERE user_id = @u AND approved_at IS NULL AND revoked_at IS NULL AND code_expires > now()', {'u': user.id}) ?? 0;
          if (pending >= 3) throw conflict('Há pedidos demais aguardando código: confirme ou aguarde 10 minutos');
          final mail = await tx.scalar<String>('SELECT email FROM users WHERE id = @u', {'u': user.id});
          final created = await tx.insert('app_devices', {
            'tenantId': tenantId,
            'userId': user.id,
            'name': name,
            'codeHash': sha256Hex(utf8.encode('${user.id}:$code')),
            'codeExpires': DateTime.now().add(const Duration(minutes: 10)),
          });
          await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'CREATE', entity: 'app_device', entityId: created['id'] as String?, after: {'name': name}, meta: ctx.meta);
          return (device: (await tx.one('SELECT $_deviceCols FROM app_devices WHERE id = @id', {'id': created['id']}))!, email: mail!);
        });
        await app.mail.send(
          OutgoingMail(
            to: res.email,
            subject: 'SuperPonto: código para liberar o aparelho',
            text: 'Código para liberar "$name": $code\nVale por 10 minutos. Se não foi você, ignore este e-mail e avise o RH.',
            html:
                '<p>Código para liberar <b>${escapeHtml(name)}</b>:</p><p style="font-size:24px;letter-spacing:4px"><b>$code</b></p><p>Vale por 10 minutos. Se não foi você, ignore este e-mail e avise o RH.</p>',
          ),
        );
        return res.device;
      });

      // Confere o código e devolve o token do aparelho UMA vez (só o hash fica guardado).
      r.post('/:id/confirm', permission: 'time.records:create', status: 200, throttle: 10, (ctx) {
        final id = ctx.uuidParam('id');
        final b = Obj({'code': Str(pattern: RegExp(r'^\d{6}$'), patternMessage: 'Código de 6 dígitos')}).parse(ctx.body);
        final user = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final d = await tx.one('SELECT * FROM app_devices WHERE id = @id AND user_id = @u', {'id': id, 'u': user.id});
          if (d == null || d['revokedAt'] != null) throw notFound('Pedido não encontrado');
          if (d['approvedAt'] != null) throw conflict('Este aparelho já foi liberado');
          if (d['codeHash'] == null || d['codeExpires'] == null || (d['codeExpires']! as DateTime).isBefore(DateTime.now())) throw badRequest('Código expirado: peça um novo');
          final attempts = d['attempts']! as int;
          if (attempts >= 5) throw forbidden('Tentativas esgotadas: peça um novo código');
          if (sha256Hex(utf8.encode('${user.id}:${b['code']}')) != d['codeHash']) {
            // Conta a tentativa mesmo recusando (em transação própria, que não é desfeita pelo erro).
            await db.forTenant(tenantId, (t2) => t2.execute('UPDATE app_devices SET attempts = attempts + 1 WHERE id = @id', {'id': id}));
            throw badRequest('Código incorreto (${5 - attempts - 1} tentativa(s) restante(s))');
          }
          final token = 'spa_${b64url(randomBytes(32))}';
          await tx.execute('UPDATE app_devices SET token_hash = @h, approved_at = now(), code_hash = NULL, code_expires = NULL WHERE id = @id', {'h': sha256Hex(utf8.encode(token)), 'id': id});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'APPROVE', entity: 'app_device', entityId: id, after: {'name': d['name']}, meta: ctx.meta);
          return {
            ...(await tx.one('SELECT $_deviceCols FROM app_devices WHERE id = @id', {'id': id}))!,
            'token': token,
          };
        });
      });

      Future<Map<String, Object?>> revoke(Ctx ctx, bool asAdmin) {
        final id = ctx.uuidParam('id');
        final user = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final d = await tx.one('SELECT * FROM app_devices WHERE id = @id${asAdmin ? '' : ' AND user_id = @u'}', {'id': id, 'u': user.id});
          if (d == null) throw notFound('Aparelho não encontrado');
          if (d['revokedAt'] != null) return {'ok': true};
          await tx.execute('UPDATE app_devices SET revoked_at = now(), token_hash = NULL, code_hash = NULL WHERE id = @id', {'id': id});
          await app.audit.record(
            tx,
            tenantId: tenantId,
            actorUserId: user.id,
            action: 'DELETE',
            entity: 'app_device',
            entityId: id,
            before: {'name': d['name'], 'userId': d['userId']},
            meta: ctx.meta,
          );
          return {'ok': true};
        });
      }

      r.post('/mine/:id/revoke', permission: 'time.records:create', status: 200, (ctx) => revoke(ctx, false));
      r.get(
        '',
        permission: 'admin.users:manage',
        (ctx) => db.forTenant(
          ctx.tenant,
          (tx) async => [
            for (final d in await tx.query(
              'SELECT d.id, d.user_id, d.name, d.approved_at, d.last_used_at, d.revoked_at, d.created_at, d.code_expires, u.display_name, u.email FROM app_devices d '
              'LEFT JOIN users u ON u.id = d.user_id WHERE d.approved_at IS NOT NULL ORDER BY d.approved_at DESC LIMIT 500',
            ))
              {
                for (final e in d.entries)
                  if (e.key != 'displayName' && e.key != 'email') e.key: e.value,
                'user': d['displayName'] == null ? null : {'id': d['userId'], 'displayName': d['displayName'], 'email': d['email']},
              },
          ],
        ),
      );
      r.post('/:id/revoke', permission: 'admin.users:manage', status: 200, (ctx) => revoke(ctx, true));
    });

    r.group('/v1/custom-texts', tag: 'ferramentas', () {
      r.get(
        '',
        (ctx) => db.forTenant(ctx.tenant, (tx) async {
          final rows = await tx.query('SELECT key, text FROM custom_texts');
          return [
            for (final e in customTexts.entries) {'key': e.key, 'label': e.value, 'text': rows.where((x) => x['key'] == e.key).firstOrNull?['text'] ?? ''},
          ];
        }),
      );
      r.put('/:key', permission: 'admin.settings:manage', (ctx) {
        final key = ctx.param('key');
        final b = Obj({'text': const Str(max: 2000)}).parse(ctx.body);
        if (!customTexts.containsKey(key)) throw notFound('Texto não encontrado');
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final before = await tx.one('SELECT * FROM custom_texts WHERE key = @k', {'k': key});
          final t = (b['text']! as String).trim();
          if (t.isEmpty) {
            if (before != null) await tx.execute('DELETE FROM custom_texts WHERE id = @id', {'id': before['id']});
          } else {
            await tx.execute(
              'INSERT INTO custom_texts (id, tenant_id, key, text, updated_at) VALUES (gen_random_uuid(), @t, @k, @x, now()) ON CONFLICT (tenant_id, key) DO UPDATE SET text = EXCLUDED.text, updated_at = now()',
              {'t': tenantId, 'k': key, 'x': t},
            );
          }
          await app.audit.record(
            tx,
            tenantId: tenantId,
            actorUserId: ctx.user.id,
            action: 'UPDATE',
            entity: 'custom_text',
            entityId: before?['id'] as String?,
            before: before == null ? null : {'key': key, 'text': before['text']},
            after: {'key': key, 'text': t},
            meta: ctx.meta,
          );
          return {'key': key, 'label': customTexts[key], 'text': t};
        });
      });
    });

    // ------------------------------------------------------------------ ciência do espelho
    r.get('/v1/timesheet/me/ack', permission: 'time.records:create', (ctx) async {
      final q = Obj({'from': date, 'to': date, 'employmentId': uuid.optional}).parse(ctx.query);
      final tenantId = ctx.tenant;
      final from = q['from']! as String, to = q['to']! as String;
      final m = await _myMirror(tenantId, ctx.user, from, to, q['employmentId'] as String?);
      final hash = _hash(m).hash;
      final eid = (m['employment']! as Map)['id'];
      final res = await db.forTenant(
        tenantId,
        (tx) async => (
          ack: await tx.one('SELECT *, decision::text AS decision FROM mirror_acknowledgments WHERE employment_id = @e AND period_start = @f AND period_end = @t', {'e': eid, 'f': from, 't': to}),
          term: await tx.scalar<String>("SELECT text FROM custom_texts WHERE key = 'MIRROR_ACK_TERM'"),
        ),
      );
      final today = localBr(DateTime.now()).date;
      final ack = res.ack;
      return {
        'employmentId': eid,
        'from': from,
        'to': to,
        'currentHash': hash,
        'canSign': ack == null && to.compareTo(today) < 0,
        'reason': ack != null
            ? null
            : to.compareTo(today) >= 0
            ? 'O período ainda não terminou'
            : null,
        'term': res.term ?? 'Declaro que conferi as marcações e os totais deste espelho de ponto.',
        'acknowledgment': ack == null
            ? null
            : {'id': ack['id'], 'decision': ack['decision'], 'comment': ack['comment'], 'createdAt': ack['createdAt'], 'contentHash': ack['contentHash'], 'changedSince': ack['contentHash'] != hash},
      };
    });

    r.post('/v1/timesheet/me/ack', permission: 'time.records:create', (ctx) async {
      final input = _ack.parse(ctx.body);
      final user = ctx.user, tenantId = ctx.tenant;
      final from = input['from']! as String, to = input['to']! as String;
      if (from.compareTo(to) > 0) throw badRequest('Período inválido');
      if (to.compareTo(localBr(DateTime.now()).date) >= 0) throw badRequest('Só dá para dar ciência depois que o período terminar');
      final m = await _myMirror(tenantId, user, from, to, input['employmentId'] as String?);
      final h = _hash(m);
      final eid = (m['employment']! as Map)['id'];
      return db.forTenant(tenantId, (tx) async {
        if (await tx.one('SELECT 1 FROM mirror_acknowledgments WHERE employment_id = @e AND period_start = @f AND period_end = @t', {'e': eid, 'f': from, 't': to}) != null) {
          throw conflict('A ciência deste período já foi registrada');
        }
        final ua = ctx.userAgent;
        final a = await tx.insert('mirror_acknowledgments', {
          'tenantId': tenantId,
          'employmentId': eid,
          'userId': user.id,
          'periodStart': from,
          'periodEnd': to,
          'contentHash': h.hash,
          'summary': jsonb(h.summary),
          'decision': input['decision'],
          'comment': input['comment'],
          'ip': ctx.ip,
          'userAgent': ua == null ? null : (ua.length > 300 ? ua.substring(0, 300) : ua),
        });
        await app.audit.record(
          tx,
          tenantId: tenantId,
          actorUserId: user.id,
          action: input['decision'] == 'AGREE' ? 'APPROVE' : 'REJECT',
          entity: 'mirror_acknowledgment',
          entityId: a['id'] as String?,
          after: {'employmentId': eid, 'from': from, 'to': to, 'hash': h.hash},
          meta: ctx.meta,
        );
        return a;
      });
    });

    r.get('/v1/mirror-acks', permission: 'time.calculations:read', (ctx) async {
      final q = Obj({'companyId': uuid, 'from': date, 'to': date}).parse(ctx.query);
      final tenantId = ctx.tenant;
      final from = q['from']! as String, to = q['to']! as String;
      final emps = await db.forTenant(tenantId, (tx) => timesheet.companyEmployments(tx, q['companyId']! as String, from, to));
      final acks = await db.forTenant(
        tenantId,
        (tx) => tx.query('SELECT *, decision::text AS decision FROM mirror_acknowledgments WHERE employment_id::text = ANY(@ids) AND period_start = @f AND period_end = @t', {
          'ids': [for (final e in emps) e.id],
          'f': from,
          't': to,
        }),
      );
      final rows = <Map<String, Object?>>[];
      for (final e in emps..sort((a, b) => a.fullName.compareTo(b.fullName))) {
        final a = acks.where((x) => x['employmentId'] == e.id).firstOrNull;
        var changed = false;
        if (a != null) changed = _hash(await timesheet.mirror(tenantId, e.id, from, to)).hash != a['contentHash'];
        rows.add({
          'employmentId': e.id,
          'registration': e.registration,
          'name': e.name,
          'status': a?['decision'] ?? 'PENDING',
          'signedAt': a?['createdAt'],
          'comment': a?['comment'],
          'ip': a?['ip'],
          'changedSince': changed,
        });
      }
      int count(String s) => rows.where((x) => x['status'] == s).length;
      return {
        'from': from,
        'to': to,
        'rows': rows,
        'totals': {'agree': count('AGREE'), 'disagree': count('DISAGREE'), 'pending': count('PENDING')},
      };
    });

    if (!app.config.testHooks) app.every(const Duration(minutes: 1), () => tick());
  }
}

/// Data civil de um campo de data (para outros módulos).
String toolsIsoDay(Object? v) => isoDay(v);
