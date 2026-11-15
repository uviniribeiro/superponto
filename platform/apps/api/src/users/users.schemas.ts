import { z } from 'zod';

export const userCreateSchema = z.object({
  email: z.email(),
  displayName: z.string().trim().min(2).max(200),
  roleIds: z.array(z.uuid()).min(1, 'Escolha ao menos um perfil').max(10),
});
export type UserCreate = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(200).optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(z.uuid()).min(1, 'Escolha ao menos um perfil').max(10).optional(),
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
