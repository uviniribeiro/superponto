import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { can } from '../authorization/authorization.js';
import { ActiveTenant } from '../common/tenant.js';
import { HolidaysModule } from '../holidays/holidays.module.js';
import { HolidaysService } from '../holidays/holidays.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const SP_TZ = 'America/Sao_Paulo';
/** Data civil de hoje no fuso de Brasília (aaaa-mm-dd). */
const todayBr = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: SP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

/**
 * Resumo do painel inicial. Cada bloco só aparece com a permissão de leitura correspondente;
 * todos os números saem do banco (nada estimado).
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService, private readonly holidays: HolidaysService) {}

  async summary(tenantId: string, user: AuthUser, companyId?: string) {
    const today = todayBr();
    const [y, m] = today.split('-').map(Number) as [number, number];
    // Seis meses terminando no mês atual (rótulo aaaa-mm).
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(Date.UTC(y, m - 1 - (5 - i), 1));
      return d.toISOString().slice(0, 7);
    });
    const from = new Date(`${months[0]}-01T00:00:00Z`);

    const data = await this.prisma.forTenant(tenantId, async (tx) => {
      const out: Record<string, unknown> = {};
      if (can(user, 'people.employments:read')) {
        const base = { deletedAt: null, ...(companyId ? { companyId } : {}) };
        const [active, total, complete, hired, terminated] = await Promise.all([
          tx.employment.count({ where: { ...base, status: 'ACTIVE' } }),
          tx.employment.count({ where: base }),
          tx.employment.count({ where: { ...base, status: 'ACTIVE', departmentId: { not: null }, positionId: { not: null } } }),
          tx.employment.findMany({ where: { ...base, hiredAt: { gte: from } }, select: { hiredAt: true } }),
          tx.employment.findMany({ where: { ...base, terminatedAt: { gte: from } }, select: { terminatedAt: true } }),
        ]);
        const bucket = (dates: Array<Date | null>) => months.map((mo) => dates.filter((d) => d && d.toISOString().slice(0, 7) === mo).length);
        out.employees = {
          active, total, complete,
          months,
          hires: bucket(hired.map((h) => h.hiredAt)),
          terminations: bucket(terminated.map((t) => t.terminatedAt)),
        };
      }
      if (can(user, 'org.companies:read')) {
        const [companies, departments, positions, groupings] = await Promise.all([
          tx.company.count({ where: { deletedAt: null } }),
          can(user, 'org.departments:read') ? tx.department.count({ where: { deletedAt: null, ...(companyId ? { companyId } : {}) } }) : null,
          can(user, 'org.positions:read') ? tx.jobPosition.count({ where: { deletedAt: null, ...(companyId ? { companyId } : {}) } }) : null,
          can(user, 'org.groupings:read') ? tx.grouping.count({ where: { deletedAt: null } }) : null,
        ]);
        out.structure = { companies, departments, positions, groupings };
      }
      if (can(user, 'admin.users:read')) {
        const now = new Date();
        const hideSupport = !user.isPlatformAdmin && !user.isSupport;
        const [users, activeBlocks] = await Promise.all([
          tx.user.count({ where: { deletedAt: null, isActive: true, tenantId, ...(hideSupport ? { isSupport: false } : {}) } }),
          tx.userAccessBlock.count({ where: { revokedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }] } }),
        ]);
        out.access = { users, activeBlocks };
      }
      const first = companyId ?? (await tx.company.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true } }))?.id;
      return { out, holidayCompany: first ?? null };
    });

    let holidays: Array<{ date: string; name: string; scope: string }> | undefined;
    if (data.holidayCompany && can(user, 'org.holidays:read')) {
      const list = [
        ...(await this.holidays.listForCompany(tenantId, data.holidayCompany, y)).holidays,
        ...(m >= 11 ? (await this.holidays.listForCompany(tenantId, data.holidayCompany, y + 1)).holidays : []),
      ];
      holidays = list.filter((h) => h.date >= today && !h.workday).slice(0, 3).map((h) => ({ date: h.date, name: h.name, scope: h.scope }));
    }
    return { today, ...data.out, ...(holidays ? { holidays } : {}) };
  }
}

@ApiTags('painel')
@ApiBearerAuth()
@Controller('v1/dashboard')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  /** Sem permissão própria: cada bloco do resumo confere a permissão de leitura correspondente. */
  @Get('summary')
  summary(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Query({ schema: z.object({ companyId: z.uuid().optional() }) }) q: { companyId?: string }) {
    return this.svc.summary(tenantId, user, q.companyId);
  }
}

@Module({ imports: [HolidaysModule], controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
