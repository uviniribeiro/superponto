import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@superponto/database';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { can } from '../authorization/authorization.js';
import { ACTION_LABELS, MODULE_LABELS, PERMISSIONS, RESOURCE_LABELS } from '../authorization/catalog.js';
import { HolidaysService } from '../holidays/holidays.service.js';
import { mirrorHashOf } from '../tools/mirror-hash.js';
import { maskCpf } from '../people/employees.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { EMP_SELECT, iso, LEAVE_LABEL, local, TimesheetCore, toDate, type DayView, type Emp } from '../timesheet/timesheet.core.js';

export type ColType = 'text' | 'minutes' | 'number' | 'date' | 'percent' | 'datetime';
export interface Col { key: string; label: string; type?: ColType }
type Row = Record<string, unknown>;
interface Ctx { tenantId: string; user: AuthUser; f: Filters; emps: () => Promise<Array<Emp & Extra>>; days: () => Promise<Map<string, DayView[]>>; tx: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T> }
type Extra = { person: { fullName: string; socialName: string | null; pis?: string | null }; department: { name: string } | null; position: { name: string } | null; company: { legalName: string; tradeName: string | null } };
interface ReportDef { key: string; title: string; category: string; description: string; period: 'required' | 'optional' | 'none'; permission?: string; columns: Col[] | ((ctx: Ctx) => Promise<Col[]>); run: (ctx: Ctx) => Promise<Row[]> }

const civil = z.iso.date();
export const filtersSchema = z.object({
  companyId: z.uuid(),
  from: civil.optional(),
  to: civil.optional(),
  departmentId: z.uuid().optional(),
  includeSubdepartments: z.boolean().default(true),
  groupingId: z.uuid().optional(),
  employeeTypeId: z.uuid().optional(),
  employmentIds: z.array(z.uuid()).max(2000).optional(),
  status: z.enum(['ACTIVE', 'ALL']).default('ACTIVE'),
  /** montador: campos escolhidos */
  fields: z.array(z.string().max(40)).max(30).optional(),
});
export type Filters = z.infer<typeof filtersSchema>;

const name = (e: { person: { fullName: string; socialName: string | null } }) => e.person.socialName ?? e.person.fullName;
const base = (e: Emp & Extra) => ({ registration: e.registration, name: name(e), department: e.department?.name ?? '', position: e.position?.name ?? '' });
const EMP_COLS: Col[] = [{ key: 'registration', label: 'Matrícula' }, { key: 'name', label: 'Funcionário' }, { key: 'department', label: 'Departamento' }];
const dmy = (v: string) => v.split('-').reverse().join('/');
const punchList = (d: DayView) => d.punches.filter((p) => p.status === 'ORIGINAL' || p.status === 'INCLUDED').map((p) => p.time).join(' ');
const sum = (rows: Row[], key: string) => rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
const FLAG: Record<string, string> = { ABSENCE: 'Falta', INCOMPLETE: 'Marcação ímpar', LATE: 'Atraso', EARLY_LEAVE: 'Saída antecipada', INSUFFICIENT_BREAK: 'Intervalo curto', OVERTIME_LIMIT_EXCEEDED: 'Extra acima do limite', WORK_ON_REST_DAY: 'Trabalho na folga', WORK_ON_HOLIDAY: 'Trabalho no feriado', LEAVE_FULL: 'Abonado', JUSTIFIED: 'Justificado', OVERTIME_UNAUTHORIZED: 'Extra sem autorização', BREAK_EXCEEDED: 'Intervalo excedido' };
const flags = (d: DayView) => (d.result?.flags ?? []).map((f) => FLAG[f]).filter(Boolean).join(', ');

/** Para cada funcionário, os dias apurados (com o vínculo). */
async function perDay(ctx: Ctx) {
  const [emps, days] = await Promise.all([ctx.emps(), ctx.days()]);
  return emps.flatMap((e) => (days.get(e.id) ?? []).map((d) => ({ e, d })));
}

const REPORTS: ReportDef[] = [
  // ------------------------------------------------------------- Ponto
  {
    key: 'horas-trabalhadas', title: 'Horas trabalhadas', category: 'Ponto', period: 'required', description: 'Previsto, trabalhado, saldo, extras, noturno, faltas e atrasos por funcionário.',
    columns: [...EMP_COLS, { key: 'expected', label: 'Previsto', type: 'minutes' }, { key: 'worked', label: 'Trabalhado', type: 'minutes' }, { key: 'balance', label: 'Saldo', type: 'minutes' }, { key: 'overtime', label: 'Extras', type: 'minutes' }, { key: 'night', label: 'Noturno (reduzido)', type: 'minutes' }, { key: 'absences', label: 'Faltas (dias)', type: 'number' }, { key: 'late', label: 'Atrasos', type: 'minutes' }],
    run: async (ctx) => {
      const [emps, days] = await Promise.all([ctx.emps(), ctx.days()]);
      return emps.map((e) => {
        const r = (days.get(e.id) ?? []).map((d) => d.result).filter(Boolean) as NonNullable<DayView['result']>[];
        return { ...base(e), expected: r.reduce((s, x) => s + x.expectedMinutes, 0), worked: r.reduce((s, x) => s + x.workedMinutes, 0), balance: r.reduce((s, x) => s + x.balanceMinutes, 0), overtime: r.reduce((s, x) => s + x.overtimeMinutes, 0), night: r.reduce((s, x) => s + x.nightReducedMinutes, 0), absences: r.filter((x) => x.flags.includes('ABSENCE')).length, late: r.reduce((s, x) => s + x.lateMinutes, 0) };
      });
    },
  },
  {
    key: 'folha-conferencia', title: 'Folha de conferência (para a folha de pagamento)', category: 'Ponto', period: 'required', description: 'Horas normais, extras por percentual, noturno, faltas, abonos e sobreaviso por funcionário.',
    columns: async (ctx) => {
      const pcts = new Set<number>();
      for (const list of (await ctx.days()).values()) for (const d of list) for (const o of d.result?.overtime ?? []) pcts.add(o.percent);
      return [...EMP_COLS, { key: 'normal', label: 'Horas normais', type: 'minutes' }, ...[...pcts].sort((a, b) => a - b).map((p) => ({ key: `ot${p}`, label: `Extra ${p}%`, type: 'minutes' as const })), { key: 'night', label: 'Adicional noturno', type: 'minutes' }, { key: 'absence', label: 'Faltas', type: 'minutes' }, { key: 'late', label: 'Atrasos e saídas', type: 'minutes' }, { key: 'allowances', label: 'Dias abonados', type: 'number' }, { key: 'onCall', label: 'Sobreaviso (1/3)', type: 'minutes' }];
    },
    run: async (ctx) => {
      const [emps, days] = await Promise.all([ctx.emps(), ctx.days()]);
      return emps.map((e) => {
        const list = days.get(e.id) ?? [];
        const r = list.map((d) => d.result).filter(Boolean) as NonNullable<DayView['result']>[];
        const row: Row = { ...base(e), normal: r.reduce((s, x) => s + Math.max(0, x.workedMinutes - x.overtimeMinutes), 0), night: r.reduce((s, x) => s + x.nightReducedMinutes, 0) };
        for (const x of r) for (const o of x.overtime) row[`ot${o.percent}`] = Number(row[`ot${o.percent}`] ?? 0) + o.minutes;
        row.absence = r.filter((x) => x.flags.includes('ABSENCE')).reduce((s, x) => s + Math.abs(Math.min(0, x.balanceMinutes)), 0);
        row.late = r.reduce((s, x) => s + x.lateMinutes + x.earlyLeaveMinutes, 0);
        row.allowances = list.filter((d) => d.allowance?.fullDay && d.allowance.disregardsDebits).length;
        row.onCall = Math.round(list.reduce((s, d) => s + d.onCall.reduce((a, o) => a + o.minutes, 0), 0) / 3);
        return row;
      });
    },
  },
  {
    key: 'cartao-ponto', title: 'Cartão ponto (espelho em lote)', category: 'Ponto', period: 'required', description: 'Todos os dias de cada funcionário: previsto, marcações, trabalhado, saldo e ocorrências.',
    columns: [...EMP_COLS.slice(0, 2), { key: 'date', label: 'Data', type: 'date' }, { key: 'expected', label: 'Previsto' }, { key: 'punches', label: 'Marcações' }, { key: 'worked', label: 'Trabalhado', type: 'minutes' }, { key: 'balance', label: 'Saldo', type: 'minutes' }, { key: 'flags', label: 'Ocorrências' }],
    run: async (ctx) => (await perDay(ctx)).map(({ e, d }) => {
      const x = d.expected as { isWorkday: boolean; isHoliday: boolean; start: string | null; end: string | null; holidayName: string | null };
      return { registration: e.registration, name: name(e), date: d.date, expected: d.leave ? d.leave.label : x.isHoliday ? (x.holidayName ?? 'Feriado') : x.isWorkday ? `${x.start ?? ''}–${x.end ?? ''}` : 'Folga', punches: punchList(d), worked: d.result?.workedMinutes ?? 0, balance: d.result?.balanceMinutes ?? 0, flags: flags(d) };
    }),
  },
  {
    key: 'extras', title: 'Analítico de horas extras', category: 'Ponto', period: 'required', description: 'Cada dia com hora extra, por percentual, e se havia autorização.',
    columns: [...EMP_COLS.slice(0, 2), { key: 'date', label: 'Data', type: 'date' }, { key: 'minutes', label: 'Extra', type: 'minutes' }, { key: 'percents', label: 'Percentuais' }, { key: 'unauthorized', label: 'Sem autorização', type: 'minutes' }, { key: 'kind', label: 'Dia' }],
    run: async (ctx) => (await perDay(ctx)).filter(({ d }) => (d.result?.overtimeMinutes ?? 0) > 0).map(({ e, d }) => ({ registration: e.registration, name: name(e), date: d.date, minutes: d.result!.overtimeMinutes, percents: d.result!.overtime.map((o) => `${o.minutes}min a ${o.percent}%`).join(', '), unauthorized: d.result!.unauthorizedOvertimeMinutes, kind: d.result!.flags.includes('WORK_ON_HOLIDAY') ? 'Feriado' : d.result!.flags.includes('WORK_ON_REST_DAY') ? 'Folga' : 'Útil' })),
  },
  {
    key: 'faltas', title: 'Analítico de faltas', category: 'Ponto', period: 'required', description: 'Dias de falta, com previsto e se foram justificados.',
    columns: [...EMP_COLS, { key: 'date', label: 'Data', type: 'date' }, { key: 'expected', label: 'Previsto', type: 'minutes' }, { key: 'justified', label: 'Justificativa' }],
    run: async (ctx) => (await perDay(ctx)).filter(({ d }) => d.result?.flags.includes('ABSENCE') || (d.allowance?.fullDay && !d.punches.length)).map(({ e, d }) => ({ ...base(e), date: d.date, expected: d.result?.expectedMinutes ?? 0, justified: d.allowance ? `${d.allowance.justification}${d.allowance.disregardsDebits ? ' (abonada)' : ''}` : '' })),
  },
  {
    key: 'atrasos', title: 'Analítico de atrasos e saídas antecipadas', category: 'Ponto', period: 'required', description: 'Dias com atraso ou saída antes do horário.',
    columns: [...EMP_COLS.slice(0, 2), { key: 'date', label: 'Data', type: 'date' }, { key: 'scheduled', label: 'Horário' }, { key: 'punches', label: 'Marcações' }, { key: 'late', label: 'Atraso', type: 'minutes' }, { key: 'early', label: 'Saída antecipada', type: 'minutes' }],
    run: async (ctx) => (await perDay(ctx)).filter(({ d }) => (d.result?.lateMinutes ?? 0) + (d.result?.earlyLeaveMinutes ?? 0) > 0).map(({ e, d }) => { const x = d.expected as { start: string | null; end: string | null }; return { registration: e.registration, name: name(e), date: d.date, scheduled: `${x.start ?? ''}–${x.end ?? ''}`, punches: punchList(d), late: d.result!.lateMinutes, early: d.result!.earlyLeaveMinutes }; }),
  },
  {
    key: 'marcacao-incompleta', title: 'Marcações incompletas (ímpares)', category: 'Ponto', period: 'required', description: 'Dias com número ímpar de marcações, a tratar antes do fechamento.',
    columns: [...EMP_COLS.slice(0, 2), { key: 'date', label: 'Data', type: 'date' }, { key: 'punches', label: 'Marcações' }],
    run: async (ctx) => (await perDay(ctx)).filter(({ d }) => d.result?.flags.includes('INCOMPLETE')).map(({ e, d }) => ({ registration: e.registration, name: name(e), date: d.date, punches: punchList(d) })),
  },
  {
    key: 'deficit-intervalo', title: 'Déficit de intervalo', category: 'Ponto', period: 'required', description: 'Dias com intervalo menor que o mínimo (CLT art. 71), com o tempo que faltou.',
    columns: [...EMP_COLS.slice(0, 2), { key: 'date', label: 'Data', type: 'date' }, { key: 'break', label: 'Intervalo feito', type: 'minutes' }, { key: 'shortfall', label: 'Faltou', type: 'minutes' }],
    run: async (ctx) => (await perDay(ctx)).filter(({ d }) => d.result?.flags.includes('INSUFFICIENT_BREAK')).map(({ e, d }) => ({ registration: e.registration, name: name(e), date: d.date, break: d.result!.breakMinutes, shortfall: (d.result as unknown as { breakShortfallMinutes: number }).breakShortfallMinutes })),
  },
  {
    key: 'interjornada', title: 'Interjornada (descanso menor que 11h)', category: 'Ponto', period: 'required', description: 'Descanso entre o fim de uma jornada e o início da seguinte menor que 11 horas (CLT art. 66).',
    columns: [...EMP_COLS.slice(0, 2), { key: 'date', label: 'Dia', type: 'date' }, { key: 'lastExit', label: 'Saída anterior', type: 'datetime' }, { key: 'firstEntry', label: 'Entrada', type: 'datetime' }, { key: 'rest', label: 'Descanso', type: 'minutes' }, { key: 'missing', label: 'Faltou para 11h', type: 'minutes' }],
    run: async (ctx) => {
      const [emps, days] = await Promise.all([ctx.emps(), ctx.days()]);
      const out: Row[] = [];
      for (const e of emps) {
        let prev: string | null = null;
        for (const d of days.get(e.id) ?? []) {
          const ps = d.punches.filter((p) => p.status === 'ORIGINAL' || p.status === 'INCLUDED');
          if (!ps.length) continue;
          if (prev) {
            const rest = Math.round((Date.parse(ps[0]!.at) - Date.parse(prev)) / 60000);
            if (rest >= 0 && rest < 660) out.push({ registration: e.registration, name: name(e), date: d.date, lastExit: prev, firstEntry: ps[0]!.at, rest, missing: 660 - rest });
          }
          prev = ps.length % 2 === 0 ? ps.at(-1)!.at : null;
        }
      }
      return out;
    },
  },
  {
    key: 'absenteismo', title: 'Absenteísmo', category: 'Ponto', period: 'required', description: 'Ausências (faltas, atrasos e saídas antecipadas) sobre as horas previstas, por funcionário.',
    columns: [...EMP_COLS, { key: 'expected', label: 'Previsto', type: 'minutes' }, { key: 'absent', label: 'Ausente', type: 'minutes' }, { key: 'rate', label: 'Absenteísmo', type: 'percent' }],
    run: async (ctx) => {
      const [emps, days] = await Promise.all([ctx.emps(), ctx.days()]);
      return emps.map((e) => {
        const r = (days.get(e.id) ?? []).map((d) => d.result).filter(Boolean) as NonNullable<DayView['result']>[];
        const expected = r.reduce((s, x) => s + x.expectedMinutes, 0);
        const absent = r.reduce((s, x) => s + (x.flags.includes('ABSENCE') ? x.expectedMinutes : 0) + x.lateMinutes + x.earlyLeaveMinutes, 0);
        return { ...base(e), expected, absent, rate: expected ? absent / expected : 0 };
      });
    },
  },
  {
    key: 'frequencia', title: 'Frequência sintética (assiduidade)', category: 'Ponto', period: 'required', description: 'Dias previstos, presentes, faltas, abonados e afastados, com o percentual de presença.',
    columns: [...EMP_COLS, { key: 'workdays', label: 'Dias previstos', type: 'number' }, { key: 'present', label: 'Presentes', type: 'number' }, { key: 'absent', label: 'Faltas', type: 'number' }, { key: 'allowance', label: 'Abonados', type: 'number' }, { key: 'leave', label: 'Afastados', type: 'number' }, { key: 'rate', label: 'Presença', type: 'percent' }],
    run: async (ctx) => {
      const [emps, days] = await Promise.all([ctx.emps(), ctx.days()]);
      return emps.map((e) => {
        const list = (days.get(e.id) ?? []).filter((d) => d.result && (d.expected as { isWorkday: boolean }).isWorkday);
        const present = list.filter((d) => d.punches.some((p) => p.status !== 'DISREGARDED')).length;
        return { ...base(e), workdays: list.length, present, absent: list.filter((d) => d.result!.flags.includes('ABSENCE')).length, allowance: list.filter((d) => d.allowance?.fullDay).length, leave: list.filter((d) => d.leave).length, rate: list.length ? present / list.length : 0 };
      });
    },
  },
  {
    key: 'noturno', title: 'Adicional noturno', category: 'Ponto', period: 'required', description: 'Minutos noturnos trabalhados e convertidos em hora reduzida (52min30s).',
    columns: [...EMP_COLS, { key: 'night', label: 'Noturno (relógio)', type: 'minutes' }, { key: 'reduced', label: 'Noturno (hora reduzida)', type: 'minutes' }],
    run: async (ctx) => { const [emps, days] = await Promise.all([ctx.emps(), ctx.days()]); return emps.map((e) => { const r = (days.get(e.id) ?? []).map((d) => d.result).filter(Boolean) as NonNullable<DayView['result']>[]; return { ...base(e), night: r.reduce((s, x) => s + x.nightMinutes, 0), reduced: r.reduce((s, x) => s + x.nightReducedMinutes, 0) }; }).filter((r) => r.night > 0); },
  },
  {
    key: 'sobreaviso', title: 'Sobreaviso', category: 'Ponto', period: 'required', description: 'Lançamentos de sobreaviso e o valor de 1/3 (CLT art. 244 §2º).',
    columns: [...EMP_COLS.slice(0, 2), { key: 'date', label: 'Data', type: 'date' }, { key: 'period', label: 'Período' }, { key: 'minutes', label: 'Sobreaviso', type: 'minutes' }, { key: 'paid', label: 'A pagar (1/3)', type: 'minutes' }],
    run: async (ctx) => (await perDay(ctx)).flatMap(({ e, d }) => d.onCall.map((o) => ({ registration: e.registration, name: name(e), date: d.date, period: `${o.startTime}–${o.endTime}`, minutes: o.minutes, paid: Math.round(o.minutes / 3) }))),
  },
  // ------------------------------------------------------------- Movimentações
  {
    key: 'abonos', title: 'Abonos', category: 'Movimentações', period: 'required', description: 'Abonos lançados no período.',
    columns: [...EMP_COLS.slice(0, 2), { key: 'date', label: 'Data', type: 'date' }, { key: 'justification', label: 'Justificativa' }, { key: 'kind', label: 'Tipo' }, { key: 'note', label: 'Observação' }],
    run: async (ctx) => { const ids = (await ctx.emps()).map((e) => e.id); return (await ctx.tx((tx) => tx.allowance.findMany({ where: { employmentId: { in: ids }, date: { gte: toDate(ctx.f.from!), lte: toDate(ctx.f.to!) } }, include: { justification: true, employment: { select: { registration: true, person: { select: { fullName: true, socialName: true } } } } }, orderBy: { date: 'asc' } }))).map((a) => ({ registration: a.employment.registration, name: name(a.employment), date: iso(a.date), justification: a.justification.name, kind: a.fullDay ? 'Dia inteiro' : `${a.minutes} min`, note: a.note ?? '' })); },
  },
  {
    key: 'afastamentos', title: 'Afastamentos', category: 'Movimentações', period: 'required', description: 'Atestados, férias e licenças que tocam o período.',
    columns: [...EMP_COLS.slice(0, 2), { key: 'type', label: 'Tipo' }, { key: 'start', label: 'Início', type: 'date' }, { key: 'end', label: 'Fim', type: 'date' }, { key: 'days', label: 'Dias', type: 'number' }],
    run: async (ctx) => { const ids = (await ctx.emps()).map((e) => e.id); return (await ctx.tx((tx) => tx.leave.findMany({ where: { employmentId: { in: ids }, deletedAt: null, startDate: { lte: toDate(ctx.f.to!) }, endDate: { gte: toDate(ctx.f.from!) } }, include: { employment: { select: { registration: true, person: { select: { fullName: true, socialName: true } } } } }, orderBy: { startDate: 'asc' } }))).map((l) => ({ registration: l.employment.registration, name: name(l.employment), type: LEAVE_LABEL[l.type] ?? l.type, start: iso(l.startDate), end: iso(l.endDate), days: Math.round((l.endDate.getTime() - l.startDate.getTime()) / 86_400_000) + 1 })); },
  },
  {
    key: 'ajustes', title: 'Ajustes manuais de marcação', category: 'Movimentações', period: 'required', description: 'Inclusões e desconsiderações, com justificativa, situação e quem decidiu.',
    columns: [...EMP_COLS.slice(0, 2), { key: 'when', label: 'Marcação', type: 'datetime' }, { key: 'kind', label: 'Ajuste' }, { key: 'status', label: 'Situação' }, { key: 'justification', label: 'Justificativa' }],
    run: async (ctx) => {
      const emps = await ctx.emps(); const byId = new Map(emps.map((e) => [e.id, e]));
      const rows = await ctx.tx((tx) => tx.timeRecordAdjustment.findMany({ where: { employmentId: { in: emps.map((e) => e.id) }, createdAt: { gte: new Date(`${ctx.f.from}T00:00:00-03:00`), lt: new Date(new Date(`${ctx.f.to}T00:00:00-03:00`).getTime() + 86_400_000) } }, include: { timeRecord: { select: { recordedAt: true } } }, orderBy: { createdAt: 'asc' } }));
      const st: Record<string, string> = { PENDING: 'Pendente', APPROVED: 'Aprovado', REJECTED: 'Recusado', CANCELLED: 'Cancelado' };
      return rows.map((a) => ({ registration: byId.get(a.employmentId)?.registration, name: byId.get(a.employmentId) ? name(byId.get(a.employmentId)!) : '', when: (a.recordedAt ?? a.timeRecord?.recordedAt)?.toISOString() ?? '', kind: a.kind === 'INCLUDE' ? 'Inclusão' : a.kind === 'DISREGARD' ? 'Desconsiderar' : a.kind, status: st[a.status] ?? a.status, justification: a.justification }));
    },
  },
  {
    key: 'solicitacoes', title: 'Solicitações', category: 'Movimentações', period: 'required', description: 'Pedidos abertos no período, com tipo, situação e etapa.',
    columns: [...EMP_COLS.slice(0, 2), { key: 'createdAt', label: 'Aberta em', type: 'datetime' }, { key: 'type', label: 'Tipo' }, { key: 'refDate', label: 'Dia', type: 'date' }, { key: 'status', label: 'Situação' }, { key: 'justification', label: 'Motivo' }],
    run: async (ctx) => {
      const ids = (await ctx.emps()).map((e) => e.id);
      const T: Record<string, string> = { RECORD_CORRECTION: 'Inclusão de marcação', ABSENCE_JUSTIFICATION: 'Justificativa', SCHEDULE_CHANGE: 'Troca de folga', OVERTIME_AUTHORIZATION: 'Autorização de extra', OTHER: 'Outro' };
      const S: Record<string, string> = { PENDING: 'Pendente', APPROVED: 'Aprovada', REJECTED: 'Recusada', CANCELLED: 'Cancelada' };
      return (await ctx.tx((tx) => tx.timeRequest.findMany({ where: { employmentId: { in: ids }, createdAt: { gte: new Date(`${ctx.f.from}T00:00:00-03:00`), lt: new Date(new Date(`${ctx.f.to}T00:00:00-03:00`).getTime() + 86_400_000) } }, include: { employment: { select: { registration: true, person: { select: { fullName: true, socialName: true } } } } }, orderBy: { createdAt: 'asc' } }))).map((r) => ({ registration: r.employment.registration, name: name(r.employment), createdAt: r.createdAt.toISOString(), type: T[r.type] ?? r.type, refDate: r.refDate ? iso(r.refDate) : '', status: S[r.status] ?? r.status, justification: r.justification }));
    },
  },
  {
    key: 'trocas-escala', title: 'Trocas de escala e escala agendada', category: 'Movimentações', period: 'required', description: 'Dias definidos por escala agendada ou troca, com o horário e o motivo.',
    columns: [...EMP_COLS.slice(0, 2), { key: 'date', label: 'Data', type: 'date' }, { key: 'origin', label: 'Origem' }, { key: 'plan', label: 'Dia' }, { key: 'note', label: 'Motivo' }],
    run: async (ctx) => { const ids = (await ctx.emps()).map((e) => e.id); return (await ctx.tx((tx) => tx.scheduleOverride.findMany({ where: { employmentId: { in: ids }, date: { gte: toDate(ctx.f.from!), lte: toDate(ctx.f.to!) } }, include: { employment: { select: { registration: true, person: { select: { fullName: true, socialName: true } } } } }, orderBy: { date: 'asc' } }))).map((o) => ({ registration: o.employment.registration, name: name(o.employment), date: iso(o.date), origin: o.origin === 'TROCA' ? 'Troca' : 'Escala agendada', plan: o.isWorkday ? `${o.startTime}–${o.endTime}` : 'Folga', note: o.note ?? '' })); },
  },
  {
    key: 'escala-mensal', title: 'Escala do período', category: 'Movimentações', period: 'required', description: 'Horário previsto de cada funcionário em cada dia (folgas, feriados e afastamentos).',
    columns: [...EMP_COLS.slice(0, 2), { key: 'date', label: 'Data', type: 'date' }, { key: 'plan', label: 'Previsto' }, { key: 'schedule', label: 'Horário' }],
    run: async (ctx) => (await perDay(ctx)).map(({ e, d }) => { const x = d.expected as { isWorkday: boolean; isHoliday: boolean; start: string | null; end: string | null; holidayName: string | null; scheduleName: string | null }; return { registration: e.registration, name: name(e), date: d.date, plan: d.leave ? d.leave.label : x.isHoliday ? (x.holidayName ?? 'Feriado') : x.isWorkday ? `${x.start ?? ''}–${x.end ?? ''}` : 'Folga', schedule: x.scheduleName ?? '' }; }),
  },
  // ------------------------------------------------------------- Bancos
  {
    key: 'banco-saldos', title: 'Saldos do banco de horas', category: 'Bancos', period: 'none', description: 'Saldo atual de cada funcionário.',
    columns: [...EMP_COLS, { key: 'balance', label: 'Saldo', type: 'minutes' }],
    run: async (ctx) => { const emps = await ctx.emps(); const acc = await ctx.tx((tx) => tx.bankHourAccount.findMany({ where: { employmentId: { in: emps.map((e) => e.id) } } })); return emps.map((e) => ({ ...base(e), balance: acc.find((a) => a.employmentId === e.id)?.balanceMinutes ?? 0 })); },
  },
  {
    key: 'banco-extrato', title: 'Extrato do banco de horas', category: 'Bancos', period: 'required', description: 'Lançamentos do período: créditos, débitos, vencimentos, pagamentos e ajustes.',
    columns: [...EMP_COLS.slice(0, 2), { key: 'date', label: 'Data', type: 'date' }, { key: 'type', label: 'Lançamento' }, { key: 'minutes', label: 'Horas', type: 'minutes' }, { key: 'expires', label: 'Vence em', type: 'date' }, { key: 'description', label: 'Descrição' }],
    run: async (ctx) => {
      const emps = await ctx.emps(); const byId = new Map(emps.map((e) => [e.id, e]));
      const T: Record<string, string> = { CREDIT: 'Crédito', DEBIT: 'Débito', EXPIRATION: 'Vencimento', ADJUSTMENT: 'Ajuste', PAYOUT: 'Pagamento', COMPENSATION: 'Compensação' };
      const txs = await ctx.tx((tx) => tx.bankHourTransaction.findMany({ where: { account: { employmentId: { in: emps.map((e) => e.id) } }, refDate: { gte: toDate(ctx.f.from!), lte: toDate(ctx.f.to!) } }, include: { account: { select: { employmentId: true } } }, orderBy: [{ refDate: 'asc' }] }));
      return txs.map((t) => { const e = byId.get(t.account.employmentId)!; return { registration: e.registration, name: name(e), date: iso(t.refDate), type: T[t.type] ?? t.type, minutes: t.minutes, expires: t.expiresOn ? iso(t.expiresOn) : '', description: t.description ?? '' }; });
    },
  },
  // ------------------------------------------------------------- Cadastros
  {
    key: 'funcionarios', title: 'Funcionários', category: 'Cadastros', period: 'none', description: 'Lista de funcionários com cargo, departamento, admissão e situação.',
    columns: [...EMP_COLS, { key: 'position', label: 'Cargo' }, { key: 'cpf', label: 'CPF' }, { key: 'hiredAt', label: 'Admissão', type: 'date' }, { key: 'terminatedAt', label: 'Desligamento', type: 'date' }, { key: 'status', label: 'Situação' }],
    run: async (ctx) => {
      const sensitive = can(ctx.user, 'people.sensitive:read');
      const S: Record<string, string> = { ACTIVE: 'Ativo', ON_LEAVE: 'Afastado', SUSPENDED: 'Suspenso', TERMINATED: 'Desligado' };
      return (await ctx.emps()).map((e) => ({ ...base(e), cpf: sensitive ? (e as unknown as { person: { cpf: string | null } }).person.cpf ?? '' : maskCpf((e as unknown as { person: { cpf: string | null } }).person.cpf) ?? '', hiredAt: iso(e.hiredAt), terminatedAt: e.terminatedAt ? iso(e.terminatedAt) : '', status: S[e.status] ?? e.status }));
    },
  },
  {
    key: 'aniversariantes', title: 'Aniversariantes', category: 'Cadastros', period: 'required', description: 'Funcionários que fazem aniversário nos meses do período.',
    columns: [...EMP_COLS, { key: 'birthday', label: 'Aniversário' }],
    run: async (ctx) => {
      const months = new Set<string>();
      for (let d = ctx.f.from!; d <= ctx.f.to!; d = iso(new Date(toDate(d).getTime() + 86_400_000))) months.add(d.slice(5, 7));
      return (await ctx.emps()).map((e) => ({ e, b: (e as unknown as { person: { birthDate: Date | null } }).person.birthDate })).filter(({ b }) => b && months.has(iso(b).slice(5, 7))).sort((a, b) => iso(a.b!).slice(5).localeCompare(iso(b.b!).slice(5))).map(({ e, b }) => ({ ...base(e), birthday: `${iso(b!).slice(8, 10)}/${iso(b!).slice(5, 7)}` }));
    },
  },
  {
    key: 'feriados', title: 'Feriados', category: 'Cadastros', period: 'required', description: 'Feriados e pontos facultativos da empresa no período.',
    columns: [{ key: 'date', label: 'Data', type: 'date' }, { key: 'name', label: 'Feriado' }, { key: 'scope', label: 'Abrangência' }, { key: 'workday', label: 'Trabalha?' }],
    run: async () => [],
  },
  {
    key: 'marcacoes', title: 'Marcações', category: 'Equipamentos e marcações', period: 'required', description: 'Todas as marcações recebidas, com origem e equipamento.',
    columns: [...EMP_COLS.slice(0, 2), { key: 'at', label: 'Data e hora', type: 'datetime' }, { key: 'source', label: 'Origem' }, { key: 'device', label: 'Equipamento' }, { key: 'location', label: 'Localização' }],
    run: async (ctx) => marks(ctx, false),
  },
  {
    key: 'marcacao-web', title: 'Marcações pelo navegador e app', category: 'Equipamentos e marcações', period: 'required', description: 'Marcações do REP-P (navegador e app), com localização quando houver.',
    columns: [...EMP_COLS.slice(0, 2), { key: 'at', label: 'Data e hora', type: 'datetime' }, { key: 'source', label: 'Origem' }, { key: 'location', label: 'Localização' }],
    run: async (ctx) => marks(ctx, true),
  },
  {
    key: 'eventos-equipamento', title: 'Eventos dos equipamentos', category: 'Equipamentos e marcações', period: 'required', description: 'Contatos, comandos, falhas e alertas de comunicação.',
    columns: [{ key: 'at', label: 'Data e hora', type: 'datetime' }, { key: 'device', label: 'Equipamento' }, { key: 'level', label: 'Nível' }, { key: 'message', label: 'Evento' }],
    run: async (ctx) => (await ctx.tx((tx) => tx.deviceLog.findMany({ where: { device: { companyId: ctx.f.companyId }, createdAt: { gte: new Date(`${ctx.f.from}T00:00:00-03:00`), lt: new Date(new Date(`${ctx.f.to}T00:00:00-03:00`).getTime() + 86_400_000) } }, include: { device: { select: { name: true } } }, orderBy: { createdAt: 'asc' }, take: 20000 }))).map((l) => ({ at: l.createdAt.toISOString(), device: l.device.name, level: l.level === 'info' ? 'Informação' : l.level === 'warn' ? 'Aviso' : 'Erro', message: l.message })),
  },
  {
    key: 'divergencias', title: 'Divergências de jornada', category: 'Ponto', period: 'required', description: 'Marcou sem horário previsto, trabalhou na folga ou marcou muito fora do horário (mais de 2 horas antes ou depois).',
    columns: [...EMP_COLS.slice(0, 2), { key: 'date', label: 'Data', type: 'date' }, { key: 'expected', label: 'Previsto' }, { key: 'punches', label: 'Marcações' }, { key: 'issue', label: 'Divergência' }],
    run: async (ctx) => {
      const out: Row[] = [];
      const m = (hm: string | null) => (hm ? Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5)) : null);
      for (const { e, d } of await perDay(ctx)) {
        const ps = d.punches.filter((p) => p.status === 'ORIGINAL' || p.status === 'INCLUDED');
        if (!ps.length || d.leave) continue;
        const x = d.expected as { isWorkday: boolean; isHoliday: boolean; start: string | null; end: string | null; scheduleName: string | null };
        const issues: string[] = [];
        if (!x.scheduleName) issues.push('Marcou sem horário atribuído');
        else if (x.isHoliday) issues.push('Trabalhou no feriado');
        else if (!x.isWorkday) issues.push('Trabalhou na folga');
        else {
          const s0 = m(x.start), e0 = m(x.end), first = m(ps[0]!.time), last = m(ps.at(-1)!.time);
          if (s0 !== null && first !== null && s0 - first > 120) issues.push(`Entrada ${s0 - first} min antes do horário`);
          if (e0 !== null && last !== null && e0 > s0! && last - e0 > 120) issues.push(`Saída ${last - e0} min depois do horário`);
        }
        if (issues.length) out.push({ registration: e.registration, name: name(e), date: d.date, expected: x.isWorkday ? `${x.start ?? ''}–${x.end ?? ''}` : x.scheduleName ? 'Folga' : 'Sem horário', punches: punchList(d), issue: issues.join('; ') });
      }
      return out;
    },
  },
  {
    key: 'intervalo-nao-calculavel', title: 'Intervalo não calculável', category: 'Ponto', period: 'required', description: 'Dias com intervalo previsto em que as marcações não permitem medir o intervalo (só entrada e saída, ou número ímpar).',
    columns: [...EMP_COLS.slice(0, 2), { key: 'date', label: 'Data', type: 'date' }, { key: 'breakExpected', label: 'Intervalo previsto', type: 'minutes' }, { key: 'punches', label: 'Marcações' }, { key: 'reason', label: 'Motivo' }],
    run: async (ctx) => (await perDay(ctx)).flatMap(({ e, d }) => {
      const n = d.punches.filter((p) => p.status === 'ORIGINAL' || p.status === 'INCLUDED').length;
      const b = (d.expected as { breakMinutes: number; isWorkday: boolean }).breakMinutes ?? 0;
      if (!b || !n || n >= 4 && n % 2 === 0) return [];
      return [{ registration: e.registration, name: name(e), date: d.date, breakExpected: b, punches: punchList(d), reason: n % 2 ? 'Número ímpar de marcações' : 'Intervalo não marcado (só entrada e saída)' }];
    }),
  },
  {
    key: 'espelho-1510', title: 'Espelho de ponto (Portaria 1.510/2009 e 671/2021)', category: 'Ponto', period: 'required', description: 'Espelho por PIS: identificação, horário contratual e marcações do dia (originais e incluídas, indicadas com (I)), com as desconsideradas indicadas com (D).',
    columns: [{ key: 'pis', label: 'PIS' }, { key: 'name', label: 'Funcionário' }, { key: 'hiredAt', label: 'Admissão', type: 'date' }, { key: 'date', label: 'Data', type: 'date' }, { key: 'contract', label: 'Horário contratual' }, { key: 'punches', label: 'Marcações' }, { key: 'worked', label: 'Trabalhado', type: 'minutes' }],
    run: async (ctx) => (await perDay(ctx)).filter(({ d }) => !d.outsideEmployment).map(({ e, d }) => {
      const x = d.expected as { isWorkday: boolean; start: string | null; end: string | null; breakMinutes: number };
      const tag = (st: string) => (st === 'INCLUDED' ? '(I)' : st === 'DISREGARDED' ? '(D)' : '');
      return { pis: e.person.pis ?? '', name: name(e), hiredAt: iso(e.hiredAt), date: d.date, contract: x.isWorkday ? `${x.start ?? ''}–${x.end ?? ''}${x.breakMinutes ? ` (intervalo ${x.breakMinutes} min)` : ''}` : 'Folga', punches: d.punches.filter((p) => !p.status.startsWith('PENDING')).map((p) => `${p.time}${tag(p.status)}`).join(' '), worked: d.result?.workedMinutes ?? 0 };
    }),
  },
  {
    key: 'ciencia-espelho', title: 'Ciência eletrônica do espelho', category: 'Ponto', period: 'required', description: 'Quem deu ciência no espelho do período exato informado (de acordo ou com ressalva), quando, de qual IP, e se o espelho mudou depois.',
    columns: [...EMP_COLS, { key: 'status', label: 'Situação' }, { key: 'signedAt', label: 'Ciência em', type: 'datetime' }, { key: 'comment', label: 'Ressalva' }, { key: 'ip', label: 'IP' }, { key: 'changed', label: 'Espelho mudou depois?' }],
    run: async (ctx) => {
      const emps = await ctx.emps();
      const acks = await ctx.tx((tx) => tx.mirrorAcknowledgment.findMany({ where: { employmentId: { in: emps.map((e) => e.id) }, periodStart: toDate(ctx.f.from!), periodEnd: toDate(ctx.f.to!) } }));
      const days = acks.length ? await ctx.days() : new Map<string, DayView[]>();
      return emps.map((e) => {
        const a = acks.find((x) => x.employmentId === e.id);
        const changed = a ? mirrorHashOf(e.id, ctx.f.from!, ctx.f.to!, days.get(e.id) ?? []).hash !== a.contentHash : false;
        return { ...base(e), status: a ? (a.decision === 'AGREE' ? 'De acordo' : 'Com ressalva') : 'Pendente', signedAt: a?.createdAt.toISOString() ?? '', comment: a?.comment ?? '', ip: a?.ip ?? '', changed: a ? (changed ? 'Sim' : 'Não') : '' };
      });
    },
  },
  // ------------------------------------------------------------- Módulos especializados
  {
    key: 'plantoes-cobertura', title: 'Cobertura de plantões', category: 'Saúde', period: 'required', permission: 'health.shifts:read', description: 'Cada plantão do período por unidade: profissionais necessários, escalados e vagas descobertas.',
    columns: [{ key: 'unit', label: 'Unidade' }, { key: 'start', label: 'Início', type: 'datetime' }, { key: 'end', label: 'Fim', type: 'datetime' }, { key: 'kind', label: 'Tipo' }, { key: 'required', label: 'Necessários', type: 'number' }, { key: 'covered', label: 'Escalados', type: 'number' }, { key: 'missing', label: 'Descobertos', type: 'number' }, { key: 'names', label: 'Plantonistas' }],
    run: async (ctx) => {
      const K: Record<string, string> = { DAY: 'Diurno', NIGHT: 'Noturno', H12: '12 horas', H24: '24 horas', ON_CALL: 'Sobreaviso', EXTRA: 'Extra', COVERAGE: 'Cobertura' };
      const list = await ctx.tx((tx) => tx.medicalShift.findMany({ where: { deletedAt: null, unit: { companyId: ctx.f.companyId }, startsAt: { gte: new Date(`${ctx.f.from}T00:00:00-03:00`), lt: new Date(new Date(`${ctx.f.to}T00:00:00-03:00`).getTime() + 86_400_000) } }, orderBy: { startsAt: 'asc' }, include: { unit: { select: { name: true } }, assignments: { where: { status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] } }, include: { employment: { select: { person: { select: { fullName: true } } } } } } } }));
      return list.map((x) => ({ unit: x.unit.name, start: x.startsAt.toISOString(), end: x.endsAt.toISOString(), kind: K[x.kind] ?? x.kind, required: x.requiredProfessionals, covered: x.assignments.length, missing: Math.max(0, x.requiredProfessionals - x.assignments.length), names: x.assignments.map((a) => a.employment.person.fullName).join(', ') }));
    },
  },
  {
    key: 'plantoes-horas', title: 'Horas de plantão por profissional', category: 'Saúde', period: 'required', permission: 'health.shifts:read', description: 'Plantões escalados, cumpridos, faltas e substituições de cada profissional, com as horas previstas e as registradas (entrada e saída).',
    columns: [...EMP_COLS.slice(0, 2), { key: 'shifts', label: 'Plantões', type: 'number' }, { key: 'completed', label: 'Cumpridos', type: 'number' }, { key: 'absent', label: 'Faltas', type: 'number' }, { key: 'substituted', label: 'Substituídos', type: 'number' }, { key: 'planned', label: 'Horas previstas', type: 'minutes' }, { key: 'recorded', label: 'Horas registradas', type: 'minutes' }],
    run: async (ctx) => {
      const rows = await ctx.tx((tx) => tx.medicalShiftAssignment.findMany({ where: { status: { not: 'CANCELLED' }, shift: { deletedAt: null, unit: { companyId: ctx.f.companyId }, startsAt: { gte: new Date(`${ctx.f.from}T00:00:00-03:00`), lt: new Date(new Date(`${ctx.f.to}T00:00:00-03:00`).getTime() + 86_400_000) } } }, include: { shift: true, employment: { select: { id: true, registration: true, person: { select: { fullName: true, socialName: true } } } } } }));
      const by = new Map<string, Row>();
      for (const a of rows) {
        const r = by.get(a.employmentId) ?? by.set(a.employmentId, { registration: a.employment.registration, name: name(a.employment), shifts: 0, completed: 0, absent: 0, substituted: 0, planned: 0, recorded: 0 }).get(a.employmentId)!;
        r.shifts = Number(r.shifts) + 1;
        if (a.status === 'COMPLETED') r.completed = Number(r.completed) + 1;
        if (a.status === 'ABSENT') r.absent = Number(r.absent) + 1;
        if (a.status === 'SUBSTITUTED') r.substituted = Number(r.substituted) + 1;
        if (!['ABSENT', 'SUBSTITUTED'].includes(a.status)) r.planned = Number(r.planned) + Math.round((a.shift.endsAt.getTime() - a.shift.startsAt.getTime()) / 60000);
        if (a.checkInAt && a.checkOutAt) r.recorded = Number(r.recorded) + Math.round((a.checkOutAt.getTime() - a.checkInAt.getTime()) / 60000);
      }
      return [...by.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    },
  },
  {
    key: 'aulas-professor', title: 'Aulas por professor', category: 'Educação', period: 'required', permission: 'education.academic:read', description: 'Aulas dadas, não dadas, substituições e horas-aula de cada professor no período.',
    columns: [{ key: 'registration', label: 'Matrícula' }, { key: 'name', label: 'Professor' }, { key: 'held', label: 'Dadas', type: 'number' }, { key: 'notHeld', label: 'Não dadas', type: 'number' }, { key: 'substitutedOut', label: 'Substituído', type: 'number' }, { key: 'substitutedIn', label: 'Substituiu', type: 'number' }, { key: 'minutes', label: 'Horas-aula', type: 'minutes' }],
    run: async (ctx) => {
      const sessions = await ctx.tx((tx) => tx.classSession.findMany({ where: { sessionDate: { gte: toDate(ctx.f.from!), lte: toDate(ctx.f.to!) }, schedule: { assignment: { subject: { companyId: ctx.f.companyId } } } }, include: { schedule: { include: { assignment: { include: { employment: { select: { id: true, registration: true, person: { select: { fullName: true, socialName: true } } } } } } } } } }));
      const subs = await ctx.tx((tx) => tx.employment.findMany({ where: { id: { in: sessions.map((x) => x.substituteEmploymentId).filter(Boolean) as string[] } }, select: { id: true, registration: true, person: { select: { fullName: true, socialName: true } } } }));
      const by = new Map<string, Row>();
      const row = (e: { id: string; registration: string; person: { fullName: string; socialName: string | null } }) => by.get(e.id) ?? by.set(e.id, { registration: e.registration, name: name(e), held: 0, notHeld: 0, substitutedOut: 0, substitutedIn: 0, minutes: 0 }).get(e.id)!;
      const len = (a: string, b: string) => (Number(b.slice(0, 2)) * 60 + Number(b.slice(3))) - (Number(a.slice(0, 2)) * 60 + Number(a.slice(3)));
      for (const x of sessions) {
        const r = row(x.schedule.assignment.employment);
        const m = len(x.schedule.startTime, x.schedule.endTime);
        if (x.status === 'HELD') { r.held = Number(r.held) + 1; r.minutes = Number(r.minutes) + m; }
        if (x.status === 'NOT_HELD') r.notHeld = Number(r.notHeld) + 1;
        if (x.status === 'SUBSTITUTED' && x.substituteEmploymentId) { r.substitutedOut = Number(r.substitutedOut) + 1; const sub = subs.find((e) => e.id === x.substituteEmploymentId); if (sub) { const q = row(sub); q.substitutedIn = Number(q.substitutedIn) + 1; q.minutes = Number(q.minutes) + m; } }
      }
      return [...by.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    },
  },
  {
    key: 'ocorrencias', title: 'Ocorrências operacionais', category: 'Operacional', period: 'required', permission: 'operational.board:read', description: 'Ocorrências do período com tipo, unidade, situação, responsável e tempo até a solução.',
    columns: [{ key: 'at', label: 'Quando', type: 'datetime' }, { key: 'unit', label: 'Unidade' }, { key: 'type', label: 'Tipo' }, { key: 'title', label: 'Ocorrência' }, { key: 'status', label: 'Situação' }, { key: 'hours', label: 'Horas até resolver', type: 'number' }],
    run: async (ctx) => {
      const T: Record<string, string> = { ABSENCE: 'Falta', LATE: 'Atraso', MISSING_RECORD: 'Marcação incompleta', INCOMPLETE_TEAM: 'Equipe incompleta', OPERATIONAL_ISSUE: 'Problema operacional', EQUIPMENT_UNAVAILABLE: 'Equipamento indisponível', UNCOVERED_SHIFT: 'Plantão descoberto', OTHER: 'Outro' };
      const S: Record<string, string> = { OPEN: 'Aberta', IN_PROGRESS: 'Em tratamento', RESOLVED: 'Resolvida', DISMISSED: 'Descartada' };
      const list = await ctx.tx(async (tx) => {
        const units = await tx.companyUnit.findMany({ where: { companyId: ctx.f.companyId }, select: { id: true, name: true } });
        const occ = await tx.operationalOccurrence.findMany({ where: { unitId: { in: units.map((u) => u.id) }, occurredAt: { gte: new Date(`${ctx.f.from}T00:00:00-03:00`), lt: new Date(new Date(`${ctx.f.to}T00:00:00-03:00`).getTime() + 86_400_000) } }, orderBy: { occurredAt: 'asc' } });
        return occ.map((o) => ({ at: o.occurredAt.toISOString(), unit: units.find((u) => u.id === o.unitId)?.name ?? '', type: T[o.type] ?? o.type, title: o.title, status: S[o.status] ?? o.status, hours: o.status === 'RESOLVED' ? Math.round(((o.updatedAt.getTime() - o.occurredAt.getTime()) / 3_600_000) * 10) / 10 : '' }));
      });
      return list;
    },
  },
  // ------------------------------------------------------------- Segurança
  {
    key: 'auditoria', title: 'Auditoria', category: 'Segurança', period: 'required', permission: 'admin.audit:read', description: 'Quem alterou o quê e quando (sem dados sensíveis).',
    columns: [{ key: 'at', label: 'Data e hora', type: 'datetime' }, { key: 'user', label: 'Usuário' }, { key: 'action', label: 'Ação' }, { key: 'entity', label: 'Cadastro' }, { key: 'ip', label: 'IP' }],
    run: async (ctx) => {
      const logs = await ctx.tx((tx) => tx.auditLog.findMany({ where: { tenantId: ctx.tenantId, createdAt: { gte: new Date(`${ctx.f.from}T00:00:00-03:00`), lt: new Date(new Date(`${ctx.f.to}T00:00:00-03:00`).getTime() + 86_400_000) } }, orderBy: { createdAt: 'asc' }, take: 20000, select: { createdAt: true, actorUserId: true, action: true, entity: true, ip: true } }));
      const users = await ctx.tx((tx) => tx.user.findMany({ where: { id: { in: [...new Set(logs.map((l) => l.actorUserId).filter(Boolean) as string[])] } }, select: { id: true, displayName: true, email: true } }));
      const A: Record<string, string> = { CREATE: 'Criou', UPDATE: 'Alterou', DELETE: 'Excluiu', APPROVE: 'Aprovou', REJECT: 'Recusou', CLOSE_PERIOD: 'Fechou período', REOPEN_PERIOD: 'Reabriu período', LOGIN: 'Entrou', LOGIN_FAILED: 'Falha de login' };
      return logs.map((l) => ({ at: l.createdAt.toISOString(), user: users.find((u) => u.id === l.actorUserId)?.displayName ?? (l.actorUserId ? '' : 'Sistema'), action: A[l.action] ?? l.action, entity: l.entity, ip: l.ip ?? '' }));
    },
  },
  {
    key: 'usuarios-perfis', title: 'Usuários e perfis', category: 'Segurança', period: 'none', permission: 'admin.users:read', description: 'Usuários da organização, perfis, forma de login e último acesso.',
    columns: [{ key: 'name', label: 'Usuário' }, { key: 'email', label: 'E-mail' }, { key: 'roles', label: 'Perfis' }, { key: 'source', label: 'Login' }, { key: 'active', label: 'Ativo' }, { key: 'lastLogin', label: 'Último acesso', type: 'datetime' }],
    run: async (ctx) => (await ctx.tx((tx) => tx.user.findMany({ where: { tenantId: ctx.tenantId, deletedAt: null, isPlatformAdmin: false, ...(ctx.user.isSupport || ctx.user.isPlatformAdmin ? {} : { isSupport: false }) }, include: { roles: { include: { role: { select: { name: true } } } } }, orderBy: { displayName: 'asc' } }))).map((u) => ({ name: u.displayName, email: u.email, roles: u.roles.map((r) => r.role.name).join(', '), source: u.authSource === 'LDAP' ? 'Rede (LDAP)' : 'Senha', active: u.isActive ? 'Sim' : 'Não', lastLogin: u.lastLoginAt?.toISOString() ?? '' })),
  },
  {
    key: 'log-espelho', title: 'Log do espelho (alterações por funcionário)', category: 'Movimentações', period: 'required', permission: 'admin.audit:read', description: 'Ajustes, abonos, afastamentos, sobreaviso e marcações web lançados no período, com quem fez e quando.',
    columns: [...EMP_COLS.slice(0, 2), { key: 'at', label: 'Quando', type: 'datetime' }, { key: 'user', label: 'Usuário' }, { key: 'action', label: 'Ação' }, { key: 'entity', label: 'O quê' }, { key: 'detail', label: 'Detalhe' }],
    run: async (ctx) => {
      const emps = await ctx.emps(); const byId = new Map(emps.map((e) => [e.id, e]));
      const E: Record<string, string> = { time_adjustment: 'Ajuste de marcação', allowance: 'Abono', leave: 'Afastamento', on_call: 'Sobreaviso', time_record: 'Marcação', mirror_acknowledgment: 'Ciência do espelho', bank_transaction: 'Banco de horas' };
      const A: Record<string, string> = { CREATE: 'Lançou', UPDATE: 'Alterou', DELETE: 'Excluiu', APPROVE: 'Aprovou', REJECT: 'Recusou' };
      const logs = await ctx.tx((tx) => tx.auditLog.findMany({ where: { tenantId: ctx.tenantId, entity: { in: Object.keys(E) }, createdAt: { gte: new Date(`${ctx.f.from}T00:00:00-03:00`), lt: new Date(new Date(`${ctx.f.to}T00:00:00-03:00`).getTime() + 86_400_000) } }, orderBy: { createdAt: 'asc' }, take: 20000, select: { createdAt: true, actorUserId: true, action: true, entity: true, before: true, after: true } }));
      const empOf = (l: { before: unknown; after: unknown }) => ((l.after as { employmentId?: string } | null)?.employmentId ?? (l.before as { employmentId?: string } | null)?.employmentId) ?? null;
      const mine = logs.filter((l) => { const id = empOf(l); return id && byId.has(id); });
      const users = await ctx.tx((tx) => tx.user.findMany({ where: { id: { in: [...new Set(mine.map((l) => l.actorUserId).filter(Boolean) as string[])] } }, select: { id: true, displayName: true } }));
      const detail = (l: { after: unknown; before: unknown }) => {
        const o = (l.after ?? l.before ?? {}) as Record<string, unknown>;
        return ['kind', 'date', 'time', 'recordedAt', 'type', 'justification', 'minutes', 'from', 'to', 'decision'].filter((k) => o[k] !== undefined && o[k] !== null).map((k) => `${k}: ${String(o[k])}`).join(', ').slice(0, 300);
      };
      return mine.map((l) => { const e = byId.get(empOf(l)!)!; return { registration: e.registration, name: name(e), at: l.createdAt.toISOString(), user: users.find((u) => u.id === l.actorUserId)?.displayName ?? '', action: A[l.action] ?? l.action, entity: E[l.entity] ?? l.entity, detail: detail(l) }; });
    },
  },
  {
    key: 'acessos', title: 'Acessos (login e falhas)', category: 'Segurança', period: 'required', permission: 'admin.audit:read', description: 'Entradas no sistema e tentativas com senha errada ou fora do horário/bloqueio, com IP e navegador.',
    columns: [{ key: 'at', label: 'Data e hora', type: 'datetime' }, { key: 'user', label: 'Usuário' }, { key: 'email', label: 'E-mail' }, { key: 'result', label: 'Resultado' }, { key: 'method', label: 'Forma' }, { key: 'ip', label: 'IP' }, { key: 'agent', label: 'Navegador/app' }],
    run: async (ctx) => {
      const logs = await ctx.tx((tx) => tx.auditLog.findMany({ where: { tenantId: ctx.tenantId, action: { in: ['LOGIN', 'LOGIN_FAILED'] }, createdAt: { gte: new Date(`${ctx.f.from}T00:00:00-03:00`), lt: new Date(new Date(`${ctx.f.to}T00:00:00-03:00`).getTime() + 86_400_000) } }, orderBy: { createdAt: 'asc' }, take: 20000 }));
      const users = await ctx.tx((tx) => tx.user.findMany({ where: { id: { in: [...new Set(logs.map((l) => l.actorUserId).filter(Boolean) as string[])] } }, select: { id: true, displayName: true, email: true, isSupport: true } }));
      const hide = !ctx.user.isSupport && !ctx.user.isPlatformAdmin;
      return logs.flatMap((l) => {
        const u = users.find((x) => x.id === l.actorUserId);
        if (hide && u?.isSupport) return [];
        const a = (l.after ?? {}) as { method?: string; reason?: string };
        return [{ at: l.createdAt.toISOString(), user: u?.displayName ?? '', email: u?.email ?? '', result: l.action === 'LOGIN' ? 'Entrou' : a.reason === 'access_denied' ? 'Bloqueado (horário/bloqueio)' : 'Senha incorreta', method: a.method === 'ldap' ? 'Rede (LDAP)' : 'Senha', ip: l.ip ?? '', agent: (l.userAgent ?? '').slice(0, 80) }];
      });
    },
  },
  {
    key: 'alteracoes-senha', title: 'Alterações de senha', category: 'Segurança', period: 'required', permission: 'admin.audit:read', description: 'Trocas de senha pelo próprio usuário e redefinições pelo link do e-mail.',
    columns: [{ key: 'at', label: 'Data e hora', type: 'datetime' }, { key: 'user', label: 'Usuário' }, { key: 'email', label: 'E-mail' }, { key: 'via', label: 'Como' }, { key: 'ip', label: 'IP' }],
    run: async (ctx) => {
      const logs = await ctx.tx((tx) => tx.auditLog.findMany({ where: { tenantId: ctx.tenantId, entity: 'user_password', createdAt: { gte: new Date(`${ctx.f.from}T00:00:00-03:00`), lt: new Date(new Date(`${ctx.f.to}T00:00:00-03:00`).getTime() + 86_400_000) } }, orderBy: { createdAt: 'asc' }, take: 20000 }));
      const users = await ctx.tx((tx) => tx.user.findMany({ where: { id: { in: [...new Set(logs.map((l) => l.actorUserId).filter(Boolean) as string[])] } }, select: { id: true, displayName: true, email: true } }));
      return logs.map((l) => { const u = users.find((x) => x.id === l.actorUserId); return { at: l.createdAt.toISOString(), user: u?.displayName ?? '', email: u?.email ?? '', via: (l.after as { via?: string } | null)?.via === 'reset' ? 'Redefinição por e-mail' : 'Troca pelo usuário', ip: l.ip ?? '' }; });
    },
  },
  {
    key: 'funcionalidades-perfil', title: 'Funcionalidades por perfil', category: 'Segurança', period: 'none', permission: 'admin.users:read', description: 'O que cada perfil (do sistema e personalizado) pode fazer: módulo, recurso e ação.',
    columns: [{ key: 'role', label: 'Perfil' }, { key: 'kind', label: 'Tipo' }, { key: 'module', label: 'Módulo' }, { key: 'resource', label: 'Recurso' }, { key: 'action', label: 'Ação' }, { key: 'description', label: 'Permissão' }],
    run: async (ctx) => {
      const roles = await ctx.tx((tx) => tx.role.findMany({ where: { deletedAt: null, OR: [{ tenantId: null }, { tenantId: ctx.tenantId }], NOT: { key: 'super_admin' } }, include: { permissions: { include: { permission: { select: { key: true } } } } }, orderBy: { name: 'asc' } }));
      return roles.flatMap((r) => r.permissions.map((p) => p.permission.key).filter((k) => !k.startsWith('platform.')).sort().map((k) => {
        const [res, act] = k.split(':') as [string, string];
        return { role: r.name, kind: r.tenantId ? 'Personalizado' : 'Do sistema', module: MODULE_LABELS[res.split('.')[0]!] ?? res, resource: RESOURCE_LABELS[res] ?? res, action: ACTION_LABELS[act] ?? act, description: PERMISSIONS[k as keyof typeof PERMISSIONS] ?? k };
      }));
    },
  },
];

async function marks(ctx: Ctx, webOnly: boolean) {
  const emps = await ctx.emps(); const byId = new Map(emps.map((e) => [e.id, e]));
  const S: Record<string, string> = { WEB: 'Navegador', MOBILE: 'App', KIOSK: 'Terminal', DEVICE: 'Relógio', COMMUNICATION_SERVER: 'Relógio', IMPORT: 'Importação', MANUAL_ADJUSTMENT: 'Ajuste' };
  const rows = await ctx.tx((tx) => tx.timeRecord.findMany({
    where: { employmentId: { in: emps.map((e) => e.id) }, recordedAt: { gte: new Date(`${ctx.f.from}T00:00:00-03:00`), lt: new Date(new Date(`${ctx.f.to}T00:00:00-03:00`).getTime() + 86_400_000) }, ...(webOnly ? { source: { in: ['WEB', 'MOBILE'] } } : {}) },
    include: { device: { select: { name: true } } }, orderBy: { recordedAt: 'asc' }, take: 50000,
  }));
  return rows.map((r) => { const e = byId.get(r.employmentId)!; return { registration: e.registration, name: name(e), at: r.recordedAt.toISOString(), source: S[r.source] ?? r.source, device: r.device?.name ?? '', location: r.latitude !== null && r.longitude !== null ? `${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}` : '' }; });
}

/** Campos do montador (uma linha por funcionário e dia). */
export const BUILDER_FIELDS: Array<Col & { get: (e: Emp & Extra, d: DayView) => unknown }> = [
  { key: 'registration', label: 'Matrícula', get: (e) => e.registration },
  { key: 'name', label: 'Funcionário', get: (e) => name(e) },
  { key: 'company', label: 'Empresa', get: (e) => e.company.tradeName ?? e.company.legalName },
  { key: 'department', label: 'Departamento', get: (e) => e.department?.name ?? '' },
  { key: 'position', label: 'Cargo', get: (e) => e.position?.name ?? '' },
  { key: 'date', label: 'Data', type: 'date', get: (_, d) => d.date },
  { key: 'weekday', label: 'Dia da semana', get: (_, d) => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][toDate(d.date).getUTCDay()] },
  { key: 'schedule', label: 'Horário', get: (_, d) => (d.expected as { scheduleName: string | null }).scheduleName ?? '' },
  { key: 'expectedText', label: 'Previsto (horário)', get: (_, d) => { const x = d.expected as { isWorkday: boolean; start: string | null; end: string | null }; return x.isWorkday ? `${x.start ?? ''}–${x.end ?? ''}` : 'Folga'; } },
  { key: 'punches', label: 'Marcações', get: (_, d) => punchList(d) },
  { key: 'expected', label: 'Previsto (horas)', type: 'minutes', get: (_, d) => d.result?.expectedMinutes ?? 0 },
  { key: 'worked', label: 'Trabalhado', type: 'minutes', get: (_, d) => d.result?.workedMinutes ?? 0 },
  { key: 'balance', label: 'Saldo', type: 'minutes', get: (_, d) => d.result?.balanceMinutes ?? 0 },
  { key: 'overtime', label: 'Extras', type: 'minutes', get: (_, d) => d.result?.overtimeMinutes ?? 0 },
  { key: 'night', label: 'Noturno reduzido', type: 'minutes', get: (_, d) => d.result?.nightReducedMinutes ?? 0 },
  { key: 'late', label: 'Atraso', type: 'minutes', get: (_, d) => d.result?.lateMinutes ?? 0 },
  { key: 'earlyLeave', label: 'Saída antecipada', type: 'minutes', get: (_, d) => d.result?.earlyLeaveMinutes ?? 0 },
  { key: 'break', label: 'Intervalo', type: 'minutes', get: (_, d) => d.result?.breakMinutes ?? 0 },
  { key: 'absence', label: 'Falta', get: (_, d) => (d.result?.flags.includes('ABSENCE') ? 'Sim' : '') },
  { key: 'allowance', label: 'Abono', get: (_, d) => d.allowance?.justification ?? '' },
  { key: 'leave', label: 'Afastamento', get: (_, d) => d.leave?.label ?? '' },
  { key: 'flags', label: 'Ocorrências', get: (_, d) => flags(d) },
];

const fmtMinutes = (m: number) => { const a = Math.abs(m); return `${m < 0 ? '-' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`; };
export function formatCell(v: unknown, type?: ColType): string {
  if (v === null || v === undefined || v === '') return '';
  switch (type) {
    case 'minutes': return fmtMinutes(Number(v));
    case 'percent': return `${(Number(v) * 100).toFixed(1).replace('.', ',')}%`;
    case 'date': return dmy(String(v));
    case 'datetime': { const l = local(new Date(String(v))); return `${dmy(l.date)} ${l.time}`; }
    default: return String(v);
  }
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService, private readonly core: TimesheetCore, private readonly holidays: HolidaysService) {}

  catalog(user: AuthUser) {
    return {
      reports: REPORTS.filter((r) => !r.permission || can(user, r.permission)).map((r) => ({ key: r.key, title: r.title, category: r.category, description: r.description, period: r.period })),
      builderFields: BUILDER_FIELDS.map(({ key, label, type }) => ({ key, label, type: type ?? 'text' })),
    };
  }

  async run(tenantId: string, user: AuthUser, key: string, f: Filters) {
    const def = key === 'customizado' ? null : REPORTS.find((r) => r.key === key);
    if (key !== 'customizado' && !def) throw new NotFoundException('Relatório não encontrado');
    if (def?.permission && !can(user, def.permission)) throw new ForbiddenException(`Permissão necessária: ${def.permission}`);
    const needsPeriod = key === 'customizado' || def!.period === 'required';
    if (needsPeriod && (!f.from || !f.to)) throw new BadRequestException('Informe o período');
    if (f.from && f.to) {
      if (f.to < f.from) throw new BadRequestException('A data final deve ser igual ou posterior à inicial');
      if ((Date.parse(f.to) - Date.parse(f.from)) / 86_400_000 > 92) throw new BadRequestException('Período de até 93 dias');
    }
    let empsCache: Array<Emp & Extra> | null = null;
    let daysCache: Map<string, DayView[]> | null = null;
    const ctx: Ctx = {
      tenantId, user, f,
      tx: (fn) => this.prisma.forTenant(tenantId, fn),
      emps: async () => (empsCache ??= await this.employments(tenantId, f)),
      days: async () => (daysCache ??= await this.core.compute(tenantId, await ctx.emps(), f.from!, f.to!)),
    };
    let columns: Col[], rows: Row[];
    if (key === 'customizado') {
      const chosen = (f.fields ?? []).map((k) => BUILDER_FIELDS.find((x) => x.key === k)).filter(Boolean) as typeof BUILDER_FIELDS;
      if (!chosen.length) throw new BadRequestException('Escolha ao menos um campo');
      columns = chosen.map(({ key: k, label, type }) => ({ key: k, label, type }));
      rows = (await perDay(ctx)).map(({ e, d }) => Object.fromEntries(chosen.map((c) => [c.key, c.get(e, d)])));
    } else if (key === 'feriados') {
      columns = def!.columns as Col[];
      const list = (await this.holidays.listForCompany(tenantId, f.companyId, Number(f.from!.slice(0, 4)))).holidays.concat(f.to!.slice(0, 4) !== f.from!.slice(0, 4) ? (await this.holidays.listForCompany(tenantId, f.companyId, Number(f.to!.slice(0, 4)))).holidays : []);
      const S: Record<string, string> = { NATIONAL: 'Nacional', STATE: 'Estadual', MUNICIPAL: 'Municipal', COMPANY: 'Empresa' };
      rows = list.filter((h) => h.date >= f.from! && h.date <= f.to!).map((h) => ({ date: h.date, name: h.name, scope: S[h.scope] ?? h.scope, workday: h.workday ? 'Sim' : 'Não' }));
    } else {
      columns = typeof def!.columns === 'function' ? await def!.columns(ctx) : def!.columns;
      rows = await def!.run(ctx);
    }
    const totals: Row = {};
    for (const c of columns) if (c.type === 'minutes' || c.type === 'number') totals[c.key] = sum(rows, c.key);
    return { key, title: def?.title ?? 'Relatório personalizado', filters: f, columns, rows, totals, generatedAt: new Date().toISOString() };
  }

  /** Funcionários pelos filtros padronizados (empresa, departamento e subdepartamentos, agrupamento, tipo, situação). */
  private async employments(tenantId: string, f: Filters) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (!(await tx.company.findFirst({ where: { id: f.companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
      let departments: string[] | undefined;
      if (f.departmentId) {
        departments = [f.departmentId];
        if (f.includeSubdepartments) {
          const all = await tx.department.findMany({ where: { deletedAt: null }, select: { id: true, parentId: true } });
          let grew = true;
          while (grew) { grew = false; for (const d of all) if (d.parentId && departments.includes(d.parentId) && !departments.includes(d.id)) { departments.push(d.id); grew = true; } }
        }
      }
      const where: Prisma.EmploymentWhereInput = {
        companyId: f.companyId, deletedAt: null,
        ...(f.status === 'ACTIVE' ? (f.from && f.to ? { hiredAt: { lte: toDate(f.to) }, OR: [{ terminatedAt: null }, { terminatedAt: { gte: toDate(f.from) } }] } : { status: { not: 'TERMINATED' } }) : {}),
        ...(departments ? { departmentId: { in: departments } } : {}),
        ...(f.groupingId ? { groupings: { some: { groupingId: f.groupingId } } } : {}),
        ...(f.employeeTypeId ? { employeeTypeId: f.employeeTypeId } : {}),
        ...(f.employmentIds?.length ? { id: { in: f.employmentIds } } : {}),
      };
      return tx.employment.findMany({
        where, orderBy: { person: { fullName: 'asc' } }, take: 2000,
        select: { ...EMP_SELECT, person: { select: { fullName: true, socialName: true, cpf: true, birthDate: true, pis: true } }, department: { select: { name: true } }, position: { select: { name: true } }, company: { select: { legalName: true, tradeName: true } } },
      }) as unknown as Promise<Array<Emp & Extra>>;
    });
  }

  /** Exportação: CSV (separado por ponto e vírgula, para o Excel em português) ou planilha XLSX. */
  async export(tenantId: string, user: AuthUser, key: string, f: Filters, format: 'csv' | 'xlsx') {
    const r = await this.run(tenantId, user, key, f);
    const stamp = `${f.from ?? ''}${f.to ? `_${f.to}` : ''}`.replace(/^_/, '');
    const base = `${key}${stamp ? `_${stamp}` : ''}`;
    if (format === 'csv') {
      const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
      const lines = [r.columns.map((c) => esc(c.label)).join(';'), ...r.rows.map((row) => r.columns.map((c) => esc(formatCell(row[c.key], c.type))).join(';'))];
      if (Object.keys(r.totals).length) lines.push(r.columns.map((c, i) => (i === 0 ? 'Total' : c.key in r.totals ? formatCell(r.totals[c.key], c.type) : '')).join(';'));
      return { filename: `${base}.csv`, mime: 'text/csv;charset=utf-8', base64: Buffer.from(`﻿${lines.join('\r\n')}\r\n`, 'utf8').toString('base64') };
    }
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SuperPonto';
    const ws = wb.addWorksheet(r.title.slice(0, 31));
    ws.addRow([r.title]).font = { bold: true, size: 14 };
    ws.addRow([f.from && f.to ? `Período: ${dmy(f.from)} a ${dmy(f.to)}` : 'Posição atual', `Gerado em ${formatCell(r.generatedAt, 'datetime')}`]);
    ws.addRow([]);
    const header = ws.addRow(r.columns.map((c) => c.label));
    header.font = { bold: true };
    header.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCC419' } }; });
    for (const row of r.rows) ws.addRow(r.columns.map((c) => (c.type === 'number' ? Number(row[c.key] ?? 0) : formatCell(row[c.key], c.type))));
    if (Object.keys(r.totals).length) ws.addRow(r.columns.map((c, i) => (i === 0 ? 'Total' : c.key in r.totals ? (c.type === 'number' ? Number(r.totals[c.key]) : formatCell(r.totals[c.key], c.type)) : ''))).font = { bold: true };
    ws.columns.forEach((col, i) => { col.width = Math.min(48, Math.max(10, r.columns[i]?.label.length ?? 10, ...r.rows.slice(0, 200).map((row) => formatCell(row[r.columns[i]?.key ?? ''], r.columns[i]?.type).length)) + 2); });
    ws.views = [{ state: 'frozen', ySplit: 4 }];
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    return { filename: `${base}.xlsx`, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64: buf.toString('base64') };
  }
}
