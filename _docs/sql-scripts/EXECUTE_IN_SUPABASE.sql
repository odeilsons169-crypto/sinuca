-- =====================================================
-- EXECUTE ESTE SCRIPT NO SQL EDITOR DO SUPABASE
-- =====================================================
-- Este script adiciona todas as colunas necessárias
-- para o sistema funcionar corretamente.

-- 1. Adicionar colunas de CPF, Telefone e Nome Completo
ALTER TABLE users ADD COLUMN IF NOT EXISTS fullname VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf VARCHAR(11);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(15);

-- 2. Adicionar coluna is_admin
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 3. Adicionar colunas de localização
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code VARCHAR(2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS state_code VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS state_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- 4. Criar índices
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cpf_unique ON users(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country_code) WHERE country_code IS NOT NULL;

-- 5. Tabela de países disponíveis
CREATE TABLE IF NOT EXISTS available_countries (
  code VARCHAR(2) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  name_pt VARCHAR(100) NOT NULL,
  flag_emoji VARCHAR(10) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir países
INSERT INTO available_countries (code, name, name_pt, flag_emoji, is_active) VALUES
  ('BR', 'Brazil', 'Brasil', '🇧🇷', TRUE),
  ('US', 'United States', 'Estados Unidos', '🇺🇸', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 6. Tabela de estados do Brasil
CREATE TABLE IF NOT EXISTS states_br (
  code VARCHAR(2) PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

INSERT INTO states_br (code, name) VALUES
  ('AC', 'Acre'), ('AL', 'Alagoas'), ('AP', 'Amapá'), ('AM', 'Amazonas'),
  ('BA', 'Bahia'), ('CE', 'Ceará'), ('DF', 'Distrito Federal'), ('ES', 'Espírito Santo'),
  ('GO', 'Goiás'), ('MA', 'Maranhão'), ('MT', 'Mato Grosso'), ('MS', 'Mato Grosso do Sul'),
  ('MG', 'Minas Gerais'), ('PA', 'Pará'), ('PB', 'Paraíba'), ('PR', 'Paraná'),
  ('PE', 'Pernambuco'), ('PI', 'Piauí'), ('RJ', 'Rio de Janeiro'), ('RN', 'Rio Grande do Norte'),
  ('RS', 'Rio Grande do Sul'), ('RO', 'Rondônia'), ('RR', 'Roraima'), ('SC', 'Santa Catarina'),
  ('SP', 'São Paulo'), ('SE', 'Sergipe'), ('TO', 'Tocantins')
ON CONFLICT (code) DO NOTHING;

-- 7. Tabela de estados dos EUA
CREATE TABLE IF NOT EXISTS states_us (
  code VARCHAR(2) PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

INSERT INTO states_us (code, name) VALUES
  ('AL', 'Alabama'), ('AK', 'Alaska'), ('AZ', 'Arizona'), ('AR', 'Arkansas'),
  ('CA', 'California'), ('CO', 'Colorado'), ('CT', 'Connecticut'), ('DE', 'Delaware'),
  ('FL', 'Florida'), ('GA', 'Georgia'), ('HI', 'Hawaii'), ('ID', 'Idaho'),
  ('IL', 'Illinois'), ('IN', 'Indiana'), ('IA', 'Iowa'), ('KS', 'Kansas'),
  ('KY', 'Kentucky'), ('LA', 'Louisiana'), ('ME', 'Maine'), ('MD', 'Maryland'),
  ('MA', 'Massachusetts'), ('MI', 'Michigan'), ('MN', 'Minnesota'), ('MS', 'Mississippi'),
  ('MO', 'Missouri'), ('MT', 'Montana'), ('NE', 'Nebraska'), ('NV', 'Nevada'),
  ('NH', 'New Hampshire'), ('NJ', 'New Jersey'), ('NM', 'New Mexico'), ('NY', 'New York'),
  ('NC', 'North Carolina'), ('ND', 'North Dakota'), ('OH', 'Ohio'), ('OK', 'Oklahoma'),
  ('OR', 'Oregon'), ('PA', 'Pennsylvania'), ('RI', 'Rhode Island'), ('SC', 'South Carolina'),
  ('SD', 'South Dakota'), ('TN', 'Tennessee'), ('TX', 'Texas'), ('UT', 'Utah'),
  ('VT', 'Vermont'), ('VA', 'Virginia'), ('WA', 'Washington'), ('WV', 'West Virginia'),
  ('WI', 'Wisconsin'), ('WY', 'Wyoming'), ('DC', 'District of Columbia')
ON CONFLICT (code) DO NOTHING;

-- 8. Tabela de permissões por role
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(20) NOT NULL,
  permission VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, permission)
);

-- Inserir permissões
INSERT INTO role_permissions (role, permission) VALUES
  ('super_admin', 'all'),
  ('admin', 'manage_users'), ('admin', 'manage_finances'), ('admin', 'manage_employees'),
  ('manager', 'view_financial'), ('manager', 'manage_users'), ('manager', 'manage_withdrawals'),
  ('moderator', 'view_users'), ('moderator', 'ban_users'),
  ('employee', 'view_users'), ('employee', 'approve_withdrawals')
ON CONFLICT (role, permission) DO NOTHING;

-- 9. Tabela de convites para funcionários
CREATE TABLE IF NOT EXISTS employee_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  invited_by UUID NOT NULL REFERENCES users(id),
  invite_code VARCHAR(32) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. RLS para novas tabelas
ALTER TABLE available_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE states_br ENABLE ROW LEVEL SECURITY;
ALTER TABLE states_us ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_invites ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura pública para países/estados
DROP POLICY IF EXISTS "Anyone can read countries" ON available_countries;
CREATE POLICY "Anyone can read countries" ON available_countries FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Anyone can read BR states" ON states_br;
CREATE POLICY "Anyone can read BR states" ON states_br FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Anyone can read US states" ON states_us;
CREATE POLICY "Anyone can read US states" ON states_us FOR SELECT USING (TRUE);

-- Atualizar is_admin para usuários com role admin
UPDATE users SET is_admin = TRUE WHERE role IN ('admin', 'super_admin');

-- =====================================================
-- PRONTO! Agora você pode criar o Super Admin via API
-- =====================================================
