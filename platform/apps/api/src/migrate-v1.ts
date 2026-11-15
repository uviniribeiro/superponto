/**
 * Migração v1 → v2 pela linha de comando:
 *   DATABASE_URL=postgresql://dono@.../superponto node dist/migrate-v1.js backup.json [--apply]
 * Sem --apply só confere (nada é gravado) e mostra o que seria importado.
 * Use o usuário dono do banco (a migração cria clientes, por isso passa por cima da RLS).
 */
import { readFileSync } from 'node:fs';
import { createPrismaClient } from '@superponto/database';
import { importV1, type V1Backup } from './migration/v1-import.js';

const [file, flag] = process.argv.slice(2);
if (!file || !process.env.DATABASE_URL) {
  console.error('Uso: DATABASE_URL=... node dist/migrate-v1.js backup.json [--apply]');
  process.exit(2);
}
const backup = JSON.parse(readFileSync(file, 'utf8')) as V1Backup;
const db = createPrismaClient(process.env.DATABASE_URL);
try {
  const r = await importV1(db as never, backup, { dryRun: flag !== '--apply' });
  console.log(r.dryRun ? '== CONFERÊNCIA (nada foi gravado; rode com --apply para importar)' : '== IMPORTADO');
  for (const t of r.tenants) console.log(`  cliente ${t.status === 'created' ? 'novo' : 'já importado'}: ${t.name} (${t.slug})`);
  for (const [k, v] of Object.entries(r.counts)) console.log(`  ${k}: ${v}`);
  if (r.warnings.length) { console.log('Avisos:'); for (const w of r.warnings) console.log(`  - ${w}`); }
} catch (e) {
  console.error(`Falha: ${(e as Error).message.split('\n').filter(Boolean).slice(-2).join(' ')}`);
  process.exitCode = 1;
} finally {
  await (db as { $disconnect: () => Promise<void> }).$disconnect();
}
