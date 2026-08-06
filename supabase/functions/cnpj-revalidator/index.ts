import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleanCNPJ, formatCNPJ, validateCNPJ, computeCheckDigits } from "../_shared/cnpj.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    let dryRun = false;
    try { dryRun = Boolean((await req.json())?.dryRun); } catch { /* sem corpo */ }

    const outcomes = await revalidate(supabase, dryRun);

    return json({
      success: true,
      dryRun,
      total: outcomes.length,
      corrected: outcomes.filter(o => o.action === 'corrected').length,
      normalized: outcomes.filter(o => o.action === 'normalized').length,
      flagged: outcomes.filter(o => o.action === 'flagged').length,
      outcomes,
    });
  } catch (e) {
    console.error('cnpj-revalidator error', e);
    return json({ success: false, error: 'Falha ao revalidar CNPJs.' }, 500);
  }
});
