-- AlterTable
ALTER TABLE "time_records" ADD COLUMN     "rep_p_company_id" UUID,
ADD COLUMN     "rep_p_hash" TEXT,
ADD COLUMN     "rep_p_nsr" BIGINT;

-- CreateTable
CREATE TABLE "rep_p_registers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "inpi_number" TEXT,
    "last_nsr" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rep_p_registers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rep_p_registers_company_id_key" ON "rep_p_registers"("company_id");

-- CreateIndex
CREATE INDEX "rep_p_registers_tenant_id_idx" ON "rep_p_registers"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "time_records_rep_p_company_id_rep_p_nsr_key" ON "time_records"("rep_p_company_id", "rep_p_nsr");


-- Regras que o Prisma não expressa -------------------------------------------------------
ALTER TABLE "rep_p_registers" ADD CONSTRAINT "rep_p_registers_inpi" CHECK ("inpi_number" IS NULL OR "inpi_number" ~ '^[0-9]{17}$');
ALTER TABLE "time_records" ADD CONSTRAINT "time_records_rep_p" CHECK (("rep_p_nsr" IS NULL) = ("rep_p_company_id" IS NULL) AND ("rep_p_nsr" IS NULL) = ("rep_p_hash" IS NULL));
ALTER TABLE "rep_p_registers" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rep_p_registers" USING (app_bypass_rls() OR tenant_id = app_tenant_id()) WITH CHECK (app_bypass_rls() OR tenant_id = app_tenant_id());
GRANT SELECT, INSERT, UPDATE ON "rep_p_registers" TO superponto_app;
