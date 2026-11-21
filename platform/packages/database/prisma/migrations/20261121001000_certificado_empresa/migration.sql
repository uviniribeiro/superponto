-- Certificado digital ICP-Brasil (A1, arquivo PFX) da empresa, usado para assinar o AFD do REP-P e o
-- AEJ no padrão CAdES (arquivo .p7s destacado). O PFX e a senha ficam cifrados (AES-256-GCM, chave
-- SECRETS_ENCRYPTION_KEY da API); o banco nunca vê a chave privada em claro.
CREATE TABLE "company_certificates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "pfx_enc" TEXT NOT NULL,
    "password_enc" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "not_before" TIMESTAMPTZ(6) NOT NULL,
    "not_after" TIMESTAMPTZ(6) NOT NULL,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "company_certificates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_certificates_company_id_key" ON "company_certificates"("company_id");
CREATE INDEX "company_certificates_tenant_id_idx" ON "company_certificates"("tenant_id");
ALTER TABLE "company_certificates" ADD CONSTRAINT "company_certificates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_certificates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "company_certificates" USING (app_bypass_rls() OR tenant_id = app_tenant_id()) WITH CHECK (app_bypass_rls() OR tenant_id = app_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "company_certificates" TO superponto_app;
