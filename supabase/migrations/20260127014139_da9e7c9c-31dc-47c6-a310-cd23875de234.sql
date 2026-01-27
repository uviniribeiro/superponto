-- Add support for partial holidays (until specific time) and extended holidays (multiple days)
ALTER TABLE public.holidays 
ADD COLUMN IF NOT EXISTS end_date date,
ADD COLUMN IF NOT EXISTS is_partial boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS partial_end_time time,
ADD COLUMN IF NOT EXISTS holiday_type text DEFAULT 'full' CHECK (holiday_type IN ('full', 'partial', 'extended'));

-- Add comment for clarity
COMMENT ON COLUMN public.holidays.end_date IS 'End date for extended holidays (multiple days)';
COMMENT ON COLUMN public.holidays.is_partial IS 'True if holiday is only until a specific time';
COMMENT ON COLUMN public.holidays.partial_end_time IS 'Time until which the holiday applies (e.g., 12:00 for half-day)';
COMMENT ON COLUMN public.holidays.holiday_type IS 'Type: full (whole day), partial (until time), extended (multiple days)';