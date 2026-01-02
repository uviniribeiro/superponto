-- Add column to enable teacher module for companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS teacher_module_enabled boolean DEFAULT false;

-- Add comment
COMMENT ON COLUMN public.companies.teacher_module_enabled IS 'Indicates if the teacher module is enabled for this company';