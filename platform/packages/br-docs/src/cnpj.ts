/**
 * CNPJ numérico e alfanumérico (IN RFB nº 2.229/2024, novas inscrições a partir de julho de 2026).
 *
 * Formato: 12 caracteres de identificação (0-9 e A-Z) + 2 dígitos verificadores numéricos.
 * Cálculo do DV: módulo 11 com pesos 2..9 da direita para a esquerda, e o valor de cada
 * caractere é o seu código ASCII menos 48 (0-9 → 0-9, A → 17 … Z → 42). Para CNPJs só com
 * números o resultado é idêntico ao cálculo antigo, então os cadastros existentes continuam válidos.
 */

const BODY = /^[0-9A-Z]{12}$/;
const FULL = /^[0-9A-Z]{12}[0-9]{2}$/;

/** Remove máscara e espaços e passa letras para maiúsculas: "12.abc.345/01de-35" → "12ABC34501DE35". */
export function normalizeCnpj(value: string): string {
  return value.replace(/[\s./-]/g, '').toUpperCase();
}

function checkDigit(chars: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = chars.length - 1; i >= 0; i--) {
    sum += (chars.charCodeAt(i) - 48) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** Os dois dígitos verificadores para os 12 primeiros caracteres. */
export function cnpjCheckDigits(body: string): string {
  const b = normalizeCnpj(body);
  if (!BODY.test(b)) throw new Error('A base do CNPJ tem 12 caracteres (letras A-Z ou números)');
  const d1 = checkDigit(b);
  const d2 = checkDigit(b + d1);
  return `${d1}${d2}`;
}

/** CNPJ válido (com ou sem máscara, numérico ou alfanumérico). */
export function isValidCnpj(value: string): boolean {
  const v = normalizeCnpj(value);
  if (!FULL.test(v)) return false;
  if (/^(.)\1{13}$/.test(v)) return false; // 00000000000000, 11111111111111…
  return v.slice(12) === cnpjCheckDigits(v.slice(0, 12));
}

/** Máscara oficial XX.XXX.XXX/XXXX-DD; devolve o valor como veio se não tiver 14 caracteres. */
export function formatCnpj(value: string): string {
  const v = normalizeCnpj(value);
  if (v.length !== 14) return value;
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
}

/** Máscara progressiva para campos de digitação (aceita letras nas 12 primeiras posições). */
export function maskCnpjInput(value: string): string {
  const raw = normalizeCnpj(value).replace(/[^0-9A-Z]/g, '');
  const body = raw.slice(0, 12);
  const dv = raw.slice(12).replace(/\D/g, '').slice(0, 2);
  const v = body + (body.length === 12 ? dv : '');
  let out = v.slice(0, 2);
  if (v.length > 2) out += `.${v.slice(2, 5)}`;
  if (v.length > 5) out += `.${v.slice(5, 8)}`;
  if (v.length > 8) out += `/${v.slice(8, 12)}`;
  if (v.length > 12) out += `-${v.slice(12, 14)}`;
  return out;
}
