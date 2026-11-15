-- CNPJ alfanumérico (IN RFB nº 2.229/2024): 12 caracteres A-Z/0-9 + 2 dígitos verificadores.
-- O valor é guardado sem máscara e em maiúsculas; a API valida os dígitos verificadores.
-- CNPJs numéricos já cadastrados continuam válidos (são um caso particular do novo formato).

UPDATE "companies" SET "cnpj" = upper(regexp_replace("cnpj", '[\s./-]', '', 'g')) WHERE "cnpj" IS NOT NULL;
UPDATE "company_units" SET "cnpj" = upper(regexp_replace("cnpj", '[\s./-]', '', 'g')) WHERE "cnpj" IS NOT NULL;

ALTER TABLE "companies"
  ADD CONSTRAINT "companies_cnpj_format" CHECK ("cnpj" IS NULL OR "cnpj" ~ '^[0-9A-Z]{12}[0-9]{2}$');
ALTER TABLE "company_units"
  ADD CONSTRAINT "company_units_cnpj_format" CHECK ("cnpj" IS NULL OR "cnpj" ~ '^[0-9A-Z]{12}[0-9]{2}$');
