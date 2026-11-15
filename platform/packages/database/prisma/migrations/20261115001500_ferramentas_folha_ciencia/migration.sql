-- CreateTable
CREATE TABLE "notification_schedules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kinds" TEXT[],
    "time" TEXT NOT NULL,
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "recipients" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID,
    "grouping_id" UUID,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "require_ack" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcement_reads" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_devices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code_hash" TEXT,
    "code_expires" TIMESTAMPTZ(6),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "token_hash" TEXT,
    "approved_at" TIMESTAMPTZ(6),
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_texts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "custom_texts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_layouts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "events" JSONB NOT NULL,
    "separator" TEXT NOT NULL DEFAULT ';',
    "quantity_format" TEXT NOT NULL DEFAULT 'HHMM',
    "include_header" BOOLEAN NOT NULL DEFAULT true,
    "employee_key" TEXT NOT NULL DEFAULT 'MATRICULA',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "payroll_layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mirror_acknowledgments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "content_hash" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "decision" TEXT NOT NULL DEFAULT 'AGREE',
    "comment" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mirror_acknowledgments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_schedules_tenant_id_company_id_idx" ON "notification_schedules"("tenant_id", "company_id");

-- CreateIndex
CREATE INDEX "announcements_tenant_id_starts_at_idx" ON "announcements"("tenant_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_reads_announcement_id_user_id_key" ON "announcement_reads"("announcement_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_devices_token_hash_key" ON "app_devices"("token_hash");

-- CreateIndex
CREATE INDEX "app_devices_tenant_id_user_id_idx" ON "app_devices"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_texts_tenant_id_key_key" ON "custom_texts"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "payroll_layouts_tenant_id_company_id_idx" ON "payroll_layouts"("tenant_id", "company_id");

-- CreateIndex
CREATE INDEX "mirror_acknowledgments_tenant_id_period_start_idx" ON "mirror_acknowledgments"("tenant_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "mirror_acknowledgments_employment_id_period_start_period_en_key" ON "mirror_acknowledgments"("employment_id", "period_start", "period_end");

-- AddForeignKey
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Regras que o Prisma não expressa ------------------------------------------------------
ALTER TABLE "notification_schedules" ADD CONSTRAINT "notification_schedules_time" CHECK ("time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND cardinality("recipients") BETWEEN 1 AND 20 AND "weekdays" <@ ARRAY[0,1,2,3,4,5,6]);
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_level" CHECK ("level" IN ('INFO', 'IMPORTANT') AND ("ends_at" IS NULL OR "ends_at" > "starts_at"));
ALTER TABLE "payroll_layouts" ADD CONSTRAINT "payroll_layouts_opts" CHECK ("separator" IN (';', ',', '|', 'TAB') AND "quantity_format" IN ('HHMM', 'DECIMAL', 'MINUTES') AND "employee_key" IN ('MATRICULA', 'CPF'));
CREATE UNIQUE INDEX "payroll_layouts_company_name" ON "payroll_layouts"("company_id", lower("name")) WHERE "deleted_at" IS NULL;
ALTER TABLE "mirror_acknowledgments" ADD CONSTRAINT "mirror_acknowledgments_decision" CHECK ("decision" IN ('AGREE', 'DISAGREE'));
-- Ciência do espelho é prova: não muda nem some.
CREATE TRIGGER mirror_acknowledgments_immutable BEFORE UPDATE OR DELETE ON "mirror_acknowledgments" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['notification_schedules','announcements','announcement_reads','app_devices','custom_texts','payroll_layouts','mirror_acknowledgments'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (app_bypass_rls() OR tenant_id = app_tenant_id()) WITH CHECK (app_bypass_rls() OR tenant_id = app_tenant_id())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO superponto_app', t);
  END LOOP;
END $$;
