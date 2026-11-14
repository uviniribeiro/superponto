import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  JwtBearerProvider,
  SessionCookieProvider,
  type JwtClaims,
  type SessionRecord,
} from '@nestjs/authentication';
import type { AuthUser } from './auth-user.js';
import { UsersRepository } from './users.repository.js';

/** Navegador: cookie de sessão httpOnly (__Host-sid). */
@Injectable()
export class SessionAuth extends SessionCookieProvider<AuthUser> {
  constructor(private readonly users: UsersRepository, registry: AuthenticationRegistry) {
    super();
    registry.registerProvider(this);
  }

  validate(session: SessionRecord) {
    return this.users.findById(session.userId);
  }
}

/** Apps (funcionário, terminal) e integrações: Bearer JWT de 15 min + refresh token rotativo. */
@Injectable()
export class JwtAuth extends JwtBearerProvider<AuthUser> {
  constructor(private readonly users: UsersRepository, registry: AuthenticationRegistry) {
    super({ realm: 'superponto' });
    registry.registerProvider(this, { order: 1 });
  }

  validate({ sub }: JwtClaims) {
    return sub ? this.users.findById(sub) : null;
  }
}
