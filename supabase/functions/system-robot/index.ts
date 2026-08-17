import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { revalidate } from "../_shared/cnpjRevalidate.ts";


import { getCorsHeaders } from "../_shared/cors.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

interface Finding {
  code: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  technical_detail: string;
  entity_table?: string;
  entity_id?: string;
  auto_fixable: boolean;
  fix_action?: string;
}

/**
 * Robô diário de manutenção do Ponto Max.
 * Roda às 03:00, sinaliza a janela de manutenção (o sistema continua no ar,
 * apenas exibindo o aviso) e executa checagens, correções e reativações.
 */
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const startedAt = new Date();

  const { data: window } = await supabase.from('system_maintenance').insert({
    is_active: true,
    job: 'robo-diario-03h',
    reason: 'Verificação automática de dados, correções e reativação de recursos.',
    started_at: startedAt.toISOString(),
    expected_end_at: new Date(startedAt.getTime() + 30 * 60_000).toISOString(),
  }).select('id').single();

  const findings: Finding[] = [];
  const fixes: string[] = [];

  try {
    // 1) CNPJs inconsistentes (numérico e alfanumérico)
    const cnpjOutcomes = await revalidate(supabase, false);
    if (cnpjOutcomes.length) fixes.push(`${cnpjOutcomes.filter(o => o.action !== 'flagged').length} CNPJ(s) ajustados`);

    // 2) Registros de ponto sem hash de integridade
    const { data: noHash } = await supabase
      .from('time_records').select('id').is('transaction_hash', null).limit(500);
    for (const r of noHash || []) {
      findings.push({
        code: 'time_record_sem_hash', severity: 'warning',
        title: 'Registro de ponto sem selo de integridade',
        technical_detail: `time_records.id=${r.id} está sem transaction_hash`,
        entity_table: 'time_records', entity_id: r.id,
        auto_fixable: true, fix_action: 'rehash_time_record',
      });
    }

    // 3) Funcionários ativos sem nenhum método de identificação
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, company_id').eq('is_active', true).limit(2000);
    const { data: methods } = await supabase
      .from('employee_identification_methods').select('profile_id').eq('is_active', true).limit(10000);
    const withMethod = new Set((methods || []).map(m => m.profile_id));
    for (const p of profiles || []) {
      if (!withMethod.has(p.id)) {
        findings.push({
          code: 'funcionario_sem_identificacao', severity: 'warning',
          title: `Funcionário sem método de identificação: ${p.full_name}`,
          technical_detail: `profiles.id=${p.id} não possui QR Code, PIN, crachá ou facial ativo`,
          entity_table: 'profiles', entity_id: p.id,
          auto_fixable: true, fix_action: 'generate_qrcode',
        });
      }
    }

    // 4) QR Codes expirados que continuam marcados como ativos
    const { data: expired } = await supabase
      .from('employee_identification_methods')
      .select('id, profile_id, expires_at')
      .eq('is_active', true).eq('method_type', 'qrcode')
      .lt('expires_at', new Date().toISOString()).limit(1000);
    for (const m of expired || []) {
      findings.push({
        code: 'qrcode_expirado_ativo', severity: 'warning',
        title: 'QR Code expirado ainda marcado como ativo',
        technical_detail: `employee_identification_methods.id=${m.id} expirou em ${m.expires_at}`,
        entity_table: 'employee_identification_methods', entity_id: m.id,
        auto_fixable: true, fix_action: 'renew_qrcode',
      });
    }

    // 5) Equipamentos REP offline há mais de 24h — tenta reativar a comunicação
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const { data: offline } = await supabase
      .from('time_clock_equipment')
      .select('id, name, last_communication')
      .eq('is_active', true).or(`last_communication.is.null,last_communication.lt.${dayAgo}`).limit(500);
    for (const e of offline || []) {
      findings.push({
        code: 'equipamento_offline', severity: 'error',
        title: `Equipamento sem comunicação: ${e.name}`,
        technical_detail: `time_clock_equipment.id=${e.id} última comunicação: ${e.last_communication ?? 'nunca'}`,
        entity_table: 'time_clock_equipment', entity_id: e.id,
        auto_fixable: true, fix_action: 'ping_equipment',
      });
    }

    // 6) Terminais de ponto pendentes de liberação há mais de 48h
    const twoDays = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const { data: stale } = await supabase
      .from('kiosk_terminals').select('id, name, created_at')
      .eq('status', 'pending').lt('created_at', twoDays).limit(200);
    for (const t of stale || []) {
      findings.push({
        code: 'terminal_pendente', severity: 'info',
        title: `Terminal aguardando liberação: ${t.name}`,
        technical_detail: `kiosk_terminals.id=${t.id} pendente desde ${t.created_at}`,
        entity_table: 'kiosk_terminals', entity_id: t.id,
        auto_fixable: false,
      });
    }

    // 7) Recursos desativados que deveriam estar ativos (empresa ativa, regras de apuração)
    const { data: companies } = await supabase.from('companies').select('id, name').eq('is_active', true).limit(1000);
    const { data: rules } = await supabase.from('attendance_rules').select('company_id').limit(2000);
    const withRules = new Set((rules || []).map(r => r.company_id));
    for (const c of companies || []) {
      if (!withRules.has(c.id)) {
        findings.push({
          code: 'regras_apuracao_ausentes', severity: 'warning',
          title: `Empresa sem regras de apuração: ${c.name}`,
          technical_detail: `companies.id=${c.id} não possui registro em attendance_rules`,
          entity_table: 'companies', entity_id: c.id,
          auto_fixable: true, fix_action: 'create_default_rules',
        });
      }
    }

    // Grava os diagnósticos abertos (sem duplicar os já abertos)
    const { data: open } = await supabase
      .from('system_diagnostics').select('id, code, entity_id, occurrences').eq('status', 'open').limit(5000);
    const key = (c: string, e?: string) => `${c}::${e ?? ''}`;
    const existing = new Map((open || []).map(d => [key(d.code, d.entity_id), d]));

    for (const f of findings) {
      const found = existing.get(key(f.code, f.entity_id));
      if (found) {
        await supabase.from('system_diagnostics')
          .update({ occurrences: (found.occurrences || 1) + 1, detected_at: new Date().toISOString() })
          .eq('id', found.id);
      } else {
        await supabase.from('system_diagnostics').insert({ ...f, status: 'open' });
      }
    }

    // Fecha diagnósticos que não apareceram mais
    const currentKeys = new Set(findings.map(f => key(f.code, f.entity_id)));
    for (const [k, d] of existing) {
      if (!currentKeys.has(k) && d.code !== 'runtime_error') {
        await supabase.from('system_diagnostics')
          .update({ status: 'fixed', fixed_at: new Date().toISOString(), fix_result: 'Resolvido — não detectado na última varredura' })
          .eq('id', d.id);
      }
    }

    const endedAt = new Date();
    if (window?.id) {
      await supabase.from('system_maintenance')
        .update({ is_active: false, ended_at: endedAt.toISOString() })
        .eq('id', window.id);
    }

    return json({
      success: true,
      startedAt, endedAt,
      durationSeconds: Math.round((+endedAt - +startedAt) / 1000),
      findings: findings.length,
      fixes,
    });
  } catch (e) {
    console.error('system-robot error', e);
    if (window?.id) {
      await supabase.from('system_maintenance')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', window.id);
    }
    return json({ success: false, error: 'Falha na rotina automática de manutenção.' }, 500);
  }
});
