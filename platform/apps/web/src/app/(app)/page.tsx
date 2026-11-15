'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, BookOpen, Boxes, Building2, CalendarDays, Clock3, FileSpreadsheet, KeyRound, Plus, ShieldCheck, Users, UsersRound, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Card, EmptyState, RollingNumber, Skeleton, Sparkline } from '@/components/ui';
import { api, type Page as Paged, type Tenant } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Summary {
  today: string;
  employees?: { active: number; total: number; complete: number; months: string[]; hires: number[]; terminations: number[] };
  structure?: { companies: number; departments: number | null; positions: number | null; groupings: number | null };
  access?: { users: number; activeBlocks: number };
  holidays?: Array<{ date: string; name: string; scope: string }>;
}

const EASE = [0.2, 0.8, 0.2, 1] as const;
const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const SCOPE: Record<string, string> = { NATIONAL: 'Nacional', STATE: 'Estadual', MUNICIPAL: 'Municipal', COMPANY: 'Empresa' };
const civil = (s: string) => new Date(`${s}T12:00:00Z`);

/** Saudação e data calculadas no navegador (fuso e relógio do usuário). */
function useToday() {
  const [today, setToday] = useState<{ greeting: string; date: string } | null>(null);
  useEffect(() => {
    const now = new Date();
    const h = now.getHours();
    setToday({
      greeting: h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite',
      date: now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }),
    });
  }, []);
  return today;
}

/** Anel de progresso no cartão amarelo, com pontos orbitando (decorativo). */
function Ring({ percent }: { percent: number }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-40 shrink-0 place-items-center sm:size-44">
      <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 28, repeat: Infinity, ease: 'linear' }} aria-hidden>
        {[0, 72, 144, 216, 288].map((deg, i) => (
          <span key={deg} className="absolute left-1/2 top-1/2 -ml-1.5 -mt-1.5 size-3" style={{ transform: `rotate(${deg}deg) translateY(-78px)` }}>
            <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.6 + i * 0.08, type: 'spring', stiffness: 300, damping: 18 }}
              className="block size-3 rounded-full border-2 border-[rgb(18_18_18/0.5)] bg-white/80 shadow" />
          </span>
        ))}
      </motion.div>
      <svg viewBox="0 0 120 120" className="size-32 -rotate-90 sm:size-36">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgb(18 18 18 / 0.12)" strokeWidth="10" />
        <motion.circle cx="60" cy="60" r={r} fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - percent / 100) }} transition={{ duration: 1.4, ease: EASE, delay: 0.35 }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-semibold tracking-tight"><RollingNumber value={percent} format={(n) => `${n}%`} /></div>
        <div className="text-[11px] font-medium opacity-70">completos</div>
      </div>
    </div>
  );
}

function Hero({ s }: { s: Summary }) {
  const e = s.employees!;
  const pct = e.active ? Math.round((e.complete / e.active) * 100) : 0;
  return (
    <motion.section initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.6, ease: EASE }}
      className="hero-brand flex flex-col gap-6 overflow-hidden rounded-[28px] p-6 sm:flex-row sm:items-center sm:p-7">
      <div className="min-w-0 flex-1">
        <span className="inline-flex items-center gap-2 rounded-full bg-black/10 px-3 py-1 text-xs font-semibold">
          <span className="size-1.5 animate-pulse rounded-full bg-[#121212]" />
          {e.active} vínculo(s) ativo(s){s.structure ? ` · ${s.structure.companies} empresa(s)` : ''}
        </span>
        <h2 className="mt-4 max-w-md text-[28px] font-semibold leading-[1.12] tracking-[-0.02em] sm:text-[32px]">
          Cadastros <em className="font-brand not-italic underline decoration-black/25 decoration-[3px] underline-offset-4">prontos</em> para o ponto
        </h2>
        <p className="mt-2 max-w-md text-sm opacity-75">
          {e.active ? `${e.complete} de ${e.active} funcionários ativos têm cargo e departamento definidos.` : 'Cadastre o primeiro funcionário para começar.'}
        </p>
        <div className="mt-5 flex gap-6">
          {[
            [e.active, 'ativos'],
            [s.structure?.departments ?? null, 'departamentos'],
            [s.structure?.positions ?? null, 'cargos'],
          ].filter(([v]) => v !== null).map(([v, l]) => (
            <div key={l as string}>
              <div className="text-2xl font-semibold tracking-tight"><RollingNumber value={v as number} /></div>
              <div className="text-[11px] font-medium opacity-65">{l}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/funcionarios" className="pill-light inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-transform hover:-translate-y-0.5">Ver funcionários <ArrowUpRight className="size-4" /></Link>
          <Link href="/funcionarios/importar" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-black/20 bg-white/15 px-4 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/30"><Plus className="size-4" />Importar planilha</Link>
        </div>
      </div>
      <Ring percent={pct} />
    </motion.section>
  );
}

function CalendarCard({ s }: { s: Summary }) {
  const today = civil(s.today);
  const dow = today.getUTCDay();
  const week = Array.from({ length: 7 }, (_, i) => new Date(today.getTime() + (i - dow) * 86_400_000));
  const weekday = today.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });
  const holidays = s.holidays ?? [];
  return (
    <Card delay={0.08} className="flex flex-col rounded-[28px] p-5">
      <div className="flex items-start gap-3">
        <span className="text-[44px] font-semibold leading-none tracking-tight text-brand">{String(today.getUTCDate()).padStart(2, '0')}</span>
        <div className="flex-1 pt-1">
          <div className="font-semibold capitalize">{weekday}</div>
          <div className="text-xs text-muted">{MONTHS[today.getUTCMonth()]} {today.getUTCFullYear()} · {holidays.length ? `${holidays.length} feriado(s) próximo(s)` : 'sem feriados próximos'}</div>
        </div>
        <Link href="/feriados" className="grid size-9 place-items-center rounded-xl border border-line text-muted transition-colors hover:bg-hover hover:text-fg" aria-label="Feriados"><CalendarDays className="size-4" /></Link>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {week.map((d, i) => {
          const isToday = i === dow;
          return (
            <div key={i} className={cn('relative rounded-xl py-1.5 text-xs', isToday ? 'text-brand-fg' : 'text-muted')}>
              {isToday && <motion.span layoutId="cal-today" className="absolute inset-0 rounded-xl bg-brand shadow-[0_8px_20px_-8px_var(--brand-glow)]" />}
              <span className="relative block text-[10px] opacity-70">{WEEK[i]}</span>
              <span className="relative block font-semibold">{d.getUTCDate()}</span>
            </div>
          );
        })}
      </div>
      <ul className="mt-4 space-y-2">
        {holidays.length ? holidays.map((h, i) => {
          const d = civil(h.date);
          return (
            <motion.li key={h.date} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.07, ease: EASE }}
              className="flex items-center gap-3 rounded-2xl border border-line bg-hover px-3 py-2">
              <span className="w-11 shrink-0 text-xs font-semibold tabular-nums text-muted">{String(d.getUTCDate()).padStart(2, '0')}/{String(d.getUTCMonth() + 1).padStart(2, '0')}</span>
              <span className="h-7 w-[3px] rounded-full bg-brand" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{h.name}</span>
                <span className="block text-[11px] text-subtle">{SCOPE[h.scope] ?? h.scope}</span>
              </span>
            </motion.li>
          );
        }) : <li className="rounded-2xl border border-dashed border-line px-3 py-4 text-center text-xs text-subtle">{s.holidays ? 'Nenhum feriado nos próximos meses.' : 'Cadastre uma empresa para ver os feriados.'}</li>}
      </ul>
    </Card>
  );
}

function Stat({ icon: Icon, label, hint, value, delay, href, series, delta, accent }: {
  icon: LucideIcon; label: string; hint: string; value: number; delay: number; href?: string; series?: number[]; delta?: string | null; accent?: boolean;
}) {
  const body = (
    <motion.div initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.5, delay, ease: EASE }}
      whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 26 } }}
      className={cn('group flex h-full flex-col rounded-[24px] p-4', accent ? 'hero-brand-soft' : 'glass')}>
      <div className="flex items-center justify-between">
        <span className={cn('grid size-8 place-items-center rounded-full', accent ? 'bg-black/10' : 'border border-line bg-hover text-muted')}><Icon className="size-4" /></span>
        {delta && <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', accent ? 'bg-black/10' : 'bg-success/15 text-success')}>{delta}</span>}
      </div>
      <div className="mt-5 text-[34px] font-semibold leading-none tracking-tight"><RollingNumber value={value} /></div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{label}</div>
          <div className={cn('truncate text-[11px]', accent ? 'opacity-70' : 'text-subtle')}>{hint}</div>
        </div>
        {series && series.some(Boolean) && <Sparkline values={series} color={accent ? '#121212' : 'var(--brand)'} className="shrink-0" />}
      </div>
    </motion.div>
  );
  return href ? <Link href={href} className="block h-full">{body}</Link> : body;
}

function QuickAction({ href, icon: Icon, title, hint, delay }: { href: string; icon: LucideIcon; title: string; hint: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, ease: EASE, duration: 0.4 }}>
      <Link href={href} className="glass group flex items-center gap-3 rounded-full py-2 pl-2 pr-4 transition-transform hover:-translate-y-0.5">
        <span className="grid size-8 place-items-center rounded-full bg-hover text-muted transition-colors group-hover:bg-brand group-hover:text-brand-fg"><Icon className="size-4" /></span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold">{title}</span>
          <span className="block truncate text-[11px] text-subtle">{hint}</span>
        </span>
      </Link>
    </motion.div>
  );
}

/** Admissões × desligamentos nos últimos 6 meses (barras que crescem ao aparecer). */
function Movement({ e }: { e: NonNullable<Summary['employees']> }) {
  const max = Math.max(1, ...e.hires, ...e.terminations);
  return (
    <Card delay={0.3} className="rounded-[28px] p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Movimentação</h2>
          <p className="text-sm text-muted">Admissões e desligamentos nos últimos 6 meses</p>
        </div>
        <div className="flex gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand" />Admissões</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-fg/40" />Desligamentos</span>
        </div>
      </div>
      <div className="mt-6 grid h-40 grid-cols-6 items-end gap-3">
        {e.months.map((m, i) => (
          <div key={m} className="flex h-full flex-col items-center justify-end gap-2">
            <div className="flex h-full w-full items-end justify-center gap-1">
              {[[e.hires[i] ?? 0, 'bg-brand'], [e.terminations[i] ?? 0, 'bg-fg/30']].map(([v, color], k) => (
                <motion.div key={k} title={`${v}`} initial={{ height: 0 }} animate={{ height: `${Math.max(3, ((v as number) / max) * 100)}%` }} transition={{ delay: 0.4 + i * 0.06 + k * 0.03, duration: 0.8, ease: EASE }}
                  className={cn('w-3 rounded-full sm:w-4', color as string)} />
              ))}
            </div>
            <span className="text-[11px] text-subtle">{MONTHS[Number(m.slice(5)) - 1]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const today = useToday();
  const firstName = me?.displayName?.split(' ')[0] ?? '';

  const summary = useQuery({ queryKey: ['dashboard', tenantId], queryFn: () => api<Summary>('/dashboard/summary'), enabled: !!tenantId });
  const tenants = useQuery({ queryKey: ['tenants', 'count'], queryFn: () => api<Paged<Tenant>>('/platform/tenants?pageSize=1'), enabled: isPlatform });
  const s = summary.data;
  const e = s?.employees;
  const thisMonthHires = e?.hires.at(-1) ?? 0;

  const actions = [
    can(me, 'people.employments:import') && { href: '/funcionarios/importar', icon: FileSpreadsheet, title: 'Importar planilha', hint: 'CSV com conferência' },
    can(me, 'people.employments:read') && { href: '/funcionarios', icon: UsersRound, title: 'Funcionários', hint: 'Vínculos e histórico' },
    can(me, 'org.holidays:read') && { href: '/feriados', icon: CalendarDays, title: 'Feriados', hint: 'Gerados todo 1º de janeiro' },
    can(me, 'org.groupings:read') && { href: '/estrutura/agrupamentos', icon: Boxes, title: 'Agrupamentos', hint: 'Filtros por grupo' },
    can(me, 'admin.users:read') && { href: '/usuarios', icon: Users, title: 'Usuários', hint: 'Acessos e perfis' },
    { href: '/manual', icon: BookOpen, title: 'Manual', hint: 'Como usar cada tela' },
  ].filter(Boolean) as Array<{ href: string; icon: LucideIcon; title: string; hint: string }>;

  return (
    <Page>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
          <h1 className="text-3xl font-semibold tracking-[-0.025em] md:text-[38px]">
            {today?.greeting ?? 'Olá'}{firstName && <>, {firstName}</>}
          </h1>
          <p className="mt-1 text-sm text-muted first-letter:uppercase">
            {today?.date ?? ' '}{e ? ` · ${e.active} funcionário(s) ativo(s)` : ''}
          </p>
        </motion.div>
        <div className="flex flex-wrap items-center gap-2">
          {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
          {can(me, 'people.employments:read') && tenantId && (
            <Link href="/funcionarios" className="pill-dark inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-transform hover:-translate-y-0.5"><Plus className="size-4" />Novo funcionário</Link>
          )}
        </div>
      </div>

      {!tenantId ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {isPlatform && tenants.data && <Stat icon={ShieldCheck} label="Clientes" hint="Organizações na plataforma" value={tenants.data.total} delay={0} href="/plataforma/clientes" accent />}
          <Stat icon={KeyRound} label="Permissões" hint="Liberadas para o seu perfil" value={me?.permissions.length ?? 0} delay={0.06} />
          <Card delay={0.1} className="rounded-[24px] sm:col-span-2"><EmptyState icon={Building2} title="Escolha uma organização" body="Selecione o cliente no topo para ver o painel dele." /></Card>
        </div>
      ) : !s ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]"><Skeleton className="h-72 rounded-[28px]" /><Skeleton className="h-72 rounded-[28px]" /></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-[24px]" />)}</div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={cn('grid gap-4', e ? 'lg:grid-cols-[1.7fr_1fr]' : '')}>
            {e && <Hero s={s} />}
            <CalendarCard s={s} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {e && <Stat icon={UsersRound} label="Funcionários ativos" hint={`${e.total} vínculo(s) no total`} value={e.active} delay={0.12} href="/funcionarios" series={e.hires} delta={thisMonthHires ? `+${thisMonthHires} no mês` : null} />}
            {s.structure && <Stat icon={Building2} label="Empresas" hint={s.structure.departments !== null ? `${s.structure.departments} departamento(s)` : 'Cadastradas'} value={s.structure.companies} delay={0.17} href="/empresas" />}
            {s.access && <Stat icon={Users} label="Usuários ativos" hint={s.access.activeBlocks ? `${s.access.activeBlocks} bloqueio(s) em vigor` : 'Nenhum bloqueio em vigor'} value={s.access.users} delay={0.22} href="/usuarios" accent />}
            <Stat icon={KeyRound} label="Permissões" hint="Liberadas para o seu perfil" value={me?.permissions.length ?? 0} delay={0.27} href="/minha-conta" />
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {actions.map((a, i) => <QuickAction key={a.href} {...a} delay={0.3 + i * 0.04} />)}
          </div>

          <div className={cn('grid gap-4', e ? 'lg:grid-cols-[1.5fr_1fr]' : '')}>
            {e && <Movement e={e} />}
            <Card delay={0.35} className="rounded-[28px] p-6">
              <h2 className="text-lg font-semibold">Marcações de hoje</h2>
              <p className="text-sm text-muted">Entradas e saídas dos relógios e do app.</p>
              <EmptyState icon={Clock3} title="Veja quem já marcou" body="O espelho diário mostra presentes, atrasados, faltas e quem ainda não marcou hoje." action={<Link href="/ponto/diario" className="pill-light inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold">Abrir espelho diário <ArrowUpRight className="size-4" /></Link>} />
            </Card>
          </div>
        </div>
      )}
    </Page>
  );
}
