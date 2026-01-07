-- =====================================================
-- SCHEMA COMPLETO - GAME ONLINE DE SINUCA
-- Execute este arquivo no SQL Editor do Supabase
-- =====================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'banned');
CREATE TYPE match_status AS ENUM ('waiting', 'playing', 'finished', 'cancelled');
CREATE TYPE match_mode AS ENUM ('casual', 'bet', 'ai');
CREATE TYPE room_status AS ENUM ('open', 'full', 'playing', 'closed');
CREATE TYPE bet_status AS ENUM ('pending', 'active', 'settled', 'cancelled');
CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'bet_win', 'bet_loss', 'credit_purchase', 'admin_adjustment');
CREATE TYPE punishment_type AS ENUM ('warning', 'mute', 'suspension', 'ban');
CREATE TYPE ranking_period AS ENUM ('global', 'monthly');

-- =====================================================
-- TABELA: users (perfil do usuário)
-- =====================================================

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  role user_role DEFAULT 'user' NOT NULL,
  status user_status DEFAULT 'active' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- TABELA: user_stats (estatísticas do jogador)
-- =====================================================

CREATE TABLE user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_matches INTEGER DEFAULT 0 NOT NULL,
  wins INTEGER DEFAULT 0 NOT NULL,
  losses INTEGER DEFAULT 0 NOT NULL,
  win_rate DECIMAL(5,2) DEFAULT 0 NOT NULL,
  total_credits_used INTEGER DEFAULT 0 NOT NULL,
  total_bet_won DECIMAL(10,2) DEFAULT 0 NOT NULL,
  total_bet_lost DECIMAL(10,2) DEFAULT 0 NOT NULL,
  ranking_points INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- TABELA: wallet (carteira do usuário)
-- =====================================================

CREATE TABLE wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(10,2) DEFAULT 0 NOT NULL CHECK (balance >= 0),
  is_blocked BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- TABELA: credits (créditos para jogar)
-- =====================================================

CREATE TABLE credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER DEFAULT 0 NOT NULL CHECK (amount >= 0),
  is_unlimited BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- TABELA: rooms (salas de jogo)
-- =====================================================

CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status room_status DEFAULT 'open' NOT NULL,
  mode match_mode DEFAULT 'casual' NOT NULL,
  bet_amount DECIMAL(10,2) CHECK (bet_amount IS NULL OR bet_amount >= 5),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- TABELA: matches (partidas)
-- =====================================================

CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES users(id),
  player2_id UUID NOT NULL REFERENCES users(id),
  winner_id UUID REFERENCES users(id),
  status match_status DEFAULT 'waiting' NOT NULL,
  mode match_mode NOT NULL,
  player1_score INTEGER DEFAULT 0 NOT NULL,
  player2_score INTEGER DEFAULT 0 NOT NULL,
  game_state JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- TABELA: bets (apostas)
-- =====================================================

CREATE TABLE bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID UNIQUE NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES users(id),
  player2_id UUID NOT NULL REFERENCES users(id),
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 5),
  total_pool DECIMAL(10,2) NOT NULL,
  status bet_status DEFAULT 'pending' NOT NULL,
  winner_id UUID REFERENCES users(id),
  winner_payout DECIMAL(10,2),
  platform_fee DECIMAL(10,2),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- TABELA: transactions (movimentações financeiras)
-- =====================================================

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- TABELA: rankings (ranking global e mensal)
-- =====================================================

CREATE TABLE rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER DEFAULT 0 NOT NULL,
  period ranking_period NOT NULL,
  month TEXT,
  position INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, period, month)
);

-- =====================================================
-- TABELA: punishments (punições)
-- =====================================================

CREATE TABLE punishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES users(id),
  type punishment_type NOT NULL,
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- TABELA: subscriptions (assinaturas)
-- =====================================================

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  starts_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- TABELA: chat_messages (mensagens do chat)
-- =====================================================

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_moderated BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- TABELA: invites (convites para partidas)
-- =====================================================

CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- TABELA: files_metadata (metadados de arquivos)
-- =====================================================

CREATE TABLE files_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  public_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- TABELA: email_logs (histórico de e-mails)
-- =====================================================

CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email_to TEXT NOT NULL,
  subject TEXT NOT NULL,
  template TEXT NOT NULL,
  status TEXT DEFAULT 'sent' NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- TABELA: admin_logs (auditoria de ações admin)
-- =====================================================

CREATE TABLE admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- TABELA: payments (pagamentos)
-- =====================================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('pix', 'credit_card')),
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
  external_id TEXT,
  metadata JSONB DEFAULT '{}',
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- TABELA: withdrawal_requests (solicitações de saque)
-- =====================================================

CREATE TABLE withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  pix_key TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  admin_id UUID REFERENCES users(id),
  admin_notes TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);


-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);

CREATE INDEX idx_user_stats_ranking_points ON user_stats(ranking_points DESC);
CREATE INDEX idx_user_stats_wins ON user_stats(wins DESC);

CREATE INDEX idx_wallet_user_id ON wallet(user_id);
CREATE INDEX idx_wallet_balance ON wallet(balance);

CREATE INDEX idx_credits_user_id ON credits(user_id);

CREATE INDEX idx_rooms_owner_id ON rooms(owner_id);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_mode ON rooms(mode);
CREATE INDEX idx_rooms_created_at ON rooms(created_at DESC);

CREATE INDEX idx_matches_room_id ON matches(room_id);
CREATE INDEX idx_matches_player1_id ON matches(player1_id);
CREATE INDEX idx_matches_player2_id ON matches(player2_id);
CREATE INDEX idx_matches_winner_id ON matches(winner_id);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_created_at ON matches(created_at DESC);

CREATE INDEX idx_bets_match_id ON bets(match_id);
CREATE INDEX idx_bets_player1_id ON bets(player1_id);
CREATE INDEX idx_bets_player2_id ON bets(player2_id);
CREATE INDEX idx_bets_status ON bets(status);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

CREATE INDEX idx_rankings_user_id ON rankings(user_id);
CREATE INDEX idx_rankings_period ON rankings(period);
CREATE INDEX idx_rankings_points ON rankings(points DESC);
CREATE INDEX idx_rankings_position ON rankings(position);

CREATE INDEX idx_punishments_user_id ON punishments(user_id);
CREATE INDEX idx_punishments_is_active ON punishments(is_active);
CREATE INDEX idx_punishments_type ON punishments(type);

CREATE INDEX idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);

CREATE INDEX idx_invites_to_user_id ON invites(to_user_id);
CREATE INDEX idx_invites_status ON invites(status);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

CREATE INDEX idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_action ON admin_logs(action);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- =====================================================
-- FUNÇÕES E TRIGGERS
-- =====================================================

-- Função: Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_user_stats_updated_at
  BEFORE UPDATE ON user_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_wallet_updated_at
  BEFORE UPDATE ON wallet
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_credits_updated_at
  BEFORE UPDATE ON credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_rankings_updated_at
  BEFORE UPDATE ON rankings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- FUNÇÃO: Criar perfil, carteira, créditos e stats após registro
-- =====================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar perfil do usuário
  INSERT INTO public.users (id, email, username)
  VALUES (NEW.id, NEW.email, SPLIT_PART(NEW.email, '@', 1));
  
  -- Criar carteira
  INSERT INTO public.wallet (user_id, balance)
  VALUES (NEW.id, 0);
  
  -- Criar créditos
  INSERT INTO public.credits (user_id, amount)
  VALUES (NEW.id, 0);
  
  -- Criar estatísticas
  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id);
  
  -- Criar ranking global
  INSERT INTO public.rankings (user_id, period, points)
  VALUES (NEW.id, 'global', 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para novos usuários
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- FUNÇÃO: Débito de crédito ao iniciar partida
-- =====================================================

CREATE OR REPLACE FUNCTION debit_credit_on_match_start()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'playing' AND OLD.status = 'waiting' THEN
    IF NEW.mode = 'casual' THEN
      UPDATE credits 
      SET amount = amount - 1 
      WHERE user_id = NEW.player1_id 
        AND (amount >= 1 OR is_unlimited = TRUE);
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Player 1 não tem créditos suficientes';
      END IF;
      
      UPDATE credits 
      SET amount = amount - 1 
      WHERE user_id = NEW.player2_id 
        AND (amount >= 1 OR is_unlimited = TRUE);
      
      IF NOT FOUND THEN
        UPDATE credits SET amount = amount + 1 WHERE user_id = NEW.player1_id;
        RAISE EXCEPTION 'Player 2 não tem créditos suficientes';
      END IF;
      
      UPDATE user_stats SET total_credits_used = total_credits_used + 1 WHERE user_id = NEW.player1_id;
      UPDATE user_stats SET total_credits_used = total_credits_used + 1 WHERE user_id = NEW.player2_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_debit_credit_on_match
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION debit_credit_on_match_start();

-- =====================================================
-- FUNÇÃO: Atualizar estatísticas e ranking após partida
-- =====================================================

CREATE OR REPLACE FUNCTION update_stats_after_match()
RETURNS TRIGGER AS $$
DECLARE
  points_win INTEGER := 10;
  points_loss INTEGER := -3;
  points_bet_bonus INTEGER := 5;
  loser_id UUID;
  is_bet_match BOOLEAN;
BEGIN
  IF NEW.status = 'finished' AND OLD.status = 'playing' AND NEW.winner_id IS NOT NULL THEN
    IF NEW.winner_id = NEW.player1_id THEN
      loser_id := NEW.player2_id;
    ELSE
      loser_id := NEW.player1_id;
    END IF;
    
    SELECT EXISTS(SELECT 1 FROM bets WHERE match_id = NEW.id) INTO is_bet_match;
    
    UPDATE user_stats SET
      total_matches = total_matches + 1,
      wins = wins + 1,
      win_rate = ROUND((wins + 1)::DECIMAL / (total_matches + 1) * 100, 2),
      ranking_points = ranking_points + points_win + (CASE WHEN is_bet_match THEN points_bet_bonus ELSE 0 END)
    WHERE user_id = NEW.winner_id;
    
    UPDATE user_stats SET
      total_matches = total_matches + 1,
      losses = losses + 1,
      win_rate = ROUND(wins::DECIMAL / (total_matches + 1) * 100, 2),
      ranking_points = GREATEST(0, ranking_points + points_loss)
    WHERE user_id = loser_id;
    
    UPDATE rankings SET
      points = (SELECT ranking_points FROM user_stats WHERE user_id = NEW.winner_id)
    WHERE user_id = NEW.winner_id AND period = 'global';
    
    UPDATE rankings SET
      points = (SELECT ranking_points FROM user_stats WHERE user_id = loser_id)
    WHERE user_id = loser_id AND period = 'global';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_stats_after_match
  AFTER UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_stats_after_match();

-- =====================================================
-- FUNÇÃO: Liquidar aposta automaticamente
-- =====================================================

CREATE OR REPLACE FUNCTION settle_bet_on_match_finish()
RETURNS TRIGGER AS $$
DECLARE
  bet_record RECORD;
  winner_amount DECIMAL(10,2);
  platform_amount DECIMAL(10,2);
  loser_id UUID;
BEGIN
  IF NEW.status = 'finished' AND OLD.status = 'playing' AND NEW.winner_id IS NOT NULL THEN
    SELECT * INTO bet_record FROM bets WHERE match_id = NEW.id AND status = 'active';
    
    IF FOUND THEN
      platform_amount := bet_record.total_pool * 0.10;
      winner_amount := bet_record.total_pool - platform_amount;
      
      IF NEW.winner_id = bet_record.player1_id THEN
        loser_id := bet_record.player2_id;
      ELSE
        loser_id := bet_record.player1_id;
      END IF;
      
      UPDATE bets SET
        status = 'settled',
        winner_id = NEW.winner_id,
        winner_payout = winner_amount,
        platform_fee = platform_amount,
        settled_at = NOW()
      WHERE id = bet_record.id;
      
      UPDATE wallet SET balance = balance + winner_amount WHERE user_id = NEW.winner_id;
      
      INSERT INTO transactions (user_id, type, amount, balance_after, reference_id, description)
      SELECT NEW.winner_id, 'bet_win', winner_amount, w.balance, bet_record.id, 'Vitória em aposta'
      FROM wallet w WHERE w.user_id = NEW.winner_id;
      
      INSERT INTO transactions (user_id, type, amount, balance_after, reference_id, description)
      SELECT loser_id, 'bet_loss', -bet_record.amount, w.balance, bet_record.id, 'Derrota em aposta'
      FROM wallet w WHERE w.user_id = loser_id;
      
      UPDATE user_stats SET total_bet_won = total_bet_won + winner_amount WHERE user_id = NEW.winner_id;
      UPDATE user_stats SET total_bet_lost = total_bet_lost + bet_record.amount WHERE user_id = loser_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_settle_bet
  AFTER UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION settle_bet_on_match_finish();

-- =====================================================
-- FUNÇÃO: Verificar saldo antes de criar aposta
-- =====================================================

CREATE OR REPLACE FUNCTION check_balance_before_bet()
RETURNS TRIGGER AS $$
DECLARE
  player1_balance DECIMAL(10,2);
  player2_balance DECIMAL(10,2);
BEGIN
  SELECT balance INTO player1_balance FROM wallet WHERE user_id = NEW.player1_id AND is_blocked = FALSE;
  IF player1_balance IS NULL OR player1_balance < NEW.amount THEN
    RAISE EXCEPTION 'Player 1 não tem saldo suficiente para apostar';
  END IF;
  
  SELECT balance INTO player2_balance FROM wallet WHERE user_id = NEW.player2_id AND is_blocked = FALSE;
  IF player2_balance IS NULL OR player2_balance < NEW.amount THEN
    RAISE EXCEPTION 'Player 2 não tem saldo suficiente para apostar';
  END IF;
  
  UPDATE wallet SET balance = balance - NEW.amount WHERE user_id = NEW.player1_id;
  UPDATE wallet SET balance = balance - NEW.amount WHERE user_id = NEW.player2_id;
  
  NEW.total_pool := NEW.amount * 2;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_check_balance_before_bet
  BEFORE INSERT ON bets
  FOR EACH ROW EXECUTE FUNCTION check_balance_before_bet();

-- =====================================================
-- FUNÇÃO: Verificar limite de salas por usuário
-- =====================================================

CREATE OR REPLACE FUNCTION check_room_limit()
RETURNS TRIGGER AS $$
DECLARE
  active_rooms INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_rooms 
  FROM rooms 
  WHERE owner_id = NEW.owner_id 
    AND status IN ('open', 'full', 'playing');
  
  IF active_rooms >= 1 THEN
    RAISE EXCEPTION 'Usuário já possui uma sala ativa';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_room_limit
  BEFORE INSERT ON rooms
  FOR EACH ROW EXECUTE FUNCTION check_room_limit();

-- =====================================================
-- FUNÇÃO: Atualizar posições do ranking
-- =====================================================

CREATE OR REPLACE FUNCTION update_ranking_positions()
RETURNS TRIGGER AS $$
BEGIN
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY points DESC) as pos
    FROM rankings
    WHERE period = 'global'
  )
  UPDATE rankings r
  SET position = ranked.pos
  FROM ranked
  WHERE r.id = ranked.id;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ranking_positions
  AFTER INSERT OR UPDATE ON rankings
  FOR EACH STATEMENT EXECUTE FUNCTION update_ranking_positions();


-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE punishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE files_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- FUNÇÃO AUXILIAR: Verificar se é admin
-- =====================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNÇÃO AUXILIAR: Verificar se usuário está ativo
-- =====================================================

CREATE OR REPLACE FUNCTION is_user_active()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- POLÍTICAS: users
-- =====================================================

CREATE POLICY "users_select_public" ON users
  FOR SELECT USING (TRUE);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_admin_all" ON users
  FOR ALL USING (is_admin());

-- =====================================================
-- POLÍTICAS: user_stats
-- =====================================================

CREATE POLICY "user_stats_select_public" ON user_stats
  FOR SELECT USING (TRUE);

CREATE POLICY "user_stats_admin_update" ON user_stats
  FOR UPDATE USING (is_admin());

-- =====================================================
-- POLÍTICAS: wallet
-- =====================================================

CREATE POLICY "wallet_select_own" ON wallet
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "wallet_admin_all" ON wallet
  FOR ALL USING (is_admin());

-- =====================================================
-- POLÍTICAS: credits
-- =====================================================

CREATE POLICY "credits_select_own" ON credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "credits_admin_all" ON credits
  FOR ALL USING (is_admin());

-- =====================================================
-- POLÍTICAS: rooms
-- =====================================================

CREATE POLICY "rooms_select_open" ON rooms
  FOR SELECT USING (
    is_user_active() AND (
      status = 'open' OR 
      owner_id = auth.uid() OR 
      guest_id = auth.uid()
    )
  );

CREATE POLICY "rooms_insert_active" ON rooms
  FOR INSERT WITH CHECK (
    is_user_active() AND owner_id = auth.uid()
  );

CREATE POLICY "rooms_update_owner" ON rooms
  FOR UPDATE USING (
    owner_id = auth.uid() OR guest_id = auth.uid()
  );

CREATE POLICY "rooms_admin_all" ON rooms
  FOR ALL USING (is_admin());

-- =====================================================
-- POLÍTICAS: matches
-- =====================================================

CREATE POLICY "matches_select_player" ON matches
  FOR SELECT USING (
    player1_id = auth.uid() OR 
    player2_id = auth.uid() OR
    is_admin()
  );

CREATE POLICY "matches_admin_insert" ON matches
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "matches_update_player" ON matches
  FOR UPDATE USING (
    (player1_id = auth.uid() OR player2_id = auth.uid()) AND
    status IN ('waiting', 'playing')
  );

CREATE POLICY "matches_admin_all" ON matches
  FOR ALL USING (is_admin());

-- =====================================================
-- POLÍTICAS: bets
-- =====================================================

CREATE POLICY "bets_select_player" ON bets
  FOR SELECT USING (
    player1_id = auth.uid() OR 
    player2_id = auth.uid() OR
    is_admin()
  );

CREATE POLICY "bets_admin_insert" ON bets
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "bets_admin_all" ON bets
  FOR ALL USING (is_admin());

-- =====================================================
-- POLÍTICAS: transactions
-- =====================================================

CREATE POLICY "transactions_select_own" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "transactions_admin_insert" ON transactions
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "transactions_admin_select" ON transactions
  FOR SELECT USING (is_admin());

-- =====================================================
-- POLÍTICAS: rankings
-- =====================================================

CREATE POLICY "rankings_select_public" ON rankings
  FOR SELECT USING (TRUE);

CREATE POLICY "rankings_admin_all" ON rankings
  FOR ALL USING (is_admin());

-- =====================================================
-- POLÍTICAS: punishments
-- =====================================================

CREATE POLICY "punishments_select_own" ON punishments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "punishments_admin_all" ON punishments
  FOR ALL USING (is_admin());

-- =====================================================
-- POLÍTICAS: subscriptions
-- =====================================================

CREATE POLICY "subscriptions_select_own" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "subscriptions_admin_all" ON subscriptions
  FOR ALL USING (is_admin());

-- =====================================================
-- POLÍTICAS: chat_messages
-- =====================================================

CREATE POLICY "chat_select_room_member" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM rooms 
      WHERE rooms.id = chat_messages.room_id 
      AND (rooms.owner_id = auth.uid() OR rooms.guest_id = auth.uid())
    )
  );

CREATE POLICY "chat_insert_active" ON chat_messages
  FOR INSERT WITH CHECK (
    is_user_active() AND auth.uid() = user_id
  );

CREATE POLICY "chat_admin_all" ON chat_messages
  FOR ALL USING (is_admin());

-- =====================================================
-- POLÍTICAS: invites
-- =====================================================

CREATE POLICY "invites_select_own" ON invites
  FOR SELECT USING (
    from_user_id = auth.uid() OR to_user_id = auth.uid()
  );

CREATE POLICY "invites_insert_active" ON invites
  FOR INSERT WITH CHECK (
    is_user_active() AND from_user_id = auth.uid()
  );

CREATE POLICY "invites_update_recipient" ON invites
  FOR UPDATE USING (to_user_id = auth.uid());

CREATE POLICY "invites_admin_all" ON invites
  FOR ALL USING (is_admin());

-- =====================================================
-- POLÍTICAS: files_metadata
-- =====================================================

CREATE POLICY "files_select_own" ON files_metadata
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "files_insert_own" ON files_metadata
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "files_delete_own" ON files_metadata
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "files_admin_all" ON files_metadata
  FOR ALL USING (is_admin());

-- =====================================================
-- POLÍTICAS: email_logs
-- =====================================================

CREATE POLICY "email_logs_admin_only" ON email_logs
  FOR ALL USING (is_admin());

-- =====================================================
-- POLÍTICAS: admin_logs
-- =====================================================

CREATE POLICY "admin_logs_admin_only" ON admin_logs
  FOR ALL USING (is_admin());

-- =====================================================
-- POLÍTICAS: payments
-- =====================================================

CREATE POLICY "payments_select_own" ON payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "payments_admin_all" ON payments
  FOR ALL USING (is_admin());

-- =====================================================
-- POLÍTICAS: withdrawal_requests
-- =====================================================

CREATE POLICY "withdrawals_select_own" ON withdrawal_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "withdrawals_insert_active" ON withdrawal_requests
  FOR INSERT WITH CHECK (
    is_user_active() AND auth.uid() = user_id
  );

CREATE POLICY "withdrawals_admin_all" ON withdrawal_requests
  FOR ALL USING (is_admin());

-- =====================================================
-- FIM DO SCHEMA
-- =====================================================
