-- Criar trigger para tornar o primeiro usuário admin automaticamente
CREATE OR REPLACE FUNCTION public.handle_first_user_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  -- Se é o primeiro usuário, torna-o admin
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.user_id, 'employee');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger que executa após inserção de perfil
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_first_user_admin();

-- Permitir que novos usuários criem seu próprio perfil (necessário para signup)
CREATE POLICY "Users can insert own profile on signup" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);