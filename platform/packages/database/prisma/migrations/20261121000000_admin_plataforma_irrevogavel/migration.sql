-- Administrador da plataforma irrevogável: viniciusacacio1@gmail.com existe sempre, é sempre
-- administrador da plataforma, ativo, com o perfil super_admin, e não pode ser excluído nem bloqueado.
-- A regra vale no banco (gatilhos), não só na API: nenhuma tela, script ou migração consegue revogá-lo.

CREATE TABLE platform_protected_admins (
  email text PRIMARY KEY CHECK (email = lower(email))
);
INSERT INTO platform_protected_admins (email) VALUES ('viniciusacacio1@gmail.com');
-- O papel da API só lê a lista; ninguém além do dono do banco a altera.
REVOKE ALL ON platform_protected_admins FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'superponto_app') THEN
    REVOKE ALL ON platform_protected_admins FROM superponto_app;
    GRANT SELECT ON platform_protected_admins TO superponto_app;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION is_protected_admin(p_email text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path FROM CURRENT AS $$
  SELECT EXISTS (SELECT 1 FROM platform_protected_admins WHERE email = lower(p_email))
$$;

-- Lista protegida: não aceita alterações pela aplicação.
CREATE OR REPLACE FUNCTION protected_admins_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'A lista de administradores protegidos da plataforma não pode ser alterada' USING ERRCODE = 'insufficient_privilege';
END $$;
CREATE TRIGGER platform_protected_admins_immutable
  BEFORE UPDATE OR DELETE ON platform_protected_admins FOR EACH ROW EXECUTE FUNCTION protected_admins_immutable();

-- Usuário: ao criar, já nasce administrador ativo; depois, não pode perder isso nem ser excluído.
CREATE OR REPLACE FUNCTION users_protect_platform_admin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF is_protected_admin(OLD.email) THEN
      RAISE EXCEPTION 'O administrador da plataforma % não pode ser excluído', OLD.email USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND is_protected_admin(OLD.email) THEN
    IF lower(NEW.email) <> lower(OLD.email) THEN
      RAISE EXCEPTION 'O e-mail do administrador da plataforma não pode ser alterado' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NOT NEW.is_platform_admin OR NOT NEW.is_active OR NEW.deleted_at IS NOT NULL OR NEW.tenant_id IS NOT NULL THEN
      RAISE EXCEPTION 'O administrador da plataforma % é irrevogável', OLD.email USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' AND is_protected_admin(NEW.email) THEN
    NEW.is_platform_admin := true;
    NEW.is_active := true;
    NEW.deleted_at := NULL;
    NEW.tenant_id := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER users_protect_platform_admin
  BEFORE INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION users_protect_platform_admin();

-- Perfil super_admin dele não pode ser retirado.
CREATE OR REPLACE FUNCTION user_roles_protect_platform_admin() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_key text; v_email text;
BEGIN
  SELECT r.key INTO v_key FROM roles r WHERE r.id = OLD.role_id;
  SELECT u.email INTO v_email FROM users u WHERE u.id = OLD.user_id;
  IF v_key = 'super_admin' AND v_email IS NOT NULL AND is_protected_admin(v_email) THEN
    RAISE EXCEPTION 'O perfil super_admin do administrador da plataforma não pode ser retirado' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER user_roles_protect_platform_admin
  BEFORE DELETE ON user_roles FOR EACH ROW EXECUTE FUNCTION user_roles_protect_platform_admin();

-- Não pode ser bloqueado.
CREATE OR REPLACE FUNCTION user_blocks_protect_platform_admin() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_email text;
BEGIN
  SELECT u.email INTO v_email FROM users u WHERE u.id = NEW.user_id;
  IF v_email IS NOT NULL AND is_protected_admin(v_email) THEN
    RAISE EXCEPTION 'O administrador da plataforma não pode ser bloqueado' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER user_blocks_protect_platform_admin
  BEFORE INSERT ON user_access_blocks FOR EACH ROW EXECUTE FUNCTION user_blocks_protect_platform_admin();

-- Garante a conta agora (sem senha: o primeiro acesso é pelo "Esqueci minha senha").
INSERT INTO users (id, email, display_name, is_platform_admin, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'viniciusacacio1@gmail.com', 'Vinicius (administrador da plataforma)', true, true, now(), now())
ON CONFLICT (email) DO UPDATE SET is_platform_admin = true, is_active = true, deleted_at = NULL, tenant_id = NULL, updated_at = now();

-- Perfil super_admin, se o catálogo de perfis já existir (o seed também garante).
INSERT INTO user_roles (id, user_id, role_id, scope, created_at)
SELECT gen_random_uuid(), u.id, r.id, 'PLATFORM', now()
FROM users u JOIN roles r ON r.key = 'super_admin' AND r.tenant_id IS NULL
WHERE u.email = 'viniciusacacio1@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = r.id);

-- Quando o perfil super_admin de sistema for criado (o seed roda depois das migrações), já o concede a ele.
CREATE OR REPLACE FUNCTION roles_grant_protected_admin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.key = 'super_admin' AND NEW.tenant_id IS NULL THEN
    INSERT INTO user_roles (id, user_id, role_id, scope, created_at)
    SELECT gen_random_uuid(), u.id, NEW.id, 'PLATFORM', now()
    FROM users u JOIN platform_protected_admins p ON p.email = u.email
    WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER roles_grant_protected_admin
  AFTER INSERT ON roles FOR EACH ROW EXECUTE FUNCTION roles_grant_protected_admin();
