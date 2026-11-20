// Banco de testes do zero: migrações (papel dono), papel de login da API (sujeito à RLS) e seed.
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';

const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? 'postgresql://postgres:dev@127.0.0.1:55432/postgres';
const DB = 'superponto_test';

export default async function setup() {
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${DB}`);
  await admin.end();

  const ownerUrl = ADMIN_URL.replace(/\/[^/]+$/, `/${DB}`);
  // Papéis que a API REST do Supabase usa: as migrações precisam tirar o acesso deles.
  const pre = new pg.Client({ connectionString: ownerUrl });
  await pre.connect();
  await pre.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  END $$`);
  await pre.end();
  const dbPackage = path.resolve(import.meta.dirname, '../../../packages/database');
  execSync('npx prisma migrate deploy', { cwd: dbPackage, env: { ...process.env, DATABASE_URL: `${ownerUrl}?schema=superponto` }, stdio: 'pipe' });

  const owner = new pg.Client({ connectionString: ownerUrl });
  await owner.connect();
  await owner.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'superponto_api_test') THEN
      CREATE ROLE superponto_api_test LOGIN PASSWORD 'api' IN ROLE superponto_app;
    END IF; END $$`);
  await owner.end();

  process.env.TEST_OWNER_DATABASE_URL = ownerUrl;
  process.env.TEST_APP_DATABASE_URL = ownerUrl.replace(/\/\/[^@]+@/, '//superponto_api_test:api@');
  const { seed } = await import('../src/seed.js');
  const { createPrismaClient } = await import('@superponto/database');
  const client = createPrismaClient(ownerUrl);
  await seed(client, 'plataforma@superponto.test');
  await client.$disconnect();

  if (process.env.API_TARGET === 'dart') return startDart(process.env.TEST_APP_DATABASE_URL);
  return () => undefined;
}

/** Compila e sobe o servidor Dart com a mesma configuração de teste da API em Node. */
async function startDart(databaseUrl: string): Promise<() => Promise<void>> {
  const dartDir = path.resolve(import.meta.dirname, '../../../dart/server');
  const bin = path.join(dartDir, 'build', 'sp_server');
  const outbox = path.join(os.tmpdir(), `sp-dart-outbox-${process.pid}.jsonl`);
  rmSync(outbox, { force: true });
  mkdirSync(path.dirname(bin), { recursive: true });
  execSync(`dart compile exe bin/server.dart -o ${bin}`, { cwd: dartDir, stdio: 'pipe' });
  const port = process.env.DART_API_PORT ?? '3999';
  const child = spawn(bin, [], {
    stdio: ['ignore', 'pipe', 'inherit'],
    env: {
      ...process.env,
      NODE_ENV: 'test', PORT: port, DATABASE_URL: databaseUrl,
      APP_URL: 'http://localhost:3001', API_URL: 'http://localhost:3000',
      JWT_SECRET: 'teste-segredo-jwt-com-mais-de-32-caracteres!!',
      MFA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
      BIOMETRIC_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
      SECRETS_ENCRYPTION_KEY: Buffer.alloc(32, 5).toString('base64'),
      LDAP_ALLOW_PRIVATE_HOSTS: process.env.TEST_LDAP_ALLOW_PRIVATE ?? 'true',
      MAIL_TRANSPORT: 'memory', MAIL_OUTBOX_FILE: outbox, RATE_LIMIT: 'off',
    },
  });
  process.env.DART_API_URL = `http://127.0.0.1:${port}`;
  process.env.DART_MAIL_OUTBOX = outbox;
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${process.env.DART_API_URL}/health`)).ok) break;
    } catch { /* subindo */ }
    if (i > 100 || child.exitCode !== null) throw new Error('O servidor Dart não subiu');
    await new Promise((r) => setTimeout(r, 100));
  }
  return async () => { child.kill('SIGTERM'); };
}
