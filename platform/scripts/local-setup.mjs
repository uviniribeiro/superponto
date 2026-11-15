#!/usr/bin/env node
// Versão local: espera o banco, aplica as migrações, cria o papel de login da API e roda o seed
// (com o administrador e a senha inicial escolhidos no instalador). Pode rodar várias vezes.
import { execSync } from 'node:child_process';
import pg from 'pg';

const owner = process.env.MIGRATION_DATABASE_URL;
const apiPassword = process.env.API_DB_PASSWORD;
if (!owner || !apiPassword) throw new Error('Defina MIGRATION_DATABASE_URL e API_DB_PASSWORD');
const plain = (() => { const u = new URL(owner); u.searchParams.delete('schema'); return u.toString(); })();

for (let i = 1; ; i++) {
  const c = new pg.Client({ connectionString: plain });
  try { await c.connect(); await c.end(); break; } catch (e) {
    if (i >= 60) throw e;
    console.log('Aguardando o banco…');
    await new Promise((r) => setTimeout(r, 2000));
  }
}

console.log('==> Migrações');
execSync('npx prisma migrate deploy', { cwd: 'packages/database', env: { ...process.env, DATABASE_URL: owner }, stdio: 'inherit' });

console.log('==> Papel de login da API (sujeito às regras de isolamento)');
const c = new pg.Client({ connectionString: plain });
await c.connect();
const exists = (await c.query("SELECT 1 FROM pg_roles WHERE rolname = 'superponto_api'")).rowCount;
const pw = apiPassword.replace(/'/g, "''");
await c.query(exists ? `ALTER ROLE superponto_api WITH LOGIN PASSWORD '${pw}'` : `CREATE ROLE superponto_api LOGIN PASSWORD '${pw}' IN ROLE superponto_app`);
await c.query('ALTER ROLE superponto_api SET search_path = superponto, public');
await c.end();

console.log('==> Seed (permissões, perfis e administrador)');
execSync('node apps/api/dist/seed.js', { env: { ...process.env, DATABASE_URL: owner }, stdio: 'inherit' });
console.log('Banco pronto.');
