// Formatação no padrão brasileiro: datas, horas (minutos → HH:MM), CPF/CNPJ, dinheiro.
const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const weekdaysShort = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

String two(int n) => n.toString().padLeft(2, '0');

/// 'YYYY-MM-DD' (ou ISO) → 'DD/MM/AAAA'.
String brDate(Object? v) {
  if (v == null) return '';
  final s = v.toString();
  if (s.length < 10) return s;
  if (s.length > 10 && s.contains('T')) {
    final d = DateTime.tryParse(s);
    if (d != null) {
      final l = toBr(d);
      return '${two(l.day)}/${two(l.month)}/${l.year}';
    }
  }
  return '${s.substring(8, 10)}/${s.substring(5, 7)}/${s.substring(0, 4)}';
}

/// Horário de Brasília (UTC-3, sem horário de verão desde 2019).
DateTime toBr(DateTime d) => d.toUtc().subtract(const Duration(hours: 3));

String brDateTime(Object? v) {
  if (v == null) return '';
  final d = DateTime.tryParse(v.toString());
  if (d == null) return v.toString();
  final l = toBr(d);
  return '${two(l.day)}/${two(l.month)}/${l.year} ${two(l.hour)}:${two(l.minute)}';
}

String brTime(Object? v) {
  if (v == null) return '';
  final d = DateTime.tryParse(v.toString());
  if (d == null) return v.toString();
  final l = toBr(d);
  return '${two(l.hour)}:${two(l.minute)}';
}

String isoDate(DateTime d) => '${d.year}-${two(d.month)}-${two(d.day)}';
DateTime todayBr() {
  final n = toBr(DateTime.now());
  return DateTime(n.year, n.month, n.day);
}

String monthLabel(DateTime d) => '${months[d.month - 1]}/${d.year}';

/// Minutos → '±H:MM'.
String hm(Object? minutes, {bool sign = false}) {
  if (minutes == null) return '—';
  final m = minutes is num ? minutes.round() : int.tryParse('$minutes') ?? 0;
  final neg = m < 0;
  final a = m.abs();
  final s = '${a ~/ 60}:${two(a % 60)}';
  return neg ? '-$s' : (sign && m > 0 ? '+$s' : s);
}

String digits(String s) => s.replaceAll(RegExp(r'\D'), '');

String fmtCnpj(Object? v) {
  final d = normCnpj('${v ?? ''}');
  if (d.length != 14) return '${v ?? ''}';
  return '${d.substring(0, 2)}.${d.substring(2, 5)}.${d.substring(5, 8)}/${d.substring(8, 12)}-${d.substring(12)}';
}

String fmtCpf(Object? v) {
  final d = digits('${v ?? ''}');
  if (d.length != 11) return '${v ?? ''}';
  return '${d.substring(0, 3)}.${d.substring(3, 6)}.${d.substring(6, 9)}-${d.substring(9)}';
}

/// CNPJ sem pontuação (aceita o formato alfanumérico de 2026).
String normCnpj(String s) => s.toUpperCase().replaceAll(RegExp(r'[^0-9A-Z]'), '');

bool validCnpj(String s) {
  final d = normCnpj(s);
  if (!RegExp(r'^[0-9A-Z]{12}\d{2}$').hasMatch(d) || RegExp(r'^(\d)\1+$').hasMatch(d)) return false;
  int val(int i) => d.codeUnitAt(i) - 48;
  int calc(int len) {
    final w = len == 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    var sum = 0;
    for (var i = 0; i < len; i++) {
      sum += val(i) * w[i];
    }
    final r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  }

  return calc(12) == val(12) && calc(13) == val(13);
}

bool validCpf(String s) {
  final d = digits(s);
  if (d.length != 11 || RegExp(r'^(\d)\1+$').hasMatch(d)) return false;
  int calc(int len) {
    var sum = 0;
    for (var i = 0; i < len; i++) {
      sum += int.parse(d[i]) * (len + 1 - i);
    }
    final r = (sum * 10) % 11;
    return r == 10 ? 0 : r;
  }

  return calc(9) == int.parse(d[9]) && calc(10) == int.parse(d[10]);
}

String money(Object? cents) {
  final c = cents is num ? cents.round() : int.tryParse('$cents') ?? 0;
  final reais = c ~/ 100;
  final s = reais.toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => '.');
  return 'R\$ $s,${two(c.abs() % 100)}';
}

String plural(int n, String one, String many) => '$n ${n == 1 ? one : many}';

bool validPis(String s) {
  final v = digits(s);
  if (v.length != 11 || RegExp(r'^(\d)\1{10}$').hasMatch(v)) return false;
  const w = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  var sum = 0;
  for (var i = 0; i < 10; i++) {
    sum += w[i] * int.parse(v[i]);
  }
  final r = 11 - (sum % 11);
  return (r >= 10 ? 0 : r) == int.parse(v[10]);
}

String fmtPis(Object? v) {
  final d = digits('${v ?? ''}');
  if (d.length != 11) return '${v ?? ''}';
  return '${d.substring(0, 3)}.${d.substring(3, 8)}.${d.substring(8, 10)}-${d.substring(10)}';
}

/// Datas civis 'YYYY-MM-DD' (sem fuso).
String addDays(String iso, int n) => isoDate(DateTime.utc(int.parse(iso.substring(0, 4)), int.parse(iso.substring(5, 7)), int.parse(iso.substring(8, 10))).add(Duration(days: n)));
int weekdayOf(String iso) => DateTime.utc(int.parse(iso.substring(0, 4)), int.parse(iso.substring(5, 7)), int.parse(iso.substring(8, 10))).weekday % 7;
String mondayOf(String iso) => addDays(iso, -((weekdayOf(iso) + 6) % 7));
String dm(String iso) => '${iso.substring(8, 10)}/${iso.substring(5, 7)}';
String todayIso() => isoDate(todayBr());
