/** Converte data/hora local (sem fuso) de um fuso IANA em instante UTC, sem bibliotecas. */
export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, second: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = (t: number) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(t))
      .reduce<Record<string, number>>((acc, p) => (p.type === 'literal' ? acc : { ...acc, [p.type]: Number(p.value) }), {});
    return Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!) - t;
  };
  // Duas passadas resolvem a troca de horário de verão.
  let utc = guess - offset(guess);
  utc = guess - offset(utc);
  return new Date(utc);
}

/** Partes de data/hora de um instante no fuso informado. */
export function localParts(at: Date, timeZone: string) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(at)
    .reduce<Record<string, number>>((acc, x) => (x.type === 'literal' ? acc : { ...acc, [x.type]: Number(x.value) }), {});
  return { year: p.year!, month: p.month!, day: p.day!, hour: p.hour!, minute: p.minute!, second: p.second! };
}
