'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isValidCpf, isValidPis } from '@superponto/br-docs';
import { useEffect, useState } from 'react';
import { api, type AddressLookup, type Company, type EmployeeDetail, type Page } from '@/lib/api';
import { digits, maskCep, maskCpf, maskPhone, maskPis } from '@/lib/masks';
import { CONTRACT_TYPES, useStructureOptions } from '@/lib/options';
import { Button, Input, useToast } from './ui';

type F = Record<string, string>;
const from = (e: EmployeeDetail | null, companyId: string | null): F => ({
  companyId: e?.company.id ?? companyId ?? '', fullName: e?.fullName ?? '', socialName: e?.socialName ?? '',
  cpf: e?.cpf && e.sensitiveVisible ? maskCpf(e.cpf) : '', pis: e?.pis && e.sensitiveVisible ? maskPis(e.pis) : '',
  birthDate: e?.birthDate ?? '', email: e?.email ?? '', phone: e?.phone ? maskPhone(e.phone) : '',
  zipCode: e?.address?.zipCode ? maskCep(e.address.zipCode) : '', street: e?.address?.street ?? '', number: e?.address?.number ?? '',
  complement: e?.address?.complement ?? '', district: e?.address?.district ?? '', city: e?.address?.city ?? '', state: e?.address?.state ?? '', ibge: e?.address?.ibge ?? '',
  registration: e?.registration ?? '', hiredAt: e?.hiredAt ?? '', contractType: e?.contractType ?? 'CLT', weeklyHours: e?.weeklyHours ? String(e.weeklyHours) : '',
  departmentId: e?.department?.id ?? '', sectorId: e?.sector?.id ?? '', positionId: e?.position?.id ?? '', functionId: e?.function?.id ?? '',
  costCenterId: e?.costCenter?.id ?? '', employeeTypeId: e?.employeeType?.id ?? '', unionId: e?.union?.id ?? '',
  effectiveAt: new Date().toISOString().slice(0, 10), reason: '',
});

function Select({ label, value, onChange, options, empty = '—' }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]>; empty?: string | null }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-subtle">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-2xl border border-line bg-hover px-4 text-sm outline-none focus:border-brand [&>option]:bg-elevated">
        {empty !== null && <option value="">{empty}</option>}
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="space-y-4"><legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">{title}</legend>{children}</fieldset>
);

/** Cadastro/edição de funcionário: pessoa, endereço (pelo CEP) e vínculo com a estrutura. */
export function EmployeeForm({ tenantId, employee, defaultCompanyId, onDone }: { tenantId: string; employee: EmployeeDetail | null; defaultCompanyId: string | null; onDone: (id: string) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState<F>(() => from(employee, defaultCompanyId));
  const [errors, setErrors] = useState<F>({});
  const set = (k: string, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); };
  const companies = useQuery({ queryKey: ['companies', tenantId, 'all'], queryFn: () => api<Page<Company>>('/companies?pageSize=200'), enabled: !employee });
  const opt = useStructureOptions(tenantId, f.companyId || null);
  const sectors = opt.departments.find((d) => d.id === f.departmentId)?.sectors ?? [];
  const editing = !!employee;
  const canSeeDocs = !employee || employee.sensitiveVisible;

  // CEP → endereço
  useEffect(() => {
    const cep = digits(f.zipCode);
    if (cep.length !== 8 || cep === digits(employee?.address?.zipCode ?? '')) return;
    api<AddressLookup>(`/lookup/cep/${cep}`).then((a) => setF((p) => ({ ...p, street: a.street || p.street, district: a.district || p.district, city: a.city, state: a.uf, ibge: a.ibge ?? '' }))).catch(() => undefined);
  }, [f.zipCode, employee?.address?.zipCode]);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => (editing ? api<{ id: string }>(`/employees/${employee!.id}`, { method: 'PATCH', json: body }) : api<{ id: string }>('/employees', { method: 'POST', json: body })),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['employees'] }); qc.invalidateQueries({ queryKey: ['employee'] }); toast('success', editing ? 'Funcionário atualizado' : 'Funcionário cadastrado'); onDone(r.id); },
    onError: (e: Error) => toast('error', e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: F = {};
    if (f.fullName.trim().length < 3) errs.fullName = 'Informe o nome completo';
    if (canSeeDocs) {
      if (f.cpf && !isValidCpf(f.cpf)) errs.cpf = 'CPF inválido';
      if (f.pis && !isValidPis(f.pis)) errs.pis = 'PIS inválido';
      if (!editing && !f.cpf && !f.pis) errs.cpf = 'Informe o CPF ou o PIS';
    }
    if (!f.registration.trim()) errs.registration = 'Informe a matrícula';
    if (!editing && !f.hiredAt) errs.hiredAt = 'Informe a admissão';
    if (!editing && !f.companyId) errs.companyId = 'Escolha a empresa';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const val = (k: string) => (f[k]?.trim() ? f[k]!.trim() : editing ? null : undefined);
    const address = f.zipCode || f.street || f.city ? Object.fromEntries(Object.entries({ zipCode: digits(f.zipCode), street: f.street, number: f.number, complement: f.complement, district: f.district, city: f.city, state: f.state, ibge: f.ibge }).filter(([, v]) => v)) : editing ? null : undefined;
    const body: Record<string, unknown> = {
      fullName: f.fullName.trim(), socialName: val('socialName'), birthDate: val('birthDate'), email: val('email'), phone: f.phone ? digits(f.phone) : editing ? null : undefined, address,
      registration: f.registration.trim(), contractType: f.contractType, weeklyHours: f.weeklyHours ? Number(f.weeklyHours.replace(',', '.')) : editing ? null : undefined,
      departmentId: val('departmentId'), sectorId: val('sectorId'), positionId: val('positionId'), functionId: val('functionId'), costCenterId: val('costCenterId'), employeeTypeId: val('employeeTypeId'), unionId: val('unionId'),
    };
    if (canSeeDocs) { body.cpf = f.cpf ? digits(f.cpf) : editing ? null : undefined; body.pis = f.pis ? digits(f.pis) : editing ? null : undefined; }
    if (editing) { body.effectiveAt = f.effectiveAt; if (f.reason.trim()) body.reason = f.reason.trim(); }
    else { body.companyId = f.companyId; body.hiredAt = f.hiredAt; }
    save.mutate(Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)));
  }

  const opts = (rows: Array<{ id: string; name: string }>) => rows.map((r) => [r.id, r.name] as [string, string]);

  return (
    <form onSubmit={submit} className="space-y-7" noValidate>
      <Section title="Pessoa">
        <Input label="Nome completo" value={f.fullName} onChange={(e) => set('fullName', e.target.value)} error={errors.fullName} autoFocus={!editing} />
        <Input label="Nome social" value={f.socialName} onChange={(e) => set('socialName', e.target.value)} hint="Usado nas telas e relatórios quando preenchido" />
        {canSeeDocs ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="CPF" value={f.cpf} onChange={(e) => set('cpf', maskCpf(e.target.value))} error={errors.cpf} inputMode="numeric" placeholder="000.000.000-00" className="font-mono" hint="Relógios da Portaria 671 usam o CPF" />
            <Input label="PIS/PASEP" value={f.pis} onChange={(e) => set('pis', maskPis(e.target.value))} error={errors.pis} inputMode="numeric" placeholder="000.00000.00-0" className="font-mono" hint="Relógios da Portaria 1.510 usam o PIS" />
          </div>
        ) : (
          <p className="rounded-xl bg-hover px-3 py-2 text-xs text-muted">CPF {employee?.cpf ?? '—'} · PIS {employee?.pis ?? '—'} (você não tem permissão para ver ou alterar dados sensíveis)</p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Nascimento" type="date" value={f.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
          <Input label="Telefone" value={f.phone} onChange={(e) => set('phone', maskPhone(e.target.value))} inputMode="tel" />
          <Input label="E-mail" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
        </div>
      </Section>

      <Section title="Endereço">
        <div className="grid grid-cols-[1fr_110px] gap-4">
          <Input label="CEP" value={f.zipCode} onChange={(e) => set('zipCode', maskCep(e.target.value))} inputMode="numeric" placeholder="00000-000" hint="O endereço é preenchido pelo CEP" />
          <Input label="Número" value={f.number} onChange={(e) => set('number', e.target.value)} />
        </div>
        <Input label="Logradouro" value={f.street} onChange={(e) => set('street', e.target.value)} />
        <div className="grid grid-cols-[1fr_1fr_80px] gap-4">
          <Input label="Bairro" value={f.district} onChange={(e) => set('district', e.target.value)} />
          <Input label="Cidade" value={f.city} onChange={(e) => set('city', e.target.value)} />
          <Input label="UF" value={f.state} onChange={(e) => set('state', e.target.value.toUpperCase().slice(0, 2))} />
        </div>
      </Section>

      <Section title="Vínculo">
        {!editing && (
          <Select label="Empresa" value={f.companyId} onChange={(v) => setF((p) => ({ ...p, companyId: v, departmentId: '', sectorId: '', positionId: '' }))} options={(companies.data?.data ?? []).map((c) => [c.id, c.tradeName ?? c.legalName])} empty={null} />
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Matrícula" value={f.registration} onChange={(e) => set('registration', e.target.value)} error={errors.registration} className="font-mono" />
          <Input label="Admissão" type="date" value={f.hiredAt} onChange={(e) => set('hiredAt', e.target.value)} error={errors.hiredAt} disabled={editing} />
          <Input label="Carga semanal (h)" value={f.weeklyHours} onChange={(e) => set('weeklyHours', e.target.value.replace(/[^\d,.]/g, ''))} inputMode="decimal" placeholder="44" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Tipo de contrato" value={f.contractType} onChange={(v) => set('contractType', v)} options={CONTRACT_TYPES} empty={null} />
          <Select label="Tipo de funcionário" value={f.employeeTypeId} onChange={(v) => set('employeeTypeId', v)} options={opts(opt.types)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Departamento" value={f.departmentId} onChange={(v) => setF((p) => ({ ...p, departmentId: v, sectorId: '' }))} options={opt.departments.map((d) => [d.id, `${'  '.repeat(d.depth)}${d.name}`])} />
          <Select label="Seção" value={f.sectorId} onChange={(v) => set('sectorId', v)} options={opts(sectors)} empty={sectors.length ? '—' : 'Sem seções'} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Cargo" value={f.positionId} onChange={(v) => set('positionId', v)} options={opts(opt.positions)} />
          <Select label="Função" value={f.functionId} onChange={(v) => set('functionId', v)} options={opts(opt.functions)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Centro de custo" value={f.costCenterId} onChange={(v) => set('costCenterId', v)} options={opts(opt.costCenters)} />
          <Select label="Sindicato" value={f.unionId} onChange={(v) => set('unionId', v)} options={opt.unions.map((u) => [u.id, `${u.acronym} — ${u.name}`])} />
        </div>
      </Section>

      {editing && (
        <Section title="Vigência da alteração">
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <Input label="Vale a partir de" type="date" value={f.effectiveAt} onChange={(e) => set('effectiveAt', e.target.value)} />
            <Input label="Motivo" value={f.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Ex.: promoção, remanejamento" hint="Vai para o histórico do vínculo" />
          </div>
        </Section>
      )}

      <div className="sticky bottom-0 -mx-6 -mb-6 border-t border-line bg-[var(--surface-strong)] px-6 py-4 backdrop-blur">
        <Button type="submit" loading={save.isPending} className="h-12 w-full">{editing ? 'Salvar alterações' : 'Cadastrar funcionário'}</Button>
      </div>
    </form>
  );
}
