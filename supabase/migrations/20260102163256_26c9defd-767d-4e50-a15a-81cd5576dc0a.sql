-- Add must_change_password column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN public.profiles.must_change_password IS 'If true, user must change password on next login';