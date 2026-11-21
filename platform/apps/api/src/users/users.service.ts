import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PasswordResetService } from '@nestjs/authentication';
import type { AuthUser } from '../auth/auth-user.js';
import { normalizeEmail } from '../auth/users.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { assertLimit } from '../common/limits.js';
import type { PageQuery, RequestMeta } from '../common/tenant.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import type { BlockInput, UserCreate, UserUpdate } from './users.schemas.js';

const SELECT = {
  id: true, email: true, username: true, displayName: true, isActive: true, isSupport: true, lastLoginAt: true, createdAt: true, accessWeekdays: true, mustChangePassword: true, authSource: true, personId: true, person: { select: { fullName: true } },
  accessBlocks: { where: { revokedAt: null }, select: { id: true, reason: true, startsAt: true, endsAt: true }, orderBy: { startsAt: 'desc' }, take: 20 },
  roles: { select: { role: { select: { id: true, key: true, name: true } } } },
} as const;

/**
 * Usuários do cliente. Regra do usuário de suporte: fica oculto da lista para os usuários do
 * cliente; quando o próprio suporte está logado, ele aparece, mas não pode ser editado.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly passwordReset: PasswordResetService) {}

  private shape(u: { id: string; email: string; username: string | null; displayName: string; isActive: boolean; isSupport: boolean; lastLoginAt: Date | null; createdAt: Date; accessWeekdays: number[]; mustChangePassword: boolean; authSource: 'LOCAL' | 'LDAP'; personId: string | null; person: { fullName: string } | null; accessBlocks: Array<{ id: string; reason: string; startsAt: Date; endsAt: Date | null }>; roles: Array<{ role: { id: string; key: string; name: string } }> }, viewer: AuthUser) {
    const now = new Date();
    const blocks = u.accessBlocks.filter((b) => !b.endsAt || b.endsAt > now);
    const activeBlock = blocks.find((b) => b.startsAt <= now) ?? null;
    return { ...u, accessBlocks: blocks, activeBlock, roles: u.roles.map((r) => r.role), editable: !u.isSupport, isSelf: u.id === viewer.id };
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
  private async requireLdap(tx: Tx, tenantId: string) {
    if (!(await tx.tenantLdapConfig.count({ where: { tenantId, enabled: true } }))) throw new BadRequestException('Ative o login por LDAP da organização antes de criar usuários LDAP');
  }

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

  private async uniqueUsername(tx: Tx, tenantId: string, username: string, exceptId?: string) {
    const other = await tx.user.findFirst({ where: { tenantId, username, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
    if (other) throw new ConflictException('Este usuário já existe neste cliente');
  }

  async create(tenantId: string, actor: AuthUser, input: UserCreate, meta: RequestMeta) {
    const email = normalizeEmail(input.email);
    // E-mail é único na plataforma inteira: a checagem precisa enxergar todos os clientes
    // (sem revelar de qual cliente é a conta).
    if (await this.prisma.asPlatform((tx) => tx.user.count({ where: { email } }))) throw new ConflictException('Este e-mail já tem uma conta no SuperPonto');
    const result = await this.prisma.forTenant(tenantId, async (tx) => {
      const roleIds = await this.assignableRoles(tx, tenantId, input.roleIds);
      await assertLimit(tx, tenantId, 'limit.users');
      const ldap = input.authSource === 'LDAP';
      if (ldap) await this.requireLdap(tx, tenantId);
      if (input.username) await this.uniqueUsername(tx, tenantId, input.username);
      const user = await tx.user.create({ data: { tenantId, email, username: input.username ?? null, displayName: input.displayName, accessWeekdays: input.accessWeekdays ?? [], mustChangePassword: ldap ? false : input.mustChangePassword ?? false, authSource: ldap ? 'LDAP' : 'LOCAL' } });
      await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: user.id, roleId, tenantId, scope: 'TENANT' as const })) });
      const saved = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: SELECT });
      await this.audit.record(tx, { tenantId, actorUserId: actor.id, action: 'CREATE', entity: 'user', entityId: user.id, after: { email, displayName: input.displayName, roleIds }, ...meta });
      return this.shape(saved, actor);
    });
    if (input.authSource !== 'LDAP') this.passwordReset.request(email); // convite: o usuário define a própria senha
    return result;
  }

  async update(tenantId: string, actor: AuthUser, id: string, input: UserUpdate, meta: RequestMeta) {
    let invite: string | null = null;
    const result = await this.prisma.forTenant(tenantId, async (tx) => {
      const before = await this.editable(tx, tenantId, actor, id);
      if (id === actor.id && input.isActive === false) throw new BadRequestException('Você não pode desativar o próprio usuário');
      if (input.roleIds) {
        const roleIds = await this.assignableRoles(tx, tenantId, input.roleIds);
        await tx.userRole.deleteMany({ where: { userId: id, tenantId } });
        await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId, tenantId, scope: 'TENANT' as const })) });
      }
      if (id === actor.id && input.accessWeekdays?.length) throw new BadRequestException('Você não pode limitar os dias do próprio acesso');
      const toLdap = input.authSource === 'LDAP' && before.authSource !== 'LDAP';
      const toLocal = input.authSource === 'LOCAL' && before.authSource === 'LDAP';
      if (toLdap) {
        if (id === actor.id) throw new BadRequestException('Você não pode mudar a forma de login do próprio usuário');
        await this.requireLdap(tx, tenantId);
      }
      if (input.personId) {
        if (!(await tx.person.findFirst({ where: { id: input.personId } }))) throw new NotFoundException('Funcionário não encontrado');
        const other = await tx.user.findFirst({ where: { personId: input.personId, id: { not: id } } });
        if (other) throw new ConflictException('Este funcionário já está ligado a outro usuário');
      }
      if (input.username) await this.uniqueUsername(tx, tenantId, input.username, id);
      await tx.user.update({ where: { id }, data: {
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.personId !== undefined ? { personId: input.personId } : {}),
        displayName: input.displayName, isActive: input.isActive, accessWeekdays: input.accessWeekdays,
        mustChangePassword: toLdap || (before.authSource === 'LDAP' && !toLocal) ? false : input.mustChangePassword,
        // LDAP não guarda senha local; ao voltar para senha própria, o usuário recebe convite para definir uma.
        ...(toLdap ? { authSource: 'LDAP' as const, passwordHash: null } : toLocal ? { authSource: 'LOCAL' as const } : {}),
      } });
      if (toLocal) invite = before.email;
      const after = await tx.user.findUniqueOrThrow({ where: { id }, select: SELECT });
      await this.audit.record(tx, { tenantId, actorUserId: actor.id, action: 'UPDATE', entity: 'user', entityId: id, before: this.shape(before, actor), after: this.shape(after, actor), ...meta });
      return this.shape(after, actor);
    });
    // Depois do commit: o convite precisa enxergar a conta já como senha própria.
    if (invite) this.passwordReset.request(invite);
    return result;
  }

  remove(tenantId: string, actor: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await this.editable(tx, tenantId, actor, id);
      if (id === actor.id) throw new BadRequestException('Você não pode excluir o próprio usuário');
      await tx.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      await this.audit.record(tx, { tenantId, actorUserId: actor.id, action: 'DELETE', entity: 'user', entityId: id, before: this.shape(before, actor), ...meta });
    });
  }

  /** Bloqueio de acesso por período (encerra as sessões do usuário enquanto valer). */
  addBlock(tenantId: string, actor: AuthUser, id: string, input: BlockInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.editable(tx, tenantId, actor, id);
      if (id === actor.id) throw new BadRequestException('Você não pode bloquear o próprio acesso');
      const b = await tx.userAccessBlock.create({ data: { tenantId, userId: id, reason: input.reason, startsAt: input.startsAt, endsAt: input.endsAt, createdById: actor.id } });
      await this.audit.record(tx, { tenantId, actorUserId: actor.id, action: 'CREATE', entity: 'user_access_block', entityId: b.id, after: b, ...meta });
      return b;
    });
  }

  revokeBlock(tenantId: string, actor: AuthUser, id: string, blockId: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.editable(tx, tenantId, actor, id);
      const b = await tx.userAccessBlock.findFirst({ where: { id: blockId, userId: id, revokedAt: null } });
      if (!b) throw new NotFoundException('Bloqueio não encontrado');
      await tx.userAccessBlock.update({ where: { id: blockId }, data: { revokedAt: new Date() } });
      await this.audit.record(tx, { tenantId, actorUserId: actor.id, action: 'DELETE', entity: 'user_access_block', entityId: blockId, before: b, ...meta });
    });
  }

  /** Bloqueios do cliente (tela "Bloqueio de acesso"): vigentes, futuros e, opcionalmente, encerrados. */
  listBlocks(tenantId: string, viewer: AuthUser, includeEnded: boolean) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const now = new Date();
      const rows = await tx.userAccessBlock.findMany({
        where: { user: { tenantId, deletedAt: null, ...(viewer.isSupport ? {} : { isSupport: false }) }, ...(includeEnded ? {} : { revokedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }) },
        include: { user: { select: { id: true, displayName: true, email: true } } },
        orderBy: { startsAt: 'desc' }, take: 500,
      });
      return rows.map((b) => ({ ...b, state: b.revokedAt ? 'REVOKED' : b.endsAt && b.endsAt <= now ? 'ENDED' : b.startsAt > now ? 'SCHEDULED' : 'ACTIVE' }));
    });
  }

  async resendInvite(tenantId: string, actor: AuthUser, id: string) {
    const u = await this.prisma.forTenant(tenantId, (tx) => this.editable(tx, tenantId, actor, id));
    this.passwordReset.request(u.email);
  }
}
