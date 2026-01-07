-- =====================================================
-- MIGRATION: Adicionar suporte a timeout de partidas
-- Data: 2025-01-06
-- Descrição: Adiciona campo timeout_reason para registrar
--            quando partidas são encerradas por tempo
-- =====================================================

-- Adicionar campo timeout_reason na tabela matches
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS timeout_reason TEXT DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN matches.timeout_reason IS 'Motivo do timeout: timeout_p1_wins, timeout_p2_wins, timeout_draw';

-- Garantir que rooms tem coluna updated_at ANTES de criar índice
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Adicionar campo last_activity_at na tabela livestreams (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'livestreams') THEN
    ALTER TABLE livestreams 
    ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();
    
    ALTER TABLE livestreams 
    ADD COLUMN IF NOT EXISTS end_reason TEXT DEFAULT NULL;
    
    COMMENT ON COLUMN livestreams.last_activity_at IS 'Última atividade na transmissão';
    COMMENT ON COLUMN livestreams.end_reason IS 'Motivo do encerramento: manual, inactivity, error';
  END IF;
END $$;

-- Criar índice para buscar partidas em andamento antigas (para cleanup)
CREATE INDEX IF NOT EXISTS idx_matches_playing_started 
ON matches(started_at) 
WHERE status = 'playing';

-- Criar índice para buscar salas inativas (para cleanup)
CREATE INDEX IF NOT EXISTS idx_rooms_open_updated 
ON rooms(updated_at) 
WHERE status IN ('open', 'full');

-- Atualizar updated_at automaticamente nas salas
CREATE OR REPLACE FUNCTION update_room_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at nas salas
DROP TRIGGER IF EXISTS trigger_room_updated_at ON rooms;
CREATE TRIGGER trigger_room_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_room_updated_at();

-- Log de sucesso
DO $$
BEGIN
  RAISE NOTICE 'Migration 20250106000005_match_timeout aplicada com sucesso!';
END $$;
