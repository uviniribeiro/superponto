import { describe, expect, it } from 'vitest';
import { formatCpf, isValidCpf, isValidPis } from '../src/index.ts';

describe('CPF', () => {
  it('valida dígitos verificadores', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('52998224726')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
  });
});

describe('PIS/PASEP', () => {
  it('valida dígito verificador', () => {
    expect(isValidPis('120.5646.212-7')).toBe(true);
    expect(isValidPis('12056462127')).toBe(true);
    expect(isValidPis('12056462128')).toBe(false);
    expect(isValidPis('00000000000')).toBe(false);
  });
});
