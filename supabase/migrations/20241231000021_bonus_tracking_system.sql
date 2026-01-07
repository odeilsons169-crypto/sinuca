-- =====================================================
-- MIGRATION: Sistema de Rastreamento de Bônus
-- Separa valores financeiros reais de bônus dados
-- =====================================================

-- 1. Tabela de Registro de Bônus (para controle administrativo)
-- Registra TODOS os bônus dados: admin, admissão, indique e ganhe, cupons
CREATE TABLE IF NOT EXISTS bonus_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES users(id), -- NULL se for automático (admissão, referral)
  bonus_type VARCHAR(50) NOT NULL, -- 'admin_credit', 'admin_balance', 'welcome', 'referral', 'coupon', 'mission', 'daily_free'
  amount DECIMAL(10,2) NOT NULL, -- Valor em R$ ou quantidade de créditos
  amount_type VARCHAR(20) NOT NULL DEFAULT 'credits', -- 'credits' ou 'balance'
  description TEXT,
  reference_id UUID, -- ID do cupom, referral, missão, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Receita Real (para controle financeiro)
-- Registra APENAS receitas reais: pagamentos, assinaturas, comissões
CREATE TABLE IF NOT EXISTS revenue_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Pode ser NULL para comissões de torneios
  revenue_type VARCHAR(50) NOT NULL, -- 'payment', 'subscription', 'credit_purchase', 'bet_commission', 'tournament_commission', 'tournament_entry'
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  reference_id UUID, -- ID do pagamento, assinatura, aposta, torneio
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_bonus_records_user ON bonus_records(user_id);
CREATE INDEX IF NOT EXISTS idx_bonus_records_type ON bonus_records(bonus_type);
CREATE INDEX IF NOT EXISTS idx_bonus_records_admin ON bonus_records(admin_id);
CREATE INDEX IF NOT EXISTS idx_bonus_records_created ON bonus_records(created_at);

CREATE INDEX IF NOT EXISTS idx_revenue_records_user ON revenue_records(user_id);
CREATE INDEX IF NOT EXISTS idx_revenue_records_type ON revenue_records(revenue_type);
CREATE INDEX IF NOT EXISTS idx_revenue_records_created ON revenue_records(created_at);

-- 4. RLS
ALTER TABLE bonus_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_records ENABLE ROW LEVEL SECURITY;

-- Políticas de Bônus
CREATE POLICY "Users can view own bonus records" ON bonus_records
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage bonus records" ON bonus_records
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin', 'manager') OR is_admin = true))
  );

-- Políticas de Receita
CREATE POLICY "Admins can view revenue records" ON revenue_records
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin', 'manager') OR is_admin = true))
  );

CREATE POLICY "System can insert revenue records" ON revenue_records
  FOR INSERT WITH CHECK (true);

-- 5. Função para registrar bônus dado pelo admin
CREATE OR REPLACE FUNCTION register_admin_bonus(
  p_admin_id UUID,
  p_user_id UUID,
  p_amount DECIMAL,
  p_amount_type VARCHAR,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_bonus_id UUID;
BEGIN
  INSERT INTO bonus_records (user_id, admin_id, bonus_type, amount, amount_type, description)
  VALUES (p_user_id, p_admin_id, 
    CASE WHEN p_amount_type = 'credits' THEN 'admin_credit' ELSE 'admin_balance' END,
    p_amount, p_amount_type, COALESCE(p_description, 'Bônus dado pelo administrador'))
  RETURNING id INTO v_bonus_id;
  
  RETURN v_bonus_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Função para registrar bônus de boas-vindas (admissão)
CREATE OR REPLACE FUNCTION register_welcome_bonus(
  p_user_id UUID,
  p_amount DECIMAL,
  p_amount_type VARCHAR DEFAULT 'credits'
)
RETURNS UUID AS $$
DECLARE
  v_bonus_id UUID;
BEGIN
  INSERT INTO bonus_records (user_id, bonus_type, amount, amount_type, description)
  VALUES (p_user_id, 'welcome', p_amount, p_amount_type, 'Bônus de boas-vindas')
  RETURNING id INTO v_bonus_id;
  
  RETURN v_bonus_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Função para registrar bônus de indicação
CREATE OR REPLACE FUNCTION register_referral_bonus(
  p_user_id UUID,
  p_amount DECIMAL,
  p_referral_id UUID,
  p_amount_type VARCHAR DEFAULT 'credits'
)
RETURNS UUID AS $$
DECLARE
  v_bonus_id UUID;
BEGIN
  INSERT INTO bonus_records (user_id, bonus_type, amount, amount_type, description, reference_id)
  VALUES (p_user_id, 'referral', p_amount, p_amount_type, 'Bônus de indicação', p_referral_id)
  RETURNING id INTO v_bonus_id;
  
  RETURN v_bonus_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Função para registrar bônus de cupom
CREATE OR REPLACE FUNCTION register_coupon_bonus(
  p_user_id UUID,
  p_amount DECIMAL,
  p_coupon_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_bonus_id UUID;
BEGIN
  INSERT INTO bonus_records (user_id, bonus_type, amount, amount_type, description, reference_id)
  VALUES (p_user_id, 'coupon', p_amount, 'balance', 'Desconto de cupom aplicado', p_coupon_id)
  RETURNING id INTO v_bonus_id;
  
  RETURN v_bonus_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Função para registrar receita real
CREATE OR REPLACE FUNCTION register_revenue(
  p_user_id UUID,
  p_revenue_type VARCHAR,
  p_amount DECIMAL,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_revenue_id UUID;
BEGIN
  INSERT INTO revenue_records (user_id, revenue_type, amount, description, reference_id)
  VALUES (p_user_id, p_revenue_type, p_amount, p_description, p_reference_id)
  RETURNING id INTO v_revenue_id;
  
  RETURN v_revenue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. View para resumo de bônus por período
CREATE OR REPLACE VIEW bonus_summary AS
SELECT 
  DATE_TRUNC('month', created_at) as month,
  bonus_type,
  amount_type,
  COUNT(*) as total_count,
  SUM(amount) as total_amount,
  COUNT(DISTINCT user_id) as unique_users
FROM bonus_records
GROUP BY DATE_TRUNC('month', created_at), bonus_type, amount_type
ORDER BY month DESC, bonus_type;

-- 11. View para resumo de receita por período
CREATE OR REPLACE VIEW revenue_summary AS
SELECT 
  DATE_TRUNC('month', created_at) as month,
  revenue_type,
  COUNT(*) as total_count,
  SUM(amount) as total_amount,
  COUNT(DISTINCT user_id) as unique_users
FROM revenue_records
GROUP BY DATE_TRUNC('month', created_at), revenue_type
ORDER BY month DESC, revenue_type;

-- 12. Função para obter dashboard financeiro completo
CREATE OR REPLACE FUNCTION get_financial_dashboard(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
  v_end_date TIMESTAMPTZ;
  v_result JSON;
BEGIN
  v_start_date := COALESCE(p_start_date, DATE_TRUNC('month', NOW()));
  v_end_date := COALESCE(p_end_date, NOW());
  
  SELECT json_build_object(
    'period', json_build_object(
      'start', v_start_date,
      'end', v_end_date
    ),
    'revenue', (
      SELECT json_build_object(
        'total', COALESCE(SUM(amount), 0),
        'by_type', (
          SELECT json_object_agg(revenue_type, total)
          FROM (
            SELECT revenue_type, SUM(amount) as total
            FROM revenue_records
            WHERE created_at BETWEEN v_start_date AND v_end_date
            GROUP BY revenue_type
          ) sub
        )
      )
      FROM revenue_records
      WHERE created_at BETWEEN v_start_date AND v_end_date
    ),
    'bonus', (
      SELECT json_build_object(
        'total_credits', COALESCE(SUM(CASE WHEN amount_type = 'credits' THEN amount ELSE 0 END), 0),
        'total_balance', COALESCE(SUM(CASE WHEN amount_type = 'balance' THEN amount ELSE 0 END), 0),
        'by_type', (
          SELECT json_object_agg(bonus_type, total)
          FROM (
            SELECT bonus_type, SUM(amount) as total
            FROM bonus_records
            WHERE created_at BETWEEN v_start_date AND v_end_date
            GROUP BY bonus_type
          ) sub
        ),
        'admin_given', (
          SELECT json_build_object(
            'credits', COALESCE(SUM(CASE WHEN amount_type = 'credits' THEN amount ELSE 0 END), 0),
            'balance', COALESCE(SUM(CASE WHEN amount_type = 'balance' THEN amount ELSE 0 END), 0)
          )
          FROM bonus_records
          WHERE created_at BETWEEN v_start_date AND v_end_date
          AND admin_id IS NOT NULL
        )
      )
      FROM bonus_records
      WHERE created_at BETWEEN v_start_date AND v_end_date
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Grant permissions
GRANT EXECUTE ON FUNCTION register_admin_bonus TO authenticated;
GRANT EXECUTE ON FUNCTION register_welcome_bonus TO authenticated;
GRANT EXECUTE ON FUNCTION register_referral_bonus TO authenticated;
GRANT EXECUTE ON FUNCTION register_coupon_bonus TO authenticated;
GRANT EXECUTE ON FUNCTION register_revenue TO authenticated;
GRANT EXECUTE ON FUNCTION get_financial_dashboard TO authenticated;
