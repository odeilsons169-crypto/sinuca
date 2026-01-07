-- =====================================================
-- SISTEMA DE TORNEIOS CRIADOS POR JOGADORES
-- 
-- Torneios de ADMIN: 70% prêmio, 30% plataforma
-- Torneios de JOGADOR: 60% prêmio, 20% criador, 20% plataforma
-- =====================================================

-- 1. Adicionar campos para torneios de jogadores
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS created_by_player BOOLEAN DEFAULT false;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS creator_fee DECIMAL(10,2) DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS creator_fee_percentage INTEGER DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS final_creator_fee DECIMAL(10,2);

-- 2. Criar tabela de pagamentos de torneios (para aprovação manual)
CREATE TABLE IF NOT EXISTS tournament_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN ('prize', 'creator_fee', 'platform_fee')),
  amount DECIMAL(10,2) NOT NULL,
  position INTEGER, -- Posição no torneio (para prêmios)
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  description TEXT,
  proof_url TEXT, -- URL do comprovante de pagamento
  processed_by UUID REFERENCES users(id),
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_tournament_payments_tournament ON tournament_payments(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_payments_user ON tournament_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_payments_status ON tournament_payments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_created_by_player ON tournaments(created_by_player);

-- 4. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_tournament_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tournament_payments_updated_at ON tournament_payments;
CREATE TRIGGER tournament_payments_updated_at
  BEFORE UPDATE ON tournament_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_tournament_payments_updated_at();

-- 5. Atualizar função de cálculo de premiação para considerar tipo de criador
CREATE OR REPLACE FUNCTION calculate_tournament_prize_v2(
  p_entry_fee DECIMAL(10,2),
  p_participant_count INTEGER,
  p_is_player_created BOOLEAN DEFAULT false
)
RETURNS TABLE(
  total_collected DECIMAL(10,2),
  prize_pool DECIMAL(10,2),
  platform_fee DECIMAL(10,2),
  creator_fee DECIMAL(10,2)
) AS $$
DECLARE
  v_prize_pct INTEGER;
  v_platform_pct INTEGER;
  v_creator_pct INTEGER;
BEGIN
  -- Definir percentuais baseado no tipo de criador
  IF p_is_player_created THEN
    v_prize_pct := 60;
    v_platform_pct := 20;
    v_creator_pct := 20;
  ELSE
    v_prize_pct := 70;
    v_platform_pct := 30;
    v_creator_pct := 0;
  END IF;

  RETURN QUERY SELECT
    (p_entry_fee * p_participant_count)::DECIMAL(10,2) as total_collected,
    ((p_entry_fee * p_participant_count) * v_prize_pct / 100)::DECIMAL(10,2) as prize_pool,
    ((p_entry_fee * p_participant_count) * v_platform_pct / 100)::DECIMAL(10,2) as platform_fee,
    ((p_entry_fee * p_participant_count) * v_creator_pct / 100)::DECIMAL(10,2) as creator_fee;
END;
$$ LANGUAGE plpgsql;

-- 6. Atualizar trigger de participantes para considerar tipo de criador
CREATE OR REPLACE FUNCTION update_tournament_prize_on_participant_change()
RETURNS TRIGGER AS $$
DECLARE
  v_tournament RECORD;
  v_participant_count INTEGER;
  v_prize_info RECORD;
BEGIN
  SELECT COUNT(*) INTO v_participant_count
  FROM tournament_participants
  WHERE tournament_id = COALESCE(NEW.tournament_id, OLD.tournament_id);

  SELECT * INTO v_tournament
  FROM tournaments
  WHERE id = COALESCE(NEW.tournament_id, OLD.tournament_id);

  IF v_tournament IS NOT NULL THEN
    SELECT * INTO v_prize_info
    FROM calculate_tournament_prize_v2(
      v_tournament.entry_fee,
      v_participant_count,
      COALESCE(v_tournament.created_by_player, false)
    );

    UPDATE tournaments
    SET 
      total_collected = v_prize_info.total_collected,
      prize_pool = v_prize_info.prize_pool,
      platform_fee = v_prize_info.platform_fee,
      creator_fee = v_prize_info.creator_fee,
      current_participants = v_participant_count,
      updated_at = NOW()
    WHERE id = COALESCE(NEW.tournament_id, OLD.tournament_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 7. Comentários
COMMENT ON TABLE tournament_payments IS 'Pagamentos de torneios pendentes de aprovação manual';
COMMENT ON COLUMN tournaments.created_by_player IS 'Se o torneio foi criado por um jogador (não admin)';
COMMENT ON COLUMN tournaments.creator_fee IS 'Taxa do criador (20% para torneios de jogadores)';
COMMENT ON COLUMN tournament_payments.payment_type IS 'Tipo: prize (prêmio), creator_fee (taxa criador), platform_fee (taxa plataforma)';
COMMENT ON COLUMN tournament_payments.proof_url IS 'URL do comprovante de transferência anexado pelo admin';

SELECT 'Sistema de torneios de jogadores configurado!' as status;
