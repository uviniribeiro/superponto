/**
 * Validadores de documentos brasileiros - CPF e PIS
 * Conforme exigências da Portaria 671 do MTE
 */

/**
 * Valida CPF com dígito verificador
 * @param cpf - CPF com ou sem formatação
 * @returns objeto com status de validação e mensagem
 */
export function validateCPF(cpf: string): { valid: boolean; message: string } {
  // Remove caracteres não numéricos
  const cleanCPF = cpf.replace(/[^\d]/g, '');
  
  // Verifica se tem 11 dígitos
  if (cleanCPF.length !== 11) {
    return { valid: false, message: 'CPF deve ter 11 dígitos' };
  }
  
  // Verifica se todos os dígitos são iguais (CPFs inválidos conhecidos)
  if (/^(\d)\1{10}$/.test(cleanCPF)) {
    return { valid: false, message: 'CPF inválido - dígitos repetidos' };
  }
  
  // Calcula primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  
  if (remainder !== parseInt(cleanCPF.charAt(9))) {
    return { valid: false, message: 'CPF inválido - primeiro dígito verificador incorreto' };
  }
  
  // Calcula segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  
  if (remainder !== parseInt(cleanCPF.charAt(10))) {
    return { valid: false, message: 'CPF inválido - segundo dígito verificador incorreto' };
  }
  
  return { valid: true, message: 'CPF válido' };
}

/**
 * Valida PIS/PASEP com dígito verificador
 * @param pis - PIS com ou sem formatação (11 dígitos)
 * @returns objeto com status de validação e mensagem
 */
export function validatePIS(pis: string): { valid: boolean; message: string } {
  // Remove caracteres não numéricos
  const cleanPIS = pis.replace(/[^\d]/g, '');
  
  // Verifica se tem 11 dígitos
  if (cleanPIS.length !== 11) {
    return { valid: false, message: 'PIS deve ter 11 dígitos' };
  }
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cleanPIS)) {
    return { valid: false, message: 'PIS inválido - dígitos repetidos' };
  }
  
  // Multiplicadores para cálculo do PIS
  const multiplicadores = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  // Calcula dígito verificador
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanPIS.charAt(i)) * multiplicadores[i];
  }
  
  let remainder = sum % 11;
  let digit = remainder < 2 ? 0 : 11 - remainder;
  
  if (digit !== parseInt(cleanPIS.charAt(10))) {
    return { valid: false, message: 'PIS inválido - dígito verificador incorreto' };
  }
  
  return { valid: true, message: 'PIS válido' };
}

/**
 * Formata CPF para exibição
 * @param cpf - CPF sem formatação
 * @returns CPF formatado (000.000.000-00)
 */
export function formatCPF(cpf: string): string {
  const cleanCPF = cpf.replace(/[^\d]/g, '');
  if (cleanCPF.length !== 11) return cpf;
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata PIS para exibição
 * @param pis - PIS sem formatação
 * @returns PIS formatado (000.00000.00-0)
 */
export function formatPIS(pis: string): string {
  const cleanPIS = pis.replace(/[^\d]/g, '');
  if (cleanPIS.length !== 11) return pis;
  return cleanPIS.replace(/(\d{3})(\d{5})(\d{2})(\d{1})/, '$1.$2.$3-$4');
}

/**
 * CNPJ Alfanumérico (Receita Federal — vigente a partir de 2026, IN RFB nº 2.229/2024).
 * Estrutura: 12 posições alfanuméricas (0-9, A-Z) + 2 dígitos verificadores numéricos.
 * O DV é calculado com o valor ASCII do caractere menos 48.
 */
const CNPJ_WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Remove máscara e normaliza para maiúsculas, mantendo apenas [0-9A-Z] */
export function cleanCNPJ(cnpj: string): string {
  return (cnpj || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** Retorna true se o CNPJ contém letras (novo formato alfanumérico) */
export function isAlphanumericCNPJ(cnpj: string): boolean {
  return /[A-Z]/.test(cleanCNPJ(cnpj));
}

function cnpjCharValue(char: string): number {
  return char.charCodeAt(0) - 48;
}

function cnpjCheckDigit(base: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    sum += cnpjCharValue(base.charAt(i)) * weights[i];
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/**
 * Valida CNPJ numérico ou alfanumérico (padrão Receita Federal 2026)
 */
export function validateCNPJ(cnpj: string): { valid: boolean; message: string } {
  const clean = cleanCNPJ(cnpj);

  if (clean.length !== 14) {
    return { valid: false, message: 'CNPJ deve ter 14 caracteres' };
  }

  // Os dois últimos caracteres (DV) devem ser sempre numéricos
  if (!/^\d{2}$/.test(clean.slice(12))) {
    return { valid: false, message: 'CNPJ inválido - dígitos verificadores devem ser numéricos' };
  }

  // Raiz/ordem: 12 posições alfanuméricas
  if (!/^[0-9A-Z]{12}$/.test(clean.slice(0, 12))) {
    return { valid: false, message: 'CNPJ inválido - use apenas números e letras (A-Z)' };
  }

  if (/^(.)\1{13}$/.test(clean)) {
    return { valid: false, message: 'CNPJ inválido - caracteres repetidos' };
  }

  const base = clean.slice(0, 12);
  const digits = clean.slice(12);

  if (cnpjCheckDigit(base, CNPJ_WEIGHTS_1) !== parseInt(digits.charAt(0))) {
    return { valid: false, message: 'CNPJ inválido - primeiro dígito verificador incorreto' };
  }

  if (cnpjCheckDigit(base + digits.charAt(0), CNPJ_WEIGHTS_2) !== parseInt(digits.charAt(1))) {
    return { valid: false, message: 'CNPJ inválido - segundo dígito verificador incorreto' };
  }

  return { valid: true, message: isAlphanumericCNPJ(clean) ? 'CNPJ alfanumérico válido' : 'CNPJ válido' };
}

/**
 * Formata CNPJ (numérico ou alfanumérico) para exibição: 00.000.000/0000-00
 */
export function formatCNPJ(cnpj: string): string {
  const clean = cleanCNPJ(cnpj);
  if (clean.length !== 14) return cnpj;
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`;
}

/**
 * Calcula os 2 dígitos verificadores esperados para uma raiz de 12 caracteres.
 * Retorna null quando a raiz não é válida.
 */
export function computeCNPJCheckDigits(base: string): string | null {
  const clean = cleanCNPJ(base).slice(0, 12);
  if (!/^[0-9A-Z]{12}$/.test(clean)) return null;
  const d1 = cnpjCheckDigit(clean, CNPJ_WEIGHTS_1);
  const d2 = cnpjCheckDigit(`${clean}${d1}`, CNPJ_WEIGHTS_2);
  return `${d1}${d2}`;
}

export interface CnpjFeedback {
  status: 'empty' | 'incomplete' | 'invalid' | 'valid';
  message: string;
  hint?: string;
  suggestion?: string;
  isAlphanumeric: boolean;
}

/**
 * Feedback detalhado para exibição em formulários: o que está errado e como corrigir.
 */
export function getCNPJFeedback(cnpj: string): CnpjFeedback {
  const clean = cleanCNPJ(cnpj);
  const isAlphanumeric = /[A-Z]/.test(clean);

  if (clean.length === 0) {
    return {
      status: 'empty',
      message: '',
      hint: 'Aceita CNPJ numérico ou alfanumérico (padrão Receita Federal 2026).',
      isAlphanumeric,
    };
  }

  if (clean.length < 14) {
    return {
      status: 'incomplete',
      message: `CNPJ incompleto — faltam ${14 - clean.length} caractere(s) de 14.`,
      hint: 'Formato: 12 caracteres (números ou letras A-Z) + 2 dígitos verificadores numéricos.',
      isAlphanumeric,
    };
  }

  const result = validateCNPJ(cnpj);
  if (result.valid) {
    return {
      status: 'valid',
      message: result.message,
      isAlphanumeric,
    };
  }

  // Dígito verificador incorreto → sugere o valor correto para a raiz digitada
  if (result.message.includes('dígito verificador')) {
    const expected = computeCNPJCheckDigits(clean.slice(0, 12));
    const suggestion = expected ? formatCNPJ(`${clean.slice(0, 12)}${expected}`) : undefined;
    return {
      status: 'invalid',
      message: 'Dígito verificador não confere com a raiz informada.',
      hint: expected
        ? `Para a raiz ${clean.slice(0, 12)}, os dígitos verificadores corretos são “${expected}”. Confira o CNPJ no cartão da Receita Federal ou corrija os 2 últimos dígitos.`
        : 'Confira o CNPJ no cartão CNPJ da Receita Federal.',
      suggestion,
      isAlphanumeric,
    };
  }

  return {
    status: 'invalid',
    message: result.message,
    hint: 'Use 12 caracteres alfanuméricos (0-9, A-Z) seguidos de 2 dígitos verificadores numéricos.',
    isAlphanumeric,
  };
}


