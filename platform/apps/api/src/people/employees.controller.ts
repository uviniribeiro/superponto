import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { RequirePermission } from '../authorization/authorization.js';
import { ActiveTenant, RequestInfo, type RequestMeta } from '../common/tenant.js';
import { employeeCreateSchema, employeeListSchema, employeeUpdateSchema, terminateSchema, type EmployeeCreate, type EmployeeList, type EmployeeUpdate, type TerminateInput } from './employees.schemas.js';
import { EmployeesService } from './employees.service.js';
import { EmployeeImportService, type ImportRow } from './import.service.js';

const idSchema = z.uuid();
const importSchema = z.object({
  companyId: z.uuid(),
  dryRun: z.boolean().default(true),
  createMissing: z.boolean().default(false),
  updateExisting: z.boolean().default(false),
  rows: z.array(z.record(z.string(), z.string().max(300))).max(5000),
});

@ApiTags('pessoas')
@ApiBearerAuth()
@Controller('v1/employees')
export class EmployeesController {
  constructor(private readonly svc: EmployeesService, private readonly importer: EmployeeImportService) {}

  @Get()
  @RequirePermission('people.employments:read')
  list(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Query({ schema: employeeListSchema }) q: EmployeeList) {
    return this.svc.list(tenantId, user, q);
  }

  @Get(':id')
  @RequirePermission('people.employments:read')
  get(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string) {
    return this.svc.get(tenantId, user, id);
  }

  @Post()
  @RequirePermission('people.employments:manage')
  create(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Body({ schema: employeeCreateSchema }) body: EmployeeCreate, @RequestInfo() meta: RequestMeta) {
    return this.svc.create(tenantId, user, body, meta);
  }

  @Post('import')
  @RequirePermission('people.employments:import')
  import(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Body({ schema: importSchema }) body: z.infer<typeof importSchema>, @RequestInfo() meta: RequestMeta) {
    return this.importer.run(tenantId, user, { ...body, rows: body.rows as ImportRow[] }, meta);
  }

  @Patch(':id')
  @RequirePermission('people.employments:manage')
  update(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @Body({ schema: employeeUpdateSchema }) body: EmployeeUpdate, @RequestInfo() meta: RequestMeta) {
    return this.svc.update(tenantId, user, id, body, meta);
  }

  @Post(':id/terminate')
  @RequirePermission('people.employments:manage')
  terminate(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @Body({ schema: terminateSchema }) body: TerminateInput, @RequestInfo() meta: RequestMeta) {
    return this.svc.terminate(tenantId, user, id, body, meta);
  }

  @Post(':id/reactivate')
  @RequirePermission('people.employments:manage')
  reactivate(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @RequestInfo() meta: RequestMeta) {
    return this.svc.reactivate(tenantId, user, id, meta);
  }
}
