import { Body, ConflictException, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser, PasswordResetService } from '@nestjs/authentication';
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
  admin: z.object({ email: z.email(), displayName: z.string().trim().min(2).max(200) }),
});
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

  /** Cria o cliente e seu primeiro administrador, que recebe um e-mail para definir a senha. */
  @Post()
  @RequirePermission('platform.tenants:manage')
  async create(@CurrentUser() actor: AuthUser, @Body({ schema: createTenantSchema }) body: CreateTenant, @RequestInfo() meta: RequestMeta) {
    const email = normalizeEmail(body.admin.email);
    const result = await this.prisma.asPlatform(async (tx) => {
      if (await tx.tenant.findUnique({ where: { slug: body.slug } })) throw new ConflictException('Identificador (slug) já em uso');
      if (await tx.user.findUnique({ where: { email } })) throw new ConflictException('E-mail do administrador já cadastrado');
      const tenant = await tx.tenant.create({ data: { name: body.name, slug: body.slug, document: body.document } });
      const role = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'company_admin' } });
      const admin = await tx.user.create({ data: { tenantId: tenant.id, email, displayName: body.admin.displayName } });
      await tx.userRole.create({ data: { userId: admin.id, roleId: role.id, tenantId: tenant.id, scope: 'TENANT' } });
      // Usuário de suporte e treinamento da equipe SuperPonto, criado junto com o cliente.
      const supportUser = await this.support.ensureInTx(tx, tenant);
      await this.audit.record(tx, { tenantId: tenant.id, actorUserId: actor.id, action: 'CREATE', entity: 'tenant', entityId: tenant.id, after: { tenant, adminEmail: email }, ...meta });
      return { tenant, adminId: admin.id, supportEmail: supportUser.email };
    });
    this.passwordReset.request(email);
    this.support.sendAccess(result.supportEmail);
    return result;
  }
}
