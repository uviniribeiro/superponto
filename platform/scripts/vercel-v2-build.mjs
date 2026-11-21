#!/usr/bin/env node
// Monta a v2 para a Vercel no formato "Build Output API v3" (.vercel/output), publicado com
// `vercel deploy --prebuilt`:
//   - static/        app Flutter web (mesma origem da API)
//   - functions/api  API (a mesma aplicação Nest dos testes de contrato), empacotada com esbuild
// Pré-requisitos: pacotes e API compilados (npm run build -w ...) e `flutter build web` feito.
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, '.vercel/output');
const web = path.join(root, 'flutter/app/build/web');
const entry = path.join(root, 'apps/api/dist/serverless.js');
for (const [p, hint] of [[web, 'flutter build web'], [entry, 'npm run build -w @superponto/api']]) {
  if (!existsSync(p)) throw new Error(`Falta ${path.relative(root, p)} (rode ${hint})`);
}

rmSync(out, { recursive: true, force: true });
cpSync(web, path.join(out, 'static'), { recursive: true });

const fn = path.join(out, 'functions/api.func');
mkdirSync(fn, { recursive: true });
// Módulos opcionais do Nest (carregados só se instalados) ficam de fora do pacote.
const optional = [
  '@nestjs/microservices', '@nestjs/microservices/*', '@nestjs/websockets', '@nestjs/websockets/*',
  'class-transformer', 'class-transformer/*', 'class-validator', '@fastify/*', 'fastify', 'swagger-ui-dist',
  'pg-native', 'cpu-features', 'ssh2',
];
await build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: path.join(fn, 'index.mjs'),
  external: optional,
  // Dependências CommonJS empacotadas em ESM ainda usam require/__dirname.
  banner: { js: "import { createRequire as __cr } from 'node:module'; import { fileURLToPath as __fu } from 'node:url'; import { dirname as __dn } from 'node:path'; const require = __cr(import.meta.url); const __filename = __fu(import.meta.url); const __dirname = __dn(__filename);" },
  logLevel: 'warning',
  legalComments: 'none',
});
// Página da documentação (/docs) lê os arquivos do swagger-ui-dist do disco.
const req = createRequire(path.join(root, 'apps/api/package.json'));
const swaggerDir = path.dirname(req.resolve('swagger-ui-dist/package.json'));
cpSync(swaggerDir, path.join(fn, 'node_modules/swagger-ui-dist'), { recursive: true });
writeFileSync(path.join(fn, 'package.json'), JSON.stringify({ type: 'module' }));
writeFileSync(path.join(fn, '.vc-config.json'), JSON.stringify({
  runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 60, memory: 1024,
}, null, 2));

writeFileSync(path.join(out, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { src: '^/(v1|docs|docs-json|health)(/.*)?$', dest: '/api' },
    { handle: 'filesystem' },
    { src: '/(.*)', dest: '/index.html' },
  ],
}, null, 2));
console.log(`Saída da Vercel pronta em ${path.relative(process.cwd(), out)}`);
