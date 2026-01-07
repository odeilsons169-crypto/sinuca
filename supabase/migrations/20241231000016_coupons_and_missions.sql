-- =====================================================
-- MIGRATION: Sistema de Cupons e Missões
-- =====================================================

-- 1. Tabela de Cupons de Desconto
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage', -- 'percentage' ou 'fixed'
  discount_value DECIMAL(10,2) NOT NULL, -- Porcentagem ou valor fixo
  min_purchase DECIMAL(10,2) DEFAULT 0, -- Compra mínima para usar
  max_discount DECIMAL(10,2), -- Desconto máximo (para porcentagem)
  max_uses INTEGER, -- Limite total de usos (null = ilimitado)
  max_uses_per_user INTEGER DEFAULT 1, -- Limite por usuário
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Uso de Cupons
CREATE TABLE IF NOT EXISTS coupon_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id),
  discount_applied DECIMAL(10,2) NOT NULL,
  original_amount DECIMAL(10,2) NOT NULL,
  final_amount DECIMAL(10,2) NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Missões/Competições
CREATE TABLE IF NOT EXISTS missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'special', 'achievement'
  requirement_type VARCHAR(50) NOT NULL, -- 'wins', 'matches', 'streak', 'points', 'deposit', 'invite'
  requirement_value INTEGER NOT NULL, -- Quantidade necessária
  reward_type VARCHAR(50) NOT NULL DEFAULT 'credits', -- 'credits', 'bonus_balance', 'vip_days'
  reward_value INTEGER NOT NULL, -- Quantidade de recompensa
  icon VARCHAR(10) DEFAULT '🎯',
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  max_completions INTEGER, -- Limite total de completações (null = ilimitado)
  current_completions INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Progresso de Missões dos Usuários
CREATE TABLE IF NOT EXISTS user_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  reward_claimed BOOLEAN DEFAULT false,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, mission_id)
);

-- 5. Tabela de Ajustes de Créditos (Admin)
CREATE TABLE IF NOT EXISTS credit_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL, -- Positivo = adicionar, Negativo = remover
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active, valid_until);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_user ON coupon_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_coupon ON coupon_uses(coupon_id);
CREATE INDEX IF NOT EXISTS idx_missions_active ON missions(is_active, type);
CREATE INDEX IF NOT EXISTS idx_user_missions_user ON user_missions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_missions_mission ON user_missions(mission_id);
CREATE INDEX IF NOT EXISTS idx_credit_adjustments_user ON credit_adjustments(user_id);

-- RLS
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_adjustments ENABLE ROW LEVEL SECURITY;

-- Políticas de Cupons
CREATE POLICY "Anyone can view active coupons" ON coupons
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage coupons" ON coupons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true))
  );

-- Políticas de Uso de Cupons
CREATE POLICY "Users can view own coupon uses" ON coupon_uses
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can use coupons" ON coupon_uses
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all coupon uses" ON coupon_uses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin', 'manager') OR is_admin = true))
  );

-- Políticas de Missões
CREATE POLICY "Anyone can view active missions" ON missions
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage missions" ON missions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin', 'manager') OR is_admin = true))
  );

-- Políticas de Progresso de Missões
CREATE POLICY "Users can view own mission progress" ON user_missions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own mission progress" ON user_missions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Admins can view all mission progress" ON user_missions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin', 'manager') OR is_admin = true))
  );

-- Políticas de Ajustes de Créditos
CREATE POLICY "Admins can manage credit adjustments" ON credit_adjustments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin', 'manager') OR is_admin = true))
  );

CREATE POLICY "Users can view own credit adjustments" ON credit_adjustments
  FOR SELECT USING (user_id = auth.uid());

-- Triggers de updated_at
CREATE TRIGGER coupons_updated_at BEFORE UPDATE ON coupons 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER missions_updated_at BEFORE UPDATE ON missions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_missions_updated_at BEFORE UPDATE ON user_missions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Inserir algumas missões padrão
INSERT INTO missions (title, description, type, requirement_type, requirement_value, reward_type, reward_value, icon, is_active) VALUES
  ('Primeira Vitória', 'Vença sua primeira partida', 'achievement', 'wins', 1, 'credits', 5, '🏆', true),
  ('Jogador Dedicado', 'Jogue 10 partidas', 'achievement', 'matches', 10, 'credits', 10, '🎮', true),
  ('Mestre da Sinuca', 'Vença 50 partidas', 'achievement', 'wins', 50, 'credits', 50, '👑', true),
  ('Sequência de Vitórias', 'Vença 3 partidas seguidas', 'achievement', 'streak', 3, 'credits', 15, '🔥', true),
  ('Partida Diária', 'Jogue uma partida hoje', 'daily', 'matches', 1, 'credits', 1, '📅', true),
  ('Vitória Diária', 'Vença uma partida hoje', 'daily', 'wins', 1, 'credits', 2, '⭐', true)
ON CONFLICT DO NOTHING;
