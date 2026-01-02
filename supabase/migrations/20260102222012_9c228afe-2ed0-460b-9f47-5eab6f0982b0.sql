-- Add phone column to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone text;

-- Add phone column to company_settings table
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS phone text;

-- Add trade_name (nome fantasia) column to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS trade_name text;

-- Add trade_name column to company_settings table
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS trade_name text;