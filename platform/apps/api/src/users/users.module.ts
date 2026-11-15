import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LdapConfigController, LdapConfigService } from './ldap-config.js';
import { RolesService } from './roles.service.js';
import { SupportProvisioningService } from './support.service.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Global()
@Module({ imports: [AuthModule], controllers: [UsersController, LdapConfigController], providers: [UsersService, RolesService, SupportProvisioningService, LdapConfigService], exports: [SupportProvisioningService] })
export class UsersModule {}
