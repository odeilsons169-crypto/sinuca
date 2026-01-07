-- =====================================================
-- RANKING VS CPU - "Mestres da Sinuca"
-- Migration: 20250106000003_ai_rankings.sql
-- =====================================================

-- 1. Criar tabela de ranking vs CPU
CREATE TABLE IF NOT EXISTS ai_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_matches INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2) DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  last_match_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_ai_rankings_points ON ai_rankings(points DESC);
CREATE INDEX IF NOT EXISTS idx_ai_rankings_wins ON ai_rankings(wins DESC);
CREATE INDEX IF NOT EXISTS idx_ai_rankings_win_rate ON ai_rankings(win_rate DESC);
CREATE INDEX IF NOT EXISTS idx_ai_rankings_user_id ON ai_rankings(user_id);

-- 3. Habilitar RLS
ALTER TABLE ai_rankings ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS
DROP POLICY IF EXISTS "ai_rankings_select_all" ON ai_rankings;
CREATE POLICY "ai_rankings_select_all" ON ai_rankings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "ai_rankings_insert_own" ON ai_rankings;
CREATE POLICY "ai_rankings_insert_own" ON ai_rankings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ai_rankings_update_own" ON ai_rankings;
CREATE POLICY "ai_rankings_update_own" ON ai_rankings
  FOR UPDATE USING (auth.uid() = user_id);

-- 5. Function para atualizar ranking após partida vs CPU
CREATE OR REPLACE FUNCTION update_ai_ranking(
  p_user_id UUID,
  p_won BOOLEAN
) RETURNS void AS $$
BEGIN
  INSERT INTO ai_rankings (user_id, total_matches, wins, losses, current_streak, best_streak, points, last_match_at)
  VALUES (
    p_user_id,
    1,
    CASE WHEN p_won THEN 1 ELSE 0 END,
    CASE WHEN p_won THEN 0 ELSE 1 END,
    CASE WHEN p_won THEN 1 ELSE 0 END,
    CASE WHEN p_won THEN 1 ELSE 0 END,
    CASE WHEN p_won THEN 100 ELSE 0 END,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_matches = ai_rankings.total_matches + 1,
    wins = ai_rankings.wins + CASE WHEN p_won THEN 1 ELSE 0 END,
    losses = ai_rankings.losses + CASE WHEN p_won THEN 0 ELSE 1 END,
    current_streak = CASE 
      WHEN p_won THEN ai_rankings.current_streak + 1 
      ELSE 0 
    END,
    best_streak = CASE 
      WHEN p_won AND ai_rankings.current_streak + 1 > ai_rankings.best_streak 
      THEN ai_rankings.current_streak + 1 
      ELSE ai_rankings.best_streak 
    END,
    points = ai_rankings.points + CASE 
      WHEN p_won THEN 100 + (ai_rankings.current_streak * 10)
      ELSE GREATEST(0, ai_rankings.points - 20)
    END,
    win_rate = ROUND(
      ((ai_rankings.wins + CASE WHEN p_won THEN 1 ELSE 0 END)::DECIMAL / 
       (ai_rankings.total_matches + 1)) * 100, 2
    ),
    last_match_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. View para ranking com dados do usuário
CREATE OR REPLACE VIEW ai_rankings_view AS
SELECT 
  ar.id,
  ar.user_id,
  u.username,
  u.avatar_url,
  u.country_code,
  ar.total_matches,
  ar.wins,
  ar.losses,
  ar.win_rate,
  ar.best_streak,
  ar.current_streak,
  ar.points,
  ar.last_match_at,
  RANK() OVER (ORDER BY ar.points DESC) as position
FROM ai_rankings ar
JOIN users u ON u.id = ar.user_id
WHERE ar.total_matches > 0
ORDER BY ar.points DESC;

-- 7. Conceder permissões
GRANT SELECT ON ai_rankings_view TO authenticated;
GRANT SELECT ON ai_rankings_view TO anon;
