-- Add license_type column to licenses table
ALTER TABLE public.licenses 
ADD COLUMN license_type text NOT NULL DEFAULT 'annual';

-- Add comment explaining the license types
COMMENT ON COLUMN public.licenses.license_type IS 'License types: monthly, annual, lifetime';