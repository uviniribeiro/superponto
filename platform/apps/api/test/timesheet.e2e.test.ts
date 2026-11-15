// Fases 4 e 5: apuração e espelho, ajustes, abonos com limite, afastamentos, sobreaviso, espelho
// diário, fechamento com banco de horas, marcação web, solicitações em níveis e política de extra.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, createApp, ownerUrl } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
const tk: Record<string, string> = {};
const ids: Record<string, string> = {};
const as = (who: string) => ({ Authorization: `Bearer ${tk[who]}` });
const login = async (email: string) => (await api(app).post('/v1/auth/token').send({ email, password: PASSWORD }).expect(200)).body.accessToken as string;
const at = (date: string, hm: string) => new Date(`${date}T${hm}:00-03:00`);

type Day = { date: string; closed: boolean; result: { balanceMinutes: number; flags: string[]; overtimeMinutes: number; unauthorizedOvertimeMinutes: number; workedMinutes: number } | null; punches: Array<{ id: string; time: string; status: string }>; allowance: unknown; leave: unknown };
const mirror = async (emp: string, from: string, to: string, who = 'admin') => (await api(app).get(`/v1/timesheet?employmentId=${emp}&from=${from}&to=${to}`).set(as(who)).expect(200)).body as { days: Day[]; summary: Record<string, number> };
const day = (m: { days: Day[] }, date: string) => m.days.find((d) => d.date === date)!;

describe('Ponto, bancos e solicitações', () => {
  beforeAll(async () => {
    ({ app } = await createApp());
    const hasher = new PasswordHasher();
    const hash = await hasher.hash(PASSWORD);
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const role = async (key: string) => (await tx.role.findFirstOrThrow({ where: { tenantId: null, key } })).id;
      for (const slug of ['ts-a', 'ts-b']) {
        const t = await tx.tenant.create({ data: { name: slug, slug } });
        ids[slug] = t.id;
        const u = await tx.user.create({ data: { tenantId: t.id, email: `admin@${slug}.test`, displayName: 'Admin', passwordHash: hash } });
        await tx.userRole.create({ data: { userId: u.id, roleId: await role('company_admin'), tenantId: t.id, scope: 'TENANT' } });
      }
      const t = ids['ts-a']!;
      ids.co1 = (await tx.company.create({ data: { tenantId: t, legalName: 'Clínica Ponto', cnpj: '11222333000181' } })).id;
      const person = (fullName: string) => tx.person.create({ data: { tenantId: t, fullName } });
      const p1 = await person('Ana Ponto'), p2 = await person('Bruno Ponto'), p3 = await person('Carla Gestora');
      ids.e3 = (await tx.employment.create({ data: { tenantId: t, personId: p3.id, companyId: ids.co1!, registration: '300', hiredAt: new Date('2025-01-01') } })).id;
      ids.e1 = (await tx.employment.create({ data: { tenantId: t, personId: p1.id, companyId: ids.co1!, registration: '100', hiredAt: new Date('2025-01-01'), supervisorId: ids.e3 } })).id;
      ids.e2 = (await tx.employment.create({ data: { tenantId: t, personId: p2.id, companyId: ids.co1!, registration: '200', hiredAt: new Date('2025-01-01') } })).id;
      const emp = await tx.user.create({ data: { tenantId: t, email: 'ana@ts-a.test', displayName: 'Ana', passwordHash: hash, personId: p1.id } });
      await tx.userRole.create({ data: { userId: emp.id, roleId: await role('employee'), tenantId: t, scope: 'TENANT' } });
      const mgr = await tx.user.create({ data: { tenantId: t, email: 'carla@ts-a.test', displayName: 'Carla', passwordHash: hash, personId: p3.id } });
      await tx.userRole.create({ data: { userId: mgr.id, roleId: await role('manager'), tenantId: t, scope: 'TENANT' } });
      // Perfil próprio: lança ajustes, mas não aprova.
      const clerkRole = await tx.role.create({ data: { tenantId: t, key: 'lancador', name: 'Lançador' } });
      for (const key of ['time.adjustments:create', 'time.records:read', 'time.calculations:read']) {
        const perm = await tx.permission.findUniqueOrThrow({ where: { key } });
        await tx.rolePermission.create({ data: { roleId: clerkRole.id, permissionId: perm.id } });
      }
      const clerk = await tx.user.create({ data: { tenantId: t, email: 'lancador@ts-a.test', displayName: 'Lançador', passwordHash: hash } });
      await tx.userRole.create({ data: { userId: clerk.id, roleId: clerkRole.id, tenantId: t, scope: 'TENANT' } });
      // Marcações da Ana (relógio): seg ok, ter +2h, qua atraso 30, qui falta, sex ímpar.
      let n = 0;
      const punch = (date: string, hm: string) => tx.timeRecord.create({ data: { tenantId: t, employmentId: ids.e1!, recordedAt: at(date, hm), source: 'DEVICE', hash: `h${++n}`, idempotencyKey: `seed-${n}` } });
      for (const hm of ['08:00', '12:00', '13:00', '17:00']) await punch('2026-03-02', hm);
      for (const hm of ['08:00', '12:00', '13:00', '19:00']) await punch('2026-03-03', hm);
      for (const hm of ['08:30', '12:00', '13:00', '17:00']) await punch('2026-03-04', hm);
      for (const hm of ['08:00', '12:00', '13:00']) await punch('2026-03-06', hm);
      ids.dup = (await punch('2026-03-02', '12:01')).id; // duplicidade
    });
    for (const [k, e] of [['admin', 'admin@ts-a.test'], ['other', 'admin@ts-b.test'], ['ana', 'ana@ts-a.test'], ['carla', 'carla@ts-a.test'], ['clerk', 'lancador@ts-a.test']]) tk[k] = await login(e!);
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => (d >= 1 && d <= 5 ? { dayIndex: d, isWorkday: true, startTime: '08:00', endTime: '17:00', breakMinutes: 60, breakStart: '12:00' } : { dayIndex: d, isWorkday: false }));
    ids.sched = (await api(app).post('/v1/work-schedules').set(as('admin')).send({ companyId: ids.co1, name: 'Comercial', type: 'FIXED', days }).expect(201)).body.id;
    await api(app).post('/v1/schedule-assignments').set(as('admin')).send({ employmentIds: [ids.e1, ids.e2, ids.e3], scheduleId: ids.sched, validFrom: '2026-03-01' }).expect(201);
  });

  afterAll(async () => {
    await app.close();
    await owner.$disconnect();
  });

  it('espelho: calcula cada dia pelo horário e pelas marcações', async () => {
    const m = await mirror(ids.e1!, '2026-03-02', '2026-03-08');
    expect(day(m, '2026-03-02').result!.flags).toContain('INCOMPLETE'); // 5 marcações por causa da duplicidade
    expect(day(m, '2026-03-03').result).toMatchObject({ balanceMinutes: 120, overtimeMinutes: 120 });
    expect(day(m, '2026-03-04').result!.balanceMinutes).toBe(-30);
    expect(day(m, '2026-03-05').result!.flags).toContain('ABSENCE');
    expect(day(m, '2026-03-06').result!.flags).toContain('INCOMPLETE');
    expect(m.summary).toMatchObject({ absenceDays: 1, incompleteDays: 2 });
  });

  it('ajustes: desconsiderar duplicidade e incluir marcação esquecida; quem pediu não aprova', async () => {
    await api(app).post('/v1/time-adjustments').set(as('ana')).send({ kind: 'INCLUDE', employmentId: ids.e1, date: '2026-03-06', time: '17:00', justification: 'Esqueci de marcar' }).expect(403);
    await api(app).post('/v1/time-adjustments').set(as('admin')).send({ kind: 'DISREGARD', employmentId: ids.e1, timeRecordId: ids.dup, justification: 'Marcação em duplicidade' }).expect(201);
    await api(app).post('/v1/time-adjustments').set(as('admin')).send({ kind: 'DISREGARD', employmentId: ids.e1, timeRecordId: ids.dup, justification: 'De novo' }).expect(409);
    const pending = await api(app).post('/v1/time-adjustments').set(as('clerk')).send({ kind: 'INCLUDE', employmentId: ids.e1, date: '2026-03-06', time: '17:00', justification: 'Esqueceu de marcar a saída' }).expect(201);
    expect(pending.body.status).toBe('PENDING');
    let m = await mirror(ids.e1!, '2026-03-02', '2026-03-06');
    expect(day(m, '2026-03-02').result!.balanceMinutes).toBe(0);
    expect(day(m, '2026-03-02').punches.find((p) => p.id === ids.dup)!.status).toBe('DISREGARDED');
    expect(day(m, '2026-03-06').punches.some((p) => p.status === 'PENDING_INCLUDE')).toBe(true);
    expect(day(m, '2026-03-06').result!.flags).toContain('INCOMPLETE');
    await api(app).post(`/v1/time-adjustments/${pending.body.id}/decide`).set(as('clerk')).send({ approve: true }).expect(403);
    const list = await api(app).get(`/v1/time-adjustments?status=PENDING&companyId=${ids.co1}`).set(as('admin')).expect(200);
    expect(list.body.map((a: { id: string }) => a.id)).toContain(pending.body.id);
    await api(app).post(`/v1/time-adjustments/${pending.body.id}/decide`).set(as('admin')).send({ approve: true }).expect(200);
    m = await mirror(ids.e1!, '2026-03-06', '2026-03-06');
    expect(day(m, '2026-03-06').result).toMatchObject({ balanceMinutes: 0 });
    expect(day(m, '2026-03-06').punches.map((p) => p.status)).toContain('INCLUDED');
    // a marcação original nunca é apagada
    expect(await owner.timeRecord.count({ where: { id: ids.dup } })).toBe(1);
  });

  it('abonos: abona falta e atraso, respeita o limite de uso e pula folgas', async () => {
    const j = await api(app).post('/v1/justifications').set(as('admin')).send({ code: 'AT', name: 'Atestado de horas', disregardsDebits: true, usageLimit: 2, limitPeriod: 'MONTH' }).expect(201);
    ids.atestado = j.body.id;
    ids.semAbono = (await api(app).post('/v1/justifications').set(as('admin')).send({ name: 'Falta justificada sem abono', disregardsDebits: false }).expect(201)).body.id;
    await api(app).post('/v1/allowances').set(as('admin')).send({ employmentIds: [ids.e1], from: '2026-03-05', to: '2026-03-05', justificationId: ids.atestado }).expect(201);
    await api(app).post('/v1/allowances').set(as('admin')).send({ employmentIds: [ids.e1], from: '2026-03-04', to: '2026-03-04', justificationId: ids.atestado, fullDay: false, minutes: 30 }).expect(201);
    const m = await mirror(ids.e1!, '2026-03-04', '2026-03-05');
    expect(day(m, '2026-03-04').result!.balanceMinutes).toBe(0);
    expect(day(m, '2026-03-05').result).toMatchObject({ balanceMinutes: 0 });
    expect(day(m, '2026-03-05').result!.flags).toContain('LEAVE_FULL');
    const over = await api(app).post('/v1/allowances').set(as('admin')).send({ employmentIds: [ids.e1], from: '2026-03-10', to: '2026-03-10', justificationId: ids.atestado }).expect(409);
    expect(over.body.message).toMatch(/Limite/);
    await api(app).post('/v1/allowances').set(as('admin')).send({ employmentIds: [ids.e1], from: '2026-03-07', to: '2026-03-08', justificationId: ids.semAbono }).expect(400); // fim de semana
    // justificada sem abono: continua descontando, mas aparece justificada
    await api(app).post('/v1/allowances').set(as('admin')).send({ employmentIds: [ids.e2], from: '2026-03-02', to: '2026-03-02', justificationId: ids.semAbono }).expect(201);
    const b = await mirror(ids.e2!, '2026-03-02', '2026-03-02');
    expect(day(b, '2026-03-02').result).toMatchObject({ balanceMinutes: -480 });
    expect(day(b, '2026-03-02').result!.flags).toContain('JUSTIFIED');
  });

  it('afastamento e sobreaviso', async () => {
    await api(app).post('/v1/leaves').set(as('admin')).send({ employmentId: ids.e2, type: 'VACATION', startDate: '2026-03-09', endDate: '2026-03-13' }).expect(201);
    await api(app).post('/v1/leaves').set(as('admin')).send({ employmentId: ids.e2, type: 'MEDICAL', startDate: '2026-03-12', endDate: '2026-03-14' }).expect(409);
    const b = await mirror(ids.e2!, '2026-03-09', '2026-03-13');
    expect(b.days.every((d) => d.leave && d.result!.balanceMinutes === 0)).toBe(true);
    expect(b.summary.leaveDays).toBe(5);
    const oc = await api(app).post('/v1/on-call').set(as('admin')).send({ employmentIds: [ids.e1], date: '2026-03-07', startTime: '18:00', endTime: '06:00' }).expect(201);
    expect(oc.body.minutes).toBe(720);
    const m = await mirror(ids.e1!, '2026-03-02', '2026-03-08');
    expect(m.summary).toMatchObject({ onCallMinutes: 720, onCallPaidMinutes: 240 });
  });

  it('espelho diário: situação de cada funcionário', async () => {
    const d = await api(app).get(`/v1/timesheet/daily?companyId=${ids.co1}&date=2026-03-02`).set(as('admin')).expect(200);
    const sit = Object.fromEntries(d.body.rows.map((r: { registration: string; situation: string }) => [r.registration, r.situation]));
    expect(sit).toMatchObject({ 100: 'PRESENT', 200: 'ABSENT', 300: 'ABSENT' });
    const v = await api(app).get(`/v1/timesheet/daily?companyId=${ids.co1}&date=2026-03-10`).set(as('admin')).expect(200);
    expect(v.body.rows.find((r: { registration: string }) => r.registration === '200').situation).toBe('LEAVE');
  });

  it('fechamento: grava a apuração, lança o banco de horas e trava alterações; reabrir desfaz', async () => {
    await api(app).put('/v1/bank/policy').set(as('admin')).send({ companyId: ids.co1, enabled: true, expirationDays: 90, maxDailyCreditMinutes: null, creditMultipliers: {} }).expect(200);
    const calc = await api(app).post('/v1/timesheet/calculate').set(as('admin')).send({ companyId: ids.co1, from: '2026-03-02', to: '2026-03-08' }).expect(200);
    expect(calc.body).toMatchObject({ employments: 3, days: 21 });
    const c = await api(app).post('/v1/closings').set(as('admin')).send({ companyId: ids.co1, periodStart: '2026-03-02', periodEnd: '2026-03-08' }).expect(201);
    expect(c.body.status).toBe('CLOSED');
    expect(c.body.bankEntries).toBeGreaterThan(0);
    ids.closing = c.body.id;
    await api(app).post('/v1/closings').set(as('admin')).send({ companyId: ids.co1, periodStart: '2026-03-05', periodEnd: '2026-03-10' }).expect(409);
    const m = await mirror(ids.e1!, '2026-03-02', '2026-03-08');
    expect(m.days.every((d) => d.closed)).toBe(true);
    expect(day(m, '2026-03-03').result!.balanceMinutes).toBe(120);
    await api(app).post('/v1/time-adjustments').set(as('admin')).send({ kind: 'INCLUDE', employmentId: ids.e1, date: '2026-03-03', time: '20:00', justification: 'Tentativa em período fechado' }).expect(409);
    await api(app).post('/v1/allowances').set(as('admin')).send({ employmentIds: [ids.e1], from: '2026-03-06', to: '2026-03-06', justificationId: ids.semAbono }).expect(409);
    // banco: Ana +120 (03/03); Bruno -1920 (faltas de 03 a 06/03: 4 dias; 02/03 justificada sem abono também desconta)
    let s = await api(app).get(`/v1/bank/statement/${ids.e1}`).set(as('admin')).expect(200);
    expect(s.body.balanceMinutes).toBe(120);
    expect(s.body.transactions[0]).toMatchObject({ type: 'CREDIT', minutes: 120, refDate: '2026-03-03', expiresOn: '2026-06-01' });
    const bal = await api(app).get(`/v1/bank/balances?companyId=${ids.co1}`).set(as('admin')).expect(200);
    expect(bal.body.find((b: { registration: string }) => b.registration === '200').balanceMinutes).toBe(-2400);
    // lançamentos manuais e zerar em lote
    await api(app).post('/v1/bank/transactions').set(as('admin')).send({ employmentIds: [ids.e1], type: 'PAYOUT', minutes: 60, refDate: '2026-03-31', description: 'Pago na folha de março' }).expect(201);
    s = await api(app).get(`/v1/bank/statement/${ids.e1}`).set(as('admin')).expect(200);
    expect(s.body.balanceMinutes).toBe(60);
    const z = await api(app).post('/v1/bank/reset').set(as('admin')).send({ companyId: ids.co1, refDate: '2026-03-31', type: 'ADJUSTMENT', only: 'NEGATIVE', description: 'Perdão das faltas de março' }).expect(200);
    expect(z.body.zeroed).toBe(2); // Bruno e Carla
    // reabrir: desfaz os lançamentos do fechamento (os manuais ficam)
    await api(app).post(`/v1/closings/${ids.closing}/reopen`).set(as('admin')).send({ reason: 'x' }).expect(400);
    const r = await api(app).post(`/v1/closings/${ids.closing}/reopen`).set(as('admin')).send({ reason: 'Ajuste tardio do RH' }).expect(200);
    expect(r.body).toMatchObject({ status: 'REOPENED' });
    s = await api(app).get(`/v1/bank/statement/${ids.e1}`).set(as('admin')).expect(200);
    expect(s.body.balanceMinutes).toBe(-60);
    expect((await mirror(ids.e1!, '2026-03-03', '2026-03-03')).days[0]!.closed).toBe(false);
  });

  it('marcação web: desafio de uso único, intervalo mínimo e cerca virtual', async () => {
    const me = await api(app).get('/v1/punch/me').set(as('ana')).expect(200);
    expect(me.body.employments).toHaveLength(1);
    await api(app).post('/v1/punch').set(as('ana')).send({ token: 'falso.falso-falso-falso-falso' }).expect(400);
    await api(app).post('/v1/punch/challenge').set(as('admin')).expect(200); // admin sem funcionário ligado consegue o desafio...
    await api(app).get('/v1/punch/me').set(as('admin')).expect(403); // ...mas não tem vínculo para marcar
    const ch = await api(app).post('/v1/punch/challenge').set(as('ana')).expect(200);
    const p = await api(app).post('/v1/punch').set(as('ana')).send({ token: ch.body.token }).expect(201);
    expect(p.body).toMatchObject({ employee: 'Ana Ponto', registration: '100', cnpj: '11222333000181' });
    expect(p.body.hash).toMatch(/^[0-9a-f]{64}$/);
    await api(app).post('/v1/punch').set(as('ana')).send({ token: ch.body.token }).expect(409); // reuso
    const ch2 = await api(app).post('/v1/punch/challenge').set(as('ana')).expect(200);
    const again = await api(app).post('/v1/punch').set(as('ana')).send({ token: ch2.body.token }).expect(409);
    expect(again.body.message).toMatch(/1 minuto/);
    // desafio de outro usuário não vale
    const chCarla = await api(app).post('/v1/punch/challenge').set(as('carla')).expect(200);
    await api(app).post('/v1/punch').set(as('ana')).send({ token: chCarla.body.token }).expect(400);
    // cerca virtual da unidade
    const unit = await api(app).post('/v1/units').set(as('admin')).send({ companyId: ids.co1, name: 'Sede', latitude: -19.9191, longitude: -43.9386, geofenceM: 100 }).expect(201);
    await owner.$transaction(async (tx) => { await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`; await tx.employment.update({ where: { id: ids.e1! }, data: { unitId: unit.body.id } }); });
    const ch3 = await api(app).post('/v1/punch/challenge').set(as('ana')).expect(200);
    await api(app).post('/v1/punch').set(as('ana')).send({ token: ch3.body.token }).expect(403);
    const far = await api(app).post('/v1/punch').set(as('ana')).send({ token: ch3.body.token, latitude: -19.95, longitude: -43.95, accuracy: 10 }).expect(403);
    expect(far.body.message).toMatch(/m de Sede/);
    const rec = await owner.timeRecord.findFirstOrThrow({ where: { id: p.body.id } });
    expect(rec.source).toBe('WEB');
  });

  it('meu espelho: o funcionário vê o próprio e não acessa o de outros', async () => {
    const m = await api(app).get('/v1/timesheet/me?from=2026-03-02&to=2026-03-03').set(as('ana')).expect(200);
    expect(m.body.employment.registration).toBe('100');
    await api(app).get(`/v1/timesheet?employmentId=${ids.e2}&from=2026-03-02&to=2026-03-03`).set(as('ana')).expect(403);
  });

  it('solicitação em dois níveis (superior imediato e RH) aplica a inclusão ao aprovar', async () => {
    await api(app).put('/v1/approval-flows').set(as('admin')).send({ companyId: ids.co1, requestType: 'RECORD_CORRECTION', steps: [{ label: 'Superior imediato', approver: 'SUPERVISOR' }, { label: 'RH', approver: 'PERMISSION' }] }).expect(200);
    const r = await api(app).post('/v1/requests').set(as('ana')).send({ type: 'RECORD_CORRECTION', refDate: '2026-04-01', payload: { time: '08:00' }, justification: 'Esqueci de marcar a entrada' }).expect(201);
    expect(r.body).toMatchObject({ status: 'PENDING', currentStep: 0, employee: { registration: '100' } });
    await api(app).post(`/v1/requests/${r.body.id}/decide`).set(as('ana')).send({ decision: 'APPROVED' }).expect(403); // o próprio
    expect((await api(app).get('/v1/requests/inbox').set(as('admin')).expect(200)).body).toHaveLength(0); // etapa do superior
    expect((await api(app).get('/v1/requests/inbox').set(as('carla')).expect(200)).body.map((x: { id: string }) => x.id)).toEqual([r.body.id]);
    await api(app).post(`/v1/requests/${r.body.id}/decide`).set(as('carla')).send({ decision: 'REJECTED' }).expect(400); // recusa sem motivo
    const s1 = await api(app).post(`/v1/requests/${r.body.id}/decide`).set(as('carla')).send({ decision: 'APPROVED', comment: 'Confirmo' }).expect(200);
    expect(s1.body).toMatchObject({ status: 'PENDING', currentStep: 1 });
    expect(await owner.timeRecordAdjustment.count({ where: { requestId: r.body.id } })).toBe(0);
    const s2 = await api(app).post(`/v1/requests/${r.body.id}/decide`).set(as('admin')).send({ decision: 'APPROVED' }).expect(200);
    expect(s2.body.status).toBe('APPROVED');
    expect(await owner.timeRecordAdjustment.findFirstOrThrow({ where: { requestId: r.body.id } })).toMatchObject({ kind: 'INCLUDE', status: 'APPROVED' });
    const mine = await api(app).get('/v1/requests/mine').set(as('ana')).expect(200);
    expect(mine.body[0].decisions).toHaveLength(2);
  });

  it('política de hora extra: extra sem autorização é apontada; a autorização aprovada reduz o apontamento', async () => {
    await api(app).post('/v1/rule-sets').set(as('admin')).send({ companyId: ids.co1, name: 'Com autorização de extra', isDefault: true, rules: { overtimeRequiresAuthorization: true } }).expect(201);
    let d = day(await mirror(ids.e1!, '2026-03-03', '2026-03-03'), '2026-03-03');
    expect(d.result).toMatchObject({ overtimeMinutes: 120, unauthorizedOvertimeMinutes: 120 });
    expect(d.result!.flags).toContain('OVERTIME_UNAUTHORIZED');
    const r = await api(app).post('/v1/requests').set(as('ana')).send({ type: 'OVERTIME_AUTHORIZATION', refDate: '2026-03-03', payload: { maxMinutes: 60 }, justification: 'Atendimento que atrasou' }).expect(201);
    await api(app).post(`/v1/requests/${r.body.id}/decide`).set(as('carla')).send({ decision: 'APPROVED' }).expect(200); // sem fluxo: quem pode aprovar
    d = day(await mirror(ids.e1!, '2026-03-03', '2026-03-03'), '2026-03-03');
    expect(d.result).toMatchObject({ overtimeMinutes: 120, unauthorizedOvertimeMinutes: 60, balanceMinutes: 120 }); // a extra continua sendo paga
  });

  it('justificativa por solicitação vira abono; pedido pendente pode ser cancelado', async () => {
    const r = await api(app).post('/v1/requests').set(as('ana')).send({ type: 'ABSENCE_JUSTIFICATION', refDate: '2026-04-02', payload: { justificationId: ids.semAbono, fullDay: true }, justification: 'Consulta médica sem atestado' }).expect(201);
    await api(app).post(`/v1/requests/${r.body.id}/decide`).set(as('admin')).send({ decision: 'APPROVED' }).expect(200);
    expect(await owner.allowance.count({ where: { employmentId: ids.e1, date: new Date('2026-04-02') } })).toBe(1);
    const o = await api(app).post('/v1/requests').set(as('ana')).send({ type: 'OTHER', payload: { subject: 'Declaração de horas' }, justification: 'Preciso para a faculdade' }).expect(201);
    await api(app).post(`/v1/requests/${o.body.id}/cancel`).set(as('carla')).expect(403);
    expect((await api(app).post(`/v1/requests/${o.body.id}/cancel`).set(as('ana')).expect(200)).body.status).toBe('CANCELLED');
  });

  it('outro cliente não enxerga nada', async () => {
    await api(app).get(`/v1/timesheet?employmentId=${ids.e1}&from=2026-03-02&to=2026-03-03`).set(as('other')).expect(404);
    await api(app).get(`/v1/bank/statement/${ids.e1}`).set(as('other')).expect(404);
    await api(app).post(`/v1/closings/${ids.closing}/reopen`).set(as('other')).send({ reason: 'Invasão de cliente' }).expect(404);
    expect((await api(app).get('/v1/requests').set(as('other')).expect(200)).body).toHaveLength(0);
  });

  it('auditoria registra ponto, fechamento, banco e solicitações', async () => {
    const entities = new Set((await owner.auditLog.findMany({ where: { tenantId: ids['ts-a'] }, select: { entity: true } })).map((a) => a.entity));
    for (const e of ['time_adjustment', 'allowance', 'leave', 'on_call', 'time_calculation', 'time_closing', 'bank_policy', 'bank_transaction', 'bank_reset', 'time_record', 'approval_flow', 'time_request']) expect(entities, e).toContain(e);
  });
});
