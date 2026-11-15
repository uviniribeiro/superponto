import { describe, expect, it } from 'vitest';
import { controlIdRequests, RepCommandError, repName, workerIdFor, type RepEmployee } from '../src/index.ts';

const maria: RepEmployee = { employmentId: 'e1', name: 'Maria Conceição', cpf: '529.982.247-25', pis: '120.5646.212-7', registration: '1001' };

describe('identificação do trabalhador por portaria', () => {
  it('1510 usa PIS e 671 usa CPF', () => {
    expect(workerIdFor('1510', maria)).toEqual({ type: 'PIS', value: '12056462127' });
    expect(workerIdFor('671', maria)).toEqual({ type: 'CPF', value: '52998224725' });
  });
  it('recusa envio sem o documento exigido', () => {
    expect(() => workerIdFor('1510', { ...maria, pis: null })).toThrow(RepCommandError);
    expect(() => workerIdFor('671', { ...maria, cpf: '111.111.111-11' })).toThrow(/CPF válido/);
  });
  it('nome cabe no campo do REP e sem acentos', () => {
    expect(repName('Maria Conceição')).toBe('Maria Conceicao');
    expect(repName('x'.repeat(80))).toHaveLength(52);
  });
});

describe('adaptador Control iD', () => {
  it('cadastra funcionário em equipamento de acesso (users)', () => {
    const reqs = controlIdRequests({ type: 'UPSERT_EMPLOYEE', employee: maria }, { family: 'access', layout: '671' });
    expect(reqs.at(-1)).toMatchObject({ path: '/create_objects.fcgi', body: { object: 'users', values: [{ name: 'Maria Conceicao', registration: '1001' }] } });
  });
  it('envia digital como template', () => {
    const [req] = controlIdRequests({ type: 'UPSERT_FINGERPRINT', employee: maria, fingerprint: { employmentId: 'e1', finger: 1, format: 'ISO_19794_2', template: 'AAEC' } }, { family: 'access', layout: '671' });
    expect(req).toMatchObject({ path: '/create_objects.fcgi', body: { object: 'templates', values: [{ finger_type: 1, template: 'AAEC' }] } });
  });
  it('recusa formato de digital de outro fabricante', () => {
    expect(() => controlIdRequests({ type: 'UPSERT_FINGERPRINT', employee: maria, fingerprint: { employmentId: 'e1', finger: 1, format: 'HENRY', template: 'x' } }, { family: 'access', layout: '671' })).toThrow(/não é aceito/);
  });
  it('REP: empregador e funcionário com PIS (1510) marcados como pendentes de homologação', () => {
    const emp = controlIdRequests({ type: 'SET_EMPLOYER', employer: { idType: 'CNPJ', id: '11.222.333/0001-81', name: 'Empresa', location: 'Matriz' } }, { family: 'rep', layout: '1510' });
    expect(emp[0]).toMatchObject({ homologationPending: true, body: { employer: { document: '11222333000181' } } });
    const user = controlIdRequests({ type: 'UPSERT_EMPLOYEE', employee: maria }, { family: 'rep', layout: '1510' });
    expect(user[0]).toMatchObject({ path: '/add_users.fcgi', body: { users: [{ pis: 12056462127 }] } });
  });
  it('REP da 1510 não aceita CNPJ alfanumérico', () => {
    expect(() => controlIdRequests({ type: 'SET_EMPLOYER', employer: { idType: 'CNPJ', id: '12.ABC.345/01DE-35', name: 'Clínica', location: 'Centro' } }, { family: 'rep', layout: '1510' })).toThrow(/alfanumérico/);
  });
  it('ajuste de relógio usa o fuso do equipamento', () => {
    const [req] = controlIdRequests({ type: 'SET_CLOCK', at: new Date('2026-11-03T15:00:00Z'), timeZone: 'America/Sao_Paulo' }, { family: 'rep', layout: '671' });
    expect(req!.body).toMatchObject({ hour: 12, minute: 0, day: 3, month: 11, year: 2026 });
  });
});
