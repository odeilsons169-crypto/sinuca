-- Remover trigger e função antigos
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS handle_new_user();

-- Criar função com permissões corretas
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_username TEXT;
BEGIN
  -- Gerar username a partir do email ou metadata
  new_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    SPLIT_PART(NEW.email, '@', 1)
  );
  
  -- Garantir username único adicionando sufixo se necessário
  WHILE EXISTS (SELECT 1 FROM public.users WHERE username = new_username) LOOP
    new_username := new_username || '_' || SUBSTRING(NEW.id::TEXT, 1, 4);
  END LOOP;

  -- Inserir na tabela users
  INSERT INTO public.users (id, email, username, role, status)
  VALUES (NEW.id, NEW.email, new_username, 'user', 'active');
  
  -- Inserir carteira
  INSERT INTO public.wallet (user_id, balance, is_blocked)
  VALUES (NEW.id, 0, false);
  
  -- Inserir créditos
  INSERT INTO public.credits (user_id, amount, is_unlimited)
  VALUES (NEW.id, 0, false);
  
  -- Inserir estatísticas
  INSERT INTO public.user_stats (user_id, total_matches, wins, losses, win_rate, total_credits_used, total_bet_won, total_bet_lost, ranking_points)
  VALUES (NEW.id, 0, 0, 0, 0, 0, 0, 0, 0);
  
  -- Inserir ranking global
  INSERT INTO public.rankings (user_id, period, points, month)
  VALUES (NEW.id, 'global', 0, NULL);
  
  RETURN NEW;
END;
$$;

-- Criar trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Garantir que a função pode ser executada
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;
