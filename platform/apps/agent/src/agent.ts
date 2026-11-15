import { readFile, rename, writeFile } from 'node:fs/promises';
import { parseAfd } from '@superponto/rep-protocols';
import { AgentApi, ApiError, type AgentJob, type DeviceConfig } from './api.js';
import { UnsupportedError, type DeviceDriver, type EmployeeData, type EmployerData, type FingerprintData } from './drivers/types.js';

export const VERSION = '2.0.0';
type Log = (level: 'info' | 'warn' | 'error', msg: string) => void;

/** Estado local por equipamento: último NSR enviado (para a coleta agendada não reenviar tudo). */
export class StateStore {
  private data: Record<string, { lastNsr: number; lastCollectAt?: string }> = {};
  constructor(private readonly file: string | null) {}
  async load() { if (!this.file) return; try { this.data = JSON.parse(await readFile(this.file, 'utf8')); } catch { this.data = {}; } }
  get(id: string) { return this.data[id] ?? { lastNsr: 0 }; }
  async set(id: string, v: { lastNsr: number; lastCollectAt?: string }) {
    this.data[id] = v;
    if (!this.file) return;
    await writeFile(`${this.file}.tmp`, JSON.stringify(this.data, null, 2));
    await rename(`${this.file}.tmp`, this.file);
  }
}

/** Maior NSR de um AFD (para lembrar até onde já foi enviado). */
export function maxNsr(afd: string) {
  try { return parseAfd(afd).records.reduce((m, r) => Math.max(m, r.nsr), 0); } catch { return 0; }
}

/**
 * Um equipamento: batimento, fila de comandos e coleta agendada. Só faz conexões de saída
 * (relógio na rede local e API do SuperPonto). Falhas de rede esperam cada vez mais (até 5 min).
 */
export class DeviceRunner {
  config: DeviceConfig | null = null;
  private failures = 0;
  private stopped = false;
  private nextCollect = 0;

  constructor(readonly id: string, private readonly api: AgentApi, private readonly driver: DeviceDriver, private readonly state: StateStore, private readonly log: Log) {}

  async heartbeat() {
    const r = await this.api.heartbeat({ adapterVersion: `superponto-agent ${VERSION} (${this.driver.name})` });
    this.config = r.device;
    return r;
  }

  /** Executa um comando no relógio e devolve o resultado (com os dados lidos, quando houver). */
  async execute(job: AgentJob): Promise<{ status: 'SUCCEEDED' | 'FAILED'; error?: string; data?: Record<string, unknown> }> {
    const d = job.data;
    const emp = d as unknown as EmployeeData;
    try {
      switch (job.action) {
        case 'SET_DATETIME': await this.driver.setClock(new Date(String(d.now)), String(d.timezone ?? 'America/Sao_Paulo')); return { status: 'SUCCEEDED' };
        case 'SET_EMPLOYER': await this.driver.setEmployer(d.employer as EmployerData, job.layout); return { status: 'SUCCEEDED' };
        case 'UPSERT_EMPLOYEE': await this.driver.upsertEmployee(emp, job.layout); return { status: 'SUCCEEDED' };
        case 'DELETE_EMPLOYEE': await this.driver.deleteEmployee(emp, job.layout); return { status: 'SUCCEEDED' };
        case 'UPSERT_FINGERPRINT': await this.driver.upsertFingerprint(d as unknown as FingerprintData, job.layout); return { status: 'SUCCEEDED' };
        case 'DELETE_FINGERPRINTS': await this.driver.deleteFingerprints(emp, job.layout); return { status: 'SUCCEEDED' };
        case 'RECEIVE_EMPLOYEES': return { status: 'SUCCEEDED', data: { employees: await this.driver.readEmployees(job.layout) } };
        case 'RECEIVE_FINGERPRINTS': return { status: 'SUCCEEDED', data: { fingerprints: await this.driver.readFingerprints(job.layout) } };
        case 'RECEIVE_EMPLOYER': return { status: 'SUCCEEDED', data: { employer: await this.driver.readEmployer(job.layout) } };
        case 'COLLECT_RECORDS': {
          const since = Math.max(Number(d.sinceNsr ?? 0), 0);
          const afd = await this.driver.fetchAfd(job.layout, since);
          const top = maxNsr(afd);
          if (top) await this.state.set(this.id, { ...this.state.get(this.id), lastNsr: Math.max(top, this.state.get(this.id).lastNsr) });
          return { status: 'SUCCEEDED', data: afd.trim() ? { afd } : {} };
        }
        default: return { status: 'FAILED', error: `Comando ${job.action} não suportado por este agente` };
      }
    } catch (e) {
      const msg = e instanceof UnsupportedError ? e.message : `${this.driver.name}: ${(e as Error).message}`;
      return { status: 'FAILED', error: msg.slice(0, 1000) };
    }
  }

  /** Busca a fila e executa em ordem. */
  async processJobs() {
    const { jobs } = await this.api.jobs();
    for (const job of jobs) {
      const r = await this.execute(job);
      try {
        const out = await this.api.result(job.id, r);
        this.log(r.status === 'SUCCEEDED' ? 'info' : 'warn', `${job.action}: ${r.status === 'SUCCEEDED' ? `ok ${JSON.stringify(out)}` : r.error}`);
      } catch (e) {
        // 409 = a API já não espera este resultado (ex.: comando expirou e voltou para a fila).
        if (!(e instanceof ApiError && e.status === 409)) throw e;
      }
    }
    return jobs.length;
  }

  /** Coleta agendada: só o que veio depois do último NSR enviado. */
  async collect() {
    const layout = this.config?.layout ?? '671';
    const st = this.state.get(this.id);
    const afd = await this.driver.fetchAfd(layout, st.lastNsr);
    const top = maxNsr(afd);
    if (!afd.trim() || !top) { await this.state.set(this.id, { ...st, lastCollectAt: new Date().toISOString() }); return { imported: 0, duplicates: 0, unmatched: 0 }; }
    const r = await this.api.afd(afd);
    await this.state.set(this.id, { lastNsr: Math.max(top, st.lastNsr), lastCollectAt: new Date().toISOString() });
    this.log('info', `Coleta: ${r.imported} novas, ${r.duplicates} repetidas, ${r.unmatched} sem funcionário`);
    return r;
  }

  /** Uma volta completa: batimento, comandos e (se for a hora) coleta. */
  async tick(now = Date.now()) {
    await this.heartbeat();
    await this.processJobs();
    if (now >= this.nextCollect) {
      await this.collect();
      this.nextCollect = now + (this.config?.collectIntervalMinutes ?? 10) * 60_000;
    }
  }

  /** Espera depois de uma falha: 15 s, 30 s, 1 min… até 5 min. */
  backoffMs() { return Math.min(300_000, 15_000 * 2 ** Math.max(0, this.failures - 1)); }

  async loop(intervalMs = 30_000) {
    while (!this.stopped) {
      let wait = intervalMs;
      try { await this.tick(); this.failures = 0; }
      catch (e) { this.failures++; wait = this.backoffMs(); this.log('error', `${(e as Error).message} (nova tentativa em ${Math.round(wait / 1000)} s)`); }
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  stop() { this.stopped = true; }
}
