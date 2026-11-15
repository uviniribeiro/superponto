import { describe, expect, it } from 'vitest';
import { afdDateTime, afdHeader671, afdRecord7, afdTrailer671, crc16, parseAfd } from '../src/index.ts';

describe('AFD do REP-P (Portaria 671)', () => {
  it('CRC-16/KERMIT com o vetor de referência', () => {
    expect(crc16('123456789')).toBe('2189'); // valor de verificação do CRC-16/KERMIT
  });

  it('data e hora com fuso', () => {
    expect(afdDateTime(new Date('2026-11-03T10:58:30Z'))).toBe('2026-11-03T07:58:00-0300');
    expect(afdDateTime(new Date('2026-11-03T10:58:30Z'), 'America/Sao_Paulo', true)).toBe('2026-11-03T07:58:30-0300');
    expect(afdDateTime(new Date('2026-11-03T10:58:30Z'), 'America/Manaus')).toBe('2026-11-03T06:58:00-0400');
  });

  it('arquivo completo é lido pelo leitor oficial: cabeçalho, tipo 7 com hash encadeado e trailer', () => {
    const header = afdHeader671({ employerIdType: 'CNPJ', employerId: '11.222.333/0001-81', employerName: 'Clínica Vida Ltda', repId: '12345678901234567', periodStart: '2026-11-01', periodEnd: '2026-11-30', generatedAt: new Date('2026-12-01T11:00:00Z'), developerId: '11222333000181', model: 'SuperPonto' });
    const r1 = afdRecord7({ nsr: 1, at: new Date('2026-11-03T10:58:00Z'), cpf: '529.982.247-25', recordedAt: new Date('2026-11-03T10:58:04Z'), collector: '02', offline: false }, null);
    const r2 = afdRecord7({ nsr: 2, at: new Date('2026-11-03T15:01:00Z'), cpf: '52998224725', recordedAt: new Date('2026-11-03T15:01:02Z'), collector: '01', offline: true }, r1.hash);
    expect(r2.hash).not.toBe(afdRecord7({ nsr: 2, at: new Date('2026-11-03T15:01:00Z'), cpf: '52998224725', recordedAt: new Date('2026-11-03T15:01:02Z'), collector: '01', offline: true }, null).hash);
    const file = [header, r1.line, r2.line, afdTrailer671({ '7': 2 })].join('\r\n');
    const p = parseAfd(file);
    expect(p.layout).toBe('671');
    expect(p.header).toMatchObject({ employerId: '11222333000181', employerName: 'Clinica Vida Ltda', repId: '12345678901234567', periodStart: '2026-11-01', periodEnd: '2026-11-30', layoutVersion: '003' });
    expect(p.punches.map((x) => [x.nsr, x.recordType, x.workerId, x.collector, x.connectionFlag])).toEqual([[1, '7', '52998224725', '02', '0'], [2, '7', '52998224725', '01', '1']]);
    expect(p.punches[1]!.hash).toBe(r2.hash);
    expect(p.warnings).toEqual([]);
    expect(header.length).toBe(302);
  });
});
