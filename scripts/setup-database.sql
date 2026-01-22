-- ============================================
-- Setup inicial do banco de dados PostgreSQL
-- Sistema de Ponto Eletrônico - SuperPonto
-- ============================================

-- Executar como superusuário (postgres)

-- 1. Criar usuário da aplicação
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'superponto_user') THEN
        CREATE ROLE superponto_user WITH LOGIN PASSWORD 'SuperPonto@2024';
    END IF;
END
$$;

-- 2. Criar banco de dados
SELECT 'CREATE DATABASE superponto OWNER superponto_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'superponto')\gexec

-- 3. Conectar ao banco superponto e habilitar extensões
\c superponto

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 4. Criar schema auth (simula Supabase Auth)
CREATE SCHEMA IF NOT EXISTS auth;

-- 5. Criar tabela de usuários auth (alternativa ao Supabase Auth)
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    encrypted_password VARCHAR(255) NOT NULL,
    email_confirmed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_sign_in_at TIMESTAMP WITH TIME ZONE,
    raw_app_meta_data JSONB DEFAULT '{}',
    raw_user_meta_data JSONB DEFAULT '{}',
    is_super_admin BOOLEAN DEFAULT FALSE,
    role VARCHAR(50) DEFAULT 'authenticated'
);

-- 6. Função para hash de senha
CREATE OR REPLACE FUNCTION auth.hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN crypt(password, gen_salt('bf', 10));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Função para verificar senha
CREATE OR REPLACE FUNCTION auth.verify_password(password TEXT, hashed_password TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN hashed_password = crypt(password, hashed_password);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Função auxiliar auth.uid() (simula Supabase)
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
BEGIN
    RETURN current_setting('app.current_user_id', true)::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- 9. Função para definir usuário atual (usar no backend)
CREATE OR REPLACE FUNCTION auth.set_current_user(user_id UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_id::TEXT, false);
END;
$$ LANGUAGE plpgsql;

-- 10. Criar enum de roles
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'manager', 'employee');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 11. Criar enum de tipo de organização
DO $$ BEGIN
    CREATE TYPE public.organization_type AS ENUM ('company', 'city_hall');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 12. Conceder permissões
GRANT ALL PRIVILEGES ON SCHEMA public TO superponto_user;
GRANT ALL PRIVILEGES ON SCHEMA auth TO superponto_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO superponto_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO superponto_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO superponto_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO superponto_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO superponto_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO superponto_user;

-- 13. Permissões para futuras tabelas
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO superponto_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL PRIVILEGES ON TABLES TO superponto_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO superponto_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL PRIVILEGES ON SEQUENCES TO superponto_user;

-- 14. Criar super admin inicial
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, is_super_admin)
VALUES (
    'superadmin@superponto.local',
    auth.hash_password('Super@Admin2024'),
    NOW(),
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- ============================================
-- Mensagem de conclusão
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE ' Setup do banco de dados concluído!';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
    RAISE NOTICE ' Banco: superponto';
    RAISE NOTICE ' Usuário: superponto_user';
    RAISE NOTICE ' Senha: SuperPonto@2024';
    RAISE NOTICE '';
    RAISE NOTICE ' Super Admin:';
    RAISE NOTICE '   Email: superadmin@superponto.local';
    RAISE NOTICE '   Senha: Super@Admin2024';
    RAISE NOTICE '';
    RAISE NOTICE ' Próximos passos:';
    RAISE NOTICE ' 1. Execute as migrações: ./scripts/run-migrations.sh';
    RAISE NOTICE ' 2. Configure o .env.local';
    RAISE NOTICE ' 3. Execute: npm run build';
    RAISE NOTICE '';
END
$$;
