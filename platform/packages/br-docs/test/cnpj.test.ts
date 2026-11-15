import { describe, expect, it } from 'vitest';
import { cnpjCheckDigits, formatCnpj, isValidCnpj, maskCnpjInput, normalizeCnpj } from '../src/index.ts';

describe('CNPJ alfanumérico (IN RFB 2.229/2024)', () => {
  it('calcula os DVs do exemplo oficial da Receita (12.ABC.345/01DE-35)', () => {
    expect(cnpjCheckDigits('12ABC34501DE')).toBe('35');
    expect(isValidCnpj('12.ABC.345/01DE-35')).toBe(true);
  });

  it('aceita letras minúsculas e sem máscara', () => {
    expect(isValidCnpj('12abc34501de35')).toBe(true);
    expect(normalizeCnpj(' 12.abc.345/01de-35 ')).toBe('12ABC34501DE35');
  });

  it('rejeita DV errado, letra no DV e tamanho errado', () => {
    expect(isValidCnpj('12ABC34501DE36')).toBe(false);
    expect(isValidCnpj('12ABC34501DE3A')).toBe(false);
    expect(isValidCnpj('12ABC34501DE3')).toBe(false);
    expect(isValidCnpj('12ABC34501DE355')).toBe(false);
  });
});

describe('CNPJ numérico continua válido', () => {
  it('valida CNPJs numéricos reais pelo mesmo cálculo', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11222333000181')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-82')).toBe(false);
  });

  it('rejeita sequências repetidas', () => {
    expect(isValidCnpj('00000000000000')).toBe(false);
    expect(isValidCnpj('11111111111111')).toBe(false);
  });
});

describe('máscaras', () => {
  it('formata no padrão oficial', () => {
    expect(formatCnpj('12abc34501de35')).toBe('12.ABC.345/01DE-35');
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('mascara a digitação aos poucos e só aceita números no DV', () => {
    expect(maskCnpjInput('12a')).toBe('12.A');
    expect(maskCnpjInput('12abc34501de')).toBe('12.ABC.345/01DE');
    expect(maskCnpjInput('12abc34501dex5')).toBe('12.ABC.345/01DE-5');
    expect(maskCnpjInput('12abc34501de35999')).toBe('12.ABC.345/01DE-35');
  });
});
