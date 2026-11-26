// AEJ — Arquivo Eletrônico de Jornada (Portaria MTP 671/2021): registros separados por "|":
// 01 cabeçalho · 02 REP · 03 vínculos · 04 horários contratuais · 05 marcações · 06 matrícula
// · 07 ausências · 08 programa de tratamento · 99 trailer com a contagem de cada tipo.
import type { DayRow } from './attendancePeriod';

const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const clean = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[|\r\n]/g, ' ').trim();
const hhmm = (t?: string | null) => (t ? t.slice(0, 5).replace(':', '') : '');
const local = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  return `${date}T${time}:00-0300`;
};

export interface AejInput {
  company: { cnpj?: string | null; cei?: string | null; name: string };
  from: string; to: string;
  days: DayRow[];
  repP?: string; // número do REP-P (registro do programa no INPI), 17 dígitos
}

export function buildAej({ company, from, to, days, repP }: AejInput): { content: string; warnings: string[] } {
  const warnings: string[] = [];
  const lines: string[] = [];
  const count: Record<string, number> = {};
  const push = (cols: (string | number)[]) => { const l = cols.join('|'); lines.push(l); const k = l.slice(0, 2); count[k] = (count[k] ?? 0) + 1; };
  const cnpj = digits(company.cnpj);
  if (cnpj.length !== 14) warnings.push('Empresa sem CNPJ válido nas configurações.');
  if (!repP) warnings.push('Número do REP-P (INPI) não informado: saiu com zeros.');
  push(['01', '1', cnpj.padStart(14, '0').slice(-14), '', digits(company.cei).length === 12 ? digits(company.cei) : '', clean(company.name).slice(0, 150), from, to, local(new Date().toISOString()), '001']);
  push(['02', '1', '3', digits(repP).padStart(17, '0').slice(-17)]);

  const people = new Map<string, DayRow['person']>();
  for (const d of days) people.set(d.person.id, d.person);
  const vinc = new Map<string, number>();
  for (const p of people.values()) {
    const cpf = digits(p.cpf);
    if (cpf.length !== 11) { warnings.push(`${p.full_name}: sem CPF, fora do AEJ.`); continue; }
    vinc.set(p.id, vinc.size + 1);
    push(['03', vinc.get(p.id)!, cpf, clean(p.full_name).slice(0, 150)]);
  }
  push(['04', '1', String(Math.round(days.filter((d) => d.scheduled).reduce((a, d) => a + d.result.expectedMinutes, 0) / Math.max(1, days.filter((d) => d.scheduled).length))), '', '', '', '']);

  for (const [id, v] of vinc) {
    const mine = days.filter((d) => d.person.id === id);
    for (const d of mine) {
      let seq = 0;
      d.punches.forEach((p, i) => {
        const tp = i % 2 === 0 ? 'E' : 'S';
        if (tp === 'E') seq++;
        push(['05', v, local(p.at), '1', tp, seq, 'O', '1', '']);
      });
    }
    push(['06', v, clean(people.get(id)?.registration_number ?? '').slice(0, 30)]);
    for (const d of mine) if (d.result.isAbsent && !d.absenceReason) push(['07', v, '2', d.date, d.result.expectedMinutes, '']);
  }
  push(['08', 'SuperPonto', '1.0', '1', '', 'SuperPonto', '']);
  push(['99', ...['01', '02', '03', '04', '05', '06', '07', '08'].map((k) => count[k] ?? 0)]);
  return { content: lines.join('\r\n') + '\r\n', warnings };
}
