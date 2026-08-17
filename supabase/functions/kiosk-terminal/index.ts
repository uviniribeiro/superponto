import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleanCNPJ, validateCNPJ } from "../_shared/cnpj.ts";


import { getCorsHeaders } from "../_shared/cors.ts";


let corsHeaders: Record<string, string> = getCorsHeaders(new Request("https://superponto.lovable.app"));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Employee photos live in a private bucket; sign them for short-lived display.
const signPhotoUrl = async (client: any, url: string | null | undefined): Promise<string | null> => {
  if (!url) return null;
  const match = String(url).match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!match) return url;
  const { data } = await client.storage.from(match[1]).createSignedUrl(decodeURIComponent(match[2]), 300);
  return data?.signedUrl ?? null;
};

const RECORD_ORDER = ['entry', 'break_start', 'break_end', 'exit'] as const;
type RecordType = typeof RECORD_ORDER[number];

async function sha256(value: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function activationCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const action = String(body?.action || '');

    // ---------------------------------------------------------------
    // 0) Health-check: sempre responde, inclusive durante a manutenção.
    //    O terminal usa esta rota para reconectar automaticamente.
    // ---------------------------------------------------------------
    if (action === 'health') {
      let maintenance: Record<string, unknown> | null = null;
      try {
        const { data } = await supabase
          .from('system_maintenance')
          .select('job, reason, started_at, expected_end_at')
          .eq('is_active', true)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        maintenance = data ?? null;
      } catch (_e) {
        // health-check nunca falha por causa da consulta de manutenção
      }
      return json({
        success: true,
        status: 'online',
        serverTime: new Date().toISOString(),
        maintenance,
        acceptsPunches: true,
      });
    }



    // ---------------------------------------------------------------
    // 1) Solicitação de ativação do terminal (aguarda liberação do ADM)
    // ---------------------------------------------------------------
    if (action === 'activate') {
      const cnpj = cleanCNPJ(String(body?.cnpj || ''));
      const terminalName = String(body?.terminalName || '').trim() || 'Terminal de Ponto';

      if (!cnpj) {
        return json({ success: false, error: 'Informe o CNPJ da empresa.' }, 400);
      }
      const cnpjCheck = validateCNPJ(cnpj);
      if (!cnpjCheck.valid) {
        return json({ success: false, error: `CNPJ inválido — ${cnpjCheck.message}.` }, 400);
      }

      const { data: companies, error: companyError } = await supabase
        .from('companies')
        .select('id, name, company_code, cnpj, is_active')
        .limit(2000);

      if (companyError) throw companyError;

      const company = (companies || []).find(c =>
        cleanCNPJ(c.company_code || '') === cnpj || cleanCNPJ(c.cnpj || '') === cnpj
      );

      if (!company) {
        return json({ success: false, error: 'CNPJ não encontrado no sistema.' }, 404);
      }
      if (!company.is_active) {
        return json({ success: false, error: 'Empresa inativa. Contate o administrador.' }, 403);
      }

      const deviceToken = crypto.randomUUID() + '.' + crypto.randomUUID();
      const code = activationCode();

      const { data: terminal, error: terminalError } = await supabase
        .from('kiosk_terminals')
        .insert({
          company_id: company.id,
          name: terminalName,
          device_token: deviceToken,
          status: 'pending',
          activation_code: code,
          latitude: body?.latitude ?? null,
          longitude: body?.longitude ?? null,
          address: body?.address ?? null,
          last_used_at: new Date().toISOString(),
        })
        .select('id, name, status, activation_code')
        .single();

      if (terminalError) throw terminalError;

      return json({
        success: true,
        deviceToken,
        status: 'pending',
        activationCode: code,
        terminal: { id: terminal.id, name: terminal.name },
        company: { id: company.id, name: company.name },
      });
    }

    // Todas as demais ações exigem um terminal válido
    const deviceToken = String(body?.deviceToken || '');
    if (!deviceToken) {
      return json({ success: false, error: 'Terminal não autenticado.' }, 401);
    }

    const { data: terminal } = await supabase
      .from('kiosk_terminals')
      .select('id, name, company_id, is_active, status, allow_all_employees, activation_code, latitude, longitude, address, companies:company_id(id, name, is_active)')
      .eq('device_token', deviceToken)
      .maybeSingle();

    if (!terminal || !terminal.is_active) {
      return json({ success: false, error: 'Terminal desativado ou não reconhecido. Ative novamente com o CNPJ.', code: 'terminal_invalid' }, 401);
    }
    const companyInfo = (terminal as any).companies;
    if (companyInfo && companyInfo.is_active === false) {
      return json({ success: false, error: 'Empresa inativa. Contate o administrador.', code: 'company_inactive' }, 403);
    }

    const terminalPayload = {
      id: terminal.id,
      name: terminal.name,
      status: terminal.status,
      activationCode: terminal.activation_code,
      latitude: terminal.latitude,
      longitude: terminal.longitude,
      address: terminal.address,
    };

    // Atualiza a localização do terminal quando o dispositivo informa
    if (body?.latitude != null && body?.longitude != null && action !== 'activate') {
      await supabase.from('kiosk_terminals').update({
        latitude: body.latitude,
        longitude: body.longitude,
        address: body?.address ?? terminal.address,
      }).eq('id', terminal.id);
    }

    // ---------------------------------------------------------------
    // 2) Sessão do terminal (revalidação no carregamento)
    // ---------------------------------------------------------------
    if (action === 'session') {
      return json({
        success: true,
        terminal: terminalPayload,
        company: { id: terminal.company_id, name: companyInfo?.name ?? '' },
      });
    }

    // ---------------------------------------------------------------
    // 2b) Terminal relata queda de conexão assim que volta ao ar.
    //     Gera diagnóstico com correção automática para o ADM.
    // ---------------------------------------------------------------
    if (action === 'report-issue') {
      const detail = String(body?.detail || 'Terminal ficou sem comunicação com o servidor.').slice(0, 1000);
      const offlineSeconds = Number(body?.offlineSeconds || 0);
      const pending = Number(body?.pendingPunches || 0);

      await supabase.from('system_diagnostics').insert({
        code: 'terminal_sem_conexao',
        severity: offlineSeconds > 600 ? 'error' : 'warning',
        title: `Terminal "${terminal.name}" ficou sem comunicação com o servidor`,
        user_message: 'Ocorreu um erro. Já registramos o problema e a equipe foi avisada.',
        technical_detail: `${detail}\nTempo offline: ${offlineSeconds}s\nRegistros na fila: ${pending}\nTerminal: ${terminal.id}`,
        entity_table: 'kiosk_terminals',
        entity_id: terminal.id,
        auto_fixable: true,
        fix_action: 'reconnect_kiosk_terminal',
        status: 'open',
      });

      return json({ success: true });
    }



    if (terminal.status === 'rejected') {
      return json({ success: false, error: 'Este terminal foi recusado pelo administrador.', code: 'terminal_rejected' }, 403);
    }
    if (terminal.status !== 'approved') {
      return json({ success: false, error: 'Terminal aguardando liberação do administrador do sistema.', code: 'terminal_pending' }, 403);
    }

    // Lista de funcionários autorizados neste terminal
    async function authorizedProfileIds(): Promise<string[] | null> {
      if (terminal.allow_all_employees) return null; // null = todos
      const { data } = await supabase
        .from('kiosk_terminal_employees')
        .select('profile_id')
        .eq('terminal_id', terminal.id);
      return (data || []).map(r => r.profile_id as string);
    }

    // ---------------------------------------------------------------
    // 3) Lista de funcionários liberados para este terminal
    // ---------------------------------------------------------------
    if (action === 'roster') {
      const allowed = await authorizedProfileIds();
      let query = supabase
        .from('profiles')
        .select('id, full_name, registration_number, department, position, photo_url')
        .eq('company_id', terminal.company_id)
        .eq('is_active', true)
        .order('full_name');
      if (allowed) {
        if (allowed.length === 0) return json({ success: true, employees: [] });
        query = query.in('id', allowed);
      }
      const { data } = await query.limit(500);
      return json({ success: true, employees: data || [] });
    }

    async function buildIdentifyResponse(profileId: string, methodType: string) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, registration_number, department, position, photo_url, is_active, company_id')
        .eq('id', profileId)
        .maybeSingle();

      if (!profile || !profile.is_active || profile.company_id !== terminal.company_id) {
        return json({ success: false, error: 'Funcionário inativo ou de outra empresa.' }, 403);
      }

      const allowed = await authorizedProfileIds();
      if (allowed && !allowed.includes(profile.id)) {
        await supabase.from('identification_validation_attempts').insert({
          profile_id: profile.id,
          company_id: terminal.company_id,
          method_type: methodType,
          success: false,
          reason: `Funcionário não autorizado no terminal ${terminal.name}`,
          user_agent: `kiosk terminal=${terminal.name}`,
        });
        return json({ success: false, error: 'Você não está autorizado a registrar ponto neste terminal.' }, 403);
      }

      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      const { data: todayRecords } = await supabase
        .from('time_records')
        .select('record_type, recorded_at')
        .eq('profile_id', profile.id)
        .gte('recorded_at', start.toISOString())
        .lte('recorded_at', end.toISOString())
        .order('recorded_at', { ascending: true });

      const last = (todayRecords || []).at(-1)?.record_type as RecordType | undefined;
      const nextIndex = last ? RECORD_ORDER.indexOf(last) + 1 : 0;
      const nextRecordType = nextIndex < RECORD_ORDER.length ? RECORD_ORDER[nextIndex] : null;

      await supabase.from('identification_validation_attempts').insert({
        profile_id: profile.id,
        company_id: terminal.company_id,
        method_type: methodType,
        success: true,
        reason: `Identificação aceita no terminal ${terminal.name}`,
        user_agent: `kiosk terminal=${terminal.name}`,
      });

      await supabase.from('kiosk_terminals')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', terminal.id);

      return json({
        success: true,
        methodType,
        employee: {
          id: profile.id,
          full_name: profile.full_name,
          registration_number: profile.registration_number,
          department: profile.department,
          position: profile.position,
          photo_url: await signPhotoUrl(supabase, profile.photo_url),
        },
        todayRecords: todayRecords || [],
        nextRecordType,
      });
    }

    // ---------------------------------------------------------------
    // 4) Identificação por QR, código de barras, PIN, RFID, matrícula ou CPF
    // ---------------------------------------------------------------
    if (action === 'identify') {
      const rawIdentifier = String(body?.identifier || '').trim();
      if (!rawIdentifier) {
        return json({ success: false, error: 'Informe o QR Code, PIN, matrícula ou CPF.' }, 400);
      }

      const digitsOnly = rawIdentifier.replace(/\D/g, '');
      let profileId: string | null = null;
      let methodType = 'manual';

      const { data: method } = await supabase
        .from('employee_identification_methods')
        .select('profile_id, company_id, method_type, is_active, expires_at')
        .eq('company_id', terminal.company_id)
        .eq('identifier', rawIdentifier)
        .maybeSingle();

      if (method) {
        methodType = method.method_type;
        if (!method.is_active) {
          return json({ success: false, error: 'Este método de identificação está inativo. Procure o RH.' }, 403);
        }
        if (method.expires_at && new Date(method.expires_at) <= new Date()) {
          return json({ success: false, error: 'QR Code expirado. Solicite um novo ao RH.' }, 403);
        }
        profileId = method.profile_id;
      } else {
        const { data: byRegistration } = await supabase
          .from('profiles')
          .select('id')
          .eq('company_id', terminal.company_id)
          .eq('registration_number', rawIdentifier)
          .eq('is_active', true)
          .maybeSingle();

        if (byRegistration) {
          profileId = byRegistration.id;
          methodType = 'registration';
        } else if (digitsOnly.length === 11) {
          const { data: byCpf } = await supabase
            .from('profiles')
            .select('id')
            .eq('company_id', terminal.company_id)
            .eq('cpf', digitsOnly)
            .eq('is_active', true)
            .maybeSingle();
          if (byCpf) {
            profileId = byCpf.id;
            methodType = 'cpf';
          }
        }
      }

      if (!profileId) {
        await supabase.from('identification_validation_attempts').insert({
          company_id: terminal.company_id,
          method_type: 'kiosk',
          success: false,
          reason: 'Identificação não encontrada no terminal de ponto',
          user_agent: `kiosk terminal=${terminal.name}`,
        });
        return json({ success: false, error: 'Funcionário não encontrado nesta empresa.' }, 404);
      }

      return await buildIdentifyResponse(profileId, methodType);
    }

    // ---------------------------------------------------------------
    // 5) Identificação facial (compara com as fotos dos autorizados)
    // ---------------------------------------------------------------
    if (action === 'identify-face') {
      const selfie = String(body?.selfieBase64 || '');
      if (!selfie) return json({ success: false, error: 'Foto não capturada. Tente novamente.' }, 400);

      const allowed = await authorizedProfileIds();
      let query = supabase
        .from('profiles')
        .select('id, full_name, photo_url')
        .eq('company_id', terminal.company_id)
        .eq('is_active', true)
        .not('photo_url', 'is', null);
      if (allowed) {
        if (allowed.length === 0) return json({ success: false, error: 'Nenhum funcionário autorizado neste terminal.' }, 403);
        query = query.in('id', allowed);
      }
      const { data: roster } = await query.limit(60);

      if (!roster || roster.length === 0) {
        return json({ success: false, error: 'Nenhuma foto cadastrada para reconhecimento facial neste terminal.' }, 404);
      }

      const apiKey = Deno.env.get('LOVABLE_API_KEY');
      if (!apiKey) return json({ success: false, error: 'Reconhecimento facial indisponível no momento.' }, 500);

      const content: unknown[] = [
        {
          type: 'text',
          text: `Compare a PRIMEIRA imagem (pessoa no terminal) com as demais imagens cadastradas e diga qual delas é a mesma pessoa. Responda apenas com JSON: {"index": <número da foto cadastrada a partir de 1 ou 0 se nenhuma>, "confidence": <0 a 100>}.`,
        },
        { type: 'image_url', image_url: { url: selfie.startsWith('data:') ? selfie : `data:image/jpeg;base64,${selfie}` } },
      ];
      for (const p of roster) {
        const signed = await signPhotoUrl(supabase, p.photo_url);
        if (!signed) continue;
        content.push({ type: 'image_url', image_url: { url: signed } });
      }

      const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content }],
        }),
      });

      if (!aiRes.ok) {
        console.error('face ai error', aiRes.status, await aiRes.text());
        return json({ success: false, error: 'Não foi possível concluir o reconhecimento facial. Use o QR Code ou o teclado.' }, 502);
      }

      const aiJson = await aiRes.json();
      const text = aiJson?.choices?.[0]?.message?.content ?? '';
      const match = /\{[\s\S]*\}/.exec(text);
      const parsed = match ? JSON.parse(match[0]) : { index: 0, confidence: 0 };
      const idx = Number(parsed.index || 0);
      const confidence = Number(parsed.confidence || 0);

      if (!idx || idx > roster.length || confidence < 70) {
        await supabase.from('identification_validation_attempts').insert({
          company_id: terminal.company_id,
          method_type: 'facial',
          success: false,
          reason: `Reconhecimento facial sem correspondência (confiança ${confidence}%)`,
          user_agent: `kiosk terminal=${terminal.name}`,
        });
        return json({ success: false, error: 'Rosto não reconhecido. Aproxime-se, melhore a iluminação e tente de novo, ou use o QR Code.' }, 404);
      }

      return await buildIdentifyResponse(roster[idx - 1].id, 'facial');
    }

    // ---------------------------------------------------------------
    // 6) Registro de ponto
    // ---------------------------------------------------------------
    if (action === 'punch') {
      const profileId = String(body?.profileId || '');
      const recordType = String(body?.recordType || '') as RecordType;

      if (!profileId || !RECORD_ORDER.includes(recordType)) {
        return json({ success: false, error: 'Dados do registro inválidos.' }, 400);
      }

      const allowed = await authorizedProfileIds();
      if (allowed && !allowed.includes(profileId)) {
        return json({ success: false, error: 'Funcionário não autorizado neste terminal.' }, 403);
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, company_id, is_active')
        .eq('id', profileId)
        .maybeSingle();

      if (!profile || !profile.is_active || profile.company_id !== terminal.company_id) {
        return json({ success: false, error: 'Funcionário inválido para este terminal.' }, 403);
      }

      // Registro offline enfileirado no terminal: preserva a hora real da marcação
      const clientRecordedAt = body?.clientRecordedAt ? new Date(String(body.clientRecordedAt)) : null;
      const queued = !!clientRecordedAt && !isNaN(clientRecordedAt.getTime());
      const recordedAt = queued ? clientRecordedAt! : new Date();

      // Idempotência da fila: o mesmo registro reenviado não duplica
      const punchId = String(body?.clientPunchId || '');
      const transactionHash = await sha256(
        [profile.id, recordType, recordedAt.toISOString(), body?.latitude ?? '', body?.longitude ?? '', punchId].join('|')
      );

      const { data: existing } = await supabase
        .from('time_records')
        .select('id, nsr, recorded_at, record_type, transaction_hash')
        .eq('transaction_hash', transactionHash)
        .maybeSingle();

      if (existing) {
        return json({ success: true, record: existing, employeeName: profile.full_name, duplicated: true });
      }

      const { data: record, error } = await supabase
        .from('time_records')
        .insert({
          profile_id: profile.id,
          company_id: terminal.company_id,
          record_type: recordType,
          recorded_at: recordedAt.toISOString(),
          latitude: body?.latitude ?? terminal.latitude ?? null,
          longitude: body?.longitude ?? terminal.longitude ?? null,
          address: body?.address ?? terminal.address ?? null,
          device_info: `Terminal CNPJ | ${terminal.name}${queued ? ' | fila offline' : ''} | ${String(body?.userAgent || '').slice(0, 300)}`,
          transaction_hash: transactionHash,
        })
        .select('id, nsr, recorded_at, record_type, transaction_hash')
        .single();


      if (error) {
        console.error('Erro ao inserir registro do terminal:', error);
        return json({ success: false, error: 'Não foi possível registrar o ponto. Tente novamente.' }, 500);
      }

      return json({ success: true, record, employeeName: profile.full_name });
    }

    return json({ success: false, error: 'Ação não reconhecida.' }, 400);
  } catch (err) {
    console.error('kiosk-terminal error:', err);
    return json({ success: false, error: 'Erro interno no terminal de ponto.' }, 500);
  }
});
