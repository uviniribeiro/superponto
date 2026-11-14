// Resolução da jornada prevista de um vínculo em uma data.
import { type CivilDate, diffDays, parseHm, weekday } from './time.ts';

export type ScheduleType =
  | 'FIXED'
  | 'FLEXIBLE'
  | 'SHIFT_12X36'
  | 'SHIFT_6X1'
  | 'SHIFT_5X2'
  | 'SHIFT_4X2'
  | 'ROTATING'
  | 'CUSTOM'
  | 'ON_CALL'
  | 'TEACHING';

export interface ScheduleDay {
  /** dia da semana (0-6) em jornadas semanais; posição no ciclo em escalas cíclicas */
  dayIndex: number;
  isWorkday: boolean;
  startTime?: string | null;
  endTime?: string | null;
  breakMinutes?: number;
  /** obrigatório em jornadas flexíveis (sem horário fixo) */
  expectedMinutes?: number;
}

export interface Schedule {
  type: ScheduleType;
  days: ScheduleDay[];
  /** tamanho do ciclo em dias (escalas cíclicas) */
  cycleDays?: number | null;
}

export interface ScheduleAssignment {
  schedule: Schedule;
  validFrom: CivilDate;
  validTo?: CivilDate | null;
  /** primeiro dia do ciclo (posição 0) */
  cycleStart?: CivilDate | null;
}

export interface CalendarDay {
  date: CivilDate;
  isHoliday: boolean;
  /** feriado/evento marcado como dia útil (ex.: dia de planejamento) */
  isWorkday?: boolean;
}

export interface ExpectedDay {
  date: CivilDate;
  isWorkday: boolean;
  isHoliday: boolean;
  /** minutos desde 00:00 da data (fim pode passar de 1440 em jornadas noturnas) */
  start: number | null;
  end: number | null;
  breakMinutes: number;
  expectedMinutes: number;
  flexible: boolean;
}

const CYCLIC: ScheduleType[] = ['SHIFT_12X36', 'SHIFT_6X1', 'SHIFT_5X2', 'SHIFT_4X2', 'ROTATING', 'CUSTOM', 'ON_CALL'];

export function isCyclic(schedule: Schedule): boolean {
  return CYCLIC.includes(schedule.type) && !!schedule.cycleDays;
}

/** Vigência ativa na data (a mais recente que cobre o dia). */
export function activeAssignment(assignments: ScheduleAssignment[], date: CivilDate): ScheduleAssignment | null {
  return (
    [...assignments]
      .filter((a) => a.validFrom <= date && (!a.validTo || a.validTo >= date))
      .sort((a, b) => (a.validFrom < b.validFrom ? 1 : -1))[0] ?? null
  );
}

export function resolveExpectedDay(
  assignment: ScheduleAssignment | null,
  date: CivilDate,
  calendar?: CalendarDay | null,
): ExpectedDay {
  const holiday = !!calendar?.isHoliday && !calendar.isWorkday;
  const empty: ExpectedDay = {
    date, isWorkday: false, isHoliday: holiday, start: null, end: null, breakMinutes: 0, expectedMinutes: 0, flexible: false,
  };
  if (!assignment) return empty;

  const { schedule } = assignment;
  let index: number;
  if (isCyclic(schedule)) {
    const origin = assignment.cycleStart ?? assignment.validFrom;
    const cycle = schedule.cycleDays as number;
    index = ((diffDays(origin, date) % cycle) + cycle) % cycle;
  } else {
    index = weekday(date);
  }

  const day = schedule.days.find((d) => d.dayIndex === index);
  if (!day || !day.isWorkday || holiday) return { ...empty, isHoliday: holiday };

  const breakMinutes = day.breakMinutes ?? 0;
  if (!day.startTime || !day.endTime) {
    const expected = day.expectedMinutes ?? 0;
    return { ...empty, isWorkday: expected > 0, expectedMinutes: expected, breakMinutes, flexible: true };
  }

  const start = parseHm(day.startTime);
  let end = parseHm(day.endTime);
  if (end <= start) end += 1440; // atravessa a meia-noite (ex.: 19:00-07:00)
  const expected = day.expectedMinutes ?? Math.max(0, end - start - breakMinutes);
  return { date, isWorkday: true, isHoliday: false, start, end, breakMinutes, expectedMinutes: expected, flexible: false };
}

/**
 * Modelos de escala prontos. `start`/`end` em HH:mm; `breakMinutes` descontado do previsto.
 *  - 12x36: trabalha 1 dia, folga 1 (ciclo de 2)
 *  - 6x1, 5x2, 4x2: N dias de trabalho seguidos de folgas
 */
export function cyclicTemplate(
  type: 'SHIFT_12X36' | 'SHIFT_6X1' | 'SHIFT_5X2' | 'SHIFT_4X2',
  start: string,
  end: string,
  breakMinutes = 0,
): Schedule {
  const pattern: Record<typeof type, [number, number]> = {
    SHIFT_12X36: [1, 1],
    SHIFT_6X1: [6, 1],
    SHIFT_5X2: [5, 2],
    SHIFT_4X2: [4, 2],
  };
  const [work, off] = pattern[type];
  const cycleDays = work + off;
  return {
    type,
    cycleDays,
    days: Array.from({ length: cycleDays }, (_, i) => ({
      dayIndex: i,
      isWorkday: i < work,
      startTime: i < work ? start : null,
      endTime: i < work ? end : null,
      breakMinutes: i < work ? breakMinutes : 0,
    })),
  };
}
