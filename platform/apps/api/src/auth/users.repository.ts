import { Injectable } from '@nestjs/common';
import type { Grant } from '../authorization/authorization.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth-user.js';

export const normalizeEmail = (email: string) => email.trim().normalize('NFC').toLowerCase();

/**
 * Usuários para autenticação. Opera em modo plataforma (o login acontece antes de saber o tenant)
 * e devolve só `AuthUser`: o hash de senha nunca sai desta classe, exceto em `findCredentials`.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<AuthUser | null> {
    return this.prisma.asPlatform(async (tx) => {
      const user = await tx.user.findFirst({ where: { id, isActive: true, deletedAt: null } });
      if (!user) return null;
      // Bloqueio ou dia sem acesso derrubam também sessões e tokens já emitidos.
      if (await accessDenial(tx, user)) return null;
      return this.toAuthUser(tx, user);
    });
  }

  /** Hash atual (para conferir a senha antiga na troca de senha). */
  async findHashById(id: string): Promise<string | null> {
    return this.prisma.asPlatform(async (tx) => (await tx.user.findFirst({ where: { id, deletedAt: null }, select: { passwordHash: true } }))?.passwordHash ?? null);
  }

  async findCredentials(email: string): Promise<{ user: AuthUser; passwordHash: string | null; denial: string | null } | null> {
    return this.prisma.asPlatform(async (tx) => {
      const user = await tx.user.findFirst({ where: { email: normalizeEmail(email), isActive: true, deletedAt: null } });
      if (!user) return null;
      if (user.tenantId) {
        const tenant = await tx.tenant.findUnique({ where: { id: user.tenantId } });
        if (!tenant || tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED' || tenant.deletedAt) return null;
      }
      return { user: await this.toAuthUser(tx, user), passwordHash: user.passwordHash, denial: await accessDenial(tx, user) };
    });
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.asPlatform((tx) =>
      tx.user.update({ where: { id }, data: { passwordHash, mustChangePassword: false, failedLogins: 0 } }),
    );
  }

  async recordLogin(id: string): Promise<void> {
    await this.prisma.asPlatform((tx) => tx.user.update({ where: { id }, data: { lastLoginAt: new Date(), failedLogins: 0 } }));
  }

  private async toAuthUser(tx: Parameters<Parameters<PrismaService['asPlatform']>[0]>[0], user: {
    id: string; email: string; displayName: string; tenantId: string | null; personId: string | null;
    isPlatformAdmin: boolean; isSupport: boolean; mustChangePassword: boolean;
  }): Promise<AuthUser> {
    const roles = await tx.userRole.findMany({
      where: { userId: user.id },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    const grants: Grant[] = roles.flatMap((ur) =>
      ur.role.deletedAt ? [] : ur.role.permissions.map((rp) => ({
        permission: rp.permission.key,
        scope: ur.scope,
        companyId: ur.companyId,
        unitId: ur.unitId,
        departmentId: ur.departmentId,
      })),
    );
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      tenantId: user.tenantId,
      personId: user.personId,
      isPlatformAdmin: user.isPlatformAdmin,
      isSupport: user.isSupport,
      mustChangePassword: user.mustChangePassword,
      grants,
    };
  }
}

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

/**
 * Motivo pelo qual o usuário não pode entrar agora, ou null: bloqueio por período ativo ou dia da
 * semana fora dos permitidos (horário de Brasília).
 */
export async function accessDenial(tx: Tx, user: { id: string; accessWeekdays: number[] }, now = new Date()): Promise<string | null> {
  const block = await tx.userAccessBlock.findFirst({
    where: { userId: user.id, revokedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    orderBy: { startsAt: 'desc' },
  });
  if (block) {
    const until = block.endsAt ? ` até ${block.endsAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}` : '';
    return `Acesso bloqueado${until}. Motivo: ${block.reason}`;
  }
  if (user.accessWeekdays.length) {
    const wd = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay();
    if (!user.accessWeekdays.includes(wd)) return `Seu acesso não é permitido em ${WEEKDAYS[wd]}`;
  }
  return null;
}
