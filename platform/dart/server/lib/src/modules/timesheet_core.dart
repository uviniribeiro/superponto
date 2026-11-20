// Apuração: jornada prevista + marcações (originais, incluídas e desconsideradas por ajuste aprovado)
// + abonos e afastamentos + regras de apuração -> resultado diário pelo motor. Nada é gravado aqui.
import 'package:sp_core/sp_core.dart' as core;

import '../db.dart';
import 'schedules.dart';

const tz = 'America/Sao_Paulo';

/// Data e hora locais (Brasília) de um instante.
({String date, String time}) localBr(DateTime at) {
  final l = core.localParts(at, tz);
  return (date: core.civil(l.year, l.month, l.day), time: '${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}');
}

/// Meia-noite de Brasília (-03:00) de uma data civil.
DateTime brMidnight(String date) => DateTime.parse('${date}T00:00:00-03:00');

const leaveLabel = {
  'MEDICAL': 'Atestado médico',
  'VACATION': 'Férias',
  'MATERNITY': 'Licença-maternidade',
  'PATERNITY': 'Licença-paternidade',
  'WORK_ACCIDENT': 'Acidente de trabalho',
  'UNPAID': 'Licença não remunerada',
  'SUSPENSION': 'Suspensão',
  'OTHER': 'Afastamento',
};

/// Vínculo usado na apuração.
class Emp {
  Emp(Row r)
    : id = r['id']! as String,
      companyId = r['companyId']! as String,
      ruleSetId = r['ruleSetId'] as String?,
      registration = r['registration']! as String,
      status = r['status']?.toString() ?? 'ACTIVE',
      hiredAt = isoDay(r['hiredAt']),
      terminatedAt = r['terminatedAt'] == null ? null : isoDay(r['terminatedAt']),
      fullName = r['fullName']! as String,
      socialName = r['socialName'] as String?,
      row = r;
  final String id, companyId, registration, status, hiredAt, fullName;
  final String? ruleSetId, terminatedAt, socialName;
  final Row row;
  String get name => socialName ?? fullName;
}

const empSelect =
    'SELECT e.id, e.company_id, e.rule_set_id, e.registration, e.status::text AS status, e.hired_at, e.terminated_at, '
    'p.full_name, p.social_name FROM employment_relationships e JOIN people p ON p.id = e.person_id';

Future<List<Emp>> loadEmps(Tx tx, String where, Map<String, Object?> p, {String order = '', String limit = ''}) async => [
  for (final r in await tx.query('$empSelect WHERE $where $order $limit', p)) Emp(r),
];

core.DayResult resultFromJson(Map<String, Object?> m) => core.DayResult(
  date: m['date']! as String,
  expectedMinutes: (m['expectedMinutes'] as num?)?.toInt() ?? 0,
  balanceMinutes: (m['balanceMinutes'] as num?)?.toInt() ?? 0,
  overtime: [for (final o in (m['overtime'] as List?) ?? const []) core.OvertimePart((o as Map)['percent']! as num, (o['minutes']! as num).toInt())],
  flags: [for (final f in (m['flags'] as List?) ?? const []) f.toString()],
);

class TimesheetCore {
  TimesheetCore(this.schedules);
  final SchedulesModule schedules;
  Db get db => schedules.db;

  Future<Map<String, List<Map<String, Object?>>>> compute(String tenantId, List<Emp> emps, String from, String to) async {
    if (emps.isEmpty) return {};
    final hol = await schedules.holidayMap(tenantId, {for (final e in emps) e.companyId}.toList(), from, to);
    return db.forTenant(tenantId, (tx) => computeTx(tx, emps, from, to, hol));
  }

  Future<Map<String, List<Map<String, Object?>>>> computeTx(Tx tx, List<Emp> emps, String from, String to, HolidayMap hol) async {
    final ids = [for (final e in emps) e.id];
    final companies = {for (final e in emps) e.companyId}.toList();
    final winFrom = DateTime.parse('${from}T00:00:00Z').subtract(const Duration(days: 1));
    final winTo = DateTime.parse('${to}T00:00:00Z').add(const Duration(days: 2));
    final plan = await schedules.computeEngine(tx, [for (final e in emps) (id: e.id, companyId: e.companyId)], from, to, hol);
    final p = {'ids': ids, 'from': from, 'to': to, 'wf': winFrom, 'wt': winTo, 'c': companies};
    final records = await tx.query(
      'SELECT id, employment_id, recorded_at, source::text AS source FROM time_records WHERE employment_id::text = ANY(@ids) AND recorded_at >= @wf AND recorded_at < @wt ORDER BY recorded_at ASC',
      p,
    );
    final adjustments = await tx.query(
      'SELECT a.*, a.kind::text AS kind, a.status::text AS status FROM time_record_adjustments a LEFT JOIN time_records r ON r.id = a.time_record_id '
      "WHERE a.employment_id::text = ANY(@ids) AND a.status IN ('APPROVED', 'PENDING') AND ((a.recorded_at >= @wf AND a.recorded_at < @wt) OR (r.recorded_at >= @wf AND r.recorded_at < @wt))",
      p,
    );
    final allowances = await tx.query(
      'SELECT a.*, j.name AS j_name, j.disregards_debits AS j_disregards_debits FROM allowances a JOIN justifications j ON j.id = a.justification_id '
      'WHERE a.employment_id::text = ANY(@ids) AND a.date BETWEEN @from AND @to',
      p,
    );
    final leaves = await tx.query('SELECT *, type::text AS type FROM leaves WHERE employment_id::text = ANY(@ids) AND deleted_at IS NULL AND start_date <= @to AND end_date >= @from', p);
    final onCalls = await tx.query('SELECT * FROM on_call_periods WHERE employment_id::text = ANY(@ids) AND date BETWEEN @from AND @to', p);
    final ruleSets = await tx.query('SELECT * FROM attendance_rule_sets WHERE company_id::text = ANY(@c) AND deleted_at IS NULL', p);
    final closings = await tx.query(
      "SELECT company_id, period_start, period_end FROM time_closings WHERE company_id::text = ANY(@c) AND status = 'CLOSED' AND period_start <= @to AND period_end >= @from",
      p,
    );
    final authorizations = await tx.query('SELECT employment_id, date, max_minutes FROM overtime_authorizations WHERE employment_id::text = ANY(@ids) AND date BETWEEN @from AND @to', p);
    final persisted = await tx.query('SELECT employment_id, work_date, details FROM time_calculations WHERE employment_id::text = ANY(@ids) AND work_date BETWEEN @from AND @to', p);
    final persistedMap = {for (final x in persisted) '${x['employmentId']}|${isoDay(x['workDate'])}': x['details']};
    final out = <String, List<Map<String, Object?>>>{};
    final today = localBr(DateTime.now()).date;

    for (final e in emps) {
      final days = plan[e.id]!;
      ({core.AttendanceRules rules, bool requiresAuthorization}) ruleFor(String? ruleSetId) {
        final own = ruleSets.where((x) => x['id'] == (e.ruleSetId ?? ruleSetId)).firstOrNull ?? ruleSets.where((x) => x['companyId'] == e.companyId && x['isDefault'] == true).firstOrNull;
        final r = (own?['rules'] as Map?)?.cast<String, Object?>();
        return (rules: core.AttendanceRules.fromJson(r), requiresAuthorization: r?['overtimeRequiresAuthorization'] == true);
      }

      // Marcações efetivas e a visão de cada uma (para o espelho).
      final mineAdj = adjustments.where((a) => a['employmentId'] == e.id).toList();
      final views = <Map<String, Object?>>[];
      final effective = <core.Punch>[];
      for (final r in records.where((x) => x['employmentId'] == e.id)) {
        final dis = mineAdj.where((a) => a['kind'] == 'DISREGARD' && a['timeRecordId'] == r['id']).firstOrNull;
        final status = dis?['status'] == 'APPROVED'
            ? 'DISREGARDED'
            : dis != null
            ? 'PENDING_DISREGARD'
            : 'ORIGINAL';
        final at = r['recordedAt']! as DateTime;
        final l = localBr(at);
        views.add({'id': r['id'], 'adjustmentId': dis?['id'], 'at': isoMs(at), 'time': l.time, 'date': l.date, 'source': r['source'], 'status': status, 'justification': dis?['justification']});
        if (status != 'DISREGARDED') effective.add(core.Punch(at, r['id']! as String));
      }
      for (final a in mineAdj.where((x) => x['kind'] == 'INCLUDE' && x['recordedAt'] != null)) {
        final at = a['recordedAt']! as DateTime;
        final l = localBr(at);
        views.add({
          'id': a['id'],
          'adjustmentId': a['id'],
          'at': isoMs(at),
          'time': l.time,
          'date': l.date,
          'source': 'MANUAL_ADJUSTMENT',
          'status': a['status'] == 'APPROVED' ? 'INCLUDED' : 'PENDING_INCLUDE',
          'justification': a['justification'],
        });
        if (a['status'] == 'APPROVED') effective.add(core.Punch(at, a['id']! as String));
      }
      final byDay = core.assignPunchesToDays(effective, [for (final d in days) d.engine], tz);
      final dayOfView = <String, String>{};
      byDay.forEach((date, list) {
        for (final p in list) {
          dayOfView[p.id!] = date;
        }
      });
      final list = <Map<String, Object?>>[];
      for (final d in days) {
        final date = d.view['date']! as String;
        final closed = closings.any((c) => c['companyId'] == e.companyId && isoDay(c['periodStart']).compareTo(date) <= 0 && isoDay(c['periodEnd']).compareTo(date) >= 0);
        final snap = closed ? persistedMap['${e.id}|$date'] : null;
        if (snap is Map) {
          list.add({...snap.cast<String, Object?>(), 'closed': true});
          continue;
        }
        final outside = date.compareTo(e.hiredAt) < 0 || (e.terminatedAt != null && date.compareTo(e.terminatedAt!) > 0);
        final punchViews = views.where((v) {
          final st = v['status']! as String;
          return (dayOfView[v['id']] ?? (st.startsWith('PENDING') || st == 'DISREGARDED' ? v['date'] : null)) == date;
        }).toList()..sort((a, b) => (a['at']! as String).compareTo(b['at']! as String));
        final lv = leaves.where((x) => x['employmentId'] == e.id && isoDay(x['startDate']).compareTo(date) <= 0 && isoDay(x['endDate']).compareTo(date) >= 0).firstOrNull;
        final al = allowances.where((x) => x['employmentId'] == e.id && isoDay(x['date']) == date).firstOrNull;
        final oc = onCalls.where((x) => x['employmentId'] == e.id && isoDay(x['date']) == date).toList();
        core.DayAbsence? absence;
        if (lv != null) {
          absence = core.DayAbsence.full(leaveLabel[lv['type']]);
        } else if (al != null && al['jDisregardsDebits'] == true) {
          absence = al['fullDay'] == true ? core.DayAbsence.full(al['jName'] as String?) : core.DayAbsence.partial(al['minutes']! as int, al['jName'] as String?);
        }
        final rules = ruleFor(d.ruleSetId);
        Map<String, Object?>? result;
        // Dia que ainda não chegou (horário de Brasília) não é apurado: sem falta antecipada.
        final future = date.compareTo(today) > 0;
        if (!outside && !future) {
          final r = core.calculateDay(date: date, timeZone: tz, expected: d.engine, punches: byDay[date] ?? const [], rules: rules.rules, absence: absence);
          final flags = [...r.flags];
          if (al != null && al['jDisregardsDebits'] != true) flags.add('JUSTIFIED');
          var unauthorized = 0;
          if (rules.requiresAuthorization && r.overtimeMinutes > 0) {
            final auth = authorizations.where((x) => x['employmentId'] == e.id && isoDay(x['date']) == date).firstOrNull?['maxMinutes'] as int? ?? 0;
            unauthorized = r.overtimeMinutes - auth > 0 ? r.overtimeMinutes - auth : 0;
            if (unauthorized > 0) flags.add('OVERTIME_UNAUTHORIZED');
          }
          result = {...r.toJson(), 'flags': flags, 'unauthorizedOvertimeMinutes': unauthorized};
        }
        list.add({
          'date': date,
          'expected': d.view,
          'punches': punchViews,
          'result': result,
          'allowance': al == null
              ? null
              : {'id': al['id'], 'justification': al['jName'], 'disregardsDebits': al['jDisregardsDebits'], 'fullDay': al['fullDay'], 'minutes': al['minutes'], 'note': al['note']},
          'leave': lv == null ? null : {'id': lv['id'], 'type': lv['type'], 'label': leaveLabel[lv['type']] ?? lv['type'], 'note': lv['note']},
          'onCall': [
            for (final o in oc) {'id': o['id'], 'startTime': o['startTime'], 'endTime': o['endTime'], 'minutes': o['minutes']},
          ],
          'closed': closed,
          'outsideEmployment': outside,
        });
      }
      out[e.id] = list;
    }
    return out;
  }

  /// Totais do período (espelho), com sobreaviso e extra não autorizada.
  Map<String, Object?> summary(List<Map<String, Object?>> days) {
    final results = [
      for (final d in days)
        if (d['result'] is Map) (d['result']! as Map).cast<String, Object?>(),
    ];
    int sum(String k) => results.fold(0, (s, r) => s + ((r[k] as num?)?.toInt() ?? 0));
    final byPercent = <num, int>{};
    for (final r in results) {
      for (final o in (r['overtime'] as List?) ?? const []) {
        final m = o as Map;
        byPercent[m['percent']! as num] = (byPercent[m['percent']] ?? 0) + (m['minutes']! as num).toInt();
      }
    }
    final onCallMinutes = days.fold<int>(0, (t, d) => t + ((d['onCall'] as List?) ?? const []).fold<int>(0, (x, o) => x + ((o as Map)['minutes'] as num).toInt()));
    return {
      'days': results.length,
      'workdays': results.where((r) => ((r['expectedMinutes'] as num?) ?? 0) > 0).length,
      'expectedMinutes': sum('expectedMinutes'),
      'workedMinutes': sum('workedMinutes'),
      'balanceMinutes': sum('balanceMinutes'),
      'overtimeMinutes': sum('overtimeMinutes'),
      'overtimeByPercent': [
        for (final e in (byPercent.entries.toList()..sort((a, b) => a.key.compareTo(b.key)))) {'percent': e.key, 'minutes': e.value},
      ],
      'nightMinutes': sum('nightMinutes'),
      'nightReducedMinutes': sum('nightReducedMinutes'),
      'lateMinutes': sum('lateMinutes'),
      'earlyLeaveMinutes': sum('earlyLeaveMinutes'),
      'absenceDays': results.where((r) => (r['flags'] as List?)?.contains('ABSENCE') ?? false).length,
      'incompleteDays': results.where((r) => (r['flags'] as List?)?.contains('INCOMPLETE') ?? false).length,
      'onCallMinutes': onCallMinutes,
      'onCallPaidMinutes': core.jsRound(onCallMinutes / 3),
      'allowanceDays': days.where((d) => (d['allowance'] as Map?)?['fullDay'] == true).length,
      'leaveDays': days.where((d) => d['leave'] != null).length,
      'unauthorizedOvertimeMinutes': days.fold<int>(0, (t, d) => t + (((d['result'] as Map?)?['unauthorizedOvertimeMinutes'] as num?)?.toInt() ?? 0)),
      'pendingAdjustments': days.fold<int>(0, (t, d) => t + ((d['punches'] as List?) ?? const []).where((p) => ((p as Map)['status']! as String).startsWith('PENDING')).length),
    };
  }

  /// Grava a apuração dos dias abertos (dias de período fechado não são regravados).
  Future<int> persist(Tx tx, String tenantId, Map<String, List<Map<String, Object?>>> map) async {
    var n = 0;
    for (final entry in map.entries) {
      for (final d in entry.value) {
        if (d['closed'] == true || d['result'] == null) continue;
        final r = (d['result']! as Map).cast<String, Object?>();
        await tx.execute(
          'INSERT INTO time_calculations (id, tenant_id, employment_id, work_date, expected_minutes, worked_minutes, balance_minutes, overtime, night_minutes, '
          'late_minutes, early_leave_minutes, absence_minutes, break_minutes, flags, details, engine_version, calculated_at) '
          'VALUES (gen_random_uuid(), @t, @e, @d, @exp, @w, @b, @ot, @n, @l, @el, @ab, @br, @f, @det, @v, now()) '
          'ON CONFLICT (employment_id, work_date) DO UPDATE SET expected_minutes = EXCLUDED.expected_minutes, worked_minutes = EXCLUDED.worked_minutes, '
          'balance_minutes = EXCLUDED.balance_minutes, overtime = EXCLUDED.overtime, night_minutes = EXCLUDED.night_minutes, late_minutes = EXCLUDED.late_minutes, '
          'early_leave_minutes = EXCLUDED.early_leave_minutes, absence_minutes = EXCLUDED.absence_minutes, break_minutes = EXCLUDED.break_minutes, '
          'flags = EXCLUDED.flags, details = EXCLUDED.details, engine_version = EXCLUDED.engine_version, calculated_at = now()',
          {
            't': tenantId,
            'e': entry.key,
            'd': d['date'],
            'exp': r['expectedMinutes'],
            'w': r['workedMinutes'],
            'b': r['balanceMinutes'],
            'ot': jsonb(r['overtime']),
            'n': r['nightMinutes'],
            'l': r['lateMinutes'],
            'el': r['earlyLeaveMinutes'],
            'ab': r['absenceMinutes'],
            'br': r['breakMinutes'],
            'f': jsonb(r['flags']),
            'det': jsonb(toJsonValue(d)),
            'v': r['engineVersion'],
          },
        );
        n++;
      }
    }
    return n;
  }
}
