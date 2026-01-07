-- =====================================================
-- MIGRATION: Integração de Pagamentos Gerencianet/Efí
-- =====================================================

-- 1. Adicionar campos de segregação de saldo na wallet
ALTER TABLE wallet 
ADD COLUMN IF NOT EXISTS deposit_balance DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS winnings_balance DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS bonus_balance DECIMAL(10,2) DEFAULT 0.00;

UPDATE wallet SET winnings_balance = balance WHERE balance > 0 AND winnings_balance = 0;

-- 2. Tabela de configurações de pagamento
CREATE TABLE IF NOT EXISTS payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment VARCHAR(20) NOT NULL DEFAULT 'sandbox',
  client_id TEXT,
  client_secret TEXT,
  certificate_path TEXT,
  certificate_uploaded_at TIMESTAMPTZ,
  pix_key TEXT,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO payment_settings (environment, is_active) 
VALUES ('sandbox', false)
ON CONFLICT DO NOTHING;

-- 3. Adicionar colunas faltantes na tabela payments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'external_id') THEN
    ALTER TABLE payments ADD COLUMN external_id VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'txid') THEN
    ALTER TABLE payments ADD COLUMN txid VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'method') THEN
    ALTER TABLE payments ADD COLUMN method VARCHAR(20) DEFAULT 'pix';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'amount_brl') THEN
    ALTER TABLE payments ADD COLUMN amount_brl DECIMAL(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'credits_amount') THEN
    ALTER TABLE payments ADD COLUMN credits_amount INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'payer_name') THEN
    ALTER TABLE payments ADD COLUMN payer_name VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'payer_cpf') THEN
    ALTER TABLE payments ADD COLUMN payer_cpf VARCHAR(14);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'pix_qrcode') THEN
    ALTER TABLE payments ADD COLUMN pix_qrcode TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'pix_copy_paste') THEN
    ALTER TABLE payments ADD COLUMN pix_copy_paste TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'pix_expiration') THEN
    ALTER TABLE payments ADD COLUMN pix_expiration TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'card_last_four') THEN
    ALTER TABLE payments ADD COLUMN card_last_four VARCHAR(4);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'card_brand') THEN
    ALTER TABLE payments ADD COLUMN card_brand VARCHAR(20);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'paid_at') THEN
    ALTER TABLE payments ADD COLUMN paid_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'refunded_at') THEN
    ALTER TABLE payments ADD COLUMN refunded_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'metadata') THEN
    ALTER TABLE payments ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- 4. Índices para payments
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_external_id ON payments(external_id);
CREATE INDEX IF NOT EXISTS idx_payments_txid ON payments(txid);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- 5. Tabela de saques
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  fee DECIMAL(10,2) DEFAULT 0.00,
  net_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  pix_key TEXT NOT NULL,
  pix_key_type VARCHAR(20) NOT NULL,
  rejection_reason TEXT,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- 6. Atualizar tabela transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS balance_type VARCHAR(20) DEFAULT 'deposit';


-- 7. Function para calcular saldo disponível para saque
CREATE OR REPLACE FUNCTION get_withdrawable_balance(p_user_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  v_winnings DECIMAL(10,2);
  v_bonus DECIMAL(10,2);
BEGIN
  SELECT COALESCE(winnings_balance, 0), COALESCE(bonus_balance, 0)
  INTO v_winnings, v_bonus
  FROM wallet WHERE user_id = p_user_id;
  RETURN COALESCE(v_winnings, 0) + COALESCE(v_bonus, 0);
END;
$$ LANGUAGE plpgsql;

-- 8. Function para adicionar saldo de depósito
CREATE OR REPLACE FUNCTION add_deposit_balance(p_user_id UUID, p_amount DECIMAL(10,2), p_description TEXT DEFAULT 'Depósito')
RETURNS VOID AS $$
BEGIN
  UPDATE wallet SET balance = balance + p_amount, deposit_balance = deposit_balance + p_amount, updated_at = NOW() WHERE user_id = p_user_id;
  INSERT INTO transactions (user_id, type, amount, balance_type, description) VALUES (p_user_id, 'deposit', p_amount, 'deposit', p_description);
END;
$$ LANGUAGE plpgsql;

-- 9. Function para adicionar saldo de ganhos
CREATE OR REPLACE FUNCTION add_winnings_balance(p_user_id UUID, p_amount DECIMAL(10,2), p_description TEXT DEFAULT 'Ganhos')
RETURNS VOID AS $$
BEGIN
  UPDATE wallet SET balance = balance + p_amount, winnings_balance = winnings_balance + p_amount, updated_at = NOW() WHERE user_id = p_user_id;
  INSERT INTO transactions (user_id, type, amount, balance_type, description) VALUES (p_user_id, 'winnings', p_amount, 'winnings', p_description);
END;
$$ LANGUAGE plpgsql;

-- 10. Function para adicionar bônus
CREATE OR REPLACE FUNCTION add_bonus_balance(p_user_id UUID, p_amount DECIMAL(10,2), p_description TEXT DEFAULT 'Bônus')
RETURNS VOID AS $$
BEGIN
  UPDATE wallet SET balance = balance + p_amount, bonus_balance = bonus_balance + p_amount, updated_at = NOW() WHERE user_id = p_user_id;
  INSERT INTO transactions (user_id, type, amount, balance_type, description) VALUES (p_user_id, 'bonus', p_amount, 'bonus', p_description);
END;
$$ LANGUAGE plpgsql;

-- 11. Function para debitar saldo
CREATE OR REPLACE FUNCTION debit_balance(p_user_id UUID, p_amount DECIMAL(10,2), p_description TEXT DEFAULT 'Débito')
RETURNS BOOLEAN AS $$
DECLARE
  v_wallet RECORD;
  v_remaining DECIMAL(10,2);
  v_from_deposit DECIMAL(10,2) := 0;
  v_from_winnings DECIMAL(10,2) := 0;
  v_from_bonus DECIMAL(10,2) := 0;
BEGIN
  SELECT * INTO v_wallet FROM wallet WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet.balance < p_amount THEN RETURN FALSE; END IF;
  v_remaining := p_amount;
  IF v_remaining > 0 AND v_wallet.deposit_balance > 0 THEN
    v_from_deposit := LEAST(v_remaining, v_wallet.deposit_balance);
    v_remaining := v_remaining - v_from_deposit;
  END IF;
  IF v_remaining > 0 AND v_wallet.bonus_balance > 0 THEN
    v_from_bonus := LEAST(v_remaining, v_wallet.bonus_balance);
    v_remaining := v_remaining - v_from_bonus;
  END IF;
  IF v_remaining > 0 AND v_wallet.winnings_balance > 0 THEN
    v_from_winnings := LEAST(v_remaining, v_wallet.winnings_balance);
    v_remaining := v_remaining - v_from_winnings;
  END IF;
  UPDATE wallet SET balance = balance - p_amount, deposit_balance = deposit_balance - v_from_deposit, bonus_balance = bonus_balance - v_from_bonus, winnings_balance = winnings_balance - v_from_winnings, updated_at = NOW() WHERE user_id = p_user_id;
  INSERT INTO transactions (user_id, type, amount, description) VALUES (p_user_id, 'debit', -p_amount, p_description);
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 12. Function para processar saque
CREATE OR REPLACE FUNCTION process_withdrawal(p_user_id UUID, p_amount DECIMAL(10,2))
RETURNS TABLE(success BOOLEAN, error_message TEXT) AS $$
DECLARE
  v_wallet RECORD;
  v_withdrawable DECIMAL(10,2);
  v_from_winnings DECIMAL(10,2) := 0;
  v_from_bonus DECIMAL(10,2) := 0;
  v_remaining DECIMAL(10,2);
BEGIN
  SELECT * INTO v_wallet FROM wallet WHERE user_id = p_user_id FOR UPDATE;
  v_withdrawable := COALESCE(v_wallet.winnings_balance, 0) + COALESCE(v_wallet.bonus_balance, 0);
  IF v_withdrawable < p_amount THEN
    RETURN QUERY SELECT FALSE, 'Apenas ganhos e premiações estão disponíveis para saque.';
    RETURN;
  END IF;
  v_remaining := p_amount;
  IF v_remaining > 0 AND v_wallet.winnings_balance > 0 THEN
    v_from_winnings := LEAST(v_remaining, v_wallet.winnings_balance);
    v_remaining := v_remaining - v_from_winnings;
  END IF;
  IF v_remaining > 0 AND v_wallet.bonus_balance > 0 THEN
    v_from_bonus := LEAST(v_remaining, v_wallet.bonus_balance);
    v_remaining := v_remaining - v_from_bonus;
  END IF;
  UPDATE wallet SET balance = balance - p_amount, winnings_balance = winnings_balance - v_from_winnings, bonus_balance = bonus_balance - v_from_bonus, updated_at = NOW() WHERE user_id = p_user_id;
  INSERT INTO transactions (user_id, type, amount, balance_type, description) VALUES (p_user_id, 'withdrawal', -p_amount, 'winnings', 'Saque solicitado');
  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 13. RLS Policies
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage payment_settings" ON payment_settings;
CREATE POLICY "Admins can manage payment_settings" ON payment_settings FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
CREATE POLICY "Users can view own payments" ON payments FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create payments" ON payments;
CREATE POLICY "Users can create payments" ON payments FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own withdrawals" ON withdrawals;
CREATE POLICY "Users can view own withdrawals" ON withdrawals FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create withdrawals" ON withdrawals;
CREATE POLICY "Users can create withdrawals" ON withdrawals FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all payments" ON payments;
CREATE POLICY "Admins can view all payments" ON payments FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage withdrawals" ON withdrawals;
CREATE POLICY "Admins can manage withdrawals" ON withdrawals FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- 14. Triggers
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payments_updated_at ON payments;
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS withdrawals_updated_at ON withdrawals;
CREATE TRIGGER withdrawals_updated_at BEFORE UPDATE ON withdrawals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS payment_settings_updated_at ON payment_settings;
CREATE TRIGGER payment_settings_updated_at BEFORE UPDATE ON payment_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
