/**
 * Hook para formatação automática de documentos brasileiros
 * Segue padrões oficiais: CPF (000.000.000-00), CNPJ (00.000.000/0000-00), PIS (000.00000.00-0)
 */

export const formatCPF = (value: string): string => {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
};

export const formatCNPJ = (value: string): string => {
  const numbers = value.replace(/\D/g, '').slice(0, 14);
  
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
  if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
  if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;
  return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12)}`;
};

export const formatPIS = (value: string): string => {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 8) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 10) return `${numbers.slice(0, 3)}.${numbers.slice(3, 8)}.${numbers.slice(8)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 8)}.${numbers.slice(8, 10)}-${numbers.slice(10)}`;
};

export const formatPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  
  if (numbers.length <= 2) return numbers.length > 0 ? `(${numbers}` : '';
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
};

export const formatCEI = (value: string): string => {
  const numbers = value.replace(/\D/g, '').slice(0, 12);
  
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
  if (numbers.length <= 10) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
  if (numbers.length <= 11) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 10)}/${numbers.slice(10)}`;
  return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 10)}/${numbers.slice(10, 12)}`;
};

// Remove formatação para obter apenas números
export const unformatDocument = (value: string): string => {
  return value.replace(/\D/g, '');
};

// Validação de CPF
export const validateCPF = (cpf: string): boolean => {
  const numbers = cpf.replace(/\D/g, '');
  
  if (numbers.length !== 11) return false;
  if (/^(\d)\1+$/.test(numbers)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(numbers[10])) return false;
  
  return true;
};

// Validação de CNPJ
export const validateCNPJ = (cnpj: string): boolean => {
  const numbers = cnpj.replace(/\D/g, '');
  
  if (numbers.length !== 14) return false;
  if (/^(\d)\1+$/.test(numbers)) return false;
  
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(numbers[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(numbers[12])) return false;
  
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(numbers[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(numbers[13])) return false;
  
  return true;
};

// Validação de PIS/NIT
export const validatePIS = (pis: string): boolean => {
  const numbers = pis.replace(/\D/g, '');
  
  if (numbers.length !== 11) return false;
  
  const weights = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers[i]) * weights[i];
  }
  
  let remainder = sum % 11;
  const digit = remainder < 2 ? 0 : 11 - remainder;
  
  return digit === parseInt(numbers[10]);
};

// Hook para uso em inputs controlados
export const useDocumentMask = () => {
  const handleCPFChange = (value: string, onChange: (value: string) => void) => {
    onChange(formatCPF(value));
  };

  const handleCNPJChange = (value: string, onChange: (value: string) => void) => {
    onChange(formatCNPJ(value));
  };

  const handlePISChange = (value: string, onChange: (value: string) => void) => {
    onChange(formatPIS(value));
  };

  const handlePhoneChange = (value: string, onChange: (value: string) => void) => {
    onChange(formatPhone(value));
  };

  const handleCEIChange = (value: string, onChange: (value: string) => void) => {
    onChange(formatCEI(value));
  };

  return {
    handleCPFChange,
    handleCNPJChange,
    handlePISChange,
    handlePhoneChange,
    handleCEIChange,
    formatCPF,
    formatCNPJ,
    formatPIS,
    formatPhone,
    formatCEI,
    unformatDocument,
    validateCPF,
    validateCNPJ,
    validatePIS,
  };
};
