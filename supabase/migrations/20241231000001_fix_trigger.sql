-- Corrigir trigger para novos usuários
-- O trigger precisa ser executado com SECURITY DEFINER e ter permissões corretas

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar perfil do usuário
  INSERT INTO public.users (id, email, username)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)));
  
  -- Criar carteira
  INSERT INTO public.wallet (user_id, balance)
  VALUES (NEW.id, 0);
  
  -- Criar créditos
  INSERT INTO public.credits (user_id, amount)
  VALUES (NEW.id, 0);
  
  -- Criar estatísticas
  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id);
  
  -- Criar ranking global
  INSERT INTO public.rankings (user_id, period, points)
  VALUES (NEW.id, 'global', 0);
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Dar permissões necessárias
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Recriar trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
