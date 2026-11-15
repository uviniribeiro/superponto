import { z } from 'zod';

export const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const hm = z.string().regex(HM, 'Horário no formato HH:mm');
const civil = z.iso.date();
const toMin = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));

export const SCHEDULE_TYPES = ['FIXED', 'FLEXIBLE', 'SHIFT_12X36', 'SHIFT_6X1', 'SHIFT_5X2', 'SHIFT_4X2', 'ROTATING', 'CUSTOM', 'ON_CALL', 'TEACHING'] as const;
export const CYCLIC_TYPES = new Set<string>(['SHIFT_12X36', 'SHIFT_6X1', 'SHIFT_5X2', 'SHIFT_4X2', 'ROTATING', 'CUSTOM', 'ON_CALL']);

const daySchema = z.object({
  dayIndex: z.number().int().min(0).max(61),
  isWorkday: z.boolean(),
  startTime: hm.nullable().optional(),
  endTime: hm.nullable().optional(),
  breakMinutes: z.number().int().min(0).max(720).default(0),
  breakStart: hm.nullable().optional(),
  expectedMinutes: z.number().int().min(0).max(1440).optional(),
});
export type ScheduleDayInput = z.infer<typeof daySchema>;

/** Duração do dia em minutos (atravessando a meia-noite quando o fim é menor que o início). */
export function span(start: string, end: string) {
  const s = toMin(start);
  let e = toMin(end);
  if (e <= s) e += 1440;
  return e - s;
}

const scheduleFields = {
  name: z.string().trim().min(3, 'Mínimo de 3 caracteres').max(120),
  code: z.string().trim().min(1).max(20).nullable().optional(),
  type: z.enum(SCHEDULE_TYPES),
  cycleDays: z.number().int().min(2).max(62).nullable().optional(),
  considerHolidays: z.boolean().default(true),
  inItinereMinutes: z.number().int().min(0).max(600).default(0),
  entryMobilityMinutes: z.number().int().min(0).max(600).default(0),
  breakMobilityMinutes: z.number().int().min(0).max(600).default(0),
  ruleSetId: z.uuid().nullable().optional(),
  active: z.boolean().optional(),
  days: z.array(daySchema).min(1).max(62),
};

function checkSchedule(v: { type: string; cycleDays?: number | null; days: ScheduleDayInput[] }, ctx: z.RefinementCtx) {
  const cyclic = CYCLIC_TYPES.has(v.type);
  const issue = (message: string, path: (string | number)[] = ['days']) => ctx.addIssue({ code: 'custom', message, path });
  if (cyclic && !v.cycleDays) issue('Informe quantos dias tem o ciclo da escala', ['cycleDays']);
  if (!cyclic && v.cycleDays) issue('Jornada semanal não tem ciclo', ['cycleDays']);
  const seen = new Set<number>();
  v.days.forEach((d, i) => {
    if (seen.has(d.dayIndex)) issue('Dia repetido na jornada', ['days', i, 'dayIndex']);
    seen.add(d.dayIndex);
    if (cyclic ? d.dayIndex >= (v.cycleDays ?? 0) : d.dayIndex > 6) issue(cyclic ? 'Dia fora do ciclo' : 'Dia da semana inválido (0 = domingo … 6 = sábado)', ['days', i, 'dayIndex']);
    if (!d.isWorkday) return;
    const flexible = v.type === 'FLEXIBLE' || (!d.startTime && !d.endTime);
    if (!!d.startTime !== !!d.endTime) return issue('Informe entrada e saída juntas', ['days', i, 'endTime']);
    if (flexible) {
      if (!d.expectedMinutes) issue('Jornada sem horário fixo precisa da carga do dia', ['days', i, 'expectedMinutes']);
      return;
    }
    const total = span(d.startTime!, d.endTime!);
    if (d.breakMinutes >= total) issue('O intervalo não pode ser maior que a jornada do dia', ['days', i, 'breakMinutes']);
    if (total - d.breakMinutes > 960) issue('Jornada do dia acima de 16 horas', ['days', i, 'endTime']);
    if (d.breakStart) {
      const s = toMin(d.startTime!);
      let b = toMin(d.breakStart);
      if (b < s) b += 1440;
      if (b - s <= 0 || b - s + d.breakMinutes >= total) issue('O intervalo precisa ficar dentro da jornada', ['days', i, 'breakStart']);
    }
  });
}

export const scheduleCreateSchema = z.object({ companyId: z.uuid(), ...scheduleFields }).superRefine(checkSchedule);
export const scheduleUpdateSchema = z.object(scheduleFields).superRefine(checkSchedule);
export type ScheduleCreate = z.infer<typeof scheduleCreateSchema>;
export type ScheduleUpdate = z.infer<typeof scheduleUpdateSchema>;

const pct = (min: number, label: string) => z.number().int().min(min, `${label}: mínimo de ${min}%`).max(300);
/** Regras de apuração (tolerâncias, extras, noturno). Limites legais conferidos aqui. */
export const rulesSchema = z.object({
  markToleranceMinutes: z.number().int().min(0).max(5, 'CLT art. 58 §1º: até 5 minutos por marcação').default(5),
  dailyToleranceMinutes: z.number().int().min(0).max(10, 'CLT art. 58 §1º: até 10 minutos no dia').default(10),
  roundingMinutes: z.number().int().min(0).max(30).default(0),
  roundingMode: z.enum(['up', 'down', 'nearest']).default('nearest'),
  overtimePercent: z.object({
    normal: pct(50, 'Hora extra'), night: pct(50, 'Hora extra noturna'), rest: pct(50, 'Extra no descanso'), holiday: pct(50, 'Extra no feriado'), break: pct(50, 'Intervalo suprimido'),
  }).default({ normal: 50, night: 50, rest: 100, holiday: 100, break: 50 }),
  nightStart: hm.default('22:00'),
  nightEnd: hm.default('05:00'),
  reducedNightHour: z.boolean().default(true),
  minBreakMinutes: z.number().int().min(0).max(240).default(60),
  autoDeductBreak: z.boolean().default(false),
  dailyOvertimeLimitMinutes: z.number().int().min(0).max(720).default(120),
  discountAbsences: z.boolean().default(true),
  overtimeBands: z.array(z.object({ upToMinutes: z.number().int().min(1).max(720).nullable(), percent: pct(50, 'Faixa de extra') })).max(5).optional(),
}).superRefine((r, ctx) => {
  const b = r.overtimeBands;
  if (!b?.length) return;
  b.forEach((band, i) => {
    if (band.upToMinutes === null && i !== b.length - 1) ctx.addIssue({ code: 'custom', message: 'Só a última faixa pode ficar sem limite', path: ['overtimeBands', i] });
    if (i > 0 && band.upToMinutes !== null && b[i - 1]!.upToMinutes !== null && band.upToMinutes <= b[i - 1]!.upToMinutes!) ctx.addIssue({ code: 'custom', message: 'As faixas precisam crescer', path: ['overtimeBands', i] });
  });
});
export type RulesInput = z.infer<typeof rulesSchema>;

export const ruleSetCreateSchema = z.object({ companyId: z.uuid(), name: z.string().trim().min(3).max(120), isDefault: z.boolean().default(false), rules: rulesSchema });
export const ruleSetUpdateSchema = z.object({ name: z.string().trim().min(3).max(120).optional(), isDefault: z.boolean().optional(), rules: rulesSchema.optional() });
export type RuleSetCreate = z.infer<typeof ruleSetCreateSchema>;
export type RuleSetUpdate = z.infer<typeof ruleSetUpdateSchema>;

export const assignSchema = z.object({
  employmentIds: z.array(z.uuid()).min(1).max(500),
  scheduleId: z.uuid(),
  validFrom: civil,
  /** primeiro dia do ciclo (posição 0) nas escalas cíclicas; padrão = início da vigência */
  cycleStart: civil.optional(),
});
export type AssignInput = z.infer<typeof assignSchema>;

const dayPlan = {
  isWorkday: z.boolean(),
  startTime: hm.nullable().optional(),
  endTime: hm.nullable().optional(),
  breakMinutes: z.number().int().min(0).max(720).default(0),
  breakStart: hm.nullable().optional(),
};
export const overrideCreateSchema = z.object({
  employmentIds: z.array(z.uuid()).min(1).max(500),
  from: civil,
  to: civil,
  /** só estes dias da semana dentro do período (0 = domingo); vazio = todos */
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  ...dayPlan,
  note: z.string().trim().max(300).optional(),
}).superRefine((v, ctx) => {
  if (v.to < v.from) ctx.addIssue({ code: 'custom', message: 'A data final deve ser igual ou posterior à inicial', path: ['to'] });
  if ((Date.parse(v.to) - Date.parse(v.from)) / 86_400_000 > 366) ctx.addIssue({ code: 'custom', message: 'Período máximo de 1 ano por lançamento', path: ['to'] });
  if (v.isWorkday && (!v.startTime || !v.endTime)) ctx.addIssue({ code: 'custom', message: 'Dia de trabalho precisa de entrada e saída', path: ['startTime'] });
  if (v.isWorkday && v.startTime && v.endTime && v.breakMinutes >= span(v.startTime, v.endTime)) ctx.addIssue({ code: 'custom', message: 'O intervalo não pode ser maior que a jornada', path: ['breakMinutes'] });
});
export type OverrideCreate = z.infer<typeof overrideCreateSchema>;

export const swapSchema = z.discriminatedUnion('kind', [
  /** dois funcionários trocam a escala do mesmo dia */
  z.object({ kind: z.literal('SHIFT'), date: civil, employmentIdA: z.uuid(), employmentIdB: z.uuid(), note: z.string().trim().min(3, 'Informe o motivo').max(300) }),
  /** o funcionário trabalha na folga e folga no dia de trabalho */
  z.object({ kind: z.literal('DAY_OFF'), employmentId: z.uuid(), workDate: civil, offDate: civil, note: z.string().trim().min(3, 'Informe o motivo').max(300) }),
]);
export type SwapInput = z.infer<typeof swapSchema>;

export const rangeSchema = z.object({ from: civil, to: civil }).refine((v) => v.to >= v.from && (Date.parse(v.to) - Date.parse(v.from)) / 86_400_000 <= 92, { message: 'Período de até 93 dias', path: ['to'] });
export const gridSchema = z.object({
  companyId: z.uuid(), from: civil, to: civil,
  departmentId: z.uuid().optional(), groupingId: z.uuid().optional(), search: z.string().trim().max(100).optional(),
}).refine((v) => v.to >= v.from && (Date.parse(v.to) - Date.parse(v.from)) / 86_400_000 <= 41, { message: 'Período de até 42 dias', path: ['to'] });
export type GridQuery = z.infer<typeof gridSchema>;
