import { Body, ConflictException, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, PasswordHasher, PasswordResetService } from '@nestjs/authentication';
import { randomInt } from 'node:crypto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { normalizeEmail } from '../auth/users.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { RequirePermission } from '../authorization/authorization.js';
import { cnpjSchema } from '../common/documents.js';
import { pageSchema, RequestInfo, type PageQuery, type RequestMeta } from '../common/tenant.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SupportProvisioningService } from '../users/support.service.js';

const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/, 'Use letras minúsculas, números e hífen'),
  /** CNPJ do titular do contrato (numérico ou alfanumérico). */
  document: cnpjSchema.optional(),
  /** Administrador do cliente. Sem e-mail, entra só por usuário (admin) + CNPJ + senha inicial, como na v1. */
  admin: z.object({ email: z.email().optional(), displayName: z.string().trim().min(2).max(200).optional() }).optional(),
});

/** Senha inicial legível (sem caracteres ambíguos), mostrada uma única vez ao Super Admin. */
export function initialPassword() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 12; i++) p += abc[randomInt(abc.length)];
  return `${p}#${randomInt(10, 99)}`;
}
type CreateTenant = z.infer<typeof createTenantSchema>;
const updateTenantSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']).optional(),
});
const resetSchema = z.object({ who: z.enum(['admin', 'support']) });

/** Administração global (equipe SuperPonto). */
@ApiTags('plataforma')
@ApiBearerAuth()
@Controller('v1/platform/tenants')
export class TenantsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly passwordReset: PasswordResetService,
    private readonly support: SupportProvisioningService,
  ) {}

  @Get()
  @RequirePermission('platform.tenants:manage')
  list(@Query({ schema: pageSchema }) q: PageQuery) {
    return this.prisma.asPlatform(async (tx) => {
      const where = { deletedAt: null, ...(q.search ? { name: { contains: q.search, mode: 'insensitive' as const } } : {}) };
      const [data, total] = await Promise.all([
        tx.tenant.findMany({ where, orderBy: { name: 'asc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
        tx.tenant.count({ where }),
      ]);
      return { data, page: q.page, pageSize: q.pageSize, total };
    });
  }

  /**
   * Painel do Super Admin: só números por cliente (empresas, CNPJs, usuários, funcionários ativos,
   * equipamentos) — nenhum dado de pessoa ou de ponto dos clientes.
   */
  @Get('overview')
  @RequirePermission('platform.tenants:manage')
  overview() {
    return this.prisma.asPlatform(async (tx) => {
      const tenants = await tx.tenant.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
      const rows = await tx.$queryRaw<Array<{ tenant_id: string; companies: number; cnpjs: string[] | null; users: number; employees: number; devices: number }>>`
        SELECT t.id AS tenant_id,
          (SELECT count(*)::int FROM companies c WHERE c.tenant_id = t.id AND c.deleted_at IS NULL) AS companies,
          (SELECT array_agg(c.cnpj ORDER BY c.created_at) FROM companies c WHERE c.tenant_id = t.id AND c.deleted_at IS NULL AND c.cnpj IS NOT NULL) AS cnpjs,
          (SELECT count(*)::int FROM users u WHERE u.tenant_id = t.id AND u.deleted_at IS NULL AND NOT u.is_support) AS users,
          (SELECT count(*)::int FROM employment_relationships e WHERE e.tenant_id = t.id AND e.deleted_at IS NULL AND e.status = 'ACTIVE') AS employees,
          (SELECT count(*)::int FROM devices d WHERE d.tenant_id = t.id AND d.deleted_at IS NULL) AS devices
        FROM tenants t WHERE t.deleted_at IS NULL`;
      const by = new Map(rows.map((r) => [r.tenant_id, r]));
      const data = tenants.map((t) => {
        const r = by.get(t.id);
        return { id: t.id, name: t.name, slug: t.slug, status: t.status, createdAt: t.createdAt, companies: r?.companies ?? 0, cnpjs: r?.cnpjs ?? [], users: r?.users ?? 0, employees: r?.employees ?? 0, devices: r?.devices ?? 0 };
      });
      const sum = (k: 'companies' | 'users' | 'employees' | 'devices') => data.reduce((a, x) => a + x[k], 0);
      return {
        totals: { tenants: data.length, active: data.filter((x) => x.status === 'ACTIVE' || x.status === 'TRIAL').length, suspended: data.filter((x) => x.status === 'SUSPENDED' || x.status === 'CANCELLED').length, companies: sum('companies'), users: sum('users'), employees: sum('employees'), devices: sum('devices') },
        data,
      };
    });
  }

  /** Renomeia, suspende ou reativa um cliente. Cliente suspenso ou cancelado não entra no sistema. */
  @Patch(':id')
  @RequirePermission('platform.tenants:manage')
  update(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: updateTenantSchema }) body: z.infer<typeof updateTenantSchema>, @RequestInfo() meta: RequestMeta) {
    return this.prisma.asPlatform(async (tx) => {
      const before = await tx.tenant.findFirst({ where: { id, deletedAt: null } });
      if (!before) throw new NotFoundException('Cliente não encontrado');
      const tenant = await tx.tenant.update({ where: { id }, data: body });
      // Suspenso/cancelado: encerra as sessões abertas do cliente.
      if (body.status === 'SUSPENDED' || body.status === 'CANCELLED') {
        const ids = (await tx.user.findMany({ where: { tenantId: id }, select: { id: true } })).map((u) => u.id);
        await tx.refreshToken.updateMany({ where: { userId: { in: ids } }, data: { revoked: true } });
      }
      await this.audit.record(tx, { tenantId: id, actorUserId: actor.id, action: 'UPDATE', entity: 'tenant', entityId: id, before, after: tenant, ...meta });
      return tenant;
    });
  }

  /** Nova senha inicial para o "admin" ou o "suporte" do cliente (mostrada uma única vez). */
  @Post(':id/reset-password')
  @RequirePermission('platform.tenants:manage')
  async resetPassword(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: resetSchema }) body: z.infer<typeof resetSchema>, @RequestInfo() meta: RequestMeta) {
    const password = initialPassword();
    const hash = await new PasswordHasher().hash(password);
    const user = await this.prisma.asPlatform(async (tx) => {
      const tenant = await tx.tenant.findFirst({ where: { id, deletedAt: null } });
      if (!tenant) throw new NotFoundException('Cliente não encontrado');
      let u = body.who === 'support'
        ? await tx.user.findFirst({ where: { tenantId: id, isSupport: true, deletedAt: null } })
        : await tx.user.findFirst({ where: { tenantId: id, username: 'admin', isSupport: false, deletedAt: null } });
      if (!u && body.who === 'support') u = await tx.user.findUniqueOrThrow({ where: { id: (await this.support.ensureInTx(tx, tenant, hash)).id } });
      if (!u) throw new NotFoundException('O cliente não tem usuário "admin"');
      await tx.user.update({ where: { id: u.id }, data: { passwordHash: hash, mustChangePassword: body.who === 'admin', isActive: true } });
      await tx.refreshToken.updateMany({ where: { userId: u.id }, data: { revoked: true } });
      await this.audit.record(tx, { tenantId: id, actorUserId: actor.id, action: 'UPDATE', entity: 'user', entityId: u.id, after: { passwordReset: body.who }, ...meta });
      return u;
    });
    return { username: user.username ?? (body.who === 'support' ? 'suporte' : 'admin'), password };
  }

  /**
   * Cria o cliente como na v1: a empresa com o CNPJ informado, o administrador (usuário "admin") e o
   * suporte (usuário "suporte", oculto e não editável pelo cliente). Os dois recebem senha inicial,
   * mostrada uma única vez nesta resposta e trocada no primeiro acesso.
   */
  @Post()
  @RequirePermission('platform.tenants:manage')
  async create(@CurrentUser() actor: AuthUser, @Body({ schema: createTenantSchema }) body: CreateTenant, @RequestInfo() meta: RequestMeta) {
    const realEmail = body.admin?.email ? normalizeEmail(body.admin.email) : null;
    const email = realEmail ?? `admin@${body.slug}.superponto.local`;
    const adminPassword = initialPassword(), supportPassword = initialPassword();
    const hasher = new PasswordHasher();
    const [adminHash, supportHash] = await Promise.all([hasher.hash(adminPassword), hasher.hash(supportPassword)]);
    const result = await this.prisma.asPlatform(async (tx) => {
      if (await tx.tenant.findUnique({ where: { slug: body.slug } })) throw new ConflictException('Identificador (slug) já em uso');
      if (await tx.user.findUnique({ where: { email } })) throw new ConflictException('E-mail do administrador já cadastrado');
      if (body.document && (await tx.company.findFirst({ where: { cnpj: body.document, deletedAt: null } }))) throw new ConflictException('Este CNPJ já pertence a outro cliente');
      const tenant = await tx.tenant.create({ data: { name: body.name, slug: body.slug, document: body.document } });
      // A empresa com o CNPJ do cliente: é por ela que o login "usuário + CNPJ" encontra o cliente.
      const company = body.document ? await tx.company.create({ data: { tenantId: tenant.id, legalName: body.name, cnpj: body.document } }) : null;
      const role = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'company_admin' } });
      const admin = await tx.user.create({ data: { tenantId: tenant.id, email, username: 'admin', displayName: body.admin?.displayName ?? 'Administrador', passwordHash: adminHash, mustChangePassword: true } });
      await tx.userRole.create({ data: { userId: admin.id, roleId: role.id, tenantId: tenant.id, scope: 'TENANT' } });
      // Usuário de suporte e treinamento da equipe SuperPonto, criado junto com o cliente.
      const supportUser = await this.support.ensureInTx(tx, tenant, supportHash);
      await this.audit.record(tx, { tenantId: tenant.id, actorUserId: actor.id, action: 'CREATE', entity: 'tenant', entityId: tenant.id, after: { tenant, adminEmail: email, companyId: company?.id ?? null }, ...meta });
      return { tenant, companyId: company?.id ?? null, adminId: admin.id, supportEmail: supportUser.email };
    });
    if (realEmail) this.passwordReset.request(realEmail);
    return {
      ...result,
      // Mostrado uma única vez: o banco guarda só o hash.
      credentials: { cnpj: body.document ?? null, admin: { username: 'admin', password: adminPassword }, support: { username: 'suporte', password: supportPassword } },
    };
  }
}
