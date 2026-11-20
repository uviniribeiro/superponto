import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

var _tzReady = false;
void _ensureTz() {
  if (!_tzReady) {
    tzdata.initializeTimeZones();
    _tzReady = true;
  }
}

/// Arredondamento igual ao Math.round do JavaScript (meio para cima), para resultados idênticos.
int jsRound(num x) => (x + 0.5).floor();

/// Data e minutos locais (0–1439) de um instante no fuso.
({String date, int minutes}) toLocal(DateTime instant, String timeZone) {
  _ensureTz();
  final t = tz.TZDateTime.from(instant, tz.getLocation(timeZone));
  return (date: civil(t.year, t.month, t.day), minutes: t.hour * 60 + t.minute);
}

/// Partes locais completas (com segundos e deslocamento do fuso).
({int year, int month, int day, int hour, int minute, int second, int offsetMinutes}) localParts(DateTime instant, String timeZone) {
  _ensureTz();
  final t = tz.TZDateTime.from(instant, tz.getLocation(timeZone));
  return (year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, second: t.second, offsetMinutes: t.timeZoneOffset.inMinutes);
}

/// Instante (UTC) de uma data/hora local no fuso.
DateTime zonedToUtc(int year, int month, int day, int hour, int minute, int second, String timeZone) {
  _ensureTz();
  return tz.TZDateTime(tz.getLocation(timeZone), year, month, day, hour, minute, second).toUtc();
}

String civil(int y, int m, int d) => '${y.toString().padLeft(4, '0')}-${m.toString().padLeft(2, '0')}-${d.toString().padLeft(2, '0')}';
DateTime _utcDate(String date) => DateTime.parse('${date}T00:00:00Z');

/// "HH:mm" -> minutos.
int parseHm(String value) {
  final m = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch(value.trim());
  if (m == null) throw FormatException('Horário inválido: $value');
  final h = int.parse(m[1]!), mi = int.parse(m[2]!);
  if (h > 23 || mi > 59) throw FormatException('Horário inválido: $value');
  return h * 60 + mi;
}

String addDays(String date, int days) {
  final d = _utcDate(date).add(Duration(days: days));
  return civil(d.year, d.month, d.day);
}

/// Diferença em dias civis (b - a).
int diffDays(String a, String b) => jsRound(_utcDate(b).difference(_utcDate(a)).inHours / 24);

/// Dia da semana (0 = domingo).
int weekday(String date) => _utcDate(date).weekday % 7;

/// Minutos de um instante em relação à meia-noite local de `baseDate` (pode passar de 1440).
int minutesFrom(String baseDate, DateTime instant, String timeZone) {
  final l = toLocal(instant, timeZone);
  return diffDays(baseDate, l.date) * 1440 + l.minutes;
}

String formatMinutes(num minutes) {
  final sign = minutes < 0 ? '-' : '';
  final abs = jsRound(minutes.abs());
  return '$sign${(abs ~/ 60).toString().padLeft(2, '0')}:${(abs % 60).toString().padLeft(2, '0')}';
}
