-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "logo_updated_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "company_logos" (
    "company_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "company_logos_pkey" PRIMARY KEY ("company_id")
);

-- CreateIndex
CREATE INDEX "company_logos_tenant_id_idx" ON "company_logos"("tenant_id");

-- AddForeignKey
ALTER TABLE "company_logos" ADD CONSTRAINT "company_logos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "company_logos"
  ADD CONSTRAINT "company_logos_mime" CHECK ("mime" IN ('image/png', 'image/jpeg', 'image/webp')),
  ADD CONSTRAINT "company_logos_size" CHECK (octet_length("data") <= 524288);
ALTER TABLE "company_logos" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "company_logos" USING (app_bypass_rls() OR tenant_id = app_tenant_id()) WITH CHECK (app_bypass_rls() OR tenant_id = app_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "company_logos" TO superponto_app;
