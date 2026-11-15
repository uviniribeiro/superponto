// Verificação em duas etapas (TOTP): ativar, entrar com código, código de recuperação e desativar.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, createApp, ownerUrl } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const EMAIL = 'mfa@mfa-a.test';
const owner = createPrismaClient(ownerUrl);
let app: INestApplication;

function base32(s: string) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) bits += A.indexOf(c).toString(2).padStart(5, '0');
  return Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
}
function totp(secret: string, offset = 0) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + offset));
  const h = createHmac('sha1', base32(secret)).update(counter).digest();
  const o = h[h.length - 1]! & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
const login = (extra: Record<string, string> = {}) => api(app).post('/v1/auth/token').send({ email: EMAIL, password: PASSWORD, ...extra });

describe('MFA', () => {
  beforeAll(async () => {
    ({ app } = await createApp());
    const hash = await new PasswordHasher().hash(PASSWORD);
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const t = await tx.tenant.create({ data: { name: 'mfa-a', slug: 'mfa-a' } });
      const u = await tx.user.create({ data: { tenantId: t.id, email: EMAIL, displayName: 'Ana', passwordHash: hash } });
      const role = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'company_admin' } });
      await tx.userRole.create({ data: { userId: u.id, roleId: role.id, tenantId: t.id, scope: 'TENANT' } });
    });
  });
  afterAll(async () => { await app.close(); await owner.$disconnect(); });

  it('ativa, exige o código no login, aceita recuperação uma vez e desativa', async () => {
    const t0 = (await login().expect(200)).body.accessToken;
    const as = (t: string) => ({ Authorization: `Bearer ${t}` });
    expect((await api(app).get('/v1/auth/mfa').set(as(t0)).expect(200)).body).toEqual({ enrolled: false, recoveryCodesLeft: 0 });
    const en = await api(app).post('/v1/auth/mfa/enroll').set(as(t0)).expect(200);
    expect(en.body.uri).toMatch(/^otpauth:\/\/totp\//);
    await api(app).post('/v1/auth/mfa/confirm').set(as(t0)).send({ code: '000000' }).expect(400);
    const conf = await api(app).post('/v1/auth/mfa/confirm').set(as(t0)).send({ code: totp(en.body.secret, -1) }).expect(200);
    expect(conf.body.recoveryCodes.length).toBeGreaterThanOrEqual(8);

    // Login sem código: pede o segundo fator; com código errado: recusa; com código certo: entra.
    const need = await login().expect(401);
    expect(need.body.mfaRequired).toBe(true);
    expect((await login({ code: '123456' }).expect(401)).body.message).toMatch(/incorreto/);
    const t1 = (await login({ code: totp(en.body.secret, 0) }).expect(200)).body.accessToken;
    expect((await api(app).get('/v1/auth/mfa').set(as(t1)).expect(200)).body.enrolled).toBe(true);

    // Código de recuperação vale uma vez.
    const rc = conf.body.recoveryCodes[0];
    await login({ recoveryCode: rc }).expect(200);
    await login({ recoveryCode: rc }).expect(401);

    // Token emitido antes da ativação não desativa (precisa ter passado pelo segundo fator).
    await api(app).post('/v1/auth/mfa/disable').set(as(t0)).send({ code: totp(en.body.secret) }).expect(401);
    await api(app).post('/v1/auth/mfa/disable').set(as(t1)).send({ code: totp(en.body.secret, 1) }).expect(204);
    await login().expect(200);
    const audit = await owner.$transaction(async (tx) => { await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`; return tx.auditLog.findMany({ where: { entity: 'user_mfa' }, orderBy: { createdAt: 'asc' } }); });
    expect(audit.map((a) => (a.after as { change: string }).change)).toEqual(['enabled', 'disabled']);
  });
});
