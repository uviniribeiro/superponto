// Catraca ligada ao terminal: o próprio terminal (mesma rede local da catraca) envia o comando de
// liberação assim que a identificação é aceita — sem passar pela nuvem, em milissegundos.
//  - Control iD (iDBlock, iDFlex…): API do equipamento (login.fcgi + execute_actions.fcgi, ação "catra").
//  - HTTP genérico: placas de relé e controladoras que liberam por uma URL (GET/POST).
// No app Android as requisições saem pelo HTTP nativo (sem bloqueio de CORS nem de HTTP na rede local).
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export type TurnstileDirection = 'clockwise' | 'anticlockwise' | 'both';

export interface TurnstileConfig {
  vendor: 'none' | 'controlid' | 'http';
  /** Control iD: IP ou endereço do equipamento (ex.: 192.168.0.50). HTTP genérico: URL completa. */
  host?: string;
  login?: string;
  password?: string;
  /** Sentido que libera a ENTRADA (catraca Control iD). */
  entry?: TurnstileDirection;
  /** Botão "Liberar saída" na tela do terminal. */
  exitButton?: boolean;
  /** Liberar a catraca também no registro de ponto (não só no refeitório). */
  onPunch?: boolean;
  /** Sem internet: libera mesmo assim (a refeição fica guardada e é conferida ao reconectar). Padrão: sim. */
  offlineUnlock?: boolean;
  /** HTTP genérico: método, URL de saída e corpo (opcional). */
  method?: 'GET' | 'POST';
  exitUrl?: string;
  body?: string;
}

const native = () => Capacitor.isNativePlatform();

async function request(method: 'GET' | 'POST', url: string, data?: unknown, timeoutMs = 2500): Promise<{ ok: boolean; data: any }> {
  if (native()) {
    const r = await CapacitorHttp.request({ method, url, data, headers: { 'Content-Type': 'application/json' }, connectTimeout: timeoutMs, readTimeout: timeoutMs });
    return { ok: r.status >= 200 && r.status < 300, data: r.data };
  }
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method, headers: data ? { 'Content-Type': 'application/json' } : undefined, body: data ? JSON.stringify(data) : undefined, signal: ctl.signal });
    let d: any = null;
    try { d = await r.json(); } catch { /* sem corpo JSON */ }
    return { ok: r.ok, data: d };
  } finally {
    clearTimeout(t);
  }
}

const base = (host: string) => (/^https?:\/\//.test(host) ? host.replace(/\/+$/, '') : `http://${host}`);

/** Sessão da Control iD guardada em memória (renovada a cada 4 min pelo acompanhamento de status). */
let cidSession: { host: string; session: string; at: number } | null = null;

async function controlIdSession(cfg: TurnstileConfig, force = false) {
  const host = base(cfg.host ?? '');
  if (!force && cidSession && cidSession.host === host && Date.now() - cidSession.at < 4 * 60_000) return cidSession.session;
  const r = await request('POST', `${host}/login.fcgi`, { login: cfg.login || 'admin', password: cfg.password || 'admin' });
  const session = r.data?.session;
  if (!r.ok || !session) throw new Error('login');
  cidSession = { host, session, at: Date.now() };
  return session as string;
}

/** Libera a catraca. Devolve true se o equipamento aceitou. */
export async function unlockTurnstile(cfg: TurnstileConfig | null | undefined, kind: 'entry' | 'exit'): Promise<boolean> {
  if (!cfg || cfg.vendor === 'none' || !cfg.host) return false;
  try {
    if (cfg.vendor === 'controlid') {
      const entry = cfg.entry ?? 'clockwise';
      const dir: TurnstileDirection = kind === 'entry' ? entry : entry === 'clockwise' ? 'anticlockwise' : entry === 'anticlockwise' ? 'clockwise' : 'both';
      const run = async (force: boolean) => {
        const s = await controlIdSession(cfg, force);
        return request('POST', `${base(cfg.host!)}/execute_actions.fcgi?session=${encodeURIComponent(s)}`, { actions: [{ action: 'catra', parameters: `allow=${dir}` }] });
      };
      let r = await run(false);
      if (!r.ok) r = await run(true); // sessão expirada: renova e tenta de novo
      return r.ok;
    }
    const url = kind === 'exit' && cfg.exitUrl ? cfg.exitUrl : cfg.host;
    let body: unknown;
    if (cfg.body) { try { body = JSON.parse(cfg.body); } catch { body = cfg.body; } }
    return (await request(cfg.method ?? 'GET', url, cfg.method === 'POST' ? body : undefined)).ok;
  } catch {
    return false;
  }
}

/** A catraca responde? (Control iD: confere/renova a sessão; HTTP genérico: não há verificação padrão.) */
export async function turnstileOnline(cfg: TurnstileConfig | null | undefined): Promise<boolean | null> {
  if (!cfg || cfg.vendor === 'none' || !cfg.host) return null;
  if (cfg.vendor !== 'controlid') return null;
  try {
    await controlIdSession(cfg, true);
    return true;
  } catch {
    return false;
  }
}
