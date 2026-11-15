'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { labelCls } from '@/components/company-actions';
import { Page, PageHeader } from '@/components/page';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';

interface Text { key: string; label: string; text: string }
const HELP: Record<string, string> = {
  DASHBOARD_MESSAGE: 'Aparece no topo da visão geral para todos os usuários.',
  PUNCH_RECEIPT_FOOTER: 'Impresso no comprovante de cada marcação pelo navegador ou app.',
  MIRROR_FOOTER: 'Rodapé do espelho de ponto ao imprimir.',
  MIRROR_ACK_TERM: 'Texto que o funcionário lê antes de dar ciência do espelho.',
};

export default function TextosPage() {
  const { tenantId, select: pickTenant, isPlatform } = useActiveTenant();
  const toast = useToast();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['custom-texts', tenantId], queryFn: () => api<Text[]>('/custom-texts'), enabled: !!tenantId });
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => { if (list.data) setDraft(Object.fromEntries(list.data.map((t) => [t.key, t.text]))); }, [list.data]);
  const save = useMutation({
    mutationFn: (key: string) => api(`/custom-texts/${key}`, { method: 'PUT', json: { text: draft[key] ?? '' } }),
    onSuccess: () => { toast('success', 'Texto salvo'); qc.invalidateQueries({ queryKey: ['custom-texts'] }); },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <Page>
      <PageHeader title="Textos personalizados" description="Mensagens da sua organização no painel, no comprovante de marcação e no espelho. Deixe em branco para não mostrar." actions={isPlatform ? <TenantPicker value={tenantId} onChange={pickTenant} /> : undefined} />
      {!list.data ? <Skeleton className="h-96 rounded-[28px]" /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.data.map((t) => (
            <Card key={t.key} className="space-y-3 rounded-[24px]">
              <div><span className={labelCls}>{t.label}</span><p className="text-xs text-muted">{HELP[t.key]}</p></div>
              <textarea aria-label={t.label} rows={4} maxLength={2000} value={draft[t.key] ?? ''} onChange={(e) => setDraft({ ...draft, [t.key]: e.target.value })} className="w-full rounded-2xl border border-line bg-hover px-4 py-3 text-sm outline-none focus:border-brand" />
              <div className="flex justify-end"><Button variant="outline" onClick={() => save.mutate(t.key)} loading={save.isPending && save.variables === t.key} disabled={(draft[t.key] ?? '') === t.text}><Save className="size-4" />Salvar</Button></div>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
