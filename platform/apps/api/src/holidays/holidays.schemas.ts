import { z } from 'zod';

export const yearQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()) });
export type YearQuery = z.infer<typeof yearQuery>;

export const holidayRuleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.enum(['HOLIDAY', 'OPTIONAL']).default('HOLIDAY'),
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).optional(),
  movable: z.enum(['CARNIVAL_MONDAY', 'CARNIVAL_TUESDAY', 'ASH_WEDNESDAY', 'GOOD_FRIDAY', 'CORPUS_CHRISTI']).optional(),
}).refine((v) => (v.movable ? v.month === undefined && v.day === undefined : v.month !== undefined && v.day !== undefined), { message: 'Informe dia e mês, ou um feriado móvel' })
  .refine((v) => v.movable || new Date(Date.UTC(2024, v.month! - 1, v.day!)).getUTCMonth() === v.month! - 1, { message: 'Data inexistente' });
export type HolidayRuleInput = z.infer<typeof holidayRuleSchema>;

export const holidayOverrideSchema = z.object({
  date: z.iso.date(),
  workday: z.boolean(),
  note: z.string().trim().max(200).optional(),
});
export type HolidayOverrideInput = z.infer<typeof holidayOverrideSchema>;

export const generateSchema = z.object({ year: z.number().int().min(2000).max(2100) });
export type GenerateInput = z.infer<typeof generateSchema>;
