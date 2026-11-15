import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { RequirePermission } from '../authorization/authorization.js';
import { ActiveTenant, RequestInfo, type RequestMeta } from '../common/tenant.js';
import { DepartmentsService } from './departments.service.js';
import { departmentSchema, departmentUpdateSchema, sectorSchema, type DepartmentInput, type DepartmentUpdate, type SectorInput } from './structure.schemas.js';

const idSchema = z.uuid();
const companyQuery = z.object({ companyId: z.uuid() });

@ApiTags('estrutura')
@ApiBearerAuth()
@Controller('v1/departments')
export class DepartmentsController {
  constructor(private readonly svc: DepartmentsService) {}

  @Get()
  @RequirePermission('org.departments:read')
  list(@ActiveTenant() tenantId: string, @Query({ schema: companyQuery }) q: { companyId: string }) {
    return this.svc.list(tenantId, q.companyId);
  }

  @Post()
  @RequirePermission('org.departments:manage')
  create(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Body({ schema: departmentSchema }) body: DepartmentInput, @RequestInfo() meta: RequestMeta) {
    return this.svc.create(tenantId, user, body, meta);
  }

  @Patch(':id')
  @RequirePermission('org.departments:manage')
  update(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @Body({ schema: departmentUpdateSchema }) body: DepartmentUpdate, @RequestInfo() meta: RequestMeta) {
    return this.svc.update(tenantId, user, id, body, meta);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('org.departments:manage')
  remove(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @RequestInfo() meta: RequestMeta) {
    return this.svc.remove(tenantId, user, id, meta);
  }

  @Post(':id/sectors')
  @RequirePermission('org.departments:manage')
  addSector(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @Body({ schema: sectorSchema }) body: SectorInput, @RequestInfo() meta: RequestMeta) {
    return this.svc.addSector(tenantId, user, id, body, meta);
  }

  @Delete(':id/sectors/:sectorId')
  @HttpCode(204)
  @RequirePermission('org.departments:manage')
  removeSector(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @Param('sectorId', { schema: idSchema }) sectorId: string, @RequestInfo() meta: RequestMeta) {
    return this.svc.removeSector(tenantId, user, id, sectorId, meta);
  }
}
