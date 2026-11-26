// Política de aprovação: quantas aprovações (de pessoas diferentes) cada tipo de solicitação precisa.
import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MODULES = [
  { key: 'adjustments', label: 'Ajustes de ponto', help: 'Inclusão ou correção de marcações pedidas pelo funcionário.' },
  { key: 'schedule_swaps', label: 'Troca de escala e folga', help: 'Troca de dia com colega ou mudança de folga.' },
];
const db = supabase as any;

export default function ApprovalPolicies() {
  const { profile } = useAuth();
  const [levels, setLevels] = useState<Record<string, number>>({ adjustments: 1, schedule_swaps: 1 });

  useEffect(() => {
    db.from('approval_policies').select('module, levels').then(({ data }: any) => {
      const m: Record<string, number> = { adjustments: 1, schedule_swaps: 1 };
      for (const r of data ?? []) m[r.module] = r.levels;
      setLevels(m);
    });
  }, []);

  const save = async () => {
    const { error } = await db.from('approval_policies').upsert(MODULES.map((m) => ({ company_id: profile?.company_id, module: m.key, levels: levels[m.key] })), { onConflict: 'company_id,module' });
    if (error) return toast.error(error.message);
    toast.success('Política de aprovação salva');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Política de aprovação" description="Defina quantos níveis de aprovação cada solicitação precisa. Cada nível é aprovado por uma pessoa diferente." icon={ShieldCheck} />
      <Card className="rounded-3xl">
        <CardContent className="grid gap-6 p-6">
          {MODULES.map((m) => (
            <div key={m.key} className="flex flex-wrap items-center justify-between gap-4">
              <div><Label className="text-base">{m.label}</Label><p className="text-sm text-muted-foreground">{m.help}</p></div>
              <Select value={String(levels[m.key])} onValueChange={(v) => setLevels({ ...levels, [m.key]: Number(v) })}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n === 1 ? '1 nível (direto)' : `${n} níveis`}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ))}
          <Button onClick={save} className="w-fit rounded-full">Salvar</Button>
        </CardContent>
      </Card>
    </div>
  );
}
