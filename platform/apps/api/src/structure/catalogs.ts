import { isValidCnpj, normalizeCnpj } from '@superponto/br-docs';
import { z } from 'zod';
import type { Tx } from '../prisma/prisma.service.js';
import type { CatalogConfig } from './catalog.factory.js';

const name = z.string().trim().min(3, 'Mínimo de 3 caracteres').max(120);
const code = z.string().trim().min(1).max(20).optional();
const active = z.boolean().optional();
const used = (field: string) => (tx: Tx, id: string) => tx.employment.count({ where: { [field]: id, deletedAt: null, status: 'ACTIVE' } });

const simple = z.object({ code, name, active });

export const FUNCTIONS: CatalogConfig = {
  path: 'job-functions', model: 'jobFunction', entity: 'job_function', label: 'Função', gender: 'a',
  read: 'org.functions:read', manage: 'org.functions:manage',
  createSchema: simple, updateSchema: simple.partial(), searchFields: ['name', 'code'], orderBy: { name: 'asc' },
  usage: used('functionId'),
};

export const COST_CENTERS: CatalogConfig = {
  path: 'cost-centers', model: 'costCenter', entity: 'cost_center', label: 'Centro de custo', gender: 'o',
  read: 'org.costcenters:read', manage: 'org.costcenters:manage',
  createSchema: simple, updateSchema: simple.partial(), searchFields: ['name', 'code'], orderBy: { name: 'asc' },
  usage: used('costCenterId'),
};

export const EMPLOYEE_TYPES: CatalogConfig = {
  path: 'employee-types', model: 'employeeType', entity: 'employee_type', label: 'Tipo de funcionário', gender: 'o',
  read: 'org.employeetypes:read', manage: 'org.employeetypes:manage',
  createSchema: simple, updateSchema: simple.partial(), searchFields: ['name', 'code'], orderBy: { name: 'asc' },
  usage: used('employeeTypeId'),
};

const unionBase = z.object({
  code,
  name,
  acronym: z.string().trim().min(2).max(20),
  cnpj: z.string().trim().transform(normalizeCnpj).refine((v) => !v || isValidCnpj(v), 'CNPJ inválido').optional(),
  entityType: z.enum(['SINDICATO', 'FEDERACAO', 'CONFEDERACAO', 'CENTRAL']).default('SINDICATO'),
  side: z.enum(['EMPREGADOS', 'EMPREGADORES']).default('EMPREGADOS'),
  baseMonth: z.number().int().min(1).max(12).optional(),
  active,
});
export const UNIONS: CatalogConfig = {
  path: 'labor-unions', model: 'laborUnion', entity: 'labor_union', label: 'Sindicato', gender: 'o',
  read: 'org.unions:read', manage: 'org.unions:manage',
  createSchema: unionBase, updateSchema: unionBase.partial(), searchFields: ['name', 'acronym', 'code'], orderBy: { name: 'asc' },
  usage: used('unionId'),
};

const day = z.iso.date().transform((v) => new Date(`${v}T00:00:00Z`));
const competenceBase = z.object({ name, startsOn: day, endsOn: day });
export const COMPETENCES: CatalogConfig = {
  path: 'competences', model: 'competence', entity: 'competence', label: 'Competência', gender: 'a',
  read: 'org.competences:read', manage: 'org.competences:manage',
  createSchema: competenceBase.refine((v) => v.endsOn >= v.startsOn, { message: 'A data final deve ser igual ou posterior à inicial', path: ['endsOn'] }),
  updateSchema: competenceBase.partial().refine((v) => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, { message: 'A data final deve ser igual ou posterior à inicial', path: ['endsOn'] }),
  searchFields: ['name'], orderBy: { startsOn: 'desc' },
};

const positionBase = z.object({
  companyId: z.uuid(),
  name,
  cbo: z.string().trim().regex(/^\d{4}-?\d{2}$/, 'CBO no formato 0000-00').transform((v) => v.replace('-', '')).optional(),
  category: z.enum(['GENERAL', 'TEACHER', 'PHYSICIAN', 'NURSE', 'NURSING_TECHNICIAN', 'NURSING_ASSISTANT', 'PHYSIOTHERAPIST', 'PSYCHOLOGIST', 'PHARMACIST', 'DENTIST', 'NUTRITIONIST', 'SOCIAL_WORKER', 'OTHER_HEALTH']).optional(),
});
export const POSITIONS: CatalogConfig = {
  path: 'job-positions', model: 'jobPosition', entity: 'job_position', label: 'Cargo', gender: 'o',
  read: 'org.positions:read', manage: 'org.positions:manage', companyScoped: true,
  createSchema: positionBase, updateSchema: positionBase.omit({ companyId: true }).partial(), searchFields: ['name', 'cbo'], orderBy: { name: 'asc' },
  usage: used('positionId'),
};

const UNIT_TYPES = ['HEADQUARTERS', 'BRANCH', 'SCHOOL', 'HOSPITAL', 'CLINIC', 'UPA', 'UBS', 'LABORATORY', 'OFFICE', 'OPERATIONAL_SITE', 'OTHER'] as const;
const coord = (min: number, max: number, label: string) =>
  z.union([z.number(), z.string().trim().transform((v) => Number(v.replace(',', '.')))]).refine((v) => Number.isFinite(v) && v >= min && v <= max, `${label} inválida`);
const unitBase = z.object({
  companyId: z.uuid(),
  name,
  code,
  type: z.enum(UNIT_TYPES).default('OFFICE'),
  cnpj: z.string().trim().transform(normalizeCnpj).refine((v) => !v || isValidCnpj(v), 'CNPJ inválido').optional(),
  latitude: coord(-90, 90, 'Latitude').optional(),
  longitude: coord(-180, 180, 'Longitude').optional(),
  geofenceM: z.coerce.number().int().min(20, 'Raio mínimo de 20 m').max(5000, 'Raio máximo de 5.000 m').optional(),
});
/** Unidades / locais de trabalho da empresa (filial, escola, UBS…), com cerca virtual opcional. */
export const UNITS: CatalogConfig = {
  path: 'units', model: 'companyUnit', entity: 'company_unit', label: 'Unidade', gender: 'a',
  read: 'org.units:read', manage: 'org.units:manage', companyScoped: true,
  createSchema: unitBase.refine((v) => (v.latitude === undefined) === (v.longitude === undefined), { message: 'Informe latitude e longitude juntas', path: ['longitude'] }),
  updateSchema: unitBase.omit({ companyId: true }).partial(),
  searchFields: ['name', 'code'], orderBy: { name: 'asc' },
  usage: used('unitId'),
};

export const CATALOGS = [FUNCTIONS, COST_CENTERS, EMPLOYEE_TYPES, UNIONS, COMPETENCES, POSITIONS, UNITS];
