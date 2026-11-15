import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createAppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { loadConfig, type AppConfig } from '../src/config.js';
import { MailService } from '../src/mail/mail.service.js';
import { HTTP_FETCH } from '../src/lookup/lookup.service.js';

export const appUrl = (process.env.TEST_APP_DATABASE_URL ?? 'postgresql://superponto_api_test:api@127.0.0.1:55432/superponto_test');
export const ownerUrl = (process.env.TEST_OWNER_DATABASE_URL ?? 'postgresql://postgres:dev@127.0.0.1:55432/superponto_test');

export function testConfig(): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: appUrl,
    APP_URL: 'http://localhost:3001',
    API_URL: 'http://localhost:3000',
    JWT_SECRET: 'teste-segredo-jwt-com-mais-de-32-caracteres!!',
    MFA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    BIOMETRIC_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
    MAIL_TRANSPORT: 'memory',
  } as NodeJS.ProcessEnv);
}

export async function createApp(opts: { fetch?: typeof fetch } = {}): Promise<{ app: INestApplication; mail: MailService }> {
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

export const api = (app: INestApplication) => request(app.getHttpServer());
