-- Super Administrador irrevogável: viniciusacacio1@gmail.com sempre tem o papel super_admin.
-- Garante o papel agora (e a cada nova conta com esse e-mail) e impede retirá-lo pelo app ou pela API.

CREATE OR REPLACE FUNCTION public.protected_super_admin_email() RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT 'viniciusacacio1@gmail.com'::text $$;

-- Papel para a conta atual (se já existir).
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = public.protected_super_admin_email()
ON CONFLICT (user_id, role) DO NOTHING;

-- Perfil ativo (o login do Super Admin consulta o perfil em algumas telas).
UPDATE public.profiles p SET is_active = true
FROM auth.users u
WHERE p.user_id = u.id AND lower(u.email) = public.protected_super_admin_email() AND p.is_active IS DISTINCT FROM true;

-- Bloqueia retirar ou trocar o papel do Super Admin protegido.
CREATE OR REPLACE FUNCTION public.protect_super_admin_role() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_email text;
BEGIN
  IF OLD.role = 'super_admin' THEN
    SELECT lower(email) INTO v_email FROM auth.users WHERE id = OLD.user_id;
    IF v_email = public.protected_super_admin_email()
       AND (TG_OP = 'DELETE' OR NEW.role IS DISTINCT FROM OLD.role OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
      RAISE EXCEPTION 'O Super Administrador % não pode ser removido', v_email USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DROP TRIGGER IF EXISTS user_roles_protect_super_admin ON public.user_roles;
CREATE TRIGGER user_roles_protect_super_admin
  BEFORE UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_role();

-- Conta criada (ou recriada) com esse e-mail recebe o papel na hora.
CREATE OR REPLACE FUNCTION public.grant_protected_super_admin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF lower(NEW.email) = public.protected_super_admin_email() THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_protected_super_admin ON auth.users;
CREATE TRIGGER on_auth_user_protected_super_admin
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_protected_super_admin();
