// App de terminal único: o mesmo aplicativo atende clientes da v1 e da v2. Na ativação, o CNPJ diz
// qual versão o cliente usa (kiosk_system_version) e o terminal passa a falar com o servidor certo.
// As respostas das duas versões são normalizadas para o mesmo formato.
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type SystemVersion = 'v1' | 'v2';
export type TerminalMethod = 'facial' | 'qrcode' | 'barcode' | 'pin' | 'registration' | 'cpf' | 'card';

export const V2_API = 'https://superponto-v2.vercel.app/v1';

/** Resposta normalizada (formato da v1). */
export interface TerminalResult {
  success: boolean;
  error?: string;
  code?: string;
  requireFace?: boolean;
  requireSecond?: boolean;
  options?: TerminalMethod[];
  employee?: { id?: string; full_name: string };
  record?: { record_type: string | null; recorded_at: string; nsr: number | string; transaction_hash?: string };
  employeeName?: string;
  duplicated?: boolean;
  meal?: { meal_name: string; recorded_at: string; transaction_hash?: string };
  access?: { direction: 'in' | 'out'; recorded_at: string };
  [k: string]: unknown;
}

export interface OfflineInfo { clientRecordedAt?: string; clientPunchId?: string; selfie2?: string; challenge?: string }

/** Falha de rede (sem resposta do servidor): o terminal guarda a marcação na fila offline. */
export class OfflineError extends Error {
  constructor() { super('offline'); }
}

const V2_METHOD: Record<string, string> = { qrcode: 'qr', barcode: 'barcode', pin: 'pin', registration: 'registration', cpf: 'cpf', card: 'card' };
const V1_FROM_V2: Record<string, TerminalMethod> = { qr: 'qrcode', barcode: 'barcode', pin: 'pin', registration: 'registration', cpf: 'cpf', card: 'card' };

export async function resolveVersion(cnpj: string): Promise<SystemVersion | null> {
  const { data, error } = await (supabase as any).rpc('kiosk_system_version', { p_cnpj: cnpj });
  if (error) {
    if (/fetch|network/i.test(error.message || '')) throw new OfflineError();
    return null;
  }
  return data === 'v2' ? 'v2' : data === 'v1' ? 'v1' : null;
}

// ---------------- v1 (função kiosk-terminal) ----------------
async function v1(payload: Record<string, unknown>): Promise<TerminalResult> {
  const { data, error } = await supabase.functions.invoke('kiosk-terminal', { body: payload });
  if (!error) return data as TerminalResult;
  if (error instanceof FunctionsHttpError) {
    // Erro de negócio (4xx/5xx com corpo JSON): não é falta de conexão.
    try { return (await (error.context as Response).json()) as TerminalResult; } catch { return { success: false, error: 'Erro no servidor do ponto.' }; }
  }
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) throw new OfflineError();
  throw new OfflineError();
}

// ---------------- v2 (API /v1/kiosk-device) ----------------
async function v2(path: string, token: string | null, body?: unknown): Promise<TerminalResult> {
  let res: Response;
  try {
    res = await fetch(`${V2_API}/kiosk-device/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'x-kiosk-token': token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new OfflineError();
  }
  if (res.status >= 502 && res.status <= 504) throw new OfflineError();
  let json: any = null;
  try { json = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) {
    const msg = Array.isArray(json?.message) ? json.message.join(' ') : json?.message;
    return { success: false, error: msg || 'Erro no servidor do ponto.', code: json?.code };
  }
  return { success: true, ...json };
}

const v2Record = (r: TerminalResult): TerminalResult => r.access ? ({
  success: true, duplicated: !!r.duplicated, employeeName: String(r.employee ?? ''),
  access: { direction: (r.access as any).direction, recorded_at: String((r.access as any).recordedAt ?? new Date().toISOString()) },
}) : r.meal ? ({
  success: true,
  duplicated: !!r.duplicated,
  employeeName: String(r.employee ?? ''),
  meal: { meal_name: String((r.meal as any).mealName ?? 'Refeição'), recorded_at: String((r.meal as any).recordedAt ?? new Date().toISOString()) },
}) : ({
  success: true,
  duplicated: !!r.duplicated,
  employeeName: String(r.employee ?? ''),
  record: { record_type: null, recorded_at: String(r.recordedAt ?? new Date().toISOString()), nsr: (r.nsr as number) ?? '', transaction_hash: String(r.hash ?? '') },
});

export interface Backend {
  version: SystemVersion;
  health(): Promise<TerminalResult>;
  session(token: string): Promise<TerminalResult>;
  activate(cnpj: string, name: string, coords?: { latitude: number | null; longitude: number | null }, purpose?: 'punch' | 'meal' | 'gate'): Promise<TerminalResult>;
  identify(token: string, method: TerminalMethod, value: string, alt?: string): Promise<TerminalResult>;
  configure(token: string, config: Record<string, unknown>): Promise<TerminalResult>;
  verifyFace(token: string, method: TerminalMethod, value: string, selfie: string, off?: OfflineInfo): Promise<TerminalResult>;
  identifyFace(token: string, selfie: string, off?: OfflineInfo): Promise<TerminalResult>;
  reportTurnstile(token: string, online: boolean): Promise<unknown>;
  verifyTwoFactor(token: string, first: { method: TerminalMethod; value: string }, second: { method: TerminalMethod; value: string }, off?: OfflineInfo): Promise<TerminalResult>;
}

const v1Backend: Backend = {
  version: 'v1',
  health: () => v1({ action: 'health' }),
  session: (token) => v1({ action: 'session', deviceToken: token }),
  activate: (cnpj, name, coords, purpose) => v1({ action: 'activate', cnpj, terminalName: name, purpose, latitude: coords?.latitude ?? null, longitude: coords?.longitude ?? null }),
  identify: (token, method, value, alt) => v1({ action: 'identify', deviceToken: token, identifier: value, method, alt }),
  configure: (token, config) => v1({ action: 'configure', deviceToken: token, config }),
  verifyFace: (token, method, value, selfie, off) => v1({ action: 'verify-face', deviceToken: token, identifier: value, method, selfieBase64: selfie, userAgent: navigator.userAgent, ...off }),
  identifyFace: (token, selfie, off) => v1({ action: 'identify-face', deviceToken: token, selfieBase64: selfie, userAgent: navigator.userAgent, ...off }),
  reportTurnstile: (token, online) => v1({ action: 'turnstile-status', deviceToken: token, online }).catch(() => null),
  verifyTwoFactor: async () => ({ success: false, error: 'Na v1 a conferência do rosto é obrigatória.' }),
};

const v2Backend: Backend = {
  version: 'v2',
  health: async () => {
    try {
      const r = await fetch(`${V2_API}/kiosk-device/session`, { cache: 'no-store' }); // 401 sem token = servidor no ar
      if (r.status >= 502) throw new OfflineError();
      return { success: true };
    } catch {
      throw new OfflineError();
    }
  },
  session: async (token) => {
    const r = await v2('session', token);
    if (!r.success) return r.code === 'terminal_invalid' ? r : { ...r, success: false };
    return { success: true, terminal: { name: (r.terminal as any)?.name, status: (r.terminal as any)?.status, activationCode: (r.terminal as any)?.activationCode, purpose: (r.terminal as any)?.purpose, turnstile: (r.terminal as any)?.turnstile ?? null, gateDirection: (r.terminal as any)?.gateDirection, cardWithoutFace: (r.terminal as any)?.cardWithoutFace }, company: r.company, meals: r.meals };
  },
  activate: async (cnpj, name, _coords, purpose) => {
    const r = await v2('activate', null, { cnpj, name: name || undefined, purpose });
    if (!r.success) return r;
    return { success: true, deviceToken: r.deviceToken, activationCode: r.activationCode, status: r.status, terminal: r.terminal, company: r.company };
  },
  configure: (token, config) => v2('configure', token, { config }),
  identify: async (token, method, value, alt) => {
    const r = await v2('identify', token, { method: V2_METHOD[method], value, ...(alt ? { alt } : {}) });
    if (!r.success) return r;
    if (r.meal || r.access) return v2Record(r); // cartão sem rosto (refeitório/portaria): já registrou
    return {
      success: true,
      requireFace: !!r.requireFace,
      requireSecond: !!r.requireSecond,
      options: ((r.options as string[]) ?? []).map((o) => V1_FROM_V2[o]).filter(Boolean),
      employee: { id: String(r.employmentId ?? ''), full_name: String(r.name ?? '') },
    };
  },
  verifyFace: async (token, method, value, selfie, off) => {
    const r = await v2('verify', token, { method: V2_METHOD[method], value, selfie, ...off });
    return r.success ? v2Record(r) : r;
  },
  identifyFace: async (token, selfie, off) => {
    const r = await v2('identify-face', token, { selfie, ...off });
    return r.success ? v2Record(r) : r;
  },
  reportTurnstile: (token, online) => v2('turnstile-status', token, { online }).catch(() => null),
  verifyTwoFactor: async (token, first, second, off) => {
    const r = await v2('verify-2fa', token, { first: { method: V2_METHOD[first.method], value: first.value }, second: { method: V2_METHOD[second.method], value: second.value }, ...off });
    return r.success ? v2Record(r) : r;
  },
};

export const backendFor = (v: SystemVersion | undefined | null): Backend => (v === 'v2' ? v2Backend : v1Backend);

// ---------------- Fila offline ----------------
export interface QueuedPunch {
  id: string; // clientPunchId
  at: string; // hora da marcação no terminal
  kind: 'face' | 'faceN' | 'twoFactor';
  method?: TerminalMethod;
  value?: string;
  selfie?: string;
  selfie2?: string;
  challenge?: string;
  second?: { method: TerminalMethod; value: string };
  label?: string;
}

export interface RejectedPunch { at: string; label: string; reason: string }

const QUEUE_KEY = 'superponto.terminal.queue';
const REJECTED_KEY = 'superponto.terminal.rejected';
const MAX_QUEUE = 200;

const read = <T,>(k: string): T[] => {
  try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; }
};

export const readQueue = () => read<QueuedPunch>(QUEUE_KEY);
export const readRejected = () => read<RejectedPunch>(REJECTED_KEY);

export function writeQueue(q: QueuedPunch[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE)));
    return true;
  } catch {
    // Memória do navegador cheia: guarda sem as fotos mais antigas (serão recusadas na conferência).
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE).map((p, i, a) => (i < a.length - 30 ? { ...p, selfie: undefined } : p))));
      return true;
    } catch {
      return false;
    }
  }
}

export function addRejected(r: RejectedPunch) {
  try { localStorage.setItem(REJECTED_KEY, JSON.stringify([...readRejected(), r].slice(-50))); } catch { /* ignora */ }
}

export function clearRejected() {
  try { localStorage.removeItem(REJECTED_KEY); } catch { /* ignora */ }
}

/** Envia a fila: conferência do rosto (ou das duas verificações) acontece agora, com a hora original. */
export async function flushQueue(backend: Backend, token: string): Promise<{ sent: number; rejected: number }> {
  let sent = 0, rejected = 0;
  for (const item of readQueue()) {
    const off = { clientRecordedAt: item.at, clientPunchId: item.id, selfie2: item.selfie2, challenge: item.challenge };
    let r: TerminalResult;
    try {
      if (item.kind === 'faceN') r = item.selfie ? await backend.identifyFace(token, item.selfie, off) : { success: false, error: 'Foto não guardada' };
      else if (item.kind === 'twoFactor') r = await backend.verifyTwoFactor(token, { method: item.method!, value: item.value! }, item.second!, off);
      else r = item.selfie ? await backend.verifyFace(token, item.method!, item.value!, item.selfie, off) : { success: false, error: 'Foto não guardada' };
    } catch (e) {
      if (e instanceof OfflineError) break;
      r = { success: false, error: 'Erro ao enviar' };
    }
    if (r.code === 'no_face' || r.code === 'not_recognized') {
      // Sem rosto aproveitável: não há como conferir depois.
      r = { success: false, error: r.error };
    }
    if (r.success) sent++;
    else {
      rejected++;
      addRejected({ at: item.at, label: item.label || 'Marcação offline', reason: r.error || 'Recusada na conferência' });
    }
    writeQueue(readQueue().filter((q) => q.id !== item.id));
  }
  return { sent, rejected };
}

/** Endereço público do comprovante (QR Code mostrado no terminal depois do registro). */
export const receiptUrl = (version: SystemVersion | undefined, hash: string) => `https://superponto.vercel.app/comprovante/${version === 'v2' ? 'v2' : 'v1'}/${hash}`;

export async function fetchReceipt(version: string, hash: string): Promise<Record<string, any> | null> {
  if (version === 'v2') {
    try {
      const r = await fetch(`${V2_API}/kiosk-device/receipt/${hash}`);
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }
  const r = await v1({ action: 'receipt', hash }).catch(() => null);
  return r?.success ? (r.receipt as Record<string, any>) : null;
}
