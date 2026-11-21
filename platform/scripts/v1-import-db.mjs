#!/usr/bin/env node
// Importa clientes, empresas, usuários (com a senha da v1), funcionários e marcações da v1 para a v2,
// lendo a v1 direto do mesmo banco Supabase (esquemas public e auth) — as senhas não saem do banco/build.
// Roda no build da Vercel quando V1_IMPORT=dry (só confere) ou V1_IMPORT=apply (grava). Clientes já
// importados são pulados, então rodar de novo é seguro.
//   MIGRATION_DATABASE_URL=postgresql://superponto_migrator...?schema=superponto V1_IMPORT=dry node scripts/v1-import-db.mjs
import path from 'node:path';
import pg from 'pg';
import { createPrismaClient } from '@superponto/database';

const root = path.resolve(import.meta.dirname, '..');
const mode = process.env.V1_IMPORT;
const url = process.env.MIGRATION_DATABASE_URL;
if (!url || !['dry', 'apply'].includes(mode ?? '')) {
  console.log('Importação da v1: desligada (defina V1_IMPORT=dry ou V1_IMPORT=apply).');
  process.exit(0);
}
const { importV1 } = await import(path.join(root, 'apps/api/dist/migration/v1-import.js'));

const TABLES = [
  ['public', 'companies'], ['public', 'company_settings'], ['public', 'departments'], ['public', 'employee_types'],
  ['public', 'georeferenced_locations'], ['public', 'job_functions'], ['public', 'justifications'], ['public', 'positions'],
  ['public', 'profiles'], ['public', 'time_clock_equipment'], ['public', 'time_records'], ['public', 'user_roles'],
];
const plain = (() => { const u = new URL(url); u.searchParams.delete('schema'); return u.toString(); })();
const client = new pg.Client({ connectionString: plain });
await client.connect();
const tables = [];
try {
  for (const [schema, name] of TABLES) {
    const r = await client.query(`SELECT coalesce(json_agg(t), '[]'::json) AS rows FROM ${schema}.${name} t`);
    tables.push({ schema, name, rows: r.rows[0].rows });
  }
  const users = await client.query(
    `SELECT coalesce(json_agg(t), '[]'::json) AS rows FROM (SELECT id, email, encrypted_password, last_sign_in_at, banned_until, created_at FROM auth.users) t`,
  );
  tables.push({ schema: 'auth', name: 'users', rows: users.rows[0].rows });
} finally {
  await client.end();
}
console.log(`v1 lida: ${tables.map((t) => `${t.schema}.${t.name}=${t.rows.length}`).join(', ')}`);

const db = createPrismaClient(url);
try {
  const r = await importV1(db, { exported_at: new Date().toISOString(), tables }, { dryRun: mode !== 'apply' });
  console.log(r.dryRun ? '== IMPORTAÇÃO DA V1: CONFERÊNCIA (nada gravado)' : '== IMPORTAÇÃO DA V1: GRAVADA');
  for (const t of r.tenants) console.log(`  cliente ${t.status === 'created' ? 'novo' : 'já importado'}: ${t.name} (${t.slug})`);
  for (const [k, v] of Object.entries(r.counts)) console.log(`  ${k}: ${v}`);
  if (r.warnings.length) {
    console.log(`Avisos (${r.warnings.length}):`);
    for (const w of r.warnings.slice(0, 200)) console.log(`  - ${w}`);
  }
} finally {
  await db.$disconnect();
}
