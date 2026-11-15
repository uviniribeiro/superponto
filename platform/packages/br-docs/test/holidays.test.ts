import { describe, expect, it } from 'vitest';
import { easterSunday, holidaysFor, MUNICIPAL_RULES, nationalHolidays, STATE_RULES, UFS } from '../src/index.ts';

describe('Páscoa e feriados móveis', () => {
  it('calcula a Páscoa de anos conhecidos', () => {
    expect(easterSunday(2024)).toEqual({ month: 3, day: 31 });
    expect(easterSunday(2026)).toEqual({ month: 4, day: 5 });
    expect(easterSunday(2027)).toEqual({ month: 3, day: 28 });
    expect(easterSunday(2038)).toEqual({ month: 4, day: 25 });
  });

  it('móveis de 2027 batem com o calendário oficial', () => {
    const d = Object.fromEntries(nationalHolidays(2027).map((h) => [h.name + (h.date === '2027-02-08' ? ' seg' : ''), h.date]));
    expect(d['Carnaval seg']).toBe('2027-02-08');
    expect(d['Carnaval']).toBe('2027-02-09');
    expect(d['Sexta-feira da Paixão']).toBe('2027-03-26');
    expect(d['Corpus Christi']).toBe('2027-05-27');
  });
});

describe('nacionais', () => {
  it('inclui o 20 de novembro (Lei 14.759/2023) e marca Carnaval e Corpus Christi como facultativos', () => {
    const n = nationalHolidays(2026);
    expect(n.find((h) => h.date === '2026-11-20')).toMatchObject({ kind: 'HOLIDAY', basis: 'Lei nº 14.759/2023' });
    expect(n.filter((h) => h.kind === 'HOLIDAY')).toHaveLength(10);
    expect(n.find((h) => h.name === 'Corpus Christi')!.kind).toBe('OPTIONAL');
  });
});

describe('por local', () => {
  it('Belo Horizonte: Corpus Christi vira feriado municipal, mais 15/08 e 08/12', () => {
    const bh = holidaysFor(2027, { uf: 'MG', ibge: '3106200' });
    expect(bh.find((h) => h.date === '2027-05-27')).toMatchObject({ name: 'Corpus Christi', scope: 'MUNICIPAL', kind: 'HOLIDAY' });
    expect(bh.find((h) => h.date === '2027-08-15')).toMatchObject({ scope: 'MUNICIPAL', review: true });
    expect(bh.find((h) => h.date === '2027-12-08')).toMatchObject({ name: 'Imaculada Conceição' });
    expect(new Set(bh.map((h) => h.date)).size).toBe(bh.length); // sem datas repetidas
  });

  it('São Paulo: aniversário da cidade e feriado estadual de 9 de julho', () => {
    const sp = holidaysFor(2026, { uf: 'SP', ibge: '3550308' });
    expect(sp.find((h) => h.date === '2026-01-25')?.name).toBe('Aniversário de São Paulo');
    expect(sp.find((h) => h.date === '2026-07-09')).toMatchObject({ scope: 'STATE', uf: 'SP' });
  });

  it('cidade fora da base recebe nacionais e estaduais', () => {
    const r = holidaysFor(2026, { uf: 'RS', ibge: '4300000' });
    expect(r.some((h) => h.scope === 'MUNICIPAL')).toBe(false);
    expect(r.find((h) => h.date === '2026-09-20')?.scope).toBe('STATE');
  });

  it('base consistente: UFs válidas, códigos IBGE de 7 dígitos começando pelo código da UF', () => {
    const ufCode: Record<string, string> = { RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17', MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27', SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41', SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53' };
    for (const uf of Object.keys(STATE_RULES)) expect(UFS).toContain(uf);
    for (const [ibge, m] of Object.entries(MUNICIPAL_RULES)) {
      expect(ibge).toMatch(/^\d{7}$/);
      expect(ibge.slice(0, 2)).toBe(ufCode[m.uf]);
    }
  });
});
