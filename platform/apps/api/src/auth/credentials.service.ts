import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
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
    // Só depois da senha correta: não revela a quem não sabe a senha se a conta existe.
    if (found.denial) throw new ForbiddenException(found.denial);
    if (this.hasher.needsRehash(found.passwordHash)) {
      await this.users.updatePasswordHash(found.user.id, await this.hasher.hash(password));
    }
    await this.users.recordLogin(found.user.id);
    return found.user;
  }

  /** Troca de senha pelo próprio usuário (confere a senha atual). */
  async change(userId: string, current: string, next: string): Promise<void> {
    const hash = await this.users.findHashById(userId);
    if (!hash || !(await this.hasher.verify(current, hash))) throw new BadRequestException('Senha atual incorreta');
    if (current === next) throw new BadRequestException('A nova senha deve ser diferente da atual');
    await this.users.updatePasswordHash(userId, await this.hasher.hash(next));
  }
}
