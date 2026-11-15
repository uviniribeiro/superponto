-- AlterTable
ALTER TABLE "work_schedules" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "break_mobility_minutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "consider_holidays" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "entry_mobility_minutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "in_itinere_minutes" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "schedule_overrides" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "is_workday" BOOLEAN NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "break_start" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'AGENDADA',
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_overrides_tenant_id_date_idx" ON "schedule_overrides"("tenant_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_overrides_employment_id_date_key" ON "schedule_overrides"("employment_id", "date");

-- AddForeignKey
ALTER TABLE "schedule_overrides" ADD CONSTRAINT "schedule_overrides_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras que o Prisma não expressa ------------------------------------------------------
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_minutes" CHECK ("in_itinere_minutes" BETWEEN 0 AND 600 AND "entry_mobility_minutes" BETWEEN 0 AND 600 AND "break_mobility_minutes" BETWEEN 0 AND 600);
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_cycle" CHECK ("cycle_days" IS NULL OR "cycle_days" BETWEEN 2 AND 62);
CREATE UNIQUE INDEX "work_schedules_company_code" ON "work_schedules"("company_id", lower("code")) WHERE "code" IS NOT NULL AND "deleted_at" IS NULL;
ALTER TABLE "schedule_overrides" ADD CONSTRAINT "schedule_overrides_hours" CHECK (
  ("is_workday" = false AND "start_time" IS NULL AND "end_time" IS NULL)
  OR ("is_workday" = true AND "start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
ALTER TABLE "schedule_overrides" ADD CONSTRAINT "schedule_overrides_origin" CHECK ("origin" IN ('AGENDADA', 'TROCA'));
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_period" CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from");

ALTER TABLE "schedule_overrides" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "schedule_overrides" USING (app_bypass_rls() OR tenant_id = app_tenant_id()) WITH CHECK (app_bypass_rls() OR tenant_id = app_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "schedule_overrides" TO superponto_app;
