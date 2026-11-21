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

// A v1 tem RLS por empresa: a leitura é feita pela função v1_export.dump() (SECURITY DEFINER, só leitura,
// executável apenas pelo papel superponto_migrator), criada só durante a migração e removida depois.
const AUTH_TABLES = new Set(['users']);
const plain = (() => { const u = new URL(url); u.searchParams.delete('schema'); return u.toString(); })();
const client = new pg.Client({ connectionString: plain });
await client.connect();
let dump;
try {
  dump = (await client.query('SELECT v1_export.dump() AS d')).rows[0].d;
} finally {
  await client.end();
}
const tables = Object.entries(dump).map(([name, rows]) => ({ schema: AUTH_TABLES.has(name) ? 'auth' : 'public', name, rows }));
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
