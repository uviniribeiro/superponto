import { BadgeCheck, Briefcase, CalendarRange, Landmark, Tags, Wallet } from 'lucide-react';
import { formatCnpj } from '@superponto/br-docs';
import type { CatalogDef } from '@/components/catalog-page';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const code = (r: Record<string, unknown>) => (r.code ? `Código ${r.code}` : 'Sem código');
const br = (v: unknown) => (typeof v === 'string' ? new Date(`${v.slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '');

const simpleFields: CatalogDef['fields'] = [
  { key: 'name', label: 'Descrição', type: 'text', required: true, max: 120 },
  { key: 'code', label: 'Código', type: 'text', max: 20, hint: 'Opcional; usado na exportação para a folha', mono: true },
  { key: 'active', label: 'Ativo', type: 'active' },
];

export const FUNCTIONS_DEF: CatalogDef = {
  title: 'Funções', singular: 'Função', feminine: true, path: 'job-functions', icon: BadgeCheck,
  description: 'O que a pessoa faz no dia a dia, independente do cargo (ex.: recepcionista num cargo de auxiliar administrativo).',
  readPermission: 'org.functions:read', managePermission: 'org.functions:manage', fields: simpleFields, subtitle: code,
};

export const COST_CENTERS_DEF: CatalogDef = {
  title: 'Centros de custo', singular: 'Centro de custo', path: 'cost-centers', icon: Wallet,
  description: 'Agrupam a folha e as horas por área de despesa; vão na exportação para a folha de pagamento.',
  readPermission: 'org.costcenters:read', managePermission: 'org.costcenters:manage', fields: simpleFields, subtitle: code,
};

export const EMPLOYEE_TYPES_DEF: CatalogDef = {
  title: 'Tipos de funcionário', singular: 'Tipo de funcionário', path: 'employee-types', icon: Tags,
  description: 'Classificação usada em filtros, relatórios e cálculo em lote (efetivo, comissionado, contratado, estagiário…).',
  readPermission: 'org.employeetypes:read', managePermission: 'org.employeetypes:manage', fields: simpleFields, subtitle: code,
};

export const UNIONS_DEF: CatalogDef = {
  title: 'Sindicatos', singular: 'Sindicato', path: 'labor-unions', icon: Landmark,
  description: 'Entidades sindicais das categorias; a data-base orienta o reajuste e as regras da convenção.',
  readPermission: 'org.unions:read', managePermission: 'org.unions:manage',
  fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true, max: 120 },
    { key: 'acronym', label: 'Sigla', type: 'text', required: true, max: 20, mono: true },
    { key: 'cnpj', label: 'CNPJ', type: 'cnpj' },
    { key: 'entityType', label: 'Tipo de entidade', type: 'select', options: [['SINDICATO', 'Sindicato'], ['FEDERACAO', 'Federação'], ['CONFEDERACAO', 'Confederação'], ['CENTRAL', 'Central sindical']] },
    { key: 'side', label: 'Representa', type: 'select', options: [['EMPREGADOS', 'Empregados'], ['EMPREGADORES', 'Empregadores']] },
    { key: 'baseMonth', label: 'Data-base (mês)', type: 'select', empty: 'Não informada', options: MONTHS.map((m, i) => [String(i + 1), m] as [string, string]) },
    { key: 'code', label: 'Código', type: 'text', max: 20, mono: true },
    { key: 'active', label: 'Ativo', type: 'active' },
  ],
  subtitle: (r) => [r.acronym, r.cnpj ? formatCnpj(String(r.cnpj)) : null, r.baseMonth ? `data-base ${MONTHS[Number(r.baseMonth) - 1]}` : null].filter(Boolean).join(' · '),
  badge: (r) => (r.side === 'EMPREGADORES' ? 'Patronal' : 'Laboral'),
};

export const COMPETENCES_DEF: CatalogDef = {
  title: 'Competências', singular: 'Competência', feminine: true, path: 'competences', icon: CalendarRange,
  description: 'Períodos com nome (ex.: "Janeiro/2027", "1º trimestre") para filtrar espelho, relatórios e cálculo em lote.',
  readPermission: 'org.competences:read', managePermission: 'org.competences:manage',
  fields: [
    { key: 'name', label: 'Descrição', type: 'text', required: true, max: 120, placeholder: 'Ex.: Janeiro/2027' },
    { key: 'startsOn', label: 'Data inicial', type: 'date', required: true },
    { key: 'endsOn', label: 'Data final', type: 'date', required: true },
  ],
  subtitle: (r) => `${br(r.startsOn)} a ${br(r.endsOn)}`,
};

export const POSITIONS_DEF: CatalogDef = {
  title: 'Cargos', singular: 'Cargo', path: 'job-positions', icon: Briefcase, companyScoped: true,
  description: 'Cargos de cada empresa, com o código CBO usado no eSocial.',
  readPermission: 'org.positions:read', managePermission: 'org.positions:manage',
  fields: [
    { key: 'name', label: 'Descrição', type: 'text', required: true, max: 120 },
    { key: 'cbo', label: 'CBO', type: 'text', max: 7, placeholder: '0000-00', hint: 'Classificação Brasileira de Ocupações', mono: true },
    { key: 'category', label: 'Categoria profissional', type: 'select', options: [
      ['GENERAL', 'Geral'], ['TEACHER', 'Professor'], ['PHYSICIAN', 'Médico'], ['NURSE', 'Enfermeiro'], ['NURSING_TECHNICIAN', 'Técnico de enfermagem'],
      ['NURSING_ASSISTANT', 'Auxiliar de enfermagem'], ['PHYSIOTHERAPIST', 'Fisioterapeuta'], ['PSYCHOLOGIST', 'Psicólogo'], ['PHARMACIST', 'Farmacêutico'],
      ['DENTIST', 'Dentista'], ['NUTRITIONIST', 'Nutricionista'], ['SOCIAL_WORKER', 'Assistente social'], ['OTHER_HEALTH', 'Outro profissional da saúde'],
    ] },
  ],
  subtitle: (r) => (r.cbo ? `CBO ${String(r.cbo).replace(/^(\d{4})(\d{2})$/, '$1-$2')}` : 'Sem CBO'),
};
