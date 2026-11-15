-- AlterTable
ALTER TABLE "bank_policies" ADD COLUMN     "compensation_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "compensation_leftover" TEXT NOT NULL DEFAULT 'BANK',
ADD COLUMN     "compensation_period" TEXT NOT NULL DEFAULT 'WEEK';

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "agent_key_hash" TEXT,
ADD COLUMN     "alert_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "collect_interval_minutes" INTEGER,
ADD COLUMN     "group_name" TEXT,
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "model_name" TEXT,
ADD COLUMN     "rep_number" TEXT;

-- CreateTable
CREATE TABLE "device_roster" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "worker_id" TEXT NOT NULL,
    "name" TEXT,
    "registration" TEXT,
    "fingerprints" INTEGER NOT NULL DEFAULT 0,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_roster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_roster_device_id_worker_id_key" ON "device_roster"("device_id", "worker_id");

-- CreateIndex
CREATE UNIQUE INDEX "devices_agent_key_hash_key" ON "devices"("agent_key_hash");

-- AddForeignKey
ALTER TABLE "device_roster" ADD CONSTRAINT "device_roster_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Regras que o Prisma não expressa ------------------------------------------------------
ALTER TABLE "bank_policies" ADD CONSTRAINT "bank_policies_compensation" CHECK ("compensation_period" IN ('WEEK', 'MONTH') AND "compensation_leftover" IN ('BANK', 'PAY'));
ALTER TABLE "devices" ADD CONSTRAINT "devices_collect_interval" CHECK ("collect_interval_minutes" IS NULL OR "collect_interval_minutes" BETWEEN 5 AND 1440);
ALTER TABLE "devices" ADD CONSTRAINT "devices_rep_number" CHECK ("rep_number" IS NULL OR "rep_number" ~ '^[0-9]{17}$');
ALTER TABLE "device_roster" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "device_roster" USING (app_bypass_rls() OR tenant_id = app_tenant_id()) WITH CHECK (app_bypass_rls() OR tenant_id = app_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "device_roster" TO superponto_app;
