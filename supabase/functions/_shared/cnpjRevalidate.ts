import { cleanCNPJ, formatCNPJ, validateCNPJ, computeCheckDigits } from "./cnpj.ts";

interface Outcome {
  table: string;
  id: string;
  before: string;
  after: string | null;
  action: 'corrected' | 'flagged' | 'normalized';
  reason: string;
}

const TABLES = [
  { table: 'companies', label: 'Empresa', nameField: 'name' },
  { table: 'unions', label: 'Sindicato', nameField: 'name' },
];

export async function revalidate(supabase: any, dryRun = false) {
  const outcomes: Outcome[] = [];

  for (const t of TABLES) {
    const { data, error } = await supabase.from(t.table).select(`id, cnpj, ${t.nameField}, company_id`).limit(5000);
    if (error) { console.error(`erro lendo ${t.table}`, error); continue; }

    for (const row of data || []) {
      const raw: string = row.cnpj || '';
      if (!raw.trim()) continue;

      const clean = cleanCNPJ(raw);
      const check = validateCNPJ(clean);

      if (check.valid) {
        // Normaliza a máscara quando estiver fora do padrão
        const formatted = formatCNPJ(clean);
        if (raw !== formatted) {
          if (!dryRun) await supabase.from(t.table).update({ cnpj: formatted }).eq('id', row.id);
          outcomes.push({ table: t.table, id: row.id, before: raw, after: formatted, action: 'normalized', reason: 'Formatação padronizada' });
        }
        continue;
      }

      // Tenta corrigir automaticamente apenas o dígito verificador
      if (clean.length === 14 && /^[0-9A-Z]{12}$/.test(clean.slice(0, 12))) {
        const expected = computeCheckDigits(clean.slice(0, 12));
        const fixed = formatCNPJ(clean.slice(0, 12) + expected);
        if (!dryRun) await supabase.from(t.table).update({ cnpj: fixed }).eq('id', row.id);
        outcomes.push({
          table: t.table, id: row.id, before: raw, after: fixed, action: 'corrected',
          reason: `Dígito verificador corrigido (esperado ${expected})`,
        });
      } else {
        outcomes.push({
          table: t.table, id: row.id, before: raw, after: null, action: 'flagged',
          reason: check.message,
        });
      }
    }
  }

  if (!dryRun) {
    for (const o of outcomes) {
      if (o.action === 'flagged') {
        await supabase.from('system_diagnostics').insert({
          code: 'cnpj_invalido',
          severity: 'error',
          title: `CNPJ inválido em ${o.table}`,
          user_message: 'Ocorreu um erro. Nossa equipe já foi avisada.',
          technical_detail: `${o.before} — ${o.reason}`,
          entity_table: o.table,
          entity_id: o.id,
          auto_fixable: false,
          status: 'open',
        });
      } else {
        await supabase.from('audit_logs').insert({
          company_id: null,
          user_id: '00000000-0000-0000-0000-000000000000',
          user_name: 'Robô de revalidação de CNPJ',
          action: 'update_cnpj',
          table_name: o.table,
          record_id: o.id,
          old_data: { cnpj: o.before },
          new_data: { cnpj: o.after },
          menu_section: 'Manutenção automática',
          description: `${o.reason}: ${o.before} → ${o.after}`,
        });
      }
    }
  }

  return outcomes;
}

