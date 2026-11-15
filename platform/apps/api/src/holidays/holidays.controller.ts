import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { RequirePermission } from '../authorization/authorization.js';
import { ActiveTenant, RequestInfo, type RequestMeta } from '../common/tenant.js';
import { generateSchema, holidayOverrideSchema, holidayRuleSchema, yearQuery, type GenerateInput, type HolidayOverrideInput, type HolidayRuleInput, type YearQuery } from './holidays.schemas.js';
import { HolidaysService } from './holidays.service.js';

const idSchema = z.uuid();
const dateSchema = z.iso.date();

@ApiTags('feriados')
@ApiBearerAuth()
@Controller('v1')
export class HolidaysController {
  constructor(private readonly holidays: HolidaysService) {}

  @Get('companies/:id/holidays')
  @RequirePermission('org.holidays:read')
  list(@ActiveTenant() tenantId: string, @Param('id', { schema: idSchema }) id: string, @Query({ schema: yearQuery }) q: YearQuery) {
    return this.holidays.listForCompany(tenantId, id, q.year);
  }

  @Post('companies/:id/holiday-rules')
  @RequirePermission('org.holidays:manage')
  addRule(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @Body({ schema: holidayRuleSchema }) body: HolidayRuleInput, @RequestInfo() meta: RequestMeta) {
    return this.holidays.addRule(tenantId, user, id, body, meta);
  }

  @Delete('companies/:id/holiday-rules/:ruleId')
  @HttpCode(204)
  @RequirePermission('org.holidays:manage')
  removeRule(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @Param('ruleId', { schema: idSchema }) ruleId: string, @RequestInfo() meta: RequestMeta) {
    return this.holidays.removeRule(tenantId, user, id, ruleId, meta);
  }

  @Put('companies/:id/holiday-overrides')
  @RequirePermission('org.holidays:manage')
  setOverride(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @Body({ schema: holidayOverrideSchema }) body: HolidayOverrideInput, @RequestInfo() meta: RequestMeta) {
    return this.holidays.setOverride(tenantId, user, id, body, meta);
  }

  @Delete('companies/:id/holiday-overrides/:date')
  @HttpCode(204)
  @RequirePermission('org.holidays:manage')
  clearOverride(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @Param('date', { schema: dateSchema }) date: string, @RequestInfo() meta: RequestMeta) {
    return this.holidays.clearOverride(tenantId, user, id, date, meta);
  }

  /** SuperAdmin: gera manualmente o catálogo de um ano (normalmente automático). */
  @Post('platform/holidays/generate')
  @RequirePermission('platform.tenants:manage')
  generate(@Body({ schema: generateSchema }) body: GenerateInput) {
    return this.holidays.generateYear(body.year).then((created) => ({ year: body.year, created }));
  }
}
