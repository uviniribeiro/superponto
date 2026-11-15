/**
 * Feriados brasileiros calculados para qualquer ano, sem depender de serviço externo.
 *
 * - Nacionais fixos (Leis 662/1949, 6.802/1980, 10.607/2002 e 14.759/2023) e móveis, contados a
 *   partir da Páscoa.
 * - Estaduais por UF e municipais pelo código IBGE da cidade (que vem da busca por CEP).
 *
 * As bases estadual e municipal são uma base inicial do SuperPonto (capitais e datas mais
 * conhecidas) e vêm marcadas com `review: true`: conferir com a lei local. Cidades fora da base
 * recebem os municipais cadastrados pela empresa, que a geração anual repete todo ano.
 */

export type HolidayScope = 'NATIONAL' | 'STATE' | 'MUNICIPAL';
/** HOLIDAY = feriado; OPTIONAL = ponto facultativo (a empresa decide se trabalha) */
export type HolidayKind = 'HOLIDAY' | 'OPTIONAL';
export type Movable = 'CARNIVAL_MONDAY' | 'CARNIVAL_TUESDAY' | 'ASH_WEDNESDAY' | 'GOOD_FRIDAY' | 'EASTER' | 'CORPUS_CHRISTI';

export interface HolidayRule {
  name: string;
  kind: HolidayKind;
  /** data fixa (mês 1-12, dia) ou móvel */
  month?: number;
  day?: number;
  movable?: Movable;
  basis?: string;
  /** base inicial a conferir com a lei local */
  review?: boolean;
}

export interface Holiday {
  date: string; // AAAA-MM-DD
  name: string;
  scope: HolidayScope;
  kind: HolidayKind;
  uf?: string;
  ibge?: string;
  basis?: string;
  review: boolean;
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  return { month: Math.floor((h + l - 7 * m + 114) / 31), day: ((h + l - 7 * m + 114) % 31) + 1 };
}

const OFFSETS: Record<Movable, number> = { CARNIVAL_MONDAY: -48, CARNIVAL_TUESDAY: -47, ASH_WEDNESDAY: -46, GOOD_FRIDAY: -2, EASTER: 0, CORPUS_CHRISTI: 60 };

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export function ruleDate(rule: HolidayRule, year: number): string {
  if (rule.movable) {
    const e = easterSunday(year);
    const t = new Date(Date.UTC(year, e.month - 1, e.day) + OFFSETS[rule.movable] * 86_400_000);
    return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  return iso(year, rule.month!, rule.day!);
}

export const NATIONAL_RULES: HolidayRule[] = [
  { name: 'Confraternização Universal', kind: 'HOLIDAY', month: 1, day: 1, basis: 'Lei nº 662/1949' },
  { name: 'Carnaval', kind: 'OPTIONAL', movable: 'CARNIVAL_MONDAY', basis: 'Ponto facultativo (calendário federal)' },
  { name: 'Carnaval', kind: 'OPTIONAL', movable: 'CARNIVAL_TUESDAY', basis: 'Ponto facultativo (calendário federal)' },
  { name: 'Quarta-feira de Cinzas (até 14h)', kind: 'OPTIONAL', movable: 'ASH_WEDNESDAY', basis: 'Ponto facultativo (calendário federal)' },
  { name: 'Sexta-feira da Paixão', kind: 'HOLIDAY', movable: 'GOOD_FRIDAY', basis: 'Lei nº 9.093/1995' },
  { name: 'Tiradentes', kind: 'HOLIDAY', month: 4, day: 21, basis: 'Lei nº 662/1949' },
  { name: 'Dia do Trabalho', kind: 'HOLIDAY', month: 5, day: 1, basis: 'Lei nº 662/1949' },
  { name: 'Corpus Christi', kind: 'OPTIONAL', movable: 'CORPUS_CHRISTI', basis: 'Ponto facultativo (calendário federal); feriado onde houver lei municipal' },
  { name: 'Independência do Brasil', kind: 'HOLIDAY', month: 9, day: 7, basis: 'Lei nº 662/1949' },
  { name: 'Nossa Senhora Aparecida', kind: 'HOLIDAY', month: 10, day: 12, basis: 'Lei nº 6.802/1980' },
  { name: 'Finados', kind: 'HOLIDAY', month: 11, day: 2, basis: 'Lei nº 10.607/2002' },
  { name: 'Proclamação da República', kind: 'HOLIDAY', month: 11, day: 15, basis: 'Lei nº 662/1949' },
  { name: 'Dia Nacional de Zumbi e da Consciência Negra', kind: 'HOLIDAY', month: 11, day: 20, basis: 'Lei nº 14.759/2023' },
  { name: 'Natal', kind: 'HOLIDAY', month: 12, day: 25, basis: 'Lei nº 662/1949' },
];

const S = (month: number, day: number, name: string): HolidayRule => ({ name, kind: 'HOLIDAY', month, day, basis: 'Lei estadual', review: true });

export const STATE_RULES: Record<string, HolidayRule[]> = {
  AC: [S(6, 15, 'Aniversário do Acre'), S(11, 17, 'Assinatura do Tratado de Petrópolis')],
  AL: [S(9, 16, 'Emancipação Política de Alagoas')],
  AM: [S(9, 5, 'Elevação do Amazonas à categoria de província')],
  AP: [S(9, 13, 'Criação do Território Federal do Amapá')],
  BA: [S(7, 2, 'Independência da Bahia')],
  CE: [S(3, 19, 'Dia de São José'), S(3, 25, 'Data Magna do Ceará')],
  DF: [S(11, 30, 'Dia do Evangélico')],
  MA: [S(7, 28, 'Adesão do Maranhão à Independência')],
  MS: [S(10, 11, 'Criação do Estado de Mato Grosso do Sul')],
  PA: [S(8, 15, 'Adesão do Pará à Independência')],
  PB: [S(8, 5, 'Fundação do Estado da Paraíba')],
  PE: [S(3, 6, 'Data Magna de Pernambuco')],
  PI: [S(10, 19, 'Dia do Piauí')],
  PR: [S(12, 19, 'Emancipação Política do Paraná')],
  RJ: [S(4, 23, 'Dia de São Jorge')],
  RN: [S(10, 3, 'Mártires de Cunhaú e Uruaçu')],
  RO: [S(1, 4, 'Criação do Estado de Rondônia')],
  RR: [S(10, 5, 'Criação do Estado de Roraima')],
  RS: [S(9, 20, 'Revolução Farroupilha')],
  SE: [S(7, 8, 'Emancipação Política de Sergipe')],
  SP: [S(7, 9, 'Revolução Constitucionalista')],
  TO: [S(10, 5, 'Criação do Estado do Tocantins')],
};

const M = (month: number, day: number, name: string): HolidayRule => ({ name, kind: 'HOLIDAY', month, day, basis: 'Lei municipal', review: true });
const CC: HolidayRule = { name: 'Corpus Christi', kind: 'HOLIDAY', movable: 'CORPUS_CHRISTI', basis: 'Lei municipal', review: true };

/** Municipais por código IBGE (7 dígitos). Base inicial: capitais. */
export const MUNICIPAL_RULES: Record<string, { city: string; uf: string; rules: HolidayRule[] }> = {
  '3106200': { city: 'Belo Horizonte', uf: 'MG', rules: [CC, M(8, 15, 'Assunção de Nossa Senhora'), M(12, 8, 'Imaculada Conceição')] },
  '3550308': { city: 'São Paulo', uf: 'SP', rules: [M(1, 25, 'Aniversário de São Paulo'), CC] },
  '3304557': { city: 'Rio de Janeiro', uf: 'RJ', rules: [M(1, 20, 'Dia de São Sebastião')] },
  '2927408': { city: 'Salvador', uf: 'BA', rules: [M(6, 24, 'São João'), M(12, 8, 'Nossa Senhora da Conceição da Praia')] },
  '2611606': { city: 'Recife', uf: 'PE', rules: [M(6, 24, 'São João'), M(7, 16, 'Nossa Senhora do Carmo'), M(12, 8, 'Nossa Senhora da Conceição')] },
  '2304400': { city: 'Fortaleza', uf: 'CE', rules: [M(4, 13, 'Aniversário de Fortaleza'), M(8, 15, 'Nossa Senhora da Assunção')] },
  '4106902': { city: 'Curitiba', uf: 'PR', rules: [M(9, 8, 'Nossa Senhora da Luz dos Pinhais'), CC] },
  '4314902': { city: 'Porto Alegre', uf: 'RS', rules: [M(2, 2, 'Nossa Senhora dos Navegantes')] },
  '5208707': { city: 'Goiânia', uf: 'GO', rules: [M(5, 24, 'Nossa Senhora Auxiliadora'), M(10, 24, 'Aniversário de Goiânia')] },
  '1302603': { city: 'Manaus', uf: 'AM', rules: [M(10, 24, 'Aniversário de Manaus'), M(12, 8, 'Nossa Senhora da Conceição')] },
  '1501402': { city: 'Belém', uf: 'PA', rules: [M(1, 12, 'Aniversário de Belém')] },
  '4205407': { city: 'Florianópolis', uf: 'SC', rules: [M(3, 23, 'Aniversário de Florianópolis')] },
  '3205309': { city: 'Vitória', uf: 'ES', rules: [M(9, 8, 'Nossa Senhora da Vitória')] },
  '2408102': { city: 'Natal', uf: 'RN', rules: [M(1, 6, 'Santos Reis'), M(11, 21, 'Nossa Senhora da Apresentação')] },
  '2211001': { city: 'Teresina', uf: 'PI', rules: [M(8, 16, 'Aniversário de Teresina')] },
  '2704302': { city: 'Maceió', uf: 'AL', rules: [M(8, 27, 'Nossa Senhora dos Prazeres'), M(12, 8, 'Nossa Senhora da Conceição')] },
  '2800308': { city: 'Aracaju', uf: 'SE', rules: [M(3, 17, 'Aniversário de Aracaju'), M(12, 8, 'Nossa Senhora da Conceição')] },
  '5103403': { city: 'Cuiabá', uf: 'MT', rules: [M(4, 8, 'Aniversário de Cuiabá')] },
  '5002704': { city: 'Campo Grande', uf: 'MS', rules: [M(8, 26, 'Aniversário de Campo Grande')] },
  '1100205': { city: 'Porto Velho', uf: 'RO', rules: [M(10, 2, 'Aniversário de Porto Velho')] },
  '1400100': { city: 'Boa Vista', uf: 'RR', rules: [M(7, 9, 'Aniversário de Boa Vista')] },
  '1600303': { city: 'Macapá', uf: 'AP', rules: [M(2, 4, 'Aniversário de Macapá')] },
  '1721000': { city: 'Palmas', uf: 'TO', rules: [M(5, 20, 'Aniversário de Palmas')] },
  '2111300': { city: 'São Luís', uf: 'MA', rules: [M(9, 8, 'Aniversário de São Luís')] },
};

export const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'] as const;

function expand(rules: HolidayRule[], year: number, scope: HolidayScope, extra: { uf?: string; ibge?: string } = {}): Holiday[] {
  return rules.map((r) => ({ date: ruleDate(r, year), name: r.name, scope, kind: r.kind, basis: r.basis, review: !!r.review, ...extra }));
}

export const nationalHolidays = (year: number) => expand(NATIONAL_RULES, year, 'NATIONAL');
export const stateHolidays = (year: number, uf: string) => expand(STATE_RULES[uf.toUpperCase()] ?? [], year, 'STATE', { uf: uf.toUpperCase() });
export function municipalHolidays(year: number, ibge: string): Holiday[] {
  const m = MUNICIPAL_RULES[ibge];
  return m ? expand(m.rules, year, 'MUNICIPAL', { uf: m.uf, ibge }) : [];
}

/**
 * Feriados de um local num ano, sem repetir datas: no mesmo dia vale o mais específico
 * (municipal > estadual > nacional) e feriado prevalece sobre ponto facultativo.
 */
export function holidaysFor(year: number, place: { uf?: string | null; ibge?: string | null } = {}): Holiday[] {
  const all = [
    ...nationalHolidays(year),
    ...(place.uf ? stateHolidays(year, place.uf) : []),
    ...(place.ibge ? municipalHolidays(year, place.ibge) : []),
  ];
  const rank = (h: Holiday) => (h.kind === 'HOLIDAY' ? 10 : 0) + (h.scope === 'MUNICIPAL' ? 3 : h.scope === 'STATE' ? 2 : 1);
  const byDate = new Map<string, Holiday>();
  for (const h of all) {
    const cur = byDate.get(h.date);
    if (!cur || rank(h) > rank(cur)) byDate.set(h.date, h);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
