import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createAppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { loadConfig, type AppConfig } from '../src/config.js';
import { MailService } from '../src/mail/mail.service.js';
import { HTTP_FETCH } from '../src/lookup/lookup.service.js';

export const appUrl = (process.env.TEST_APP_DATABASE_URL ?? 'postgresql://superponto_api_test:api@127.0.0.1:55432/superponto_test');
export const ownerUrl = (process.env.TEST_OWNER_DATABASE_URL ?? 'postgresql://postgres:dev@127.0.0.1:55432/superponto_test');

/** Segredo do servidor de comunicação nos testes (as rotas do agente exigem X-Comm-Token). */
export const COMM_TOKEN = 'teste-token-do-servidor-de-comunicacao-0123456789';

export function testConfig(): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: appUrl,
    APP_URL: 'http://localhost:3001',
    API_URL: 'http://localhost:3000',
    JWT_SECRET: 'teste-segredo-jwt-com-mais-de-32-caracteres!!',
    MFA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    BIOMETRIC_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
    SECRETS_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString('base64'),
    LDAP_ALLOW_PRIVATE_HOSTS: process.env.TEST_LDAP_ALLOW_PRIVATE ?? 'true',
    MAIL_TRANSPORT: 'memory',
    COMM_SERVER_TOKEN: COMM_TOKEN,
  } as NodeJS.ProcessEnv);
}

/**
 * API_TARGET=dart: os mesmos testes rodam contra o servidor Dart (iniciado no global-setup).
 * O "app" vira um endereço HTTP e a caixa de e-mail é lida do arquivo que o servidor grava.
 */
export const dartTarget = process.env.API_TARGET === 'dart';
export const dartUrl = process.env.DART_API_URL ?? 'http://127.0.0.1:3999';
export const dartOutbox = process.env.DART_MAIL_OUTBOX ?? '';

function dartMail(): MailService {
  return {
    get outbox() {
      if (!dartOutbox || !existsSync(dartOutbox)) return [];
      return readFileSync(dartOutbox, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    },
  } as unknown as MailService;
}

function dartApp(): INestApplication {
  return {
    getHttpServer: () => dartUrl,
    close: async () => undefined,
    get: () => { throw new Error('app.get() não existe no alvo Dart: use a rota de teste correspondente'); },
  } as unknown as INestApplication;
}

export async function createApp(opts: { fetch?: typeof fetch } = {}): Promise<{ app: INestApplication; mail: MailService }> {
  if (dartTarget) {
    // Consultas externas (CEP/CNPJ): o servidor Dart passa a perguntar a este servidor local, que responde com o fetch falso.
    const fake = opts.fetch ?? (async () => new Response('{}', { status: 503 }));
    const stub = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://x').searchParams.get('url') ?? '';
      const r = await fake(url);
      res.writeHead(r.status, { 'content-type': 'application/json' });
      res.end(await r.text());
    });
    await new Promise<void>((ok) => stub.listen(0, '127.0.0.1', ok));
    const port = (stub.address() as { port: number }).port;
    await hook('lookup-stub', async () => undefined, () => undefined, { url: `http://127.0.0.1:${port}/` });
    const app = dartApp();
    (app as unknown as { close: () => Promise<void> }).close = async () => { stub.close(); };
    return { app, mail: dartMail() };
  }
  const config = testConfig();
  const builder = Test.createTestingModule({ imports: [createAppModule(config)] });
  // Testes nunca acessam serviços externos: a consulta de CEP/CNPJ usa um fetch falso.
  builder.overrideProvider(HTTP_FETCH).useValue(opts.fetch ?? (async () => new Response('{}', { status: 503 })));
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  configureApp(app, config);
  await app.init();
  return { app, mail: app.get(MailService) };
}

/** Extrai o token do último e-mail de redefinição enviado para `email`. */
export function resetTokenFor(mail: MailService, email: string, after = 0): string {
  const msg = mail.outbox.slice(after).reverse().find((m) => m.to === email);
  if (!msg) throw new Error(`Nenhum e-mail para ${email}`);
  const url = /https?:\/\/\S+/.exec(msg.text)?.[0];
  const token = url && new URL(url).searchParams.get('token');
  if (!token) throw new Error(`Link sem token: ${url}`);
  return token;
}

export async function waitFor<T>(fn: () => T | undefined, timeoutMs = 5000): Promise<T> {
  const start = Date.now();
  for (;;) {
    try {
      const value = fn();
      if (value !== undefined) return value;
    } catch { /* tenta de novo */ }
    if (Date.now() - start > timeoutMs) throw new Error('Tempo esgotado esperando condição');
    await new Promise((r) => setTimeout(r, 50));
  }
}

export const api = (app: INestApplication) => request(app.getHttpServer() as Parameters<typeof request>[0]);

/** Ponte de teste: no alvo Dart chama POST /__test/<nome>; no Node, executa `node()`. */
export async function hook<T>(name: string, node: () => Promise<T>, pick: (body: any) => T = (b) => b, body: unknown = {}): Promise<T> {
  if (!dartTarget) return node();
  const res = await fetch(`${dartUrl}/__test/${name}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Ponte de teste ${name}: ${res.status} ${await res.text()}`);
  return pick(await res.json());
}
