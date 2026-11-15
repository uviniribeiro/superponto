import { z } from 'zod';

const weekdays = z.array(z.number().int().min(0).max(6)).max(7).transform((v) => [...new Set(v)].sort());

export const userCreateSchema = z.object({
  email: z.email(),
  displayName: z.string().trim().min(2).max(200),
  roleIds: z.array(z.uuid()).min(1, 'Escolha ao menos um perfil').max(10),
  /** dias com acesso (0 = domingo … 6 = sábado); vazio = todos */
  accessWeekdays: weekdays.optional(),
  mustChangePassword: z.boolean().optional(),
});
export type UserCreate = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(200).optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(z.uuid()).min(1, 'Escolha ao menos um perfil').max(10).optional(),
  accessWeekdays: weekdays.optional(),
  mustChangePassword: z.boolean().optional(),
});
export type UserUpdate = z.infer<typeof userUpdateSchema>;

export const roleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  permissions: z.array(z.string().regex(/^[a-z]+\.[a-z]+:[a-z]+$/)).min(1, 'Escolha ao menos uma permissão').max(200),
});
export type RoleInput = z.infer<typeof roleSchema>;
export const roleUpdateSchema = roleSchema.partial();
export type RoleUpdate = z.infer<typeof roleUpdateSchema>;

export const blockSchema = z.object({
  reason: z.string().trim().min(3, 'Informe o motivo').max(300),
  startsAt: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
  endsAt: z.iso.datetime({ offset: true }).transform((v) => new Date(v)).optional(),
}).refine((v) => !v.endsAt || v.endsAt > v.startsAt, { message: 'O fim do bloqueio deve ser depois do início', path: ['endsAt'] });
export type BlockInput = z.infer<typeof blockSchema>;
