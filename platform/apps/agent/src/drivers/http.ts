import http from 'node:http';
import https from 'node:https';

export interface HttpTarget { host: string; port: number; https: boolean; insecureTls: boolean; timeoutMs: number }
export interface HttpResult { status: number; text: string; contentType: string }

/**
 * Requisição para o relógio na rede local. Os REPs costumam usar certificado autoassinado:
 * `insecureTls` vale só para esta conexão (nunca para a API do SuperPonto).
 */
export function deviceRequest(t: HttpTarget, method: 'GET' | 'POST', path: string, body?: unknown): Promise<HttpResult> {
  const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
  const lib = t.https ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request({
      host: t.host, port: t.port, method, path, timeout: t.timeoutMs,
      headers: { ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}), Accept: '*/*' },
      ...(t.https ? { rejectUnauthorized: !t.insecureTls } : {}),
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('latin1'), contentType: String(res.headers['content-type'] ?? '') }));
    });
    req.on('timeout', () => req.destroy(new Error(`Tempo esgotado falando com ${t.host}:${t.port}`)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}
