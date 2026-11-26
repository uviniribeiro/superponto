// Política de aprovação em níveis: quantas aprovações (de pessoas diferentes) uma solicitação precisa.
import { supabase } from '@/integrations/supabase/client';

export type Approval = { by: string; name: string; at: string };

export async function levelsFor(module: 'adjustments' | 'schedule_swaps'): Promise<number> {
  const { data } = await (supabase as any).from('approval_policies').select('levels').eq('module', module).maybeSingle();
  return Math.max(1, Number(data?.levels ?? 1));
}

/**
 * Registra a aprovação de quem está aprovando. Devolve `final: true` quando atingiu o número de níveis
 * (aí a solicitação deve ser aprovada de vez). A mesma pessoa não aprova duas vezes.
 */
export function addApproval(current: unknown, levels: number, approver: { id: string; name: string }): { approvals: Approval[]; final: boolean; error?: string } {
  const list = (Array.isArray(current) ? current : []) as Approval[];
  if (list.some((a) => a.by === approver.id)) return { approvals: list, final: false, error: 'Você já aprovou esta solicitação; ela aguarda o próximo nível.' };
  const approvals = [...list, { by: approver.id, name: approver.name, at: new Date().toISOString() }];
  return { approvals, final: approvals.length >= levels };
}
