import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { RequirePermission } from '../authorization/authorization.js';
import { ActiveTenant, pageSchema, RequestInfo, type PageQuery, type RequestMeta } from '../common/tenant.js';
import { companyInputSchema, companyUpdateSchema, type CompanyInput, type CompanyUpdate } from './companies.schemas.js';
import { CompaniesService } from './companies.service.js';

const idSchema = z.uuid();
const logoSchema = z.object({ dataUrl: z.string().max(800_000, 'O logo deve ter no máximo 512 KB') });

@ApiTags('organização')
@ApiBearerAuth()
@ApiHeader({ name: 'X-Tenant-Id', required: false, description: 'Somente SuperAdmin' })
@Controller('v1/companies')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  @RequirePermission('org.companies:read')
  list(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Query({ schema: pageSchema }) q: PageQuery) {
    return this.companies.list(tenantId, user, q);
  }

  @Get(':id')
  @RequirePermission('org.companies:read')
  get(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string) {
    return this.companies.get(tenantId, user, id);
  }

  @Post()
  @RequirePermission('org.companies:create')
  create(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Body({ schema: companyInputSchema }) body: CompanyInput, @RequestInfo() meta: RequestMeta) {
    return this.companies.create(tenantId, user, body, meta);
  }

  @Patch(':id')
  @RequirePermission('org.companies:update')
  update(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @Body({ schema: companyUpdateSchema }) body: CompanyUpdate, @RequestInfo() meta: RequestMeta) {
    return this.companies.update(tenantId, user, id, body, meta);
  }

  @Get(':id/logo')
  @RequirePermission('org.companies:read')
  logo(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string) {
    return this.companies.getLogo(tenantId, user, id);
  }

  @Put(':id/logo')
  @RequirePermission('org.companies:update')
  setLogo(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @Body({ schema: logoSchema }) body: { dataUrl: string }, @RequestInfo() meta: RequestMeta) {
    return this.companies.setLogo(tenantId, user, id, body.dataUrl, meta);
  }

  @Delete(':id/logo')
  @HttpCode(204)
  @RequirePermission('org.companies:update')
  removeLogo(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @RequestInfo() meta: RequestMeta) {
    return this.companies.removeLogo(tenantId, user, id, meta);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('org.companies:delete')
  remove(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @RequestInfo() meta: RequestMeta) {
    return this.companies.remove(tenantId, user, id, meta);
  }
}
