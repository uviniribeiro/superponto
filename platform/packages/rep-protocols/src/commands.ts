/**
 * Comandos enviados do SuperPonto para o registrador (REP), independentes de fabricante.
 * Cada adaptador (Control iD, Henry, ...) traduz estes comandos para o protocolo do equipamento,
 * e o Servidor de Comunicação os executa na rede do cliente.
 *
 * Identificação do trabalhador no equipamento:
 * - REP da Portaria 1.510/2009 (e sistemas da 373/2011 nesse leiaute): PIS
 * - REP da Portaria 671/2021: CPF
 */
import { isValidCnpj, isValidCpf, isValidPis, normalizeCnpj, onlyDigits } from '@superponto/br-docs';
import type { AfdLayout } from './afd.ts';

export interface RepEmployer {
  idType: 'CNPJ' | 'CPF';
  /** CNPJ (numérico ou alfanumérico) ou CPF do empregador */
  id: string;
  /** CEI (1510) ou CNO/CAEPF (671), opcional */
  secondaryId?: string;
  name: string;
  /** local de prestação de serviço */
  location: string;
}

export interface RepEmployee {
  /** id interno do vínculo no SuperPonto */
  employmentId: string;
  name: string;
  cpf?: string | null;
  pis?: string | null;
  /** matrícula */
  registration?: string | null;
  card?: string | null;
}

export type FingerprintFormat = 'ISO_19794_2' | 'ANSI_378' | 'CONTROLID' | 'HENRY' | 'OTHER';

export interface RepFingerprint {
  employmentId: string;
  /** 0 = polegar direito … 9 = mínimo esquerdo (ISO/IEC 19794-2) */
  finger: number;
  format: FingerprintFormat;
  /** template em base64 (nunca a imagem da digital) */
  template: string;
}

export type RepCommand =
  | { type: 'SET_EMPLOYER'; employer: RepEmployer }
  | { type: 'UPSERT_EMPLOYEE'; employee: RepEmployee }
  | { type: 'DELETE_EMPLOYEE'; employee: RepEmployee }
  | { type: 'UPSERT_FINGERPRINT'; employee: RepEmployee; fingerprint: RepFingerprint }
  | { type: 'DELETE_FINGERPRINTS'; employee: RepEmployee }
  | { type: 'SET_CLOCK'; at: Date; timeZone: string }
  | { type: 'FETCH_AFD'; fromNsr?: number };

export class RepCommandError extends Error {}

/** Identificador do trabalhador exigido pelo leiaute do equipamento. */
export function workerIdFor(layout: AfdLayout, e: RepEmployee): { type: 'PIS' | 'CPF'; value: string } {
  if (layout === '1510') {
    const pis = onlyDigits(e.pis ?? '');
    if (!isValidPis(pis)) throw new RepCommandError(`${e.name}: equipamento da Portaria 1.510 exige PIS válido`);
    return { type: 'PIS', value: pis };
  }
  const cpf = onlyDigits(e.cpf ?? '');
  if (!isValidCpf(cpf)) throw new RepCommandError(`${e.name}: equipamento da Portaria 671 exige CPF válido`);
  return { type: 'CPF', value: cpf };
}

export function validateEmployer(e: RepEmployer): RepEmployer {
  const id = e.idType === 'CNPJ' ? normalizeCnpj(e.id) : onlyDigits(e.id);
  const ok = e.idType === 'CNPJ' ? isValidCnpj(id) : isValidCpf(id);
  if (!ok) throw new RepCommandError(`${e.idType} do empregador inválido`);
  if (!e.name.trim()) throw new RepCommandError('Razão social do empregador obrigatória');
  if (!e.location.trim()) throw new RepCommandError('Local de prestação de serviço obrigatório');
  return { ...e, id, name: e.name.trim(), location: e.location.trim() };
}

/**
 * Equipamentos da Portaria 1.510 só aceitam empregador com CNPJ numérico (campo de 14 dígitos).
 * CNPJ alfanumérico só pode ir para equipamentos que já suportam o leiaute novo.
 */
export function assertEmployerFitsLayout(layout: AfdLayout, e: RepEmployer) {
  if (layout === '1510' && e.idType === 'CNPJ' && /[A-Z]/.test(e.id)) {
    throw new RepCommandError('Este equipamento (Portaria 1.510) não aceita CNPJ alfanumérico; atualize o firmware ou use um REP da Portaria 671');
  }
}

/** Nome no limite do campo do REP (52 caracteres no AFD), sem acentos problemáticos para firmwares antigos. */
export function repName(name: string, max = 52) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '').trim().slice(0, max);
}
