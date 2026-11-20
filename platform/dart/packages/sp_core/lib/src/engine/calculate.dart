// Apuração diária: marcações + jornada prevista + regras -> resultado auditável.
// Porta fiel do motor TypeScript (mesmos números, mesmas ocorrências).
import 'schedule.dart';
import 'time.dart';

const engineVersion = '2.1.0';

enum RoundingMode { up, down, nearest }

class OvertimePercent {
  const OvertimePercent({this.normal = 50, this.night = 50, this.rest = 100, this.holiday = 100, this.breakPercent = 50});
  final num normal, night, rest, holiday, breakPercent;
  factory OvertimePercent.fromJson(Map<String, Object?>? j, [OvertimePercent base = const OvertimePercent()]) => OvertimePercent(
        normal: (j?['normal'] as num?) ?? base.normal, night: (j?['night'] as num?) ?? base.night, rest: (j?['rest'] as num?) ?? base.rest,
        holiday: (j?['holiday'] as num?) ?? base.holiday, breakPercent: (j?['break'] as num?) ?? base.breakPercent,
      );
  Map<String, Object?> toJson() => {'normal': normal, 'night': night, 'rest': rest, 'holiday': holiday, 'break': breakPercent};
}

class OvertimeBand {
  const OvertimeBand({required this.upToMinutes, required this.percent});
  final int? upToMinutes;
  final num percent;
}

class AttendanceRules {
  const AttendanceRules({
    this.markToleranceMinutes = 5, this.dailyToleranceMinutes = 10, this.roundingMinutes = 0, this.roundingMode = RoundingMode.nearest,
    this.overtimePercent = const OvertimePercent(), this.nightStart = '22:00', this.nightEnd = '05:00', this.reducedNightHour = true,
    this.minBreakMinutes = 60, this.autoDeductBreak = false, this.dailyOvertimeLimitMinutes = 120, this.discountAbsences = true, this.overtimeBands = const [],
  });
  final int markToleranceMinutes, dailyToleranceMinutes, roundingMinutes, minBreakMinutes, dailyOvertimeLimitMinutes;
  final RoundingMode roundingMode;
  final OvertimePercent overtimePercent;
  final String nightStart, nightEnd;
  final bool reducedNightHour, autoDeductBreak, discountAbsences;
  final List<OvertimeBand> overtimeBands;

  /// Regras gravadas (JSON parcial) sobre os padrões.
  factory AttendanceRules.fromJson(Map<String, Object?>? j) {
    const d = AttendanceRules();
    if (j == null) return d;
    int i(String k, int def) => (j[k] as num?)?.toInt() ?? def;
    final bands = (j['overtimeBands'] as List<Object?>?)?.cast<Map<String, Object?>>() ?? const [];
    return AttendanceRules(
      markToleranceMinutes: i('markToleranceMinutes', d.markToleranceMinutes), dailyToleranceMinutes: i('dailyToleranceMinutes', d.dailyToleranceMinutes),
      roundingMinutes: i('roundingMinutes', d.roundingMinutes),
      roundingMode: RoundingMode.values.firstWhere((m) => m.name == j['roundingMode'], orElse: () => d.roundingMode),
      overtimePercent: OvertimePercent.fromJson(j['overtimePercent'] as Map<String, Object?>?),
      nightStart: (j['nightStart'] as String?) ?? d.nightStart, nightEnd: (j['nightEnd'] as String?) ?? d.nightEnd,
      reducedNightHour: (j['reducedNightHour'] as bool?) ?? d.reducedNightHour, minBreakMinutes: i('minBreakMinutes', d.minBreakMinutes),
      autoDeductBreak: (j['autoDeductBreak'] as bool?) ?? d.autoDeductBreak, dailyOvertimeLimitMinutes: i('dailyOvertimeLimitMinutes', d.dailyOvertimeLimitMinutes),
      discountAbsences: (j['discountAbsences'] as bool?) ?? d.discountAbsences,
      overtimeBands: [for (final b in bands) OvertimeBand(upToMinutes: (b['upToMinutes'] as num?)?.toInt(), percent: (b['percent'] as num?) ?? 50)],
    );
  }
}

class Punch {
  const Punch(this.at, [this.id]);
  final DateTime at;
  final String? id;
}

class DayAbsence {
  const DayAbsence.full([this.reason]) : full = true, minutes = 0;
  const DayAbsence.partial(this.minutes, [this.reason]) : full = false;
  final bool full;
  final int minutes;
  final String? reason;
}

class OvertimePart {
  OvertimePart(this.percent, this.minutes);
  final num percent;
  int minutes;
  Map<String, Object?> toJson() => {'percent': percent, 'minutes': minutes};
}

class DayResult {
  DayResult({
    required this.date, required this.expectedMinutes, this.workedMinutes = 0, this.balanceMinutes = 0, this.breakMinutes = 0, this.nightMinutes = 0,
    this.nightReducedMinutes = 0, this.lateMinutes = 0, this.earlyLeaveMinutes = 0, this.earlyEntryMinutes = 0, this.absenceMinutes = 0,
    this.breakShortfallMinutes = 0, this.breakDeviationMinutes = 0, this.inItinereMinutes = 0, this.entryShiftMinutes = 0,
    List<OvertimePart>? overtime, this.overtimeMinutes = 0, List<({int start, int end})>? intervals, required this.flags,
  })  : overtime = overtime ?? [],
        intervals = intervals ?? [];
  final String date;
  final String engineVersionUsed = engineVersion;
  final int expectedMinutes, workedMinutes, balanceMinutes, breakMinutes, nightMinutes, nightReducedMinutes, lateMinutes, earlyLeaveMinutes,
      earlyEntryMinutes, absenceMinutes, breakShortfallMinutes, breakDeviationMinutes, inItinereMinutes, entryShiftMinutes, overtimeMinutes;
  final List<OvertimePart> overtime;
  final List<({int start, int end})> intervals;
  final List<String> flags;

  Map<String, Object?> toJson() => {
        'date': date, 'engineVersion': engineVersionUsed, 'expectedMinutes': expectedMinutes, 'workedMinutes': workedMinutes, 'balanceMinutes': balanceMinutes,
        'breakMinutes': breakMinutes, 'nightMinutes': nightMinutes, 'nightReducedMinutes': nightReducedMinutes, 'lateMinutes': lateMinutes,
        'earlyLeaveMinutes': earlyLeaveMinutes, 'earlyEntryMinutes': earlyEntryMinutes, 'absenceMinutes': absenceMinutes,
        'breakShortfallMinutes': breakShortfallMinutes, 'breakDeviationMinutes': breakDeviationMinutes, 'inItinereMinutes': inItinereMinutes,
        'entryShiftMinutes': entryShiftMinutes, 'overtime': [for (final o in overtime) o.toJson()], 'overtimeMinutes': overtimeMinutes,
        'intervals': [for (final i in intervals) {'start': i.start, 'end': i.end}], 'flags': flags,
      };
}

int _round(num minutes, AttendanceRules r) {
  if (r.roundingMinutes == 0) return jsRound(minutes);
  final ratio = minutes / r.roundingMinutes;
  final v = switch (r.roundingMode) { RoundingMode.up => ratio.ceil(), RoundingMode.down => ratio.floor(), RoundingMode.nearest => jsRound(ratio) };
  return v * r.roundingMinutes;
}

/// Minutos noturnos em [start, end) (relativos à meia-noite da data base).
int nightMinutes(int start, int end, AttendanceRules rules) {
  final ns = parseHm(rules.nightStart), ne = parseHm(rules.nightEnd);
  var total = 0;
  for (var m = start; m < end; m++) {
    final mod = ((m % 1440) + 1440) % 1440;
    final isNight = ns < ne ? (mod >= ns && mod < ne) : (mod >= ns || mod < ne);
    if (isNight) total++;
  }
  return total;
}

DayResult calculateDay({required String date, required String timeZone, required ExpectedDay expected, required List<Punch> punches, AttendanceRules rules = const AttendanceRules(), DayAbsence? absence}) {
  var exp = expected;
  final flags = <String>[];
  if (exp.scheduled) flags.add('SCHEDULED_DAY');

  if (absence != null && absence.full) {
    flags.add('LEAVE_FULL');
    return DayResult(date: date, expectedMinutes: exp.expectedMinutes, absenceMinutes: exp.expectedMinutes, flags: flags);
  }
  final leaveMinutes = absence != null ? (absence.minutes < exp.expectedMinutes ? absence.minutes : exp.expectedMinutes) : 0;
  if (leaveMinutes > 0) flags.add('LEAVE_PARTIAL');
  final effectiveExpected = (exp.expectedMinutes - leaveMinutes).clamp(0, 1 << 30);

  final marks = [for (final p in punches) minutesFrom(date, p.at, timeZone)]..sort();

  if (marks.isEmpty) {
    if (exp.isWorkday && effectiveExpected > 0) {
      flags.add('ABSENCE');
      return DayResult(date: date, expectedMinutes: exp.expectedMinutes, absenceMinutes: effectiveExpected, balanceMinutes: rules.discountAbsences ? -effectiveExpected : 0, flags: flags);
    }
    return DayResult(date: date, expectedMinutes: exp.expectedMinutes, flags: flags);
  }

  // Pareamento sequencial (1ª,2ª), (3ª,4ª)...
  final intervals = <({int start, int end})>[];
  for (var i = 0; i + 1 < marks.length; i += 2) {
    intervals.add((start: marks[i], end: marks[i + 1]));
  }
  final incomplete = marks.length.isOdd;
  if (incomplete) flags.add('INCOMPLETE');

  var worked = intervals.fold<int>(0, (s, iv) => s + (iv.end - iv.start));
  var breakMinutes = 0;
  for (var i = 1; i < intervals.length; i++) {
    breakMinutes += intervals[i].start - intervals[i - 1].end;
  }
  var night = intervals.fold<int>(0, (s, iv) => s + nightMinutes(iv.start, iv.end, rules));

  if (intervals.length == 1 && rules.autoDeductBreak && exp.breakMinutes > 0 && worked > exp.breakMinutes) {
    breakMinutes = exp.breakMinutes;
    worked -= breakMinutes;
    flags.add('AUTO_BREAK_DEDUCTED');
  }
  worked = _round(worked, rules);
  if (worked < 0) worked = 0;
  night = night.clamp(0, worked);

  final inItinere = !incomplete && worked > 0 ? exp.inItinereMinutes : 0;
  if (inItinere > 0) {
    worked += inItinere;
    flags.add('IN_ITINERE');
  }

  var breakShortfall = 0;
  if (intervals.length > 1 && rules.minBreakMinutes > 0 && breakMinutes < rules.minBreakMinutes && worked > 360) {
    breakShortfall = rules.minBreakMinutes - breakMinutes;
    flags.add('INSUFFICIENT_BREAK');
  }

  // Mobilidade de jornada.
  final first = marks.first;
  var entryShift = 0;
  final mobility = exp.entryMobilityMinutes;
  if (mobility > 0 && exp.start != null && exp.end != null && (first - exp.start!).abs() <= mobility && first != exp.start) {
    entryShift = first - exp.start!;
    exp = exp.copyWith(start: exp.start! + entryShift, end: exp.end! + entryShift, breakStart: exp.breakStart == null ? null : exp.breakStart! + entryShift, clearBreakStart: exp.breakStart == null);
    flags.add('MOBILE_ENTRY');
  }

  // Intervalo fora da janela e maior que o previsto.
  var breakDeviation = 0;
  if (intervals.length > 1 && exp.breakStart != null) {
    final allowed = exp.breakMobilityMinutes > rules.markToleranceMinutes ? exp.breakMobilityMinutes : rules.markToleranceMinutes;
    final diff = (intervals[0].end - exp.breakStart!).abs();
    if (diff > allowed) {
      breakDeviation = diff - allowed;
      flags.add('BREAK_OUT_OF_WINDOW');
    }
  }
  if (intervals.length > 1 && exp.breakMinutes > 0 && breakMinutes > exp.breakMinutes + rules.markToleranceMinutes) flags.add('BREAK_EXCEEDED');

  var late = 0, earlyLeave = 0, earlyEntry = 0, lateExit = 0;
  final int? last = incomplete ? null : marks.last;
  if (exp.start != null) {
    if (first > exp.start!) {
      late = first - exp.start!;
    } else {
      earlyEntry = exp.start! - first;
    }
  }
  if (exp.end != null && last != null) {
    if (last < exp.end!) {
      earlyLeave = exp.end! - last;
    } else {
      lateExit = last - exp.end!;
    }
  }

  // CLT art. 58 §1º.
  final variations = [late, earlyLeave, earlyEntry, lateExit];
  final withinTolerance = exp.isWorkday && !exp.flexible && !incomplete &&
      variations.every((v) => v <= rules.markToleranceMinutes) &&
      variations.fold<int>(0, (s, v) => s + v) <= rules.dailyToleranceMinutes &&
      variations.any((v) => v > 0);
  if (withinTolerance) {
    flags.add('WITHIN_TOLERANCE');
    late = earlyLeave = earlyEntry = 0;
  } else {
    if (late > 0) flags.add('LATE');
    if (earlyLeave > 0) flags.add('EARLY_LEAVE');
    if (earlyEntry > 0) flags.add('EARLY_ENTRY');
  }

  final dayKind = exp.isHoliday ? 'holiday' : exp.isWorkday ? 'normal' : 'rest';
  if (dayKind == 'holiday') flags.add('WORK_ON_HOLIDAY');
  if (dayKind == 'rest') flags.add('WORK_ON_REST_DAY');

  int balance, overtimeMinutes;
  if (incomplete) {
    balance = 0;
    overtimeMinutes = 0;
  } else if (dayKind == 'normal') {
    balance = withinTolerance ? 0 : worked - effectiveExpected;
    overtimeMinutes = balance > 0 ? balance : 0;
  } else {
    balance = worked;
    overtimeMinutes = worked;
  }

  final overtime = <OvertimePart>[];
  void push(num percent, int minutes) {
    if (minutes <= 0) return;
    for (final o in overtime) {
      if (o.percent == percent) {
        o.minutes += minutes;
        return;
      }
    }
    overtime.add(OvertimePart(percent, minutes));
  }

  if (overtimeMinutes > 0) {
    final pct = dayKind == 'holiday' ? rules.overtimePercent.holiday : dayKind == 'rest' ? rules.overtimePercent.rest : rules.overtimePercent.normal;
    final nightPart = night < overtimeMinutes ? night : overtimeMinutes;
    final dayPart = overtimeMinutes - nightPart;
    if (dayKind == 'normal' && rules.overtimeBands.isNotEmpty) {
      var left = dayPart, used = 0;
      for (final band in rules.overtimeBands) {
        if (left <= 0) break;
        final room = band.upToMinutes == null ? left : (band.upToMinutes! - used).clamp(0, 1 << 30);
        final take = left < room ? left : room;
        push(band.percent, take);
        left -= take;
        used += take;
      }
      push(rules.overtimeBands.last.percent, left);
    } else {
      push(pct, dayPart);
    }
    push(dayKind == 'normal' ? rules.overtimePercent.night : pct, nightPart);
  }
  if (breakShortfall > 0) push(rules.overtimePercent.breakPercent, breakShortfall);
  if (rules.dailyOvertimeLimitMinutes > 0 && overtimeMinutes > rules.dailyOvertimeLimitMinutes && dayKind == 'normal') flags.add('OVERTIME_LIMIT_EXCEEDED');

  return DayResult(
    date: date, expectedMinutes: exp.expectedMinutes, workedMinutes: worked, balanceMinutes: balance, breakMinutes: breakMinutes, nightMinutes: night,
    nightReducedMinutes: rules.reducedNightHour ? jsRound(night * 60 / 52.5) : night, lateMinutes: late, earlyLeaveMinutes: earlyLeave,
    earlyEntryMinutes: earlyEntry, absenceMinutes: leaveMinutes, breakShortfallMinutes: breakShortfall, breakDeviationMinutes: breakDeviation,
    inItinereMinutes: inItinere, entryShiftMinutes: entryShift, overtime: overtime, overtimeMinutes: overtimeMinutes + breakShortfall, intervals: intervals, flags: flags,
  );
}

/// Atribui cada marcação ao dia de jornada (janela início-4h até fim+4h); sem jornada, a data local.
Map<String, List<Punch>> assignPunchesToDays(List<Punch> punches, List<ExpectedDay> days, String timeZone, {int marginMinutes = 240}) {
  final result = <String, List<Punch>>{for (final d in days) d.date: []};
  final ordered = [...days]..sort((a, b) => a.date.compareTo(b.date));
  for (final p in punches) {
    String? target;
    for (final day in ordered) {
      if (day.start == null || day.end == null) continue;
      final m = minutesFrom(day.date, p.at, timeZone);
      if (m >= day.start! - marginMinutes && m <= day.end! + marginMinutes) {
        target = day.date;
        break;
      }
    }
    target ??= toLocal(p.at, timeZone).date;
    (result[target] ??= []).add(p);
  }
  return result;
}
