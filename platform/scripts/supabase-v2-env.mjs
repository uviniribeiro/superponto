#!/usr/bin/env node
// Prepara as variáveis da v2 hospedada (Vercel + banco no mesmo projeto Supabase da v1, esquema
// "superponto"). Escreve em $GITHUB_ENV (mascarando os valores):
//   MIGRATION_DATABASE_URL  papel dono (postgres) pelo pooler em modo sessão, para as migrações
//   DATABASE_URL            papel superponto_api (sujeito às regras de isolamento), para a API
//   API_DB_PASSWORD, JWT_SECRET, MFA_ENCRYPTION_KEY, BIOMETRIC_ENCRYPTION_KEY, SECRETS_ENCRYPTION_KEY
// As chaves são derivadas da senha do banco (HMAC) para serem sempre as mesmas a cada publicação,
// sem cadastrar secrets novos; um secret V2_<NOME> com valor próprio tem prioridade.
import { createHmac } from 'node:crypto';
import { appendFileSync } from 'node:fs';

const env = (k) => process.env[k]?.trim() ?? '';
const ref = env('SUPABASE_PROJECT_REF');
const token = env('SUPABASE_ACCESS_TOKEN');
const dbPassword = env('SUPABASE_DB_PASSWORD');
if (!ref || !token || !dbPassword) throw new Error('Defina SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN e SUPABASE_DB_PASSWORD');

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/database/pooler`, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) throw new Error(`Supabase (pooler): HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
const list = await res.json();
const pooler = (Array.isArray(list) ? list : [list]).find((p) => p?.db_host) ?? null;
if (!pooler) throw new Error('Supabase não informou o endereço do pooler');
const host = pooler.db_host;

const derive = (label, bytes = 32) => createHmac('sha256', dbPassword).update(`superponto-v2:${label}`).digest().subarray(0, bytes).toString('base64');
const pick = (name, fallback) => env(`V2_${name}`) || fallback;
const enc = encodeURIComponent;
const apiPassword = pick('API_DB_PASSWORD', derive('api-db-password').replace(/[^A-Za-z0-9]/g, '') + 'Aa1');
const out = {
  // Modo sessão (porta 5432): migrações e a API usam transações e set_config por transação.
  MIGRATION_DATABASE_URL: `postgresql://postgres.${ref}:${enc(dbPassword)}@${host}:5432/postgres?schema=superponto`,
  DATABASE_URL: `postgresql://superponto_api.${ref}:${enc(apiPassword)}@${host}:5432/postgres?schema=superponto`,
  API_DB_PASSWORD: apiPassword,
  JWT_SECRET: pick('JWT_SECRET', derive('jwt', 48)),
  MFA_ENCRYPTION_KEY: pick('MFA_ENCRYPTION_KEY', derive('mfa')),
  BIOMETRIC_ENCRYPTION_KEY: pick('BIOMETRIC_ENCRYPTION_KEY', derive('biometric')),
  SECRETS_ENCRYPTION_KEY: pick('SECRETS_ENCRYPTION_KEY', derive('secrets')),
};
const file = env('GITHUB_ENV');
for (const [k, v] of Object.entries(out)) {
  console.log(`::add-mask::${v}`);
  if (file) appendFileSync(file, `${k}=${v}\n`);
}
console.log(`Banco da v2: projeto ${ref}, pooler ${host} (modo sessão), esquema superponto.`);
