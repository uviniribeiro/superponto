'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatCnpj, isValidCnpj, maskCnpjInput, normalizeCnpj } from '@superponto/br-docs';
import { CheckCircle2, LoaderCircle, MapPin, Search, TriangleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, type AddressLookup, type CnpjLookup, type Company } from '@/lib/api';
import { cn } from '@/lib/cn';
import { BR_TIMEZONES, digits, maskCep, maskPhone, UFS } from '@/lib/masks';
import { Button, Input, useToast } from './ui';

export const SEGMENTS: Record<Company['segment'], string> = {
  GENERAL: 'Geral', EDUCATION: 'Educação', HEALTH: 'Saúde', PUBLIC_SECTOR: 'Setor público', INDUSTRY: 'Indústria', RETAIL: 'Varejo', SERVICES: 'Serviços',
};

type Form = {
  cnpj: string; legalName: string; tradeName: string; segment: Company['segment']; timezone: string;
  zipCode: string; street: string; number: string; complement: string; district: string; city: string; state: string; ibgeCode: string;
  phone: string; email: string;
};

const fromCompany = (c: Company | null): Form => ({
  cnpj: c?.cnpj ? maskCnpjInput(c.cnpj) : '', legalName: c?.legalName ?? '', tradeName: c?.tradeName ?? '', segment: c?.segment ?? 'GENERAL', timezone: c?.timezone ?? 'America/Sao_Paulo',
  zipCode: c?.zipCode ? maskCep(c.zipCode) : '', street: c?.street ?? '', number: c?.number ?? '', complement: c?.complement ?? '', district: c?.district ?? '', city: c?.city ?? '', state: c?.state ?? '', ibgeCode: c?.ibgeCode ?? '',
  phone: c?.phone ? maskPhone(c.phone) : '', email: c?.email ?? '',
});

type Status = { kind: 'idle' | 'loading' | 'ok' | 'warn' | 'error'; text?: string };

function StatusLine({ s }: { s: Status }) {
  if (s.kind === 'idle') return null;
  const Icon = s.kind === 'loading' ? LoaderCircle : s.kind === 'ok' ? CheckCircle2 : TriangleAlert;
  return (
    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={cn('flex items-center gap-1.5 text-xs', s.kind === 'ok' ? 'text-success' : s.kind === 'loading' ? 'text-muted' : s.kind === 'warn' ? 'text-brand' : 'text-danger')}>
      <Icon className={cn('size-3.5', s.kind === 'loading' && 'animate-spin')} />{s.text}
    </motion.p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Cadastro de empresa: o CNPJ busca os dados na Receita e o CEP completa o endereço (com o município para os feriados). */
export function CompanyForm({ initial, onSaved }: { initial: Company | null; onSaved: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState<Form>(() => fromCompany(initial));
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [cnpjStatus, setCnpjStatus] = useState<Status>({ kind: 'idle' });
  const [cepStatus, setCepStatus] = useState<Status>({ kind: 'idle' });
  const [filled, setFilled] = useState<Set<keyof Form>>(new Set());
  const numberRef = useRef<HTMLInputElement>(null);
  const autoFilled = useRef<Set<keyof Form>>(new Set());
  const lastCnpj = useRef(initial?.cnpj ?? '');
  const lastCep = useRef(initial?.zipCode ?? '');

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    setFilled((s) => { const n = new Set(s); n.delete(k); return n; });
    autoFilled.current.delete(k);
  };

  function applyAddress(a: AddressLookup, overwrite: boolean) {
    const previous = new Set(autoFilled.current); // campos do endereço anterior, antes de trocar a lista
    setF((p) => {
      const pick = (cur: string, next?: string | null) => (overwrite || !cur ? next ?? cur : cur);
      // Número e complemento preenchidos por um endereço anterior não valem para o novo CEP.
      const stale = (k: 'number' | 'complement', next?: string) => (next ?? (previous.has(k) ? '' : p[k]));
      return {
        ...p, zipCode: maskCep(a.cep), street: pick(p.street, a.street), number: stale('number', a.number), complement: stale('complement', a.complement),
        district: pick(p.district, a.district), city: a.city, state: a.uf, ibgeCode: a.ibge ?? '', timezone: a.timezone ?? p.timezone,
      };
    });
    const keys: Array<keyof Form> = ['street', 'district', 'city', 'state', ...(a.number ? ['number' as const] : []), ...(a.complement ? ['complement' as const] : [])];
    autoFilled.current = new Set(keys);
    setFilled((s) => new Set([...s, ...keys]));
  }

  // CNPJ completo e válido → consulta a Receita uma vez.
  useEffect(() => {
    const v = normalizeCnpj(f.cnpj);
    if (v.length < 14) { setCnpjStatus({ kind: 'idle' }); return; }
    if (!isValidCnpj(v)) { setCnpjStatus({ kind: 'error', text: 'CNPJ inválido: confira os dígitos finais' }); return; }
    if (v === lastCnpj.current) return;
    lastCnpj.current = v;
    setCnpjStatus({ kind: 'loading', text: 'Consultando a Receita Federal…' });
    api<CnpjLookup>(`/lookup/cnpj/${v}`)
      .then((d) => {
        setF((p) => ({
          ...p, legalName: d.legalName, tradeName: d.tradeName ?? p.tradeName,
          phone: d.phone ? maskPhone(d.phone) : p.phone, email: d.email ?? p.email,
        }));
        setFilled((s) => new Set([...s, 'legalName', ...(d.tradeName ? ['tradeName' as const] : []), ...(d.phone ? ['phone' as const] : []), ...(d.email ? ['email' as const] : [])]));
        if (d.address) { applyAddress(d.address, true); lastCep.current = d.address.cep; setCepStatus({ kind: 'ok', text: `${d.address.city}/${d.address.uf}` }); }
        const active = !d.status || d.status.toUpperCase() === 'ATIVA';
        setCnpjStatus(active ? { kind: 'ok', text: `Situação ${d.status ?? 'não informada'} · dados preenchidos pela Receita` } : { kind: 'warn', text: `Atenção: situação cadastral ${d.status}` });
      })
      .catch((e: ApiError) => setCnpjStatus({ kind: e.status === 404 ? 'warn' : 'error', text: e.message }));
  }, [f.cnpj]);

  // CEP completo → busca endereço, município (feriados) e fuso.
  useEffect(() => {
    const v = digits(f.zipCode);
    if (v.length < 8) { if (!v) setCepStatus({ kind: 'idle' }); return; }
    if (v === lastCep.current) return;
    lastCep.current = v;
    setCepStatus({ kind: 'loading', text: 'Buscando endereço…' });
    api<AddressLookup>(`/lookup/cep/${v}`)
      .then((a) => { applyAddress(a, true); setCepStatus({ kind: 'ok', text: `${a.city}/${a.uf}${a.ibge ? ' · feriados municipais desta cidade aplicados' : ''}` }); setTimeout(() => numberRef.current?.focus(), 50); })
      .catch((e: ApiError) => setCepStatus({ kind: e.status === 404 ? 'warn' : 'error', text: e.message }));
  }, [f.zipCode]);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => (initial ? api<Company>(`/companies/${initial.id}`, { method: 'PATCH', json: body }) : api<Company>('/companies', { method: 'POST', json: body })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['holidays'] });
      toast('success', initial ? 'Empresa atualizada' : 'Empresa cadastrada');
      onSaved();
    },
    onError: (e: Error) => toast('error', e.message),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cnpj = normalizeCnpj(f.cnpj);
    const next: typeof errors = {};
    if (f.legalName.trim().length < 2) next.legalName = 'Informe a razão social';
    if (cnpj && !isValidCnpj(cnpj)) next.cnpj = 'CNPJ inválido';
    if (f.zipCode && digits(f.zipCode).length !== 8) next.zipCode = 'CEP deve ter 8 dígitos';
    if (f.phone && ![10, 11].includes(digits(f.phone).length)) next.phone = 'Telefone com DDD: 10 ou 11 dígitos';
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) next.email = 'E-mail inválido';
    setErrors(next);
    if (Object.keys(next).length) return;
    const opt = (v: string) => (v.trim() ? v.trim() : undefined);
    save.mutate({
      legalName: f.legalName.trim(), tradeName: opt(f.tradeName), cnpj: cnpj || undefined, segment: f.segment, timezone: f.timezone,
      zipCode: opt(digits(f.zipCode)), street: opt(f.street), number: opt(f.number), complement: opt(f.complement), district: opt(f.district),
      city: opt(f.city), state: opt(f.state), ibgeCode: opt(f.ibgeCode), phone: opt(digits(f.phone)), email: opt(f.email),
    });
  }

  const auto = (k: keyof Form) => (filled.has(k) ? 'border-success/50 bg-success/5' : undefined);

  return (
    <form onSubmit={onSubmit} className="space-y-7" noValidate>
      <Section title="Identificação">
        <div className="space-y-1.5">
          <Input label="CNPJ" name="cnpj" value={f.cnpj} onChange={(e) => set('cnpj', maskCnpjInput(e.target.value))} error={errors.cnpj} placeholder="00.000.000/0000-00 ou 12.ABC.345/01DE-35" autoComplete="off" spellCheck={false} className="font-mono tracking-wide" autoFocus={!initial} hint={cnpjStatus.kind === 'idle' ? 'Digite o CNPJ: os dados da Receita são preenchidos automaticamente' : undefined} />
          <StatusLine s={cnpjStatus} />
        </div>
        <Input label="Razão social" name="legalName" value={f.legalName} onChange={(e) => set('legalName', e.target.value)} error={errors.legalName} required className={auto('legalName')} />
        <Input label="Nome fantasia" name="tradeName" value={f.tradeName} onChange={(e) => set('tradeName', e.target.value)} className={auto('tradeName')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Telefone" name="phone" value={f.phone} onChange={(e) => set('phone', maskPhone(e.target.value))} error={errors.phone} inputMode="tel" placeholder="(31) 99999-0000" className={auto('phone')} />
          <Input label="E-mail" name="email" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} error={errors.email} className={auto('email')} />
        </div>
      </Section>

      <Section title="Endereço">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Input label="CEP" name="zipCode" value={f.zipCode} onChange={(e) => set('zipCode', maskCep(e.target.value))} error={errors.zipCode} inputMode="numeric" placeholder="00000-000" />
            <StatusLine s={cepStatus} />
          </div>
          <a href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noreferrer" className="flex h-11 items-center gap-1.5 self-start rounded-2xl px-3 text-xs text-muted hover:text-brand sm:mt-6"><Search className="size-3.5" />Não sei o CEP</a>
        </div>
        <Input label="Logradouro" name="street" value={f.street} onChange={(e) => set('street', e.target.value)} className={auto('street')} />
        <div className="grid grid-cols-[110px_1fr] gap-4">
          <Input ref={numberRef} label="Número" name="number" value={f.number} onChange={(e) => set('number', e.target.value)} className={auto('number')} />
          <Input label="Complemento" name="complement" value={f.complement} onChange={(e) => set('complement', e.target.value)} />
        </div>
        <Input label="Bairro" name="district" value={f.district} onChange={(e) => set('district', e.target.value)} className={auto('district')} />
        <div className="grid grid-cols-[1fr_96px] gap-4">
          <Input label="Cidade" name="city" value={f.city} onChange={(e) => { set('city', e.target.value); set('ibgeCode', ''); }} className={auto('city')} />
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-subtle">UF</span>
            <select value={f.state} onChange={(e) => { set('state', e.target.value); set('ibgeCode', ''); }} className={cn('h-11 w-full rounded-2xl border border-line bg-hover px-3 text-sm outline-none focus:border-brand [&>option]:bg-elevated', auto('state'))}>
              <option value="">—</option>
              {UFS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </label>
        </div>
        <AnimatePresence>
          {f.city && !f.ibgeCode && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-start gap-2 rounded-xl bg-brand-soft/60 px-3 py-2 text-xs text-muted">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-brand" />Preencha o CEP para o sistema identificar o município e aplicar os feriados municipais automaticamente.
            </motion.p>
          )}
        </AnimatePresence>
      </Section>

      <Section title="Configuração">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-subtle">Segmento</span>
          <select value={f.segment} onChange={(e) => set('segment', e.target.value as Company['segment'])} className="h-11 w-full rounded-2xl border border-line bg-hover px-4 text-sm outline-none focus:border-brand [&>option]:bg-elevated">
            {Object.entries(SEGMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-subtle">Fuso horário</span>
          <select value={f.timezone} onChange={(e) => set('timezone', e.target.value)} className="h-11 w-full rounded-2xl border border-line bg-hover px-4 text-sm outline-none focus:border-brand [&>option]:bg-elevated">
            {BR_TIMEZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            {!BR_TIMEZONES.some(([v]) => v === f.timezone) && <option value={f.timezone}>{f.timezone}</option>}
          </select>
          <span className="text-xs text-subtle">Definido pelo CEP; usado no cálculo da jornada</span>
        </label>
      </Section>

      <div className="sticky bottom-0 -mx-6 -mb-6 border-t border-line bg-[var(--surface-strong)] px-6 py-4 backdrop-blur">
        <Button type="submit" loading={save.isPending} className="h-12 w-full">{initial ? 'Salvar alterações' : 'Cadastrar empresa'}</Button>
        {initial?.cnpj && <p className="mt-2 text-center text-xs text-subtle">CNPJ atual: {formatCnpj(initial.cnpj)}</p>}
      </div>
    </form>
  );
}
