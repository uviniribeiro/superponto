// Certificado digital da empresa e assinatura CAdES (.p7s destacada) do AFD do REP-P e do AEJ.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, createApp, ownerUrl } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
const tk: Record<string, string> = {};
const ids: Record<string, string> = {};
const as = (w: string) => ({ Authorization: `Bearer ${tk[w]}` });
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const dir = mkdtempSync(join(tmpdir(), 'sp-cert-test-'));
const ssl = (...args: string[]) => execFileSync('openssl', args, { stdio: 'pipe' }).toString();

/** Certificado de teste no formato do e-CNPJ ICP-Brasil (CN "RAZÃO:CNPJ"), exportado em PFX. */
function makePfx(name: string, cn: string, pass: string, opts: { noKey?: boolean } = {}) {
  const key = join(dir, `${name}.key`), crt = join(dir, `${name}.crt`), pfx = join(dir, `${name}.pfx`);
  ssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '30', '-subj', `/C=BR/O=ICP-Brasil/CN=${cn}`, '-keyout', key, '-out', crt);
  ssl('pkcs12', '-export', ...(opts.noKey ? ['-nokeys'] : ['-inkey', key]), '-in', crt, '-passout', `pass:${pass}`, '-out', pfx);
  return readFileSync(pfx).toString('base64');
}

/** Confere a assinatura destacada com o OpenSSL e devolve o dump da estrutura CMS. */
function verify(content: Buffer, p7sBase64: string) {
  const data = join(dir, 'data'), sig = join(dir, 'sig.p7s');
  writeFileSync(data, content);
  writeFileSync(sig, Buffer.from(p7sBase64, 'base64'));
  ssl('cms', '-verify', '-binary', '-inform', 'DER', '-in', sig, '-content', data, '-noverify', '-out', join(dir, 'out'));
  return ssl('cms', '-cmsout', '-print', '-inform', 'DER', '-in', sig);
}

describe('Certificado digital e assinatura CAdES', () => {
  beforeAll(async () => {
    ({ app } = await createApp());
    const hash = await new PasswordHasher().hash(PASSWORD);
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const role = async (key: string) => (await tx.role.findFirstOrThrow({ where: { tenantId: null, key } })).id;
      for (const slug of ['cert-a', 'cert-b']) {
        const t = await tx.tenant.create({ data: { name: slug, slug } });
        ids[slug] = t.id;
        const u = await tx.user.create({ data: { tenantId: t.id, email: `admin@${slug}.test`, displayName: 'Admin', passwordHash: hash } });
        await tx.userRole.create({ data: { userId: u.id, roleId: await role('company_admin'), tenantId: t.id, scope: 'TENANT' } });
      }
      const t = ids['cert-a']!;
      ids.co = (await tx.company.create({ data: { tenantId: t, legalName: 'Clínica Certificada Ltda', cnpj: '11222333000181' } })).id;
      const u = await tx.user.create({ data: { tenantId: t, email: 'func@cert-a.test', displayName: 'Func', passwordHash: hash } });
      await tx.userRole.create({ data: { userId: u.id, roleId: await role('employee'), tenantId: t, scope: 'TENANT' } });
    });
    for (const [k, e] of [['admin', 'admin@cert-a'], ['adminB', 'admin@cert-b'], ['func', 'func@cert-a']]) {
      tk[k!] = (await api(app).post('/v1/auth/token').send({ email: `${e}.test`, password: PASSWORD }).expect(200)).body.accessToken;
    }
  });
  afterAll(async () => { await app.close(); await owner.$disconnect(); rmSync(dir, { recursive: true, force: true }); });

  it('sem certificado: AFD e AEJ saem sem assinatura e com aviso', async () => {
    expect((await api(app).get(`/v1/companies/${ids.co}/certificate`).set(as('admin')).expect(200)).body).toEqual({ certificate: null });
    const afd = await api(app).get(`/v1/timesheet/afd-rep-p?companyId=${ids.co}&from=${today}&to=${today}`).set(as('admin')).expect(200);
    expect(afd.body.signature).toBeNull();
    expect(afd.body.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/Sem certificado digital/)]));
    const aej = await api(app).get(`/v1/timesheet/aej?companyId=${ids.co}&from=${today}&to=${today}`).set(as('admin')).expect(200);
    expect(aej.body.signature).toBeNull();
  });

  it('recusa senha errada, PFX sem chave, certificado de outra empresa e quem não pode configurar', async () => {
    const good = makePfx('good', 'CLINICA CERTIFICADA LTDA:11222333000181', 'senha-pfx');
    const url = `/v1/companies/${ids.co}/certificate`;
    const wrong = await api(app).put(url).set(as('admin')).send({ pfxBase64: good, password: 'errada' }).expect(400);
    expect(wrong.body.message).toMatch(/Senha do certificado incorreta/);
    const noKey = await api(app).put(url).set(as('admin')).send({ pfxBase64: makePfx('nokey', 'X:11222333000181', 'p', { noKey: true }), password: 'p' }).expect(400);
    expect(noKey.body.message).toMatch(/chave privada/);
    const other = await api(app).put(url).set(as('admin')).send({ pfxBase64: makePfx('other', 'OUTRA EMPRESA:22333444000105', 'p'), password: 'p' }).expect(400);
    expect(other.body.message).toMatch(/outra empresa/);
    await api(app).put(url).set(as('admin')).send({ pfxBase64: 'x', password: 'p' }).expect(400);
    await api(app).put(url).set(as('func')).send({ pfxBase64: good, password: 'senha-pfx' }).expect(403);
    await api(app).put(url).set(as('adminB')).send({ pfxBase64: good, password: 'senha-pfx' }).expect(404);
  });

  it('guarda cifrado, assina AFD e AEJ em CAdES destacado e permite remover', async () => {
    const url = `/v1/companies/${ids.co}/certificate`;
    const saved = await api(app).put(url).set(as('admin')).send({ pfxBase64: makePfx('main', 'CLINICA CERTIFICADA LTDA:11222333000181', 'senha-pfx'), password: 'senha-pfx' }).expect(200);
    expect(saved.body.certificate).toMatchObject({ expired: false });
    expect(saved.body.certificate.subject).toContain('11222333000181');
    expect(saved.body.certificate.serialNumber).toMatch(/^[0-9A-F]+$/);
    expect(JSON.stringify(saved.body)).not.toMatch(/pfx|senha-pfx/i);
    expect((await api(app).get(url).set(as('admin')).expect(200)).body.certificate.serialNumber).toBe(saved.body.certificate.serialNumber);
    await api(app).get(url).set(as('adminB')).expect(404);

    // No banco, PFX e senha só cifrados.
    const row = await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      return tx.companyCertificate.findUniqueOrThrow({ where: { companyId: ids.co! } });
    });
    expect(row.pfxEnc).toMatch(/^v1\./);
    expect(row.passwordEnc).toMatch(/^v1\./);
    expect(row.passwordEnc).not.toContain('senha-pfx');

    const afd = await api(app).get(`/v1/timesheet/afd-rep-p?companyId=${ids.co}&from=${today}&to=${today}`).set(as('admin')).expect(200);
    expect(afd.body.signature).toMatchObject({ filename: `${afd.body.filename}.p7s`, mime: 'application/pkcs7-signature' });
    expect(afd.body.warnings.some((w: string) => /certificado/i.test(w))).toBe(false);
    const dump = verify(Buffer.from(afd.body.base64, 'base64'), afd.body.signature.base64);
    expect(dump).toMatch(/signingCertificateV2/); // CAdES-BES
    expect(dump).toMatch(/sha256/);
    expect(dump).toMatch(/eContent: <ABSENT>/); // destacada: o arquivo não vai dentro do .p7s

    const aej = await api(app).get(`/v1/timesheet/aej?companyId=${ids.co}&from=${today}&to=${today}`).set(as('admin')).expect(200);
    verify(Buffer.from(aej.body.content, 'utf8'), aej.body.signature.base64);
    // Arquivo adulterado não confere.
    expect(() => verify(Buffer.from(`${aej.body.content}X`, 'utf8'), aej.body.signature.base64)).toThrow();

    await api(app).delete(url).set(as('func')).expect(403);
    await api(app).delete(url).set(as('admin')).expect(204);
    await api(app).delete(url).set(as('admin')).expect(404);
    const after = await api(app).get(`/v1/timesheet/afd-rep-p?companyId=${ids.co}&from=${today}&to=${today}`).set(as('admin')).expect(200);
    expect(after.body.signature).toBeNull();
  });
});
