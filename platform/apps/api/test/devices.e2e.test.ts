// Equipamentos: AFD das Portarias 1.510/2009 e 671/2021, envio de cadastros ao REP e digitais cifradas.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, createApp, ownerUrl } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
let token = '';
let otherToken = '';
const ids: Record<string, string> = {};
const as = (t: string) => ({ Authorization: `Bearer ${t}` });

const L = (v: string | number, n: number) => String(v).padStart(n, '0').slice(-n);
const R = (v: string, n: number) => v.padEnd(n, ' ').slice(0, n);
const MARIA = { cpf: '52998224725', pis: '12056462127' };
const JOAO = { cpf: '11144477735', pis: '12345678919' };

function afd1510(cnpj: string) {
  return [
    L(0, 9) + '1' + '1' + cnpj + R('', 12) + R('ESCOLA ALFA', 150) + L('00004004330001234', 17) + '01112026' + '30112026' + '01122026' + '0800',
    L(1, 9) + '3' + '03112026' + '0758' + L(MARIA.pis, 12),
    L(2, 9) + '3' + '03112026' + '1702' + L(MARIA.pis, 12),
    L(3, 9) + '3' + '03112026' + '0801' + L('99999999999', 12), // PIS desconhecido
    '999999999' + L(0, 9) + L(3, 9) + L(0, 9) + L(0, 9) + '9',
  ].join('\r\n');
}

function afd671(cnpj: string) {
  return [
    L(0, 9) + '1' + '1' + R(cnpj, 14) + R('', 14) + R('ESCOLA ALFA', 150) + R('BR512024000001', 17) + '2026-11-01' + '2026-11-30' + '2026-12-01T08:00:00-0300' + '003' + '1' + '11222333000181' + R('MODELO X', 30) + 'ABCD',
    L(10, 9) + '7' + '2026-11-04T08:00:00-0300' + L(JOAO.cpf, 12) + '2026-11-04T08:00:02-0300' + '01' + '0' + 'b'.repeat(64),
  ].join('\n');
}

describe('Equipamentos: portarias 1.510, 373 e 671, cadastros e digitais', () => {
  beforeAll(async () => {
    ({ app } = await createApp());
    const hasher = new PasswordHasher();
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const role = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'company_admin' } });
      for (const slug of ['equip-a', 'equip-b']) {
        const tenant = await tx.tenant.create({ data: { name: slug, slug } });
        const user = await tx.user.create({ data: { tenantId: tenant.id, email: `admin@${slug}.test`, displayName: 'Admin', passwordHash: await hasher.hash(PASSWORD) } });
        await tx.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId: tenant.id, scope: 'TENANT' } });
        ids[slug] = tenant.id;
      }
      const t = ids['equip-a']!;
      const company = await tx.company.create({ data: { tenantId: t, legalName: 'Escola Alfa Ltda', cnpj: '11222333000181' } });
      const companyAlfa = await tx.company.create({ data: { tenantId: t, legalName: 'Clínica Nova', cnpj: '12ABC34501DE35' } });
      ids.company = company.id;
      const maria = await tx.person.create({ data: { tenantId: t, fullName: 'Maria Conceição', cpf: MARIA.cpf, pis: MARIA.pis } });
      const joao = await tx.person.create({ data: { tenantId: t, fullName: 'João Pereira', cpf: JOAO.cpf, pis: null } });
      ids.maria = (await tx.employment.create({ data: { tenantId: t, personId: maria.id, companyId: company.id, registration: '1001', hiredAt: new Date('2026-01-01') } })).id;
      ids.joao = (await tx.employment.create({ data: { tenantId: t, personId: joao.id, companyId: company.id, registration: '1002', hiredAt: new Date('2026-01-01') } })).id;
      ids.rep1510 = (await tx.device.create({ data: { tenantId: t, companyId: company.id, name: 'Relógio antigo', ordinance: 'P1510_2009', status: 'ONLINE' } })).id;
      ids.rep671 = (await tx.device.create({ data: { tenantId: t, companyId: company.id, name: 'REP novo', ordinance: 'P671_2021', status: 'ONLINE' } })).id;
      ids.semPortaria = (await tx.device.create({ data: { tenantId: t, companyId: company.id, name: 'Sem portaria' } })).id;
      ids.repAlfa1510 = (await tx.device.create({ data: { tenantId: t, companyId: companyAlfa.id, name: 'Antigo na clínica', ordinance: 'P1510_2009' } })).id;
    });
    token = (await api(app).post('/v1/auth/token').send({ email: 'admin@equip-a.test', password: PASSWORD }).expect(200)).body.accessToken;
    otherToken = (await api(app).post('/v1/auth/token').send({ email: 'admin@equip-b.test', password: PASSWORD }).expect(200)).body.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await owner.$disconnect();
  });

  it('AFD da Portaria 1.510: marcações pelo PIS viram registros de ponto; PIS desconhecido é informado', async () => {
    const res = await api(app).post(`/v1/devices/${ids.rep1510}/afd`).set(as(token)).send({ content: afd1510('11222333000181') }).expect(201);
    expect(res.body).toMatchObject({ layout: '1510', punches: 3, imported: 2, duplicates: 0, unmatched: [{ workerId: '99999999999', count: 1 }] });
    const records = await owner.timeRecord.findMany({ where: { employmentId: ids.maria }, orderBy: { recordedAt: 'asc' } });
    expect(records.map((r) => r.recordedAt.toISOString())).toEqual(['2026-11-03T10:58:00.000Z', '2026-11-03T20:02:00.000Z']);
    expect(records[1]!.previousHash).toBe(records[0]!.hash); // cadeia de integridade
    expect(records.every((r) => r.source === 'DEVICE' && r.deviceNsr !== null)).toBe(true);
  });

  it('reimportar o mesmo AFD não duplica marcações', async () => {
    const res = await api(app).post(`/v1/devices/${ids.rep1510}/afd`).set(as(token)).send({ content: afd1510('11222333000181') }).expect(201);
    expect(res.body).toMatchObject({ imported: 0, duplicates: 2 });
  });

  it('AFD da Portaria 671 (REP-P, tipo 7): identifica pelo CPF, com fuso do arquivo', async () => {
    const res = await api(app).post(`/v1/devices/${ids.rep671}/afd`).set(as(token)).send({ content: afd671('11222333000181') }).expect(201);
    expect(res.body).toMatchObject({ layout: '671', imported: 1 });
    const rec = await owner.timeRecord.findFirstOrThrow({ where: { employmentId: ids.joao } });
    expect(rec.recordedAt.toISOString()).toBe('2026-11-04T11:00:00.000Z');
  });

  it('AFD de outro CNPJ é recusado', async () => {
    const res = await api(app).post(`/v1/devices/${ids.rep1510}/afd`).set(as(token)).send({ content: afd1510('99888777000166') }).expect(400);
    expect(res.body.message).toMatch(/diferente da empresa/);
  });

  it('equipamento sem portaria definida recusa uso', async () => {
    const res = await api(app).post(`/v1/devices/${ids.semPortaria}/afd`).set(as(token)).send({ content: afd1510('11222333000181') }).expect(400);
    expect(res.body.message).toMatch(/portaria/);
  });

  it('outro cliente não importa nem vê o equipamento', async () => {
    await api(app).post(`/v1/devices/${ids.rep1510}/afd`).set(as(otherToken)).send({ content: afd1510('11222333000181') }).expect(404);
    await api(app).get(`/v1/devices/${ids.rep1510}/jobs`).set(as(otherToken)).expect(404);
  });

  it('digital: gravada cifrada, nunca devolvida, e enviada aos REPs da empresa', async () => {
    const template = Buffer.alloc(400, 3).toString('base64');
    const res = await api(app).post(`/v1/employments/${ids.maria}/fingerprints`).set(as(token)).send({ finger: 1, format: 'ISO_19794_2', template, quality: 80 }).expect(201);
    expect(res.body).toMatchObject({ finger: 1, format: 'ISO_19794_2', queuedDevices: 2 });
    expect(res.body.template).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(template);
    const row = await owner.biometricTemplate.findFirstOrThrow({ where: { id: res.body.id } });
    expect(row.templateEnc.startsWith('v1.')).toBe(true);
    expect(row.templateEnc).not.toContain(template.slice(0, 40));
    const jobs = await owner.deviceSyncJob.findMany({ where: { action: 'UPSERT_FINGERPRINT', tenantId: ids['equip-a'] } });
    expect(jobs).toHaveLength(2);
    expect(JSON.stringify(jobs.map((j) => j.payload))).not.toContain(template.slice(0, 40)); // fila só com referência
    const list = await api(app).get(`/v1/employments/${ids.maria}/fingerprints`).set(as(token)).expect(200);
    expect(list.body).toHaveLength(1);
    const audit = await owner.auditLog.findFirstOrThrow({ where: { entity: 'biometric_template', entityId: res.body.id } });
    expect(JSON.stringify(audit.after)).not.toContain(template.slice(0, 40));
  });

  it('nova captura do mesmo dedo substitui a anterior; repetir a mesma é recusado', async () => {
    const t1 = Buffer.alloc(400, 3).toString('base64');
    await api(app).post(`/v1/employments/${ids.maria}/fingerprints`).set(as(token)).send({ finger: 1, format: 'ISO_19794_2', template: t1 }).expect(400);
    const t2 = Buffer.alloc(400, 4).toString('base64');
    await api(app).post(`/v1/employments/${ids.maria}/fingerprints`).set(as(token)).send({ finger: 1, format: 'ISO_19794_2', template: t2 }).expect(201);
    const list = await api(app).get(`/v1/employments/${ids.maria}/fingerprints`).set(as(token)).expect(200);
    expect(list.body).toHaveLength(1);
    expect(await owner.biometricTemplate.count({ where: { employmentId: ids.maria } })).toBe(2);
  });

  it('o banco não deixa alterar o template de uma digital', async () => {
    const row = await owner.biometricTemplate.findFirstOrThrow({ where: { employmentId: ids.maria, revokedAt: null } });
    await expect(owner.$executeRawUnsafe(`UPDATE biometric_templates SET template_enc = 'v1.x.y.z' WHERE id = '${row.id}'`)).rejects.toThrow(/não pode ser alterada/);
  });

  it('outro cliente não acessa digitais', async () => {
    await api(app).get(`/v1/employments/${ids.maria}/fingerprints`).set(as(otherToken)).expect(404);
  });

  it('remover digital agenda a exclusão nos REPs', async () => {
    const [fp] = (await api(app).get(`/v1/employments/${ids.maria}/fingerprints`).set(as(token)).expect(200)).body;
    await api(app).delete(`/v1/employments/${ids.maria}/fingerprints/${fp.id}`).set(as(token)).expect(204);
    expect(await owner.deviceSyncJob.count({ where: { action: 'DELETE_FINGERPRINTS' } })).toBe(2);
  });

  it('envio de cadastros ao REP da 1.510: exige PIS e informa quem ficou de fora', async () => {
    const res = await api(app).post(`/v1/devices/${ids.rep1510}/sync`).set(as(token)).expect(201);
    expect(res.body).toMatchObject({ layout: '1510', employees: 1, skipped: [{ name: 'João Pereira' }] });
    expect(res.body.skipped[0].reason).toMatch(/PIS/);
  });

  it('envio de cadastros ao REP da 671: usa CPF e inclui todos', async () => {
    const res = await api(app).post(`/v1/devices/${ids.rep671}/sync`).set(as(token)).expect(201);
    expect(res.body).toMatchObject({ layout: '671', employees: 2, skipped: [] });
    const jobs = (await api(app).get(`/v1/devices/${ids.rep671}/jobs`).set(as(token)).expect(200)).body;
    expect(jobs.map((j: { action: string }) => j.action)).toEqual(expect.arrayContaining(['SET_EMPLOYER', 'UPSERT_EMPLOYEE']));
  });

  it('REP da 1.510 não recebe empregador com CNPJ alfanumérico', async () => {
    const res = await api(app).post(`/v1/devices/${ids.repAlfa1510}/sync`).set(as(token)).expect(400);
    expect(res.body.message).toMatch(/alfanumérico/);
  });
});
