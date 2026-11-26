// Importação de afastamentos em lote: uma linha por afastamento, no mesmo formato de arquivo usado por
// outros sistemas de ponto — "código da justificativa;matrícula ou PIS;data início;data fim[;observação]".
import { useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const db = supabase as any;
const iso = (d: string) => { const m = d.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

export function ImportAbsencesDialog({ companyId, userId, onDone }: { companyId?: string; userId?: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string[]>([]);

  const run = async (dryRun: boolean) => {
    setBusy(true);
    const errors: string[] = [];
    const rows: Record<string, unknown>[] = [];
    try {
      const [{ data: people }, { data: just }] = await Promise.all([
        db.from('profiles').select('id, registration_number, pis').eq('company_id', companyId),
        db.from('justifications').select('code, description').eq('company_id', companyId),
      ]);
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      lines.forEach((line, i) => {
        const [code, ref, start, end, note] = line.split(';').map((c) => (c ?? '').trim());
        const s = iso(start ?? ''), e = iso(end ?? '');
        const digits = (ref ?? '').replace(/\D/g, '');
        const person = (people ?? []).find((p: any) => p.registration_number === ref || (digits.length === 11 && String(p.pis ?? '').replace(/\D/g, '') === digits));
        const j = (just ?? []).find((x: any) => x.code === code);
        if (!person) { errors.push(`Linha ${i + 1}: funcionário "${ref}" não encontrado (matrícula ou PIS)`); return; }
        if (!s || !e || e < s) { errors.push(`Linha ${i + 1}: datas inválidas (use dd/mm/aaaa)`); return; }
        const days = Math.round((Date.parse(e) - Date.parse(s)) / 86_400_000) + 1;
        rows.push({
          profile_id: person.id, company_id: companyId, absence_type: 'other', start_date: s, end_date: e, total_days: days,
          reason: j ? `${j.code} - ${j.description}` : (code || null), notes: note || null, status: 'approved', approved_by: userId, approved_at: new Date().toISOString(),
        });
      });
      if (!dryRun && rows.length) {
        const { error } = await db.from('employee_absences').insert(rows);
        if (error) throw error;
        toast.success(`${rows.length} afastamento(s) importado(s)`);
        onDone();
        if (!errors.length) { setOpen(false); setText(''); }
      }
      setReport([`${rows.length} linha(s) válida(s)${dryRun ? ' — nada gravado ainda' : ' gravada(s)'}`, ...errors]);
    } catch (err) {
      toast.error('Falha na importação', { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setReport([]); }}>
      <DialogTrigger asChild><Button variant="outline" className="rounded-full"><Upload className="mr-2 h-4 w-4" />Importar</Button></DialogTrigger>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle>Importar afastamentos</DialogTitle>
          <DialogDescription>Uma linha por afastamento: <code>código da justificativa;matrícula ou PIS;início;fim;observação</code> (datas dd/mm/aaaa). Cole o texto ou abra um arquivo .csv/.txt.</DialogDescription>
        </DialogHeader>
        <input type="file" accept=".csv,.txt" className="text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} />
        <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="ATEST;1404;19/01/2026;20/01/2026;Atestado médico" className="font-mono text-xs" />
        {report.length > 0 && <div className="max-h-40 overflow-auto rounded-2xl bg-muted/50 p-3 text-xs">{report.map((r, i) => <p key={i} className={i ? 'text-destructive' : 'font-medium'}>{r}</p>)}</div>}
        <DialogFooter>
          <Button variant="ghost" disabled={busy || !text.trim()} onClick={() => run(true)}>Conferir</Button>
          <Button disabled={busy || !text.trim()} onClick={() => run(false)}>Importar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
