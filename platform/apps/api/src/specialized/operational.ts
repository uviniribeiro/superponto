import { Body, Controller, Get, Injectable, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import { RequirePermission } from '../authorization/authorization.js';
import { ActiveTenant, RequestInfo, type RequestMeta } from '../common/tenant.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TimesheetService } from '../timesheet/timesheet.service.js';

const id = { schema: z.uuid() };
export const OCCURRENCE_TYPES = ['ABSENCE', 'LATE', 'EARLY_LEAVE', 'MISSING_RECORD', 'OVERTIME', 'INSUFFICIENT_BREAK', 'UNCOVERED_SHIFT', 'SHIFT_NOT_STARTED', 'SHIFT_NOT_CLOSED', 'SCHEDULE_CONFLICT', 'INCOMPLETE_TEAM', 'OPERATIONAL_ISSUE', 'PROFESSIONAL_SWAP', 'SCHEDULE_CHANGE', 'EQUIPMENT_UNAVAILABLE', 'OTHER'] as const;
export const occurrenceSchema = z.object({
  unitId: z.uuid(),
  type: z.enum(OCCURRENCE_TYPES),
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(2000).nullable().optional(),
  occurredAt: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
  employmentId: z.uuid().nullable().optional(),
  responsibleId: z.uuid().nullable().optional(),
});
const listSchema = z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'ACTIVE']).default('ACTIVE'), unitId: z.uuid().optional(), type: z.enum(OCCURRENCE_TYPES).optional() });
const actionSchema = z.object({ action: z.enum(['START', 'RESOLVE', 'DISMISS', 'REOPEN', 'COMMENT']), notes: z.string().trim().max(1000).optional(), responsibleId: z.uuid().nullable().optional() })
  .refine((a) => a.action !== 'COMMENT' || (a.notes?.length ?? 0) > 0, { message: 'Escreva o comentário', path: ['notes'] })
  .refine((a) => !['RESOLVE', 'DISMISS'].includes(a.action) || (a.notes?.length ?? 0) >= 3, { message: 'Explique como foi tratada', path: ['notes'] });
const generateSchema = z.object({ companyId: z.uuid(), date: z.iso.date() });
const NEXT: Record<string, 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED' | null> = { START: 'IN_PROGRESS', RESOLVE: 'RESOLVED', DISMISS: 'DISMISSED', REOPEN: 'OPEN', COMMENT: null };

/** Ocorrências operacionais com histórico de tratamento; as de ponto podem ser geradas do espelho diário. */
@Injectable()
export class OccurrencesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly timesheet: TimesheetService) {}

  async list(tenantId: string, q: z.infer<typeof listSchema>) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const list = await tx.operationalOccurrence.findMany({
        where: { ...(q.status === 'ACTIVE' ? { status: { in: ['OPEN', 'IN_PROGRESS'] } } : { status: q.status }), ...(q.unitId ? { unitId: q.unitId } : {}), ...(q.type ? { type: q.type } : {}) },
        orderBy: { occurredAt: 'desc' }, take: 300, include: { events: { orderBy: { createdAt: 'asc' } } },
      });
      const empIds = [...new Set(list.flatMap((o) => [o.employmentId, o.responsibleId]).filter(Boolean) as string[])];
      const units = await tx.companyUnit.findMany({ where: { id: { in: [...new Set(list.map((o) => o.unitId))] } }, select: { id: true, name: true } });
      const emps = await tx.employment.findMany({ where: { id: { in: empIds } }, select: { id: true, registration: true, person: { select: { fullName: true } } } });
      const users = await tx.user.findMany({ where: { id: { in: [...new Set(list.flatMap((o) => o.events.map((e) => e.actorUserId)))] } }, select: { id: true, displayName: true } });
      const en = (i: string | null) => { const e = emps.find((x) => x.id === i); return e ? `${e.registration} — ${e.person.fullName}` : null; };
      return list.map((o) => ({
        id: o.id, unitId: o.unitId, unit: units.find((u) => u.id === o.unitId)?.name ?? '', type: o.type, title: o.title, description: o.description, occurredAt: o.occurredAt, status: o.status,
        employmentId: o.employmentId, employment: en(o.employmentId), responsibleId: o.responsibleId, responsible: en(o.responsibleId),
        events: o.events.map((e) => ({ action: e.action, notes: e.notes, at: e.createdAt, by: users.find((u) => u.id === e.actorUserId)?.displayName ?? '' })),
      }));
    });
  }

  /** Painel: abertas por tipo e unidade, paradas há mais de 24 h e tempo médio de solução (30 dias). */
  async stats(tenantId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const active = await tx.operationalOccurrence.findMany({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } }, select: { type: true, unitId: true, status: true, occurredAt: true } });
      const since = new Date(Date.now() - 30 * 86_400_000);
      const solved = await tx.operationalOccurrence.findMany({ where: { status: 'RESOLVED', updatedAt: { gte: since } }, select: { occurredAt: true, updatedAt: true } });
      const units = await tx.companyUnit.findMany({ where: { id: { in: [...new Set(active.map((a) => a.unitId))] } }, select: { id: true, name: true } });
      const group = <K extends string>(key: (a: (typeof active)[number]) => K) => Object.entries(active.reduce<Record<string, number>>((m, a) => { const k = key(a); m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
      const hours = solved.map((x) => (x.updatedAt.getTime() - x.occurredAt.getTime()) / 3_600_000).filter((h) => h >= 0);
      return {
        open: active.filter((a) => a.status === 'OPEN').length, inProgress: active.filter((a) => a.status === 'IN_PROGRESS').length,
        stale: active.filter((a) => Date.now() - a.occurredAt.getTime() > 24 * 3_600_000).length,
        resolved30d: solved.length, avgResolutionHours: hours.length ? Math.round((hours.reduce((t, h) => t + h, 0) / hours.length) * 10) / 10 : null,
        byType: group((a) => a.type).map(([type, n]) => ({ type, n })), byUnit: group((a) => a.unitId).map(([unitId, n]) => ({ unit: units.find((u) => u.id === unitId)?.name ?? '', n })),
      };
    });
  }

  async create(tenantId: string, user: AuthUser, input: z.infer<typeof occurrenceSchema>, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (!(await tx.companyUnit.findFirst({ where: { id: input.unitId, deletedAt: null } }))) throw new NotFoundException('Unidade não encontrada');
      for (const e of [input.employmentId, input.responsibleId]) if (e && !(await tx.employment.findFirst({ where: { id: e, deletedAt: null } }))) throw new NotFoundException('Funcionário não encontrado');
      const o = await tx.operationalOccurrence.create({ data: { tenantId, ...input, description: input.description ?? null, employmentId: input.employmentId ?? null, responsibleId: input.responsibleId ?? null, createdById: user.id } });
      await tx.operationalEvent.create({ data: { tenantId, occurrenceId: o.id, action: 'CREATE', actorUserId: user.id } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'operational_occurrence', entityId: o.id, after: o, ...meta });
      return o;
    });
  }

  async act(tenantId: string, user: AuthUser, occurrenceId: string, input: z.infer<typeof actionSchema>, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const o = await tx.operationalOccurrence.findFirst({ where: { id: occurrenceId } });
      if (!o) throw new NotFoundException('Ocorrência não encontrada');
      const status = NEXT[input.action];
      const data: { status?: typeof o.status; responsibleId?: string | null } = {};
      if (status) data.status = status;
      if (input.responsibleId !== undefined) data.responsibleId = input.responsibleId;
      const u = Object.keys(data).length ? await tx.operationalOccurrence.update({ where: { id: occurrenceId }, data }) : o;
      await tx.operationalEvent.create({ data: { tenantId, occurrenceId, action: input.action, notes: input.notes ?? null, actorUserId: user.id } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'operational_occurrence', entityId: occurrenceId, before: { status: o.status }, after: { status: u.status, action: input.action }, ...meta });
      return u;
    });
  }

  /**
   * Gera ocorrências de falta, atraso e marcação incompleta a partir do espelho diário (uma por
   * funcionário, tipo e dia: rodar de novo não duplica). Funcionário sem unidade fica de fora.
   */
  async generate(tenantId: string, user: AuthUser, q: z.infer<typeof generateSchema>, meta: RequestMeta) {
    const d = await this.timesheet.daily(tenantId, { companyId: q.companyId, date: q.date });
    const map: Record<string, { type: 'ABSENCE' | 'LATE' | 'MISSING_RECORD'; title: string }> = { ABSENT: { type: 'ABSENCE', title: 'Falta' }, LATE: { type: 'LATE', title: 'Atraso' }, INCOMPLETE: { type: 'MISSING_RECORD', title: 'Marcação incompleta' } };
    const at = new Date(`${q.date}T12:00:00-03:00`);
    return this.prisma.forTenant(tenantId, async (tx) => {
      let created = 0, skipped = 0, noUnit = 0;
      const units = new Map((await tx.employment.findMany({ where: { id: { in: d.rows.map((r) => r.employmentId) } }, select: { id: true, unitId: true } })).map((e) => [e.id, e.unitId]));
      for (const r of d.rows) {
        const m = map[r.situation];
        if (!m) continue;
        const unitId = units.get(r.employmentId);
        if (!unitId) { noUnit++; continue; }
        const exists = await tx.operationalOccurrence.findFirst({ where: { employmentId: r.employmentId, type: m.type, occurredAt: at } });
        if (exists) { skipped++; continue; }
        const late = r.day.result?.lateMinutes;
        const o = await tx.operationalOccurrence.create({ data: { tenantId, unitId, type: m.type, title: `${m.title}: ${r.name}`, description: m.type === 'LATE' && late ? `${late} min de atraso` : null, occurredAt: at, employmentId: r.employmentId, createdById: user.id } });
        await tx.operationalEvent.create({ data: { tenantId, occurrenceId: o.id, action: 'CREATE', notes: 'Gerada do espelho diário', actorUserId: user.id } });
        created++;
      }
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'operational_occurrence_batch', after: { ...q, created, skipped, noUnit }, ...meta });
      return { created, skipped, noUnit };
    });
  }
}

@ApiTags('operacional')
@ApiBearerAuth()
@Controller('v1/operational/occurrences')
export class OccurrencesController {
  constructor(private readonly svc: OccurrencesService) {}

  @Get()
  @RequirePermission('operational.board:read')
  list(@ActiveTenant() t: string, @Query({ schema: listSchema }) q: z.infer<typeof listSchema>) { return this.svc.list(t, q); }

  @Get('stats')
  @RequirePermission('operational.board:read')
  stats(@ActiveTenant() t: string) { return this.svc.stats(t); }

  @Post()
  @RequirePermission('operational.occurrences:manage')
  create(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: occurrenceSchema }) b: z.infer<typeof occurrenceSchema>, @RequestInfo() m: RequestMeta) { return this.svc.create(t, u, b, m); }

  @Post('generate')
  @RequirePermission('operational.occurrences:manage')
  generate(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: generateSchema }) b: z.infer<typeof generateSchema>, @RequestInfo() m: RequestMeta) { return this.svc.generate(t, u, b, m); }

  @Post(':id/actions')
  @RequirePermission('operational.occurrences:manage')
  act(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) oid: string, @Body({ schema: actionSchema }) b: z.infer<typeof actionSchema>, @RequestInfo() m: RequestMeta) { return this.svc.act(t, u, oid, b, m); }
}
