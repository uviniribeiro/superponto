// Tipos de horário, modelos prontos e contas de carga (os mesmos da web).
const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const scheduleTypes = {
  'FIXED': 'Semanal fixa',
  'FLEXIBLE': 'Flexível (carga por dia)',
  'SHIFT_12X36': 'Escala 12x36',
  'SHIFT_6X1': 'Escala 6x1',
  'SHIFT_5X2': 'Escala 5x2 (ciclo)',
  'SHIFT_4X2': 'Escala 4x2',
  'ROTATING': 'Revezamento',
  'CUSTOM': 'Ciclo personalizado',
  'ON_CALL': 'Sobreaviso / plantão',
  'TEACHING': 'Docente',
};
const cyclicTypes = {'SHIFT_12X36', 'SHIFT_6X1', 'SHIFT_5X2', 'SHIFT_4X2', 'ROTATING', 'CUSTOM', 'ON_CALL'};

String hours(Object? m) {
  final v = m is num ? m.round() : 0;
  if (v == 0) return '0h';
  final h = v ~/ 60, r = v % 60;
  return r > 0 ? '${h}h${r.toString().padLeft(2, '0')}' : '${h}h';
}

int toMin(String v) => int.parse(v.substring(0, 2)) * 60 + int.parse(v.substring(3, 5));
int span(String s, String e) {
  var b = toMin(e);
  final a = toMin(s);
  if (b <= a) b += 1440;
  return b - a;
}

bool validHm(String v) => RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch(v);

Map<String, dynamic> workDay(int i, String s, String e, [int b = 60, String? bs]) => {
  'dayIndex': i,
  'isWorkday': true,
  'startTime': s,
  'endTime': e,
  'breakMinutes': b,
  'breakStart': bs,
  'expectedMinutes': 0,
};
Map<String, dynamic> offDay(int i) => {'dayIndex': i, 'isWorkday': false, 'startTime': null, 'endTime': null, 'breakMinutes': 0, 'breakStart': null, 'expectedMinutes': 0};

int dayExpected(Map<String, dynamic> d) {
  if (d['isWorkday'] != true) return 0;
  final s = d['startTime'] as String?, e = d['endTime'] as String?;
  if (s != null && e != null && validHm(s) && validHm(e)) return (span(s, e) - ((d['breakMinutes'] as num?)?.toInt() ?? 0)).clamp(0, 1440);
  return (d['expectedMinutes'] as num?)?.toInt() ?? 0;
}

const schedulePresets = [
  ('comercial', 'Comercial (seg–sex)'),
  ('sabado', 'Seg–sex + sábado'),
  ('12x36', '12x36 diurno'),
  ('12x36n', '12x36 noturno'),
  ('6x1', '6x1'),
  ('5x2', '5x2 em ciclo'),
  ('4x2', '4x2'),
  ('flex', 'Flexível'),
];

({String type, int? cycleDays, bool considerHolidays, List<Map<String, dynamic>> days}) preset(String kind) {
  ({String type, int? cycleDays, bool considerHolidays, List<Map<String, dynamic>> days}) cycle(String type, int w, int o, String s, String e, int b) =>
      (type: type, cycleDays: w + o, considerHolidays: false, days: [for (var i = 0; i < w + o; i++) i < w ? workDay(i, s, e, b) : offDay(i)]);
  final week = [0, 1, 2, 3, 4, 5, 6];
  switch (kind) {
    case 'comercial':
      return (type: 'FIXED', cycleDays: null, considerHolidays: true, days: [for (final d in week) d >= 1 && d <= 5 ? workDay(d, '08:00', '17:00', 60, '12:00') : offDay(d)]);
    case 'sabado':
      return (
        type: 'FIXED',
        cycleDays: null,
        considerHolidays: true,
        days: [
          for (final d in week)
            d >= 1 && d <= 5
                ? workDay(d, '08:00', '17:00', 60, '12:00')
                : d == 6
                ? workDay(d, '08:00', '12:00', 0)
                : offDay(d),
        ],
      );
    case '12x36':
      return cycle('SHIFT_12X36', 1, 1, '07:00', '19:00', 60);
    case '12x36n':
      return cycle('SHIFT_12X36', 1, 1, '19:00', '07:00', 60);
    case '6x1':
      return cycle('SHIFT_6X1', 6, 1, '07:00', '15:20', 60);
    case '5x2':
      return cycle('SHIFT_5X2', 5, 2, '08:00', '17:00', 60);
    case '4x2':
      return cycle('SHIFT_4X2', 4, 2, '07:00', '19:00', 60);
    case 'flex':
      return (
        type: 'FLEXIBLE',
        cycleDays: null,
        considerHolidays: true,
        days: [
          for (final d in week) d >= 1 && d <= 5 ? {...offDay(d), 'isWorkday': true, 'expectedMinutes': 480, 'breakMinutes': 60} : offDay(d),
        ],
      );
    default:
      return (type: 'FIXED', cycleDays: null, considerHolidays: true, days: [for (final d in week) offDay(d)]);
  }
}
