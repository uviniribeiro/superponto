-- CreateEnum
CREATE TYPE "leave_type" AS ENUM ('MEDICAL', 'VACATION', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNPAID', 'SUSPENSION', 'OTHER');

-- AlterEnum
ALTER TYPE "request_type" ADD VALUE 'OVERTIME_AUTHORIZATION';

-- AlterTable
ALTER TABLE "time_calculations" ADD COLUMN     "details" JSONB;

-- CreateTable
CREATE TABLE "justifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "disregards_debits" BOOLEAN NOT NULL DEFAULT true,
    "usage_limit" INTEGER,
    "limit_period" TEXT NOT NULL DEFAULT 'MONTH',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "justifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowances" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "justification_id" UUID NOT NULL,
    "full_day" BOOLEAN NOT NULL DEFAULT true,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allowances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaves" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "type" "leave_type" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "justification_id" UUID,
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "on_call_periods" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "on_call_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "expiration_days" INTEGER,
    "max_daily_credit_minutes" INTEGER,
    "credit_multipliers" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bank_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overtime_authorizations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "max_minutes" INTEGER NOT NULL,
    "request_id" UUID,
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "overtime_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "justifications_tenant_id_idx" ON "justifications"("tenant_id");

-- CreateIndex
CREATE INDEX "allowances_tenant_id_date_idx" ON "allowances"("tenant_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "allowances_employment_id_date_key" ON "allowances"("employment_id", "date");

-- CreateIndex
CREATE INDEX "leaves_tenant_id_employment_id_start_date_idx" ON "leaves"("tenant_id", "employment_id", "start_date");

-- CreateIndex
CREATE INDEX "on_call_periods_tenant_id_employment_id_date_idx" ON "on_call_periods"("tenant_id", "employment_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "bank_policies_company_id_key" ON "bank_policies"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "overtime_authorizations_employment_id_date_key" ON "overtime_authorizations"("employment_id", "date");

-- AddForeignKey
ALTER TABLE "allowances" ADD CONSTRAINT "allowances_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowances" ADD CONSTRAINT "allowances_justification_id_fkey" FOREIGN KEY ("justification_id") REFERENCES "justifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_justification_id_fkey" FOREIGN KEY ("justification_id") REFERENCES "justifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "on_call_periods" ADD CONSTRAINT "on_call_periods_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_policies" ADD CONSTRAINT "bank_policies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overtime_authorizations" ADD CONSTRAINT "overtime_authorizations_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras que o Prisma não expressa ------------------------------------------------------
CREATE UNIQUE INDEX "justifications_tenant_name" ON "justifications"("tenant_id", lower("name")) WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "justifications_tenant_code" ON "justifications"("tenant_id", lower("code")) WHERE "code" IS NOT NULL AND "deleted_at" IS NULL;
ALTER TABLE "justifications" ADD CONSTRAINT "justifications_limit" CHECK ("limit_period" IN ('MONTH', 'YEAR') AND ("usage_limit" IS NULL OR "usage_limit" > 0));
ALTER TABLE "allowances" ADD CONSTRAINT "allowances_minutes" CHECK (("full_day" AND "minutes" = 0) OR (NOT "full_day" AND "minutes" BETWEEN 1 AND 1440));
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_period" CHECK ("end_date" >= "start_date");
ALTER TABLE "on_call_periods" ADD CONSTRAINT "on_call_minutes" CHECK ("minutes" BETWEEN 1 AND 1440);
ALTER TABLE "bank_policies" ADD CONSTRAINT "bank_policies_limits" CHECK (("expiration_days" IS NULL OR "expiration_days" BETWEEN 1 AND 730) AND ("max_daily_credit_minutes" IS NULL OR "max_daily_credit_minutes" BETWEEN 1 AND 720));
ALTER TABLE "overtime_authorizations" ADD CONSTRAINT "overtime_authorizations_minutes" CHECK ("max_minutes" BETWEEN 1 AND 720);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['justifications','allowances','leaves','on_call_periods','bank_policies','overtime_authorizations'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (app_bypass_rls() OR tenant_id = app_tenant_id()) WITH CHECK (app_bypass_rls() OR tenant_id = app_tenant_id())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO superponto_app', t);
  END LOOP;
END $$;
