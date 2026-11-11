import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ATTENDANCE_RULES,
  applyReducedNightHour,
  calculateDay,
  formatMinutes,
  nightMinutesBetween,
  roundMinutes,
  summarizePeriod,
  type AttendanceRules,
  type DayCalculationInput,
  type PunchInput,
} from '../timeCalculation';

const rules = (overrides: Partial<AttendanceRules> = {}): AttendanceRules => ({
  ...DEFAULT_ATTENDANCE_RULES,
  ...overrides,
});

const t = (h: number, m = 0, day = 5) => new Date(2026, 0, day, h, m);
const punch = (record_type: PunchInput['record_type'], date: Date): PunchInput => ({ record_type, recorded_at: date });

const standardDay = (
  punches: PunchInput[],
  overrides: Partial<DayCalculationInput> = {}
): DayCalculationInput => ({
  date: t(0),
  punches,
  journey: { start: '08:00', end: '17:00', expectedMinutes: 480, breakMinutes: 60 },
  dayKind: 'normal',
  rules: rules(),
  ...overrides,
});

const fullDay = (entry = t(8), exit = t(17), breakStart = t(12), breakEnd = t(13)) => [
  punch('entry', entry),
  punch('break_start', breakStart),
  punch('break_end', breakEnd),
  punch('exit', exit),
];

describe('roundMinutes', () => {
  it('não arredonda quando o passo é zero', () => {
    expect(roundMinutes(17, rules())).toBe(17);
  });
  it('respeita os modos para cima, para baixo e mais próximo', () => {
    expect(roundMinutes(17, rules({ rounding_minutes: 5, rounding_mode: 'up' }))).toBe(20);
    expect(roundMinutes(17, rules({ rounding_minutes: 5, rounding_mode: 'down' }))).toBe(15);
    expect(roundMinutes(17, rules({ rounding_minutes: 5, rounding_mode: 'nearest' }))).toBe(15);
  });
});

describe('nightMinutesBetween / applyReducedNightHour', () => {
  it('conta minutos noturnos atravessando a meia-noite', () => {
    expect(nightMinutesBetween(t(21), t(6, 0, 6), rules())).toBe(7 * 60);
  });
  it('retorna zero para jornada diurna ou intervalo inválido', () => {
    expect(nightMinutesBetween(t(8), t(17), rules())).toBe(0);
    expect(nightMinutesBetween(t(17), t(8), rules())).toBe(0);
  });
  it('converte pela hora noturna reduzida de 52min30s', () => {
    expect(applyReducedNightHour(420, rules())).toBe(480);
    expect(applyReducedNightHour(420, rules({ use_reduced_night_hour: false }))).toBe(420);
  });
});

describe('calculateDay', () => {
  it('apura um dia completo sem ocorrências', () => {
    const r = calculateDay(standardDay(fullDay()));
    expect(r.workedMinutes).toBe(480);
    expect(r.balanceMinutes).toBe(0);
    expect(r.overtimeMinutes).toBe(0);
    expect(r.breakMinutes).toBe(60);
    expect(r.occurrences).toEqual([]);
  });

  it('registra atraso acima da tolerância e gera saldo negativo', () => {
    const r = calculateDay(standardDay(fullDay(t(8, 20))));
    expect(r.lateMinutes).toBe(20);
    expect(r.balanceMinutes).toBe(-20);
    expect(r.occurrences).toContain('Atraso de 20 min na entrada');
  });

  it('não registra atraso dentro da tolerância de entrada', () => {
    const r = calculateDay(standardDay(fullDay(t(8, 4))));
    expect(r.lateMinutes).toBe(0);
    expect(r.balanceMinutes).toBe(-4);
  });

  it('zera débito dentro da tolerância diária', () => {
    const r = calculateDay(standardDay(fullDay(t(8, 6))));
    expect(r.lateMinutes).toBe(6);
    expect(r.balanceMinutes).toBe(0);
  });

  it('calcula hora extra no dia normal com percentual padrão', () => {
    const r = calculateDay(standardDay(fullDay(t(8), t(19))));
    expect(r.overtimeMinutes).toBe(120);
    expect(r.overtimeByPercent).toEqual([{ percent: 50, minutes: 120 }]);
    expect(r.balanceMinutes).toBe(120);
  });

  it('sinaliza extra acima do limite diário', () => {
    const r = calculateDay(standardDay(fullDay(t(8), t(20))));
    expect(r.occurrences.some((o) => o.startsWith('Extra acima do limite diário'))).toBe(true);
  });

  it('considera toda a jornada como extra em feriado', () => {
    const r = calculateDay(standardDay(fullDay(), { dayKind: 'holiday' }));
    expect(r.overtimeMinutes).toBe(480);
    expect(r.overtimeByPercent).toEqual([{ percent: 100, minutes: 480 }]);
  });

  it('marca falta sem marcações e desconta conforme regra', () => {
    const r = calculateDay(standardDay([]));
    expect(r.isAbsent).toBe(true);
    expect(r.balanceMinutes).toBe(-480);
    const noDiscount = calculateDay(standardDay([], { rules: rules({ auto_discount_absences: false }) }));
    expect(noDiscount.balanceMinutes).toBe(0);
  });

  it('não marca falta em dia de folga sem marcações', () => {
    const r = calculateDay(standardDay([], { dayKind: 'rest' }));
    expect(r.isAbsent).toBe(false);
  });

  it('neutraliza o dia em afastamento integral', () => {
    const r = calculateDay(standardDay([], { absence: { type: 'full', reason: 'Atestado' } }));
    expect(r.balanceMinutes).toBe(0);
    expect(r.absenceMinutes).toBe(480);
    expect(r.occurrences).toEqual(['Afastamento integral: Atestado']);
  });

  it('reduz a jornada prevista em afastamento parcial', () => {
    const r = calculateDay(
      standardDay(fullDay(t(8), t(13), t(10), t(10)), { absence: { type: 'partial', minutes: 240 } })
    );
    expect(r.workedMinutes).toBe(300);
    expect(r.balanceMinutes).toBe(60);
  });

  it('gera extra de intervalo quando a intrajornada é menor que o mínimo', () => {
    const r = calculateDay(standardDay(fullDay(t(8), t(16, 30), t(12), t(12, 30))));
    expect(r.intraJourneyShortfallMinutes).toBe(30);
    expect(r.breakOvertimeMinutes).toBe(30);
    expect(r.overtimeByPercent).toContainEqual({ percent: 50, minutes: 30 });
  });

  it('desconta intervalo automaticamente quando não há marcação de intervalo', () => {
    const r = calculateDay(standardDay([punch('entry', t(8)), punch('exit', t(17))]));
    expect(r.breakMinutes).toBe(60);
    expect(r.workedMinutes).toBe(480);
    expect(r.occurrences).toContain('Intervalo descontado automaticamente (sem marcação)');
  });

  it('marca dia incompleto com marcação única', () => {
    const r = calculateDay(standardDay([punch('entry', t(8))]));
    expect(r.incomplete).toBe(true);
    expect(r.workedMinutes).toBe(0);
  });

  it('separa extra noturna com percentual próprio', () => {
    const r = calculateDay(
      standardDay(fullDay(t(14), t(0, 0, 6), t(18), t(19)), {
        journey: { start: '14:00', end: '22:00', expectedMinutes: 420, breakMinutes: 60 },
        rules: rules({ overtime_night_percent: 70 }),
      })
    );
    expect(r.workedMinutes).toBe(540);
    expect(r.nightMinutes).toBe(120);
    expect(r.overtimeByPercent).toEqual([{ percent: 70, minutes: 120 }]);
  });
});

describe('summarizePeriod', () => {
  it('soma os dias e agrupa extras por percentual', () => {
    const r = rules();
    const days = [
      calculateDay(standardDay(fullDay(t(8), t(19)))),
      calculateDay(standardDay(fullDay(t(8, 0, 6), t(17, 0, 6), t(12, 0, 6), t(13, 0, 6)), { dayKind: 'holiday' })),
      calculateDay(standardDay([])),
    ];
    const summary = summarizePeriod(days, r);
    expect(summary.workedMinutes).toBe(600 + 480);
    expect(summary.absenceDays).toBe(1);
    expect(summary.overtimeByPercent).toEqual([
      { percent: 50, minutes: 120 },
      { percent: 100, minutes: 480 },
    ]);
  });

  it('compensa débitos com créditos dentro do limite mensal', () => {
    const days = [
      calculateDay(standardDay(fullDay(t(8), t(18)))),
      calculateDay(standardDay(fullDay(t(8, 30)))),
    ];
    const summary = summarizePeriod(days, rules());
    expect(summary.compensatedMinutes).toBe(30);
    expect(summary.residualBalanceMinutes).toBe(30);
  });

  it('não compensa quando excede o número de ocorrências do mês', () => {
    const late = calculateDay(standardDay(fullDay(t(8, 30))));
    const summary = summarizePeriod([late, late], rules({ max_occurrences_per_month: 1 }));
    expect(summary.compensatedMinutes).toBe(0);
  });
});

describe('formatMinutes', () => {
  it('formata positivos e negativos como HH:mm', () => {
    expect(formatMinutes(125)).toBe('02:05');
    expect(formatMinutes(-90)).toBe('-01:30');
    expect(formatMinutes(0)).toBe('00:00');
  });
});
