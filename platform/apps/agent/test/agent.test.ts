// Agente local: driver Control iD contra um relógio falso (HTTP) e o ciclo completo contra uma API falsa.
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseAfd } from '@superponto/rep-protocols';
import { DeviceRunner, maxNsr, StateStore } from '../src/agent.js';
import { AgentApi } from '../src/api.js';
import { loadConfig } from '../src/config.js';
import { ControlIdDriver } from '../src/drivers/controlid.js';
import { SimulatorDriver } from '../src/drivers/simulator.js';

// ------------------------------------------------------------ relógio Control iD falso
const calls: Array<{ path: string; body: unknown }> = [];
let sessions = 0;
let expireNext = false;
const AFD = ['000000001' + '3' + '2026-11-03T07:58:00-0300' + '052998224725' + 'A1B2', '000000002' + '3' + '2026-11-03T12:01:00-0300' + '052998224725' + 'A1B2'];
const fakeClock = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const url = new URL(req.url!, 'http://x');
    const body = raw ? JSON.parse(raw) : undefined;
    calls.push({ path: url.pathname + (url.search ? url.search.replace(/session=[^&]+/, 'session=*') : ''), body });
    const json = (code: number, v: unknown) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(v)); };
    if (url.pathname === '/login.fcgi') return body?.login === 'admin' && body?.password === 'segredo' ? json(200, { session: `s${++sessions}` }) : json(401, { error: 'login' });
    if (!url.searchParams.get('session')) return json(401, { error: 'no session' });
    if (expireNext) { expireNext = false; return json(401, { error: 'expired' }); }
    if (url.pathname === '/get_afd.fcgi') {
      const from = Number(url.searchParams.get('initial_nsr') ?? 1);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end(AFD.filter((l) => Number(l.slice(0, 9)) >= from).join('\r\n'));
    }
    if (url.pathname === '/load_users.fcgi') return json(200, { users: [{ name: 'JOAO', cpf: 52998224725, registration: '10', templates_count: 2 }] });
    return json(200, {});
  });
});
let clockPort = 0;

beforeAll(async () => {
  await new Promise<void>((r) => fakeClock.listen(0, '127.0.0.1', r));
  clockPort = (fakeClock.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((r) => fakeClock.close(() => r())));

const cid = (password = 'segredo') => new ControlIdDriver({ host: '127.0.0.1', port: clockPort, https: false, insecureTls: false, timeoutMs: 5000, login: 'admin', password, family: 'rep' });

describe('Driver Control iD', () => {
  it('faz login, guarda a sessão e refaz quando expira', async () => {
    calls.length = 0;
    const d = cid();
    await d.setClock(new Date('2026-11-03T10:00:00Z'), 'America/Sao_Paulo');
    expireNext = true;
    await d.setClock(new Date('2026-11-03T10:00:00Z'), 'America/Sao_Paulo');
    expect(calls.filter((c) => c.path === '/login.fcgi')).toHaveLength(2);
    expect(calls.find((c) => c.path.startsWith('/set_system_time.fcgi'))?.body).toEqual({ day: 3, month: 11, year: 2026, hour: 7, minute: 0, second: 0 });
  });

  it('senha errada vira erro claro', async () => {
    await expect(cid('errada').setClock(new Date(), 'America/Sao_Paulo')).rejects.toThrow(/usuário e senha do equipamento/);
  });

  it('funcionário (CPF no 671), leitura da lista e AFD a partir do NSR', async () => {
    calls.length = 0;
    const d = cid();
    await d.upsertEmployee({ worker: { type: 'CPF', value: '52998224725' }, name: 'JOAO PEREIRA', registration: '10' }, '671');
    expect(calls.at(-1)).toMatchObject({ path: '/add_users.fcgi?session=*', body: { users: [{ name: 'JOAO PEREIRA', cpf: 52998224725, registration: '10' }] } });
    expect(await d.readEmployees('671')).toEqual([{ workerId: '52998224725', name: 'JOAO', registration: '10', fingerprints: 2 }]);
    const afd = await d.fetchAfd('671', 1);
    expect(calls.at(-1)!.path).toBe('/get_afd.fcgi?mode=671&initial_nsr=2&session=*');
    expect(parseAfd(afd).records).toHaveLength(1);
    await expect(d.readEmployer()).rejects.toThrow(/homologada/);
  });
});

// ------------------------------------------------------------ API falsa
interface Sent { results: Record<string, { status: string; error?: string; data?: Record<string, unknown> }>; afd: string[]; heartbeats: number }
function fakeApi(jobs: Array<{ id: string; action: string; layout: '1510' | '671'; data: Record<string, unknown> }>, key = 'spd_' + 'a'.repeat(30)) {
  const sent: Sent = { results: {}, afd: [], heartbeats: 0 };
  const impl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const h = new Headers(init?.headers);
    if (h.get('X-Device-Key') !== key) return new Response(JSON.stringify({ message: 'Chave do equipamento ausente ou inválida' }), { status: 401 });
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (url.pathname === '/v1/agent/heartbeat') { sent.heartbeats++; return Response.json({ ok: true, serverTime: new Date().toISOString(), device: { name: 'Portaria', manufacturer: 'Simulador', modelName: null, host: null, port: null, layout: '671', timezone: 'America/Sao_Paulo', collectIntervalMinutes: 10 } }); }
    if (url.pathname === '/v1/agent/jobs') return Response.json({ jobs: jobs.splice(0) });
    const m = /^\/v1\/agent\/jobs\/([^/]+)\/result$/.exec(url.pathname);
    if (m) { sent.results[m[1]!] = body; return Response.json({ ok: body.status === 'SUCCEEDED' }); }
    if (url.pathname === '/v1/agent/afd') { sent.afd.push(body.content); const n = parseAfd(body.content).records.length; return Response.json({ imported: n, duplicates: 0, unmatched: 0 }); }
    return new Response('{}', { status: 404 });
  };
  return { sent, api: new AgentApi('https://api.exemplo.test', key, 5000, impl) };
}

describe('Ciclo do agente', () => {
  it('executa a fila, devolve dados lidos e coleta só o que é novo', async () => {
    const sim = new SimulatorDriver();
    const emp = { worker: { type: 'CPF', value: '52998224725' }, name: 'JOAO PEREIRA', registration: '10' };
    const { sent, api } = fakeApi([
      { id: 'j1', action: 'SET_DATETIME', layout: '671', data: { now: '2026-11-03T10:00:00.000Z', timezone: 'America/Sao_Paulo' } },
      { id: 'j2', action: 'SET_EMPLOYER', layout: '671', data: { employer: { idType: 'CNPJ', id: '11222333000181', name: 'CLINICA', location: 'SEDE' } } },
      { id: 'j3', action: 'UPSERT_EMPLOYEE', layout: '671', data: emp },
      { id: 'j4', action: 'UPSERT_FINGERPRINT', layout: '671', data: { ...emp, finger: 1, format: 'ISO_19794_2', template: 'QUJD' } },
      { id: 'j5', action: 'RECEIVE_EMPLOYEES', layout: '671', data: {} },
      { id: 'j6', action: 'RECEIVE_FINGERPRINTS', layout: '671', data: {} },
      { id: 'j7', action: 'RECEIVE_EMPLOYER', layout: '671', data: {} },
      { id: 'j8', action: 'FORMATAR_TUDO', layout: '671', data: {} },
    ]);
    const dir = mkdtempSync(join(tmpdir(), 'sp-agent-'));
    const state = new StateStore(join(dir, 'state.json'));
    const logs: string[] = [];
    const r = new DeviceRunner('portaria', api, sim, state, (_l, m) => logs.push(m));
    sim.punch('52998224725', new Date('2026-11-03T10:58:00Z'));
    sim.punch('52998224725', new Date('2026-11-03T15:01:00Z'));
    await r.tick(0);
    expect(sent.heartbeats).toBe(1);
    expect(r.config?.layout).toBe('671');
    expect(Object.fromEntries(Object.entries(sent.results).map(([k, v]) => [k, v.status]))).toEqual({ j1: 'SUCCEEDED', j2: 'SUCCEEDED', j3: 'SUCCEEDED', j4: 'SUCCEEDED', j5: 'SUCCEEDED', j6: 'SUCCEEDED', j7: 'SUCCEEDED', j8: 'FAILED' });
    expect(sim.clock?.at.toISOString()).toBe('2026-11-03T10:00:00.000Z');
    expect(sent.results.j5!.data).toEqual({ employees: [{ workerId: '52998224725', name: 'JOAO PEREIRA', registration: '10', fingerprints: 0 }] });
    expect(sent.results.j6!.data!.fingerprints).toEqual([{ workerId: '52998224725', finger: 1, format: 'ISO_19794_2', template: 'QUJD' }]);
    expect(sent.results.j7!.data).toEqual({ employer: { cnpj: '11222333000181', name: 'CLINICA' } });
    expect(sent.results.j8!.error).toMatch(/não suportado/);
    // Coleta agendada: as duas marcações, no leiaute 671, lidas pelo mesmo leitor da API.
    expect(sent.afd).toHaveLength(1);
    const recs = parseAfd(sent.afd[0]!).records;
    expect(recs.map((x) => x.nsr)).toEqual([1, 2]);
    expect(recs[0]).toMatchObject({ kind: 'punch', workerId: '52998224725' });
    expect(JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')).portaria.lastNsr).toBe(2);
    // Próxima volta antes do intervalo: não coleta. Depois do intervalo: só o NSR 3.
    sim.punch('52998224725', new Date('2026-11-03T16:00:00Z'));
    await r.tick(60_000);
    expect(sent.afd).toHaveLength(1);
    await r.tick(11 * 60_000);
    expect(parseAfd(sent.afd[1]!).records.map((x) => x.nsr)).toEqual([3]);
    // Estado sobrevive a reinício.
    const again = new StateStore(join(dir, 'state.json'));
    await again.load();
    expect(again.get('portaria').lastNsr).toBe(3);
  });

  it('COLLECT_RECORDS pela fila respeita o NSR que a API informa', async () => {
    const sim = new SimulatorDriver();
    for (let i = 0; i < 3; i++) sim.punch('52998224725', new Date(Date.UTC(2026, 10, 3, 11 + i)));
    const { sent, api } = fakeApi([{ id: 'c1', action: 'COLLECT_RECORDS', layout: '1510', data: { sinceNsr: 1 } }]);
    await new DeviceRunner('x', api, sim, new StateStore(null), () => {}).processJobs();
    const afd = sent.results.c1!.data!.afd as string;
    expect(parseAfd(afd).records.map((x) => x.nsr)).toEqual([2, 3]);
    expect(maxNsr(afd)).toBe(2 + 1);
  });

  it('chave inválida: erro da API e espera crescente', async () => {
    const { api } = fakeApi([], 'spd_' + 'b'.repeat(30));
    const r = new DeviceRunner('x', new AgentApi('https://api.exemplo.test', 'spd_' + 'c'.repeat(30), 5000, (api as unknown as { fetchImpl: typeof fetch }).fetchImpl), new SimulatorDriver(), new StateStore(null), () => {});
    await expect(r.tick()).rejects.toThrow(/401/);
    expect([1, 2, 3, 9].map((f) => { (r as unknown as { failures: number }).failures = f; return r.backoffMs(); })).toEqual([15_000, 30_000, 60_000, 300_000]);
  });
});

describe('Configuração', () => {
  const key = 'spd_' + 'k'.repeat(30);
  it('exige API em HTTPS (http só localhost) e dados do Control iD', () => {
    expect(() => loadConfig({ SUPERPONTO_API_URL: 'http://api.exemplo.test', SUPERPONTO_DEVICE_KEY: key, SUPERPONTO_DRIVER: 'simulator' })).toThrow(/HTTPS/);
    expect(() => loadConfig({ SUPERPONTO_API_URL: 'https://api.exemplo.test', SUPERPONTO_DEVICE_KEY: key })).toThrow(/host, login e password/);
    expect(() => loadConfig({ SUPERPONTO_API_URL: 'https://api.exemplo.test', SUPERPONTO_DEVICE_KEY: 'x', SUPERPONTO_DRIVER: 'simulator' })).toThrow(/chave/);
    const c = loadConfig({ SUPERPONTO_API_URL: 'https://api.exemplo.test', SUPERPONTO_DEVICE_KEY: key, SUPERPONTO_DEVICE_HOST: '192.168.0.50', SUPERPONTO_DEVICE_LOGIN: 'admin', SUPERPONTO_DEVICE_PASSWORD: 'admin' });
    expect(c.devices[0]).toMatchObject({ driver: 'controlid', host: '192.168.0.50', https: true, family: 'rep' });
  });
});
