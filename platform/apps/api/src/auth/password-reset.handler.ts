import { Injectable } from '@nestjs/common';
import { AuthenticationRegistry, PasswordResetHandler, type PasswordResetLink } from '@nestjs/authentication';
import { MailService } from '../mail/mail.service.js';
import { UsersRepository } from './users.repository.js';

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

@Injectable()
export class PasswordResetMailer extends PasswordResetHandler {
  constructor(private readonly users: UsersRepository, private readonly mail: MailService, registry: AuthenticationRegistry) {
    super();
    registry.registerHandler('passwordReset', this);
  }

  /** O link vai para o e-mail cadastrado, nunca para o digitado; vale enquanto e-mail e senha não mudarem. */
  async findUser(email: string) {
    const found = await this.users.findCredentials(email);
    // Conta LDAP não tem senha local: a redefinição é feita no diretório da organização.
    if (!found || found.authSource === 'LDAP') return null;
    return { id: found.user.id, email: found.user.email, passwordHash: found.passwordHash };
  }

  async send(link: PasswordResetLink) {
    await this.mail.send({
      to: link.email,
      subject: 'SuperPonto — redefinição de senha',
      text: `Recebemos um pedido para redefinir sua senha.\n\nAbra o link (válido uma vez, por 1 hora):\n${link.url}\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.`,
      html: `<p>Recebemos um pedido para redefinir sua senha do SuperPonto.</p><p><a href="${escape(link.url)}">Definir nova senha</a></p><p>O link funciona uma vez, por 1 hora. Se não foi você, ignore este e-mail.</p>`,
    });
  }

  async updatePassword(userId: string, passwordHash: string) {
    await this.users.updatePasswordHash(userId, passwordHash);
    await this.users.logAccess(userId, 'UPDATE', 'user_password', { via: 'reset' });
  }
}
