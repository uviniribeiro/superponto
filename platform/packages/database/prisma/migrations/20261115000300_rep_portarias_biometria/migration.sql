-- CreateEnum
CREATE TYPE "rep_ordinance" AS ENUM ('P1510_2009', 'P373_2011', 'P671_2021');

-- CreateEnum
CREATE TYPE "biometric_format" AS ENUM ('ISO_19794_2', 'ANSI_378', 'CONTROLID', 'HENRY', 'OTHER');

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "ordinance" "rep_ordinance",
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

-- CreateTable
CREATE TABLE "biometric_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "finger" SMALLINT NOT NULL,
    "format" "biometric_format" NOT NULL,
    "template_enc" TEXT NOT NULL,
    "template_sha256" TEXT NOT NULL,
    "quality" SMALLINT,
    "captured_device_id" UUID,
    "captured_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "biometric_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "biometric_templates_tenant_id_employment_id_idx" ON "biometric_templates"("tenant_id", "employment_id");

-- AddForeignKey
ALTER TABLE "biometric_templates" ADD CONSTRAINT "biometric_templates_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_templates" ADD CONSTRAINT "biometric_templates_captured_device_id_fkey" FOREIGN KEY ("captured_device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Regras que o Prisma não expressa ------------------------------------------------------

-- Dedo válido, hash no formato hex e no máximo uma digital ativa por dedo e formato.
ALTER TABLE "biometric_templates"
  ADD CONSTRAINT "biometric_templates_finger_range" CHECK ("finger" BETWEEN 0 AND 9),
  ADD CONSTRAINT "biometric_templates_sha256_format" CHECK ("template_sha256" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "biometric_templates_quality_range" CHECK ("quality" IS NULL OR "quality" BETWEEN 0 AND 100);
CREATE UNIQUE INDEX "biometric_templates_active_finger" ON "biometric_templates"("tenant_id", "employment_id", "finger", "format") WHERE "revoked_at" IS NULL;

-- O template cifrado nunca é alterado: uma nova captura revoga a anterior e cria outra linha.
CREATE OR REPLACE FUNCTION biometric_templates_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.template_enc <> OLD.template_enc OR NEW.template_sha256 <> OLD.template_sha256
     OR NEW.employment_id <> OLD.employment_id OR NEW.tenant_id <> OLD.tenant_id THEN
    RAISE EXCEPTION 'Digital não pode ser alterada; revogue e cadastre outra';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER biometric_templates_guard BEFORE UPDATE ON "biometric_templates"
  FOR EACH ROW EXECUTE FUNCTION biometric_templates_guard();

-- Isolamento por cliente (mesmo padrão das demais tabelas).
ALTER TABLE "biometric_templates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "biometric_templates"
  USING (app_bypass_rls() OR tenant_id = app_tenant_id())
  WITH CHECK (app_bypass_rls() OR tenant_id = app_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "biometric_templates" TO superponto_app;
