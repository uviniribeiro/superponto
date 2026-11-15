'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, type Company, type Page } from './api';

export interface ScheduleDay { dayIndex: number; isWorkday: boolean; startTime: string | null; endTime: string | null; breakMinutes: number; breakStart: string | null; expectedMinutes: number }
export interface WorkSchedule {
  id: string; companyId: string; name: string; code: string | null; type: string; cycleDays: number | null; weeklyMinutes: number | null;
  considerHolidays: boolean; inItinereMinutes: number; entryMobilityMinutes: number; breakMobilityMinutes: number; active: boolean;
  ruleSetId: string | null; ruleSet: { id: string; name: string } | null; days: ScheduleDay[]; inUse: number;
}
export interface Rules {
  markToleranceMinutes: number; dailyToleranceMinutes: number; roundingMinutes: number; roundingMode: 'up' | 'down' | 'nearest';
  overtimePercent: { normal: number; night: number; rest: number; holiday: number; break: number };
  nightStart: string; nightEnd: string; reducedNightHour: boolean; minBreakMinutes: number; autoDeductBreak: boolean;
  dailyOvertimeLimitMinutes: number; discountAbsences: boolean; overtimeBands?: Array<{ upToMinutes: number | null; percent: number }>;
}
export interface RuleSet { id: string; companyId: string; name: string; isDefault: boolean; rules: Rules; inUse: number }
export interface ExpectedDay {
  date: string; isWorkday: boolean; isHoliday: boolean; flexible: boolean; scheduled: boolean; start: string | null; end: string | null;
  breakMinutes: number; expectedMinutes: number; overnight: boolean; scheduleName: string | null; scheduleCode: string | null;
  holidayName: string | null; overrideId: string | null; origin: 'AGENDADA' | 'TROCA' | null; note: string | null;
}

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const TYPE_LABEL: Record<string, string> = {
  FIXED: 'Semanal fixa', FLEXIBLE: 'Flexível (carga por dia)', SHIFT_12X36: 'Escala 12x36', SHIFT_6X1: 'Escala 6x1', SHIFT_5X2: 'Escala 5x2 (ciclo)',
  SHIFT_4X2: 'Escala 4x2', ROTATING: 'Revezamento', CUSTOM: 'Ciclo personalizado', ON_CALL: 'Sobreaviso / plantão', TEACHING: 'Docente',
};
export const CYCLIC = new Set(['SHIFT_12X36', 'SHIFT_6X1', 'SHIFT_5X2', 'SHIFT_4X2', 'ROTATING', 'CUSTOM', 'ON_CALL']);

export const hours = (m: number | null | undefined) => {
  if (!m) return '0h';
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`;
};
export const toMin = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
export function span(start: string, end: string) { let e = toMin(end); const s = toMin(start); if (e <= s) e += 1440; return e - s; }

export const DEFAULT_RULES: Rules = {
  markToleranceMinutes: 5, dailyToleranceMinutes: 10, roundingMinutes: 0, roundingMode: 'nearest',
  overtimePercent: { normal: 50, night: 50, rest: 100, holiday: 100, break: 50 }, nightStart: '22:00', nightEnd: '05:00', reducedNightHour: true,
  minBreakMinutes: 60, autoDeductBreak: false, dailyOvertimeLimitMinutes: 120, discountAbsences: true,
};

/** Modelos prontos para começar um horário. */
export function preset(kind: string): { type: string; cycleDays: number | null; days: ScheduleDay[]; considerHolidays: boolean } {
  const work = (i: number, s: string, e: string, b = 60, bs: string | null = null): ScheduleDay => ({ dayIndex: i, isWorkday: true, startTime: s, endTime: e, breakMinutes: b, breakStart: bs, expectedMinutes: 0 });
  const off = (i: number): ScheduleDay => ({ dayIndex: i, isWorkday: false, startTime: null, endTime: null, breakMinutes: 0, breakStart: null, expectedMinutes: 0 });
  const cycle = (type: string, w: number, o: number, s: string, e: string, b: number) => ({ type, cycleDays: w + o, considerHolidays: false, days: Array.from({ length: w + o }, (_, i) => (i < w ? work(i, s, e, b) : off(i))) });
  switch (kind) {
    case 'comercial': return { type: 'FIXED', cycleDays: null, considerHolidays: true, days: [0, 1, 2, 3, 4, 5, 6].map((d) => (d >= 1 && d <= 5 ? work(d, '08:00', '17:00', 60, '12:00') : off(d))) };
    case 'sabado': return { type: 'FIXED', cycleDays: null, considerHolidays: true, days: [0, 1, 2, 3, 4, 5, 6].map((d) => (d >= 1 && d <= 5 ? work(d, '08:00', '17:00', 60, '12:00') : d === 6 ? work(d, '08:00', '12:00', 0) : off(d))) };
    case '12x36': return cycle('SHIFT_12X36', 1, 1, '07:00', '19:00', 60);
    case '12x36n': return cycle('SHIFT_12X36', 1, 1, '19:00', '07:00', 60);
    case '6x1': return cycle('SHIFT_6X1', 6, 1, '07:00', '15:20', 60);
    case '5x2': return cycle('SHIFT_5X2', 5, 2, '08:00', '17:00', 60);
    case '4x2': return cycle('SHIFT_4X2', 4, 2, '07:00', '19:00', 60);
    case 'flex': return { type: 'FLEXIBLE', cycleDays: null, considerHolidays: true, days: [0, 1, 2, 3, 4, 5, 6].map((d) => (d >= 1 && d <= 5 ? { ...off(d), isWorkday: true, expectedMinutes: 480, breakMinutes: 60 } : off(d))) };
    default: return { type: 'FIXED', cycleDays: null, considerHolidays: true, days: [0, 1, 2, 3, 4, 5, 6].map(off) };
  }
}

/** Empresa escolhida na tela (primeira da lista por padrão). */
export function useCompanyPick(tenantId: string | null) {
  const companies = useQuery({ queryKey: ['companies', tenantId, 'all'], queryFn: () => api<Page<Company>>('/companies?pageSize=200'), enabled: !!tenantId });
  const [companyId, setCompanyId] = useState('');
  useEffect(() => {
    const l = companies.data?.data ?? [];
    if (l.length && !l.some((c) => c.id === companyId)) setCompanyId(l[0]!.id);
  }, [companies.data, companyId]);
  return { companies: companies.data?.data ?? [], loaded: !!companies.data, companyId, setCompanyId };
}
