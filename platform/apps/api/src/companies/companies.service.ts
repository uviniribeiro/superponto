import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  /** Logo: PNG, JPEG ou WebP até 512 KB, enviado como data URL. */
  setLogo(tenantId: string, user: AuthUser, id: string, dataUrl: string, meta: RequestMeta) {
    const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!m) throw new BadRequestException('Envie uma imagem PNG, JPEG ou WebP');
    const data = Buffer.from(m[2]!, 'base64');
    if (data.length > 512 * 1024) throw new BadRequestException('O logo deve ter no máximo 512 KB');
    const mime = sniffImage(data);
    if (!mime) throw new BadRequestException('Arquivo não é uma imagem PNG, JPEG ou WebP válida');
    return this.prisma.forTenant(tenantId, async (tx) => {
      const allowed = companyFilter(user, 'org.companies:update');
      const c = await tx.company.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
      if (!c || (allowed && !allowed.includes(c.id))) throw new NotFoundException('Empresa não encontrada');
      await tx.companyLogo.upsert({ where: { companyId: id }, create: { companyId: id, tenantId, mime, data }, update: { mime, data } });
      const updated = await tx.company.update({ where: { id }, data: { logoUpdatedAt: new Date() } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'company', entityId: id, after: { logo: { mime, bytes: data.length } }, ...meta });
      return { logoUpdatedAt: updated.logoUpdatedAt };
    });
  }

  getLogo(tenantId: string, user: AuthUser, id: string) {
    const allowed = companyFilter(user, 'org.companies:read');
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (allowed && !allowed.includes(id)) throw new NotFoundException('Logo não encontrado');
      const logo = await tx.companyLogo.findFirst({ where: { companyId: id, company: { deletedAt: null } } });
      if (!logo) throw new NotFoundException('Logo não encontrado');
      return { dataUrl: `data:${logo.mime};base64,${Buffer.from(logo.data).toString('base64')}`, updatedAt: logo.updatedAt };
    });
  }

  removeLogo(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const allowed = companyFilter(user, 'org.companies:update');
      if (allowed && !allowed.includes(id)) throw new NotFoundException('Empresa não encontrada');
      const deleted = await tx.companyLogo.deleteMany({ where: { companyId: id } });
      if (!deleted.count) throw new NotFoundException('Logo não encontrado');
      await tx.company.update({ where: { id }, data: { logoUpdatedAt: null } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'company', entityId: id, after: { logo: null }, ...meta });
    });
  }
}

/** Tipo real da imagem pelos primeiros bytes (não confia na extensão nem no tipo declarado). */
export function sniffImage(buf: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}
