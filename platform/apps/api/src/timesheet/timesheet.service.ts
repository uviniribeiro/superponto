import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import { can } from '../authorization/authorization.js';
import { sha256Hex } from '../common/crypto.js';
import type { RequestMeta } from '../common/tenant.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { assertOpenPeriod, ExpectedScheduleService } from '../schedules/schedules.service.js';
import { addDays, daysBetween, EMP_SELECT, iso, local, TimesheetCore, toDate, type Emp } from './timesheet.core.js';
import type { AdjustmentInput, AllowanceInput, LeaveInput, OnCallInput, PunchInput } from './timesheet.schemas.js';

const span = (s: string, e: string) => { const a = Number(s.slice(0, 2)) * 60 + Number(s.slice(3)); let b = Number(e.slice(0, 2)) * 60 + Number(e.slice(3)); if (b <= a) b += 1440; return b - a; };

/** Vínculos do usuário logado (pela pessoa ligada ao usuário). */
export async function myEmployments(tx: Tx, user: AuthUser) {
  if (!user.personId) throw new ForbiddenException('Seu usuário não está ligado a um funcionário: peça ao RH para fazer o vínculo em Usuários');
  return tx.employment.findMany({ where: { personId: user.personId, deletedAt: null, status: { not: 'TERMINATED' } }, select: { ...EMP_SELECT, unit: { select: { latitude: true, longitude: true, geofenceM: true, name: true } }, company: { select: { legalName: true, tradeName: true, cnpj: true } } } });
}

/** Espelho de ponto, espelho diário e cálculo em lote. */
@Injectable()
export class TimesheetService {
  constructor(private readonly prisma: PrismaService, private readonly core: TimesheetCore, private readonly audit: AuditService) {}

  private async emp(tenantId: string, id: string) {
    const e = await this.prisma.forTenant(tenantId, (tx) => tx.employment.findFirst({ where: { id, deletedAt: null }, select: EMP_SELECT }));
    if (!e) throw new NotFoundException('Funcionário não encontrado');
    return e;
  }

  async mirror(tenantId: string, employmentId: string, from: string, to: string) {
    const e = await this.emp(tenantId, employmentId);
    const days = (await this.core.compute(tenantId, [e], from, to)).get(e.id)!;
    return { employment: { id: e.id, registration: e.registration, name: e.person.socialName ?? e.person.fullName, companyId: e.companyId }, from, to, days, summary: this.core.summary(days) };
  }

  async myMirror(tenantId: string, user: AuthUser, from: string, to: string, employmentId?: string) {
    const mine = await this.prisma.forTenant(tenantId, (tx) => myEmployments(tx, user));
    const e = employmentId ? mine.find((m) => m.id === employmentId) : mine[0];
    if (!e) throw new NotFoundException('Vínculo não encontrado');
    return this.mirror(tenantId, e.id, from, to);
  }

  /** Espelho diário: todos os funcionários da empresa num dia, com a situação de cada um. */
  async daily(tenantId: string, q: { companyId: string; date: string; departmentId?: string; groupingId?: string }) {
    const emps = await this.prisma.forTenant(tenantId, (tx) => tx.employment.findMany({
      where: {
        companyId: q.companyId, deletedAt: null, hiredAt: { lte: toDate(q.date) }, OR: [{ terminatedAt: null }, { terminatedAt: { gte: toDate(q.date) } }],
        ...(q.departmentId ? { departmentId: q.departmentId } : {}), ...(q.groupingId ? { groupings: { some: { groupingId: q.groupingId } } } : {}),
      },
      select: EMP_SELECT, orderBy: { person: { fullName: 'asc' } }, take: 500,
    }));
    const map = await this.core.compute(tenantId, emps, q.date, q.date);
    const rows = emps.map((e) => {
      const d = map.get(e.id)![0]!;
      const f = d.result?.flags ?? [];
      const situation = d.leave ? 'LEAVE' : d.allowance?.fullDay && d.allowance.disregardsDebits ? 'ALLOWANCE' : f.includes('ABSENCE') ? 'ABSENT' : f.includes('INCOMPLETE') ? 'INCOMPLETE'
        : !(d.expected as { isWorkday: boolean }).isWorkday && !d.punches.length ? 'OFF' : f.includes('LATE') ? 'LATE' : d.punches.length ? 'PRESENT' : 'EXPECTED';
      return { employmentId: e.id, registration: e.registration, name: e.person.socialName ?? e.person.fullName, situation, day: d };
    });
    const count = (s: string) => rows.filter((r) => r.situation === s).length;
    return { date: q.date, rows, totals: { present: count('PRESENT') + count('LATE'), late: count('LATE'), absent: count('ABSENT'), incomplete: count('INCOMPLETE'), off: count('OFF'), leave: count('LEAVE') + count('ALLOWANCE'), expected: count('EXPECTED') } };
  }

  async companyEmployments(tx: Tx, companyId: string, from: string, to: string, ids?: string[]) {
    return tx.employment.findMany({ where: { companyId, deletedAt: null, hiredAt: { lte: toDate(to) }, OR: [{ terminatedAt: null }, { terminatedAt: { gte: toDate(from) } }], ...(ids?.length ? { id: { in: ids } } : {}) }, select: EMP_SELECT });
  }

  /** Cálculo em lote: grava a apuração dos dias abertos do período. */
  async calculate(tenantId: string, user: AuthUser, q: { companyId: string; from: string; to: string; employmentIds?: string[] }, meta: RequestMeta) {
    const emps = await this.prisma.forTenant(tenantId, async (tx) => {
      if (!(await tx.company.findFirst({ where: { id: q.companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
      return this.companyEmployments(tx, q.companyId, q.from, q.to, q.employmentIds);
    });
    const map = await this.core.compute(tenantId, emps, q.from, q.to);
    const saved = await this.prisma.forTenant(tenantId, async (tx) => {
      const n = await this.core.persist(tx, tenantId, map);
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'time_calculation', after: { companyId: q.companyId, from: q.from, to: q.to, employments: emps.length, days: n }, ...meta });
      return n;
    });
    let pending = 0, unauthorized = 0, incomplete = 0;
    for (const days of map.values()) { const s = this.core.summary(days); pending += s.pendingAdjustments; unauthorized += s.unauthorizedOvertimeMinutes; incomplete += s.incompleteDays; }
    return { employments: emps.length, days: saved, pendingAdjustments: pending, incompleteDays: incomplete, unauthorizedOvertimeMinutes: unauthorized };
  }
}

/** Ajustes de marcação: incluir ou desconsiderar, com aprovação. As marcações originais nunca mudam. */
@Injectable()
export class AdjustmentsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  list(tenantId: string, q: { status?: string; companyId?: string; employmentId?: string }) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.timeRecordAdjustment.findMany({
        where: { ...(q.status ? { status: q.status as 'PENDING' } : {}), ...(q.employmentId ? { employmentId: q.employmentId } : {}) },
        include: { timeRecord: { select: { recordedAt: true, source: true } } }, orderBy: { createdAt: 'desc' }, take: 500,
      });
      const emps = await tx.employment.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.employmentId))] }, ...(q.companyId ? { companyId: q.companyId } : {}) }, select: { id: true, registration: true, person: { select: { fullName: true, socialName: true } } } });
      const byId = new Map(emps.map((e) => [e.id, e]));
      return rows.filter((r) => byId.has(r.employmentId)).map((r) => {
        const e = byId.get(r.employmentId)!;
        const at = r.recordedAt ?? r.timeRecord?.recordedAt ?? null;
        return { ...r, employee: { id: e.id, registration: e.registration, name: e.person.socialName ?? e.person.fullName }, when: at ? local(at) : null };
      });
    });
  }

  async create(tenantId: string, user: AuthUser, input: AdjustmentInput, meta: RequestMeta, requestId?: string) {
    const autoApprove = can(user, 'time.adjustments:approve') || !!requestId;
    return this.prisma.forTenant(tenantId, async (tx) => {
      const e = await tx.employment.findFirst({ where: { id: input.employmentId, deletedAt: null } });
      if (!e) throw new NotFoundException('Funcionário não encontrado');
      let recordedAt: Date | null = null;
      let date: string;
      if (input.kind === 'INCLUDE') {
        recordedAt = new Date(`${input.date}T${input.time}:00-03:00`);
        if (recordedAt.getTime() > Date.now() + 60_000) throw new BadRequestException('Não dá para incluir marcação no futuro');
        date = input.date;
      } else {
        const r = await tx.timeRecord.findFirst({ where: { id: input.timeRecordId, employmentId: e.id } });
        if (!r) throw new NotFoundException('Marcação não encontrada');
        const open = await tx.timeRecordAdjustment.findFirst({ where: { timeRecordId: r.id, kind: 'DISREGARD', status: { in: ['PENDING', 'APPROVED'] } } });
        if (open) throw new ConflictException('Esta marcação já tem um pedido para desconsiderar');
        date = local(r.recordedAt).date;
      }
      await assertOpenPeriod(tx, [e.companyId], date, date);
      const a = await tx.timeRecordAdjustment.create({ data: {
        tenantId, employmentId: e.id, kind: input.kind, timeRecordId: input.kind === 'DISREGARD' ? input.timeRecordId : null, recordedAt,
        justification: input.justification, status: autoApprove ? 'APPROVED' : 'PENDING', createdById: user.id, requestId: requestId ?? null,
        ...(autoApprove ? { decidedById: user.id, decidedAt: new Date() } : {}),
      } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'time_adjustment', entityId: a.id, after: a, ...meta });
      return a;
    });
  }

  decide(tenantId: string, user: AuthUser, id: string, approve: boolean, comment: string | undefined, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const a = await tx.timeRecordAdjustment.findFirst({ where: { id }, include: { timeRecord: true } });
      if (!a) throw new NotFoundException('Ajuste não encontrado');
      if (a.status !== 'PENDING') throw new ConflictException('Este ajuste já foi decidido');
      if (a.createdById === user.id) throw new ForbiddenException('Quem pediu o ajuste não pode aprová-lo');
      const e = await tx.employment.findFirstOrThrow({ where: { id: a.employmentId } });
      const date = local(a.recordedAt ?? a.timeRecord!.recordedAt).date;
      await assertOpenPeriod(tx, [e.companyId], date, date);
      const saved = await tx.timeRecordAdjustment.update({ where: { id }, data: { status: approve ? 'APPROVED' : 'REJECTED', decidedById: user.id, decidedAt: new Date() } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: approve ? 'APPROVE' : 'REJECT', entity: 'time_adjustment', entityId: id, before: a, after: { ...saved, comment }, ...meta });
      return saved;
    });
  }

  cancel(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const a = await tx.timeRecordAdjustment.findFirst({ where: { id } });
      if (!a) throw new NotFoundException('Ajuste não encontrado');
      if (a.status !== 'PENDING' && !(a.status === 'APPROVED' && can(user, 'time.adjustments:approve'))) throw new ConflictException('Só ajustes pendentes podem ser cancelados');
      const e = await tx.employment.findFirstOrThrow({ where: { id: a.employmentId } });
      const rec = a.timeRecordId ? await tx.timeRecord.findFirst({ where: { id: a.timeRecordId } }) : null;
      const date = local(a.recordedAt ?? rec!.recordedAt).date;
      await assertOpenPeriod(tx, [e.companyId], date, date);
      await tx.timeRecordAdjustment.update({ where: { id }, data: { status: 'CANCELLED', decidedById: user.id, decidedAt: new Date() } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'time_adjustment', entityId: id, before: a, after: { status: 'CANCELLED' }, ...meta });
    });
  }
}

/** Abonos (com limite de uso por justificativa), afastamentos e sobreaviso. */
@Injectable()
export class AbsencesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly expected: ExpectedScheduleService) {}

  listAllowances(tenantId: string, q: { from: string; to: string; companyId?: string; employmentId?: string }) {
    return this.prisma.forTenant(tenantId, async (tx) => (await tx.allowance.findMany({
      where: { date: { gte: toDate(q.from), lte: toDate(q.to) }, ...(q.employmentId ? { employmentId: q.employmentId } : {}), ...(q.companyId ? { employment: { companyId: q.companyId } } : {}) },
      include: { justification: { select: { id: true, name: true, code: true, disregardsDebits: true } }, employment: { select: { id: true, registration: true, person: { select: { fullName: true, socialName: true } } } } },
      orderBy: [{ date: 'desc' }], take: 2000,
    })).map((a) => ({ ...a, date: iso(a.date), employment: { id: a.employment.id, registration: a.employment.registration, name: a.employment.person.socialName ?? a.employment.person.fullName } })));
  }

  /** Abono em lote. Respeita o limite de uso da justificativa (por mês ou por ano) de cada funcionário. */
  async createAllowances(tenantId: string, user: AuthUser, input: AllowanceInput, meta: RequestMeta) {
    const ids = [...new Set(input.employmentIds)];
    const emps = await this.prisma.forTenant(tenantId, (tx) => tx.employment.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, companyId: true, registration: true } }));
    if (emps.length !== ids.length) throw new NotFoundException('Funcionário não encontrado');
    let plan: Map<string, Array<{ engine: { isWorkday: boolean } }>> | null = null;
    if (input.onlyWorkdays) {
      const hol = await this.expected.holidayMap(tenantId, [...new Set(emps.map((e) => e.companyId))], input.from, input.to);
      plan = await this.prisma.forTenant(tenantId, (tx) => this.expected.computeEngine(tx, emps, input.from, input.to, hol));
    }
    return this.prisma.forTenant(tenantId, async (tx) => {
      const j = await tx.justification.findFirst({ where: { id: input.justificationId, deletedAt: null } });
      if (!j) throw new NotFoundException('Justificativa não encontrada');
      if (!j.active) throw new BadRequestException('Justificativa inativa');
      await assertOpenPeriod(tx, [...new Set(emps.map((e) => e.companyId))], input.from, input.to);
      const all = [...daysBetween(input.from, input.to)];
      const rows: Array<{ employmentId: string; date: string }> = [];
      for (const e of emps) {
        const dates = plan ? all.filter((d, i) => plan!.get(e.id)![i]!.engine.isWorkday) : all;
        if (j.usageLimit) {
          // conta por mês/ano de cada data lançada, somando o que já existe
          const buckets = new Map<string, number>();
          for (const d of dates) { const k = j.limitPeriod === 'YEAR' ? d.slice(0, 4) : d.slice(0, 7); buckets.set(k, (buckets.get(k) ?? 0) + 1); }
          for (const [k, n] of buckets) {
            const start = j.limitPeriod === 'YEAR' ? `${k}-01-01` : `${k}-01`;
            const end = j.limitPeriod === 'YEAR' ? `${k}-12-31` : addDays(`${iso(new Date(Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)), 1)))}`, -1);
            const used = await tx.allowance.count({ where: { employmentId: e.id, justificationId: j.id, date: { gte: toDate(start), lte: toDate(end), notIn: dates.map(toDate) } } });
            if (used + n > j.usageLimit) throw new ConflictException(`Limite de "${j.name}" excedido para a matrícula ${e.registration}: ${j.usageLimit} por ${j.limitPeriod === 'YEAR' ? 'ano' : 'mês'} (já usado ${used})`);
          }
        }
        for (const d of dates) rows.push({ employmentId: e.id, date: d });
      }
      if (!rows.length) throw new BadRequestException('Nenhum dia de trabalho no período escolhido');
      await tx.allowance.deleteMany({ where: { OR: rows.map((r) => ({ employmentId: r.employmentId, date: toDate(r.date) })) } });
      const { count } = await tx.allowance.createMany({ data: rows.map((r) => ({ tenantId, employmentId: r.employmentId, date: toDate(r.date), justificationId: j.id, fullDay: input.fullDay, minutes: input.fullDay ? 0 : input.minutes!, note: input.note ?? null, createdById: user.id })) });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'allowance', after: { employments: emps.length, days: count, justification: j.name, from: input.from, to: input.to, fullDay: input.fullDay, minutes: input.minutes }, ...meta });
      return { created: count };
    });
  }

  removeAllowance(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const a = await tx.allowance.findFirst({ where: { id }, include: { employment: { select: { companyId: true } } } });
      if (!a) throw new NotFoundException('Abono não encontrado');
      await assertOpenPeriod(tx, [a.employment.companyId], iso(a.date), iso(a.date));
      await tx.allowance.delete({ where: { id } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'allowance', entityId: id, before: a, ...meta });
    });
  }

  listLeaves(tenantId: string, q: { from: string; to: string; companyId?: string; employmentId?: string }) {
    return this.prisma.forTenant(tenantId, async (tx) => (await tx.leave.findMany({
      where: { deletedAt: null, startDate: { lte: toDate(q.to) }, endDate: { gte: toDate(q.from) }, ...(q.employmentId ? { employmentId: q.employmentId } : {}), ...(q.companyId ? { employment: { companyId: q.companyId } } : {}) },
      include: { justification: { select: { id: true, name: true } }, employment: { select: { id: true, registration: true, person: { select: { fullName: true, socialName: true } } } } },
      orderBy: { startDate: 'desc' }, take: 1000,
    })).map((l) => ({ ...l, startDate: iso(l.startDate), endDate: iso(l.endDate), employment: { id: l.employment.id, registration: l.employment.registration, name: l.employment.person.socialName ?? l.employment.person.fullName } })));
  }

  createLeave(tenantId: string, user: AuthUser, input: LeaveInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const e = await tx.employment.findFirst({ where: { id: input.employmentId, deletedAt: null } });
      if (!e) throw new NotFoundException('Funcionário não encontrado');
      if (input.justificationId && !(await tx.justification.findFirst({ where: { id: input.justificationId, deletedAt: null } }))) throw new NotFoundException('Justificativa não encontrada');
      await assertOpenPeriod(tx, [e.companyId], input.startDate, input.endDate);
      const overlap = await tx.leave.findFirst({ where: { employmentId: e.id, deletedAt: null, startDate: { lte: toDate(input.endDate) }, endDate: { gte: toDate(input.startDate) } } });
      if (overlap) throw new ConflictException(`Já existe afastamento de ${iso(overlap.startDate)} a ${iso(overlap.endDate)} neste período`);
      const l = await tx.leave.create({ data: { tenantId, employmentId: e.id, type: input.type, startDate: toDate(input.startDate), endDate: toDate(input.endDate), justificationId: input.justificationId ?? null, note: input.note ?? null, createdById: user.id } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'leave', entityId: l.id, after: l, ...meta });
      return { ...l, startDate: iso(l.startDate), endDate: iso(l.endDate) };
    });
  }

  removeLeave(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const l = await tx.leave.findFirst({ where: { id, deletedAt: null }, include: { employment: { select: { companyId: true } } } });
      if (!l) throw new NotFoundException('Afastamento não encontrado');
      await assertOpenPeriod(tx, [l.employment.companyId], iso(l.startDate), iso(l.endDate));
      await tx.leave.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'leave', entityId: id, before: l, ...meta });
    });
  }

  createOnCall(tenantId: string, user: AuthUser, input: OnCallInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const ids = [...new Set(input.employmentIds)];
      const emps = await tx.employment.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, companyId: true } });
      if (emps.length !== ids.length) throw new NotFoundException('Funcionário não encontrado');
      await assertOpenPeriod(tx, [...new Set(emps.map((e) => e.companyId))], input.date, input.date);
      const minutes = span(input.startTime, input.endTime);
      const { count } = await tx.onCallPeriod.createMany({ data: ids.map((employmentId) => ({ tenantId, employmentId, date: toDate(input.date), startTime: input.startTime, endTime: input.endTime, minutes, note: input.note ?? null, createdById: user.id })) });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'on_call', after: { employments: ids.length, ...input, minutes }, ...meta });
      return { created: count, minutes };
    });
  }

  removeOnCall(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const o = await tx.onCallPeriod.findFirst({ where: { id }, include: { employment: { select: { companyId: true } } } });
      if (!o) throw new NotFoundException('Sobreaviso não encontrado');
      await assertOpenPeriod(tx, [o.employment.companyId], iso(o.date), iso(o.date));
      await tx.onCallPeriod.delete({ where: { id } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'on_call', entityId: id, before: o, ...meta });
    });
  }
}

const distanceM = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const R = 6_371_000, rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/**
 * Marcação pelo navegador. Proteção contra robôs: cada marcação exige um desafio assinado pela API,
 * de uso único e válido por 2 minutos, emitido para o usuário logado; limite de tentativas por minuto;
 * marcações repetidas em menos de 1 minuto são recusadas; cerca virtual da unidade, quando configurada.
 */
@Injectable()
export class PunchService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, @Inject(APP_CONFIG) private readonly config: AppConfig) {}

  private sign(payload: string) { return createHmac('sha256', `${this.config.JWT_SECRET}:punch`).update(payload).digest('base64url'); }

  challenge(user: AuthUser) {
    const body = Buffer.from(JSON.stringify({ u: user.id, n: randomBytes(16).toString('base64url'), exp: Date.now() + 120_000 })).toString('base64url');
    return { token: `${body}.${this.sign(body)}`, expiresInSeconds: 120 };
  }

  private verify(user: AuthUser, token: string): string {
    const [body, sig] = token.split('.');
    if (!body || !sig) throw new BadRequestException('Desafio inválido');
    const expected = Buffer.from(this.sign(body));
    const got = Buffer.from(sig);
    if (expected.length !== got.length || !timingSafeEqual(expected, got)) throw new BadRequestException('Desafio inválido');
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as { u: string; n: string; exp: number };
    if (p.u !== user.id) throw new BadRequestException('Desafio de outro usuário');
    if (p.exp < Date.now()) throw new BadRequestException('Desafio expirado: atualize a página e tente de novo');
    return p.n;
  }

  async me(tenantId: string, user: AuthUser) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const mine = await myEmployments(tx, user);
      const today = local(new Date()).date;
      const from = new Date(`${today}T00:00:00-03:00`);
      const records = await tx.timeRecord.findMany({ where: { employmentId: { in: mine.map((m) => m.id) }, recordedAt: { gte: from } }, orderBy: { recordedAt: 'asc' }, select: { id: true, employmentId: true, recordedAt: true, source: true, hash: true } });
      return {
        today,
        employments: mine.map((m) => ({ id: m.id, registration: m.registration, company: m.company.tradeName ?? m.company.legalName, geofence: m.unit?.geofenceM ? { name: m.unit.name, radiusM: m.unit.geofenceM } : null })),
        punches: records.map((r) => ({ id: r.id, employmentId: r.employmentId, at: r.recordedAt.toISOString(), time: local(r.recordedAt).time, source: r.source, hash: r.hash.slice(0, 16) })),
      };
    });
  }

  async punch(tenantId: string, user: AuthUser, input: PunchInput, meta: RequestMeta) {
    const nonce = this.verify(user, input.token);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const mine = await myEmployments(tx, user);
      const e = input.employmentId ? mine.find((m) => m.id === input.employmentId) : mine.length === 1 ? mine[0] : undefined;
      if (!e) throw new BadRequestException(mine.length > 1 ? 'Escolha o vínculo da marcação' : 'Vínculo não encontrado');
      const now = new Date();
      const today = local(now).date;
      await assertOpenPeriod(tx, [e.companyId], today, today);
      if (e.unit?.geofenceM && e.unit.latitude !== null && e.unit.longitude !== null) {
        if (input.latitude === undefined || input.longitude === undefined) throw new ForbiddenException(`Sua unidade exige localização: permita o acesso à localização para marcar (${e.unit.name})`);
        const d = distanceM({ lat: Number(e.unit.latitude), lon: Number(e.unit.longitude) }, { lat: input.latitude, lon: input.longitude });
        if (d > e.unit.geofenceM + Math.min(input.accuracy ?? 0, 100)) throw new ForbiddenException(`Você está a ${Math.round(d)} m de ${e.unit.name}; a marcação vale até ${e.unit.geofenceM} m`);
      }
      const last = await tx.timeRecord.findFirst({ where: { employmentId: e.id }, orderBy: { recordedAt: 'desc' }, select: { recordedAt: true, hash: true } });
      if (last && now.getTime() - last.recordedAt.getTime() < 60_000) throw new ConflictException('Marcação repetida: aguarde 1 minuto entre marcações');
      const key = `web:${nonce}`;
      if (await tx.timeRecord.findFirst({ where: { idempotencyKey: key } })) throw new ConflictException('Este desafio já foi usado');
      const lastHash = (await tx.timeRecord.findFirst({ where: { employmentId: e.id }, orderBy: { receivedAt: 'desc' }, select: { hash: true } }))?.hash ?? null;
      const hash = sha256Hex([lastHash ?? '', e.id, now.toISOString(), 'WEB', nonce].join('|'));
      const r = await tx.timeRecord.create({ data: {
        tenantId, employmentId: e.id, recordedAt: now, source: 'WEB', hash, previousHash: lastHash, idempotencyKey: key,
        latitude: input.latitude ?? null, longitude: input.longitude ?? null, accuracyM: input.accuracy ?? null,
      } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'time_record', entityId: r.id, after: { employmentId: e.id, recordedAt: now, source: 'WEB', ip: meta.ip }, ...meta });
      // Comprovante (Portaria 671): dados da marcação para o trabalhador conferir.
      return {
        id: r.id, recordedAt: now.toISOString(), date: today, time: local(now).time, hash,
        employee: e.person.socialName ?? e.person.fullName, registration: e.registration, company: e.company.tradeName ?? e.company.legalName, cnpj: e.company.cnpj,
      };
    });
  }
}
