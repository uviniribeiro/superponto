// Login pela rede da organização (LDAP / Active Directory), contra um OpenLDAP real.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { Client } from 'ldapts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildFilter, LdapService } from '../src/auth/ldap.service.js';
import type { AppConfig } from '../src/config.js';
import type { MailService } from '../src/mail/mail.service.js';
import { api, createApp, ownerUrl, waitFor } from './helpers.js';

const LDAP_URL = process.env.TEST_LDAP_URL ?? 'ldap://127.0.0.1:1389';
const BASE = 'dc=empresa,dc=test';
const ADMIN_DN = `cn=admin,${BASE}`;
const ADMIN_PW = 'admin-ldap';
const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
let mail: MailService;
let admin = '';
let other = '';
let employee = '';
let employeeRole = '';
const as = (t: string) => ({ Authorization: `Bearer ${t}` });
const tokenFor = (email: string, password: string) => api(app).post('/v1/auth/token').send({ email, password });

async function seedDirectory() {
  const c = new Client({ url: LDAP_URL });
  await c.bind(ADMIN_DN, ADMIN_PW);
  const add = async (dn: string, attrs: Record<string, string | string[]>) => {
    try { await c.add(dn, attrs); } catch (e) { if ((e as Error).name !== 'AlreadyExistsError') throw e; }
  };
  await add(`ou=people,${BASE}`, { objectClass: ['organizationalUnit'], ou: 'people' });
  const person = (uid: string, email: string, pw: string) => add(`uid=${uid},ou=people,${BASE}`, { objectClass: ['inetOrgPerson'], uid, cn: uid, sn: uid, mail: email, userPassword: pw });
  await person('maria', 'maria@ldap-a.test', 'Senha-da-Rede-1');
  await person('dup1', 'dup@ldap-a.test', 'x-Senha-1');
  await person('dup2', 'dup@ldap-a.test', 'x-Senha-2');
  await c.unbind();
}

const config = (over: Record<string, unknown> = {}) => ({
  enabled: true, url: LDAP_URL, bindDn: ADMIN_DN, bindPassword: ADMIN_PW, baseDn: `ou=people,${BASE}`, userFilter: '(mail={email})', ...over,
});

describe('LDAP / Active Directory', () => {
  beforeAll(async () => {
    await seedDirectory();
    ({ app, mail } = await createApp());
    const hasher = new PasswordHasher();
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const adminRole = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'company_admin' } });
      const empRole = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'employee' } });
      employeeRole = empRole.id;
      for (const slug of ['ldap-a', 'ldap-b']) {
        const t = await tx.tenant.create({ data: { name: slug, slug } });
        const u = await tx.user.create({ data: { tenantId: t.id, email: `admin@${slug}.test`, displayName: 'Admin', passwordHash: await hasher.hash(PASSWORD) } });
        await tx.userRole.create({ data: { userId: u.id, roleId: adminRole.id, tenantId: t.id, scope: 'TENANT' } });
        if (slug === 'ldap-a') {
          const e = await tx.user.create({ data: { tenantId: t.id, email: 'func@ldap-a.test', displayName: 'Func', passwordHash: await hasher.hash(PASSWORD) } });
          await tx.userRole.create({ data: { userId: e.id, roleId: empRole.id, tenantId: t.id, scope: 'TENANT' } });
        }
      }
    });
    admin = (await tokenFor('admin@ldap-a.test', PASSWORD).expect(200)).body.accessToken;
    other = (await tokenFor('admin@ldap-b.test', PASSWORD).expect(200)).body.accessToken;
    employee = (await tokenFor('func@ldap-a.test', PASSWORD).expect(200)).body.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await owner.$disconnect();
  });

  it('filtro com escape: e-mail não consegue alterar a busca (injeção LDAP)', () => {
    expect(buildFilter('(mail={email})', 'a*)(uid=*@x.test')).toBe('(mail=a\\2a\\29\\28uid=\\2a@x.test)');
    expect(buildFilter('(sAMAccountName={login})', 'joao.silva@empresa.com.br')).toBe('(sAMAccountName=joao.silva)');
  });

  it('no SaaS, recusa servidor em endereço interno e URL fora do padrão', async () => {
    const svc = new LdapService({ LDAP_ALLOW_PRIVATE_HOSTS: false } as AppConfig);
    for (const url of ['ldap://127.0.0.1:389', 'ldap://10.1.2.3', 'ldaps://192.168.0.10:636', 'ldap://169.254.169.254', 'ldap://[::1]:389', 'ldap://localhost']) {
      await expect(svc.assertSafeUrl(url), url).rejects.toThrow(/endereço público/);
    }
    await expect(svc.assertSafeUrl('http://ad.empresa.com.br')).rejects.toThrow(/ldap:\/\//);
    await expect(svc.assertSafeUrl('ldap://user:senha@8.8.8.8')).rejects.toThrow(/só protocolo/);
  });

  it('configuração: valida, guarda a senha cifrada e nunca a devolve', async () => {
    expect((await api(app).get('/v1/ldap-config').set(as(admin)).expect(200)).body).toEqual({ configured: false });
    await api(app).put('/v1/ldap-config').set(as(admin)).send(config({ url: 'http://ad.test' })).expect(400);
    await api(app).put('/v1/ldap-config').set(as(admin)).send(config({ userFilter: '(mail=fixo)' })).expect(400);
    await api(app).put('/v1/ldap-config').set(as(admin)).send(config({ bindPassword: undefined })).expect(400);
    const saved = await api(app).put('/v1/ldap-config').set(as(admin)).send(config({ enabled: false }));
    if (saved.status !== 200) console.log(saved.body);
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ enabled: false, hasBindPassword: true, bindDn: ADMIN_DN });
    expect(JSON.stringify(saved.body)).not.toContain(ADMIN_PW);
    expect(saved.body.bindPasswordEnc).toBeUndefined();
    const row = await owner.tenantLdapConfig.findFirstOrThrow({ where: { bindDn: ADMIN_DN } });
    expect(row.bindPasswordEnc).toMatch(/^v1\./);
    expect(row.bindPasswordEnc).not.toContain(ADMIN_PW);
    // Salvar de novo sem a senha mantém a senha guardada.
    const again = await api(app).put('/v1/ldap-config').set(as(admin)).send(config({ enabled: false, bindPassword: undefined })).expect(200);
    expect(again.body.hasBindPassword).toBe(true);
    const audit = await owner.auditLog.findMany({ where: { entity: 'ldap_config' } });
    expect(audit.length).toBe(2);
    expect(JSON.stringify(audit)).not.toContain(ADMIN_PW);
  });

  it('isolamento e permissão: outro cliente não vê; funcionário não configura', async () => {
    expect((await api(app).get('/v1/ldap-config').set(as(other)).expect(200)).body).toEqual({ configured: false });
    await api(app).get('/v1/ldap-config').set(as(employee)).expect(403);
    await api(app).put('/v1/ldap-config').set(as(employee)).send(config()).expect(403);
  });

  it('teste de conexão: encontra, confere senha e explica as falhas', async () => {
    const found = await api(app).post('/v1/ldap-config/test').set(as(admin)).send({ email: 'maria@ldap-a.test' }).expect(200);
    expect(found.body).toMatchObject({ ok: true, dn: `uid=maria,ou=people,${BASE}` });
    expect((await api(app).post('/v1/ldap-config/test').set(as(admin)).send({ email: 'maria@ldap-a.test', password: 'Senha-da-Rede-1' }).expect(200)).body.ok).toBe(true);
    expect((await api(app).post('/v1/ldap-config/test').set(as(admin)).send({ email: 'maria@ldap-a.test', password: 'errada' }).expect(200)).body).toMatchObject({ ok: false, reason: 'invalid_credentials' });
    expect((await api(app).post('/v1/ldap-config/test').set(as(admin)).send({ email: 'ninguem@ldap-a.test' }).expect(200)).body).toMatchObject({ ok: false, reason: 'not_found' });
    expect((await api(app).post('/v1/ldap-config/test').set(as(admin)).send({ email: 'dup@ldap-a.test' }).expect(200)).body).toMatchObject({ ok: false, reason: 'ambiguous' });
  });

  it('usuário LDAP: exige LDAP ativo, não recebe convite e entra com a senha da rede', async () => {
    await api(app).post('/v1/users').set(as(admin)).send({ email: 'maria@ldap-a.test', displayName: 'Maria', roleIds: [employeeRole], authSource: 'LDAP' }).expect(400);
    await api(app).put('/v1/ldap-config').set(as(admin)).send(config({ bindPassword: undefined })).expect(200);
    const before = mail.outbox.length;
    const created = await api(app).post('/v1/users').set(as(admin)).send({ email: 'maria@ldap-a.test', displayName: 'Maria', roleIds: [employeeRole], authSource: 'LDAP', mustChangePassword: true }).expect(201);
    expect(created.body).toMatchObject({ authSource: 'LDAP', mustChangePassword: false });
    expect(mail.outbox.slice(before).some((m) => m.to === 'maria@ldap-a.test')).toBe(false);

    const ok = await tokenFor('maria@ldap-a.test', 'Senha-da-Rede-1').expect(200);
    await tokenFor('maria@ldap-a.test', 'Senha-errada-9').expect(401);
    // Sem senha local: redefinição e troca ficam no diretório.
    await api(app).post('/v1/auth/password/forgot').send({ email: 'maria@ldap-a.test' }).expect(202);
    await new Promise((r) => setTimeout(r, 400));
    expect(mail.outbox.slice(before).some((m) => m.to === 'maria@ldap-a.test')).toBe(false);
    await api(app).post('/v1/auth/password/change').set(as(ok.body.accessToken)).send({ currentPassword: 'Senha-da-Rede-1', newPassword: 'Outra-Senha-Forte-1' }).expect(400);
    const row = await owner.user.findFirstOrThrow({ where: { email: 'maria@ldap-a.test' } });
    expect(row.passwordHash).toBeNull();
  });

  it('diretório fora do ar: avisa (503); LDAP desligado: não entra', async () => {
    await api(app).put('/v1/ldap-config').set(as(admin)).send(config({ url: 'ldap://127.0.0.1:1', bindPassword: undefined, timeoutMs: 1500 })).expect(200);
    await tokenFor('maria@ldap-a.test', 'Senha-da-Rede-1').expect(503);
    await api(app).put('/v1/ldap-config').set(as(admin)).send(config({ enabled: false, bindPassword: undefined })).expect(200);
    await tokenFor('maria@ldap-a.test', 'Senha-da-Rede-1').expect(401);
  });

  it('voltar para senha própria envia convite para definir a senha', async () => {
    const u = await owner.user.findFirstOrThrow({ where: { email: 'maria@ldap-a.test' } });
    const before = mail.outbox.length;
    const r = await api(app).patch(`/v1/users/${u.id}`).set(as(admin)).send({ authSource: 'LOCAL' }).expect(200);
    expect(r.body.authSource).toBe('LOCAL');
    await waitFor(() => mail.outbox.slice(before).find((m) => m.to === 'maria@ldap-a.test'));
  });
});
