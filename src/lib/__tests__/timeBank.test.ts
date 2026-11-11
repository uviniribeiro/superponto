import { describe, expect, it } from 'vitest';
import { expectedHoursForSchedule, roundHours, workedHoursFromPunches } from '../timeBank';

const at = (h: number, m = 0) => new Date(2026, 0, 5, h, m).toISOString();

describe('workedHoursFromPunches', () => {
  it('soma os dois períodos de um dia com intervalo', () => {
    const punches = [
      { record_type: 'entry', recorded_at: at(8) },
      { record_type: 'break_start', recorded_at: at(12) },
      { record_type: 'break_end', recorded_at: at(13) },
      { record_type: 'exit', recorded_at: at(17, 30) },
    ];
    expect(workedHoursFromPunches(punches)).toBe(8.5);
  });

  it('ignora entrada sem saída correspondente', () => {
    expect(workedHoursFromPunches([{ record_type: 'entry', recorded_at: at(8) }])).toBe(0);
  });

  it('ignora saída sem entrada aberta', () => {
    const punches = [
      { record_type: 'exit', recorded_at: at(7) },
      { record_type: 'entry', recorded_at: at(8) },
      { record_type: 'exit', recorded_at: at(10) },
    ];
    expect(workedHoursFromPunches(punches)).toBe(2);
  });

  it('retorna zero sem marcações', () => {
    expect(workedHoursFromPunches([])).toBe(0);
  });
});

describe('expectedHoursForSchedule', () => {
  it('desconta o intervalo da jornada diurna', () => {
    expect(expectedHoursForSchedule({ start: '08:00', end: '17:00', breakMinutes: 60 })).toBe(8);
  });

  it('calcula jornada que atravessa a meia-noite', () => {
    expect(expectedHoursForSchedule({ start: '22:00', end: '06:00', breakMinutes: 60 })).toBe(7);
  });

  it('retorna zero para dia sem escala ou horários iguais', () => {
    expect(expectedHoursForSchedule({ start: null, end: '17:00' })).toBe(0);
    expect(expectedHoursForSchedule({ start: '08:00', end: '08:00', breakMinutes: 60 })).toBe(0);
  });

  it('nunca fica negativo quando o intervalo excede a jornada', () => {
    expect(expectedHoursForSchedule({ start: '08:00', end: '08:30', breakMinutes: 60 })).toBe(0);
  });
});

describe('roundHours', () => {
  it('arredonda para duas casas', () => {
    expect(roundHours(7.666666)).toBe(7.67);
  });
});
