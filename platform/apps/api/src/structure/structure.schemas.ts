import { z } from 'zod';

export const departmentSchema = z.object({
  companyId: z.uuid(),
  name: z.string().trim().min(3, 'Mínimo de 3 caracteres').max(120),
  code: z.string().trim().min(1).max(20).optional(),
  parentId: z.uuid().optional(),
});
export type DepartmentInput = z.infer<typeof departmentSchema>;

export const departmentUpdateSchema = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  code: z.string().trim().min(1).max(20).optional(),
  /** null move para a raiz */
  parentId: z.uuid().nullable().optional(),
});
export type DepartmentUpdate = z.infer<typeof departmentUpdateSchema>;

export const sectorSchema = z.object({ name: z.string().trim().min(3).max(120) });
export type SectorInput = z.infer<typeof sectorSchema>;
