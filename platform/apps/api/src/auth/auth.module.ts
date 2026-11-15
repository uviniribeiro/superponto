import { Module } from '@nestjs/common';
import { MailService } from '../mail/mail.service.js';
import { AuthController } from './auth.controller.js';
import { CredentialsService } from './credentials.service.js';
import { PasswordResetMailer } from './password-reset.handler.js';
import { PrismaAuthenticationStore } from './prisma-auth.store.js';
import { LdapService } from './ldap.service.js';
import { JwtAuth, SessionAuth } from './providers.js';
import { UsersRepository } from './users.repository.js';

@Module({
  controllers: [AuthController],
  providers: [
    UsersRepository,
    PrismaAuthenticationStore,
    SessionAuth,
    JwtAuth,
    CredentialsService,
    LdapService,
    MailService,
    PasswordResetMailer,
  ],
  exports: [UsersRepository, CredentialsService, MailService, LdapService],
})
export class AuthModule {}
