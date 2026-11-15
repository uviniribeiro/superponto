import type { AfdLayout } from '@superponto/rep-protocols';

/** Dados que a API manda em cada comando (ver AgentService.pull). */
export interface Worker { type: 'PIS' | 'CPF'; value: string }
export interface EmployeeData { worker: Worker; name: string; registration?: string | null }
export interface FingerprintData extends EmployeeData { finger: number; format: string; template: string }
export interface EmployerData { idType: 'CNPJ' | 'CPF'; id: string; secondaryId?: string; name: string; location: string }

export interface RosterEntry { workerId: string; name?: string; registration?: string; fingerprints?: number }
export interface DeviceFingerprint { workerId: string; finger: number; format: 'ISO_19794_2' | 'ANSI_378' | 'CONTROLID' | 'HENRY' | 'OTHER'; template: string }

/** Equipamento não suporta (ou ainda não homologado): o comando volta como FALHA com esta mensagem. */
export class UnsupportedError extends Error {}

/**
 * Um driver por fabricante. Cada método fala com o relógio na rede local; nada sai para a internet
 * além da API do SuperPonto (feito pelo agente, não pelo driver).
 */
export interface DeviceDriver {
  readonly name: string;
  setClock(at: Date, timeZone: string): Promise<void>;
  setEmployer(e: EmployerData, layout: AfdLayout): Promise<void>;
  upsertEmployee(e: EmployeeData, layout: AfdLayout): Promise<void>;
  deleteEmployee(e: EmployeeData, layout: AfdLayout): Promise<void>;
  upsertFingerprint(f: FingerprintData, layout: AfdLayout): Promise<void>;
  deleteFingerprints(e: EmployeeData, layout: AfdLayout): Promise<void>;
  readEmployees(layout: AfdLayout): Promise<RosterEntry[]>;
  readFingerprints(layout: AfdLayout): Promise<DeviceFingerprint[]>;
  readEmployer(layout: AfdLayout): Promise<{ cnpj: string; name?: string }>;
  /** AFD a partir do NSR informado (exclusive quando o relógio permitir; a API ignora repetidos). */
  fetchAfd(layout: AfdLayout, sinceNsr: number): Promise<string>;
  close?(): Promise<void>;
}
