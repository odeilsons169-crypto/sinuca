-- =====================================================
-- MIGRATION: Funções para Ranking Semanal
-- (Executar após o enum weekly estar disponível)
-- =====================================================

-- 1. Índice único para ranking semanal
CREATE UNIQUE INDEX IF NOT EXISTS idx_rankings_unique_weekly ON rankings(user_id, week) WHERE period = 'weekly';

-- 2. Função para arquivar ranking semanal
CREATE OR REPLACE FUNCTION archive_and_reset_weekly_ranking()
RETURNS VOID AS $$
DECLARE
    v_last_week TEXT;
    v_week_start DATE;
    v_week_end DATE;
BEGIN
    v_last_week := TO_CHAR(NOW() - INTERVAL '7 days', 'IYYY-IW');
    v_week_start := DATE_TRUNC('week', NOW() - INTERVAL '7 days')::DATE;
    v_week_end := v_week_start + INTERVAL '6 days';
    
    INSERT INTO ranking_history (user_id, period_type, period_start, period_end, final_position, final_points, wins, losses, matches_played)
    SELECT 
        user_id,
        'weekly',
        v_week_start,
        v_week_end,
        r.position,
        r.points,
        COALESCE(r.wins, 0),
        COALESCE(r.losses, 0),
        COALESCE(r.matches_played, 0)
    FROM rankings r
    WHERE r.period = 'weekly' AND r.week = v_last_week
    ON CONFLICT DO NOTHING;
    
    DELETE FROM rankings 
    WHERE period = 'weekly' AND week != get_current_week();
END;
$$ LANGUAGE plpgsql;

-- 3. Função para arquivar ranking mensal
CREATE OR REPLACE FUNCTION archive_and_reset_monthly_ranking()
RETURNS VOID AS $$
DECLARE
    v_last_month TEXT;
    v_month_start DATE;
    v_month_end DATE;
BEGIN
    v_last_month := TO_CHAR(NOW() - INTERVAL '1 month', 'YYYY-MM');
    v_month_start := DATE_TRUNC('month', NOW() - INTERVAL '1 month')::DATE;
    v_month_end := (DATE_TRUNC('month', NOW()) - INTERVAL '1 day')::DATE;
    
    INSERT INTO ranking_history (user_id, period_type, period_start, period_end, final_position, final_points, wins, losses, matches_played)
    SELECT 
        user_id,
        'monthly',
        v_month_start,
        v_month_end,
        r.position,
        r.points,
        COALESCE(r.wins, 0),
        COALESCE(r.losses, 0),
        COALESCE(r.matches_played, 0)
    FROM rankings r
    WHERE r.period = 'monthly' AND r.month = v_last_month
    ON CONFLICT DO NOTHING;
    
    DELETE FROM rankings 
    WHERE period = 'monthly' AND month != get_current_month();
END;
$$ LANGUAGE plpgsql;

-- 4. View para dashboard de ranking
DROP VIEW IF EXISTS ranking_dashboard;
CREATE VIEW ranking_dashboard AS
SELECT 
    'global' as ranking_type,
    COUNT(*)::INTEGER as total_players,
    COALESCE(SUM(points), 0)::BIGINT as total_points,
    COALESCE(SUM(matches_played), 0)::BIGINT as total_matches,
    COALESCE(MAX(points), 0)::INTEGER as highest_points
FROM rankings WHERE period = 'global'
UNION ALL
SELECT 
    'weekly' as ranking_type,
    COUNT(*)::INTEGER as total_players,
    COALESCE(SUM(points), 0)::BIGINT as total_points,
    COALESCE(SUM(matches_played), 0)::BIGINT as total_matches,
    COALESCE(MAX(points), 0)::INTEGER as highest_points
FROM rankings WHERE period = 'weekly' AND week = get_current_week()
UNION ALL
SELECT 
    'monthly' as ranking_type,
    COUNT(*)::INTEGER as total_players,
    COALESCE(SUM(points), 0)::BIGINT as total_points,
    COALESCE(SUM(matches_played), 0)::BIGINT as total_matches,
    COALESCE(MAX(points), 0)::INTEGER as highest_points
FROM rankings WHERE period = 'monthly' AND month = get_current_month();

-- 5. Comentários
COMMENT ON TABLE ranking_history IS 'Histórico de rankings arquivados (semanal e mensal)';
COMMENT ON FUNCTION archive_and_reset_weekly_ranking() IS 'Arquiva ranking semanal e reseta para nova semana';
COMMENT ON FUNCTION archive_and_reset_monthly_ranking() IS 'Arquiva ranking mensal e reseta para novo mês';
