-- =====================================================
-- MIGRATION: Sistema de Indicação (Indique e Ganhe)
-- =====================================================

-- 1. Adicionar código de referência único para cada usuário
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(10) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_earnings INTEGER DEFAULT 0;

-- 2. Tabela de indicações
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Quem indicou
  referred_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Quem foi indicado
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'qualified', 'rewarded'
  reward_credits INTEGER DEFAULT 2, -- Créditos de recompensa
  qualified_at TIMESTAMPTZ, -- Quando o indicado fez primeira compra
  rewarded_at TIMESTAMPTZ, -- Quando a recompensa foi creditada
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_id) -- Cada usuário só pode ser indicado uma vez
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- 4. RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals" ON referrals
  FOR SELECT USING (referrer_id = auth.uid() OR referred_id = auth.uid());

CREATE POLICY "System can manage referrals" ON referrals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true))
  );

-- 5. Função para gerar código de referência único
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS VARCHAR(10) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR(10) := '';
  i INTEGER;
  code_exists BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = result) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 6. Função para criar código de referência para usuário
CREATE OR REPLACE FUNCTION ensure_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger para gerar código automaticamente
DROP TRIGGER IF EXISTS ensure_user_referral_code ON users;
CREATE TRIGGER ensure_user_referral_code
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_referral_code();

-- 8. Gerar códigos para usuários existentes que não têm
UPDATE users SET referral_code = generate_referral_code() WHERE referral_code IS NULL;

-- 9. Função para processar indicação quando usuário faz primeira compra
CREATE OR REPLACE FUNCTION process_referral_reward()
RETURNS TRIGGER AS $$
DECLARE
  v_referrer_id UUID;
  v_referral RECORD;
BEGIN
  -- Só processa se for um pagamento completado
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Buscar se o usuário foi indicado e ainda não qualificou
    SELECT r.* INTO v_referral
    FROM referrals r
    WHERE r.referred_id = NEW.user_id
      AND r.status = 'pending'
    LIMIT 1;
    
    IF v_referral.id IS NOT NULL THEN
      -- Marcar como qualificado
      UPDATE referrals 
      SET status = 'qualified', qualified_at = NOW()
      WHERE id = v_referral.id;
      
      -- Creditar recompensa ao indicador
      UPDATE credits 
      SET amount = amount + v_referral.reward_credits, updated_at = NOW()
      WHERE user_id = v_referral.referrer_id;
      
      -- Atualizar contadores do indicador
      UPDATE users 
      SET referral_earnings = referral_earnings + v_referral.reward_credits
      WHERE id = v_referral.referrer_id;
      
      -- Marcar como recompensado
      UPDATE referrals 
      SET status = 'rewarded', rewarded_at = NOW()
      WHERE id = v_referral.id;
      
      -- Criar notificação para o indicador
      INSERT INTO notifications (user_id, type, title, message)
      VALUES (
        v_referral.referrer_id,
        'referral_reward',
        '🎉 Indicação Recompensada!',
        'Você ganhou ' || v_referral.reward_credits || ' créditos! Seu amigo fez a primeira compra.'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Trigger para processar recompensa
DROP TRIGGER IF EXISTS process_referral_on_payment ON payments;
CREATE TRIGGER process_referral_on_payment
  AFTER UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION process_referral_reward();

-- 11. Configuração de recompensa de indicação
INSERT INTO system_settings (key, value) VALUES
  ('referral_reward_credits', '2'),
  ('referral_enabled', 'true'),
  ('referral_share_message', '"🎱 Venha jogar Sinuca Online comigo! Cadastre-se pelo meu link e ganhe créditos grátis para jogar. Vamos ver quem é o melhor? 🏆"')
ON CONFLICT (key) DO NOTHING;
