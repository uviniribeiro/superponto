'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Network, PlugZap, TriangleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, EmptyState, Input, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

interface LdapConfig {
  configured: boolean; enabled?: boolean; url?: string; startTls?: boolean; allowInsecureTls?: boolean; bindDn?: string | null; hasBindPassword?: boolean;
  baseDn?: string; userFilter?: string; timeoutMs?: number; updatedAt?: string;
}
interface TestResult { ok: boolean; dn?: string; reason?: string; message: string }

const PRESETS: Array<[string, string, string]> = [
  ['Active Directory (e-mail)', '(&(objectClass=user)(mail={email}))', 'Busca a conta do AD pelo e-mail'],
  ['Active Directory (login)', '(&(objectClass=user)(sAMAccountName={login}))', 'Usa a parte antes do @ como login de rede'],
  ['OpenLDAP', '(mail={email})', 'Busca pelo atributo mail'],
];

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3 text-sm">
      <span><span className="block">{label}</span>{hint && <span className="block text-xs text-subtle">{hint}</span>}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 shrink-0 accent-[var(--brand)]" />
    </label>
  );
}

function ConfigForm({ cfg }: { cfg: LdapConfig }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({
    enabled: cfg.enabled ?? false, url: cfg.url ?? 'ldaps://', startTls: cfg.startTls ?? false, allowInsecureTls: cfg.allowInsecureTls ?? false,
    bindDn: cfg.bindDn ?? '', bindPassword: '', baseDn: cfg.baseDn ?? '', userFilter: cfg.userFilter ?? '(mail={email})', timeoutMs: String(cfg.timeoutMs ?? 5000),
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const save = useMutation({
    mutationFn: () => api<LdapConfig>('/ldap-config', { method: 'PUT', json: {
      enabled: f.enabled, url: f.url.trim(), startTls: f.startTls, allowInsecureTls: f.allowInsecureTls, bindDn: f.bindDn.trim() || null,
      ...(f.bindPassword ? { bindPassword: f.bindPassword } : {}), baseDn: f.baseDn.trim(), userFilter: f.userFilter.trim(), timeoutMs: Number(f.timeoutMs) || 5000,
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ldap-config'] }); setF((p) => ({ ...p, bindPassword: '' })); toast('success', 'Configuração salva'); },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
      <Toggle label="Login pela rede ativado" hint="Usuários marcados como LDAP entram com a senha da rede" checked={f.enabled} onChange={(v) => set('enabled', v)} />
      <Input label="Servidor" value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="ldaps://ad.empresa.com.br:636" className="font-mono" hint="ldaps:// (porta 636) protege a senha no caminho; ldap:// só com STARTTLS" required />
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle label="STARTTLS" hint="Cifra uma conexão ldap://" checked={f.startTls} onChange={(v) => set('startTls', v)} />
        <Toggle label="Aceitar certificado próprio" hint="Só para servidor interno sem certificado público" checked={f.allowInsecureTls} onChange={(v) => set('allowInsecureTls', v)} />
      </div>
      <Input label="Base de busca (Base DN)" value={f.baseDn} onChange={(e) => set('baseDn', e.target.value)} placeholder="OU=Usuarios,DC=empresa,DC=com,DC=br" className="font-mono" required />
      <div className="space-y-1.5">
        <Input label="Filtro do usuário" value={f.userFilter} onChange={(e) => set('userFilter', e.target.value)} className="font-mono" hint="{email} = e-mail digitado no login; {login} = parte antes do @" required />
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(([l, v, h]) => <button key={l} type="button" title={h} onClick={() => set('userFilter', v)} className={cn('rounded-full border px-2.5 py-1 text-xs', f.userFilter === v ? 'border-brand/50 bg-brand-soft' : 'border-line text-muted hover:text-fg')}>{l}</button>)}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Conta de serviço (Bind DN)" value={f.bindDn} onChange={(e) => set('bindDn', e.target.value)} placeholder="CN=superponto,OU=Servicos,DC=empresa,DC=com,DC=br" className="font-mono" hint="Só leitura no diretório; vazio = busca anônima" />
        <Input label="Senha da conta de serviço" type="password" value={f.bindPassword} onChange={(e) => set('bindPassword', e.target.value)} autoComplete="new-password" placeholder={cfg.hasBindPassword ? '•••••••• (guardada)' : ''} hint={cfg.hasBindPassword ? 'Guardada cifrada; deixe vazio para manter' : 'Guardada cifrada; nunca é exibida'} />
      </div>
      <Input label="Tempo limite (ms)" value={f.timeoutMs} onChange={(e) => set('timeoutMs', e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="font-mono" />
      <Button type="submit" loading={save.isPending} className="h-12 w-full">Salvar configuração</Button>
    </form>
  );
}

function Tester() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<TestResult | null>(null);
  const test = useMutation({
    mutationFn: () => api<TestResult>('/ldap-config/test', { method: 'POST', json: { email: email.trim(), ...(password ? { password } : {}) } }),
    onSuccess: (r) => { setResult(r); setPassword(''); },
    onError: (e: Error) => setResult({ ok: false, message: e.message }),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); test.mutate(); }} className="space-y-3">
      <Input label="E-mail de um usuário da rede" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Input label="Senha (opcional)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" hint="Sem senha: só confere se o usuário é encontrado. A senha não é guardada." />
      <Button type="submit" variant="outline" loading={test.isPending} className="w-full"><PlugZap className="size-4" />Testar</Button>
      <AnimatePresence mode="wait">
        {result && (
          <motion.div key={result.message} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn('flex gap-2 rounded-2xl border px-3 py-2.5 text-sm', result.ok ? 'border-success/30 bg-success/10' : 'border-danger/30 bg-danger/10')}>
            {result.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />}
            <span><span className="block">{result.message}</span>{result.dn && <span className="block break-all font-mono text-xs text-muted">{result.dn}</span>}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

export default function LdapPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const allowed = can(me, 'admin.ldap:manage');
  const cfg = useQuery({ queryKey: ['ldap-config', tenantId], queryFn: () => api<LdapConfig>('/ldap-config'), enabled: !!tenantId && allowed });
  const [key, setKey] = useState(0);
  useEffect(() => setKey((k) => k + 1), [cfg.data?.updatedAt, tenantId]);
  return (
    <Page>
      <PageHeader title="Login pela rede" description="Usuários entram com o mesmo e-mail e senha da rede da organização (Active Directory ou OpenLDAP)." actions={isPlatform ? <TenantPicker value={tenantId} onChange={select} /> : undefined} />
      {!allowed ? (
        <Card><EmptyState icon={Network} title="Sem permissão" body="Peça ao administrador a permissão “Login por LDAP/AD”." /></Card>
      ) : !tenantId ? (
        <Card><EmptyState icon={Network} title="Escolha uma organização" body="Selecione acima o cliente que você quer configurar." /></Card>
      ) : !cfg.data ? (
        <Skeleton className="h-96 rounded-[28px]" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card className="rounded-[28px] p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className={cn('size-2.5 rounded-full', cfg.data.enabled ? 'bg-success shadow-[0_0_10px_var(--success)]' : 'bg-fg/30')} />
              <h2 className="text-lg font-semibold">{cfg.data.configured ? (cfg.data.enabled ? 'Ativado' : 'Configurado, desativado') : 'Ainda não configurado'}</h2>
            </div>
            <ConfigForm key={key} cfg={cfg.data} />
          </Card>
          <div className="space-y-4">
            <Card delay={0.05} className="rounded-[28px] p-6">
              <h2 className="text-lg font-semibold">Testar</h2>
              <p className="mb-4 text-sm text-muted">Usa a configuração salva.</p>
              {cfg.data.configured ? <Tester /> : <p className="text-sm text-subtle">Salve a configuração para testar.</p>}
            </Card>
            <Card delay={0.1} className="rounded-[28px] p-6 text-sm text-muted">
              <h2 className="mb-2 text-base font-semibold text-fg">Como funciona</h2>
              <ul className="list-disc space-y-1.5 pl-4">
                <li>Em <strong className="text-fg">Usuários</strong>, marque a forma de login “Rede da organização (LDAP)”.</li>
                <li>A senha é conferida no diretório a cada login; o SuperPonto não guarda a senha desses usuários.</li>
                <li>Perfis, dias de acesso e bloqueios continuam valendo.</li>
                <li>Na nuvem, o servidor precisa ter endereço público com TLS; diretório só na rede interna exige instalação própria.</li>
              </ul>
            </Card>
          </div>
        </div>
      )}
    </Page>
  );
}
