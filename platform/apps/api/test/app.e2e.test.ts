import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MailService } from '../src/mail/mail.service.js';
import { api, createApp, ownerUrl, resetTokenFor, waitFor } from './helpers.js';

const PLATFORM = 'plataforma@superponto.test';
const ADMIN_A = 'admin@cliente-a.test';
const ADMIN_B = 'admin@cliente-b.test';
const EMPLOYEE_A = 'funcionario@cliente-a.test';
const PASSWORD = 'Senha-Muito-Forte-2026';

let app: INestApplication;
let mail: MailService;
const owner = createPrismaClient(ownerUrl);
const tokens: Record<string, string> = {};
const tenants: Record<string, string> = {};

async function setPasswordByEmailLink(email: string, after = 0) {
  const token = await waitFor(() => resetTokenFor(mail, email, after));
  await api(app).post('/v1/auth/password/reset').send({ token, password: PASSWORD }).expect(200);
}

async function login(email: string): Promise<string> {
  const res = await api(app).post('/v1/auth/token').send({ email, password: PASSWORD }).expect(200);
  return res.body.accessToken as string;
}

const as = (email: string) => ({ Authorization: `Bearer ${tokens[email]}` });

describe('SuperPonto API — autenticação, multi-tenant, permissões e auditoria', () => {
  beforeAll(async () => {
    ({ app, mail } = await createApp());
  });

  afterAll(async () => {
    await app.close();
    await owner.$disconnect();
  });

  it('health check responde sem autenticação', async () => {
    const res = await api(app).get('/health').expect(200);
    expect(res.body.database).toBe('ok');
  });

  it('rotas exigem autenticação', async () => {
    await api(app).get('/v1/companies').expect(401);
    await api(app).get('/v1/auth/me').expect(401);
  });

  it('esqueci minha senha: mesma resposta para e-mail inexistente, sem envio', async () => {
    const before = mail.outbox.length;
    await api(app).post('/v1/auth/password/forgot').send({ email: 'ninguem@x.test' }).expect(202);
    await new Promise((r) => setTimeout(r, 300));
    expect(mail.outbox.length).toBe(before);
  });

  it('SuperAdmin define a senha pelo link de recuperação e entra', async () => {
    const sent = mail.outbox.length;
    await api(app).post('/v1/auth/password/forgot').send({ email: PLATFORM }).expect(202);
    await setPasswordByEmailLink(PLATFORM, sent);
    tokens[PLATFORM] = await login(PLATFORM);
    const me = await api(app).get('/v1/auth/me').set(as(PLATFORM)).expect(200);
    expect(me.body).toMatchObject({ email: PLATFORM, isPlatformAdmin: true });
  });

  it('link de recuperação vale uma única vez', async () => {
    const sent = mail.outbox.length;
    await api(app).post('/v1/auth/password/forgot').send({ email: PLATFORM }).expect(202);
    const token = await waitFor(() => resetTokenFor(mail, PLATFORM, sent));
    await api(app).post('/v1/auth/password/reset').send({ token, password: PASSWORD }).expect(200);
    await api(app).post('/v1/auth/password/reset').send({ token, password: PASSWORD }).expect(400);
    tokens[PLATFORM] = await login(PLATFORM); // a redefinição encerra sessões e tokens anteriores
  });

  it('senha errada e e-mail inexistente respondem igual (401)', async () => {
    const a = await api(app).post('/v1/auth/token').send({ email: PLATFORM, password: 'errada' }).expect(401);
    const b = await api(app).post('/v1/auth/token').send({ email: 'nao@existe.test', password: 'errada' }).expect(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('SuperAdmin cria dois clientes; cada administrador recebe e-mail para definir a senha', async () => {
    for (const [slug, email] of [['cliente-a', ADMIN_A], ['cliente-b', ADMIN_B]] as const) {
      const sent = mail.outbox.length;
      const res = await api(app).post('/v1/platform/tenants').set(as(PLATFORM))
        .send({ name: `Cliente ${slug}`, slug, admin: { email, displayName: `Admin ${slug}` } }).expect(201);
      tenants[slug] = res.body.tenant.id;
      await setPasswordByEmailLink(email, sent);
      tokens[email] = await login(email);
    }
  });

  it('slug duplicado é recusado', async () => {
    await api(app).post('/v1/platform/tenants').set(as(PLATFORM))
      .send({ name: 'Outro', slug: 'cliente-a', admin: { email: 'outro@cliente.test', displayName: 'Outro Admin' } }).expect(409);
  });

  it('administrador do cliente não acessa a área da plataforma', async () => {
    await api(app).get('/v1/platform/tenants').set(as(ADMIN_A)).expect(403);
  });

  let companyA = '';
  it('administrador A cadastra empresa (CNPJ normalizado) e a auditoria registra', async () => {
    const res = await api(app).post('/v1/companies').set(as(ADMIN_A))
      .send({ legalName: 'Escola Alfa Ltda', cnpj: '12.345.678/0001-95', segment: 'EDUCATION' }).expect(201);
    companyA = res.body.id;
    expect(res.body).toMatchObject({ cnpj: '12345678000195', tenantId: tenants['cliente-a'] });
    const audit = await owner.auditLog.findMany({ where: { entity: 'company', entityId: companyA } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'CREATE', tenantId: tenants['cliente-a'] });
  });

  it('validação recusa dados inválidos', async () => {
    await api(app).post('/v1/companies').set(as(ADMIN_A)).send({ legalName: 'X', cnpj: '123' }).expect(400);
  });

  it('CNPJ repetido no mesmo cliente é recusado', async () => {
    await api(app).post('/v1/companies').set(as(ADMIN_A)).send({ legalName: 'Escola Alfa 2', cnpj: '12345678000195' }).expect(409);
  });

  it('isolamento: cliente B não vê, não edita e não exclui a empresa do cliente A', async () => {
    const list = await api(app).get('/v1/companies').set(as(ADMIN_B)).expect(200);
    expect(list.body.total).toBe(0);
    await api(app).get(`/v1/companies/${companyA}`).set(as(ADMIN_B)).expect(404);
    await api(app).patch(`/v1/companies/${companyA}`).set(as(ADMIN_B)).send({ legalName: 'Invadida' }).expect(404);
    await api(app).delete(`/v1/companies/${companyA}`).set(as(ADMIN_B)).expect(404);
  });

  it('isolamento: usuário comum não troca de cliente pelo cabeçalho X-Tenant-Id', async () => {
    const res = await api(app).get('/v1/companies').set(as(ADMIN_B)).set('X-Tenant-Id', tenants['cliente-a']!).expect(200);
    expect(res.body.total).toBe(0);
  });

  it('Super Admin não acessa dados de clientes (usa só o painel da plataforma)', async () => {
    const res = await api(app).get('/v1/companies').set(as(PLATFORM)).set('X-Tenant-Id', tenants['cliente-a']!).expect(403);
    expect(res.body.message).toMatch(/painel da plataforma/);
    await api(app).get('/v1/employees').set(as(PLATFORM)).expect(403);
  });

  it('funcionário não cadastra empresa (403) — permissão validada na API', async () => {
    const hasher = new PasswordHasher();
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const user = await tx.user.create({ data: { tenantId: tenants['cliente-a']!, email: EMPLOYEE_A, displayName: 'Funcionário', passwordHash: await hasher.hash(PASSWORD) } });
      const role = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'employee' } });
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId: tenants['cliente-a']!, scope: 'TENANT' } });
    });
    tokens[EMPLOYEE_A] = await login(EMPLOYEE_A);
    await api(app).post('/v1/companies').set(as(EMPLOYEE_A)).send({ legalName: 'Tentativa' }).expect(403);
    await api(app).get('/v1/companies').set(as(EMPLOYEE_A)).expect(403);
  });

  it('edição registra antes e depois na auditoria; exclusão é lógica', async () => {
    await api(app).patch(`/v1/companies/${companyA}`).set(as(ADMIN_A)).send({ tradeName: 'Alfa' }).expect(200);
    await api(app).delete(`/v1/companies/${companyA}`).set(as(ADMIN_A)).expect(204);
    await api(app).get(`/v1/companies/${companyA}`).set(as(ADMIN_A)).expect(404);
    const row = await owner.company.findUnique({ where: { id: companyA } });
    expect(row?.deletedAt).not.toBeNull();
    const actions = (await owner.auditLog.findMany({ where: { entityId: companyA }, orderBy: { createdAt: 'asc' } })).map((a) => a.action);
    expect(actions).toEqual(['CREATE', 'UPDATE', 'DELETE']);
  });

  it('auditoria é imutável no banco', async () => {
    await expect(owner.auditLog.deleteMany({ where: { entityId: companyA } })).rejects.toThrow();
  });

  it('CNPJ alfanumérico (IN RFB 2.229/2024): aceito, normalizado e encontrado na busca', async () => {
    const res = await api(app).post('/v1/companies').set(as(ADMIN_A))
      .send({ legalName: 'Alfa Filial Norte', cnpj: '12.abc.345/01de-35' }).expect(201);
    expect(res.body.cnpj).toBe('12ABC34501DE35');
    const found = await api(app).get('/v1/companies?search=abc.345').set(as(ADMIN_A)).expect(200);
    expect(found.body.data.map((c: { id: string }) => c.id)).toEqual([res.body.id]);
  });

  it('CNPJ com dígito verificador errado ou letra no DV é recusado', async () => {
    await api(app).post('/v1/companies').set(as(ADMIN_A)).send({ legalName: 'DV errado', cnpj: '12ABC34501DE36' }).expect(400);
    await api(app).post('/v1/companies').set(as(ADMIN_A)).send({ legalName: 'Letra no DV', cnpj: '12ABC34501DE3A' }).expect(400);
    await api(app).post('/v1/companies').set(as(ADMIN_A)).send({ legalName: 'Repetido', cnpj: '11111111111111' }).expect(400);
  });

  it('multi-CNPJ: o mesmo CNPJ pode existir em clientes diferentes, sem vazar entre eles', async () => {
    await api(app).post('/v1/companies').set(as(ADMIN_B)).send({ legalName: 'Beta Norte', cnpj: '12ABC34501DE35' }).expect(201);
    const a = await api(app).get('/v1/companies?search=12ABC34501DE35').set(as(ADMIN_A)).expect(200);
    const b = await api(app).get('/v1/companies?search=12ABC34501DE35').set(as(ADMIN_B)).expect(200);
    expect(a.body.data.map((c: { legalName: string }) => c.legalName)).toEqual(['Alfa Filial Norte']);
    expect(b.body.data.map((c: { legalName: string }) => c.legalName)).toEqual(['Beta Norte']);
  });

  it('o banco recusa CNPJ fora do formato mesmo sem passar pela API', async () => {
    await expect(owner.$executeRawUnsafe(
      `UPDATE companies SET cnpj = '12.ABC.345/01DE-35' WHERE legal_name = 'Alfa Filial Norte'`,
    )).rejects.toThrow(/companies_cnpj_format/);
  });

  it('refresh token gira e o reuso revoga toda a família', async () => {
    const issued = await api(app).post('/v1/auth/token').send({ email: ADMIN_A, password: PASSWORD }).expect(200);
    const first = issued.body.refreshToken as string;
    const rotated = await api(app).post('/v1/auth/token/refresh').send({ refreshToken: first }).expect(200);
    expect(rotated.body.refreshToken).not.toBe(first);
    await api(app).post('/v1/auth/token/refresh').send({ refreshToken: first }).expect(401); // reuso detectado
    await api(app).post('/v1/auth/token/refresh').send({ refreshToken: rotated.body.refreshToken }).expect(401); // família revogada
  });

  it('cliente suspenso não consegue entrar', async () => {
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      await tx.tenant.update({ where: { id: tenants['cliente-b']! }, data: { status: 'SUSPENDED' } });
    });
    await api(app).post('/v1/auth/token').send({ email: ADMIN_B, password: PASSWORD }).expect(401);
  });

  it('documentação OpenAPI disponível', async () => {
    const res = await api(app).get('/docs-json').expect(200);
    expect(Object.keys(res.body.paths)).toEqual(expect.arrayContaining(['/v1/companies', '/v1/auth/token']));
  });
});
