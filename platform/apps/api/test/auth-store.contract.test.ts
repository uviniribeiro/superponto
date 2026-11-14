// Suíte oficial do @nestjs/authentication contra o store Prisma, inclusive corridas concorrentes
// (refresh simultâneo, códigos TOTP repetidos, consumo duplo de link).
import { authenticationStoreContract } from '@nestjs/authentication/testing';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { PrismaAuthenticationStore } from '../src/auth/prisma-auth.store.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createPrismaClient } from '@superponto/database';
import { ownerUrl, testConfig } from './helpers.js';

class CappedStore extends PrismaAuthenticationStore {
  protected override readonly maxPending = 3;
}

const prisma = new PrismaService(testConfig());
// Limpeza entre casos com o papel dono: o papel da API não tem TRUNCATE (de propósito).
const owner = createPrismaClient(ownerUrl);

async function emptyStore() {
  await owner.$executeRawUnsafe(
    'TRUNCATE auth_sessions, auth_refresh_tokens, auth_mfa_authenticators, auth_mfa_recovery_codes, auth_mfa_failures, auth_email_tokens RESTART IDENTITY',
  );
  const store = new CappedStore(prisma);
  return { sessions: store, refreshTokens: store, mfa: store, emailTokens: store };
}

describe('PrismaAuthenticationStore — contrato do @nestjs/authentication', () => {
  beforeAll(async () => { await prisma.client.$connect(); });
  afterAll(async () => { await prisma.onModuleDestroy(); await owner.$disconnect(); });

  for (const c of authenticationStoreContract(emptyStore, {
    contracts: ['sessions', 'refreshTokens', 'mfa', 'emailTokens'],
    concurrent: true,
    maxPending: 3,
  })) {
    it(`${c.contract}: ${c.name}`, () => c.run());
  }
});
