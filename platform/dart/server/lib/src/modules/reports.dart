// Relatórios com filtros padronizados, montador por campos e exportação CSV (ponto e vírgula, UTF-8 com BOM) ou XLSX.
import 'dart:convert';
import 'dart:math' as math;

import 'package:sp_core/sp_core.dart' as core;

import '../app.dart';
import '../auth/auth_user.dart';
import '../crypto/tokens.dart' show sha256Hex;
import '../db.dart';
import '../generated/catalog.dart';
import '../http.dart';
import '../validate.dart';
import '../xlsx.dart';
import 'holidays.dart';
import 'people.dart' show maskCpf;
import 'schedules.dart' show isoDay;
import 'timesheet_core.dart';

class Col {
  const Col(this.key, this.label, [this.type]);
  final String key, label;
  final String? type;
  Map<String, Object?> toJson() => {'key': key, 'label': label, 'type': ?type};
}

typedef Days = Map<String, List<Map<String, Object?>>>;

class RCtx {
  RCtx(this.tenantId, this.user, this.f, this._emps, this._days, this.db);
  final String tenantId;
  final AuthUser user;
  final Map<String, Object?> f;
  final Future<List<Emp>> Function() _emps;
  final Future<Days> Function() _days;
  final Db db;
  List<Emp>? _e;
  Days? _d;
  Future<List<Emp>> emps() async => _e ??= await _emps();
  Future<Days> days() async => _d ??= await _days();
  Future<T> tx<T>(Future<T> Function(Tx tx) fn) => db.forTenant(tenantId, fn);
  String get from => f['from']! as String;
  String get to => f['to']! as String;
  DateTime get fromAt => brMidnight(from);
  DateTime get toAt => brMidnight(to).add(const Duration(days: 1));
}

class ReportDef {
  const ReportDef({required this.key, required this.title, required this.category, required this.period, required this.description, required this.run, this.columns, this.columnsFn, this.permission});
  final String key, title, category, period, description;
  final String? permission;
  final List<Col>? columns;
  final Future<List<Col>> Function(RCtx ctx)? columnsFn;
  final Future<List<Map<String, Object?>>> Function(RCtx ctx) run;
}

final filtersSchema = Obj({
  'companyId': uuid,
  'from': date.optional,
  'to': date.optional,
  'departmentId': uuid.optional,
  'includeSubdepartments': const Bool().def(true),
  'groupingId': uuid.optional,
  'employeeTypeId': uuid.optional,
  'employmentIds': const Arr(uuid, max: 2000).optional,
  'status': const Enum(['ACTIVE', 'ALL']).def('ACTIVE'),
  'fields': const Arr(Str(max: 40), max: 30).optional,
});

const _emp = [Col('registration', 'Matrícula'), Col('name', 'Funcionário'), Col('department', 'Departamento')];
final _emp2 = _emp.sublist(0, 2);
String _dmy(String v) => v.split('-').reversed.join('/');
Map<String, Object?> _base(Emp e) => {'registration': e.registration, 'name': e.name, 'department': e.row['dName'] ?? '', 'position': e.row['jpName'] ?? ''};
List<Map<String, Object?>> _punches(Map<String, Object?> d) => ((d['punches'] as List?) ?? const []).cast<Map<String, Object?>>();
String _punchList(Map<String, Object?> d) => [
  for (final p in _punches(d))
    if (p['status'] == 'ORIGINAL' || p['status'] == 'INCLUDED') p['time'],
].join(' ');
Map<String, Object?>? _res(Map<String, Object?> d) => (d['result'] as Map?)?.cast<String, Object?>();
int _n(Map<String, Object?>? r, String k) => (r?[k] as num?)?.toInt() ?? 0;
List<String> _flagsOf(Map<String, Object?>? r) => [for (final f in (r?['flags'] as List?) ?? const []) f.toString()];
Map<String, Object?> _exp(Map<String, Object?> d) => (d['expected'] as Map?)?.cast<String, Object?>() ?? const {};
const _flagLabel = {
  'ABSENCE': 'Falta',
  'INCOMPLETE': 'Marcação ímpar',
  'LATE': 'Atraso',
  'EARLY_LEAVE': 'Saída antecipada',
  'INSUFFICIENT_BREAK': 'Intervalo curto',
  'OVERTIME_LIMIT_EXCEEDED': 'Extra acima do limite',
  'WORK_ON_REST_DAY': 'Trabalho na folga',
  'WORK_ON_HOLIDAY': 'Trabalho no feriado',
  'LEAVE_FULL': 'Abonado',
  'JUSTIFIED': 'Justificado',
  'OVERTIME_UNAUTHORIZED': 'Extra sem autorização',
  'BREAK_EXCEEDED': 'Intervalo excedido',
};
String _flags(Map<String, Object?> d) => [
  for (final f in _flagsOf(_res(d)))
    if (_flagLabel[f] != null) _flagLabel[f],
].join(', ');

Future<List<(Emp, Map<String, Object?>)>> _perDay(RCtx ctx) async {
  final emps = await ctx.emps(), days = await ctx.days();
  return [
    for (final e in emps)
      for (final d in days[e.id] ?? const <Map<String, Object?>>[]) (e, d),
  ];
}

List<Map<String, Object?>> _results(Days days, Emp e) => [
  for (final d in days[e.id] ?? const <Map<String, Object?>>[])
    if (_res(d) != null) _res(d)!,
];
int _sumR(List<Map<String, Object?>> r, String k) => r.fold(0, (s, x) => s + _n(x, k));
String _iso(Object? v) => v is DateTime ? isoMs(v) : (v?.toString() ?? '');
String _planText(Map<String, Object?> d) {
  final x = _exp(d);
  final lv = d['leave'] as Map?;
  if (lv != null) return lv['label'].toString();
  if (x['isHoliday'] == true) return (x['holidayName'] ?? 'Feriado').toString();
  return x['isWorkday'] == true ? '${x['start'] ?? ''}–${x['end'] ?? ''}' : 'Folga';
}

const _whereEmp = 'employment_id::text = ANY(@ids)';
List<String> _ids(List<Emp> emps) => [for (final e in emps) e.id];

/// Hash do espelho (o mesmo da ciência eletrônica): muda quando qualquer número ou marcação muda.
({String hash, Map<String, Object?> summary}) mirrorHashOf(String employmentId, String from, String to, List<Map<String, Object?>> list) {
  final days = [
    for (final d in list)
      {
        'date': d['date'],
        'punches': [for (final p in _punches(d)) '${p['time']}:${p['status']}'],
        'r': _res(d) == null
            ? null
            : [
                for (final k in ['expectedMinutes', 'workedMinutes', 'balanceMinutes', 'lateMinutes', 'absenceMinutes', 'nightMinutes', 'overtimeMinutes']) _n(_res(d), k),
              ],
        'allowance': (d['allowance'] as Map?)?['justification'],
        'leave': (d['leave'] as Map?)?['type'],
      },
  ];
  final r = [
    for (final d in list)
      if (_res(d) != null) _res(d)!,
  ];
  final summary = {
    'expected': _sumR(r, 'expectedMinutes'),
    'worked': _sumR(r, 'workedMinutes'),
    'balance': _sumR(r, 'balanceMinutes'),
    'overtime': _sumR(r, 'overtimeMinutes'),
    'late': _sumR(r, 'lateMinutes'),
    'early': _sumR(r, 'earlyLeaveMinutes'),
    'absenceDays': r.where((x) => _flagsOf(x).contains('ABSENCE')).length,
    'night': _sumR(r, 'nightMinutes'),
  };
  final json = jsonEncode({'e': employmentId, 'from': from, 'to': to, 'days': days, 'summary': summary});
  return (hash: sha256Hex(utf8.encode(json)), summary: summary);
}

final reports = <ReportDef>[
  // ------------------------------------------------------------- Ponto
  ReportDef(
    key: 'horas-trabalhadas',
    title: 'Horas trabalhadas',
    category: 'Ponto',
    period: 'required',
    description: 'Previsto, trabalhado, saldo, extras, noturno, faltas e atrasos por funcionário.',
    columns: [
      ..._emp,
      const Col('expected', 'Previsto', 'minutes'),
      const Col('worked', 'Trabalhado', 'minutes'),
      const Col('balance', 'Saldo', 'minutes'),
      const Col('overtime', 'Extras', 'minutes'),
      const Col('night', 'Noturno (reduzido)', 'minutes'),
      const Col('absences', 'Faltas (dias)', 'number'),
      const Col('late', 'Atrasos', 'minutes'),
    ],
    run: (ctx) async {
      final emps = await ctx.emps(), days = await ctx.days();
      return [
        for (final e in emps)
          () {
            final r = _results(days, e);
            return {
              ..._base(e),
              'expected': _sumR(r, 'expectedMinutes'),
              'worked': _sumR(r, 'workedMinutes'),
              'balance': _sumR(r, 'balanceMinutes'),
              'overtime': _sumR(r, 'overtimeMinutes'),
              'night': _sumR(r, 'nightReducedMinutes'),
              'absences': r.where((x) => _flagsOf(x).contains('ABSENCE')).length,
              'late': _sumR(r, 'lateMinutes'),
            };
          }(),
      ];
    },
  ),
  ReportDef(
    key: 'folha-conferencia',
    title: 'Folha de conferência (para a folha de pagamento)',
    category: 'Ponto',
    period: 'required',
    description: 'Horas normais, extras por percentual, noturno, faltas, abonos e sobreaviso por funcionário.',
    columnsFn: (ctx) async {
      final pcts = <num>{};
      for (final list in (await ctx.days()).values) {
        for (final d in list) {
          for (final o in (_res(d)?['overtime'] as List?) ?? const []) {
            pcts.add((o as Map)['percent']! as num);
          }
        }
      }
      return [
        ..._emp,
        const Col('normal', 'Horas normais', 'minutes'),
        for (final p in pcts.toList()..sort()) Col('ot$p', 'Extra $p%', 'minutes'),
        const Col('night', 'Adicional noturno', 'minutes'),
        const Col('absence', 'Faltas', 'minutes'),
        const Col('late', 'Atrasos e saídas', 'minutes'),
        const Col('allowances', 'Dias abonados', 'number'),
        const Col('onCall', 'Sobreaviso (1/3)', 'minutes'),
      ];
    },
    run: (ctx) async {
      final emps = await ctx.emps(), days = await ctx.days();
      return [
        for (final e in emps)
          () {
            final list = days[e.id] ?? const <Map<String, Object?>>[];
            final r = _results(days, e);
            final row = <String, Object?>{
              ..._base(e),
              'normal': r.fold<int>(0, (s, x) => s + math.max(0, _n(x, 'workedMinutes') - _n(x, 'overtimeMinutes'))),
              'night': _sumR(r, 'nightReducedMinutes'),
            };
            for (final x in r) {
              for (final o in (x['overtime'] as List?) ?? const []) {
                final k = 'ot${(o as Map)['percent']}';
                row[k] = ((row[k] as int?) ?? 0) + (o['minutes']! as num).toInt();
              }
            }
            row['absence'] = r.where((x) => _flagsOf(x).contains('ABSENCE')).fold<int>(0, (s, x) => s + math.min(0, _n(x, 'balanceMinutes')).abs());
            row['late'] = r.fold<int>(0, (s, x) => s + _n(x, 'lateMinutes') + _n(x, 'earlyLeaveMinutes'));
            row['allowances'] = list.where((d) => (d['allowance'] as Map?)?['fullDay'] == true && (d['allowance'] as Map?)?['disregardsDebits'] == true).length;
            row['onCall'] = core.jsRound(list.fold<int>(0, (s, d) => s + ((d['onCall'] as List?) ?? const []).fold<int>(0, (a, o) => a + ((o as Map)['minutes'] as num).toInt())) / 3);
            return row;
          }(),
      ];
    },
  ),
  ReportDef(
    key: 'cartao-ponto',
    title: 'Cartão ponto (espelho em lote)',
    category: 'Ponto',
    period: 'required',
    description: 'Todos os dias de cada funcionário: previsto, marcações, trabalhado, saldo e ocorrências.',
    columns: [
      ..._emp2,
      const Col('date', 'Data', 'date'),
      const Col('expected', 'Previsto'),
      const Col('punches', 'Marcações'),
      const Col('worked', 'Trabalhado', 'minutes'),
      const Col('balance', 'Saldo', 'minutes'),
      const Col('flags', 'Ocorrências'),
    ],
    run: (ctx) async => [
      for (final (e, d) in await _perDay(ctx))
        {
          'registration': e.registration,
          'name': e.name,
          'date': d['date'],
          'expected': _planText(d),
          'punches': _punchList(d),
          'worked': _n(_res(d), 'workedMinutes'),
          'balance': _n(_res(d), 'balanceMinutes'),
          'flags': _flags(d),
        },
    ],
  ),
  ReportDef(
    key: 'extras',
    title: 'Analítico de horas extras',
    category: 'Ponto',
    period: 'required',
    description: 'Cada dia com hora extra, por percentual, e se havia autorização.',
    columns: [
      ..._emp2,
      const Col('date', 'Data', 'date'),
      const Col('minutes', 'Extra', 'minutes'),
      const Col('percents', 'Percentuais'),
      const Col('unauthorized', 'Sem autorização', 'minutes'),
      const Col('kind', 'Dia'),
    ],
    run: (ctx) async => [
      for (final (e, d) in await _perDay(ctx))
        if (_n(_res(d), 'overtimeMinutes') > 0)
          {
            'registration': e.registration,
            'name': e.name,
            'date': d['date'],
            'minutes': _n(_res(d), 'overtimeMinutes'),
            'percents': [for (final o in (_res(d)!['overtime'] as List?) ?? const []) '${(o as Map)['minutes']}min a ${o['percent']}%'].join(', '),
            'unauthorized': _n(_res(d), 'unauthorizedOvertimeMinutes'),
            'kind': _flagsOf(_res(d)).contains('WORK_ON_HOLIDAY')
                ? 'Feriado'
                : _flagsOf(_res(d)).contains('WORK_ON_REST_DAY')
                ? 'Folga'
                : 'Útil',
          },
    ],
  ),
  ReportDef(
    key: 'faltas',
    title: 'Analítico de faltas',
    category: 'Ponto',
    period: 'required',
    description: 'Dias de falta, com previsto e se foram justificados.',
    columns: [..._emp, const Col('date', 'Data', 'date'), const Col('expected', 'Previsto', 'minutes'), const Col('justified', 'Justificativa')],
    run: (ctx) async => [
      for (final (e, d) in await _perDay(ctx))
        if (_flagsOf(_res(d)).contains('ABSENCE') || ((d['allowance'] as Map?)?['fullDay'] == true && _punches(d).isEmpty))
          {
            ..._base(e),
            'date': d['date'],
            'expected': _n(_res(d), 'expectedMinutes'),
            'justified': d['allowance'] == null ? '' : '${(d['allowance']! as Map)['justification']}${(d['allowance']! as Map)['disregardsDebits'] == true ? ' (abonada)' : ''}',
          },
    ],
  ),
  ReportDef(
    key: 'atrasos',
    title: 'Analítico de atrasos e saídas antecipadas',
    category: 'Ponto',
    period: 'required',
    description: 'Dias com atraso ou saída antes do horário.',
    columns: [
      ..._emp2,
      const Col('date', 'Data', 'date'),
      const Col('scheduled', 'Horário'),
      const Col('punches', 'Marcações'),
      const Col('late', 'Atraso', 'minutes'),
      const Col('early', 'Saída antecipada', 'minutes'),
    ],
    run: (ctx) async => [
      for (final (e, d) in await _perDay(ctx))
        if (_n(_res(d), 'lateMinutes') + _n(_res(d), 'earlyLeaveMinutes') > 0)
          {
            'registration': e.registration,
            'name': e.name,
            'date': d['date'],
            'scheduled': '${_exp(d)['start'] ?? ''}–${_exp(d)['end'] ?? ''}',
            'punches': _punchList(d),
            'late': _n(_res(d), 'lateMinutes'),
            'early': _n(_res(d), 'earlyLeaveMinutes'),
          },
    ],
  ),
  ReportDef(
    key: 'marcacao-incompleta',
    title: 'Marcações incompletas (ímpares)',
    category: 'Ponto',
    period: 'required',
    description: 'Dias com número ímpar de marcações, a tratar antes do fechamento.',
    columns: [..._emp2, const Col('date', 'Data', 'date'), const Col('punches', 'Marcações')],
    run: (ctx) async => [
      for (final (e, d) in await _perDay(ctx))
        if (_flagsOf(_res(d)).contains('INCOMPLETE')) {'registration': e.registration, 'name': e.name, 'date': d['date'], 'punches': _punchList(d)},
    ],
  ),
  ReportDef(
    key: 'deficit-intervalo',
    title: 'Déficit de intervalo',
    category: 'Ponto',
    period: 'required',
    description: 'Dias com intervalo menor que o mínimo (CLT art. 71), com o tempo que faltou.',
    columns: [..._emp2, const Col('date', 'Data', 'date'), const Col('break', 'Intervalo feito', 'minutes'), const Col('shortfall', 'Faltou', 'minutes')],
    run: (ctx) async => [
      for (final (e, d) in await _perDay(ctx))
        if (_flagsOf(_res(d)).contains('INSUFFICIENT_BREAK'))
          {'registration': e.registration, 'name': e.name, 'date': d['date'], 'break': _n(_res(d), 'breakMinutes'), 'shortfall': _n(_res(d), 'breakShortfallMinutes')},
    ],
  ),
  ReportDef(
    key: 'interjornada',
    title: 'Interjornada (descanso menor que 11h)',
    category: 'Ponto',
    period: 'required',
    description: 'Descanso entre o fim de uma jornada e o início da seguinte menor que 11 horas (CLT art. 66).',
    columns: [
      ..._emp2,
      const Col('date', 'Dia', 'date'),
      const Col('lastExit', 'Saída anterior', 'datetime'),
      const Col('firstEntry', 'Entrada', 'datetime'),
      const Col('rest', 'Descanso', 'minutes'),
      const Col('missing', 'Faltou para 11h', 'minutes'),
    ],
    run: (ctx) async {
      final emps = await ctx.emps(), days = await ctx.days();
      final out = <Map<String, Object?>>[];
      for (final e in emps) {
        String? prev;
        for (final d in days[e.id] ?? const <Map<String, Object?>>[]) {
          final ps = [
            for (final p in _punches(d))
              if (p['status'] == 'ORIGINAL' || p['status'] == 'INCLUDED') p,
          ];
          if (ps.isEmpty) continue;
          if (prev != null) {
            final rest = core.jsRound(DateTime.parse(ps.first['at']! as String).difference(DateTime.parse(prev)).inMilliseconds / 60000);
            if (rest >= 0 && rest < 660) {
              out.add({'registration': e.registration, 'name': e.name, 'date': d['date'], 'lastExit': prev, 'firstEntry': ps.first['at'], 'rest': rest, 'missing': 660 - rest});
            }
          }
          prev = ps.length.isEven ? ps.last['at']! as String : null;
        }
      }
      return out;
    },
  ),
  ReportDef(
    key: 'absenteismo',
    title: 'Absenteísmo',
    category: 'Ponto',
    period: 'required',
    description: 'Ausências (faltas, atrasos e saídas antecipadas) sobre as horas previstas, por funcionário.',
    columns: [..._emp, const Col('expected', 'Previsto', 'minutes'), const Col('absent', 'Ausente', 'minutes'), const Col('rate', 'Absenteísmo', 'percent')],
    run: (ctx) async {
      final emps = await ctx.emps(), days = await ctx.days();
      return [
        for (final e in emps)
          () {
            final r = _results(days, e);
            final expected = _sumR(r, 'expectedMinutes');
            final absent = r.fold<int>(0, (s, x) => s + (_flagsOf(x).contains('ABSENCE') ? _n(x, 'expectedMinutes') : 0) + _n(x, 'lateMinutes') + _n(x, 'earlyLeaveMinutes'));
            return {..._base(e), 'expected': expected, 'absent': absent, 'rate': expected == 0 ? 0 : absent / expected};
          }(),
      ];
    },
  ),
  ReportDef(
    key: 'frequencia',
    title: 'Frequência sintética (assiduidade)',
    category: 'Ponto',
    period: 'required',
    description: 'Dias previstos, presentes, faltas, abonados e afastados, com o percentual de presença.',
    columns: [
      ..._emp,
      const Col('workdays', 'Dias previstos', 'number'),
      const Col('present', 'Presentes', 'number'),
      const Col('absent', 'Faltas', 'number'),
      const Col('allowance', 'Abonados', 'number'),
      const Col('leave', 'Afastados', 'number'),
      const Col('rate', 'Presença', 'percent'),
    ],
    run: (ctx) async {
      final emps = await ctx.emps(), days = await ctx.days();
      return [
        for (final e in emps)
          () {
            final list = [
              for (final d in days[e.id] ?? const <Map<String, Object?>>[])
                if (_res(d) != null && _exp(d)['isWorkday'] == true) d,
            ];
            final present = list.where((d) => _punches(d).any((p) => p['status'] != 'DISREGARDED')).length;
            return {
              ..._base(e),
              'workdays': list.length,
              'present': present,
              'absent': list.where((d) => _flagsOf(_res(d)).contains('ABSENCE')).length,
              'allowance': list.where((d) => (d['allowance'] as Map?)?['fullDay'] == true).length,
              'leave': list.where((d) => d['leave'] != null).length,
              'rate': list.isEmpty ? 0 : present / list.length,
            };
          }(),
      ];
    },
  ),
  ReportDef(
    key: 'noturno',
    title: 'Adicional noturno',
    category: 'Ponto',
    period: 'required',
    description: 'Minutos noturnos trabalhados e convertidos em hora reduzida (52min30s).',
    columns: [..._emp, const Col('night', 'Noturno (relógio)', 'minutes'), const Col('reduced', 'Noturno (hora reduzida)', 'minutes')],
    run: (ctx) async {
      final emps = await ctx.emps(), days = await ctx.days();
      return [
        for (final e in emps)
          if (_sumR(_results(days, e), 'nightMinutes') > 0) {..._base(e), 'night': _sumR(_results(days, e), 'nightMinutes'), 'reduced': _sumR(_results(days, e), 'nightReducedMinutes')},
      ];
    },
  ),
  ReportDef(
    key: 'sobreaviso',
    title: 'Sobreaviso',
    category: 'Ponto',
    period: 'required',
    description: 'Lançamentos de sobreaviso e o valor de 1/3 (CLT art. 244 §2º).',
    columns: [..._emp2, const Col('date', 'Data', 'date'), const Col('period', 'Período'), const Col('minutes', 'Sobreaviso', 'minutes'), const Col('paid', 'A pagar (1/3)', 'minutes')],
    run: (ctx) async => [
      for (final (e, d) in await _perDay(ctx))
        for (final o in ((d['onCall'] as List?) ?? const []).cast<Map<String, Object?>>())
          {'registration': e.registration, 'name': e.name, 'date': d['date'], 'period': '${o['startTime']}–${o['endTime']}', 'minutes': o['minutes'], 'paid': core.jsRound((o['minutes']! as num) / 3)},
    ],
  ),
  // ------------------------------------------------------------- Movimentações
  ReportDef(
    key: 'abonos',
    title: 'Abonos',
    category: 'Movimentações',
    period: 'required',
    description: 'Abonos lançados no período.',
    columns: [..._emp2, const Col('date', 'Data', 'date'), const Col('justification', 'Justificativa'), const Col('kind', 'Tipo'), const Col('note', 'Observação')],
    run: (ctx) async {
      final emps = await ctx.emps();
      final byId = {for (final e in emps) e.id: e};
      final rows = await ctx.tx(
        (tx) => tx.query('SELECT a.*, j.name AS j_name FROM allowances a JOIN justifications j ON j.id = a.justification_id WHERE a.$_whereEmp AND a.date BETWEEN @f AND @t ORDER BY a.date ASC', {
          'ids': _ids(emps),
          'f': ctx.from,
          't': ctx.to,
        }),
      );
      return [
        for (final a in rows)
          {
            'registration': byId[a['employmentId']]!.registration,
            'name': byId[a['employmentId']]!.name,
            'date': isoDay(a['date']),
            'justification': a['jName'],
            'kind': a['fullDay'] == true ? 'Dia inteiro' : '${a['minutes']} min',
            'note': a['note'] ?? '',
          },
      ];
    },
  ),
  ReportDef(
    key: 'afastamentos',
    title: 'Afastamentos',
    category: 'Movimentações',
    period: 'required',
    description: 'Atestados, férias e licenças que tocam o período.',
    columns: [..._emp2, const Col('type', 'Tipo'), const Col('start', 'Início', 'date'), const Col('end', 'Fim', 'date'), const Col('days', 'Dias', 'number')],
    run: (ctx) async {
      final emps = await ctx.emps();
      final byId = {for (final e in emps) e.id: e};
      final rows = await ctx.tx(
        (tx) => tx.query('SELECT *, type::text AS type FROM leaves WHERE $_whereEmp AND deleted_at IS NULL AND start_date <= @t AND end_date >= @f ORDER BY start_date ASC', {
          'ids': _ids(emps),
          'f': ctx.from,
          't': ctx.to,
        }),
      );
      return [
        for (final l in rows)
          {
            'registration': byId[l['employmentId']]!.registration,
            'name': byId[l['employmentId']]!.name,
            'type': leaveLabel[l['type']] ?? l['type'],
            'start': isoDay(l['startDate']),
            'end': isoDay(l['endDate']),
            'days': (l['endDate']! as DateTime).difference(l['startDate']! as DateTime).inDays + 1,
          },
      ];
    },
  ),
  ReportDef(
    key: 'ajustes',
    title: 'Ajustes manuais de marcação',
    category: 'Movimentações',
    period: 'required',
    description: 'Inclusões e desconsiderações, com justificativa, situação e quem decidiu.',
    columns: [..._emp2, const Col('when', 'Marcação', 'datetime'), const Col('kind', 'Ajuste'), const Col('status', 'Situação'), const Col('justification', 'Justificativa')],
    run: (ctx) async {
      final emps = await ctx.emps();
      final byId = {for (final e in emps) e.id: e};
      const st = {'PENDING': 'Pendente', 'APPROVED': 'Aprovado', 'REJECTED': 'Recusado', 'CANCELLED': 'Cancelado'};
      final rows = await ctx.tx(
        (tx) => tx.query(
          'SELECT a.*, a.kind::text AS kind, a.status::text AS status, t.recorded_at AS t_recorded_at FROM time_record_adjustments a LEFT JOIN time_records t ON t.id = a.time_record_id '
          'WHERE a.$_whereEmp AND a.created_at >= @f AND a.created_at < @t ORDER BY a.created_at ASC',
          {'ids': _ids(emps), 'f': ctx.fromAt, 't': ctx.toAt},
        ),
      );
      return [
        for (final a in rows)
          {
            'registration': byId[a['employmentId']]?.registration,
            'name': byId[a['employmentId']]?.name ?? '',
            'when': _iso(a['recordedAt'] ?? a['tRecordedAt']),
            'kind': a['kind'] == 'INCLUDE'
                ? 'Inclusão'
                : a['kind'] == 'DISREGARD'
                ? 'Desconsiderar'
                : a['kind'],
            'status': st[a['status']] ?? a['status'],
            'justification': a['justification'],
          },
      ];
    },
  ),
  ReportDef(
    key: 'solicitacoes',
    title: 'Solicitações',
    category: 'Movimentações',
    period: 'required',
    description: 'Pedidos abertos no período, com tipo, situação e etapa.',
    columns: [
      ..._emp2,
      const Col('createdAt', 'Aberta em', 'datetime'),
      const Col('type', 'Tipo'),
      const Col('refDate', 'Dia', 'date'),
      const Col('status', 'Situação'),
      const Col('justification', 'Motivo'),
    ],
    run: (ctx) async {
      final emps = await ctx.emps();
      final byId = {for (final e in emps) e.id: e};
      const t = {
        'RECORD_CORRECTION': 'Inclusão de marcação',
        'ABSENCE_JUSTIFICATION': 'Justificativa',
        'SCHEDULE_CHANGE': 'Troca de folga',
        'OVERTIME_AUTHORIZATION': 'Autorização de extra',
        'OTHER': 'Outro',
      };
      const s = {'PENDING': 'Pendente', 'APPROVED': 'Aprovada', 'REJECTED': 'Recusada', 'CANCELLED': 'Cancelada'};
      final rows = await ctx.tx(
        (tx) => tx.query('SELECT *, type::text AS type, status::text AS status FROM time_requests WHERE $_whereEmp AND created_at >= @f AND created_at < @t ORDER BY created_at ASC', {
          'ids': _ids(emps),
          'f': ctx.fromAt,
          't': ctx.toAt,
        }),
      );
      return [
        for (final r in rows)
          {
            'registration': byId[r['employmentId']]!.registration,
            'name': byId[r['employmentId']]!.name,
            'createdAt': _iso(r['createdAt']),
            'type': t[r['type']] ?? r['type'],
            'refDate': r['refDate'] == null ? '' : isoDay(r['refDate']),
            'status': s[r['status']] ?? r['status'],
            'justification': r['justification'],
          },
      ];
    },
  ),
  ReportDef(
    key: 'trocas-escala',
    title: 'Trocas de escala e escala agendada',
    category: 'Movimentações',
    period: 'required',
    description: 'Dias definidos por escala agendada ou troca, com o horário e o motivo.',
    columns: [..._emp2, const Col('date', 'Data', 'date'), const Col('origin', 'Origem'), const Col('plan', 'Dia'), const Col('note', 'Motivo')],
    run: (ctx) async {
      final emps = await ctx.emps();
      final byId = {for (final e in emps) e.id: e};
      final rows = await ctx.tx((tx) => tx.query('SELECT * FROM schedule_overrides WHERE $_whereEmp AND date BETWEEN @f AND @t ORDER BY date ASC', {'ids': _ids(emps), 'f': ctx.from, 't': ctx.to}));
      return [
        for (final o in rows)
          {
            'registration': byId[o['employmentId']]!.registration,
            'name': byId[o['employmentId']]!.name,
            'date': isoDay(o['date']),
            'origin': o['origin'] == 'TROCA' ? 'Troca' : 'Escala agendada',
            'plan': o['isWorkday'] == true ? '${o['startTime']}–${o['endTime']}' : 'Folga',
            'note': o['note'] ?? '',
          },
      ];
    },
  ),
  ReportDef(
    key: 'escala-mensal',
    title: 'Escala do período',
    category: 'Movimentações',
    period: 'required',
    description: 'Horário previsto de cada funcionário em cada dia (folgas, feriados e afastamentos).',
    columns: [..._emp2, const Col('date', 'Data', 'date'), const Col('plan', 'Previsto'), const Col('schedule', 'Horário')],
    run: (ctx) async => [
      for (final (e, d) in await _perDay(ctx)) {'registration': e.registration, 'name': e.name, 'date': d['date'], 'plan': _planText(d), 'schedule': _exp(d)['scheduleName'] ?? ''},
    ],
  ),
  // ------------------------------------------------------------- Bancos
  ReportDef(
    key: 'banco-saldos',
    title: 'Saldos do banco de horas',
    category: 'Bancos',
    period: 'none',
    description: 'Saldo atual de cada funcionário.',
    columns: [..._emp, const Col('balance', 'Saldo', 'minutes')],
    run: (ctx) async {
      final emps = await ctx.emps();
      final acc = await ctx.tx((tx) => tx.query('SELECT employment_id, balance_minutes FROM bank_hours WHERE $_whereEmp', {'ids': _ids(emps)}));
      return [
        for (final e in emps) {..._base(e), 'balance': acc.where((a) => a['employmentId'] == e.id).firstOrNull?['balanceMinutes'] ?? 0},
      ];
    },
  ),
  ReportDef(
    key: 'banco-extrato',
    title: 'Extrato do banco de horas',
    category: 'Bancos',
    period: 'required',
    description: 'Lançamentos do período: créditos, débitos, vencimentos, pagamentos e ajustes.',
    columns: [
      ..._emp2,
      const Col('date', 'Data', 'date'),
      const Col('type', 'Lançamento'),
      const Col('minutes', 'Horas', 'minutes'),
      const Col('expires', 'Vence em', 'date'),
      const Col('description', 'Descrição'),
    ],
    run: (ctx) async {
      final emps = await ctx.emps();
      final byId = {for (final e in emps) e.id: e};
      const t = {'CREDIT': 'Crédito', 'DEBIT': 'Débito', 'EXPIRATION': 'Vencimento', 'ADJUSTMENT': 'Ajuste', 'PAYOUT': 'Pagamento', 'COMPENSATION': 'Compensação'};
      final rows = await ctx.tx(
        (tx) => tx.query(
          'SELECT t.*, t.type::text AS type, a.employment_id FROM bank_hour_transactions t JOIN bank_hours a ON a.id = t.account_id WHERE a.$_whereEmp AND t.ref_date BETWEEN @f AND @to ORDER BY t.ref_date ASC',
          {'ids': _ids(emps), 'f': ctx.from, 'to': ctx.to},
        ),
      );
      return [
        for (final x in rows)
          {
            'registration': byId[x['employmentId']]!.registration,
            'name': byId[x['employmentId']]!.name,
            'date': isoDay(x['refDate']),
            'type': t[x['type']] ?? x['type'],
            'minutes': x['minutes'],
            'expires': x['expiresOn'] == null ? '' : isoDay(x['expiresOn']),
            'description': x['description'] ?? '',
          },
      ];
    },
  ),
  // ------------------------------------------------------------- Cadastros
  ReportDef(
    key: 'funcionarios',
    title: 'Funcionários',
    category: 'Cadastros',
    period: 'none',
    description: 'Lista de funcionários com cargo, departamento, admissão e situação.',
    columns: [
      ..._emp,
      const Col('position', 'Cargo'),
      const Col('cpf', 'CPF'),
      const Col('hiredAt', 'Admissão', 'date'),
      const Col('terminatedAt', 'Desligamento', 'date'),
      const Col('status', 'Situação'),
    ],
    run: (ctx) async {
      final sensitive = can(ctx.user, 'people.sensitive:read');
      const s = {'ACTIVE': 'Ativo', 'ON_LEAVE': 'Afastado', 'SUSPENDED': 'Suspenso', 'TERMINATED': 'Desligado'};
      return [
        for (final e in await ctx.emps())
          {
            ..._base(e),
            'cpf': sensitive ? (e.row['cpf'] ?? '') : (maskCpf(e.row['cpf'] as String?) ?? ''),
            'hiredAt': e.hiredAt,
            'terminatedAt': e.terminatedAt ?? '',
            'status': s[e.status] ?? e.status,
          },
      ];
    },
  ),
  ReportDef(
    key: 'aniversariantes',
    title: 'Aniversariantes',
    category: 'Cadastros',
    period: 'required',
    description: 'Funcionários que fazem aniversário nos meses do período.',
    columns: [..._emp, const Col('birthday', 'Aniversário')],
    run: (ctx) async {
      final months = <String>{};
      for (var d = ctx.from; d.compareTo(ctx.to) <= 0; d = core.addDays(d, 1)) {
        months.add(d.substring(5, 7));
      }
      final list = [
        for (final e in await ctx.emps())
          if (e.row['birthDate'] != null && months.contains(isoDay(e.row['birthDate']).substring(5, 7))) e,
      ]..sort((a, b) => isoDay(a.row['birthDate']).substring(5).compareTo(isoDay(b.row['birthDate']).substring(5)));
      return [
        for (final e in list) {..._base(e), 'birthday': '${isoDay(e.row['birthDate']).substring(8, 10)}/${isoDay(e.row['birthDate']).substring(5, 7)}'},
      ];
    },
  ),
  ReportDef(
    key: 'feriados',
    title: 'Feriados',
    category: 'Cadastros',
    period: 'required',
    description: 'Feriados e pontos facultativos da empresa no período.',
    columns: const [Col('date', 'Data', 'date'), Col('name', 'Feriado'), Col('scope', 'Abrangência'), Col('workday', 'Trabalha?')],
    run: (ctx) async => const [],
  ),
  ReportDef(
    key: 'marcacoes',
    title: 'Marcações',
    category: 'Equipamentos e marcações',
    period: 'required',
    description: 'Todas as marcações recebidas, com origem e equipamento.',
    columns: [..._emp2, const Col('at', 'Data e hora', 'datetime'), const Col('source', 'Origem'), const Col('device', 'Equipamento'), const Col('location', 'Localização')],
    run: (ctx) => _marks(ctx, false),
  ),
  ReportDef(
    key: 'marcacao-web',
    title: 'Marcações pelo navegador e app',
    category: 'Equipamentos e marcações',
    period: 'required',
    description: 'Marcações do REP-P (navegador e app), com localização quando houver.',
    columns: [..._emp2, const Col('at', 'Data e hora', 'datetime'), const Col('source', 'Origem'), const Col('location', 'Localização')],
    run: (ctx) => _marks(ctx, true),
  ),
  ReportDef(
    key: 'eventos-equipamento',
    title: 'Eventos dos equipamentos',
    category: 'Equipamentos e marcações',
    period: 'required',
    description: 'Contatos, comandos, falhas e alertas de comunicação.',
    columns: const [Col('at', 'Data e hora', 'datetime'), Col('device', 'Equipamento'), Col('level', 'Nível'), Col('message', 'Evento')],
    run: (ctx) async => [
      for (final l in await ctx.tx(
        (tx) => tx.query(
          'SELECT l.created_at, l.level, l.message, d.name FROM device_logs l JOIN devices d ON d.id = l.device_id WHERE d.company_id = @c AND l.created_at >= @f AND l.created_at < @t ORDER BY l.created_at ASC LIMIT 20000',
          {'c': ctx.f['companyId'], 'f': ctx.fromAt, 't': ctx.toAt},
        ),
      ))
        {
          'at': _iso(l['createdAt']),
          'device': l['name'],
          'level': l['level'] == 'info'
              ? 'Informação'
              : l['level'] == 'warn'
              ? 'Aviso'
              : 'Erro',
          'message': l['message'],
        },
    ],
  ),
  ReportDef(
    key: 'divergencias',
    title: 'Divergências de jornada',
    category: 'Ponto',
    period: 'required',
    description: 'Marcou sem horário previsto, trabalhou na folga ou marcou muito fora do horário (mais de 2 horas antes ou depois).',
    columns: [..._emp2, const Col('date', 'Data', 'date'), const Col('expected', 'Previsto'), const Col('punches', 'Marcações'), const Col('issue', 'Divergência')],
    run: (ctx) async {
      int? m(Object? hm) => hm is String && hm.length >= 5 ? int.parse(hm.substring(0, 2)) * 60 + int.parse(hm.substring(3, 5)) : null;
      final out = <Map<String, Object?>>[];
      for (final (e, d) in await _perDay(ctx)) {
        final ps = [
          for (final p in _punches(d))
            if (p['status'] == 'ORIGINAL' || p['status'] == 'INCLUDED') p,
        ];
        if (ps.isEmpty || d['leave'] != null) continue;
        final x = _exp(d);
        final issues = <String>[];
        if (x['scheduleName'] == null) {
          issues.add('Marcou sem horário atribuído');
        } else if (x['isHoliday'] == true) {
          issues.add('Trabalhou no feriado');
        } else if (x['isWorkday'] != true) {
          issues.add('Trabalhou na folga');
        } else {
          final s0 = m(x['start']), e0 = m(x['end']), first = m(ps.first['time']), last = m(ps.last['time']);
          if (s0 != null && first != null && s0 - first > 120) issues.add('Entrada ${s0 - first} min antes do horário');
          if (e0 != null && last != null && s0 != null && e0 > s0 && last - e0 > 120) issues.add('Saída ${last - e0} min depois do horário');
        }
        if (issues.isNotEmpty) {
          out.add({
            'registration': e.registration,
            'name': e.name,
            'date': d['date'],
            'expected': x['isWorkday'] == true
                ? '${x['start'] ?? ''}–${x['end'] ?? ''}'
                : x['scheduleName'] != null
                ? 'Folga'
                : 'Sem horário',
            'punches': _punchList(d),
            'issue': issues.join('; '),
          });
        }
      }
      return out;
    },
  ),
  ReportDef(
    key: 'intervalo-nao-calculavel',
    title: 'Intervalo não calculável',
    category: 'Ponto',
    period: 'required',
    description: 'Dias com intervalo previsto em que as marcações não permitem medir o intervalo (só entrada e saída, ou número ímpar).',
    columns: [..._emp2, const Col('date', 'Data', 'date'), const Col('breakExpected', 'Intervalo previsto', 'minutes'), const Col('punches', 'Marcações'), const Col('reason', 'Motivo')],
    run: (ctx) async => [
      for (final (e, d) in await _perDay(ctx))
        if (() {
          final n = _punches(d).where((p) => p['status'] == 'ORIGINAL' || p['status'] == 'INCLUDED').length;
          final b = (_exp(d)['breakMinutes'] as num?)?.toInt() ?? 0;
          return !(b == 0 || n == 0 || (n >= 4 && n.isEven));
        }())
          () {
            final n = _punches(d).where((p) => p['status'] == 'ORIGINAL' || p['status'] == 'INCLUDED').length;
            return {
              'registration': e.registration,
              'name': e.name,
              'date': d['date'],
              'breakExpected': _exp(d)['breakMinutes'],
              'punches': _punchList(d),
              'reason': n.isOdd ? 'Número ímpar de marcações' : 'Intervalo não marcado (só entrada e saída)',
            };
          }(),
    ],
  ),
  ReportDef(
    key: 'espelho-1510',
    title: 'Espelho de ponto (Portaria 1.510/2009 e 671/2021)',
    category: 'Ponto',
    period: 'required',
    description: 'Espelho por PIS: identificação, horário contratual e marcações do dia (originais e incluídas, indicadas com (I)), com as desconsideradas indicadas com (D).',
    columns: const [
      Col('pis', 'PIS'),
      Col('name', 'Funcionário'),
      Col('hiredAt', 'Admissão', 'date'),
      Col('date', 'Data', 'date'),
      Col('contract', 'Horário contratual'),
      Col('punches', 'Marcações'),
      Col('worked', 'Trabalhado', 'minutes'),
    ],
    run: (ctx) async => [
      for (final (e, d) in await _perDay(ctx))
        if (d['outsideEmployment'] != true)
          () {
            final x = _exp(d);
            String tag(Object? st) => st == 'INCLUDED'
                ? '(I)'
                : st == 'DISREGARDED'
                ? '(D)'
                : '';
            final brk = (x['breakMinutes'] as num?)?.toInt() ?? 0;
            return {
              'pis': e.row['pis'] ?? '',
              'name': e.name,
              'hiredAt': e.hiredAt,
              'date': d['date'],
              'contract': x['isWorkday'] == true ? '${x['start'] ?? ''}–${x['end'] ?? ''}${brk > 0 ? ' (intervalo $brk min)' : ''}' : 'Folga',
              'punches': [
                for (final p in _punches(d))
                  if (!(p['status']! as String).startsWith('PENDING')) '${p['time']}${tag(p['status'])}',
              ].join(' '),
              'worked': _n(_res(d), 'workedMinutes'),
            };
          }(),
    ],
  ),
  ReportDef(
    key: 'ciencia-espelho',
    title: 'Ciência eletrônica do espelho',
    category: 'Ponto',
    period: 'required',
    description: 'Quem deu ciência no espelho do período exato informado (de acordo ou com ressalva), quando, de qual IP, e se o espelho mudou depois.',
    columns: [
      ..._emp,
      const Col('status', 'Situação'),
      const Col('signedAt', 'Ciência em', 'datetime'),
      const Col('comment', 'Ressalva'),
      const Col('ip', 'IP'),
      const Col('changed', 'Espelho mudou depois?'),
    ],
    run: (ctx) async {
      final emps = await ctx.emps();
      final acks = await ctx.tx(
        (tx) =>
            tx.query('SELECT *, decision::text AS decision FROM mirror_acknowledgments WHERE $_whereEmp AND period_start = @f AND period_end = @t', {'ids': _ids(emps), 'f': ctx.from, 't': ctx.to}),
      );
      final days = acks.isEmpty ? <String, List<Map<String, Object?>>>{} : await ctx.days();
      return [
        for (final e in emps)
          () {
            final a = acks.where((x) => x['employmentId'] == e.id).firstOrNull;
            final changed = a != null && mirrorHashOf(e.id, ctx.from, ctx.to, days[e.id] ?? const []).hash != a['contentHash'];
            return {
              ..._base(e),
              'status': a == null
                  ? 'Pendente'
                  : a['decision'] == 'AGREE'
                  ? 'De acordo'
                  : 'Com ressalva',
              'signedAt': a == null ? '' : _iso(a['createdAt']),
              'comment': a?['comment'] ?? '',
              'ip': a?['ip'] ?? '',
              'changed': a == null
                  ? ''
                  : changed
                  ? 'Sim'
                  : 'Não',
            };
          }(),
      ];
    },
  ),
  // ------------------------------------------------------------- Módulos especializados
  ReportDef(
    key: 'plantoes-cobertura',
    title: 'Cobertura de plantões',
    category: 'Saúde',
    period: 'required',
    permission: 'health.shifts:read',
    description: 'Cada plantão do período por unidade: profissionais necessários, escalados e vagas descobertas.',
    columns: const [
      Col('unit', 'Unidade'),
      Col('start', 'Início', 'datetime'),
      Col('end', 'Fim', 'datetime'),
      Col('kind', 'Tipo'),
      Col('required', 'Necessários', 'number'),
      Col('covered', 'Escalados', 'number'),
      Col('missing', 'Descobertos', 'number'),
      Col('names', 'Plantonistas'),
    ],
    run: (ctx) async {
      const k = {'DAY': 'Diurno', 'NIGHT': 'Noturno', 'H12': '12 horas', 'H24': '24 horas', 'ON_CALL': 'Sobreaviso', 'EXTRA': 'Extra', 'COVERAGE': 'Cobertura'};
      final rows = await ctx.tx(
        (tx) => tx.query(
          'SELECT s.id, s.starts_at, s.ends_at, s.kind::text AS kind, s.required_professionals, u.name AS unit, '
          '(SELECT coalesce(array_agg(p.full_name ORDER BY a.created_at), ARRAY[]::text[]) FROM medical_shift_assignments a JOIN employment_relationships e ON e.id = a.employment_id JOIN people p ON p.id = e.person_id '
          "WHERE a.shift_id = s.id AND a.status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED')) AS names "
          'FROM medical_shifts s JOIN company_units u ON u.id = s.unit_id WHERE s.deleted_at IS NULL AND u.company_id = @c AND s.starts_at >= @f AND s.starts_at < @t ORDER BY s.starts_at ASC',
          {'c': ctx.f['companyId'], 'f': ctx.fromAt, 't': ctx.toAt},
        ),
      );
      return [
        for (final x in rows)
          () {
            final names = (x['names']! as List).cast<String>();
            final req = x['requiredProfessionals']! as int;
            return {
              'unit': x['unit'],
              'start': _iso(x['startsAt']),
              'end': _iso(x['endsAt']),
              'kind': k[x['kind']] ?? x['kind'],
              'required': req,
              'covered': names.length,
              'missing': math.max(0, req - names.length),
              'names': names.join(', '),
            };
          }(),
      ];
    },
  ),
  ReportDef(
    key: 'plantoes-horas',
    title: 'Horas de plantão por profissional',
    category: 'Saúde',
    period: 'required',
    permission: 'health.shifts:read',
    description: 'Plantões escalados, cumpridos, faltas e substituições de cada profissional, com as horas previstas e as registradas (entrada e saída).',
    columns: [
      ..._emp2,
      const Col('shifts', 'Plantões', 'number'),
      const Col('completed', 'Cumpridos', 'number'),
      const Col('absent', 'Faltas', 'number'),
      const Col('substituted', 'Substituídos', 'number'),
      const Col('planned', 'Horas previstas', 'minutes'),
      const Col('recorded', 'Horas registradas', 'minutes'),
    ],
    run: (ctx) async {
      final rows = await ctx.tx(
        (tx) => tx.query(
          'SELECT a.employment_id, a.status::text AS status, a.check_in_at, a.check_out_at, s.starts_at, s.ends_at, e.registration, p.full_name, p.social_name '
          'FROM medical_shift_assignments a JOIN medical_shifts s ON s.id = a.shift_id JOIN company_units u ON u.id = s.unit_id JOIN employment_relationships e ON e.id = a.employment_id '
          "JOIN people p ON p.id = e.person_id WHERE a.status <> 'CANCELLED' AND s.deleted_at IS NULL AND u.company_id = @c AND s.starts_at >= @f AND s.starts_at < @t",
          {'c': ctx.f['companyId'], 'f': ctx.fromAt, 't': ctx.toAt},
        ),
      );
      final by = <String, Map<String, Object?>>{};
      for (final a in rows) {
        final r = by.putIfAbsent(
          a['employmentId']! as String,
          () => {'registration': a['registration'], 'name': a['socialName'] ?? a['fullName'], 'shifts': 0, 'completed': 0, 'absent': 0, 'substituted': 0, 'planned': 0, 'recorded': 0},
        );
        void inc(String k, [int v = 1]) => r[k] = (r[k]! as int) + v;
        inc('shifts');
        if (a['status'] == 'COMPLETED') inc('completed');
        if (a['status'] == 'ABSENT') inc('absent');
        if (a['status'] == 'SUBSTITUTED') inc('substituted');
        if (!['ABSENT', 'SUBSTITUTED'].contains(a['status'])) inc('planned', core.jsRound((a['endsAt']! as DateTime).difference(a['startsAt']! as DateTime).inMilliseconds / 60000));
        if (a['checkInAt'] != null && a['checkOutAt'] != null) inc('recorded', core.jsRound((a['checkOutAt']! as DateTime).difference(a['checkInAt']! as DateTime).inMilliseconds / 60000));
      }
      return by.values.toList()..sort((a, b) => a['name'].toString().compareTo(b['name'].toString()));
    },
  ),
  ReportDef(
    key: 'aulas-professor',
    title: 'Aulas por professor',
    category: 'Educação',
    period: 'required',
    permission: 'education.academic:read',
    description: 'Aulas dadas, não dadas, substituições e horas-aula de cada professor no período.',
    columns: const [
      Col('registration', 'Matrícula'),
      Col('name', 'Professor'),
      Col('held', 'Dadas', 'number'),
      Col('notHeld', 'Não dadas', 'number'),
      Col('substitutedOut', 'Substituído', 'number'),
      Col('substitutedIn', 'Substituiu', 'number'),
      Col('minutes', 'Horas-aula', 'minutes'),
    ],
    run: (ctx) async {
      final sessions = await ctx.tx(
        (tx) => tx.query(
          'SELECT cs.status::text AS status, cs.substitute_employment_id, sc.start_time, sc.end_time, ta.employment_id, e.registration, p.full_name, p.social_name '
          'FROM class_sessions cs JOIN class_schedules sc ON sc.id = cs.schedule_id JOIN teaching_assignments ta ON ta.id = sc.assignment_id JOIN subjects sb ON sb.id = ta.subject_id '
          'JOIN employment_relationships e ON e.id = ta.employment_id JOIN people p ON p.id = e.person_id WHERE cs.session_date BETWEEN @f AND @t AND sb.company_id = @c',
          {'c': ctx.f['companyId'], 'f': ctx.from, 't': ctx.to},
        ),
      );
      final subIds = {
        for (final x in sessions)
          if (x['substituteEmploymentId'] != null) x['substituteEmploymentId']! as String,
      }.toList();
      final subs = subIds.isEmpty
          ? <Row>[]
          : await ctx.tx(
              (tx) =>
                  tx.query('SELECT e.id, e.registration, p.full_name, p.social_name FROM employment_relationships e JOIN people p ON p.id = e.person_id WHERE e.id::text = ANY(@ids)', {'ids': subIds}),
            );
      final by = <String, Map<String, Object?>>{};
      Map<String, Object?> row(String id, Object? reg, Object? name) =>
          by.putIfAbsent(id, () => {'registration': reg, 'name': name, 'held': 0, 'notHeld': 0, 'substitutedOut': 0, 'substitutedIn': 0, 'minutes': 0});
      int len(String a, String b) => (int.parse(b.substring(0, 2)) * 60 + int.parse(b.substring(3))) - (int.parse(a.substring(0, 2)) * 60 + int.parse(a.substring(3)));
      for (final x in sessions) {
        final r = row(x['employmentId']! as String, x['registration'], x['socialName'] ?? x['fullName']);
        final m = len(x['startTime']! as String, x['endTime']! as String);
        if (x['status'] == 'HELD') {
          r['held'] = (r['held']! as int) + 1;
          r['minutes'] = (r['minutes']! as int) + m;
        }
        if (x['status'] == 'NOT_HELD') r['notHeld'] = (r['notHeld']! as int) + 1;
        if (x['status'] == 'SUBSTITUTED' && x['substituteEmploymentId'] != null) {
          r['substitutedOut'] = (r['substitutedOut']! as int) + 1;
          final sub = subs.where((e) => e['id'] == x['substituteEmploymentId']).firstOrNull;
          if (sub != null) {
            final q = row(sub['id']! as String, sub['registration'], sub['socialName'] ?? sub['fullName']);
            q['substitutedIn'] = (q['substitutedIn']! as int) + 1;
            q['minutes'] = (q['minutes']! as int) + m;
          }
        }
      }
      return by.values.toList()..sort((a, b) => a['name'].toString().compareTo(b['name'].toString()));
    },
  ),
  ReportDef(
    key: 'ocorrencias',
    title: 'Ocorrências operacionais',
    category: 'Operacional',
    period: 'required',
    permission: 'operational.board:read',
    description: 'Ocorrências do período com tipo, unidade, situação, responsável e tempo até a solução.',
    columns: const [Col('at', 'Quando', 'datetime'), Col('unit', 'Unidade'), Col('type', 'Tipo'), Col('title', 'Ocorrência'), Col('status', 'Situação'), Col('hours', 'Horas até resolver', 'number')],
    run: (ctx) async {
      const t = {
        'ABSENCE': 'Falta',
        'LATE': 'Atraso',
        'MISSING_RECORD': 'Marcação incompleta',
        'INCOMPLETE_TEAM': 'Equipe incompleta',
        'OPERATIONAL_ISSUE': 'Problema operacional',
        'EQUIPMENT_UNAVAILABLE': 'Equipamento indisponível',
        'UNCOVERED_SHIFT': 'Plantão descoberto',
        'OTHER': 'Outro',
      };
      const s = {'OPEN': 'Aberta', 'IN_PROGRESS': 'Em tratamento', 'RESOLVED': 'Resolvida', 'DISMISSED': 'Descartada'};
      final rows = await ctx.tx(
        (tx) => tx.query(
          'SELECT o.occurred_at, o.updated_at, o.type::text AS type, o.title, o.status::text AS status, u.name AS unit FROM operational_occurrences o JOIN company_units u ON u.id = o.unit_id '
          'WHERE u.company_id = @c AND o.occurred_at >= @f AND o.occurred_at < @t ORDER BY o.occurred_at ASC',
          {'c': ctx.f['companyId'], 'f': ctx.fromAt, 't': ctx.toAt},
        ),
      );
      return [
        for (final o in rows)
          {
            'at': _iso(o['occurredAt']),
            'unit': o['unit'] ?? '',
            'type': t[o['type']] ?? o['type'],
            'title': o['title'],
            'status': s[o['status']] ?? o['status'],
            'hours': o['status'] == 'RESOLVED' ? core.jsRound((o['updatedAt']! as DateTime).difference(o['occurredAt']! as DateTime).inMilliseconds / 3600000 * 10) / 10 : '',
          },
      ];
    },
  ),
  // ------------------------------------------------------------- Segurança
  ReportDef(
    key: 'auditoria',
    title: 'Auditoria',
    category: 'Segurança',
    period: 'required',
    permission: 'admin.audit:read',
    description: 'Quem alterou o quê e quando (sem dados sensíveis).',
    columns: const [Col('at', 'Data e hora', 'datetime'), Col('user', 'Usuário'), Col('action', 'Ação'), Col('entity', 'Cadastro'), Col('ip', 'IP')],
    run: (ctx) async {
      const a = {
        'CREATE': 'Criou',
        'UPDATE': 'Alterou',
        'DELETE': 'Excluiu',
        'APPROVE': 'Aprovou',
        'REJECT': 'Recusou',
        'CLOSE_PERIOD': 'Fechou período',
        'REOPEN_PERIOD': 'Reabriu período',
        'LOGIN': 'Entrou',
        'LOGIN_FAILED': 'Falha de login',
      };
      final rows = await ctx.tx(
        (tx) => tx.query(
          'SELECT l.created_at, l.actor_user_id, l.action::text AS action, l.entity, l.ip, u.display_name FROM audit_logs l LEFT JOIN users u ON u.id = l.actor_user_id '
          'WHERE l.tenant_id = @tn AND l.created_at >= @f AND l.created_at < @t ORDER BY l.created_at ASC LIMIT 20000',
          {'tn': ctx.tenantId, 'f': ctx.fromAt, 't': ctx.toAt},
        ),
      );
      return [
        for (final l in rows)
          {'at': _iso(l['createdAt']), 'user': l['displayName'] ?? (l['actorUserId'] != null ? '' : 'Sistema'), 'action': a[l['action']] ?? l['action'], 'entity': l['entity'], 'ip': l['ip'] ?? ''},
      ];
    },
  ),
  ReportDef(
    key: 'usuarios-perfis',
    title: 'Usuários e perfis',
    category: 'Segurança',
    period: 'none',
    permission: 'admin.users:read',
    description: 'Usuários da organização, perfis, forma de login e último acesso.',
    columns: const [Col('name', 'Usuário'), Col('email', 'E-mail'), Col('roles', 'Perfis'), Col('source', 'Login'), Col('active', 'Ativo'), Col('lastLogin', 'Último acesso', 'datetime')],
    run: (ctx) async {
      final hide = !(ctx.user.isSupport || ctx.user.isPlatformAdmin);
      final rows = await ctx.tx(
        (tx) => tx.query(
          'SELECT u.display_name, u.email, u.auth_source::text AS auth_source, u.is_active, u.last_login_at, '
          '(SELECT string_agg(r.name, \', \' ORDER BY ur.created_at) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles '
          'FROM users u WHERE u.tenant_id = @tn AND u.deleted_at IS NULL AND NOT u.is_platform_admin${hide ? ' AND NOT u.is_support' : ''} ORDER BY u.display_name ASC',
          {'tn': ctx.tenantId},
        ),
      );
      return [
        for (final u in rows)
          {
            'name': u['displayName'],
            'email': u['email'],
            'roles': u['roles'] ?? '',
            'source': u['authSource'] == 'LDAP' ? 'Rede (LDAP)' : 'Senha',
            'active': u['isActive'] == true ? 'Sim' : 'Não',
            'lastLogin': _iso(u['lastLoginAt']),
          },
      ];
    },
  ),
  ReportDef(
    key: 'log-espelho',
    title: 'Log do espelho (alterações por funcionário)',
    category: 'Movimentações',
    period: 'required',
    permission: 'admin.audit:read',
    description: 'Ajustes, abonos, afastamentos, sobreaviso e marcações web lançados no período, com quem fez e quando.',
    columns: [..._emp2, const Col('at', 'Quando', 'datetime'), const Col('user', 'Usuário'), const Col('action', 'Ação'), const Col('entity', 'O quê'), const Col('detail', 'Detalhe')],
    run: (ctx) async {
      final emps = await ctx.emps();
      final byId = {for (final e in emps) e.id: e};
      const ent = {
        'time_adjustment': 'Ajuste de marcação',
        'allowance': 'Abono',
        'leave': 'Afastamento',
        'on_call': 'Sobreaviso',
        'time_record': 'Marcação',
        'mirror_acknowledgment': 'Ciência do espelho',
        'bank_transaction': 'Banco de horas',
      };
      const act = {'CREATE': 'Lançou', 'UPDATE': 'Alterou', 'DELETE': 'Excluiu', 'APPROVE': 'Aprovou', 'REJECT': 'Recusou'};
      final logs = await ctx.tx(
        (tx) => tx.query(
          'SELECT l.created_at, l.action::text AS action, l.entity, l.before, l.after, u.display_name FROM audit_logs l LEFT JOIN users u ON u.id = l.actor_user_id '
          'WHERE l.tenant_id = @tn AND l.entity = ANY(@e) AND l.created_at >= @f AND l.created_at < @t ORDER BY l.created_at ASC LIMIT 20000',
          {'tn': ctx.tenantId, 'e': ent.keys.toList(), 'f': ctx.fromAt, 't': ctx.toAt},
        ),
      );
      String? empOf(Row l) => ((l['after'] as Map?)?['employmentId'] ?? (l['before'] as Map?)?['employmentId']) as String?;
      String detail(Row l) {
        final o = ((l['after'] ?? l['before'] ?? const {}) as Map).cast<String, Object?>();
        final s = [
          for (final k in ['kind', 'date', 'time', 'recordedAt', 'type', 'justification', 'minutes', 'from', 'to', 'decision'])
            if (o[k] != null) '$k: ${o[k]}',
        ].join(', ');
        return s.length > 300 ? s.substring(0, 300) : s;
      }

      return [
        for (final l in logs)
          if (empOf(l) != null && byId.containsKey(empOf(l)))
            {
              'registration': byId[empOf(l)]!.registration,
              'name': byId[empOf(l)]!.name,
              'at': _iso(l['createdAt']),
              'user': l['displayName'] ?? '',
              'action': act[l['action']] ?? l['action'],
              'entity': ent[l['entity']] ?? l['entity'],
              'detail': detail(l),
            },
      ];
    },
  ),
  ReportDef(
    key: 'acessos',
    title: 'Acessos (login e falhas)',
    category: 'Segurança',
    period: 'required',
    permission: 'admin.audit:read',
    description: 'Entradas no sistema e tentativas com senha errada ou fora do horário/bloqueio, com IP e navegador.',
    columns: const [
      Col('at', 'Data e hora', 'datetime'),
      Col('user', 'Usuário'),
      Col('email', 'E-mail'),
      Col('result', 'Resultado'),
      Col('method', 'Forma'),
      Col('ip', 'IP'),
      Col('agent', 'Navegador/app'),
    ],
    run: (ctx) async {
      final hide = !ctx.user.isSupport && !ctx.user.isPlatformAdmin;
      final logs = await ctx.tx(
        (tx) => tx.query(
          'SELECT l.created_at, l.action::text AS action, l.after, l.ip, l.user_agent, u.display_name, u.email, u.is_support FROM audit_logs l LEFT JOIN users u ON u.id = l.actor_user_id '
          "WHERE l.tenant_id = @tn AND l.action IN ('LOGIN', 'LOGIN_FAILED') AND l.created_at >= @f AND l.created_at < @t ORDER BY l.created_at ASC LIMIT 20000",
          {'tn': ctx.tenantId, 'f': ctx.fromAt, 't': ctx.toAt},
        ),
      );
      return [
        for (final l in logs)
          if (!(hide && l['isSupport'] == true))
            () {
              final a = (l['after'] as Map?) ?? const {};
              final ua = (l['userAgent'] as String?) ?? '';
              return {
                'at': _iso(l['createdAt']),
                'user': l['displayName'] ?? '',
                'email': l['email'] ?? '',
                'result': l['action'] == 'LOGIN'
                    ? 'Entrou'
                    : a['reason'] == 'access_denied'
                    ? 'Bloqueado (horário/bloqueio)'
                    : 'Senha incorreta',
                'method': a['method'] == 'ldap' ? 'Rede (LDAP)' : 'Senha',
                'ip': l['ip'] ?? '',
                'agent': ua.length > 80 ? ua.substring(0, 80) : ua,
              };
            }(),
      ];
    },
  ),
  ReportDef(
    key: 'alteracoes-senha',
    title: 'Alterações de senha',
    category: 'Segurança',
    period: 'required',
    permission: 'admin.audit:read',
    description: 'Trocas de senha pelo próprio usuário e redefinições pelo link do e-mail.',
    columns: const [Col('at', 'Data e hora', 'datetime'), Col('user', 'Usuário'), Col('email', 'E-mail'), Col('via', 'Como'), Col('ip', 'IP')],
    run: (ctx) async => [
      for (final l in await ctx.tx(
        (tx) => tx.query(
          'SELECT l.created_at, l.after, l.ip, u.display_name, u.email FROM audit_logs l LEFT JOIN users u ON u.id = l.actor_user_id '
          "WHERE l.tenant_id = @tn AND l.entity = 'user_password' AND l.created_at >= @f AND l.created_at < @t ORDER BY l.created_at ASC LIMIT 20000",
          {'tn': ctx.tenantId, 'f': ctx.fromAt, 't': ctx.toAt},
        ),
      ))
        {
          'at': _iso(l['createdAt']),
          'user': l['displayName'] ?? '',
          'email': l['email'] ?? '',
          'via': (l['after'] as Map?)?['via'] == 'reset' ? 'Redefinição por e-mail' : 'Troca pelo usuário',
          'ip': l['ip'] ?? '',
        },
    ],
  ),
  ReportDef(
    key: 'funcionalidades-perfil',
    title: 'Funcionalidades por perfil',
    category: 'Segurança',
    period: 'none',
    permission: 'admin.users:read',
    description: 'O que cada perfil (do sistema e personalizado) pode fazer: módulo, recurso e ação.',
    columns: const [Col('role', 'Perfil'), Col('kind', 'Tipo'), Col('module', 'Módulo'), Col('resource', 'Recurso'), Col('action', 'Ação'), Col('description', 'Permissão')],
    run: (ctx) async {
      final rows = await ctx.tx(
        (tx) => tx.query(
          'SELECT r.name, r.tenant_id, p.key FROM roles r JOIN role_permissions rp ON rp.role_id = r.id JOIN permissions p ON p.id = rp.permission_id '
          "WHERE r.deleted_at IS NULL AND (r.tenant_id IS NULL OR r.tenant_id = @tn) AND r.key <> 'super_admin' AND p.key NOT LIKE 'platform.%' ORDER BY r.name ASC, p.key ASC",
          {'tn': ctx.tenantId},
        ),
      );
      return [
        for (final x in rows)
          () {
            final k = x['key']! as String;
            final res = k.split(':')[0], act = k.split(':')[1];
            return {
              'role': x['name'],
              'kind': x['tenantId'] != null ? 'Personalizado' : 'Do sistema',
              'module': moduleLabels[res.split('.')[0]] ?? res,
              'resource': resourceLabels[res] ?? res,
              'action': actionLabels[act] ?? act,
              'description': permissions[k] ?? k,
            };
          }(),
      ];
    },
  ),
];

Future<List<Map<String, Object?>>> _marks(RCtx ctx, bool webOnly) async {
  final emps = await ctx.emps();
  final byId = {for (final e in emps) e.id: e};
  const s = {'WEB': 'Navegador', 'MOBILE': 'App', 'KIOSK': 'Terminal', 'DEVICE': 'Relógio', 'COMMUNICATION_SERVER': 'Relógio', 'IMPORT': 'Importação', 'MANUAL_ADJUSTMENT': 'Ajuste'};
  final rows = await ctx.tx(
    (tx) => tx.query(
      'SELECT t.employment_id, t.recorded_at, t.source::text AS source, t.latitude, t.longitude, d.name AS device FROM time_records t LEFT JOIN devices d ON d.id = t.device_id '
      "WHERE t.$_whereEmp AND t.recorded_at >= @f AND t.recorded_at < @t${webOnly ? " AND t.source IN ('WEB', 'MOBILE')" : ''} ORDER BY t.recorded_at ASC LIMIT 50000",
      {'ids': _ids(emps), 'f': ctx.fromAt, 't': ctx.toAt},
    ),
  );
  return [
    for (final r in rows)
      {
        'registration': byId[r['employmentId']]!.registration,
        'name': byId[r['employmentId']]!.name,
        'at': _iso(r['recordedAt']),
        'source': s[r['source']] ?? r['source'],
        'device': r['device'] ?? '',
        'location': r['latitude'] != null && r['longitude'] != null
            ? '${double.parse(r['latitude'].toString()).toStringAsFixed(5)}, ${double.parse(r['longitude'].toString()).toStringAsFixed(5)}'
            : '',
      },
  ];
}

/// Campos do montador (uma linha por funcionário e dia).
final builderFields = <(Col, Object? Function(Emp e, Map<String, Object?> d))>[
  (const Col('registration', 'Matrícula'), (e, d) => e.registration),
  (const Col('name', 'Funcionário'), (e, d) => e.name),
  (const Col('company', 'Empresa'), (e, d) => e.row['cTradeName'] ?? e.row['cLegalName']),
  (const Col('department', 'Departamento'), (e, d) => e.row['dName'] ?? ''),
  (const Col('position', 'Cargo'), (e, d) => e.row['jpName'] ?? ''),
  (const Col('date', 'Data', 'date'), (e, d) => d['date']),
  (const Col('weekday', 'Dia da semana'), (e, d) => const ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][core.weekday(d['date']! as String)]),
  (const Col('schedule', 'Horário'), (e, d) => _exp(d)['scheduleName'] ?? ''),
  (const Col('expectedText', 'Previsto (horário)'), (e, d) => _exp(d)['isWorkday'] == true ? '${_exp(d)['start'] ?? ''}–${_exp(d)['end'] ?? ''}' : 'Folga'),
  (const Col('punches', 'Marcações'), (e, d) => _punchList(d)),
  (const Col('expected', 'Previsto (horas)', 'minutes'), (e, d) => _n(_res(d), 'expectedMinutes')),
  (const Col('worked', 'Trabalhado', 'minutes'), (e, d) => _n(_res(d), 'workedMinutes')),
  (const Col('balance', 'Saldo', 'minutes'), (e, d) => _n(_res(d), 'balanceMinutes')),
  (const Col('overtime', 'Extras', 'minutes'), (e, d) => _n(_res(d), 'overtimeMinutes')),
  (const Col('night', 'Noturno reduzido', 'minutes'), (e, d) => _n(_res(d), 'nightReducedMinutes')),
  (const Col('late', 'Atraso', 'minutes'), (e, d) => _n(_res(d), 'lateMinutes')),
  (const Col('earlyLeave', 'Saída antecipada', 'minutes'), (e, d) => _n(_res(d), 'earlyLeaveMinutes')),
  (const Col('break', 'Intervalo', 'minutes'), (e, d) => _n(_res(d), 'breakMinutes')),
  (const Col('absence', 'Falta'), (e, d) => _flagsOf(_res(d)).contains('ABSENCE') ? 'Sim' : ''),
  (const Col('allowance', 'Abono'), (e, d) => (d['allowance'] as Map?)?['justification'] ?? ''),
  (const Col('leave', 'Afastamento'), (e, d) => (d['leave'] as Map?)?['label'] ?? ''),
  (const Col('flags', 'Ocorrências'), (e, d) => _flags(d)),
];

String formatCell(Object? v, String? type) {
  if (v == null || v == '') return '';
  switch (type) {
    case 'minutes':
      final m = (v as num).toInt(), a = m.abs();
      return '${m < 0 ? '-' : ''}${a ~/ 60}:${(a % 60).toString().padLeft(2, '0')}';
    case 'percent':
      return '${((v as num) * 100).toStringAsFixed(1).replaceFirst('.', ',')}%';
    case 'date':
      return _dmy(v.toString());
    case 'datetime':
      final l = localBr(DateTime.parse(v.toString()));
      return '${_dmy(l.date)} ${l.time}';
    default:
      return v.toString();
  }
}

class ReportsModule {
  ReportsModule(this.app, this.core0, this.holidays);
  final App app;
  final TimesheetCore core0;
  final HolidaysService holidays;
  Db get db => app.db;

  Future<List<Emp>> _employments(String tenantId, Map<String, Object?> f) => db.forTenant(tenantId, (tx) async {
    if (await tx.one('SELECT 1 FROM companies WHERE id = @c AND deleted_at IS NULL', {'c': f['companyId']}) == null) throw notFound('Empresa não encontrada');
    final where = ['e.company_id = @c', 'e.deleted_at IS NULL'];
    final p = <String, Object?>{'c': f['companyId'], 'from': f['from'], 'to': f['to']};
    if (f['status'] == 'ACTIVE') {
      where.add(f['from'] != null && f['to'] != null ? 'e.hired_at <= @to AND (e.terminated_at IS NULL OR e.terminated_at >= @from)' : "e.status <> 'TERMINATED'");
    }
    if (f['departmentId'] != null) {
      if (f['includeSubdepartments'] == true) {
        where.add(
          'e.department_id IN (WITH RECURSIVE t AS (SELECT id FROM departments WHERE id = @dep UNION SELECT d.id FROM departments d JOIN t ON d.parent_id = t.id WHERE d.deleted_at IS NULL) SELECT id FROM t)',
        );
      } else {
        where.add('e.department_id = @dep');
      }
      p['dep'] = f['departmentId'];
    }
    if (f['groupingId'] != null) {
      where.add('EXISTS (SELECT 1 FROM grouping_employments g WHERE g.employment_id = e.id AND g.grouping_id = @g)');
      p['g'] = f['groupingId'];
    }
    if (f['employeeTypeId'] != null) {
      where.add('e.employee_type_id = @et');
      p['et'] = f['employeeTypeId'];
    }
    final ids = (f['employmentIds'] as List?)?.cast<String>();
    if (ids != null && ids.isNotEmpty) {
      where.add('e.id::text = ANY(@ids)');
      p['ids'] = ids;
    }
    final rows = await tx.query(
      'SELECT e.id, e.company_id, e.rule_set_id, e.registration, e.status::text AS status, e.hired_at, e.terminated_at, p.full_name, p.social_name, p.cpf, p.birth_date, p.pis, '
      'd.name AS d_name, jp.name AS jp_name, c.legal_name AS c_legal_name, c.trade_name AS c_trade_name FROM employment_relationships e JOIN people p ON p.id = e.person_id '
      'JOIN companies c ON c.id = e.company_id LEFT JOIN departments d ON d.id = e.department_id LEFT JOIN job_positions jp ON jp.id = e.position_id '
      'WHERE ${where.join(' AND ')} ORDER BY p.full_name ASC LIMIT 2000',
      p,
    );
    return [for (final r in rows) Emp(r)];
  });

  Future<Map<String, Object?>> run(String tenantId, AuthUser user, String key, Map<String, Object?> f) async {
    final def = key == 'customizado' ? null : reports.where((r) => r.key == key).firstOrNull;
    if (key != 'customizado' && def == null) throw notFound('Relatório não encontrado');
    if (def?.permission != null && !can(user, def!.permission!)) throw forbidden('Permissão necessária: ${def.permission}');
    final needsPeriod = key == 'customizado' || def!.period == 'required';
    final from = f['from'] as String?, to = f['to'] as String?;
    if (needsPeriod && (from == null || to == null)) throw badRequest('Informe o período');
    if (from != null && to != null) {
      if (to.compareTo(from) < 0) throw badRequest('A data final deve ser igual ou posterior à inicial');
      if (DateTime.parse('${to}T00:00:00Z').difference(DateTime.parse('${from}T00:00:00Z')).inDays > 92) throw badRequest('Período de até 93 dias');
    }
    late final RCtx ctx;
    ctx = RCtx(tenantId, user, f, () => _employments(tenantId, f), () async => core0.compute(tenantId, await ctx.emps(), from!, to!), db);
    List<Col> columns;
    List<Map<String, Object?>> rows;
    if (key == 'customizado') {
      final chosen = [for (final k in (f['fields'] as List?) ?? const []) ...builderFields.where((b) => b.$1.key == k)];
      if (chosen.isEmpty) throw badRequest('Escolha ao menos um campo');
      columns = [for (final c in chosen) c.$1];
      rows = [
        for (final (e, d) in await _perDay(ctx)) {for (final c in chosen) c.$1.key: c.$2(e, d)},
      ];
    } else if (key == 'feriados') {
      columns = def!.columns!;
      final list = [
        ...((await holidays.listForCompany(tenantId, f['companyId']! as String, int.parse(from!.substring(0, 4))))['holidays']! as List).cast<Map<String, Object?>>(),
        if (to!.substring(0, 4) != from.substring(0, 4))
          ...((await holidays.listForCompany(tenantId, f['companyId']! as String, int.parse(to.substring(0, 4))))['holidays']! as List).cast<Map<String, Object?>>(),
      ];
      const s = {'NATIONAL': 'Nacional', 'STATE': 'Estadual', 'MUNICIPAL': 'Municipal', 'COMPANY': 'Empresa'};
      rows = [
        for (final h in list)
          if ((h['date']! as String).compareTo(from) >= 0 && (h['date']! as String).compareTo(to) <= 0)
            {'date': h['date'], 'name': h['name'], 'scope': s[h['scope']] ?? h['scope'], 'workday': h['workday'] == true ? 'Sim' : 'Não'},
      ];
    } else {
      columns = def!.columnsFn != null ? await def.columnsFn!(ctx) : def.columns!;
      rows = await def.run(ctx);
    }
    final totals = <String, Object?>{
      for (final c in columns)
        if (c.type == 'minutes' || c.type == 'number') c.key: rows.fold<num>(0, (s, r) => s + (r[c.key] is num ? r[c.key]! as num : num.tryParse(r[c.key]?.toString() ?? '') ?? 0)),
    };
    return {
      'key': key,
      'title': def?.title ?? 'Relatório personalizado',
      'filters': f,
      'columns': [for (final c in columns) c.toJson()],
      'rows': rows,
      'totals': totals,
      'generatedAt': isoMs(DateTime.now()),
    };
  }

  Future<Map<String, Object?>> export(String tenantId, AuthUser user, String key, Map<String, Object?> f, String format) async {
    final r = await run(tenantId, user, key, f);
    final columns = [for (final c in (r['columns']! as List).cast<Map<String, Object?>>()) Col(c['key']! as String, c['label']! as String, c['type'] as String?)];
    final rows = (r['rows']! as List).cast<Map<String, Object?>>();
    final totals = (r['totals']! as Map).cast<String, Object?>();
    final stamp = '${f['from'] ?? ''}${f['to'] != null ? '_${f['to']}' : ''}'.replaceFirst(RegExp('^_'), '');
    final base = '$key${stamp.isNotEmpty ? '_$stamp' : ''}';
    if (format == 'csv') {
      String esc(String v) => RegExp('[;"\n]').hasMatch(v) ? '"${v.replaceAll('"', '""')}"' : v;
      final lines = [
        columns.map((c) => esc(c.label)).join(';'),
        for (final row in rows) columns.map((c) => esc(formatCell(row[c.key], c.type))).join(';'),
        if (totals.isNotEmpty)
          [
            for (var i = 0; i < columns.length; i++)
              i == 0
                  ? 'Total'
                  : totals.containsKey(columns[i].key)
                  ? formatCell(totals[columns[i].key], columns[i].type)
                  : '',
          ].join(';'),
      ];
      return {'filename': '$base.csv', 'mime': 'text/csv;charset=utf-8', 'base64': base64.encode(utf8.encode('﻿${lines.join('\r\n')}\r\n'))};
    }
    final title = r['title']! as String;
    final from = f['from'] as String?, to = f['to'] as String?;
    Object? cellOf(Col c, Object? v) => c.type == 'number' ? ((v is num ? v : num.tryParse(v?.toString() ?? '')) ?? 0) : formatCell(v, c.type);
    final sheet = <List<XlsxCell>>[
      [XlsxCell(title, size: 14)],
      [XlsxCell(from != null && to != null ? 'Período: ${_dmy(from)} a ${_dmy(to)}' : 'Posição atual'), XlsxCell('Gerado em ${formatCell(r['generatedAt'], 'datetime')}')],
      [],
      [for (final c in columns) XlsxCell(c.label, fill: true)],
      for (final row in rows) [for (final c in columns) XlsxCell(cellOf(c, row[c.key]))],
      if (totals.isNotEmpty)
        [
          for (var i = 0; i < columns.length; i++)
            XlsxCell(
              i == 0
                  ? 'Total'
                  : totals.containsKey(columns[i].key)
                  ? cellOf(columns[i], totals[columns[i].key])
                  : '',
              bold: true,
            ),
        ],
    ];
    final widths = [
      for (var i = 0; i < columns.length; i++)
        (math.min(48, [10, columns[i].label.length, for (final row in rows.take(200)) formatCell(row[columns[i].key], columns[i].type).length].reduce(math.max)) + 2).toDouble(),
    ];
    final bytes = buildXlsx(sheetName: title, rows: sheet, widths: widths, frozenRows: 4);
    return {'filename': '$base.xlsx', 'mime': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'base64': base64.encode(bytes)};
  }

  void routes() {
    final r = app.router;
    r.group('/v1/reports', tag: 'relatórios', () {
      r.get(
        '',
        permission: 'reports.reports:read',
        (ctx) => {
          'reports': [
            for (final x in reports)
              if (x.permission == null || can(ctx.user, x.permission!)) {'key': x.key, 'title': x.title, 'category': x.category, 'description': x.description, 'period': x.period},
          ],
          'builderFields': [
            for (final b in builderFields) {'key': b.$1.key, 'label': b.$1.label, 'type': b.$1.type ?? 'text'},
          ],
        },
      );
      r.post('/:key/run', permission: 'reports.reports:read', status: 200, (ctx) {
        final key = ctx.param('key');
        Str(pattern: RegExp(r'^[a-z0-9-]{3,40}$')).parse(key);
        return run(ctx.tenant, ctx.user, key, filtersSchema.parse(ctx.body));
      });
      r.post('/:key/export', permission: 'reports.reports:export', status: 200, (ctx) {
        final key = ctx.param('key');
        Str(pattern: RegExp(r'^[a-z0-9-]{3,40}$')).parse(key);
        final q = Obj({
          'format': const Enum(['csv', 'xlsx']).def('xlsx'),
        }).parse(ctx.query);
        return export(ctx.tenant, ctx.user, key, filtersSchema.parse(ctx.body), q['format']! as String);
      });
    });
  }
}
