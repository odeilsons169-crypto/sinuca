-- =====================================================
-- CORREÇÃO: Atualizar trigger de liquidação de apostas
-- para creditar winnings_balance (saldo de ganhos)
-- =====================================================

-- Atualizar função de liquidação de apostas
CREATE OR REPLACE FUNCTION settle_bet_on_match_finish()
RETURNS TRIGGER AS $$
DECLARE
  bet_record RECORD;
  winner_amount DECIMAL(10,2);
  platform_amount DECIMAL(10,2);
  loser_id UUID;
  winner_new_balance DECIMAL(10,2);
BEGIN
  IF NEW.status = 'finished' AND OLD.status = 'playing' AND NEW.winner_id IS NOT NULL THEN
    SELECT * INTO bet_record FROM bets WHERE match_id = NEW.id AND status = 'active';
    
    IF FOUND THEN
      -- Calcular valores: 10% taxa da plataforma, 90% para o vencedor
      platform_amount := bet_record.total_pool * 0.10;
      winner_amount := bet_record.total_pool - platform_amount;
      
      -- Identificar perdedor
      IF NEW.winner_id = bet_record.player1_id THEN
        loser_id := bet_record.player2_id;
      ELSE
        loser_id := bet_record.player1_id;
      END IF;
      
      -- Atualizar registro da aposta
      UPDATE bets SET
        status = 'settled',
        winner_id = NEW.winner_id,
        winner_payout = winner_amount,
        platform_fee = platform_amount,
        settled_at = NOW()
      WHERE id = bet_record.id;
      
      -- Creditar vencedor (balance + winnings_balance)
      UPDATE wallet SET 
        balance = balance + winner_amount,
        winnings_balance = COALESCE(winnings_balance, 0) + winner_amount,
        updated_at = NOW()
      WHERE user_id = NEW.winner_id;
      
      -- Obter novo saldo para registro
      SELECT balance INTO winner_new_balance FROM wallet WHERE user_id = NEW.winner_id;
      
      -- Registrar transação do vencedor
      INSERT INTO transactions (user_id, type, amount, balance_after, reference_id, description)
      VALUES (NEW.winner_id, 'bet_win', winner_amount, winner_new_balance, bet_record.id, 
              'Vitória em aposta - Prêmio: R$' || winner_amount::TEXT || ' (90% do pot)');
      
      -- Registrar transação do perdedor
      INSERT INTO transactions (user_id, type, amount, balance_after, reference_id, description)
      SELECT loser_id, 'bet_loss', -bet_record.amount, w.balance, bet_record.id, 
             'Derrota em aposta - Valor apostado: R$' || bet_record.amount::TEXT
      FROM wallet w WHERE w.user_id = loser_id;
      
      -- Atualizar estatísticas
      UPDATE user_stats SET total_bet_won = COALESCE(total_bet_won, 0) + winner_amount WHERE user_id = NEW.winner_id;
      UPDATE user_stats SET total_bet_lost = COALESCE(total_bet_lost, 0) + bet_record.amount WHERE user_id = loser_id;
      
      -- Registrar receita da plataforma (taxa admin)
      INSERT INTO revenue_records (user_id, revenue_type, amount, description, reference_id)
      VALUES (NULL, 'bet_commission', platform_amount, 
              'Taxa de aposta (10%) - Partida ' || NEW.id::TEXT, bet_record.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar tabela revenue_records se não existir
CREATE TABLE IF NOT EXISTS revenue_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  revenue_type TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para revenue_records
CREATE INDEX IF NOT EXISTS idx_revenue_records_type ON revenue_records(revenue_type);
CREATE INDEX IF NOT EXISTS idx_revenue_records_created_at ON revenue_records(created_at DESC);
