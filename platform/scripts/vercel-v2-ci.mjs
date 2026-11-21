#!/usr/bin/env node
// Build da v2 feito pela própria Vercel (projeto "superponto-v2", diretório raiz "platform"), a cada
// push na main — sem GitHub Actions:
//   1. compila os pacotes e a API
//   2. aplica as migrações da v2 (MIGRATION_DATABASE_URL: papel superponto_migrator, só o esquema
//      superponto) e roda o seed (perfis e o Super Admin irrevogável)
//   3. instala o Flutter (versão fixa) e compila o app web
//   4. monta .vercel/output (app estático + API como função), que a Vercel publica
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const FLUTTER_VERSION = process.env.FLUTTER_VERSION || '3.50.1';
const sh = (cmd, opts = {}) => {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
};

for (const pkg of ['br-docs', 'time-engine', 'rep-protocols', 'database', 'api']) sh(`npm run build -w @superponto/${pkg}`);

if (process.env.MIGRATION_DATABASE_URL) {
  sh('npx prisma migrate deploy', { cwd: path.join(root, 'packages/database'), env: { ...process.env, DATABASE_URL: process.env.MIGRATION_DATABASE_URL } });
  sh('node apps/api/dist/seed.js', { env: { ...process.env, DATABASE_URL: process.env.MIGRATION_DATABASE_URL, SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL || 'viniciusacacio1@gmail.com' } });
  // Clientes, empresas, usuários e senhas da v1 (mesmo banco) — só quando V1_IMPORT=dry|apply.
  sh('node scripts/v1-import-db.mjs');
} else {
  console.warn('MIGRATION_DATABASE_URL não definida: migrações da v2 não aplicadas neste build.');
}

const flutterDir = path.join(process.env.HOME || '/tmp', 'flutter-sdk');
if (!existsSync(path.join(flutterDir, 'bin/flutter'))) {
  sh(`git clone --depth 1 --branch ${FLUTTER_VERSION} https://github.com/flutter/flutter.git ${flutterDir}`);
}
const flutter = path.join(flutterDir, 'bin/flutter');
const app = path.join(root, 'flutter/app');
const env = { ...process.env, FLUTTER_SUPPRESS_ANALYTICS: 'true', PUB_CACHE: path.join(process.env.HOME || '/tmp', '.pub-cache') };
sh(`${flutter} config --no-analytics --enable-web`, { env });
sh(`${flutter} pub get`, { cwd: app, env });
// Motor gráfico (CanvasKit) publicado junto com o app: não depende do CDN do Google (redes de empresa costumam bloquear).
sh(`${flutter} build web --release --no-web-resources-cdn`, { cwd: app, env });

sh('node scripts/vercel-v2-build.mjs');
