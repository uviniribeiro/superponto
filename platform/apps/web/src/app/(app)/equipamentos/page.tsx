'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Clock, Download, KeyRound, Pencil, Plus, RefreshCw, Router, Send, Trash2, Upload, Users, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Page, PageHeader } from '@/components/page';
import { can, useSession } from '@/components/providers';
import { TenantPicker, useActiveTenant } from '@/components/tenant-picker';
import { Button, Card, Confirm, EmptyState, Input, Sheet, Skeleton, useToast } from '@/components/ui';
import { api, type Page as Paged, type Ref } from '@/lib/api';
import { cn } from '@/lib/cn';
import { downloadText } from '@/lib/download';
import { useCompanyPick } from '@/lib/schedules';
import { todayBr } from '@/lib/timesheet';

interface Device {
  id: string; companyId: string; unitId: string | null; name: string; ordinance: string; serialNumber: string | null; repNumber: string | null; manufacturer: string | null; modelName: string | null;
  host: string | null; port: number | null; groupName: string | null; collectIntervalMinutes: number | null; alertEmails: string[]; timezone: string; status: string; lastSeenAt: string | null;
  lastSyncAt: string | null; firmware: string | null; hasAgentKey: boolean; pendingJobs: number; failedJobs: number; unit: { name: string } | null;
}
interface Job { id: string; action: string; status: string; attempts: number; lastError: string | null; scheduledAt: string; finishedAt: string | null }
interface Stats { lastSeenAt: string | null; status: string; offlineAfterMinutes: number; days: Array<{ day: string; records: number; contacts: number; alerts: number }>; recent: Array<{ level: string; message: string; createdAt: string }> }
interface Roster { layout: string; receivedAt: string | null; totals: Record<string, number>; rows: Array<{ employmentId: string; name: string; registration: string; workerId: string | null; problem: string | null; fingerprints: number; inDevice: boolean; lastSend: { status: string; at: string; error: string | null } | null }>; extra: Array<{ workerId: string; name: string | null }> }

const ORD: Record<string, string> = { P1510_2009: 'Portaria 1.510', P373_2011: 'Portaria 373 (REP-A)', P671_2021: 'Portaria 671' };
const STATUS: Record<string, [string, string]> = { ONLINE: ['Comunicando', 'bg-success'], OFFLINE: ['Sem comunicação', 'bg-danger'], PENDING: ['Aguardando agente', 'bg-warning'], ERROR: ['Erro', 'bg-danger'], DISABLED: ['Desativado', 'bg-fg/30'] };
const ACTION: Record<string, string> = {
  SET_DATETIME: 'Enviar data e hora', SET_EMPLOYER: 'Enviar empregador', SYNC_EMPLOYEES: 'Enviar funcionários e digitais', UPSERT_EMPLOYEE: 'Enviar funcionário', UPSERT_FINGERPRINT: 'Enviar digital',
  DELETE_FINGERPRINTS: 'Remover digital', RECEIVE_EMPLOYEES: 'Receber funcionários', RECEIVE_FINGERPRINTS: 'Receber digitais', RECEIVE_EMPLOYER: 'Receber empregador', COLLECT_RECORDS: 'Coletar registros',
};
const JOB_CLS: Record<string, string> = { QUEUED: 'bg-brand-soft', RUNNING: 'bg-sky-500/15 text-sky-300', SUCCEEDED: 'bg-success/15 text-success', FAILED: 'bg-danger/15 text-danger', CANCELLED: 'bg-hover text-muted' };
const JOB_LABEL: Record<string, string> = { QUEUED: 'Na fila', RUNNING: 'Executando', SUCCEEDED: 'Concluído', FAILED: 'Falhou', CANCELLED: 'Cancelado' };
const since = (v: string | null) => { if (!v) return 'nunca'; const m = Math.round((Date.now() - Date.parse(v)) / 60000); return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`; };

function DeviceForm({ companyId, row, onDone }: { companyId: string; row: Device | null; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const units = useQuery({ queryKey: ['opt', 'units', companyId], queryFn: () => api<Paged<Ref>>(`/units?companyId=${companyId}&pageSize=200`), retry: false });
  const [f, setF] = useState({
    name: row?.name ?? '', ordinance: row?.ordinance ?? 'P671_2021', serialNumber: row?.serialNumber ?? '', repNumber: row?.repNumber ?? '', manufacturer: row?.manufacturer ?? '', modelName: row?.modelName ?? '',
    host: row?.host ?? '', port: row?.port ? String(row.port) : '', groupName: row?.groupName ?? '', collect: row?.collectIntervalMinutes ? String(row.collectIntervalMinutes) : '10',
    emails: (row?.alertEmails ?? []).join(', '), unitId: row?.unitId ?? '', active: row ? row.status !== 'DISABLED' : true,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name.trim(), ordinance: f.ordinance, serialNumber: f.serialNumber.trim() || null, repNumber: f.repNumber.replace(/\D/g, '') || null, manufacturer: f.manufacturer.trim() || null, modelName: f.modelName.trim() || null,
        host: f.host.trim() || null, port: f.port ? Number(f.port) : null, groupName: f.groupName.trim() || null, collectIntervalMinutes: f.collect ? Number(f.collect) : null,
        alertEmails: f.emails.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean), unitId: f.unitId || null, active: f.active,
      };
      return row ? api(`/devices/${row.id}`, { method: 'PATCH', json: body }) : api('/devices', { method: 'POST', json: { ...body, companyId } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['devices'] }); toast('success', row ? 'Equipamento atualizado' : 'Equipamento cadastrado'); onDone(); },
    onError: (e: Error) => toast('error', e.message),
  });
  const sel = 'h-11 w-full rounded-2xl border border-line bg-hover px-4 text-sm outline-none [&>option]:bg-elevated';
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
      <Input label="Nome" value={f.name} onChange={(e) => set('name', e.target.value)} required minLength={2} autoFocus placeholder="Ex.: REP da portaria" />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wider text-subtle">Portaria</span><select value={f.ordinance} onChange={(e) => set('ordinance', e.target.value)} className={sel}>{Object.entries(ORD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wider text-subtle">Unidade</span><select value={f.unitId} onChange={(e) => set('unitId', e.target.value)} className={sel}><option value="">—</option>{(units.data?.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Número do REP (fabricação)" value={f.repNumber} onChange={(e) => set('repNumber', e.target.value.replace(/\D/g, '').slice(0, 17))} className="font-mono" hint="17 dígitos; vai no AEJ" />
        <Input label="Número de série" value={f.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} className="font-mono" />
        <Input label="Fabricante" value={f.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} placeholder="Ex.: Control iD, Henry" />
        <Input label="Modelo" value={f.modelName} onChange={(e) => set('modelName', e.target.value)} />
        <Input label="Endereço na rede (IP ou nome)" value={f.host} onChange={(e) => set('host', e.target.value)} className="font-mono" hint="Usado pelo agente local, dentro da rede do cliente" />
        <Input label="Porta" value={f.port} onChange={(e) => set('port', e.target.value.replace(/\D/g, ''))} className="font-mono" />
        <Input label="Grupo de REP" value={f.groupName} onChange={(e) => set('groupName', e.target.value)} placeholder="Ex.: Portaria, Bloco B" hint="Comandos podem ir para o grupo inteiro" />
        <Input label="Coletar a cada (min)" value={f.collect} onChange={(e) => set('collect', e.target.value.replace(/\D/g, ''))} className="font-mono" hint="5 a 1440; o alerta dispara após 3 intervalos sem contato" />
      </div>
      <Input label="E-mails de alerta" value={f.emails} onChange={(e) => set('emails', e.target.value)} placeholder="ti@empresa.com.br, rh@empresa.com.br" hint="Avisados quando o equipamento fica sem comunicação e quando volta" />
      <label className="flex items-center justify-between rounded-2xl border border-line px-4 py-3 text-sm"><span>Ativo</span><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} className="size-4 accent-[var(--brand)]" /></label>
      <Button type="submit" loading={save.isPending} className="h-12 w-full">{row ? 'Salvar' : 'Cadastrar equipamento'}</Button>
    </form>
  );
}

function Bars({ data }: { data: Stats['days'] }) {
  const max = Math.max(1, ...data.map((d) => d.records));
  return (
    <div className="flex h-36 items-end gap-1.5">
      {data.map((d, i) => (
        <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.day.split('-').reverse().join('/')}: ${d.records} registro(s), ${d.contacts} contato(s)${d.alerts ? `, ${d.alerts} alerta(s)` : ''}`}>
          <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(3, (d.records / max) * 100)}%` }} transition={{ delay: i * 0.02, duration: 0.6 }} className={cn('w-full rounded-t-lg', d.alerts ? 'bg-danger/70' : 'bg-brand')} />
          <span className={cn('size-1.5 rounded-full', d.contacts ? 'bg-success' : 'bg-fg/20')} />
          <span className="text-[9px] text-subtle">{d.day.slice(8)}</span>
        </div>
      ))}
    </div>
  );
}

function DeviceDetail({ d, canCmd, canManage }: { d: Device; canCmd: boolean; canManage: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<'overview' | 'commands' | 'roster' | 'files' | 'agent'>('overview');
  const [key, setKey] = useState<string | null>(null);
  const [range, setRange] = useState(() => { const t = todayBr(); return { from: `${t.slice(0, 7)}-01`, to: t }; });
  const stats = useQuery({ queryKey: ['device', d.id, 'stats'], queryFn: () => api<Stats>(`/devices/${d.id}/stats?days=14`), enabled: tab === 'overview' });
  const jobs = useQuery({ queryKey: ['device', d.id, 'jobs'], queryFn: () => api<Job[]>(`/devices/${d.id}/jobs`), enabled: tab === 'commands', refetchInterval: tab === 'commands' ? 5000 : false });
  const roster = useQuery({ queryKey: ['device', d.id, 'roster'], queryFn: () => api<Roster>(`/devices/${d.id}/roster`), enabled: tab === 'roster' });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['device', d.id] }); qc.invalidateQueries({ queryKey: ['devices'] }); };
  const cmd = useMutation({ mutationFn: (action: string) => api<{ queued: number }>(`/devices/${d.id}/commands`, { method: 'POST', json: { action } }), onSuccess: (r, a) => { refresh(); toast('success', `${ACTION[a]}: ${r.queued} comando(s) na fila`); setTab('commands'); }, onError: (e: Error) => toast('error', e.message) });
  const retry = useMutation({ mutationFn: () => api<{ retried: number }>(`/devices/${d.id}/jobs/retry`, { method: 'POST' }), onSuccess: (r) => { refresh(); toast('success', `${r.retried} comando(s) de volta à fila`); }, onError: (e: Error) => toast('error', e.message) });
  const cancel = useMutation({ mutationFn: (id: string) => api(`/devices/${d.id}/jobs/${id}`, { method: 'DELETE' }), onSuccess: () => refresh(), onError: (e: Error) => toast('error', e.message) });
  const genKey = useMutation({ mutationFn: () => api<{ key: string }>(`/devices/${d.id}/agent-key`, { method: 'POST' }), onSuccess: (r) => { setKey(r.key); refresh(); }, onError: (e: Error) => toast('error', e.message) });
  const importAfd = useMutation({ mutationFn: (content: string) => api<{ imported: number; duplicates: number; unmatched: unknown[]; warnings: string[] }>(`/devices/${d.id}/afd`, { method: 'POST', json: { content } }), onSuccess: (r) => toast('success', `AFD: ${r.imported} marcação(ões) nova(s), ${r.duplicates} repetida(s), ${r.unmatched.length} sem funcionário`), onError: (e: Error) => toast('error', e.message) });
  const exportAfd = useMutation({ mutationFn: () => api<{ filename: string; content: string; lines: number }>(`/devices/${d.id}/afd-export?from=${range.from}&to=${range.to}`), onSuccess: (r) => { if (!r.lines) toast('error', 'Nenhum registro coletado no período'); else downloadText(r.filename, r.content); }, onError: (e: Error) => toast('error', e.message) });
  const [label, dot] = STATUS[d.status] ?? [d.status, 'bg-fg/30'];
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-hover p-3">
        <span className={cn('size-2.5 rounded-full', dot)} /><span className="font-medium">{label}</span><span className="text-muted">· último contato {since(d.lastSeenAt)}</span>
        <span className="ml-auto text-xs text-subtle">{ORD[d.ordinance]}{d.repNumber ? ` · REP ${d.repNumber}` : ''}</span>
      </div>
      <div className="flex flex-wrap gap-1 rounded-full border border-line p-0.5 text-xs">
        {([['overview', 'Visão geral'], ['commands', 'Comandos'], ['roster', 'Funcionários'], ['files', 'Arquivos'], ['agent', 'Agente local']] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cn('h-8 rounded-full px-3', tab === k ? 'pill-light' : 'text-muted')}>{l}</button>)}
      </div>
      {tab === 'overview' && (!stats.data ? <Skeleton className="h-48" /> : (
        <div className="space-y-4">
          <div><p className="mb-2 text-xs text-muted">Registros por dia (14 dias) · ponto verde = houve contato</p><Bars data={stats.data.days} /></div>
          <p className="text-xs text-subtle">Alerta de sem comunicação após {stats.data.offlineAfterMinutes} min sem contato{d.alertEmails.length ? `, para ${d.alertEmails.join(', ')}` : ' (nenhum e-mail cadastrado)'}.</p>
          <ul className="max-h-60 space-y-1 overflow-y-auto">{stats.data.recent.map((l, i) => <li key={i} className="flex gap-2 text-xs"><span className={cn('mt-1 size-1.5 shrink-0 rounded-full', l.level === 'info' ? 'bg-success' : l.level === 'warn' ? 'bg-warning' : 'bg-danger')} /><span className="text-subtle">{new Date(l.createdAt).toLocaleString('pt-BR')}</span><span>{l.message}</span></li>)}{!stats.data.recent.length && <li className="text-xs text-subtle">Sem contato ainda: instale o agente local.</li>}</ul>
        </div>
      ))}
      {tab === 'commands' && (
        <div className="space-y-3">
          {canCmd && (
            <div className="grid grid-cols-2 gap-1.5">
              {['SYNC_EMPLOYEES', 'SET_DATETIME', 'SET_EMPLOYER', 'COLLECT_RECORDS', 'RECEIVE_EMPLOYEES', 'RECEIVE_FINGERPRINTS', 'RECEIVE_EMPLOYER'].map((a) => (
                <Button key={a} variant="outline" className="h-9 justify-start text-xs" onClick={() => cmd.mutate(a)} disabled={cmd.isPending || d.status === 'DISABLED'}><Send className="size-3.5" />{ACTION[a]}</Button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-wider text-subtle">Fila</h3>{canCmd && d.failedJobs > 0 && <Button variant="ghost" className="h-8 text-xs" onClick={() => retry.mutate()}><RefreshCw className="size-3.5" />Tentar de novo as falhas</Button>}</div>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-2xl border border-line">
            {(jobs.data ?? []).map((j) => (
              <li key={j.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                <span className={cn('rounded-full px-2 py-0.5', JOB_CLS[j.status])}>{JOB_LABEL[j.status] ?? j.status}</span>
                <span className="min-w-0 flex-1"><span className="block">{ACTION[j.action] ?? j.action}</span>{j.lastError && <span className="block text-danger">{j.lastError}</span>}</span>
                <span className="text-subtle">{new Date(j.finishedAt ?? j.scheduledAt).toLocaleString('pt-BR')}</span>
                {canCmd && (j.status === 'QUEUED' || j.status === 'FAILED') && <button onClick={() => cancel.mutate(j.id)} className="text-subtle hover:text-danger" aria-label="Cancelar comando"><X className="size-3.5" /></button>}
              </li>
            ))}
            {jobs.data && !jobs.data.length && <li className="px-3 py-4 text-center text-xs text-subtle">Nenhum comando ainda.</li>}
          </ul>
          <p className="text-xs text-subtle">O agente local busca a fila a cada minuto, executa no relógio e devolve o resultado.</p>
        </div>
      )}
      {tab === 'roster' && (!roster.data ? <Skeleton className="h-40" /> : (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2 text-center text-xs">{[['No cadastro', roster.data.totals.registry], ['No relógio', roster.data.totals.inDevice], ['Faltando', roster.data.totals.missing], ['Sobrando', roster.data.totals.extra]].map(([k, v]) => <div key={k as string} className="rounded-xl bg-hover p-2"><div className="text-lg font-semibold">{v as number}</div><div className="text-muted">{k}</div></div>)}</div>
          <p className="text-xs text-subtle">{roster.data.receivedAt ? `Lido do relógio em ${new Date(roster.data.receivedAt).toLocaleString('pt-BR')}.` : 'O relógio ainda não foi lido: use "Receber funcionários".'} Identificação pela Portaria {roster.data.layout === '671' ? '671 (CPF)' : '1.510 (PIS)'}.</p>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-2xl border border-line text-xs">
            {roster.data.rows.map((r) => (
              <li key={r.employmentId} className="flex items-center gap-2 px-3 py-2">
                <span className={cn('size-2 rounded-full', r.problem ? 'bg-warning' : r.inDevice ? 'bg-success' : 'bg-danger')} />
                <span className="min-w-0 flex-1"><span className="block">{r.name} <span className="text-subtle">· {r.registration}</span></span>{r.problem && <span className="block text-warning">{r.problem}</span>}</span>
                <span className="text-subtle">{r.fingerprints} digital(is)</span>
                {r.lastSend && <span className={cn('rounded-full px-2 py-0.5', JOB_CLS[r.lastSend.status])}>{JOB_LABEL[r.lastSend.status]}</span>}
              </li>
            ))}
            {roster.data.extra.map((x) => <li key={x.workerId} className="flex items-center gap-2 px-3 py-2"><span className="size-2 rounded-full bg-fg/40" /><span className="flex-1">{x.name ?? 'Sem nome'} <span className="text-subtle">· {x.workerId} · no relógio, fora do cadastro</span></span></li>)}
          </ul>
        </div>
      ))}
      {tab === 'files' && (
        <div className="space-y-4">
          {canCmd && (
            <section className="space-y-2 rounded-2xl border border-line p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-subtle">Importar AFD (pendrive)</h3>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-line px-3 py-4 text-sm text-muted hover:bg-hover"><Upload className="size-4" />Escolher arquivo AFD (.txt)<input type="file" accept=".txt,text/plain" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) importAfd.mutate(await f.text()); e.target.value = ''; }} /></label>
              <p className="text-xs text-subtle">Reimportar o mesmo arquivo não duplica marcações.</p>
            </section>
          )}
          <section className="space-y-2 rounded-2xl border border-line p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-subtle">Exportar registros coletados</h3>
            <div className="flex flex-wrap items-center gap-2"><input type="date" aria-label="De" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="h-9 rounded-xl border border-line bg-hover px-2" />até<input type="date" aria-label="Até" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="h-9 rounded-xl border border-line bg-hover px-2" /><Button variant="outline" className="h-9" onClick={() => exportAfd.mutate()} loading={exportAfd.isPending}><Download className="size-4" />Baixar</Button></div>
            <p className="text-xs text-subtle">Linhas originais do AFD recebidas deste equipamento, em ordem de NSR (para conferência e auditoria).</p>
          </section>
        </div>
      )}
      {tab === 'agent' && (
        <div className="space-y-3">
          <p className="text-muted">O agente local roda num computador da rede do cliente, conversa com o relógio e com o SuperPonto pela internet (HTTPS). Ele se identifica com a chave deste equipamento.</p>
          {key ? (
            <div className="space-y-2 rounded-2xl border border-brand/50 bg-brand-soft p-3"><p className="text-xs font-semibold">Copie agora: a chave não aparece de novo.</p><code className="block break-all rounded-xl bg-[var(--bg)] p-2 font-mono text-xs">{key}</code><Button variant="outline" className="h-8 text-xs" onClick={() => navigator.clipboard?.writeText(key)}>Copiar</Button></div>
          ) : <p className="text-xs text-subtle">{d.hasAgentKey ? 'Já existe uma chave. Gerar outra desliga a anterior.' : 'Nenhuma chave gerada ainda.'}</p>}
          {canManage && <Button onClick={() => genKey.mutate()} loading={genKey.isPending}><KeyRound className="size-4" />{d.hasAgentKey ? 'Trocar chave' : 'Gerar chave'}</Button>}
          <div className="rounded-2xl bg-hover p-3 font-mono text-[11px] leading-relaxed text-muted">
            POST /v1/agent/heartbeat · GET /v1/agent/jobs<br />POST /v1/agent/jobs/:id/result · POST /v1/agent/afd<br />Cabeçalho: X-Device-Key: &lt;chave&gt;
          </div>
        </div>
      )}
    </div>
  );
}

export default function EquipamentosPage() {
  const { me } = useSession();
  const { tenantId, select, isPlatform } = useActiveTenant();
  const qc = useQueryClient();
  const toast = useToast();
  const canManage = can(me, 'devices.devices:manage');
  const canCmd = can(me, 'devices.commands:execute');
  const { companies, loaded, companyId, setCompanyId } = useCompanyPick(tenantId);
  const [group, setGroup] = useState('');
  const [editing, setEditing] = useState<Device | null | 'new'>(null);
  const [open, setOpen] = useState<Device | null>(null);
  const [removing, setRemoving] = useState<Device | null>(null);
  const [groupCmd, setGroupCmd] = useState<{ group: string; action: string } | null>(null);
  const list = useQuery({ queryKey: ['devices', tenantId, companyId], queryFn: () => api<Device[]>(`/devices?companyId=${companyId}`), enabled: !!companyId, refetchInterval: 30_000 });
  const devices = list.data ?? [];
  const groups = useMemo(() => [...new Set(devices.map((d) => d.groupName).filter(Boolean) as string[])].sort(), [devices]);
  const shown = devices.filter((d) => !group || d.groupName === group);
  const remove = useMutation({ mutationFn: (id: string) => api(`/devices/${id}`, { method: 'DELETE' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['devices'] }); toast('success', 'Equipamento excluído'); setRemoving(null); }, onError: (e: Error) => toast('error', e.message) });
  const runGroup = useMutation({ mutationFn: () => api<{ devices: number; results: Array<{ ok: boolean }> }>('/devices/group-command', { method: 'POST', json: { companyId, groupName: groupCmd!.group, action: groupCmd!.action } }), onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['devices'] }); toast('success', `Comando enviado a ${r.results.filter((x) => x.ok).length} de ${r.devices} equipamento(s)`); setGroupCmd(null); }, onError: (e: Error) => toast('error', e.message) });
  const fresh = open ? devices.find((d) => d.id === open.id) ?? open : null;
  const online = devices.filter((d) => d.status === 'ONLINE').length;
  const offline = devices.filter((d) => d.status === 'OFFLINE').length;

  return (
    <Page>
      <PageHeader title="Equipamentos" description="Relógios de ponto (REP), com status de comunicação, comandos de envio e recebimento, funcionários no relógio e arquivos." actions={<>
        {isPlatform && <TenantPicker value={tenantId} onChange={select} />}
        {companies.length > 1 && <select aria-label="Empresa" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="glass h-10 max-w-xs rounded-full px-4 text-sm [&>option]:bg-elevated">{companies.map((c) => <option key={c.id} value={c.id}>{c.tradeName ?? c.legalName}</option>)}</select>}
        {canManage && companyId && <Button onClick={() => setEditing('new')}><Plus className="size-4" />Novo equipamento</Button>}
      </>} />
      {loaded && !companies.length ? <Card><EmptyState icon={Building2} title="Cadastre uma empresa primeiro" body="Equipamentos pertencem a uma empresa." /></Card> : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[['Equipamentos', devices.length, 'hero-brand-soft'], ['Comunicando', online, ''], ['Sem comunicação', offline, '']].map(([k, v, cls], i) => (
              <motion.div key={k as string} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }} className={cn('rounded-[20px] p-4', (cls as string) || 'glass')}><div className={cn('text-xs', cls ? 'opacity-70' : 'text-muted')}>{k}</div><div className={cn('text-3xl font-semibold', k === 'Sem comunicação' && (v as number) > 0 && 'text-danger')}>{v as number}</div></motion.div>
            ))}
          </div>
          {!!groups.length && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap rounded-full border border-line p-0.5 text-sm"><button onClick={() => setGroup('')} className={cn('h-8 rounded-full px-3', !group ? 'pill-light' : 'text-muted')}>Todos</button>{groups.map((g) => <button key={g} onClick={() => setGroup(g)} className={cn('h-8 rounded-full px-3', group === g ? 'pill-light' : 'text-muted')}>{g}</button>)}</div>
              {group && canCmd && <Button variant="outline" className="h-9" onClick={() => setGroupCmd({ group, action: 'SET_DATETIME' })}><Send className="size-4" />Comando para o grupo</Button>}
            </div>
          )}
          {list.isLoading ? <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-36 rounded-[24px]" />)}</div> : !shown.length ? <Card><EmptyState icon={Router} title="Nenhum equipamento" body="Cadastre os relógios desta empresa para enviar funcionários e coletar marcações." action={canManage ? <Button onClick={() => setEditing('new')}><Plus className="size-4" />Novo equipamento</Button> : undefined} /></Card> : (
            <div className="grid gap-4 md:grid-cols-2">
              {shown.map((d, i) => {
                const [label, dot] = STATUS[d.status] ?? [d.status, 'bg-fg/30'];
                return (
                  <motion.div key={d.id} initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { delay: Math.min(i, 8) * 0.04 } }} className="glass group cursor-pointer rounded-[24px] p-5" onClick={() => setOpen(d)}>
                    <div className="flex items-start gap-3">
                      <span className="relative grid size-10 place-items-center rounded-2xl bg-hover"><Router className="size-5" /><span className={cn('absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-[var(--bg-elevated)]', dot, d.status === 'ONLINE' && 'animate-pulse')} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{d.name}</p>
                        <p className="text-xs text-muted">{label} · {since(d.lastSeenAt)}{d.groupName ? ` · ${d.groupName}` : ''}</p>
                        <p className="mt-1 text-[11px] text-subtle">{ORD[d.ordinance]}{d.manufacturer ? ` · ${d.manufacturer}${d.modelName ? ` ${d.modelName}` : ''}` : ''}{d.unit ? ` · ${d.unit.name}` : ''}</p>
                      </div>
                      {canManage && (
                        <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" className="size-8 px-0" onClick={() => setEditing(d)} aria-label={`Editar ${d.name}`}><Pencil className="size-4" /></Button>
                          <Button variant="ghost" className="size-8 px-0 hover:text-danger" onClick={() => setRemoving(d)} aria-label={`Excluir ${d.name}`}><Trash2 className="size-4" /></Button>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                      {d.pendingJobs > 0 && <span className="rounded-full bg-brand-soft px-2 py-0.5"><Clock className="mr-1 inline size-3" />{d.pendingJobs} na fila</span>}
                      {d.failedJobs > 0 && <span className="rounded-full bg-danger/15 px-2 py-0.5 text-danger">{d.failedJobs} com falha</span>}
                      {!d.hasAgentKey && <span className="rounded-full bg-hover px-2 py-0.5 text-muted">sem agente</span>}
                      {d.lastSyncAt && <span className="rounded-full bg-hover px-2 py-0.5 text-muted"><Users className="mr-1 inline size-3" />sincronizado {since(d.lastSyncAt)}</span>}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Novo equipamento' : 'Editar equipamento'} wide>{editing !== null && companyId && <DeviceForm key={editing === 'new' ? 'new' : editing.id} companyId={companyId} row={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}</Sheet>
      <Sheet open={!!fresh} onClose={() => setOpen(null)} title={fresh?.name ?? ''} wide>{fresh && <DeviceDetail d={fresh} canCmd={canCmd} canManage={canManage} />}</Sheet>
      <Sheet open={!!groupCmd} onClose={() => setGroupCmd(null)} title={`Comando para o grupo ${groupCmd?.group ?? ''}`}>
        {groupCmd && (
          <form onSubmit={(e) => { e.preventDefault(); runGroup.mutate(); }} className="space-y-4 text-sm">
            <select aria-label="Comando" value={groupCmd.action} onChange={(e) => setGroupCmd({ ...groupCmd, action: e.target.value })} className="h-11 w-full rounded-2xl border border-line bg-hover px-4 [&>option]:bg-elevated">{['SYNC_EMPLOYEES', 'SET_DATETIME', 'SET_EMPLOYER', 'COLLECT_RECORDS', 'RECEIVE_EMPLOYEES', 'RECEIVE_FINGERPRINTS'].map((a) => <option key={a} value={a}>{ACTION[a]}</option>)}</select>
            <p className="text-muted">Vai para todos os equipamentos ativos do grupo.</p>
            <Button type="submit" loading={runGroup.isPending} className="h-12 w-full"><Send className="size-4" />Enviar</Button>
          </form>
        )}
      </Sheet>
      <Confirm open={!!removing} title="Excluir equipamento?" body={`"${removing?.name}" deixa de aparecer, a chave do agente para de funcionar e os comandos na fila são cancelados. As marcações já recebidas continuam.`} confirmLabel="Excluir" loading={remove.isPending} onConfirm={() => removing && remove.mutate(removing.id)} onCancel={() => setRemoving(null)} />
    </Page>
  );
}
