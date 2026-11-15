/** Cliente da API do SuperPonto (só HTTPS de saída; autentica pela chave do equipamento). */
export interface AgentJob { id: string; action: string; layout: '1510' | '671'; data: Record<string, unknown> }
export interface DeviceConfig { name: string; manufacturer: string | null; modelName: string | null; host: string | null; port: number | null; layout: '1510' | '671'; timezone: string; collectIntervalMinutes: number }

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export class AgentApi {
  constructor(private readonly baseUrl: string, private readonly deviceKey: string, private readonly timeoutMs = 60_000, private readonly fetchImpl: typeof fetch = fetch) {}

  private async req<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const r = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}${path}`, {
      method, signal: AbortSignal.timeout(this.timeoutMs),
      headers: { 'X-Device-Key': this.deviceKey, 'User-Agent': 'superponto-agent/2', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await r.text();
    if (!r.ok) {
      let msg = text.slice(0, 300);
      try { msg = (JSON.parse(text) as { message?: string }).message ?? msg; } catch { /* texto puro */ }
      throw new ApiError(`API ${method} ${path}: ${r.status} ${msg}`, r.status);
    }
    return (text ? JSON.parse(text) : {}) as T;
  }

  heartbeat(info: { firmware?: string; adapterVersion?: string; message?: string }) { return this.req<{ ok: boolean; serverTime: string; device: DeviceConfig }>('POST', '/v1/agent/heartbeat', info); }
  jobs() { return this.req<{ jobs: AgentJob[] }>('GET', '/v1/agent/jobs'); }
  result(id: string, body: { status: 'SUCCEEDED' | 'FAILED'; error?: string; data?: Record<string, unknown> }) { return this.req<Record<string, unknown>>('POST', `/v1/agent/jobs/${id}/result`, body); }
  afd(content: string) { return this.req<{ imported: number; duplicates: number; unmatched: number }>('POST', '/v1/agent/afd', { content }); }
}
