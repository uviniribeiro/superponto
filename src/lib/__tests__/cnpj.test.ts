import { describe, it, expect } from 'vitest';
import {
  validateCNPJ,
  cleanCNPJ,
  formatCNPJ,
  isAlphanumericCNPJ,
  computeCNPJCheckDigits,
  getCNPJFeedback,
} from '../validators';
import {
  validateCNPJ as validateCNPJBackend,
  cleanCNPJ as cleanCNPJBackend,
  formatCNPJ as formatCNPJBackend,
  isAlphanumericCNPJ as isAlphanumericCNPJBackend,
} from '../../../supabase/functions/_shared/cnpj';

const VALID_NUMERIC = '11.444.777/0001-61';
const VALID_ALPHA = '12ABC34501DE35';
const VALID_ALPHA_2 = 'A1B2C3D4E5F668';

describe('CNPJ numérico', () => {
  it('aceita CNPJ numérico válido com e sem máscara', () => {
    expect(validateCNPJ(VALID_NUMERIC).valid).toBe(true);
    expect(validateCNPJ('11444777000161').valid).toBe(true);
  });

  it('rejeita dígito verificador incorreto', () => {
    const r = validateCNPJ('11444777000162');
    expect(r.valid).toBe(false);
    expect(r.message).toMatch(/dígito verificador/);
  });

  it('rejeita tamanho errado e caracteres repetidos', () => {
    expect(validateCNPJ('1144477700016').valid).toBe(false);
    expect(validateCNPJ('11111111111111').valid).toBe(false);
    expect(validateCNPJ('').valid).toBe(false);
  });
});

describe('CNPJ alfanumérico (Receita Federal 2026)', () => {
  it('aceita CNPJ alfanumérico válido', () => {
    expect(validateCNPJ(VALID_ALPHA).valid).toBe(true);
    expect(validateCNPJ(VALID_ALPHA_2).valid).toBe(true);
    expect(validateCNPJ('12.abc.345/01de-35').valid).toBe(true);
  });

  it('identifica CNPJ alfanumérico', () => {
    expect(isAlphanumericCNPJ(VALID_ALPHA)).toBe(true);
    expect(isAlphanumericCNPJ(VALID_NUMERIC)).toBe(false);
  });

  it('rejeita dígitos verificadores não numéricos', () => {
    const r = validateCNPJ('12ABC34501DEAB');
    expect(r.valid).toBe(false);
    expect(r.message).toMatch(/numéricos/);
  });

  it('rejeita caracteres fora de 0-9 e A-Z', () => {
    expect(validateCNPJ('12@BC34501DE35').valid).toBe(false);
  });

  it('normaliza e formata corretamente', () => {
    expect(cleanCNPJ('12.abc.345/01de-35')).toBe('12ABC34501DE35');
    expect(formatCNPJ('12ABC34501DE35')).toBe('12.ABC.345/01DE-35');
  });
});

describe('Feedback de correção', () => {
  it('sugere os dígitos verificadores corretos', () => {
    expect(computeCNPJCheckDigits('114447770001')).toBe('61');
    const fb = getCNPJFeedback('11444777000162');
    expect(fb.status).toBe('invalid');
    expect(fb.suggestion).toBe('11.444.777/0001-61');
    expect(fb.hint).toContain('61');
  });

  it('informa quantos caracteres faltam', () => {
    const fb = getCNPJFeedback('11.444');
    expect(fb.status).toBe('incomplete');
    expect(fb.message).toContain('9');
  });

  it('marca CNPJ válido e sinaliza alfanumérico', () => {
    const fb = getCNPJFeedback(VALID_ALPHA);
    expect(fb.status).toBe('valid');
    expect(fb.isAlphanumeric).toBe(true);
  });

  it('estado vazio não exibe erro', () => {
    expect(getCNPJFeedback('').status).toBe('empty');
  });
});

describe('Paridade frontend x backend (edge functions)', () => {
  const cases = [
    VALID_NUMERIC,
    '11444777000162',
    VALID_ALPHA,
    VALID_ALPHA_2,
    '12ABC34501DEAB',
    '11111111111111',
    '',
    '123',
  ];

  it('retorna o mesmo resultado de validação nos dois validadores', () => {
    for (const c of cases) {
      expect(validateCNPJBackend(c).valid).toBe(validateCNPJ(c).valid);
      expect(validateCNPJBackend(c).message).toBe(validateCNPJ(c).message);
      expect(cleanCNPJBackend(c)).toBe(cleanCNPJ(c));
      expect(formatCNPJBackend(c)).toBe(formatCNPJ(c));
      expect(isAlphanumericCNPJBackend(c)).toBe(isAlphanumericCNPJ(c));
    }
  });
});
