-- Create a function to automatically create users when a company is created
-- This function will be called via a webhook or manually after company creation
-- We store the pending company creation in a queue table

CREATE TABLE IF NOT EXISTS public.pending_company_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.pending_company_users ENABLE ROW LEVEL SECURITY;

-- Only super admins can see this table
CREATE POLICY "Super admins can manage pending users"
ON public.pending_company_users
FOR ALL
USING (is_super_admin(auth.uid()));

-- Create trigger function to queue user creation when company is created
CREATE OR REPLACE FUNCTION public.queue_company_users_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only queue for new active companies
  IF NEW.is_active = true THEN
    INSERT INTO public.pending_company_users (company_id)
    VALUES (NEW.id)
    ON CONFLICT (company_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on companies table
DROP TRIGGER IF EXISTS on_company_created ON public.companies;
CREATE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_company_users_creation();