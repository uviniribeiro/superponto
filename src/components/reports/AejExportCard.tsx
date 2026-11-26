import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loadPeriod } from '@/lib/attendancePeriod';
import { buildAej } from '@/lib/aej';

/** AEJ (Arquivo Eletrônico de Jornada, Portaria 671/2021) do período, a partir da apuração. */
export function AejExportCard({ startDate, endDate, company }: { startDate: string; endDate: string; company: { company_name?: string; cnpj?: string | null; cei?: string | null } | null }) {
  const [repP, setRepP] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const { days } = await loadPeriod(startDate, endDate);
      const { content, warnings } = buildAej({ company: { name: company?.company_name ?? 'EMPRESA', cnpj: company?.cnpj, cei: company?.cei }, from: startDate, to: endDate, days, repP: repP.replace(/\D/g, '') || undefined });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
      a.download = `AEJ_${startDate}_${endDate}.txt`;
      a.click();
      warnings.slice(0, 5).forEach((w) => toast.warning(w));
      toast.success('AEJ gerado');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="rounded-3xl">
      <CardHeader><CardTitle className="text-base">AEJ — Arquivo Eletrônico de Jornada</CardTitle><CardDescription>Leiaute da Portaria 671/2021: vínculos, marcações, matrículas e ausências do período.</CardDescription></CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2"><Label>Número do REP-P (INPI, 17 dígitos)</Label><Input value={repP} onChange={(e) => setRepP(e.target.value)} placeholder="opcional" className="w-64" /></div>
        <Button onClick={run} disabled={busy} className="rounded-full">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}Gerar AEJ</Button>
      </CardContent>
    </Card>
  );
}
