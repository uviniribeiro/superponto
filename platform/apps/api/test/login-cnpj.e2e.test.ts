// Login como na v1: usuário + CNPJ da empresa + senha (além do login por e-mail).
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, createApp, ownerUrl } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
const ids: Record<string, string> = {};
let adminToken = '';
const admin = () => ({ Authorization: `Bearer ${adminToken}` });

async function setPassword(email: string) {
  const hash = await new PasswordHasher().hash(PASSWORD);
  await owner.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
    await tx.user.update({ where: { email }, data: { passwordHash: hash } });
  });
}

describe('Login por usuário + CNPJ', () => {
  beforeAll(async () => {
    ({ app } = await createApp());
    const hash = await new PasswordHasher().hash(PASSWORD);
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const role = async (key: string) => (await tx.role.findFirstOrThrow({ where: { tenantId: null, key } })).id;
      for (const [slug, cnpj] of [['cnpj-a', '11222333000181'], ['cnpj-b', '45997418000153']] as const) {
        const t = await tx.tenant.create({ data: { name: slug, slug } });
        ids[slug] = t.id;
        await tx.company.create({ data: { tenantId: t.id, legalName: `Empresa ${slug}`, cnpj } });
        const u = await tx.user.create({ data: { tenantId: t.id, email: `admin@${slug}.test`, displayName: 'Admin', passwordHash: hash, username: 'admin' } });
        await tx.userRole.create({ data: { userId: u.id, roleId: await role('company_admin'), tenantId: t.id, scope: 'TENANT' } });
      }
      ids.employeeRole = await role('employee');
    });
    adminToken = (await api(app).post('/v1/auth/token').send({ email: 'admin@cnpj-a.test', password: PASSWORD }).expect(200)).body.accessToken;
  });
  afterAll(async () => { await app.close(); await owner.$disconnect(); });

  it('o administrador cadastra o usuário (minúsculo, único no cliente)', async () => {
    await api(app).post('/v1/users').set(admin()).send({ email: 'joao@cnpj-a.test', username: 'joão silva', displayName: 'João', roleIds: [ids.employeeRole] }).expect(400);
    const u = await api(app).post('/v1/users').set(admin()).send({ email: 'joao@cnpj-a.test', username: 'Joao.Silva', displayName: 'João', roleIds: [ids.employeeRole] }).expect(201);
    expect(u.body.username).toBe('joao.silva');
    ids.joao = u.body.id;
    await api(app).post('/v1/users').set(admin()).send({ email: 'outro@cnpj-a.test', username: 'joao.silva', displayName: 'Outro', roleIds: [ids.employeeRole] }).expect(409);
    const list = await api(app).get('/v1/users').set(admin()).expect(200);
    expect(list.body.data.find((x: { id: string }) => x.id === ids.joao).username).toBe('joao.silva');
  });

  it('entra com usuário + CNPJ (com ou sem máscara) e senha; o e-mail continua valendo', async () => {
    await setPassword('joao@cnpj-a.test');
    const r = await api(app).post('/v1/auth/token').send({ username: 'JOAO.SILVA', cnpj: '11.222.333/0001-81', password: PASSWORD }).expect(200);
    expect(r.body.accessToken).toBeTruthy();
    const me = await api(app).get('/v1/auth/me').set({ Authorization: `Bearer ${r.body.accessToken}` }).expect(200);
    expect(me.body.email).toBe('joao@cnpj-a.test');
    await api(app).post('/v1/auth/token').send({ email: 'joao@cnpj-a.test', password: PASSWORD }).expect(200);
  });

  it('o mesmo usuário em clientes diferentes: o CNPJ decide a conta', async () => {
    const a = await api(app).post('/v1/auth/token').send({ username: 'admin', cnpj: '11222333000181', password: PASSWORD }).expect(200);
    const b = await api(app).post('/v1/auth/token').send({ username: 'admin', cnpj: '45997418000153', password: PASSWORD }).expect(200);
    const meA = await api(app).get('/v1/auth/me').set({ Authorization: `Bearer ${a.body.accessToken}` }).expect(200);
    const meB = await api(app).get('/v1/auth/me').set({ Authorization: `Bearer ${b.body.accessToken}` }).expect(200);
    expect([meA.body.email, meB.body.email]).toEqual(['admin@cnpj-a.test', 'admin@cnpj-b.test']);
  });

  it('senha errada, CNPJ de outro cliente ou usuário inexistente: a mesma mensagem', async () => {
    for (const body of [
      { username: 'joao.silva', cnpj: '11222333000181', password: 'errada-123' },
      { username: 'joao.silva', cnpj: '45997418000153', password: PASSWORD },
      { username: 'ninguem', cnpj: '11222333000181', password: PASSWORD },
    ]) {
      const r = await api(app).post('/v1/auth/token').send(body).expect(401);
      expect(r.body.message).toBe('Usuário, CNPJ ou senha incorretos');
    }
    await api(app).post('/v1/auth/token').send({ username: 'joao.silva', password: PASSWORD }).expect(400);
    await api(app).post('/v1/auth/token').send({ password: PASSWORD }).expect(400);
  });

  it('trocar ou retirar o usuário muda o login na hora', async () => {
    // Nova instância: zera o limite de tentativas de login por minuto usado nos testes acima.
    await app.close();
    ({ app } = await createApp());
    const r = await api(app).patch(`/v1/users/${ids.joao}`).set(admin()).send({ username: 'jsilva' }).expect(200);
    expect(r.body.username).toBe('jsilva');
    await api(app).post('/v1/auth/token').send({ username: 'joao.silva', cnpj: '11222333000181', password: PASSWORD }).expect(401);
    await api(app).post('/v1/auth/token').send({ username: 'jsilva', cnpj: '11222333000181', password: PASSWORD }).expect(200);
    await api(app).patch(`/v1/users/${ids.joao}`).set(admin()).send({ username: 'admin' }).expect(409);
    await api(app).patch(`/v1/users/${ids.joao}`).set(admin()).send({ username: null }).expect(200);
    await api(app).post('/v1/auth/token').send({ username: 'jsilva', cnpj: '11222333000181', password: PASSWORD }).expect(401);
  });
});
