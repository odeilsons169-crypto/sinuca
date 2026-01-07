-- =====================================================
-- MIGRATION: Sistema de Permissões Administrativas
-- =====================================================

-- 1. Adicionar campo is_admin se não existir
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. Atualizar is_admin baseado no role existente
UPDATE users SET is_admin = TRUE WHERE role::text IN ('admin', 'super_admin');

-- 3. Criar tabela de permissões por role
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(20) NOT NULL,
  permission VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, permission)
);

-- 4. Inserir permissões por role
INSERT INTO role_permissions (role, permission) VALUES
  ('super_admin', 'all'),
  ('super_admin', 'manage_admins'),
  ('super_admin', 'manage_settings'),
  ('super_admin', 'manage_payments'),
  ('super_admin', 'view_financial'),
  ('super_admin', 'manage_users'),
  ('super_admin', 'manage_matches'),
  ('super_admin', 'manage_tournaments'),
  ('super_admin', 'manage_withdrawals'),
  ('super_admin', 'view_logs'),
  ('super_admin', 'export_data'),
  ('super_admin', 'manage_employees'),
  ('admin', 'manage_settings'),
  ('admin', 'manage_payments'),
  ('admin', 'view_financial'),
  ('admin', 'manage_users'),
  ('admin', 'manage_matches'),
  ('admin', 'manage_tournaments'),
  ('admin', 'manage_withdrawals'),
  ('admin', 'view_logs'),
  ('admin', 'export_data'),
  ('admin', 'manage_employees'),
  ('manager', 'view_financial'),
  ('manager', 'manage_users'),
  ('manager', 'manage_matches'),
  ('manager', 'manage_tournaments'),
  ('manager', 'manage_withdrawals'),
  ('manager', 'view_logs'),
  ('employee', 'view_users'),
  ('employee', 'view_matches'),
  ('employee', 'view_withdrawals'),
  ('employee', 'approve_withdrawals'),
  ('employee', 'view_logs'),
  ('moderator', 'view_users'),
  ('moderator', 'ban_users'),
  ('moderator', 'view_matches'),
  ('moderator', 'view_logs')
ON CONFLICT (role, permission) DO NOTHING;

-- 5. Função para verificar permissão (drop primeiro para evitar conflito)
DROP FUNCTION IF EXISTS has_permission(UUID, VARCHAR);
CREATE FUNCTION has_permission(p_uid UUID, p_perm VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  v_role VARCHAR;
BEGIN
  SELECT role::text INTO v_role FROM users WHERE id = p_uid;
  IF v_role IS NULL THEN RETURN FALSE; END IF;
  IF v_role = 'super_admin' THEN RETURN TRUE; END IF;
  RETURN EXISTS (SELECT 1 FROM role_permissions WHERE role = v_role AND (permission = p_perm OR permission = 'all'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Função para listar permissões de um usuário
DROP FUNCTION IF EXISTS get_user_permissions(UUID);
CREATE FUNCTION get_user_permissions(p_uid UUID)
RETURNS TABLE(permission VARCHAR) AS $$
DECLARE
  v_role VARCHAR;
BEGIN
  SELECT role::text INTO v_role FROM users WHERE id = p_uid;
  IF v_role = 'super_admin' THEN RETURN QUERY SELECT 'all'::VARCHAR; RETURN; END IF;
  RETURN QUERY SELECT rp.permission FROM role_permissions rp WHERE rp.role = v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Tabela de convites para funcionários
CREATE TABLE IF NOT EXISTS employee_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('employee', 'manager', 'moderator')),
  invited_by UUID NOT NULL REFERENCES users(id),
  invite_code VARCHAR(32) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_invites_code ON employee_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_employee_invites_email ON employee_invites(email);

-- 8. RLS para tabelas administrativas
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read permissions" ON role_permissions;
CREATE POLICY "Admins can read permissions" ON role_permissions FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role::text IN ('admin', 'super_admin', 'manager')));

DROP POLICY IF EXISTS "Admins can manage invites" ON employee_invites;
CREATE POLICY "Admins can manage invites" ON employee_invites FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role::text IN ('admin', 'super_admin')));

-- 9. View para listar funcionários
CREATE OR REPLACE VIEW admin_employees AS
SELECT u.id, u.username, u.email, u.fullname, u.role::text as role, u.is_admin, u.created_at, u.last_login_at, u.status::text as status
FROM users u
WHERE u.role::text IN ('employee', 'manager', 'moderator', 'admin', 'super_admin')
ORDER BY CASE u.role::text WHEN 'super_admin' THEN 1 WHEN 'admin' THEN 2 WHEN 'manager' THEN 3 WHEN 'moderator' THEN 4 WHEN 'employee' THEN 5 END, u.created_at DESC;
