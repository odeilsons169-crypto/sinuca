-- =====================================================
-- MIGRATION: Adicionar configuração de linha de mira nas salas
-- Data: 2025-01-06
-- =====================================================

-- Adicionar campo aim_line_enabled na tabela rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS aim_line_enabled BOOLEAN DEFAULT true;

-- Adicionar campo game_mode na tabela rooms (se não existir)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS game_mode VARCHAR(20) DEFAULT '15ball';

-- Comentários
COMMENT ON COLUMN rooms.aim_line_enabled IS 'Se a linha de mira está habilitada na sala';
COMMENT ON COLUMN rooms.game_mode IS 'Modo de jogo: 15ball (8 bolas) ou 9ball';

-- Atualizar salas existentes para ter mira habilitada por padrão
UPDATE rooms SET aim_line_enabled = true WHERE aim_line_enabled IS NULL;
UPDATE rooms SET game_mode = '15ball' WHERE game_mode IS NULL;
