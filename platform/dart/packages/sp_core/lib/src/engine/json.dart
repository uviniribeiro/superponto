// Conversão das estruturas do motor de/para JSON (mesmo formato do banco e da API).
import 'calculate.dart';
import 'schedule.dart';

Schedule scheduleFromJson(Map<String, Object?> j) => Schedule(
      type: scheduleTypeFrom(j['type'] as String),
      cycleDays: (j['cycleDays'] as num?)?.toInt(),
      considerHolidays: (j['considerHolidays'] as bool?) ?? true,
      inItinereMinutes: (j['inItinereMinutes'] as num?)?.toInt() ?? 0,
      entryMobilityMinutes: (j['entryMobilityMinutes'] as num?)?.toInt() ?? 0,
      breakMobilityMinutes: (j['breakMobilityMinutes'] as num?)?.toInt() ?? 0,
      days: [
        for (final d in (j['days'] as List<Object?>).cast<Map<String, Object?>>())
          ScheduleDay(
            dayIndex: (d['dayIndex'] as num).toInt(), isWorkday: d['isWorkday'] as bool, startTime: d['startTime'] as String?, endTime: d['endTime'] as String?,
            breakMinutes: (d['breakMinutes'] as num?)?.toInt() ?? 0, breakStart: d['breakStart'] as String?, expectedMinutes: (d['expectedMinutes'] as num?)?.toInt(),
          ),
      ],
    );

ScheduleAssignment? assignmentFromJson(Map<String, Object?>? j) => j == null
    ? null
    : ScheduleAssignment(schedule: scheduleFromJson(j['schedule'] as Map<String, Object?>), validFrom: j['validFrom'] as String, validTo: j['validTo'] as String?, cycleStart: j['cycleStart'] as String?);

DayOverride? overrideFromJson(Map<String, Object?>? j) => j == null
    ? null
    : DayOverride(isWorkday: j['isWorkday'] as bool, startTime: j['startTime'] as String?, endTime: j['endTime'] as String?, breakMinutes: (j['breakMinutes'] as num?)?.toInt() ?? 0,
        breakStart: j['breakStart'] as String?, expectedMinutes: (j['expectedMinutes'] as num?)?.toInt());

CalendarDay? calendarFromJson(Map<String, Object?>? j) =>
    j == null ? null : CalendarDay(date: j['date'] as String, isHoliday: j['isHoliday'] as bool, isWorkday: (j['isWorkday'] as bool?) ?? false);

DayAbsence? absenceFromJson(Map<String, Object?>? j) =>
    j == null ? null : (j['kind'] == 'full' ? DayAbsence.full(j['reason'] as String?) : DayAbsence.partial((j['minutes'] as num?)?.toInt() ?? 0, j['reason'] as String?));
