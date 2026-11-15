/**
 * Henry, protocolo de gerenciamento "8x" (Primme Acesso, Argos e família Prisma com firmware 8.x).
 * Implementado a partir da especificação do fabricante (planilha "Protocolo Primme Acesso 8.0.0.50 e
 * Argos"), sem código de terceiros.
 *
 * Quadro: 0x02 | tamanho (word, little-endian) | "II+CMD+VV[+dados]" | checksum | 0x03
 * - II: índice da mensagem (00–99), a resposta volta com o mesmo índice
 * - CMD: código do comando (EH, RH, EE, RE, EU, RU, ED, RD, RR, ER, RQ, EC, RC, REON…)
 * - VV: versão do comando no envio; código de erro na resposta (00 = sem erro, 01 = sem dados)
 * - checksum: XOR de todos os bytes a partir do tamanho (bytes 1..N) até o fim dos dados
 * Separadores reservados: "+" dados, "]" parâmetros, "[" "{" "}" atributos.
 */

export const HENRY_ERRORS: Record<string, string> = {
  '01': 'Não há dados', '10': 'Comando desconhecido', '11': 'Tamanho do pacote inválido', '12': 'Parâmetros inválidos', '13': 'Erro de checksum',
  '14': 'Tamanho dos parâmetros inválido', '15': 'Número da mensagem inválido', '16': 'Start byte inválido', '17': 'Erro ao receber pacote',
  '20': 'Não há empregador cadastrado', '21': 'Não há usuários cadastrados', '22': 'Usuário não cadastrado', '23': 'Usuário já cadastrado',
  '24': 'Limite de usuários atingido', '25': 'Equipamento sem biometria', '26': 'Índice biométrico não encontrado', '27': 'Limite de digitais atingido',
  '28': 'Equipamento não possui eventos', '29': 'Erro na manipulação de biometrias', '30': 'Documento do empregador inválido', '31': 'Tipo do documento do empregador inválido',
  '33': 'Tipo de operação do usuário inválido', '34': 'Identificador do empregado inválido', '43': 'Erro ao gravar dados', '44': 'Erro ao ler dados', '50': 'Erro desconhecido',
  '61': 'Matrícula já existe', '62': 'Identificador já existe', '64': 'Matrícula não existe', '65': 'Identificador não existe',
};

export interface HenryFrame { index: string; command: string; code: string; data: string }

const enc = (s: string) => Buffer.from(s, 'latin1');
const xor = (b: Uint8Array) => b.reduce((a, x) => a ^ x, 0);

/** Monta um quadro. `index` 0–99; `data` vazio omite o último "+". */
export function encodeHenry(index: number, command: string, data = '', version = '00'): Buffer {
  if (!/^[A-Z]{2,4}$/.test(command)) throw new Error(`Comando Henry inválido: ${command}`);
  if (/[\x00-\x1f]/.test(data)) throw new Error('Dados com caractere de controle');
  const body = enc(`${String(index % 100).padStart(2, '0')}+${command}+${version}${data ? `+${data}` : ''}`);
  if (body.length > 65535) throw new Error('Pacote Henry acima de 65535 bytes');
  const size = Buffer.from([body.length & 0xff, body.length >> 8]);
  const cs = xor(Buffer.concat([size, body]));
  return Buffer.concat([Buffer.from([0x02]), size, body, Buffer.from([cs, 0x03])]);
}

/**
 * Lê quadros de um buffer de recepção (TCP entrega em pedaços). Devolve os quadros completos e o
 * resto ainda incompleto. Lixo antes do 0x02 é descartado; checksum errado gera erro.
 */
export function decodeHenry(buf: Buffer): { frames: HenryFrame[]; rest: Buffer } {
  const frames: HenryFrame[] = [];
  let i = 0;
  while (i < buf.length) {
    if (buf[i] !== 0x02) { i++; continue; }
    if (buf.length - i < 3) break;
    const len = buf[i + 1]! | (buf[i + 2]! << 8);
    const end = i + 3 + len + 2;
    if (buf.length < end) break;
    const body = buf.subarray(i + 3, i + 3 + len);
    const cs = buf[i + 3 + len]!;
    if (buf[end - 1] !== 0x03) throw new Error('Quadro Henry sem byte final');
    if (xor(buf.subarray(i + 1, i + 3 + len)) !== cs) throw new Error('Checksum Henry inválido');
    const text = body.toString('latin1');
    const m = /^(\d{2})\+([A-Z]{2,4})\+(\d{2,3})(?:\+([\s\S]*))?$/.exec(text);
    if (!m) throw new Error(`Quadro Henry malformado: ${text.slice(0, 40)}`);
    frames.push({ index: m[1]!, command: m[2]!, code: m[3]!, data: m[4] ?? '' });
    i = end;
  }
  return { frames, rest: buf.subarray(i) };
}

const p2 = (n: number) => String(n).padStart(2, '0');
/** Nome sem os separadores reservados do protocolo. */
export const henrySafe = (s: string, max: number) => s.replace(/[+\][{}]/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, max).trim();

/** EH: data e hora local (dd/mm/aa hh:mm:ss), horário de verão desligado. */
export function henryDateTime(parts: { year: number; month: number; day: number; hour: number; minute: number; second: number }) {
  return `${p2(parts.day)}/${p2(parts.month)}/${p2(parts.year % 100)} ${p2(parts.hour)}:${p2(parts.minute)}:${p2(parts.second)}]00/00/00]00/00/00`;
}

/** EE: empregador (documento até 32, nome até 150, local até 100). */
export function henryEmployer(e: { id: string; name: string; location: string }) {
  return `]${e.id.replace(/\W/g, '').slice(0, 32)}]]${henrySafe(e.name, 150)}]${henrySafe(e.location, 100)}`;
}

/** EU: inclusão/alteração (I/A) ou exclusão (E) de um usuário; o índice é o PIS/CPF. */
export function henryUser(op: 'I' | 'A' | 'E', id: string, name = '', cards: string[] = []) {
  if (op === 'E') return `1+E[${id}[[[0[`;
  return `1+${op}[${id}[${henrySafe(name, 100)}[[${cards.length}[${cards.join('}')}`;
}

/** Resultado individual do EU ("00" ou código de erro por usuário). */
export function henryUserResult(data: string) {
  const [, results = ''] = data.split('+');
  return results.split(/[\][]/).filter(Boolean);
}

/** ED: digital (template Henry de 384 caracteres) e exclusão das digitais do usuário. */
export const henryFingerprint = (id: string, finger: number, template: string) => `D]${id}}1}${finger}{${template}`;
export const henryDeleteFingerprints = (id: string) => `E]${id}`;

export interface HenryEvent { id: number; code: string; user: string; at: { year: number; month: number; day: number; hour: number; minute: number; second: number }; direction: string; reader: string }

/** Resposta do RR: "N+id[evento[matrícula[dd/mm/aaaa hh:mm:ss[direção[acesso[leitora[online]..." */
export function parseHenryEvents(data: string): HenryEvent[] {
  const plus = data.indexOf('+');
  if (plus < 0) return [];
  const out: HenryEvent[] = [];
  for (const rec of data.slice(plus + 1).split(']')) {
    const f = rec.split('[');
    if (f.length < 4) continue;
    const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(f[3]!.trim());
    const id = Number(f[0]);
    if (!m || !Number.isInteger(id) || id <= 0) continue;
    out.push({ id, code: f[1]!.trim(), user: f[2]!.trim(), at: { day: +m[1]!, month: +m[2]!, year: +m[3]!, hour: +m[4]!, minute: +m[5]!, second: +m[6]! }, direction: (f[4] ?? '').trim(), reader: (f[6] ?? '').trim() });
  }
  return out;
}

/** Resposta do RU: "N+índice[nome[[qtde[cartões]..." */
export function parseHenryUsers(data: string) {
  const plus = data.indexOf('+');
  if (plus < 0) return [];
  return data.slice(plus + 1).split(']').map((r) => r.split('[')).filter((f) => f.length >= 2 && f[0]).map((f) => ({ id: f[0]!.trim(), name: (f[1] ?? '').trim(), cards: (f[4] ?? '').split('}').filter(Boolean) }));
}

/**
 * Converte eventos em linhas de marcação no leiaute do AFD (tipo 3), para a API importar como as
 * demais coletas. NSR = id do evento no equipamento. Equipamento de acesso Henry não é REP
 * certificado: a validade legal depende de acordo coletivo (REP-A, Portaria 671, art. 77).
 */
export function henryEventsToAfd(events: HenryEvent[], layout: '1510' | '671', offset = '-0300') {
  return events.filter((e) => /^\d{1,12}$/.test(e.user) && Number(e.user) > 0).map((e) => {
    const nsr = String(e.id).padStart(9, '0');
    const w = e.user.padStart(12, '0');
    const { year, month, day, hour, minute, second } = e.at;
    return layout === '671'
      ? `${nsr}3${year}-${p2(month)}-${p2(day)}T${p2(hour)}:${p2(minute)}:${p2(second)}${offset}${w}0000`
      : `${nsr}3${p2(day)}${p2(month)}${year}${p2(hour)}${p2(minute)}${w}`;
  }).join('\r\n');
}
