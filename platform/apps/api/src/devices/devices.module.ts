import { Module } from '@nestjs/common';
import { BiometricsService } from './biometrics.service.js';
import { DevicesController } from './devices.controller.js';
import { DevicesService } from './devices.service.js';

@Module({ controllers: [DevicesController], providers: [DevicesService, BiometricsService], exports: [BiometricsService] })
export class DevicesModule {}
