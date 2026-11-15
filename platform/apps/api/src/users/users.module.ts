import { Global, Module } from '@nestjs/common';
import { RolesService } from './roles.service.js';
import { SupportProvisioningService } from './support.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Global()
@Module({ controllers: [UsersController], providers: [UsersService, RolesService, SupportProvisioningService], exports: [SupportProvisioningService] })
export class UsersModule {}
