// Fase 3 (jornada): horários, regras de apuração, atribuição com vigência, escala agendada,
// trocas de escala/folga, jornada prevista com feriados e período fechado.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, createApp, ownerUrl } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
let admin = '';
let other = '';
let employee = '';
const ids: Record<string, string> = {};
const as = (t: string) => ({ Authorization: `Bearer ${t}` });
const login = async (email: string) => (await api(app).post('/v1/auth/token').send({ email, password: PASSWORD }).expect(200)).body.accessToken as string;

const weekdays = (start: string, end: string, breakStart = '12:00') => [0, 1, 2, 3, 4, 5, 6].map((d) => (d >= 1 && d <= 5
  ? { dayIndex: d, isWorkday: true, startTime: start, endTime: end, breakMinutes: 60, breakStart }
  : { dayIndex: d, isWorkday: false }));

type Day = { date: string; isWorkday: boolean; isHoliday: boolean; start: string | null; end: string | null; scheduled: boolean; origin: string | null; holidayName: string | null; scheduleName: string | null };
const expected = async (emp: string, from: string, to: string) => (await api(app).get(`/v1/employees/${emp}/expected?from=${from}&to=${to}`).set(as(admin)).expect(200)).body.days as Day[];
const on = (days: Day[], date: string) => days.find((d) => d.date === date)!;

describe('Jornadas e escalas', () => {
  beforeAll(async () => {
    ({ app } = await createApp());
    const hasher = new PasswordHasher();
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const adminRole = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'company_admin' } });
      const empRole = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'employee' } });
      for (const slug of ['sch-a', 'sch-b']) {
        const t = await tx.tenant.create({ data: { name: slug, slug } });
        ids[slug] = t.id;
        const u = await tx.user.create({ data: { tenantId: t.id, email: `admin@${slug}.test`, displayName: 'Admin', passwordHash: await hasher.hash(PASSWORD) } });
        await tx.userRole.create({ data: { userId: u.id, roleId: adminRole.id, tenantId: t.id, scope: 'TENANT' } });
      }
      const t = ids['sch-a']!;
      const e = await tx.user.create({ data: { tenantId: t, email: 'func@sch-a.test', displayName: 'Func', passwordHash: await hasher.hash(PASSWORD) } });
      await tx.userRole.create({ data: { userId: e.id, roleId: empRole.id, tenantId: t, scope: 'TENANT' } });
      ids.co1 = (await tx.company.create({ data: { tenantId: t, legalName: 'Hospital Teste' } })).id;
      ids.co2 = (await tx.company.create({ data: { tenantId: t, legalName: 'Outra Empresa' } })).id;
      for (const [key, name, reg] of [['e1', 'Ana Plantonista', '100'], ['e2', 'Bruno Comercial', '200']] as const) {
        const p = await tx.person.create({ data: { tenantId: t, fullName: name } });
        ids[key] = (await tx.employment.create({ data: { tenantId: t, personId: p.id, companyId: ids.co1!, registration: reg, hiredAt: new Date('2025-01-01') } })).id;
      }
    });
    admin = await login('admin@sch-a.test');
    other = await login('admin@sch-b.test');
    employee = await login('func@sch-a.test');
  });

  afterAll(async () => {
    await app.close();
    await owner.$disconnect();
  });

  it('horário: valida o desenho da jornada', async () => {
    const base = { companyId: ids.co1, name: 'Inválido' };
    await api(app).post('/v1/work-schedules').set(as(admin)).send({ ...base, type: 'SHIFT_12X36', days: [{ dayIndex: 0, isWorkday: true, startTime: '07:00', endTime: '19:00' }] }).expect(400);
    await api(app).post('/v1/work-schedules').set(as(admin)).send({ ...base, type: 'FIXED', days: [{ dayIndex: 1, isWorkday: true, startTime: '08:00', endTime: '09:00', breakMinutes: 90 }] }).expect(400);
    await api(app).post('/v1/work-schedules').set(as(admin)).send({ ...base, type: 'FIXED', days: [{ dayIndex: 1, isWorkday: true, startTime: '08:00' }] }).expect(400);
    await api(app).post('/v1/work-schedules').set(as(admin)).send({ ...base, type: 'FIXED', days: [{ dayIndex: 7, isWorkday: false }] }).expect(400);
    await api(app).post('/v1/work-schedules').set(as(admin)).send({ ...base, type: 'FIXED', days: [{ dayIndex: 1, isWorkday: true, startTime: '08:00', endTime: '17:00', breakMinutes: 60, breakStart: '18:00' }] }).expect(400);
    await api(app).post('/v1/work-schedules').set(as(admin)).send({ ...base, type: 'FLEXIBLE', days: [{ dayIndex: 1, isWorkday: true }] }).expect(400);
  });

  it('horário semanal e escala 12x36: carga semanal calculada e prévia do ciclo', async () => {
    const c = await api(app).post('/v1/work-schedules').set(as(admin)).send({ companyId: ids.co1, name: 'Comercial', code: 'H01', type: 'FIXED', days: weekdays('08:00', '17:00'), breakMobilityMinutes: 30 }).expect(201);
    expect(c.body).toMatchObject({ weeklyMinutes: 2400, code: 'H01', breakMobilityMinutes: 30, considerHolidays: true });
    expect(c.body.days).toHaveLength(7);
    ids.comercial = c.body.id;
    await api(app).post('/v1/work-schedules').set(as(admin)).send({ companyId: ids.co1, name: 'comercial', type: 'FIXED', days: weekdays('08:00', '17:00') }).expect(409);
    const p = await api(app).post('/v1/work-schedules').set(as(admin)).send({
      companyId: ids.co1, name: 'Plantão 12x36', type: 'SHIFT_12X36', cycleDays: 2, considerHolidays: false, inItinereMinutes: 20,
      days: [{ dayIndex: 0, isWorkday: true, startTime: '07:00', endTime: '19:00', breakMinutes: 60 }, { dayIndex: 1, isWorkday: false }],
    }).expect(201);
    expect(p.body.weeklyMinutes).toBe(2310);
    ids.plantao = p.body.id;
    const prev = await api(app).get(`/v1/work-schedules/${ids.plantao}/preview?from=2026-03-02&days=4`).set(as(admin)).expect(200);
    expect(prev.body.map((d: Day) => d.isWorkday)).toEqual([true, false, true, false]);
    expect(prev.body[0]).toMatchObject({ start: '07:00', end: '19:00', expectedMinutes: 660 });
    const night = await api(app).post('/v1/work-schedules').set(as(admin)).send({ companyId: ids.co1, name: 'Noturno', type: 'SHIFT_12X36', cycleDays: 2, days: [{ dayIndex: 0, isWorkday: true, startTime: '19:00', endTime: '07:00', breakMinutes: 60 }, { dayIndex: 1, isWorkday: false }] }).expect(201);
    const pn = await api(app).get(`/v1/work-schedules/${night.body.id}/preview?from=2026-03-02&days=1`).set(as(admin)).expect(200);
    expect(pn.body[0]).toMatchObject({ start: '19:00', end: '07:00', overnight: true, expectedMinutes: 660 });
    ids.co2Schedule = (await api(app).post('/v1/work-schedules').set(as(admin)).send({ companyId: ids.co2, name: 'Outra', type: 'FIXED', days: weekdays('09:00', '18:00') }).expect(201)).body.id;
  });

  it('regras de apuração: limites legais, faixas e regra padrão única', async () => {
    const rules = { markToleranceMinutes: 5, dailyToleranceMinutes: 10 };
    await api(app).post('/v1/rule-sets').set(as(admin)).send({ companyId: ids.co1, name: 'Ilegal', rules: { markToleranceMinutes: 6 } }).expect(400);
    await api(app).post('/v1/rule-sets').set(as(admin)).send({ companyId: ids.co1, name: 'Ilegal', rules: { overtimePercent: { normal: 40, night: 50, rest: 100, holiday: 100, break: 50 } } }).expect(400);
    await api(app).post('/v1/rule-sets').set(as(admin)).send({ companyId: ids.co1, name: 'Ilegal', rules: { overtimeBands: [{ upToMinutes: 120, percent: 50 }, { upToMinutes: 60, percent: 100 }] } }).expect(400);
    const a = await api(app).post('/v1/rule-sets').set(as(admin)).send({ companyId: ids.co1, name: 'CLT padrão', rules }).expect(201);
    expect(a.body.isDefault).toBe(true); // a primeira vira padrão
    expect(a.body.rules).toMatchObject({ markToleranceMinutes: 5, nightStart: '22:00', reducedNightHour: true, overtimePercent: { normal: 50 } });
    const b = await api(app).post('/v1/rule-sets').set(as(admin)).send({ companyId: ids.co1, name: 'Convenção saúde', isDefault: true, rules: { overtimeBands: [{ upToMinutes: 120, percent: 50 }, { upToMinutes: null, percent: 100 }] } }).expect(201);
    const list = await api(app).get(`/v1/rule-sets?companyId=${ids.co1}`).set(as(admin)).expect(200);
    expect(list.body.filter((r: { isDefault: boolean }) => r.isDefault).map((r: { id: string }) => r.id)).toEqual([b.body.id]);
    await api(app).delete(`/v1/rule-sets/${b.body.id}`).set(as(admin)).expect(409);
    // horário usando a regra
    await api(app).patch(`/v1/work-schedules/${ids.comercial}`).set(as(admin)).send({ name: 'Comercial', code: 'H01', type: 'FIXED', days: weekdays('08:00', '17:00'), breakMobilityMinutes: 30, ruleSetId: a.body.id }).expect(200);
    await api(app).delete(`/v1/rule-sets/${a.body.id}`).set(as(admin)).expect(409);
  });

  it('atribuição com vigência: a anterior termina na véspera e a outra empresa é recusada', async () => {
    await api(app).post('/v1/schedule-assignments').set(as(admin)).send({ employmentIds: [ids.e1], scheduleId: ids.co2Schedule, validFrom: '2026-03-01' }).expect(400);
    const first = await api(app).post('/v1/schedule-assignments').set(as(admin)).send({ employmentIds: [ids.e1, ids.e2], scheduleId: ids.comercial, validFrom: '2026-03-01' });
    expect(first.body).toEqual({ assigned: 2 });
    await api(app).post('/v1/schedule-assignments').set(as(admin)).send({ employmentIds: [ids.e1], scheduleId: ids.plantao, validFrom: '2026-03-10' }).expect(201);
    const hist = await api(app).get(`/v1/schedule-assignments?employmentId=${ids.e1}`).set(as(admin)).expect(200);
    expect(hist.body.map((h: { schedule: { name: string }; validFrom: string; validTo: string | null }) => [h.schedule.name, h.validFrom, h.validTo])).toEqual([
      ['Plantão 12x36', '2026-03-10', null],
      ['Comercial', '2026-03-01', '2026-03-09'],
    ]);
    const days = await expected(ids.e1!, '2026-03-08', '2026-03-12');
    expect(days.map((d) => [d.date, d.isWorkday, d.start, d.scheduleName])).toEqual([
      ['2026-03-08', false, null, 'Comercial'],
      ['2026-03-09', true, '08:00', 'Comercial'],
      ['2026-03-10', true, '07:00', 'Plantão 12x36'],
      ['2026-03-11', false, null, 'Plantão 12x36'],
      ['2026-03-12', true, '07:00', 'Plantão 12x36'],
    ]);
    // histórico funcional registra a troca de horário
    expect(await owner.employmentHistory.count({ where: { employmentId: ids.e1, field: 'schedule' } })).toBe(2);
  });

  it('feriado: folga em quem considera feriado; a escala 12x36 segue o ciclo', async () => {
    const bruno = on(await expected(ids.e2!, '2026-04-21', '2026-04-21'), '2026-04-21');
    expect(bruno).toMatchObject({ isWorkday: false, isHoliday: true, holidayName: 'Tiradentes' });
    const ana = on(await expected(ids.e1!, '2026-04-21', '2026-04-21'), '2026-04-21'); // 42 dias após o início do ciclo: dia de trabalho
    expect(ana).toMatchObject({ isWorkday: true, isHoliday: false, start: '07:00' });
  });

  it('escala agendada: sábados trabalhados e folga num dia útil; excluir volta ao normal', async () => {
    await api(app).post('/v1/schedule-overrides').set(as(admin)).send({ employmentIds: [ids.e2], from: '2026-03-14', to: '2026-03-28', isWorkday: true }).expect(400);
    const sat = await api(app).post('/v1/schedule-overrides').set(as(admin)).send({ employmentIds: [ids.e2], from: '2026-03-14', to: '2026-03-28', weekdays: [6], isWorkday: true, startTime: '07:00', endTime: '13:00', note: 'Mutirão' }).expect(201);
    expect(sat.body).toEqual({ created: 3 });
    await api(app).post('/v1/schedule-overrides').set(as(admin)).send({ employmentIds: [ids.e2], from: '2026-03-16', to: '2026-03-16', isWorkday: false, note: 'Folga concedida' }).expect(201);
    let days = await expected(ids.e2!, '2026-03-14', '2026-03-16');
    expect(on(days, '2026-03-14')).toMatchObject({ isWorkday: true, start: '07:00', end: '13:00', scheduled: true, origin: 'AGENDADA' });
    expect(on(days, '2026-03-16')).toMatchObject({ isWorkday: false, scheduled: true });
    const list = await api(app).get(`/v1/schedule-overrides?from=2026-03-01&to=2026-03-31&employmentId=${ids.e2}`).set(as(admin)).expect(200);
    expect(list.body).toHaveLength(4);
    const folga = list.body.find((o: { date: string }) => o.date === '2026-03-16');
    await api(app).delete(`/v1/schedule-overrides/${folga.id}`).set(as(admin)).expect(204);
    days = await expected(ids.e2!, '2026-03-16', '2026-03-16');
    expect(on(days, '2026-03-16')).toMatchObject({ isWorkday: true, start: '08:00', scheduled: false });
  });

  it('troca de escala entre dois funcionários e troca de folga', async () => {
    await api(app).post('/v1/schedule-overrides/swap').set(as(admin)).send({ kind: 'SHIFT', date: '2026-03-12', employmentIdA: ids.e1, employmentIdB: ids.e2, note: 'Pedido da equipe' }).expect(200);
    expect(on(await expected(ids.e1!, '2026-03-12', '2026-03-12'), '2026-03-12')).toMatchObject({ start: '08:00', end: '17:00', origin: 'TROCA' });
    expect(on(await expected(ids.e2!, '2026-03-12', '2026-03-12'), '2026-03-12')).toMatchObject({ start: '07:00', end: '19:00', origin: 'TROCA' });
    await api(app).post('/v1/schedule-overrides/swap').set(as(admin)).send({ kind: 'DAY_OFF', employmentId: ids.e2, workDate: '2026-03-17', offDate: '2026-03-18', note: 'x' }).expect(400); // motivo curto
    await api(app).post('/v1/schedule-overrides/swap').set(as(admin)).send({ kind: 'DAY_OFF', employmentId: ids.e2, workDate: '2026-03-17', offDate: '2026-03-18', note: 'Troca de folga' }).expect(400); // 18/03 já é dia de trabalho
    await api(app).post('/v1/schedule-overrides/swap').set(as(admin)).send({ kind: 'DAY_OFF', employmentId: ids.e2, workDate: '2026-03-17', offDate: '2026-03-22', note: 'Troca de folga' }).expect(200);
    const days = await expected(ids.e2!, '2026-03-17', '2026-03-22');
    expect(on(days, '2026-03-17')).toMatchObject({ isWorkday: false, origin: 'TROCA' });
    expect(on(days, '2026-03-22')).toMatchObject({ isWorkday: true, start: '08:00', end: '17:00', origin: 'TROCA' });
  });

  it('grade da equipe: todos os dias de cada funcionário', async () => {
    const g = await api(app).get(`/v1/schedule-grid?companyId=${ids.co1}&from=2026-03-09&to=2026-03-15`).set(as(admin)).expect(200);
    expect(g.body.rows.map((r: { name: string }) => r.name)).toEqual(['Ana Plantonista', 'Bruno Comercial']);
    expect(g.body.rows[0].days).toHaveLength(7);
    await api(app).get(`/v1/schedule-grid?companyId=${ids.co1}&from=2026-03-01&to=2026-05-01`).set(as(admin)).expect(400);
  });

  it('período fechado bloqueia atribuição e escala agendada', async () => {
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      await tx.timeClosing.create({ data: { tenantId: ids['sch-a']!, companyId: ids.co1!, periodStart: new Date('2026-02-01'), periodEnd: new Date('2026-02-28'), status: 'CLOSED' } });
    });
    await api(app).post('/v1/schedule-assignments').set(as(admin)).send({ employmentIds: [ids.e2], scheduleId: ids.comercial, validFrom: '2026-02-15' }).expect(409);
    await api(app).post('/v1/schedule-overrides').set(as(admin)).send({ employmentIds: [ids.e2], from: '2026-02-20', to: '2026-03-02', isWorkday: false }).expect(409);
  });

  it('horário em uso não é excluído; atribuição mais recente pode ser desfeita', async () => {
    await api(app).delete(`/v1/work-schedules/${ids.plantao}`).set(as(admin)).expect(409);
    const hist = await api(app).get(`/v1/schedule-assignments?employmentId=${ids.e1}`).set(as(admin)).expect(200);
    await api(app).delete(`/v1/schedule-assignments/${hist.body[1].id}`).set(as(admin)).expect(409);
    await api(app).delete(`/v1/schedule-assignments/${hist.body[0].id}`).set(as(admin)).expect(204);
    const after = await api(app).get(`/v1/schedule-assignments?employmentId=${ids.e1}`).set(as(admin)).expect(200);
    expect(after.body).toHaveLength(1);
    expect(after.body[0]).toMatchObject({ validTo: null });
    await api(app).delete(`/v1/work-schedules/${ids.plantao}`).set(as(admin)).expect(204);
  });

  it('outro cliente não enxerga nada; funcionário comum não acessa', async () => {
    await api(app).get(`/v1/work-schedules?companyId=${ids.co1}`).set(as(other)).expect(404);
    await api(app).get(`/v1/work-schedules/${ids.comercial}`).set(as(other)).expect(404);
    await api(app).get(`/v1/employees/${ids.e1}/expected?from=2026-03-01&to=2026-03-02`).set(as(other)).expect(404);
    await api(app).post('/v1/schedule-assignments').set(as(other)).send({ employmentIds: [ids.e1], scheduleId: ids.comercial, validFrom: '2026-04-01' }).expect(404);
    await api(app).get(`/v1/work-schedules?companyId=${ids.co1}`).set(as(employee)).expect(403);
    await api(app).post('/v1/schedule-overrides').set(as(employee)).send({ employmentIds: [ids.e1], from: '2026-04-01', to: '2026-04-01', isWorkday: false }).expect(403);
  });

  it('toda alteração fica na auditoria', async () => {
    const entities = (await owner.auditLog.findMany({ where: { tenantId: ids['sch-a'] }, select: { entity: true } })).map((a) => a.entity);
    for (const e of ['work_schedule', 'attendance_rule_set', 'schedule_assignment', 'schedule_override', 'schedule_swap']) expect(entities, e).toContain(e);
  });
});
