import { Body, Controller, Get, HttpCode, Module, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { RequirePermission } from '../authorization/authorization.js';
import { ActiveTenant } from '../common/tenant.js';
import { HolidaysModule } from '../holidays/holidays.module.js';
import { TimesheetModule } from '../timesheet/timesheet.module.js';
import { filtersSchema, ReportsService, type Filters } from './reports.service.js';

const keySchema = { schema: z.string().regex(/^[a-z0-9-]{3,40}$/) };

@ApiTags('relatórios')
@ApiBearerAuth()
@Controller('v1/reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get()
  @RequirePermission('reports.reports:read')
  catalog(@CurrentUser() u: AuthUser) { return this.svc.catalog(u); }

  @Post(':key/run')
  @HttpCode(200)
  @RequirePermission('reports.reports:read')
  run(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('key', keySchema) key: string, @Body({ schema: filtersSchema }) f: Filters) { return this.svc.run(t, u, key, f); }

  @Post(':key/export')
  @HttpCode(200)
  @RequirePermission('reports.reports:export')
  export(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('key', keySchema) key: string, @Query({ schema: z.object({ format: z.enum(['csv', 'xlsx']).default('xlsx') }) }) q: { format: 'csv' | 'xlsx' }, @Body({ schema: filtersSchema }) f: Filters) { return this.svc.export(t, u, key, f, q.format); }
}

@Module({ imports: [TimesheetModule, HolidaysModule], controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
