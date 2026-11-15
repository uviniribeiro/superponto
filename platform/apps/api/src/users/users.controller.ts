import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { RequirePermission } from '../authorization/authorization.js';
import { ActiveTenant, pageSchema, RequestInfo, type PageQuery, type RequestMeta } from '../common/tenant.js';
import { permissionCatalog, RolesService } from './roles.service.js';
import { roleSchema, roleUpdateSchema, userCreateSchema, userUpdateSchema, type RoleInput, type RoleUpdate, type UserCreate, type UserUpdate } from './users.schemas.js';
import { UsersService } from './users.service.js';

const idSchema = z.uuid();

@ApiTags('administração')
@ApiBearerAuth()
@Controller('v1')
export class UsersController {
  constructor(private readonly users: UsersService, private readonly roles: RolesService) {}

  @Get('users')
  @RequirePermission('admin.users:read')
  list(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Query({ schema: pageSchema }) q: PageQuery) {
    return this.users.list(tenantId, user, q);
  }

  @Post('users')
  @RequirePermission('admin.users:manage')
  create(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Body({ schema: userCreateSchema }) body: UserCreate, @RequestInfo() meta: RequestMeta) {
    return this.users.create(tenantId, user, body, meta);
  }

  @Patch('users/:id')
  @RequirePermission('admin.users:manage')
  update(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @Body({ schema: userUpdateSchema }) body: UserUpdate, @RequestInfo() meta: RequestMeta) {
    return this.users.update(tenantId, user, id, body, meta);
  }

  @Delete('users/:id')
  @HttpCode(204)
  @RequirePermission('admin.users:manage')
  remove(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @RequestInfo() meta: RequestMeta) {
    return this.users.remove(tenantId, user, id, meta);
  }

  @Post('users/:id/invite')
  @HttpCode(202)
  @RequirePermission('admin.users:manage')
  invite(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string) {
    return this.users.resendInvite(tenantId, user, id);
  }

  @Get('permissions')
  @RequirePermission('admin.users:read')
  permissions() {
    return permissionCatalog(false);
  }

  @Get('roles')
  @RequirePermission('admin.users:read')
  listRoles(@ActiveTenant() tenantId: string) {
    return this.roles.list(tenantId);
  }

  @Post('roles')
  @RequirePermission('admin.roles:manage')
  createRole(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Body({ schema: roleSchema }) body: RoleInput, @RequestInfo() meta: RequestMeta) {
    return this.roles.create(tenantId, user, body, meta);
  }

  @Patch('roles/:id')
  @RequirePermission('admin.roles:manage')
  updateRole(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @Body({ schema: roleUpdateSchema }) body: RoleUpdate, @RequestInfo() meta: RequestMeta) {
    return this.roles.update(tenantId, user, id, body, meta);
  }

  @Delete('roles/:id')
  @HttpCode(204)
  @RequirePermission('admin.roles:manage')
  removeRole(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @RequestInfo() meta: RequestMeta) {
    return this.roles.remove(tenantId, user, id, meta);
  }
}
