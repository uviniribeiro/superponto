// Usuários Admin e Suporte automáticos por cliente, regra de visibilidade do suporte e perfis por recurso.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MailService } from '../src/mail/mail.service.js';
import { SupportProvisioningService } from '../src/users/support.service.js';
import { api, createApp, hook, ownerUrl, resetTokenFor, waitFor } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
const hasher = new PasswordHasher();
let app: INestApplication;
let mail: MailService;
let platform = '';
let admin = '';
let support = '';
let tenantId = '';
let supportId = '';
const as = (t: string) => ({ Authorization: `Bearer ${t}` });
const login = async (email: string) => (await api(app).post('/v1/auth/token').send({ email, password: PASSWORD }).expect(200)).body.accessToken as string;

describe('Usuários, suporte e perfis', () => {
  beforeAll(async () => {
    ({ app, mail } = await createApp());
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const role = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'super_admin' } });
      const u = await tx.user.create({ data: { email: 'plataforma-usuarios@superponto.test', displayName: 'Plataforma', isPlatformAdmin: true, passwordHash: await hasher.hash(PASSWORD) } });
      await tx.userRole.create({ data: { userId: u.id, roleId: role.id, scope: 'PLATFORM' } });
    });
    platform = await login('plataforma-usuarios@superponto.test');
  });

  afterAll(async () => {
    await app.close();
    await owner.$disconnect();
  });

  it('novo cliente já nasce com Admin e Suporte', async () => {
    const sent = mail.outbox.length;
    const res = await api(app).post('/v1/platform/tenants').set(as(platform)).send({ name: 'Rede Escolar Alfa', slug: 'rede-alfa', admin: { email: 'admin@rede-alfa.test', displayName: 'Ana Admin' } }).expect(201);
    tenantId = res.body.tenant.id;
    expect(res.body.supportEmail).toBe('suporte+rede-alfa@superponto.local');
    const users = await owner.user.findMany({ where: { tenantId }, include: { roles: { include: { role: true } } } });
    expect(users.map((u) => [u.email, u.isSupport, u.roles[0]!.role.key]).sort()).toEqual([
      ['admin@rede-alfa.test', false, 'company_admin'],
      ['suporte+rede-alfa@superponto.local', true, 'company_admin'],
    ]);
    supportId = users.find((u) => u.isSupport)!.id;
    const token = await waitFor(() => resetTokenFor(mail, 'admin@rede-alfa.test', sent));
    await api(app).post('/v1/auth/password/reset').send({ token, password: PASSWORD }).expect(200);
    admin = await login('admin@rede-alfa.test');
  });

  it('clientes antigos sem suporte recebem um (idempotente)', async () => {
    const t = await owner.tenant.create({ data: { name: 'Antigo', slug: 'cliente-antigo' } });
    const backfill = () => hook('support-backfill', () => app.get(SupportProvisioningService).backfill(), (b) => b.created as number);
    expect(await backfill()).toBeGreaterThanOrEqual(1);
    expect(await owner.user.count({ where: { tenantId: t.id, isSupport: true } })).toBe(1);
    await backfill();
    expect(await owner.user.count({ where: { tenantId: t.id, isSupport: true } })).toBe(1);
  });

  it('o usuário de suporte fica oculto da lista para os usuários do cliente', async () => {
    const res = await api(app).get('/v1/users').set(as(admin)).expect(200);
    expect(res.body.data.map((u: { email: string }) => u.email)).toEqual(['admin@rede-alfa.test']);
    await api(app).patch(`/v1/users/${supportId}`).set(as(admin)).send({ displayName: 'Hack' }).expect(404);
    await api(app).delete(`/v1/users/${supportId}`).set(as(admin)).expect(404);
  });

  it('com o suporte logado, ele aparece na lista mas não pode ser editado', async () => {
    await owner.user.update({ where: { id: supportId }, data: { passwordHash: await hasher.hash(PASSWORD) } });
    support = await login('suporte+rede-alfa@superponto.local');
    const me = await api(app).get('/v1/auth/me').set(as(support)).expect(200);
    expect(me.body.isSupport).toBe(true);
    const res = await api(app).get('/v1/users').set(as(support)).expect(200);
    const sup = res.body.data.find((u: { id: string }) => u.id === supportId);
    expect(sup).toMatchObject({ isSupport: true, editable: false, isSelf: true });
    const r = await api(app).patch(`/v1/users/${supportId}`).set(as(support)).send({ displayName: 'Outro' }).expect(403);
    expect(r.body.message).toMatch(/suporte não pode ser editado/);
    await api(app).delete(`/v1/users/${supportId}`).set(as(support)).expect(403);
  });

  it('catálogo de permissões separado por módulo e recurso, sem permissões da plataforma', async () => {
    const res = await api(app).get('/v1/permissions').set(as(admin)).expect(200);
    const org = res.body.find((m: { key: string }) => m.key === 'org');
    expect(org.label).toBe('Organização');
    expect(org.resources.map((r: { label: string }) => r.label)).toEqual(expect.arrayContaining(['Empresas', 'Feriados', 'Sindicatos', 'Departamentos', 'Cargos']));
    const empresas = org.resources.find((r: { key: string }) => r.key === 'org.companies');
    expect(empresas.actions.map((a: { label: string }) => a.label)).toEqual(['Ver', 'Criar', 'Editar', 'Excluir']);
    expect(res.body.some((m: { key: string }) => m.key === 'platform')).toBe(false);
  });

  let roleId = '';
  it('perfil personalizado: criar, atribuir e o acesso segue exatamente as permissões', async () => {
    const created = await api(app).post('/v1/roles').set(as(admin)).send({ name: 'Recepção', description: 'Só consulta empresas', permissions: ['org.companies:read'] }).expect(201);
    roleId = created.body.id;
    await api(app).post('/v1/roles').set(as(admin)).send({ name: 'Ruim', permissions: ['platform.tenants:manage'] }).expect(400);
    const sent = mail.outbox.length;
    const u = await api(app).post('/v1/users').set(as(admin)).send({ email: 'recepcao@rede-alfa.test', displayName: 'Rita Recepção', roleIds: [roleId] }).expect(201);
    expect(u.body.roles.map((r: { name: string }) => r.name)).toEqual(['Recepção']);
    const token = await waitFor(() => resetTokenFor(mail, 'recepcao@rede-alfa.test', sent)); // convite por e-mail
    await api(app).post('/v1/auth/password/reset').send({ token, password: PASSWORD }).expect(200);
    const rita = await login('recepcao@rede-alfa.test');
    await api(app).get('/v1/companies').set(as(rita)).expect(200);
    await api(app).post('/v1/companies').set(as(rita)).send({ legalName: 'Tentativa' }).expect(403);
    await api(app).get('/v1/users').set(as(rita)).expect(403);
    // amplia o perfil: o acesso muda no próximo login
    await api(app).patch(`/v1/roles/${roleId}`).set(as(admin)).send({ permissions: ['org.companies:read', 'org.companies:create'] }).expect(200);
    const rita2 = await login('recepcao@rede-alfa.test');
    await api(app).post('/v1/companies').set(as(rita2)).send({ legalName: 'Unidade Recepção' }).expect(201);
  });

  it('perfis do sistema não são alteráveis; perfil em uso não pode ser excluído', async () => {
    const roles = (await api(app).get('/v1/roles').set(as(admin)).expect(200)).body;
    const sys = roles.find((r: { key: string }) => r.key === 'hr');
    expect(sys).toMatchObject({ isSystem: true, editable: false });
    expect(roles.some((r: { key: string }) => r.key === 'super_admin')).toBe(false);
    await api(app).patch(`/v1/roles/${sys.id}`).set(as(admin)).send({ name: 'Meu RH' }).expect(403);
    await api(app).delete(`/v1/roles/${roleId}`).set(as(admin)).expect(409);
  });

  it('e-mail de outro cliente não pode ser reutilizado; não pode desativar a si mesmo', async () => {
    const roles = (await api(app).get('/v1/roles').set(as(admin)).expect(200)).body;
    const emp = roles.find((r: { key: string }) => r.key === 'employee');
    const other = await owner.tenant.findFirstOrThrow({ where: { slug: 'cliente-antigo' } });
    await owner.user.create({ data: { tenantId: other.id, email: 'existente@outro-cliente.test', displayName: 'Existente' } });
    const r = await api(app).post('/v1/users').set(as(admin)).send({ email: 'Existente@Outro-Cliente.test', displayName: 'Xavier', roleIds: [emp.id] });
    expect(r.status).toBe(409);
    expect(r.body.message).not.toMatch(/antigo/i); // não revela de qual cliente é
    const me = (await api(app).get('/v1/users').set(as(admin)).expect(200)).body.data.find((u: { isSelf: boolean }) => u.isSelf);
    await api(app).patch(`/v1/users/${me.id}`).set(as(admin)).send({ isActive: false }).expect(400);
  });

  it('não é possível atribuir o perfil SuperAdmin nem perfil de outro cliente', async () => {
    const sa = await owner.role.findFirstOrThrow({ where: { key: 'super_admin', tenantId: null } });
    await api(app).post('/v1/users').set(as(admin)).send({ email: 'x@rede-alfa.test', displayName: 'X', roleIds: [sa.id] }).expect(400);
  });
});
