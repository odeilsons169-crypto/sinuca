-- =====================================================
-- SEED DATA - DADOS INICIAIS
-- =====================================================

-- =====================================================
-- SUPER ADMIN - CREDENCIAIS
-- =====================================================
-- Email: admin@sinuca.online
-- Senha: Admin@2024!
-- Username: SuperAdmin
-- 
-- IMPORTANTE: Altere a senha após o primeiro login!
-- =====================================================

-- Nota: O usuário admin deve ser criado via Supabase Auth primeiro
-- Use o painel do Supabase ou a API para criar o usuário com:
-- - Email: admin@sinuca.online
-- - Password: Admin@2024!

-- Após criar via Auth, execute este SQL para configurar como super_admin:
/*
UPDATE users 
SET 
  role = 'super_admin',
  is_admin = true,
  username = 'SuperAdmin',
  fullname = 'Administrador do Sistema',
  status = 'active'
WHERE email = 'admin@sinuca.online';
*/

-- =====================================================
-- CONFIGURAÇÕES PADRÃO DO SISTEMA
-- =====================================================

-- Inserir configurações padrão se não existirem
INSERT INTO system_settings (key, value, updated_at) VALUES
  ('credits_price_per_unit', '0.50', NOW()),
  ('free_credits_on_register', '2', NOW()),
  ('daily_free_credits', '0', NOW()),
  ('platform_fee_percent', '10', NOW()),
  ('min_bet_amount', '5.00', NOW()),
  ('max_bet_amount', '1000.00', NOW()),
  ('bet_enabled', 'true', NOW()),
  ('casual_mode_enabled', 'true', NOW()),
  ('ranked_mode_enabled', 'true', NOW()),
  ('bet_mode_enabled', 'true', NOW()),
  ('ai_mode_enabled', 'false', NOW()),
  ('credits_per_match', '1', NOW()),
  ('match_timeout_minutes', '30', NOW()),
  ('turn_timeout_seconds', '60', NOW()),
  ('points_per_win', '25', NOW()),
  ('points_per_loss', '-10', NOW()),
  ('max_rooms_per_user', '1', NOW()),
  ('max_daily_matches', '50', NOW()),
  ('maintenance_mode', 'false', NOW()),
  ('maintenance_message', 'Sistema em manutenção. Voltamos em breve!', NOW())
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- VALORES DE REFERÊNCIA
-- =====================================================
-- R$2 = 4 créditos
-- 1 crédito = 1 partida
-- Taxa da plataforma: 10%
-- Aposta mínima: R$5
-- Máximo de salas por usuário: 1
