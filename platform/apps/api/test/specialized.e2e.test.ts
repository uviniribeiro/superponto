// Módulos especializados: plantões (saúde), turmas/grade/aulas (educação) e ocorrências (operacional).
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
const as = (w: string) => ({ Authorization: `Bearer ${tk[w]}` });
const at = (d: string, h: string) => new Date(`${d}T${h}:00-03:00`).toISOString();

describe('Módulos especializados', () => {
  beforeAll(async () => {
    ({ app } = await createApp());
    const hash = await new PasswordHasher().hash(PASSWORD);
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const role = async (key: string) => (await tx.role.findFirstOrThrow({ where: { tenantId: null, key } })).id;
      for (const slug of ['esp-a', 'esp-b']) {
        const t = await tx.tenant.create({ data: { name: slug, slug } });
        ids[slug] = t.id;
        const u = await tx.user.create({ data: { tenantId: t.id, email: `admin@${slug}.test`, displayName: 'Admin', passwordHash: hash } });
        await tx.userRole.create({ data: { userId: u.id, roleId: await role('company_admin'), tenantId: t.id, scope: 'TENANT' } });
      }
      const t = ids['esp-a']!;
      const emp = await tx.user.create({ data: { tenantId: t, email: 'func@esp-a.test', displayName: 'Func', passwordHash: hash } });
      await tx.userRole.create({ data: { userId: emp.id, roleId: await role('employee'), tenantId: t, scope: 'TENANT' } });
      ids.co = (await tx.company.create({ data: { tenantId: t, legalName: 'Hospital Escola Ltda' } })).id;
      ids.unit = (await tx.companyUnit.create({ data: { tenantId: t, companyId: ids.co!, name: 'Pronto-socorro' } })).id;
      for (const n of ['1', '2', '3']) {
        const p = await tx.person.create({ data: { tenantId: t, fullName: `Profissional ${n}` } });
        ids[`e${n}`] = (await tx.employment.create({ data: { tenantId: t, personId: p.id, companyId: ids.co!, registration: n, hiredAt: new Date('2025-01-01'), unitId: ids.unit } })).id;
      }
    });
    for (const w of ['admin@esp-a', 'admin@esp-b', 'func@esp-a']) tk[w.replace('@esp-', '-')] = (await api(app).post('/v1/auth/token').send({ email: `${w}.test`, password: PASSWORD }).expect(200)).body.accessToken;
  });
  afterAll(async () => { await app.close(); await owner.$disconnect(); });

  it('saúde: plantões em série, cobertura, conflito de horário e troca aprovada', async () => {
    await api(app).post('/v1/health/shifts').set(as('admin-a')).send({ unitId: ids.unit, kind: 'NIGHT', startsAt: at('2026-12-01', '19:00'), endsAt: at('2026-12-01', '07:00'), requiredProfessionals: 2 }).expect(400);
    const c = await api(app).post('/v1/health/shifts').set(as('admin-a')).send({ unitId: ids.unit, kind: 'NIGHT', startsAt: at('2026-12-01', '19:00'), endsAt: at('2026-12-02', '07:00'), requiredProfessionals: 2, repeatDays: 2 }).expect(201);
    expect(c.body.created).toBe(3);
    const [s1, s2] = c.body.ids;
    await api(app).post(`/v1/health/shifts/${s1}/assign`).set(as('admin-a')).send({ employmentId: ids.e1 }).expect(201);
    await api(app).post(`/v1/health/shifts/${s1}/assign`).set(as('admin-a')).send({ employmentId: ids.e1 }).expect(409);
    // Plantão sobreposto do mesmo profissional.
    const extra = (await api(app).post('/v1/health/shifts').set(as('admin-a')).send({ unitId: ids.unit, kind: 'EXTRA', startsAt: at('2026-12-02', '06:00'), endsAt: at('2026-12-02', '12:00') }).expect(201)).body.ids[0];
    expect((await api(app).post(`/v1/health/shifts/${extra}/assign`).set(as('admin-a')).send({ employmentId: ids.e1 }).expect(409)).body.message).toMatch(/outro plantão/);
    let list = (await api(app).get(`/v1/health/shifts?unitId=${ids.unit}&from=2026-12-01&to=2026-12-03`).set(as('admin-a')).expect(200)).body;
    const first = list.find((x: { id: string }) => x.id === s1);
    expect(first).toMatchObject({ requiredProfessionals: 2, covered: 1, missing: 1 });
    // Troca: e1 → e2, aprovada.
    const sub = await api(app).post(`/v1/health/assignments/${first.assignments[0].id}/substitution`).set(as('admin-a')).send({ substituteEmploymentId: ids.e2, reason: 'Congresso médico' }).expect(201);
    await api(app).post(`/v1/health/substitutions/${sub.body.id}/decide`).set(as('admin-a')).send({ approve: true }).expect(200);
    list = (await api(app).get(`/v1/health/shifts?unitId=${ids.unit}&from=2026-12-01&to=2026-12-01`).set(as('admin-a')).expect(200)).body;
    expect(list.find((x: { id: string }) => x.id === s1).assignments.map((a: { registration: string; status: string }) => `${a.registration}:${a.status}`).sort()).toEqual(['1:SUBSTITUTED', '2:SCHEDULED']);
    await api(app).post(`/v1/health/shifts/${s2}/assign`).set(as('admin-a')).send({ employmentId: ids.e3 }).expect(201);
    await api(app).get(`/v1/health/shifts?from=2026-12-01&to=2026-12-03`).set(as('admin-b')).expect(200).then((r) => expect(r.body).toHaveLength(0));
    await api(app).post('/v1/health/shifts').set(as('func-a')).send({}).expect(403);
  });

  it('educação: período, turma, alocação, grade sem conflito, aulas do dia e resumo', async () => {
    const course = (await api(app).post('/v1/education/courses').set(as('admin-a')).send({ companyId: ids.co, name: 'Ensino Médio' }).expect(201)).body;
    const math = (await api(app).post('/v1/education/subjects').set(as('admin-a')).send({ companyId: ids.co, courseId: course.id, name: 'Matemática', weeklyLessons: 4 }).expect(201)).body;
    const bio = (await api(app).post('/v1/education/subjects').set(as('admin-a')).send({ companyId: ids.co, name: 'Biologia' }).expect(201)).body;
    const period = (await api(app).post('/v1/education/periods').set(as('admin-a')).send({ companyId: ids.co, name: '2026', startsOn: '2026-02-01', endsOn: '2026-12-15' }).expect(201)).body;
    const k1 = (await api(app).post('/v1/education/classes').set(as('admin-a')).send({ unitId: ids.unit, periodId: period.id, courseId: course.id, name: '1º A', shift: 'MANHA' }).expect(201)).body;
    const k2 = (await api(app).post('/v1/education/classes').set(as('admin-a')).send({ unitId: ids.unit, periodId: period.id, name: '1º B' }).expect(201)).body;
    const a1 = (await api(app).post('/v1/education/assignments').set(as('admin-a')).send({ employmentId: ids.e1, subjectId: math.id, classId: k1.id, validFrom: '2026-02-01' }).expect(201)).body;
    await api(app).post('/v1/education/assignments').set(as('admin-a')).send({ employmentId: ids.e2, subjectId: math.id, classId: k1.id, validFrom: '2026-02-01' }).expect(409);
    const a2 = (await api(app).post('/v1/education/assignments').set(as('admin-a')).send({ employmentId: ids.e1, subjectId: bio.id, classId: k2.id, validFrom: '2026-02-01' }).expect(201)).body;
    // Terça (2): 07:30–08:20 no 1º A; conflito no 1º B no mesmo horário.
    const slot = (await api(app).post('/v1/education/slots').set(as('admin-a')).send({ assignmentId: a1.id, weekday: 2, startTime: '07:30', endTime: '08:20' }).expect(201)).body;
    expect((await api(app).post('/v1/education/slots').set(as('admin-a')).send({ assignmentId: a2.id, weekday: 2, startTime: '08:00', endTime: '08:50' }).expect(409)).body.message).toMatch(/1º A/);
    await api(app).post('/v1/education/slots').set(as('admin-a')).send({ assignmentId: a2.id, weekday: 2, startTime: '08:20', endTime: '09:10' }).expect(201);
    const ov = (await api(app).get(`/v1/education?companyId=${ids.co}`).set(as('admin-a')).expect(200)).body;
    expect(ov.classes.find((c: { name: string }) => c.name === '1º A').assignments[0]).toMatchObject({ teacher: 'Profissional 1', subject: 'Matemática', weeklyLessons: 4 });
    const day = (await api(app).get(`/v1/education/day?companyId=${ids.co}&date=2026-12-01`).set(as('admin-a')).expect(200)).body; // terça
    expect(day.map((d: { startTime: string; className: string; status: string }) => `${d.startTime} ${d.className} ${d.status}`)).toEqual(['07:30 1º A SCHEDULED', '08:20 1º B SCHEDULED']);
    await api(app).post('/v1/education/sessions').set(as('admin-a')).send({ scheduleId: slot.id, date: '2026-12-02', status: 'HELD' }).expect(400); // quarta
    await api(app).post('/v1/education/sessions').set(as('admin-a')).send({ scheduleId: slot.id, date: '2026-12-01', status: 'SUBSTITUTED' }).expect(400);
    await api(app).post('/v1/education/sessions').set(as('admin-a')).send({ scheduleId: slot.id, date: '2026-12-01', status: 'SUBSTITUTED', substituteEmploymentId: ids.e3 }).expect(200);
    await api(app).post('/v1/education/sessions').set(as('admin-a')).send({ scheduleId: day[1].scheduleId, date: '2026-12-01', status: 'HELD' }).expect(200);
    const sum = (await api(app).get(`/v1/education/summary?companyId=${ids.co}&from=2026-12-01&to=2026-12-31`).set(as('admin-a')).expect(200)).body;
    expect(sum).toEqual([
      { teacher: 'Profissional 1', registration: '1', held: 1, notHeld: 0, substitutedOut: 1, substitutedIn: 0, minutes: 50 },
      { teacher: 'Profissional 3', registration: '3', held: 0, notHeld: 0, substitutedOut: 0, substitutedIn: 1, minutes: 50 },
    ]);
    await api(app).delete(`/v1/education/slots/${slot.id}`).set(as('admin-a')).expect(409);
    await api(app).get(`/v1/education?companyId=${ids.co}`).set(as('admin-b')).expect(404);
  });

  it('operacional: ocorrência com histórico, tratamento e geração a partir do espelho diário', async () => {
    const o = (await api(app).post('/v1/operational/occurrences').set(as('admin-a')).send({ unitId: ids.unit, type: 'EQUIPMENT_UNAVAILABLE', title: 'Relógio da portaria sem energia', occurredAt: at('2026-12-01', '08:10') }).expect(201)).body;
    await api(app).post(`/v1/operational/occurrences/${o.id}/actions`).set(as('admin-a')).send({ action: 'RESOLVE' }).expect(400);
    await api(app).post(`/v1/operational/occurrences/${o.id}/actions`).set(as('admin-a')).send({ action: 'START', responsibleId: ids.e2 }).expect(201);
    await api(app).post(`/v1/operational/occurrences/${o.id}/actions`).set(as('admin-a')).send({ action: 'RESOLVE', notes: 'Disjuntor religado' }).expect(201);
    expect((await api(app).get('/v1/operational/occurrences').set(as('admin-a')).expect(200)).body).toHaveLength(0); // ativas
    const done = (await api(app).get('/v1/operational/occurrences?status=RESOLVED').set(as('admin-a')).expect(200)).body[0];
    expect(done).toMatchObject({ status: 'RESOLVED', responsible: '2 — Profissional 2' });
    expect(done.events.map((e: { action: string }) => e.action)).toEqual(['CREATE', 'START', 'RESOLVE']);
    // Gera do espelho diário: com jornada de segunda a sexta e sem marcação, os três faltaram.
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => (d >= 1 && d <= 5 ? { dayIndex: d, isWorkday: true, startTime: '08:00', endTime: '17:00', breakMinutes: 60 } : { dayIndex: d, isWorkday: false }));
    const s = await api(app).post('/v1/work-schedules').set(as('admin-a')).send({ companyId: ids.co, name: 'Comercial', type: 'FIXED', days }).expect(201);
    await api(app).post('/v1/schedule-assignments').set(as('admin-a')).send({ employmentIds: [ids.e1, ids.e2, ids.e3], scheduleId: s.body.id, validFrom: '2026-01-01' }).expect(201);
    expect((await api(app).post('/v1/operational/occurrences/generate').set(as('admin-a')).send({ companyId: ids.co, date: '2026-03-02' }).expect(201)).body).toEqual({ created: 3, skipped: 0, noUnit: 0 });
    expect((await api(app).post('/v1/operational/occurrences/generate').set(as('admin-a')).send({ companyId: ids.co, date: '2026-03-02' }).expect(201)).body).toEqual({ created: 0, skipped: 3, noUnit: 0 });
    expect((await api(app).get('/v1/operational/occurrences?type=ABSENCE').set(as('admin-a')).expect(200)).body).toHaveLength(3);
    expect((await api(app).get('/v1/operational/occurrences').set(as('admin-b')).expect(200)).body).toHaveLength(0);
  });
});
