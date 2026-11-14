import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../auth/auth-user.js';
import type { PermissionKey } from './catalog.js';

const PERMISSION_KEY = 'superponto:permission';

/** Exige a permissão no tenant ativo (ou em algum escopo dele, quando `scoped`). */
export const RequirePermission = (permission: PermissionKey) => SetMetadata(PERMISSION_KEY, permission);

export interface Grant {
  permission: string;
  scope: 'PLATFORM' | 'TENANT' | 'COMPANY' | 'UNIT' | 'DEPARTMENT' | 'SELF';
  companyId: string | null;
  unitId: string | null;
  departmentId: string | null;
}

export interface ResourceScope {
  companyId?: string | null;
  unitId?: string | null;
  departmentId?: string | null;
}

/** Verifica se o usuário tem a permissão para um recurso (respeitando o escopo da atribuição). */
export function can(user: AuthUser, permission: string, resource: ResourceScope = {}): boolean {
  if (user.isPlatformAdmin) return true;
  return user.grants.some((g) => {
    if (g.permission !== permission) return false;
    switch (g.scope) {
      case 'PLATFORM':
      case 'TENANT':
        return true;
      case 'COMPANY':
        return !resource.companyId || resource.companyId === g.companyId;
      case 'UNIT':
        return !resource.unitId || resource.unitId === g.unitId;
      case 'DEPARTMENT':
        return !resource.departmentId || resource.departmentId === g.departmentId;
      case 'SELF':
        return true; // o serviço restringe ao próprio vínculo
    }
  });
}

/** Guard global: rotas com @RequirePermission só passam com a permissão no token/sessão atual. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<PermissionKey | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;
    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user || !can(user, permission)) {
      throw new ForbiddenException(`Permissão necessária: ${permission}`);
    }
    return true;
  }
}
