import { describe, expect, it } from 'vitest';
import { buildAfdLines, cleanCNPJ, cleanPIS, padLeft, padRight } from '../afd';

const company = {
  company_name: 'Empresa Teste Ltda',
  cnpj: '12.345.678/0001-95',
  cei: null,
  rep_number: '00004000000000123',
};

const employees = [
  { id: 'a', full_name: 'Maria da Silva', pis: '123.45678.90-1' },
  { id: 'b', full_name: 'João Souza', pis: null },
];

const build = (punches: { profile_id: string; recorded_at: string }[] = []) =>
  buildAfdLines({
    company,
    employees,
    punches,
    periodStart: new Date(2026, 9, 1),
    periodEnd: new Date(2026, 9, 31),
    generatedAt: new Date(2026, 10, 1, 9, 5),
  });

describe('helpers', () => {
  it('padLeft completa com zeros e preserva os dígitos finais ao exceder', () => {
    expect(padLeft(7, 9)).toBe('000000007');
    expect(padLeft('123456', 4)).toBe('3456');
  });

  it('padRight completa com espaços, trunca e remove quebras de linha', () => {
    expect(padRight('abc', 5)).toBe('abc  ');
    expect(padRight('abcdef', 3)).toBe('abc');
    expect(padRight('a\r\nb', 4)).toBe('a b ');
  });

  it('normaliza CNPJ e PIS', () => {
    expect(cleanCNPJ('12.345.678/0001-95')).toBe('12345678000195');
    expect(cleanCNPJ(null)).toBe('00000000000000');
    expect(cleanPIS('123.45678.90-1')).toBe('12345678901');
    expect(cleanPIS(null)).toBe('00000000000');
  });
});

describe('buildAfdLines', () => {
  it('gera cabeçalho com largura fixa e datas do período', () => {
    const [header] = build();
    expect(header).toHaveLength(1 + 1 + 14 + 12 + 150 + 17 + 8 + 8 + 8 + 4);
    expect(header.slice(0, 16)).toBe('1112345678000195');
    expect(header.slice(-28)).toBe('0110202631102026011120260905');
  });

  it('gera um registro tipo 2 por empregado com NSR sequencial', () => {
    const lines = build();
    expect(lines[1]).toBe('2000000002I112345678901' + 'Maria da Silva'.padEnd(52));
    expect(lines[2].slice(0, 11)).toBe('2000000003I');
    expect(lines[2]).toHaveLength(1 + 9 + 1 + 1 + 11 + 52);
  });

  it('gera marcações tipo 3, ignora perfis não exportados e fecha com trailer', () => {
    const lines = build([
      { profile_id: 'a', recorded_at: new Date(2026, 9, 5, 8, 2).toISOString() },
      { profile_id: 'z', recorded_at: new Date(2026, 9, 5, 8, 3).toISOString() },
      { profile_id: 'b', recorded_at: new Date(2026, 9, 5, 17, 45).toISOString() },
    ]);
    expect(lines).toHaveLength(1 + 2 + 2 + 1);
    expect(lines[3]).toBe('3000000004112345678901051020260802');
    expect(lines[4]).toBe('3000000005100000000000051020261745');
    expect(lines[5]).toBe('9000000006');
  });

  it('mantém a largura do cabeçalho mesmo com campos longos', () => {
    const [header] = buildAfdLines({
      company: { ...company, company_name: 'X'.repeat(300), rep_number: '9'.repeat(30), cei: '1'.repeat(20) },
      employees: [],
      punches: [],
      periodStart: new Date(2026, 9, 1),
      periodEnd: new Date(2026, 9, 31),
      generatedAt: new Date(2026, 10, 1),
    });
    expect(header).toHaveLength(223);
  });
});
