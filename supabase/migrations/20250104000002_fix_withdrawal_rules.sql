-- =====================================================
-- CORREÇÃO DAS REGRAS DE SAQUE
-- Apenas winnings_balance pode ser sacado (não bônus)
-- Adiciona configuração de valor mínimo de saque
-- =====================================================

-- 1. Adicionar configuração de valor mínimo de saque
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS min_withdrawal_amount DECIMAL(10,2) DEFAULT 10.00;
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS max_withdrawal_amount DECIMAL(10,2) DEFAULT 10000.00;
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS withdrawal_fee_percent DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS withdrawal_fee_fixed DECIMAL(10,2) DEFAULT 0.00;

-- 2. Atualizar função get_withdrawable_balance para retornar APENAS winnings_balance
CREATE OR REPLACE FUNCTION get_withdrawable_balance(p_user_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  v_winnings DECIMAL(10,2);
BEGIN
  -- APENAS winnings_balance pode ser sacado
  -- bonus_balance NÃO pode ser sacado
  -- deposit_balance deve ser usado em partidas
  SELECT COALESCE(winnings_balance, 0) INTO v_winnings
  FROM wallet
  WHERE user_id = p_user_id;
  
  RETURN COALESCE(v_winnings, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Atualizar função process_withdrawal para debitar APENAS de winnings_balance
CREATE OR REPLACE FUNCTION process_withdrawal(p_user_id UUID, p_amount DECIMAL(10,2))
RETURNS TABLE(success BOOLEAN, error_message TEXT) AS $$
DECLARE
  v_wallet RECORD;
  v_withdrawable DECIMAL(10,2);
  v_min_amount DECIMAL(10,2);
  v_max_amount DECIMAL(10,2);
BEGIN
  -- Buscar configurações de saque
  SELECT 
    COALESCE(min_withdrawal_amount, 10.00),
    COALESCE(max_withdrawal_amount, 10000.00)
  INTO v_min_amount, v_max_amount
  FROM payment_settings
  LIMIT 1;
  
  -- Validar valor mínimo
  IF p_amount < v_min_amount THEN
    RETURN QUERY SELECT FALSE, format('Valor mínimo para saque é R$ %s', v_min_amount);
    RETURN;
  END IF;
  
  -- Validar valor máximo
  IF p_amount > v_max_amount THEN
    RETURN QUERY SELECT FALSE, format('Valor máximo para saque é R$ %s', v_max_amount);
    RETURN;
  END IF;
  
  -- Bloquear a linha da carteira para evitar race conditions
  SELECT * INTO v_wallet FROM wallet WHERE user_id = p_user_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Carteira não encontrada';
    RETURN;
  END IF;
  
  -- APENAS winnings_balance pode ser sacado
  v_withdrawable := COALESCE(v_wallet.winnings_balance, 0);
  
  IF v_withdrawable < p_amount THEN
    RETURN QUERY SELECT FALSE, format('Saldo insuficiente para saque. Disponível: R$ %s. Apenas ganhos de partidas podem ser sacados.', v_withdrawable);
    RETURN;
  END IF;
  
  -- Debitar APENAS de winnings_balance
  UPDATE wallet 
  SET 
    balance = balance - p_amount,
    winnings_balance = winnings_balance - p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Registrar transação
  INSERT INTO transactions (user_id, type, amount, balance_type, description)
  VALUES (p_user_id, 'withdrawal', -p_amount, 'winnings', 'Saque solicitado - aguardando aprovação');
  
  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Função para devolver saldo quando saque é rejeitado/cancelado
CREATE OR REPLACE FUNCTION add_winnings_balance(p_user_id UUID, p_amount DECIMAL(10,2), p_description TEXT DEFAULT 'Crédito de ganhos')
RETURNS VOID AS $$
BEGIN
  UPDATE wallet 
  SET 
    balance = balance + p_amount,
    winnings_balance = winnings_balance + p_amount,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  INSERT INTO transactions (user_id, type, amount, balance_type, description)
  VALUES (p_user_id, 'winnings_credit', p_amount, 'winnings', p_description);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Garantir que a tabela payment_settings tenha pelo menos uma linha
INSERT INTO payment_settings (id, min_withdrawal_amount, max_withdrawal_amount)
SELECT gen_random_uuid(), 10.00, 10000.00
WHERE NOT EXISTS (SELECT 1 FROM payment_settings);

-- 6. Comentários explicativos
COMMENT ON COLUMN wallet.deposit_balance IS 'Saldo de depósitos - deve ser usado em partidas, NÃO pode ser sacado';
COMMENT ON COLUMN wallet.winnings_balance IS 'Saldo de ganhos/prêmios - PODE ser sacado';
COMMENT ON COLUMN wallet.bonus_balance IS 'Saldo de bônus - NÃO pode ser sacado, apenas usado em partidas';
COMMENT ON COLUMN payment_settings.min_withdrawal_amount IS 'Valor mínimo para solicitar saque';
COMMENT ON COLUMN payment_settings.max_withdrawal_amount IS 'Valor máximo para solicitar saque';
