-- =====================================================
-- MIGRATION: Sistema de Sincronização de Torneios
-- 
-- Funções para:
-- - Adicionar pontos de ranking
-- - Incrementar estatísticas de jogadores
-- - Histórico de ranking
-- - Campos adicionais nas tabelas
-- =====================================================

-- 1. Adicionar campos nas tabelas existentes

-- Campos na tabela matches para torneios
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id),
ADD COLUMN IF NOT EXISTS tournament_match_id UUID;

-- Campos na tabela rooms para torneios
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES tournaments(id),
ADD COLUMN IF NOT EXISTS tournament_match_id UUID;

-- Campos na tabela tournament_participants
ALTER TABLE tournament_participants
ADD COLUMN IF NOT EXISTS eliminated_in_round INTEGER,
ADD COLUMN IF NOT EXISTS prize_amount DECIMAL(10,2) DEFAULT 0;

-- Campos na tabela tournament_matches
ALTER TABLE tournament_matches
ADD COLUMN IF NOT EXISTS match_id UUID REFERENCES matches(id),
ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id);

-- Campo winner_id na tabela tournaments
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- 2. Criar tabela de histórico de ranking
CREATE TABLE IF NOT EXISTS ranking_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points_change INTEGER NOT NULL,
    reason TEXT,
    tournament_id UUID REFERENCES tournaments(id),
    match_id UUID REFERENCES matches(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ranking_history_user ON ranking_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ranking_history_created ON ranking_history(created_at);

-- 3. Adicionar campos de estatísticas de torneio nos usuários
ALTER TABLE users
ADD COLUMN IF NOT EXISTS tournament_wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tournament_losses INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tournaments_played INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_tournament_placement INTEGER;

-- 4. Função para adicionar pontos de ranking
CREATE OR REPLACE FUNCTION add_ranking_points(
    p_user_id UUID,
    p_points INTEGER,
    p_period TEXT DEFAULT 'global',
    p_month TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_month TEXT;
BEGIN
    -- Definir mês se for ranking mensal
    IF p_period = 'monthly' THEN
        v_month := COALESCE(p_month, TO_CHAR(NOW(), 'YYYY-MM'));
    END IF;

    -- Inserir ou atualizar ranking
    INSERT INTO rankings (user_id, period, month, points)
    VALUES (p_user_id, p_period, v_month, p_points)
    ON CONFLICT (user_id, period, COALESCE(month, ''))
    DO UPDATE SET 
        points = rankings.points + p_points,
        updated_at = NOW();
    
    -- Recalcular posições
    PERFORM update_ranking_positions();
END;
$$;

-- 5. Função para atualizar posições do ranking
CREATE OR REPLACE FUNCTION update_ranking_positions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Atualizar posições do ranking global
    WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY points DESC, updated_at ASC) as new_position
        FROM rankings
        WHERE period = 'global'
    )
    UPDATE rankings r
    SET position = ranked.new_position
    FROM ranked
    WHERE r.id = ranked.id;

    -- Atualizar posições do ranking mensal (mês atual)
    WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY points DESC, updated_at ASC) as new_position
        FROM rankings
        WHERE period = 'monthly' AND month = TO_CHAR(NOW(), 'YYYY-MM')
    )
    UPDATE rankings r
    SET position = ranked.new_position
    FROM ranked
    WHERE r.id = ranked.id;
END;
$$;

-- 6. Função para incrementar estatísticas do usuário
CREATE OR REPLACE FUNCTION increment_user_stats(
    p_user_id UUID,
    p_wins INTEGER DEFAULT 0,
    p_losses INTEGER DEFAULT 0,
    p_tournament_wins INTEGER DEFAULT 0,
    p_tournament_losses INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE users
    SET 
        wins = COALESCE(wins, 0) + p_wins,
        losses = COALESCE(losses, 0) + p_losses,
        tournament_wins = COALESCE(tournament_wins, 0) + p_tournament_wins,
        tournament_losses = COALESCE(tournament_losses, 0) + p_tournament_losses,
        tournaments_played = CASE 
            WHEN p_tournament_wins > 0 OR p_tournament_losses > 0 
            THEN COALESCE(tournaments_played, 0) + 1 
            ELSE COALESCE(tournaments_played, 0) 
        END,
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$$;

-- 7. Função para atualizar melhor colocação em torneio
CREATE OR REPLACE FUNCTION update_best_tournament_placement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Atualizar melhor colocação se for melhor que a atual
    IF NEW.placement IS NOT NULL THEN
        UPDATE users
        SET best_tournament_placement = LEAST(
            COALESCE(best_tournament_placement, 999),
            NEW.placement
        )
        WHERE id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger para atualizar melhor colocação
DROP TRIGGER IF EXISTS trg_update_best_placement ON tournament_participants;
CREATE TRIGGER trg_update_best_placement
    AFTER UPDATE OF placement ON tournament_participants
    FOR EACH ROW
    WHEN (NEW.placement IS NOT NULL)
    EXECUTE FUNCTION update_best_tournament_placement();

-- 8. Índices para performance
CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_rooms_tournament ON rooms(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_status ON tournament_matches(status);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_placement ON tournament_participants(placement);

-- 9. Garantir que a tabela rankings tenha constraint única correta
-- Primeiro remover constraint antiga se existir
DO $$
BEGIN
    -- Tentar criar constraint única
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'rankings_user_period_month_unique'
    ) THEN
        -- Criar constraint única para user_id + period + month
        ALTER TABLE rankings 
        ADD CONSTRAINT rankings_user_period_month_unique 
        UNIQUE (user_id, period, month);
    END IF;
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

-- 10. Comentários nas tabelas
COMMENT ON FUNCTION add_ranking_points IS 'Adiciona pontos ao ranking do usuário (global ou mensal)';
COMMENT ON FUNCTION increment_user_stats IS 'Incrementa estatísticas de vitórias/derrotas do usuário';
COMMENT ON TABLE ranking_history IS 'Histórico de alterações de pontos de ranking';
