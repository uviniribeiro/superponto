import { z } from 'zod';

const weekdays = z.array(z.number().int().min(0).max(6)).max(7).transform((v) => [...new Set(v)].sort());

export const userCreateSchema = z.object({
  email: z.email(),
  displayName: z.string().trim().min(2).max(200),
  roleIds: z.array(z.uuid()).min(1, 'Escolha ao menos um perfil').max(10),
  /** dias com acesso (0 = domingo … 6 = sábado); vazio = todos */
  accessWeekdays: weekdays.optional(),
  mustChangePassword: z.boolean().optional(),
  /** LOCAL = senha do SuperPonto (convite por e-mail); LDAP = senha da rede da organização */
  authSource: z.enum(['LOCAL', 'LDAP']).optional(),
});
export type UserCreate = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(200).optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(z.uuid()).min(1, 'Escolha ao menos um perfil').max(10).optional(),
  accessWeekdays: weekdays.optional(),
  mustChangePassword: z.boolean().optional(),
  authSource: z.enum(['LOCAL', 'LDAP']).optional(),
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

export const ldapConfigSchema = z.object({
  enabled: z.boolean(),
  url: z.string().trim().max(300).regex(/^ldaps?:\/\//i, 'Use ldap:// ou ldaps://'),
  startTls: z.boolean().default(false),
  allowInsecureTls: z.boolean().default(false),
  bindDn: z.string().trim().max(500).nullable().optional(),
  /** só enviada para trocar; omitida = mantém; null = remove */
  bindPassword: z.string().max(500).nullable().optional(),
  baseDn: z.string().trim().min(3).max(500),
  userFilter: z.string().trim().max(500).refine((v) => v.includes('{email}') || v.includes('{login}'), 'O filtro precisa conter {email} ou {login}').refine((v) => v.startsWith('(') && v.endsWith(')'), 'O filtro deve estar entre parênteses, ex.: (mail={email})').default('(mail={email})'),
  timeoutMs: z.number().int().min(1000).max(30000).default(5000),
});
export type LdapConfigInput = z.infer<typeof ldapConfigSchema>;
export const ldapTestSchema = z.object({ email: z.email(), password: z.string().max(500).optional() });
