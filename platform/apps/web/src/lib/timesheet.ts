'use client';

export interface Punch { id: string; adjustmentId: string | null; at: string; time: string; date: string; source: string; status: 'ORIGINAL' | 'INCLUDED' | 'DISREGARDED' | 'PENDING_INCLUDE' | 'PENDING_DISREGARD'; justification: string | null }
export interface DayResult {
  expectedMinutes: number; workedMinutes: number; balanceMinutes: number; breakMinutes: number; nightMinutes: number; lateMinutes: number; earlyLeaveMinutes: number;
  absenceMinutes: number; overtimeMinutes: number; overtime: Array<{ percent: number; minutes: number }>; flags: string[]; unauthorizedOvertimeMinutes: number; inItinereMinutes: number;
}
export interface MirrorDay {
  date: string;
  expected: { isWorkday: boolean; isHoliday: boolean; start: string | null; end: string | null; expectedMinutes: number; holidayName: string | null; scheduleName: string | null; origin: string | null };
  punches: Punch[]; result: DayResult | null;
  allowance: { id: string; justification: string; disregardsDebits: boolean; fullDay: boolean; minutes: number; note: string | null } | null;
  leave: { id: string; type: string; label: string; note: string | null } | null;
  onCall: Array<{ id: string; startTime: string; endTime: string; minutes: number }>;
  closed: boolean; outsideEmployment: boolean;
}
export interface Summary {
  days: number; workdays: number; expectedMinutes: number; workedMinutes: number; balanceMinutes: number; overtimeMinutes: number; overtimeByPercent: Array<{ percent: number; minutes: number }>;
  nightMinutes: number; nightReducedMinutes: number; lateMinutes: number; earlyLeaveMinutes: number; absenceDays: number; incompleteDays: number;
  onCallMinutes: number; onCallPaidMinutes: number; allowanceDays: number; leaveDays: number; unauthorizedOvertimeMinutes: number; pendingAdjustments: number;
}
export interface Mirror { employment: { id: string; registration: string; name: string; companyId: string }; from: string; to: string; days: MirrorDay[]; summary: Summary }

/** Minutos em "8h00", com sinal quando pedido ("+2h00", "−0h30"). */
export function hhmm(m: number | null | undefined, signed = false) {
  const v = m ?? 0;
  const a = Math.abs(v);
  const s = `${Math.floor(a / 60)}h${String(a % 60).padStart(2, '0')}`;
  return signed ? (v > 0 ? `+${s}` : v < 0 ? `−${s}` : s) : v < 0 ? `−${s}` : s;
}

export const FLAG_LABEL: Record<string, string> = {
  ABSENCE: 'Falta', INCOMPLETE: 'Marcação ímpar', LATE: 'Atraso', EARLY_LEAVE: 'Saída antecipada', EARLY_ENTRY: 'Entrada antecipada',
  INSUFFICIENT_BREAK: 'Intervalo curto', AUTO_BREAK_DEDUCTED: 'Intervalo descontado', OVERTIME_LIMIT_EXCEEDED: 'Extra acima do limite', WITHIN_TOLERANCE: 'Na tolerância',
  WORK_ON_REST_DAY: 'Trabalho na folga', WORK_ON_HOLIDAY: 'Trabalho no feriado', LEAVE_FULL: 'Abonado', LEAVE_PARTIAL: 'Abono parcial', MOBILE_ENTRY: 'Entrada móvel',
  BREAK_OUT_OF_WINDOW: 'Intervalo fora da janela', BREAK_EXCEEDED: 'Intervalo excedido', IN_ITINERE: 'In itinere', SCHEDULED_DAY: 'Escala agendada',
  JUSTIFIED: 'Justificado', OVERTIME_UNAUTHORIZED: 'Extra sem autorização',
};
export const BAD_FLAGS = new Set(['ABSENCE', 'INCOMPLETE', 'LATE', 'EARLY_LEAVE', 'INSUFFICIENT_BREAK', 'OVERTIME_LIMIT_EXCEEDED', 'BREAK_OUT_OF_WINDOW', 'BREAK_EXCEEDED', 'OVERTIME_UNAUTHORIZED']);
export const LEAVE_TYPES: Array<[string, string]> = [['MEDICAL', 'Atestado médico'], ['VACATION', 'Férias'], ['MATERNITY', 'Licença-maternidade'], ['PATERNITY', 'Licença-paternidade'], ['WORK_ACCIDENT', 'Acidente de trabalho'], ['UNPAID', 'Licença não remunerada'], ['SUSPENSION', 'Suspensão'], ['OTHER', 'Outro afastamento']];
export const SOURCE_LABEL: Record<string, string> = { WEB: 'Navegador', MOBILE: 'App', KIOSK: 'Terminal', DEVICE: 'Relógio', COMMUNICATION_SERVER: 'Relógio', IMPORT: 'Importação', MANUAL_ADJUSTMENT: 'Incluída' };

export const todayBr = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
export const addDays = (v: string, n: number) => new Date(Date.parse(`${v}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
export const monthRange = (v: string) => { const [y, m] = v.split('-').map(Number) as [number, number]; const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return { from: `${v.slice(0, 7)}-01`, to: `${v.slice(0, 7)}-${String(last).padStart(2, '0')}` }; };
export const br = (v: string) => `${v.slice(8, 10)}/${v.slice(5, 7)}`;
export const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const wd = (v: string) => WD[new Date(`${v}T00:00:00Z`).getUTCDay()]!;
