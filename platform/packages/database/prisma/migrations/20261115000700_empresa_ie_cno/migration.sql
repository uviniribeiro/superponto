-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "cno" TEXT,
ADD COLUMN     "external_code" TEXT,
ADD COLUMN     "state_registration" TEXT;



ALTER TABLE "companies"
  ADD CONSTRAINT "companies_cno_format" CHECK ("cno" IS NULL OR "cno" ~ '^\d{12,14}$'),
  ADD CONSTRAINT "companies_state_registration_format" CHECK ("state_registration" IS NULL OR "state_registration" ~ '^(ISENTO|[0-9A-Z]{2,18})$');
