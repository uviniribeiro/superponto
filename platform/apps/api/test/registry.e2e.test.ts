// Fase 6: cadastro de equipamentos, comandos e grupos, protocolo do agente local, funcionários no
// relógio × cadastro, alertas de comunicação, estatísticas, exportação dos registros e AEJ.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DeviceMonitor } from '../src/devices/registry.js';
import type { MailService } from '../src/mail/mail.service.js';
import { api, COMM_TOKEN, createApp, hook, ownerUrl } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
let mail: MailService;
const tk: Record<string, string> = {};
const ids: Record<string, string> = {};
let key = '';
const as = (who: string) => ({ Authorization: `Bearer ${tk[who]}` });
const agent = () => ({ 'X-Device-Key': key, 'X-Comm-Token': COMM_TOKEN });
const L = (v: string | number, n: number) => String(v).padStart(n, '0').slice(-n);
const R = (v: string, n: number) => v.padEnd(n, ' ').slice(0, n);
const MARIA = { cpf: '52998224725', pis: '12056462127' };

function afd671(cnpj: string) {
  return [
    L(0, 9) + '1' + '1' + R(cnpj, 14) + R('', 14) + R('CLINICA DV', 150) + R('00004000020000123', 17) + '2026-03-01' + '2026-03-31' + '2026-04-01T08:00:00-0300' + '003' + '1' + '11222333000181' + R('MODELO X', 30) + 'ABCD',
    L(21, 9) + '7' + '2026-03-02T08:00:00-0300' + L(MARIA.cpf, 12) + '2026-03-02T08:00:02-0300' + '01' + '0' + 'a'.repeat(64),
    L(22, 9) + '7' + '2026-03-02T17:00:00-0300' + L(MARIA.cpf, 12) + '2026-03-02T17:00:02-0300' + '01' + '0' + 'c'.repeat(64),
  ].join('\n');
}

describe('Equipamentos: cadastro, agente local, alertas, AFD e AEJ', () => {
  beforeAll(async () => {
    ({ app, mail } = await createApp());
    const hash = await new PasswordHasher().hash(PASSWORD);
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const role = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'company_admin' } });
      for (const slug of ['dv-a', 'dv-b']) {
        const t = await tx.tenant.create({ data: { name: slug, slug } });
        ids[slug] = t.id;
        const u = await tx.user.create({ data: { tenantId: t.id, email: `admin@${slug}.test`, displayName: 'Admin', passwordHash: hash } });
        await tx.userRole.create({ data: { userId: u.id, roleId: role.id, tenantId: t.id, scope: 'TENANT' } });
      }
      const t = ids['dv-a']!;
      ids.co = (await tx.company.create({ data: { tenantId: t, legalName: 'Clínica DV Ltda', cnpj: '11222333000181' } })).id;
      const p = await tx.person.create({ data: { tenantId: t, fullName: 'Maria Relógio', cpf: MARIA.cpf, pis: MARIA.pis } });
      ids.maria = (await tx.employment.create({ data: { tenantId: t, personId: p.id, companyId: ids.co!, registration: '1001', hiredAt: new Date('2026-01-01') } })).id;
    });
    tk.admin = (await api(app).post('/v1/auth/token').send({ email: 'admin@dv-a.test', password: PASSWORD }).expect(200)).body.accessToken;
    tk.other = (await api(app).post('/v1/auth/token').send({ email: 'admin@dv-b.test', password: PASSWORD }).expect(200)).body.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await owner.$disconnect();
  });

  it('cadastro: valida o número do REP, grupo, coleta e e-mails de alerta', async () => {
    const base = { companyId: ids.co, name: 'REP Portaria', ordinance: 'P671_2021', serialNumber: 'SN-001', groupName: 'Portaria', collectIntervalMinutes: 10, alertEmails: ['ti@clinica.test'] };
    await api(app).post('/v1/devices').set(as('admin')).send({ ...base, repNumber: '123' }).expect(400);
    await api(app).post('/v1/devices').set(as('admin')).send({ ...base, collectIntervalMinutes: 1 }).expect(400);
    const d = await api(app).post('/v1/devices').set(as('admin')).send({ ...base, repNumber: '00004000020000123' }).expect(201);
    expect(d.body).toMatchObject({ status: 'PENDING', hasAgentKey: false, groupName: 'Portaria' });
    expect(d.body.agentKeyHash).toBeUndefined();
    ids.dev = d.body.id;
    await api(app).post('/v1/devices').set(as('admin')).send(base).expect(409); // mesmo número de série
    ids.dev2 = (await api(app).post('/v1/devices').set(as('admin')).send({ ...base, name: 'REP Bloco B', serialNumber: 'SN-002' }).expect(201)).body.id;
    const list = await api(app).get(`/v1/devices?companyId=${ids.co}&groupName=Portaria`).set(as('admin')).expect(200);
    expect(list.body).toHaveLength(2);
    await api(app).get(`/v1/devices/${ids.dev}`).set(as('other')).expect(404);
  });

  it('agente: sem chave é recusado; com a chave, o contato deixa o equipamento online', async () => {
    await api(app).post('/v1/agent/heartbeat').send({}).expect(401);
    await api(app).post('/v1/agent/heartbeat').set({ 'X-Device-Key': 'spd_invalida', 'X-Comm-Token': COMM_TOKEN }).send({}).expect(401);
    key = (await api(app).post(`/v1/devices/${ids.dev}/agent-key`).set(as('admin')).expect(200)).body.key;
    expect(key).toMatch(/^spd_/);
    // Só o servidor de comunicação fala com o sistema: sem o segredo dele, mesmo a chave certa é recusada.
    const direct = await api(app).post('/v1/agent/heartbeat').set({ 'X-Device-Key': key }).send({}).expect(401);
    expect(direct.body.message).toMatch(/servidor de comunicação/);
    await api(app).get('/v1/agent/jobs').set({ 'X-Device-Key': key, 'X-Comm-Token': 'x'.repeat(50) }).expect(401);
    const hb = await api(app).post('/v1/agent/heartbeat').set(agent()).send({ firmware: '1.2.3' }).expect(200);
    expect(hb.body.ok).toBe(true);
    expect(hb.body.device).toMatchObject({ layout: expect.stringMatching(/^(1510|671)$/), collectIntervalMinutes: expect.any(Number) });
    const d = await api(app).get(`/v1/devices/${ids.dev}`).set(as('admin')).expect(200);
    expect(d.body).toMatchObject({ status: 'ONLINE', firmware: '1.2.3', hasAgentKey: true });
    expect(await owner.device.count({ where: { agentKeyHash: { contains: key } } })).toBe(0); // só o hash fica guardado
  });

  it('comandos: o agente recebe empregador, funcionário e data/hora prontos para o relógio', async () => {
    await api(app).post(`/v1/devices/${ids.dev}/commands`).set(as('admin')).send({ action: 'SET_DATETIME' }).expect(201);
    const sync = await api(app).post(`/v1/devices/${ids.dev}/commands`).set(as('admin')).send({ action: 'SYNC_EMPLOYEES' }).expect(201);
    expect(sync.body).toMatchObject({ layout: '671', employees: 1 });
    const pulled = await api(app).get('/v1/agent/jobs').set(agent()).expect(200);
    const byAction = Object.fromEntries(pulled.body.jobs.map((j: { action: string }) => [j.action, j]));
    expect(byAction.SET_EMPLOYER.data.employer).toMatchObject({ idType: 'CNPJ', id: '11222333000181' });
    expect(byAction.UPSERT_EMPLOYEE.data).toMatchObject({ worker: { type: 'CPF', value: MARIA.cpf }, registration: '1001' });
    expect(byAction.SET_DATETIME.data.timezone).toBe('America/Sao_Paulo');
    expect((await api(app).get('/v1/agent/jobs').set(agent()).expect(200)).body.jobs).toHaveLength(0); // já em execução
    for (const j of pulled.body.jobs) await api(app).post(`/v1/agent/jobs/${j.id}/result`).set(agent()).send({ status: 'SUCCEEDED' }).expect(200);
    await api(app).post(`/v1/agent/jobs/${pulled.body.jobs[0].id}/result`).set(agent()).send({ status: 'SUCCEEDED' }).expect(409);
    const jobs = await api(app).get(`/v1/devices/${ids.dev}/jobs`).set(as('admin')).expect(200);
    expect(jobs.body.every((j: { status: string }) => j.status === 'SUCCEEDED')).toBe(true);
  });

  it('receber funcionários: compara o relógio com o cadastro', async () => {
    await api(app).post(`/v1/devices/${ids.dev}/commands`).set(as('admin')).send({ action: 'RECEIVE_EMPLOYEES' }).expect(201);
    const [job] = (await api(app).get('/v1/agent/jobs').set(agent()).expect(200)).body.jobs;
    const r = await api(app).post(`/v1/agent/jobs/${job.id}/result`).set(agent()).send({ status: 'SUCCEEDED', data: { employees: [{ workerId: MARIA.cpf, name: 'MARIA RELOGIO', fingerprints: 1 }, { workerId: '11144477735', name: 'EX FUNCIONARIO' }] } }).expect(200);
    expect(r.body.received).toBe(2);
    const roster = await api(app).get(`/v1/devices/${ids.dev}/roster`).set(as('admin')).expect(200);
    expect(roster.body.totals).toMatchObject({ registry: 1, inDevice: 1, missing: 0, extra: 1 });
    expect(roster.body.rows[0]).toMatchObject({ registration: '1001', inDevice: true, lastSend: { status: 'SUCCEEDED' } });
    expect(roster.body.extra[0]).toMatchObject({ workerId: '11144477735' });
  });

  it('receber digitais: entram cifradas para o funcionário certo, sem duplicar', async () => {
    const template = Buffer.alloc(200, 7).toString('base64');
    for (const expected of [{ imported: 1, duplicates: 0 }, { imported: 0, duplicates: 1 }]) {
      await api(app).post(`/v1/devices/${ids.dev}/commands`).set(as('admin')).send({ action: 'RECEIVE_FINGERPRINTS' }).expect(201);
      const jobs = (await api(app).get('/v1/agent/jobs').set(agent()).expect(200)).body.jobs;
      const job = jobs.find((j: { action: string }) => j.action === 'RECEIVE_FINGERPRINTS');
      for (const other of jobs.filter((j: { id: string }) => j.id !== job.id)) await api(app).post(`/v1/agent/jobs/${other.id}/result`).set(agent()).send({ status: 'SUCCEEDED' });
      const r = await api(app).post(`/v1/agent/jobs/${job.id}/result`).set(agent()).send({ status: 'SUCCEEDED', data: { fingerprints: [{ workerId: MARIA.cpf, finger: 1, format: 'ISO_19794_2', template }, { workerId: '11144477735', finger: 1, format: 'ISO_19794_2', template }] } }).expect(200);
      expect(r.body).toMatchObject({ ...expected, unmatched: 1 });
    }
    const fp = await owner.biometricTemplate.findFirstOrThrow({ where: { employmentId: ids.maria, revokedAt: null } });
    expect(fp.templateEnc).not.toContain(template.slice(0, 20));
  });

  it('coletar registros: o AFD do relógio vira marcações; exportação devolve as linhas originais', async () => {
    await api(app).post(`/v1/devices/${ids.dev}/commands`).set(as('admin')).send({ action: 'COLLECT_RECORDS' }).expect(201);
    const jobs = (await api(app).get('/v1/agent/jobs').set(agent()).expect(200)).body.jobs;
    const job = jobs.find((j: { action: string }) => j.action === 'COLLECT_RECORDS');
    expect(job.data.sinceNsr).toBe(0);
    for (const other of jobs.filter((j: { id: string }) => j.id !== job.id)) await api(app).post(`/v1/agent/jobs/${other.id}/result`).set(agent()).send({ status: 'SUCCEEDED' });
    const r = await api(app).post(`/v1/agent/jobs/${job.id}/result`).set(agent()).send({ status: 'SUCCEEDED', data: { afd: afd671('11222333000181') } }).expect(200);
    expect(r.body).toMatchObject({ imported: 2, unmatched: 0 });
    // coleta enviada pelo agente sem comando (agendada) não duplica
    const again = await api(app).post('/v1/agent/afd').set(agent()).send({ content: afd671('11222333000181') }).expect(200);
    expect(again.body.imported).toBe(0);
    const ex = await api(app).get(`/v1/devices/${ids.dev}/afd-export?from=2026-03-01&to=2026-03-31`).set(as('admin')).expect(200);
    expect(ex.body.lines).toBe(2);
    expect(ex.body.content.split('\r\n')[0]).toMatch(/^0000000217/);
  });

  it('falha, nova tentativa, cancelamento e comando por grupo', async () => {
    await api(app).post(`/v1/devices/${ids.dev}/commands`).set(as('admin')).send({ action: 'RECEIVE_EMPLOYER' }).expect(201);
    const [job] = (await api(app).get('/v1/agent/jobs').set(agent()).expect(200)).body.jobs;
    await api(app).post(`/v1/agent/jobs/${job.id}/result`).set(agent()).send({ status: 'FAILED', error: 'Relógio não respondeu' }).expect(200);
    const list = await api(app).get(`/v1/devices?companyId=${ids.co}`).set(as('admin')).expect(200);
    expect(list.body.find((d: { id: string }) => d.id === ids.dev).failedJobs).toBe(1);
    expect((await api(app).post(`/v1/devices/${ids.dev}/jobs/retry`).set(as('admin')).expect(200)).body.retried).toBe(1);
    await api(app).delete(`/v1/devices/${ids.dev}/jobs/${job.id}`).set(as('admin')).expect(204);
    const g = await api(app).post('/v1/devices/group-command').set(as('admin')).send({ companyId: ids.co, groupName: 'Portaria', action: 'SET_DATETIME' }).expect(201);
    expect(g.body.devices).toBe(2);
    expect(g.body.results.every((x: { ok: boolean }) => x.ok)).toBe(true);
  });

  it('alertas: sem comunicação vira OFFLINE e avisa por e-mail; ao voltar, avisa de novo', async () => {
    await owner.$transaction(async (tx) => { await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`; await tx.device.update({ where: { id: ids.dev! }, data: { lastSeenAt: new Date(Date.now() - 2 * 3600_000) } }); });
    const before = mail.outbox.length;
    expect(await hook('device-check-offline', () => app.get(DeviceMonitor).checkOffline(), (b) => b.offline as number)).toBeGreaterThanOrEqual(1);
    expect((await api(app).get(`/v1/devices/${ids.dev}`).set(as('admin')).expect(200)).body.status).toBe('OFFLINE');
    expect(mail.outbox.slice(before).find((m) => m.to === 'ti@clinica.test')?.subject).toMatch(/sem comunicação/);
    expect(await hook('device-check-offline', () => app.get(DeviceMonitor).checkOffline(), (b) => b.offline as number)).toBe(0); // um alerta por queda
    await api(app).post('/v1/agent/heartbeat').set(agent()).send({}).expect(200);
    expect(mail.outbox.slice(before).some((m) => /voltou/.test(m.subject))).toBe(true);
    const st = await api(app).get(`/v1/devices/${ids.dev}/stats?days=7`).set(as('admin')).expect(200);
    expect(st.body.days).toHaveLength(7);
    expect(st.body.offlineAfterMinutes).toBe(30);
    expect(st.body.recent.map((r: { message: string }) => r.message).join(' ')).toMatch(/restabelecida/);
  });

  it('AEJ: arquivo do período com registradores, vínculos, marcações e trailer', async () => {
    const r = await api(app).get(`/v1/timesheet/aej?companyId=${ids.co}&from=2026-03-01&to=2026-03-31`).set(as('admin')).expect(200);
    const lines: string[] = r.body.content.trim().split('\r\n');
    expect(lines[0]).toMatch(/^01\|1\|11222333000181\|\|\|Clínica DV Ltda\|2026-03-01\|2026-03-31\|/);
    expect(lines).toContain('02|2|1|00004000020000123');
    expect(lines).toContain(`03|1|${MARIA.cpf}|Maria Relógio`);
    const marks = lines.filter((l) => l.startsWith('05|'));
    expect(marks.map((l) => l.split('|').slice(2, 7).join('|'))).toEqual(['2026-03-02T08:00:00-0300|2|E|1|O', '2026-03-02T17:00:00-0300|2|S|1|O']);
    const trailer = lines.at(-1)!.split('|');
    expect(trailer[0]).toBe('99');
    expect(Number(trailer[5])).toBe(2); // tipo 05
    expect(r.body.warnings.join(' ')).toMatch(/REP-P/);
  });

  it('desativar e excluir: o agente perde o acesso', async () => {
    await api(app).patch(`/v1/devices/${ids.dev}`).set(as('admin')).send({ active: false }).expect(200);
    await api(app).post('/v1/agent/heartbeat').set(agent()).send({}).expect(401);
    await api(app).delete(`/v1/devices/${ids.dev}`).set(as('admin')).expect(204);
    await api(app).get(`/v1/devices/${ids.dev}`).set(as('admin')).expect(404);
  });
});
