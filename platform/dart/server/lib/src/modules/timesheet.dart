// Ponto: espelho, espelho diário, cálculo, ajustes, abonos, afastamentos, sobreaviso, fechamento, marcação web (REP-P),
// banco de horas e de compensação, fluxos de aprovação e solicitações, AFD do REP-P e AEJ.
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:crypto/crypto.dart' as c;
import 'package:sp_core/sp_core.dart' as core;

import 'package:shelf/shelf.dart' show Request;

import '../app.dart';
import '../auth/auth_user.dart';
import '../crypto/openssl.dart' show randomBytes;
import '../crypto/tokens.dart' show b64url, b64urlDecode, safeEqual, sha256Hex;
import '../db.dart';
import '../http.dart';
import '../validate.dart';
import 'schedules.dart';
import 'structure.dart' show Catalog, catalogRoutes;
import 'timesheet_core.dart';

final _hm = Str(pattern: RegExp(r'^([01]\d|2[0-3]):[0-5]\d$'), patternMessage: 'Horário no formato HH:mm');
int _days(String a, String b) => DateTime.parse('${b}T00:00:00Z').difference(DateTime.parse('${a}T00:00:00Z')).inDays;
Obj _period(Map<String, S> extra, int max, String message, {String from = 'from', String to = 'to'}) => Obj({from: date, to: date, ...extra})
    .check((v) => (v[to]! as String).compareTo(v[from]! as String) >= 0 && _days(v[from]! as String, v[to]! as String) <= max - 1, message, path: [to]);

final _mirror = _period({'employmentId': uuid}, 63, 'Período de até 63 dias');
final _periodQ = _period({'employmentId': uuid.optional}, 63, 'Período de até 63 dias');
final _daily = Obj({'companyId': uuid, 'date': date, 'departmentId': uuid.optional, 'groupingId': uuid.optional});
final _calculate = _period({'companyId': uuid, 'employmentIds': const Arr(uuid, max: 2000).optional}, 63, 'Período de até 63 dias');
const _justification5 = Str(trim: true, min: 5, max: 300, message: 'Justifique com pelo menos 5 caracteres');
final _adjInclude = Obj({'kind': const Literal('INCLUDE'), 'employmentId': uuid, 'date': date, 'time': _hm, 'justification': _justification5});
final _adjDisregard = Obj({'kind': const Literal('DISREGARD'), 'employmentId': uuid, 'timeRecordId': uuid, 'justification': _justification5});
final _decide = Obj({'approve': const Bool(), 'comment': const Str(trim: true, max: 300).optional});
final justificationSchema = Obj({
  'code': const Str(trim: true, min: 1, max: 20).optional,
  'name': const Str(trim: true, min: 3, max: 120),
  'disregardsDebits': const AnyS().map((v) => v == 'true' ? true : v == 'false' ? false : v).refine((v) => v is bool, 'Invalid input').def(true),
  'usageLimit': const Num(int: true, coerce: true, min: 1, max: 366).nullish,
  'limitPeriod': const Enum(['MONTH', 'YEAR']).def('MONTH'),
  'active': const Bool().optional,
});
final _allowance = Obj({
  'employmentIds': const Arr(uuid, min: 1, max: 500),
  'from': date, 'to': date,
  'justificationId': uuid,
  'fullDay': const Bool().def(true),
  'minutes': const Num(int: true, min: 1, max: 1440).optional,
  'onlyWorkdays': const Bool().def(true),
  'note': const Str(trim: true, max: 300).optional,
}).superRefine((v, add) {
  if ((v['to']! as String).compareTo(v['from']! as String) < 0) add('A data final deve ser igual ou posterior à inicial', ['to']);
  if (_days(v['from']! as String, v['to']! as String) > 92) add('Período máximo de 93 dias por lançamento', ['to']);
  if (v['fullDay'] != true && v['minutes'] == null) add('Informe os minutos abonados', ['minutes']);
});
const leaveTypes = ['MEDICAL', 'VACATION', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNPAID', 'SUSPENSION', 'OTHER'];
final _leave = Obj({
  'employmentId': uuid, 'type': const Enum(leaveTypes), 'startDate': date, 'endDate': date,
  'justificationId': uuid.optional, 'note': const Str(trim: true, max: 300).optional,
}).check((v) => (v['endDate']! as String).compareTo(v['startDate']! as String) >= 0 && _days(v['startDate']! as String, v['endDate']! as String) <= 730,
    'Período inválido (fim antes do início ou acima de 2 anos)', path: ['endDate']);
final _onCall = Obj({'employmentIds': const Arr(uuid, min: 1, max: 200), 'date': date, 'startTime': _hm, 'endTime': _hm, 'note': const Str(trim: true, max: 300).optional})
    .check((v) => v['startTime'] != v['endTime'], 'Início e fim iguais', path: ['endTime']);
final _listRange = _period({'companyId': uuid.optional, 'employmentId': uuid.optional}, 367, 'Período de até 1 ano');
final _closing = _period({'companyId': uuid}, 63, 'Período de até 63 dias', from: 'periodStart', to: 'periodEnd');
final _reopen = Obj({'reason': const Str(trim: true, min: 5, max: 300, message: 'Informe o motivo da reabertura')});
final _punch = Obj({
  'token': const Str(min: 20, max: 500),
  'employmentId': uuid.optional,
  'latitude': const Num(min: -90, max: 90).optional,
  'longitude': const Num(min: -180, max: 180).optional,
  'accuracy': const Num(int: true, min: 0, max: 100000).optional,
  'appDeviceToken': Str(pattern: RegExp(r'^spa_[A-Za-z0-9_-]{20,80}$')).optional,
});
final _bankPolicy = Obj({
  'companyId': uuid,
  'enabled': const Bool(),
  'expirationDays': const Num(int: true, min: 1, max: 730).nullable,
  'maxDailyCreditMinutes': const Num(int: true, min: 1, max: 720).nullish,
  'creditMultipliers': const Rec(Num(min: 1, max: 3)).refine((v) => (v as Map).keys.every((k) => RegExp(r'^\d{1,3}$').hasMatch(k as String)), 'Invalid key').def(<String, Object?>{}),
  'compensationEnabled': const Bool().def(false),
  'compensationPeriod': const Enum(['WEEK', 'MONTH']).def('WEEK'),
  'compensationLeftover': const Enum(['BANK', 'PAY']).def('BANK'),
});
final _bankTx = Obj({
  'employmentIds': const Arr(uuid, min: 1, max: 500),
  'type': const Enum(['ADJUSTMENT', 'PAYOUT', 'COMPENSATION']),
  'minutes': const Num(int: true, min: -100000, max: 100000).refine((v) => v != 0, 'Informe os minutos'),
  'refDate': date,
  'description': const Str(trim: true, min: 3, max: 300, message: 'Descreva o lançamento'),
});
final _bankReset = Obj({
  'companyId': uuid, 'employmentIds': const Arr(uuid, max: 5000).optional, 'refDate': date,
  'type': const Enum(['PAYOUT', 'ADJUSTMENT']), 'description': const Str(trim: true, min: 3, max: 300),
  'only': const Enum(['POSITIVE', 'NEGATIVE', 'ALL']).def('ALL'),
});
const requestTypes = ['RECORD_CORRECTION', 'ABSENCE_JUSTIFICATION', 'SCHEDULE_CHANGE', 'OVERTIME_AUTHORIZATION', 'OTHER'];
const _typeLabel = {
  'RECORD_CORRECTION': 'Inclusão de marcação', 'ABSENCE_JUSTIFICATION': 'Justificativa de falta/atraso', 'SCHEDULE_CHANGE': 'Troca de folga',
  'OVERTIME_AUTHORIZATION': 'Autorização de hora extra', 'OTHER': 'Outro pedido',
};
final _step = Obj({'label': const Str(trim: true, min: 2, max: 60), 'approver': const Enum(['SUPERVISOR', 'ROLE', 'PERMISSION']), 'roleId': uuid.optional})
    .check((s) => s['approver'] != 'ROLE' || s['roleId'] != null, 'Escolha o perfil que aprova', path: ['roleId']);
final _flow = Obj({'companyId': uuid, 'requestType': const Enum(requestTypes), 'steps': Arr(_step, min: 1, max: 5), 'isActive': const Bool().def(true)});
const _reqJust = Str(trim: true, min: 5, max: 500);
final _requestSchemas = {
  'RECORD_CORRECTION': Obj({'type': const Literal('RECORD_CORRECTION'), 'employmentId': uuid.optional, 'refDate': date, 'payload': Obj({'time': _hm}), 'justification': _reqJust}),
  'ABSENCE_JUSTIFICATION': Obj({
    'type': const Literal('ABSENCE_JUSTIFICATION'), 'employmentId': uuid.optional, 'refDate': date,
    'payload': Obj({'justificationId': uuid, 'fullDay': const Bool().def(true), 'minutes': const Num(int: true, min: 1, max: 1440).optional}), 'justification': _reqJust,
  }),
  'SCHEDULE_CHANGE': Obj({'type': const Literal('SCHEDULE_CHANGE'), 'employmentId': uuid.optional, 'refDate': date, 'payload': Obj({'offDate': date}), 'justification': _reqJust}),
  'OVERTIME_AUTHORIZATION': Obj({
    'type': const Literal('OVERTIME_AUTHORIZATION'), 'employmentId': uuid.optional, 'refDate': date,
    'payload': Obj({'maxMinutes': const Num(int: true, min: 1, max: 720)}), 'justification': _reqJust,
  }),
  'OTHER': Obj({'type': const Literal('OTHER'), 'employmentId': uuid.optional, 'refDate': date.optional, 'payload': Obj({'subject': const Str(trim: true, min: 3, max: 120)}), 'justification': _reqJust}),
};
final _requestDecision = Obj({'decision': const Enum(['APPROVED', 'REJECTED']), 'comment': const Str(trim: true, max: 500).optional})
    .check((v) => v['decision'] == 'APPROVED' || ((v['comment'] as String?)?.length ?? 0) >= 3, 'Explique o motivo da recusa', path: ['comment']);
const _defaultSteps = [{'label': 'Aprovação', 'approver': 'PERMISSION'}];
final _repPSettings = Obj({'companyId': uuid, 'inpiNumber': Str(pattern: RegExp(r'^\d{17}$'), patternMessage: 'Número do INPI com 17 dígitos').nullable});
final _repPAfd = Obj({'companyId': uuid, 'from': date, 'to': date}).check((v) => (v['to']! as String).compareTo(v['from']! as String) >= 0, 'Período inválido', path: ['to']);

int _span(String s, String e) {
  final a = int.parse(s.substring(0, 2)) * 60 + int.parse(s.substring(3));
  var b = int.parse(e.substring(0, 2)) * 60 + int.parse(e.substring(3));
  if (b <= a) b += 1440;
  return b - a;
}

/// Chave do período de compensação: segunda-feira da semana ou o mês.
String periodKey(String d, String period) {
  if (period == 'MONTH') return d.substring(0, 7);
  return core.addDays(d, -((core.weekday(d) + 6) % 7));
}

/// Banco de compensação: o líquido negativo vira débito; o positivo vai para o banco (BANK) ou é pago (PAY).
({List<Map<String, Object?>> periods, List<core.DayResult> toBank}) compensate(List<core.DayResult> days, String period, String leftover) {
  final groups = <String, List<core.DayResult>>{};
  for (final d in [...days]..sort((a, b) => a.date.compareTo(b.date))) {
    groups.putIfAbsent(periodKey(d.date, period), () => []).add(d);
  }
  final periods = [
    for (final e in groups.entries)
      () {
        final positive = e.value.fold<int>(0, (s, d) => s + math.max(0, d.balanceMinutes));
        final negative = e.value.fold<int>(0, (s, d) => s + math.min(0, d.balanceMinutes));
        final net = positive + negative;
        return <String, Object?>{
          'key': e.key, 'from': e.value.first.date, 'to': e.value.last.date, 'positive': positive, 'negative': negative, 'net': net,
          'toBank': net < 0 || leftover == 'BANK' ? net : 0, 'toPay': net > 0 && leftover == 'PAY' ? net : 0,
        };
      }(),
  ];
  return (
    periods: periods,
    toBank: [
      for (final p in periods)
        if (p['toBank'] != 0) core.DayResult(date: p['to']! as String, expectedMinutes: 0, balanceMinutes: p['toBank']! as int, flags: const []),
    ],
  );
}

/// Reconstrói o estado do banco (saldo e créditos em aberto, FIFO) a partir dos lançamentos.
core.BankState replay(List<Row> txs) {
  final state = core.BankState();
  final sorted = [...txs]..sort((a, b) => (a['refDate']! as DateTime).compareTo(b['refDate']! as DateTime));
  for (final t in sorted) {
    final m = t['minutes']! as int;
    state.balance += m;
    if (m > 0) {
      state.openCredits.add(core.OpenCredit(m, t['expiresOn'] == null ? null : isoDay(t['expiresOn'])));
    } else {
      var left = -m;
      for (final c in state.openCredits) {
        if (left == 0) break;
        final used = math.min(c.minutes, left);
        c.minutes -= used;
        left -= used;
      }
      state.openCredits = state.openCredits.where((c) => c.minutes > 0).toList();
    }
  }
  return state;
}

double _distanceM(double lat1, double lon1, double lat2, double lon2) {
  const r = 6371000.0;
  double rad(double x) => x * math.pi / 180;
  final dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  final h = math.pow(math.sin(dLat / 2), 2) + math.cos(rad(lat1)) * math.cos(rad(lat2)) * math.pow(math.sin(dLon / 2), 2);
  return 2 * r * math.asin(math.sqrt(h));
}

class TimesheetModule {
  TimesheetModule(this.app, this.schedules) : core0 = TimesheetCore(schedules);
  final App app;
  final SchedulesModule schedules;
  final TimesheetCore core0;
  Db get db => app.db;

  /// Vínculos do usuário logado (pela pessoa ligada ao usuário).
  Future<List<Row>> myEmployments(Tx tx, AuthUser user) async {
    if (user.personId == null) throw forbidden('Seu usuário não está ligado a um funcionário: peça ao RH para fazer o vínculo em Usuários');
    return tx.query(
      'SELECT e.id, e.company_id, e.rule_set_id, e.registration, e.status::text AS status, e.hired_at, e.terminated_at, p.full_name, p.social_name, '
      'u.latitude AS u_latitude, u.longitude AS u_longitude, u.geofence_m AS u_geofence_m, u.name AS u_name, '
      'c.legal_name AS c_legal_name, c.trade_name AS c_trade_name, c.cnpj AS c_cnpj '
      'FROM employment_relationships e JOIN people p ON p.id = e.person_id JOIN companies c ON c.id = e.company_id LEFT JOIN company_units u ON u.id = e.unit_id '
      "WHERE e.person_id = @p AND e.deleted_at IS NULL AND e.status <> 'TERMINATED'",
      {'p': user.personId},
    );
  }

  Future<Emp> _emp(String tenantId, String id) async {
    final list = await db.forTenant(tenantId, (tx) => loadEmps(tx, 'e.id = @id AND e.deleted_at IS NULL', {'id': id}));
    if (list.isEmpty) throw notFound('Funcionário não encontrado');
    return list.first;
  }

  Future<Map<String, Object?>> mirror(String tenantId, String employmentId, String from, String to) async {
    final e = await _emp(tenantId, employmentId);
    final days = (await core0.compute(tenantId, [e], from, to))[e.id]!;
    return {'employment': {'id': e.id, 'registration': e.registration, 'name': e.name, 'companyId': e.companyId}, 'from': from, 'to': to, 'days': days, 'summary': core0.summary(days)};
  }

  Future<List<Emp>> companyEmployments(Tx tx, String companyId, String from, String to, [List<String>? ids]) => loadEmps(
        tx,
        'e.company_id = @c AND e.deleted_at IS NULL AND e.hired_at <= @to AND (e.terminated_at IS NULL OR e.terminated_at >= @from)'
        '${ids != null && ids.isNotEmpty ? ' AND e.id::text = ANY(@ids)' : ''}',
        {'c': companyId, 'from': from, 'to': to, 'ids': ids},
      );

  // ------------------------------------------------------------------ ajustes
  Future<Row> createAdjustment(String tenantId, AuthUser user, Map<String, Object?> input, Map<String, Object?> meta, [String? requestId]) {
    final autoApprove = can(user, 'time.adjustments:approve') || requestId != null;
    return db.forTenant(tenantId, (tx) async {
      final e = await tx.one('SELECT id, company_id FROM employment_relationships WHERE id = @id AND deleted_at IS NULL', {'id': input['employmentId']});
      if (e == null) throw notFound('Funcionário não encontrado');
      DateTime? recordedAt;
      String date;
      if (input['kind'] == 'INCLUDE') {
        recordedAt = DateTime.parse('${input['date']}T${input['time']}:00-03:00').toUtc();
        if (recordedAt.isAfter(DateTime.now().add(const Duration(minutes: 1)))) throw badRequest('Não dá para incluir marcação no futuro');
        date = input['date']! as String;
      } else {
        final r = await tx.one('SELECT id, recorded_at FROM time_records WHERE id = @id AND employment_id = @e', {'id': input['timeRecordId'], 'e': e['id']});
        if (r == null) throw notFound('Marcação não encontrada');
        if (await tx.one("SELECT 1 FROM time_record_adjustments WHERE time_record_id = @r AND kind = 'DISREGARD' AND status IN ('PENDING', 'APPROVED')", {'r': r['id']}) != null) {
          throw conflict('Esta marcação já tem um pedido para desconsiderar');
        }
        date = localBr(r['recordedAt']! as DateTime).date;
      }
      await assertOpenPeriod(tx, [e['companyId']! as String], date, date);
      final a = await tx.insert('time_record_adjustments', {
        'tenantId': tenantId, 'employmentId': e['id'], 'kind': input['kind'], 'timeRecordId': input['kind'] == 'DISREGARD' ? input['timeRecordId'] : null,
        'recordedAt': recordedAt, 'justification': input['justification'], 'status': autoApprove ? 'APPROVED' : 'PENDING', 'createdById': user.id, 'requestId': requestId,
        if (autoApprove) 'decidedById': user.id, if (autoApprove) 'decidedAt': DateTime.now(),
      });
      await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'CREATE', entity: 'time_adjustment', entityId: a['id'] as String?, after: a, meta: meta);
      return a;
    });
  }

  // ------------------------------------------------------------------ abonos
  Future<Map<String, Object?>> createAllowances(String tenantId, AuthUser user, Map<String, Object?> input, Map<String, Object?> meta) async {
    final ids = (input['employmentIds']! as List).cast<String>().toSet().toList();
    final emps = await db.forTenant(tenantId, (tx) => tx.query('SELECT id, company_id, registration FROM employment_relationships WHERE id::text = ANY(@ids) AND deleted_at IS NULL', {'ids': ids}));
    if (emps.length != ids.length) throw notFound('Funcionário não encontrado');
    final from = input['from']! as String, to = input['to']! as String;
    final companies = {for (final e in emps) e['companyId']! as String}.toList();
    Map<String, List<PlannedDay>>? plan;
    if (input['onlyWorkdays'] == true) {
      final hol = await schedules.holidayMap(tenantId, companies, from, to);
      plan = await db.forTenant(tenantId, (tx) => schedules.computeEngine(tx, [for (final e in emps) (id: e['id']! as String, companyId: e['companyId']! as String)], from, to, hol));
    }
    return db.forTenant(tenantId, (tx) async {
      final j = await tx.one('SELECT * FROM justifications WHERE id = @id AND deleted_at IS NULL', {'id': input['justificationId']});
      if (j == null) throw notFound('Justificativa não encontrada');
      if (j['active'] != true) throw badRequest('Justificativa inativa');
      await assertOpenPeriod(tx, companies, from, to);
      final all = daysBetween(from, to).toList();
      final rows = <({String employmentId, String date})>[];
      for (final e in emps) {
        final eid = e['id']! as String;
        final dates = plan == null ? all : [for (var i = 0; i < all.length; i++) if (plan[eid]![i].engine.isWorkday) all[i]];
        final limit = j['usageLimit'] as int?;
        if (limit != null) {
          final year = j['limitPeriod'] == 'YEAR';
          final buckets = <String, int>{};
          for (final d in dates) {
            final k = year ? d.substring(0, 4) : d.substring(0, 7);
            buckets[k] = (buckets[k] ?? 0) + 1;
          }
          for (final b in buckets.entries) {
            final start = year ? '${b.key}-01-01' : '${b.key}-01';
            final end = year ? '${b.key}-12-31' : core.addDays(isoDay(DateTime.utc(int.parse(b.key.substring(0, 4)), int.parse(b.key.substring(5, 7)) + 1, 1)), -1);
            final used = await tx.scalar<int>(
                'SELECT count(*)::int FROM allowances WHERE employment_id = @e AND justification_id = @j AND date BETWEEN @s AND @f AND NOT (date::text = ANY(@d))',
                {'e': eid, 'j': j['id'], 's': start, 'f': end, 'd': dates}) ?? 0;
            if (used + b.value > limit) {
              throw conflict('Limite de "${j['name']}" excedido para a matrícula ${e['registration']}: $limit por ${year ? 'ano' : 'mês'} (já usado $used)');
            }
          }
        }
        for (final d in dates) {
          rows.add((employmentId: eid, date: d));
        }
      }
      if (rows.isEmpty) throw badRequest('Nenhum dia de trabalho no período escolhido');
      for (final r in rows) {
        await tx.execute('DELETE FROM allowances WHERE employment_id = @e AND date = @d', {'e': r.employmentId, 'd': r.date});
        await tx.insert('allowances', {
          'tenantId': tenantId, 'employmentId': r.employmentId, 'date': r.date, 'justificationId': j['id'], 'fullDay': input['fullDay'],
          'minutes': input['fullDay'] == true ? 0 : input['minutes'], 'note': input['note'], 'createdById': user.id,
        });
      }
      await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'CREATE', entity: 'allowance', after: {
        'employments': emps.length, 'days': rows.length, 'justification': j['name'], 'from': from, 'to': to, 'fullDay': input['fullDay'], 'minutes': input['minutes'],
      }, meta: meta);
      return {'created': rows.length};
    });
  }

  // ------------------------------------------------------------------ banco de horas
  Future<Row> _account(Tx tx, String tenantId, String employmentId) async =>
      await tx.one('SELECT * FROM bank_hours WHERE employment_id = @e', {'e': employmentId}) ??
      await tx.insert('bank_hours', {'tenantId': tenantId, 'employmentId': employmentId});

  Future<int> _applyClosing(Tx tx, String tenantId, String companyId, String closingId, Map<String, List<Map<String, Object?>>> results, String userId) async {
    final policy = await tx.one('SELECT * FROM bank_policies WHERE company_id = @c', {'c': companyId});
    if (policy?['enabled'] != true) return 0;
    var n = 0;
    for (final entry in results.entries) {
      final raw = [for (final d in entry.value) if (d['result'] is Map) resultFromJson((d['result']! as Map).cast<String, Object?>())];
      final dayResults = policy!['compensationEnabled'] == true ? compensate(raw, policy['compensationPeriod']! as String, policy['compensationLeftover']! as String).toBank : raw;
      if (dayResults.isEmpty) continue;
      final acc = await _account(tx, tenantId, entry.key);
      final before = replay(await tx.query('SELECT minutes, ref_date, expires_on FROM bank_hour_transactions WHERE account_id = @a', {'a': acc['id']}));
      final mult = (policy['creditMultipliers'] as Map?) ?? const {};
      final after = core.applyToBank(before, dayResults, core.BankPolicy(
        enabled: true, expirationDays: policy['expirationDays'] as int?, maxDailyCreditMinutes: policy['maxDailyCreditMinutes'] as int?,
        creditMultiplierByPercent: {for (final e in mult.entries) num.parse(e.key as String): e.value as num},
      ));
      final fresh = after.entries.sublist(before.entries.length);
      if (fresh.isEmpty) continue;
      for (final e in fresh) {
        await tx.insert('bank_hour_transactions', {
          'tenantId': tenantId, 'accountId': acc['id'], 'type': e.type, 'minutes': e.minutes, 'refDate': e.refDate, 'expiresOn': e.expiresOn,
          'description': e.type == 'CREDIT' ? 'Crédito do fechamento' : e.type == 'DEBIT' ? 'Débito do fechamento' : 'Crédito vencido',
          'closingId': closingId, 'createdById': userId,
        });
      }
      await tx.update('bank_hours', acc['id']! as String, {'balanceMinutes': after.balance});
      n += fresh.length;
    }
    return n;
  }

  Future<int> _revertClosing(Tx tx, String closingId) async {
    final txs = await tx.query('DELETE FROM bank_hour_transactions WHERE closing_id = @c RETURNING account_id', {'c': closingId});
    for (final a in {for (final t in txs) t['accountId']}) {
      final sum = await tx.scalar<int>('SELECT coalesce(sum(minutes), 0)::int FROM bank_hour_transactions WHERE account_id = @a', {'a': a});
      await tx.update('bank_hours', a! as String, {'balanceMinutes': sum ?? 0});
    }
    return txs.length;
  }

  Future<Map<String, Object?>> statement(String tenantId, String employmentId, [String? from, String? to]) => db.forTenant(tenantId, (tx) async {
        final e = await tx.one(
            'SELECT e.id, e.registration, p.full_name, p.social_name FROM employment_relationships e JOIN people p ON p.id = e.person_id WHERE e.id = @id AND e.deleted_at IS NULL',
            {'id': employmentId});
        if (e == null) throw notFound('Funcionário não encontrado');
        final acc = await tx.one('SELECT id FROM bank_hours WHERE employment_id = @e', {'e': employmentId});
        final all = acc == null
            ? <Row>[]
            : await tx.query('SELECT *, type::text AS type FROM bank_hour_transactions WHERE account_id = @a ORDER BY ref_date ASC, created_at ASC', {'a': acc['id']});
        var running = 0;
        final rows = [
          for (final t in all)
            () {
              running += t['minutes']! as int;
              return <String, Object?>{...t, 'refDate': isoDay(t['refDate']), 'expiresOn': t['expiresOn'] == null ? null : isoDay(t['expiresOn']), 'balanceAfter': running};
            }(),
        ];
        final filtered = rows.where((r) => (from == null || (r['refDate']! as String).compareTo(from) >= 0) && (to == null || (r['refDate']! as String).compareTo(to) <= 0)).toList();
        final opening = from == null ? 0 : rows.where((r) => (r['refDate']! as String).compareTo(from) < 0).fold<int>(0, (s, r) => s + (r['minutes']! as int));
        final state = replay(all);
        final open = state.openCredits.where((c) => c.expiresOn != null).toList()..sort((a, b) => a.expiresOn!.compareTo(b.expiresOn!));
        return {
          'employment': {'id': e['id'], 'registration': e['registration'], 'name': e['socialName'] ?? e['fullName']},
          'balanceMinutes': running, 'openingMinutes': opening, 'transactions': filtered.reversed.toList(),
          'nextExpiration': open.isEmpty ? null : {'minutes': open.first.minutes, 'expiresOn': open.first.expiresOn},
        };
      });

  // ------------------------------------------------------------------ solicitações
  static const _reqSelect = 'SELECT r.*, r.type::text AS type, r.status::text AS status, f.steps AS f_steps, e.registration AS e_registration, e.company_id AS e_company_id, '
      'p.full_name AS e_full_name, p.social_name AS e_social_name FROM time_requests r LEFT JOIN approval_flows f ON f.id = r.flow_id '
      'JOIN employment_relationships e ON e.id = r.employment_id JOIN people p ON p.id = e.person_id';

  List<Map<String, Object?>> _steps(Row r) => r['fSteps'] is List ? (r['fSteps']! as List).cast<Map<String, Object?>>() : _defaultSteps;

  Future<Map<String, Object?>> _shapeRequest(Tx tx, Row r) async {
    final decisions = await tx.query('SELECT step, decision::text AS decision, comment, decider_id, created_at FROM request_decisions WHERE request_id = @id ORDER BY created_at ASC', {'id': r['id']});
    return {
      'id': r['id'], 'type': r['type'], 'typeLabel': _typeLabel[r['type']], 'status': r['status'], 'currentStep': r['currentStep'], 'steps': _steps(r),
      'refDate': r['refDate'] == null ? null : isoDay(r['refDate']), 'payload': r['payload'], 'justification': r['justification'],
      'createdAt': r['createdAt'], 'createdById': r['createdById'],
      'employee': {'id': r['employmentId'], 'registration': r['eRegistration'], 'name': r['eSocialName'] ?? r['eFullName']},
      'decisions': decisions,
    };
  }

  Future<bool> _canDecide(Tx tx, AuthUser user, Row r) async {
    if (r['createdById'] == user.id) return false;
    if (user.personId != null && await tx.one('SELECT 1 FROM employment_relationships WHERE id = @e AND person_id = @p', {'e': r['employmentId'], 'p': user.personId}) != null) {
      return false; // ninguém aprova o próprio pedido
    }
    final steps = _steps(r);
    final idx = r['currentStep']! as int;
    if (idx >= steps.length) return false;
    final step = steps[idx];
    if (step['approver'] == 'PERMISSION') return can(user, 'requests.requests:approve');
    if (step['approver'] == 'ROLE') return await tx.one('SELECT 1 FROM user_roles WHERE user_id = @u AND role_id = @r', {'u': user.id, 'r': step['roleId']}) != null;
    if (user.personId == null) return false;
    final sup = await tx.scalar<String>('SELECT s.person_id FROM employment_relationships e JOIN employment_relationships s ON s.id = e.supervisor_id WHERE e.id = @e', {'e': r['employmentId']});
    return sup == user.personId;
  }

  Future<void> _applyRequest(String tenantId, AuthUser user, Row r, Map<String, Object?> meta) async {
    final p = (r['payload'] as Map?)?.cast<String, Object?>() ?? const {};
    final d = r['refDate'] == null ? null : isoDay(r['refDate']);
    String note() {
      final s = 'Solicitação: ${r['justification']}';
      return s.length > 300 ? s.substring(0, 300) : s;
    }

    switch (r['type']) {
      case 'RECORD_CORRECTION':
        await createAdjustment(tenantId, user, {'kind': 'INCLUDE', 'employmentId': r['employmentId'], 'date': d, 'time': p['time'], 'justification': note()}, meta, r['id']! as String);
      case 'ABSENCE_JUSTIFICATION':
        await createAllowances(tenantId, user, {
          'employmentIds': [r['employmentId']], 'from': d, 'to': d, 'justificationId': p['justificationId'], 'fullDay': p['fullDay'] != false,
          'minutes': p['minutes'], 'onlyWorkdays': false, 'note': note(),
        }, meta);
      case 'SCHEDULE_CHANGE':
        final res = await _swapViaHttp(tenantId, user, {'kind': 'DAY_OFF', 'employmentId': r['employmentId'], 'workDate': d, 'offDate': p['offDate'], 'note': note()}, meta);
        if (res != null) throw res;
      case 'OVERTIME_AUTHORIZATION':
        final j = r['justification']! as String;
        await db.forTenant(tenantId, (tx) => tx.execute(
              'INSERT INTO overtime_authorizations (id, tenant_id, employment_id, date, max_minutes, request_id, note, created_by_id) VALUES (gen_random_uuid(), @t, @e, @d, @m, @r, @n, @u) '
              'ON CONFLICT (employment_id, date) DO UPDATE SET max_minutes = EXCLUDED.max_minutes, request_id = EXCLUDED.request_id, note = EXCLUDED.note',
              {'t': tenantId, 'e': r['employmentId'], 'd': d, 'm': p['maxMinutes'], 'r': r['id'], 'n': j.length > 300 ? j.substring(0, 300) : j, 'u': user.id},
            ));
      default:
        break; // "Outro pedido": só registra a decisão
    }
  }

  /// Troca de folga reaproveitando a rota de trocas (mesmas validações da escala).
  Future<HttpError?> _swapViaHttp(String tenantId, AuthUser user, Map<String, Object?> input, Map<String, Object?> meta) async {
    final route = app.router.routes.firstWhere((r) => r.method == 'POST' && r.path == '/v1/schedule-overrides/swap');
    final ctx = _InternalCtx(user, tenantId, input, meta);
    try {
      await route.handler(ctx);
      return null;
    } on HttpError catch (e) {
      return e;
    }
  }

  // ------------------------------------------------------------------ REP-P
  static final _developerId = Platform.environment['REP_P_DEVELOPER_CNPJ'] ?? '';
  String _sign(String payload) => b64url(c.Hmac(c.sha256, utf8.encode('${app.config.jwtSecret}:punch')).convert(utf8.encode(payload)).bytes);

  void routes() {
    final r = app.router;
    final companyQuery = Obj({'companyId': uuid});

    // Justificativas (cadastro simples).
    catalogRoutes(app, Catalog(
      path: 'justifications', table: 'justifications', entity: 'justification', label: 'Justificativa', gender: 'a', read: 'time.calculations:read',
      manage: 'time.justifications:manage', create: justificationSchema, update: justificationSchema.partial, searchFields: ['name', 'code'], orderBy: 'name ASC',
      usageSql: 'SELECT (SELECT count(*) FROM allowances WHERE justification_id = @id) + (SELECT count(*) FROM leaves WHERE justification_id = @id AND deleted_at IS NULL)',
    ));

    r.group('/v1/timesheet', tag: 'ponto', () {
      r.get('/rep-p', permission: 'time.calculations:read', (ctx) {
        final q = companyQuery.parse(ctx.query);
        return db.forTenant(ctx.tenant, (tx) async {
          await requireCompanyExists(tx, q['companyId']);
          final x = await tx.one('SELECT inpi_number, last_nsr FROM rep_p_registers WHERE company_id = @c', {'c': q['companyId']});
          return {'companyId': q['companyId'], 'inpiNumber': x?['inpiNumber'], 'lastNsr': x?['lastNsr'] ?? 0};
        });
      });

      r.put('/rep-p', permission: 'admin.settings:manage', (ctx) {
        final input = _repPSettings.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await requireCompanyExists(tx, input['companyId']);
          final before = await tx.one('SELECT inpi_number FROM rep_p_registers WHERE company_id = @c', {'c': input['companyId']});
          final x = (await tx.one(
            'INSERT INTO rep_p_registers (id, tenant_id, company_id, inpi_number, updated_at) VALUES (gen_random_uuid(), @t, @c, @i, now()) '
            'ON CONFLICT (company_id) DO UPDATE SET inpi_number = EXCLUDED.inpi_number, updated_at = now() RETURNING *',
            {'t': tenantId, 'c': input['companyId'], 'i': input['inpiNumber']},
          ))!;
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'rep_p_register', entityId: x['id'] as String?,
              before: {'inpiNumber': before?['inpiNumber']}, after: {'inpiNumber': x['inpiNumber']}, meta: ctx.meta);
          return {'companyId': x['companyId'], 'inpiNumber': x['inpiNumber'], 'lastNsr': x['lastNsr']};
        });
      });

      // AFD (Portaria 671) das marcações do REP-P (navegador/app) no período.
      r.get('/afd-rep-p', permission: 'reports.reports:export', (ctx) async {
        final q = _repPAfd.parse(ctx.query);
        final tenantId = ctx.tenant;
        final from = brMidnight(q['from']! as String), to = brMidnight(q['to']! as String).add(const Duration(days: 1));
        final data = await db.forTenant(tenantId, (tx) async {
          final company = await tx.one('SELECT * FROM companies WHERE id = @c AND deleted_at IS NULL', {'c': q['companyId']});
          if (company == null) throw notFound('Empresa não encontrada');
          final reg = await tx.one('SELECT * FROM rep_p_registers WHERE company_id = @c', {'c': q['companyId']});
          final rows = await tx.query(
              'SELECT t.rep_p_nsr, t.rep_p_hash, t.recorded_at, p.cpf FROM time_records t JOIN employment_relationships e ON e.id = t.employment_id JOIN people p ON p.id = e.person_id '
              'WHERE t.rep_p_company_id = @c AND t.recorded_at >= @f AND t.recorded_at < @to ORDER BY t.rep_p_nsr ASC',
              {'c': q['companyId'], 'f': from, 'to': to});
          final first = rows.isEmpty ? null : rows.first['repPNsr'] as int?;
          final prevHash = first != null && first > 1
              ? await tx.scalar<String>('SELECT rep_p_hash FROM time_records WHERE rep_p_company_id = @c AND rep_p_nsr = @n', {'c': q['companyId'], 'n': first - 1})
              : null;
          return (company: company, reg: reg, rows: rows, prevHash: prevHash);
        });
        final cnpj = data.company['cnpj'] as String?;
        if (cnpj == null) throw badRequest('A empresa precisa de CNPJ para gerar o AFD');
        final warnings = <String>[];
        if (data.reg?['inpiNumber'] == null) warnings.add('Número do REP-P no INPI não informado: o cabeçalho saiu com zeros.');
        if (_developerId.isEmpty) warnings.add('CNPJ do desenvolvedor do programa (REP_P_DEVELOPER_CNPJ) não configurado.');
        final lines = [
          core.afdHeader671(employerIdType: 'CNPJ', employerId: cnpj, secondaryId: data.company['cno'] as String? ?? '', employerName: data.company['legalName']! as String,
              repId: data.reg?['inpiNumber'] as String? ?? '', periodStart: q['from']! as String, periodEnd: q['to']! as String, generatedAt: DateTime.now(),
              developerId: _developerId, model: 'SuperPonto'),
        ];
        String? prev = data.prevHash;
        var broken = 0;
        for (final x in data.rows) {
          final at = x['recordedAt']! as DateTime;
          final tries = [for (final col in ['02', '01']) core.afdRecord7(nsr: x['repPNsr']! as int, at: at, cpf: x['cpf'] as String? ?? '', recordedAt: at, collector: col, offline: false, previousHash: prev)];
          final ok = tries.where((t) => t.hash == x['repPHash']).firstOrNull;
          if (ok == null) broken++;
          lines.add((ok ?? tries.first).line);
          prev = x['repPHash'] as String?;
          if (x['cpf'] == null) warnings.add('NSR ${x['repPNsr']}: funcionário sem CPF.');
        }
        if (broken > 0) warnings.add('$broken registro(s) não conferem com o hash gravado: verifique a integridade do banco.');
        lines.add(core.afdTrailer671({'7': data.rows.length}));
        await db.forTenant(tenantId, (tx) => app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'EXPORT', entity: 'afd_rep_p',
            after: {'companyId': q['companyId'], 'from': q['from'], 'to': q['to'], 'records': data.rows.length}, meta: ctx.meta));
        final content = '${lines.join('\r\n')}\r\n';
        return {
          'filename': 'AFD_REP-P_${cnpj.replaceAll(RegExp(r'\W'), '')}_${q['from']}_${q['to']}.txt', 'mime': 'text/plain;charset=iso-8859-1',
          'base64': base64.encode(latin1.encode(content.replaceAll(RegExp(r'[^\x00-\xFF]'), '?'))), 'records': data.rows.length, 'warnings': warnings,
        };
      });

      r.get('', permission: 'time.calculations:read', (ctx) {
        final q = _mirror.parse(ctx.query);
        return mirror(ctx.tenant, q['employmentId']! as String, q['from']! as String, q['to']! as String);
      });

      r.get('/me', permission: 'time.records:create', (ctx) async {
        final q = _periodQ.parse(ctx.query);
        final tenantId = ctx.tenant;
        final mine = await db.forTenant(tenantId, (tx) => myEmployments(tx, ctx.user));
        final e = q['employmentId'] != null ? mine.where((m) => m['id'] == q['employmentId']).firstOrNull : mine.firstOrNull;
        if (e == null) throw notFound('Vínculo não encontrado');
        return mirror(tenantId, e['id']! as String, q['from']! as String, q['to']! as String);
      });

      // Espelho diário: todos os funcionários da empresa num dia, com a situação de cada um.
      r.get('/daily', permission: 'time.calculations:read', (ctx) async {
        final q = _daily.parse(ctx.query);
        final tenantId = ctx.tenant;
        final d = q['date']! as String;
        final emps = await db.forTenant(tenantId, (tx) => loadEmps(tx,
            'e.company_id = @c AND e.deleted_at IS NULL AND e.hired_at <= @d AND (e.terminated_at IS NULL OR e.terminated_at >= @d)'
            '${q['departmentId'] != null ? ' AND e.department_id = @dep' : ''}'
            '${q['groupingId'] != null ? ' AND EXISTS (SELECT 1 FROM grouping_employments g WHERE g.employment_id = e.id AND g.grouping_id = @g)' : ''}',
            {'c': q['companyId'], 'd': d, 'dep': q['departmentId'], 'g': q['groupingId']}, order: 'ORDER BY p.full_name ASC', limit: 'LIMIT 500'));
        final map = await core0.compute(tenantId, emps, d, d);
        final rows = [
          for (final e in emps)
            () {
              final day = map[e.id]!.first;
              final f = ((day['result'] as Map?)?['flags'] as List?) ?? const [];
              final punches = (day['punches'] as List?) ?? const [];
              final al = day['allowance'] as Map?;
              final situation = day['leave'] != null
                  ? 'LEAVE'
                  : al?['fullDay'] == true && al?['disregardsDebits'] == true
                      ? 'ALLOWANCE'
                      : f.contains('ABSENCE')
                          ? 'ABSENT'
                          : f.contains('INCOMPLETE')
                              ? 'INCOMPLETE'
                              : (day['expected'] as Map?)?['isWorkday'] != true && punches.isEmpty
                                  ? 'OFF'
                                  : f.contains('LATE')
                                      ? 'LATE'
                                      : punches.isNotEmpty
                                          ? 'PRESENT'
                                          : 'EXPECTED';
              return {'employmentId': e.id, 'registration': e.registration, 'name': e.name, 'situation': situation, 'day': day};
            }(),
        ];
        int count(String s) => rows.where((x) => x['situation'] == s).length;
        return {
          'date': d, 'rows': rows,
          'totals': {
            'present': count('PRESENT') + count('LATE'), 'late': count('LATE'), 'absent': count('ABSENT'), 'incomplete': count('INCOMPLETE'), 'off': count('OFF'),
            'leave': count('LEAVE') + count('ALLOWANCE'), 'expected': count('EXPECTED'),
          },
        };
      });

      r.get('/aej', permission: 'reports.reports:export', (ctx) => _aej(ctx.tenant, _calculate.parse(ctx.query)));

      // Cálculo em lote: grava a apuração dos dias abertos do período.
      r.post('/calculate', permission: 'time.closings:manage', status: 200, (ctx) async {
        final q = _calculate.parse(ctx.body);
        final tenantId = ctx.tenant;
        final from = q['from']! as String, to = q['to']! as String;
        final emps = await db.forTenant(tenantId, (tx) async {
          await requireCompanyExists(tx, q['companyId']);
          return companyEmployments(tx, q['companyId']! as String, from, to, (q['employmentIds'] as List?)?.cast<String>());
        });
        final map = await core0.compute(tenantId, emps, from, to);
        final saved = await db.forTenant(tenantId, (tx) async {
          final n = await core0.persist(tx, tenantId, map);
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'time_calculation',
              after: {'companyId': q['companyId'], 'from': from, 'to': to, 'employments': emps.length, 'days': n}, meta: ctx.meta);
          return n;
        });
        var pending = 0, unauthorized = 0, incomplete = 0;
        for (final days in map.values) {
          final s = core0.summary(days);
          pending += s['pendingAdjustments']! as int;
          unauthorized += s['unauthorizedOvertimeMinutes']! as int;
          incomplete += s['incompleteDays']! as int;
        }
        return {'employments': emps.length, 'days': saved, 'pendingAdjustments': pending, 'incompleteDays': incomplete, 'unauthorizedOvertimeMinutes': unauthorized};
      });
    });

    // ------------------------------------------------------------------ ajustes
    r.group('/v1/time-adjustments', tag: 'ponto', () {
      r.get('', permission: 'time.records:read', (ctx) {
        final q = Obj({'status': const Enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional, 'companyId': uuid.optional, 'employmentId': uuid.optional}).parse(ctx.query);
        return db.forTenant(ctx.tenant, (tx) async {
          final rows = await tx.query(
            'SELECT a.*, a.kind::text AS kind, a.status::text AS status, t.recorded_at AS t_recorded_at, t.source::text AS t_source, '
            'e.registration AS e_registration, p.full_name AS e_full_name, p.social_name AS e_social_name '
            'FROM time_record_adjustments a LEFT JOIN time_records t ON t.id = a.time_record_id JOIN employment_relationships e ON e.id = a.employment_id JOIN people p ON p.id = e.person_id '
            'WHERE TRUE${q['status'] != null ? ' AND a.status = @s' : ''}${q['employmentId'] != null ? ' AND a.employment_id = @e' : ''}${q['companyId'] != null ? ' AND e.company_id = @c' : ''} '
            'ORDER BY a.created_at DESC LIMIT 500',
            {'s': q['status'], 'e': q['employmentId'], 'c': q['companyId']},
          );
          return [
            for (final a in rows)
              () {
                final at = (a['recordedAt'] ?? a['tRecordedAt']) as DateTime?;
                final l = at == null ? null : localBr(at);
                return {
                  for (final e in a.entries) if (!RegExp('^[te][A-Z]').hasMatch(e.key)) e.key: e.value,
                  'timeRecord': a['timeRecordId'] == null ? null : {'recordedAt': a['tRecordedAt'], 'source': a['tSource']},
                  'employee': {'id': a['employmentId'], 'registration': a['eRegistration'], 'name': a['eSocialName'] ?? a['eFullName']},
                  'when': l == null ? null : {'date': l.date, 'time': l.time},
                };
              }(),
          ];
        });
      });

      r.post('', permission: 'time.adjustments:create', (ctx) {
        final kind = ctx.json['kind'];
        final input = kind == 'INCLUDE' ? _adjInclude.parse(ctx.body) : kind == 'DISREGARD' ? _adjDisregard.parse(ctx.body) : throw badRequest(['kind: Invalid input']);
        return createAdjustment(ctx.tenant, ctx.user, input, ctx.meta);
      });

      r.post('/:id/decide', permission: 'time.adjustments:approve', status: 200, (ctx) {
        final id = ctx.uuidParam('id');
        final b = _decide.parse(ctx.body);
        final user = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final a = await tx.one(
              'SELECT a.*, a.kind::text AS kind, a.status::text AS status, t.recorded_at AS t_recorded_at, e.company_id AS e_company_id FROM time_record_adjustments a '
              'LEFT JOIN time_records t ON t.id = a.time_record_id JOIN employment_relationships e ON e.id = a.employment_id WHERE a.id = @id',
              {'id': id});
          if (a == null) throw notFound('Ajuste não encontrado');
          if (a['status'] != 'PENDING') throw conflict('Este ajuste já foi decidido');
          if (a['createdById'] == user.id) throw forbidden('Quem pediu o ajuste não pode aprová-lo');
          final d = localBr((a['recordedAt'] ?? a['tRecordedAt'])! as DateTime).date;
          await assertOpenPeriod(tx, [a['eCompanyId']! as String], d, d);
          final approve = b['approve'] == true;
          final saved = await tx.update('time_record_adjustments', id, {'status': approve ? 'APPROVED' : 'REJECTED', 'decidedById': user.id, 'decidedAt': DateTime.now()});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: approve ? 'APPROVE' : 'REJECT', entity: 'time_adjustment', entityId: id,
              before: a, after: {...?saved, 'comment': b['comment']}, meta: ctx.meta);
          return saved;
        });
      });

      r.delete('/:id', permission: 'time.adjustments:create', status: 204, (ctx) {
        final id = ctx.uuidParam('id');
        final user = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final a = await tx.one(
              'SELECT a.*, a.status::text AS status, t.recorded_at AS t_recorded_at, e.company_id AS e_company_id FROM time_record_adjustments a '
              'LEFT JOIN time_records t ON t.id = a.time_record_id JOIN employment_relationships e ON e.id = a.employment_id WHERE a.id = @id',
              {'id': id});
          if (a == null) throw notFound('Ajuste não encontrado');
          if (a['status'] != 'PENDING' && !(a['status'] == 'APPROVED' && can(user, 'time.adjustments:approve'))) throw conflict('Só ajustes pendentes podem ser cancelados');
          final d = localBr((a['recordedAt'] ?? a['tRecordedAt'])! as DateTime).date;
          await assertOpenPeriod(tx, [a['eCompanyId']! as String], d, d);
          await tx.update('time_record_adjustments', id, {'status': 'CANCELLED', 'decidedById': user.id, 'decidedAt': DateTime.now()});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'time_adjustment', entityId: id, before: a, after: {'status': 'CANCELLED'}, meta: ctx.meta);
          return null;
        });
      });
    });

    // ------------------------------------------------------------------ abonos, afastamentos, sobreaviso
    String empJoin(String alias) => 'JOIN employment_relationships e ON e.id = $alias.employment_id JOIN people p ON p.id = e.person_id';
    Map<String, Object?> empOf(Row x) => {'id': x['employmentId'], 'registration': x['eRegistration'], 'name': x['eSocialName'] ?? x['eFullName']};
    const empCols = 'e.registration AS e_registration, p.full_name AS e_full_name, p.social_name AS e_social_name';

    r.get('/v1/allowances', permission: 'time.calculations:read', (ctx) {
      final q = _listRange.parse(ctx.query);
      return db.forTenant(ctx.tenant, (tx) async {
        final rows = await tx.query(
          'SELECT a.*, j.name AS j_name, j.code AS j_code, j.disregards_debits AS j_disregards_debits, $empCols FROM allowances a JOIN justifications j ON j.id = a.justification_id ${empJoin('a')} '
          'WHERE a.date BETWEEN @f AND @t${q['employmentId'] != null ? ' AND a.employment_id = @e' : ''}${q['companyId'] != null ? ' AND e.company_id = @c' : ''} ORDER BY a.date DESC LIMIT 2000',
          {'f': q['from'], 't': q['to'], 'e': q['employmentId'], 'c': q['companyId']},
        );
        return [
          for (final a in rows)
            {
              for (final e in a.entries) if (!RegExp('^[je][A-Z]').hasMatch(e.key)) e.key: e.value,
              'date': isoDay(a['date']),
              'justification': {'id': a['justificationId'], 'name': a['jName'], 'code': a['jCode'], 'disregardsDebits': a['jDisregardsDebits']},
              'employment': empOf(a),
            },
        ];
      });
    });

    r.post('/v1/allowances', permission: 'time.allowances:create', (ctx) => createAllowances(ctx.tenant, ctx.user, _allowance.parse(ctx.body), ctx.meta));

    r.delete('/v1/allowances/:id', permission: 'time.allowances:create', status: 204, (ctx) {
      final id = ctx.uuidParam('id');
      final tenantId = ctx.tenant;
      return db.forTenant(tenantId, (tx) async {
        final a = await tx.one('SELECT a.*, e.company_id AS e_company_id FROM allowances a JOIN employment_relationships e ON e.id = a.employment_id WHERE a.id = @id', {'id': id});
        if (a == null) throw notFound('Abono não encontrado');
        await assertOpenPeriod(tx, [a['eCompanyId']! as String], isoDay(a['date']), isoDay(a['date']));
        await tx.execute('DELETE FROM allowances WHERE id = @id', {'id': id});
        await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'allowance', entityId: id, before: a, meta: ctx.meta);
        return null;
      });
    });

    r.get('/v1/leaves', permission: 'time.calculations:read', (ctx) {
      final q = _listRange.parse(ctx.query);
      return db.forTenant(ctx.tenant, (tx) async {
        final rows = await tx.query(
          'SELECT l.*, l.type::text AS type, j.name AS j_name, $empCols FROM leaves l LEFT JOIN justifications j ON j.id = l.justification_id ${empJoin('l')} '
          'WHERE l.deleted_at IS NULL AND l.start_date <= @t AND l.end_date >= @f${q['employmentId'] != null ? ' AND l.employment_id = @e' : ''}${q['companyId'] != null ? ' AND e.company_id = @c' : ''} '
          'ORDER BY l.start_date DESC LIMIT 1000',
          {'f': q['from'], 't': q['to'], 'e': q['employmentId'], 'c': q['companyId']},
        );
        return [
          for (final l in rows)
            {
              for (final e in l.entries) if (!RegExp('^[je][A-Z]').hasMatch(e.key)) e.key: e.value,
              'startDate': isoDay(l['startDate']), 'endDate': isoDay(l['endDate']),
              'justification': l['justificationId'] == null ? null : {'id': l['justificationId'], 'name': l['jName']},
              'employment': empOf(l),
            },
        ];
      });
    });

    r.post('/v1/leaves', permission: 'time.allowances:create', (ctx) {
      final input = _leave.parse(ctx.body);
      final user = ctx.user, tenantId = ctx.tenant;
      return db.forTenant(tenantId, (tx) async {
        final e = await tx.one('SELECT id, company_id FROM employment_relationships WHERE id = @id AND deleted_at IS NULL', {'id': input['employmentId']});
        if (e == null) throw notFound('Funcionário não encontrado');
        if (input['justificationId'] != null && await tx.one('SELECT 1 FROM justifications WHERE id = @id AND deleted_at IS NULL', {'id': input['justificationId']}) == null) {
          throw notFound('Justificativa não encontrada');
        }
        await assertOpenPeriod(tx, [e['companyId']! as String], input['startDate']! as String, input['endDate']! as String);
        final overlap = await tx.one('SELECT start_date, end_date FROM leaves WHERE employment_id = @e AND deleted_at IS NULL AND start_date <= @end AND end_date >= @start LIMIT 1',
            {'e': e['id'], 'start': input['startDate'], 'end': input['endDate']});
        if (overlap != null) throw conflict('Já existe afastamento de ${isoDay(overlap['startDate'])} a ${isoDay(overlap['endDate'])} neste período');
        final l = await tx.insert('leaves', {
          'tenantId': tenantId, 'employmentId': e['id'], 'type': input['type'], 'startDate': input['startDate'], 'endDate': input['endDate'],
          'justificationId': input['justificationId'], 'note': input['note'], 'createdById': user.id,
        });
        await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'CREATE', entity: 'leave', entityId: l['id'] as String?, after: l, meta: ctx.meta);
        return {...l, 'startDate': isoDay(l['startDate']), 'endDate': isoDay(l['endDate'])};
      });
    });

    r.delete('/v1/leaves/:id', permission: 'time.allowances:create', status: 204, (ctx) {
      final id = ctx.uuidParam('id');
      final tenantId = ctx.tenant;
      return db.forTenant(tenantId, (tx) async {
        final l = await tx.one('SELECT l.*, e.company_id AS e_company_id FROM leaves l JOIN employment_relationships e ON e.id = l.employment_id WHERE l.id = @id AND l.deleted_at IS NULL', {'id': id});
        if (l == null) throw notFound('Afastamento não encontrado');
        await assertOpenPeriod(tx, [l['eCompanyId']! as String], isoDay(l['startDate']), isoDay(l['endDate']));
        await tx.execute('UPDATE leaves SET deleted_at = now() WHERE id = @id', {'id': id});
        await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'leave', entityId: id, before: l, meta: ctx.meta);
        return null;
      });
    });

    r.post('/v1/on-call', permission: 'time.adjustments:create', (ctx) {
      final input = _onCall.parse(ctx.body);
      final user = ctx.user, tenantId = ctx.tenant;
      return db.forTenant(tenantId, (tx) async {
        final ids = (input['employmentIds']! as List).cast<String>().toSet().toList();
        final emps = await tx.query('SELECT id, company_id FROM employment_relationships WHERE id::text = ANY(@ids) AND deleted_at IS NULL', {'ids': ids});
        if (emps.length != ids.length) throw notFound('Funcionário não encontrado');
        await assertOpenPeriod(tx, {for (final e in emps) e['companyId']! as String}.toList(), input['date']! as String, input['date']! as String);
        final minutes = _span(input['startTime']! as String, input['endTime']! as String);
        for (final id in ids) {
          await tx.insert('on_call_periods', {
            'tenantId': tenantId, 'employmentId': id, 'date': input['date'], 'startTime': input['startTime'], 'endTime': input['endTime'], 'minutes': minutes,
            'note': input['note'], 'createdById': user.id,
          });
        }
        await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'CREATE', entity: 'on_call', after: {'employments': ids.length, ...input, 'minutes': minutes}, meta: ctx.meta);
        return {'created': ids.length, 'minutes': minutes};
      });
    });

    r.delete('/v1/on-call/:id', permission: 'time.adjustments:create', status: 204, (ctx) {
      final id = ctx.uuidParam('id');
      final tenantId = ctx.tenant;
      return db.forTenant(tenantId, (tx) async {
        final o = await tx.one('SELECT o.*, e.company_id AS e_company_id FROM on_call_periods o JOIN employment_relationships e ON e.id = o.employment_id WHERE o.id = @id', {'id': id});
        if (o == null) throw notFound('Sobreaviso não encontrado');
        await assertOpenPeriod(tx, [o['eCompanyId']! as String], isoDay(o['date']), isoDay(o['date']));
        await tx.execute('DELETE FROM on_call_periods WHERE id = @id', {'id': id});
        await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'on_call', entityId: id, before: o, meta: ctx.meta);
        return null;
      });
    });

    // ------------------------------------------------------------------ fechamento
    Map<String, Object?> closingView(Row x) => {...x, 'periodStart': isoDay(x['periodStart']), 'periodEnd': isoDay(x['periodEnd'])};

    r.group('/v1/closings', tag: 'ponto', () {
      r.get('', permission: 'time.calculations:read', (ctx) {
        final q = companyQuery.parse(ctx.query);
        return db.forTenant(ctx.tenant, (tx) async => [
              for (final x in await tx.query('SELECT *, status::text AS status FROM time_closings WHERE company_id = @c ORDER BY period_start DESC', {'c': q['companyId']})) closingView(x),
            ]);
      });

      r.post('', permission: 'time.closings:manage', (ctx) async {
        final input = _closing.parse(ctx.body);
        final user = ctx.user, tenantId = ctx.tenant;
        final ps = input['periodStart']! as String, pe = input['periodEnd']! as String;
        final emps = await db.forTenant(tenantId, (tx) async {
          await requireCompanyExists(tx, input['companyId']);
          final overlap = await tx.one(
              "SELECT period_start, period_end FROM time_closings WHERE company_id = @c AND status = 'CLOSED' AND period_start <= @pe AND period_end >= @ps LIMIT 1",
              {'c': input['companyId'], 'ps': ps, 'pe': pe});
          if (overlap != null) throw conflict('Já existe período fechado de ${isoDay(overlap['periodStart'])} a ${isoDay(overlap['periodEnd'])}');
          final pending = await tx.scalar<int>(
            "SELECT count(*)::int FROM time_record_adjustments a LEFT JOIN time_records t ON t.id = a.time_record_id JOIN employment_relationships e ON e.id = a.employment_id "
            "WHERE a.status = 'PENDING' AND e.company_id = @c AND ((a.recorded_at >= @s AND a.recorded_at < @end) OR (t.recorded_at >= @s AND t.recorded_at < @end))",
            {'c': input['companyId'], 's': brMidnight(ps), 'end': brMidnight(pe).add(const Duration(days: 1))},
          ) ?? 0;
          if (pending > 0) throw conflict('Há $pending ajuste(s) de marcação pendente(s) no período: aprove ou recuse antes de fechar');
          return companyEmployments(tx, input['companyId']! as String, ps, pe);
        });
        final holidays = await schedules.holidayMap(tenantId, [input['companyId']! as String], ps, pe);
        return db.forTenant(tenantId, (tx) async {
          final results = await core0.computeTx(tx, emps, ps, pe, holidays);
          final days = await core0.persist(tx, tenantId, results);
          final existing = await tx.one('SELECT id FROM time_closings WHERE company_id = @c AND period_start = @ps AND period_end = @pe', {'c': input['companyId'], 'ps': ps, 'pe': pe});
          final closing = existing != null
              ? (await tx.one("UPDATE time_closings SET status = 'CLOSED', closed_by_id = @u, closed_at = now() WHERE id = @id RETURNING *, status::text AS status", {'u': user.id, 'id': existing['id']}))!
              : (await tx.one(
                  "INSERT INTO time_closings (id, tenant_id, company_id, period_start, period_end, status, closed_by_id, closed_at) VALUES (gen_random_uuid(), @t, @c, @ps, @pe, 'CLOSED', @u, now()) "
                  'RETURNING *, status::text AS status',
                  {'t': tenantId, 'c': input['companyId'], 'ps': ps, 'pe': pe, 'u': user.id}))!;
          final bankEntries = await _applyClosing(tx, tenantId, input['companyId']! as String, closing['id']! as String, results, user.id);
          await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'CLOSE_PERIOD', entity: 'time_closing', entityId: closing['id'] as String?,
              after: {...input, 'employments': emps.length, 'days': days, 'bankEntries': bankEntries}, meta: ctx.meta);
          return {...closingView(closing), 'employments': emps.length, 'days': days, 'bankEntries': bankEntries};
        });
      });

      r.post('/:id/reopen', permission: 'time.closings:manage', status: 200, (ctx) {
        final id = ctx.uuidParam('id');
        final b = _reopen.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final x = await tx.one('SELECT *, status::text AS status FROM time_closings WHERE id = @id', {'id': id});
          if (x == null) throw notFound('Fechamento não encontrado');
          if (x['status'] != 'CLOSED') throw badRequest('Este período não está fechado');
          final later = await tx.one("SELECT period_start, period_end FROM time_closings WHERE company_id = @c AND status = 'CLOSED' AND period_start > @pe LIMIT 1",
              {'c': x['companyId'], 'pe': isoDay(x['periodEnd'])});
          if (later != null) {
            throw conflict('Reabra antes o período posterior (${isoDay(later['periodStart'])} a ${isoDay(later['periodEnd'])}): o banco de horas depende da ordem');
          }
          final saved = (await tx.one("UPDATE time_closings SET status = 'REOPENED', reopen_reason = @r WHERE id = @id RETURNING *, status::text AS status", {'r': b['reason'], 'id': id}))!;
          final reverted = await _revertClosing(tx, id);
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'REOPEN_PERIOD', entity: 'time_closing', entityId: id,
              before: x, after: {...saved, 'reverted': reverted}, meta: ctx.meta);
          return {...closingView(saved), 'revertedBankEntries': reverted};
        });
      });
    });

    // ------------------------------------------------------------------ marcação web (REP-P)
    r.group('/v1/punch', tag: 'ponto', () {
      r.get('/me', permission: 'time.records:create', (ctx) {
        final user = ctx.user;
        return db.forTenant(ctx.tenant, (tx) async {
          final mine = await myEmployments(tx, user);
          final today = localBr(DateTime.now()).date;
          final records = await tx.query(
              'SELECT id, employment_id, recorded_at, source::text AS source, hash FROM time_records WHERE employment_id::text = ANY(@ids) AND recorded_at >= @f ORDER BY recorded_at ASC',
              {'ids': [for (final m in mine) m['id']! as String], 'f': brMidnight(today)});
          return {
            'today': today,
            'employments': [
              for (final m in mine)
                {
                  'id': m['id'], 'registration': m['registration'], 'company': m['cTradeName'] ?? m['cLegalName'],
                  'geofence': m['uGeofenceM'] != null ? {'name': m['uName'], 'radiusM': m['uGeofenceM']} : null,
                },
            ],
            'punches': [
              for (final x in records)
                {'id': x['id'], 'employmentId': x['employmentId'], 'at': isoMs(x['recordedAt']! as DateTime), 'time': localBr(x['recordedAt']! as DateTime).time,
                  'source': x['source'], 'hash': (x['hash']! as String).substring(0, 16)},
            ],
          };
        });
      });

      r.post('/challenge', permission: 'time.records:create', status: 200, throttle: 20, (ctx) {
        final body = b64url(utf8.encode(jsonEncode({'u': ctx.user.id, 'n': b64url(randomBytes(16)), 'exp': DateTime.now().millisecondsSinceEpoch + 120000})));
        return {'token': '$body.${_sign(body)}', 'expiresInSeconds': 120};
      });

      r.post('', permission: 'time.records:create', throttle: 10, (ctx) {
        final input = _punch.parse(ctx.body);
        final user = ctx.user, tenantId = ctx.tenant;
        final parts = (input['token']! as String).split('.');
        if (parts.length != 2 || parts[0].isEmpty || parts[1].isEmpty || !safeEqual(_sign(parts[0]), parts[1])) throw badRequest('Desafio inválido');
        final Map<String, Object?> payload;
        try {
          payload = (jsonDecode(utf8.decode(b64urlDecode(parts[0]))) as Map).cast<String, Object?>();
        } catch (_) {
          throw badRequest('Desafio inválido');
        }
        if (payload['u'] != user.id) throw badRequest('Desafio de outro usuário');
        if ((payload['exp']! as num) < DateTime.now().millisecondsSinceEpoch) throw badRequest('Desafio expirado: atualize a página e tente de novo');
        final nonce = payload['n']! as String;
        return db.forTenant(tenantId, (tx) async {
          final mine = await myEmployments(tx, user);
          final e = input['employmentId'] != null ? mine.where((m) => m['id'] == input['employmentId']).firstOrNull : mine.length == 1 ? mine.first : null;
          if (e == null) throw badRequest(mine.length > 1 ? 'Escolha o vínculo da marcação' : 'Vínculo não encontrado');
          final now = DateTime.now().toUtc();
          final today = localBr(now).date;
          final companyId = e['companyId']! as String;
          await assertOpenPeriod(tx, [companyId], today, today);
          Row? appDevice;
          if (input['appDeviceToken'] != null) {
            appDevice = await tx.one('SELECT id, name FROM app_devices WHERE token_hash = @h AND user_id = @u AND approved_at IS NOT NULL AND revoked_at IS NULL',
                {'h': sha256Hex(utf8.encode(input['appDeviceToken']! as String)), 'u': user.id});
            if (appDevice == null) throw forbidden('Aparelho não liberado ou revogado: libere este aparelho de novo em Meus aparelhos');
            await tx.execute('UPDATE app_devices SET last_used_at = @n WHERE id = @id', {'n': now, 'id': appDevice['id']});
          }
          final radius = e['uGeofenceM'] as int?;
          if (radius != null && e['uLatitude'] != null && e['uLongitude'] != null) {
            if (input['latitude'] == null || input['longitude'] == null) {
              throw forbidden('Sua unidade exige localização: permita o acesso à localização para marcar (${e['uName']})');
            }
            final dist = _distanceM(double.parse(e['uLatitude'].toString()), double.parse(e['uLongitude'].toString()),
                (input['latitude']! as num).toDouble(), (input['longitude']! as num).toDouble());
            final acc = math.min((input['accuracy'] as int?) ?? 0, 100);
            if (dist > radius + acc) throw forbidden('Você está a ${core.jsRound(dist)} m de ${e['uName']}; a marcação vale até $radius m');
          }
          final last = await tx.one('SELECT recorded_at FROM time_records WHERE employment_id = @e ORDER BY recorded_at DESC LIMIT 1', {'e': e['id']});
          if (last != null && now.difference(last['recordedAt']! as DateTime).inMilliseconds < 60000) throw conflict('Marcação repetida: aguarde 1 minuto entre marcações');
          final key = 'web:$nonce';
          if (await tx.one('SELECT 1 FROM time_records WHERE idempotency_key = @k', {'k': key}) != null) throw conflict('Este desafio já foi usado');
          final lastHash = await tx.scalar<String>('SELECT hash FROM time_records WHERE employment_id = @e ORDER BY received_at DESC LIMIT 1', {'e': e['id']});
          final hash = sha256Hex(utf8.encode([lastHash ?? '', e['id'], isoMs(now), 'WEB', nonce].join('|')));
          // REP-P: NSR sequencial por empresa (linha travada na mesma transação) e hash do registro tipo 7.
          final nsr = (await tx.scalar<int>(
            'INSERT INTO rep_p_registers (id, tenant_id, company_id, last_nsr, updated_at) VALUES (gen_random_uuid(), @t, @c, 1, now()) '
            'ON CONFLICT (company_id) DO UPDATE SET last_nsr = rep_p_registers.last_nsr + 1, updated_at = now() RETURNING last_nsr',
            {'t': tenantId, 'c': companyId},
          ))!;
          final prev = nsr > 1 ? await tx.scalar<String>('SELECT rep_p_hash FROM time_records WHERE rep_p_company_id = @c AND rep_p_nsr = @n', {'c': companyId, 'n': nsr - 1}) : null;
          final cpf = await tx.scalar<String>('SELECT p.cpf FROM employment_relationships e JOIN people p ON p.id = e.person_id WHERE e.id = @e', {'e': e['id']}) ?? '';
          final rec7 = core.afdRecord7(nsr: nsr, at: now, cpf: cpf, recordedAt: now, collector: appDevice != null ? '01' : '02', offline: false, previousHash: prev);
          final rec = await tx.insert('time_records', {
            'tenantId': tenantId, 'employmentId': e['id'], 'recordedAt': now, 'source': 'WEB', 'hash': hash, 'previousHash': lastHash, 'idempotencyKey': key,
            'repPCompanyId': companyId, 'repPNsr': nsr, 'repPHash': rec7.hash,
            'latitude': input['latitude'] == null ? null : untyped(input['latitude'].toString()),
            'longitude': input['longitude'] == null ? null : untyped(input['longitude'].toString()), 'accuracyM': input['accuracy'],
          });
          await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'CREATE', entity: 'time_record', entityId: rec['id'] as String?,
              after: {'employmentId': e['id'], 'recordedAt': now, 'source': 'WEB', 'ip': ctx.ip, 'appDevice': appDevice?['name']}, meta: ctx.meta);
          final footer = await tx.scalar<String>("SELECT text FROM custom_texts WHERE key = 'PUNCH_RECEIPT_FOOTER'");
          return {
            'id': rec['id'], 'recordedAt': isoMs(now), 'date': today, 'time': localBr(now).time, 'hash': hash,
            'employee': e['socialName'] ?? e['fullName'], 'registration': e['registration'], 'company': e['cTradeName'] ?? e['cLegalName'], 'cnpj': e['cCnpj'],
            'appDevice': appDevice?['name'], 'footer': footer, 'nsr': nsr,
          };
        });
      });
    });

    // ------------------------------------------------------------------ banco de horas
    r.group('/v1/bank', tag: 'bancos', () {
      r.get('/policy', permission: 'time.bank:read', (ctx) {
        final q = companyQuery.parse(ctx.query);
        return db.forTenant(ctx.tenant, (tx) async {
          await requireCompanyExists(tx, q['companyId']);
          return await tx.one('SELECT * FROM bank_policies WHERE company_id = @c', {'c': q['companyId']}) ??
              {
                'companyId': q['companyId'], 'enabled': false, 'expirationDays': 180, 'maxDailyCreditMinutes': null, 'creditMultipliers': <String, Object?>{},
                'compensationEnabled': false, 'compensationPeriod': 'WEEK', 'compensationLeftover': 'BANK', 'configured': false,
              };
        });
      });

      r.put('/policy', permission: 'time.compensation:manage', (ctx) {
        final input = _bankPolicy.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await requireCompanyExists(tx, input['companyId']);
          final before = await tx.one('SELECT * FROM bank_policies WHERE company_id = @c', {'c': input['companyId']});
          final data = {
            'enabled': input['enabled'], 'expirationDays': input['expirationDays'], 'maxDailyCreditMinutes': input['maxDailyCreditMinutes'],
            'creditMultipliers': jsonb(input['creditMultipliers']), 'compensationEnabled': input['compensationEnabled'],
            'compensationPeriod': input['compensationPeriod'], 'compensationLeftover': input['compensationLeftover'],
          };
          final p = before == null
              ? await tx.insert('bank_policies', {'tenantId': tenantId, 'companyId': input['companyId'], ...data})
              : (await tx.update('bank_policies', before['id']! as String, data))!;
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: before == null ? 'CREATE' : 'UPDATE', entity: 'bank_policy', entityId: p['id'] as String?,
              before: before, after: p, meta: ctx.meta);
          return p;
        });
      });

      r.get('/me', permission: 'time.records:create', (ctx) async {
        final q = Obj({'employmentId': uuid.optional}).parse(ctx.query);
        final tenantId = ctx.tenant;
        final mine = await db.forTenant(tenantId, (tx) => myEmployments(tx, ctx.user));
        final e = q['employmentId'] != null ? mine.where((m) => m['id'] == q['employmentId']).firstOrNull : mine.firstOrNull;
        if (e == null) throw notFound('Vínculo não encontrado');
        return statement(tenantId, e['id']! as String);
      });

      r.get('/compensation/:employmentId', permission: 'time.bank:read', (ctx) async {
        final id = ctx.uuidParam('employmentId');
        final q = _period({}, 63, 'Período de até 63 dias').parse(ctx.query);
        final tenantId = ctx.tenant;
        final e = await _emp(tenantId, id);
        final policy = await db.forTenant(tenantId, (tx) => tx.one('SELECT * FROM bank_policies WHERE company_id = @c', {'c': e.companyId}));
        final period = policy?['compensationPeriod'] as String? ?? 'WEEK', leftover = policy?['compensationLeftover'] as String? ?? 'BANK';
        final days = (await core0.compute(tenantId, [e], q['from']! as String, q['to']! as String))[e.id]!;
        final results = [for (final d in days) if (d['result'] is Map) resultFromJson({...(d['result']! as Map).cast<String, Object?>(), 'date': d['date']})];
        return {
          'employment': {'id': e.id, 'registration': e.registration, 'name': e.name}, 'enabled': policy?['compensationEnabled'] == true,
          'period': period, 'leftover': leftover, 'periods': compensate(results, period, leftover).periods,
        };
      });

      r.get('/balances', permission: 'time.bank:read', (ctx) {
        final q = companyQuery.parse(ctx.query);
        return db.forTenant(ctx.tenant, (tx) async {
          final rows = await tx.query(
            'SELECT e.id, e.registration, e.status::text AS status, p.full_name, p.social_name, a.balance_minutes, a.updated_at FROM employment_relationships e '
            'JOIN people p ON p.id = e.person_id LEFT JOIN bank_hours a ON a.employment_id = e.id WHERE e.company_id = @c AND e.deleted_at IS NULL ORDER BY p.full_name ASC',
            {'c': q['companyId']},
          );
          return [
            for (final x in rows)
              {'employmentId': x['id'], 'registration': x['registration'], 'status': x['status'], 'name': x['socialName'] ?? x['fullName'],
                'balanceMinutes': x['balanceMinutes'] ?? 0, 'updatedAt': x['updatedAt']},
          ];
        });
      });

      r.get('/statement/:employmentId', permission: 'time.bank:read', (ctx) {
        final id = ctx.uuidParam('employmentId');
        final q = Obj({'from': date.optional, 'to': date.optional}).parse(ctx.query);
        return statement(ctx.tenant, id, q['from'] as String?, q['to'] as String?);
      });

      r.post('/transactions', permission: 'time.bank:manage', (ctx) {
        final input = _bankTx.parse(ctx.body);
        final user = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final ids = (input['employmentIds']! as List).cast<String>().toSet().toList();
          final emps = await tx.query('SELECT id FROM employment_relationships WHERE id::text = ANY(@ids) AND deleted_at IS NULL', {'ids': ids});
          if (emps.length != ids.length) throw notFound('Funcionário não encontrado');
          final minutes = input['type'] == 'ADJUSTMENT' ? input['minutes']! as int : -((input['minutes']! as int).abs());
          for (final e in emps) {
            final acc = await _account(tx, tenantId, e['id']! as String);
            await tx.insert('bank_hour_transactions', {
              'tenantId': tenantId, 'accountId': acc['id'], 'type': input['type'], 'minutes': minutes, 'refDate': input['refDate'], 'description': input['description'], 'createdById': user.id,
            });
            await tx.execute('UPDATE bank_hours SET balance_minutes = balance_minutes + @m, updated_at = now() WHERE id = @id', {'m': minutes, 'id': acc['id']});
          }
          await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'CREATE', entity: 'bank_transaction',
              after: {...input, 'minutes': minutes, 'employments': ids.length}, meta: ctx.meta);
          return {'created': emps.length};
        });
      });

      // Zerar em lote: lança o contrário do saldo atual de cada funcionário (pagamento ou ajuste).
      r.post('/reset', permission: 'time.bank:manage', status: 200, (ctx) {
        final input = _bankReset.parse(ctx.body);
        final user = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final ids = (input['employmentIds'] as List?)?.cast<String>();
          final accounts = await tx.query(
            'SELECT a.* FROM bank_hours a JOIN employment_relationships e ON e.id = a.employment_id WHERE e.company_id = @c AND e.deleted_at IS NULL'
            '${ids != null && ids.isNotEmpty ? ' AND e.id::text = ANY(@ids)' : ''}',
            {'c': input['companyId'], 'ids': ids},
          );
          var n = 0, total = 0;
          for (final a in accounts) {
            final b = a['balanceMinutes']! as int;
            if (b == 0 || (input['only'] == 'POSITIVE' && b < 0) || (input['only'] == 'NEGATIVE' && b > 0)) continue;
            if (input['type'] == 'PAYOUT' && b < 0) continue; // saldo negativo não se "paga"
            await tx.insert('bank_hour_transactions', {
              'tenantId': tenantId, 'accountId': a['id'], 'type': input['type'], 'minutes': -b, 'refDate': input['refDate'], 'description': input['description'], 'createdById': user.id,
            });
            await tx.update('bank_hours', a['id']! as String, {'balanceMinutes': 0});
            n++;
            total += b;
          }
          await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'bank_reset', after: {...input, 'accounts': n, 'totalMinutes': total}, meta: ctx.meta);
          return {'zeroed': n, 'totalMinutes': total};
        });
      });
    });

    // ------------------------------------------------------------------ fluxos e solicitações
    r.group('/v1/approval-flows', tag: 'solicitações', () {
      r.get('', permission: 'requests.requests:read', (ctx) {
        final q = companyQuery.parse(ctx.query);
        return db.forTenant(ctx.tenant, (tx) => tx.query('SELECT *, request_type::text AS request_type FROM approval_flows WHERE company_id = @c ORDER BY request_type ASC', {'c': q['companyId']}));
      });
      r.put('', permission: 'requests.flows:manage', (ctx) {
        final input = _flow.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await requireCompanyExists(tx, input['companyId']);
          for (final s in (input['steps']! as List).cast<Map<String, Object?>>()) {
            if (s['roleId'] != null && await tx.one('SELECT 1 FROM roles WHERE id = @r AND (tenant_id = @t OR tenant_id IS NULL)', {'r': s['roleId'], 't': tenantId}) == null) {
              throw notFound('Perfil não encontrado');
            }
          }
          final existing = await tx.one('SELECT * FROM approval_flows WHERE company_id = @c AND request_type = @rt', {'c': input['companyId'], 'rt': input['requestType']});
          final f = existing != null
              ? (await tx.one('UPDATE approval_flows SET steps = @s, is_active = @a WHERE id = @id RETURNING *, request_type::text AS request_type',
                  {'s': jsonb(input['steps']), 'a': input['isActive'], 'id': existing['id']}))!
              : (await tx.one(
                  'INSERT INTO approval_flows (id, tenant_id, company_id, request_type, steps, is_active) VALUES (gen_random_uuid(), @t, @c, @rt, @s, @a) RETURNING *, request_type::text AS request_type',
                  {'t': tenantId, 'c': input['companyId'], 'rt': input['requestType'], 's': jsonb(input['steps']), 'a': input['isActive']}))!;
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: existing != null ? 'UPDATE' : 'CREATE', entity: 'approval_flow', entityId: f['id'] as String?,
              before: existing, after: f, meta: ctx.meta);
          return f;
        });
      });
    });

    r.group('/v1/requests', tag: 'solicitações', () {
      r.get('', permission: 'requests.requests:read', (ctx) {
        final q = Obj({'status': const Enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional, 'companyId': uuid.optional}).parse(ctx.query);
        return db.forTenant(ctx.tenant, (tx) async {
          final rows = await tx.query('$_reqSelect WHERE TRUE${q['status'] != null ? ' AND r.status = @s' : ''}${q['companyId'] != null ? ' AND e.company_id = @c' : ''} ORDER BY r.created_at DESC LIMIT 500',
              {'s': q['status'], 'c': q['companyId']});
          return [for (final x in rows) await _shapeRequest(tx, x)];
        });
      });

      r.get('/mine', permission: 'requests.requests:create', (ctx) {
        final user = ctx.user;
        return db.forTenant(ctx.tenant, (tx) async {
          final rows = await tx.query('$_reqSelect WHERE r.created_by_id = @u OR (@p::uuid IS NOT NULL AND e.person_id = @p::uuid) ORDER BY r.created_at DESC LIMIT 200', {'u': user.id, 'p': user.personId});
          return [for (final x in rows) await _shapeRequest(tx, x)];
        });
      });

      r.get('/inbox', permission: 'requests.requests:create', (ctx) {
        final user = ctx.user;
        return db.forTenant(ctx.tenant, (tx) async {
          final rows = await tx.query("$_reqSelect WHERE r.status = 'PENDING' ORDER BY r.created_at ASC LIMIT 500");
          return [for (final x in rows) if (await _canDecide(tx, user, x)) await _shapeRequest(tx, x)];
        });
      });

      r.post('', permission: 'requests.requests:create', (ctx) {
        final schema = _requestSchemas[ctx.json['type']] ?? (throw badRequest(['type: Invalid input']));
        final input = schema.parse(ctx.body);
        final user = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          var employmentId = input['employmentId'] as String?;
          if (employmentId == null || user.personId != null) {
            final mine = user.personId != null ? await myEmployments(tx, user) : <Row>[];
            if (employmentId == null) {
              if (mine.isEmpty) throw forbidden('Seu usuário não está ligado a um funcionário: peça ao RH para fazer o vínculo em Usuários');
              employmentId = mine.first['id']! as String;
            } else if (!mine.any((m) => m['id'] == employmentId) && !can(user, 'time.adjustments:create')) {
              throw forbidden('Você só pode abrir solicitações para os seus vínculos');
            }
          } else if (!can(user, 'time.adjustments:create')) {
            throw forbidden('Você só pode abrir solicitações para os seus vínculos');
          }
          final e = await tx.one('SELECT id, company_id FROM employment_relationships WHERE id = @id AND deleted_at IS NULL', {'id': employmentId});
          if (e == null) throw notFound('Funcionário não encontrado');
          final payload = (input['payload']! as Map).cast<String, Object?>();
          final refDate = input['refDate'] as String?;
          if (refDate != null) {
            final end = input['type'] == 'SCHEDULE_CHANGE' ? ([refDate, payload['offDate']! as String]..sort()).last : refDate;
            await assertOpenPeriod(tx, [e['companyId']! as String], refDate, end);
          }
          if (input['type'] == 'ABSENCE_JUSTIFICATION') {
            if (await tx.one('SELECT 1 FROM justifications WHERE id = @id AND deleted_at IS NULL AND active', {'id': payload['justificationId']}) == null) {
              throw notFound('Justificativa não encontrada');
            }
            if (payload['fullDay'] == false && payload['minutes'] == null) throw badRequest('Informe os minutos');
          }
          final flow = await tx.one('SELECT id FROM approval_flows WHERE company_id = @c AND request_type = @t AND is_active', {'c': e['companyId'], 't': input['type']});
          final created = await tx.insert('time_requests', {
            'tenantId': tenantId, 'employmentId': e['id'], 'type': input['type'], 'refDate': refDate, 'payload': jsonb(payload), 'justification': input['justification'],
            'flowId': flow?['id'], 'createdById': user.id,
          });
          final x = (await tx.one('$_reqSelect WHERE r.id = @id', {'id': created['id']}))!;
          await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'CREATE', entity: 'time_request', entityId: created['id'] as String?, after: created, meta: ctx.meta);
          return _shapeRequest(tx, x);
        });
      });

      r.post('/:id/decide', permission: 'requests.requests:create', status: 200, (ctx) async {
        final id = ctx.uuidParam('id');
        final b = _requestDecision.parse(ctx.body);
        final user = ctx.user, tenantId = ctx.tenant;
        final x = await db.forTenant(tenantId, (tx) async {
          final x = await tx.one('$_reqSelect WHERE r.id = @id', {'id': id});
          if (x == null) throw notFound('Solicitação não encontrada');
          if (x['status'] != 'PENDING') throw conflict('Esta solicitação já foi decidida');
          if (!await _canDecide(tx, user, x)) throw forbidden('Você não é o aprovador desta etapa');
          return x;
        });
        final steps = _steps(x);
        final step = x['currentStep']! as int;
        final last = step >= steps.length - 1;
        final decision = b['decision']! as String;
        // Efeito antes de registrar a aprovação final: se não puder ser aplicado, nada muda.
        if (decision == 'APPROVED' && last) await _applyRequest(tenantId, user, x, ctx.meta);
        return db.forTenant(tenantId, (tx) async {
          await tx.insert('request_decisions', {'tenantId': tenantId, 'requestId': id, 'step': step, 'decision': decision, 'comment': b['comment'], 'deciderId': user.id});
          await tx.update('time_requests', id, decision == 'REJECTED' ? {'status': 'REJECTED'} : last ? {'status': 'APPROVED'} : {'currentStep': step + 1});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: decision == 'APPROVED' ? 'APPROVE' : 'REJECT', entity: 'time_request', entityId: id,
              after: {'step': step, 'decision': decision, 'comment': b['comment'], 'final': last || decision == 'REJECTED'}, meta: ctx.meta);
          return _shapeRequest(tx, (await tx.one('$_reqSelect WHERE r.id = @id', {'id': id}))!);
        });
      });

      r.post('/:id/cancel', permission: 'requests.requests:create', status: 200, (ctx) {
        final id = ctx.uuidParam('id');
        final user = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final x = await tx.one('$_reqSelect WHERE r.id = @id', {'id': id});
          if (x == null) throw notFound('Solicitação não encontrada');
          if (x['createdById'] != user.id) throw forbidden('Só quem abriu pode cancelar');
          if (x['status'] != 'PENDING') throw conflict('Só solicitações pendentes podem ser canceladas');
          await tx.update('time_requests', id, {'status': 'CANCELLED'});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'time_request', entityId: id, after: {'status': 'CANCELLED'}, meta: ctx.meta);
          return _shapeRequest(tx, (await tx.one('$_reqSelect WHERE r.id = @id', {'id': id}))!);
        });
      });
    });
  }

  // ------------------------------------------------------------------ AEJ (Portaria 671)
  Future<Map<String, Object?>> _aej(String tenantId, Map<String, Object?> q) async {
    final companyId = q['companyId']! as String, from = q['from']! as String, to = q['to']! as String;
    String hhmm(Object? v) => v == null ? '' : (v as String).replaceFirst(':', '');
    String clean(String v) => v.replaceAll(RegExp(r'[|\r\n]'), ' ').trim();
    String cut(String v, int n) => v.length > n ? v.substring(0, n) : v;
    final data = await db.forTenant(tenantId, (tx) async {
      final company = await tx.one('SELECT * FROM companies WHERE id = @c AND deleted_at IS NULL', {'c': companyId});
      if (company == null) throw notFound('Empresa não encontrada');
      final emps = await tx.query(
        'SELECT e.id, e.company_id, e.rule_set_id, e.registration, e.status::text AS status, e.hired_at, e.terminated_at, p.full_name, p.social_name, p.cpf '
        'FROM employment_relationships e JOIN people p ON p.id = e.person_id WHERE e.company_id = @c AND e.deleted_at IS NULL AND e.hired_at <= @to '
        'AND (e.terminated_at IS NULL OR e.terminated_at >= @from) ORDER BY e.registration ASC',
        {'c': companyId, 'from': from, 'to': to},
      );
      final assignments = await tx.query(
          'SELECT a.employment_id, s.id, s.code, s.name FROM schedule_assignments a JOIN work_schedules s ON s.id = a.schedule_id '
          'WHERE a.employment_id::text = ANY(@ids) AND a.valid_from <= @to AND (a.valid_to IS NULL OR a.valid_to >= @from)',
          {'ids': [for (final e in emps) e['id']! as String], 'from': from, 'to': to});
      final schedDays = assignments.isEmpty
          ? <Row>[]
          : await tx.query('SELECT * FROM work_schedule_days WHERE schedule_id::text = ANY(@s)', {'s': {for (final a in assignments) a['id']! as String}.toList()});
      final devices = await tx.query('SELECT id, rep_number, ordinance::text AS ordinance FROM devices WHERE company_id = @c AND deleted_at IS NULL', {'c': companyId});
      final repP = await tx.one('SELECT inpi_number FROM rep_p_registers WHERE company_id = @c', {'c': companyId});
      final bank = await tx.query(
          "SELECT t.type::text AS type, t.minutes, t.ref_date, a.employment_id FROM bank_hour_transactions t JOIN bank_hours a ON a.id = t.account_id "
          "JOIN employment_relationships e ON e.id = a.employment_id WHERE e.company_id = @c AND t.ref_date BETWEEN @from AND @to AND t.type IN ('CREDIT', 'DEBIT', 'COMPENSATION')",
          {'c': companyId, 'from': from, 'to': to});
      final records = await tx.query('SELECT id, device_id FROM time_records WHERE employment_id::text = ANY(@ids)', {'ids': [for (final e in emps) e['id']! as String]});
      return (company: company, emps: emps, assignments: assignments, schedDays: schedDays, devices: devices, repP: repP, bank: bank, records: records);
    });
    final cnpj = data.company['cnpj'] as String?;
    if (cnpj == null) throw badRequest('A empresa precisa de CNPJ para gerar o AEJ');
    final warnings = <String>[];
    final days = await core0.compute(tenantId, [for (final e in data.emps) Emp(e)], from, to);

    // 02: registradores. REP-P (navegador/app) = id 1; relógios com número de fabricação a partir do 2.
    final reps = <String, ({int id, int tp, String nr})>{'WEB': (id: 1, tp: 3, nr: data.repP?['inpiNumber'] as String? ?? '0' * 17)};
    if (data.repP?['inpiNumber'] == null) warnings.add('O número do REP-P (registro do programa no INPI) ainda não foi informado: saiu com zeros.');
    var next = 2;
    for (final d in data.devices) {
      if (d['repNumber'] == null) {
        warnings.add('Há relógio sem número de fabricação (17 dígitos): as marcações dele saem como REP-P.');
        continue;
      }
      reps[d['id']! as String] = (id: next++, tp: d['ordinance'] == 'P373_2011' ? 2 : 1, nr: d['repNumber']! as String);
    }
    ({int id, int tp, String nr}) repOf(String? deviceId) => reps[deviceId ?? 'WEB'] ?? reps['WEB']!;
    final deviceOfRecord = {for (final x in data.records) x['id']: x['deviceId'] as String?};

    // 04: horários contratuais usados no período.
    final horarios = <String, ({String cod, String line})>{};
    for (final a in data.assignments) {
      final sid = a['id']! as String;
      if (horarios.containsKey(sid)) continue;
      final ds = data.schedDays.where((x) => x['scheduleId'] == sid && x['isWorkday'] == true && x['startTime'] != null && x['endTime'] != null).toList()
        ..sort((x, y) => (x['dayIndex']! as int).compareTo(y['dayIndex']! as int));
      final d = ds.firstOrNull;
      final cod = cut(clean(a['code'] as String? ?? '${horarios.length + 1}'), 30);
      var e1 = hhmm(d?['startTime']), s1 = hhmm(d?['endTime']), e2 = '', s2 = '';
      if (d?['breakStart'] != null && (d?['breakMinutes'] as int? ?? 0) > 0) {
        final bs = d!['breakStart']! as String;
        final b = int.parse(bs.substring(0, 2)) * 60 + int.parse(bs.substring(3)) + (d['breakMinutes']! as int);
        s1 = hhmm(bs);
        e2 = '${((b % 1440) ~/ 60).toString().padLeft(2, '0')}${(b % 60).toString().padLeft(2, '0')}';
        s2 = hhmm(d['endTime']);
      }
      horarios[sid] = (cod: cod, line: ['04', cod, '${d?['expectedMinutes'] ?? 0}', e1, s1, e2, s2].join('|'));
    }

    final lines = <String>[];
    final count = <String, int>{};
    void push(String l) {
      lines.add(l);
      final k = l.substring(0, 2);
      count[k] = (count[k] ?? 0) + 1;
    }

    final now = localBr(DateTime.now());
    final cno = core.onlyDigits(data.company['cno'] as String? ?? '');
    push(['01', '1', core.onlyDigits(cnpj).padLeft(14, '0').substring(core.onlyDigits(cnpj).padLeft(14, '0').length - 14), '', cno.length == 12 ? cno : '',
      cut(clean(data.company['legalName']! as String), 150), from, to, '${now.date}T${now.time}:00-0300', '001'].join('|'));
    for (final x in reps.values.toList()..sort((a, b) => a.id.compareTo(b.id))) {
      push(['02', '${x.id}', '${x.tp}', x.nr].join('|'));
    }
    final vinc = <String, int>{};
    for (final e in data.emps) {
      if (e['cpf'] == null) {
        warnings.add('Matrícula ${e['registration']} sem CPF: fora do AEJ.');
        continue;
      }
      vinc[e['id']! as String] = vinc.length + 1;
      push(['03', '${vinc[e['id']]}', e['cpf'], cut(clean(e['fullName']! as String), 150)].join('|'));
    }
    for (final h in horarios.values) {
      push(h.line);
    }
    for (final e in data.emps) {
      final v = vinc[e['id']];
      if (v == null) continue;
      final firstAssign = data.assignments.where((a) => a['employmentId'] == e['id']).firstOrNull;
      final cod = firstAssign == null ? '' : horarios[firstAssign['id']]?.cod ?? '';
      for (final d in days[e['id']] ?? const <Map<String, Object?>>[]) {
        var seq = 0;
        final punches = ((d['punches'] as List?) ?? const []).cast<Map<String, Object?>>();
        final valid = punches.where((p) => p['status'] == 'ORIGINAL' || p['status'] == 'INCLUDED').toList();
        for (final p in punches) {
          final st = p['status']! as String;
          if (st.startsWith('PENDING')) continue;
          final idx = valid.indexOf(p);
          final tp = st == 'DISREGARDED' ? 'D' : idx % 2 == 0 ? 'E' : 'S';
          if (tp != 'D' && idx % 2 == 0) seq++;
          final fonte = st == 'INCLUDED' ? 'I' : 'O';
          final rep = repOf(st == 'INCLUDED' ? null : deviceOfRecord[p['id']]);
          push(['05', '$v', '${p['date']}T${p['time']}:00-0300', '${rep.id}', tp, tp == 'D' ? '' : '$seq', fonte, cod,
            fonte == 'I' || tp == 'D' ? cut(clean(p['justification'] as String? ?? ''), 150) : ''].join('|'));
        }
      }
      push(['06', '$v', cut(clean(e['registration']! as String), 30)].join('|'));
      for (final d in days[e['id']] ?? const <Map<String, Object?>>[]) {
        final res = d['result'] as Map?;
        if (((res?['flags'] as List?)?.contains('ABSENCE') ?? false) && (d['allowance'] as Map?)?['disregardsDebits'] != true) {
          final abs = (res!['absenceMinutes'] as num?)?.toInt() ?? 0;
          push(['07', '$v', '2', d['date'], '${abs != 0 ? abs : ((res['balanceMinutes'] as num?)?.toInt() ?? 0).abs()}', ''].join('|'));
        }
      }
      for (final b in data.bank.where((x) => x['employmentId'] == e['id'])) {
        final m = b['minutes']! as int;
        push(['07', '$v', '3', isoDay(b['refDate']), '${m.abs()}', m > 0 ? '1' : '2'].join('|'));
      }
    }
    push(['08', 'SuperPonto', '2.0', '1', '', 'SuperPonto', ''].join('|'));
    push(['99', ...['01', '02', '03', '04', '05', '06', '07', '08'].map((k) => '${count[k] ?? 0}')].join('|'));
    return {
      'filename': 'AEJ_${core.onlyDigits(cnpj)}_${from}_$to.txt',
      'content': '${lines.join('\r\n')}\r\n',
      'totals': {'vinculos': vinc.length, 'marcacoes': count['05'] ?? 0, 'horarios': horarios.length, 'ausencias': count['07'] ?? 0},
      'warnings': warnings.toSet().toList(),
    };
  }
}

Future<void> requireCompanyExists(Tx tx, Object? id) async {
  if (await tx.one('SELECT 1 FROM companies WHERE id = @id AND deleted_at IS NULL', {'id': id}) == null) throw notFound('Empresa não encontrada');
}

/// Contexto interno para reaproveitar uma rota já validada (efeito de solicitação aprovada).
class _InternalCtx extends Ctx {
  _InternalCtx(AuthUser user, this._tenant, Map<String, Object?> body, this._meta) : super(_fakeRequest, const {}, body) {
    this.user = user;
  }
  final String _tenant;
  final Map<String, Object?> _meta;
  @override
  String get tenant => _tenant;
  @override
  Map<String, Object?> get meta => _meta;
}

final _fakeRequest = Request('POST', Uri.parse('http://internal/'));
