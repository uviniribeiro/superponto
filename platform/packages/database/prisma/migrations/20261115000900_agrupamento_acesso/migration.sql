-- AlterTable
ALTER TABLE "users" ADD COLUMN     "access_weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "groupings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "groupings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grouping_employments" (
    "grouping_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,

    CONSTRAINT "grouping_employments_pkey" PRIMARY KEY ("grouping_id","employment_id")
);

-- CreateTable
CREATE TABLE "grouping_positions" (
    "grouping_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,

    CONSTRAINT "grouping_positions_pkey" PRIMARY KEY ("grouping_id","position_id")
);

-- CreateTable
CREATE TABLE "grouping_units" (
    "grouping_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,

    CONSTRAINT "grouping_units_pkey" PRIMARY KEY ("grouping_id","unit_id")
);

-- CreateTable
CREATE TABLE "user_access_blocks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_access_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "groupings_tenant_id_idx" ON "groupings"("tenant_id");

-- CreateIndex
CREATE INDEX "grouping_employments_tenant_id_employment_id_idx" ON "grouping_employments"("tenant_id", "employment_id");

-- CreateIndex
CREATE INDEX "user_access_blocks_tenant_id_user_id_idx" ON "user_access_blocks"("tenant_id", "user_id");

-- AddForeignKey
ALTER TABLE "grouping_employments" ADD CONSTRAINT "grouping_employments_grouping_id_fkey" FOREIGN KEY ("grouping_id") REFERENCES "groupings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grouping_employments" ADD CONSTRAINT "grouping_employments_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grouping_positions" ADD CONSTRAINT "grouping_positions_grouping_id_fkey" FOREIGN KEY ("grouping_id") REFERENCES "groupings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grouping_positions" ADD CONSTRAINT "grouping_positions_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "job_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grouping_units" ADD CONSTRAINT "grouping_units_grouping_id_fkey" FOREIGN KEY ("grouping_id") REFERENCES "groupings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grouping_units" ADD CONSTRAINT "grouping_units_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "company_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_access_blocks" ADD CONSTRAINT "user_access_blocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Regras que o Prisma não expressa ------------------------------------------------------
CREATE UNIQUE INDEX "groupings_tenant_name" ON "groupings"("tenant_id", lower("name")) WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "groupings_tenant_code" ON "groupings"("tenant_id", lower("code")) WHERE "code" IS NOT NULL AND "deleted_at" IS NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_access_weekdays" CHECK ("access_weekdays" <@ ARRAY[0,1,2,3,4,5,6]);
ALTER TABLE "user_access_blocks" ADD CONSTRAINT "user_access_blocks_period" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at");

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['groupings','grouping_employments','grouping_positions','grouping_units','user_access_blocks'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (app_bypass_rls() OR tenant_id = app_tenant_id()) WITH CHECK (app_bypass_rls() OR tenant_id = app_tenant_id())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO superponto_app', t);
  END LOOP;
END $$;
