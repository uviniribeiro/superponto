-- Remove the unique constraint on CNPJ to allow sectors to share the same CNPJ as parent city hall
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_cnpj_key;