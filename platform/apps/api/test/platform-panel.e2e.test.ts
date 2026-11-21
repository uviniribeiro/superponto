// Painel do Super Admin (como na v1): só ferramentas da plataforma — números por cliente, suspender e
// reativar, nova senha do admin/suporte — e nenhum acesso aos dados dos clientes. Mais uma varredura de
// todas as tabelas: um cliente não enxerga nenhuma linha de outro.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, appUrl, createApp, ownerUrl } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
let platform = '';
const as = (t: string) => ({ Authorization: `Bearer ${t}` });

function cnpj(base12: string) {
  const dv = (s: string) => {
    const w = s.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = [...s].reduce((a, c, i) => a + Number(c) * w[i]!, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base12);
  return `${base12}${d1}${dv(`${base12}${d1}`)}`;
}
const CNPJ_X = cnpj('815263740001');
const CNPJ_Y = cnpj('815263750001');

describe('Painel do Super Admin e isolamento entre clientes', () => {
  let x: { id: string; admin: string; support: string };
  let y: { id: string; admin: string };

  beforeAll(async () => {
    ({ app } = await createApp());
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const role = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'super_admin' } });
      const u = await tx.user.create({ data: { email: 'plataforma-painel@superponto.test', displayName: 'Plataforma', isPlatformAdmin: true, passwordHash: await new PasswordHasher().hash(PASSWORD) } });
      await tx.userRole.create({ data: { userId: u.id, roleId: role.id, scope: 'PLATFORM' } });
    });
    platform = (await api(app).post('/v1/auth/token').send({ email: 'plataforma-painel@superponto.test', password: PASSWORD }).expect(200)).body.accessToken;
    const a = (await api(app).post('/v1/platform/tenants').set(as(platform)).send({ name: 'Cliente X', slug: 'painel-x', document: CNPJ_X }).expect(201)).body;
    const b = (await api(app).post('/v1/platform/tenants').set(as(platform)).send({ name: 'Cliente Y', slug: 'painel-y', document: CNPJ_Y }).expect(201)).body;
    x = { id: a.tenant.id, admin: a.credentials.admin.password, support: a.credentials.support.password };
    y = { id: b.tenant.id, admin: b.credentials.admin.password };
  });
  afterAll(async () => { await app.close(); await owner.$disconnect(); });

  it('painel mostra só números por cliente (sem dados de pessoas)', async () => {
    const r = await api(app).get('/v1/platform/tenants/overview').set(as(platform)).expect(200);
    expect(r.body.totals.tenants).toBeGreaterThanOrEqual(2);
    const row = r.body.data.find((t: { id: string }) => t.id === x.id);
    expect(row).toMatchObject({ name: 'Cliente X', status: 'TRIAL', companies: 1, cnpjs: [CNPJ_X], users: 1, employees: 0, devices: 0 });
    const semCnpj = (await api(app).post('/v1/platform/tenants').set(as(platform)).send({ name: 'Sem CNPJ', slug: 'painel-sem-cnpj' }).expect(201)).body.tenant.id;
    const r2 = await api(app).get('/v1/platform/tenants/overview').set(as(platform)).expect(200);
    expect(r2.body.data.find((t: { id: string }) => t.id === semCnpj)).toMatchObject({ cnpjs: [], companies: 0 });
    expect(Object.keys(row).sort()).toEqual(['cnpjs', 'companies', 'createdAt', 'devices', 'employees', 'id', 'name', 'slug', 'status', 'users']);
  });

  it('Super Admin não entra nos dados de cliente nenhum', async () => {
    for (const path of ['/v1/companies', '/v1/users', '/v1/employees', '/v1/dashboard/summary']) {
      const r = await api(app).get(path).set(as(platform)).set('X-Tenant-Id', x.id); expect([path, r.status, r.body.message]).toEqual([path, 403, expect.stringMatching(/painel/)]);
    }
  });

  it('suspende (sem login) e reativa o cliente', async () => {
    await api(app).post('/v1/auth/token').send({ username: 'admin', cnpj: CNPJ_Y, password: y.admin }).expect(200);
    await api(app).patch(`/v1/platform/tenants/${y.id}`).set(as(platform)).send({ status: 'SUSPENDED' }).expect(200);
    await api(app).post('/v1/auth/token').send({ username: 'admin', cnpj: CNPJ_Y, password: y.admin }).expect(401);
    await api(app).patch(`/v1/platform/tenants/${y.id}`).set(as(platform)).send({ status: 'ACTIVE', name: 'Cliente Y Ltda' }).expect(200);
    await api(app).post('/v1/auth/token').send({ username: 'admin', cnpj: CNPJ_Y, password: y.admin }).expect(200);
    await api(app).patch(`/v1/platform/tenants/${y.id}`).set(as(platform)).send({ status: 'QUALQUER' }).expect(400);
  });

  it('gera nova senha do admin e do suporte (mostrada uma vez)', async () => {
    const adm = await api(app).post(`/v1/platform/tenants/${x.id}/reset-password`).set(as(platform)).send({ who: 'admin' }).expect(201);
    expect(adm.body).toMatchObject({ username: 'admin' });
    await api(app).post('/v1/auth/token').send({ username: 'admin', cnpj: CNPJ_X, password: x.admin }).expect(401);
    const t = (await api(app).post('/v1/auth/token').send({ username: 'admin', cnpj: CNPJ_X, password: adm.body.password }).expect(200)).body.accessToken;
    expect((await api(app).get('/v1/auth/me').set(as(t)).expect(200)).body.mustChangePassword).toBe(true);
    const sup = await api(app).post(`/v1/platform/tenants/${x.id}/reset-password`).set(as(platform)).send({ who: 'support' }).expect(201);
    expect(sup.body.username).toBe('suporte');
    await api(app).post('/v1/auth/token').send({ username: 'suporte', cnpj: CNPJ_X, password: sup.body.password }).expect(200);
    // Cliente comum não usa as ferramentas da plataforma.
    await api(app).get('/v1/platform/tenants/overview').set(as(t)).expect(403);
    await api(app).post(`/v1/platform/tenants/${y.id}/reset-password`).set(as(t)).send({ who: 'admin' }).expect(403);
  });

  it('varredura: com a sessão de um cliente, nenhuma tabela devolve linhas de outro cliente', async () => {
    const db = new pg.Client({ connectionString: appUrl });
    await db.connect();
    try {
      const tables = (await db.query(`SELECT table_name FROM information_schema.columns WHERE table_schema = 'superponto' AND column_name = 'tenant_id'
        AND table_name IN (SELECT table_name FROM information_schema.tables WHERE table_schema = 'superponto' AND table_type = 'BASE TABLE')`)).rows.map((r) => r.table_name as string);
      expect(tables.length).toBeGreaterThan(50);
      await db.query('BEGIN');
      await db.query(`SELECT set_config('app.tenant_id', $1, true)`, [x.id]);
      const leaks: string[] = [];
      for (const t of tables) {
        const r = await db.query(`SELECT count(*)::int AS n FROM superponto."${t}" WHERE tenant_id IS DISTINCT FROM $1::uuid AND NOT (tenant_id IS NULL AND '${t}' <> 'users')`, [x.id]);
        if (r.rows[0].n > 0) leaks.push(`${t}: ${r.rows[0].n}`);
      }
      // Usuários sem cliente (o Super Admin) também não aparecem para o cliente.
      const nullUsers = (await db.query(`SELECT count(*)::int AS n FROM superponto.users WHERE tenant_id IS NULL`)).rows[0].n;
      const otherTenants = (await db.query(`SELECT count(*)::int AS n FROM superponto.tenants WHERE id <> $1::uuid`, [x.id])).rows[0].n;
      await db.query('ROLLBACK');
      expect(leaks).toEqual([]);
      expect(nullUsers).toBe(0);
      expect(otherTenants).toBe(0);
    } finally {
      await db.end();
    }
  });
});
