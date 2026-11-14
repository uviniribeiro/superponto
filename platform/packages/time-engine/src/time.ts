// Utilitários de data/hora com fuso horário explícito (sem dependências externas).

/** Data civil no formato AAAA-MM-DD. */
export type CivilDate = string;

export interface LocalParts {
  date: CivilDate;
  /** minutos desde 00:00 no fuso informado */
  minutes: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Converte um instante para data e minutos locais do fuso. */
export function toLocal(instant: Date, timeZone: string): LocalParts {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** "HH:mm" -> minutos. */
export function parseHm(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) throw new Error(`Horário inválido: ${value}`);
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) throw new Error(`Horário inválido: ${value}`);
  return h * 60 + m;
}

export function addDays(date: CivilDate, days: number): CivilDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Diferença em dias civis (b - a). */
export function diffDays(a: CivilDate, b: CivilDate): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Dia da semana (0 = domingo) de uma data civil. */
export function weekday(date: CivilDate): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Minutos de um instante em relação à meia-noite (local) de `baseDate`; pode passar de 1440. */
export function minutesFrom(baseDate: CivilDate, instant: Date, timeZone: string): number {
  const local = toLocal(instant, timeZone);
  return diffDays(baseDate, local.date) * 1440 + local.minutes;
}

export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minutes));
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}
