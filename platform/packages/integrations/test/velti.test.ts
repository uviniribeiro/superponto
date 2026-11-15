import { describe, expect, it } from 'vitest';
import { hhhmm, normalizarMarcacoes, VeltiClient, VeltiError } from '../src/index.ts';

function fake(status = 200, body: unknown = { ok: true }) {
  const calls: Array<{ url: string; method: string; headers: Record<string, string>; body: unknown }> = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method!, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { f, calls };
}
const d = (s: string) => new Date(s);

describe('conector Velti (coleção Postman)', () => {
  it('obter marcações: rota, token no cabeçalho e datas dd-MM-yyyy', async () => {
    const { f, calls } = fake();
    await new VeltiClient({ baseUrl: 'https://ponto.cliente.com.br:8080/', token: 'abc', fetch: f }).marcacoes(d('2017-01-01T12:00'), d('2017-02-22T12:00'), '856.77330.05-6');
    expect(calls[0]).toMatchObject({ url: 'https://ponto.cliente.com.br:8080/servicoponto/api/espelho/marcacoes/lista', method: 'POST', headers: { token: 'abc' }, body: { dataInicio: '01-01-2017', dataFim: '22-02-2017', pisPasep: '85677330056' } });
  });

  it('ajuste manual e abonos no formato da coleção', async () => {
    const { f, calls } = fake();
    const c = new VeltiClient({ baseUrl: 'http://x', token: 't', fetch: f });
    await c.ajusteManual({ dataPonto: d('2017-04-13T00:00'), dataMarcacao: d('2017-04-13T13:00'), pis: '85677330056', ordemMarcacao: 's1', descricao: 'Ajuste' });
    await c.abonoFalta({ dataPonto: d('2017-05-11T00:00'), pis: '85677330056', codigoAbono: '002', minutos: 480 });
    await c.abonoAtraso({ dataPonto: d('2017-05-11T00:00'), pis: '85677330056', ordemMarcacao: 's1', codigoAbono: '002', minutos: 10 });
    expect(calls[0]!.body).toEqual({ dataPonto: '13-04-2017', dataMarcacao: '13-04-2017 13:00', pisPasep: '85677330056', ordemMarcacao: 's1', descricao: 'Ajuste' });
    expect(calls[1]!.body).toMatchObject({ valorAbono: '08:00', codigoAbono: '002' });
    expect(calls[2]!.body).toMatchObject({ valorAbono: '00:10', ordemMarcacao: 's1' });
  });

  it('apontamento, afastamentos e escala agendada (um ou vários)', async () => {
    const { f, calls } = fake();
    const c = new VeltiClient({ baseUrl: 'http://x', token: 't', fetch: f });
    await c.apontamento({ nrReferencia: 97, tpReferencia: 'MATRICULA' }, d('2019-10-05T10:00:00'));
    await c.importarAfastamentos([{ codJustificativa: 'CodJustificativa', matricula: 97, inicio: d('2020-01-19T00:00'), fim: d('2020-01-20T00:00') }]);
    await c.escalaAgendada([{ nrReferencia: '1404', tpReferencia: 'MATRICULA', dias: [{ data: d('2020-05-13T00:00'), tipo: 'FOLGA', codHorario: '2415' }] }]);
    await c.escalaAgendada([{ nrReferencia: 2, tpReferencia: 'MATRICULA', editarExistente: true, dias: [] }, { nrReferencia: 3, tpReferencia: 'MATRICULA', dias: [] }]);
    expect(calls[0]).toMatchObject({ url: 'http://x/servicoponto/api/marcacao/apontamento', body: { data: '05/10/2019', hora: '10:00:00', nrReferencia: 97, tpReferencia: 'MATRICULA' } });
    expect(calls[1]!.body).toEqual({ afastamentos: ['CodJustificativa;97;19/01/2020;20/01/2020;;;;'] });
    expect(calls[2]).toMatchObject({ url: 'http://x/servicoponto/api/escalaAgendada', body: { listaEscala: [{ data: '13/05/2020', tpDiaEscala: 'FOLGA', codHorario: '2415' }] } });
    expect(calls[3]!.url).toBe('http://x/servicoponto/api/escalaAgendada/incluirEmLista');
  });

  it('extras, sindicato, horários e banco de compensação', async () => {
    const { f, calls } = fake();
    const c = new VeltiClient({ baseUrl: 'http://x', token: 't', fetch: f });
    await c.aprovarExtras([{ nrReferencia: 1033, tpReferencia: 'MATRICULA', inicio: d('2020-05-04T00:00'), fim: d('2020-05-05T00:00'), minutos: 70, tipo: 'POR_PERIODO' }]);
    await c.incluirSindicato({ nome: 'Sind', descricao: 'd', sigla: 's', codigo: 'c', tipoEntidade: 'SINDICATO', tipoSindicato: 'EMPREGADOS', cnpj: '66.790.340/0001-71' });
    await c.horarios();
    await c.incluirBancoCompensacao({ descricao: 'Comp', codigo: 'WS', compensarDe: d('2020-05-01T00:00'), compensarAte: d('2020-05-30T00:00'), usoDe: d('2020-05-01T00:00'), usoAte: d('2020-05-30T00:00'), minutosCompensar: 2400, tpReferencia: 'MATRICULA', funcionarios: ['854'] });
    expect(calls[0]!.body).toEqual([{ nrReferencia: '1033', tpReferencia: 'MATRICULA', dtPontoInicio: '04/05/2020', dtPontoFim: '05/05/2020', nrHrExtraAprovada: '01:10', tpAprovacao: 'POR_PERIODO' }]);
    expect(calls[1]!.body).toMatchObject({ cnpj: '66790340000171', tpEntidade: 'SINDICATO' });
    expect(calls[2]).toMatchObject({ method: 'GET', url: 'http://x/servicoponto/api/horario' });
    expect(calls[3]!.body).toMatchObject({ nrHrCompensar: '040:00', dtInicioCompensar: '01/05/2020' });
    expect(hhhmm(600)).toBe('010:00');
  });

  it('erro HTTP vira VeltiError com status e corpo', async () => {
    const { f } = fake(401, { mensagem: 'token inválido' });
    await expect(new VeltiClient({ baseUrl: 'http://x', token: 'errado', fetch: f }).horarios()).rejects.toMatchObject({ status: 401, body: { mensagem: 'token inválido' } });
    expect(VeltiError).toBeTypeOf('function');
  });
});

describe('Swagger do servidor', () => {
  it('variante de caminhos do Swagger', async () => {
    const { f, calls } = fake(200, []);
    const c = new VeltiClient({ baseUrl: 'https://ponto.x.gov.br', token: 't', routes: 'swagger', fetch: f });
    await c.marcacoes(new Date('2024-01-01T12:00'), new Date('2024-01-31T12:00'));
    await c.apontamento({ nrReferencia: 1, tpReferencia: 'PIS' }, new Date('2024-01-02T08:00:00'));
    expect(calls.map((x) => x.url)).toEqual(['https://ponto.x.gov.br/servicoponto/api/marcacoes/lista', 'https://ponto.x.gov.br/servicoponto/api/apontamento']);
  });

  it('lê o formato de erro real do servidor ({status, resposta})', async () => {
    const { f } = fake(500, { status: 'FALHA', resposta: 'Erro interno' });
    await expect(new VeltiClient({ baseUrl: 'http://x', token: 't', fetch: f }).horarios()).rejects.toThrow(/Erro interno/);
  });

  it('códigos de erro do espelho viram mensagens claras', async () => {
    const { f } = fake(403, null);
    await expect(new VeltiClient({ baseUrl: 'http://x', token: 't', fetch: f }).abonoFalta({ dataPonto: new Date(), pis: '1', codigoAbono: '1', minutos: 60 })).rejects.toThrow(/Ponto fechado/);
  });

  it('normaliza marcações em mapa, lista de textos ou lista de objetos', () => {
    const r = normalizarMarcacoes([
      { data: '02-01-2024', pisPasep: 12056462127, abono: '', codAbono: '', marcacoes: { e1: '08:00', s1: '12:00', e2: '13:00', s2: '' } },
      { data: '03-01-2024', pisPasep: '12056462127', marcacoes: ['08:01', '12:02'] },
      { data: '04-01-2024', pisPasep: 12056462127, codAbono: '002', abono: '08:00', marcacoes: [{ ordem: 'e1', hora: '07:58' }] },
    ]);
    expect(r[0]).toEqual({ data: '02-01-2024', pis: '12056462127', abono: null, codAbono: null, batidas: [{ ordem: 'e1', hora: '08:00' }, { ordem: 's1', hora: '12:00' }, { ordem: 'e2', hora: '13:00' }] });
    expect(r[1]!.batidas).toEqual([{ ordem: 'e1', hora: '08:01' }, { ordem: 's1', hora: '12:02' }]);
    expect(r[2]).toMatchObject({ codAbono: '002', batidas: [{ ordem: 'e1', hora: '07:58' }] });
  });
});
