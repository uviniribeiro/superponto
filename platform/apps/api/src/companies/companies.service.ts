import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { normalizeCnpj } from '@superponto/br-docs';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import type { PageQuery, RequestMeta } from '../common/tenant.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CompanyInput, CompanyUpdate } from './companies.schemas.js';

/** Empresas visíveis: todas do tenant (escopo TENANT) ou só as atribuídas (escopo COMPANY). */
function companyFilter(user: AuthUser, permission: string): string[] | null {
  if (user.isPlatformAdmin) return null;
  const grants = user.grants.filter((g) => g.permission === permission);
  if (grants.some((g) => g.scope === 'TENANT' || g.scope === 'PLATFORM')) return null;
  return grants.filter((g) => g.scope === 'COMPANY' && g.companyId).map((g) => g.companyId!);
}

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  list(tenantId: string, user: AuthUser, q: PageQuery) {
    const allowed = companyFilter(user, 'org.companies:read');
    return this.prisma.forTenant(tenantId, async (tx) => {
      const where = {
        deletedAt: null,
        ...(allowed ? { id: { in: allowed } } : {}),
        ...(q.search ? { OR: [{ legalName: { contains: q.search, mode: 'insensitive' as const } }, { tradeName: { contains: q.search, mode: 'insensitive' as const } }, { cnpj: { contains: normalizeCnpj(q.search) || q.search, mode: 'insensitive' as const } }] } : {}),
      };
      const [data, total] = await Promise.all([
        tx.company.findMany({ where, orderBy: { legalName: 'asc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
        tx.company.count({ where }),
      ]);
      return { data, page: q.page, pageSize: q.pageSize, total };
    });
  }

  get(tenantId: string, user: AuthUser, id: string) {
    const allowed = companyFilter(user, 'org.companies:read');
    return this.prisma.forTenant(tenantId, async (tx) => {
      const company = await tx.company.findFirst({ where: { id, deletedAt: null } });
      if (!company || (allowed && !allowed.includes(company.id))) throw new NotFoundException('Empresa não encontrada');
      return company;
    });
  }

  create(tenantId: string, user: AuthUser, input: CompanyInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (input.cnpj && (await tx.company.findFirst({ where: { cnpj: input.cnpj } }))) {
        throw new ConflictException('Já existe uma empresa com este CNPJ nesta organização');
      }
      const company = await tx.company.create({ data: { ...input, tenantId } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'company', entityId: company.id, after: company, ...meta });
      return company;
    });
  }

  update(tenantId: string, user: AuthUser, id: string, input: CompanyUpdate, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await tx.company.findFirst({ where: { id, deletedAt: null } });
      const allowed = companyFilter(user, 'org.companies:update');
      if (!before || (allowed && !allowed.includes(before.id))) throw new NotFoundException('Empresa não encontrada');
      if (input.cnpj && input.cnpj !== before.cnpj && (await tx.company.findFirst({ where: { cnpj: input.cnpj } }))) {
        throw new ConflictException('Já existe uma empresa com este CNPJ nesta organização');
      }
      const after = await tx.company.update({ where: { id }, data: input });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'company', entityId: id, before, after, ...meta });
      return after;
    });
  }

  remove(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await tx.company.findFirst({ where: { id, deletedAt: null } });
      const allowed = companyFilter(user, 'org.companies:delete');
      if (!before || (allowed && !allowed.includes(before.id))) throw new NotFoundException('Empresa não encontrada');
      const active = await tx.employment.count({ where: { companyId: id, status: { not: 'TERMINATED' }, deletedAt: null } });
      if (active > 0) throw new ConflictException(`A empresa tem ${active} vínculo(s) ativo(s); desligue-os antes de excluir`);
      await tx.company.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'company', entityId: id, before, ...meta });
    });
  }
}
