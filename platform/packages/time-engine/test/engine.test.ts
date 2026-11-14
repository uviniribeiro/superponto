import { describe, expect, it } from 'vitest';
import {
  activeAssignment, applyToBank, assignPunchesToDays, calculateDay, cyclicTemplate, emptyBank, expireUntil,
  resolveExpectedDay, summarizePeriod, type Schedule, type ScheduleAssignment,
} from '../src/index.ts';

const TZ = 'America/Sao_Paulo'; // UTC-3, sem horário de verão
/** Instante local de São Paulo -> Date */
const at = (date: string, hm: string) => new Date(`${date}T${hm}:00-03:00`);

const weekly: Schedule = {
  type: 'FIXED',
  days: [1, 2, 3, 4, 5].map((d) => ({ dayIndex: d, isWorkday: true, startTime: '08:00', endTime: '17:00', breakMinutes: 60 })),
};
const office: ScheduleAssignment = { schedule: weekly, validFrom: '2026-01-01' };
// 2026-03-02 é segunda-feira
const MON = '2026-03-02';
const day = (date: string, punches: string[], a: ScheduleAssignment = office, extra = {}) =>
  calculateDay({
    date, timeZone: TZ, expected: resolveExpectedDay(a, date),
    punches: punches.map((p) => {
      const [d, hm] = p.includes(' ') ? p.split(' ') : [date, p];
      return { at: at(d!, hm!) };
    }),
    ...extra,
  });

describe('jornada prevista', () => {
  it('semanal: dia útil e fim de semana', () => {
    expect(resolveExpectedDay(office, MON)).toMatchObject({ isWorkday: true, start: 480, end: 1020, expectedMinutes: 480 });
    expect(resolveExpectedDay(office, '2026-03-07').isWorkday).toBe(false);
  });

  it('feriado anula o dia útil', () => {
    expect(resolveExpectedDay(office, MON, { date: MON, isHoliday: true })).toMatchObject({ isWorkday: false, isHoliday: true });
  });

  it.each([
    ['SHIFT_12X36', [true, false, true, false]],
    ['SHIFT_6X1', [true, true, true, true, true, true, false, true]],
    ['SHIFT_5X2', [true, true, true, true, true, false, false, true]],
    ['SHIFT_4X2', [true, true, true, true, false, false, true]],
  ] as const)('escala %s segue o ciclo a partir do início', (type, pattern) => {
    const a: ScheduleAssignment = { schedule: cyclicTemplate(type, '07:00', '19:00', 60), validFrom: MON, cycleStart: MON };
    pattern.forEach((work, i) => {
      const date = new Date(Date.parse(`${MON}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
      expect(resolveExpectedDay(a, date).isWorkday, `${type} dia ${i}`).toBe(work);
    });
  });

  it('plantão noturno atravessa a meia-noite', () => {
    const a: ScheduleAssignment = { schedule: cyclicTemplate('SHIFT_12X36', '19:00', '07:00'), validFrom: MON, cycleStart: MON };
    expect(resolveExpectedDay(a, MON)).toMatchObject({ start: 1140, end: 1860, expectedMinutes: 720 });
  });

  it('vigência mais recente vale na data', () => {
    const newer: ScheduleAssignment = { schedule: cyclicTemplate('SHIFT_12X36', '07:00', '19:00'), validFrom: '2026-03-01' };
    expect(activeAssignment([office, newer], MON)).toBe(newer);
    expect(activeAssignment([office, newer], '2026-02-27')).toBe(office);
  });
});

describe('apuração diária', () => {
  it('dia completo sem ocorrências', () => {
    const r = day(MON, ['08:00', '12:00', '13:00', '17:00']);
    expect(r).toMatchObject({ workedMinutes: 480, balanceMinutes: 0, breakMinutes: 60, overtimeMinutes: 0 });
    expect(r.flags).toEqual([]);
  });

  it('variações dentro da tolerância da CLT são desconsideradas', () => {
    const r = day(MON, ['08:04', '12:00', '13:00', '17:00']);
    expect(r.balanceMinutes).toBe(0);
    expect(r.flags).toContain('WITHIN_TOLERANCE');
  });

  it('acima da tolerância conta todos os minutos', () => {
    const r = day(MON, ['08:20', '12:00', '13:00', '17:00']);
    expect(r).toMatchObject({ lateMinutes: 20, balanceMinutes: -20 });
    expect(r.flags).toContain('LATE');
  });

  it('tolerância diária total de 10 minutos', () => {
    const r = day(MON, ['08:05', '12:00', '13:00', '16:54']);
    expect(r.flags).not.toContain('WITHIN_TOLERANCE');
    expect(r.balanceMinutes).toBe(-11);
  });

  it('hora extra em dia normal com 50%', () => {
    const r = day(MON, ['08:00', '12:00', '13:00', '19:00']);
    expect(r.overtime).toEqual([{ percent: 50, minutes: 120 }]);
    expect(r.balanceMinutes).toBe(120);
  });

  it('extra acima do limite diário é sinalizada', () => {
    expect(day(MON, ['08:00', '12:00', '13:00', '20:00']).flags).toContain('OVERTIME_LIMIT_EXCEEDED');
  });

  it('trabalho no fim de semana é extra a 100%', () => {
    const r = day('2026-03-07', ['08:00', '12:00']);
    expect(r.overtime).toEqual([{ percent: 100, minutes: 240 }]);
    expect(r.flags).toContain('WORK_ON_REST_DAY');
  });

  it('falta em dia útil desconta a jornada', () => {
    const r = day(MON, []);
    expect(r).toMatchObject({ absenceMinutes: 480, balanceMinutes: -480 });
    expect(r.flags).toEqual(['ABSENCE']);
  });

  it('afastamento integral neutraliza o dia', () => {
    expect(day(MON, [], office, { absence: { kind: 'full' } })).toMatchObject({ balanceMinutes: 0, flags: ['LEAVE_FULL'] });
  });

  it('marcação ímpar fica pendente, sem desconto automático', () => {
    const r = day(MON, ['08:00', '12:00', '13:00']);
    expect(r.flags).toContain('INCOMPLETE');
    expect(r.balanceMinutes).toBe(0);
  });

  it('intervalo menor que o mínimo vira extra de intervalo', () => {
    const r = day(MON, ['08:00', '12:00', '12:30', '16:30']);
    expect(r.breakShortfallMinutes).toBe(30);
    expect(r.overtime).toContainEqual({ percent: 50, minutes: 30 });
  });

  it('desconto automático de intervalo quando configurado', () => {
    const r = day(MON, ['08:00', '17:00'], office, { rules: { autoDeductBreak: true } });
    expect(r).toMatchObject({ workedMinutes: 480, breakMinutes: 60 });
    expect(r.flags).toContain('AUTO_BREAK_DEDUCTED');
  });

  it('plantão 12x36 noturno: horas noturnas e hora reduzida', () => {
    const a: ScheduleAssignment = { schedule: cyclicTemplate('SHIFT_12X36', '19:00', '07:00'), validFrom: MON, cycleStart: MON };
    const r = day(MON, ['19:00', '2026-03-03 07:00'], a);
    expect(r.workedMinutes).toBe(720);
    expect(r.balanceMinutes).toBe(0);
    expect(r.nightMinutes).toBe(420); // 22:00-05:00
    expect(r.nightReducedMinutes).toBe(480);
  });

  it('marcações do plantão noturno são atribuídas ao dia de início', () => {
    const a: ScheduleAssignment = { schedule: cyclicTemplate('SHIFT_12X36', '19:00', '07:00'), validFrom: MON, cycleStart: MON };
    const days = [MON, '2026-03-03'].map((d) => resolveExpectedDay(a, d));
    const map = assignPunchesToDays([{ at: at(MON, '18:55') }, { at: at('2026-03-03', '07:02') }], days, TZ);
    expect(map.get(MON)).toHaveLength(2);
    expect(map.get('2026-03-03')).toHaveLength(0);
  });
});

describe('banco de horas e período', () => {
  const policy = { enabled: true, expirationDays: 30 };

  it('credita extras, debita atrasos e consome créditos antigos primeiro', () => {
    const days = [day(MON, ['08:00', '12:00', '13:00', '19:00']), day('2026-03-03', ['08:30', '12:00', '13:00', '17:00'])];
    const bank = applyToBank(emptyBank(), days, policy);
    expect(bank.balance).toBe(90);
    expect(bank.openCredits).toEqual([{ minutes: 90, expiresOn: '2026-04-01' }]);
  });

  it('crédito vence após o prazo', () => {
    const bank = applyToBank(emptyBank(), [day(MON, ['08:00', '12:00', '13:00', '19:00'])], policy);
    const expired = expireUntil(bank, '2026-04-02');
    expect(expired.balance).toBe(0);
    expect(expired.entries.at(-1)).toMatchObject({ type: 'EXPIRATION', minutes: -120 });
  });

  it('multiplicador por percentual de extra', () => {
    const bank = applyToBank(emptyBank(), [day('2026-03-07', ['08:00', '12:00'])], { ...policy, creditMultiplierByPercent: { 100: 2 } });
    expect(bank.balance).toBe(480);
  });

  it('resumo do período soma vínculos sem misturar percentuais', () => {
    const s = summarizePeriod([day(MON, ['08:00', '12:00', '13:00', '19:00']), day('2026-03-03', []), day('2026-03-07', ['08:00', '12:00'])]);
    expect(s).toMatchObject({ workedMinutes: 840, absenceDays: 1, balanceMinutes: 120 - 480 + 240 });
    expect(s.overtimeByPercent).toEqual([{ percent: 50, minutes: 120 }, { percent: 100, minutes: 240 }]);
  });
});
