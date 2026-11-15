import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import { ACTION_LABELS, AVAILABLE_RESOURCES, MODULE_LABELS, PERMISSIONS, RESOURCE_LABELS } from '../authorization/catalog.js';
import type { RequestMeta } from '../common/tenant.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import type { RoleInput, RoleUpdate } from './users.schemas.js';

const slug = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50) || 'perfil';

/** Catálogo de permissões agrupado por módulo → recurso → ação, para a tela de perfis. */
export function permissionCatalog(includePlatform: boolean) {
  const modules = new Map<string, { key: string; label: string; resources: Map<string, { key: string; label: string; available: boolean; actions: Array<{ permission: string; action: string; label: string; description: string }> }> }>();
  for (const [permission, description] of Object.entries(PERMISSIONS)) {
    const [resource, action] = permission.split(':') as [string, string];
    const mod = resource.split('.')[0]!;
    if (mod === 'platform' && !includePlatform) continue;
    if (!modules.has(mod)) modules.set(mod, { key: mod, label: MODULE_LABELS[mod] ?? mod, resources: new Map() });
    const m = modules.get(mod)!;
    if (!m.resources.has(resource)) m.resources.set(resource, { key: resource, label: RESOURCE_LABELS[resource] ?? resource, available: AVAILABLE_RESOURCES.has(resource), actions: [] });
    m.resources.get(resource)!.actions.push({ permission, action, label: ACTION_LABELS[action] ?? action, description });
  }
  return [...modules.values()].map((m) => ({ ...m, resources: [...m.resources.values()] }));
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  list(tenantId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const roles = await tx.role.findMany({
        where: { deletedAt: null, OR: [{ tenantId }, { tenantId: null, isSystem: true }], NOT: { key: 'super_admin' } },
        select: { id: true, key: true, name: true, description: true, isSystem: true, tenantId: true, permissions: { select: { permission: { select: { key: true } } } }, _count: { select: { users: { where: { tenantId, user: { deletedAt: null, isSupport: false } } } } } },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      });
      return roles.map((r) => ({ id: r.id, key: r.key, name: r.name, description: r.description, isSystem: r.isSystem, editable: r.tenantId === tenantId, permissions: r.permissions.map((p) => p.permission.key).sort(), users: r._count.users }));
    });
  }

  private async permissionIds(tx: Tx, keys: string[]) {
    const unique = [...new Set(keys)];
    if (unique.some((k) => k.startsWith('platform.') || !(k in PERMISSIONS))) throw new BadRequestException('Permissão inválida');
    const rows = await tx.permission.findMany({ where: { key: { in: unique } }, select: { id: true } });
    if (rows.length !== unique.length) throw new BadRequestException('Permissão inválida');
    return rows.map((r) => r.id);
  }

  private async own(tx: Tx, tenantId: string, id: string) {
    const r = await tx.role.findFirst({ where: { id, deletedAt: null, OR: [{ tenantId }, { tenantId: null, isSystem: true }] }, include: { permissions: { include: { permission: true } } } });
    if (!r || r.key === 'super_admin') throw new NotFoundException('Perfil não encontrado');
    if (r.tenantId !== tenantId) throw new ForbiddenException('Perfis do sistema não podem ser alterados; crie um perfil novo a partir dele');
    return r;
  }

  create(tenantId: string, actor: AuthUser, input: RoleInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const ids = await this.permissionIds(tx, input.permissions);
      let key = slug(input.name);
      if (await tx.role.findFirst({ where: { OR: [{ tenantId, key }, { tenantId: null, key }] } })) key = `${key}_${Date.now().toString(36)}`;
      if (await tx.role.findFirst({ where: { tenantId, name: input.name, deletedAt: null } })) throw new ConflictException('Já existe um perfil com este nome');
      const role = await tx.role.create({ data: { tenantId, key, name: input.name, description: input.description } });
      await tx.rolePermission.createMany({ data: ids.map((permissionId) => ({ roleId: role.id, permissionId })) });
      await this.audit.record(tx, { tenantId, actorUserId: actor.id, action: 'CREATE', entity: 'role', entityId: role.id, after: { ...input }, ...meta });
      return { id: role.id, key, name: role.name };
    });
  }

  update(tenantId: string, actor: AuthUser, id: string, input: RoleUpdate, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await this.own(tx, tenantId, id);
      if (input.permissions) {
        const ids = await this.permissionIds(tx, input.permissions);
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({ data: ids.map((permissionId) => ({ roleId: id, permissionId })) });
      }
      await tx.role.update({ where: { id }, data: { name: input.name, description: input.description } });
      await this.audit.record(tx, { tenantId, actorUserId: actor.id, action: 'UPDATE', entity: 'role', entityId: id, before: { name: before.name, permissions: before.permissions.map((p) => p.permission.key) }, after: input, ...meta });
      return { id };
    });
  }

  remove(tenantId: string, actor: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await this.own(tx, tenantId, id);
      if (await tx.userRole.count({ where: { roleId: id, user: { deletedAt: null } } })) throw new ConflictException('Há usuários com este perfil: troque o perfil deles antes de excluir');
      await tx.role.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, { tenantId, actorUserId: actor.id, action: 'DELETE', entity: 'role', entityId: id, before: { name: before.name }, ...meta });
    });
  }
}
