-- =====================================================
-- MIGRATION: Funções auxiliares para indicações
-- =====================================================

-- Função para incrementar contador de indicações
CREATE OR REPLACE FUNCTION increment_referral_count(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users 
  SET referral_count = COALESCE(referral_count, 0) + 1
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Função para incrementar ganhos de indicação
CREATE OR REPLACE FUNCTION increment_referral_earnings(user_id UUID, amount INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_new_amount INTEGER;
BEGIN
  UPDATE users 
  SET referral_earnings = COALESCE(referral_earnings, 0) + amount
  WHERE id = user_id
  RETURNING referral_earnings INTO v_new_amount;
  
  RETURN v_new_amount;
END;
$$ LANGUAGE plpgsql;
