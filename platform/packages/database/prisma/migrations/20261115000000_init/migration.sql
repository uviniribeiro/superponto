-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "company_segment" AS ENUM ('GENERAL', 'EDUCATION', 'HEALTH', 'PUBLIC_SECTOR', 'INDUSTRY', 'RETAIL', 'SERVICES');

-- CreateEnum
CREATE TYPE "unit_type" AS ENUM ('HEADQUARTERS', 'BRANCH', 'SCHOOL', 'HOSPITAL', 'CLINIC', 'UPA', 'UBS', 'LABORATORY', 'OFFICE', 'OPERATIONAL_SITE', 'OTHER');

-- CreateEnum
CREATE TYPE "person_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "employment_status" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "contract_type" AS ENUM ('CLT', 'STATUTORY', 'TEMPORARY', 'INTERN', 'APPRENTICE', 'CONTRACTOR', 'SERVICE_PROVIDER', 'VOLUNTEER', 'OTHER');

-- CreateEnum
CREATE TYPE "professional_category" AS ENUM ('GENERAL', 'TEACHER', 'PHYSICIAN', 'NURSE', 'NURSING_TECHNICIAN', 'NURSING_ASSISTANT', 'PHYSIOTHERAPIST', 'PSYCHOLOGIST', 'PHARMACIST', 'DENTIST', 'NUTRITIONIST', 'SOCIAL_WORKER', 'OTHER_HEALTH');

-- CreateEnum
CREATE TYPE "schedule_type" AS ENUM ('FIXED', 'FLEXIBLE', 'SHIFT_12X36', 'SHIFT_6X1', 'SHIFT_5X2', 'SHIFT_4X2', 'ROTATING', 'CUSTOM', 'ON_CALL', 'TEACHING');

-- CreateEnum
CREATE TYPE "time_record_type" AS ENUM ('ENTRY', 'BREAK_START', 'BREAK_END', 'EXIT', 'EXTRA', 'UNCLASSIFIED');

-- CreateEnum
CREATE TYPE "time_record_source" AS ENUM ('WEB', 'MOBILE', 'KIOSK', 'DEVICE', 'COMMUNICATION_SERVER', 'IMPORT', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "adjustment_kind" AS ENUM ('INCLUDE', 'DISREGARD', 'RECLASSIFY');

-- CreateEnum
CREATE TYPE "approval_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_INFO', 'CANCELLED');

-- CreateEnum
CREATE TYPE "request_type" AS ENUM ('RECORD_CORRECTION', 'ABSENCE_JUSTIFICATION', 'SCHEDULE_ADJUSTMENT', 'COMPENSATION', 'ALLOWANCE', 'SCHEDULE_CHANGE', 'OTHER');

-- CreateEnum
CREATE TYPE "occurrence_type" AS ENUM ('ABSENCE', 'LATE', 'EARLY_LEAVE', 'MISSING_RECORD', 'OVERTIME', 'INSUFFICIENT_BREAK', 'UNCOVERED_SHIFT', 'SHIFT_NOT_STARTED', 'SHIFT_NOT_CLOSED', 'SCHEDULE_CONFLICT', 'INCOMPLETE_TEAM', 'OPERATIONAL_ISSUE', 'PROFESSIONAL_SWAP', 'SCHEDULE_CHANGE', 'EQUIPMENT_UNAVAILABLE', 'OTHER');

-- CreateEnum
CREATE TYPE "occurrence_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "bank_hour_transaction_type" AS ENUM ('CREDIT', 'DEBIT', 'COMPENSATION', 'ADJUSTMENT', 'PAYOUT', 'EXPIRATION');

-- CreateEnum
CREATE TYPE "closing_status" AS ENUM ('OPEN', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "shift_kind" AS ENUM ('DAY', 'NIGHT', 'H12', 'H24', 'ON_CALL', 'EXTRA', 'COVERAGE');

-- CreateEnum
CREATE TYPE "shift_assignment_status" AS ENUM ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'ABSENT', 'SUBSTITUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "class_session_status" AS ENUM ('SCHEDULED', 'HELD', 'NOT_HELD', 'SUBSTITUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "calendar_event_type" AS ENUM ('HOLIDAY', 'RECESS', 'SCHOOL_VACATION', 'ACADEMIC_TERM', 'MEETING', 'PLANNING_DAY', 'EVENT', 'OPTIONAL_DAY');

-- CreateEnum
CREATE TYPE "device_category" AS ENUM ('TIME_CLOCK', 'BIOMETRIC_READER', 'FINGERPRINT_READER', 'FACIAL_RECOGNITION', 'RFID_READER', 'CARD_READER', 'ACCESS_CONTROLLER', 'TURNSTILE', 'GATE', 'ELECTRONIC_LOCK', 'DOOR_CONTROLLER', 'IDENTIFICATION_TERMINAL');

-- CreateEnum
CREATE TYPE "device_status" AS ENUM ('PENDING', 'ONLINE', 'OFFLINE', 'ERROR', 'DISABLED');

-- CreateEnum
CREATE TYPE "homologation_status" AS ENUM ('NOT_TESTED', 'IN_TESTING', 'HOMOLOGATED', 'PARTIAL', 'REJECTED');

-- CreateEnum
CREATE TYPE "device_identifier_type" AS ENUM ('REGISTRATION', 'CARD', 'RFID', 'PIN', 'BIOMETRIC_REFERENCE', 'FACIAL_REFERENCE');

-- CreateEnum
CREATE TYPE "device_event_kind" AS ENUM ('TIME_RECORD', 'ACCESS_GRANTED', 'ACCESS_DENIED', 'DOOR_OPENED', 'TURNSTILE_PASS', 'STATUS', 'ALARM', 'OTHER');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "server_status" AS ENUM ('PENDING', 'ONLINE', 'DEGRADED', 'OFFLINE', 'DISABLED');

-- CreateEnum
CREATE TYPE "permission_scope" AS ENUM ('PLATFORM', 'TENANT', 'COMPANY', 'UNIT', 'DEPARTMENT', 'SELF');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('IN_APP', 'EMAIL', 'WHATSAPP', 'PUSH');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'APPROVE', 'REJECT', 'EXPORT', 'CLOSE_PERIOD', 'REOPEN_PERIOD', 'PERMISSION_CHANGE', 'OTHER');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "tenant_status" NOT NULL DEFAULT 'TRIAL',
    "document" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "legal_name" TEXT NOT NULL,
    "trade_name" TEXT,
    "cnpj" TEXT,
    "segment" "company_segment" NOT NULL DEFAULT 'GENERAL',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_units" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" "unit_type" NOT NULL DEFAULT 'OFFICE',
    "cnpj" TEXT,
    "address" JSONB,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "geofence_m" INTEGER,
    "timezone" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "company_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "unit_id" UUID,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "manager_employment_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sectors" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_teams" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "min_members" INTEGER NOT NULL DEFAULT 1,
    "supervisor_employment_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "operational_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "social_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "cpf" TEXT,
    "pis" TEXT,
    "birth_date" DATE,
    "address" JSONB,
    "photo_path" TEXT,
    "status" "person_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_documents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "number" TEXT,
    "file_path" TEXT,
    "issued_at" DATE,
    "expires_at" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "person_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_registrations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "council" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "rqe" TEXT,
    "valid_until" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "professional_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_positions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" "professional_category" NOT NULL DEFAULT 'GENERAL',
    "cbo" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "job_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_specialties" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" "professional_category" NOT NULL DEFAULT 'PHYSICIAN',
    "parent_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "professional_specialties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_relationships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "unit_id" UUID,
    "department_id" UUID,
    "position_id" UUID,
    "registration" TEXT NOT NULL,
    "category" "professional_category" NOT NULL DEFAULT 'GENERAL',
    "contract_type" "contract_type" NOT NULL DEFAULT 'CLT',
    "function" TEXT,
    "status" "employment_status" NOT NULL DEFAULT 'ACTIVE',
    "hired_at" DATE NOT NULL,
    "terminated_at" DATE,
    "weekly_hours" DECIMAL(5,2),
    "supervisor_id" UUID,
    "rule_set_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employment_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "effective_at" DATE NOT NULL,
    "reason" TEXT,
    "actor_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_specialties" (
    "employment_id" UUID NOT NULL,
    "specialty_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,

    CONSTRAINT "employment_specialties_pkey" PRIMARY KEY ("employment_id","specialty_id")
);

-- CreateTable
CREATE TABLE "attendance_rule_sets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "rules" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "attendance_rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "schedule_type" NOT NULL,
    "weekly_minutes" INTEGER,
    "cycle_days" INTEGER,
    "cycle" JSONB,
    "rule_set_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedule_days" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "day_index" INTEGER NOT NULL,
    "is_workday" BOOLEAN NOT NULL DEFAULT true,
    "start_time" TEXT,
    "end_time" TEXT,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "break_start" TEXT,
    "expected_minutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_schedule_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "cycle_start" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendars" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "unit_id" UUID,
    "name" TEXT NOT NULL,
    "is_academic" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "calendar_id" UUID NOT NULL,
    "type" "calendar_event_type" NOT NULL,
    "title" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "is_workday" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_records" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "type" "time_record_type" NOT NULL DEFAULT 'UNCLASSIFIED',
    "source" "time_record_source" NOT NULL,
    "device_id" UUID,
    "device_nsr" BIGINT,
    "comm_event_id" UUID,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "accuracy_m" INTEGER,
    "captured_offline" BOOLEAN NOT NULL DEFAULT false,
    "synced_at" TIMESTAMPTZ(6),
    "hash" TEXT NOT NULL,
    "previous_hash" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_record_adjustments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "time_record_id" UUID,
    "kind" "adjustment_kind" NOT NULL,
    "recorded_at" TIMESTAMPTZ(6),
    "new_type" "time_record_type",
    "justification" TEXT NOT NULL,
    "status" "approval_status" NOT NULL DEFAULT 'PENDING',
    "request_id" UUID,
    "created_by_id" UUID NOT NULL,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_record_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_calculations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "expected_minutes" INTEGER NOT NULL,
    "worked_minutes" INTEGER NOT NULL,
    "balance_minutes" INTEGER NOT NULL,
    "overtime" JSONB NOT NULL,
    "night_minutes" INTEGER NOT NULL DEFAULT 0,
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_leave_minutes" INTEGER NOT NULL DEFAULT 0,
    "absence_minutes" INTEGER NOT NULL DEFAULT 0,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "flags" JSONB NOT NULL DEFAULT '[]',
    "engine_version" TEXT NOT NULL,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_hours" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "balance_minutes" INTEGER NOT NULL DEFAULT 0,
    "expiration_days" INTEGER,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bank_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_hour_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "type" "bank_hour_transaction_type" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "ref_date" DATE NOT NULL,
    "expires_on" DATE,
    "description" TEXT,
    "closing_id" UUID,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_hour_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_occurrences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "type" "occurrence_type" NOT NULL,
    "minutes" INTEGER,
    "status" "occurrence_status" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_closings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "closing_status" NOT NULL DEFAULT 'OPEN',
    "closed_by_id" UUID,
    "closed_at" TIMESTAMPTZ(6),
    "reopen_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_closings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_flows" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "unit_id" UUID,
    "request_type" "request_type" NOT NULL,
    "steps" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "flow_id" UUID,
    "type" "request_type" NOT NULL,
    "status" "approval_status" NOT NULL DEFAULT 'PENDING',
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "ref_date" DATE,
    "payload" JSONB NOT NULL,
    "justification" TEXT NOT NULL,
    "attachment_path" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "time_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_decisions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "step" INTEGER NOT NULL,
    "decision" "approval_status" NOT NULL,
    "comment" TEXT,
    "decider_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_periods" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "calendar_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,

    CONSTRAINT "academic_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "course_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "weekly_lessons" INTEGER,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "course_id" UUID,
    "name" TEXT NOT NULL,
    "grade" TEXT,
    "shift" TEXT,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classrooms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teaching_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "weekly_lessons" INTEGER,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,

    CONSTRAINT "teaching_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_schedules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "classroom_id" UUID,
    "weekday" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,

    CONSTRAINT "class_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "session_date" DATE NOT NULL,
    "status" "class_session_status" NOT NULL DEFAULT 'SCHEDULED',
    "is_extra" BOOLEAN NOT NULL DEFAULT false,
    "substitute_employment_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_shifts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "specialty_id" UUID,
    "kind" "shift_kind" NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "required_professionals" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "medical_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_shift_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "status" "shift_assignment_status" NOT NULL DEFAULT 'SCHEDULED',
    "check_in_at" TIMESTAMPTZ(6),
    "check_out_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_substitutions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "substitute_employment_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "approval_status" NOT NULL DEFAULT 'PENDING',
    "decided_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_substitutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_handover_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "from_employment_id" UUID,
    "to_employment_id" UUID,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "shift_handover_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_availability" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "recurrence" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "professional_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation_rooms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "consultation_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_appointments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "employment_id" UUID,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_activities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_assignments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "team_id" UUID,
    "activity_id" UUID,
    "work_date" DATE NOT NULL,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),

    CONSTRAINT "operational_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_occurrences" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "type" "occurrence_type" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "occurrence_status" NOT NULL DEFAULT 'OPEN',
    "responsible_id" UUID,
    "employment_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "operational_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "occurrence_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "actor_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_manufacturers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,

    CONSTRAINT "device_manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_models" (
    "id" UUID NOT NULL,
    "manufacturer_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" "device_category" NOT NULL,
    "protocols" TEXT[],
    "capabilities" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "device_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_adapters" (
    "id" UUID NOT NULL,
    "model_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "transport" TEXT NOT NULL,

    CONSTRAINT "device_adapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_homologations" (
    "id" UUID NOT NULL,
    "model_id" UUID NOT NULL,
    "firmware" TEXT NOT NULL,
    "adapter_key" TEXT NOT NULL,
    "adapter_version" TEXT NOT NULL,
    "connection" TEXT NOT NULL,
    "features" JSONB NOT NULL DEFAULT '{}',
    "status" "homologation_status" NOT NULL DEFAULT 'NOT_TESTED',
    "tested_at" TIMESTAMPTZ(6),
    "limitations" TEXT,

    CONSTRAINT "device_homologations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "unit_id" UUID,
    "model_id" UUID,
    "comm_server_id" UUID,
    "name" TEXT NOT NULL,
    "serial_number" TEXT,
    "firmware" TEXT,
    "host" TEXT,
    "port" INTEGER,
    "protocol" TEXT,
    "internal_code" TEXT,
    "usage" TEXT[] DEFAULT ARRAY['TIME']::TEXT[],
    "status" "device_status" NOT NULL DEFAULT 'PENDING',
    "last_seen_at" TIMESTAMPTZ(6),
    "last_sync_at" TIMESTAMPTZ(6),
    "adapter_version" TEXT,
    "credentials_enc" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_identifiers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "device_id" UUID,
    "type" "device_identifier_type" NOT NULL,
    "value" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "kind" "device_event_kind" NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "identifier" TEXT,
    "nsr" BIGINT,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMPTZ(6),
    "comm_event_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_sync_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "job_status" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "scheduled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,

    CONSTRAINT "device_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "employment_id" UUID,
    "kind" "device_event_kind" NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "direction" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_servers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "public_ip" TEXT,
    "domain" TEXT,
    "port" INTEGER,
    "protocol" TEXT NOT NULL DEFAULT 'https',
    "status" "server_status" NOT NULL DEFAULT 'PENDING',
    "version" TEXT,
    "last_seen_at" TIMESTAMPTZ(6),
    "allowed_company_ids" UUID[],
    "allowed_unit_ids" UUID[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "communication_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_server_credentials" (
    "id" UUID NOT NULL,
    "server_id" UUID NOT NULL,
    "key_id" TEXT NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "cert_fingerprint" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_server_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_events" (
    "id" UUID NOT NULL,
    "server_id" UUID NOT NULL,
    "tenant_id" UUID,
    "batch_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "item_count" INTEGER NOT NULL,
    "accepted_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "rejected_count" INTEGER NOT NULL DEFAULT 0,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "errors" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "communication_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_sync_history" (
    "id" UUID NOT NULL,
    "server_id" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "summary" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_sync_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_logs" (
    "id" UUID NOT NULL,
    "server_id" UUID NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "person_id" UUID,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "display_name" TEXT NOT NULL,
    "is_platform_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ(6),
    "failed_logins" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_factors" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TOTP',
    "secret_enc" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "tenant_id" UUID,
    "scope" "permission_scope" NOT NULL DEFAULT 'TENANT',
    "company_id" UUID,
    "unit_id" UUID,
    "department_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "actor_user_id" UUID,
    "action" "audit_action" NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "channel" "notification_channel" NOT NULL DEFAULT 'IN_APP',
    "read_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "interval" TEXT NOT NULL DEFAULT 'month',
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_features" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'TRIALING',
    "trial_ends_at" TIMESTAMPTZ(6),
    "current_period_start" TIMESTAMPTZ(6) NOT NULL,
    "current_period_end" TIMESTAMPTZ(6) NOT NULL,
    "cancel_at" TIMESTAMPTZ(6),
    "addons" JSONB NOT NULL DEFAULT '[]',
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "external_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" UUID NOT NULL,
    "subscription_id" UUID,
    "tenant_id" UUID,
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount_cents" INTEGER,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "companies_tenant_id_idx" ON "companies"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_tenant_id_cnpj_key" ON "companies"("tenant_id", "cnpj");

-- CreateIndex
CREATE INDEX "company_units_tenant_id_company_id_idx" ON "company_units"("tenant_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_units_company_id_code_key" ON "company_units"("company_id", "code");

-- CreateIndex
CREATE INDEX "departments_tenant_id_company_id_idx" ON "departments"("tenant_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_company_id_code_key" ON "departments"("company_id", "code");

-- CreateIndex
CREATE INDEX "sectors_tenant_id_department_id_idx" ON "sectors"("tenant_id", "department_id");

-- CreateIndex
CREATE INDEX "operational_teams_tenant_id_unit_id_idx" ON "operational_teams"("tenant_id", "unit_id");

-- CreateIndex
CREATE INDEX "people_tenant_id_full_name_idx" ON "people"("tenant_id", "full_name");

-- CreateIndex
CREATE UNIQUE INDEX "people_tenant_id_cpf_key" ON "people"("tenant_id", "cpf");

-- CreateIndex
CREATE INDEX "person_documents_tenant_id_person_id_idx" ON "person_documents"("tenant_id", "person_id");

-- CreateIndex
CREATE INDEX "professional_registrations_tenant_id_person_id_idx" ON "professional_registrations"("tenant_id", "person_id");

-- CreateIndex
CREATE UNIQUE INDEX "professional_registrations_tenant_id_council_state_number_key" ON "professional_registrations"("tenant_id", "council", "state", "number");

-- CreateIndex
CREATE INDEX "job_positions_tenant_id_idx" ON "job_positions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_positions_company_id_name_key" ON "job_positions"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "professional_specialties_tenant_id_name_key" ON "professional_specialties"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "employment_relationships_tenant_id_person_id_idx" ON "employment_relationships"("tenant_id", "person_id");

-- CreateIndex
CREATE INDEX "employment_relationships_tenant_id_company_id_status_idx" ON "employment_relationships"("tenant_id", "company_id", "status");

-- CreateIndex
CREATE INDEX "employment_relationships_tenant_id_unit_id_idx" ON "employment_relationships"("tenant_id", "unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "employment_relationships_company_id_registration_key" ON "employment_relationships"("company_id", "registration");

-- CreateIndex
CREATE INDEX "employment_history_tenant_id_employment_id_effective_at_idx" ON "employment_history"("tenant_id", "employment_id", "effective_at");

-- CreateIndex
CREATE INDEX "attendance_rule_sets_tenant_id_company_id_idx" ON "attendance_rule_sets"("tenant_id", "company_id");

-- CreateIndex
CREATE INDEX "work_schedules_tenant_id_idx" ON "work_schedules"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_schedules_company_id_name_key" ON "work_schedules"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "work_schedule_days_schedule_id_day_index_key" ON "work_schedule_days"("schedule_id", "day_index");

-- CreateIndex
CREATE INDEX "schedule_assignments_tenant_id_employment_id_valid_from_idx" ON "schedule_assignments"("tenant_id", "employment_id", "valid_from");

-- CreateIndex
CREATE INDEX "calendars_tenant_id_company_id_idx" ON "calendars"("tenant_id", "company_id");

-- CreateIndex
CREATE INDEX "calendar_events_tenant_id_calendar_id_starts_on_idx" ON "calendar_events"("tenant_id", "calendar_id", "starts_on");

-- CreateIndex
CREATE INDEX "time_records_tenant_id_employment_id_recorded_at_idx" ON "time_records"("tenant_id", "employment_id", "recorded_at");

-- CreateIndex
CREATE INDEX "time_records_tenant_id_device_id_device_nsr_idx" ON "time_records"("tenant_id", "device_id", "device_nsr");

-- CreateIndex
CREATE UNIQUE INDEX "time_records_tenant_id_idempotency_key_key" ON "time_records"("tenant_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "time_record_adjustments_tenant_id_employment_id_created_at_idx" ON "time_record_adjustments"("tenant_id", "employment_id", "created_at");

-- CreateIndex
CREATE INDEX "time_calculations_tenant_id_work_date_idx" ON "time_calculations"("tenant_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "time_calculations_employment_id_work_date_key" ON "time_calculations"("employment_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "bank_hours_employment_id_key" ON "bank_hours"("employment_id");

-- CreateIndex
CREATE INDEX "bank_hours_tenant_id_idx" ON "bank_hours"("tenant_id");

-- CreateIndex
CREATE INDEX "bank_hour_transactions_tenant_id_account_id_ref_date_idx" ON "bank_hour_transactions"("tenant_id", "account_id", "ref_date");

-- CreateIndex
CREATE INDEX "attendance_occurrences_tenant_id_employment_id_work_date_idx" ON "attendance_occurrences"("tenant_id", "employment_id", "work_date");

-- CreateIndex
CREATE INDEX "attendance_occurrences_tenant_id_status_idx" ON "attendance_occurrences"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "time_closings_company_id_period_start_period_end_key" ON "time_closings"("company_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "approval_flows_tenant_id_company_id_request_type_idx" ON "approval_flows"("tenant_id", "company_id", "request_type");

-- CreateIndex
CREATE INDEX "time_requests_tenant_id_status_created_at_idx" ON "time_requests"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "time_requests_tenant_id_employment_id_idx" ON "time_requests"("tenant_id", "employment_id");

-- CreateIndex
CREATE INDEX "request_decisions_tenant_id_request_id_idx" ON "request_decisions"("tenant_id", "request_id");

-- CreateIndex
CREATE INDEX "academic_periods_tenant_id_calendar_id_idx" ON "academic_periods"("tenant_id", "calendar_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_company_id_name_key" ON "courses"("company_id", "name");

-- CreateIndex
CREATE INDEX "subjects_tenant_id_company_id_idx" ON "subjects"("tenant_id", "company_id");

-- CreateIndex
CREATE INDEX "classes_tenant_id_unit_id_period_id_idx" ON "classes"("tenant_id", "unit_id", "period_id");

-- CreateIndex
CREATE UNIQUE INDEX "classrooms_unit_id_name_key" ON "classrooms"("unit_id", "name");

-- CreateIndex
CREATE INDEX "teaching_assignments_tenant_id_employment_id_idx" ON "teaching_assignments"("tenant_id", "employment_id");

-- CreateIndex
CREATE INDEX "class_schedules_tenant_id_weekday_idx" ON "class_schedules"("tenant_id", "weekday");

-- CreateIndex
CREATE INDEX "class_sessions_tenant_id_session_date_idx" ON "class_sessions"("tenant_id", "session_date");

-- CreateIndex
CREATE UNIQUE INDEX "class_sessions_schedule_id_session_date_key" ON "class_sessions"("schedule_id", "session_date");

-- CreateIndex
CREATE INDEX "medical_shifts_tenant_id_unit_id_starts_at_idx" ON "medical_shifts"("tenant_id", "unit_id", "starts_at");

-- CreateIndex
CREATE INDEX "medical_shift_assignments_tenant_id_employment_id_idx" ON "medical_shift_assignments"("tenant_id", "employment_id");

-- CreateIndex
CREATE UNIQUE INDEX "medical_shift_assignments_shift_id_employment_id_key" ON "medical_shift_assignments"("shift_id", "employment_id");

-- CreateIndex
CREATE INDEX "shift_substitutions_tenant_id_assignment_id_idx" ON "shift_substitutions"("tenant_id", "assignment_id");

-- CreateIndex
CREATE INDEX "shift_handover_events_tenant_id_shift_id_idx" ON "shift_handover_events"("tenant_id", "shift_id");

-- CreateIndex
CREATE INDEX "professional_availability_tenant_id_employment_id_starts_at_idx" ON "professional_availability"("tenant_id", "employment_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "consultation_rooms_unit_id_name_key" ON "consultation_rooms"("unit_id", "name");

-- CreateIndex
CREATE INDEX "medical_appointments_tenant_id_room_id_starts_at_idx" ON "medical_appointments"("tenant_id", "room_id", "starts_at");

-- CreateIndex
CREATE INDEX "operational_activities_tenant_id_unit_id_starts_at_idx" ON "operational_activities"("tenant_id", "unit_id", "starts_at");

-- CreateIndex
CREATE INDEX "operational_assignments_tenant_id_work_date_idx" ON "operational_assignments"("tenant_id", "work_date");

-- CreateIndex
CREATE INDEX "operational_occurrences_tenant_id_unit_id_status_idx" ON "operational_occurrences"("tenant_id", "unit_id", "status");

-- CreateIndex
CREATE INDEX "operational_events_tenant_id_occurrence_id_idx" ON "operational_events"("tenant_id", "occurrence_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_manufacturers_name_key" ON "device_manufacturers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "device_models_manufacturer_id_name_key" ON "device_models"("manufacturer_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "device_adapters_model_id_key_version_key" ON "device_adapters"("model_id", "key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "device_homologations_model_id_firmware_adapter_key_adapter__key" ON "device_homologations"("model_id", "firmware", "adapter_key", "adapter_version");

-- CreateIndex
CREATE INDEX "devices_tenant_id_company_id_status_idx" ON "devices"("tenant_id", "company_id", "status");

-- CreateIndex
CREATE INDEX "devices_comm_server_id_idx" ON "devices"("comm_server_id");

-- CreateIndex
CREATE UNIQUE INDEX "devices_tenant_id_serial_number_key" ON "devices"("tenant_id", "serial_number");

-- CreateIndex
CREATE INDEX "device_identifiers_tenant_id_employment_id_idx" ON "device_identifiers"("tenant_id", "employment_id");

-- CreateIndex
CREATE UNIQUE INDEX "device_identifiers_tenant_id_type_value_device_id_key" ON "device_identifiers"("tenant_id", "type", "value", "device_id");

-- CreateIndex
CREATE INDEX "device_events_tenant_id_device_id_occurred_at_idx" ON "device_events"("tenant_id", "device_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "device_events_device_id_kind_nsr_occurred_at_key" ON "device_events"("device_id", "kind", "nsr", "occurred_at");

-- CreateIndex
CREATE INDEX "device_logs_tenant_id_device_id_created_at_idx" ON "device_logs"("tenant_id", "device_id", "created_at");

-- CreateIndex
CREATE INDEX "device_sync_jobs_tenant_id_device_id_status_idx" ON "device_sync_jobs"("tenant_id", "device_id", "status");

-- CreateIndex
CREATE INDEX "access_events_tenant_id_device_id_occurred_at_idx" ON "access_events"("tenant_id", "device_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "communication_servers_identifier_key" ON "communication_servers"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "communication_server_credentials_key_id_key" ON "communication_server_credentials"("key_id");

-- CreateIndex
CREATE INDEX "communication_events_server_id_received_at_idx" ON "communication_events"("server_id", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "communication_events_server_id_batch_id_key" ON "communication_events"("server_id", "batch_id");

-- CreateIndex
CREATE INDEX "communication_sync_history_server_id_created_at_idx" ON "communication_sync_history"("server_id", "created_at");

-- CreateIndex
CREATE INDEX "communication_logs_server_id_created_at_idx" ON "communication_logs"("server_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_person_id_key" ON "users"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_family_id_idx" ON "sessions"("family_id");

-- CreateIndex
CREATE INDEX "mfa_factors_user_id_idx" ON "mfa_factors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_key_key" ON "roles"("tenant_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "user_roles_tenant_id_user_id_idx" ON "user_roles"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_scope_company_id_unit_id_departm_key" ON "user_roles"("user_id", "role_id", "scope", "company_id", "unit_id", "department_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_entity_entity_id_idx" ON "audit_logs"("tenant_id", "entity", "entity_id");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_user_id_read_at_idx" ON "notifications"("tenant_id", "user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_type_channel_key" ON "notification_preferences"("user_id", "type", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "plans_key_key" ON "plans"("key");

-- CreateIndex
CREATE UNIQUE INDEX "plan_features_plan_id_key_key" ON "plan_features"("plan_id", "key");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_status_idx" ON "subscriptions"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_provider_external_id_key" ON "billing_events"("provider", "external_id");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_units" ADD CONSTRAINT "company_units_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_units" ADD CONSTRAINT "company_units_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "company_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "company_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_teams" ADD CONSTRAINT "operational_teams_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "company_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_documents" ADD CONSTRAINT "person_documents_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_registrations" ADD CONSTRAINT "professional_registrations_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_positions" ADD CONSTRAINT "job_positions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_specialties" ADD CONSTRAINT "professional_specialties_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "professional_specialties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_relationships" ADD CONSTRAINT "employment_relationships_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_relationships" ADD CONSTRAINT "employment_relationships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_relationships" ADD CONSTRAINT "employment_relationships_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "company_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_relationships" ADD CONSTRAINT "employment_relationships_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_relationships" ADD CONSTRAINT "employment_relationships_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "job_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_relationships" ADD CONSTRAINT "employment_relationships_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "employment_relationships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_relationships" ADD CONSTRAINT "employment_relationships_rule_set_id_fkey" FOREIGN KEY ("rule_set_id") REFERENCES "attendance_rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_history" ADD CONSTRAINT "employment_history_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_specialties" ADD CONSTRAINT "employment_specialties_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_specialties" ADD CONSTRAINT "employment_specialties_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "professional_specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_rule_sets" ADD CONSTRAINT "attendance_rule_sets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_rule_set_id_fkey" FOREIGN KEY ("rule_set_id") REFERENCES "attendance_rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule_days" ADD CONSTRAINT "work_schedule_days_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "work_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "work_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_records" ADD CONSTRAINT "time_records_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_records" ADD CONSTRAINT "time_records_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_record_adjustments" ADD CONSTRAINT "time_record_adjustments_time_record_id_fkey" FOREIGN KEY ("time_record_id") REFERENCES "time_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_record_adjustments" ADD CONSTRAINT "time_record_adjustments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "time_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_calculations" ADD CONSTRAINT "time_calculations_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_hours" ADD CONSTRAINT "bank_hours_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_hour_transactions" ADD CONSTRAINT "bank_hour_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "bank_hours"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_occurrences" ADD CONSTRAINT "attendance_occurrences_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_closings" ADD CONSTRAINT "time_closings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_flows" ADD CONSTRAINT "approval_flows_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_requests" ADD CONSTRAINT "time_requests_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_requests" ADD CONSTRAINT "time_requests_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "approval_flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_decisions" ADD CONSTRAINT "request_decisions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "time_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_periods" ADD CONSTRAINT "academic_periods_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "academic_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "company_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "teaching_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "class_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_shifts" ADD CONSTRAINT "medical_shifts_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "company_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_shifts" ADD CONSTRAINT "medical_shifts_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "professional_specialties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_shift_assignments" ADD CONSTRAINT "medical_shift_assignments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "medical_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_shift_assignments" ADD CONSTRAINT "medical_shift_assignments_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_substitutions" ADD CONSTRAINT "shift_substitutions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "medical_shift_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_handover_events" ADD CONSTRAINT "shift_handover_events_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "medical_shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_availability" ADD CONSTRAINT "professional_availability_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation_rooms" ADD CONSTRAINT "consultation_rooms_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "company_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_appointments" ADD CONSTRAINT "medical_appointments_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "consultation_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_assignments" ADD CONSTRAINT "operational_assignments_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_assignments" ADD CONSTRAINT "operational_assignments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "operational_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_assignments" ADD CONSTRAINT "operational_assignments_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "operational_activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_events" ADD CONSTRAINT "operational_events_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "operational_occurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_models" ADD CONSTRAINT "device_models_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "device_manufacturers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_adapters" ADD CONSTRAINT "device_adapters_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "device_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_homologations" ADD CONSTRAINT "device_homologations_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "device_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "company_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "device_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_comm_server_id_fkey" FOREIGN KEY ("comm_server_id") REFERENCES "communication_servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_identifiers" ADD CONSTRAINT "device_identifiers_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_identifiers" ADD CONSTRAINT "device_identifiers_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_logs" ADD CONSTRAINT "device_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sync_jobs" ADD CONSTRAINT "device_sync_jobs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment_relationships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_servers" ADD CONSTRAINT "communication_servers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_server_credentials" ADD CONSTRAINT "communication_server_credentials_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "communication_servers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_events" ADD CONSTRAINT "communication_events_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "communication_servers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_sync_history" ADD CONSTRAINT "communication_sync_history_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "communication_servers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "communication_servers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_factors" ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_events" ADD CONSTRAINT "billing_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
