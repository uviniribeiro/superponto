-- CreateEnum
CREATE TYPE "auth_source" AS ENUM ('LOCAL', 'LDAP');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "auth_source" "auth_source" NOT NULL DEFAULT 'LOCAL';

-- CreateTable
CREATE TABLE "tenant_ldap_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "url" TEXT NOT NULL,
    "start_tls" BOOLEAN NOT NULL DEFAULT false,
    "allow_insecure_tls" BOOLEAN NOT NULL DEFAULT false,
    "bind_dn" TEXT,
    "bind_password_enc" TEXT,
    "base_dn" TEXT NOT NULL,
    "user_filter" TEXT NOT NULL DEFAULT '(mail={email})',
    "timeout_ms" INTEGER NOT NULL DEFAULT 5000,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_ldap_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_ldap_configs_tenant_id_key" ON "tenant_ldap_configs"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_ldap_configs" ADD CONSTRAINT "tenant_ldap_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras que o Prisma não expressa ------------------------------------------------------
ALTER TABLE "tenant_ldap_configs" ADD CONSTRAINT "tenant_ldap_configs_url" CHECK ("url" ~* '^ldaps?://');
ALTER TABLE "tenant_ldap_configs" ADD CONSTRAINT "tenant_ldap_configs_timeout" CHECK ("timeout_ms" BETWEEN 1000 AND 30000);
-- Conta LDAP não guarda senha local (a senha é conferida no diretório do cliente).
ALTER TABLE "users" ADD CONSTRAINT "users_ldap_without_local_password" CHECK ("auth_source" = 'LOCAL' OR "password_hash" IS NULL);

ALTER TABLE "tenant_ldap_configs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_ldap_configs" USING (app_bypass_rls() OR tenant_id = app_tenant_id()) WITH CHECK (app_bypass_rls() OR tenant_id = app_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "tenant_ldap_configs" TO superponto_app;
