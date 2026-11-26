// Barra de exportação única dos relatórios: PDF (padrão), demais formatos e envio por e-mail.
import { useState } from 'react';
import { ChevronDown, FileDown, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FORMATS, buildReport, downloadReport, fileName, blobToBase64, periodText, type ReportData, type ReportFormat } from '@/lib/reportExport';

/** `onPdf`: relatório com PDF próprio (ex.: espelho de ponto com assinaturas) usa o dele no lugar do PDF padrão. */
export function ReportExportMenu({ getData, disabled, onPdf }: { getData: () => ReportData | null | Promise<ReportData | null>; disabled?: boolean; onPdf?: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [mail, setMail] = useState(false);
  const [to, setTo] = useState('');
  const [fmt, setFmt] = useState<ReportFormat>('pdf');

  const run = async (f: ReportFormat) => {
    setBusy(true);
    try {
      if (f === 'pdf' && onPdf) { await onPdf(); return; }
      const d = await getData();
      if (!d || !d.rows.length) return toast.error('Gere o relatório antes de exportar');
      await downloadReport(f, d);
    } catch (e) {
      toast.error('Não foi possível exportar', { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const emails = to.split(/[,;\s]+/).filter(Boolean);
    if (!emails.length || emails.some((e) => !/^\S+@\S+\.\S+$/.test(e))) return toast.error('Informe e-mails válidos');
    setBusy(true);
    try {
      const d = await getData();
      if (!d || !d.rows.length) return toast.error('Gere o relatório antes de enviar');
      const blob = await buildReport(fmt, d);
      if (blob.size > 8 * 1024 * 1024) return toast.error('Arquivo grande demais para e-mail (máx. 8 MB). Filtre o período.');
      const { data, error } = await supabase.functions.invoke('send-report', {
        body: { to: emails, title: d.title, period: periodText(d), filename: fileName(d, fmt), mime: blob.type, content: await blobToBase64(blob) },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error ?? error?.message);
      toast.success('Relatório enviado por e-mail');
      setMail(false);
    } catch (e) {
      toast.error('Não foi possível enviar', { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 print:hidden">
      <div className="flex">
        <Button onClick={() => run('pdf')} disabled={disabled || busy} className="rounded-l-full rounded-r-none">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}Exportar PDF
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={disabled || busy} className="rounded-l-none rounded-r-full border-l border-primary-foreground/20 px-2" aria-label="Outros formatos"><ChevronDown className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl">
            <DropdownMenuLabel>Exportar para</DropdownMenuLabel>
            {FORMATS.map((f) => <DropdownMenuItem key={f.key} onClick={() => run(f.key)}>{f.label}</DropdownMenuItem>)}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setMail(true)}><Mail className="mr-2 h-4 w-4" />Enviar por e-mail</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Dialog open={mail} onOpenChange={setMail}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>Enviar relatório por e-mail</DialogTitle><DialogDescription>O arquivo vai anexado no formato escolhido.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Para (separe por vírgula)</Label><Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="rh@empresa.com.br" /></div>
            <div className="grid gap-2"><Label>Formato</Label>
              <Select value={fmt} onValueChange={(v) => setFmt(v as ReportFormat)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FORMATS.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setMail(false)}>Cancelar</Button><Button onClick={send} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
