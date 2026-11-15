/**
 * Leitura do AFD (Arquivo Fonte de Dados) gerado por registradores de ponto.
 *
 * - Portaria nº 1.510/2009 (REP antigo, ainda em uso): datas ddmmaaaa + hhmm, sem fuso; trabalhador
 *   identificado pelo PIS. Registros 1 (cabeçalho), 2 (empresa), 3 (marcação), 4 (ajuste do relógio),
 *   5 (empregado) e 9 (trailer).
 * - Portaria MTP nº 671/2021: data e hora com fuso (AAAA-MM-DDThh:mm:00-0300); trabalhador
 *   identificado pelo CPF. Registros 1, 2, 3 (marcação REP-C), 4, 5, 6 (eventos sensíveis),
 *   7 (marcação REP-P, com hash) e 9.
 * - Sistemas alternativos da Portaria nº 373/2011 (hoje REP-A) costumam exportar um destes dois leiautes.
 *
 * O leiaute é detectado pelo cabeçalho (ou pelo formato da data, se o cabeçalho faltar). Linhas
 * com problema não interrompem a leitura: viram avisos com o número da linha.
 */
import { zonedToUtc } from './time.ts';

export type AfdLayout = '1510' | '671';

export interface AfdHeader {
  layout: AfdLayout;
  employerIdType: 'CNPJ' | 'CPF';
  employerId: string;
  /** CEI (1510) ou CNO/CAEPF (671) */
  secondaryId: string;
  employerName: string;
  /** número de fabricação do REP (ou registro do programa, no REP-P) */
  repId: string;
  periodStart: string;
  periodEnd: string;
  /** só no 671 */
  layoutVersion?: string;
  manufacturerId?: string;
  model?: string;
}

export interface AfdPunch {
  kind: 'punch';
  nsr: number;
  line: number;
  occurredAt: Date;
  /** PIS (1510) ou CPF (671), só dígitos e sem zeros à esquerda extras */
  workerId: string;
  workerIdType: 'PIS' | 'CPF';
  /** tipo do registro de origem: 3 (REP-C/REP-A) ou 7 (REP-P) */
  recordType: '3' | '7';
  /** registro 7: identificador do coletor e indicador on-line/off-line, como vieram no arquivo */
  collector?: string;
  connectionFlag?: string;
  hash?: string;
}

export interface AfdEmployeeChange {
  kind: 'employee';
  nsr: number;
  line: number;
  occurredAt: Date;
  operation: 'I' | 'A' | 'E';
  workerId: string;
  workerIdType: 'PIS' | 'CPF';
  name: string;
}

export interface AfdClockAdjust {
  kind: 'clock';
  nsr: number;
  line: number;
  before: Date;
  after: Date;
}

export interface AfdEmployerChange {
  kind: 'employer';
  nsr: number;
  line: number;
  occurredAt: Date;
  employerIdType: 'CNPJ' | 'CPF';
  employerId: string;
  employerName: string;
  location: string;
}

export interface AfdSensitiveEvent {
  kind: 'event';
  nsr: number;
  line: number;
  occurredAt: Date;
  code: string;
}

export type AfdRecord = AfdPunch | AfdEmployeeChange | AfdClockAdjust | AfdEmployerChange | AfdSensitiveEvent;

export interface AfdResult {
  layout: AfdLayout;
  header: AfdHeader | null;
  records: AfdRecord[];
  punches: AfdPunch[];
  /** contagens do trailer, quando presente */
  trailer: Record<string, number> | null;
  warnings: string[];
}

export interface AfdOptions {
  /** fuso do equipamento, usado no leiaute 1510 (sem fuso no arquivo). Padrão: America/Sao_Paulo */
  timeZone?: string;
}

const trimId = (v: string) => v.trim().replace(/^0+(?=\d)/, '');
const text = (v: string) => v.replace(/\s+$/, '');

function date1510(ddmmaaaa: string, hhmm: string, tz: string): Date {
  const d = Number(ddmmaaaa.slice(0, 2)), m = Number(ddmmaaaa.slice(2, 4)), y = Number(ddmmaaaa.slice(4, 8));
  const h = Number(hhmm.slice(0, 2)), min = Number(hhmm.slice(2, 4));
  if (![d, m, y, h, min].every(Number.isFinite) || m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || min > 59) throw new Error(`data inválida "${ddmmaaaa} ${hhmm}"`);
  return zonedToUtc(y, m, d, h, min, 0, tz);
}

/** AAAA-MM-DDThh:mm:ss-ZZZZ (671). Aceita também -ZZ:ZZ. */
function date671(v: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?([+-])(\d{2}):?(\d{2})$/.exec(v.trim());
  if (!m) throw new Error(`data inválida "${v.trim()}"`);
  const [, y, mo, d, h, mi, s, sign, oh, om] = m;
  const offsetMin = (Number(oh) * 60 + Number(om)) * (sign === '-' ? -1 : 1);
  const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0)) - offsetMin * 60_000;
  const out = new Date(utc);
  if (Number.isNaN(out.getTime())) throw new Error(`data inválida "${v.trim()}"`);
  return out;
}

const ISO_AT_10 = /^\d{9}\d\d{4}-\d{2}-\d{2}T/;

function detectLayout(lines: string[]): AfdLayout {
  const header = lines.find((l) => l.slice(9, 10) === '1');
  if (header) {
    // 671: data inicial AAAA-MM-DD na posição 206; 1510: ddmmaaaa na posição 204.
    if (/^\d{4}-\d{2}-\d{2}$/.test(header.slice(206, 216))) return '671';
    return '1510';
  }
  return lines.some((l) => ISO_AT_10.test(l)) ? '671' : '1510';
}

export function parseAfd(content: string, options: AfdOptions = {}): AfdResult {
  const tz = options.timeZone ?? 'America/Sao_Paulo';
  const lines = content.replace(/^﻿/, '').split(/\r?\n/);
  const layout = detectLayout(lines);
  const warnings: string[] = [];
  const records: AfdRecord[] = [];
  let header: AfdHeader | null = null;
  let trailer: Record<string, number> | null = null;
  let lastNsr = 0;

  lines.forEach((raw, i) => {
    const line = i + 1;
    if (!raw.trim()) return;
    const type = raw.slice(9, 10);
    try {
      if (raw.startsWith('999999999')) {
        const n = (a: number) => Number(raw.slice(a, a + 9));
        trailer = layout === '1510'
          ? { '2': n(9), '3': n(18), '4': n(27), '5': n(36) }
          : { '2': n(9), '3': n(18), '4': n(27), '5': n(36), '6': n(45), '7': n(54) };
        return;
      }
      const nsr = Number(raw.slice(0, 9));
      if (type !== '1') {
        if (!Number.isInteger(nsr) || nsr <= 0) throw new Error('NSR inválido');
        if (nsr <= lastNsr) warnings.push(`linha ${line}: NSR ${nsr} fora de ordem (anterior ${lastNsr})`);
        else if (lastNsr && nsr !== lastNsr + 1) warnings.push(`linha ${line}: lacuna de NSR entre ${lastNsr} e ${nsr}`);
        lastNsr = Math.max(lastNsr, nsr);
      }

      if (layout === '1510') {
        switch (type) {
          case '1':
            header = {
              layout, employerIdType: raw[10] === '2' ? 'CPF' : 'CNPJ', employerId: raw.slice(11, 25).trim(),
              secondaryId: raw.slice(25, 37).trim(), employerName: text(raw.slice(37, 187)), repId: raw.slice(187, 204).trim(),
              periodStart: raw.slice(204, 212), periodEnd: raw.slice(212, 220),
            };
            return;
          case '2':
            records.push({ kind: 'employer', nsr, line, occurredAt: date1510(raw.slice(10, 18), raw.slice(18, 22), tz), employerIdType: raw[22] === '2' ? 'CPF' : 'CNPJ', employerId: raw.slice(23, 37).trim(), employerName: text(raw.slice(49, 199)), location: text(raw.slice(199, 299)) });
            return;
          case '3': {
            const workerId = trimId(raw.slice(22, 34));
            if (!/^\d{11}$/.test(workerId.padStart(11, '0'))) throw new Error('PIS inválido');
            records.push({ kind: 'punch', nsr, line, occurredAt: date1510(raw.slice(10, 18), raw.slice(18, 22), tz), workerId, workerIdType: 'PIS', recordType: '3' });
            return;
          }
          case '4':
            records.push({ kind: 'clock', nsr, line, before: date1510(raw.slice(10, 18), raw.slice(18, 22), tz), after: date1510(raw.slice(22, 30), raw.slice(30, 34), tz) });
            return;
          case '5':
            records.push({ kind: 'employee', nsr, line, occurredAt: date1510(raw.slice(10, 18), raw.slice(18, 22), tz), operation: raw[22] as 'I' | 'A' | 'E', workerId: trimId(raw.slice(23, 35)), workerIdType: 'PIS', name: text(raw.slice(35, 87)) });
            return;
          default:
            warnings.push(`linha ${line}: tipo de registro "${type}" desconhecido no leiaute 1510`);
            return;
        }
      }

      switch (type) {
        case '1':
          header = {
            layout, employerIdType: raw[10] === '2' ? 'CPF' : 'CNPJ', employerId: raw.slice(11, 25).trim(),
            secondaryId: raw.slice(25, 39).trim(), employerName: text(raw.slice(39, 189)), repId: raw.slice(189, 206).trim(),
            periodStart: raw.slice(206, 216), periodEnd: raw.slice(216, 226), layoutVersion: raw.slice(250, 253),
            manufacturerId: raw.slice(254, 268).trim(), model: text(raw.slice(268, 298)),
          };
          return;
        case '2':
          records.push({ kind: 'employer', nsr, line, occurredAt: date671(raw.slice(10, 34)), employerIdType: raw[48] === '2' ? 'CPF' : 'CNPJ', employerId: raw.slice(49, 63).trim(), employerName: text(raw.slice(77, 227)), location: text(raw.slice(227, 327)) });
          return;
        case '3':
          records.push({ kind: 'punch', nsr, line, occurredAt: date671(raw.slice(10, 34)), workerId: trimId(raw.slice(34, 46)), workerIdType: 'CPF', recordType: '3' });
          return;
        case '4':
          records.push({ kind: 'clock', nsr, line, before: date671(raw.slice(10, 34)), after: date671(raw.slice(34, 58)) });
          return;
        case '5':
          records.push({ kind: 'employee', nsr, line, occurredAt: date671(raw.slice(10, 34)), operation: raw[34] as 'I' | 'A' | 'E', workerId: trimId(raw.slice(35, 47)), workerIdType: 'CPF', name: text(raw.slice(47, 99)) });
          return;
        case '6':
          records.push({ kind: 'event', nsr, line, occurredAt: date671(raw.slice(10, 34)), code: raw.slice(34, 36) });
          return;
        case '7':
          records.push({ kind: 'punch', nsr, line, occurredAt: date671(raw.slice(10, 34)), workerId: trimId(raw.slice(34, 46)), workerIdType: 'CPF', recordType: '7', collector: raw.slice(70, 72), connectionFlag: raw[72], hash: raw.slice(73, 137).trim() || undefined });
          return;
        default:
          warnings.push(`linha ${line}: tipo de registro "${type}" desconhecido no leiaute 671`);
      }
    } catch (e) {
      warnings.push(`linha ${line}: ${(e as Error).message}`);
    }
  });

  const punches = records.filter((r): r is AfdPunch => r.kind === 'punch');
  if (trailer) {
    const t: Record<string, number> = trailer;
    const count3 = punches.filter((r) => r.recordType === '3').length;
    if (Number.isFinite(t['3']) && t['3'] !== count3) warnings.push(`trailer informa ${t['3']} marcações tipo 3, arquivo tem ${count3}`);
  }
  return { layout, header, records, punches, trailer, warnings };
}
