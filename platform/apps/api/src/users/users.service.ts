import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PasswordResetService } from '@nestjs/authentication';
import type { AuthUser } from '../auth/auth-user.js';
import { normalizeEmail } from '../auth/users.repository.js';
import { AuditService } from '../audit/audit.service.js';
import type { PageQuery, RequestMeta } from '../common/tenant.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import type { UserCreate, UserUpdate } from './users.schemas.js';

const SELECT = {
  id: true, email: true, displayName: true, isActive: true, isSupport: true, lastLoginAt: true, createdAt: true,
  roles: { select: { role: { select: { id: true, key: true, name: true } } } },
} as const;

/**
 * Usuários do cliente. Regra do usuário de suporte: fica oculto da lista para os usuários do
 * cliente; quando o próprio suporte está logado, ele aparece, mas não pode ser editado.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly passwordReset: PasswordResetService) {}

  private shape(u: { id: string; email: string; displayName: string; isActive: boolean; isSupport: boolean; lastLoginAt: Date | null; createdAt: Date; roles: Array<{ role: { id: string; key: string; name: string } }> }, viewer: AuthUser) {
    return { ...u, roles: u.roles.map((r) => r.role), editable: !u.isSupport, isSelf: u.id === viewer.id };
  }

  list(tenantId: string, viewer: AuthUser, q: PageQuery) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const where = {
        tenantId, deletedAt: null, isPlatformAdmin: false,
        ...(viewer.isSupport ? {} : { isSupport: false }),
        ...(q.search ? { OR: [{ displayName: { contains: q.search, mode: 'insensitive' as const } }, { email: { contains: q.search, mode: 'insensitive' as const } }] } : {}),
      };
      const [rows, total] = await Promise.all([
        tx.user.findMany({ where, select: SELECT, orderBy: [{ isSupport: 'desc' }, { displayName: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
        tx.user.count({ where }),
      ]);
      return { data: rows.map((u) => this.shape(u, viewer)), page: q.page, pageSize: q.pageSize, total };
    });
  }

  /** Usuário editável pelo `viewer`; o de suporte some (404) ou fica bloqueado (403) se o próprio suporte pedir. */
  private async editable(tx: Tx, tenantId: string, viewer: AuthUser, id: string) {
    const u = await tx.user.findFirst({ where: { id, tenantId, deletedAt: null, isPlatformAdmin: false }, select: { ...SELECT } });
    if (!u || (u.isSupport && !viewer.isSupport)) throw new NotFoundException('Usuário não encontrado');
    if (u.isSupport) throw new ForbiddenException('O usuário de suporte não pode ser editado');
    return u;
  }

  private async assignableRoles(tx: Tx, tenantId: string, roleIds: string[]) {
    const roles = await tx.role.findMany({ where: { id: { in: roleIds }, deletedAt: null, OR: [{ tenantId }, { tenantId: null, isSystem: true }], NOT: { key: 'super_admin' } }, select: { id: true } });
    if (roles.length !== new Set(roleIds).size) throw new BadRequestException('Perfil inválido');
    return roles.map((r) => r.id);
  }

  async create(tenantId: string, actor: AuthUser, input: UserCreate, meta: RequestMeta) {
    const email = normalizeEmail(input.email);
    // E-mail é único na plataforma inteira: a checagem precisa enxergar todos os clientes
    // (sem revelar de qual cliente é a conta).
    if (await this.prisma.asPlatform((tx) => tx.user.count({ where: { email } }))) throw new ConflictException('Este e-mail já tem uma conta no SuperPonto');
    const result = await this.prisma.forTenant(tenantId, async (tx) => {
      const roleIds = await this.assignableRoles(tx, tenantId, input.roleIds);
      const user = await tx.user.create({ data: { tenantId, email, displayName: input.displayName } });
      await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: user.id, roleId, tenantId, scope: 'TENANT' as const })) });
      const saved = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: SELECT });
      await this.audit.record(tx, { tenantId, actorUserId: actor.id, action: 'CREATE', entity: 'user', entityId: user.id, after: { email, displayName: input.displayName, roleIds }, ...meta });
      return this.shape(saved, actor);
    });
    this.passwordReset.request(email); // convite: o usuário define a própria senha
    return result;
  }

  update(tenantId: string, actor: AuthUser, id: string, input: UserUpdate, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await this.editable(tx, tenantId, actor, id);
      if (id === actor.id && input.isActive === false) throw new BadRequestException('Você não pode desativar o próprio usuário');
      if (input.roleIds) {
        const roleIds = await this.assignableRoles(tx, tenantId, input.roleIds);
        await tx.userRole.deleteMany({ where: { userId: id, tenantId } });
        await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId, tenantId, scope: 'TENANT' as const })) });
      }
      await tx.user.update({ where: { id }, data: { displayName: input.displayName, isActive: input.isActive } });
      const after = await tx.user.findUniqueOrThrow({ where: { id }, select: SELECT });
      await this.audit.record(tx, { tenantId, actorUserId: actor.id, action: 'UPDATE', entity: 'user', entityId: id, before: this.shape(before, actor), after: this.shape(after, actor), ...meta });
      return this.shape(after, actor);
    });
  }

  remove(tenantId: string, actor: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await this.editable(tx, tenantId, actor, id);
      if (id === actor.id) throw new BadRequestException('Você não pode excluir o próprio usuário');
      await tx.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      await this.audit.record(tx, { tenantId, actorUserId: actor.id, action: 'DELETE', entity: 'user', entityId: id, before: this.shape(before, actor), ...meta });
    });
  }

  async resendInvite(tenantId: string, actor: AuthUser, id: string) {
    const u = await this.prisma.forTenant(tenantId, (tx) => this.editable(tx, tenantId, actor, id));
    this.passwordReset.request(u.email);
  }
}
