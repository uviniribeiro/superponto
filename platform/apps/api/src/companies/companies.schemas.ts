import { z } from 'zod';
import { cnpjSchema } from '../common/documents.js';

export const companyInputSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  tradeName: z.string().trim().max(200).optional(),
  cnpj: cnpjSchema.optional(),
  segment: z.enum(['GENERAL', 'EDUCATION', 'HEALTH', 'PUBLIC_SECTOR', 'INDUSTRY', 'RETAIL', 'SERVICES']).default('GENERAL'),
  timezone: z.string().trim().min(3).max(64).default('America/Sao_Paulo'),
  // Endereço: o CEP/CNPJ preenchem; o código IBGE define os feriados municipais.
  zipCode: z.string().trim().transform((v) => v.replace(/\D/g, '')).pipe(z.string().length(8, 'CEP deve ter 8 dígitos')).optional(),
  street: z.string().trim().max(200).optional(),
  number: z.string().trim().max(20).optional(),
  complement: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'UF inválida').optional(),
  ibgeCode: z.string().trim().regex(/^\d{7}$/, 'Código IBGE inválido').optional(),
  phone: z.string().trim().transform((v) => v.replace(/\D/g, '')).pipe(z.string().min(10).max(11)).optional(),
  email: z.email().optional(),
});
export type CompanyInput = z.infer<typeof companyInputSchema>;

export const companyUpdateSchema = companyInputSchema.partial();
export type CompanyUpdate = z.infer<typeof companyUpdateSchema>;
