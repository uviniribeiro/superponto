// REP-P: NSR sequencial por empresa gravado na marcação e AFD (Portaria 671) com hash encadeado.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { parseAfd } from '@superponto/rep-protocols';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, createApp, ownerUrl } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
const tk: Record<string, string> = {};
const ids: Record<string, string> = {};
const as = (w: string) => ({ Authorization: `Bearer ${tk[w]}` });
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

describe('REP-P', () => {
  beforeAll(async () => {
    ({ app } = await createApp());
    const hash = await new PasswordHasher().hash(PASSWORD);
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const role = async (key: string) => (await tx.role.findFirstOrThrow({ where: { tenantId: null, key } })).id;
      for (const slug of ['repp-a', 'repp-b']) {
        const t = await tx.tenant.create({ data: { name: slug, slug } });
        ids[slug] = t.id;
        const u = await tx.user.create({ data: { tenantId: t.id, email: `admin@${slug}.test`, displayName: 'Admin', passwordHash: hash } });
        await tx.userRole.create({ data: { userId: u.id, roleId: await role('company_admin'), tenantId: t.id, scope: 'TENANT' } });
      }
      const t = ids['repp-a']!;
      ids.co = (await tx.company.create({ data: { tenantId: t, legalName: 'Clínica REP-P Ltda', cnpj: '11222333000181' } })).id;
      for (const [i, cpf] of [['1', '52998224725'], ['2', '11144477735'], ['3', null]] as const) {
        const p = await tx.person.create({ data: { tenantId: t, fullName: `Pessoa ${i}`, cpf } });
        await tx.employment.create({ data: { tenantId: t, personId: p.id, companyId: ids.co!, registration: i, hiredAt: new Date('2025-01-01') } });
        const u = await tx.user.create({ data: { tenantId: t, email: `f${i}@repp-a.test`, displayName: `F${i}`, passwordHash: hash, personId: p.id } });
        await tx.userRole.create({ data: { userId: u.id, roleId: await role('employee'), tenantId: t, scope: 'TENANT' } });
      }
    });
    for (const w of ['admin@repp-a', 'admin@repp-b', 'f1@repp-a', 'f2@repp-a', 'f3@repp-a']) tk[w.split('@')[0] + (w.endsWith('-b') ? 'B' : '')] = (await api(app).post('/v1/auth/token').send({ email: `${w}.test`, password: PASSWORD }).expect(200)).body.accessToken;
  });
  afterAll(async () => { await app.close(); await owner.$disconnect(); });

  it('cada marcação recebe o próximo NSR da empresa; o AFD é lido pelo leitor oficial e o hash confere', async () => {
    const nsrs: number[] = [];
    for (const w of ['f1', 'f2', 'f3']) {
      const ch = await api(app).post('/v1/punch/challenge').set(as(w)).expect(200);
      nsrs.push((await api(app).post('/v1/punch').set(as(w)).send({ token: ch.body.token }).expect(201)).body.nsr);
    }
    expect(nsrs).toEqual([1, 2, 3]);
    expect((await api(app).get(`/v1/timesheet/rep-p?companyId=${ids.co}`).set(as('admin')).expect(200)).body).toMatchObject({ inpiNumber: null, lastNsr: 3 });
    await api(app).put('/v1/timesheet/rep-p').set(as('admin')).send({ companyId: ids.co, inpiNumber: '123' }).expect(400);
    await api(app).put('/v1/timesheet/rep-p').set(as('admin')).send({ companyId: ids.co, inpiNumber: '12345678901234567' }).expect(200);

    const r = await api(app).get(`/v1/timesheet/afd-rep-p?companyId=${ids.co}&from=${today}&to=${today}`).set(as('admin')).expect(200);
    const text = Buffer.from(r.body.base64, 'base64').toString('latin1');
    const afd = parseAfd(text);
    expect(afd.header).toMatchObject({ employerId: '11222333000181', repId: '12345678901234567' });
    expect(afd.punches.map((p) => [p.nsr, p.recordType, p.workerId, p.collector])).toEqual([[1, '7', '52998224725', '02'], [2, '7', '11144477735', '02'], [3, '7', '0', '02']]);
    // Encadeamento: hash(n) = SHA-256(campos(n) + hash(n-1)).
    let prev = '';
    for (const line of text.split('\r\n').filter((l) => l.slice(9, 10) === '7')) {
      expect(createHash('sha256').update(line.slice(0, 73) + prev).digest('hex')).toBe(line.slice(73));
      prev = line.slice(73);
    }
    expect(r.body.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/NSR 3: funcionário sem CPF/)]));
    expect(r.body.warnings.some((w: string) => /não conferem/.test(w))).toBe(false);
    // Isolamento e permissão.
    await api(app).get(`/v1/timesheet/afd-rep-p?companyId=${ids.co}&from=${today}&to=${today}`).set(as('adminB')).expect(404);
    await api(app).get(`/v1/timesheet/afd-rep-p?companyId=${ids.co}&from=${today}&to=${today}`).set(as('f1')).expect(403);
    // NSR e hash não mudam depois (marcação imutável).
    await expect(owner.$executeRawUnsafe(`UPDATE superponto.time_records SET rep_p_nsr = 99 WHERE rep_p_nsr = 1`)).rejects.toThrow();
  });
});
