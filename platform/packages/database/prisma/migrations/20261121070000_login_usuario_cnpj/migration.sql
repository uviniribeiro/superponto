-- Login como na v1: usuário + CNPJ da empresa + senha. O usuário é único dentro do cliente (tenant);
-- o CNPJ identifica o cliente pela empresa cadastrada.
ALTER TABLE "users" ADD COLUMN "username" TEXT;
ALTER TABLE "users" ADD CONSTRAINT "users_username_format" CHECK ("username" IS NULL OR "username" ~ '^[a-z0-9][a-z0-9._-]{1,59}$');
CREATE UNIQUE INDEX "users_tenant_id_username_key" ON "users"("tenant_id", "username");
