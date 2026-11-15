import { Module, type DynamicModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthenticationGuard, AuthenticationModule } from '@nestjs/authentication';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { PermissionsGuard } from './authorization/authorization.js';
import { CompaniesModule } from './companies/companies.module.js';
import { DevicesModule } from './devices/devices.module.js';
import { APP_CONFIG, type AppConfig } from './config.js';
import { HealthController } from './health/health.controller.js';
import { PlatformModule } from './platform/platform.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

export function createAppModule(config: AppConfig): DynamicModule {
  const configModule = { module: class ConfigModule {}, global: true, providers: [{ provide: APP_CONFIG, useValue: config }], exports: [APP_CONFIG] };
  return {
    module: class AppModule {},
    imports: [
      configModule,
      AuthenticationModule.forRoot({
        // Guards registrados abaixo, em ordem explícita: limite de taxa -> autenticação -> permissão.
        globalGuard: false,
        session: {
          absoluteTtl: '12h',
          idleTtl: '2h',
          trustedOrigins: [config.APP_URL],
          // Em desenvolvimento local sem HTTPS fora de localhost, o cookie __Host- exige secure.
          cookie: { secure: config.NODE_ENV !== 'test' },
        },
        accessToken: { key: config.JWT_SECRET, issuer: config.API_URL, audience: 'superponto', ttl: '15m' },
        refreshToken: { ttl: '30d', absoluteTtl: '90d' },
        mfa: { encryption: { keys: [config.MFA_ENCRYPTION_KEY] }, issuer: 'SuperPonto' },
        passwordReset: { url: `${config.APP_URL}/reset-password`, ttl: '1h' },
      }),
      ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
      PrismaModule,
      AuditModule,
      AuthModule,
      CompaniesModule,
      DevicesModule,
      PlatformModule,
    ],
    controllers: [HealthController],
    providers: [
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      { provide: APP_GUARD, useClass: AuthenticationGuard },
      { provide: APP_GUARD, useClass: PermissionsGuard },
    ],
  };
}
