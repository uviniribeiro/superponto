CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE private.locked_profile_logins (
  profile_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  email text NOT NULL,
  company_id uuid,
  locked_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.locked_profile_logins FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE private.locked_profile_logins ENABLE ROW LEVEL SECURITY;
INSERT INTO private.locked_profile_logins (profile_id, user_id, email, company_id)
SELECT id, user_id, email, company_id FROM public.profiles;
CREATE TABLE private.locked_companies (
  company_id uuid PRIMARY KEY,
  snapshot jsonb NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.locked_companies FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE private.locked_companies ENABLE ROW LEVEL SECURITY;
INSERT INTO private.locked_companies (company_id, snapshot)
SELECT id, to_jsonb(c) - 'updated_at' FROM public.companies c;
CREATE FUNCTION private.protect_locked_profile_login()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE locked private.locked_profile_logins%ROWTYPE;
BEGIN
  SELECT * INTO locked FROM private.locked_profile_logins WHERE profile_id = OLD.id;
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Cadastro existente protegido contra exclusão' USING ERRCODE = '23514';
  END IF;
  IF NEW.id IS DISTINCT FROM locked.profile_id
    OR NEW.user_id IS DISTINCT FROM locked.user_id
    OR NEW.email IS DISTINCT FROM locked.email
    OR NEW.company_id IS DISTINCT FROM locked.company_id THEN
    RAISE EXCEPTION 'E-mail, usuário e empresa do cadastro existente estão protegidos' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.protect_locked_profile_login() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER protect_locked_profile_login_trg BEFORE UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.protect_locked_profile_login();
CREATE FUNCTION private.protect_locked_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, private AS $$
DECLARE locked_snapshot jsonb;
BEGIN
  SELECT snapshot INTO locked_snapshot FROM private.locked_companies WHERE company_id = OLD.id;
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Empresa existente protegida contra exclusão' USING ERRCODE = '23514';
  END IF;
  IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM locked_snapshot THEN
    RAISE EXCEPTION 'Os dados da empresa existente estão protegidos contra alteração' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.protect_locked_company() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER protect_locked_company_trg BEFORE UPDATE OR DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION private.protect_locked_company();
COMMENT ON TABLE private.locked_profile_logins IS 'Immutable snapshot of existing application login identifiers; does not change authentication passwords or managed auth settings.';
COMMENT ON TABLE private.locked_companies IS 'Immutable snapshot of existing companies, excluding automatic updated_at bookkeeping.';