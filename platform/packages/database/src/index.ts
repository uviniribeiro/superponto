import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';

export * from './generated/client.js';

/** Cria o cliente Prisma com o driver `pg` (Prisma 7). */
export function createPrismaClient(connectionString: string) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
