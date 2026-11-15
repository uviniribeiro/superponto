export const digits = (v: string) => v.replace(/\D/g, '');

export function maskCep(v: string) {
  const d = digits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function maskPhone(v: string) {
  const d = digits(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Fusos do Brasil (IANA) com nomes amigáveis. */
export const BR_TIMEZONES: Array<[string, string]> = [
  ['America/Sao_Paulo', 'Brasília (SP, RJ, MG, Sul, GO, DF, BA...)'],
  ['America/Fortaleza', 'Fortaleza (CE, RN, PB, PI, MA)'],
  ['America/Recife', 'Recife (PE)'],
  ['America/Maceio', 'Maceió (AL, SE)'],
  ['America/Bahia', 'Salvador (BA)'],
  ['America/Belem', 'Belém (PA leste, AP)'],
  ['America/Araguaina', 'Araguaína (TO)'],
  ['America/Santarem', 'Santarém (PA oeste)'],
  ['America/Cuiaba', 'Cuiabá (MT)'],
  ['America/Campo_Grande', 'Campo Grande (MS)'],
  ['America/Manaus', 'Manaus (AM)'],
  ['America/Porto_Velho', 'Porto Velho (RO)'],
  ['America/Boa_Vista', 'Boa Vista (RR)'],
  ['America/Rio_Branco', 'Rio Branco (AC)'],
  ['America/Eirunepe', 'Eirunepé (AM oeste)'],
  ['America/Noronha', 'Fernando de Noronha'],
];

export const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];
