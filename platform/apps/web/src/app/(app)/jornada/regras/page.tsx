'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus, Scale, Star, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, Confirm, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { DEFAULT_RULES, hours, useCompanyPick, type RuleSet, type Rules } from '@/lib/schedules';

const num = (v: string) => Number(v.replace(/\D/g, '') || 0);
function N({ label, value, onChange, hint, suffix }: { label: string; value: number; onChange: (n: number) => void; hint?: string; suffix?: string }) {
  return <Input label={suffix ? `${label} (${suffix})` : label} inputMode="numeric" value={String(value)} onChange={(e) => onChange(num(e.target.value))} hint={hint} className="font-mono" />;
}
function T({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3 text-sm">
      <span><span className="block">{label}</span>{hint && <span className="block text-xs text-subtle">{hint}</span>}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 shrink-0 accent-[var(--brand)]" />
    </label>
  );
}

function RuleForm({ companyId, row, onDone }: { companyId: string; row: RuleSet | null; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(row?.name ?? '');
  const [isDefault, setIsDefault] = useState(row?.isDefault ?? false);
  const [r, setR] = useState<Rules>(() => ({ ...DEFAULT_RULES, ...row?.rules, overtimePercent: { ...DEFAULT_RULES.overtimePercent, ...row?.rules.overtimePercent } }));
  const [bands, setBands] = useState(!!row?.rules.overtimeBands?.length);
  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => setR((p) => ({ ...p, [k]: v }));
  const pct = (k: keyof Rules['overtimePercent'], v: number) => setR((p) => ({ ...p, overtimePercent: { ...p.overtimePercent, [k]: v } }));
  const bandList = r.overtimeBands?.length ? r.overtimeBands : [{ upToMinutes: 120, percent: 50 }, { upToMinutes: null, percent: 100 }];
  const save = useMutation({
    mutationFn: () => {
      const rules = { ...r, overtimeBands: bands ? bandList : undefined };
      return row ? api(`/rule-sets/${row.id}`, { method: 'PATCH', json: { name, isDefault: isDefault || undefined, rules } }) : api('/rule-sets', { method: 'POST', json: { companyId, name, isDefault, rules } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rule-sets'] }); toast('success', 'Regra salva'); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-5">
      <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} autoFocus placeholder="Ex.: CLT padrão, Convenção da saúde" />
      <T label="Regra padrão da empresa" hint="Usada pelos horários sem regra própria" checked={isDefault} onChange={setIsDefault} />
      <fieldset className="space-y-3">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">Tolerância (CLT art. 58 §1º)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <N label="Por marcação" suffix="até 5 min" value={r.markToleranceMinutes} onChange={(n) => set('markToleranceMinutes', Math.min(5, n))} />
          <N label="No dia" suffix="até 10 min" value={r.dailyToleranceMinutes} onChange={(n) => set('dailyToleranceMinutes', Math.min(10, n))} />
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">Percentuais de hora extra</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <N label="Dia útil" suffix="%" value={r.overtimePercent.normal} onChange={(n) => pct('normal', n)} hint="Mínimo de 50% (CF art. 7º XVI)" />
          <N label="Noturna" suffix="%" value={r.overtimePercent.night} onChange={(n) => pct('night', n)} />
          <N label="Intervalo suprimido" suffix="%" value={r.overtimePercent.break} onChange={(n) => pct('break', n)} />
          <N label="Descanso (DSR)" suffix="%" value={r.overtimePercent.rest} onChange={(n) => pct('rest', n)} />
          <N label="Feriado" suffix="%" value={r.overtimePercent.holiday} onChange={(n) => pct('holiday', n)} />
          <N label="Limite diário de extra" suffix="min" value={r.dailyOvertimeLimitMinutes} onChange={(n) => set('dailyOvertimeLimitMinutes', n)} hint={`${hours(r.dailyOvertimeLimitMinutes)} (CLT art. 59: até 2h)`} />
        </div>
        <T label="Faixas de hora extra no dia útil" hint="Ex.: as 2 primeiras horas a 50% e o restante a 100%" checked={bands} onChange={setBands} />
        {bands && (
          <div className="space-y-2 rounded-2xl border border-line p-3">
            {bandList.map((b, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-16 text-xs text-muted">Faixa {i + 1}</span>
                {b.upToMinutes === null ? <span className="text-xs text-muted">restante das horas</span> : (
                  <>até <input aria-label={`Faixa ${i + 1}: até minutos`} className="h-9 w-20 rounded-xl border border-line bg-hover px-2 text-center font-mono text-xs" value={b.upToMinutes} onChange={(e) => set('overtimeBands', bandList.map((x, j) => (j === i ? { ...x, upToMinutes: num(e.target.value) } : x)))} /> min</>
                )}
                <span className="text-xs text-muted">a</span>
                <input aria-label={`Faixa ${i + 1}: percentual`} className="h-9 w-16 rounded-xl border border-line bg-hover px-2 text-center font-mono text-xs" value={b.percent} onChange={(e) => set('overtimeBands', bandList.map((x, j) => (j === i ? { ...x, percent: num(e.target.value) } : x)))} />%
                {b.upToMinutes !== null && bandList.length > 2 && <button type="button" onClick={() => set('overtimeBands', bandList.filter((_, j) => j !== i))} className="text-subtle hover:text-danger" aria-label="Remover faixa"><X className="size-4" /></button>}
              </div>
            ))}
            {bandList.length < 5 && <button type="button" onClick={() => { const last = bandList.at(-2)?.upToMinutes ?? 0; set('overtimeBands', [...bandList.slice(0, -1), { upToMinutes: last + 60, percent: 75 }, bandList.at(-1)!]); }} className="text-xs text-brand">+ faixa</button>}
          </div>
        )}
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">Adicional noturno e intervalo</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Noturno começa" type="time" value={r.nightStart} onChange={(e) => set('nightStart', e.target.value)} hint="Urbano: 22h (CLT art. 73)" />
          <Input label="Noturno termina" type="time" value={r.nightEnd} onChange={(e) => set('nightEnd', e.target.value)} hint="Urbano: 5h" />
          <N label="Intervalo mínimo" suffix="min" value={r.minBreakMinutes} onChange={(n) => set('minBreakMinutes', n)} hint="Jornada acima de 6h: 1h (art. 71)" />
        </div>
        <T label="Hora noturna reduzida (52min30s)" checked={r.reducedNightHour} onChange={(v) => set('reducedNightHour', v)} />
        <T label="Descontar o intervalo previsto quando não houver marcação de intervalo" hint="Só use com intervalo pré-assinalado (Portaria 671, art. 74 §2º da CLT)" checked={r.autoDeductBreak} onChange={(v) => set('autoDeductBreak', v)} />
        <T label="Falta sem justificativa gera saldo negativo" checked={r.discountAbsences} onChange={(v) => set('discountAbsences', v)} />
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">Arredondamento</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <N label="Arredondar a cada" suffix="min (0 = não)" value={r.roundingMinutes} onChange={(n) => set('roundingMinutes', Math.min(30, n))} />
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-subtle">Modo</span>
            <select value={r.roundingMode} onChange={(e) => set('roundingMode', e.target.value as Rules['roundingMode'])} className="h-11 w-full rounded-2xl border border-line bg-hover px-4 text-sm outline-none [&>option]:bg-elevated">
              <option value="nearest">Mais próximo</option><option value="up">Para cima</option><option value="down">Para baixo</option>
            </select>
          </label>
        </div>
      </fieldset>
      <Button type="submit" loading={save.isPending} className="h-12 w-full">Salvar regra</Button>
    </form>
  );
}

export default function RegrasPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const qc = useQueryClient();
  const toast = useToast();
  const canManage = can(me, 'schedules.timetables:manage');
  const { companies, loaded, companyId, setCompanyId } = useCompanyPick(tenantId);
  const [editing, setEditing] = useState<RuleSet | null | 'new'>(null);
  const [removing, setRemoving] = useState<RuleSet | null>(null);
  const list = useQuery({ queryKey: ['rule-sets', tenantId, companyId], queryFn: () => api<RuleSet[]>(`/rule-sets?companyId=${companyId}`), enabled: !!companyId });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/rule-sets/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rule-sets'] }); toast('success', 'Regra excluída'); setRemoving(null); },
    onError: (e: Error) => { toast('error', e.message); setRemoving(null); },
  });
  const rows = list.data ?? [];
  return (
    <Page>
      <PageHeader title="Regras de apuração" description="Tolerâncias, percentuais e faixas de hora extra, adicional noturno e intervalo usados no cálculo do ponto." actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
        {companies.length > 1 && <select aria-label="Empresa" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="glass h-10 max-w-xs rounded-full px-4 text-sm outline-none [&>option]:bg-elevated">{companies.map((c) => <option key={c.id} value={c.id}>{c.tradeName ?? c.legalName}</option>)}</select>}
        {canManage && companyId && <Button onClick={() => setEditing('new')}><Plus className="size-4" />Nova regra</Button>}
      </>} />
      {!tenantId ? <Card><EmptyState icon={Scale} title="Escolha uma organização" body="Selecione acima o cliente." /></Card>
        : loaded && !companies.length ? <Card><EmptyState icon={Building2} title="Cadastre uma empresa primeiro" body="Regras pertencem a uma empresa." /></Card>
        : list.isLoading || !companyId ? <Skeleton className="h-40 rounded-[24px]" />
        : !rows.length ? <Card><EmptyState icon={Scale} title="Nenhuma regra" body="Sem regra cadastrada, o cálculo usa a CLT: tolerância 5/10 min, extra 50%, descanso e feriado 100%, noturno 22h–5h com hora reduzida." action={canManage ? <Button onClick={() => setEditing('new')}><Plus className="size-4" />Nova regra</Button> : undefined} /></Card>
        : (
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((r, i) => (
              <Card key={r.id} delay={i * 0.04} className="rounded-[24px]">
                <div className="flex items-start gap-3">
                  <span className={cn('grid size-9 place-items-center rounded-xl', r.isDefault ? 'bg-brand text-brand-fg' : 'bg-hover text-muted')}>{r.isDefault ? <Star className="size-4" /> : <Scale className="size-4" />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.name}{r.isDefault && <span className="ml-2 text-xs text-brand">padrão</span>}</p>
                    <p className="text-xs text-muted">Tolerância {r.rules.markToleranceMinutes}/{r.rules.dailyToleranceMinutes} min · extra {r.rules.overtimeBands?.length ? r.rules.overtimeBands.map((b) => `${b.percent}%`).join('→') : `${r.rules.overtimePercent.normal}%`} · feriado {r.rules.overtimePercent.holiday}% · noturno {r.rules.nightStart}–{r.rules.nightEnd}</p>
                  </div>
                  <span className="rounded-full bg-hover px-2.5 py-1 text-xs text-muted">{r.inUse} em uso</span>
                </div>
                {canManage && (
                  <div className="mt-3 flex gap-1">
                    <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => setEditing(r)}><Pencil className="size-3.5" />Editar</Button>
                    <Button variant="ghost" className="ml-auto h-8 px-3 text-xs hover:text-danger" onClick={() => setRemoving(r)} aria-label={`Excluir ${r.name}`}><Trash2 className="size-3.5" /></Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nova regra de apuração' : 'Editar regra'} wide>
        {editing !== null && companyId && <RuleForm key={editing === 'new' ? 'new' : editing.id} companyId={companyId} row={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      </Sheet>
      <Confirm open={!!removing} title="Excluir regra?" body={`"${removing?.name}" deixa de aparecer. Regras em uso ou a regra padrão não podem ser excluídas.`} confirmLabel="Excluir" loading={remove.isPending} onConfirm={() => removing && remove.mutate(removing.id)} onCancel={() => setRemoving(null)} />
    </Page>
  );
}
