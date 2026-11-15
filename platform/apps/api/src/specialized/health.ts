import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Injectable, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import { RequirePermission } from '../authorization/authorization.js';
import { ActiveTenant, RequestInfo, type RequestMeta } from '../common/tenant.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';

const id = { schema: z.uuid() };
const dt = z.iso.datetime({ offset: true }).transform((v) => new Date(v));
export const shiftSchema = z.object({
  unitId: z.uuid(),
  specialtyId: z.uuid().nullable().optional(),
  kind: z.enum(['DAY', 'NIGHT', 'H12', 'H24', 'ON_CALL', 'EXTRA', 'COVERAGE']),
  startsAt: dt,
  endsAt: dt,
  requiredProfessionals: z.number().int().min(1).max(50).default(1),
  notes: z.string().trim().max(500).nullable().optional(),
  /** cria o mesmo plantão nos próximos N dias (0 = só este) */
  repeatDays: z.number().int().min(0).max(62).default(0),
}).refine((s) => s.endsAt > s.startsAt && s.endsAt.getTime() - s.startsAt.getTime() <= 36 * 3600_000, { message: 'O fim deve ser depois do início (até 36 horas)', path: ['endsAt'] });
export type ShiftInput = z.infer<typeof shiftSchema>;
const listSchema = z.object({ unitId: z.uuid().optional(), from: z.iso.date(), to: z.iso.date() });
const statusSchema = z.object({ status: z.enum(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'ABSENT', 'CANCELLED']) });
const substitutionSchema = z.object({ substituteEmploymentId: z.uuid(), reason: z.string().trim().min(5).max(300) });
const decideSchema = z.object({ approve: z.boolean() });

const EMP = { select: { id: true, registration: true, person: { select: { fullName: true, socialName: true } } } } as const;
const nameOf = (e: { person: { fullName: string; socialName: string | null } }) => e.person.socialName ?? e.person.fullName;

/**
 * Plantões (saúde): escala de plantonistas por unidade, cobertura (necessários × escalados),
 * conflito de horário do profissional, situação de cada plantonista e troca com aprovação.
 * Só dados administrativos: nada de paciente ou informação clínica.
 */
@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(tenantId: string, q: z.infer<typeof listSchema>) {
    const from = new Date(`${q.from}T00:00:00-03:00`), to = new Date(new Date(`${q.to}T00:00:00-03:00`).getTime() + 86_400_000);
    if ((to.getTime() - from.getTime()) / 86_400_000 > 62) throw new BadRequestException('Período de até 62 dias');
    return this.prisma.forTenant(tenantId, async (tx) => {
      const shifts = await tx.medicalShift.findMany({
        where: { deletedAt: null, startsAt: { lt: to }, endsAt: { gt: from }, ...(q.unitId ? { unitId: q.unitId } : {}) },
        orderBy: { startsAt: 'asc' },
        include: { unit: { select: { name: true } }, specialty: { select: { name: true } }, assignments: { where: { status: { notIn: ['CANCELLED'] } }, include: { employment: EMP, substitutions: { where: { status: 'PENDING' } } } } },
      });
      return shifts.map((s) => {
        const active = s.assignments.filter((a) => a.status !== 'SUBSTITUTED' && a.status !== 'ABSENT');
        return {
          id: s.id, unitId: s.unitId, unit: s.unit.name, specialty: s.specialty?.name ?? null, kind: s.kind, startsAt: s.startsAt, endsAt: s.endsAt, notes: s.notes,
          requiredProfessionals: s.requiredProfessionals, covered: active.length, missing: Math.max(0, s.requiredProfessionals - active.length),
          assignments: s.assignments.map((a) => ({ id: a.id, employmentId: a.employmentId, name: nameOf(a.employment), registration: a.employment.registration, status: a.status, pendingSubstitution: a.substitutions[0]?.id ?? null })),
        };
      });
    });
  }

  private async unitOf(tx: Tx, unitId: string) {
    const u = await tx.companyUnit.findFirst({ where: { id: unitId, deletedAt: null }, select: { id: true, companyId: true } });
    if (!u) throw new NotFoundException('Unidade não encontrada');
    return u;
  }

  async create(tenantId: string, user: AuthUser, input: ShiftInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.unitOf(tx, input.unitId);
      if (input.specialtyId && !(await tx.specialty.findFirst({ where: { id: input.specialtyId } }))) throw new NotFoundException('Especialidade não encontrada');
      const { repeatDays, ...data } = input;
      const out = [];
      for (let i = 0; i <= repeatDays; i++) {
        const shift = (ms: Date) => new Date(ms.getTime() + i * 86_400_000);
        out.push(await tx.medicalShift.create({ data: { tenantId, ...data, specialtyId: data.specialtyId ?? null, notes: data.notes ?? null, startsAt: shift(data.startsAt), endsAt: shift(data.endsAt) } }));
      }
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'medical_shift', entityId: out[0]!.id, after: { ...input, created: out.length }, ...meta });
      return { created: out.length, ids: out.map((s) => s.id) };
    });
  }

  async update(tenantId: string, user: AuthUser, shiftId: string, input: ShiftInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await tx.medicalShift.findFirst({ where: { id: shiftId, deletedAt: null } });
      if (!before) throw new NotFoundException('Plantão não encontrado');
      await this.unitOf(tx, input.unitId);
      const { repeatDays: _r, ...data } = input;
      const s = await tx.medicalShift.update({ where: { id: shiftId }, data: { ...data, specialtyId: data.specialtyId ?? null, notes: data.notes ?? null } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'medical_shift', entityId: shiftId, before, after: s, ...meta });
      return s;
    });
  }

  async remove(tenantId: string, user: AuthUser, shiftId: string, meta: RequestMeta) {
    await this.prisma.forTenant(tenantId, async (tx) => {
      const before = await tx.medicalShift.findFirst({ where: { id: shiftId, deletedAt: null } });
      if (!before) throw new NotFoundException('Plantão não encontrado');
      await tx.medicalShift.update({ where: { id: shiftId }, data: { deletedAt: new Date() } });
      await tx.medicalShiftAssignment.updateMany({ where: { shiftId, status: { in: ['SCHEDULED', 'CONFIRMED'] } }, data: { status: 'CANCELLED' } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'medical_shift', entityId: shiftId, before, ...meta });
    });
  }

  /** Escala o profissional; recusa vínculo de outra empresa ou plantão no mesmo horário. */
  private async place(tx: Tx, tenantId: string, shiftId: string, employmentId: string) {
    const s = await tx.medicalShift.findFirst({ where: { id: shiftId, deletedAt: null }, include: { unit: { select: { companyId: true } } } });
    if (!s) throw new NotFoundException('Plantão não encontrado');
    const e = await tx.employment.findFirst({ where: { id: employmentId, deletedAt: null, status: { not: 'TERMINATED' } }, select: { companyId: true } });
    if (!e || e.companyId !== s.unit.companyId) throw new BadRequestException('Profissional não encontrado nesta empresa');
    const clash = await tx.medicalShiftAssignment.findFirst({
      where: { employmentId, shiftId: { not: shiftId }, status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] }, shift: { deletedAt: null, startsAt: { lt: s.endsAt }, endsAt: { gt: s.startsAt } } },
      include: { shift: { select: { startsAt: true } } },
    });
    if (clash) throw new ConflictException(`O profissional já está em outro plantão que começa em ${clash.shift.startsAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    const existing = await tx.medicalShiftAssignment.findUnique({ where: { shiftId_employmentId: { shiftId, employmentId } } });
    if (existing && !['CANCELLED', 'SUBSTITUTED', 'ABSENT'].includes(existing.status)) throw new ConflictException('Profissional já escalado neste plantão');
    return existing
      ? tx.medicalShiftAssignment.update({ where: { id: existing.id }, data: { status: 'SCHEDULED', checkInAt: null, checkOutAt: null } })
      : tx.medicalShiftAssignment.create({ data: { tenantId, shiftId, employmentId } });
  }

  async assign(tenantId: string, user: AuthUser, shiftId: string, employmentId: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const a = await this.place(tx, tenantId, shiftId, employmentId);
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'medical_shift_assignment', entityId: a.id, after: { shiftId, employmentId }, ...meta });
      return a;
    });
  }

  async setStatus(tenantId: string, user: AuthUser, assignmentId: string, status: z.infer<typeof statusSchema>['status'], meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await tx.medicalShiftAssignment.findFirst({ where: { id: assignmentId } });
      if (!before) throw new NotFoundException('Escala não encontrada');
      const now = new Date();
      const a = await tx.medicalShiftAssignment.update({ where: { id: assignmentId }, data: { status, ...(status === 'IN_PROGRESS' ? { checkInAt: now } : {}), ...(status === 'COMPLETED' ? { checkOutAt: now } : {}) } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'medical_shift_assignment', entityId: assignmentId, before: { status: before.status }, after: { status }, ...meta });
      return a;
    });
  }

  async requestSubstitution(tenantId: string, user: AuthUser, assignmentId: string, input: z.infer<typeof substitutionSchema>, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const a = await tx.medicalShiftAssignment.findFirst({ where: { id: assignmentId, status: { in: ['SCHEDULED', 'CONFIRMED'] } } });
      if (!a) throw new NotFoundException('Escala não encontrada ou já encerrada');
      if (a.employmentId === input.substituteEmploymentId) throw new BadRequestException('O substituto deve ser outro profissional');
      if (await tx.shiftSubstitution.findFirst({ where: { assignmentId, status: 'PENDING' } })) throw new ConflictException('Já há uma troca pendente para esta escala');
      const s = await tx.shiftSubstitution.create({ data: { tenantId, assignmentId, ...input } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'shift_substitution', entityId: s.id, after: input, ...meta });
      return s;
    });
  }

  /** Aprovar coloca o substituto (mesmas regras de conflito) e marca o original como substituído. */
  async decideSubstitution(tenantId: string, user: AuthUser, substitutionId: string, approve: boolean, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const s = await tx.shiftSubstitution.findFirst({ where: { id: substitutionId, status: 'PENDING' }, include: { assignment: true } });
      if (!s) throw new NotFoundException('Troca não encontrada ou já decidida');
      if (approve) {
        await this.place(tx, tenantId, s.assignment.shiftId, s.substituteEmploymentId);
        await tx.medicalShiftAssignment.update({ where: { id: s.assignmentId }, data: { status: 'SUBSTITUTED' } });
      }
      const d = await tx.shiftSubstitution.update({ where: { id: substitutionId }, data: { status: approve ? 'APPROVED' : 'REJECTED', decidedById: user.id } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: approve ? 'APPROVE' : 'REJECT', entity: 'shift_substitution', entityId: substitutionId, ...meta });
      return d;
    });
  }

  /** Plantões dos próximos dias do profissional logado. */
  async mine(tenantId: string, user: AuthUser) {
    if (!user.personId) return [];
    return this.prisma.forTenant(tenantId, async (tx) => {
      const list = await tx.medicalShiftAssignment.findMany({
        where: { employment: { personId: user.personId! }, status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] }, shift: { deletedAt: null, endsAt: { gt: new Date() } } },
        include: { shift: { include: { unit: { select: { name: true } } } } }, orderBy: { shift: { startsAt: 'asc' } }, take: 60,
      });
      return list.map((a) => ({ id: a.id, status: a.status, unit: a.shift.unit.name, kind: a.shift.kind, startsAt: a.shift.startsAt, endsAt: a.shift.endsAt }));
    });
  }
}

@ApiTags('saúde')
@ApiBearerAuth()
@Controller('v1/health')
export class ShiftsController {
  constructor(private readonly svc: ShiftsService) {}

  @Get('shifts')
  @RequirePermission('health.shifts:read')
  list(@ActiveTenant() t: string, @Query({ schema: listSchema }) q: z.infer<typeof listSchema>) { return this.svc.list(t, q); }

  @Get('shifts/mine')
  @RequirePermission('health.shifts:read')
  mine(@ActiveTenant() t: string, @CurrentUser() u: AuthUser) { return this.svc.mine(t, u); }

  @Post('shifts')
  @RequirePermission('health.shifts:manage')
  create(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: shiftSchema }) b: ShiftInput, @RequestInfo() m: RequestMeta) { return this.svc.create(t, u, b, m); }

  @Put('shifts/:id')
  @RequirePermission('health.shifts:manage')
  update(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) sid: string, @Body({ schema: shiftSchema }) b: ShiftInput, @RequestInfo() m: RequestMeta) { return this.svc.update(t, u, sid, b, m); }

  @Delete('shifts/:id')
  @HttpCode(204)
  @RequirePermission('health.shifts:manage')
  remove(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) sid: string, @RequestInfo() m: RequestMeta) { return this.svc.remove(t, u, sid, m); }

  @Post('shifts/:id/assign')
  @RequirePermission('health.shifts:manage')
  assign(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) sid: string, @Body({ schema: z.object({ employmentId: z.uuid() }) }) b: { employmentId: string }, @RequestInfo() m: RequestMeta) { return this.svc.assign(t, u, sid, b.employmentId, m); }

  @Post('assignments/:id/status')
  @HttpCode(200)
  @RequirePermission('health.shifts:manage')
  status(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) aid: string, @Body({ schema: statusSchema }) b: z.infer<typeof statusSchema>, @RequestInfo() m: RequestMeta) { return this.svc.setStatus(t, u, aid, b.status, m); }

  @Post('assignments/:id/substitution')
  @RequirePermission('health.shifts:manage')
  substitution(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) aid: string, @Body({ schema: substitutionSchema }) b: z.infer<typeof substitutionSchema>, @RequestInfo() m: RequestMeta) { return this.svc.requestSubstitution(t, u, aid, b, m); }

  @Post('substitutions/:id/decide')
  @HttpCode(200)
  @RequirePermission('health.shifts:manage')
  decide(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) sid: string, @Body({ schema: decideSchema }) b: { approve: boolean }, @RequestInfo() m: RequestMeta) { return this.svc.decideSubstitution(t, u, sid, b.approve, m); }
}
