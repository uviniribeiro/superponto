import { Body, ConflictException, Controller, Get, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import { RequirePermission } from '../authorization/authorization.js';
import { currentPlan, LIMITS, usage } from '../common/limits.js';
import { ActiveTenant, RequestInfo, type RequestMeta } from '../common/tenant.js';
import { PrismaService } from '../prisma/prisma.service.js';

const limitsSchema = z.object({ 'limit.employments': z.number().int().min(1).max(1_000_000).nullable(), 'limit.devices': z.number().int().min(0).max(100_000).nullable(), 'limit.users': z.number().int().min(1).max(1_000_000).nullable() }).partial();
const planSchema = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,40}$/),
  name: z.string().trim().min(2).max(80),
  priceCents: z.number().int().min(0).max(100_000_000),
  interval: z.enum(['month', 'year']).default('month'),
  isPublic: z.boolean().default(true),
  limits: limitsSchema.default({}),
});
const subscriptionSchema = z.object({
  planId: z.uuid(),
  status: z.enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED']),
  currentPeriodEnd: z.iso.date(),
  trialEndsAt: z.iso.date().nullable().optional(),
  overrides: limitsSchema.default({}),
});
const id = { schema: z.uuid() };

const shapePlan = (p: { id: string; key: string; name: string; priceCents: number; currency: string; interval: string; isPublic: boolean; features: Array<{ key: string; value: unknown }> }) => ({
  id: p.id, key: p.key, name: p.name, priceCents: p.priceCents, currency: p.currency, interval: p.interval, isPublic: p.isPublic,
  limits: Object.fromEntries(p.features.filter((f) => f.key in LIMITS).map((f) => [f.key, f.value])),
});

/** Planos e assinaturas (equipe SuperPonto). A cobrança em si fica com o meio de pagamento contratado. */
@ApiTags('plataforma')
@ApiBearerAuth()
@Controller('v1/platform')
export class PlansController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get('plans')
  @RequirePermission('platform.plans:manage')
  async plans() {
    return (await this.prisma.asPlatform((tx) => tx.plan.findMany({ include: { features: true }, orderBy: { priceCents: 'asc' } }))).map(shapePlan);
  }

  private async writeFeatures(tx: Parameters<Parameters<PrismaService['asPlatform']>[0]>[0], planId: string, limits: Record<string, number | null | undefined>) {
    for (const [key, value] of Object.entries(limits)) {
      if (value === undefined) continue;
      if (value === null) await tx.planFeature.deleteMany({ where: { planId, key } });
      else await tx.planFeature.upsert({ where: { planId_key: { planId, key } }, create: { planId, key, value }, update: { value } });
    }
  }

  @Post('plans')
  @RequirePermission('platform.plans:manage')
  async createPlan(@CurrentUser() u: AuthUser, @Body({ schema: planSchema }) b: z.infer<typeof planSchema>, @RequestInfo() m: RequestMeta) {
    return this.prisma.asPlatform(async (tx) => {
      if (await tx.plan.findUnique({ where: { key: b.key } })) throw new ConflictException('Já existe um plano com esse identificador');
      const { limits, ...data } = b;
      const p = await tx.plan.create({ data });
      await this.writeFeatures(tx, p.id, limits);
      await this.audit.record(tx, { tenantId: null, actorUserId: u.id, action: 'CREATE', entity: 'plan', entityId: p.id, after: b, ...m });
      return shapePlan(await tx.plan.findUniqueOrThrow({ where: { id: p.id }, include: { features: true } }));
    });
  }

  @Put('plans/:id')
  @RequirePermission('platform.plans:manage')
  async updatePlan(@CurrentUser() u: AuthUser, @Param('id', id) pid: string, @Body({ schema: planSchema.omit({ key: true }) }) b: Omit<z.infer<typeof planSchema>, 'key'>, @RequestInfo() m: RequestMeta) {
    return this.prisma.asPlatform(async (tx) => {
      const before = await tx.plan.findUnique({ where: { id: pid }, include: { features: true } });
      if (!before) throw new NotFoundException('Plano não encontrado');
      const { limits, ...data } = b;
      await tx.plan.update({ where: { id: pid }, data });
      await this.writeFeatures(tx, pid, limits);
      await this.audit.record(tx, { tenantId: null, actorUserId: u.id, action: 'UPDATE', entity: 'plan', entityId: pid, before: shapePlan(before), after: b, ...m });
      return shapePlan(await tx.plan.findUniqueOrThrow({ where: { id: pid }, include: { features: true } }));
    });
  }

  /** Situação do cliente: assinatura, limites e uso. */
  @Get('tenants/:id/subscription')
  @RequirePermission('platform.tenants:manage')
  async tenantSubscription(@Param('id', id) tid: string) {
    return this.prisma.forTenant(tid, async (tx) => {
      const plan = await currentPlan(tx);
      const last = plan?.subscription ?? (await tx.subscription.findFirst({ orderBy: { createdAt: 'desc' }, include: { plan: { include: { features: true } } } }));
      return { subscription: last ? { id: last.id, status: last.status, planId: last.planId, planName: last.plan.name, currentPeriodEnd: last.currentPeriodEnd, trialEndsAt: last.trialEndsAt, overrides: last.overrides } : null, limits: plan?.limits ?? {}, usage: await usage(tx, tid) };
    });
  }

  /**
   * Define o plano do cliente (troca a assinatura vigente). SUSPENDED/CANCELLED também suspendem
   * o cliente (ninguém entra) e ACTIVE/TRIALING reativam.
   */
  @Put('tenants/:id/subscription')
  @RequirePermission('platform.tenants:manage')
  async setSubscription(@CurrentUser() u: AuthUser, @Param('id', id) tid: string, @Body({ schema: subscriptionSchema }) b: z.infer<typeof subscriptionSchema>, @RequestInfo() m: RequestMeta) {
    return this.prisma.asPlatform(async (tx) => {
      const tenant = await tx.tenant.findFirst({ where: { id: tid, deletedAt: null } });
      if (!tenant) throw new NotFoundException('Cliente não encontrado');
      if (!(await tx.plan.findUnique({ where: { id: b.planId } }))) throw new NotFoundException('Plano não encontrado');
      const overrides = Object.fromEntries(Object.entries(b.overrides).filter(([, v]) => v !== null && v !== undefined));
      const current = await tx.subscription.findFirst({ where: { tenantId: tid, status: { notIn: ['CANCELLED'] } }, orderBy: { createdAt: 'desc' } });
      const data = { planId: b.planId, status: b.status, currentPeriodEnd: new Date(`${b.currentPeriodEnd}T23:59:59-03:00`), trialEndsAt: b.trialEndsAt ? new Date(`${b.trialEndsAt}T23:59:59-03:00`) : null, overrides };
      const sub = current
        ? await tx.subscription.update({ where: { id: current.id }, data })
        : await tx.subscription.create({ data: { tenantId: tid, currentPeriodStart: new Date(), ...data } });
      const status = b.status === 'SUSPENDED' || b.status === 'CANCELLED' ? 'SUSPENDED' : b.status === 'TRIALING' ? 'TRIAL' : 'ACTIVE';
      if (tenant.status !== status) await tx.tenant.update({ where: { id: tid }, data: { status } });
      await this.audit.record(tx, { tenantId: tid, actorUserId: u.id, action: 'UPDATE', entity: 'subscription', entityId: sub.id, before: current, after: { ...b, tenantStatus: status }, ...m });
      return sub;
    });
  }
}

/** O cliente vê o próprio plano, limites e uso. */
@ApiTags('administração')
@ApiBearerAuth()
@Controller('v1/subscription')
export class MySubscriptionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('admin.users:read')
  async mine(@ActiveTenant() t: string) {
    return this.prisma.forTenant(t, async (tx) => {
      const plan = await currentPlan(tx);
      return { plan: plan ? { name: plan.subscription.plan.name, status: plan.subscription.status, currentPeriodEnd: plan.subscription.currentPeriodEnd, trialEndsAt: plan.subscription.trialEndsAt } : null, limits: plan?.limits ?? {}, usage: await usage(tx, t), labels: Object.fromEntries(Object.entries(LIMITS).map(([k, v]) => [k, v.label])) };
    });
  }
}
