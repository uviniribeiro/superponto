// Resolução da jornada prevista de um vínculo em uma data.
import 'time.dart';

enum ScheduleType { fixed, flexible, shift12x36, shift6x1, shift5x2, shift4x2, rotating, custom, onCall, teaching }

const _typeNames = {
  'FIXED': ScheduleType.fixed, 'FLEXIBLE': ScheduleType.flexible, 'SHIFT_12X36': ScheduleType.shift12x36, 'SHIFT_6X1': ScheduleType.shift6x1,
  'SHIFT_5X2': ScheduleType.shift5x2, 'SHIFT_4X2': ScheduleType.shift4x2, 'ROTATING': ScheduleType.rotating, 'CUSTOM': ScheduleType.custom,
  'ON_CALL': ScheduleType.onCall, 'TEACHING': ScheduleType.teaching,
};
ScheduleType scheduleTypeFrom(String v) => _typeNames[v] ?? (throw ArgumentError('Tipo de escala desconhecido: $v'));
String scheduleTypeName(ScheduleType t) => _typeNames.entries.firstWhere((e) => e.value == t).key;

class ScheduleDay {
  const ScheduleDay({required this.dayIndex, required this.isWorkday, this.startTime, this.endTime, this.breakMinutes = 0, this.breakStart, this.expectedMinutes});
  /// dia da semana (0-6) em jornadas semanais; posição no ciclo em escalas cíclicas
  final int dayIndex;
  final bool isWorkday;
  final String? startTime, endTime, breakStart;
  final int breakMinutes;
  final int? expectedMinutes;
}

class Schedule {
  const Schedule({required this.type, required this.days, this.cycleDays, this.considerHolidays = true, this.inItinereMinutes = 0, this.entryMobilityMinutes = 0, this.breakMobilityMinutes = 0});
  final ScheduleType type;
  final List<ScheduleDay> days;
  final int? cycleDays;
  /// feriado vira folga (padrão); falso: o dia segue a escala
  final bool considerHolidays;
  final int inItinereMinutes, entryMobilityMinutes, breakMobilityMinutes;
}

/// Escala agendada: substitui a jornada de um dia específico.
class DayOverride {
  const DayOverride({required this.isWorkday, this.startTime, this.endTime, this.breakMinutes = 0, this.breakStart, this.expectedMinutes});
  final bool isWorkday;
  final String? startTime, endTime, breakStart;
  final int breakMinutes;
  final int? expectedMinutes;
}

class ScheduleAssignment {
  const ScheduleAssignment({required this.schedule, required this.validFrom, this.validTo, this.cycleStart});
  final Schedule schedule;
  final String validFrom;
  final String? validTo, cycleStart;
}

class CalendarDay {
  const CalendarDay({required this.date, required this.isHoliday, this.isWorkday = false});
  final String date;
  final bool isHoliday;
  /// feriado/evento marcado como dia útil
  final bool isWorkday;
}

class ExpectedDay {
  const ExpectedDay({
    required this.date, required this.isWorkday, required this.isHoliday, this.start, this.end, this.breakMinutes = 0, this.expectedMinutes = 0,
    this.flexible = false, this.breakStart, this.inItinereMinutes = 0, this.entryMobilityMinutes = 0, this.breakMobilityMinutes = 0, this.scheduled = false,
  });
  final String date;
  final bool isWorkday, isHoliday, flexible, scheduled;
  /// minutos desde 00:00 da data (fim pode passar de 1440)
  final int? start, end, breakStart;
  final int breakMinutes, expectedMinutes, inItinereMinutes, entryMobilityMinutes, breakMobilityMinutes;

  ExpectedDay copyWith({bool? isHoliday, bool? scheduled, int? start, int? end, int? breakStart, bool clearBreakStart = false}) => ExpectedDay(
        date: date, isWorkday: isWorkday, isHoliday: isHoliday ?? this.isHoliday, start: start ?? this.start, end: end ?? this.end,
        breakMinutes: breakMinutes, expectedMinutes: expectedMinutes, flexible: flexible, breakStart: clearBreakStart ? null : (breakStart ?? this.breakStart),
        inItinereMinutes: inItinereMinutes, entryMobilityMinutes: entryMobilityMinutes, breakMobilityMinutes: breakMobilityMinutes, scheduled: scheduled ?? this.scheduled,
      );

  Map<String, Object?> toJson() => {
        'date': date, 'isWorkday': isWorkday, 'isHoliday': isHoliday, 'start': start, 'end': end, 'breakMinutes': breakMinutes, 'expectedMinutes': expectedMinutes,
        'flexible': flexible, 'breakStart': breakStart, 'inItinereMinutes': inItinereMinutes, 'entryMobilityMinutes': entryMobilityMinutes,
        'breakMobilityMinutes': breakMobilityMinutes, if (scheduled) 'scheduled': true,
      };
}

const _cyclic = {ScheduleType.shift12x36, ScheduleType.shift6x1, ScheduleType.shift5x2, ScheduleType.shift4x2, ScheduleType.rotating, ScheduleType.custom, ScheduleType.onCall};

bool isCyclic(Schedule s) => _cyclic.contains(s.type) && (s.cycleDays ?? 0) > 0;

/// Vigência ativa na data (a mais recente que cobre o dia).
ScheduleAssignment? activeAssignment(List<ScheduleAssignment> assignments, String date) {
  final list = assignments.where((a) => a.validFrom.compareTo(date) <= 0 && (a.validTo == null || a.validTo!.compareTo(date) >= 0)).toList()
    ..sort((a, b) => b.validFrom.compareTo(a.validFrom));
  return list.isEmpty ? null : list.first;
}

ExpectedDay resolveExpectedDay(ScheduleAssignment? assignment, String date, {CalendarDay? calendar, DayOverride? override}) {
  final calendarHoliday = (calendar?.isHoliday ?? false) && !(calendar?.isWorkday ?? false);
  final holiday = calendarHoliday && (assignment?.schedule.considerHolidays ?? true);
  final empty = ExpectedDay(date: date, isWorkday: false, isHoliday: holiday);
  final s = assignment?.schedule;
  final extras = (s?.inItinereMinutes ?? 0, s?.entryMobilityMinutes ?? 0, s?.breakMobilityMinutes ?? 0);

  // Escala agendada vence a jornada e o feriado.
  if (override != null) {
    if (!override.isWorkday) return empty.copyWith(isHoliday: calendarHoliday, scheduled: true);
    return _build(date, override.startTime, override.endTime, override.breakMinutes, override.breakStart, override.expectedMinutes, extras).copyWith(scheduled: true);
  }
  if (assignment == null) return empty;
  final schedule = assignment.schedule;
  final int index;
  if (isCyclic(schedule)) {
    final origin = assignment.cycleStart ?? assignment.validFrom;
    final cycle = schedule.cycleDays!;
    index = ((diffDays(origin, date) % cycle) + cycle) % cycle;
  } else {
    index = weekday(date);
  }
  ScheduleDay? day;
  for (final d in schedule.days) {
    if (d.dayIndex == index) {
      day = d;
      break;
    }
  }
  if (day == null || !day.isWorkday || holiday) return empty.copyWith(isHoliday: holiday);
  return _build(date, day.startTime, day.endTime, day.breakMinutes, day.breakStart, day.expectedMinutes, extras);
}

ExpectedDay _build(String date, String? startTime, String? endTime, int breakMinutes, String? breakStartHm, int? expectedMinutes, (int, int, int) extras) {
  if (startTime == null || startTime.isEmpty || endTime == null || endTime.isEmpty) {
    final expected = expectedMinutes ?? 0;
    return ExpectedDay(date: date, isWorkday: expected > 0, isHoliday: false, breakMinutes: breakMinutes, expectedMinutes: expected, flexible: true,
        inItinereMinutes: extras.$1, entryMobilityMinutes: extras.$2, breakMobilityMinutes: extras.$3);
  }
  final start = parseHm(startTime);
  var end = parseHm(endTime);
  if (end <= start) end += 1440; // atravessa a meia-noite
  int? breakStart = breakStartHm != null && breakStartHm.isNotEmpty ? parseHm(breakStartHm) : null;
  if (breakStart != null && breakStart < start) breakStart += 1440;
  final expected = (expectedMinutes != null && expectedMinutes != 0) ? expectedMinutes : (end - start - breakMinutes).clamp(0, 1 << 30);
  return ExpectedDay(date: date, isWorkday: true, isHoliday: false, start: start, end: end, breakMinutes: breakMinutes, expectedMinutes: expected, breakStart: breakStart,
      inItinereMinutes: extras.$1, entryMobilityMinutes: extras.$2, breakMobilityMinutes: extras.$3);
}

/// Modelos de escala cíclica prontos (12x36, 6x1, 5x2, 4x2).
Schedule cyclicTemplate(ScheduleType type, String start, String end, {int breakMinutes = 0}) {
  final pattern = {ScheduleType.shift12x36: (1, 1), ScheduleType.shift6x1: (6, 1), ScheduleType.shift5x2: (5, 2), ScheduleType.shift4x2: (4, 2)}[type];
  if (pattern == null) throw ArgumentError('Modelo cíclico inválido');
  final cycle = pattern.$1 + pattern.$2;
  return Schedule(type: type, cycleDays: cycle, days: [
    for (var i = 0; i < cycle; i++)
      ScheduleDay(dayIndex: i, isWorkday: i < pattern.$1, startTime: i < pattern.$1 ? start : null, endTime: i < pattern.$1 ? end : null, breakMinutes: i < pattern.$1 ? breakMinutes : 0),
  ]);
}
