// Banco de horas por vínculo: créditos/débitos diários, compensação e vencimento (FIFO).
import type { DayResult } from './calculate.ts';
import { type CivilDate, addDays } from './time.ts';

export interface BankPolicy {
  enabled: boolean;
  /** dias até o crédito vencer (null = não vence) */
  expirationDays: number | null;
  /** multiplicador do crédito por percentual de extra (ex.: 50% -> 1.5); padrão 1 */
  creditMultiplierByPercent?: Record<number, number>;
  /** limite de crédito por dia (minutos); excedente não entra no banco */
  maxDailyCreditMinutes?: number;
}

export interface BankEntry {
  type: 'CREDIT' | 'DEBIT' | 'EXPIRATION';
  minutes: number;
  refDate: CivilDate;
  expiresOn?: CivilDate | null;
}

export interface BankState {
  balance: number;
  entries: BankEntry[];
  /** créditos ainda disponíveis (para vencimento FIFO) */
  openCredits: { minutes: number; expiresOn: CivilDate | null }[];
}

export const emptyBank = (): BankState => ({ balance: 0, entries: [], openCredits: [] });

function expire(state: BankState, date: CivilDate) {
  for (const credit of state.openCredits) {
    if (credit.minutes > 0 && credit.expiresOn && credit.expiresOn < date) {
      state.entries.push({ type: 'EXPIRATION', minutes: -credit.minutes, refDate: credit.expiresOn });
      state.balance -= credit.minutes;
      credit.minutes = 0;
    }
  }
  state.openCredits = state.openCredits.filter((c) => c.minutes > 0);
}

/** Aplica os resultados diários (em ordem) ao banco. Débitos consomem créditos mais antigos primeiro. */
export function applyToBank(initial: BankState, days: DayResult[], policy: BankPolicy): BankState {
  const state: BankState = {
    balance: initial.balance,
    entries: [...initial.entries],
    openCredits: initial.openCredits.map((c) => ({ ...c })),
  };
  if (!policy.enabled) return state;

  for (const day of [...days].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    expire(state, day.date);
    if (day.balanceMinutes > 0) {
      let credit = 0;
      const byPercent = policy.creditMultiplierByPercent ?? {};
      if (day.overtime.length) {
        for (const o of day.overtime) credit += Math.round(o.minutes * (byPercent[o.percent] ?? 1));
      } else {
        credit = day.balanceMinutes;
      }
      if (policy.maxDailyCreditMinutes !== undefined) credit = Math.min(credit, policy.maxDailyCreditMinutes);
      const expiresOn = policy.expirationDays === null ? null : addDays(day.date, policy.expirationDays);
      state.entries.push({ type: 'CREDIT', minutes: credit, refDate: day.date, expiresOn });
      state.openCredits.push({ minutes: credit, expiresOn });
      state.balance += credit;
    } else if (day.balanceMinutes < 0) {
      let debit = -day.balanceMinutes;
      state.entries.push({ type: 'DEBIT', minutes: day.balanceMinutes, refDate: day.date });
      state.balance += day.balanceMinutes;
      for (const credit of state.openCredits) {
        if (debit === 0) break;
        const used = Math.min(credit.minutes, debit);
        credit.minutes -= used;
        debit -= used;
      }
      state.openCredits = state.openCredits.filter((c) => c.minutes > 0);
    }
  }
  return state;
}

/** Vence créditos até a data (usar no fechamento do período). */
export function expireUntil(initial: BankState, date: CivilDate): BankState {
  const state: BankState = { balance: initial.balance, entries: [...initial.entries], openCredits: initial.openCredits.map((c) => ({ ...c })) };
  expire(state, date);
  return state;
}
