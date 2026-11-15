import { z } from 'zod';
import { cnpjSchema } from '../common/documents.js';

export const companyInputSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  tradeName: z.string().trim().max(200).optional(),
  cnpj: cnpjSchema.optional(),
  segment: z.enum(['GENERAL', 'EDUCATION', 'HEALTH', 'PUBLIC_SECTOR', 'INDUSTRY', 'RETAIL', 'SERVICES']).default('GENERAL'),
  timezone: z.string().trim().min(3).max(64).default('America/Sao_Paulo'),
});
export type CompanyInput = z.infer<typeof companyInputSchema>;

export const companyUpdateSchema = companyInputSchema.partial();
export type CompanyUpdate = z.infer<typeof companyUpdateSchema>;
