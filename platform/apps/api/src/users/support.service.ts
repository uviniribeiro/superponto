import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { PasswordResetService } from '@nestjs/authentication';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';

/** Endereço do suporte de um cliente: suporte+<slug>@dominio (mesma caixa de e-mail do suporte). */
export function supportEmailFor(base: string, slug: string) {
  const [local, domain] = base.toLowerCase().split('@');
  return `${local}+${slug}@${domain}`;
}

/**
 * Usuário de suporte e treinamento da equipe SuperPonto em cada cliente: criado junto com o
 * cliente e, para clientes antigos, na subida da API. Perfil de administrador do cliente, oculto
 * da lista para os usuários do cliente e não editável por eles.
 */
@Injectable()
export class SupportProvisioningService implements OnApplicationBootstrap {
  private readonly log = new Logger('Suporte');
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordReset: PasswordResetService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Garante o usuário de suporte do cliente dentro de uma transação já aberta. Idempotente. */
  async ensureInTx(tx: Tx, tenant: { id: string; slug: string }, passwordHash?: string): Promise<{ id: string; email: string; created: boolean }> {
    const existing = await tx.user.findFirst({ where: { tenantId: tenant.id, isSupport: true, deletedAt: null }, select: { id: true, email: true, username: true } });
    if (existing) {
      // Login da v1: usuário "suporte" + CNPJ (clientes antigos ganham o usuário se estiver livre).
      if (!existing.username && !(await tx.user.findFirst({ where: { tenantId: tenant.id, username: 'suporte' } }))) await tx.user.update({ where: { id: existing.id }, data: { username: 'suporte' } });
      return { id: existing.id, email: existing.email, created: false };
    }
    const email = supportEmailFor(this.config.SUPPORT_EMAIL, tenant.slug);
    const role = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'company_admin' } });
    const username = (await tx.user.findFirst({ where: { tenantId: tenant.id, username: 'suporte' } })) ? null : 'suporte';
    const user = await tx.user.create({ data: { tenantId: tenant.id, email, username, displayName: 'Suporte SuperPonto', isSupport: true, ...(passwordHash ? { passwordHash, mustChangePassword: true } : {}) } });
    await tx.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId: tenant.id, scope: 'TENANT' } });
    return { id: user.id, email, created: true };
  }

  /** Envia o link de definição de senha para a caixa do suporte (quando é um e-mail real). */
  sendAccess(email: string) {
    if (!email.endsWith('.local')) this.passwordReset.request(email);
  }

  /** Clientes antigos sem usuário de suporte recebem um na subida da API. */
  async backfill(): Promise<number> {
    const tenants = await this.prisma.asPlatform((tx) => tx.tenant.findMany({ where: { deletedAt: null, OR: [{ users: { none: { isSupport: true, deletedAt: null } } }, { users: { some: { isSupport: true, deletedAt: null, username: null } } }] }, select: { id: true, slug: true } }));
    let created = 0;
    for (const t of tenants) {
      const r = await this.prisma.asPlatform((tx) => this.ensureInTx(tx, t));
      if (r.created) { created++; this.sendAccess(r.email); }
    }
    if (created) this.log.log(`${created} usuário(s) de suporte criado(s)`);
    return created;
  }

  onApplicationBootstrap() {
    if (this.config.NODE_ENV === 'test') return;
    this.backfill().catch((e: Error) => this.log.error(`Falha ao criar usuários de suporte: ${e.message}`));
  }
}
