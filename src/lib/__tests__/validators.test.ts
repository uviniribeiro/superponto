import { describe, it, expect } from 'vitest';
import { validateCPF, validateCNPJ, validatePIS, formatCPF, formatCNPJ, formatPIS } from '../validators';

describe('CPF Validator', () => {
  it('should validate correct CPF', () => {
    expect(validateCPF('529.982.247-25').valid).toBe(true);
    expect(validateCPF('52998224725').valid).toBe(true);
  });

  it('should reject invalid CPF', () => {
    expect(validateCPF('111.111.111-11').valid).toBe(false);
    expect(validateCPF('123.456.789-00').valid).toBe(false);
    expect(validateCPF('').valid).toBe(false);
  });

  it('should reject CPF with wrong length', () => {
    expect(validateCPF('1234567890').valid).toBe(false);
    expect(validateCPF('123456789012').valid).toBe(false);
  });
});

describe('CNPJ Validator', () => {
  it('should validate correct CNPJ', () => {
    expect(validateCNPJ('11.444.777/0001-61').valid).toBe(true);
    expect(validateCNPJ('11444777000161').valid).toBe(true);
  });

  it('should reject invalid CNPJ', () => {
    expect(validateCNPJ('11.111.111/1111-11').valid).toBe(false);
    expect(validateCNPJ('12.345.678/0001-00').valid).toBe(false);
    expect(validateCNPJ('').valid).toBe(false);
  });
});

describe('PIS Validator', () => {
  it('should validate correct PIS', () => {
    expect(validatePIS('170.71332.43-4').valid).toBe(true);
    expect(validatePIS('17071332434').valid).toBe(true);
  });

  it('should reject invalid PIS', () => {
    expect(validatePIS('111.11111.11-1').valid).toBe(false);
    expect(validatePIS('').valid).toBe(false);
  });
});

describe('Format Functions', () => {
  it('should format CPF correctly', () => {
    expect(formatCPF('52998224725')).toBe('529.982.247-25');
  });

  it('should format CNPJ correctly', () => {
    expect(formatCNPJ('11444777000161')).toBe('11.444.777/0001-61');
  });

  it('should format PIS correctly', () => {
    expect(formatPIS('17071332434')).toBe('170.71332.43-4');
  });

  it('should return original value if invalid length', () => {
    expect(formatCPF('123')).toBe('123');
    expect(formatCNPJ('123')).toBe('123');
    expect(formatPIS('123')).toBe('123');
  });
});
