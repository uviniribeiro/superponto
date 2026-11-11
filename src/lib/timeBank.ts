/**
 * Cálculo de horas trabalhadas para o Banco de Horas.
 * Pareia entrada/retorno de intervalo com saída/início de intervalo, na ordem das marcações.
 */
export interface TimeBankPunch {
  record_type: string;
  recorded_at: string;
}

const OPENS = new Set(['entry', 'break_end']);
const CLOSES = new Set(['exit', 'break_start']);

/** Horas trabalhadas (decimais) a partir das marcações de um dia, já ordenadas por horário. */
export function workedHoursFromPunches(punches: TimeBankPunch[]): number {
  let worked = 0;
  let openedAt: number | null = null;
  for (const punch of punches) {
    const at = new Date(punch.recorded_at).getTime();
    if (OPENS.has(punch.record_type)) {
      openedAt = at;
    } else if (CLOSES.has(punch.record_type) && openedAt !== null) {
      worked += (at - openedAt) / 3_600_000;
      openedAt = null;
    }
  }
  return worked;
}

/** Arredonda para duas casas decimais, como exibido no Banco de Horas. */
export const roundHours = (hours: number) => Math.round(hours * 100) / 100;

export interface DaySchedule {
  start: string | null;
  end: string | null;
  breakMinutes?: number | null;
}

/**
 * Horas previstas (decimais) para um dia de escala.
 * Jornadas que atravessam a meia-noite (ex.: 22:00–06:00) somam as horas do dia seguinte.
 */
export function expectedHoursForSchedule({ start, end, breakMinutes }: DaySchedule): number {
  if (!start || !end) return 0;
  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  let span = toMinutes(end) - toMinutes(start);
  if (span === 0) return 0;
  if (span < 0) span += 24 * 60;
  return Math.max(0, span - (breakMinutes || 0)) / 60;
}
