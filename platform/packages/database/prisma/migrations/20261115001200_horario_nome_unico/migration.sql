-- DropIndex
DROP INDEX "work_schedules_company_id_name_key";

-- CreateIndex
CREATE INDEX "work_schedules_company_id_idx" ON "work_schedules"("company_id");


-- Nome do horário único por empresa, sem diferenciar maiúsculas; excluídos liberam o nome.
CREATE UNIQUE INDEX "work_schedules_company_name_ci" ON "work_schedules"("company_id", lower("name")) WHERE "deleted_at" IS NULL;
