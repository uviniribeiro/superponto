import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { AuthModule } from '../auth/auth.module.js';
import { RequirePermission } from '../authorization/authorization.js';
import { ActiveTenant, RequestInfo, type RequestMeta } from '../common/tenant.js';
import { TimesheetModule } from '../timesheet/timesheet.module.js';
import {
  AcknowledgmentsService, ackSchema, announcementSchema, AnnouncementsService, appDeviceConfirmSchema, appDeviceRequestSchema, AppDevicesService, customTextSchema, CustomTextsService,
  liveSchema, LiveService, notificationSchema, NotificationsService, type AckInput, type AnnouncementInput, type LiveQuery, type NotificationInput,
} from './tools.service.js';

const id = { schema: z.uuid() };
const period = z.object({ from: z.iso.date(), to: z.iso.date(), employmentId: z.uuid().optional() });

@ApiTags('ferramentas')
@ApiBearerAuth()
@Controller('v1/live')
export class LiveController {
  constructor(private readonly svc: LiveService) {}

  /** Painel ao vivo: situação de cada funcionário agora (trabalhando, intervalo, atrasado...). */
  @Get()
  @RequirePermission('time.calculations:read')
  live(@ActiveTenant() t: string, @Query({ schema: liveSchema }) q: LiveQuery) { return this.svc.live(t, q); }
}

@ApiTags('ferramentas')
@ApiBearerAuth()
@Controller('v1/notification-schedules')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  @RequirePermission('tools.notifications:manage')
  list(@ActiveTenant() t: string, @Query({ schema: z.object({ companyId: z.uuid().optional() }) }) q: { companyId?: string }) { return this.svc.list(t, q.companyId); }

  @Post()
  @RequirePermission('tools.notifications:manage')
  create(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: notificationSchema }) b: NotificationInput, @RequestInfo() m: RequestMeta) { return this.svc.create(t, u, b, m); }

  @Patch(':id')
  @RequirePermission('tools.notifications:manage')
  update(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) nid: string, @Body({ schema: notificationSchema.partial() }) b: Partial<NotificationInput>, @RequestInfo() m: RequestMeta) { return this.svc.update(t, u, nid, b, m); }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('tools.notifications:manage')
  remove(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) nid: string, @RequestInfo() m: RequestMeta) { return this.svc.remove(t, u, nid, m); }

  /** Prévia do resumo, sem enviar. */
  @Get(':id/preview')
  @RequirePermission('tools.notifications:manage')
  preview(@ActiveTenant() t: string, @Param('id', id) nid: string) { return this.svc.preview(t, nid); }

  @Post(':id/send')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequirePermission('tools.notifications:manage')
  send(@ActiveTenant() t: string, @Param('id', id) nid: string) { return this.svc.send(t, nid); }
}

@ApiTags('ferramentas')
@ApiBearerAuth()
@Controller('v1/announcements')
export class AnnouncementsController {
  constructor(private readonly svc: AnnouncementsService) {}

  /** Avisos vigentes para quem está logado (sem permissão própria: todo usuário vê os seus). */
  @Get('active')
  active(@ActiveTenant() t: string, @CurrentUser() u: AuthUser) { return this.svc.active(t, u); }

  @Post(':id/read')
  @HttpCode(200)
  read(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) aid: string) { return this.svc.markRead(t, u, aid); }

  @Get()
  @RequirePermission('tools.announcements:manage')
  list(@ActiveTenant() t: string) { return this.svc.list(t); }

  @Get(':id/reads')
  @RequirePermission('tools.announcements:manage')
  reads(@ActiveTenant() t: string, @Param('id', id) aid: string) { return this.svc.reads(t, aid); }

  @Post()
  @RequirePermission('tools.announcements:manage')
  create(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: announcementSchema }) b: AnnouncementInput, @RequestInfo() m: RequestMeta) { return this.svc.create(t, u, b, m); }

  @Put(':id')
  @RequirePermission('tools.announcements:manage')
  update(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) aid: string, @Body({ schema: announcementSchema }) b: AnnouncementInput, @RequestInfo() m: RequestMeta) { return this.svc.update(t, u, aid, b, m); }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('tools.announcements:manage')
  remove(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) aid: string, @RequestInfo() m: RequestMeta) { return this.svc.remove(t, u, aid, m); }
}

@ApiTags('ferramentas')
@ApiBearerAuth()
@Controller('v1/app-devices')
export class AppDevicesController {
  constructor(private readonly svc: AppDevicesService) {}

  @Get('mine')
  @RequirePermission('time.records:create')
  mine(@ActiveTenant() t: string, @CurrentUser() u: AuthUser) { return this.svc.mine(t, u); }

  @Post('request')
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @RequirePermission('time.records:create')
  request(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: appDeviceRequestSchema }) b: { name: string }, @RequestInfo() m: RequestMeta) { return this.svc.request(t, u, b.name, m); }

  @Post(':id/confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @RequirePermission('time.records:create')
  confirm(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) did: string, @Body({ schema: appDeviceConfirmSchema }) b: { code: string }, @RequestInfo() m: RequestMeta) { return this.svc.confirm(t, u, did, b.code, m); }

  @Post('mine/:id/revoke')
  @HttpCode(200)
  @RequirePermission('time.records:create')
  revokeMine(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) did: string, @RequestInfo() m: RequestMeta) { return this.svc.revoke(t, u, did, false, m); }

  @Get()
  @RequirePermission('admin.users:manage')
  list(@ActiveTenant() t: string) { return this.svc.list(t); }

  @Post(':id/revoke')
  @HttpCode(200)
  @RequirePermission('admin.users:manage')
  revoke(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) did: string, @RequestInfo() m: RequestMeta) { return this.svc.revoke(t, u, did, true, m); }
}

@ApiTags('ferramentas')
@ApiBearerAuth()
@Controller('v1/custom-texts')
export class CustomTextsController {
  constructor(private readonly svc: CustomTextsService) {}

  /** Todo usuário do cliente lê (aparecem no painel, comprovante e espelho). */
  @Get()
  all(@ActiveTenant() t: string) { return this.svc.all(t); }

  @Put(':key')
  @RequirePermission('admin.settings:manage')
  save(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('key') key: string, @Body({ schema: customTextSchema }) b: { text: string }, @RequestInfo() m: RequestMeta) { return this.svc.save(t, u, key, b.text, m); }
}

@ApiTags('ponto')
@ApiBearerAuth()
@Controller('v1')
export class AcknowledgmentsController {
  constructor(private readonly svc: AcknowledgmentsService) {}

  @Get('timesheet/me/ack')
  @RequirePermission('time.records:create')
  mine(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Query({ schema: period }) q: { from: string; to: string; employmentId?: string }) { return this.svc.mine(t, u, q); }

  /** Ciência eletrônica do espelho pelo próprio funcionário (imutável depois de gravada). */
  @Post('timesheet/me/ack')
  @RequirePermission('time.records:create')
  sign(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: ackSchema }) b: AckInput, @RequestInfo() m: RequestMeta) { return this.svc.sign(t, u, b, m); }

  @Get('mirror-acks')
  @RequirePermission('time.calculations:read')
  list(@ActiveTenant() t: string, @Query({ schema: z.object({ companyId: z.uuid(), from: z.iso.date(), to: z.iso.date() }) }) q: { companyId: string; from: string; to: string }) { return this.svc.list(t, q); }
}

@Module({
  imports: [TimesheetModule, AuthModule],
  controllers: [LiveController, NotificationsController, AnnouncementsController, AppDevicesController, CustomTextsController, AcknowledgmentsController],
  providers: [LiveService, NotificationsService, AnnouncementsService, AppDevicesService, CustomTextsService, AcknowledgmentsService],
  exports: [LiveService, AcknowledgmentsService],
})
export class ToolsModule {}
