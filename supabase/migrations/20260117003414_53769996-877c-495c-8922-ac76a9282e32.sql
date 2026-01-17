
-- Add is_system_user column to profiles table to identify system/access-only users
-- These users (suporte, admin) are NOT employees and should not appear in employee lists

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_system_user boolean DEFAULT false;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.profiles.is_system_user IS 'When true, this user is a system/access user only (e.g., suporte, admin) and should NOT be shown in employee lists. They have login access but are not registered as employees.';

-- Update existing system users (support and admin accounts) to mark them as system users
UPDATE public.profiles 
SET is_system_user = true 
WHERE email LIKE 'suporte@%.pontomax.local' 
   OR email LIKE 'admin@%.pontomax.local';

-- Create index for filtering employees vs system users
CREATE INDEX IF NOT EXISTS idx_profiles_is_system_user ON public.profiles(is_system_user);
