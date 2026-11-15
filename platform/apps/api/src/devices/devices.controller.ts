import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { RequirePermission } from '../authorization/authorization.js';
import { ActiveTenant, RequestInfo, type RequestMeta } from '../common/tenant.js';
import { BiometricsService } from './biometrics.service.js';
import { afdUploadSchema, fingerprintSchema, type AfdUpload, type FingerprintInput } from './devices.schemas.js';
import { DevicesService } from './devices.service.js';

const idSchema = z.uuid();

@ApiTags('equipamentos')
@ApiBearerAuth()
@Controller('v1')
export class DevicesController {
  constructor(private readonly devices: DevicesService, private readonly biometrics: BiometricsService) {}

  @Post('devices/:id/afd')
  @RequirePermission('devices.commands:execute')
  importAfd(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @Body({ schema: afdUploadSchema }) body: AfdUpload, @RequestInfo() meta: RequestMeta) {
    return this.devices.importAfd(tenantId, user, id, body.content, meta);
  }

  @Post('devices/:id/sync')
  @RequirePermission('devices.commands:execute')
  sync(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @RequestInfo() meta: RequestMeta) {
    return this.devices.syncRoster(tenantId, user, id, meta);
  }

  @Get('devices/:id/jobs')
  @RequirePermission('devices.devices:read')
  jobs(@ActiveTenant() tenantId: string, @Param('id', { schema: idSchema }) id: string) {
    return this.devices.jobs(tenantId, id);
  }

  @Get('employments/:id/fingerprints')
  @RequirePermission('people.biometrics:manage')
  listFingerprints(@ActiveTenant() tenantId: string, @Param('id', { schema: idSchema }) id: string) {
    return this.biometrics.list(tenantId, id);
  }

  @Post('employments/:id/fingerprints')
  @RequirePermission('people.biometrics:manage')
  enroll(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @Body({ schema: fingerprintSchema }) body: FingerprintInput, @RequestInfo() meta: RequestMeta) {
    return this.biometrics.enroll(tenantId, user, id, body, meta);
  }

  @Delete('employments/:id/fingerprints/:fid')
  @HttpCode(204)
  @RequirePermission('people.biometrics:manage')
  revoke(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @Param('fid', { schema: idSchema }) fid: string, @RequestInfo() meta: RequestMeta) {
    return this.biometrics.revoke(tenantId, user, id, fid, meta);
  }
}
