import { describe, expect, it } from 'vitest';
import { buildAej } from '../aej';

const person = { id: 'p1', full_name: 'José da Silva', registration_number: '10', department: null, position: null, pis: null, cpf: '529.982.247-25' };
const result = { isAbsent: false, expectedMinutes: 480 } as any;

describe('AEJ', () => {
  it('gera registros 01..08 e o trailer com as contagens', () => {
    const { content, warnings } = buildAej({
      company: { cnpj: '11.222.333/0001-81', name: 'Empresa Ltda' }, from: '2026-11-01', to: '2026-11-30', repP: '12345678901234567',
      days: [{ person, date: '2026-11-03', scheduled: true, result, punches: [{ type: 'entry', at: '2026-11-03T11:00:00Z', mobile: false }, { type: 'exit', at: '2026-11-03T20:00:00Z', mobile: false }] }],
    });
    const lines = content.trim().split('\r\n');
    expect(lines[0].startsWith('01|1|11222333000181|')).toBe(true);
    expect(lines.find((l) => l.startsWith('03|'))).toBe('03|1|52998224725|Jose da Silva');
    expect(lines.filter((l) => l.startsWith('05|'))).toEqual(['05|1|2026-11-03T08:00:00-0300|1|E|1|O|1|', '05|1|2026-11-03T17:00:00-0300|1|S|1|O|1|']);
    expect(lines.at(-1)).toBe('99|1|1|1|1|2|1|0|1');
    expect(warnings).toEqual([]);
  });
});
