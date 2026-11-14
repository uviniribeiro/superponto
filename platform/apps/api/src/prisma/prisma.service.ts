import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createPrismaClient, type Prisma, type PrismaClient } from '@superponto/database';
import { APP_CONFIG, type AppConfig } from '../config.js';

export type Tx = Prisma.TransactionClient;

/**
 * Acesso ao banco. A API conecta com o papel `superponto_app`, sujeito à RLS:
 *  - `forTenant()`: transação com `app.tenant_id` definido; o banco só expõe dados desse tenant.
 *  - `asPlatform()`: transação com RLS liberada; reservada a login, SuperAdmin e ingestão,
 *    sempre em código revisado e auditado.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = createPrismaClient(config.DATABASE_URL);
  }

  forTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    });
  }

  asPlatform<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      return fn(tx);
    });
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
