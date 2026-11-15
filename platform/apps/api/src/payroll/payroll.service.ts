import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { onlyDigits } from '@superponto/br-docs';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import { can } from '../authorization/authorization.js';
import { sha256Hex } from '../common/crypto.js';
import type { RequestMeta } from '../common/tenant.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { ReportsService } from '../reports/reports.service.js';
import { local } from '../timesheet/timesheet.core.js';

// ---------------------------------------------------------------------------------------------
// Exportação para a folha de pagamento (arquivo próprio, configurável; não fala com nenhum sistema)
// ---------------------------------------------------------------------------------------------

/** Verbas disponíveis (saem da folha de conferência). "ot" vale para qualquer percentual: ot50, ot100... */
export const PAYROLL_ITEMS: Record<string, { label: string; unit: 'hours' | 'days' }> = {
  normal: { label: 'Horas normais', unit: 'hours' },
  ot50: { label: 'Extra 50%', unit: 'hours' },
  ot60: { label: 'Extra 60%', unit: 'hours' },
  ot70: { label: 'Extra 70%', unit: 'hours' },
  ot75: { label: 'Extra 75%', unit: 'hours' },
  ot80: { label: 'Extra 80%', unit: 'hours' },
  ot100: { label: 'Extra 100%', unit: 'hours' },
  night: { label: 'Adicional noturno (hora reduzida)', unit: 'hours' },
  absence: { label: 'Faltas (horas)', unit: 'hours' },
  late: { label: 'Atrasos e saídas antecipadas', unit: 'hours' },
  allowances: { label: 'Dias abonados', unit: 'days' },
  onCall: { label: 'Sobreaviso (1/3)', unit: 'hours' },
};
const eventCode = z.string().trim().regex(/^[A-Za-z0-9._-]{1,20}$/, 'Código do evento: até 20 letras, números, ponto, hífen ou sublinhado');
export const payrollLayoutSchema = z.object({
  companyId: z.uuid(),
  name: z.string().trim().min(2).max(80),
  events: z.record(z.string().regex(/^(normal|ot\d{1,3}|night|absence|late|allowances|onCall)$/, 'Verba desconhecida'), eventCode).refine((e) => Object.keys(e).length > 0, 'Informe o código de ao menos uma verba'),
  separator: z.enum([';', ',', '|', 'TAB']).default(';'),
  quantityFormat: z.enum(['HHMM', 'DECIMAL', 'MINUTES']).default('HHMM'),
  includeHeader: z.boolean().default(true),
  employeeKey: z.enum(['MATRICULA', 'CPF']).default('MATRICULA'),
});
export type PayrollLayoutInput = z.infer<typeof payrollLayoutSchema>;
export const payrollExportSchema = z.object({ from: z.iso.date(), to: z.iso.date(), departmentId: z.uuid().optional(), groupingId: z.uuid().optional(), employmentIds: z.array(z.uuid()).max(2000).optional() });
export type PayrollExportInput = z.infer<typeof payrollExportSchema>;

export function formatQuantity(minutes: number, fmt: string, unit: 'hours' | 'days') {
  if (unit === 'days') return String(minutes);
  if (fmt === 'MINUTES') return String(minutes);
  if (fmt === 'DECIMAL') return (minutes / 60).toFixed(2).replace('.', ',');
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly reports: ReportsService) {}

  items() { return Object.entries(PAYROLL_ITEMS).map(([key, v]) => ({ key, ...v })); }

  list(tenantId: string, companyId?: string) {
    return this.prisma.forTenant(tenantId, (tx) => tx.payrollLayout.findMany({ where: { deletedAt: null, ...(companyId ? { companyId } : {}) }, orderBy: { name: 'asc' } }));
  }

  private async one(tx: Tx, id: string) {
    const l = await tx.payrollLayout.findFirst({ where: { id, deletedAt: null } });
    if (!l) throw new NotFoundException('Layout não encontrado');
    return l;
  }

  private dup(e: unknown): never {
    if ((e as { code?: string }).code === 'P2002' || /payroll_layouts_company_name/.test(String((e as Error).message))) throw new ConflictException('Já existe um layout com esse nome nesta empresa');
    throw e;
  }

  async create(tenantId: string, user: AuthUser, input: PayrollLayoutInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (!(await tx.company.findFirst({ where: { id: input.companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
      const l = await tx.payrollLayout.create({ data: { tenantId, ...input } }).catch((e) => this.dup(e));
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'payroll_layout', entityId: l.id, after: l, ...meta });
      return l;
    });
  }

  async update(tenantId: string, user: AuthUser, id: string, input: Omit<PayrollLayoutInput, 'companyId'>, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await this.one(tx, id);
      const { companyId: _c, ...data } = input as PayrollLayoutInput;
      const l = await tx.payrollLayout.update({ where: { id }, data }).catch((e) => this.dup(e));
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'payroll_layout', entityId: id, before, after: l, ...meta });
      return l;
    });
  }

  async remove(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    await this.prisma.forTenant(tenantId, async (tx) => {
      const before = await this.one(tx, id);
      await tx.payrollLayout.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'payroll_layout', entityId: id, before, ...meta });
    });
  }

  /** Gera o arquivo: uma linha por funcionário e verba (quantidade zero não entra). */
  async export(tenantId: string, user: AuthUser, id: string, q: PayrollExportInput, meta: RequestMeta) {
    const layout = await this.prisma.forTenant(tenantId, (tx) => this.one(tx, id));
    if (layout.employeeKey === 'CPF' && !can(user, 'people.sensitive:read')) throw new ForbiddenException('Layout por CPF exige a permissão de ver dados sensíveis');
    const r = await this.reports.run(tenantId, user, 'folha-conferencia', { companyId: layout.companyId, from: q.from, to: q.to, departmentId: q.departmentId, groupingId: q.groupingId, employmentIds: q.employmentIds, includeSubdepartments: true, status: 'ACTIVE' });
    const events = layout.events as Record<string, string>;
    let cpfs = new Map<string, string>();
    if (layout.employeeKey === 'CPF') {
      const emps = await this.prisma.forTenant(tenantId, (tx) => tx.employment.findMany({ where: { companyId: layout.companyId, deletedAt: null, registration: { in: r.rows.map((x) => String(x.registration)) } }, select: { registration: true, person: { select: { cpf: true } } } }));
      cpfs = new Map(emps.map((e) => [e.registration, e.person.cpf ?? '']));
    }
    const sep = layout.separator === 'TAB' ? '\t' : layout.separator;
    const lines: string[] = [];
    if (layout.includeHeader) lines.push([layout.employeeKey === 'CPF' ? 'CPF' : 'Matricula', 'Evento', 'Quantidade', 'Inicio', 'Fim'].join(sep));
    const missing: string[] = [];
    let n = 0;
    for (const row of r.rows) {
      const key = layout.employeeKey === 'CPF' ? cpfs.get(String(row.registration)) ?? '' : String(row.registration);
      if (!key) { missing.push(String(row.name)); continue; }
      for (const [item, code] of Object.entries(events)) {
        const qty = Number(row[item] ?? 0);
        if (!qty) continue;
        const unit = PAYROLL_ITEMS[item]?.unit ?? 'hours';
        lines.push([key, code, formatQuantity(qty, layout.quantityFormat, unit), q.from.split('-').reverse().join('/'), q.to.split('-').reverse().join('/')].join(sep));
        n++;
      }
    }
    await this.prisma.forTenant(tenantId, (tx) => this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'EXPORT', entity: 'payroll_export', entityId: id, after: { layout: layout.name, from: q.from, to: q.to, employees: r.rows.length, lines: n }, ...meta }));
    const content = `${lines.join('\r\n')}\r\n`;
    return {
      filename: `folha_${layout.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}_${q.from}_${q.to}.txt`, mime: 'text/plain;charset=utf-8',
      base64: Buffer.from(content, 'utf8').toString('base64'), lines: n, employees: r.rows.length, missingKey: missing,
      unmappedItems: r.columns.map((c) => c.key).filter((k) => k in PAYROLL_ITEMS && !(k in events) && r.rows.some((x) => Number(x[k] ?? 0) > 0)),
    };
  }
}

// ---------------------------------------------------------------------------------------------
// Importação de marcações por planilha (CSV/TXT): matrícula ou CPF; data; hora
// ---------------------------------------------------------------------------------------------

export const markImportSchema = z.object({
  companyId: z.uuid(),
  content: z.string().min(1).max(2_000_000),
  employeeKey: z.enum(['MATRICULA', 'CPF']).default('MATRICULA'),
  dryRun: z.boolean().default(true),
});
export type MarkImportInput = z.infer<typeof markImportSchema>;

function parseDate(v: string) {
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  const d = br ? `${br[3]}-${br[2]}-${br[1]}` : /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  if (!d) return null;
  const t = new Date(`${d}T00:00:00Z`);
  return Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== d ? null : d;
}

@Injectable()
export class MarkImportService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  /** Confere (dryRun) ou grava. Repetir o mesmo arquivo não duplica (chave por vínculo + minuto). */
  async import(tenantId: string, user: AuthUser, input: MarkImportInput, meta: RequestMeta) {
    const raw = input.content.replace(/^﻿/, '').split(/\r?\n/);
    if (raw.length > 20001) throw new BadRequestException('Até 20.000 linhas por arquivo');
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (!(await tx.company.findFirst({ where: { id: input.companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
      const emps = await tx.employment.findMany({ where: { companyId: input.companyId, deletedAt: null }, select: { id: true, registration: true, hiredAt: true, terminatedAt: true, person: { select: { cpf: true, fullName: true } } } });
      const byKey = new Map(emps.map((e) => [input.employeeKey === 'CPF' ? onlyDigits(e.person.cpf ?? '') : e.registration, e]));
      const closings = await tx.timeClosing.findMany({ where: { companyId: input.companyId, status: 'CLOSED' }, select: { periodStart: true, periodEnd: true } });
      const now = new Date();
      const errors: Array<{ line: number; message: string }> = [];
      const valid: Array<{ line: number; employmentId: string; name: string; at: Date; date: string; time: string; key: string }> = [];
      const seen = new Set<string>();
      raw.forEach((text, i) => {
        const line = i + 1;
        const t = text.trim();
        if (!t) return;
        const parts = t.split(/[;,\t|]/).map((x) => x.trim().replace(/^"|"$/g, ''));
        if (i === 0 && !/\d/.test(parts[1] ?? '')) return; // cabeçalho
        if (parts.length < 3) { errors.push({ line, message: 'Use: matrícula (ou CPF); data; hora' }); return; }
        const key = input.employeeKey === 'CPF' ? onlyDigits(parts[0]!) : parts[0]!;
        const e = byKey.get(key);
        if (!e) { errors.push({ line, message: `Funcionário não encontrado: ${parts[0]}` }); return; }
        const date = parseDate(parts[1]!);
        if (!date) { errors.push({ line, message: `Data inválida: ${parts[1]}` }); return; }
        const hm = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(parts[2]!);
        if (!hm) { errors.push({ line, message: `Hora inválida: ${parts[2]}` }); return; }
        const at = new Date(`${date}T${hm[1]}:${hm[2]}:00-03:00`);
        if (at > now) { errors.push({ line, message: 'Marcação no futuro' }); return; }
        if (date < e.hiredAt.toISOString().slice(0, 10) || (e.terminatedAt && date > e.terminatedAt.toISOString().slice(0, 10))) { errors.push({ line, message: 'Fora do período do vínculo' }); return; }
        if (closings.some((c) => c.periodStart.toISOString().slice(0, 10) <= date && c.periodEnd.toISOString().slice(0, 10) >= date)) { errors.push({ line, message: 'Período fechado' }); return; }
        const k = `import:${e.id}:${at.toISOString().slice(0, 16)}`;
        if (seen.has(k)) { errors.push({ line, message: 'Repetida no arquivo' }); return; }
        seen.add(k);
        valid.push({ line, employmentId: e.id, name: e.person.fullName, at, date, time: `${hm[1]}:${hm[2]}`, key: k });
      });
      // Já existentes: mesma chave de importação ou mesma marcação (mesmo minuto) vinda de outra origem.
      const existing = valid.length ? await tx.timeRecord.findMany({ where: { employmentId: { in: [...new Set(valid.map((v) => v.employmentId))] }, recordedAt: { gte: new Date(Math.min(...valid.map((v) => v.at.getTime()))), lte: new Date(Math.max(...valid.map((v) => v.at.getTime())) + 59_999) } }, select: { employmentId: true, recordedAt: true } }) : [];
      const have = new Set(existing.map((r) => `import:${r.employmentId}:${r.recordedAt.toISOString().slice(0, 16)}`));
      const fresh = valid.filter((v) => !have.has(v.key));
      const result = { total: valid.length + errors.length, valid: valid.length, duplicates: valid.length - fresh.length, toImport: fresh.length, imported: 0, errors: errors.slice(0, 500), preview: fresh.slice(0, 50).map((v) => ({ line: v.line, name: v.name, date: v.date, time: v.time })) };
      if (input.dryRun || !fresh.length) return result;
      // Grava em ordem por vínculo e horário, encadeando o hash como nas demais origens.
      fresh.sort((a, b) => a.employmentId.localeCompare(b.employmentId) || a.at.getTime() - b.at.getTime());
      const last = new Map<string, string | null>();
      for (const v of fresh) {
        if (!last.has(v.employmentId)) last.set(v.employmentId, (await tx.timeRecord.findFirst({ where: { employmentId: v.employmentId }, orderBy: { receivedAt: 'desc' }, select: { hash: true } }))?.hash ?? null);
        const prev = last.get(v.employmentId) ?? null;
        const hash = sha256Hex([prev ?? '', v.employmentId, v.at.toISOString(), 'IMPORT', v.key].join('|'));
        await tx.timeRecord.create({ data: { tenantId, employmentId: v.employmentId, recordedAt: v.at, source: 'IMPORT', hash, previousHash: prev, idempotencyKey: v.key } });
        last.set(v.employmentId, hash);
      }
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'time_record_import', after: { companyId: input.companyId, imported: fresh.length, duplicates: result.duplicates, errors: errors.length, at: local(now) }, ...meta });
      return { ...result, imported: fresh.length };
    }, { timeout: 120_000 });
  }
}
