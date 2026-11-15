import { Body, Controller, Get, Injectable, NotFoundException, Param, Put } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import { RequirePermission } from '../authorization/authorization.js';
import { ActiveTenant, RequestInfo, type RequestMeta } from '../common/tenant.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import type { CatalogConfig } from '../structure/catalog.factory.js';

const simple = z.object({ code: z.string().trim().min(1).max(20).optional(), name: z.string().trim().min(3).max(120), active: z.boolean().optional() });

/** CRUD do agrupamento (pela fábrica de cadastros). */
export const GROUPINGS: CatalogConfig = {
  path: 'groupings', model: 'grouping', entity: 'grouping', label: 'Agrupamento', gender: 'o',
  read: 'org.groupings:read', manage: 'org.groupings:manage',
  createSchema: simple, updateSchema: simple.partial(), searchFields: ['name', 'code'], orderBy: { name: 'asc' },
  usage: (tx: Tx, id: string) => tx.groupingEmployment.count({ where: { groupingId: id } }),
};

const membersSchema = z.object({
  employmentIds: z.array(z.uuid()).max(10000).optional(),
  positionIds: z.array(z.uuid()).max(2000).optional(),
  unitIds: z.array(z.uuid()).max(2000).optional(),
});

@Injectable()
export class GroupingMembersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private async grouping(tx: Tx, id: string) {
    const g = await tx.grouping.findFirst({ where: { id, deletedAt: null } });
    if (!g) throw new NotFoundException('Agrupamento não encontrado');
    return g;
  }

  get(tenantId: string, id: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.grouping(tx, id);
      const [employments, positions, units] = await Promise.all([
        tx.groupingEmployment.findMany({ where: { groupingId: id }, select: { employment: { select: { id: true, registration: true, status: true, person: { select: { fullName: true } } } } } }),
        tx.groupingPosition.findMany({ where: { groupingId: id }, select: { position: { select: { id: true, name: true } } } }),
        tx.groupingUnit.findMany({ where: { groupingId: id }, select: { unit: { select: { id: true, name: true } } } }),
      ]);
      return {
        employments: employments.map((e) => ({ id: e.employment.id, registration: e.employment.registration, status: e.employment.status, fullName: e.employment.person.fullName })),
        positions: positions.map((p) => p.position),
        units: units.map((u) => u.unit),
      };
    });
  }

  /** Substitui os membros informados (listas omitidas ficam como estão). */
  set(tenantId: string, user: AuthUser, id: string, input: z.infer<typeof membersSchema>, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.grouping(tx, id);
      const check = async (ids: string[] | undefined, model: 'employment' | 'jobPosition' | 'companyUnit', label: string) => {
        if (!ids?.length) return;
        const n = await (tx[model] as unknown as { count(a: unknown): Promise<number> }).count({ where: { id: { in: ids }, deletedAt: null } });
        if (n !== new Set(ids).size) throw new NotFoundException(`${label} não encontrado(a)`);
      };
      await check(input.employmentIds, 'employment', 'Funcionário');
      await check(input.positionIds, 'jobPosition', 'Cargo');
      await check(input.unitIds, 'companyUnit', 'Unidade');
      if (input.employmentIds) { await tx.groupingEmployment.deleteMany({ where: { groupingId: id } }); await tx.groupingEmployment.createMany({ data: [...new Set(input.employmentIds)].map((employmentId) => ({ groupingId: id, employmentId, tenantId })) }); }
      if (input.positionIds) { await tx.groupingPosition.deleteMany({ where: { groupingId: id } }); await tx.groupingPosition.createMany({ data: [...new Set(input.positionIds)].map((positionId) => ({ groupingId: id, positionId, tenantId })) }); }
      if (input.unitIds) { await tx.groupingUnit.deleteMany({ where: { groupingId: id } }); await tx.groupingUnit.createMany({ data: [...new Set(input.unitIds)].map((unitId) => ({ groupingId: id, unitId, tenantId })) }); }
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'grouping', entityId: id, after: { employments: input.employmentIds?.length, positions: input.positionIds?.length, units: input.unitIds?.length }, ...meta });
    }).then(() => this.get(tenantId, id));
  }
}

@ApiTags('estrutura')
@ApiBearerAuth()
@Controller('v1/groupings')
export class GroupingMembersController {
  constructor(private readonly svc: GroupingMembersService) {}

  @Get(':id/members')
  @RequirePermission('org.groupings:read')
  get(@ActiveTenant() tenantId: string, @Param('id', { schema: z.uuid() }) id: string) {
    return this.svc.get(tenantId, id);
  }

  @Put(':id/members')
  @RequirePermission('org.groupings:manage')
  set(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: z.uuid() }) id: string, @Body({ schema: membersSchema }) body: z.infer<typeof membersSchema>, @RequestInfo() meta: RequestMeta) {
    return this.svc.set(tenantId, user, id, body, meta);
  }
}
