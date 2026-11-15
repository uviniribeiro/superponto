import net from 'node:net';
import { decodeHenry, encodeHenry, HENRY_ERRORS, henryDateTime, henryDeleteFingerprints, henryEmployer, henryEventsToAfd, henryFingerprint, henryUser, henryUserResult, localParts, parseHenryEvents, parseHenryUsers, type AfdLayout, type HenryFrame } from '@superponto/rep-protocols';
import { UnsupportedError, type DeviceDriver, type DeviceFingerprint, type EmployeeData, type EmployerData, type FingerprintData, type RosterEntry } from './types.js';

export interface HenryOptions {
  host: string;
  port: number;
  timeoutMs: number;
  /** fuso do equipamento (para acertar a hora e escrever o AFD) */
  timeZone?: string;
  /** códigos de evento que viram marcação; padrão: todos menos estados de catraca (80, 82, 83) */
  ignoreEventCodes?: string[];
  /** eventos por pedido de coleta (o protocolo trabalha em lotes) */
  batch?: number;
}

/**
 * Henry pelo protocolo de gerenciamento 8x (TCP, porta padrão 3000): o agente conecta no
 * equipamento, envia um comando e espera a resposta com o mesmo índice. Eventos online (REON) que
 * chegarem no meio são ignorados. Homologação em equipamento real pendente.
 */
export class HenryDriver implements DeviceDriver {
  readonly name = 'Henry (protocolo 8x)';
  private seq = 0;
  constructor(private readonly o: HenryOptions) {}

  /** Uma conexão por comando: simples e à prova de conexão presa (o equipamento aceita poucas). */
  async request(command: string, data = '', version = '00'): Promise<HenryFrame> {
    const index = (this.seq = (this.seq + 1) % 100);
    const frame = encodeHenry(index, command, data, version);
    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ host: this.o.host, port: this.o.port });
      let buf: Buffer = Buffer.alloc(0);
      const done = (err: Error | null, f?: HenryFrame) => { clearTimeout(timer); sock.destroy(); if (err) reject(err); else resolve(f!); };
      const timer = setTimeout(() => done(new Error(`Henry ${this.o.host}:${this.o.port} não respondeu a ${command} em ${Math.round(this.o.timeoutMs / 1000)} s`)), this.o.timeoutMs);
      sock.on('connect', () => sock.write(frame));
      sock.on('error', (e) => done(new Error(`Henry ${this.o.host}:${this.o.port}: ${e.message}`)));
      sock.on('data', (chunk: Buffer) => {
        buf = Buffer.concat([buf, chunk]);
        try {
          const { frames, rest } = decodeHenry(buf);
          buf = rest;
          const f = frames.find((x) => x.command === command && Number(x.index) === index);
          if (f) done(null, f);
        } catch (e) { done(e as Error); }
      });
    });
  }

  /** Comando que precisa responder sem erro ("00"; "01" = sem dados também é aceito quando `allowEmpty`). */
  private async ok(command: string, data = '', allowEmpty = false) {
    const f = await this.request(command, data);
    if (f.code === '00' || (allowEmpty && f.code === '01')) return f;
    throw new Error(`${command}: ${HENRY_ERRORS[f.code] ?? `erro ${f.code}`}`);
  }

  async setClock(at: Date, timeZone: string) { await this.ok('EH', henryDateTime(localParts(at, this.o.timeZone ?? timeZone))); }
  async setEmployer(e: EmployerData) { await this.ok('EE', henryEmployer(e)); }

  async upsertEmployee(e: EmployeeData) {
    const f = await this.ok('EU', henryUser('I', e.worker.value, e.name));
    const [r] = henryUserResult(f.data);
    if (r === '23' || r === '62') { // já cadastrado: altera
      const [r2] = henryUserResult((await this.ok('EU', henryUser('A', e.worker.value, e.name))).data);
      if (r2 && r2 !== '00') throw new Error(`EU: ${HENRY_ERRORS[r2] ?? `erro ${r2}`}`);
    } else if (r && r !== '00') throw new Error(`EU: ${HENRY_ERRORS[r] ?? `erro ${r}`}`);
  }

  async deleteEmployee(e: EmployeeData) {
    const [r] = henryUserResult((await this.ok('EU', henryUser('E', e.worker.value))).data);
    if (r && r !== '00' && r !== '22') throw new Error(`EU: ${HENRY_ERRORS[r] ?? `erro ${r}`}`);
  }

  async upsertFingerprint(f: FingerprintData) {
    if (f.format !== 'HENRY') throw new UnsupportedError(`Henry só aceita digital no formato do próprio equipamento (recebido ${f.format})`);
    // A API entrega o template em base64; o equipamento espera o texto do próprio formato (384 caracteres).
    const raw = Buffer.from(f.template, 'base64').toString('latin1');
    if (!/^[\x21-\x7e]+$/.test(raw) || /[+\][{}]/.test(raw)) throw new UnsupportedError('Template Henry inválido para envio');
    await this.ok('ED', henryFingerprint(f.worker.value, f.finger, raw));
  }

  async deleteFingerprints(e: EmployeeData) { await this.ok('ED', henryDeleteFingerprints(e.worker.value), true); }

  async readEmployees(): Promise<RosterEntry[]> {
    const out: RosterEntry[] = [];
    for (let start = 0; start < 50_000; start += 50) {
      const f = await this.ok('RU', `50]${start}`, true);
      const list = f.code === '01' ? [] : parseHenryUsers(f.data);
      for (const u of list) if (/^\d{11,12}$/.test(u.id)) out.push({ workerId: u.id, name: u.name });
      if (list.length < 50) break;
    }
    return out;
  }

  async readFingerprints(): Promise<DeviceFingerprint[]> {
    const list = await this.ok('RD', 'L]1000}0', true);
    const ids = list.code === '01' ? [] : (list.data.split('+')[1] ?? '').split(']').filter(Boolean);
    const out: DeviceFingerprint[] = [];
    for (const id of ids) {
      const f = await this.ok('RD', `D]${id}`, true);
      // "D]matrícula}qtde}dedo{template}dedo{template..."
      const parts = f.data.replace(/^D\]/, '').split('}');
      for (const t of parts.slice(2)) {
        const [finger, template] = t.split('{');
        if (template && /^\d{11,12}$/.test(id)) out.push({ workerId: id, finger: Math.min(9, Math.max(0, Number(finger) || 0)), format: 'HENRY', template: Buffer.from(template, 'latin1').toString('base64') });
      }
    }
    return out;
  }

  async readEmployer() {
    const f = await this.ok('RE');
    const [, doc = '', , name = ''] = f.data.split(']');
    return { cnpj: doc, name };
  }

  /** Coleta em lotes a partir do evento seguinte ao último enviado; devolve linhas no leiaute AFD. */
  async fetchAfd(layout: AfdLayout, sinceNsr: number) {
    const ignore = new Set(this.o.ignoreEventCodes ?? ['80', '82', '83']);
    const batch = this.o.batch ?? 50;
    const all = [];
    for (let start = sinceNsr + 1, guard = 0; guard < 2000; guard++) {
      const f = await this.ok('RR', `T]${batch}]${start}`, true);
      if (f.code === '01') break;
      const ev = parseHenryEvents(f.data).filter((e) => e.id >= start);
      all.push(...ev.filter((e) => !ignore.has(e.code)));
      if (ev.length < batch) break;
      start = Math.max(...ev.map((e) => e.id)) + 1;
    }
    return henryEventsToAfd(all, layout);
  }
}
