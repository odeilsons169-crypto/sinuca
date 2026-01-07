-- =====================================================
-- MIGRATION: Funções auxiliares para cupons
-- =====================================================

-- Função para incrementar usos de cupom
CREATE OR REPLACE FUNCTION increment_coupon_uses(coupon_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE coupons 
  SET current_uses = current_uses + 1, updated_at = NOW()
  WHERE id = coupon_id;
END;
$$ LANGUAGE plpgsql;

-- Função para incrementar créditos
CREATE OR REPLACE FUNCTION increment_credits(p_user_id UUID, p_amount INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_new_amount INTEGER;
BEGIN
  UPDATE credits 
  SET amount = amount + p_amount, updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING amount INTO v_new_amount;
  
  RETURN v_new_amount;
END;
$$ LANGUAGE plpgsql;
