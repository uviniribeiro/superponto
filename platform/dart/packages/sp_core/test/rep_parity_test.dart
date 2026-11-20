// Paridade dos protocolos de relógio com a implementação TypeScript.
import 'dart:convert';
import 'dart:io';
import 'package:sp_core/sp_core.dart';
import 'package:test/test.dart';

void main() {
  final f = jsonDecode(File('test/fixtures/rep_cases.json').readAsStringSync()) as Map<String, Object?>;
  final files = (f['files'] as List<Object?>).cast<String>();
  final parsed = (f['parsed'] as List<Object?>).cast<Map<String, Object?>>();

  String iso(Object? v) => v == null ? '' : DateTime.parse(v as String).toUtc().toIso8601String();
  Map<String, Object?> norm(Map<String, Object?> r) => {
        for (final e in r.entries)
          if (e.value != null) e.key: (['occurredAt', 'before', 'after'].contains(e.key) ? iso(e.value) : e.value),
      };

  test('leitura de ${files.length} AFDs (1.510 e 671, com erros) igual', () {
    for (var i = 0; i < files.length; i++) {
      final r = parseAfd(files[i]);
      final want = parsed[i];
      expect(afdLayoutName(r.layout), want['layout'], reason: 'arquivo $i');
      expect(r.warnings, want['warnings'], reason: 'arquivo $i');
      expect(jsonEncode(r.trailer), jsonEncode(want['trailer']), reason: 'arquivo $i');
      expect(r.header?.toJson(), want['header'], reason: 'arquivo $i');
      final got = [for (final x in r.records) norm(x.toJson())];
      final exp = [for (final x in (want['records'] as List<Object?>).cast<Map<String, Object?>>()) norm(x)];
      expect(got, exp, reason: 'arquivo $i');
    }
  });

  test('gerador do AFD do REP-P igual (cabeçalho, tipo 7 com hash encadeado, trailer, CRC)', () {
    expect(crc16('123456789'), f['crc']);
    expect(afdTrailer671({'7': 30}), f['trailer']);
    expect(afdHeader671(employerIdType: 'CNPJ', employerId: '11.222.333/0001-81', employerName: 'Clínica Vida Ltda', repId: '12345678901234567', periodStart: '2026-11-01',
        periodEnd: '2026-11-30', generatedAt: DateTime.utc(2026, 12, 1, 11), developerId: '11222333000181', model: 'SuperPonto'), f['header']);
    for (final w in (f['writer'] as List<Object?>).cast<Map<String, Object?>>()) {
      final at = DateTime.parse(w['at'] as String);
      final r = afdRecord7(nsr: w['nsr'] as int, at: at, cpf: '52998224725', recordedAt: at, collector: w['collector'] as String, offline: w['offline'] as bool, previousHash: w['prev'] as String?);
      expect(r.line, w['line']);
      expect(r.hash, w['hash']);
    }
  });

  test('Henry e Control iD iguais', () {
    final h = (f['henry'] as List<Object?>).map((x) => (x as List<Object?>).cast<int>()).toList();
    expect(encodeHenry(7, 'RH'), h[0]);
    expect(encodeHenry(42, 'EU', data: henryUser('I', '52998224725', name: 'JOÃO PEREIRA')), h[1]);
    expect(encodeHenry(3, 'RR', data: 'T]50]1'), h[2]);
    final ev = parseHenryEvents('3+1[0[52998224725[03/11/2026 07:58:10[1[0[5[0]2[0[52998224725[03/11/2026 12:01:00[2[0[5[0]3[83[0[03/11/2026 12:02:00[0[0[0[0');
    expect(henryEventsToAfd(ev, AfdLayout.p671), f['henryAfd671']);
    expect(henryEventsToAfd(ev, AfdLayout.p1510), f['henryAfd1510']);
    final cid = (f['cid'] as List<Object?>).cast<List<Object?>>();
    String enc(List<DeviceRequest> l) => jsonEncode([for (final r in l) {'method': r.method, 'path': r.path, if (r.body != null) 'body': r.body, if (r.homologationPending) 'homologationPending': true}]);
    expect(jsonDecode(enc(controlIdSetClock(DateTime.utc(2026, 11, 3, 10, 0, 5), 'America/Sao_Paulo'))), cid[0]);
    expect(jsonDecode(enc(controlIdFetchAfd(AfdLayout.p1510, fromNsr: 5))), cid[1]);
    expect(jsonDecode(enc(controlIdUpsertEmployee(const RepEmployee(name: 'JOÃO PEREIRA', cpf: '52998224725', registration: '10'), AfdLayout.p671, rep: true))), cid[2]);
    expect(jsonDecode(enc(controlIdUpsertEmployee(const RepEmployee(name: 'Ana', pis: '12056462127', registration: '7'), AfdLayout.p1510, rep: false))), cid[3]);
    // Quadro chegando em pedaços.
    final all = encodeHenry(1, 'RH', data: '24/06/10 16:35:15]00/00/00]00/00/00');
    expect(decodeHenry(all.sublist(0, 6)).frames, isEmpty);
    expect(decodeHenry(all).frames.single.data, '24/06/10 16:35:15]00/00/00]00/00/00');
  });
}
