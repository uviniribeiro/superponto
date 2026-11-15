import { z } from 'zod';

const civil = z.iso.date();
const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário no formato HH:mm');
const days = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000;

export const periodSchema = z.object({ from: civil, to: civil }).refine((v) => v.to >= v.from && days(v.from, v.to) <= 62, { message: 'Período de até 63 dias', path: ['to'] });
export const mirrorSchema = z.object({ employmentId: z.uuid(), from: civil, to: civil }).refine((v) => v.to >= v.from && days(v.from, v.to) <= 62, { message: 'Período de até 63 dias', path: ['to'] });
export const dailySchema = z.object({ companyId: z.uuid(), date: civil, departmentId: z.uuid().optional(), groupingId: z.uuid().optional() });
export const calculateSchema = z.object({ companyId: z.uuid(), from: civil, to: civil, employmentIds: z.array(z.uuid()).max(2000).optional() })
  .refine((v) => v.to >= v.from && days(v.from, v.to) <= 62, { message: 'Período de até 63 dias', path: ['to'] });

export const adjustmentSchema = z.discriminatedUnion('kind', [
  /** inclui uma marcação esquecida (a marcação original nunca é alterada) */
  z.object({ kind: z.literal('INCLUDE'), employmentId: z.uuid(), date: civil, time: hm, justification: z.string().trim().min(5, 'Justifique com pelo menos 5 caracteres').max(300) }),
  /** desconsidera uma marcação (ex.: marcação em duplicidade); ela continua guardada */
  z.object({ kind: z.literal('DISREGARD'), employmentId: z.uuid(), timeRecordId: z.uuid(), justification: z.string().trim().min(5, 'Justifique com pelo menos 5 caracteres').max(300) }),
]);
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
export const decideSchema = z.object({ approve: z.boolean(), comment: z.string().trim().max(300).optional() });

export const justificationSchema = z.object({
  code: z.string().trim().min(1).max(20).optional(),
  name: z.string().trim().min(3).max(120),
  disregardsDebits: z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]).default(true),
  usageLimit: z.coerce.number().int().min(1).max(366).nullable().optional(),
  limitPeriod: z.enum(['MONTH', 'YEAR']).default('MONTH'),
  active: z.boolean().optional(),
});

export const allowanceSchema = z.object({
  employmentIds: z.array(z.uuid()).min(1).max(500),
  from: civil, to: civil,
  justificationId: z.uuid(),
  fullDay: z.boolean().default(true),
  minutes: z.number().int().min(1).max(1440).optional(),
  /** só dias com jornada prevista (pula folgas e feriados) */
  onlyWorkdays: z.boolean().default(true),
  note: z.string().trim().max(300).optional(),
}).superRefine((v, ctx) => {
  if (v.to < v.from) ctx.addIssue({ code: 'custom', message: 'A data final deve ser igual ou posterior à inicial', path: ['to'] });
  if (days(v.from, v.to) > 92) ctx.addIssue({ code: 'custom', message: 'Período máximo de 93 dias por lançamento', path: ['to'] });
  if (!v.fullDay && !v.minutes) ctx.addIssue({ code: 'custom', message: 'Informe os minutos abonados', path: ['minutes'] });
});
export type AllowanceInput = z.infer<typeof allowanceSchema>;

export const LEAVE_TYPES = ['MEDICAL', 'VACATION', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNPAID', 'SUSPENSION', 'OTHER'] as const;
export const leaveSchema = z.object({
  employmentId: z.uuid(), type: z.enum(LEAVE_TYPES), startDate: civil, endDate: civil,
  justificationId: z.uuid().optional(), note: z.string().trim().max(300).optional(),
}).refine((v) => v.endDate >= v.startDate && days(v.startDate, v.endDate) <= 730, { message: 'Período inválido (fim antes do início ou acima de 2 anos)', path: ['endDate'] });
export type LeaveInput = z.infer<typeof leaveSchema>;

export const onCallSchema = z.object({
  employmentIds: z.array(z.uuid()).min(1).max(200), date: civil, startTime: hm, endTime: hm, note: z.string().trim().max(300).optional(),
}).refine((v) => v.startTime !== v.endTime, { message: 'Início e fim iguais', path: ['endTime'] });
export type OnCallInput = z.infer<typeof onCallSchema>;

export const listRangeSchema = z.object({ from: civil, to: civil, companyId: z.uuid().optional(), employmentId: z.uuid().optional() })
  .refine((v) => v.to >= v.from && days(v.from, v.to) <= 366, { message: 'Período de até 1 ano', path: ['to'] });

export const closingSchema = z.object({ companyId: z.uuid(), periodStart: civil, periodEnd: civil })
  .refine((v) => v.periodEnd >= v.periodStart && days(v.periodStart, v.periodEnd) <= 62, { message: 'Período de até 63 dias', path: ['periodEnd'] });
export const reopenSchema = z.object({ reason: z.string().trim().min(5, 'Informe o motivo da reabertura').max(300) });

export const punchSchema = z.object({
  token: z.string().min(20).max(500),
  employmentId: z.uuid().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().int().min(0).max(100000).optional(),
  /** Token do aparelho liberado (app do funcionário); quando enviado, precisa ser válido e do próprio usuário. */
  appDeviceToken: z.string().regex(/^spa_[A-Za-z0-9_-]{20,80}$/).optional(),
});
export type PunchInput = z.infer<typeof punchSchema>;
