/**
 * Geração do AFD no leiaute da Portaria MTP 671/2021 para o REP-P (programa de registro de ponto):
 * cabeçalho (tipo 1), marcações do REP-P (tipo 7, com hash SHA-256 encadeado) e trailer.
 * A assinatura digital (arquivo .p7s, certificado ICP-Brasil do empregador) é feita à parte.
 */
import { createHash } from 'node:crypto';

/** CRC-16/KERMIT (polinômio 0x1021 refletido, início 0), em 4 dígitos hexadecimais maiúsculos. */
export function crc16(text: string) {
  let crc = 0;
  for (const b of Buffer.from(text, 'latin1')) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0x8408 : crc >>> 1;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const L = (v: string | number, n: number) => String(v).padStart(n, '0').slice(-n);
const R = (v: string, n: number) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, ' ').padEnd(n, ' ').slice(0, n);

/** Data e hora local no formato do AFD 671: AAAA-MM-DDThh:mm:00-0300 (offset do fuso). */
export function afdDateTime(at: Date, timeZone = 'America/Sao_Paulo', withSeconds = false) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(at).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
  const off = Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
  const sign = off < 0 ? '-' : '+';
  const a = Math.abs(off);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${withSeconds ? p.second : '00'}${sign}${L(Math.floor(a / 60), 2)}${L(a % 60, 2)}`;
}

export interface AfdHeader671 {
  employerIdType: 'CNPJ' | 'CPF';
  employerId: string;
  secondaryId?: string;
  employerName: string;
  /** número do REP-P no INPI (17 dígitos) */
  repId: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: Date;
  developerId: string;
  model: string;
}

export function afdHeader671(h: AfdHeader671, timeZone?: string) {
  const line = `${L(0, 9)}1${h.employerIdType === 'CPF' ? '2' : '1'}${R(h.employerId.replace(/\W/g, ''), 14)}${R(h.secondaryId ?? '', 14)}${R(h.employerName, 150)}${L(h.repId || '0', 17)}${h.periodStart}${h.periodEnd}${afdDateTime(h.generatedAt, timeZone)}003${h.developerId.replace(/\D/g, '').length === 11 ? '2' : '1'}${R(h.developerId.replace(/\W/g, ''), 14)}${R(h.model, 30)}`;
  return line + crc16(line);
}

/**
 * Registro tipo 7 (marcação do REP-P). O hash é o SHA-256 dos campos do registro (do NSR ao
 * indicador on/offline) concatenados ao hash do registro tipo 7 anterior (vazio no primeiro).
 * Coletor: 01 app móvel, 02 navegador, 03 app desktop, 04 dispositivo eletrônico, 05 outro.
 */
export function afdRecord7(r: { nsr: number | bigint; at: Date; cpf: string; recordedAt: Date; collector: '01' | '02' | '03' | '04' | '05'; offline: boolean }, previousHash: string | null, timeZone?: string) {
  const body = `${L(String(r.nsr), 9)}7${afdDateTime(r.at, timeZone)}${L(r.cpf.replace(/\D/g, ''), 12)}${afdDateTime(r.recordedAt, timeZone, true)}${r.collector}${r.offline ? '1' : '0'}`;
  const hash = createHash('sha256').update(body + (previousHash ?? '')).digest('hex');
  return { line: body + hash, hash };
}

/** Trailer: quantidade de registros tipos 2, 3, 4, 5, 6 e 7, e o tipo "9". */
export function afdTrailer671(counts: Partial<Record<'2' | '3' | '4' | '5' | '6' | '7', number>>) {
  return `999999999${(['2', '3', '4', '5', '6', '7'] as const).map((k) => L(counts[k] ?? 0, 9)).join('')}9`;
}
