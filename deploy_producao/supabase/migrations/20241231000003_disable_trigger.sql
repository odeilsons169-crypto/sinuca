-- Desabilitar o trigger problemático
-- O backend vai criar os registros manualmente

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
