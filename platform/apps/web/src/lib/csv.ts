/** Leitura de CSV no navegador: separador ; ou , (detectado), aspas, UTF-8 ou Windows-1252 (Excel). */
export function decodeFile(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buf);
  // Excel no Brasil costuma salvar CSV em Windows-1252: se o UTF-8 gerou caracteres inválidos, troca.
  const text = utf8.includes('�') ? new TextDecoder('windows-1252').decode(buf) : utf8;
  return text.replace(/^﻿/, '');
}

export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

const ALIASES: Record<string, string> = {
  nome: 'nome', nome_completo: 'nome', funcionario: 'nome', colaborador: 'nome', nome_social: 'nome_social',
  cpf: 'cpf', pis: 'pis', pis_pasep: 'pis', pispasep: 'pis', nis: 'pis', pasep: 'pis',
  matricula: 'matricula', registro: 'matricula', admissao: 'admissao', data_admissao: 'admissao', data_de_admissao: 'admissao',
  nascimento: 'nascimento', data_nascimento: 'nascimento', data_de_nascimento: 'nascimento', email: 'email', e_mail: 'email',
  telefone: 'telefone', celular: 'telefone', carga_semanal: 'carga_semanal', carga_horaria: 'carga_semanal', carga_horaria_semanal: 'carga_semanal',
  contrato: 'contrato', tipo_contrato: 'contrato', tipo_de_contrato: 'contrato', regime: 'contrato',
  departamento: 'departamento', setor: 'departamento', lotacao: 'departamento', secao: 'secao', cargo: 'cargo', funcao: 'funcao',
  centro_custo: 'centro_custo', centro_de_custo: 'centro_custo', tipo: 'tipo', tipo_funcionario: 'tipo', tipo_de_funcionario: 'tipo',
  sindicato: 'sindicato', cep: 'cep', numero: 'numero', complemento: 'complemento',
};
export const IMPORT_COLUMNS = ['nome', 'cpf', 'pis', 'matricula', 'admissao', 'nascimento', 'email', 'telefone', 'contrato', 'carga_semanal', 'departamento', 'secao', 'cargo', 'funcao', 'centro_custo', 'tipo', 'sindicato', 'cep', 'numero', 'complemento', 'nome_social'];

const norm = (h: string) => h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Converte as linhas em objetos com as chaves da importação; devolve também colunas ignoradas. */
export function toImportRows(table: string[][]) {
  const [header = [], ...body] = table;
  const keys = header.map((h) => ALIASES[norm(h)] ?? null);
  const ignored = header.filter((_, i) => !keys[i]);
  const rows = body.map((cells) => Object.fromEntries(keys.flatMap((k, i) => (k && cells[i]?.trim() ? [[k, cells[i]!.trim()]] : []))));
  return { rows, ignored, recognized: [...new Set(keys.filter(Boolean))] as string[] };
}

export function templateCsv() {
  const header = ['Nome', 'CPF', 'PIS', 'Matrícula', 'Data de admissão', 'Nascimento', 'E-mail', 'Telefone', 'Contrato', 'Carga semanal', 'Departamento', 'Seção', 'Cargo', 'Função', 'Centro de custo', 'Tipo de funcionário', 'Sindicato', 'CEP', 'Número'];
  const example = ['Maria da Silva', '529.982.247-25', '', '1001', '01/03/2024', '10/05/1990', 'maria@exemplo.com.br', '(31) 99999-0000', 'CLT', '40', 'UBS Centro', 'Vacinação', 'Enfermeiro', 'Sala de vacina', 'Atenção Básica', 'Efetivo', 'SINDSAUDE', '30130-010', '100'];
  return `﻿${header.join(';')}\r\n${example.join(';')}\r\n`;
}
