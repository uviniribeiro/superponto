/**
 * Validação de CNPJ numérico e alfanumérico (Receita Federal — IN RFB nº 2.229/2024, vigente 2026).
 * Estrutura: 12 posições alfanuméricas (0-9, A-Z) + 2 dígitos verificadores numéricos.
 * O DV usa o valor ASCII do caractere menos 48.
 *
 * Compartilhado por todas as edge functions que gravam ou consultam CNPJ.
 */

const WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function cleanCNPJ(cnpj: string): string {
  return (cnpj || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function isAlphanumericCNPJ(cnpj: string): boolean {
  return /[A-Z]/.test(cleanCNPJ(cnpj));
}

export function formatCNPJ(cnpj: string): string {
  const c = cleanCNPJ(cnpj);
  if (c.length !== 14) return cnpj;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

function checkDigit(base: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    sum += (base.charCodeAt(i) - 48) * weights[i];
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function validateCNPJ(cnpj: string): { valid: boolean; message: string } {
  const clean = cleanCNPJ(cnpj);

  if (clean.length !== 14) {
    return { valid: false, message: 'CNPJ deve ter 14 caracteres' };
  }
  if (!/^\d{2}$/.test(clean.slice(12))) {
    return { valid: false, message: 'CNPJ inválido - dígitos verificadores devem ser numéricos' };
  }
  if (!/^[0-9A-Z]{12}$/.test(clean.slice(0, 12))) {
    return { valid: false, message: 'CNPJ inválido - use apenas números e letras (A-Z)' };
  }
  if (/^(.)\1{13}$/.test(clean)) {
    return { valid: false, message: 'CNPJ inválido - caracteres repetidos' };
  }

  const base = clean.slice(0, 12);
  const digits = clean.slice(12);

  if (checkDigit(base, WEIGHTS_1) !== parseInt(digits.charAt(0))) {
    return { valid: false, message: 'CNPJ inválido - primeiro dígito verificador incorreto' };
  }
  if (checkDigit(base + digits.charAt(0), WEIGHTS_2) !== parseInt(digits.charAt(1))) {
    return { valid: false, message: 'CNPJ inválido - segundo dígito verificador incorreto' };
  }

  return { valid: true, message: isAlphanumericCNPJ(clean) ? 'CNPJ alfanumérico válido' : 'CNPJ válido' };
}
