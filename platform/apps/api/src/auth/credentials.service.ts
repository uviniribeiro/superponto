import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import type { AuthUser } from './auth-user.js';
import { LdapService } from './ldap.service.js';
import { UsersRepository } from './users.repository.js';

@Injectable()
export class CredentialsService {
  constructor(private readonly users: UsersRepository, private readonly hasher: PasswordHasher, private readonly ldap: LdapService) {}

  hash(password: string) {
    return this.hasher.hash(password);
  }

  /** Usuário ou `null`. E-mail inexistente e senha errada levam o mesmo tempo (hash fictício). */
  async verify(email: string, password: string): Promise<AuthUser | null> {
    const found = await this.users.findCredentials(email);
    if (found?.authSource === 'LDAP') return this.verifyLdap(found, email, password);
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

  /** Conta LDAP: a senha é conferida no diretório do cliente; sem configuração ativa, não entra. */
  private async verifyLdap(found: NonNullable<Awaited<ReturnType<UsersRepository['findCredentials']>>>, email: string, password: string): Promise<AuthUser | null> {
    const cfg = found.user.tenantId ? await this.users.findLdapConfig(found.user.tenantId) : null;
    if (!cfg) return null;
    const result = await this.ldap.authenticate(cfg, email, password);
    if (!result.ok) {
      if (result.reason === 'unreachable' || result.reason === 'config') {
        throw new ServiceUnavailableException('Não foi possível falar com o diretório da sua organização (LDAP). Tente novamente ou fale com o administrador.');
      }
      return null;
    }
    if (found.denial) throw new ForbiddenException(found.denial);
    await this.users.recordLogin(found.user.id);
    return found.user;
  }

  /** Troca de senha pelo próprio usuário (confere a senha atual). */
  async change(userId: string, current: string, next: string): Promise<void> {
    if ((await this.users.findAuthSource(userId)) === 'LDAP') throw new BadRequestException('Sua senha é a mesma da rede da organização (LDAP): troque-a no diretório da empresa');
    const hash = await this.users.findHashById(userId);
    if (!hash || !(await this.hasher.verify(current, hash))) throw new BadRequestException('Senha atual incorreta');
    if (current === next) throw new BadRequestException('A nova senha deve ser diferente da atual');
    await this.users.updatePasswordHash(userId, await this.hasher.hash(next));
  }
}
