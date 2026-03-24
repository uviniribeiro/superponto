import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Default marital statuses for Brazilian systems
const DEFAULT_MARITAL_STATUSES = [
  { code: '1', description: 'Solteiro(a)' },
  { code: '2', description: 'Casado(a)' },
  { code: '3', description: 'Divorciado(a)' },
  { code: '4', description: 'Viúvo(a)' },
  { code: '5', description: 'Separado(a)' },
  { code: '6', description: 'União Estável' },
];

// Default employee types
const DEFAULT_EMPLOYEE_TYPES = [
  { code: 'CLT', description: 'CLT - Efetivo', validate_pis: true },
  { code: 'EST', description: 'Estagiário', validate_pis: false },
  { code: 'TMP', description: 'Temporário', validate_pis: true },
  { code: 'COM', description: 'Comissionado', validate_pis: false },
  { code: 'APR', description: 'Aprendiz', validate_pis: true },
  { code: 'EST2', description: 'Estatutário', validate_pis: true },
  { code: 'TER', description: 'Terceirizado', validate_pis: false },
];

// Default job functions
const DEFAULT_JOB_FUNCTIONS = [
  { code: 'ADM', description: 'Administrativo', exempt_from_time_clock: false },
  { code: 'OPR', description: 'Operacional', exempt_from_time_clock: false },
  { code: 'GER', description: 'Gerência', exempt_from_time_clock: true },
  { code: 'DIR', description: 'Diretoria', exempt_from_time_clock: true },
  { code: 'TEC', description: 'Técnico', exempt_from_time_clock: false },
  { code: 'AUX', description: 'Auxiliar', exempt_from_time_clock: false },
  { code: 'COO', description: 'Coordenação', exempt_from_time_clock: true },
  { code: 'SUP', description: 'Supervisão', exempt_from_time_clock: false },
];

// Default justifications
const DEFAULT_JUSTIFICATIONS = [
  { code: 'ATM', description: 'Atestado Médico', justify_type: 'absence', deduct_hours: false },
  { code: 'FLT', description: 'Falta Justificada', justify_type: 'absence', deduct_hours: false },
  { code: 'FNJ', description: 'Falta Não Justificada', justify_type: 'absence', deduct_hours: true },
  { code: 'ATR', description: 'Atraso Justificado', justify_type: 'delay', deduct_hours: false },
  { code: 'SRV', description: 'Serviço Externo', justify_type: 'absence', deduct_hours: false },
  { code: 'FER', description: 'Férias', justify_type: 'absence', deduct_hours: false },
  { code: 'LIC', description: 'Licença', justify_type: 'absence', deduct_hours: false },
  { code: 'DSR', description: 'Descanso Semanal Remunerado', justify_type: 'absence', deduct_hours: false },
  { code: 'ABN', description: 'Abono', justify_type: 'absence', deduct_hours: false },
  { code: 'CMP', description: 'Compensação de Horas', justify_type: 'absence', deduct_hours: false },
];

// Default overtime percentages
const DEFAULT_OVERTIME_PERCENTAGES = [
  { code: 'HE50', description: 'Hora Extra 50%', percentage: 50 },
  { code: 'HE75', description: 'Hora Extra 75%', percentage: 75 },
  { code: 'HE100', description: 'Hora Extra 100%', percentage: 100 },
  { code: 'HEN', description: 'Hora Extra Noturna', percentage: 20 },
];

// Default groupings
const DEFAULT_GROUPINGS = [
  { code: 'GAD', description: 'Administrativo' },
  { code: 'GOP', description: 'Operacional' },
  { code: 'GTC', description: 'Técnico' },
  { code: 'GED', description: 'Educação' },
  { code: 'GSA', description: 'Saúde' },
];

// Default specialties
const DEFAULT_SPECIALTIES = [
  { code: 'INF', description: 'Informática' },
  { code: 'CON', description: 'Contabilidade' },
  { code: 'RH', description: 'Recursos Humanos' },
  { code: 'JUR', description: 'Jurídico' },
  { code: 'ENG', description: 'Engenharia' },
];

export function useDefaultDataSeeder() {
  const { profile } = useAuth();

  const seedTable = useCallback(async (
    tableName: string,
    defaults: Record<string, unknown>[],
    companyId?: string
  ) => {
    try {
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.warn(`Cannot check ${tableName}:`, countError.message);
        return;
      }

      if (count && count > 0) return; // Already has data

      const records = defaults.map(d => ({
        ...d,
        is_active: true,
        company_id: companyId || null,
      }));

      // @ts-ignore - dynamic table
      const { error } = await supabase.from(tableName).insert(records);
      if (error) {
        console.warn(`Error seeding ${tableName}:`, error.message);
      } else {
        console.log(`Seeded ${records.length} records into ${tableName}`);
      }
    } catch (err) {
      console.warn(`Error seeding ${tableName}:`, err);
    }
  }, []);

  const seedAllDefaults = useCallback(async () => {
    if (!profile?.company_id) return;
    
    const companyId = profile.company_id;

    await Promise.all([
      seedTable('marital_statuses', DEFAULT_MARITAL_STATUSES, companyId),
      seedTable('employee_types', DEFAULT_EMPLOYEE_TYPES.map(({ validate_pis, ...rest }) => ({ ...rest, validate_pis })), companyId),
      seedTable('job_functions', DEFAULT_JOB_FUNCTIONS.map(({ exempt_from_time_clock, ...rest }) => ({ ...rest, exempt_from_time_clock })), companyId),
      seedTable('groupings', DEFAULT_GROUPINGS, companyId),
      seedTable('specialties', DEFAULT_SPECIALTIES, companyId),
    ]);
  }, [profile?.company_id, seedTable]);

  useEffect(() => {
    seedAllDefaults();
  }, [seedAllDefaults]);

  return { seedAllDefaults };
}
