// Paridade do motor Dart com o motor TypeScript em milhares de cenários aleatórios.
import 'dart:convert';
import 'dart:io';
import 'package:sp_core/sp_core.dart';
import 'package:test/test.dart';

void main() {
  final data = jsonDecode(utf8.decode(gzip.decode(File('test/fixtures/engine_cases.json.gz').readAsBytesSync()))) as Map<String, Object?>;
  final cases = (data['cases'] as List<Object?>).cast<Map<String, Object?>>();
  final seqs = (data['seqs'] as List<Object?>).cast<Map<String, Object?>>();

  Map<String, Object?> norm(Map<String, Object?> m) => {for (final e in m.entries) if (e.value != null) e.key: e.value};

  test('jornada prevista e apuração diária idênticas (${cases.length} dias)', () {
    var n = 0;
    for (final c in cases) {
      final date = c['date'] as String;
      final exp = resolveExpectedDay(assignmentFromJson(c['assignment'] as Map<String, Object?>?), date,
          calendar: calendarFromJson(c['calendar'] as Map<String, Object?>?), override: overrideFromJson(c['override'] as Map<String, Object?>?));
      final want = norm(c['expected'] as Map<String, Object?>);
      final got = norm(exp.toJson());
      for (final k in ['isWorkday', 'isHoliday', 'start', 'end', 'breakMinutes', 'expectedMinutes', 'flexible', 'breakStart', 'scheduled']) {
        expect(got[k] ?? (k == 'scheduled' ? false : null), want[k] ?? (k == 'scheduled' ? false : null), reason: 'caso $n ($date) campo $k');
      }
      final r = calculateDay(
        date: date, timeZone: c['tz'] as String, expected: exp,
        punches: [for (final p in (c['punches'] as List<Object?>).cast<String>()) Punch(DateTime.parse(p))],
        rules: AttendanceRules.fromJson(c['rules'] as Map<String, Object?>), absence: absenceFromJson(c['absence'] as Map<String, Object?>?),
      );
      expect(jsonEncode(r.toJson()), jsonEncode(c['result']), reason: 'caso $n ($date)');
      n++;
    }
  });

  test('atribuição de marcações, banco de horas e resumo idênticos (${seqs.length} sequências)', () {
    for (final s in seqs) {
      final tz = s['tz'] as String;
      final a = assignmentFromJson(s['assignment'] as Map<String, Object?>);
      final days = [for (final d in (s['dates'] as List<Object?>).cast<String>()) resolveExpectedDay(a, d)];
      final punches = [for (final p in (s['punches'] as List<Object?>).cast<String>()) Punch(DateTime.parse(p), p)];
      final map = assignPunchesToDays(punches, days, tz);
      expect(jsonEncode({for (final e in map.entries) e.key: [for (final p in e.value) p.id]}), jsonEncode(s['assigned']));
      final results = [for (final e in days) calculateDay(date: e.date, timeZone: tz, expected: e, punches: [for (final p in map[e.date] ?? <Punch>[]) Punch(p.at)])];
      final pol = s['policy'] as Map<String, Object?>;
      final bank = applyToBank(BankState(), results, BankPolicy(
        enabled: true, expirationDays: (pol['expirationDays'] as num?)?.toInt(),
        creditMultiplierByPercent: {for (final e in ((pol['creditMultiplierByPercent'] as Map<String, Object?>?) ?? {}).entries) num.parse(e.key): e.value as num},
        maxDailyCreditMinutes: (pol['maxDailyCreditMinutes'] as num?)?.toInt(),
      ));
      final wantBank = s['bank'] as Map<String, Object?>;
      expect(bank.balance, wantBank['balance']);
      expect(jsonEncode([for (final e in bank.entries) {'type': e.type, 'minutes': e.minutes, 'refDate': e.refDate, if (e.type == 'CREDIT') 'expiresOn': e.expiresOn}]), jsonEncode(wantBank['entries']));
      expect(jsonEncode(summarizePeriod(results).toJson()), jsonEncode(s['summary']));
    }
  });
}
