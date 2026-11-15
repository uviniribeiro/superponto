import { Body, Controller, Delete, Get, HttpCode, Module, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { RequirePermission } from '../authorization/authorization.js';
import { ActiveTenant, RequestInfo, type RequestMeta } from '../common/tenant.js';
import { SchedulesModule } from '../schedules/schedules.module.js';
import { CatalogService, catalogController, type CatalogConfig } from '../structure/catalog.factory.js';
import type { Tx } from '../prisma/prisma.service.js';
import { bankPolicySchema, bankResetSchema, bankTxSchema, BankService, ClosingsService, type BankPolicyInput, type BankResetInput, type BankTxInput } from './bank.service.js';
import { ApprovalFlowsService, flowSchema, requestDecisionSchema, requestSchema, RequestsService, type FlowInput, type RequestInput } from './requests.service.js';
import { TimesheetCore } from './timesheet.core.js';
import {
  adjustmentSchema, allowanceSchema, calculateSchema, closingSchema, dailySchema, decideSchema, justificationSchema, leaveSchema, listRangeSchema, mirrorSchema, onCallSchema, periodSchema, punchSchema, reopenSchema,
  type AdjustmentInput, type AllowanceInput, type LeaveInput, type OnCallInput, type PunchInput,
} from './timesheet.schemas.js';
import { AbsencesService, AdjustmentsService, PunchService, TimesheetService } from './timesheet.service.js';

const id = { schema: z.uuid() };
type Range = { from: string; to: string; companyId?: string; employmentId?: string };

export const JUSTIFICATIONS: CatalogConfig = {
  path: 'justifications', model: 'justification', entity: 'justification', label: 'Justificativa', gender: 'a',
  read: 'time.calculations:read', manage: 'time.justifications:manage',
  createSchema: justificationSchema, updateSchema: justificationSchema.partial(), searchFields: ['name', 'code'], orderBy: { name: 'asc' },
  usage: (tx: Tx, jid: string) => Promise.all([tx.allowance.count({ where: { justificationId: jid } }), tx.leave.count({ where: { justificationId: jid, deletedAt: null } })]).then(([a, b]) => a + b),
};

@ApiTags('ponto')
@ApiBearerAuth()
@Controller('v1/timesheet')
export class TimesheetController {
  constructor(private readonly svc: TimesheetService) {}

  /** Espelho de ponto de um funcionário. */
  @Get()
  @RequirePermission('time.calculations:read')
  mirror(@ActiveTenant() t: string, @Query({ schema: mirrorSchema }) q: { employmentId: string; from: string; to: string }) { return this.svc.mirror(t, q.employmentId, q.from, q.to); }

  /** Meu espelho (funcionário logado). */
  @Get('me')
  @RequirePermission('time.records:create')
  me(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Query({ schema: periodSchema.and(z.object({ employmentId: z.uuid().optional() })) }) q: { from: string; to: string; employmentId?: string }) { return this.svc.myMirror(t, u, q.from, q.to, q.employmentId); }

  @Get('daily')
  @RequirePermission('time.calculations:read')
  daily(@ActiveTenant() t: string, @Query({ schema: dailySchema }) q: { companyId: string; date: string; departmentId?: string; groupingId?: string }) { return this.svc.daily(t, q); }

  @Post('calculate')
  @HttpCode(200)
  @RequirePermission('time.closings:manage')
  calculate(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: calculateSchema }) b: { companyId: string; from: string; to: string; employmentIds?: string[] }, @RequestInfo() m: RequestMeta) { return this.svc.calculate(t, u, b, m); }
}

@ApiTags('ponto')
@ApiBearerAuth()
@Controller('v1/time-adjustments')
export class AdjustmentsController {
  constructor(private readonly svc: AdjustmentsService) {}

  @Get()
  @RequirePermission('time.records:read')
  list(@ActiveTenant() t: string, @Query({ schema: z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(), companyId: z.uuid().optional(), employmentId: z.uuid().optional() }) }) q: { status?: string; companyId?: string; employmentId?: string }) { return this.svc.list(t, q); }

  @Post()
  @RequirePermission('time.adjustments:create')
  create(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: adjustmentSchema }) b: AdjustmentInput, @RequestInfo() m: RequestMeta) { return this.svc.create(t, u, b, m); }

  @Post(':id/decide')
  @HttpCode(200)
  @RequirePermission('time.adjustments:approve')
  decide(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) aid: string, @Body({ schema: decideSchema }) b: { approve: boolean; comment?: string }, @RequestInfo() m: RequestMeta) { return this.svc.decide(t, u, aid, b.approve, b.comment, m); }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('time.adjustments:create')
  cancel(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) aid: string, @RequestInfo() m: RequestMeta) { return this.svc.cancel(t, u, aid, m); }
}

@ApiTags('ponto')
@ApiBearerAuth()
@Controller('v1')
export class AbsencesController {
  constructor(private readonly svc: AbsencesService) {}

  @Get('allowances')
  @RequirePermission('time.calculations:read')
  allowances(@ActiveTenant() t: string, @Query({ schema: listRangeSchema }) q: Range) { return this.svc.listAllowances(t, q); }

  @Post('allowances')
  @RequirePermission('time.allowances:create')
  createAllowances(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: allowanceSchema }) b: AllowanceInput, @RequestInfo() m: RequestMeta) { return this.svc.createAllowances(t, u, b, m); }

  @Delete('allowances/:id')
  @HttpCode(204)
  @RequirePermission('time.allowances:create')
  removeAllowance(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) aid: string, @RequestInfo() m: RequestMeta) { return this.svc.removeAllowance(t, u, aid, m); }

  @Get('leaves')
  @RequirePermission('time.calculations:read')
  leaves(@ActiveTenant() t: string, @Query({ schema: listRangeSchema }) q: Range) { return this.svc.listLeaves(t, q); }

  @Post('leaves')
  @RequirePermission('time.allowances:create')
  createLeave(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: leaveSchema }) b: LeaveInput, @RequestInfo() m: RequestMeta) { return this.svc.createLeave(t, u, b, m); }

  @Delete('leaves/:id')
  @HttpCode(204)
  @RequirePermission('time.allowances:create')
  removeLeave(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) lid: string, @RequestInfo() m: RequestMeta) { return this.svc.removeLeave(t, u, lid, m); }

  @Post('on-call')
  @RequirePermission('time.adjustments:create')
  onCall(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: onCallSchema }) b: OnCallInput, @RequestInfo() m: RequestMeta) { return this.svc.createOnCall(t, u, b, m); }

  @Delete('on-call/:id')
  @HttpCode(204)
  @RequirePermission('time.adjustments:create')
  removeOnCall(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) oid: string, @RequestInfo() m: RequestMeta) { return this.svc.removeOnCall(t, u, oid, m); }
}

@ApiTags('ponto')
@ApiBearerAuth()
@Controller('v1/closings')
export class ClosingsController {
  constructor(private readonly svc: ClosingsService) {}

  @Get()
  @RequirePermission('time.calculations:read')
  list(@ActiveTenant() t: string, @Query({ schema: z.object({ companyId: z.uuid() }) }) q: { companyId: string }) { return this.svc.list(t, q.companyId); }

  @Post()
  @RequirePermission('time.closings:manage')
  close(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: closingSchema }) b: { companyId: string; periodStart: string; periodEnd: string }, @RequestInfo() m: RequestMeta) { return this.svc.close(t, u, b, m); }

  @Post(':id/reopen')
  @HttpCode(200)
  @RequirePermission('time.closings:manage')
  reopen(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) cid: string, @Body({ schema: reopenSchema }) b: { reason: string }, @RequestInfo() m: RequestMeta) { return this.svc.reopen(t, u, cid, b.reason, m); }
}

@ApiTags('ponto')
@ApiBearerAuth()
@Controller('v1/punch')
export class PunchController {
  constructor(private readonly svc: PunchService) {}

  @Get('me')
  @RequirePermission('time.records:create')
  me(@ActiveTenant() t: string, @CurrentUser() u: AuthUser) { return this.svc.me(t, u); }

  @Post('challenge')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @RequirePermission('time.records:create')
  challenge(@CurrentUser() u: AuthUser) { return this.svc.challenge(u); }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequirePermission('time.records:create')
  punch(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: punchSchema }) b: PunchInput, @RequestInfo() m: RequestMeta) { return this.svc.punch(t, u, b, m); }
}

@ApiTags('bancos')
@ApiBearerAuth()
@Controller('v1/bank')
export class BankController {
  constructor(private readonly svc: BankService) {}

  @Get('policy')
  @RequirePermission('time.bank:read')
  policy(@ActiveTenant() t: string, @Query({ schema: z.object({ companyId: z.uuid() }) }) q: { companyId: string }) { return this.svc.getPolicy(t, q.companyId); }

  @Put('policy')
  @RequirePermission('time.compensation:manage')
  savePolicy(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: bankPolicySchema }) b: BankPolicyInput, @RequestInfo() m: RequestMeta) { return this.svc.savePolicy(t, u, b, m); }

  @Get('balances')
  @RequirePermission('time.bank:read')
  balances(@ActiveTenant() t: string, @Query({ schema: z.object({ companyId: z.uuid() }) }) q: { companyId: string }) { return this.svc.balances(t, q.companyId); }

  @Get('statement/:employmentId')
  @RequirePermission('time.bank:read')
  statement(@ActiveTenant() t: string, @Param('employmentId', id) eid: string, @Query({ schema: z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() }) }) q: { from?: string; to?: string }) { return this.svc.statement(t, eid, q.from, q.to); }

  @Post('transactions')
  @RequirePermission('time.bank:manage')
  add(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: bankTxSchema }) b: BankTxInput, @RequestInfo() m: RequestMeta) { return this.svc.addTransactions(t, u, b, m); }

  @Post('reset')
  @HttpCode(200)
  @RequirePermission('time.bank:manage')
  reset(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: bankResetSchema }) b: BankResetInput, @RequestInfo() m: RequestMeta) { return this.svc.reset(t, u, b, m); }
}

@ApiTags('solicitações')
@ApiBearerAuth()
@Controller('v1/approval-flows')
export class ApprovalFlowsController {
  constructor(private readonly svc: ApprovalFlowsService) {}

  @Get()
  @RequirePermission('requests.requests:read')
  list(@ActiveTenant() t: string, @Query({ schema: z.object({ companyId: z.uuid() }) }) q: { companyId: string }) { return this.svc.list(t, q.companyId); }

  @Put()
  @RequirePermission('requests.flows:manage')
  save(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: flowSchema }) b: FlowInput, @RequestInfo() m: RequestMeta) { return this.svc.save(t, u, b, m); }
}

@ApiTags('solicitações')
@ApiBearerAuth()
@Controller('v1/requests')
export class RequestsController {
  constructor(private readonly svc: RequestsService) {}

  @Get()
  @RequirePermission('requests.requests:read')
  list(@ActiveTenant() t: string, @Query({ schema: z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(), companyId: z.uuid().optional() }) }) q: { status?: string; companyId?: string }) { return this.svc.list(t, q); }

  @Get('mine')
  @RequirePermission('requests.requests:create')
  mine(@ActiveTenant() t: string, @CurrentUser() u: AuthUser) { return this.svc.mine(t, u); }

  @Get('inbox')
  @RequirePermission('requests.requests:create')
  inbox(@ActiveTenant() t: string, @CurrentUser() u: AuthUser) { return this.svc.inbox(t, u); }

  @Post()
  @RequirePermission('requests.requests:create')
  create(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: requestSchema }) b: RequestInput, @RequestInfo() m: RequestMeta) { return this.svc.create(t, u, b, m); }

  @Post(':id/decide')
  @HttpCode(200)
  @RequirePermission('requests.requests:create')
  decide(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) rid: string, @Body({ schema: requestDecisionSchema }) b: { decision: 'APPROVED' | 'REJECTED'; comment?: string }, @RequestInfo() m: RequestMeta) { return this.svc.decide(t, u, rid, b.decision, b.comment, m); }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('requests.requests:create')
  cancel(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) rid: string, @RequestInfo() m: RequestMeta) { return this.svc.cancel(t, u, rid, m); }
}

@Module({
  imports: [SchedulesModule],
  controllers: [
    TimesheetController, AdjustmentsController, AbsencesController, ClosingsController, PunchController, BankController, ApprovalFlowsController, RequestsController,
    catalogController(JUSTIFICATIONS),
  ],
  providers: [TimesheetCore, TimesheetService, AdjustmentsService, AbsencesService, PunchService, BankService, ClosingsService, ApprovalFlowsService, RequestsService, CatalogService],
})
export class TimesheetModule {}

