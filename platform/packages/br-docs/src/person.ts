/** CPF e PIS/PASEP/NIS: só dígitos e verificação dos dígitos verificadores. */

export const onlyDigits = (v: string) => v.replace(/\D/g, '');

export function isValidCpf(value: string): boolean {
  const v = onlyDigits(value);
  if (v.length !== 11 || /^(\d)\1{10}$/.test(v)) return false;
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(v[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(v[9]) && dv(10) === Number(v[10]);
}

/** PIS/PASEP/NIS/NIT: pesos 3,2,9,8,7,6,5,4,3,2; DV = 11 - resto (0 se resultar 10 ou 11). */
export function isValidPis(value: string): boolean {
  const v = onlyDigits(value);
  if (v.length !== 11 || /^(\d)\1{10}$/.test(v)) return false;
  const weights = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(v[i]), 0);
  const r = 11 - (sum % 11);
  return (r >= 10 ? 0 : r) === Number(v[10]);
}

export function formatCpf(value: string): string {
  const v = onlyDigits(value);
  return v.length === 11 ? `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}` : value;
}
