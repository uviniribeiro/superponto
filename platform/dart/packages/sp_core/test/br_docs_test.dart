import 'package:sp_core/sp_core.dart';
import 'package:test/test.dart';

void main() {
  group('CNPJ', () {
    test('exemplo oficial alfanumérico', () {
      expect(cnpjCheckDigits('12ABC34501DE'), '35');
      expect(isValidCnpj('12.ABC.345/01DE-35'), isTrue);
      expect(isValidCnpj('12abc34501de35'), isTrue);
      expect(normalizeCnpj(' 12.abc.345/01de-35 '), '12ABC34501DE35');
    });
    test('rejeita DV errado, letra no DV, tamanho e sequência', () {
      for (final v in ['12ABC34501DE36', '12ABC34501DE3A', '12ABC34501DE3', '12ABC34501DE355', '00000000000000', '11111111111111', '11.222.333/0001-82']) {
        expect(isValidCnpj(v), isFalse, reason: v);
      }
      expect(isValidCnpj('11.222.333/0001-81'), isTrue);
    });
    test('formata e mascara', () {
      expect(formatCnpj('12abc34501de35'), '12.ABC.345/01DE-35');
      expect(formatCnpj('11222333000181'), '11.222.333/0001-81');
      expect(maskCnpjInput('12a'), '12.A');
      expect(maskCnpjInput('12abc34501de'), '12.ABC.345/01DE');
      expect(maskCnpjInput('12abc34501dex5'), '12.ABC.345/01DE-5');
      expect(maskCnpjInput('12abc34501de35999'), '12.ABC.345/01DE-35');
    });
  });
  test('CPF e PIS', () {
    expect(isValidCpf('529.982.247-25'), isTrue);
    expect(isValidCpf('52998224726'), isFalse);
    expect(isValidCpf('111.111.111-11'), isFalse);
    expect(formatCpf('52998224725'), '529.982.247-25');
    expect(isValidPis('120.5646.212-7'), isTrue);
    expect(isValidPis('12056462128'), isFalse);
    expect(isValidPis('00000000000'), isFalse);
  });
  group('Feriados', () {
    test('Páscoa e móveis', () {
      expect(easterSunday(2024), (month: 3, day: 31));
      expect(easterSunday(2026), (month: 4, day: 5));
      expect(easterSunday(2038), (month: 4, day: 25));
      final d = {for (final h in nationalHolidays(2027)) h.name: h.date};
      expect(d['Sexta-feira da Paixão'], '2027-03-26');
      expect(d['Corpus Christi'], '2027-05-27');
    });
    test('20 de novembro e quantidade de feriados nacionais', () {
      final n = nationalHolidays(2026);
      expect(n.firstWhere((h) => h.date == '2026-11-20').basis, 'Lei nº 14.759/2023');
      expect(n.where((h) => h.kind == HolidayKind.holiday).length, 10);
    });
    test('Belo Horizonte e São Paulo', () {
      final bh = holidaysFor(2027, uf: 'MG', ibge: '3106200');
      expect(bh.firstWhere((h) => h.date == '2027-05-27').scope, HolidayScope.municipal);
      expect(bh.map((h) => h.date).toSet().length, bh.length);
      final sp = holidaysFor(2026, uf: 'SP', ibge: '3550308');
      expect(sp.firstWhere((h) => h.date == '2026-01-25').name, 'Aniversário de São Paulo');
      expect(sp.firstWhere((h) => h.date == '2026-07-09').scope, HolidayScope.state);
    });
    test('base consistente', () {
      for (final uf in stateRules.keys) {
        expect(ufs, contains(uf));
      }
      for (final e in municipalRules.entries) {
        expect(e.key, matches(RegExp(r'^\d{7}$')));
      }
    });
  });
}
