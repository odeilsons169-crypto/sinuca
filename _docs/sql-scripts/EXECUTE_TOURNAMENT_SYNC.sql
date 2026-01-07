-- =====================================================
-- EXECUTE NO SUPABASE SQL EDITOR (SE NECESSÁRIO)
-- Sistema de Sincronização Automática de Torneios
-- =====================================================

-- Este SQL já foi executado via migration.
-- Use apenas se precisar recriar as funções.

-- 1. Função para adicionar pontos de ranking
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
    IF p_period = 'monthly' THEN
        v_month := COALESCE(p_month, TO_CHAR(NOW(), 'YYYY-MM'));
    END IF;

    INSERT INTO rankings (user_id, period, month, points)
    VALUES (p_user_id, p_period, v_month, p_points)
    ON CONFLICT (user_id, period, COALESCE(month, ''))
    DO UPDATE SET 
        points = rankings.points + p_points,
        updated_at = NOW();
    
    PERFORM update_ranking_positions();
END;
$$;

-- 2. Função para atualizar posições do ranking
CREATE OR REPLACE FUNCTION update_ranking_positions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY points DESC, updated_at ASC) as new_position
        FROM rankings
        WHERE period = 'global'
    )
    UPDATE rankings r
    SET position = ranked.new_position
    FROM ranked
    WHERE r.id = ranked.id;

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

-- 3. Função para incrementar estatísticas do usuário
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

-- =====================================================
-- SISTEMA DE SINCRONIZAÇÃO AUTOMÁTICA
-- 
-- Quando uma partida de torneio é finalizada:
-- 1. Atualiza o bracket (chaveamento)
-- 2. Elimina o perdedor
-- 3. Avança o vencedor para próxima fase
-- 4. Atualiza pontos de ranking
-- 5. Atualiza estatísticas dos jogadores
-- 6. Se for a final, processa premiação
-- 
-- Pontos de Ranking por Colocação:
-- - 1º lugar: 100 pontos
-- - 2º lugar: 60 pontos
-- - 3º-4º lugar: 35 pontos
-- - 5º-8º lugar: 20 pontos
-- - 9º-16º lugar: 10 pontos
-- - 17º-32º lugar: 5 pontos
-- - 33º-64º lugar: 2 pontos
-- 
-- Pontos por Partida:
-- - Vitória: 5 pontos
-- - Participação: 1 ponto
-- =====================================================
