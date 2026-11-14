import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import type { AuthUser } from './auth-user.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class CredentialsService {
  constructor(private readonly users: UsersRepository, private readonly hasher: PasswordHasher) {}

  hash(password: string) {
    return this.hasher.hash(password);
  }

  /** Usuário ou `null`. E-mail inexistente e senha errada levam o mesmo tempo (hash fictício). */
  async verify(email: string, password: string): Promise<AuthUser | null> {
    const found = await this.users.findCredentials(email);
    const valid = await this.hasher.verify(password, found?.passwordHash);
    if (!valid || !found?.passwordHash) return null;
    if (this.hasher.needsRehash(found.passwordHash)) {
      await this.users.updatePasswordHash(found.user.id, await this.hasher.hash(password));
    }
    await this.users.recordLogin(found.user.id);
    return found.user;
  }
}
