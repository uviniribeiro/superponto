import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


import { getCorsHeaders } from "../_shared/cors.ts";


let corsHeaders: Record<string, string> = getCorsHeaders(new Request("https://superponto.lovable.app"));

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

async function sha256(v: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(len = 24) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Somente administradores autenticados podem disparar correções
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return json({ success: false, error: 'Não autenticado.' }, 401);

  const { data: userData } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (!user) return json({ success: false, error: 'Sessão inválida.' }, 401);

  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id);
  const isAdmin = (roles || []).some(r => r.role === 'admin' || r.role === 'super_admin');
  if (!isAdmin) return json({ success: false, error: 'Apenas administradores podem corrigir erros.' }, 403);

  try {
    const body = await req.json();
    const ids: string[] = body?.diagnosticIds || (body?.diagnosticId ? [body.diagnosticId] : []);
    if (!ids.length) return json({ success: false, error: 'Informe o diagnóstico a corrigir.' }, 400);

    const { data: diagnostics } = await admin
      .from('system_diagnostics').select('*').in('id', ids).eq('status', 'open');

    const results: { id: string; ok: boolean; message: string }[] = [];

    for (const d of diagnostics || []) {
      let ok = false;
      let message = 'Correção automática não disponível para este caso.';

      try {
        switch (d.fix_action) {
          case 'rehash_time_record': {
            const { data: rec } = await admin.from('time_records')
              .select('id, profile_id, record_type, recorded_at, latitude, longitude')
              .eq('id', d.entity_id).maybeSingle();
            if (rec) {
              const hash = await sha256([rec.profile_id, rec.record_type, rec.recorded_at, rec.latitude ?? '', rec.longitude ?? ''].join('|'));
              await admin.from('time_records').update({ transaction_hash: hash }).eq('id', rec.id);
              ok = true; message = 'Selo de integridade recalculado.';
            } else message = 'Registro não encontrado (já removido).';
            break;
          }
          case 'generate_qrcode': {
            const { data: prof } = await admin.from('profiles').select('id, company_id').eq('id', d.entity_id).maybeSingle();
            if (prof) {
              const identifier = `PM-${randomToken(16)}`;
              await admin.from('employee_identification_methods').insert({
                profile_id: prof.id,
                company_id: prof.company_id,
                method_type: 'qrcode',
                identifier,
                is_active: true,
                expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(),
              });
              ok = true; message = 'QR Code gerado para o funcionário.';
            } else message = 'Funcionário não encontrado.';
            break;
          }
          case 'renew_qrcode': {
            await admin.from('employee_identification_methods')
              .update({ expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString() })
              .eq('id', d.entity_id);
            ok = true; message = 'QR Code renovado por mais 12 meses.';
            break;
          }
          case 'ping_equipment': {
            const { error } = await admin.functions.invoke('equipment-sync', {
              body: { action: 'ping', equipmentId: d.entity_id },
            });
            ok = !error;
            message = ok ? 'Sincronização solicitada ao equipamento.' : 'O equipamento continua sem responder — verifique a rede local.';
            break;
          }
          case 'create_default_rules': {
            const { error } = await admin.from('attendance_rules').insert({ company_id: d.entity_id });
            ok = !error;
            message = ok ? 'Regras de apuração padrão criadas.' : `Não foi possível criar as regras: ${error?.message}`;
            break;
          }
          case 'reconnect_kiosk_terminal': {
            const { data: term } = await admin.from('kiosk_terminals')
              .select('id, name, status, is_active').eq('id', d.entity_id).maybeSingle();
            if (!term) { message = 'Terminal não encontrado.'; break; }
            await admin.from('kiosk_terminals').update({
              is_active: true,
              status: term.status === 'rejected' ? 'rejected' : 'approved',
              last_used_at: new Date().toISOString(),
            }).eq('id', term.id);
            // Confirma que o backend do terminal está respondendo
            const { error: healthError } = await admin.functions.invoke('kiosk-terminal', { body: { action: 'health' } });
            ok = !healthError;
            message = ok
              ? `Conexão do terminal "${term.name}" restabelecida e liberada para registrar ponto.`
              : 'O serviço do terminal ainda não respondeu — tente novamente em alguns instantes.';
            break;
          }
          case 'revalidate_cnpj': {
            const { error } = await admin.functions.invoke('cnpj-revalidator', { body: { dryRun: false } });
            ok = !error;
            message = ok ? 'Revalidação de CNPJ executada.' : 'Não foi possível executar a revalidação agora.';
            break;
          }

          default:
            message = 'Este erro precisa de análise manual.';
        }
      } catch (e) {
        message = `Falha ao corrigir: ${(e as Error).message}`;
      }

      await admin.from('system_diagnostics').update({
        status: ok ? 'fixed' : 'open',
        fixed_at: ok ? new Date().toISOString() : null,
        fixed_by: ok ? user.id : null,
        fix_result: message,
      }).eq('id', d.id);

      results.push({ id: d.id, ok, message });
    }

    return json({
      success: true,
      fixed: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      results,
    });
  } catch (e) {
    console.error('system-autofix error', e);
    return json({ success: false, error: 'Falha ao aplicar a correção automática.' }, 500);
  }
});
