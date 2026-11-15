import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@superponto/database';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import { can } from '../authorization/authorization.js';
import type { RequestMeta } from '../common/tenant.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { assertOpenPeriod, ScheduleOverridesService } from '../schedules/schedules.service.js';
import { iso, toDate } from './timesheet.core.js';
import { AbsencesService, AdjustmentsService, myEmployments } from './timesheet.service.js';

const civil = z.iso.date();
const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário no formato HH:mm');
export const REQUEST_TYPES = ['RECORD_CORRECTION', 'ABSENCE_JUSTIFICATION', 'SCHEDULE_CHANGE', 'OVERTIME_AUTHORIZATION', 'OTHER'] as const;
const TYPE_LABEL: Record<string, string> = { RECORD_CORRECTION: 'Inclusão de marcação', ABSENCE_JUSTIFICATION: 'Justificativa de falta/atraso', SCHEDULE_CHANGE: 'Troca de folga', OVERTIME_AUTHORIZATION: 'Autorização de hora extra', OTHER: 'Outro pedido' };

const stepSchema = z.object({
  label: z.string().trim().min(2).max(60),
  /** SUPERVISOR = superior imediato do funcionário; ROLE = quem tem o perfil; PERMISSION = quem pode aprovar solicitações */
  approver: z.enum(['SUPERVISOR', 'ROLE', 'PERMISSION']),
  roleId: z.uuid().optional(),
}).refine((s) => s.approver !== 'ROLE' || !!s.roleId, { message: 'Escolha o perfil que aprova', path: ['roleId'] });
export const flowSchema = z.object({ companyId: z.uuid(), requestType: z.enum(REQUEST_TYPES), steps: z.array(stepSchema).min(1).max(5), isActive: z.boolean().default(true) });
export type FlowInput = z.infer<typeof flowSchema>;
type Step = z.infer<typeof stepSchema>;

export const requestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('RECORD_CORRECTION'), employmentId: z.uuid().optional(), refDate: civil, payload: z.object({ time: hm }), justification: z.string().trim().min(5).max(500) }),
  z.object({ type: z.literal('ABSENCE_JUSTIFICATION'), employmentId: z.uuid().optional(), refDate: civil, payload: z.object({ justificationId: z.uuid(), fullDay: z.boolean().default(true), minutes: z.number().int().min(1).max(1440).optional() }), justification: z.string().trim().min(5).max(500) }),
  z.object({ type: z.literal('SCHEDULE_CHANGE'), employmentId: z.uuid().optional(), refDate: civil, payload: z.object({ offDate: civil }), justification: z.string().trim().min(5).max(500) }),
  z.object({ type: z.literal('OVERTIME_AUTHORIZATION'), employmentId: z.uuid().optional(), refDate: civil, payload: z.object({ maxMinutes: z.number().int().min(1).max(720) }), justification: z.string().trim().min(5).max(500) }),
  z.object({ type: z.literal('OTHER'), employmentId: z.uuid().optional(), refDate: civil.optional(), payload: z.object({ subject: z.string().trim().min(3).max(120) }), justification: z.string().trim().min(5).max(500) }),
]);
export type RequestInput = z.infer<typeof requestSchema>;
export const requestDecisionSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), comment: z.string().trim().max(500).optional() })
  .refine((v) => v.decision === 'APPROVED' || (v.comment?.length ?? 0) >= 3, { message: 'Explique o motivo da recusa', path: ['comment'] });

const DEFAULT_STEPS: Step[] = [{ label: 'Aprovação', approver: 'PERMISSION' }];

@Injectable()
export class ApprovalFlowsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  list(tenantId: string, companyId: string) {
    return this.prisma.forTenant(tenantId, (tx) => tx.approvalFlow.findMany({ where: { companyId }, orderBy: { requestType: 'asc' } }));
  }

  save(tenantId: string, user: AuthUser, input: FlowInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (!(await tx.company.findFirst({ where: { id: input.companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
      for (const s of input.steps) if (s.roleId && !(await tx.role.findFirst({ where: { id: s.roleId, OR: [{ tenantId }, { tenantId: null }] } }))) throw new NotFoundException('Perfil não encontrado');
      const existing = await tx.approvalFlow.findFirst({ where: { companyId: input.companyId, requestType: input.requestType } });
      const f = existing
        ? await tx.approvalFlow.update({ where: { id: existing.id }, data: { steps: input.steps as Prisma.InputJsonValue, isActive: input.isActive } })
        : await tx.approvalFlow.create({ data: { tenantId, companyId: input.companyId, requestType: input.requestType, steps: input.steps as Prisma.InputJsonValue, isActive: input.isActive } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: existing ? 'UPDATE' : 'CREATE', entity: 'approval_flow', entityId: f.id, before: existing, after: f, ...meta });
      return f;
    });
  }
}

/** Solicitações do funcionário com aprovação em níveis; ao aprovar no último nível, o efeito é aplicado. */
@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService, private readonly audit: AuditService,
    private readonly adjustments: AdjustmentsService, private readonly absences: AbsencesService, private readonly overrides: ScheduleOverridesService,
  ) {}

  private shape(r: Prisma.TimeRequestGetPayload<{ include: { decisions: true; flow: true; employment: { select: { id: true; registration: true; companyId: true; person: { select: { fullName: true; socialName: true } } } } } }>) {
    const steps = ((r.flow?.steps as Step[] | undefined) ?? DEFAULT_STEPS);
    return {
      id: r.id, type: r.type, typeLabel: TYPE_LABEL[r.type], status: r.status, currentStep: r.currentStep, steps, refDate: r.refDate ? iso(r.refDate) : null,
      payload: r.payload, justification: r.justification, createdAt: r.createdAt, createdById: r.createdById,
      employee: { id: r.employment.id, registration: r.employment.registration, name: r.employment.person.socialName ?? r.employment.person.fullName },
      decisions: r.decisions.map((d) => ({ step: d.step, decision: d.decision, comment: d.comment, deciderId: d.deciderId, createdAt: d.createdAt })),
    };
  }
  private include = { decisions: { orderBy: { createdAt: 'asc' } }, flow: true, employment: { select: { id: true, registration: true, companyId: true, person: { select: { fullName: true, socialName: true } } } } } as const;

  async create(tenantId: string, user: AuthUser, input: RequestInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      let employmentId = input.employmentId;
      if (!employmentId || user.personId) {
        const mine = user.personId ? await myEmployments(tx, user) : [];
        if (!employmentId) {
          if (!mine.length) throw new ForbiddenException('Seu usuário não está ligado a um funcionário: peça ao RH para fazer o vínculo em Usuários');
          employmentId = mine[0]!.id;
        } else if (!mine.some((m) => m.id === employmentId) && !can(user, 'time.adjustments:create')) {
          throw new ForbiddenException('Você só pode abrir solicitações para os seus vínculos');
        }
      } else if (!can(user, 'time.adjustments:create')) throw new ForbiddenException('Você só pode abrir solicitações para os seus vínculos');
      const e = await tx.employment.findFirst({ where: { id: employmentId, deletedAt: null } });
      if (!e) throw new NotFoundException('Funcionário não encontrado');
      if (input.refDate) await assertOpenPeriod(tx, [e.companyId], input.refDate, input.type === 'SCHEDULE_CHANGE' ? [input.refDate, input.payload.offDate].sort()[1]! : input.refDate);
      if (input.type === 'ABSENCE_JUSTIFICATION' && !(await tx.justification.findFirst({ where: { id: input.payload.justificationId, deletedAt: null, active: true } }))) throw new NotFoundException('Justificativa não encontrada');
      if (input.type === 'ABSENCE_JUSTIFICATION' && !input.payload.fullDay && !input.payload.minutes) throw new BadRequestException('Informe os minutos');
      const flow = await tx.approvalFlow.findFirst({ where: { companyId: e.companyId, requestType: input.type, isActive: true } });
      const r = await tx.timeRequest.create({
        data: { tenantId, employmentId: e.id, type: input.type, refDate: input.refDate ? toDate(input.refDate) : null, payload: input.payload as Prisma.InputJsonValue, justification: input.justification, flowId: flow?.id ?? null, createdById: user.id },
        include: this.include,
      });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'time_request', entityId: r.id, after: r, ...meta });
      return this.shape(r);
    });
  }

  /** O usuário pode decidir o nível atual desta solicitação? */
  private async canDecide(tx: Tx, user: AuthUser, r: { createdById: string; employmentId: string; currentStep: number; flow: { steps: unknown } | null }) {
    if (r.createdById === user.id) return false;
    if (user.personId) {
      const own = await tx.employment.count({ where: { id: r.employmentId, personId: user.personId } });
      if (own) return false; // ninguém aprova o próprio pedido
    }
    const step = ((r.flow?.steps as Step[] | undefined) ?? DEFAULT_STEPS)[r.currentStep];
    if (!step) return false;
    if (step.approver === 'PERMISSION') return can(user, 'requests.requests:approve');
    if (step.approver === 'ROLE') return (await tx.userRole.count({ where: { userId: user.id, roleId: step.roleId } })) > 0;
    // SUPERVISOR: o usuário é a pessoa do superior imediato do vínculo
    if (!user.personId) return false;
    const e = await tx.employment.findFirst({ where: { id: r.employmentId }, select: { supervisor: { select: { personId: true } } } });
    return e?.supervisor?.personId === user.personId;
  }

  mine(tenantId: string, user: AuthUser) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const ids = user.personId ? (await tx.employment.findMany({ where: { personId: user.personId }, select: { id: true } })).map((e) => e.id) : [];
      const rows = await tx.timeRequest.findMany({ where: { OR: [{ createdById: user.id }, { employmentId: { in: ids } }] }, include: this.include, orderBy: { createdAt: 'desc' }, take: 200 });
      return rows.map((r) => this.shape(r));
    });
  }

  inbox(tenantId: string, user: AuthUser) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.timeRequest.findMany({ where: { status: 'PENDING' }, include: this.include, orderBy: { createdAt: 'asc' }, take: 500 });
      const out = [];
      for (const r of rows) if (await this.canDecide(tx, user, r)) out.push(this.shape(r));
      return out;
    });
  }

  list(tenantId: string, q: { status?: string; companyId?: string }) {
    return this.prisma.forTenant(tenantId, async (tx) => (await tx.timeRequest.findMany({
      where: { ...(q.status ? { status: q.status as 'PENDING' } : {}), ...(q.companyId ? { employment: { companyId: q.companyId } } : {}) },
      include: this.include, orderBy: { createdAt: 'desc' }, take: 500,
    })).map((r) => this.shape(r)));
  }

  async decide(tenantId: string, user: AuthUser, id: string, decision: 'APPROVED' | 'REJECTED', comment: string | undefined, meta: RequestMeta) {
    const r = await this.prisma.forTenant(tenantId, async (tx) => {
      const r = await tx.timeRequest.findFirst({ where: { id }, include: this.include });
      if (!r) throw new NotFoundException('Solicitação não encontrada');
      if (r.status !== 'PENDING') throw new ConflictException('Esta solicitação já foi decidida');
      if (!(await this.canDecide(tx, user, r))) throw new ForbiddenException('Você não é o aprovador desta etapa');
      return r;
    });
    const steps = (r.flow?.steps as Step[] | undefined) ?? DEFAULT_STEPS;
    const last = r.currentStep >= steps.length - 1;
    // Efeito antes de registrar a aprovação final: se não puder ser aplicado, nada muda.
    if (decision === 'APPROVED' && last) await this.apply(tenantId, user, r, meta);
    return this.prisma.forTenant(tenantId, async (tx) => {
      await tx.requestDecision.create({ data: { tenantId, requestId: id, step: r.currentStep, decision, comment: comment ?? null, deciderId: user.id } });
      const saved = await tx.timeRequest.update({
        where: { id }, include: this.include,
        data: decision === 'REJECTED' ? { status: 'REJECTED' } : last ? { status: 'APPROVED' } : { currentStep: r.currentStep + 1 },
      });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: decision === 'APPROVED' ? 'APPROVE' : 'REJECT', entity: 'time_request', entityId: id, after: { step: r.currentStep, decision, comment, final: last || decision === 'REJECTED' }, ...meta });
      return this.shape(saved);
    });
  }

  private async apply(tenantId: string, user: AuthUser, r: { id: string; type: string; employmentId: string; refDate: Date | null; payload: unknown; justification: string }, meta: RequestMeta) {
    const p = r.payload as Record<string, unknown>;
    const date = r.refDate ? iso(r.refDate) : null;
    switch (r.type) {
      case 'RECORD_CORRECTION':
        await this.adjustments.create(tenantId, user, { kind: 'INCLUDE', employmentId: r.employmentId, date: date!, time: p.time as string, justification: `Solicitação: ${r.justification}`.slice(0, 300) }, meta, r.id);
        break;
      case 'ABSENCE_JUSTIFICATION':
        await this.absences.createAllowances(tenantId, user, { employmentIds: [r.employmentId], from: date!, to: date!, justificationId: p.justificationId as string, fullDay: p.fullDay !== false, minutes: p.minutes as number | undefined, onlyWorkdays: false, note: `Solicitação: ${r.justification}`.slice(0, 300) }, meta);
        break;
      case 'SCHEDULE_CHANGE':
        await this.overrides.swap(tenantId, user, { kind: 'DAY_OFF', employmentId: r.employmentId, workDate: date!, offDate: p.offDate as string, note: `Solicitação: ${r.justification}`.slice(0, 300) }, meta);
        break;
      case 'OVERTIME_AUTHORIZATION':
        await this.prisma.forTenant(tenantId, async (tx) => {
          await tx.overtimeAuthorization.upsert({
            where: { employmentId_date: { employmentId: r.employmentId, date: toDate(date!) } },
            create: { tenantId, employmentId: r.employmentId, date: toDate(date!), maxMinutes: p.maxMinutes as number, requestId: r.id, note: r.justification.slice(0, 300), createdById: user.id },
            update: { maxMinutes: p.maxMinutes as number, requestId: r.id, note: r.justification.slice(0, 300) },
          });
        });
        break;
      default:
        break; // "Outro pedido": só registra a decisão
    }
  }

  cancel(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const r = await tx.timeRequest.findFirst({ where: { id }, include: this.include });
      if (!r) throw new NotFoundException('Solicitação não encontrada');
      if (r.createdById !== user.id) throw new ForbiddenException('Só quem abriu pode cancelar');
      if (r.status !== 'PENDING') throw new ConflictException('Só solicitações pendentes podem ser canceladas');
      const saved = await tx.timeRequest.update({ where: { id }, data: { status: 'CANCELLED' }, include: this.include });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'time_request', entityId: id, after: { status: 'CANCELLED' }, ...meta });
      return this.shape(saved);
    });
  }
}
