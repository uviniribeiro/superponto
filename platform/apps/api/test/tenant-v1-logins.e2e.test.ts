// Cliente criado como na v1: empresa com o CNPJ, "admin" e "suporte" com senha inicial mostrada uma vez,
// login por usuário + CNPJ e suporte oculto e não editável pelo cliente.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, createApp, ownerUrl } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
let platform = '';
const as = (t: string) => ({ Authorization: `Bearer ${t}` });

/** CNPJ válido a partir de 12 dígitos (base + filial). */
function cnpj(base12: string) {
  const dv = (s: string) => {
    const w = s.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = [...s].reduce((a, c, i) => a + Number(c) * w[i]!, 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base12);
  return `${base12}${d1}${dv(`${base12}${d1}`)}`;
}
const CNPJ_A = cnpj('730415260001');
const CNPJ_B = cnpj('730415270001');

describe('Cliente com admin e suporte automáticos (como na v1)', () => {
  beforeAll(async () => {
    ({ app } = await createApp());
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const role = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'super_admin' } });
      const u = await tx.user.create({ data: { email: 'plataforma-v1logins@superponto.test', displayName: 'Plataforma', isPlatformAdmin: true, passwordHash: await new PasswordHasher().hash(PASSWORD) } });
      await tx.userRole.create({ data: { userId: u.id, roleId: role.id, scope: 'PLATFORM' } });
    });
    platform = (await api(app).post('/v1/auth/token').send({ email: 'plataforma-v1logins@superponto.test', password: PASSWORD }).expect(200)).body.accessToken;
  });
  afterAll(async () => { await app.close(); await owner.$disconnect(); });

  it('cria empresa, admin e suporte; senhas iniciais vêm uma única vez na resposta', async () => {
    const r = await api(app).post('/v1/platform/tenants').set(as(platform)).send({ name: 'Prefeitura de Teste', slug: 'pref-teste-v1', document: CNPJ_A }).expect(201);
    expect(r.body.credentials).toMatchObject({ cnpj: CNPJ_A, admin: { username: 'admin' }, support: { username: 'suporte' } });
    expect(r.body.credentials.admin.password).toMatch(/^\S{12,}$/);
    expect(r.body.credentials.admin.password).not.toBe(r.body.credentials.support.password);
    expect(r.body.companyId).toBeTruthy();
    const company = await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      return tx.company.findUniqueOrThrow({ where: { id: r.body.companyId } });
    });
    expect(company).toMatchObject({ cnpj: CNPJ_A, legalName: 'Prefeitura de Teste' });

    // Admin entra com usuário + CNPJ e é obrigado a trocar a senha.
    const adm = await api(app).post('/v1/auth/token').send({ username: 'admin', cnpj: CNPJ_A, password: r.body.credentials.admin.password }).expect(200);
    const me = await api(app).get('/v1/auth/me').set(as(adm.body.accessToken)).expect(200);
    expect(me.body).toMatchObject({ mustChangePassword: true, isSupport: false });
    // Suporte também entra pelo login da v1.
    const sup = await api(app).post('/v1/auth/token').send({ username: 'suporte', cnpj: CNPJ_A, password: r.body.credentials.support.password }).expect(200);
    expect((await api(app).get('/v1/auth/me').set(as(sup.body.accessToken)).expect(200)).body.isSupport).toBe(true);

    // Suporte oculto e bloqueado para o cliente.
    const list = await api(app).get('/v1/users').set(as(adm.body.accessToken)).expect(200);
    expect(list.body.data.map((u: { username: string }) => u.username)).toEqual(['admin']);
    const supportId = (await api(app).get('/v1/users').set(as(sup.body.accessToken)).expect(200)).body.data.find((u: { isSupport: boolean }) => u.isSupport).id;
    await api(app).patch(`/v1/users/${supportId}`).set(as(adm.body.accessToken)).send({ displayName: 'Outro' }).expect(404);
    await api(app).patch(`/v1/users/${supportId}`).set(as(sup.body.accessToken)).send({ displayName: 'Outro' }).expect(403);
  });

  it('CNPJ de outro cliente é recusado; sem e-mail, o admin recebe um endereço interno', async () => {
    await api(app).post('/v1/platform/tenants').set(as(platform)).send({ name: 'Copia', slug: 'copia-v1', document: CNPJ_A }).expect(409);
    const r = await api(app).post('/v1/platform/tenants').set(as(platform)).send({ name: 'Escola B', slug: 'escola-b-v1', document: CNPJ_B, admin: { displayName: 'Diretora' } }).expect(201);
    const adm = await api(app).post('/v1/auth/token').send({ username: 'admin', cnpj: CNPJ_B, password: r.body.credentials.admin.password }).expect(200);
    const me = await api(app).get('/v1/auth/me').set(as(adm.body.accessToken)).expect(200);
    expect(me.body).toMatchObject({ email: 'admin@escola-b-v1.superponto.local', displayName: 'Diretora' });
  });
});
