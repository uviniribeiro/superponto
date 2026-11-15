'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, Clock3, KeyRound, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Card, CountUp, EmptyState, Skeleton } from '@/components/ui';
import { api, type Company, type Page as Paged, type Tenant } from '@/lib/api';

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

function Stat({ icon: Icon, label, value, hint, delay, href }: { icon: React.ElementType; label: string; value: number | undefined; hint: string; delay: number; href?: string }) {
  const body = (
    <Card delay={delay} className="group h-full p-5 transition-colors hover:border-brand/40">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-subtle">{label}</span>
        <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand transition-transform group-hover:scale-110"><Icon className="size-4" /></span>
      </div>
      <div className="mt-4 font-display text-4xl font-bold tracking-tight">
        {value === undefined ? <Skeleton className="h-10 w-20" /> : <CountUp value={value} />}
      </div>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </Card>
  );
  return href ? <Link href={href} transitionTypes={['nav-forward']} className="block">{body}</Link> : body;
}

/** Anel de progresso com animação de traço. */
function Ring({ percent }: { percent: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" className="size-36 -rotate-90">
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-hover)" strokeWidth="12" />
      <motion.circle cx="60" cy="60" r={r} fill="none" stroke="var(--brand)" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - percent / 100) }} transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1], delay: 0.3 }} />
    </svg>
  );
}

export default function DashboardPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const canCompanies = can(me, 'org.companies:read');

  const companies = useQuery({
    queryKey: ['companies', tenantId, 'dashboard'],
    queryFn: () => api<Paged<Company>>('/companies?pageSize=200'),
    enabled: canCompanies && !!tenantId,
  });
  const tenants = useQuery({
    queryKey: ['tenants', 'count'],
    queryFn: () => api<Paged<Tenant>>('/platform/tenants?pageSize=1'),
    enabled: isPlatform,
  });

  const list = companies.data?.data ?? [];
  const complete = list.filter((c) => c.cnpj && c.tradeName).length;
  const percent = list.length ? Math.round((complete / list.length) * 100) : 0;
  const firstName = me?.displayName?.split(' ')[0] ?? '';
  const today = useToday();

  return (
    <Page>
      <PageHeader
        title={<>{today?.greeting ?? 'Olá'}{firstName && <>, <span className="text-brand">{firstName}</span></>}</>}
        description={today?.date ?? '\u00a0'}
        actions={isPlatform ? <TenantPicker value={tenantId} onChange={select} /> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isPlatform && <Stat icon={ShieldCheck} label="Clientes" value={tenants.data?.total} hint="Organizações na plataforma" delay={0} href="/plataforma/clientes" />}
        {canCompanies && <Stat icon={Building2} label="Empresas" value={tenantId ? companies.data?.total : 0} hint={tenantId ? 'Cadastradas nesta organização' : 'Escolha uma organização'} delay={0.05} href="/empresas" />}
        <Stat icon={KeyRound} label="Permissões" value={me?.permissions.length} hint="Liberadas para o seu perfil" delay={0.1} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card delay={0.15} className="p-6">
          <h2 className="font-display text-lg font-bold">Marcações de hoje</h2>
          <p className="text-sm text-muted">Entradas e saídas registradas pelos relógios e pelo app.</p>
          <EmptyState icon={Clock3} title="Módulo de ponto em construção" body="Assim que o registro de ponto da V2 for liberado, as marcações do dia aparecem aqui em tempo real." />
        </Card>
        {canCompanies && (
          <Card delay={0.2} className="flex flex-col items-center p-6 text-center">
            <h2 className="self-start font-display text-lg font-bold">Cadastros completos</h2>
            <p className="self-start text-sm text-muted">Empresas com CNPJ e nome fantasia.</p>
            <div className="relative my-4 grid place-items-center">
              <Ring percent={percent} />
              <span className="absolute font-display text-3xl font-bold"><CountUp value={percent} format={(n) => `${Math.round(n)}%`} /></span>
            </div>
            <p className="text-sm text-muted">{list.length ? `${complete} de ${list.length} empresas` : tenantId ? 'Nenhuma empresa cadastrada' : 'Escolha uma organização'}</p>
          </Card>
        )}
      </div>
    </Page>
  );
}
