import { Body, ConflictException, Controller, Get, Post, Query } from '@nestjs/common';
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
