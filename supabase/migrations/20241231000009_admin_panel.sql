-- =====================================================
-- MIGRATION: Painel Administrativo Avançado
-- RBAC, Auditoria, Torneios
-- =====================================================

-- 1. Adicionar novos valores ao enum user_role existente
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'moderator' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
    ALTER TYPE user_role ADD VALUE 'moderator';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'super_admin' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
    ALTER TYPE user_role ADD VALUE 'super_admin';
  END IF;
END $$;

-- Garantir que a coluna role existe e tem os valores corretos
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';

-- 2. Adicionar campos extras para gestão de usuários
ALTER TABLE users
ADD COLUMN IF NOT EXISTS registration_ip INET,
ADD COLUMN IF NOT EXISTS last_login_ip INET,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ban_reason TEXT,
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- 3. Expandir tabela admin_logs para auditoria completa
ALTER TABLE admin_logs
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS old_value JSONB,
ADD COLUMN IF NOT EXISTS new_value JSONB;

CREATE INDEX IF NOT EXISTS idx_admin_logs_target ON admin_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);

-- 4. Tabela de torneios
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  registration_deadline TIMESTAMPTZ,
  entry_fee DECIMAL(10,2) DEFAULT 0,
  prize_pool DECIMAL(10,2) DEFAULT 0,
  prize_distribution JSONB DEFAULT '{"1": 70, "2": 20, "3": 10}',
  max_participants INTEGER DEFAULT 16,
  min_participants INTEGER DEFAULT 4,
  game_mode VARCHAR(20) DEFAULT '15ball',
  format VARCHAR(30) DEFAULT 'single_elimination',
  status VARCHAR(20) DEFAULT 'draft',
  is_vip_only BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  cancelled_by UUID REFERENCES users(id),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_start ON tournaments(start_date);


-- 5. Tabela de participantes de torneios
CREATE TABLE IF NOT EXISTS tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seed INTEGER,
  status VARCHAR(20) DEFAULT 'registered',
  placement INTEGER,
  prize_won DECIMAL(10,2) DEFAULT 0,
  eliminated_at TIMESTAMPTZ,
  eliminated_by UUID REFERENCES users(id),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_user ON tournament_participants(user_id);

-- 6. Tabela de partidas de torneios
CREATE TABLE IF NOT EXISTS tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  player1_id UUID REFERENCES users(id),
  player2_id UUID REFERENCES users(id),
  winner_id UUID REFERENCES users(id),
  match_id UUID REFERENCES matches(id),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending',
  is_bye BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);

-- 7. Tabela de palavras proibidas
CREATE TABLE IF NOT EXISTS banned_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word VARCHAR(100) NOT NULL UNIQUE,
  severity VARCHAR(20) DEFAULT 'warning',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Function para verificar permissão de role
CREATE OR REPLACE FUNCTION check_admin_permission(p_user_id UUID, p_required_role VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_role VARCHAR;
  v_role_level INTEGER;
  v_required_level INTEGER;
BEGIN
  SELECT role::text INTO v_user_role FROM users WHERE id = p_user_id;
  v_role_level := CASE v_user_role WHEN 'super_admin' THEN 4 WHEN 'admin' THEN 3 WHEN 'moderator' THEN 2 WHEN 'user' THEN 1 ELSE 0 END;
  v_required_level := CASE p_required_role WHEN 'super_admin' THEN 4 WHEN 'admin' THEN 3 WHEN 'moderator' THEN 2 WHEN 'user' THEN 1 ELSE 0 END;
  RETURN v_role_level >= v_required_level;
END;
$$ LANGUAGE plpgsql;

-- 9. Function para ajuste de saldo com auditoria
CREATE OR REPLACE FUNCTION admin_adjust_balance(p_admin_id UUID, p_user_id UUID, p_amount DECIMAL, p_balance_type VARCHAR, p_reason TEXT, p_ip_address INET DEFAULT NULL)
RETURNS TABLE(success BOOLEAN, error_message TEXT, new_balance DECIMAL) AS $$
DECLARE
  v_has_permission BOOLEAN;
  v_old_balance DECIMAL;
  v_new_balance DECIMAL;
  v_wallet RECORD;
BEGIN
  SELECT check_admin_permission(p_admin_id, 'super_admin') INTO v_has_permission;
  IF NOT v_has_permission THEN
    RETURN QUERY SELECT FALSE, 'Permissão negada.'::TEXT, 0::DECIMAL;
    RETURN;
  END IF;
  SELECT * INTO v_wallet FROM wallet WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Carteira não encontrada.'::TEXT, 0::DECIMAL;
    RETURN;
  END IF;
  IF p_balance_type = 'deposit' THEN
    v_old_balance := COALESCE(v_wallet.deposit_balance, 0);
    v_new_balance := GREATEST(0, v_old_balance + p_amount);
    UPDATE wallet SET deposit_balance = v_new_balance, balance = balance + p_amount, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF p_balance_type = 'winnings' THEN
    v_old_balance := COALESCE(v_wallet.winnings_balance, 0);
    v_new_balance := GREATEST(0, v_old_balance + p_amount);
    UPDATE wallet SET winnings_balance = v_new_balance, balance = balance + p_amount, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF p_balance_type = 'bonus' THEN
    v_old_balance := COALESCE(v_wallet.bonus_balance, 0);
    v_new_balance := GREATEST(0, v_old_balance + p_amount);
    UPDATE wallet SET bonus_balance = v_new_balance, balance = balance + p_amount, updated_at = NOW() WHERE user_id = p_user_id;
  ELSE
    RETURN QUERY SELECT FALSE, 'Tipo de saldo inválido.'::TEXT, 0::DECIMAL;
    RETURN;
  END IF;
  INSERT INTO transactions (user_id, type, amount, balance_type, description, balance_after) VALUES (p_user_id, 'admin_adjustment', p_amount, p_balance_type, '[ADMIN] ' || p_reason, v_new_balance);
  INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address, old_value, new_value) VALUES (p_admin_id, 'balance_adjust', 'wallet', v_wallet.id, jsonb_build_object('user_id', p_user_id, 'amount', p_amount, 'balance_type', p_balance_type, 'reason', p_reason), p_ip_address, jsonb_build_object('balance', v_old_balance), jsonb_build_object('balance', v_new_balance));
  RETURN QUERY SELECT TRUE, NULL::TEXT, v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- 10. Function para banir usuário
CREATE OR REPLACE FUNCTION admin_ban_user(p_admin_id UUID, p_user_id UUID, p_reason TEXT, p_is_permanent BOOLEAN DEFAULT TRUE, p_duration_hours INTEGER DEFAULT NULL, p_ip_address INET DEFAULT NULL)
RETURNS TABLE(success BOOLEAN, error_message TEXT) AS $$
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  SELECT check_admin_permission(p_admin_id, 'moderator') INTO v_has_permission;
  IF NOT v_has_permission THEN
    RETURN QUERY SELECT FALSE, 'Permissão negada.'::TEXT;
    RETURN;
  END IF;
  IF p_is_permanent THEN
    UPDATE users SET is_banned = TRUE, ban_reason = p_reason, banned_at = NOW(), banned_by = p_admin_id, is_suspended = FALSE, suspended_until = NULL WHERE id = p_user_id;
  ELSE
    UPDATE users SET is_suspended = TRUE, suspended_until = NOW() + (p_duration_hours || ' hours')::INTERVAL, suspension_reason = p_reason, is_banned = FALSE WHERE id = p_user_id;
  END IF;
  INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES (p_admin_id, CASE WHEN p_is_permanent THEN 'user_ban' ELSE 'user_suspend' END, 'user', p_user_id, jsonb_build_object('reason', p_reason, 'is_permanent', p_is_permanent, 'duration_hours', p_duration_hours), p_ip_address);
  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 11. Function para desbanir usuário
CREATE OR REPLACE FUNCTION admin_unban_user(p_admin_id UUID, p_user_id UUID, p_reason TEXT, p_ip_address INET DEFAULT NULL)
RETURNS TABLE(success BOOLEAN, error_message TEXT) AS $$
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  SELECT check_admin_permission(p_admin_id, 'admin') INTO v_has_permission;
  IF NOT v_has_permission THEN
    RETURN QUERY SELECT FALSE, 'Permissão negada.'::TEXT;
    RETURN;
  END IF;
  UPDATE users SET is_banned = FALSE, ban_reason = NULL, banned_at = NULL, banned_by = NULL, is_suspended = FALSE, suspended_until = NULL, suspension_reason = NULL WHERE id = p_user_id;
  INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES (p_admin_id, 'user_unban', 'user', p_user_id, jsonb_build_object('reason', p_reason), p_ip_address);
  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;


-- 12. View para dashboard financeiro
CREATE OR REPLACE VIEW admin_financial_dashboard AS
SELECT
  COALESCE(SUM(CASE WHEN p.paid_at >= CURRENT_DATE AND p.status = 'paid' THEN p.amount_brl ELSE 0 END), 0) as revenue_today,
  COALESCE(SUM(CASE WHEN p.paid_at >= CURRENT_DATE - INTERVAL '7 days' AND p.status = 'paid' THEN p.amount_brl ELSE 0 END), 0) as revenue_week,
  COALESCE(SUM(CASE WHEN p.paid_at >= DATE_TRUNC('month', CURRENT_DATE) AND p.status = 'paid' THEN p.amount_brl ELSE 0 END), 0) as revenue_month,
  COUNT(CASE WHEN p.status = 'paid' THEN 1 END) as total_payments,
  COUNT(CASE WHEN p.status = 'pending' THEN 1 END) as pending_payments
FROM payments p;

-- 13. View para estatísticas de usuários
CREATE OR REPLACE VIEW admin_user_stats AS
SELECT
  COUNT(*) as total_users,
  COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as new_today,
  COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_week,
  COUNT(CASE WHEN is_banned = TRUE THEN 1 END) as banned_users,
  COUNT(CASE WHEN is_suspended = TRUE THEN 1 END) as suspended_users
FROM users;

-- 14. RLS Policies para novas tabelas
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage tournaments" ON tournaments;
CREATE POLICY "Admins manage tournaments" ON tournaments FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role::text IN ('admin', 'super_admin')));

DROP POLICY IF EXISTS "Users view tournaments" ON tournaments;
CREATE POLICY "Users view tournaments" ON tournaments FOR SELECT USING (status IN ('open', 'in_progress', 'finished'));

DROP POLICY IF EXISTS "Users view tournament participants" ON tournament_participants;
CREATE POLICY "Users view tournament participants" ON tournament_participants FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users join tournaments" ON tournament_participants;
CREATE POLICY "Users join tournaments" ON tournament_participants FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage banned words" ON banned_words;
CREATE POLICY "Admins manage banned words" ON banned_words FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role::text IN ('moderator', 'admin', 'super_admin')));
