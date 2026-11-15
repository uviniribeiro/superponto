import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { RequirePermission } from '../authorization/authorization.js';
import { ActiveTenant, RequestInfo, type RequestMeta } from '../common/tenant.js';
import { HolidaysModule } from '../holidays/holidays.module.js';
import {
  assignSchema, gridSchema, overrideCreateSchema, rangeSchema, ruleSetCreateSchema, ruleSetUpdateSchema, scheduleCreateSchema, scheduleUpdateSchema, swapSchema,
  type AssignInput, type GridQuery, type OverrideCreate, type RuleSetCreate, type RuleSetUpdate, type ScheduleCreate, type ScheduleUpdate, type SwapInput,
} from './schedules.schemas.js';
import { ExpectedScheduleService, RuleSetsService, ScheduleAssignmentsService, ScheduleOverridesService, WorkSchedulesService } from './schedules.service.js';

const id = { schema: z.uuid() };
const companyQuery = z.object({ companyId: z.uuid() });

/** Horários (jornadas e escalas modelo) — Átomo: "Horário" e "Escala fixa". */
@ApiTags('jornadas')
@ApiBearerAuth()
@Controller('v1/work-schedules')
export class WorkSchedulesController {
  constructor(private readonly svc: WorkSchedulesService) {}

  @Get()
  @RequirePermission('schedules.timetables:read')
  list(@ActiveTenant() t: string, @Query({ schema: companyQuery }) q: { companyId: string }) { return this.svc.list(t, q.companyId); }

  @Get(':id')
  @RequirePermission('schedules.timetables:read')
  get(@ActiveTenant() t: string, @Param('id', id) sid: string) { return this.svc.get(t, sid); }

  @Get(':id/preview')
  @RequirePermission('schedules.timetables:read')
  preview(@ActiveTenant() t: string, @Param('id', id) sid: string, @Query({ schema: z.object({ from: z.iso.date(), cycleStart: z.iso.date().optional(), days: z.coerce.number().int().min(1).max(62).default(14) }) }) q: { from: string; cycleStart?: string; days: number }) {
    return this.svc.preview(t, sid, q.from, q.cycleStart, q.days);
  }

  @Post()
  @RequirePermission('schedules.timetables:manage')
  create(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: scheduleCreateSchema }) b: ScheduleCreate, @RequestInfo() m: RequestMeta) { return this.svc.create(t, u, b, m); }

  @Patch(':id')
  @RequirePermission('schedules.timetables:manage')
  update(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) sid: string, @Body({ schema: scheduleUpdateSchema }) b: ScheduleUpdate, @RequestInfo() m: RequestMeta) { return this.svc.update(t, u, sid, b, m); }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('schedules.timetables:manage')
  remove(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) sid: string, @RequestInfo() m: RequestMeta) { return this.svc.remove(t, u, sid, m); }
}

/** Regras de apuração: tolerâncias, percentuais e faixas de extra, noturno, intervalo. */
@ApiTags('jornadas')
@ApiBearerAuth()
@Controller('v1/rule-sets')
export class RuleSetsController {
  constructor(private readonly svc: RuleSetsService) {}

  @Get()
  @RequirePermission('schedules.timetables:read')
  list(@ActiveTenant() t: string, @Query({ schema: companyQuery }) q: { companyId: string }) { return this.svc.list(t, q.companyId); }

  @Post()
  @RequirePermission('schedules.timetables:manage')
  create(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: ruleSetCreateSchema }) b: RuleSetCreate, @RequestInfo() m: RequestMeta) { return this.svc.create(t, u, b, m); }

  @Patch(':id')
  @RequirePermission('schedules.timetables:manage')
  update(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) rid: string, @Body({ schema: ruleSetUpdateSchema }) b: RuleSetUpdate, @RequestInfo() m: RequestMeta) { return this.svc.update(t, u, rid, b, m); }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('schedules.timetables:manage')
  remove(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) rid: string, @RequestInfo() m: RequestMeta) { return this.svc.remove(t, u, rid, m); }
}

/** Atribuição de horário aos funcionários, com vigência. */
@ApiTags('jornadas')
@ApiBearerAuth()
@Controller('v1/schedule-assignments')
export class ScheduleAssignmentsController {
  constructor(private readonly svc: ScheduleAssignmentsService) {}

  @Get()
  @RequirePermission('schedules.schedules:read')
  list(@ActiveTenant() t: string, @Query({ schema: z.object({ employmentId: z.uuid() }) }) q: { employmentId: string }) { return this.svc.list(t, q.employmentId); }

  @Post()
  @RequirePermission('schedules.schedules:manage')
  assign(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: assignSchema }) b: AssignInput, @RequestInfo() m: RequestMeta) { return this.svc.assign(t, u, b, m); }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('schedules.schedules:manage')
  remove(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) aid: string, @RequestInfo() m: RequestMeta) { return this.svc.remove(t, u, aid, m); }
}

/** Escala agendada (trabalho/folga por dia) e trocas de escala e de folga. */
@ApiTags('jornadas')
@ApiBearerAuth()
@Controller('v1/schedule-overrides')
export class ScheduleOverridesController {
  constructor(private readonly svc: ScheduleOverridesService) {}

  @Get()
  @RequirePermission('schedules.schedules:read')
  list(@ActiveTenant() t: string, @Query({ schema: rangeSchema.and(z.object({ employmentId: z.uuid().optional(), companyId: z.uuid().optional() })) }) q: { from: string; to: string; employmentId?: string; companyId?: string }) { return this.svc.list(t, q); }

  @Post()
  @RequirePermission('schedules.scheduled:manage')
  create(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: overrideCreateSchema }) b: OverrideCreate, @RequestInfo() m: RequestMeta) { return this.svc.create(t, u, b, m); }

  @Post('swap')
  @HttpCode(200)
  @RequirePermission('schedules.scheduled:manage')
  swap(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: swapSchema }) b: SwapInput, @RequestInfo() m: RequestMeta) { return this.svc.swap(t, u, b, m); }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('schedules.scheduled:manage')
  remove(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) oid: string, @RequestInfo() m: RequestMeta) { return this.svc.remove(t, u, oid, m); }
}

/** Jornada prevista: por funcionário e grade da equipe. */
@ApiTags('jornadas')
@ApiBearerAuth()
@Controller('v1')
export class ExpectedScheduleController {
  constructor(private readonly svc: ExpectedScheduleService) {}

  @Get('employees/:id/expected')
  @RequirePermission('schedules.schedules:read')
  employee(@ActiveTenant() t: string, @Param('id', id) eid: string, @Query({ schema: rangeSchema }) q: { from: string; to: string }) { return this.svc.forEmployee(t, eid, q.from, q.to); }

  @Get('schedule-grid')
  @RequirePermission('schedules.schedules:read')
  grid(@ActiveTenant() t: string, @Query({ schema: gridSchema }) q: GridQuery) { return this.svc.grid(t, q); }
}

@Module({
  imports: [HolidaysModule],
  controllers: [WorkSchedulesController, RuleSetsController, ScheduleAssignmentsController, ScheduleOverridesController, ExpectedScheduleController],
  providers: [WorkSchedulesService, RuleSetsService, ScheduleAssignmentsService, ScheduleOverridesService, ExpectedScheduleService],
})
export class SchedulesModule {}
