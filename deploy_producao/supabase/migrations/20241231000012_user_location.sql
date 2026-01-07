-- =====================================================
-- MIGRATION: Localização do Usuário (País, Estado, Cidade)
-- =====================================================
-- Objetivo: Adicionar informações de localização para segurança
-- - País (com código ISO para bandeira)
-- - Estado/Província
-- - Cidade

-- Adicionar colunas na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code VARCHAR(2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS state_code VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS state_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- Criar índices para busca
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country_code) WHERE country_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_state ON users(state_code) WHERE state_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city) WHERE city IS NOT NULL;

-- Comentários nas colunas
COMMENT ON COLUMN users.country_code IS 'Código ISO 3166-1 alpha-2 do país (BR, US, etc)';
COMMENT ON COLUMN users.country_name IS 'Nome do país';
COMMENT ON COLUMN users.state_code IS 'Código do estado/província';
COMMENT ON COLUMN users.state_name IS 'Nome do estado/província';
COMMENT ON COLUMN users.city IS 'Nome da cidade';

-- Tabela de países disponíveis
CREATE TABLE IF NOT EXISTS available_countries (
  code VARCHAR(2) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  name_pt VARCHAR(100) NOT NULL,
  flag_emoji VARCHAR(10) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir países disponíveis (Brasil e EUA por enquanto)
INSERT INTO available_countries (code, name, name_pt, flag_emoji, is_active) VALUES
  ('BR', 'Brazil', 'Brasil', '🇧🇷', TRUE),
  ('US', 'United States', 'Estados Unidos', '🇺🇸', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Tabela de estados do Brasil
CREATE TABLE IF NOT EXISTS states_br (
  code VARCHAR(2) PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

INSERT INTO states_br (code, name) VALUES
  ('AC', 'Acre'),
  ('AL', 'Alagoas'),
  ('AP', 'Amapá'),
  ('AM', 'Amazonas'),
  ('BA', 'Bahia'),
  ('CE', 'Ceará'),
  ('DF', 'Distrito Federal'),
  ('ES', 'Espírito Santo'),
  ('GO', 'Goiás'),
  ('MA', 'Maranhão'),
  ('MT', 'Mato Grosso'),
  ('MS', 'Mato Grosso do Sul'),
  ('MG', 'Minas Gerais'),
  ('PA', 'Pará'),
  ('PB', 'Paraíba'),
  ('PR', 'Paraná'),
  ('PE', 'Pernambuco'),
  ('PI', 'Piauí'),
  ('RJ', 'Rio de Janeiro'),
  ('RN', 'Rio Grande do Norte'),
  ('RS', 'Rio Grande do Sul'),
  ('RO', 'Rondônia'),
  ('RR', 'Roraima'),
  ('SC', 'Santa Catarina'),
  ('SP', 'São Paulo'),
  ('SE', 'Sergipe'),
  ('TO', 'Tocantins')
ON CONFLICT (code) DO NOTHING;

-- Tabela de estados dos EUA
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

-- RLS para tabelas de localização (leitura pública)
ALTER TABLE available_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE states_br ENABLE ROW LEVEL SECURITY;
ALTER TABLE states_us ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read countries" ON available_countries FOR SELECT USING (TRUE);
CREATE POLICY "Anyone can read BR states" ON states_br FOR SELECT USING (TRUE);
CREATE POLICY "Anyone can read US states" ON states_us FOR SELECT USING (TRUE);
