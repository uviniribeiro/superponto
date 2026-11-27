import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleanCNPJ, validateCNPJ } from "../_shared/cnpj.ts";


import { getCorsHeaders } from "../_shared/cors.ts";
import { aiChat, aiConfig } from "../_shared/ai.ts";


let corsHeaders: Record<string, string> = getCorsHeaders(new Request("http://localhost"));

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

    // ---------------------------------------------------------------
    // 4) Identificação: QR Code, código de barras, PIN, matrícula ou CPF.
    //    Nenhum desses registra sozinho: o terminal sempre confere o rosto (1:1) com a foto do cadastro.
    // ---------------------------------------------------------------
    const METHOD_NAME: Record<string, string> = {
      qrcode: 'do QR Code', barcode: 'do código de barras', badge_legacy: 'do crachá', pin: 'do PIN', rfid: 'do cartão', registration: 'da matrícula', cpf: 'do CPF', manual: 'da identificação',
    };

    async function resolveIdentifier(rawIdentifier: string): Promise<{ profileId: string; methodType: string } | { error: string; status: number }> {
      if (!rawIdentifier) return { error: 'Informe o QR Code, PIN, matrícula ou CPF.', status: 400 };
      const digitsOnly = rawIdentifier.replace(/\D/g, '');
      const { data: method } = await supabase
        .from('employee_identification_methods')
        .select('profile_id, method_type, is_active, expires_at')
        .eq('company_id', terminal.company_id)
        .eq('identifier', rawIdentifier)
        .maybeSingle();
      if (method) {
        if (method.method_type === 'facial') return { error: 'Use o reconhecimento facial.', status: 400 };
        if (!method.is_active) return { error: 'Este método de identificação está inativo. Procure o RH.', status: 403 };
        if (method.expires_at && new Date(method.expires_at) <= new Date()) return { error: 'QR Code expirado. Solicite um novo ao RH.', status: 403 };
        return { profileId: method.profile_id, methodType: method.method_type };
      }
      // Matrícula e CPF: se houver mais de um cadastro com o mesmo número, exige QR Code ou PIN.
      const AMBIGUOUS = 'Há mais de um cadastro com esta identificação: use o QR Code, o código de barras ou o PIN.';
      const { data: byRegistration } = await supabase.from('profiles').select('id')
        .eq('company_id', terminal.company_id).eq('registration_number', rawIdentifier).eq('is_active', true).limit(2);
      if (byRegistration && byRegistration.length > 1) return { error: AMBIGUOUS, status: 409 };
      if (byRegistration?.length === 1) return { profileId: byRegistration[0].id, methodType: 'registration' };
      if (digitsOnly.length === 11) {
        const { data: byCpf } = await supabase.from('profiles').select('id')
          .eq('company_id', terminal.company_id).eq('cpf', digitsOnly).eq('is_active', true).limit(2);
        if (byCpf && byCpf.length > 1) return { error: AMBIGUOUS, status: 409 };
        if (byCpf?.length === 1) return { profileId: byCpf[0].id, methodType: 'cpf' };
      }
      await supabase.from('identification_validation_attempts').insert({
        company_id: terminal.company_id, method_type: 'kiosk', success: false,
        reason: 'Identificação não encontrada no terminal de ponto', user_agent: `kiosk terminal=${terminal.name}`,
      });
      return { error: 'Funcionário não encontrado nesta empresa.', status: 404 };
    }

    async function loadOwner(profileId: string) {
      const { data: owner } = await supabase.from('profiles')
        .select('id, full_name, photo_url, is_active, company_id').eq('id', profileId).maybeSingle();
      if (!owner || !owner.is_active || owner.company_id !== terminal.company_id) return { error: 'Funcionário inativo ou de outra empresa.', status: 403 };
      if (!owner.photo_url) return { error: 'Funcionário sem foto cadastrada para a verificação facial. Procure o RH.', status: 403 };
      const allowed = await authorizedProfileIds();
      if (allowed && !allowed.includes(owner.id)) return { error: 'Você não está autorizado a registrar ponto neste terminal.', status: 403 };
      return { owner };
    }

    /** Rosto conferido: próxima marcação do dia gravada na hora. */
    async function verifiedPunch(owner: { id: string; full_name: string }, methodType: string, confidence: number) {
      // Marcação offline: vale a hora em que foi feita no terminal (até 7 dias atrás, nunca no futuro).
      const offlineAt = body?.clientRecordedAt ? new Date(String(body.clientRecordedAt)) : null;
      if (offlineAt && (isNaN(offlineAt.getTime()) || offlineAt.getTime() > Date.now() + 5 * 60_000 || offlineAt.getTime() < Date.now() - 7 * 86_400_000)) {
        return json({ success: false, code: 'offline_expired', error: 'Marcação offline fora do prazo aceito (até 7 dias).' }, 422);
      }
      const ref = offlineAt ?? new Date();
      if (body?.clientPunchId) {
        const { data: dup } = await supabase.from('time_records').select('id, nsr, recorded_at, record_type, transaction_hash')
          .eq('transaction_hash', await punchHash(owner.id, '', ref)).maybeSingle();
        if (dup) return json({ success: true, record: dup, employeeName: owner.full_name, duplicated: true });
      }
      // Dia local (America/Sao_Paulo) da marcação
      const localDay = ref.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
      const start = new Date(`${localDay}T00:00:00-03:00`);
      const { data: todayRecords } = await supabase.from('time_records')
        .select('record_type, recorded_at').eq('profile_id', owner.id)
        .gte('recorded_at', start.toISOString()).lt('recorded_at', ref.toISOString()).order('recorded_at', { ascending: true });
      const last = (todayRecords || []).at(-1)?.record_type as RecordType | undefined;
      const nextIndex = last ? RECORD_ORDER.indexOf(last) + 1 : 0;
      if (nextIndex >= RECORD_ORDER.length) {
        return json({ success: false, error: 'Todos os registros do dia já foram feitos para este funcionário.' }, 409);
      }
      await supabase.from('identification_validation_attempts').insert({
        profile_id: owner.id, company_id: terminal.company_id, method_type: `${methodType}_facial`, success: true,
        reason: `Rosto conferido (${methodType}, confiança ${confidence}%) no terminal ${terminal.name}${offlineAt ? ' — marcação offline' : ''}`,
        user_agent: `kiosk terminal=${terminal.name}`,
      });
      await supabase.from('kiosk_terminals').update({ last_used_at: new Date().toISOString() }).eq('id', terminal.id);
      return await insertPunch(owner, RECORD_ORDER[nextIndex], methodType === 'facial' ? ' | facial' : ` | ${methodType} + facial`);
    }

    if (action === 'identify') {
      const r = await resolveIdentifier(String(body?.identifier || '').trim());
      if ('error' in r) return json({ success: false, error: r.error }, r.status);
      const o = await loadOwner(r.profileId);
      if ('error' in o) return json({ success: false, error: o.error }, o.status);
      return json({ success: true, requireFace: true, methodType: r.methodType, employee: { id: o.owner.id, full_name: o.owner.full_name } });
    }

    // Conferência 1:1: o rosto no terminal contra a foto do dono da identificação; se bater, registra.
    if (action === 'verify-face' || action === 'verify-qr-face') {
      const raw = String(body?.identifier || '').trim();
      const selfie = String(body?.selfieBase64 || '');
      if (!raw || !selfie) return json({ success: false, error: 'Identifique-se e olhe para a câmera.' }, 400);
      const r = await resolveIdentifier(raw);
      if ('error' in r) return json({ success: false, error: r.error }, r.status);
      const o = await loadOwner(r.profileId);
      if ('error' in o) return json({ success: false, error: o.error }, o.status);
      const owner = o.owner;
      const reference = await signPhotoUrl(supabase, owner.photo_url);
      if (!reference) return json({ success: false, error: 'Funcionário sem foto cadastrada para a verificação facial. Procure o RH.' }, 403);

      const ai = aiConfig();
      if (!ai) return json({ success: false, error: 'Verificação facial indisponível no momento.' }, 500);
      const aiRes = await aiChat(ai, {
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Verificação de identidade 1:1. A PRIMEIRA imagem é a pessoa diante do terminal agora; a SEGUNDA é a foto do cadastro. São a mesma pessoa? Considere apenas traços faciais (ignore iluminação, óculos, barba e fundo). Se não houver rosto nítido na primeira imagem, responda face=false. Responda apenas com JSON: {"face": true|false, "same": true|false, "confidence": <0 a 100>}' },
            { type: 'image_url', image_url: { url: selfie.startsWith('data:') ? selfie : `data:image/jpeg;base64,${selfie}` } },
            { type: 'image_url', image_url: { url: reference } },
          ],
        }],
      });
      if (!aiRes.ok) {
        console.error('verify face ai error', aiRes.status, await aiRes.text());
        return json({ success: false, error: 'Não foi possível concluir a verificação facial. Tente novamente.' }, 502);
      }
      const aiJson = await aiRes.json();
      const text = aiJson?.choices?.[0]?.message?.content ?? '';
      const m = /\{[\s\S]*\}/.exec(text);
      let parsed: { face?: boolean; same?: boolean; confidence?: number } = {};
      try { parsed = m ? JSON.parse(m[0]) : {}; } catch { parsed = {}; }
      const confidence = Number(parsed.confidence || 0);
      if (parsed.face === false) return json({ success: false, code: 'no_face', error: 'Rosto não detectado. Olhe para a câmera.' }, 422);
      if (!parsed.same || confidence < 75) {
        const refused = `Registro recusado, pessoa divergente ${METHOD_NAME[r.methodType] ?? 'da identificação'}.`;
        await supabase.from('identification_validation_attempts').insert({
          profile_id: owner.id, company_id: terminal.company_id, method_type: `${r.methodType}_facial`, success: false,
          reason: `${refused} (confiança ${confidence}%) no terminal ${terminal.name}`, user_agent: `kiosk terminal=${terminal.name}`,
        });
        return json({ success: false, code: 'face_mismatch', error: refused }, 403);
      }
      return await verifiedPunch(owner, r.methodType, confidence);
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

      const ai = aiConfig();
      if (!ai) return json({ success: false, error: 'Reconhecimento facial indisponível no momento.' }, 500);

      const content: unknown[] = [
        {
          type: 'text',
          text: `Compare a PRIMEIRA imagem (pessoa no terminal) com as demais imagens cadastradas e diga qual delas é a mesma pessoa. Responda apenas com JSON: {"index": <número da foto cadastrada a partir de 1 ou 0 se nenhuma>, "confidence": <0 a 100>}.`,
        },
        { type: 'image_url', image_url: { url: selfie.startsWith('data:') ? selfie : `data:image/jpeg;base64,${selfie}` } },
      ];
      const signedRoster: Array<{ id: string; url: string }> = [];
      for (const p of roster) {
        const signed = await signPhotoUrl(supabase, p.photo_url);
        if (!signed) continue;
        signedRoster.push({ id: p.id, url: signed });
        content.push({ type: 'image_url', image_url: { url: signed } });
      }
      if (signedRoster.length === 0) {
        return json({ success: false, error: 'Nenhuma foto disponível para reconhecimento facial neste terminal.' }, 404);
      }


      const aiRes = await aiChat(ai, { messages: [{ role: 'user', content }] });

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

      if (!idx || idx > signedRoster.length || confidence < 70) {
        await supabase.from('identification_validation_attempts').insert({
          company_id: terminal.company_id,
          method_type: 'facial',
          success: false,
          reason: `Reconhecimento facial sem correspondência (confiança ${confidence}%)`,
          user_agent: `kiosk terminal=${terminal.name}`,
        });
        return json({ success: false, error: 'Rosto não reconhecido. Aproxime-se, melhore a iluminação e tente de novo, ou use o QR Code.' }, 404);
      }

      const who = roster.find((p: any) => p.id === signedRoster[idx - 1].id)!;
      return await verifiedPunch({ id: who.id, full_name: who.full_name }, 'facial', confidence);
    }

    /** Hash de idempotência: com clientPunchId (fila do terminal) o mesmo envio nunca duplica. */
    async function punchHash(profileId: string, recordType: string, recordedAt: Date) {
      const punchId = String(body?.clientPunchId || '');
      return punchId
        ? await sha256(['kiosk', profileId, punchId].join('|'))
        : await sha256([profileId, recordType, recordedAt.toISOString(), body?.latitude ?? '', body?.longitude ?? '', crypto.randomUUID()].join('|'));
    }

    async function insertPunch(profile: { id: string; full_name: string }, recordType: RecordType, extra = '') {
      const clientRecordedAt = body?.clientRecordedAt ? new Date(String(body.clientRecordedAt)) : null;
      const queued = !!clientRecordedAt && !isNaN(clientRecordedAt.getTime());
      const recordedAt = queued ? clientRecordedAt! : new Date();
      const transactionHash = await punchHash(profile.id, recordType, recordedAt);
      const { data: existing } = await supabase
        .from('time_records')
        .select('id, nsr, recorded_at, record_type, transaction_hash')
        .eq('transaction_hash', transactionHash)
        .maybeSingle();
      if (existing) return json({ success: true, record: existing, employeeName: profile.full_name, duplicated: true });

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
          device_info: `Terminal CNPJ | ${terminal.name}${extra}${queued ? ' | fila offline' : ''} | ${String(body?.userAgent || '').slice(0, 300)}`,
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

    // ---------------------------------------------------------------
    // 6) Registro de ponto
    // ---------------------------------------------------------------
    if (action === 'punch') {
      // Toda marcação passa pela conferência do rosto (verify-face / identify-face).
      return json({ success: false, code: 'face_required', error: 'O registro exige a verificação facial. Atualize o terminal.' }, 410);
    }

    return json({ success: false, error: 'Ação não reconhecida.' }, 400);
  } catch (err) {
    console.error('kiosk-terminal error:', err);
    return json({ success: false, error: 'Erro interno no terminal de ponto.' }, 500);
  }
});
