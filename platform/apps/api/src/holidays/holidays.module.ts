import { Module } from '@nestjs/common';
import { HolidaysController } from './holidays.controller.js';
import { HolidaysScheduler } from './holidays.scheduler.js';
import { HolidaysService } from './holidays.service.js';

@Module({ controllers: [HolidaysController], providers: [HolidaysService, HolidaysScheduler], exports: [HolidaysService] })
export class HolidaysModule {}
