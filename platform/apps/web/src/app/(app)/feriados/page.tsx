'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Coffee, Info, RotateCcw, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api, type Company, type CompanyHoliday, type HolidayList, type Page as Paged } from '@/lib/api';
import { cn } from '@/lib/cn';

const SCOPE: Record<CompanyHoliday['scope'], { label: string; cls: string }> = {
  NATIONAL: { label: 'Nacional', cls: 'bg-brand-soft text-brand' },
  STATE: { label: 'Estadual', cls: 'bg-sky-500/15 text-sky-400' },
  MUNICIPAL: { label: 'Municipal', cls: 'bg-violet-500/15 text-violet-400' },
  COMPANY: { label: 'Da empresa', cls: 'bg-emerald-500/15 text-emerald-400' },
};
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MOVABLE: Record<string, string> = { CARNIVAL_MONDAY: 'Segunda de Carnaval', CARNIVAL_TUESDAY: 'Terça de Carnaval', ASH_WEDNESDAY: 'Quarta-feira de Cinzas', GOOD_FRIDAY: 'Sexta-feira da Paixão', CORPUS_CHRISTI: 'Corpus Christi' };

const weekday = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');

function RuleForm({ companyId, onDone }: { companyId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [mode, setMode] = useState<'fixed' | 'movable'>('fixed');
  const add = useMutation({
    mutationFn: (body: unknown) => api(`/companies/${companyId}/holiday-rules`, { method: 'POST', json: body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holidays'] }); toast('success', 'Feriado cadastrado: ele se repete todo ano'); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const base = { name: String(f.get('name')).trim(), kind: f.get('kind') };
    if (mode === 'movable') add.mutate({ ...base, movable: f.get('movable') });
    else {
      const [, m, d] = String(f.get('date')).split('-').map(Number);
      add.mutate({ ...base, month: m, day: d });
    }
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input label="Nome" name="name" required minLength={2} placeholder="Ex.: Aniversário da cidade, Padroeira" autoFocus />
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-hover p-1 text-sm">
        {(['fixed', 'movable'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={cn('relative rounded-xl py-2', mode === m ? 'text-brand-fg' : 'text-muted')}>
            {mode === m && <motion.span layoutId="rule-mode" className="absolute inset-0 rounded-xl bg-brand" />}
            <span className="relative">{m === 'fixed' ? 'Data fixa' : 'Data móvel'}</span>
          </button>
        ))}
      </div>
      {mode === 'fixed' ? (
        <Input label="Dia e mês" name="date" type="date" required hint="O ano não importa: a data se repete todo ano" />
      ) : (
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-subtle">Feriado móvel</span>
          <select name="movable" className="h-11 w-full rounded-2xl border border-line bg-hover px-4 text-sm outline-none focus:border-brand [&>option]:bg-elevated">
            {Object.entries(MOVABLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <span className="text-xs text-subtle">Calculado a partir da Páscoa de cada ano</span>
        </label>
      )}
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-subtle">Tipo</span>
        <select name="kind" className="h-11 w-full rounded-2xl border border-line bg-hover px-4 text-sm outline-none focus:border-brand [&>option]:bg-elevated">
          <option value="HOLIDAY">Feriado (folga)</option>
          <option value="OPTIONAL">Ponto facultativo</option>
        </select>
      </label>
      <Button type="submit" loading={add.isPending} className="h-12 w-full">Cadastrar feriado</Button>
    </form>
  );
}

export default function HolidaysPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const qc = useQueryClient();
  const toast = useToast();
  const [year, setYear] = useState<number | null>(null);
  const [companyId, setCompanyId] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const canEdit = can(me, 'org.companies:update');
  useEffect(() => setYear(new Date().getFullYear()), []);

  const companies = useQuery({ queryKey: ['companies', tenantId, 'all'], queryFn: () => api<Paged<Company>>('/companies?pageSize=200'), enabled: !!tenantId });
  useEffect(() => {
    const list = companies.data?.data ?? [];
    if (list.length && !list.some((c) => c.id === companyId)) setCompanyId(list[0]!.id);
  }, [companies.data, companyId]);

  const holidays = useQuery({
    queryKey: ['holidays', companyId, year],
    queryFn: () => api<HolidayList>(`/companies/${companyId}/holidays?year=${year}`),
    enabled: !!companyId && !!year,
    placeholderData: (p) => p,
  });

  const override = useMutation({
    mutationFn: ({ h, workday }: { h: CompanyHoliday; workday: boolean | null }) =>
      workday === null ? api(`/companies/${companyId}/holiday-overrides/${h.date}`, { method: 'DELETE' }) : api(`/companies/${companyId}/holiday-overrides`, { method: 'PUT', json: { date: h.date, workday } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
    onError: (e: Error) => toast('error', e.message),
  });
  const removeRule = useMutation({
    mutationFn: (ruleId: string) => api(`/companies/${companyId}/holiday-rules/${ruleId}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holidays'] }); toast('success', 'Feriado removido'); },
    onError: (e: Error) => toast('error', e.message),
  });

  const data = holidays.data;
  const byMonth = useMemo(() => {
    const m = new Map<number, CompanyHoliday[]>();
    for (const h of data?.holidays ?? []) {
      const k = Number(h.date.slice(5, 7)) - 1;
      m.set(k, [...(m.get(k) ?? []), h]);
    }
    return [...m.entries()];
  }, [data]);
  const offDays = data?.holidays.filter((h) => !h.workday).length ?? 0;
  const weekdaysOff = data?.holidays.filter((h) => !h.workday && ![0, 6].includes(new Date(`${h.date}T12:00:00Z`).getUTCDay())).length ?? 0;
  const company = companies.data?.data.find((c) => c.id === companyId);

  return (
    <Page>
      <PageHeader
        title="Feriados"
        description="Nacionais, estaduais e municipais cadastrados automaticamente pelo endereço de cada empresa; o próximo ano é gerado antes de 1º de janeiro."
        actions={<>
          {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
          {canEdit && companyId && <Button onClick={() => setAdding(true)}><CalendarPlus className="size-4" />Feriado da empresa</Button>}
        </>}
      />

      {!tenantId ? (
        <Card><EmptyState icon={CalendarDays} title="Escolha uma organização" body="Selecione acima o cliente que você quer administrar." /></Card>
      ) : companies.data && !companies.data.data.length ? (
        <Card><EmptyState icon={CalendarDays} title="Cadastre uma empresa" body="Os feriados dependem do endereço (CEP) de cada empresa." action={<Link href="/empresas" className="text-sm text-brand">Ir para Empresas</Link>} /></Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select aria-label="Empresa" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="glass h-10 max-w-xs rounded-2xl px-3 text-sm outline-none [&>option]:bg-elevated">
              {companies.data?.data.map((c) => <option key={c.id} value={c.id}>{c.tradeName ?? c.legalName}{c.city ? ` — ${c.city}/${c.state}` : ''}</option>)}
            </select>
            <div className="glass flex h-10 items-center rounded-2xl">
              <button aria-label="Ano anterior" onClick={() => setYear((y) => (y ?? 0) - 1)} className="grid h-10 w-10 place-items-center text-muted hover:text-fg"><ChevronLeft className="size-4" /></button>
              <span className="min-w-14 text-center font-display font-bold tabular-nums">{year}</span>
              <button aria-label="Próximo ano" onClick={() => setYear((y) => (y ?? 0) + 1)} className="grid h-10 w-10 place-items-center text-muted hover:text-fg"><ChevronRight className="size-4" /></button>
            </div>
            {data && <span className="text-sm text-muted">{offDays} dias de folga · {weekdaysOff} em dias úteis</span>}
          </div>

          {data && !data.location.ibge && (
            <Card className="mb-4 flex items-start gap-3 border-brand/30 p-4 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-brand" />
              <p className="text-muted"><b className="text-fg">{company?.tradeName ?? company?.legalName}</b> não tem CEP cadastrado: só aparecem os feriados nacionais. <Link href="/empresas" className="text-brand">Preencha o CEP da empresa</Link> para incluir os estaduais e municipais.</p>
            </Card>
          )}
          {data && data.location.ibge && !data.location.municipalBase && (
            <Card className="mb-4 flex items-start gap-3 border-brand/30 p-4 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-brand" />
              <p className="text-muted">{data.location.city}/{data.location.state} ainda não está na base de feriados municipais do SuperPonto. Cadastre os feriados da cidade (aniversário, padroeiro, Corpus Christi) em <b className="text-fg">Feriado da empresa</b>: eles se repetem automaticamente todo ano.</p>
            </Card>
          )}

          {holidays.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-40" />)}</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {byMonth.map(([m, list], i) => (
                <Card key={`${year}-${m}`} delay={Math.min(i, 8) * 0.03} className="p-5">
                  <h2 className="mb-3 font-display text-base font-bold">{MONTHS[m]}</h2>
                  <ul className="space-y-2">
                    <AnimatePresence initial={false}>
                      {list.map((h) => (
                        <motion.li key={h.date} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={cn('group rounded-2xl border border-line p-3 transition-colors', h.workday && 'opacity-60')}>
                          <div className="flex items-start gap-3">
                            <div className="grid w-11 shrink-0 place-items-center rounded-xl bg-hover py-1.5 text-center">
                              <span className="font-display text-lg font-bold leading-none">{h.date.slice(8)}</span>
                              <span className="text-[10px] uppercase text-subtle">{weekday(h.date)}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={cn('text-sm font-semibold', h.workday && 'line-through decoration-1')}>{h.name}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className={cn('rounded-full px-2 py-0.5 text-[11px]', SCOPE[h.scope].cls)}>{SCOPE[h.scope].label}</span>
                                {h.kind === 'OPTIONAL' && <span className="rounded-full bg-hover px-2 py-0.5 text-[11px] text-muted">Ponto facultativo</span>}
                                {h.review && <span title="Base inicial do SuperPonto: confira com a lei local" className="rounded-full border border-line px-2 py-0.5 text-[11px] text-subtle">confira</span>}
                                {h.overridden && <span className="rounded-full bg-hover px-2 py-0.5 text-[11px] text-muted">{h.workday ? 'Trabalho definido' : 'Folga definida'} pela empresa</span>}
                              </div>
                              {h.basis && <p className="mt-1 text-[11px] text-subtle">{h.basis}</p>}
                            </div>
                          </div>
                          {canEdit && (
                            <div className="mt-2 flex flex-wrap gap-1 border-t border-line pt-2">
                              {h.workday ? (
                                <button onClick={() => override.mutate({ h, workday: false })} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:bg-hover hover:text-fg"><Coffee className="size-3.5" />Dar folga</button>
                              ) : (
                                <button onClick={() => override.mutate({ h, workday: true })} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:bg-hover hover:text-fg"><Briefcase className="size-3.5" />Trabalhar neste dia</button>
                              )}
                              {h.overridden && <button onClick={() => override.mutate({ h, workday: null })} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:bg-hover hover:text-fg"><RotateCcw className="size-3.5" />Padrão</button>}
                              {h.ruleId && <button onClick={() => removeRule.mutate(h.ruleId!)} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:bg-hover hover:text-danger"><Trash2 className="size-3.5" />Remover</button>}
                            </div>
                          )}
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Feriado da empresa">
        {adding && companyId && <RuleForm companyId={companyId} onDone={() => setAdding(false)} />}
      </Sheet>
    </Page>
  );
}
