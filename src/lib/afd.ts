/**
 * Geração das linhas do arquivo AFD (layout usado pela exportação Portaria 671/1510).
 * Campos têm largura fixa: valores maiores que o campo são truncados para não deslocar
 * as colunas seguintes.
 */
import { format } from 'date-fns';

export interface AfdCompany {
  company_name: string;
  cnpj: string | null;
  cei: string | null;
  rep_number: string | null;
}

export interface AfdEmployee {
  id: string;
  full_name: string;
  pis: string | null;
}

export interface AfdPunch {
  profile_id: string;
  recorded_at: string;
}

export interface AfdInput {
  company: AfdCompany;
  employees: AfdEmployee[];
  punches: AfdPunch[];
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
}

/** Alinha à direita com zeros, mantendo os dígitos menos significativos se exceder. */
export const padLeft = (value: string | number, length: number, char = '0'): string =>
  String(value).padStart(length, char).slice(-length);

/** Alinha à esquerda com espaços, truncando o excedente. */
export const padRight = (value: string, length: number, char = ' '): string =>
  value.replace(/[\r\n]+/g, ' ').slice(0, length).padEnd(length, char);

const digits = (value: string | null, length: number) =>
  padLeft((value || '').replace(/\D/g, ''), length);

export const cleanCNPJ = (cnpj: string | null) => digits(cnpj, 14);
export const cleanPIS = (pis: string | null) => digits(pis, 11);
export const formatDateAFD = (date: Date) => format(date, 'ddMMyyyy');
export const formatTimeAFD = (date: Date) => format(date, 'HHmm');

/** Monta as linhas do AFD: cabeçalho (1), empregados (2), marcações (3) e trailer (9). */
export function buildAfdLines(input: AfdInput): string[] {
  const { company, employees, punches, periodStart, periodEnd, generatedAt } = input;
  const lines: string[] = [];
  let nsr = 1;

  lines.push(
    [
      '1',
      '1',
      cleanCNPJ(company.cnpj),
      padRight(company.cei || '', 12),
      padRight(company.company_name || '', 150),
      padLeft(company.rep_number || '0', 17),
      formatDateAFD(periodStart),
      formatDateAFD(periodEnd),
      formatDateAFD(generatedAt),
      formatTimeAFD(generatedAt),
    ].join('')
  );

  for (const employee of employees) {
    nsr++;
    lines.push(
      ['2', padLeft(nsr, 9), 'I', '1', cleanPIS(employee.pis), padRight(employee.full_name || '', 52)].join('')
    );
  }

  const byId = new Map(employees.map((e) => [e.id, e]));
  for (const punch of punches) {
    const employee = byId.get(punch.profile_id);
    if (!employee) continue;
    nsr++;
    const at = new Date(punch.recorded_at);
    lines.push(['3', padLeft(nsr, 9), '1', cleanPIS(employee.pis), formatDateAFD(at), formatTimeAFD(at)].join(''));
  }

  lines.push(['9', padLeft(lines.length + 1, 9)].join(''));
  return lines;
}
