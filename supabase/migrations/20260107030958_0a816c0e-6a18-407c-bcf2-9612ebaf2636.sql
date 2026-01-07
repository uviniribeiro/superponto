-- Add transaction_hash column to time_records
ALTER TABLE public.time_records ADD COLUMN IF NOT EXISTS transaction_hash TEXT;

-- Add transaction_hash column to adjustment_requests
ALTER TABLE public.adjustment_requests ADD COLUMN IF NOT EXISTS transaction_hash TEXT;

-- Add transaction_hash column to audit_logs
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS transaction_hash TEXT;

-- Add transaction_hash column to employee_absences
ALTER TABLE public.employee_absences ADD COLUMN IF NOT EXISTS transaction_hash TEXT;

-- Add transaction_hash column to timesheet_locks
ALTER TABLE public.timesheet_locks ADD COLUMN IF NOT EXISTS transaction_hash TEXT;

-- Add transaction_hash column to class_records
ALTER TABLE public.class_records ADD COLUMN IF NOT EXISTS transaction_hash TEXT;

-- Add transaction_hash column to payroll_exports
ALTER TABLE public.payroll_exports ADD COLUMN IF NOT EXISTS transaction_hash TEXT;

-- Create index for faster hash lookups
CREATE INDEX IF NOT EXISTS idx_time_records_hash ON public.time_records(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_adjustment_requests_hash ON public.adjustment_requests(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_hash ON public.audit_logs(transaction_hash);