// Fase 8: painel ao vivo, e-mails agendados, avisos, aparelhos do app, textos e ciência do espelho.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MailService } from '../src/mail/mail.service.js';
import { LiveService, liveState, NotificationsService } from '../src/tools/tools.service.js';
import { api, createApp, ownerUrl } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
let mail: MailService;
const tk: Record<string, string> = {};
const ids: Record<string, string> = {};
const as = (who: string) => ({ Authorization: `Bearer ${tk[who]}` });
const at = (date: string, hm: string) => new Date(`${date}T${hm}:00-03:00`);
const DAY = '2026-03-02'; // segunda

describe('Ferramentas', () => {
  beforeAll(async () => {
    ({ app, mail } = await createApp());
    const hash = await new PasswordHasher().hash(PASSWORD);
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const role = async (key: string) => (await tx.role.findFirstOrThrow({ where: { tenantId: null, key } })).id;
      for (const slug of ['tools-a', 'tools-b']) {
        const t = await tx.tenant.create({ data: { name: slug, slug } });
        ids[slug] = t.id;
        const u = await tx.user.create({ data: { tenantId: t.id, email: `admin@${slug}.test`, displayName: 'Admin', passwordHash: hash } });
        await tx.userRole.create({ data: { userId: u.id, roleId: await role('company_admin'), tenantId: t.id, scope: 'TENANT' } });
      }
      const t = ids['tools-a']!;
      ids.co = (await tx.company.create({ data: { tenantId: t, legalName: 'Ferramentas Ltda' } })).id;
      ids.co2 = (await tx.company.create({ data: { tenantId: t, legalName: 'Outra Ltda' } })).id;
      const mk = async (fullName: string, registration: string, email?: string) => {
        const p = await tx.person.create({ data: { tenantId: t, fullName } });
        const e = (await tx.employment.create({ data: { tenantId: t, personId: p.id, companyId: ids.co!, registration, hiredAt: new Date('2025-01-01') } })).id;
        if (email) {
          const u = await tx.user.create({ data: { tenantId: t, email, displayName: fullName, passwordHash: hash, personId: p.id } });
          await tx.userRole.create({ data: { userId: u.id, roleId: await role('employee'), tenantId: t, scope: 'TENANT' } });
        }
        return e;
      };
      ids.ana = await mk('Ana Viva', '1', 'ana@tools-a.test');
      ids.beto = await mk('Beto Vivo', '2');
      ids.caio = await mk('Caio Vivo', '3');
      let n = 0;
      const punch = (e: string, d: string, h: string) => tx.timeRecord.create({ data: { tenantId: t, employmentId: e, recordedAt: at(d, h), source: 'DEVICE', hash: `t${++n}`, idempotencyKey: `tools-${n}` } });
      // Ana: entrou e saiu para o almoço. Beto: entrou. Caio: nada (atrasado às 09:00).
      for (const h of ['08:00', '12:00']) await punch(ids.ana, DAY, h);
      await punch(ids.beto, DAY, '08:02');
      // Março inteiro da Ana (para a ciência do espelho).
      for (const d of ['2026-03-03', '2026-03-04']) for (const h of ['08:00', '12:00', '13:00', '17:00']) await punch(ids.ana, d, h);
      await tx.device.create({ data: { tenantId: t, companyId: ids.co!, name: 'Relógio Portaria', ordinance: 'P671_2021', status: 'OFFLINE', lastSeenAt: at(DAY, '06:00') } });
    });
    tk.admin = (await api(app).post('/v1/auth/token').send({ email: 'admin@tools-a.test', password: PASSWORD }).expect(200)).body.accessToken;
    tk.other = (await api(app).post('/v1/auth/token').send({ email: 'admin@tools-b.test', password: PASSWORD }).expect(200)).body.accessToken;
    tk.ana = (await api(app).post('/v1/auth/token').send({ email: 'ana@tools-a.test', password: PASSWORD }).expect(200)).body.accessToken;
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => (d >= 1 && d <= 5 ? { dayIndex: d, isWorkday: true, startTime: '08:00', endTime: '17:00', breakMinutes: 60 } : { dayIndex: d, isWorkday: false }));
    const s = await api(app).post('/v1/work-schedules').set(as('admin')).send({ companyId: ids.co, name: 'Comercial', type: 'FIXED', days }).expect(201);
    await api(app).post('/v1/schedule-assignments').set(as('admin')).send({ employmentIds: [ids.ana, ids.beto, ids.caio], scheduleId: s.body.id, validFrom: '2026-01-01' }).expect(201);
  });

  afterAll(async () => {
    await app.close();
    await owner.$disconnect();
  });

  it('situação ao vivo (função pura)', () => {
    const exp = { isWorkday: true, start: '08:00', end: '17:00', breakMinutes: 60, scheduleName: 'X' };
    const day = (n: number) => ({ punches: Array.from({ length: n }, () => ({ status: 'ORIGINAL' })), expected: exp, leave: null, allowance: null });
    expect(liveState(day(0), 7 * 60, 10)).toBe('NOT_YET');
    expect(liveState(day(0), 8 * 60 + 5, 10)).toBe('NOT_YET');
    expect(liveState(day(0), 8 * 60 + 11, 10)).toBe('LATE_NOW');
    expect(liveState(day(0), 18 * 60, 10)).toBe('ABSENT');
    expect(liveState(day(1), 9 * 60, 10)).toBe('WORKING');
    expect(liveState(day(2), 12 * 60 + 30, 10)).toBe('ON_BREAK');
    expect(liveState(day(4), 17 * 60 + 5, 10)).toBe('LEFT');
    expect(liveState({ ...day(0), expected: { isWorkday: false, start: null, end: null } }, 9 * 60, 10)).toBe('OFF');
    expect(liveState({ ...day(0), leave: { id: 'x' } }, 9 * 60, 10)).toBe('LEAVE');
  });

  it('painel ao vivo: trabalhando, intervalo e atrasado agora', async () => {
    const live = await app.get(LiveService).live(ids['tools-a']!, { companyId: ids.co!, toleranceMinutes: 10 }, at(DAY, '12:30'));
    const by = Object.fromEntries(live.rows.map((r) => [r.registration, r]));
    expect(by['1']).toMatchObject({ state: 'ON_BREAK', lastPunch: '12:00' });
    expect(by['2']).toMatchObject({ state: 'WORKING' });
    expect(by['3']).toMatchObject({ state: 'LATE_NOW', expectedStart: '08:00', lateMinutes: 270 });
    expect(live.totals.LATE_NOW).toBe(1);
    // Rota HTTP: permissão e isolamento.
    await api(app).get(`/v1/live?companyId=${ids.co}`).set(as('admin')).expect(200);
    await api(app).get(`/v1/live?companyId=${ids.co}`).set(as('ana')).expect(403);
    expect((await api(app).get(`/v1/live?companyId=${ids.co}`).set(as('other')).expect(200)).body.rows).toHaveLength(0);
  });

  it('e-mail agendado: cria, prévia, envia agora e dispara no horário uma vez por dia', async () => {
    const bad = { companyId: ids.co, name: 'Resumo', kinds: ['ABSENCES'], time: '25:00', recipients: ['rh@tools-a.test'] };
    await api(app).post('/v1/notification-schedules').set(as('admin')).send(bad).expect(400);
    const n = await api(app).post('/v1/notification-schedules').set(as('admin')).send({ ...bad, time: '09:00', kinds: ['ABSENCES', 'LATE', 'DEVICES_OFFLINE', 'PENDING_REQUESTS'], weekdays: [1, 2, 3, 4, 5] }).expect(201);
    expect((await api(app).get('/v1/notification-schedules').set(as('admin')).expect(200)).body).toHaveLength(1);
    const pv = await api(app).get(`/v1/notification-schedules/${n.body.id}/preview`).set(as('admin')).expect(200);
    expect(pv.body.sections.map((s: { kind: string }) => s.kind)).toEqual(['ABSENCES', 'LATE', 'PENDING_REQUESTS', 'DEVICES_OFFLINE']);
    expect(pv.body.sections.find((s: { kind: string }) => s.kind === 'DEVICES_OFFLINE').lines[0]).toContain('Relógio Portaria');

    const svc = app.get(NotificationsService);
    const before = mail.outbox.length;
    // Terça 03/03 às 09:05: manda o resumo com as faltas de segunda (Caio faltou).
    expect(await svc.tick(at('2026-03-03', '09:05'))).toBe(1);
    const m = mail.outbox.at(-1)!;
    expect(m.to).toBe('rh@tools-a.test');
    expect(m.subject).toContain('Resumo');
    expect(m.text).toContain('Faltas de ontem (02/03/2026)');
    expect(m.text).toContain('3 — Caio Vivo');
    expect(m.html).not.toContain('<script');
    expect(await svc.tick(at('2026-03-03', '09:10'))).toBe(0); // já enviado hoje
    expect(await svc.tick(at('2026-03-07', '09:05'))).toBe(0); // sábado fora dos dias
    expect(await svc.tick(at('2026-03-09', '15:00'))).toBe(0); // fora da janela de 15 min
    expect(mail.outbox.length).toBe(before + 1);
    expect((await api(app).post(`/v1/notification-schedules/${n.body.id}/send`).set(as('admin')).expect(200)).body).toMatchObject({ sent: 1, recipients: 1 });
    await api(app).patch(`/v1/notification-schedules/${n.body.id}`).set(as('admin')).send({ active: false }).expect(200);
    await api(app).get(`/v1/notification-schedules/${n.body.id}/preview`).set(as('other')).expect(404);
    await api(app).post('/v1/notification-schedules').set(as('ana')).send({ ...bad, time: '09:00' }).expect(403);
    await api(app).delete(`/v1/notification-schedules/${n.body.id}`).set(as('admin')).expect(204);
  });

  it('avisos: vigência, público (empresa), ciência e leitura', async () => {
    const now = Date.now();
    const iso = (ms: number) => new Date(now + ms).toISOString();
    const geral = await api(app).post('/v1/announcements').set(as('admin')).send({ title: 'Feriado', body: 'Não haverá expediente.', level: 'IMPORTANT', startsAt: iso(-60_000), requireAck: true }).expect(201);
    await api(app).post('/v1/announcements').set(as('admin')).send({ title: 'Futuro', body: 'Ainda não', startsAt: iso(86_400_000) }).expect(201);
    await api(app).post('/v1/announcements').set(as('admin')).send({ title: 'Outra empresa', body: 'Só lá', companyId: ids.co2, startsAt: iso(-60_000) }).expect(201);
    await api(app).post('/v1/announcements').set(as('admin')).send({ title: 'Errado', body: 'x', startsAt: iso(0), endsAt: iso(-1000) }).expect(400);
    const act = await api(app).get('/v1/announcements/active').set(as('ana')).expect(200);
    expect(act.body.map((a: { title: string }) => a.title)).toEqual(['Feriado']);
    expect(act.body[0].readAt).toBeNull();
    await api(app).post(`/v1/announcements/${geral.body.id}/read`).set(as('ana')).expect(200);
    await api(app).post(`/v1/announcements/${geral.body.id}/read`).set(as('ana')).expect(200); // idempotente
    expect((await api(app).get('/v1/announcements/active').set(as('ana')).expect(200)).body[0].readAt).not.toBeNull();
    const list = await api(app).get('/v1/announcements').set(as('admin')).expect(200);
    expect(list.body.find((a: { id: string }) => a.id === geral.body.id).reads).toBe(1);
    expect((await api(app).get(`/v1/announcements/${geral.body.id}/reads`).set(as('admin')).expect(200)).body[0].user.email).toBe('ana@tools-a.test');
    await api(app).get('/v1/announcements').set(as('ana')).expect(403);
    await api(app).post(`/v1/announcements/${geral.body.id}/read`).set(as('other')).expect(404);
    await api(app).delete(`/v1/announcements/${geral.body.id}`).set(as('admin')).expect(204);
    expect((await api(app).get('/v1/announcements/active').set(as('ana')).expect(200)).body).toHaveLength(0);
  });

  it('aparelho do app: código por e-mail, tentativas, token único, uso na marcação e revogação', async () => {
    const r = await api(app).post('/v1/app-devices/request').set(as('ana')).send({ name: 'Celular da Ana' }).expect(201);
    expect(r.body).not.toHaveProperty('codeHash');
    const code = /\b(\d{6})\b/.exec(mail.outbox.filter((m) => m.to === 'ana@tools-a.test').at(-1)!.text)![1]!;
    const wrong = code === '000000' ? '111111' : '000000';
    await api(app).post(`/v1/app-devices/${r.body.id}/confirm`).set(as('ana')).send({ code: wrong }).expect(400);
    await api(app).post(`/v1/app-devices/${r.body.id}/confirm`).set(as('admin')).send({ code }).expect(404); // pedido de outro usuário
    const ok = await api(app).post(`/v1/app-devices/${r.body.id}/confirm`).set(as('ana')).send({ code }).expect(200);
    expect(ok.body.token).toMatch(/^spa_/);
    await api(app).post(`/v1/app-devices/${r.body.id}/confirm`).set(as('ana')).send({ code }).expect(409);
    const row = await owner.$transaction(async (tx) => { await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`; return tx.appDevice.findUniqueOrThrow({ where: { id: r.body.id } }); });
    expect(row.tokenHash).not.toContain('spa_');

    // Marcação web com o token do aparelho (e o rodapé personalizado no comprovante).
    await api(app).put('/v1/custom-texts/PUNCH_RECEIPT_FOOTER').set(as('admin')).send({ text: 'Guarde este comprovante.' }).expect(200);
    const ch = await api(app).post('/v1/punch/challenge').set(as('ana')).expect(200);
    const p = await api(app).post('/v1/punch').set(as('ana')).send({ token: ch.body.token, appDeviceToken: ok.body.token }).expect(201);
    expect(p.body).toMatchObject({ appDevice: 'Celular da Ana', footer: 'Guarde este comprovante.' });
    expect((await api(app).get('/v1/app-devices').set(as('admin')).expect(200)).body[0]).toMatchObject({ name: 'Celular da Ana', user: { email: 'ana@tools-a.test' } });
    await api(app).post(`/v1/app-devices/${r.body.id}/revoke`).set(as('admin')).expect(200);
    const ch2 = await api(app).post('/v1/punch/challenge').set(as('ana')).expect(200);
    await api(app).post('/v1/punch').set(as('ana')).send({ token: ch2.body.token, appDeviceToken: ok.body.token }).expect(403);
    await api(app).get('/v1/app-devices').set(as('ana')).expect(403);
  });

  it('textos personalizados: lista fixa, salva, apaga e só quem configura edita', async () => {
    const all = await api(app).get('/v1/custom-texts').set(as('ana')).expect(200);
    expect(all.body.map((t: { key: string }) => t.key)).toEqual(['DASHBOARD_MESSAGE', 'PUNCH_RECEIPT_FOOTER', 'MIRROR_FOOTER', 'MIRROR_ACK_TERM']);
    await api(app).put('/v1/custom-texts/DASHBOARD_MESSAGE').set(as('ana')).send({ text: 'x' }).expect(403);
    await api(app).put('/v1/custom-texts/NAO_EXISTE').set(as('admin')).send({ text: 'x' }).expect(404);
    await api(app).put('/v1/custom-texts/DASHBOARD_MESSAGE').set(as('admin')).send({ text: 'Bem-vindos!' }).expect(200);
    expect((await api(app).get('/v1/custom-texts').set(as('ana')).expect(200)).body[0].text).toBe('Bem-vindos!');
    await api(app).put('/v1/custom-texts/DASHBOARD_MESSAGE').set(as('admin')).send({ text: '' }).expect(200);
    expect((await api(app).get('/v1/custom-texts').set(as('other')).expect(200)).body[0].text).toBe('');
  });

  it('ciência do espelho: só período encerrado, uma vez, imutável e detecta alteração posterior', async () => {
    const q = 'from=2026-03-01&to=2026-03-31';
    const st = await api(app).get(`/v1/timesheet/me/ack?${q}`).set(as('ana')).expect(200);
    expect(st.body).toMatchObject({ canSign: true, acknowledgment: null });
    await api(app).post('/v1/timesheet/me/ack').set(as('ana')).send({ from: '2026-03-01', to: '2099-03-31' }).expect(400);
    await api(app).post('/v1/timesheet/me/ack').set(as('ana')).send({ from: '2026-03-01', to: '2026-03-31', decision: 'DISAGREE' }).expect(400); // ressalva sem explicação
    const a = await api(app).post('/v1/timesheet/me/ack').set(as('ana')).send({ from: '2026-03-01', to: '2026-03-31', decision: 'DISAGREE', comment: 'Faltou a marcação do dia 05' }).expect(201);
    expect(a.body.contentHash).toBe(st.body.currentHash);
    await api(app).post('/v1/timesheet/me/ack').set(as('ana')).send({ from: '2026-03-01', to: '2026-03-31' }).expect(409);
    const list = await api(app).get(`/v1/mirror-acks?companyId=${ids.co}&${q}`).set(as('admin')).expect(200);
    expect(list.body.totals).toEqual({ agree: 0, disagree: 1, pending: 2 });
    expect(list.body.rows.find((r: { registration: string }) => r.registration === '1')).toMatchObject({ status: 'DISAGREE', changedSince: false });
    // Ajuste depois da ciência: o RH vê que o espelho mudou.
    const adj = await api(app).post('/v1/time-adjustments').set(as('admin')).send({ employmentId: ids.ana, kind: 'INCLUDE', date: '2026-03-05', time: '08:00', justification: 'Esqueceu de marcar' }).expect(201);
    if (adj.body.status === 'PENDING') await api(app).post(`/v1/time-adjustments/${adj.body.id}/decide`).set(as('admin')).send({ approve: true }).expect(200);
    expect((await api(app).get(`/v1/timesheet/me/ack?${q}`).set(as('ana')).expect(200)).body.acknowledgment.changedSince).toBe(true);
    // Imutável no banco.
    await expect(owner.$executeRawUnsafe(`UPDATE superponto.mirror_acknowledgments SET decision = 'AGREE' WHERE id = '${a.body.id}'`)).rejects.toThrow();
    await api(app).get(`/v1/mirror-acks?companyId=${ids.co}&${q}`).set(as('ana')).expect(403);
  });
});
