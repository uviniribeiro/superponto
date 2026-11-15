import { describe, expect, it } from 'vitest';
import { parseAfd } from '../src/index.ts';

const L = (v: string | number, n: number) => String(v).padStart(n, '0').slice(-n);
const R = (v: string, n: number) => v.padEnd(n, ' ').slice(0, n);

// ---------------------------------------------------------------- Portaria 1510/2009
const h1510 = L(0, 9) + '1' + '1' + '11222333000181' + R('', 12) + R('EMPRESA TESTE LTDA', 150) + L('00004004330001234', 17) + '01112026' + '30112026' + '01122026' + '0800';
const e1510 = L(1, 9) + '5' + '01112026' + '0745' + 'I' + L('12056462127', 12) + R('MARIA DA SILVA', 52);
const p1510a = L(2, 9) + '3' + '03112026' + '0758' + L('12056462127', 12);
const p1510b = L(3, 9) + '3' + '03112026' + '1702' + L('12056462127', 12);
const c1510 = L(4, 9) + '4' + '03112026' + '1800' + '03112026' + '1801';
const t1510 = '999999999' + L(0, 9) + L(2, 9) + L(1, 9) + L(1, 9) + '9';

describe('AFD Portaria 1510/2009', () => {
  const res = parseAfd([h1510, e1510, p1510a, p1510b, c1510, t1510].join('\r\n'));

  it('detecta o leiaute e lê o cabeçalho', () => {
    expect(h1510).toHaveLength(232);
    expect(res.layout).toBe('1510');
    expect(res.header).toMatchObject({ employerIdType: 'CNPJ', employerId: '11222333000181', employerName: 'EMPRESA TESTE LTDA', repId: '00004004330001234' });
  });

  it('lê marcações pelo PIS, no fuso do equipamento (sem fuso no arquivo)', () => {
    expect(p1510a).toHaveLength(34);
    expect(res.punches).toHaveLength(2);
    expect(res.punches[0]).toMatchObject({ nsr: 2, workerId: '12056462127', workerIdType: 'PIS', recordType: '3' });
    expect(res.punches[0]!.occurredAt.toISOString()).toBe('2026-11-03T10:58:00.000Z'); // 07:58 em São Paulo (UTC-3)
  });

  it('lê inclusão de empregado e ajuste de relógio, e confere o trailer', () => {
    expect(e1510).toHaveLength(87);
    expect(res.records.find((r) => r.kind === 'employee')).toMatchObject({ operation: 'I', name: 'MARIA DA SILVA', workerId: '12056462127' });
    expect(res.records.find((r) => r.kind === 'clock')).toBeTruthy();
    expect(res.trailer).toMatchObject({ '3': 2, '5': 1 });
    expect(res.warnings).toEqual([]);
  });

  it('usa o fuso informado para equipamentos fora de Brasília', () => {
    const r = parseAfd([h1510, p1510a].join('\n'), { timeZone: 'America/Manaus' });
    expect(r.punches[0]!.occurredAt.toISOString()).toBe('2026-11-03T11:58:00.000Z');
  });

  it('avisa sobre lacuna de NSR e linha corrompida sem parar a leitura', () => {
    const gap = L(9, 9) + '3' + '03112026' + '1800' + L('12056462127', 12);
    const bad = L(10, 9) + '3' + '99999999' + '9999' + L('12056462127', 12);
    const r = parseAfd([h1510, p1510a, gap, bad].join('\n'));
    expect(r.punches).toHaveLength(2);
    expect(r.warnings.some((w) => w.includes('lacuna de NSR'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('linha 4') && w.includes('data inválida'))).toBe(true);
  });
});

// ---------------------------------------------------------------- Portaria 671/2021
const h671 = L(0, 9) + '1' + '1' + R('12ABC34501DE35', 14) + R('', 14) + R('CLINICA VIDA LTDA', 150) + R('BR512024000001', 17) + '2026-11-01' + '2026-11-30' + '2026-12-01T08:00:00-0300' + '003' + '1' + '11222333000181' + R('MODELO X', 30) + 'ABCD';
const p671 = L(1, 9) + '3' + '2026-11-03T07:58:00-0300' + L('52998224725', 12) + 'A1B2';
const r671 = L(2, 9) + '7' + '2026-11-03T12:01:00-0300' + L('52998224725', 12) + '2026-11-03T12:01:05-0300' + '02' + '0' + 'a'.repeat(64);
const e671 = L(3, 9) + '5' + '2026-11-03T13:00:00-0300' + 'I' + L('52998224725', 12) + R('JOAO PEREIRA', 52) + R('', 4) + '52998224725' + 'FFFF';
const ev671 = L(4, 9) + '6' + '2026-11-03T14:00:00-0300' + '07';
const t671 = '999999999' + L(0, 9) + L(1, 9) + L(0, 9) + L(1, 9) + L(1, 9) + L(1, 9) + '9';

describe('AFD Portaria 671/2021', () => {
  const res = parseAfd([h671, p671, r671, e671, ev671, t671].join('\n'));

  it('detecta o leiaute e lê o cabeçalho, inclusive CNPJ alfanumérico', () => {
    expect(h671).toHaveLength(302);
    expect(res.layout).toBe('671');
    expect(res.header).toMatchObject({ employerId: '12ABC34501DE35', employerName: 'CLINICA VIDA LTDA', layoutVersion: '003', manufacturerId: '11222333000181', model: 'MODELO X' });
  });

  it('lê marcações REP-C (tipo 3) e REP-P (tipo 7) pelo CPF, com fuso do arquivo', () => {
    expect(p671).toHaveLength(50);
    expect(r671).toHaveLength(137);
    expect(res.punches.map((p) => [p.recordType, p.workerId, p.occurredAt.toISOString()])).toEqual([
      ['3', '52998224725', '2026-11-03T10:58:00.000Z'],
      ['7', '52998224725', '2026-11-03T15:01:00.000Z'],
    ]);
    expect(res.punches[1]).toMatchObject({ collector: '02', connectionFlag: '0', hash: 'a'.repeat(64) });
  });

  it('lê empregado e eventos sensíveis, e confere o trailer', () => {
    expect(e671).toHaveLength(118);
    expect(res.records.find((r) => r.kind === 'employee')).toMatchObject({ name: 'JOAO PEREIRA', workerIdType: 'CPF' });
    expect(res.records.find((r) => r.kind === 'event')).toMatchObject({ code: '07' });
    expect(res.warnings).toEqual([]);
  });

  it('detecta o leiaute 671 mesmo sem cabeçalho', () => {
    expect(parseAfd(p671).layout).toBe('671');
  });
});
