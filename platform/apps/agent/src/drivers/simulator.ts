import type { AfdLayout } from '@superponto/rep-protocols';
import { UnsupportedError, type DeviceDriver, type DeviceFingerprint, type EmployeeData, type EmployerData, type FingerprintData, type RosterEntry } from './types.js';

const pad = (v: string | number, n: number) => String(v).padStart(n, '0');

/**
 * Relógio simulado (para testar a instalação sem equipamento): guarda funcionários, digitais e
 * empregador em memória e gera AFD com as marcações informadas em `punch()`.
 */
export class SimulatorDriver implements DeviceDriver {
  readonly name = 'Simulador';
  readonly employees = new Map<string, RosterEntry>();
  readonly fingerprints: DeviceFingerprint[] = [];
  employer: EmployerData | null = null;
  clock: { at: Date; timeZone: string } | null = null;
  private readonly lines: Array<{ nsr: number; workerId: string; at: Date }> = [];
  private nsr = 0;

  /** Marcação no relógio simulado (como se o funcionário batesse o ponto). */
  punch(workerId: string, at = new Date()) {
    this.lines.push({ nsr: ++this.nsr, workerId, at });
    return this.nsr;
  }

  async setClock(at: Date, timeZone: string) { this.clock = { at, timeZone }; }
  async setEmployer(e: EmployerData) { this.employer = e; }
  async upsertEmployee(e: EmployeeData) { this.employees.set(e.worker.value, { workerId: e.worker.value, name: e.name, registration: e.registration ?? undefined, fingerprints: this.fingerprints.filter((f) => f.workerId === e.worker.value).length }); }
  async deleteEmployee(e: EmployeeData) { this.employees.delete(e.worker.value); }
  async upsertFingerprint(f: FingerprintData) {
    if (!this.employees.has(f.worker.value)) throw new Error('Funcionário não está no relógio');
    const i = this.fingerprints.findIndex((x) => x.workerId === f.worker.value && x.finger === f.finger);
    const fp: DeviceFingerprint = { workerId: f.worker.value, finger: f.finger, format: f.format as DeviceFingerprint['format'], template: f.template };
    if (i >= 0) this.fingerprints[i] = fp; else this.fingerprints.push(fp);
  }
  async deleteFingerprints(e: EmployeeData) { for (let i = this.fingerprints.length - 1; i >= 0; i--) if (this.fingerprints[i]!.workerId === e.worker.value) this.fingerprints.splice(i, 1); }
  async readEmployees() { return [...this.employees.values()]; }
  async readFingerprints() { return [...this.fingerprints]; }
  async readEmployer() {
    if (!this.employer) throw new UnsupportedError('Relógio sem empregador gravado');
    return { cnpj: this.employer.id, name: this.employer.name };
  }

  async fetchAfd(layout: AfdLayout, sinceNsr: number) {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    return this.lines.filter((l) => l.nsr > sinceNsr).map((l) => {
      const p = Object.fromEntries(fmt.formatToParts(l.at).map((x) => [x.type, x.value]));
      return layout === '671'
        ? `${pad(l.nsr, 9)}3${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00-0300${pad(l.workerId, 12)}0000`
        : `${pad(l.nsr, 9)}3${p.day}${p.month}${p.year}${p.hour}${p.minute}${pad(l.workerId, 12)}`;
    }).join('\r\n');
  }
}
