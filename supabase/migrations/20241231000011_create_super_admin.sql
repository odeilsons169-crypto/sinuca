-- =====================================================
-- MIGRATION: Criar Usuário Super Admin
-- =====================================================
-- Este script cria o usuário administrador principal do sistema
-- IMPORTANTE: Altere a senha após o primeiro login!

-- Garantir que a coluna role existe e tem os valores corretos
DO $$
BEGIN
  -- Adicionar coluna role se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
    ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';
  END IF;
  
  -- Adicionar coluna is_admin se não existir (para compatibilidade)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_admin') THEN
    ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Criar índice para role
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Comentários
COMMENT ON COLUMN users.role IS 'Nível de acesso: user, moderator, admin, super_admin';
COMMENT ON COLUMN users.is_admin IS 'Flag de compatibilidade para verificação rápida de admin';

-- Trigger para sincronizar is_admin com role
CREATE OR REPLACE FUNCTION sync_is_admin()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_admin := NEW.role IN ('admin', 'super_admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_is_admin ON users;
CREATE TRIGGER trigger_sync_is_admin
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION sync_is_admin();

-- =====================================================
-- CRIAR SUPER ADMIN
-- =====================================================
-- Email: admin@sinuca.online
-- Senha: Admin@2024! (ALTERAR APÓS PRIMEIRO LOGIN!)
-- Username: SuperAdmin
-- =====================================================

-- Nota: O usuário será criado via Supabase Auth
-- Este script apenas prepara a estrutura

-- Inserir configuração padrão de permissões por role
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(20) NOT NULL,
  permission VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(role, permission)
);

-- Permissões do Super Admin (todas)
INSERT INTO role_permissions (role, permission) VALUES
  ('super_admin', 'view_users'),
  ('super_admin', 'edit_users'),
  ('super_admin', 'delete_users'),
  ('super_admin', 'ban_users'),
  ('super_admin', 'view_finances'),
  ('super_admin', 'edit_finances'),
  ('super_admin', 'approve_withdrawals'),
  ('super_admin', 'adjust_balance'),
  ('super_admin', 'view_matches'),
  ('super_admin', 'cancel_matches'),
  ('super_admin', 'view_tournaments'),
  ('super_admin', 'manage_tournaments'),
  ('super_admin', 'view_logs'),
  ('super_admin', 'system_settings'),
  ('super_admin', 'payment_settings'),
  ('super_admin', 'manage_roles')
ON CONFLICT (role, permission) DO NOTHING;

-- Permissões do Admin Operacional
INSERT INTO role_permissions (role, permission) VALUES
  ('admin', 'view_users'),
  ('admin', 'edit_users'),
  ('admin', 'ban_users'),
  ('admin', 'view_finances'),
  ('admin', 'approve_withdrawals'),
  ('admin', 'view_matches'),
  ('admin', 'cancel_matches'),
  ('admin', 'view_tournaments'),
  ('admin', 'manage_tournaments'),
  ('admin', 'view_logs')
ON CONFLICT (role, permission) DO NOTHING;

-- Permissões do Moderador
INSERT INTO role_permissions (role, permission) VALUES
  ('moderator', 'view_users'),
  ('moderator', 'ban_users'),
  ('moderator', 'view_matches'),
  ('moderator', 'view_tournaments'),
  ('moderator', 'view_logs')
ON CONFLICT (role, permission) DO NOTHING;

-- Função para verificar permissão
CREATE OR REPLACE FUNCTION has_permission(user_id UUID, required_permission VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  user_role VARCHAR;
BEGIN
  SELECT role INTO user_role FROM users WHERE id = user_id;
  
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM role_permissions 
    WHERE role = user_role AND permission = required_permission
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
