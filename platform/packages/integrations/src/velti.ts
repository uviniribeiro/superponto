/**
 * Conector para o "Serviço API" do sistema de ponto Velti/Átomo (servicoponto), montado a partir
 * da coleção Postman fornecida pelo cliente. Autenticação: cabeçalho `token`.
 *
 * Uso previsto: integrar clientes que ainda usam esse sistema (trazer marcações para o SuperPonto
 * e enviar ajustes, abonos, escalas, afastamentos, aprovações de extra, sindicatos e bancos de
 * compensação). Não é um protocolo de equipamento: conversa servidor a servidor por HTTP/JSON.
 *
 * Fontes: a coleção Postman (requisições) e o Swagger publicado pelo próprio servidor em
 * /servicoponto/documentacao/swagger.json (modelos de resposta e códigos de erro). Os dois trazem
 * caminhos um pouco diferentes (com e sem os prefixos /espelho e /marcacao), por isso o conector
 * aceita as duas variantes (`routes`).
 */

export type Fetcher = typeof fetch;

export interface VeltiConfig {
  /** ex.: https://servidor:8080 (sem /servicoponto) */
  baseUrl: string;
  token: string;
  /** 'postman' (padrão) ou 'swagger': variante dos caminhos usada pelo servidor */
  routes?: 'postman' | 'swagger';
  fetch?: Fetcher;
  timeoutMs?: number;
}

const ROUTES = {
  postman: { marcacoes: '/espelho/marcacoes/lista', ajuste: '/espelho/ajusteManual', abonoFalta: '/espelho/abonoFalta', abonoAtraso: '/espelho/abonoAtraso', apontamento: '/marcacao/apontamento' },
  swagger: { marcacoes: '/marcacoes/lista', ajuste: '/ajusteManual', abonoFalta: '/abonoFalta', abonoAtraso: '/abonoAtraso', apontamento: '/apontamento' },
} as const;

/** Significado dos códigos HTTP das rotas de espelho, conforme o Swagger do servidor. */
export const ESPELHO_ERROS: Record<number, string> = {
  401: 'Falha de autenticação (token inválido)',
  403: 'Ponto fechado para o período',
  404: 'Pessoa não encontrada com o PIS/PASEP informado',
  406: 'Funcionário inativo',
  411: 'Não existem horas/minutos para abonar',
  412: 'Funcionário demitido',
  413: 'O valor do abono deve ser menor ou igual à ocorrência',
  417: 'Data do ponto maior que a data atual',
  422: 'Código do abono não encontrado',
};

/** Item de /marcacoes/lista (modelo RespostaMarcacoesEspelho do Swagger). */
export interface VeltiMarcacaoDia { data: string; pisPasep: number | string; abono?: string; codAbono?: string; marcacoes: unknown }
export interface MarcacaoNormalizada { data: string; pis: string; abono: string | null; codAbono: string | null; batidas: Array<{ ordem: string; hora: string }> }

/**
 * Normaliza a resposta de marcações: o Swagger define `marcacoes` como objeto genérico, então
 * aceita mapa {"e1":"08:00","s1":"12:00"}, lista de textos ou lista de objetos {ordem, hora}.
 */
export function normalizarMarcacoes(resp: unknown): MarcacaoNormalizada[] {
  const list = Array.isArray(resp) ? resp : resp && typeof resp === 'object' && Array.isArray((resp as { lista?: unknown }).lista) ? (resp as { lista: unknown[] }).lista : [];
  return (list as VeltiMarcacaoDia[]).map((d) => {
    const m = d.marcacoes;
    let batidas: Array<{ ordem: string; hora: string }> = [];
    if (Array.isArray(m)) {
      batidas = m.map((x, i) => (typeof x === 'string' ? { ordem: `${i % 2 ? 's' : 'e'}${Math.floor(i / 2) + 1}`, hora: x } : { ordem: String((x as Record<string, unknown>).ordem ?? (x as Record<string, unknown>).ordemMarcacao ?? i + 1), hora: String((x as Record<string, unknown>).hora ?? (x as Record<string, unknown>).marcacao ?? '') }));
    } else if (m && typeof m === 'object') {
      batidas = Object.entries(m as Record<string, unknown>).filter(([, v]) => v !== null && v !== '').map(([ordem, hora]) => ({ ordem, hora: String(hora) }));
    }
    return { data: String(d.data), pis: String(d.pisPasep ?? '').replace(/\D/g, ''), abono: d.abono || null, codAbono: d.codAbono || null, batidas: batidas.filter((b) => b.hora) };
  });
}

export type Referencia = { nrReferencia: string | number; tpReferencia: 'PIS' | 'MATRICULA' };

export class VeltiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) { super(message); }
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Datas no formato que cada rota espera (a coleção mistura dd-MM-yyyy e dd/MM/yyyy). */
export const dmyDash = (d: Date) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
export const dmySlash = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
export const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
/** Horas com 3 dígitos usadas no banco de compensação ("040:00"). */
export const hhhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(3, '0')}:${pad(minutes % 60)}`;
const onlyDigits = (v: string) => v.replace(/\D/g, '');

export class VeltiClient {
  private readonly base: string;
  private readonly http: Fetcher;
  private readonly r: (typeof ROUTES)[keyof typeof ROUTES];
  constructor(private readonly cfg: VeltiConfig) {
    this.r = ROUTES[cfg.routes ?? 'postman'];
    this.base = cfg.baseUrl.replace(/\/+$/, '') + '/servicoponto/api';
    this.http = cfg.fetch ?? fetch;
  }

  private async call<T = unknown>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const res = await this.http(`${this.base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', token: this.cfg.token },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.cfg.timeoutMs ?? 30_000),
    });
    const text = await res.text();
    let data: unknown = text;
    try { data = text ? JSON.parse(text) : null; } catch { /* resposta em texto */ }
    if (!res.ok) {
      // O servidor responde {"status":"FALHA","resposta":"..."} ou {"status","message"} (modelo Error).
      const body = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
      const motivo = ESPELHO_ERROS[res.status] ?? String(body.resposta ?? body.message ?? `HTTP ${res.status}`);
      throw new VeltiError(res.status, `Velti ${method} ${path}: ${motivo}`, data);
    }
    return data as T;
  }

  /** Espelho › Obter marcações de um período (todas ou de um PIS). */
  marcacoes(inicio: Date, fim: Date, pis = '') {
    return this.call<VeltiMarcacaoDia[]>('POST', this.r.marcacoes, { dataInicio: dmyDash(inicio), dataFim: dmyDash(fim), pisPasep: onlyDigits(pis) });
  }

  /** Marcações já normalizadas (dia, PIS, batidas por ordem). */
  async marcacoesNormalizadas(inicio: Date, fim: Date, pis = '') {
    return normalizarMarcacoes(await this.marcacoes(inicio, fim, pis));
  }

  /** Espelho › Ajuste manual. ordemMarcacao: e1, s1, e2, s2… */
  ajusteManual(a: { dataPonto: Date; dataMarcacao: Date; pis: string; ordemMarcacao: string; descricao: string }) {
    return this.call('POST', this.r.ajuste, {
      dataPonto: dmyDash(a.dataPonto), dataMarcacao: `${dmyDash(a.dataMarcacao)} ${pad(a.dataMarcacao.getHours())}:${pad(a.dataMarcacao.getMinutes())}`,
      pisPasep: onlyDigits(a.pis), ordemMarcacao: a.ordemMarcacao, descricao: a.descricao,
    });
  }

  /** Espelho › Abono de falta (minutos abonados). */
  abonoFalta(a: { dataPonto: Date; pis: string; codigoAbono: string; minutos: number }) {
    return this.call('POST', this.r.abonoFalta, { dataPonto: dmyDash(a.dataPonto), pisPasep: onlyDigits(a.pis), codigoAbono: a.codigoAbono, valorAbono: hhmm(a.minutos) });
  }

  /** Espelho › Abono de atraso numa marcação. */
  abonoAtraso(a: { dataPonto: Date; pis: string; ordemMarcacao: string; codigoAbono: string; minutos: number }) {
    return this.call('POST', this.r.abonoAtraso, { dataPonto: dmyDash(a.dataPonto), pisPasep: onlyDigits(a.pis), ordemMarcacao: a.ordemMarcacao, codigoAbono: a.codigoAbono, valorAbono: hhmm(a.minutos) });
  }

  /** Importações › Afastamentos (linhas no formato do sistema: "CodJustificativa;matricula;inicio;fim;;;;"). */
  importarAfastamentos(itens: Array<{ codJustificativa: string; matricula: string | number; inicio: Date; fim: Date }>) {
    return this.call('POST', '/importacao/afastamento', { afastamentos: itens.map((i) => `${i.codJustificativa};${i.matricula};${dmySlash(i.inicio)};${dmySlash(i.fim)};;;;`) });
  }

  /** Marcações › Apontamento (registra uma marcação). */
  apontamento(ref: Referencia, quando: Date) {
    return this.call('POST', this.r.apontamento, { data: dmySlash(quando), hora: `${pad(quando.getHours())}:${pad(quando.getMinutes())}:${pad(quando.getSeconds())}`, ...ref });
  }

  /** Escala agendada (um funcionário ou vários). */
  escalaAgendada(itens: Array<Referencia & { cnpj?: string; editarExistente?: boolean; dias: Array<{ data: Date; tipo: 'TRABALHO' | 'FOLGA'; codHorario: string }> }>) {
    const body = itens.map(({ dias, ...r }) => ({ ...r, listaEscala: dias.map((d) => ({ data: dmySlash(d.data), tpDiaEscala: d.tipo, codHorario: d.codHorario })) }));
    return body.length === 1 ? this.call('POST', '/escalaAgendada', body[0]) : this.call('POST', '/escalaAgendada/incluirEmLista', body);
  }

  /** Horários cadastrados. */
  horarios() {
    return this.call('GET', '/horario');
  }

  sindicatos() {
    return this.call('GET', '/sindicato');
  }

  incluirSindicato(s: { nome: string; descricao: string; sigla: string; codigo: string; tipoEntidade: string; tipoSindicato: string; cnpj: string }) {
    return this.call('POST', '/sindicato', { nomeSindicato: s.nome, descricao: s.descricao, sigla: s.sigla, codigo: s.codigo, tpEntidade: s.tipoEntidade, tpSindicato: s.tipoSindicato, cnpj: onlyDigits(s.cnpj) });
  }

  /** Aprovação de horas extras (por dia ou por período). */
  aprovarExtras(itens: Array<Referencia & { inicio: Date; fim?: Date; minutos: number; tipo?: 'POR_DIA' | 'POR_PERIODO' }>) {
    return this.call('POST', '/autorizarExtra', itens.map((i) => ({
      nrReferencia: String(i.nrReferencia), tpReferencia: i.tpReferencia, dtPontoInicio: dmySlash(i.inicio),
      ...(i.fim ? { dtPontoFim: dmySlash(i.fim) } : {}), nrHrExtraAprovada: hhmm(i.minutos), ...(i.tipo ? { tpAprovacao: i.tipo } : {}),
    })));
  }

  /** Banco de compensação (corpo no formato do sistema; horas em minutos). */
  incluirBancoCompensacao(b: {
    descricao: string; codigo: string; compensarDe: Date; compensarAte: Date; usoDe: Date; usoAte: Date; minutosCompensar: number;
    tpReferencia: 'PIS' | 'MATRICULA'; funcionarios: string[]; extras?: Record<string, unknown>;
  }) {
    return this.call('POST', '/bancoCompensacao', {
      descricao: b.descricao, codigo: b.codigo, dtInicioCompensar: dmySlash(b.compensarDe), dtFimCompensar: dmySlash(b.compensarAte),
      dtInicioUso: dmySlash(b.usoDe), dtFimUso: dmySlash(b.usoAte), nrHrCompensar: hhhmm(b.minutosCompensar),
      tpReferencia: b.tpReferencia, funcionarios: b.funcionarios, ...(b.extras ?? {}),
    });
  }
}
