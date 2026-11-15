import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@superponto/database';
import { activeAssignment, resolveExpectedDay, type DayOverride, type ExpectedDay, type Schedule, type ScheduleAssignment as EngineAssignment } from '@superponto/time-engine';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import type { RequestMeta } from '../common/tenant.js';
import { HolidaysService } from '../holidays/holidays.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import {
  CYCLIC_TYPES, span, type AssignInput, type GridQuery, type OverrideCreate, type RuleSetCreate, type RuleSetUpdate, type ScheduleCreate, type ScheduleDayInput, type ScheduleUpdate, type SwapInput,
} from './schedules.schemas.js';

const isUnique = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
const toDate = (v: string) => new Date(`${v}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (v: string, n: number) => iso(new Date(toDate(v).getTime() + n * 86_400_000));
const hm = (m: number | null | undefined) => (m === null || m === undefined ? null : `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
function* daysBetween(from: string, to: string) { for (let d = from; d <= to; d = addDays(d, 1)) yield d; }

/** Carga semanal (média, nas escalas cíclicas) a partir dos dias. */
function weeklyMinutes(type: string, cycleDays: number | null | undefined, days: ScheduleDayInput[]) {
  const perDay = (d: ScheduleDayInput) => (!d.isWorkday ? 0 : d.startTime && d.endTime ? d.expectedMinutes || span(d.startTime, d.endTime) - d.breakMinutes : d.expectedMinutes ?? 0);
  const total = days.reduce((s, d) => s + perDay(d), 0);
  return CYCLIC_TYPES.has(type) && cycleDays ? Math.round((total * 7) / cycleDays) : total;
}

const SCHEDULE_INCLUDE = { days: { orderBy: { dayIndex: 'asc' } }, ruleSet: { select: { id: true, name: true } } } satisfies Prisma.WorkScheduleInclude;
type ScheduleRow = Prisma.WorkScheduleGetPayload<{ include: typeof SCHEDULE_INCLUDE }>;

export function toEngineSchedule(s: { type: string; cycleDays: number | null; considerHolidays: boolean; inItinereMinutes: number; entryMobilityMinutes: number; breakMobilityMinutes: number; days: Array<{ dayIndex: number; isWorkday: boolean; startTime: string | null; endTime: string | null; breakMinutes: number; breakStart: string | null; expectedMinutes: number }> }): Schedule {
  return {
    type: s.type as Schedule['type'], cycleDays: s.cycleDays, considerHolidays: s.considerHolidays, inItinereMinutes: s.inItinereMinutes,
    entryMobilityMinutes: s.entryMobilityMinutes, breakMobilityMinutes: s.breakMobilityMinutes,
    days: s.days.map((d) => ({ dayIndex: d.dayIndex, isWorkday: d.isWorkday, startTime: d.startTime, endTime: d.endTime, breakMinutes: d.breakMinutes, breakStart: d.breakStart, expectedMinutes: d.expectedMinutes || undefined })),
  };
}

/** Período fechado não aceita mudança de jornada (a apuração já foi conferida). */
export async function assertOpenPeriod(tx: Tx, companyIds: string[], from: string, to: string) {
  const closed = await tx.timeClosing.findFirst({ where: { companyId: { in: companyIds }, status: 'CLOSED', periodStart: { lte: toDate(to) }, periodEnd: { gte: toDate(from) } } });
  if (closed) throw new ConflictException(`Período fechado (${iso(closed.periodStart)} a ${iso(closed.periodEnd)}): reabra o fechamento para alterar a jornada`);
}

@Injectable()
export class WorkSchedulesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private shape(s: ScheduleRow, inUse?: number) {
    return { ...s, ...(inUse === undefined ? {} : { inUse }) };
  }

  private async one(tx: Tx, id: string) {
    const s = await tx.workSchedule.findFirst({ where: { id, deletedAt: null }, include: SCHEDULE_INCLUDE });
    if (!s) throw new NotFoundException('Horário não encontrado');
    return s;
  }

  private async checkRuleSet(tx: Tx, companyId: string, ruleSetId: string | null | undefined) {
    if (!ruleSetId) return;
    const r = await tx.attendanceRuleSet.findFirst({ where: { id: ruleSetId, deletedAt: null } });
    if (!r || r.companyId !== companyId) throw new BadRequestException('Regra de apuração não pertence a esta empresa');
  }

  private inUse(tx: Tx, id: string) {
    const today = toDate(iso(new Date()));
    return tx.scheduleAssignment.count({ where: { scheduleId: id, OR: [{ validTo: null }, { validTo: { gte: today } }], employment: { status: 'ACTIVE', deletedAt: null } } });
  }

  list(tenantId: string, companyId: string, includeInactive = false) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (!(await tx.company.findFirst({ where: { id: companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
      const rows = await tx.workSchedule.findMany({ where: { companyId, deletedAt: null, ...(includeInactive ? {} : {}) }, include: SCHEDULE_INCLUDE, orderBy: { name: 'asc' } });
      return Promise.all(rows.map(async (r) => this.shape(r, await this.inUse(tx, r.id))));
    });
  }

  get(tenantId: string, id: string) {
    return this.prisma.forTenant(tenantId, async (tx) => { const s = await this.one(tx, id); return this.shape(s, await this.inUse(tx, id)); });
  }

  private data(input: ScheduleUpdate) {
    const cyclic = CYCLIC_TYPES.has(input.type);
    return {
      name: input.name, code: input.code ?? null, type: input.type, cycleDays: cyclic ? input.cycleDays ?? null : null,
      considerHolidays: input.considerHolidays, inItinereMinutes: input.inItinereMinutes, entryMobilityMinutes: input.entryMobilityMinutes,
      breakMobilityMinutes: input.breakMobilityMinutes, ruleSetId: input.ruleSetId ?? null, weeklyMinutes: weeklyMinutes(input.type, input.cycleDays, input.days),
      ...(input.active === undefined ? {} : { active: input.active }),
    };
  }

  private days(tenantId: string, days: ScheduleDayInput[]) {
    return days.map((d) => ({
      tenantId, dayIndex: d.dayIndex, isWorkday: d.isWorkday, startTime: d.isWorkday ? d.startTime ?? null : null, endTime: d.isWorkday ? d.endTime ?? null : null,
      breakMinutes: d.isWorkday ? d.breakMinutes : 0, breakStart: d.isWorkday ? d.breakStart ?? null : null,
      expectedMinutes: !d.isWorkday ? 0 : d.startTime && d.endTime ? (d.expectedMinutes || span(d.startTime, d.endTime) - d.breakMinutes) : d.expectedMinutes ?? 0,
    }));
  }

  async create(tenantId: string, user: AuthUser, input: ScheduleCreate, meta: RequestMeta) {
    try {
      return await this.prisma.forTenant(tenantId, async (tx) => {
        if (!(await tx.company.findFirst({ where: { id: input.companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
        await this.checkRuleSet(tx, input.companyId, input.ruleSetId);
        const s = await tx.workSchedule.create({ data: { tenantId, companyId: input.companyId, ...this.data(input), days: { create: this.days(tenantId, input.days) } }, include: SCHEDULE_INCLUDE });
        await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'work_schedule', entityId: s.id, after: s, ...meta });
        return this.shape(s, 0);
      });
    } catch (e) {
      if (isUnique(e)) throw new ConflictException('Já existe um horário com este nome ou código nesta empresa');
      throw e;
    }
  }

  async update(tenantId: string, user: AuthUser, id: string, input: ScheduleUpdate, meta: RequestMeta) {
    try {
      return await this.prisma.forTenant(tenantId, async (tx) => {
        const before = await this.one(tx, id);
        await this.checkRuleSet(tx, before.companyId, input.ruleSetId);
        // Mudar um horário em uso muda a jornada prevista de quem o usa: o período fechado protege a apuração já conferida.
        if ((await this.inUse(tx, id)) > 0) await assertOpenPeriod(tx, [before.companyId], iso(new Date()), iso(new Date()));
        await tx.workScheduleDay.deleteMany({ where: { scheduleId: id } });
        const s = await tx.workSchedule.update({ where: { id }, data: { ...this.data(input), days: { create: this.days(tenantId, input.days) } }, include: SCHEDULE_INCLUDE });
        await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'work_schedule', entityId: id, before, after: s, ...meta });
        return this.shape(s, await this.inUse(tx, id));
      });
    } catch (e) {
      if (isUnique(e)) throw new ConflictException('Já existe um horário com este nome ou código nesta empresa');
      throw e;
    }
  }

  remove(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await this.one(tx, id);
      const used = await this.inUse(tx, id);
      if (used) throw new ConflictException(`Horário em uso por ${used} funcionário(s): atribua outro horário antes ou desative`);
      await tx.workSchedule.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'work_schedule', entityId: id, before, ...meta });
    });
  }

  /** Prévia dos próximos dias (sem feriados), para conferir o desenho da escala antes de atribuir. */
  preview(tenantId: string, id: string, from: string, cycleStart: string | undefined, days: number) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const s = await this.one(tx, id);
      const a: EngineAssignment = { schedule: toEngineSchedule(s), validFrom: from, cycleStart: cycleStart ?? from };
      return [...daysBetween(from, addDays(from, days - 1))].map((d) => viewDay(resolveExpectedDay(a, d)));
    });
  }
}

export function viewDay(e: ExpectedDay, extra: Record<string, unknown> = {}) {
  return {
    date: e.date, isWorkday: e.isWorkday, isHoliday: e.isHoliday, flexible: e.flexible, scheduled: !!e.scheduled,
    start: hm(e.start), end: hm(e.end), breakMinutes: e.breakMinutes, breakStart: hm(e.breakStart ?? null), expectedMinutes: e.expectedMinutes,
    overnight: e.end !== null && e.end > 1440, ...extra,
  };
}

@Injectable()
export class RuleSetsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private async one(tx: Tx, id: string) {
    const r = await tx.attendanceRuleSet.findFirst({ where: { id, deletedAt: null } });
    if (!r) throw new NotFoundException('Regra de apuração não encontrada');
    return r;
  }

  private usage(tx: Tx, id: string) {
    return Promise.all([tx.workSchedule.count({ where: { ruleSetId: id, deletedAt: null } }), tx.employment.count({ where: { ruleSetId: id, deletedAt: null } })]).then(([a, b]) => a + b);
  }

  list(tenantId: string, companyId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (!(await tx.company.findFirst({ where: { id: companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
      const rows = await tx.attendanceRuleSet.findMany({ where: { companyId, deletedAt: null }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });
      return Promise.all(rows.map(async (r) => ({ ...r, inUse: await this.usage(tx, r.id) })));
    });
  }

  create(tenantId: string, user: AuthUser, input: RuleSetCreate, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (!(await tx.company.findFirst({ where: { id: input.companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
      const first = !(await tx.attendanceRuleSet.count({ where: { companyId: input.companyId, deletedAt: null } }));
      const isDefault = input.isDefault || first;
      if (isDefault) await tx.attendanceRuleSet.updateMany({ where: { companyId: input.companyId }, data: { isDefault: false } });
      const r = await tx.attendanceRuleSet.create({ data: { tenantId, companyId: input.companyId, name: input.name, isDefault, rules: input.rules as Prisma.InputJsonValue } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'attendance_rule_set', entityId: r.id, after: r, ...meta });
      return { ...r, inUse: 0 };
    });
  }

  update(tenantId: string, user: AuthUser, id: string, input: RuleSetUpdate, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await this.one(tx, id);
      if (input.isDefault === false && before.isDefault) throw new BadRequestException('Escolha outra regra como padrão em vez de desmarcar esta');
      if (input.isDefault) await tx.attendanceRuleSet.updateMany({ where: { companyId: before.companyId, id: { not: id } }, data: { isDefault: false } });
      const r = await tx.attendanceRuleSet.update({ where: { id }, data: { name: input.name, isDefault: input.isDefault, ...(input.rules ? { rules: input.rules as Prisma.InputJsonValue } : {}) } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'attendance_rule_set', entityId: id, before, after: r, ...meta });
      return { ...r, inUse: await this.usage(tx, id) };
    });
  }

  remove(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await this.one(tx, id);
      const used = await this.usage(tx, id);
      if (used) throw new ConflictException(`Regra em uso por ${used} horário(s) ou funcionário(s)`);
      if (before.isDefault) throw new ConflictException('Não dá para excluir a regra padrão: escolha outra como padrão antes');
      await tx.attendanceRuleSet.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'attendance_rule_set', entityId: id, before, ...meta });
    });
  }
}

type EmploymentLite = { id: string; companyId: string; registration: string; status: string; person: { fullName: string; socialName: string | null } };

@Injectable()
export class ScheduleAssignmentsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  list(tenantId: string, employmentId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (!(await tx.employment.findFirst({ where: { id: employmentId, deletedAt: null } }))) throw new NotFoundException('Funcionário não encontrado');
      const rows = await tx.scheduleAssignment.findMany({ where: { employmentId }, orderBy: { validFrom: 'desc' }, include: { schedule: { select: { id: true, name: true, code: true, type: true, weeklyMinutes: true } } } });
      return rows.map((r) => ({ ...r, validFrom: iso(r.validFrom), validTo: r.validTo ? iso(r.validTo) : null, cycleStart: r.cycleStart ? iso(r.cycleStart) : null }));
    });
  }

  /**
   * Atribui o horário a vários funcionários a partir de uma data. A vigência anterior termina na
   * véspera; atribuições futuras (a partir da mesma data) são substituídas. Histórico preservado.
   */
  assign(tenantId: string, user: AuthUser, input: AssignInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const schedule = await tx.workSchedule.findFirst({ where: { id: input.scheduleId, deletedAt: null } });
      if (!schedule) throw new NotFoundException('Horário não encontrado');
      if (!schedule.active) throw new BadRequestException('Horário desativado: ative antes de atribuir');
      const ids = [...new Set(input.employmentIds)];
      const emps = await tx.employment.findMany({ where: { id: { in: ids }, deletedAt: null } });
      if (emps.length !== ids.length) throw new NotFoundException('Funcionário não encontrado');
      const other = emps.find((e) => e.companyId !== schedule.companyId);
      if (other) throw new BadRequestException(`O horário é de outra empresa (matrícula ${other.registration})`);
      const off = emps.find((e) => e.status === 'TERMINATED' && e.terminatedAt && iso(e.terminatedAt) < input.validFrom);
      if (off) throw new BadRequestException(`Matrícula ${off.registration} desligada antes da vigência`);
      await assertOpenPeriod(tx, [schedule.companyId], input.validFrom, input.validFrom);
      const from = toDate(input.validFrom);
      const eve = toDate(addDays(input.validFrom, -1));
      for (const e of emps) {
        const replaced = await tx.scheduleAssignment.findMany({ where: { employmentId: e.id, validFrom: { gte: from } } });
        if (replaced.length) await tx.scheduleAssignment.deleteMany({ where: { id: { in: replaced.map((r) => r.id) } } });
        await tx.scheduleAssignment.updateMany({ where: { employmentId: e.id, validFrom: { lt: from }, OR: [{ validTo: null }, { validTo: { gte: from } }] }, data: { validTo: eve } });
        const a = await tx.scheduleAssignment.create({ data: { tenantId, employmentId: e.id, scheduleId: schedule.id, validFrom: from, cycleStart: input.cycleStart ? toDate(input.cycleStart) : from } });
        await tx.employmentHistory.create({ data: { tenantId, employmentId: e.id, field: 'schedule', newValue: schedule.name, effectiveAt: from, reason: 'Atribuição de horário', actorUserId: user.id } });
        await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'schedule_assignment', entityId: a.id, after: { ...a, replaced: replaced.map((r) => r.id) }, ...meta });
      }
      return { assigned: emps.length };
    });
  }

  /** Desfaz a atribuição mais recente do funcionário; a anterior volta a valer sem data final. */
  remove(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const a = await tx.scheduleAssignment.findFirst({ where: { id }, include: { employment: true } });
      if (!a) throw new NotFoundException('Atribuição não encontrada');
      const latest = await tx.scheduleAssignment.findFirst({ where: { employmentId: a.employmentId }, orderBy: { validFrom: 'desc' } });
      if (latest?.id !== id) throw new ConflictException('Só a atribuição mais recente pode ser desfeita');
      await assertOpenPeriod(tx, [a.employment.companyId], iso(a.validFrom), iso(new Date()) > iso(a.validFrom) ? iso(new Date()) : iso(a.validFrom));
      await tx.scheduleAssignment.delete({ where: { id } });
      const prev = await tx.scheduleAssignment.findFirst({ where: { employmentId: a.employmentId }, orderBy: { validFrom: 'desc' } });
      if (prev) await tx.scheduleAssignment.update({ where: { id: prev.id }, data: { validTo: null } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'schedule_assignment', entityId: id, before: a, ...meta });
    });
  }
}

/** Jornada prevista de cada dia: atribuição vigente + escala agendada + feriados da empresa. */
@Injectable()
export class ExpectedScheduleService {
  constructor(private readonly prisma: PrismaService, private readonly holidays: HolidaysService) {}

  async holidayMap(tenantId: string, companyIds: string[], from: string, to: string) {
    const years = [...new Set([Number(from.slice(0, 4)), Number(to.slice(0, 4))])];
    const map = new Map<string, Map<string, { name: string; workday: boolean }>>();
    for (const c of companyIds) {
      const m = new Map<string, { name: string; workday: boolean }>();
      for (const y of years) for (const h of (await this.holidays.listForCompany(tenantId, c, y)).holidays) if (h.date >= from && h.date <= to) m.set(h.date, { name: h.name, workday: h.workday });
      map.set(c, m);
    }
    return map;
  }

  /** Dias previstos de um conjunto de vínculos (mesma transação do chamador). */
  async compute(tx: Tx, emps: EmploymentLite[], from: string, to: string, holidays: Map<string, Map<string, { name: string; workday: boolean }>>) {
    const raw = await this.computeEngine(tx, emps, from, to, holidays);
    return new Map([...raw].map(([id, days]) => [id, days.map((d) => d.view)]));
  }

  /** Igual a compute(), mas também devolve o dia no formato do motor e a regra de apuração do horário. */
  async computeEngine(tx: Tx, emps: Array<Pick<EmploymentLite, 'id' | 'companyId'>>, from: string, to: string, holidays: Map<string, Map<string, { name: string; workday: boolean }>>) {
    const ids = emps.map((e) => e.id);
    const [assignments, overrides] = await Promise.all([
      tx.scheduleAssignment.findMany({
        where: { employmentId: { in: ids }, validFrom: { lte: toDate(to) }, OR: [{ validTo: null }, { validTo: { gte: toDate(from) } }] },
        include: { schedule: { include: { days: true } } },
      }),
      tx.scheduleOverride.findMany({ where: { employmentId: { in: ids }, date: { gte: toDate(from), lte: toDate(to) } } }),
    ]);
    const result = new Map<string, Array<{ view: ReturnType<typeof viewDay>; engine: ExpectedDay; ruleSetId: string | null }>>();
    for (const e of emps) {
      const mine = assignments.filter((a) => a.employmentId === e.id).map((a) => ({
        id: a.id, name: a.schedule.name, code: a.schedule.code, ruleSetId: a.schedule.ruleSetId,
        engine: { schedule: toEngineSchedule(a.schedule), validFrom: iso(a.validFrom), validTo: a.validTo ? iso(a.validTo) : null, cycleStart: a.cycleStart ? iso(a.cycleStart) : null } as EngineAssignment,
      }));
      const ov = new Map(overrides.filter((o) => o.employmentId === e.id).map((o) => [iso(o.date), o]));
      const hol = holidays.get(e.companyId) ?? new Map();
      const days = [];
      for (const d of daysBetween(from, to)) {
        const active = activeAssignment(mine.map((m) => m.engine), d);
        const meta = active ? mine.find((m) => m.engine === active)! : null;
        const h = hol.get(d);
        const o = ov.get(d);
        const override: DayOverride | null = o ? { isWorkday: o.isWorkday, startTime: o.startTime, endTime: o.endTime, breakMinutes: o.breakMinutes, breakStart: o.breakStart } : null;
        const exp = resolveExpectedDay(active, d, h ? { date: d, isHoliday: true, isWorkday: h.workday } : null, override);
        days.push({
          engine: exp, ruleSetId: meta?.ruleSetId ?? null,
          view: viewDay(exp, {
            scheduleName: meta?.name ?? null, scheduleCode: meta?.code ?? null, holidayName: h && !h.workday ? h.name : null,
            overrideId: o?.id ?? null, origin: o?.origin ?? null, note: o?.note ?? null,
          }),
        });
      }
      result.set(e.id, days);
    }
    return result;
  }

  async forEmployee(tenantId: string, employmentId: string, from: string, to: string) {
    const emp = await this.prisma.forTenant(tenantId, (tx) => tx.employment.findFirst({ where: { id: employmentId, deletedAt: null }, select: { id: true, companyId: true, registration: true, status: true, person: { select: { fullName: true, socialName: true } } } }));
    if (!emp) throw new NotFoundException('Funcionário não encontrado');
    const hol = await this.holidayMap(tenantId, [emp.companyId], from, to);
    const days = await this.prisma.forTenant(tenantId, (tx) => this.compute(tx, [emp], from, to, hol));
    const list = days.get(emp.id)!;
    return { employmentId, from, to, days: list, expectedMinutes: list.reduce((s, d) => s + d.expectedMinutes, 0) };
  }

  /** Grade da equipe (escala do período) com filtros de departamento e agrupamento. */
  async grid(tenantId: string, q: GridQuery) {
    const emps = await this.prisma.forTenant(tenantId, (tx) => tx.employment.findMany({
      where: {
        companyId: q.companyId, deletedAt: null, status: { not: 'TERMINATED' },
        ...(q.departmentId ? { departmentId: q.departmentId } : {}),
        ...(q.groupingId ? { groupings: { some: { groupingId: q.groupingId } } } : {}),
        ...(q.search ? { OR: [{ registration: { contains: q.search, mode: 'insensitive' } }, { person: { fullName: { contains: q.search, mode: 'insensitive' } } }] } : {}),
      },
      select: { id: true, companyId: true, registration: true, status: true, person: { select: { fullName: true, socialName: true } } },
      orderBy: { person: { fullName: 'asc' } }, take: 300,
    }));
    const hol = await this.holidayMap(tenantId, [q.companyId], q.from, q.to);
    const days = await this.prisma.forTenant(tenantId, (tx) => this.compute(tx, emps, q.from, q.to, hol));
    return {
      from: q.from, to: q.to, truncated: emps.length === 300,
      rows: emps.map((e) => ({ employmentId: e.id, registration: e.registration, name: e.person.socialName ?? e.person.fullName, days: days.get(e.id)! })),
    };
  }
}

@Injectable()
export class ScheduleOverridesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly expected: ExpectedScheduleService) {}

  list(tenantId: string, q: { from: string; to: string; employmentId?: string; companyId?: string }) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.scheduleOverride.findMany({
        where: { date: { gte: toDate(q.from), lte: toDate(q.to) }, ...(q.employmentId ? { employmentId: q.employmentId } : {}), ...(q.companyId ? { employment: { companyId: q.companyId } } : {}) },
        include: { employment: { select: { id: true, registration: true, person: { select: { fullName: true, socialName: true } } } } },
        orderBy: [{ date: 'asc' }], take: 2000,
      });
      return rows.map((r) => ({ ...r, date: iso(r.date), employment: { id: r.employment.id, registration: r.employment.registration, name: r.employment.person.socialName ?? r.employment.person.fullName } }));
    });
  }

  /** Lança trabalho/folga por dia para vários funcionários (substitui o lançamento anterior do mesmo dia). */
  create(tenantId: string, user: AuthUser, input: OverrideCreate, meta: RequestMeta) {
    const dates = [...daysBetween(input.from, input.to)].filter((d) => !input.weekdays?.length || input.weekdays.includes(toDate(d).getUTCDay()));
    if (!dates.length) throw new BadRequestException('Nenhum dia do período corresponde aos dias da semana escolhidos');
    const ids = [...new Set(input.employmentIds)];
    if (dates.length * ids.length > 20000) throw new BadRequestException('Lançamento grande demais: até 20.000 dias por vez');
    return this.prisma.forTenant(tenantId, async (tx) => {
      const emps = await tx.employment.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, companyId: true } });
      if (emps.length !== ids.length) throw new NotFoundException('Funcionário não encontrado');
      await assertOpenPeriod(tx, [...new Set(emps.map((e) => e.companyId))], dates[0]!, dates.at(-1)!);
      const plan = {
        isWorkday: input.isWorkday, startTime: input.isWorkday ? input.startTime ?? null : null, endTime: input.isWorkday ? input.endTime ?? null : null,
        breakMinutes: input.isWorkday ? input.breakMinutes : 0, breakStart: input.isWorkday ? input.breakStart ?? null : null, note: input.note ?? null,
      };
      await tx.scheduleOverride.deleteMany({ where: { employmentId: { in: ids }, date: { in: dates.map(toDate) } } });
      const { count } = await tx.scheduleOverride.createMany({ data: ids.flatMap((employmentId) => dates.map((d) => ({ tenantId, employmentId, date: toDate(d), ...plan, origin: 'AGENDADA', createdById: user.id }))) });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'schedule_override', after: { employments: ids.length, from: dates[0], to: dates.at(-1), days: dates.length, ...plan }, ...meta });
      return { created: count };
    });
  }

  remove(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const o = await tx.scheduleOverride.findFirst({ where: { id }, include: { employment: { select: { companyId: true } } } });
      if (!o) throw new NotFoundException('Lançamento não encontrado');
      await assertOpenPeriod(tx, [o.employment.companyId], iso(o.date), iso(o.date));
      await tx.scheduleOverride.delete({ where: { id } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'schedule_override', entityId: id, before: o, ...meta });
    });
  }

  /** Troca de escala (dois funcionários no mesmo dia) ou de folga (o mesmo funcionário entre dois dias). */
  async swap(tenantId: string, user: AuthUser, input: SwapInput, meta: RequestMeta) {
    const ids = input.kind === 'SHIFT' ? [input.employmentIdA, input.employmentIdB] : [input.employmentId];
    if (input.kind === 'SHIFT' && input.employmentIdA === input.employmentIdB) throw new BadRequestException('Escolha dois funcionários diferentes');
    if (input.kind === 'DAY_OFF' && input.workDate === input.offDate) throw new BadRequestException('Escolha dois dias diferentes');
    const emps = await this.prisma.forTenant(tenantId, (tx) => tx.employment.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, companyId: true, registration: true, status: true, person: { select: { fullName: true, socialName: true } } } }));
    if (emps.length !== ids.length) throw new NotFoundException('Funcionário não encontrado');
    if (new Set(emps.map((e) => e.companyId)).size > 1) throw new BadRequestException('A troca precisa ser entre funcionários da mesma empresa');
    const dates = input.kind === 'SHIFT' ? [input.date] : [input.workDate, input.offDate].sort();
    const hol = await this.expected.holidayMap(tenantId, [emps[0]!.companyId], dates[0]!, dates.at(-1)!);
    return this.prisma.forTenant(tenantId, async (tx) => {
      await assertOpenPeriod(tx, [emps[0]!.companyId], dates[0]!, dates.at(-1)!);
      const plan = await this.expected.compute(tx, emps, dates[0]!, dates.at(-1)!, hol);
      const pick = (emp: string, date: string) => plan.get(emp)!.find((d) => d.date === date)!;
      const write = async (employmentId: string, date: string, d: ReturnType<typeof pick>) => {
        await tx.scheduleOverride.deleteMany({ where: { employmentId, date: toDate(date) } });
        await tx.scheduleOverride.create({ data: {
          tenantId, employmentId, date: toDate(date), isWorkday: d.isWorkday && !d.flexible && !!d.start, startTime: d.isWorkday ? d.start : null, endTime: d.isWorkday ? d.end : null,
          breakMinutes: d.isWorkday ? d.breakMinutes : 0, breakStart: d.isWorkday ? d.breakStart : null, origin: 'TROCA', note: input.note, createdById: user.id,
        } });
      };
      if (input.kind === 'SHIFT') {
        const a = pick(input.employmentIdA, input.date), b = pick(input.employmentIdB, input.date);
        if (a.isWorkday === b.isWorkday && a.start === b.start && a.end === b.end) throw new BadRequestException('Os dois têm a mesma escala neste dia: não há o que trocar');
        if ((a.isWorkday && a.flexible) || (b.isWorkday && b.flexible)) throw new BadRequestException('Troca de escala só entre jornadas com horário definido');
        await write(input.employmentIdA, input.date, b);
        await write(input.employmentIdB, input.date, a);
      } else {
        const work = pick(input.employmentId, input.workDate), off = pick(input.employmentId, input.offDate);
        if (!work.isWorkday || !work.start) throw new BadRequestException('O dia de trabalho escolhido não tem jornada com horário');
        if (off.isWorkday) throw new BadRequestException('O dia escolhido para trabalhar já é dia de trabalho: escolha uma folga');
        await write(input.employmentId, input.offDate, work);
        await write(input.employmentId, input.workDate, off);
      }
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'schedule_swap', after: input, ...meta });
      return { ok: true };
    });
  }
}
