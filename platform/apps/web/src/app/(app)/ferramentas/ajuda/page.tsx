'use client';

import { BookOpen, Calculator, LifeBuoy, Plus, Scale, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { labelCls } from '@/components/company-actions';
import { Page, PageHeader } from '@/components/page';
import { Button, Card } from '@/components/ui';
import { cn } from '@/lib/cn';

const parse = (v: string) => {
  const m = /^(-)?(\d{1,4}):([0-5]\d)$/.exec(v.trim());
  if (!m) return null;
  return (m[1] ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
};
const fmt = (m: number) => `${m < 0 ? '−' : ''}${Math.floor(Math.abs(m) / 60)}:${String(Math.abs(m) % 60).padStart(2, '0')}`;
const dec = (m: number) => (m / 60).toFixed(2).replace('.', ',');

/** Calculadora de horas: soma/subtrai durações e mede o tempo entre marcações (inclusive virando a meia-noite). */
function HoursCalculator() {
  const [items, setItems] = useState<Array<{ sign: 1 | -1; v: string }>>([{ sign: 1, v: '08:00' }, { sign: 1, v: '01:30' }]);
  const [punches, setPunches] = useState('08:00 12:00 13:00 17:48');
  const total = items.reduce((t, i) => t + i.sign * (parse(i.v) ?? 0), 0);
  const worked = useMemo(() => {
    const ts = punches.split(/[\s,;]+/).filter(Boolean).map(parse);
    if (ts.some((x) => x === null || x < 0 || x >= 1440)) return null;
    let sum = 0;
    for (let i = 0; i + 1 < ts.length; i += 2) { let a = ts[i]!, b = ts[i + 1]!; if (b < a) b += 1440; sum += b - a; }
    return { sum, odd: ts.length % 2 === 1 };
  }, [punches]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3 rounded-[24px]">
        <h3 className="font-semibold">Somar e subtrair horas</h3>
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <button aria-label="Somar ou subtrair" onClick={() => setItems(items.map((x, j) => (j === i ? { ...x, sign: x.sign === 1 ? -1 : 1 } : x)))} className="grid size-10 place-items-center rounded-full border border-line font-mono">{it.sign === 1 ? '+' : '−'}</button>
            <input aria-label={`Horas ${i + 1}`} value={it.v} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} placeholder="hh:mm" className={cn('h-10 flex-1 rounded-2xl border bg-hover px-4 font-mono text-sm outline-none', parse(it.v) === null ? 'border-danger' : 'border-line')} />
            <button aria-label="Remover" onClick={() => setItems(items.filter((_, j) => j !== i))} className="grid size-10 place-items-center rounded-full text-muted hover:bg-hover"><Trash2 className="size-4" /></button>
          </div>
        ))}
        <Button variant="outline" onClick={() => setItems([...items, { sign: 1, v: '00:00' }])}><Plus className="size-4" />Linha</Button>
        <p className="rounded-2xl bg-brand-soft px-4 py-3 text-sm">Total: <b className="font-mono text-lg">{fmt(total)}</b> <span className="text-muted">({dec(total)} em decimal · {total} min)</span></p>
      </Card>
      <Card className="space-y-3 rounded-[24px]">
        <h3 className="font-semibold">Horas trabalhadas a partir das marcações</h3>
        <label className="block space-y-1.5"><span className={labelCls}>Marcações do dia (entrada saída entrada saída…)</span><input aria-label="Marcações" value={punches} onChange={(e) => setPunches(e.target.value)} className="h-10 w-full rounded-2xl border border-line bg-hover px-4 font-mono text-sm outline-none" /></label>
        {worked === null ? <p className="text-sm text-danger">Use horários no formato hh:mm separados por espaço.</p> : (
          <p className="rounded-2xl bg-brand-soft px-4 py-3 text-sm">Trabalhado: <b className="font-mono text-lg">{fmt(worked.sum)}</b> <span className="text-muted">({dec(worked.sum)})</span>{worked.odd && <span className="mt-1 block text-warning">Número ímpar de marcações: a última não foi contada.</span>}</p>
        )}
        <p className="text-xs text-subtle">Saída menor que a entrada conta como virada da meia-noite. A apuração oficial (tolerâncias, intervalos, noturno) é feita pelo espelho de ponto.</p>
      </Card>
    </div>
  );
}

const FAQ: Array<[string, string]> = [
  ['Esqueci de marcar o ponto. E agora?', 'Abra Solicitações e peça a inclusão da marcação com a justificativa. Depois de aprovada, ela aparece no espelho como incluída (I); a marcação original nunca é alterada.'],
  ['Por que o dia aparece como falta se eu trabalhei?', 'Confira se todas as marcações foram registradas (dia com número ímpar aparece como incompleto) e se há jornada atribuída para o dia. Se faltou marcação, peça o ajuste.'],
  ['Como dou ciência do meu espelho?', 'Em Meu espelho, escolha o período já encerrado e clique em "Dar ciência". Você pode concordar ou registrar uma ressalva. Depois de gravada, a ciência não pode ser alterada.'],
  ['O que é o painel ao vivo?', 'Mostra, para quem tem acesso ao espelho, quem está trabalhando, em intervalo, atrasado sem marcação ou ainda vai entrar, atualizando a cada 30 segundos.'],
  ['Como libero meu celular para marcar?', 'Em Meus aparelhos, dê um nome ao aparelho e confirme com o código enviado ao seu e-mail. Você pode revogar quando trocar de celular.'],
];

export default function AjudaPage() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Page>
      <PageHeader title="Central de ajuda" description="Calculadora de horas, perguntas frequentes e atalhos para o manual." />
      <div className="space-y-6">
        <section className="space-y-3"><h2 className="flex items-center gap-2 font-semibold"><Calculator className="size-4" />Calculadora de horas</h2><HoursCalculator /></section>
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-semibold"><LifeBuoy className="size-4" />Perguntas frequentes</h2>
          <Card className="divide-y divide-line rounded-[24px] p-0">
            {FAQ.map(([q, a], i) => (
              <div key={q}>
                <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-medium">{q}<span className="text-subtle">{open === i ? '−' : '+'}</span></button>
                {open === i && <p className="px-5 pb-4 text-sm text-muted">{a}</p>}
              </div>
            ))}
          </Card>
        </section>
        <div className="flex flex-wrap gap-2">
          <Link href="/manual"><Button variant="outline"><BookOpen className="size-4" />Manual completo</Button></Link>
          <Link href="/conformidade"><Button variant="outline"><Scale className="size-4" />Conformidade MTE</Button></Link>
        </div>
      </div>
    </Page>
  );
}
