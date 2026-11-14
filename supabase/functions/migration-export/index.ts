// Exportação TEMPORÁRIA de dados para migrar do Lovable Cloud para o projeto Supabase próprio.
//
// Segurança:
//  - exige o cabeçalho x-migration-token; aqui fica apenas o SHA-256 do token;
//  - expira sozinha em EXPIRES_AT, mesmo que não seja removida;
//  - somente leitura: lê tabelas do esquema public, auth.users/auth.identities e gera links
//    temporários (1 hora) dos arquivos do Storage.
// Remover esta função assim que a migração for concluída.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const TOKEN_SHA256 = "d50f2a31379501360cb88960a710bbba8c57e8696a89b9043b305373dfc621d7";
const EXPIRES_AT = Date.parse("2026-11-28T00:00:00Z");
const AUTH_TABLES = ["users", "identities"];
const MAX_LIMIT = 2000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  if (Date.now() > EXPIRES_AT) return json({ error: "Exportação expirada" }, 410);
  const token = req.headers.get("x-migration-token") ?? "";
  if (!safeEqual(await sha256(token), TOKEN_SHA256)) return json({ error: "Não autorizado" }, 401);

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return json({ error: "SUPABASE_DB_URL indisponível neste ambiente" }, 500);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* sem corpo */ }
  const action = String(body.action ?? "manifest");

  if (action === "storage") {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const bucket = String(body.bucket ?? "");
    const prefix = String(body.prefix ?? "");
    const offset = Number(body.offset ?? 0);
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) return json({ error: error.message }, 400);
    const files = (data ?? []).filter((f) => f.id);
    const folders = (data ?? []).filter((f) => !f.id).map((f) => (prefix ? `${prefix}/` : "") + f.name);
    const paths = files.map((f) => (prefix ? `${prefix}/` : "") + f.name);
    const signed = paths.length
      ? (await admin.storage.from(bucket).createSignedUrls(paths, 3600)).data ?? []
      : [];
    return json({
      folders,
      files: files.map((f, i) => ({
        path: paths[i],
        content_type: (f.metadata as Record<string, string> | null)?.mimetype ?? null,
        url: signed[i]?.signedUrl ?? null,
      })),
      more: (data ?? []).length === 1000,
    });
  }

  const client = new Client(dbUrl);
  await client.connect();
  try {
    if (action === "manifest") {
      const tables = await client.queryObject<{ schema: string; name: string; rows: number }>(`
        SELECT n.nspname AS schema, c.relname AS name, 0 AS rows
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','p')
          AND (n.nspname = 'public' OR (n.nspname = 'auth' AND c.relname = ANY($1)))
        ORDER BY n.nspname, c.relname`, [AUTH_TABLES]);
      const out = [];
      for (const t of tables.rows) {
        const count = await client.queryObject<{ n: bigint }>(
          `SELECT count(*) AS n FROM "${t.schema}"."${t.name.replace(/"/g, '""')}"`,
        );
        out.push({ schema: t.schema, name: t.name, rows: Number(count.rows[0].n) });
      }
      const buckets = await client.queryObject<{ id: string; name: string; public: boolean }>(
        "SELECT id, name, public FROM storage.buckets ORDER BY id",
      );
      return json({ tables: out, buckets: buckets.rows });
    }

    if (action === "rows") {
      const schema = String(body.schema ?? "");
      const table = String(body.table ?? "");
      const offset = Math.max(0, Number(body.offset ?? 0));
      const limit = Math.min(MAX_LIMIT, Math.max(1, Number(body.limit ?? 500)));
      // Só tabelas que existem no catálogo e estão no escopo da exportação.
      const allowed = await client.queryObject<{ ok: boolean }>(`
        SELECT true AS ok FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','p') AND c.relname = $2 AND n.nspname = $1
          AND (n.nspname = 'public' OR (n.nspname = 'auth' AND c.relname = ANY($3)))`,
        [schema, table, AUTH_TABLES]);
      if (!allowed.rows.length) return json({ error: "Tabela fora do escopo" }, 400);
      const ident = `"${schema}"."${table.replace(/"/g, '""')}"`;
      const result = await client.queryObject<{ row: unknown }>(
        `SELECT to_jsonb(t) AS row FROM ${ident} t ORDER BY ctid OFFSET $1 LIMIT $2`,
        [offset, limit],
      );
      return json({ rows: result.rows.map((r) => r.row) });
    }

    return json({ error: "Ação inválida" }, 400);
  } finally {
    await client.end();
  }
});
