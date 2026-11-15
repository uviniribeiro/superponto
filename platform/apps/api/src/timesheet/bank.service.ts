import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@superponto/database';
import { applyToBank, type BankState, type DayResult } from '@superponto/time-engine';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import type { RequestMeta } from '../common/tenant.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { ExpectedScheduleService } from '../schedules/schedules.service.js';
import { EMP_SELECT, iso, TimesheetCore, toDate, type DayView } from './timesheet.core.js';
import { myEmployments, TimesheetService } from './timesheet.service.js';

const civil = z.iso.date();
export const bankPolicySchema = z.object({
  companyId: z.uuid(),
  enabled: z.boolean(),
  expirationDays: z.number().int().min(1).max(730).nullable(),
  maxDailyCreditMinutes: z.number().int().min(1).max(720).nullable().optional(),
  creditMultipliers: z.record(z.string().regex(/^\d{1,3}$/), z.number().min(1).max(3)).default({}),
  compensationEnabled: z.boolean().default(false),
  compensationPeriod: z.enum(['WEEK', 'MONTH']).default('WEEK'),
  compensationLeftover: z.enum(['BANK', 'PAY']).default('BANK'),
});
export type BankPolicyInput = z.infer<typeof bankPolicySchema>;
export const bankTxSchema = z.object({
  employmentIds: z.array(z.uuid()).min(1).max(500),
  /** ADJUSTMENT: positivo ou negativo; PAYOUT (pagamento em folha) e COMPENSATION (folga compensada): minutos a descontar */
  type: z.enum(['ADJUSTMENT', 'PAYOUT', 'COMPENSATION']),
  minutes: z.number().int().min(-100000).max(100000).refine((v) => v !== 0, 'Informe os minutos'),
  refDate: civil,
  description: z.string().trim().min(3, 'Descreva o lançamento').max(300),
});
export type BankTxInput = z.infer<typeof bankTxSchema>;
export const bankResetSchema = z.object({
  companyId: z.uuid(), employmentIds: z.array(z.uuid()).max(5000).optional(), refDate: civil,
  /** PAYOUT = saldo positivo pago em folha; ADJUSTMENT = zera o saldo (positivo ou negativo) */
  type: z.enum(['PAYOUT', 'ADJUSTMENT']), description: z.string().trim().min(3).max(300),
  /** só saldos positivos, só negativos ou todos */
  only: z.enum(['POSITIVE', 'NEGATIVE', 'ALL']).default('ALL'),
});
export type BankResetInput = z.infer<typeof bankResetSchema>;

/** Chave do período de compensação: segunda-feira da semana ou o mês. */
export function periodKey(date: string, period: 'WEEK' | 'MONTH') {
  if (period === 'MONTH') return date.slice(0, 7);
  const d = new Date(`${date}T00:00:00Z`);
  return iso(new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000));
}

/**
 * Banco de compensação: soma os saldos diários de cada semana (ou mês). O líquido negativo vira um
 * débito; o positivo vai para o banco (BANK) ou é pago como extra (PAY). Faltas compensam com extras.
 */
export function compensate(days: DayResult[], period: 'WEEK' | 'MONTH', leftover: 'BANK' | 'PAY') {
  const groups = new Map<string, DayResult[]>();
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const k = periodKey(d.date, period);
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  const periods = [...groups].map(([key, list]) => {
    const positive = list.reduce((s, d) => s + Math.max(0, d.balanceMinutes), 0);
    const negative = list.reduce((s, d) => s + Math.min(0, d.balanceMinutes), 0);
    const net = positive + negative;
    return { key, from: list[0]!.date, to: list.at(-1)!.date, positive, negative, net, toBank: net < 0 || leftover === 'BANK' ? net : 0, toPay: net > 0 && leftover === 'PAY' ? net : 0 };
  });
  const toBank = periods.filter((p) => p.toBank !== 0).map((p) => ({ date: p.to, balanceMinutes: p.toBank, overtime: [] } as unknown as DayResult));
  return { periods, toBank };
}

/** Reconstrói o estado do banco (saldo e créditos em aberto, FIFO) a partir dos lançamentos. */
export function replay(txs: Array<{ type: string; minutes: number; refDate: Date; expiresOn: Date | null }>): BankState {
  const state: BankState = { balance: 0, entries: [], openCredits: [] };
  for (const t of [...txs].sort((a, b) => a.refDate.getTime() - b.refDate.getTime())) {
    state.balance += t.minutes;
    if (t.minutes > 0) state.openCredits.push({ minutes: t.minutes, expiresOn: t.expiresOn ? iso(t.expiresOn) : null });
    else {
      let left = -t.minutes;
      for (const c of state.openCredits) { if (!left) break; const used = Math.min(c.minutes, left); c.minutes -= used; left -= used; }
      state.openCredits = state.openCredits.filter((c) => c.minutes > 0);
    }
  }
  return state;
}

@Injectable()
export class BankService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly core: TimesheetCore) {}

  getPolicy(tenantId: string, companyId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (!(await tx.company.findFirst({ where: { id: companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
      return (await tx.bankPolicy.findUnique({ where: { companyId } })) ?? { companyId, enabled: false, expirationDays: 180, maxDailyCreditMinutes: null, creditMultipliers: {}, compensationEnabled: false, compensationPeriod: 'WEEK', compensationLeftover: 'BANK', configured: false };
    });
  }

  savePolicy(tenantId: string, user: AuthUser, input: BankPolicyInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (!(await tx.company.findFirst({ where: { id: input.companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
      const before = await tx.bankPolicy.findUnique({ where: { companyId: input.companyId } });
      const data = { enabled: input.enabled, expirationDays: input.expirationDays, maxDailyCreditMinutes: input.maxDailyCreditMinutes ?? null, creditMultipliers: input.creditMultipliers as Prisma.InputJsonValue, compensationEnabled: input.compensationEnabled, compensationPeriod: input.compensationPeriod, compensationLeftover: input.compensationLeftover };
      const p = await tx.bankPolicy.upsert({ where: { companyId: input.companyId }, create: { tenantId, companyId: input.companyId, ...data }, update: data });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: before ? 'UPDATE' : 'CREATE', entity: 'bank_policy', entityId: p.id, before, after: p, ...meta });
      return p;
    });
  }

  private async account(tx: Tx, tenantId: string, employmentId: string) {
    return (await tx.bankHourAccount.findUnique({ where: { employmentId } })) ?? tx.bankHourAccount.create({ data: { tenantId, employmentId } });
  }

  /** Lança no banco o resultado do período fechado (créditos, débitos e vencimentos). */
  async applyClosing(tx: Tx, tenantId: string, companyId: string, closingId: string, results: Map<string, DayView[]>, userId: string) {
    const policy = await tx.bankPolicy.findUnique({ where: { companyId } });
    if (!policy?.enabled) return 0;
    let n = 0;
    for (const [employmentId, days] of results) {
      const raw = days.map((d) => d.result).filter(Boolean) as unknown as DayResult[];
      // Banco de compensação: os saldos se compensam na semana/mês; só o líquido vai para o banco.
      const dayResults = policy.compensationEnabled ? compensate(raw, policy.compensationPeriod as 'WEEK' | 'MONTH', policy.compensationLeftover as 'BANK' | 'PAY').toBank : raw;
      if (!dayResults.length) continue;
      const acc = await this.account(tx, tenantId, employmentId);
      const before = replay(await tx.bankHourTransaction.findMany({ where: { accountId: acc.id } }));
      const after = applyToBank(before, dayResults, {
        enabled: true, expirationDays: policy.expirationDays, maxDailyCreditMinutes: policy.maxDailyCreditMinutes ?? undefined,
        creditMultiplierByPercent: Object.fromEntries(Object.entries(policy.creditMultipliers as Record<string, number>).map(([k, v]) => [Number(k), v])),
      });
      const fresh = after.entries.slice(before.entries.length);
      if (!fresh.length) continue;
      await tx.bankHourTransaction.createMany({ data: fresh.map((e) => ({
        tenantId, accountId: acc.id, type: e.type, minutes: e.minutes, refDate: toDate(e.refDate), expiresOn: e.expiresOn ? toDate(e.expiresOn) : null,
        description: e.type === 'CREDIT' ? 'Crédito do fechamento' : e.type === 'DEBIT' ? 'Débito do fechamento' : 'Crédito vencido', closingId, createdById: userId,
      })) });
      await tx.bankHourAccount.update({ where: { id: acc.id }, data: { balanceMinutes: after.balance } });
      n += fresh.length;
    }
    return n;
  }

  /** Reabertura: desfaz os lançamentos daquele fechamento e recalcula o saldo. */
  async revertClosing(tx: Tx, closingId: string) {
    const txs = await tx.bankHourTransaction.findMany({ where: { closingId }, select: { accountId: true } });
    await tx.bankHourTransaction.deleteMany({ where: { closingId } });
    for (const accountId of new Set(txs.map((t) => t.accountId))) {
      const sum = await tx.bankHourTransaction.aggregate({ where: { accountId }, _sum: { minutes: true } });
      await tx.bankHourAccount.update({ where: { id: accountId }, data: { balanceMinutes: sum._sum.minutes ?? 0 } });
    }
    return txs.length;
  }

  /** Extrato do banco de compensação (líquido por semana/mês), calculado da apuração. */
  async compensation(tenantId: string, employmentId: string, from: string, to: string) {
    const e = await this.prisma.forTenant(tenantId, (tx) => tx.employment.findFirst({ where: { id: employmentId, deletedAt: null }, select: EMP_SELECT }));
    if (!e) throw new NotFoundException('Funcionário não encontrado');
    const policy = await this.prisma.forTenant(tenantId, (tx) => tx.bankPolicy.findUnique({ where: { companyId: e.companyId } }));
    const period = (policy?.compensationPeriod ?? 'WEEK') as 'WEEK' | 'MONTH';
    const leftover = (policy?.compensationLeftover ?? 'BANK') as 'BANK' | 'PAY';
    const days = (await this.core.compute(tenantId, [e], from, to)).get(e.id)!;
    const results = days.map((d) => d.result ? { ...d.result, date: d.date } : null).filter(Boolean) as unknown as DayResult[];
    const { periods } = compensate(results, period, leftover);
    return { employment: { id: e.id, registration: e.registration, name: e.person.socialName ?? e.person.fullName }, enabled: !!policy?.compensationEnabled, period, leftover, periods };
  }

  /** Meu banco de horas: extrato do funcionário logado. */
  async mine(tenantId: string, user: AuthUser, employmentId?: string) {
    const mine = await this.prisma.forTenant(tenantId, (tx) => myEmployments(tx, user));
    const e = employmentId ? mine.find((m) => m.id === employmentId) : mine[0];
    if (!e) throw new NotFoundException('Vínculo não encontrado');
    return this.statement(tenantId, e.id);
  }

  balances(tenantId: string, companyId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const emps = await tx.employment.findMany({ where: { companyId, deletedAt: null }, select: { id: true, registration: true, status: true, person: { select: { fullName: true, socialName: true } }, bankAccount: { select: { balanceMinutes: true, updatedAt: true } } }, orderBy: { person: { fullName: 'asc' } } });
      return emps.map((e) => ({ employmentId: e.id, registration: e.registration, status: e.status, name: e.person.socialName ?? e.person.fullName, balanceMinutes: e.bankAccount?.balanceMinutes ?? 0, updatedAt: e.bankAccount?.updatedAt ?? null }));
    });
  }

  statement(tenantId: string, employmentId: string, from?: string, to?: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const e = await tx.employment.findFirst({ where: { id: employmentId, deletedAt: null }, select: { id: true, registration: true, person: { select: { fullName: true, socialName: true } } } });
      if (!e) throw new NotFoundException('Funcionário não encontrado');
      const acc = await tx.bankHourAccount.findUnique({ where: { employmentId } });
      const all = acc ? await tx.bankHourTransaction.findMany({ where: { accountId: acc.id }, orderBy: [{ refDate: 'asc' }, { createdAt: 'asc' }] }) : [];
      let running = 0;
      const rows = all.map((t) => { running += t.minutes; return { ...t, refDate: iso(t.refDate), expiresOn: t.expiresOn ? iso(t.expiresOn) : null, balanceAfter: running }; });
      const filtered = rows.filter((r) => (!from || r.refDate >= from) && (!to || r.refDate <= to));
      const opening = from ? rows.filter((r) => r.refDate < from).reduce((s, r) => s + r.minutes, 0) : 0;
      const state = replay(all);
      const soon = state.openCredits.filter((c) => c.expiresOn).sort((a, b) => a.expiresOn!.localeCompare(b.expiresOn!))[0] ?? null;
      return { employment: { id: e.id, registration: e.registration, name: e.person.socialName ?? e.person.fullName }, balanceMinutes: running, openingMinutes: opening, transactions: filtered.reverse(), nextExpiration: soon };
    });
  }

  addTransactions(tenantId: string, user: AuthUser, input: BankTxInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const ids = [...new Set(input.employmentIds)];
      const emps = await tx.employment.findMany({ where: { id: { in: ids }, deletedAt: null } });
      if (emps.length !== ids.length) throw new NotFoundException('Funcionário não encontrado');
      const minutes = input.type === 'ADJUSTMENT' ? input.minutes : -Math.abs(input.minutes);
      for (const e of emps) {
        const acc = await this.account(tx, tenantId, e.id);
        await tx.bankHourTransaction.create({ data: { tenantId, accountId: acc.id, type: input.type, minutes, refDate: toDate(input.refDate), description: input.description, createdById: user.id } });
        await tx.bankHourAccount.update({ where: { id: acc.id }, data: { balanceMinutes: { increment: minutes } } });
      }
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'bank_transaction', after: { ...input, minutes, employments: ids.length }, ...meta });
      return { created: emps.length };
    });
  }

  /** Zerar em lote: lança o contrário do saldo atual de cada funcionário (pagamento ou ajuste). */
  reset(tenantId: string, user: AuthUser, input: BankResetInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const accounts = await tx.bankHourAccount.findMany({ where: { employment: { companyId: input.companyId, deletedAt: null, ...(input.employmentIds?.length ? { id: { in: input.employmentIds } } : {}) } } });
      let n = 0, total = 0;
      for (const a of accounts) {
        const b = a.balanceMinutes;
        if (!b || (input.only === 'POSITIVE' && b < 0) || (input.only === 'NEGATIVE' && b > 0)) continue;
        if (input.type === 'PAYOUT' && b < 0) continue; // saldo negativo não se "paga"
        await tx.bankHourTransaction.create({ data: { tenantId, accountId: a.id, type: input.type, minutes: -b, refDate: toDate(input.refDate), description: input.description, createdById: user.id } });
        await tx.bankHourAccount.update({ where: { id: a.id }, data: { balanceMinutes: 0 } });
        n++; total += b;
      }
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'bank_reset', after: { ...input, accounts: n, totalMinutes: total }, ...meta });
      return { zeroed: n, totalMinutes: total };
    });
  }
}

/** Fechamento: grava a apuração do período, lança o banco de horas e trava alterações. */
@Injectable()
export class ClosingsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly core: TimesheetCore, private readonly timesheet: TimesheetService, private readonly bank: BankService, private readonly expected: ExpectedScheduleService) {}

  list(tenantId: string, companyId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => (await tx.timeClosing.findMany({ where: { companyId }, orderBy: { periodStart: 'desc' } })).map((c) => ({ ...c, periodStart: iso(c.periodStart), periodEnd: iso(c.periodEnd) })));
  }

  async close(tenantId: string, user: AuthUser, input: { companyId: string; periodStart: string; periodEnd: string }, meta: RequestMeta) {
    const { emps } = await this.prisma.forTenant(tenantId, async (tx) => {
      if (!(await tx.company.findFirst({ where: { id: input.companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
      const overlap = await tx.timeClosing.findFirst({ where: { companyId: input.companyId, status: 'CLOSED', periodStart: { lte: toDate(input.periodEnd) }, periodEnd: { gte: toDate(input.periodStart) } } });
      if (overlap) throw new ConflictException(`Já existe período fechado de ${iso(overlap.periodStart)} a ${iso(overlap.periodEnd)}`);
      const empIds = (await tx.employment.findMany({ where: { companyId: input.companyId }, select: { id: true } })).map((e) => e.id);
      const start = new Date(`${input.periodStart}T00:00:00-03:00`), end = new Date(new Date(`${input.periodEnd}T00:00:00-03:00`).getTime() + 86_400_000);
      const pending = await tx.timeRecordAdjustment.count({ where: { status: 'PENDING', employmentId: { in: empIds }, OR: [{ recordedAt: { gte: start, lt: end } }, { timeRecord: { recordedAt: { gte: start, lt: end } } }] } });
      if (pending) throw new ConflictException(`Há ${pending} ajuste(s) de marcação pendente(s) no período: aprove ou recuse antes de fechar`);
      return { emps: await this.timesheet.companyEmployments(tx, input.companyId, input.periodStart, input.periodEnd) };
    });
    const holidays = await this.expected.holidayMap(tenantId, [input.companyId], input.periodStart, input.periodEnd);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const results = await this.core.computeTx(tx, emps, input.periodStart, input.periodEnd, holidays);
      const days = await this.core.persist(tx, tenantId, results);
      const existing = await tx.timeClosing.findFirst({ where: { companyId: input.companyId, periodStart: toDate(input.periodStart), periodEnd: toDate(input.periodEnd) } });
      const closing = existing
        ? await tx.timeClosing.update({ where: { id: existing.id }, data: { status: 'CLOSED', closedById: user.id, closedAt: new Date() } })
        : await tx.timeClosing.create({ data: { tenantId, companyId: input.companyId, periodStart: toDate(input.periodStart), periodEnd: toDate(input.periodEnd), status: 'CLOSED', closedById: user.id, closedAt: new Date() } });
      const bankEntries = await this.bank.applyClosing(tx, tenantId, input.companyId, closing.id, results, user.id);
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CLOSE_PERIOD', entity: 'time_closing', entityId: closing.id, after: { ...input, employments: emps.length, days, bankEntries }, ...meta });
      return { ...closing, periodStart: iso(closing.periodStart), periodEnd: iso(closing.periodEnd), employments: emps.length, days, bankEntries };
    });
  }

  reopen(tenantId: string, user: AuthUser, id: string, reason: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const c = await tx.timeClosing.findFirst({ where: { id } });
      if (!c) throw new NotFoundException('Fechamento não encontrado');
      if (c.status !== 'CLOSED') throw new BadRequestException('Este período não está fechado');
      const later = await tx.timeClosing.findFirst({ where: { companyId: c.companyId, status: 'CLOSED', periodStart: { gt: c.periodEnd } } });
      if (later) throw new ConflictException(`Reabra antes o período posterior (${iso(later.periodStart)} a ${iso(later.periodEnd)}): o banco de horas depende da ordem`);
      const saved = await tx.timeClosing.update({ where: { id }, data: { status: 'REOPENED', reopenReason: reason } });
      const reverted = await this.bank.revertClosing(tx, id);
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'REOPEN_PERIOD', entity: 'time_closing', entityId: id, before: c, after: { ...saved, reverted }, ...meta });
      return { ...saved, periodStart: iso(saved.periodStart), periodEnd: iso(saved.periodEnd), revertedBankEntries: reverted };
    });
  }
}
