-- CreateEnum
CREATE TYPE "union_entity_type" AS ENUM ('SINDICATO', 'FEDERACAO', 'CONFEDERACAO', 'CENTRAL');

-- CreateEnum
CREATE TYPE "union_side" AS ENUM ('EMPREGADOS', 'EMPREGADORES');

-- AlterTable
ALTER TABLE "employment_relationships" ADD COLUMN     "cost_center_id" UUID,
ADD COLUMN     "employee_type_id" UUID,
ADD COLUMN     "function_id" UUID,
ADD COLUMN     "sector_id" UUID,
ADD COLUMN     "union_id" UUID;

-- CreateTable
CREATE TABLE "job_functions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "job_functions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employee_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_unions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "acronym" TEXT NOT NULL,
    "cnpj" TEXT,
    "entity_type" "union_entity_type" NOT NULL DEFAULT 'SINDICATO',
    "side" "union_side" NOT NULL DEFAULT 'EMPREGADOS',
    "base_month" SMALLINT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "labor_unions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "competences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_functions_tenant_id_idx" ON "job_functions"("tenant_id");

-- CreateIndex
CREATE INDEX "cost_centers_tenant_id_idx" ON "cost_centers"("tenant_id");

-- CreateIndex
CREATE INDEX "employee_types_tenant_id_idx" ON "employee_types"("tenant_id");

-- CreateIndex
CREATE INDEX "labor_unions_tenant_id_idx" ON "labor_unions"("tenant_id");

-- CreateIndex
CREATE INDEX "competences_tenant_id_starts_on_idx" ON "competences"("tenant_id", "starts_on");

-- AddForeignKey
ALTER TABLE "employment_relationships" ADD CONSTRAINT "employment_relationships_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_relationships" ADD CONSTRAINT "employment_relationships_function_id_fkey" FOREIGN KEY ("function_id") REFERENCES "job_functions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_relationships" ADD CONSTRAINT "employment_relationships_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_relationships" ADD CONSTRAINT "employment_relationships_employee_type_id_fkey" FOREIGN KEY ("employee_type_id") REFERENCES "employee_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_relationships" ADD CONSTRAINT "employment_relationships_union_id_fkey" FOREIGN KEY ("union_id") REFERENCES "labor_unions"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Regras que o Prisma não expressa ------------------------------------------------------

-- Código e nome únicos por cliente entre os registros ativos (exclusão é lógica).
CREATE UNIQUE INDEX "job_functions_tenant_code" ON "job_functions"("tenant_id", lower("code")) WHERE "code" IS NOT NULL AND "deleted_at" IS NULL;
CREATE UNIQUE INDEX "job_functions_tenant_name" ON "job_functions"("tenant_id", lower("name")) WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "cost_centers_tenant_code" ON "cost_centers"("tenant_id", lower("code")) WHERE "code" IS NOT NULL AND "deleted_at" IS NULL;
CREATE UNIQUE INDEX "cost_centers_tenant_name" ON "cost_centers"("tenant_id", lower("name")) WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "employee_types_tenant_code" ON "employee_types"("tenant_id", lower("code")) WHERE "code" IS NOT NULL AND "deleted_at" IS NULL;
CREATE UNIQUE INDEX "employee_types_tenant_name" ON "employee_types"("tenant_id", lower("name")) WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "labor_unions_tenant_acronym" ON "labor_unions"("tenant_id", lower("acronym")) WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "competences_tenant_name" ON "competences"("tenant_id", lower("name")) WHERE "deleted_at" IS NULL;

ALTER TABLE "competences" ADD CONSTRAINT "competences_period" CHECK ("ends_on" >= "starts_on");
ALTER TABLE "labor_unions" ADD CONSTRAINT "labor_unions_cnpj_format" CHECK ("cnpj" IS NULL OR "cnpj" ~ '^[0-9A-Z]{12}[0-9]{2}$');
ALTER TABLE "labor_unions" ADD CONSTRAINT "labor_unions_base_month" CHECK ("base_month" IS NULL OR "base_month" BETWEEN 1 AND 12);

-- Isolamento por cliente.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['job_functions','cost_centers','employee_types','labor_unions','competences'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (app_bypass_rls() OR tenant_id = app_tenant_id()) WITH CHECK (app_bypass_rls() OR tenant_id = app_tenant_id())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO superponto_app', t);
  END LOOP;
END $$;
