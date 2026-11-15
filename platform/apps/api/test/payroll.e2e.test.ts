// Fase 9 (recursos nativos, sem integração com outros sistemas): layout e arquivo para a folha; importação de marcações.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formatQuantity } from '../src/payroll/payroll.service.js';
import { api, createApp, ownerUrl } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
const tk: Record<string, string> = {};
const ids: Record<string, string> = {};
const as = (who: string) => ({ Authorization: `Bearer ${tk[who]}` });
const at = (date: string, hm: string) => new Date(`${date}T${hm}:00-03:00`);
const P = { from: '2026-03-02', to: '2026-03-06' };
const decode = (b64: string) => Buffer.from(b64, 'base64').toString('utf8');

describe('Folha e importação', () => {
  beforeAll(async () => {
    ({ app } = await createApp());
    const hash = await new PasswordHasher().hash(PASSWORD);
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const role = async (key: string) => (await tx.role.findFirstOrThrow({ where: { tenantId: null, key } })).id;
      for (const slug of ['folha-a', 'folha-b']) {
        const t = await tx.tenant.create({ data: { name: slug, slug } });
        ids[slug] = t.id;
        const u = await tx.user.create({ data: { tenantId: t.id, email: `admin@${slug}.test`, displayName: 'Admin', passwordHash: hash } });
        await tx.userRole.create({ data: { userId: u.id, roleId: await role('company_admin'), tenantId: t.id, scope: 'TENANT' } });
      }
      const t = ids['folha-a']!;
      const mgr = await tx.user.create({ data: { tenantId: t, email: 'gestor@folha-a.test', displayName: 'Gestor', passwordHash: hash } });
      await tx.userRole.create({ data: { userId: mgr.id, roleId: await role('manager'), tenantId: t, scope: 'TENANT' } });
      ids.co = (await tx.company.create({ data: { tenantId: t, legalName: 'Folha Ltda' } })).id;
      const mk = async (fullName: string, registration: string, cpf: string) => {
        const p = await tx.person.create({ data: { tenantId: t, fullName, cpf } });
        return (await tx.employment.create({ data: { tenantId: t, personId: p.id, companyId: ids.co!, registration, hiredAt: new Date('2025-01-01') } })).id;
      };
      ids.ana = await mk('Ana Folha', '10', '52998224725');
      ids.beto = await mk('Beto Folha', '20', '11144477735');
      let n = 0;
      const punch = (e: string, d: string, h: string) => tx.timeRecord.create({ data: { tenantId: t, employmentId: e, recordedAt: at(d, h), source: 'DEVICE', hash: `f${++n}`, idempotencyKey: `folha-${n}` } });
      // Ana: segunda normal, terça +2h. Beto: nada (faltas, para conferir as horas de falta).
      for (const h of ['08:00', '12:00', '13:00', '17:00']) await punch(ids.ana, '2026-03-02', h);
      for (const h of ['08:00', '12:00', '13:00', '19:00']) await punch(ids.ana, '2026-03-03', h);
    });
    tk.admin = (await api(app).post('/v1/auth/token').send({ email: 'admin@folha-a.test', password: PASSWORD }).expect(200)).body.accessToken;
    tk.other = (await api(app).post('/v1/auth/token').send({ email: 'admin@folha-b.test', password: PASSWORD }).expect(200)).body.accessToken;
    tk.mgr = (await api(app).post('/v1/auth/token').send({ email: 'gestor@folha-a.test', password: PASSWORD }).expect(200)).body.accessToken;
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => (d >= 1 && d <= 5 ? { dayIndex: d, isWorkday: true, startTime: '08:00', endTime: '17:00', breakMinutes: 60 } : { dayIndex: d, isWorkday: false }));
    const s = await api(app).post('/v1/work-schedules').set(as('admin')).send({ companyId: ids.co, name: 'Comercial', type: 'FIXED', days }).expect(201);
    await api(app).post('/v1/schedule-assignments').set(as('admin')).send({ employmentIds: [ids.ana, ids.beto], scheduleId: s.body.id, validFrom: '2026-03-01' }).expect(201);
  });

  afterAll(async () => {
    await app.close();
    await owner.$disconnect();
  });

  it('formato da quantidade', () => {
    expect(formatQuantity(510, 'HHMM', 'hours')).toBe('08:30');
    expect(formatQuantity(510, 'DECIMAL', 'hours')).toBe('8,50');
    expect(formatQuantity(510, 'MINUTES', 'hours')).toBe('510');
    expect(formatQuantity(3, 'HHMM', 'days')).toBe('3');
  });

  it('layout: valida, nome único na empresa, permissão e isolamento', async () => {
    expect((await api(app).get('/v1/payroll-layouts/items').set(as('admin')).expect(200)).body.map((i: { key: string }) => i.key)).toContain('ot50');
    await api(app).post('/v1/payroll-layouts').set(as('admin')).send({ companyId: ids.co, name: 'Vazio', events: {} }).expect(400);
    await api(app).post('/v1/payroll-layouts').set(as('admin')).send({ companyId: ids.co, name: 'Ruim', events: { salario: '1' } }).expect(400);
    const l = await api(app).post('/v1/payroll-layouts').set(as('admin')).send({ companyId: ids.co, name: 'Folha padrão', events: { normal: '001', ot50: '150', absence: '300' } }).expect(201);
    ids.layout = l.body.id;
    await api(app).post('/v1/payroll-layouts').set(as('admin')).send({ companyId: ids.co, name: 'folha PADRÃO', events: { normal: '1' } }).expect(409);
    await api(app).get('/v1/payroll-layouts').set(as('mgr')).expect(403);
    expect((await api(app).get('/v1/payroll-layouts').set(as('other')).expect(200)).body).toHaveLength(0);
    await api(app).post(`/v1/payroll-layouts/${ids.layout}/export`).set(as('other')).send(P).expect(404);
  });

  it('arquivo da folha: matrícula, evento e quantidade; sem linhas zeradas', async () => {
    const r = await api(app).post(`/v1/payroll-layouts/${ids.layout}/export`).set(as('admin')).send(P).expect(200);
    const lines = decode(r.body.base64).trim().split('\r\n');
    expect(lines[0]).toBe('Matricula;Evento;Quantidade;Inicio;Fim');
    // Ana: normal 16h (seg 8h + ter 8h) + 0h nos demais (faltas qua-sex), extra 50% 2h, faltas 3 dias × 8h.
    expect(lines).toContain('10;001;16:00;02/03/2026;06/03/2026');
    expect(lines).toContain('10;150;02:00;02/03/2026;06/03/2026');
    expect(lines).toContain('10;300;24:00;02/03/2026;06/03/2026');
    expect(lines).toContain('20;300;40:00;02/03/2026;06/03/2026');
    expect(lines.some((x) => x.startsWith('20;001'))).toBe(false); // Beto sem horas normais: linha não entra
    expect(r.body).toMatchObject({ employees: 2, lines: 4, missingKey: [] });
  });

  it('layout por CPF, separador e formato decimal', async () => {
    await api(app).put(`/v1/payroll-layouts/${ids.layout}`).set(as('admin')).send({ name: 'Folha padrão', events: { ot50: 'HE50' }, separator: 'TAB', quantityFormat: 'DECIMAL', includeHeader: false, employeeKey: 'CPF' }).expect(200);
    const r = await api(app).post(`/v1/payroll-layouts/${ids.layout}/export`).set(as('admin')).send(P).expect(200);
    expect(decode(r.body.base64)).toBe('52998224725\tHE50\t2,00\t02/03/2026\t06/03/2026\r\n');
    expect(r.body.unmappedItems).toEqual(expect.arrayContaining(['normal', 'absence']));
    await api(app).delete(`/v1/payroll-layouts/${ids.layout}`).set(as('admin')).expect(204);
    expect((await api(app).get('/v1/payroll-layouts').set(as('admin')).expect(200)).body).toHaveLength(0);
  });

  it('importação de marcações: confere, grava, não duplica e aponta erros por linha', async () => {
    const csv = ['matricula;data;hora', '10;04/03/2026;08:00', '10;04/03/2026;12:00', '10;2026-03-04;13:00', '10;04/03/2026;17:00', '99;04/03/2026;08:00', '10;31/02/2026;08:00', '10;04/03/2026;25:00', '10;04/03/2099;08:00', '10;04/03/2026;08:00', '20;02/03/2026;08:00:30'].join('\n');
    const dry = await api(app).post('/v1/time-records/import-csv').set(as('admin')).send({ companyId: ids.co, content: csv }).expect(200);
    expect(dry.body).toMatchObject({ valid: 5, toImport: 5, imported: 0, duplicates: 0 });
    expect(dry.body.errors.map((e: { line: number; message: string }) => `${e.line}:${e.message}`)).toEqual([
      '6:Funcionário não encontrado: 99', '7:Data inválida: 31/02/2026', '8:Hora inválida: 25:00', '9:Marcação no futuro', '10:Repetida no arquivo',
    ]);
    const before = await api(app).post('/v1/time-records/import-csv').set(as('admin')).send({ companyId: ids.co, content: csv, dryRun: false }).expect(200);
    expect(before.body.imported).toBe(5);
    const again = await api(app).post('/v1/time-records/import-csv').set(as('admin')).send({ companyId: ids.co, content: csv, dryRun: false }).expect(200);
    expect(again.body).toMatchObject({ imported: 0, duplicates: 5 });
    // Já existente por outra origem (relógio) também conta como repetida.
    expect((await api(app).post('/v1/time-records/import-csv').set(as('admin')).send({ companyId: ids.co, content: '10;02/03/2026;08:00' }).expect(200)).body).toMatchObject({ duplicates: 1, toImport: 0 });
    // As marcações importadas entram no espelho (quarta da Ana completa).
    const m = await api(app).get(`/v1/timesheet?employmentId=${ids.ana}&from=2026-03-04&to=2026-03-04`).set(as('admin')).expect(200);
    expect(m.body.days[0].punches.map((p: { time: string; source: string }) => `${p.time}/${p.source}`)).toEqual(['08:00/IMPORT', '12:00/IMPORT', '13:00/IMPORT', '17:00/IMPORT']);
    expect(m.body.days[0].result.flags).not.toContain('ABSENCE');
    // Por CPF (com pontuação no arquivo).
    expect((await api(app).post('/v1/time-records/import-csv').set(as('admin')).send({ companyId: ids.co, employeeKey: 'CPF', content: '111.444.777-35;05/03/2026;08:00' }).expect(200)).body.valid).toBe(1);
    await api(app).post('/v1/time-records/import-csv').set(as('mgr')).send({ companyId: ids.co, content: csv }).expect(403);
    await api(app).post('/v1/time-records/import-csv').set(as('other')).send({ companyId: ids.co, content: csv }).expect(404);
  });

  it('período fechado não aceita importação', async () => {
    await api(app).post('/v1/closings').set(as('admin')).send({ companyId: ids.co, periodStart: '2026-02-01', periodEnd: '2026-02-28' }).expect(201);
    const r = await api(app).post('/v1/time-records/import-csv').set(as('admin')).send({ companyId: ids.co, content: '10;10/02/2026;08:00' }).expect(200);
    expect(r.body.errors).toEqual([{ line: 1, message: 'Período fechado' }]);
  });
});
