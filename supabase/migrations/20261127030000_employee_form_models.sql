-- Cadastro do funcionário mais completo e configurável: dados complementares em JSON e, por empresa,
-- o modelo do cadastro (simplificado, padrão, completo ou personalizado com campos e obrigatoriedade).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS extra_data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS employee_form jsonb NOT NULL DEFAULT '{"model":"padrao"}'::jsonb;
