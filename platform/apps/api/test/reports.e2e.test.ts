// Fase 7: relatórios com filtros padronizados, montador por campos e exportação CSV/XLSX.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, createApp, ownerUrl } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
const tk: Record<string, string> = {};
const ids: Record<string, string> = {};
const as = (who: string) => ({ Authorization: `Bearer ${tk[who]}` });
const at = (date: string, hm: string) => new Date(`${date}T${hm}:00-03:00`);
const run = (key: string, body: Record<string, unknown>, who = 'admin') => api(app).post(`/v1/reports/${key}/run`).set(as(who)).send({ companyId: ids.co, ...body });
const P = { from: '2026-03-02', to: '2026-03-06' };

describe('Relatórios', () => {
  beforeAll(async () => {
    ({ app } = await createApp());
    const hash = await new PasswordHasher().hash(PASSWORD);
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const role = async (key: string) => (await tx.role.findFirstOrThrow({ where: { tenantId: null, key } })).id;
      for (const slug of ['rel-a', 'rel-b']) {
        const t = await tx.tenant.create({ data: { name: slug, slug } });
        ids[slug] = t.id;
        const u = await tx.user.create({ data: { tenantId: t.id, email: `admin@${slug}.test`, displayName: 'Admin', passwordHash: hash } });
        await tx.userRole.create({ data: { userId: u.id, roleId: await role('company_admin'), tenantId: t.id, scope: 'TENANT' } });
      }
      const t = ids['rel-a']!;
      const emp = await tx.user.create({ data: { tenantId: t, email: 'func@rel-a.test', displayName: 'Func', passwordHash: hash } });
      await tx.userRole.create({ data: { userId: emp.id, roleId: await role('employee'), tenantId: t, scope: 'TENANT' } });
      ids.co = (await tx.company.create({ data: { tenantId: t, legalName: 'Relatórios Ltda' } })).id;
      const dep = await tx.department.create({ data: { tenantId: t, companyId: ids.co!, name: 'Enfermagem' } });
      const sub = await tx.department.create({ data: { tenantId: t, companyId: ids.co!, name: 'UTI', parentId: dep.id } });
      ids.dep = dep.id;
      const mk = async (fullName: string, registration: string, departmentId: string, birth: string) => {
        const p = await tx.person.create({ data: { tenantId: t, fullName, cpf: null, birthDate: new Date(birth) } });
        return (await tx.employment.create({ data: { tenantId: t, personId: p.id, companyId: ids.co!, registration, hiredAt: new Date('2025-01-01'), departmentId } })).id;
      };
      ids.ana = await mk('Ana Relatório', '1', sub.id, '1990-03-10');
      ids.beto = await mk('Beto Relatório', '2', dep.id, '1985-07-20');
      let n = 0;
      const punch = (e: string, d: string, h: string) => tx.timeRecord.create({ data: { tenantId: t, employmentId: e, recordedAt: at(d, h), source: d === '2026-03-02' ? 'WEB' : 'DEVICE', hash: `r${++n}`, idempotencyKey: `rel-${n}`, ...(d === '2026-03-02' ? { latitude: -19.9, longitude: -43.9 } : {}) } });
      // Ana: seg ok, ter +2h, qua atraso 30, qui falta, sex ímpar. Beto: só segunda.
      for (const h of ['08:00', '12:00', '13:00', '17:00']) await punch(ids.ana, '2026-03-02', h);
      for (const h of ['08:00', '12:00', '12:30', '19:00']) await punch(ids.ana, '2026-03-03', h); // intervalo de 30 min
      for (const h of ['08:30', '12:00', '13:00', '17:00']) await punch(ids.ana, '2026-03-04', h);
      for (const h of ['08:00', '12:00', '13:00']) await punch(ids.ana, '2026-03-06', h);
      for (const h of ['08:00', '12:00', '13:00', '17:00']) await punch(ids.beto, '2026-03-02', h);
    });
    tk.admin = (await api(app).post('/v1/auth/token').send({ email: 'admin@rel-a.test', password: PASSWORD }).expect(200)).body.accessToken;
    tk.other = (await api(app).post('/v1/auth/token').send({ email: 'admin@rel-b.test', password: PASSWORD }).expect(200)).body.accessToken;
    tk.func = (await api(app).post('/v1/auth/token').send({ email: 'func@rel-a.test', password: PASSWORD }).expect(200)).body.accessToken;
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => (d >= 1 && d <= 5 ? { dayIndex: d, isWorkday: true, startTime: '08:00', endTime: '17:00', breakMinutes: 60 } : { dayIndex: d, isWorkday: false }));
    const s = await api(app).post('/v1/work-schedules').set(as('admin')).send({ companyId: ids.co, name: 'Comercial', type: 'FIXED', days }).expect(201);
    await api(app).post('/v1/schedule-assignments').set(as('admin')).send({ employmentIds: [ids.ana, ids.beto], scheduleId: s.body.id, validFrom: '2026-03-01' }).expect(201);
  });

  afterAll(async () => {
    await app.close();
    await owner.$disconnect();
  });

  it('catálogo: relatórios por categoria, conforme a permissão, e campos do montador', async () => {
    const c = await api(app).get('/v1/reports').set(as('admin')).expect(200);
    expect(c.body.reports.length).toBeGreaterThanOrEqual(28);
    expect(new Set(c.body.reports.map((r: { category: string }) => r.category))).toEqual(new Set(['Ponto', 'Movimentações', 'Bancos', 'Cadastros', 'Equipamentos e marcações', 'Saúde', 'Educação', 'Operacional', 'Segurança']));
    expect(c.body.builderFields.map((f: { key: string }) => f.key)).toContain('worked');
    await api(app).get('/v1/reports').set(as('func')).expect(403);
  });

  it('horas trabalhadas: totais por funcionário e linha de total', async () => {
    const r = await run('horas-trabalhadas', P).expect(200);
    const ana = r.body.rows.find((x: { registration: string }) => x.registration === '1');
    expect(ana).toMatchObject({ expected: 2400, absences: 1, late: 30, department: 'UTI' });
    expect(ana.overtime).toBe(180); // terça: +2h30 de jornada + 30 min de intervalo suprimido (CLT art. 71 §4º)
    expect(r.body.totals.expected).toBe(4800);
  });

  it('filtro por departamento inclui subdepartamentos (ou não)', async () => {
    expect((await run('horas-trabalhadas', { ...P, departmentId: ids.dep }).expect(200)).body.rows).toHaveLength(2);
    expect((await run('horas-trabalhadas', { ...P, departmentId: ids.dep, includeSubdepartments: false }).expect(200)).body.rows.map((x: { name: string }) => x.name)).toEqual(['Beto Relatório']);
  });

  it('analíticos: faltas, atrasos, marcação ímpar, déficit de intervalo e extras', async () => {
    expect((await run('faltas', P).expect(200)).body.rows.filter((x: { registration: string }) => x.registration === '1').map((x: { date: string }) => x.date)).toEqual(['2026-03-05']);
    expect((await run('atrasos', P).expect(200)).body.rows[0]).toMatchObject({ date: '2026-03-04', late: 30 });
    expect((await run('marcacao-incompleta', P).expect(200)).body.rows[0]).toMatchObject({ date: '2026-03-06', punches: '08:00 12:00 13:00' });
    expect((await run('deficit-intervalo', P).expect(200)).body.rows[0]).toMatchObject({ date: '2026-03-03', break: 30, shortfall: 30 });
    const ex = await run('extras', P).expect(200);
    expect(ex.body.rows[0]).toMatchObject({ date: '2026-03-03', kind: 'Útil' });
  });

  it('folha de conferência traz colunas de extra por percentual', async () => {
    const r = await run('folha-conferencia', P).expect(200);
    expect(r.body.columns.map((c: { key: string }) => c.key)).toEqual(expect.arrayContaining(['normal', 'ot50', 'night', 'absence']));
  });

  it('frequência, absenteísmo, cartão ponto, marcações web e aniversariantes', async () => {
    const f = (await run('frequencia', P).expect(200)).body.rows.find((x: { registration: string }) => x.registration === '2');
    expect(f).toMatchObject({ workdays: 5, present: 1, absent: 4 });
    expect(f.rate).toBeCloseTo(0.2);
    expect((await run('absenteismo', P).expect(200)).body.rows.find((x: { registration: string }) => x.registration === '2').rate).toBeCloseTo(0.8);
    expect((await run('cartao-ponto', P).expect(200)).body.rows).toHaveLength(10);
    const web = (await run('marcacao-web', P).expect(200)).body.rows;
    expect(web).toHaveLength(8);
    expect(web[0].location).toBe('-19.90000, -43.90000');
    expect((await run('aniversariantes', { from: '2026-03-01', to: '2026-03-31' }).expect(200)).body.rows.map((x: { name: string }) => x.name)).toEqual(['Ana Relatório']);
  });

  it('montador: escolhe os campos de cada dia', async () => {
    const r = await run('customizado', { ...P, fields: ['name', 'date', 'worked', 'flags'] }).expect(200);
    expect(r.body.columns.map((c: { label: string }) => c.label)).toEqual(['Funcionário', 'Data', 'Trabalhado', 'Ocorrências']);
    expect(r.body.rows).toHaveLength(10);
    await run('customizado', { ...P, fields: [] }).expect(400);
  });

  it('validações: período obrigatório e até 93 dias; relatório inexistente', async () => {
    await run('horas-trabalhadas', {}).expect(400);
    await run('horas-trabalhadas', { from: '2026-01-01', to: '2026-06-30' }).expect(400);
    await run('nao-existe', P).expect(404);
    expect((await run('funcionarios', {}).expect(200)).body.rows).toHaveLength(2); // cadastro não exige período
  });

  it('exportação CSV (ponto e vírgula, com BOM) e XLSX', async () => {
    const csv = await api(app).post('/v1/reports/horas-trabalhadas/export?format=csv').set(as('admin')).send({ companyId: ids.co, ...P }).expect(200);
    const text = Buffer.from(csv.body.base64, 'base64').toString('utf8');
    expect(text.startsWith('﻿Matrícula;Funcionário;Departamento;Previsto')).toBe(true);
    expect(text).toContain('Total;');
    expect(text).toMatch(/1;Ana Relatório;UTI;40:00;/);
    const x = await api(app).post('/v1/reports/horas-trabalhadas/export?format=xlsx').set(as('admin')).send({ companyId: ids.co, ...P }).expect(200);
    expect(x.body.filename).toBe('horas-trabalhadas_2026-03-02_2026-03-06.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(x.body.base64, 'base64') as never);
    const ws = wb.worksheets[0]!;
    expect(ws.getRow(4).getCell(1).value).toBe('Matrícula');
    expect(ws.getRow(5).getCell(2).value).toBe('Ana Relatório');
  });

  it('fase 7 final: divergências, intervalo não calculável, espelho 1510 e ciência', async () => {
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      for (const [h, n] of [['08:00', 1], ['12:00', 2]] as const) await tx.timeRecord.create({ data: { tenantId: ids['rel-a']!, employmentId: ids.beto!, recordedAt: at('2026-03-07', h), source: 'DEVICE', hash: `sab${n}`, idempotencyKey: `rel-sab-${n}` } });
    });
    const div = (await run('divergencias', { from: '2026-03-02', to: '2026-03-07' }).expect(200)).body.rows;
    expect(div).toEqual([expect.objectContaining({ registration: '2', date: '2026-03-07', issue: 'Trabalhou na folga', punches: '08:00 12:00' })]);
    const inc = (await run('intervalo-nao-calculavel', P).expect(200)).body.rows;
    expect(inc).toEqual([expect.objectContaining({ registration: '1', date: '2026-03-06', breakExpected: 60, reason: 'Número ímpar de marcações' })]);
    const e1510 = await run('espelho-1510', P).expect(200);
    expect(e1510.body.columns[0]).toMatchObject({ key: 'pis', label: 'PIS' });
    expect(e1510.body.rows.find((r: { name: string; date: string }) => r.name === 'Ana Relatório' && r.date === '2026-03-02')).toMatchObject({ contract: '08:00–17:00 (intervalo 60 min)', punches: '08:00 12:00 13:00 17:00', hiredAt: '2025-01-01' });
    const ack = (await run('ciencia-espelho', { from: '2026-03-01', to: '2026-03-31' }).expect(200)).body.rows;
    expect(ack.map((r: { status: string }) => r.status)).toEqual(['Pendente', 'Pendente']);
  });

  it('segurança: acessos com falha, alteração de senha, funcionalidades por perfil e log do espelho', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    await api(app).post('/v1/auth/token').send({ email: 'func@rel-a.test', password: 'errada-errada' }).expect(401);
    await api(app).post('/v1/auth/token').send({ email: 'ninguem@rel-a.test', password: 'errada-errada' }).expect(401); // conta inexistente: nada é gravado
    await api(app).post('/v1/auth/password/change').set(as('func')).send({ currentPassword: PASSWORD, newPassword: 'Outra-Senha-Forte-2026' }).expect(204);
    const acc = (await run('acessos', { from: today, to: today }).expect(200)).body.rows;
    expect(acc.filter((r: { email: string; result: string }) => r.email === 'func@rel-a.test' && r.result === 'Senha incorreta')).toHaveLength(1);
    expect(acc.some((r: { email: string; result: string }) => r.email === 'admin@rel-a.test' && r.result === 'Entrou')).toBe(true);
    expect(acc.some((r: { email: string }) => r.email.endsWith('@rel-b.test'))).toBe(false); // só o próprio cliente
    const pw = (await run('alteracoes-senha', { from: today, to: today }).expect(200)).body.rows;
    expect(pw).toEqual([expect.objectContaining({ email: 'func@rel-a.test', via: 'Troca pelo usuário' })]);
    const roles = (await run('funcionalidades-perfil', {}).expect(200)).body.rows;
    expect(roles).toContainEqual(expect.objectContaining({ role: 'Funcionário', kind: 'Do sistema', module: 'Ponto', description: 'Registrar marcação própria' }));
    expect(roles.some((r: { role: string }) => r.role === 'SuperAdministrador')).toBe(false);
    // Log do espelho: o ajuste lançado hoje aparece para a Ana.
    await api(app).post('/v1/time-adjustments').set(as('admin')).send({ employmentId: ids.ana, kind: 'INCLUDE', date: '2026-03-06', time: '17:00', justification: 'Esqueceu a saída' }).expect(201);
    const log = (await run('log-espelho', { from: today, to: today }).expect(200)).body.rows;
    expect(log).toContainEqual(expect.objectContaining({ registration: '1', entity: 'Ajuste de marcação', user: 'Admin' }));
    await run('log-espelho', { from: today, to: today }, 'func').expect(403);
  });

  it('isolamento: outro cliente não roda relatório desta empresa', async () => {
    await api(app).post('/v1/reports/horas-trabalhadas/run').set(as('other')).send({ companyId: ids.co, ...P }).expect(404);
  });
});
