import { isValidCpf, isValidPis, onlyDigits } from '@superponto/br-docs';
import { z } from 'zod';

const day = z.iso.date();
const optId = z.uuid().optional();
const cpf = z.string().trim().transform(onlyDigits).refine(isValidCpf, 'CPF inválido');
const pis = z.string().trim().transform(onlyDigits).refine(isValidPis, 'PIS/PASEP inválido');

export const addressSchema = z.object({
  zipCode: z.string().trim().transform(onlyDigits).pipe(z.string().length(8, 'CEP deve ter 8 dígitos')).optional(),
  street: z.string().trim().max(200).optional(),
  number: z.string().trim().max(20).optional(),
  complement: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  ibge: z.string().trim().regex(/^\d{7}$/).optional(),
});

export const personFields = {
  fullName: z.string().trim().min(3, 'Informe o nome completo').max(200),
  socialName: z.string().trim().max(200).optional(),
  cpf: cpf.optional(),
  pis: pis.optional(),
  birthDate: day.optional(),
  email: z.email().optional(),
  phone: z.string().trim().transform(onlyDigits).pipe(z.string().min(10).max(11)).optional(),
  address: addressSchema.optional(),
};

const contractType = z.enum(['CLT', 'STATUTORY', 'TEMPORARY', 'INTERN', 'APPRENTICE', 'CONTRACTOR', 'SERVICE_PROVIDER', 'VOLUNTEER', 'OTHER']);

export const employmentFields = {
  registration: z.string().trim().min(1, 'Informe a matrícula').max(30),
  hiredAt: day,
  contractType: contractType.default('CLT'),
  weeklyHours: z.number().min(1).max(80).optional(),
  unitId: optId,
  departmentId: optId,
  sectorId: optId,
  positionId: optId,
  functionId: optId,
  costCenterId: optId,
  employeeTypeId: optId,
  unionId: optId,
  supervisorId: optId,
};

export const employeeCreateSchema = z.object({ companyId: z.uuid(), ...personFields, ...employmentFields })
  .refine((v) => v.cpf || v.pis, { message: 'Informe o CPF ou o PIS (o relógio da Portaria 671 usa o CPF; o da 1.510, o PIS)', path: ['cpf'] });
export type EmployeeCreate = z.infer<typeof employeeCreateSchema>;

const nullable = <T extends z.ZodType>(t: T) => t.nullable().optional();
export const employeeUpdateSchema = z.object({
  fullName: personFields.fullName.optional(),
  socialName: nullable(z.string().trim().max(200)),
  cpf: nullable(cpf),
  pis: nullable(pis),
  birthDate: nullable(day),
  email: nullable(z.email()),
  phone: nullable(z.string().trim().transform(onlyDigits).pipe(z.string().min(10).max(11))),
  address: nullable(addressSchema),
  registration: employmentFields.registration.optional(),
  contractType: contractType.optional(),
  weeklyHours: nullable(z.number().min(1).max(80)),
  unitId: nullable(z.uuid()),
  departmentId: nullable(z.uuid()),
  sectorId: nullable(z.uuid()),
  positionId: nullable(z.uuid()),
  functionId: nullable(z.uuid()),
  costCenterId: nullable(z.uuid()),
  employeeTypeId: nullable(z.uuid()),
  unionId: nullable(z.uuid()),
  supervisorId: nullable(z.uuid()),
  /** data a partir da qual a mudança vale (histórico); padrão: hoje */
  effectiveAt: day.optional(),
  reason: z.string().trim().max(300).optional(),
});
export type EmployeeUpdate = z.infer<typeof employeeUpdateSchema>;

export const terminateSchema = z.object({ terminatedAt: day, reason: z.string().trim().min(3).max(300) });
export type TerminateInput = z.infer<typeof terminateSchema>;

export const employeeListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
  search: z.string().trim().max(100).optional(),
  companyId: z.uuid().optional(),
  departmentId: z.uuid().optional(),
  includeSubdepartments: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  positionId: z.uuid().optional(),
  employeeTypeId: z.uuid().optional(),
  costCenterId: z.uuid().optional(),
  groupingId: z.uuid().optional(),
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'ALL']).default('ACTIVE'),
});
export type EmployeeList = z.infer<typeof employeeListSchema>;
