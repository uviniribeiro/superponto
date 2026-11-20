// Banco de horas (créditos, débitos, vencimento FIFO) e resumo do período.
import 'calculate.dart';
import 'time.dart';

class BankPolicy {
  const BankPolicy({required this.enabled, this.expirationDays, this.creditMultiplierByPercent = const {}, this.maxDailyCreditMinutes});
  final bool enabled;
  final int? expirationDays;
  final Map<num, num> creditMultiplierByPercent;
  final int? maxDailyCreditMinutes;
}

class BankEntry {
  const BankEntry(this.type, this.minutes, this.refDate, [this.expiresOn]);
  /// CREDIT, DEBIT ou EXPIRATION
  final String type;
  final int minutes;
  final String refDate;
  final String? expiresOn;
}

class OpenCredit {
  OpenCredit(this.minutes, this.expiresOn);
  int minutes;
  final String? expiresOn;
}

class BankState {
  BankState({this.balance = 0, List<BankEntry>? entries, List<OpenCredit>? openCredits}) : entries = entries ?? [], openCredits = openCredits ?? [];
  int balance;
  final List<BankEntry> entries;
  List<OpenCredit> openCredits;
  BankState copy() => BankState(balance: balance, entries: [...entries], openCredits: [for (final c in openCredits) OpenCredit(c.minutes, c.expiresOn)]);
}

void _expire(BankState s, String date) {
  for (final c in s.openCredits) {
    if (c.minutes > 0 && c.expiresOn != null && c.expiresOn!.compareTo(date) < 0) {
      s.entries.add(BankEntry('EXPIRATION', -c.minutes, c.expiresOn!));
      s.balance -= c.minutes;
      c.minutes = 0;
    }
  }
  s.openCredits = s.openCredits.where((c) => c.minutes > 0).toList();
}

/// Aplica os resultados diários (em ordem). Débitos consomem os créditos mais antigos.
BankState applyToBank(BankState initial, List<DayResult> days, BankPolicy policy) {
  final s = initial.copy();
  if (!policy.enabled) return s;
  for (final day in [...days]..sort((a, b) => a.date.compareTo(b.date))) {
    _expire(s, day.date);
    if (day.balanceMinutes > 0) {
      var credit = 0;
      if (day.overtime.isNotEmpty) {
        for (final o in day.overtime) {
          credit += jsRound(o.minutes * (policy.creditMultiplierByPercent[o.percent] ?? 1));
        }
      } else {
        credit = day.balanceMinutes;
      }
      if (policy.maxDailyCreditMinutes != null && credit > policy.maxDailyCreditMinutes!) credit = policy.maxDailyCreditMinutes!;
      final expiresOn = policy.expirationDays == null ? null : addDays(day.date, policy.expirationDays!);
      s.entries.add(BankEntry('CREDIT', credit, day.date, expiresOn));
      s.openCredits.add(OpenCredit(credit, expiresOn));
      s.balance += credit;
    } else if (day.balanceMinutes < 0) {
      var debit = -day.balanceMinutes;
      s.entries.add(BankEntry('DEBIT', day.balanceMinutes, day.date));
      s.balance += day.balanceMinutes;
      for (final c in s.openCredits) {
        if (debit == 0) break;
        final used = c.minutes < debit ? c.minutes : debit;
        c.minutes -= used;
        debit -= used;
      }
      s.openCredits = s.openCredits.where((c) => c.minutes > 0).toList();
    }
  }
  return s;
}

BankState expireUntil(BankState initial, String date) {
  final s = initial.copy();
  _expire(s, date);
  return s;
}

class PeriodSummary {
  int days = 0, workdays = 0, expectedMinutes = 0, workedMinutes = 0, balanceMinutes = 0, overtimeMinutes = 0, nightMinutes = 0,
      nightReducedMinutes = 0, lateMinutes = 0, earlyLeaveMinutes = 0, absenceDays = 0, incompleteDays = 0;
  List<({num percent, int minutes})> overtimeByPercent = [];

  Map<String, Object?> toJson() => {
        'days': days, 'workdays': workdays, 'expectedMinutes': expectedMinutes, 'workedMinutes': workedMinutes, 'balanceMinutes': balanceMinutes,
        'overtimeMinutes': overtimeMinutes, 'overtimeByPercent': [for (final o in overtimeByPercent) {'percent': o.percent, 'minutes': o.minutes}],
        'nightMinutes': nightMinutes, 'nightReducedMinutes': nightReducedMinutes, 'lateMinutes': lateMinutes, 'earlyLeaveMinutes': earlyLeaveMinutes,
        'absenceDays': absenceDays, 'incompleteDays': incompleteDays,
      };
}

PeriodSummary summarizePeriod(List<DayResult> days) {
  final s = PeriodSummary()..days = days.length;
  final byPercent = <num, int>{};
  for (final d in days) {
    if (d.expectedMinutes > 0) s.workdays++;
    s.expectedMinutes += d.expectedMinutes;
    s.workedMinutes += d.workedMinutes;
    s.balanceMinutes += d.balanceMinutes;
    s.overtimeMinutes += d.overtimeMinutes;
    s.nightMinutes += d.nightMinutes;
    s.nightReducedMinutes += d.nightReducedMinutes;
    s.lateMinutes += d.lateMinutes;
    s.earlyLeaveMinutes += d.earlyLeaveMinutes;
    if (d.flags.contains('ABSENCE')) s.absenceDays++;
    if (d.flags.contains('INCOMPLETE')) s.incompleteDays++;
    for (final o in d.overtime) {
      byPercent[o.percent] = (byPercent[o.percent] ?? 0) + o.minutes;
    }
  }
  s.overtimeByPercent = [for (final e in byPercent.entries) (percent: e.key, minutes: e.value)]..sort((a, b) => a.percent.compareTo(b.percent));
  return s;
}
