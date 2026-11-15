// Fase 5 (final): banco de compensação semanal e "meu banco de horas".
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compensate } from '../src/timesheet/bank.service.js';
import { api, createApp, ownerUrl } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
const tk: Record<string, string> = {};
const ids: Record<string, string> = {};
const as = (who: string) => ({ Authorization: `Bearer ${tk[who]}` });
const at = (date: string, hm: string) => new Date(`${date}T${hm}:00-03:00`);

describe('Banco de compensação e meu banco', () => {
  beforeAll(async () => {
    ({ app } = await createApp());
    const hash = await new PasswordHasher().hash(PASSWORD);
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const role = async (key: string) => (await tx.role.findFirstOrThrow({ where: { tenantId: null, key } })).id;
      const t = await tx.tenant.create({ data: { name: 'comp-a', slug: 'comp-a' } });
      ids.t = t.id;
      const admin = await tx.user.create({ data: { tenantId: t.id, email: 'admin@comp-a.test', displayName: 'Admin', passwordHash: hash } });
      await tx.userRole.create({ data: { userId: admin.id, roleId: await role('company_admin'), tenantId: t.id, scope: 'TENANT' } });
      ids.co = (await tx.company.create({ data: { tenantId: t.id, legalName: 'Comp Ltda' } })).id;
      const p = await tx.person.create({ data: { tenantId: t.id, fullName: 'Duda Compensa' } });
      ids.e = (await tx.employment.create({ data: { tenantId: t.id, personId: p.id, companyId: ids.co!, registration: '10', hiredAt: new Date('2025-01-01') } })).id;
      const u = await tx.user.create({ data: { tenantId: t.id, email: 'duda@comp-a.test', displayName: 'Duda', passwordHash: hash, personId: p.id } });
      await tx.userRole.create({ data: { userId: u.id, roleId: await role('employee'), tenantId: t.id, scope: 'TENANT' } });
      // semana 02–06/03/2026: +1h, −1h, +2h, 0, 0  => líquido +2h; semana seguinte 09/03: −1h
      const days: Array<[string, string[]]> = [
        ['2026-03-02', ['08:00', '12:00', '13:00', '18:00']], ['2026-03-03', ['08:00', '12:00', '13:00', '16:00']], ['2026-03-04', ['08:00', '12:00', '13:00', '19:00']],
        ['2026-03-05', ['08:00', '12:00', '13:00', '17:00']], ['2026-03-06', ['08:00', '12:00', '13:00', '17:00']], ['2026-03-09', ['08:00', '12:00', '13:00', '16:00']],
      ];
      let n = 0;
      for (const [d, hs] of days) for (const h of hs) await tx.timeRecord.create({ data: { tenantId: t.id, employmentId: ids.e!, recordedAt: at(d, h), source: 'DEVICE', hash: `c${++n}`, idempotencyKey: `comp-${n}` } });
    });
    tk.admin = (await api(app).post('/v1/auth/token').send({ email: 'admin@comp-a.test', password: PASSWORD }).expect(200)).body.accessToken;
    tk.duda = (await api(app).post('/v1/auth/token').send({ email: 'duda@comp-a.test', password: PASSWORD }).expect(200)).body.accessToken;
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => (d >= 1 && d <= 5 ? { dayIndex: d, isWorkday: true, startTime: '08:00', endTime: '17:00', breakMinutes: 60 } : { dayIndex: d, isWorkday: false }));
    const s = await api(app).post('/v1/work-schedules').set(as('admin')).send({ companyId: ids.co, name: 'Comercial', type: 'FIXED', days }).expect(201);
    await api(app).post('/v1/schedule-assignments').set(as('admin')).send({ employmentIds: [ids.e], scheduleId: s.body.id, validFrom: '2026-03-01' }).expect(201);
  });

  afterAll(async () => {
    await app.close();
    await owner.$disconnect();
  });

  it('regra pura: compensa dentro da semana e separa o que vai para o banco ou é pago', () => {
    const d = (date: string, balanceMinutes: number) => ({ date, balanceMinutes, overtime: [] }) as never;
    const r = compensate([d('2026-03-02', 60), d('2026-03-03', -60), d('2026-03-04', 120), d('2026-03-09', -60)], 'WEEK', 'PAY');
    expect(r.periods.map((p) => [p.key, p.net, p.toBank, p.toPay])).toEqual([['2026-03-02', 120, 0, 120], ['2026-03-09', -60, -60, 0]]);
    expect(compensate([d('2026-03-02', 60), d('2026-03-31', -30)], 'MONTH', 'BANK').periods[0]).toMatchObject({ key: '2026-03', net: 30, toBank: 30 });
  });

  it('extrato do banco de compensação por semana', async () => {
    await api(app).put('/v1/bank/policy').set(as('admin')).send({ companyId: ids.co, enabled: true, expirationDays: 90, creditMultipliers: {}, compensationEnabled: true, compensationPeriod: 'WEEK', compensationLeftover: 'PAY' }).expect(200);
    const c = await api(app).get(`/v1/bank/compensation/${ids.e}?from=2026-03-02&to=2026-03-09`).set(as('admin')).expect(200);
    expect(c.body).toMatchObject({ enabled: true, period: 'WEEK', leftover: 'PAY' });
    expect(c.body.periods.map((p: { key: string; positive: number; negative: number; net: number }) => [p.key, p.positive, p.negative, p.net])).toEqual([['2026-03-02', 180, -60, 120], ['2026-03-09', 0, -60, -60]]);
  });

  it('fechamento com compensação: sobra paga não entra no banco; débito líquido entra', async () => {
    await api(app).post('/v1/closings').set(as('admin')).send({ companyId: ids.co, periodStart: '2026-03-02', periodEnd: '2026-03-09' }).expect(201);
    const s = await api(app).get(`/v1/bank/statement/${ids.e}`).set(as('admin')).expect(200);
    expect(s.body.balanceMinutes).toBe(-60);
    expect(s.body.transactions).toHaveLength(1);
    expect(s.body.transactions[0]).toMatchObject({ type: 'DEBIT', minutes: -60, refDate: '2026-03-09' });
  });

  it('meu banco de horas: o funcionário vê só o próprio extrato', async () => {
    const m = await api(app).get('/v1/bank/me').set(as('duda')).expect(200);
    expect(m.body).toMatchObject({ balanceMinutes: -60, employment: { registration: '10' } });
    await api(app).get(`/v1/bank/statement/${ids.e}`).set(as('duda')).expect(403);
    await api(app).get('/v1/bank/me').set(as('admin')).expect(403); // admin sem funcionário ligado
  });
});
