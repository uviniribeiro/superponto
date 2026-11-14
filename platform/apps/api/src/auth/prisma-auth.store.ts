import { Injectable } from '@nestjs/common';
import {
  AuthenticationStorage,
  type EmailTokenPurpose,
  type EmailTokenRecord,
  type EmailTokenStore,
  type MfaStore,
  type RefreshTokenRecord,
  type RefreshTokenStore,
  type SessionRecord,
  type SessionStore,
  type TotpRecord,
} from '@nestjs/authentication';
import { PrismaService } from '../prisma/prisma.service.js';

/** Remove campos nulos: os registros do pacote omitem os opcionais. */
function clean<T extends object>(row: T): T {
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null)) as T;
}

/**
 * Sessões, refresh tokens, MFA e tokens de e-mail no PostgreSQL via Prisma.
 * Toda decisão "vale uma vez" é um único comando condicional (updateMany/deleteMany com contagem),
 * para valer com várias instâncias da API. Validado pela suíte de contrato do pacote.
 */
@Injectable()
export class PrismaAuthenticationStore implements SessionStore, RefreshTokenStore, MfaStore, EmailTokenStore {
  protected readonly maxPending: number = 100_000;

  constructor(private readonly prisma: PrismaService, storage?: AuthenticationStorage) {
    storage?.registerSource({ sessions: this, refreshTokens: this, mfa: this, emailTokens: this });
  }

  private get db() {
    return this.prisma.client;
  }

  // ---------------------------------------------------------------- sessões
  async getSession(id: string): Promise<SessionRecord | undefined> {
    const row = await this.db.authSession.findUnique({ where: { id } });
    if (!row) return undefined;
    return clean({ ...row, mfa: row.mfa as SessionRecord['mfa'], metadata: row.metadata as Record<string, unknown> | undefined });
  }

  async createSession(record: SessionRecord): Promise<void> {
    await this.db.authSession.create({
      data: {
        id: record.id, userId: record.userId, createdAt: record.createdAt, expiresAt: record.expiresAt,
        lastActiveAt: record.lastActiveAt, mfa: record.mfa ?? null, metadata: (record.metadata ?? undefined) as never,
      },
    });
    await this.db.authSession.deleteMany({ where: { expiresAt: { lte: record.createdAt } } });
  }

  async touchSession(id: string, lastActiveAt: Date): Promise<void> {
    await this.db.authSession.updateMany({ where: { id, lastActiveAt: { lt: lastActiveAt } }, data: { lastActiveAt } });
  }

  async deleteSession(id: string): Promise<boolean> {
    const { count } = await this.db.authSession.deleteMany({ where: { id } });
    return count > 0;
  }

  async listUserSessions(userId: string): Promise<SessionRecord[]> {
    const rows = await this.db.authSession.findMany({ where: { userId } });
    return rows.map((row) => clean({ ...row, mfa: row.mfa as SessionRecord['mfa'], metadata: row.metadata as Record<string, unknown> | undefined }));
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.db.authSession.deleteMany({ where: { userId } });
  }

  // -------------------------------------------------------- refresh tokens
  async getRefreshToken(id: string): Promise<RefreshTokenRecord | undefined> {
    const row = await this.db.refreshToken.findUnique({ where: { id } });
    if (!row) return undefined;
    const { revoked: _revoked, ...token } = row;
    return clean({ ...token, claims: token.claims as Record<string, unknown> | undefined }) as unknown as RefreshTokenRecord;
  }

  async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    await this.db.refreshToken.create({
      data: {
        id: record.id, familyId: record.familyId, userId: record.userId, createdAt: record.createdAt,
        expiresAt: record.expiresAt, familyExpiresAt: record.familyExpiresAt, usedAt: record.usedAt ?? null,
        claims: (record.claims ?? undefined) as never,
      },
    });
    await this.db.refreshToken.deleteMany({ where: { familyExpiresAt: { lte: record.createdAt } } });
  }

  async markRefreshTokenUsed(id: string, at: Date): Promise<boolean> {
    const { count } = await this.db.refreshToken.updateMany({ where: { id, usedAt: null }, data: { usedAt: at } });
    return count === 1;
  }

  async revokeRefreshTokenFamily(familyId: string): Promise<void> {
    await this.db.refreshToken.updateMany({ where: { familyId }, data: { revoked: true } });
  }

  async isRefreshTokenFamilyRevoked(familyId: string): Promise<boolean> {
    return (await this.db.refreshToken.count({ where: { familyId, revoked: true }, take: 1 })) > 0;
  }

  async revokeUserRefreshTokens(userId: string): Promise<void> {
    await this.db.refreshToken.updateMany({ where: { userId }, data: { revoked: true } });
  }

  // ------------------------------------------------------------------ MFA
  async getTotp(userId: string): Promise<TotpRecord | undefined> {
    const row = await this.db.mfaAuthenticator.findUnique({ where: { userId } });
    if (!row) return undefined;
    const { userId: _userId, ...totp } = row;
    return clean(totp) as TotpRecord;
  }

  async saveTotp(userId: string, record: TotpRecord | null): Promise<void> {
    if (!record) {
      await this.db.mfaAuthenticator.deleteMany({ where: { userId } });
      return;
    }
    // Upsert que preserva o maior lastUsedStep (um passo já usado não pode ser reaberto).
    await this.db.$executeRaw`
      INSERT INTO auth_mfa_authenticators (user_id, secret, confirmed, pending_secret, last_used_step)
      VALUES (${userId}, ${record.secret}, ${record.confirmed}, ${record.pendingSecret ?? null}, ${record.lastUsedStep ?? null})
      ON CONFLICT (user_id) DO UPDATE SET
        secret = EXCLUDED.secret,
        confirmed = EXCLUDED.confirmed,
        pending_secret = EXCLUDED.pending_secret,
        last_used_step = GREATEST(auth_mfa_authenticators.last_used_step, EXCLUDED.last_used_step)`;
  }

  async claimTotpStep(userId: string, step: number): Promise<boolean> {
    const { count } = await this.db.mfaAuthenticator.updateMany({
      where: { userId, OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }] },
      data: { lastUsedStep: step },
    });
    return count === 1;
  }

  async saveRecoveryCodes(userId: string, hashes: string[]): Promise<void> {
    const unique = [...new Set(hashes)];
    await this.db.$transaction([
      this.db.mfaRecoveryCode.deleteMany({ where: { userId } }),
      this.db.mfaRecoveryCode.createMany({ data: unique.map((codeHash) => ({ userId, codeHash })) }),
    ]);
  }

  async consumeRecoveryCode(userId: string, hash: string): Promise<boolean> {
    const { count } = await this.db.mfaRecoveryCode.deleteMany({ where: { userId, codeHash: hash } });
    return count === 1;
  }

  countRecoveryCodes(userId: string): Promise<number> {
    return this.db.mfaRecoveryCode.count({ where: { userId } });
  }

  async recordMfaFailure(userId: string, windowMs: number, now: number): Promise<number> {
    // Inserção e contagem em comandos separados, cada um confirmado por conta própria.
    await this.db.mfaFailure.create({ data: { userId, failedAt: new Date(now) } });
    const failures = await this.countMfaFailures(userId, windowMs, now);
    await this.db.mfaFailure.deleteMany({ where: { failedAt: { lte: new Date(now - windowMs) } } });
    return failures;
  }

  countMfaFailures(userId: string, windowMs: number, now: number): Promise<number> {
    return this.db.mfaFailure.count({ where: { userId, failedAt: { gt: new Date(now - windowMs) } } });
  }

  async clearMfaFailures(userId: string): Promise<void> {
    await this.db.mfaFailure.deleteMany({ where: { userId } });
  }

  // ------------------------------------------------------- tokens de e-mail
  async saveEmailToken(record: EmailTokenRecord): Promise<void> {
    await this.db.emailToken.create({
      data: {
        id: record.id, purpose: record.purpose, userId: record.userId, email: record.email,
        fingerprint: record.fingerprint ?? null, createdAt: record.createdAt, expiresAt: record.expiresAt,
      },
    });
    await this.db.emailToken.deleteMany({ where: { expiresAt: { lte: record.createdAt } } });
    const cutoff = await this.db.emailToken.findMany({
      orderBy: { expiresAt: 'desc' }, skip: this.maxPending, take: 1, select: { expiresAt: true },
    });
    if (cutoff[0]) await this.db.emailToken.deleteMany({ where: { expiresAt: { lte: cutoff[0].expiresAt } } });
  }

  async consumeEmailToken(id: string, purpose: EmailTokenPurpose): Promise<EmailTokenRecord | undefined> {
    const rows = await this.db.$queryRaw<
      { id: string; purpose: string; user_id: string; email: string; fingerprint: string | null; created_at: Date; expires_at: Date }[]
    >`DELETE FROM auth_email_tokens WHERE id = ${id} AND purpose = ${purpose} RETURNING *`;
    const row = rows[0];
    if (!row) return undefined;
    return clean({
      id: row.id, purpose: row.purpose as EmailTokenPurpose, userId: row.user_id, email: row.email,
      fingerprint: row.fingerprint ?? undefined, createdAt: row.created_at, expiresAt: row.expires_at,
    }) as EmailTokenRecord;
  }

  async deleteUserEmailTokens(userId: string, purpose: EmailTokenPurpose): Promise<void> {
    await this.db.emailToken.deleteMany({ where: { userId, purpose } });
  }
}
