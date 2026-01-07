-- =====================================================
-- SISTEMA DE PREMIAÇÃO DINÂMICA DE TORNEIOS
-- 70% do valor arrecadado vai para premiação
-- 30% fica para a plataforma
-- =====================================================

-- 1. Adicionar novos campos na tabela tournaments
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS total_collected DECIMAL(10,2) DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2) DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS prize_percentage INTEGER DEFAULT 70;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS platform_fee_percentage INTEGER DEFAULT 30;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS current_participants INTEGER DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS final_prize_pool DECIMAL(10,2);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS final_platform_fee DECIMAL(10,2);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS final_total_collected DECIMAL(10,2);
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

-- 2. Adicionar campo de prêmio recebido nos participantes
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS prize_amount DECIMAL(10,2) DEFAULT 0;

-- 3. Função para calcular premiação do torneio
CREATE OR REPLACE FUNCTION calculate_tournament_prize(
  p_entry_fee DECIMAL(10,2),
  p_participant_count INTEGER,
  p_prize_percentage INTEGER DEFAULT 70
)
RETURNS TABLE(
  total_collected DECIMAL(10,2),
  prize_pool DECIMAL(10,2),
  platform_fee DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY SELECT
    (p_entry_fee * p_participant_count)::DECIMAL(10,2) as total_collected,
    ((p_entry_fee * p_participant_count) * p_prize_percentage / 100)::DECIMAL(10,2) as prize_pool,
    ((p_entry_fee * p_participant_count) * (100 - p_prize_percentage) / 100)::DECIMAL(10,2) as platform_fee;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger para atualizar premiação quando participante se inscreve
CREATE OR REPLACE FUNCTION update_tournament_prize_on_participant_change()
RETURNS TRIGGER AS $$
DECLARE
  v_tournament RECORD;
  v_participant_count INTEGER;
  v_prize_info RECORD;
BEGIN
  -- Contar participantes atuais
  SELECT COUNT(*) INTO v_participant_count
  FROM tournament_participants
  WHERE tournament_id = COALESCE(NEW.tournament_id, OLD.tournament_id);

  -- Buscar dados do torneio
  SELECT * INTO v_tournament
  FROM tournaments
  WHERE id = COALESCE(NEW.tournament_id, OLD.tournament_id);

  IF v_tournament IS NOT NULL THEN
    -- Calcular nova premiação
    SELECT * INTO v_prize_info
    FROM calculate_tournament_prize(
      v_tournament.entry_fee,
      v_participant_count,
      COALESCE(v_tournament.prize_percentage, 70)
    );

    -- Atualizar torneio
    UPDATE tournaments
    SET 
      total_collected = v_prize_info.total_collected,
      prize_pool = v_prize_info.prize_pool,
      platform_fee = v_prize_info.platform_fee,
      current_participants = v_participant_count,
      updated_at = NOW()
    WHERE id = COALESCE(NEW.tournament_id, OLD.tournament_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Criar triggers
DROP TRIGGER IF EXISTS tournament_participant_insert_trigger ON tournament_participants;
CREATE TRIGGER tournament_participant_insert_trigger
  AFTER INSERT ON tournament_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_tournament_prize_on_participant_change();

DROP TRIGGER IF EXISTS tournament_participant_delete_trigger ON tournament_participants;
CREATE TRIGGER tournament_participant_delete_trigger
  AFTER DELETE ON tournament_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_tournament_prize_on_participant_change();

-- 5. Atualizar torneios existentes
UPDATE tournaments t
SET 
  total_collected = COALESCE(entry_fee, 0) * COALESCE((
    SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = t.id
  ), 0),
  prize_pool = (COALESCE(entry_fee, 0) * COALESCE((
    SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = t.id
  ), 0)) * 0.70,
  platform_fee = (COALESCE(entry_fee, 0) * COALESCE((
    SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = t.id
  ), 0)) * 0.30,
  current_participants = COALESCE((
    SELECT COUNT(*) FROM tournament_participants WHERE tournament_id = t.id
  ), 0),
  prize_percentage = 70,
  platform_fee_percentage = 30
WHERE total_collected IS NULL OR total_collected = 0;

-- 6. Comentários
COMMENT ON COLUMN tournaments.total_collected IS 'Total arrecadado com inscrições';
COMMENT ON COLUMN tournaments.prize_pool IS 'Valor da premiação (70% do total)';
COMMENT ON COLUMN tournaments.platform_fee IS 'Taxa da plataforma (30% do total)';
COMMENT ON COLUMN tournaments.prize_percentage IS 'Percentual destinado à premiação';
COMMENT ON COLUMN tournaments.platform_fee_percentage IS 'Percentual da taxa da plataforma';
COMMENT ON COLUMN tournament_participants.prize_amount IS 'Valor do prêmio recebido pelo participante';

SELECT 'Sistema de premiação de torneios configurado!' as status;
