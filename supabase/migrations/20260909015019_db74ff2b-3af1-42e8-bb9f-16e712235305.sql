CREATE TABLE IF NOT EXISTS public.profile_2fa_secrets (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  two_factor_secret text,
  backup_codes text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_2fa_secrets TO authenticated;
GRANT ALL ON public.profile_2fa_secrets TO service_role;
ALTER TABLE public.profile_2fa_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_2fa_secrets" ON public.profile_2fa_secrets FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER profile_2fa_secrets_updated BEFORE UPDATE ON public.profile_2fa_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.profile_2fa_secrets (profile_id, user_id, two_factor_secret, backup_codes)
SELECT id, user_id, two_factor_secret, backup_codes
FROM public.profiles
WHERE user_id IS NOT NULL AND (two_factor_secret IS NOT NULL OR backup_codes IS NOT NULL)
ON CONFLICT (profile_id) DO NOTHING;

ALTER TABLE public.profiles DROP COLUMN two_factor_secret;
ALTER TABLE public.profiles DROP COLUMN backup_codes;