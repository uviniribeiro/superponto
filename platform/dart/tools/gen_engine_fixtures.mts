// Gera cenários aleatórios (semente fixa) e o resultado do motor TypeScript, para o teste de
// paridade do motor Dart. Uso: node --experimental-strip-types tools/gen_engine_fixtures.mts
import { writeFileSync } from 'node:fs';
import { applyToBank, assignPunchesToDays, calculateDay, emptyBank, resolveExpectedDay, summarizePeriod, type Schedule } from '../../packages/time-engine/src/index.ts';

let seed = 20261120;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const TZS = ['America/Sao_Paulo', 'America/Manaus', 'America/Noronha', 'America/Rio_Branco'];
const addD = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

function schedule(): Schedule {
  const type = pick(['FIXED', 'FIXED', 'FLEXIBLE', 'SHIFT_12X36', 'SHIFT_6X1', 'SHIFT_5X2', 'SHIFT_4X2', 'ROTATING'] as const);
  const cyclic = type !== 'FIXED' && type !== 'FLEXIBLE';
  const cycleDays = cyclic ? int(2, 9) : undefined;
  const n = cyclic ? cycleDays! : 7;
  const days = Array.from({ length: n }, (_, i) => {
    const work = rnd() < 0.7;
    if (!work) return { dayIndex: i, isWorkday: false };
    if (type === 'FLEXIBLE') return { dayIndex: i, isWorkday: true, expectedMinutes: int(240, 600), breakMinutes: pick([0, 30, 60]) };
    const start = int(0, 23) * 60 + pick([0, 15, 30, 45]);
    const len = pick([360, 480, 540, 600, 720, 720, 1440 - 60]);
    const brk = pick([0, 15, 30, 60, 60, 90]);
    return { dayIndex: i, isWorkday: true, startTime: hm(start), endTime: hm(start + len), breakMinutes: brk, breakStart: rnd() < 0.5 && brk ? hm(start + Math.floor(len / 2)) : null };
  });
  return { type, days, cycleDays, considerHolidays: rnd() < 0.8, inItinereMinutes: rnd() < 0.2 ? int(10, 60) : 0, entryMobilityMinutes: rnd() < 0.2 ? int(15, 90) : 0, breakMobilityMinutes: rnd() < 0.2 ? int(15, 90) : 0 };
}

function rules() {
  const r: Record<string, unknown> = {};
  if (rnd() < 0.3) r.markToleranceMinutes = int(0, 10);
  if (rnd() < 0.3) r.dailyToleranceMinutes = int(0, 20);
  if (rnd() < 0.2) { r.roundingMinutes = pick([5, 10, 15]); r.roundingMode = pick(['up', 'down', 'nearest']); }
  if (rnd() < 0.3) r.overtimePercent = { normal: pick([50, 60, 75]), night: pick([50, 70]), rest: 100, holiday: pick([100, 150]), break: 50 };
  if (rnd() < 0.2) { r.nightStart = pick(['22:00', '21:00']); r.nightEnd = pick(['05:00', '06:00']); }
  if (rnd() < 0.2) r.reducedNightHour = false;
  if (rnd() < 0.3) r.minBreakMinutes = pick([0, 30, 60]);
  if (rnd() < 0.3) r.autoDeductBreak = true;
  if (rnd() < 0.3) r.dailyOvertimeLimitMinutes = pick([0, 60, 120]);
  if (rnd() < 0.2) r.discountAbsences = false;
  if (rnd() < 0.25) r.overtimeBands = [{ upToMinutes: pick([60, 120]), percent: 50 }, { upToMinutes: null, percent: 100 }];
  return r;
}

const cases = [];
for (let n = 0; n < 3000; n++) {
  const tz = pick(TZS);
  const sched = schedule();
  const validFrom = addD('2026-01-01', int(0, 60));
  const assignment = rnd() < 0.08 ? null : { schedule: sched, validFrom, cycleStart: rnd() < 0.5 ? addD(validFrom, int(0, 5)) : null };
  const date = addD('2026-03-01', int(0, 90));
  const calendar = rnd() < 0.2 ? { date, isHoliday: true, isWorkday: rnd() < 0.2 } : null;
  const override = rnd() < 0.1 ? (rnd() < 0.4 ? { isWorkday: false } : { isWorkday: true, startTime: hm(int(5, 20) * 60), endTime: hm(int(5, 20) * 60 + pick([240, 360, 480])), breakMinutes: pick([0, 60]) }) : null;
  const expected = resolveExpectedDay(assignment as never, date, calendar, override);
  const count = pick([0, 0, 1, 2, 2, 3, 4, 4, 4, 5, 6]);
  const baseMin = (expected.start ?? int(6, 20) * 60) - int(0, 90) + int(0, 60);
  const punches: string[] = [];
  let cur = baseMin;
  for (let i = 0; i < count; i++) { punches.push(new Date(Date.parse(`${date}T00:00:00Z`) + cur * 60000 + int(-3, 3) * 3600000 * 0).toISOString()); cur += int(10, 330); }
  // marcações como instante: minutos a partir da meia-noite UTC + deslocamento aproximado do fuso
  const offset = tz === 'America/Manaus' || tz === 'America/Rio_Branco' ? (tz === 'America/Rio_Branco' ? 300 : 240) : tz === 'America/Noronha' ? 120 : 180;
  const instants = punches.map((p) => new Date(Date.parse(p) + offset * 60000).toISOString());
  const absence = rnd() < 0.08 ? (rnd() < 0.5 ? { kind: 'full' as const } : { kind: 'partial' as const, minutes: int(30, 300) }) : null;
  const r = rules();
  const result = calculateDay({ date, timeZone: tz, expected, punches: instants.map((s) => ({ at: new Date(s) })), rules: r as never, absence });
  cases.push({ tz, assignment, date, calendar, override, expected, punches: instants, absence, rules: r, result });
}

// Atribuição de marcações a dias e banco/período sobre sequências de dias.
const seqs = [];
for (let n = 0; n < 200; n++) {
  const tz = pick(TZS);
  const sched = schedule();
  const assignment = { schedule: sched, validFrom: '2026-01-01', cycleStart: '2026-01-05' };
  const start = addD('2026-03-01', int(0, 60));
  const dates = Array.from({ length: 7 }, (_, i) => addD(start, i));
  const days = dates.map((d) => resolveExpectedDay(assignment as never, d));
  const punches = Array.from({ length: int(0, 20) }, () => new Date(Date.parse(`${start}T00:00:00Z`) + int(0, 7 * 1440) * 60000).toISOString());
  const map = assignPunchesToDays(punches.map((p) => ({ at: new Date(p), id: p })), days, tz);
  const assigned = Object.fromEntries([...map].map(([k, v]) => [k, v.map((p) => p.id)]));
  const results = days.map((e) => calculateDay({ date: e.date, timeZone: tz, expected: e, punches: (map.get(e.date) ?? []).map((p) => ({ at: p.at })) }));
  const policy = { enabled: true, expirationDays: pick([null, 5, 30]), creditMultiplierByPercent: rnd() < 0.5 ? { 100: 2, 50: 1.5 } : {}, maxDailyCreditMinutes: rnd() < 0.3 ? 90 : undefined };
  const bank = applyToBank(emptyBank(), results, policy as never);
  seqs.push({ tz, assignment, dates, punches, assigned, policy, bank: { balance: bank.balance, entries: bank.entries, openCredits: bank.openCredits }, summary: summarizePeriod(results) });
}
writeFileSync(new URL('../packages/sp_core/test/fixtures/engine_cases.json', import.meta.url), JSON.stringify({ cases, seqs }));
// depois: gzip -9 packages/sp_core/test/fixtures/engine_cases.json
console.log(`${cases.length} dias, ${seqs.length} sequências`);
