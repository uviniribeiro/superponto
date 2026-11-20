// Jornadas: horários (semanais e escalas cíclicas), regras de apuração, atribuição com vigência,
// escala agendada, trocas e jornada prevista por funcionário e por equipe.
import 'package:sp_core/sp_core.dart' as core;

import '../app.dart';
import '../auth/auth_user.dart';
import '../db.dart';
import '../http.dart';
import '../validate.dart';
import 'holidays.dart';
import 'users.dart' show likePattern;

final _hmRe = RegExp(r'^([01]\d|2[0-3]):[0-5]\d$');
final _hm = Str(pattern: _hmRe, patternMessage: 'Horário no formato HH:mm');
int _toMin(String v) => int.parse(v.substring(0, 2)) * 60 + int.parse(v.substring(3));
const scheduleTypes = ['FIXED', 'FLEXIBLE', 'SHIFT_12X36', 'SHIFT_6X1', 'SHIFT_5X2', 'SHIFT_4X2', 'ROTATING', 'CUSTOM', 'ON_CALL', 'TEACHING'];
const cyclicTypes = {'SHIFT_12X36', 'SHIFT_6X1', 'SHIFT_5X2', 'SHIFT_4X2', 'ROTATING', 'CUSTOM', 'ON_CALL'};

/// Duração do dia em minutos (atravessando a meia-noite quando o fim é menor que o início).
int span(String start, String end) {
  final s = _toMin(start);
  var e = _toMin(end);
  if (e <= s) e += 1440;
  return e - s;
}

String dateAdd(String d, int n) => core.addDays(d, n);
Iterable<String> daysBetween(String from, String to) sync* {
  for (var d = from; d.compareTo(to) <= 0; d = dateAdd(d, 1)) {
    yield d;
  }
}

String? hmText(int? m) => m == null ? null : '${((m % 1440) ~/ 60).toString().padLeft(2, '0')}:${(m % 60).toString().padLeft(2, '0')}';
String isoDay(Object? d) => d is DateTime ? isoMs(d).substring(0, 10) : d.toString();
String todayUtc() => isoMs(DateTime.now()).substring(0, 10);
int _diffDays(String a, String b) => DateTime.parse('${b}T00:00:00Z').difference(DateTime.parse('${a}T00:00:00Z')).inDays;

final _day = Obj({
  'dayIndex': const Num(int: true, min: 0, max: 61),
  'isWorkday': const Bool(),
  'startTime': _hm.nullish,
  'endTime': _hm.nullish,
  'breakMinutes': const Num(int: true, min: 0, max: 720).def(0),
  'breakStart': _hm.nullish,
  'expectedMinutes': const Num(int: true, min: 0, max: 1440).optional,
});

void _checkSchedule(Map<String, Object?> v, void Function(String, [List<Object>]) add) {
  final type = v['type']! as String;
  final cyclic = cyclicTypes.contains(type);
  final cycleDays = v['cycleDays'] as int?;
  if (cyclic && (cycleDays ?? 0) == 0) add('Informe quantos dias tem o ciclo da escala', ['cycleDays']);
  if (!cyclic && (cycleDays ?? 0) != 0) add('Jornada semanal não tem ciclo', ['cycleDays']);
  final seen = <int>{};
  final days = (v['days']! as List).cast<Map<String, Object?>>();
  for (var i = 0; i < days.length; i++) {
    final d = days[i];
    final idx = d['dayIndex']! as int;
    if (seen.contains(idx)) add('Dia repetido na jornada', ['days', i, 'dayIndex']);
    seen.add(idx);
    if (cyclic ? idx >= (cycleDays ?? 0) : idx > 6) add(cyclic ? 'Dia fora do ciclo' : 'Dia da semana inválido (0 = domingo … 6 = sábado)', ['days', i, 'dayIndex']);
    if (d['isWorkday'] != true) continue;
    final st = d['startTime'] as String?, en = d['endTime'] as String?;
    final flexible = type == 'FLEXIBLE' || ((st ?? '').isEmpty && (en ?? '').isEmpty);
    if ((st ?? '').isNotEmpty != (en ?? '').isNotEmpty) {
      add('Informe entrada e saída juntas', ['days', i, 'endTime']);
      continue;
    }
    if (flexible) {
      if ((d['expectedMinutes'] as int? ?? 0) == 0) add('Jornada sem horário fixo precisa da carga do dia', ['days', i, 'expectedMinutes']);
      continue;
    }
    final total = span(st!, en!);
    final brk = d['breakMinutes']! as int;
    if (brk >= total) add('O intervalo não pode ser maior que a jornada do dia', ['days', i, 'breakMinutes']);
    if (total - brk > 960) add('Jornada do dia acima de 16 horas', ['days', i, 'endTime']);
    final bs = d['breakStart'] as String?;
    if (bs != null && bs.isNotEmpty) {
      final s = _toMin(st);
      var b = _toMin(bs);
      if (b < s) b += 1440;
      if (b - s <= 0 || b - s + brk >= total) add('O intervalo precisa ficar dentro da jornada', ['days', i, 'breakStart']);
    }
  }
}

final _scheduleFields = <String, S>{
  'name': const Str(trim: true, min: 3, max: 120, message: 'Mínimo de 3 caracteres'),
  'code': const Str(trim: true, min: 1, max: 20).nullish,
  'type': const Enum(scheduleTypes),
  'cycleDays': const Num(int: true, min: 2, max: 62).nullish,
  'considerHolidays': const Bool().def(true),
  'inItinereMinutes': const Num(int: true, min: 0, max: 600).def(0),
  'entryMobilityMinutes': const Num(int: true, min: 0, max: 600).def(0),
  'breakMobilityMinutes': const Num(int: true, min: 0, max: 600).def(0),
  'ruleSetId': uuid.nullish,
  'active': const Bool().optional,
  'days': Arr(_day, min: 1, max: 62),
};
final scheduleCreate = Obj({'companyId': uuid, ..._scheduleFields}).superRefine(_checkSchedule);
final scheduleUpdate = Obj(_scheduleFields).superRefine(_checkSchedule);

S _pct(int min, String label) => Num(int: true, min: min, max: 300, message: '$label: mínimo de $min%');
final rulesSchema = Obj({
  'markToleranceMinutes': const Num(int: true, min: 0, max: 5, message: 'CLT art. 58 §1º: até 5 minutos por marcação').def(5),
  'dailyToleranceMinutes': const Num(int: true, min: 0, max: 10, message: 'CLT art. 58 §1º: até 10 minutos no dia').def(10),
  'roundingMinutes': const Num(int: true, min: 0, max: 30).def(0),
  'roundingMode': const Enum(['up', 'down', 'nearest']).def('nearest'),
  'overtimePercent': Obj({
    'normal': _pct(50, 'Hora extra'), 'night': _pct(50, 'Hora extra noturna'), 'rest': _pct(50, 'Extra no descanso'),
    'holiday': _pct(50, 'Extra no feriado'), 'break': _pct(50, 'Intervalo suprimido'),
  }).def({'normal': 50, 'night': 50, 'rest': 100, 'holiday': 100, 'break': 50}),
  'nightStart': _hm.def('22:00'),
  'nightEnd': _hm.def('05:00'),
  'reducedNightHour': const Bool().def(true),
  'minBreakMinutes': const Num(int: true, min: 0, max: 240).def(60),
  'autoDeductBreak': const Bool().def(false),
  'dailyOvertimeLimitMinutes': const Num(int: true, min: 0, max: 720).def(120),
  'discountAbsences': const Bool().def(true),
  'overtimeBands': Arr(Obj({'upToMinutes': const Num(int: true, min: 1, max: 720).nullable, 'percent': _pct(50, 'Faixa de extra')}), max: 5).optional,
  'overtimeRequiresAuthorization': const Bool().def(false),
}).superRefine((r, add) {
  final b = (r['overtimeBands'] as List?)?.cast<Map<String, Object?>>();
  if (b == null || b.isEmpty) return;
  for (var i = 0; i < b.length; i++) {
    if (b[i]['upToMinutes'] == null && i != b.length - 1) add('Só a última faixa pode ficar sem limite', ['overtimeBands', i]);
    if (i > 0 && b[i]['upToMinutes'] != null && b[i - 1]['upToMinutes'] != null && (b[i]['upToMinutes']! as int) <= (b[i - 1]['upToMinutes']! as int)) {
      add('As faixas precisam crescer', ['overtimeBands', i]);
    }
  }
});

final _ruleSetCreate = Obj({'companyId': uuid, 'name': const Str(trim: true, min: 3, max: 120), 'isDefault': const Bool().def(false), 'rules': rulesSchema});
final _ruleSetUpdate = Obj({'name': const Str(trim: true, min: 3, max: 120).optional, 'isDefault': const Bool().optional, 'rules': rulesSchema.optional});
final _assign = Obj({'employmentIds': const Arr(uuid, min: 1, max: 500), 'scheduleId': uuid, 'validFrom': date, 'cycleStart': date.optional});
final _override = Obj({
  'employmentIds': const Arr(uuid, min: 1, max: 500),
  'from': date,
  'to': date,
  'weekdays': const Arr(Num(int: true, min: 0, max: 6), max: 7).optional,
  'isWorkday': const Bool(),
  'startTime': _hm.nullish,
  'endTime': _hm.nullish,
  'breakMinutes': const Num(int: true, min: 0, max: 720).def(0),
  'breakStart': _hm.nullish,
  'note': const Str(trim: true, max: 300).optional,
}).superRefine((v, add) {
  final from = v['from']! as String, to = v['to']! as String;
  if (to.compareTo(from) < 0) add('A data final deve ser igual ou posterior à inicial', ['to']);
  if (_diffDays(from, to) > 366) add('Período máximo de 1 ano por lançamento', ['to']);
  final st = v['startTime'] as String?, en = v['endTime'] as String?;
  if (v['isWorkday'] == true && ((st ?? '').isEmpty || (en ?? '').isEmpty)) add('Dia de trabalho precisa de entrada e saída', ['startTime']);
  if (v['isWorkday'] == true && st != null && en != null && st.isNotEmpty && en.isNotEmpty && (v['breakMinutes']! as int) >= span(st, en)) {
    add('O intervalo não pode ser maior que a jornada', ['breakMinutes']);
  }
});
final _note = const Str(trim: true, min: 3, max: 300, message: 'Informe o motivo');
final _swapShift = Obj({'kind': const Literal('SHIFT'), 'date': date, 'employmentIdA': uuid, 'employmentIdB': uuid, 'note': _note});
final _swapDayOff = Obj({'kind': const Literal('DAY_OFF'), 'employmentId': uuid, 'workDate': date, 'offDate': date, 'note': _note});
Obj rangeSchema(int maxDays, String message) => Obj({'from': date, 'to': date})
    .check((v) => (v['to']! as String).compareTo(v['from']! as String) >= 0 && _diffDays(v['from']! as String, v['to']! as String) <= maxDays - 1, message, path: ['to']);

/// Carga semanal (média, nas escalas cíclicas) a partir dos dias.
int _weeklyMinutes(String type, int? cycleDays, List<Map<String, Object?>> days) {
  var total = 0;
  for (final d in days) {
    total += _expected(d);
  }
  return cyclicTypes.contains(type) && (cycleDays ?? 0) > 0 ? core.jsRound(total * 7 / cycleDays!) : total;
}

int _expected(Map<String, Object?> d) {
  if (d['isWorkday'] != true) return 0;
  final st = d['startTime'] as String?, en = d['endTime'] as String?;
  final exp = d['expectedMinutes'] as int?;
  if (st != null && st.isNotEmpty && en != null && en.isNotEmpty) return (exp != null && exp != 0) ? exp : span(st, en) - (d['breakMinutes']! as int);
  return exp ?? 0;
}

core.Schedule toEngineSchedule(Row s, List<Row> days) => core.Schedule(
      type: core.scheduleTypeFrom(s['type']! as String),
      cycleDays: s['cycleDays'] as int?,
      considerHolidays: s['considerHolidays'] != false,
      inItinereMinutes: s['inItinereMinutes'] as int? ?? 0,
      entryMobilityMinutes: s['entryMobilityMinutes'] as int? ?? 0,
      breakMobilityMinutes: s['breakMobilityMinutes'] as int? ?? 0,
      days: [
        for (final d in days)
          core.ScheduleDay(
            dayIndex: d['dayIndex']! as int, isWorkday: d['isWorkday'] == true, startTime: d['startTime'] as String?, endTime: d['endTime'] as String?,
            breakMinutes: d['breakMinutes'] as int? ?? 0, breakStart: d['breakStart'] as String?,
            expectedMinutes: (d['expectedMinutes'] as int? ?? 0) == 0 ? null : d['expectedMinutes'] as int?,
          ),
      ],
    );

Map<String, Object?> viewDay(core.ExpectedDay e, [Map<String, Object?> extra = const {}]) => {
      'date': e.date, 'isWorkday': e.isWorkday, 'isHoliday': e.isHoliday, 'flexible': e.flexible, 'scheduled': e.scheduled,
      'start': hmText(e.start), 'end': hmText(e.end), 'breakMinutes': e.breakMinutes, 'breakStart': hmText(e.breakStart), 'expectedMinutes': e.expectedMinutes,
      'overnight': e.end != null && e.end! > 1440, ...extra,
    };

/// Período fechado não aceita mudança de jornada (a apuração já foi conferida).
Future<void> assertOpenPeriod(Tx tx, List<String> companyIds, String from, String to) async {
  final closed = await tx.one(
    "SELECT period_start, period_end FROM time_closings WHERE company_id::text = ANY(@c) AND status = 'CLOSED' AND period_start <= @to AND period_end >= @from LIMIT 1",
    {'c': companyIds, 'from': from, 'to': to},
  );
  if (closed != null) {
    throw conflict('Período fechado (${isoDay(closed['periodStart'])} a ${isoDay(closed['periodEnd'])}): reabra o fechamento para alterar a jornada');
  }
}

typedef HolidayMap = Map<String, Map<String, ({String name, bool workday})>>;

/// Dia previsto com a regra de apuração do horário (usado pela apuração do ponto).
class PlannedDay {
  PlannedDay(this.view, this.engine, this.ruleSetId);
  final Map<String, Object?> view;
  final core.ExpectedDay engine;
  final String? ruleSetId;
}

class SchedulesModule {
  SchedulesModule(this.app, this.holidays);
  final App app;
  final HolidaysService holidays;
  Db get db => app.db;

  Future<HolidayMap> holidayMap(String tenantId, List<String> companyIds, String from, String to) async {
    final years = {int.parse(from.substring(0, 4)), int.parse(to.substring(0, 4))};
    final map = <String, Map<String, ({String name, bool workday})>>{};
    for (final c in companyIds) {
      final m = <String, ({String name, bool workday})>{};
      for (final y in years) {
        for (final h in ((await holidays.listForCompany(tenantId, c, y))['holidays']! as List).cast<Map<String, Object?>>()) {
          final d = h['date']! as String;
          if (d.compareTo(from) >= 0 && d.compareTo(to) <= 0) m[d] = (name: h['name']! as String, workday: h['workday'] == true);
        }
      }
      map[c] = m;
    }
    return map;
  }

  /// Dias previstos (motor + visão) de um conjunto de vínculos, na transação do chamador.
  Future<Map<String, List<PlannedDay>>> computeEngine(Tx tx, List<({String id, String companyId})> emps, String from, String to, HolidayMap holidays) async {
    final ids = [for (final e in emps) e.id];
    final assignments = await tx.query(
      'SELECT a.*, s.name AS s_name, s.code AS s_code, s.rule_set_id AS s_rule_set_id, s.type::text AS s_type, s.cycle_days AS s_cycle_days, '
      's.consider_holidays AS s_consider_holidays, s.in_itinere_minutes AS s_in_itinere_minutes, s.entry_mobility_minutes AS s_entry_mobility_minutes, '
      's.break_mobility_minutes AS s_break_mobility_minutes FROM schedule_assignments a JOIN work_schedules s ON s.id = a.schedule_id '
      'WHERE a.employment_id::text = ANY(@ids) AND a.valid_from <= @to AND (a.valid_to IS NULL OR a.valid_to >= @from)',
      {'ids': ids, 'from': from, 'to': to},
    );
    final scheduleIds = {for (final a in assignments) a['scheduleId']! as String}.toList();
    final days = scheduleIds.isEmpty ? <Row>[] : await tx.query('SELECT * FROM work_schedule_days WHERE schedule_id::text = ANY(@s)', {'s': scheduleIds});
    final overrides = await tx.query('SELECT * FROM schedule_overrides WHERE employment_id::text = ANY(@ids) AND date BETWEEN @from AND @to', {'ids': ids, 'from': from, 'to': to});
    final result = <String, List<PlannedDay>>{};
    for (final e in emps) {
      final mine = [
        for (final a in assignments.where((a) => a['employmentId'] == e.id))
          (
            name: a['sName'], code: a['sCode'], ruleSetId: a['sRuleSetId'] as String?,
            engine: core.ScheduleAssignment(
              schedule: toEngineSchedule({
                'type': a['sType'], 'cycleDays': a['sCycleDays'], 'considerHolidays': a['sConsiderHolidays'], 'inItinereMinutes': a['sInItinereMinutes'],
                'entryMobilityMinutes': a['sEntryMobilityMinutes'], 'breakMobilityMinutes': a['sBreakMobilityMinutes'],
              }, days.where((d) => d['scheduleId'] == a['scheduleId']).toList()),
              validFrom: isoDay(a['validFrom']), validTo: a['validTo'] == null ? null : isoDay(a['validTo']), cycleStart: a['cycleStart'] == null ? null : isoDay(a['cycleStart']),
            ),
          ),
      ];
      final ov = {for (final o in overrides.where((o) => o['employmentId'] == e.id)) isoDay(o['date']): o};
      final hol = holidays[e.companyId] ?? const {};
      final list = <PlannedDay>[];
      for (final d in daysBetween(from, to)) {
        final active = core.activeAssignment([for (final m in mine) m.engine], d);
        final meta = active == null ? null : mine.firstWhere((m) => identical(m.engine, active));
        final h = hol[d];
        final o = ov[d];
        final exp = core.resolveExpectedDay(
          active, d,
          calendar: h == null ? null : core.CalendarDay(date: d, isHoliday: true, isWorkday: h.workday),
          override: o == null
              ? null
              : core.DayOverride(isWorkday: o['isWorkday'] == true, startTime: o['startTime'] as String?, endTime: o['endTime'] as String?,
                  breakMinutes: o['breakMinutes'] as int? ?? 0, breakStart: o['breakStart'] as String?),
        );
        list.add(PlannedDay(
          viewDay(exp, {
            'scheduleName': meta?.name, 'scheduleCode': meta?.code, 'holidayName': h != null && !h.workday ? h.name : null,
            'overrideId': o?['id'], 'origin': o?['origin'], 'note': o?['note'],
          }),
          exp,
          meta?.ruleSetId,
        ));
      }
      result[e.id] = list;
    }
    return result;
  }

  Future<Map<String, List<Map<String, Object?>>>> compute(Tx tx, List<({String id, String companyId})> emps, String from, String to, HolidayMap holidays) async =>
      (await computeEngine(tx, emps, from, to, holidays)).map((k, v) => MapEntry(k, [for (final d in v) d.view]));

  // ------------------------------------------------------------------ horários
  Future<Map<String, Object?>> _schedule(Tx tx, String id) async {
    final s = await tx.one('SELECT *, type::text AS type FROM work_schedules WHERE id = @id AND deleted_at IS NULL', {'id': id});
    if (s == null) throw notFound('Horário não encontrado');
    return _withDays(tx, s);
  }

  Future<Map<String, Object?>> _withDays(Tx tx, Row s) async {
    final days = await tx.query('SELECT * FROM work_schedule_days WHERE schedule_id = @id ORDER BY day_index ASC', {'id': s['id']});
    final rs = s['ruleSetId'] == null ? null : await tx.one('SELECT id, name FROM attendance_rule_sets WHERE id = @id', {'id': s['ruleSetId']});
    return {...s, 'days': days, 'ruleSet': rs};
  }

  Future<int> _inUse(Tx tx, String id) async => await tx.scalar<int>(
        'SELECT count(*)::int FROM schedule_assignments a JOIN employment_relationships e ON e.id = a.employment_id '
        "WHERE a.schedule_id = @id AND (a.valid_to IS NULL OR a.valid_to >= @today) AND e.status = 'ACTIVE' AND e.deleted_at IS NULL",
        {'id': id, 'today': todayUtc()},
      ) ?? 0;

  Future<void> _checkRuleSet(Tx tx, String companyId, Object? ruleSetId) async {
    if (ruleSetId == null) return;
    final r = await tx.one('SELECT company_id FROM attendance_rule_sets WHERE id = @id AND deleted_at IS NULL', {'id': ruleSetId});
    if (r == null || r['companyId'] != companyId) throw badRequest('Regra de apuração não pertence a esta empresa');
  }

  Future<void> _requireCompany(Tx tx, Object? id) async {
    if (await tx.one('SELECT 1 FROM companies WHERE id = @id AND deleted_at IS NULL', {'id': id}) == null) throw notFound('Empresa não encontrada');
  }

  Map<String, Object?> _scheduleData(Map<String, Object?> input) {
    final type = input['type']! as String;
    final cyclic = cyclicTypes.contains(type);
    final days = (input['days']! as List).cast<Map<String, Object?>>();
    return {
      'name': input['name'], 'code': input['code'], 'type': type, 'cycleDays': cyclic ? input['cycleDays'] : null,
      'considerHolidays': input['considerHolidays'], 'inItinereMinutes': input['inItinereMinutes'], 'entryMobilityMinutes': input['entryMobilityMinutes'],
      'breakMobilityMinutes': input['breakMobilityMinutes'], 'ruleSetId': input['ruleSetId'], 'weeklyMinutes': _weeklyMinutes(type, input['cycleDays'] as int?, days),
      if (input['active'] != null) 'active': input['active'],
    };
  }

  Future<void> _insertDays(Tx tx, String tenantId, String scheduleId, List<Map<String, Object?>> days) async {
    for (final d in days) {
      final work = d['isWorkday'] == true;
      await tx.insert('work_schedule_days', {
        'tenantId': tenantId, 'scheduleId': scheduleId, 'dayIndex': d['dayIndex'], 'isWorkday': work,
        'startTime': work ? d['startTime'] : null, 'endTime': work ? d['endTime'] : null, 'breakMinutes': work ? d['breakMinutes'] : 0,
        'breakStart': work ? d['breakStart'] : null, 'expectedMinutes': _expected(d),
      });
    }
  }

  static const _scheduleConflict = 'Já existe um horário com este nome ou código nesta empresa';

  void routes() {
    final r = app.router;
    final companyQuery = Obj({'companyId': uuid});

    r.group('/v1/work-schedules', tag: 'jornadas', () {
      r.get('', permission: 'schedules.timetables:read', (ctx) {
        final q = companyQuery.parse(ctx.query);
        return db.forTenant(ctx.tenant, (tx) async {
          await _requireCompany(tx, q['companyId']);
          final rows = await tx.query('SELECT *, type::text AS type FROM work_schedules WHERE company_id = @c AND deleted_at IS NULL ORDER BY name ASC', {'c': q['companyId']});
          return [for (final s in rows) {...await _withDays(tx, s), 'inUse': await _inUse(tx, s['id']! as String)}];
        });
      });

      r.get('/:id', permission: 'schedules.timetables:read', (ctx) {
        final id = ctx.uuidParam('id');
        return db.forTenant(ctx.tenant, (tx) async => {...await _schedule(tx, id), 'inUse': await _inUse(tx, id)});
      });

      r.get('/:id/preview', permission: 'schedules.timetables:read', (ctx) {
        final id = ctx.uuidParam('id');
        final q = Obj({'from': date, 'cycleStart': date.optional, 'days': const Num(int: true, coerce: true, min: 1, max: 62).def(14)}).parse(ctx.query);
        return db.forTenant(ctx.tenant, (tx) async {
          final s = await _schedule(tx, id);
          final from = q['from']! as String;
          final a = core.ScheduleAssignment(schedule: toEngineSchedule(s, (s['days']! as List).cast<Row>()), validFrom: from, cycleStart: q['cycleStart'] as String? ?? from);
          return [for (final d in daysBetween(from, dateAdd(from, (q['days']! as int) - 1))) viewDay(core.resolveExpectedDay(a, d))];
        });
      });

      r.post('', permission: 'schedules.timetables:manage', (ctx) async {
        final input = scheduleCreate.parse(ctx.body);
        final tenantId = ctx.tenant;
        try {
          return await db.forTenant(tenantId, (tx) async {
            await _requireCompany(tx, input['companyId']);
            await _checkRuleSet(tx, input['companyId']! as String, input['ruleSetId']);
            final s = await tx.insert('work_schedules', {'tenantId': tenantId, 'companyId': input['companyId'], ..._scheduleData(input)});
            await _insertDays(tx, tenantId, s['id']! as String, (input['days']! as List).cast<Map<String, Object?>>());
            final full = await _schedule(tx, s['id']! as String);
            await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: 'work_schedule', entityId: s['id'] as String?, after: full, meta: ctx.meta);
            return {...full, 'inUse': 0};
          });
        } on DbError catch (e) {
          if (e.uniqueViolation) throw conflict(_scheduleConflict);
          rethrow;
        }
      });

      r.patch('/:id', permission: 'schedules.timetables:manage', (ctx) async {
        final id = ctx.uuidParam('id');
        final input = scheduleUpdate.parse(ctx.body);
        final tenantId = ctx.tenant;
        try {
          return await db.forTenant(tenantId, (tx) async {
            final before = await _schedule(tx, id);
            await _checkRuleSet(tx, before['companyId']! as String, input['ruleSetId']);
            // Mudar um horário em uso muda a jornada de quem o usa: o período fechado protege a apuração conferida.
            if (await _inUse(tx, id) > 0) await assertOpenPeriod(tx, [before['companyId']! as String], todayUtc(), todayUtc());
            await tx.execute('DELETE FROM work_schedule_days WHERE schedule_id = @id', {'id': id});
            await tx.update('work_schedules', id, _scheduleData(input));
            await _insertDays(tx, tenantId, id, (input['days']! as List).cast<Map<String, Object?>>());
            final after = await _schedule(tx, id);
            await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'work_schedule', entityId: id, before: before, after: after, meta: ctx.meta);
            return {...after, 'inUse': await _inUse(tx, id)};
          });
        } on DbError catch (e) {
          if (e.uniqueViolation) throw conflict(_scheduleConflict);
          rethrow;
        }
      });

      r.delete('/:id', permission: 'schedules.timetables:manage', status: 204, (ctx) {
        final id = ctx.uuidParam('id');
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final before = await _schedule(tx, id);
          final used = await _inUse(tx, id);
          if (used > 0) throw conflict('Horário em uso por $used funcionário(s): atribua outro horário antes ou desative');
          await tx.update('work_schedules', id, {'deletedAt': DateTime.now()});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'work_schedule', entityId: id, before: before, meta: ctx.meta);
          return null;
        });
      });
    });

    // ------------------------------------------------------------------ regras de apuração
    Future<Row> ruleSet(Tx tx, String id) async {
      final x = await tx.one('SELECT * FROM attendance_rule_sets WHERE id = @id AND deleted_at IS NULL', {'id': id});
      if (x == null) throw notFound('Regra de apuração não encontrada');
      return x;
    }

    Future<int> ruleUsage(Tx tx, String id) async =>
        (await tx.scalar<int>('SELECT (SELECT count(*) FROM work_schedules WHERE rule_set_id = @id AND deleted_at IS NULL) + '
            '(SELECT count(*) FROM employment_relationships WHERE rule_set_id = @id AND deleted_at IS NULL)', {'id': id}) as num?)?.toInt() ?? 0;

    r.group('/v1/rule-sets', tag: 'jornadas', () {
      r.get('', permission: 'schedules.timetables:read', (ctx) {
        final q = companyQuery.parse(ctx.query);
        return db.forTenant(ctx.tenant, (tx) async {
          await _requireCompany(tx, q['companyId']);
          final rows = await tx.query('SELECT * FROM attendance_rule_sets WHERE company_id = @c AND deleted_at IS NULL ORDER BY is_default DESC, name ASC', {'c': q['companyId']});
          return [for (final x in rows) {...x, 'inUse': await ruleUsage(tx, x['id']! as String)}];
        });
      });

      r.post('', permission: 'schedules.timetables:manage', (ctx) {
        final input = _ruleSetCreate.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await _requireCompany(tx, input['companyId']);
          final first = (await tx.scalar<int>('SELECT count(*)::int FROM attendance_rule_sets WHERE company_id = @c AND deleted_at IS NULL', {'c': input['companyId']}) ?? 0) == 0;
          final isDefault = input['isDefault'] == true || first;
          if (isDefault) await tx.execute('UPDATE attendance_rule_sets SET is_default = false, updated_at = now() WHERE company_id = @c', {'c': input['companyId']});
          final x = await tx.insert('attendance_rule_sets', {'tenantId': tenantId, 'companyId': input['companyId'], 'name': input['name'], 'isDefault': isDefault, 'rules': jsonb(input['rules'])});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: 'attendance_rule_set', entityId: x['id'] as String?, after: x, meta: ctx.meta);
          return {...x, 'inUse': 0};
        });
      });

      r.patch('/:id', permission: 'schedules.timetables:manage', (ctx) {
        final id = ctx.uuidParam('id');
        final input = _ruleSetUpdate.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final before = await ruleSet(tx, id);
          if (input['isDefault'] == false && before['isDefault'] == true) throw badRequest('Escolha outra regra como padrão em vez de desmarcar esta');
          if (input['isDefault'] == true) {
            await tx.execute('UPDATE attendance_rule_sets SET is_default = false, updated_at = now() WHERE company_id = @c AND id <> @id', {'c': before['companyId'], 'id': id});
          }
          final x = await tx.update('attendance_rule_sets', id, {
            if (input['name'] != null) 'name': input['name'], if (input['isDefault'] != null) 'isDefault': input['isDefault'],
            if (input['rules'] != null) 'rules': jsonb(input['rules']),
          });
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'attendance_rule_set', entityId: id, before: before, after: x, meta: ctx.meta);
          return {...?x, 'inUse': await ruleUsage(tx, id)};
        });
      });

      r.delete('/:id', permission: 'schedules.timetables:manage', status: 204, (ctx) {
        final id = ctx.uuidParam('id');
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final before = await ruleSet(tx, id);
          final used = await ruleUsage(tx, id);
          if (used > 0) throw conflict('Regra em uso por $used horário(s) ou funcionário(s)');
          if (before['isDefault'] == true) throw conflict('Não dá para excluir a regra padrão: escolha outra como padrão antes');
          await tx.update('attendance_rule_sets', id, {'deletedAt': DateTime.now()});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'attendance_rule_set', entityId: id, before: before, meta: ctx.meta);
          return null;
        });
      });
    });

    // ------------------------------------------------------------------ atribuições
    r.group('/v1/schedule-assignments', tag: 'jornadas', () {
      r.get('', permission: 'schedules.schedules:read', (ctx) {
        final q = Obj({'employmentId': uuid}).parse(ctx.query);
        return db.forTenant(ctx.tenant, (tx) async {
          if (await tx.one('SELECT 1 FROM employment_relationships WHERE id = @id AND deleted_at IS NULL', {'id': q['employmentId']}) == null) {
            throw notFound('Funcionário não encontrado');
          }
          final rows = await tx.query(
            'SELECT a.*, s.name AS s_name, s.code AS s_code, s.type::text AS s_type, s.weekly_minutes AS s_weekly_minutes '
            'FROM schedule_assignments a JOIN work_schedules s ON s.id = a.schedule_id WHERE a.employment_id = @e ORDER BY a.valid_from DESC',
            {'e': q['employmentId']},
          );
          return [
            for (final a in rows)
              {
                for (final e in a.entries) if (!e.key.startsWith('s') || !RegExp('^s[A-Z]').hasMatch(e.key)) e.key: e.value,
                'validFrom': isoDay(a['validFrom']), 'validTo': a['validTo'] == null ? null : isoDay(a['validTo']),
                'cycleStart': a['cycleStart'] == null ? null : isoDay(a['cycleStart']),
                'schedule': {'id': a['scheduleId'], 'name': a['sName'], 'code': a['sCode'], 'type': a['sType'], 'weeklyMinutes': a['sWeeklyMinutes']},
              },
          ];
        });
      });

      // Atribui a partir de uma data: a vigência anterior termina na véspera; atribuições futuras são substituídas.
      r.post('', permission: 'schedules.schedules:manage', (ctx) {
        final input = _assign.parse(ctx.body);
        final user = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final schedule = await tx.one('SELECT * FROM work_schedules WHERE id = @id AND deleted_at IS NULL', {'id': input['scheduleId']});
          if (schedule == null) throw notFound('Horário não encontrado');
          if (schedule['active'] != true) throw badRequest('Horário desativado: ative antes de atribuir');
          final ids = (input['employmentIds']! as List).cast<String>().toSet().toList();
          final emps = await tx.query('SELECT id, company_id, registration, status::text AS status, terminated_at FROM employment_relationships WHERE id::text = ANY(@ids) AND deleted_at IS NULL', {'ids': ids});
          if (emps.length != ids.length) throw notFound('Funcionário não encontrado');
          final validFrom = input['validFrom']! as String;
          final other = emps.where((e) => e['companyId'] != schedule['companyId']).firstOrNull;
          if (other != null) throw badRequest('O horário é de outra empresa (matrícula ${other['registration']})');
          final off = emps.where((e) => e['status'] == 'TERMINATED' && e['terminatedAt'] != null && isoDay(e['terminatedAt']).compareTo(validFrom) < 0).firstOrNull;
          if (off != null) throw badRequest('Matrícula ${off['registration']} desligada antes da vigência');
          await assertOpenPeriod(tx, [schedule['companyId']! as String], validFrom, validFrom);
          final eve = dateAdd(validFrom, -1);
          for (final e in emps) {
            final replaced = await tx.query('DELETE FROM schedule_assignments WHERE employment_id = @e AND valid_from >= @f RETURNING id', {'e': e['id'], 'f': validFrom});
            await tx.execute('UPDATE schedule_assignments SET valid_to = @eve WHERE employment_id = @e AND valid_from < @f AND (valid_to IS NULL OR valid_to >= @f)',
                {'e': e['id'], 'f': validFrom, 'eve': eve});
            final a = await tx.insert('schedule_assignments', {
              'tenantId': tenantId, 'employmentId': e['id'], 'scheduleId': schedule['id'], 'validFrom': validFrom, 'cycleStart': input['cycleStart'] ?? validFrom,
            });
            await tx.insert('employment_history', {
              'tenantId': tenantId, 'employmentId': e['id'], 'field': 'schedule', 'newValue': jsonb(schedule['name']), 'effectiveAt': validFrom,
              'reason': 'Atribuição de horário', 'actorUserId': user.id,
            });
            await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'CREATE', entity: 'schedule_assignment', entityId: a['id'] as String?,
                after: {...a, 'replaced': [for (final x in replaced) x['id']]}, meta: ctx.meta);
          }
          return {'assigned': emps.length};
        });
      });

      // Desfaz a atribuição mais recente; a anterior volta a valer sem data final.
      r.delete('/:id', permission: 'schedules.schedules:manage', status: 204, (ctx) {
        final id = ctx.uuidParam('id');
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final a = await tx.one('SELECT a.*, e.company_id AS e_company_id FROM schedule_assignments a JOIN employment_relationships e ON e.id = a.employment_id WHERE a.id = @id', {'id': id});
          if (a == null) throw notFound('Atribuição não encontrada');
          final latest = await tx.scalar<String>('SELECT id FROM schedule_assignments WHERE employment_id = @e ORDER BY valid_from DESC LIMIT 1', {'e': a['employmentId']});
          if (latest != id) throw conflict('Só a atribuição mais recente pode ser desfeita');
          final vf = isoDay(a['validFrom']), today = todayUtc();
          await assertOpenPeriod(tx, [a['eCompanyId']! as String], vf, today.compareTo(vf) > 0 ? today : vf);
          await tx.execute('DELETE FROM schedule_assignments WHERE id = @id', {'id': id});
          final prev = await tx.scalar<String>('SELECT id FROM schedule_assignments WHERE employment_id = @e ORDER BY valid_from DESC LIMIT 1', {'e': a['employmentId']});
          if (prev != null) await tx.execute('UPDATE schedule_assignments SET valid_to = NULL WHERE id = @id', {'id': prev});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'schedule_assignment', entityId: id, before: a, meta: ctx.meta);
          return null;
        });
      });
    });

    // ------------------------------------------------------------------ escala agendada e trocas
    r.group('/v1/schedule-overrides', tag: 'jornadas', () {
      r.get('', permission: 'schedules.schedules:read', (ctx) {
        final q = rangeSchema(93, 'Período de até 93 dias').extend({'employmentId': uuid.optional, 'companyId': uuid.optional}).parse(ctx.query);
        return db.forTenant(ctx.tenant, (tx) async {
          final rows = await tx.query(
            'SELECT o.*, e.registration AS e_registration, p.full_name AS e_full_name, p.social_name AS e_social_name FROM schedule_overrides o '
            'JOIN employment_relationships e ON e.id = o.employment_id JOIN people p ON p.id = e.person_id '
            'WHERE o.date BETWEEN @from AND @to${q['employmentId'] != null ? ' AND o.employment_id = @emp' : ''}${q['companyId'] != null ? ' AND e.company_id = @co' : ''} '
            'ORDER BY o.date ASC LIMIT 2000',
            {'from': q['from'], 'to': q['to'], 'emp': q['employmentId'], 'co': q['companyId']},
          );
          return [
            for (final o in rows)
              {
                for (final e in o.entries) if (!RegExp('^e[A-Z]').hasMatch(e.key)) e.key: e.value,
                'date': isoDay(o['date']),
                'employment': {'id': o['employmentId'], 'registration': o['eRegistration'], 'name': o['eSocialName'] ?? o['eFullName']},
              },
          ];
        });
      });

      // Lança trabalho/folga por dia para vários funcionários (substitui o lançamento anterior do mesmo dia).
      r.post('', permission: 'schedules.scheduled:manage', (ctx) {
        final input = _override.parse(ctx.body);
        final weekdays = (input['weekdays'] as List?)?.cast<int>() ?? const [];
        final dates = [
          for (final d in daysBetween(input['from']! as String, input['to']! as String))
            if (weekdays.isEmpty || weekdays.contains(core.weekday(d))) d,
        ];
        if (dates.isEmpty) throw badRequest('Nenhum dia do período corresponde aos dias da semana escolhidos');
        final ids = (input['employmentIds']! as List).cast<String>().toSet().toList();
        if (dates.length * ids.length > 20000) throw badRequest('Lançamento grande demais: até 20.000 dias por vez');
        final user = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final emps = await tx.query('SELECT id, company_id FROM employment_relationships WHERE id::text = ANY(@ids) AND deleted_at IS NULL', {'ids': ids});
          if (emps.length != ids.length) throw notFound('Funcionário não encontrado');
          await assertOpenPeriod(tx, {for (final e in emps) e['companyId']! as String}.toList(), dates.first, dates.last);
          final work = input['isWorkday'] == true;
          final plan = {
            'isWorkday': work, 'startTime': work ? input['startTime'] : null, 'endTime': work ? input['endTime'] : null,
            'breakMinutes': work ? input['breakMinutes'] : 0, 'breakStart': work ? input['breakStart'] : null, 'note': input['note'],
          };
          await tx.execute('DELETE FROM schedule_overrides WHERE employment_id::text = ANY(@ids) AND date::text = ANY(@d)', {'ids': ids, 'd': dates});
          final n = await tx.execute(
            'INSERT INTO schedule_overrides (id, tenant_id, employment_id, date, is_workday, start_time, end_time, break_minutes, break_start, note, origin, created_by_id) '
            "SELECT gen_random_uuid(), @t, e::uuid, d::date, @w, @st, @en, @bm, @bs, @note, 'AGENDADA', @u FROM unnest(@ids::text[]) AS e CROSS JOIN unnest(@d::text[]) AS d",
            {'t': tenantId, 'ids': ids, 'd': dates, 'w': work, 'st': plan['startTime'], 'en': plan['endTime'], 'bm': plan['breakMinutes'], 'bs': plan['breakStart'], 'note': plan['note'], 'u': user.id},
          );
          await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'CREATE', entity: 'schedule_override',
              after: {'employments': ids.length, 'from': dates.first, 'to': dates.last, 'days': dates.length, ...plan}, meta: ctx.meta);
          return {'created': n};
        });
      });

      r.post('/swap', permission: 'schedules.scheduled:manage', status: 200, (ctx) async {
        final kind = ctx.json['kind'];
        final input = kind == 'DAY_OFF' ? _swapDayOff.parse(ctx.body) : kind == 'SHIFT' ? _swapShift.parse(ctx.body) : throw badRequest(['kind: Invalid input']);
        final user = ctx.user, tenantId = ctx.tenant;
        final shift = kind == 'SHIFT';
        final ids = shift ? [input['employmentIdA']! as String, input['employmentIdB']! as String] : [input['employmentId']! as String];
        if (shift && ids[0] == ids[1]) throw badRequest('Escolha dois funcionários diferentes');
        if (!shift && input['workDate'] == input['offDate']) throw badRequest('Escolha dois dias diferentes');
        final emps = await db.forTenant(tenantId, (tx) => tx.query('SELECT id, company_id FROM employment_relationships WHERE id::text = ANY(@ids) AND deleted_at IS NULL', {'ids': ids}));
        if (emps.length != ids.length) throw notFound('Funcionário não encontrado');
        if ({for (final e in emps) e['companyId']}.length > 1) throw badRequest('A troca precisa ser entre funcionários da mesma empresa');
        final companyId = emps.first['companyId']! as String;
        final dates = shift ? [input['date']! as String] : ([input['workDate']! as String, input['offDate']! as String]..sort());
        final hol = await holidayMap(tenantId, [companyId], dates.first, dates.last);
        return db.forTenant(tenantId, (tx) async {
          await assertOpenPeriod(tx, [companyId], dates.first, dates.last);
          final plan = await compute(tx, [for (final e in emps) (id: e['id']! as String, companyId: companyId)], dates.first, dates.last, hol);
          Map<String, Object?> pick(String emp, String d) => plan[emp]!.firstWhere((x) => x['date'] == d);
          Future<void> write(String employmentId, String d, Map<String, Object?> p) async {
            final work = p['isWorkday'] == true;
            await tx.execute('DELETE FROM schedule_overrides WHERE employment_id = @e AND date = @d', {'e': employmentId, 'd': d});
            await tx.insert('schedule_overrides', {
              'tenantId': tenantId, 'employmentId': employmentId, 'date': d, 'isWorkday': work && p['flexible'] != true && p['start'] != null,
              'startTime': work ? p['start'] : null, 'endTime': work ? p['end'] : null, 'breakMinutes': work ? p['breakMinutes'] : 0,
              'breakStart': work ? p['breakStart'] : null, 'origin': 'TROCA', 'note': input['note'], 'createdById': user.id,
            });
          }

          if (shift) {
            final d = input['date']! as String;
            final a = pick(ids[0], d), b = pick(ids[1], d);
            if (a['isWorkday'] == b['isWorkday'] && a['start'] == b['start'] && a['end'] == b['end']) throw badRequest('Os dois têm a mesma escala neste dia: não há o que trocar');
            if ((a['isWorkday'] == true && a['flexible'] == true) || (b['isWorkday'] == true && b['flexible'] == true)) {
              throw badRequest('Troca de escala só entre jornadas com horário definido');
            }
            await write(ids[0], d, b);
            await write(ids[1], d, a);
          } else {
            final wd = input['workDate']! as String, od = input['offDate']! as String;
            final work = pick(ids[0], wd), off = pick(ids[0], od);
            if (work['isWorkday'] != true || work['start'] == null) throw badRequest('O dia de trabalho escolhido não tem jornada com horário');
            if (off['isWorkday'] == true) throw badRequest('O dia escolhido para trabalhar já é dia de trabalho: escolha uma folga');
            await write(ids[0], od, work);
            await write(ids[0], wd, off);
          }
          await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'CREATE', entity: 'schedule_swap', after: input, meta: ctx.meta);
          return {'ok': true};
        });
      });

      r.delete('/:id', permission: 'schedules.scheduled:manage', status: 204, (ctx) {
        final id = ctx.uuidParam('id');
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final o = await tx.one('SELECT o.*, e.company_id AS e_company_id FROM schedule_overrides o JOIN employment_relationships e ON e.id = o.employment_id WHERE o.id = @id', {'id': id});
          if (o == null) throw notFound('Lançamento não encontrado');
          await assertOpenPeriod(tx, [o['eCompanyId']! as String], isoDay(o['date']), isoDay(o['date']));
          await tx.execute('DELETE FROM schedule_overrides WHERE id = @id', {'id': id});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'schedule_override', entityId: id, before: o, meta: ctx.meta);
          return null;
        });
      });
    });

    // ------------------------------------------------------------------ previsão
    r.get('/v1/employees/:id/expected', permission: 'schedules.schedules:read', (ctx) async {
      final id = ctx.uuidParam('id');
      final q = rangeSchema(93, 'Período de até 93 dias').parse(ctx.query);
      final tenantId = ctx.tenant;
      final from = q['from']! as String, to = q['to']! as String;
      final emp = await db.forTenant(tenantId, (tx) => tx.one('SELECT id, company_id FROM employment_relationships WHERE id = @id AND deleted_at IS NULL', {'id': id}));
      if (emp == null) throw notFound('Funcionário não encontrado');
      final companyId = emp['companyId']! as String;
      final hol = await holidayMap(tenantId, [companyId], from, to);
      final days = await db.forTenant(tenantId, (tx) => compute(tx, [(id: id, companyId: companyId)], from, to, hol));
      final list = days[id]!;
      return {'employmentId': id, 'from': from, 'to': to, 'days': list, 'expectedMinutes': list.fold<int>(0, (s, d) => s + (d['expectedMinutes']! as int))};
    });

    r.get('/v1/schedule-grid', permission: 'schedules.schedules:read', (ctx) async {
      final q = Obj({
        'companyId': uuid, 'from': date, 'to': date, 'departmentId': uuid.optional, 'groupingId': uuid.optional, 'search': const Str(trim: true, max: 100).optional,
      }).check((v) => (v['to']! as String).compareTo(v['from']! as String) >= 0 && _diffDays(v['from']! as String, v['to']! as String) <= 41, 'Período de até 42 dias', path: ['to']).parse(ctx.query);
      final tenantId = ctx.tenant;
      final from = q['from']! as String, to = q['to']! as String;
      final s = q['search'] as String?;
      final emps = await db.forTenant(tenantId, (tx) => tx.query(
            'SELECT e.id, e.company_id, e.registration, p.full_name, p.social_name FROM employment_relationships e JOIN people p ON p.id = e.person_id '
            "WHERE e.company_id = @co AND e.deleted_at IS NULL AND e.status <> 'TERMINATED'"
            '${q['departmentId'] != null ? ' AND e.department_id = @dep' : ''}'
            '${q['groupingId'] != null ? ' AND EXISTS (SELECT 1 FROM grouping_employments g WHERE g.employment_id = e.id AND g.grouping_id = @g)' : ''}'
            '${s != null && s.isNotEmpty ? ' AND (e.registration ILIKE @s OR p.full_name ILIKE @s)' : ''} ORDER BY p.full_name ASC LIMIT 300',
            {'co': q['companyId'], 'dep': q['departmentId'], 'g': q['groupingId'], 's': s == null ? null : likePattern(s)},
          ));
      final hol = await holidayMap(tenantId, [q['companyId']! as String], from, to);
      final days = await db.forTenant(tenantId, (tx) => compute(tx, [for (final e in emps) (id: e['id']! as String, companyId: e['companyId']! as String)], from, to, hol));
      return {
        'from': from, 'to': to, 'truncated': emps.length == 300,
        'rows': [for (final e in emps) {'employmentId': e['id'], 'registration': e['registration'], 'name': e['socialName'] ?? e['fullName'], 'days': days[e['id']]}],
      };
    });
  }
}

/// Exige a permissão (usada por outros módulos que reaproveitam a previsão).
bool canReadSchedules(AuthUser u) => can(u, 'schedules.schedules:read');
