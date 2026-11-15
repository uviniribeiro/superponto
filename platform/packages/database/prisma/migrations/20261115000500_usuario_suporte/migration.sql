-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_support" BOOLEAN NOT NULL DEFAULT false;


-- No máximo um usuário de suporte por cliente.
CREATE UNIQUE INDEX "users_one_support_per_tenant" ON "users"("tenant_id") WHERE "is_support" AND "deleted_at" IS NULL;
