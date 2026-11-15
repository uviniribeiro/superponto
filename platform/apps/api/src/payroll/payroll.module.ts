import { Body, Controller, Delete, Get, HttpCode, Module, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { RequirePermission } from '../authorization/authorization.js';
import { ActiveTenant, RequestInfo, type RequestMeta } from '../common/tenant.js';
import { ReportsModule } from '../reports/reports.module.js';
import { markImportSchema, MarkImportService, payrollExportSchema, payrollLayoutSchema, PayrollService, type MarkImportInput, type PayrollExportInput, type PayrollLayoutInput } from './payroll.service.js';

const id = { schema: z.uuid() };

@ApiTags('folha')
@ApiBearerAuth()
@Controller('v1/payroll-layouts')
export class PayrollController {
  constructor(private readonly svc: PayrollService) {}

  @Get('items')
  @RequirePermission('reports.payroll:export')
  items() { return this.svc.items(); }

  @Get()
  @RequirePermission('reports.payroll:export')
  list(@ActiveTenant() t: string, @Query({ schema: z.object({ companyId: z.uuid().optional() }) }) q: { companyId?: string }) { return this.svc.list(t, q.companyId); }

  @Post()
  @RequirePermission('reports.payroll:export')
  create(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: payrollLayoutSchema }) b: PayrollLayoutInput, @RequestInfo() m: RequestMeta) { return this.svc.create(t, u, b, m); }

  @Put(':id')
  @RequirePermission('reports.payroll:export')
  update(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) lid: string, @Body({ schema: payrollLayoutSchema.omit({ companyId: true }) }) b: Omit<PayrollLayoutInput, 'companyId'>, @RequestInfo() m: RequestMeta) { return this.svc.update(t, u, lid, b, m); }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('reports.payroll:export')
  remove(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) lid: string, @RequestInfo() m: RequestMeta) { return this.svc.remove(t, u, lid, m); }

  /** Gera o arquivo para importar no sistema de folha (o SuperPonto não envia nada a terceiros). */
  @Post(':id/export')
  @HttpCode(200)
  @RequirePermission('reports.payroll:export')
  export(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) lid: string, @Body({ schema: payrollExportSchema }) b: PayrollExportInput, @RequestInfo() m: RequestMeta) { return this.svc.export(t, u, lid, b, m); }
}

@ApiTags('ponto')
@ApiBearerAuth()
@Controller('v1/time-records')
export class MarkImportController {
  constructor(private readonly svc: MarkImportService) {}

  /** Importa marcações de planilha (matrícula ou CPF; data; hora). Com dryRun só confere. */
  @Post('import-csv')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @RequirePermission('time.records:import')
  import(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: markImportSchema }) b: MarkImportInput, @RequestInfo() m: RequestMeta) { return this.svc.import(t, u, b, m); }
}

@Module({ imports: [ReportsModule], controllers: [PayrollController, MarkImportController], providers: [PayrollService, MarkImportService] })
export class PayrollModule {}
