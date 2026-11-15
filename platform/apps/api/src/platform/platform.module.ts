import { Module } from '@nestjs/common';
import { MySubscriptionController, PlansController } from './plans.controller.js';
import { TenantsController } from './tenants.controller.js';

@Module({ controllers: [TenantsController, PlansController, MySubscriptionController] })
export class PlatformModule {}
