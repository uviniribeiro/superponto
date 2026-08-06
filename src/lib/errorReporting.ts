import { supabase } from '@/integrations/supabase/client';

export const GENERIC_USER_MESSAGE = 'Ocorreu um erro. Já registramos o problema e a equipe foi avisada.';

export interface ReportedError {
  /** Mensagem neutra, exibida para qualquer usuário */
  userMessage: string;
  /** Detalhe técnico, exibido apenas para administradores */
  technicalDetail: string;
  /** Id do diagnóstico gravado (quando conseguimos gravar) */
  diagnosticId?: string;
}

function describe(error: unknown): string {
  if (!error) return 'Erro desconhecido.';
  if (typeof error === 'string') return error;
  const e = error as Record<string, unknown>;
  return [e.message, e.details, e.hint, e.code && `código ${e.code}`]
    .filter(Boolean)
    .join(' — ') || JSON.stringify(error);
}

/**
 * Padroniza o tratamento de erros do sistema:
 * o usuário comum vê sempre "ocorreu um erro", o ADM vê o detalhe técnico
 * e o caso fica registrado no painel de diagnóstico.
 */
export async function reportError(params: {
  code: string;
  title: string;
  error: unknown;
  entityTable?: string;
  entityId?: string;
  context?: Record<string, unknown>;
  autoFixable?: boolean;
  fixAction?: string;
  severity?: 'info' | 'warning' | 'error';
}): Promise<ReportedError> {
  const technicalDetail = describe(params.error);

  let diagnosticId: string | undefined;
  try {
    const { data } = await supabase
      .from('system_diagnostics')
      .insert({
        code: params.code,
        severity: params.severity ?? 'error',
        title: params.title,
        user_message: GENERIC_USER_MESSAGE,
        technical_detail: technicalDetail,
        entity_table: params.entityTable ?? null,
        entity_id: params.entityId ?? null,
        context: (params.context ?? {}) as never,
        auto_fixable: params.autoFixable ?? false,
        fix_action: params.fixAction ?? null,
      })
      .select('id')
      .single();
    diagnosticId = data?.id;
  } catch {
    // nunca deixamos o log de erro quebrar a tela do usuário
  }

  return { userMessage: GENERIC_USER_MESSAGE, technicalDetail, diagnosticId };
}
