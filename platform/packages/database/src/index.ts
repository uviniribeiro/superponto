import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';

export * from './generated/client.js';

/** Esquema da v2 (não publicado pela API REST do Supabase; o mesmo numa VPS). */
export const DEFAULT_SCHEMA = 'superponto';

/**
 * Cliente Prisma com o driver `pg` (Prisma 7). O esquema vale para as consultas geradas e, via
 * search_path, para o SQL direto. Funciona igual no Supabase (pooler em modo sessão) e numa VPS.
 */
export function createPrismaClient(connectionString: string, schema = schemaFromUrl(connectionString)) {
  const url = new URL(connectionString);
  url.searchParams.delete('schema');
  const adapter = new PrismaPg(
    { connectionString: url.toString(), options: `-c search_path=${schema},public` },
    { schema },
  );
  return new PrismaClient({ adapter });
}

export function schemaFromUrl(connectionString: string): string {
  return new URL(connectionString).searchParams.get('schema') ?? DEFAULT_SCHEMA;
}
