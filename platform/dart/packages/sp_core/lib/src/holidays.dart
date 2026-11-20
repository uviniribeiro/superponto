/// Feriados brasileiros calculados para qualquer ano (nacionais, estaduais por UF e municipais
/// pelo código IBGE). Bases estadual e municipal iniciais vêm marcadas com `review` (conferir com a lei local).
library;

enum HolidayScope { national, state, municipal }
/// holiday = feriado; optional = ponto facultativo
enum HolidayKind { holiday, optional }
enum Movable { carnivalMonday, carnivalTuesday, ashWednesday, goodFriday, easter, corpusChristi }

class HolidayRule {
  const HolidayRule({required this.name, required this.kind, this.month, this.day, this.movable, this.basis, this.review = false});
  final String name;
  final HolidayKind kind;
  final int? month, day;
  final Movable? movable;
  final String? basis;
  final bool review;
}

class Holiday {
  const Holiday({required this.date, required this.name, required this.scope, required this.kind, this.uf, this.ibge, this.basis, required this.review});
  final String date;
  final String name;
  final HolidayScope scope;
  final HolidayKind kind;
  final String? uf, ibge, basis;
  final bool review;
}

/// Domingo de Páscoa (Meeus/Jones/Butcher).
({int month, int day}) easterSunday(int year) {
  final a = year % 19, b = year ~/ 100, c = year % 100;
  final d = b ~/ 4, e = b % 4, f = (b + 8) ~/ 25, g = (b - f + 1) ~/ 3;
  final h = (19 * a + b - d - g + 15) % 30;
  final i = c ~/ 4, k = c % 4;
  final l = (32 + 2 * e + 2 * i - h - k) % 7;
  final m = (a + 11 * h + 22 * l) ~/ 451;
  return (month: (h + l - 7 * m + 114) ~/ 31, day: ((h + l - 7 * m + 114) % 31) + 1);
}

const _offsets = {Movable.carnivalMonday: -48, Movable.carnivalTuesday: -47, Movable.ashWednesday: -46, Movable.goodFriday: -2, Movable.easter: 0, Movable.corpusChristi: 60};
String _iso(int y, int m, int d) => '$y-${m.toString().padLeft(2, '0')}-${d.toString().padLeft(2, '0')}';

String ruleDate(HolidayRule rule, int year) {
  if (rule.movable != null) {
    final e = easterSunday(year);
    final t = DateTime.utc(year, e.month, e.day).add(Duration(days: _offsets[rule.movable]!));
    return _iso(t.year, t.month, t.day);
  }
  return _iso(year, rule.month!, rule.day!);
}

const nationalRules = <HolidayRule>[
  HolidayRule(name: 'Confraternização Universal', kind: HolidayKind.holiday, month: 1, day: 1, basis: 'Lei nº 662/1949'),
  HolidayRule(name: 'Carnaval', kind: HolidayKind.optional, movable: Movable.carnivalMonday, basis: 'Ponto facultativo (calendário federal)'),
  HolidayRule(name: 'Carnaval', kind: HolidayKind.optional, movable: Movable.carnivalTuesday, basis: 'Ponto facultativo (calendário federal)'),
  HolidayRule(name: 'Quarta-feira de Cinzas (até 14h)', kind: HolidayKind.optional, movable: Movable.ashWednesday, basis: 'Ponto facultativo (calendário federal)'),
  HolidayRule(name: 'Sexta-feira da Paixão', kind: HolidayKind.holiday, movable: Movable.goodFriday, basis: 'Lei nº 9.093/1995'),
  HolidayRule(name: 'Tiradentes', kind: HolidayKind.holiday, month: 4, day: 21, basis: 'Lei nº 662/1949'),
  HolidayRule(name: 'Dia do Trabalho', kind: HolidayKind.holiday, month: 5, day: 1, basis: 'Lei nº 662/1949'),
  HolidayRule(name: 'Corpus Christi', kind: HolidayKind.optional, movable: Movable.corpusChristi, basis: 'Ponto facultativo (calendário federal); feriado onde houver lei municipal'),
  HolidayRule(name: 'Independência do Brasil', kind: HolidayKind.holiday, month: 9, day: 7, basis: 'Lei nº 662/1949'),
  HolidayRule(name: 'Nossa Senhora Aparecida', kind: HolidayKind.holiday, month: 10, day: 12, basis: 'Lei nº 6.802/1980'),
  HolidayRule(name: 'Finados', kind: HolidayKind.holiday, month: 11, day: 2, basis: 'Lei nº 10.607/2002'),
  HolidayRule(name: 'Proclamação da República', kind: HolidayKind.holiday, month: 11, day: 15, basis: 'Lei nº 662/1949'),
  HolidayRule(name: 'Dia Nacional de Zumbi e da Consciência Negra', kind: HolidayKind.holiday, month: 11, day: 20, basis: 'Lei nº 14.759/2023'),
  HolidayRule(name: 'Natal', kind: HolidayKind.holiday, month: 12, day: 25, basis: 'Lei nº 662/1949'),
];

HolidayRule _s(int month, int day, String name) => HolidayRule(name: name, kind: HolidayKind.holiday, month: month, day: day, basis: 'Lei estadual', review: true);
HolidayRule _m(int month, int day, String name) => HolidayRule(name: name, kind: HolidayKind.holiday, month: month, day: day, basis: 'Lei municipal', review: true);
const _cc = HolidayRule(name: 'Corpus Christi', kind: HolidayKind.holiday, movable: Movable.corpusChristi, basis: 'Lei municipal', review: true);

final stateRules = <String, List<HolidayRule>>{
  'AC': [_s(6, 15, 'Aniversário do Acre'), _s(11, 17, 'Assinatura do Tratado de Petrópolis')],
  'AL': [_s(9, 16, 'Emancipação Política de Alagoas')],
  'AM': [_s(9, 5, 'Elevação do Amazonas à categoria de província')],
  'AP': [_s(9, 13, 'Criação do Território Federal do Amapá')],
  'BA': [_s(7, 2, 'Independência da Bahia')],
  'CE': [_s(3, 19, 'Dia de São José'), _s(3, 25, 'Data Magna do Ceará')],
  'DF': [_s(11, 30, 'Dia do Evangélico')],
  'MA': [_s(7, 28, 'Adesão do Maranhão à Independência')],
  'MS': [_s(10, 11, 'Criação do Estado de Mato Grosso do Sul')],
  'PA': [_s(8, 15, 'Adesão do Pará à Independência')],
  'PB': [_s(8, 5, 'Fundação do Estado da Paraíba')],
  'PE': [_s(3, 6, 'Data Magna de Pernambuco')],
  'PI': [_s(10, 19, 'Dia do Piauí')],
  'PR': [_s(12, 19, 'Emancipação Política do Paraná')],
  'RJ': [_s(4, 23, 'Dia de São Jorge')],
  'RN': [_s(10, 3, 'Mártires de Cunhaú e Uruaçu')],
  'RO': [_s(1, 4, 'Criação do Estado de Rondônia')],
  'RR': [_s(10, 5, 'Criação do Estado de Roraima')],
  'RS': [_s(9, 20, 'Revolução Farroupilha')],
  'SE': [_s(7, 8, 'Emancipação Política de Sergipe')],
  'SP': [_s(7, 9, 'Revolução Constitucionalista')],
  'TO': [_s(10, 5, 'Criação do Estado do Tocantins')],
};

/// Municipais por código IBGE (7 dígitos). Base inicial: capitais.
final municipalRules = <String, ({String city, String uf, List<HolidayRule> rules})>{
  '3106200': (city: 'Belo Horizonte', uf: 'MG', rules: [_cc, _m(8, 15, 'Assunção de Nossa Senhora'), _m(12, 8, 'Imaculada Conceição')]),
  '3550308': (city: 'São Paulo', uf: 'SP', rules: [_m(1, 25, 'Aniversário de São Paulo'), _cc]),
  '3304557': (city: 'Rio de Janeiro', uf: 'RJ', rules: [_m(1, 20, 'Dia de São Sebastião')]),
  '2927408': (city: 'Salvador', uf: 'BA', rules: [_m(6, 24, 'São João'), _m(12, 8, 'Nossa Senhora da Conceição da Praia')]),
  '2611606': (city: 'Recife', uf: 'PE', rules: [_m(6, 24, 'São João'), _m(7, 16, 'Nossa Senhora do Carmo'), _m(12, 8, 'Nossa Senhora da Conceição')]),
  '2304400': (city: 'Fortaleza', uf: 'CE', rules: [_m(4, 13, 'Aniversário de Fortaleza'), _m(8, 15, 'Nossa Senhora da Assunção')]),
  '4106902': (city: 'Curitiba', uf: 'PR', rules: [_m(9, 8, 'Nossa Senhora da Luz dos Pinhais'), _cc]),
  '4314902': (city: 'Porto Alegre', uf: 'RS', rules: [_m(2, 2, 'Nossa Senhora dos Navegantes')]),
  '5208707': (city: 'Goiânia', uf: 'GO', rules: [_m(5, 24, 'Nossa Senhora Auxiliadora'), _m(10, 24, 'Aniversário de Goiânia')]),
  '1302603': (city: 'Manaus', uf: 'AM', rules: [_m(10, 24, 'Aniversário de Manaus'), _m(12, 8, 'Nossa Senhora da Conceição')]),
  '1501402': (city: 'Belém', uf: 'PA', rules: [_m(1, 12, 'Aniversário de Belém')]),
  '4205407': (city: 'Florianópolis', uf: 'SC', rules: [_m(3, 23, 'Aniversário de Florianópolis')]),
  '3205309': (city: 'Vitória', uf: 'ES', rules: [_m(9, 8, 'Nossa Senhora da Vitória')]),
  '2408102': (city: 'Natal', uf: 'RN', rules: [_m(1, 6, 'Santos Reis'), _m(11, 21, 'Nossa Senhora da Apresentação')]),
  '2211001': (city: 'Teresina', uf: 'PI', rules: [_m(8, 16, 'Aniversário de Teresina')]),
  '2704302': (city: 'Maceió', uf: 'AL', rules: [_m(8, 27, 'Nossa Senhora dos Prazeres'), _m(12, 8, 'Nossa Senhora da Conceição')]),
  '2800308': (city: 'Aracaju', uf: 'SE', rules: [_m(3, 17, 'Aniversário de Aracaju'), _m(12, 8, 'Nossa Senhora da Conceição')]),
  '5103403': (city: 'Cuiabá', uf: 'MT', rules: [_m(4, 8, 'Aniversário de Cuiabá')]),
  '5002704': (city: 'Campo Grande', uf: 'MS', rules: [_m(8, 26, 'Aniversário de Campo Grande')]),
  '1100205': (city: 'Porto Velho', uf: 'RO', rules: [_m(10, 2, 'Aniversário de Porto Velho')]),
  '1400100': (city: 'Boa Vista', uf: 'RR', rules: [_m(7, 9, 'Aniversário de Boa Vista')]),
  '1600303': (city: 'Macapá', uf: 'AP', rules: [_m(2, 4, 'Aniversário de Macapá')]),
  '1721000': (city: 'Palmas', uf: 'TO', rules: [_m(5, 20, 'Aniversário de Palmas')]),
  '2111300': (city: 'São Luís', uf: 'MA', rules: [_m(9, 8, 'Aniversário de São Luís')]),
};

const ufs = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

List<Holiday> _expand(List<HolidayRule> rules, int year, HolidayScope scope, {String? uf, String? ibge}) => [
      for (final r in rules) Holiday(date: ruleDate(r, year), name: r.name, scope: scope, kind: r.kind, basis: r.basis, review: r.review, uf: uf, ibge: ibge),
    ];

List<Holiday> nationalHolidays(int year) => _expand(nationalRules, year, HolidayScope.national);
List<Holiday> stateHolidays(int year, String uf) => _expand(stateRules[uf.toUpperCase()] ?? const [], year, HolidayScope.state, uf: uf.toUpperCase());
List<Holiday> municipalHolidays(int year, String ibge) {
  final m = municipalRules[ibge];
  return m == null ? const [] : _expand(m.rules, year, HolidayScope.municipal, uf: m.uf, ibge: ibge);
}

/// Feriados de um local num ano, sem repetir datas: vale o mais específico e feriado vence facultativo.
List<Holiday> holidaysFor(int year, {String? uf, String? ibge}) {
  final all = [...nationalHolidays(year), if (uf != null) ...stateHolidays(year, uf), if (ibge != null) ...municipalHolidays(year, ibge)];
  int rank(Holiday h) => (h.kind == HolidayKind.holiday ? 10 : 0) + (h.scope == HolidayScope.municipal ? 3 : h.scope == HolidayScope.state ? 2 : 1);
  final byDate = <String, Holiday>{};
  for (final h in all) {
    final cur = byDate[h.date];
    if (cur == null || rank(h) > rank(cur)) byDate[h.date] = h;
  }
  return byDate.values.toList()..sort((a, b) => a.date.compareTo(b.date));
}
