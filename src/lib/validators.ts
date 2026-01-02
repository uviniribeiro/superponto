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
 * Valida CNPJ com dígito verificador
 * @param cnpj - CNPJ com ou sem formatação
 * @returns objeto com status de validação e mensagem
 */
export function validateCNPJ(cnpj: string): { valid: boolean; message: string } {
  const cleanCNPJ = cnpj.replace(/[^\d]/g, '');
  
  if (cleanCNPJ.length !== 14) {
    return { valid: false, message: 'CNPJ deve ter 14 dígitos' };
  }
  
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) {
    return { valid: false, message: 'CNPJ inválido - dígitos repetidos' };
  }
  
  // Calcula primeiro dígito verificador
  let size = cleanCNPJ.length - 2;
  let numbers = cleanCNPJ.substring(0, size);
  const digits = cleanCNPJ.substring(size);
  let sum = 0;
  let pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) {
    return { valid: false, message: 'CNPJ inválido - primeiro dígito verificador incorreto' };
  }
  
  // Calcula segundo dígito verificador
  size = size + 1;
  numbers = cleanCNPJ.substring(0, size);
  sum = 0;
  pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) {
    return { valid: false, message: 'CNPJ inválido - segundo dígito verificador incorreto' };
  }
  
  return { valid: true, message: 'CNPJ válido' };
}

/**
 * Formata CNPJ para exibição
 * @param cnpj - CNPJ sem formatação
 * @returns CNPJ formatado (00.000.000/0000-00)
 */
export function formatCNPJ(cnpj: string): string {
  const cleanCNPJ = cnpj.replace(/[^\d]/g, '');
  if (cleanCNPJ.length !== 14) return cnpj;
  return cleanCNPJ.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}
