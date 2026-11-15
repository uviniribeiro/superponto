-- CreateEnum
CREATE TYPE "holiday_scope" AS ENUM ('NATIONAL', 'STATE', 'MUNICIPAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "holiday_kind" AS ENUM ('HOLIDAY', 'OPTIONAL');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "city" TEXT,
ADD COLUMN     "complement" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "ibge_code" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "zip_code" TEXT;

-- CreateTable
CREATE TABLE "public_holidays" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "year" SMALLINT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "holiday_scope" NOT NULL,
    "kind" "holiday_kind" NOT NULL,
    "uf" TEXT NOT NULL DEFAULT '',
    "ibge" TEXT NOT NULL DEFAULT '',
    "basis" TEXT,
    "review" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_holiday_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "holiday_kind" NOT NULL DEFAULT 'HOLIDAY',
    "month" SMALLINT,
    "day" SMALLINT,
    "movable" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "company_holiday_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_holiday_overrides" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "workday" BOOLEAN NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_holiday_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "public_holidays_year_scope_uf_ibge_idx" ON "public_holidays"("year", "scope", "uf", "ibge");

-- CreateIndex
CREATE UNIQUE INDEX "public_holidays_date_scope_uf_ibge_name_key" ON "public_holidays"("date", "scope", "uf", "ibge", "name");

-- CreateIndex
CREATE INDEX "company_holiday_rules_tenant_id_company_id_idx" ON "company_holiday_rules"("tenant_id", "company_id");

-- CreateIndex
CREATE INDEX "company_holiday_overrides_tenant_id_company_id_idx" ON "company_holiday_overrides"("tenant_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_holiday_overrides_company_id_date_key" ON "company_holiday_overrides"("company_id", "date");

-- AddForeignKey
ALTER TABLE "company_holiday_rules" ADD CONSTRAINT "company_holiday_rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_holiday_overrides" ADD CONSTRAINT "company_holiday_overrides_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras que o Prisma não expressa ------------------------------------------------------

ALTER TABLE "companies"
  ADD CONSTRAINT "companies_zip_code_format" CHECK ("zip_code" IS NULL OR "zip_code" ~ '^\d{8}$'),
  ADD CONSTRAINT "companies_state_format" CHECK ("state" IS NULL OR "state" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "companies_ibge_format" CHECK ("ibge_code" IS NULL OR "ibge_code" ~ '^\d{7}$');

ALTER TABLE "company_holiday_rules"
  ADD CONSTRAINT "company_holiday_rules_date" CHECK (
    ("movable" IS NULL AND "month" BETWEEN 1 AND 12 AND "day" BETWEEN 1 AND 31)
    OR ("movable" IN ('CARNIVAL_MONDAY','CARNIVAL_TUESDAY','ASH_WEDNESDAY','GOOD_FRIDAY','CORPUS_CHRISTI') AND "month" IS NULL AND "day" IS NULL)
  );

-- Catálogo global: todos leem; só o modo plataforma (geração automática) escreve.
ALTER TABLE "public_holidays" ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_holidays_read ON "public_holidays" FOR SELECT USING (true);
CREATE POLICY public_holidays_write ON "public_holidays" FOR ALL USING (app_bypass_rls()) WITH CHECK (app_bypass_rls());

-- Regras e decisões da empresa: isolamento por cliente.
ALTER TABLE "company_holiday_rules" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "company_holiday_rules"
  USING (app_bypass_rls() OR tenant_id = app_tenant_id()) WITH CHECK (app_bypass_rls() OR tenant_id = app_tenant_id());
ALTER TABLE "company_holiday_overrides" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "company_holiday_overrides"
  USING (app_bypass_rls() OR tenant_id = app_tenant_id()) WITH CHECK (app_bypass_rls() OR tenant_id = app_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON "public_holidays", "company_holiday_rules", "company_holiday_overrides" TO superponto_app;
