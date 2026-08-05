import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cleanCNPJ, isValidCNPJ } from "../_shared/cnpj.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const RECORD_ORDER = ['entry', 'break_start', 'break_end', 'exit'] as const;
type RecordType = typeof RECORD_ORDER[number];

async function sha256(value: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
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
    // 1) Ativação do terminal: apenas o CNPJ da empresa
    // ---------------------------------------------------------------
    if (action === 'activate') {
      const cnpj = cleanCNPJ(String(body?.cnpj || ''));
      const terminalName = String(body?.terminalName || '').trim() || 'Terminal de Ponto';

      if (!cnpj) {
        return json({ success: false, error: 'Informe o CNPJ da empresa.' }, 400);
      }
      if (!isValidCNPJ(cnpj)) {
        return json({ success: false, error: 'CNPJ inválido — confira os dígitos verificadores.' }, 400);
      }

      const { data: companies, error: companyError } = await supabase
        .from('companies')
        .select('id, name, company_code, cnpj, is_active')
        .or(`company_code.eq.${cnpj},cnpj.eq.${cnpj}`)
        .limit(5);

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

      const { data: terminal, error: terminalError } = await supabase
        .from('kiosk_terminals')
        .insert({
          company_id: company.id,
          name: terminalName,
          device_token: deviceToken,
          last_used_at: new Date().toISOString(),
        })
        .select('id, name')
        .single();

      if (terminalError) throw terminalError;

      return json({
        success: true,
        deviceToken,
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
      .select('id, name, company_id, is_active, companies:company_id(id, name, is_active)')
      .eq('device_token', deviceToken)
      .maybeSingle();

    if (!terminal || !terminal.is_active) {
      return json({ success: false, error: 'Terminal desativado ou não reconhecido. Ative novamente com o CNPJ.', code: 'terminal_invalid' }, 401);
    }
    const companyInfo = (terminal as any).companies;
    if (companyInfo && companyInfo.is_active === false) {
      return json({ success: false, error: 'Empresa inativa. Contate o administrador.', code: 'company_inactive' }, 403);
    }

    // ---------------------------------------------------------------
    // 2) Sessão do terminal (revalidação no carregamento)
    // ---------------------------------------------------------------
    if (action === 'session') {
      return json({
        success: true,
        terminal: { id: terminal.id, name: terminal.name },
        company: { id: terminal.company_id, name: companyInfo?.name ?? '' },
      });
    }

    // ---------------------------------------------------------------
    // 3) Identificação do funcionário (QR, PIN, RFID, matrícula ou CPF)
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, registration_number, department, position, photo_url, is_active, company_id')
        .eq('id', profileId)
        .maybeSingle();

      if (!profile || !profile.is_active || profile.company_id !== terminal.company_id) {
        return json({ success: false, error: 'Funcionário inativo ou de outra empresa.' }, 403);
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
          photo_url: profile.photo_url,
        },
        todayRecords: todayRecords || [],
        nextRecordType,
      });
    }

    // ---------------------------------------------------------------
    // 4) Registro de ponto
    // ---------------------------------------------------------------
    if (action === 'punch') {
      const profileId = String(body?.profileId || '');
      const recordType = String(body?.recordType || '') as RecordType;

      if (!profileId || !RECORD_ORDER.includes(recordType)) {
        return json({ success: false, error: 'Dados do registro inválidos.' }, 400);
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, company_id, is_active')
        .eq('id', profileId)
        .maybeSingle();

      if (!profile || !profile.is_active || profile.company_id !== terminal.company_id) {
        return json({ success: false, error: 'Funcionário inválido para este terminal.' }, 403);
      }

      const recordedAt = new Date();
      const transactionHash = await sha256(
        [profile.id, recordType, recordedAt.toISOString(), body?.latitude ?? '', body?.longitude ?? ''].join('|')
      );

      const { data: record, error } = await supabase
        .from('time_records')
        .insert({
          profile_id: profile.id,
          company_id: terminal.company_id,
          record_type: recordType,
          recorded_at: recordedAt.toISOString(),
          latitude: body?.latitude ?? null,
          longitude: body?.longitude ?? null,
          address: body?.address ?? null,
          device_info: `Terminal CNPJ | ${terminal.name} | ${String(body?.userAgent || '').slice(0, 300)}`,
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
