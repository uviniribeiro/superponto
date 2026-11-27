// Comprovante de registro de ponto (Portaria 671/2021), aberto pelo QR Code mostrado no terminal.
// Dados mínimos, sem login; a chave é o hash da marcação. Pode ser impresso ou salvo em PDF.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Printer, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchReceipt } from '@/lib/terminalBackend';

const TYPE: Record<string, string> = { entry: 'Entrada', break_start: 'Início do intervalo', break_end: 'Fim do intervalo', exit: 'Saída' };
const fmtCnpj = (v: string) => { const d = String(v ?? '').replace(/\D/g, ''); return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : v; };

export default function PunchReceipt() {
  const { version = 'v1', hash = '' } = useParams();
  const [r, setR] = useState<Record<string, any> | null | undefined>(undefined);

  useEffect(() => {
    document.title = 'Comprovante de registro de ponto';
    fetchReceipt(version, hash).then(setR);
  }, [version, hash]);

  if (r === undefined) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!r) return <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">Comprovante não encontrado. Confira o QR Code ou peça ao RH.</div>;

  const at = new Date(r.recordedAt);
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4 print:bg-white">
      <div className="w-full max-w-md space-y-4 rounded-3xl border bg-background p-6 shadow-xl print:shadow-none">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <div>
            <h1 className="text-xl font-bold">Comprovante de registro de ponto</h1>
            <p className="text-sm text-muted-foreground">Portaria MTP nº 671/2021</p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Empregador</dt><dd className="col-span-2 font-medium">{r.company}</dd>
          <dt className="text-muted-foreground">CNPJ</dt><dd className="col-span-2 tabular-nums">{fmtCnpj(r.cnpj)}</dd>
          {r.address && <><dt className="text-muted-foreground">Local</dt><dd className="col-span-2">{typeof r.address === 'string' ? r.address : ''}</dd></>}
          <dt className="text-muted-foreground">Trabalhador</dt><dd className="col-span-2 font-medium">{r.employee}</dd>
          {r.cpf && <><dt className="text-muted-foreground">CPF</dt><dd className="col-span-2 tabular-nums">{r.cpf}</dd></>}
          <dt className="text-muted-foreground">Data</dt><dd className="col-span-2 tabular-nums">{at.toLocaleDateString('pt-BR')}</dd>
          <dt className="text-muted-foreground">Hora</dt><dd className="col-span-2 text-2xl font-bold tabular-nums">{at.toLocaleTimeString('pt-BR')}</dd>
          {r.recordType && <><dt className="text-muted-foreground">Tipo</dt><dd className="col-span-2">{TYPE[r.recordType] ?? r.recordType}</dd></>}
          <dt className="text-muted-foreground">NSR</dt><dd className="col-span-2 tabular-nums">{r.nsr ?? '—'}</dd>
          <dt className="text-muted-foreground">Coletor</dt><dd className="col-span-2">{r.collector}</dd>
        </dl>
        <div className="rounded-xl bg-muted/60 p-3">
          <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Código de autenticidade (SHA-256)</p>
          <p className="break-all font-mono text-[11px]">{r.hash}</p>
        </div>
        <Button className="w-full print:hidden" variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir ou salvar em PDF</Button>
      </div>
    </div>
  );
}
