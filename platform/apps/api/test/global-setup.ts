// Banco de testes do zero: migrações (papel dono), papel de login da API (sujeito à RLS) e seed.
import { execSync } from 'node:child_process';
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

  return () => undefined;
}
