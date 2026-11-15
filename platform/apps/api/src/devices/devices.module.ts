import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BiometricsService } from './biometrics.service.js';
import { DevicesController } from './devices.controller.js';
import { DevicesService } from './devices.service.js';
import { AgentController, AgentService, DeviceMonitor, DeviceRegistryController, DeviceRegistryService } from './registry.js';

@Module({
  imports: [AuthModule],
  controllers: [DeviceRegistryController, AgentController, DevicesController],
  providers: [DevicesService, BiometricsService, DeviceRegistryService, AgentService, DeviceMonitor],
  exports: [BiometricsService, DeviceMonitor],
})
export class DevicesModule {}
