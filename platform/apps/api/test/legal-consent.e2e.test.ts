// Prova do aceite dos documentos legais (LGPD): registrado no servidor com versão e data.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, createApp, ownerUrl } from './helpers.js';

const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
let token = '';

describe('Aceite LGPD', () => {
  beforeAll(async () => {
    ({ app } = await createApp());
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const t = await tx.tenant.create({ data: { name: 'Aceite', slug: 'aceite-lgpd' } });
      await tx.user.create({ data: { tenantId: t.id, email: 'aceite@superponto.test', displayName: 'Aceite', passwordHash: await new PasswordHasher().hash('Aceite-Forte-1') } });
    });
    token = (await api(app).post('/v1/auth/token').send({ email: 'aceite@superponto.test', password: 'Aceite-Forte-1' }).expect(200)).body.accessToken;
  });
  afterAll(async () => { await app.close(); await owner.$disconnect(); });

  it('sem aceite → registra → devolve a versão aceita', async () => {
    const as = { Authorization: `Bearer ${token}` };
    expect((await api(app).get('/v1/auth/legal-consent').set(as).expect(200)).body.version).toBeNull();
    await api(app).post('/v1/auth/legal-consent').set(as).send({ version: '2026-11-22' }).expect(201);
    const r = await api(app).get('/v1/auth/legal-consent').set(as).expect(200);
    expect(r.body.version).toBe('2026-11-22');
    expect(r.body.acceptedAt).toBeTruthy();
    await api(app).post('/v1/auth/legal-consent').set(as).send({}).expect(400);
  });
});
