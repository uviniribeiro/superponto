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



/* ------------------------------------------------------------------
 * Validações gerais do sistema (contato, endereço, datas, documentos)
 * ------------------------------------------------------------------ */

export interface ValidationResult { valid: boolean; message: string }

const ok = (message = ''): ValidationResult => ({ valid: true, message });
const fail = (message: string): ValidationResult => ({ valid: false, message });

/** E-mail (RFC simplificado) */
export function validateEmail(email: string): ValidationResult {
  const value = (email || '').trim();
  if (!value) return fail('Informe o e-mail');
  if (value.length > 255) return fail('E-mail muito longo (máximo 255 caracteres)');
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(value)) {
    return fail('E-mail inválido — use o formato nome@dominio.com.br');
  }
  return ok('E-mail válido');
}

/** Telefone fixo ou celular brasileiro (10 ou 11 dígitos com DDD) */
export function validatePhone(phone: string): ValidationResult {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return fail('Informe o telefone');
  if (digits.length < 10 || digits.length > 11) {
    return fail('Telefone inválido — informe DDD + número (10 ou 11 dígitos)');
  }
  const ddd = parseInt(digits.slice(0, 2), 10);
  if (ddd < 11 || ddd > 99) return fail('DDD inválido');
  if (digits.length === 11 && digits.charAt(2) !== '9') {
    return fail('Celular inválido — o número deve começar com 9 após o DDD');
  }
  return ok('Telefone válido');
}

export function formatPhone(phone: string): string {
  const d = (phone || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/[-\s()]*$/, '');
  return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
}

/** CEP brasileiro (8 dígitos) */
export function validateCEP(cep: string): ValidationResult {
  const digits = (cep || '').replace(/\D/g, '');
  if (!digits) return fail('Informe o CEP');
  if (digits.length !== 8) return fail('CEP inválido — deve conter 8 dígitos');
  if (/^(\d)\1{7}$/.test(digits)) return fail('CEP inválido — dígitos repetidos');
  return ok('CEP válido');
}

export function formatCEP(cep: string): string {
  const d = (cep || '').replace(/\D/g, '').slice(0, 8);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export const BRAZILIAN_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR',
  'PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
] as const;

export function validateState(uf: string): ValidationResult {
  const value = (uf || '').toUpperCase().trim();
  if (!value) return fail('Selecione o estado (UF)');
  return (BRAZILIAN_STATES as readonly string[]).includes(value)
    ? ok('UF válida')
    : fail('UF inválida — use a sigla de 2 letras do estado');
}

export interface AddressInput {
  street?: string;
  number?: string;
  district?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  complement?: string;
}

/** Valida endereço completo, retornando erro por campo */
export function validateAddress(address: AddressInput): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!address.street || address.street.trim().length < 3) {
    errors.street = 'Informe o logradouro (rua, avenida...) com pelo menos 3 caracteres';
  }
  if (!address.number || !address.number.trim()) {
    errors.number = 'Informe o número ou "S/N" quando não houver';
  }
  if (!address.district || address.district.trim().length < 2) {
    errors.district = 'Informe o bairro';
  }
  if (!address.city || address.city.trim().length < 2) {
    errors.city = 'Informe a cidade';
  }
  const uf = validateState(address.state || '');
  if (!uf.valid) errors.state = uf.message;

  const cep = validateCEP(address.zipCode || '');
  if (!cep.valid) errors.zipCode = cep.message;

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Data de nascimento: idade entre 14 e 120 anos, sem datas futuras */
export function validateBirthDate(date: string | Date): ValidationResult {
  if (!date) return fail('Informe a data de nascimento');
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return fail('Data inválida');
  const today = new Date();
  if (value > today) return fail('A data de nascimento não pode ser futura');
  let age = today.getFullYear() - value.getFullYear();
  const m = today.getMonth() - value.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < value.getDate())) age--;
  if (age < 14) return fail('Idade mínima permitida para admissão é 14 anos (menor aprendiz)');
  if (age > 120) return fail('Data de nascimento improvável — confira o ano informado');
  return ok('Data válida');
}

/** Data de admissão: não pode ser futura além de 1 ano nem anterior a 1900 */
export function validateAdmissionDate(date: string | Date): ValidationResult {
  if (!date) return fail('Informe a data de admissão');
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return fail('Data inválida');
  if (value.getFullYear() < 1900) return fail('Data de admissão improvável — confira o ano');
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() + 1);
  if (value > limit) return fail('A data de admissão não pode ser mais de 1 ano no futuro');
  return ok('Data válida');
}

/** CTPS: número (5 a 8 dígitos) e série (3 a 5 dígitos) */
export function validateCTPS(number: string, series?: string): ValidationResult {
  const n = (number || '').replace(/\D/g, '');
  if (!n) return fail('Informe o número da CTPS');
  if (n.length < 5 || n.length > 8) return fail('Número da CTPS inválido — use de 5 a 8 dígitos');
  if (series !== undefined && series !== '') {
    const s = series.replace(/\D/g, '');
    if (s.length < 3 || s.length > 5) return fail('Série da CTPS inválida — use de 3 a 5 dígitos');
  }
  return ok('CTPS válida');
}

/** RG: 5 a 14 caracteres alfanuméricos */
export function validateRG(rg: string): ValidationResult {
  const value = (rg || '').replace(/[^0-9A-Za-z]/g, '');
  if (!value) return fail('Informe o RG');
  if (value.length < 5 || value.length > 14) return fail('RG inválido — verifique o número informado');
  return ok('RG válido');
}

/** Texto obrigatório com limites */
export function validateRequiredText(value: string, label: string, min = 2, max = 255): ValidationResult {
  const v = (value || '').trim();
  if (!v) return fail(`Informe ${label}`);
  if (v.length < min) return fail(`${label} deve ter pelo menos ${min} caracteres`);
  if (v.length > max) return fail(`${label} deve ter no máximo ${max} caracteres`);
  return ok();
}

/** Horário HH:MM */
export function validateTime(time: string): ValidationResult {
  if (!time) return fail('Informe o horário');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return fail('Horário inválido — use o formato HH:MM');
  return ok('Horário válido');
}

/** Latitude/longitude */
export function validateCoordinates(lat: number | string, lng: number | string): ValidationResult {
  const la = typeof lat === 'string' ? parseFloat(lat) : lat;
  const lo = typeof lng === 'string' ? parseFloat(lng) : lng;
  if (Number.isNaN(la) || Number.isNaN(lo)) return fail('Coordenadas inválidas');
  if (la < -90 || la > 90) return fail('Latitude deve estar entre -90 e 90');
  if (lo < -180 || lo > 180) return fail('Longitude deve estar entre -180 e 180');
  return ok('Coordenadas válidas');
}
