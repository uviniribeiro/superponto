#!/usr/bin/env node
/**
 * Migra os dados do Lovable Cloud para o projeto Supabase próprio.
 * Lê da função temporária migration-export (no Cloud) e grava no banco de destino.
 *
 *   node scripts/deploy/migrate-from-lovable.mjs export arquivo.json   salva tudo num arquivo
 *   node scripts/deploy/migrate-from-lovable.mjs import arquivo.json   grava o arquivo no destino
 *   node scripts/deploy/migrate-from-lovable.mjs storage               copia os arquivos (fotos, logos)
 *
 * Origem:  SOURCE_URL, SOURCE_ANON_KEY, MIGRATION_TOKEN
 * Destino: DEST_DB_URL  (ou SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD)
 *          DEST_URL + DEST_SERVICE_ROLE_KEY para o Storage
 *
 * O destino é tratado como instalação nova: as tabelas do esquema public são esvaziadas
 * antes da carga (os dados do Cloud passam a ser a referência). Contas de login, senhas
 * (hash), perfis, papéis, empresas e marcações são preservados.
 */
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const env = (n, d = '') => (process.env[n] ?? d).trim();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CHUNK = 500;

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

async function source(body) {
  const url = env('SOURCE_URL').replace(/\/+$/, '');
  const res = await fetch(`${url}/functions/v1/migration-export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env('SOURCE_ANON_KEY'),
      Authorization: `Bearer ${env('SOURCE_ANON_KEY')}`,
      'x-migration-token': env('MIGRATION_TOKEN'),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`migration-export ${body.action}: HTTP ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

// ---------------------------------------------------------------- export
async function cmdExport(file) {
  const manifest = await source({ action: 'manifest' });
  const dump = { exported_at: new Date().toISOString(), source: env('SOURCE_URL'), buckets: manifest.buckets, tables: [] };
  for (const t of manifest.tables) {
    const rows = [];
    while (rows.length < t.rows) {
      const page = await source({ action: 'rows', schema: t.schema, table: t.name, offset: rows.length, limit: 1000 });
      if (!page.rows.length) break;
      rows.push(...page.rows);
    }
    if (rows.length !== t.rows) console.log(`::warning::${t.schema}.${t.name}: ${rows.length} de ${t.rows} linhas (tabela mudou durante a exportação)`);
    dump.tables.push({ schema: t.schema, name: t.name, rows });
    if (rows.length) console.log(`  ${t.schema}.${t.name}: ${rows.length}`);
  }
  writeFileSync(file, JSON.stringify(dump));
  chmodSync(file, 0o600);
  const total = dump.tables.reduce((s, t) => s + t.rows.length, 0);
  console.log(`Exportado: ${total} linhas de ${dump.tables.length} tabelas -> ${file}`);
}

// ---------------------------------------------------------------- import
async function destinationUrl() {
  if (env('DEST_DB_URL')) return env('DEST_DB_URL');
  const ref = env('SUPABASE_PROJECT_REF');
  const token = env('SUPABASE_ACCESS_TOKEN');
  const password = env('SUPABASE_DB_PASSWORD');
  if (!ref || !token || !password) fail('Defina DEST_DB_URL ou SUPABASE_PROJECT_REF/SUPABASE_ACCESS_TOKEN/SUPABASE_DB_PASSWORD');
  // Pooler IPv4 em modo sessão (os executores do GitHub não têm IPv6 para db.<ref>.supabase.co).
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/database/pooler`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) fail(`Não foi possível obter o pooler do projeto: HTTP ${res.status}`);
  const pools = await res.json();
  const pool = (Array.isArray(pools) ? pools : [pools]).find((p) => p.database_type !== 'READ_REPLICA') ?? pools[0];
  const host = pool.db_host;
  const user = pool.db_user ?? `postgres.${ref}`;
  const db = pool.db_name ?? 'postgres';
  if (!host) fail('Resposta do pooler sem db_host');
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${db}`;
}

async function cmdImport(file) {
  const dump = JSON.parse(readFileSync(file, 'utf8'));
  const { default: postgres } = await import('postgres');
  const sql = postgres(await destinationUrl(), { max: 1, ssl: env('DEST_DB_SSL', 'require') === 'disable' ? false : 'require', onnotice: () => {} });

  const byName = new Map(dump.tables.map((t) => [`${t.schema}.${t.name}`, t]));
  const sourceEmails = (byName.get('auth.users')?.rows ?? []).map((u) => String(u.email ?? '').toLowerCase()).filter(Boolean);

  // Colunas graváveis do destino (sem colunas geradas)
  const columnsOf = async (db, schema, name) => {
    const rows = await db`
      SELECT a.attname AS col FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = ${schema} AND c.relname = ${name} AND a.attnum > 0
        AND NOT a.attisdropped ORDER BY a.attnum`;
    return rows.map((r) => r.col);
  };
  const generatedOf = async (db, schema, name) => {
    const rows = await db`
      SELECT a.attname AS col FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = ${schema} AND c.relname = ${name} AND a.attnum > 0 AND a.attgenerated <> ''`;
    return new Set(rows.map((r) => r.col));
  };

  await sql.begin(async (tx) => {
    await tx`SET LOCAL session_replication_role = replica`;
    await tx`SET LOCAL statement_timeout = 0`;

    // Instalação nova: zera public e remove contas recriadas com os mesmos e-mails (ex.: admin inicial).
    const publicTables = await tx`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
    if (publicTables.length) {
      await tx.unsafe(`TRUNCATE ${publicTables.map((t) => `public."${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
    }
    if (sourceEmails.length) {
      await tx`DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE lower(email) = ANY(${sourceEmails}))`;
      await tx`DELETE FROM auth.users WHERE lower(email) = ANY(${sourceEmails})`;
    }

    const order = [...dump.tables].sort((a, b) => (a.schema === 'auth' ? -1 : 0) - (b.schema === 'auth' ? -1 : 0));
    for (const t of order) {
      if (!t.rows.length) continue;
      const destCols = await columnsOf(tx, t.schema, t.name);
      if (!destCols.length) {
        console.log(`::warning::${t.schema}.${t.name} não existe no destino; ${t.rows.length} linhas ignoradas`);
        continue;
      }
      const generated = await generatedOf(tx, t.schema, t.name);
      const srcCols = new Set(t.rows.flatMap((r) => Object.keys(r)));
      const cols = destCols.filter((c) => srcCols.has(c) && !generated.has(c));
      const missing = [...srcCols].filter((c) => !destCols.includes(c));
      if (missing.length) console.log(`::warning::${t.schema}.${t.name}: colunas só na origem ignoradas: ${missing.join(', ')}`);
      const ident = `"${t.schema}"."${t.name}"`;
      const list = cols.map((c) => `"${c}"`).join(', ');
      for (let i = 0; i < t.rows.length; i += CHUNK) {
        const chunk = t.rows.slice(i, i + CHUNK);
        await tx.unsafe(
          `INSERT INTO ${ident} (${list}) SELECT ${list} FROM jsonb_populate_recordset(NULL::${ident}, $1::jsonb) ON CONFLICT DO NOTHING`,
          [tx.json(chunk)],
        );
      }
      console.log(`  ${t.schema}.${t.name}: ${t.rows.length}`);
    }

    // Sequências de colunas serial/identity após a carga
    const seqs = await tx`
      SELECT s.relname AS seq, n.nspname AS schema, t.relname AS tbl, a.attname AS col
      FROM pg_class s JOIN pg_depend d ON d.objid = s.oid AND d.deptype IN ('a','i')
      JOIN pg_class t ON t.oid = d.refobjid JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
      WHERE s.relkind = 'S' AND n.nspname = 'public'`;
    for (const s of seqs) {
      await tx.unsafe(
        `SELECT setval('"${s.schema}"."${s.seq}"', COALESCE((SELECT max("${s.col}") FROM "${s.schema}"."${s.tbl}"), 0) + 1, false)`,
      );
    }
  });

  // Proteção dos cadastros existentes (regra do projeto) + permissões que ela revoga.
  const locked = await sql`SELECT to_regclass('private.locked_profile_logins') IS NOT NULL AS ok`;
  if (locked[0].ok) {
    await sql`DROP TABLE IF EXISTS private.locked_profile_logins, private.locked_companies CASCADE`;
    await sql.unsafe(`DROP FUNCTION IF EXISTS private.protect_locked_profile_login() CASCADE; DROP FUNCTION IF EXISTS private.protect_locked_company() CASCADE;`);
  }
  await sql.unsafe(readFileSync(path.join(ROOT, 'drizzle/migrations/0000_snapshot_lock_existing_profiles_and_companies.sql'), 'utf8'));
  await sql.unsafe(readFileSync(path.join(ROOT, 'supabase/migrations/20261111000000_restore_rls_helper_execute.sql'), 'utf8'));

  // Conferência
  let ok = true;
  for (const t of dump.tables) {
    const [{ n }] = await sql.unsafe(`SELECT count(*)::int AS n FROM "${t.schema}"."${t.name}"`).catch(() => [{ n: -1 }]);
    if (n !== t.rows.length && t.rows.length) {
      ok = false;
      console.log(`::warning::${t.schema}.${t.name}: origem ${t.rows.length}, destino ${n}`);
    }
  }
  const [counts] = await sql`
    SELECT (SELECT count(*) FROM auth.users)::int AS users, (SELECT count(*) FROM public.profiles)::int AS profiles,
           (SELECT count(*) FROM public.companies)::int AS companies, (SELECT count(*) FROM public.time_records)::int AS records,
           (SELECT count(*) FROM private.locked_profile_logins)::int AS locked`;
  console.log(`Importado: ${counts.users} contas, ${counts.profiles} perfis, ${counts.companies} empresas, ${counts.records} marcações; ${counts.locked} cadastros protegidos.`);
  await sql.end();
  if (!ok) fail('Contagens divergentes entre origem e destino (veja os avisos acima)');
}

// ---------------------------------------------------------------- storage
async function cmdStorage() {
  const dest = env('DEST_URL').replace(/\/+$/, '');
  const key = env('DEST_SERVICE_ROLE_KEY');
  if (!dest || !key) fail('Defina DEST_URL e DEST_SERVICE_ROLE_KEY');
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const manifest = await source({ action: 'manifest' });
  let copied = 0, failed = 0;
  for (const bucket of manifest.buckets) {
    await fetch(`${dest}/storage/v1/bucket`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bucket.id, name: bucket.name, public: bucket.public }),
    });
    const queue = [''];
    while (queue.length) {
      const prefix = queue.shift();
      let offset = 0;
      for (;;) {
        const page = await source({ action: 'storage', bucket: bucket.id, prefix, offset });
        queue.push(...page.folders);
        for (const f of page.files) {
          try {
            const res = await fetch(f.url);
            if (!res.ok) throw new Error(`download HTTP ${res.status}`);
            const up = await fetch(`${dest}/storage/v1/object/${bucket.id}/${f.path.split('/').map(encodeURIComponent).join('/')}`, {
              method: 'POST',
              headers: { ...headers, 'Content-Type': f.content_type ?? res.headers.get('content-type') ?? 'application/octet-stream', 'x-upsert': 'true' },
              body: Buffer.from(await res.arrayBuffer()),
            });
            if (!up.ok) throw new Error(`upload HTTP ${up.status} ${await up.text()}`);
            copied++;
          } catch (e) {
            failed++;
            console.log(`::warning::${bucket.id}/${f.path}: ${e.message}`);
          }
        }
        if (!page.more) break;
        offset += 1000;
      }
    }
    console.log(`  bucket ${bucket.id} concluído`);
  }
  console.log(`Arquivos: ${copied} copiados, ${failed} falhas.`);
  if (failed) process.exitCode = 1;
}

const [cmd, file] = process.argv.slice(2);
const run = { export: () => cmdExport(file), import: () => cmdImport(file), storage: cmdStorage }[cmd];
if (!run || (cmd !== 'storage' && !file)) fail('Uso: migrate-from-lovable.mjs export|import <arquivo.json> | storage');
if (cmd !== 'import' && (!env('SOURCE_URL') || !env('MIGRATION_TOKEN'))) fail('Defina SOURCE_URL, SOURCE_ANON_KEY e MIGRATION_TOKEN');
run().catch((e) => fail(e.stack || e.message));
