// SaaS: planos com limites, assinatura por cliente, bloqueio ao exceder e suspensão.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, createApp, ownerUrl } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
const tk: Record<string, string> = {};
const ids: Record<string, string> = {};
const as = (w: string) => ({ Authorization: `Bearer ${tk[w]}` });

describe('Planos e limites', () => {
  beforeAll(async () => {
    ({ app } = await createApp());
    const hash = await new PasswordHasher().hash(PASSWORD);
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const sa = await tx.user.create({ data: { email: 'plataforma-planos@superponto.test', displayName: 'Plataforma', isPlatformAdmin: true, passwordHash: hash } });
      const r = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'super_admin' } });
      await tx.userRole.create({ data: { userId: sa.id, roleId: r.id, scope: 'PLATFORM' } });
      const t = await tx.tenant.create({ data: { name: 'plano-a', slug: 'plano-a' } });
      ids.t = t.id;
      const u = await tx.user.create({ data: { tenantId: t.id, email: 'admin@plano-a.test', displayName: 'Admin', passwordHash: hash } });
      const role = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'company_admin' } });
      await tx.userRole.create({ data: { userId: u.id, roleId: role.id, tenantId: t.id, scope: 'TENANT' } });
      ids.co = (await tx.company.create({ data: { tenantId: t.id, legalName: 'Plano Ltda' } })).id;
    });
    tk.sa = (await api(app).post('/v1/auth/token').send({ email: 'plataforma-planos@superponto.test', password: PASSWORD }).expect(200)).body.accessToken;
    tk.admin = (await api(app).post('/v1/auth/token').send({ email: 'admin@plano-a.test', password: PASSWORD }).expect(200)).body.accessToken;
  });
  afterAll(async () => { await app.close(); await owner.$disconnect(); });

  const CPFS = ['52998224725', '11144477735', '39053344705', '16899535009'];
  const emp = (n: number) => api(app).post('/v1/employees').set(as('admin')).send({ companyId: ids.co, fullName: `Pessoa ${n}`, cpf: CPFS[n - 1], registration: String(n), hiredAt: '2026-01-01' });

  it('sem assinatura não há limite; com plano, bloqueia ao passar e mostra o uso', async () => {
    await emp(1).expect(201);
    const p = await api(app).post('/v1/platform/plans').set(as('sa')).send({ key: 'basico-teste', name: 'Básico', priceCents: 9900, limits: { 'limit.employments': 2, 'limit.devices': 0 } }).expect(201);
    expect(p.body.limits).toEqual({ 'limit.employments': 2, 'limit.devices': 0 });
    await api(app).post('/v1/platform/plans').set(as('admin')).send({ key: 'x', name: 'X', priceCents: 0 }).expect(403);
    await api(app).put(`/v1/platform/tenants/${ids.t}/subscription`).set(as('sa')).send({ planId: p.body.id, status: 'ACTIVE', currentPeriodEnd: '2026-12-31' }).expect(200);
    await emp(2).expect(201);
    const over = await emp(3).expect(403);
    expect(over.body.message).toMatch(/Limite do plano Básico atingido: 2 funcionários ativos/);
    await api(app).post('/v1/devices').set(as('admin')).send({ companyId: ids.co, name: 'Relógio', ordinance: 'P671_2021' }).expect(403);
    const mine = await api(app).get('/v1/subscription').set(as('admin')).expect(200);
    expect(mine.body).toMatchObject({ plan: { name: 'Básico', status: 'ACTIVE' }, limits: { 'limit.employments': 2 }, usage: { 'limit.employments': 2, 'limit.devices': 0 } });
    // Ajuste do contrato (override) amplia só para este cliente.
    await api(app).put(`/v1/platform/tenants/${ids.t}/subscription`).set(as('sa')).send({ planId: p.body.id, status: 'ACTIVE', currentPeriodEnd: '2026-12-31', overrides: { 'limit.employments': 3 } }).expect(200);
    await emp(3).expect(201);
    expect((await api(app).get(`/v1/platform/tenants/${ids.t}/subscription`).set(as('sa')).expect(200)).body).toMatchObject({ limits: { 'limit.employments': 3 }, usage: { 'limit.employments': 3 } });
  });

  it('suspender a assinatura bloqueia o login do cliente; reativar libera', async () => {
    const plans = (await api(app).get('/v1/platform/plans').set(as('sa')).expect(200)).body;
    const planId = plans.find((x: { key: string }) => x.key === 'basico-teste').id;
    await api(app).put(`/v1/platform/tenants/${ids.t}/subscription`).set(as('sa')).send({ planId, status: 'SUSPENDED', currentPeriodEnd: '2026-12-31' }).expect(200);
    await api(app).post('/v1/auth/token').send({ email: 'admin@plano-a.test', password: PASSWORD }).expect(401);
    await api(app).put(`/v1/platform/tenants/${ids.t}/subscription`).set(as('sa')).send({ planId, status: 'ACTIVE', currentPeriodEnd: '2026-12-31' }).expect(200);
    await api(app).post('/v1/auth/token').send({ email: 'admin@plano-a.test', password: PASSWORD }).expect(200);
  });
});
