-- =====================================================
-- MIGRATION: Correções de Segurança
-- Data: 2025-01-06
-- =====================================================
-- Corrige:
-- 1. Tabelas sem RLS habilitado
-- 2. Views com SECURITY DEFINER (convertendo para SECURITY INVOKER)
-- =====================================================

-- =====================================================
-- PARTE 1: HABILITAR RLS NAS TABELAS
-- =====================================================

-- tournament_payments
ALTER TABLE public.tournament_payments ENABLE ROW LEVEL SECURITY;

-- Políticas para tournament_payments
DROP POLICY IF EXISTS "tournament_payments_select_own" ON public.tournament_payments;
CREATE POLICY "tournament_payments_select_own" ON public.tournament_payments
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true))
  );

DROP POLICY IF EXISTS "tournament_payments_insert_own" ON public.tournament_payments;
CREATE POLICY "tournament_payments_insert_own" ON public.tournament_payments
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "tournament_payments_admin" ON public.tournament_payments;
CREATE POLICY "tournament_payments_admin" ON public.tournament_payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true))
  );

-- user_trophies
ALTER TABLE public.user_trophies ENABLE ROW LEVEL SECURITY;

-- Políticas para user_trophies
DROP POLICY IF EXISTS "user_trophies_select_all" ON public.user_trophies;
CREATE POLICY "user_trophies_select_all" ON public.user_trophies
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "user_trophies_insert_system" ON public.user_trophies;
CREATE POLICY "user_trophies_insert_system" ON public.user_trophies
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true))
  );

DROP POLICY IF EXISTS "user_trophies_update_own" ON public.user_trophies;
CREATE POLICY "user_trophies_update_own" ON public.user_trophies
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- trophies
ALTER TABLE public.trophies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trophies_select_all" ON public.trophies;
CREATE POLICY "trophies_select_all" ON public.trophies
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "trophies_admin_manage" ON public.trophies;
CREATE POLICY "trophies_admin_manage" ON public.trophies
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true))
  );

-- trophy_room_settings
ALTER TABLE public.trophy_room_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trophy_room_settings_select_own" ON public.trophy_room_settings;
CREATE POLICY "trophy_room_settings_select_own" ON public.trophy_room_settings
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "trophy_room_settings_manage_own" ON public.trophy_room_settings;
CREATE POLICY "trophy_room_settings_manage_own" ON public.trophy_room_settings
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- vip_plans
ALTER TABLE public.vip_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vip_plans_select_active" ON public.vip_plans;
CREATE POLICY "vip_plans_select_active" ON public.vip_plans
  FOR SELECT USING (is_active = true OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true)
  ));

DROP POLICY IF EXISTS "vip_plans_admin_manage" ON public.vip_plans;
CREATE POLICY "vip_plans_admin_manage" ON public.vip_plans
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true))
  );

-- banners
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "banners_select_active" ON public.banners;
CREATE POLICY "banners_select_active" ON public.banners
  FOR SELECT USING (is_active = true OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true)
  ));

DROP POLICY IF EXISTS "banners_admin_manage" ON public.banners;
CREATE POLICY "banners_admin_manage" ON public.banners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true))
  );

-- =====================================================
-- PARTE 2: RECRIAR VIEWS COM SECURITY INVOKER
-- =====================================================

-- user_trophy_room
DROP VIEW IF EXISTS public.user_trophy_room;
CREATE VIEW public.user_trophy_room AS
SELECT 
  ut.id,
  ut.user_id,
  ut.trophy_id,
  ut.awarded_at,
  ut.is_featured,
  ut.position,
  ut.tournament_id,
  t.name as trophy_name,
  t.description as trophy_description,
  t.image_url as trophy_image_url,
  t.rarity as trophy_rarity,
  t.category as trophy_category
FROM user_trophies ut
JOIN trophies t ON ut.trophy_id = t.id;

ALTER VIEW public.user_trophy_room SET (security_invoker = on);

-- bonus_summary (usando bonus_records que é a tabela real)
DROP VIEW IF EXISTS public.bonus_summary;
CREATE VIEW public.bonus_summary AS
SELECT 
  user_id,
  COUNT(*) as total_bonuses,
  SUM(amount) as total_amount,
  COUNT(*) FILTER (WHERE bonus_type = 'welcome') as welcome_bonuses,
  COUNT(*) FILTER (WHERE bonus_type = 'referral') as referral_bonuses,
  COUNT(*) FILTER (WHERE bonus_type LIKE 'admin%') as admin_bonuses
FROM bonus_records
GROUP BY user_id;

ALTER VIEW public.bonus_summary SET (security_invoker = on);

-- admin_financial_dashboard
DROP VIEW IF EXISTS public.admin_financial_dashboard;
CREATE VIEW public.admin_financial_dashboard AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) FILTER (WHERE type = 'deposit') as deposits_count,
  COALESCE(SUM(amount) FILTER (WHERE type = 'deposit'), 0) as deposits_total,
  COUNT(*) FILTER (WHERE type = 'withdrawal') as withdrawals_count,
  COALESCE(SUM(amount) FILTER (WHERE type = 'withdrawal'), 0) as withdrawals_total,
  COUNT(*) FILTER (WHERE type = 'bet_win') as wins_count,
  COALESCE(SUM(amount) FILTER (WHERE type = 'bet_win'), 0) as wins_total,
  COUNT(*) FILTER (WHERE type = 'admin_adjustment') as adjustments_count,
  COALESCE(SUM(amount) FILTER (WHERE type = 'admin_adjustment'), 0) as adjustments_total
FROM transactions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

ALTER VIEW public.admin_financial_dashboard SET (security_invoker = on);

-- revenue_summary
DROP VIEW IF EXISTS public.revenue_summary;
CREATE VIEW public.revenue_summary AS
SELECT 
  DATE_TRUNC('month', created_at) as month,
  COALESCE(SUM(amount) FILTER (WHERE type = 'admin_adjustment'), 0) as total_adjustments,
  COALESCE(SUM(amount) FILTER (WHERE type = 'deposit'), 0) as total_deposits,
  COALESCE(SUM(amount) FILTER (WHERE type = 'withdrawal'), 0) as total_withdrawals,
  COUNT(DISTINCT user_id) as unique_users
FROM transactions
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

ALTER VIEW public.revenue_summary SET (security_invoker = on);

-- admin_employees
DROP VIEW IF EXISTS public.admin_employees;
CREATE VIEW public.admin_employees AS
SELECT 
  id,
  username,
  email,
  role,
  is_admin,
  status,
  created_at,
  last_login_at
FROM users
WHERE role IN ('admin', 'super_admin', 'moderator') OR is_admin = true;

ALTER VIEW public.admin_employees SET (security_invoker = on);

-- admin_user_stats
DROP VIEW IF EXISTS public.admin_user_stats;
CREATE VIEW public.admin_user_stats AS
SELECT 
  u.id,
  u.username,
  u.email,
  u.status,
  u.created_at,
  u.last_login_at,
  COALESCE(us.total_matches, 0) as total_matches,
  COALESCE(us.wins, 0) as wins,
  COALESCE(us.losses, 0) as losses,
  COALESCE(us.win_rate, 0) as win_rate,
  COALESCE(w.balance, 0) as balance,
  COALESCE(c.amount, 0) as credits
FROM users u
LEFT JOIN user_stats us ON u.id = us.user_id
LEFT JOIN wallet w ON u.id = w.user_id
LEFT JOIN credits c ON u.id = c.user_id;

ALTER VIEW public.admin_user_stats SET (security_invoker = on);

-- ranking_dashboard (corrigido para usar colunas reais da tabela rankings)
DROP VIEW IF EXISTS public.ranking_dashboard;
CREATE VIEW public.ranking_dashboard AS
SELECT 
  r.id,
  r.user_id,
  r.points,
  r.period,
  r.month,
  r.position,
  u.username,
  u.avatar_url,
  u.country_code,
  us.wins,
  us.losses,
  RANK() OVER (PARTITION BY r.period ORDER BY r.points DESC) as calculated_position
FROM rankings r
JOIN users u ON r.user_id = u.id
LEFT JOIN user_stats us ON r.user_id = us.user_id
WHERE u.status = 'active';

ALTER VIEW public.ranking_dashboard SET (security_invoker = on);

-- tournament_bracket_view
DROP VIEW IF EXISTS public.tournament_bracket_view;
CREATE VIEW public.tournament_bracket_view AS
SELECT 
  tm.id,
  tm.tournament_id,
  tm.round,
  tm.match_number,
  tm.player1_id,
  tm.player2_id,
  tm.winner_id,
  tm.status,
  tm.scheduled_at,
  tm.started_at,
  tm.finished_at,
  p1.username as player1_username,
  p1.avatar_url as player1_avatar,
  p2.username as player2_username,
  p2.avatar_url as player2_avatar,
  t.name as tournament_name,
  t.status as tournament_status
FROM tournament_matches tm
LEFT JOIN users p1 ON tm.player1_id = p1.id
LEFT JOIN users p2 ON tm.player2_id = p2.id
JOIN tournaments t ON tm.tournament_id = t.id;

ALTER VIEW public.tournament_bracket_view SET (security_invoker = on);

-- =====================================================
-- PARTE 3: GRANT PERMISSIONS
-- =====================================================

GRANT SELECT ON public.user_trophy_room TO authenticated;
GRANT SELECT ON public.ranking_dashboard TO authenticated;
GRANT SELECT ON public.tournament_bracket_view TO authenticated;
GRANT SELECT ON public.bonus_summary TO authenticated;

GRANT SELECT ON public.admin_financial_dashboard TO service_role;
GRANT SELECT ON public.revenue_summary TO service_role;
GRANT SELECT ON public.admin_employees TO service_role;
GRANT SELECT ON public.admin_user_stats TO service_role;

-- =====================================================
-- COMENTÁRIOS
-- =====================================================
COMMENT ON VIEW public.user_trophy_room IS 'View dos troféus do usuário - SECURITY INVOKER';
COMMENT ON VIEW public.bonus_summary IS 'Resumo de bônus por usuário - SECURITY INVOKER';
COMMENT ON VIEW public.admin_financial_dashboard IS 'Dashboard financeiro para admins - SECURITY INVOKER';
COMMENT ON VIEW public.revenue_summary IS 'Resumo de receita mensal - SECURITY INVOKER';
COMMENT ON VIEW public.admin_employees IS 'Lista de funcionários/admins - SECURITY INVOKER';
COMMENT ON VIEW public.admin_user_stats IS 'Estatísticas de usuários para admin - SECURITY INVOKER';
COMMENT ON VIEW public.ranking_dashboard IS 'Dashboard de ranking público - SECURITY INVOKER';
COMMENT ON VIEW public.tournament_bracket_view IS 'Visualização de brackets de torneio - SECURITY INVOKER';
