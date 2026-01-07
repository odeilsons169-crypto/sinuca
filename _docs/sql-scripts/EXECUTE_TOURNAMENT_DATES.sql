-- =====================================================
-- EXECUTE NO SUPABASE SQL EDITOR
-- Sistema de Datas de Inscrição para Torneios
-- =====================================================

-- 1. Adicionar novas colunas
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS registration_start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS registration_end_date TIMESTAMPTZ;

-- 2. Criar índices
CREATE INDEX IF NOT EXISTS idx_tournaments_registration_start ON tournaments(registration_start_date);
CREATE INDEX IF NOT EXISTS idx_tournaments_registration_end ON tournaments(registration_end_date);

-- 3. Função para abrir inscrições automaticamente
CREATE OR REPLACE FUNCTION open_scheduled_tournaments()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    opened_count INTEGER := 0;
BEGIN
    UPDATE tournaments
    SET status = 'open', updated_at = NOW()
    WHERE status = 'scheduled'
    AND registration_start_date IS NOT NULL
    AND registration_start_date <= NOW();
    
    GET DIAGNOSTICS opened_count = ROW_COUNT;
    RETURN opened_count;
END;
$$;

-- 4. Função para fechar inscrições automaticamente
CREATE OR REPLACE FUNCTION close_tournament_registrations()
RETURNS TABLE(
    tournament_id UUID,
    tournament_name TEXT,
    participant_count INTEGER,
    prize_pool DECIMAL,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    t RECORD;
    p_count INTEGER;
    total_collected DECIMAL;
    prize_amount DECIMAL;
    platform_fee DECIMAL;
    creator_fee DECIMAL;
    is_player_created BOOLEAN;
BEGIN
    FOR t IN 
        SELECT * FROM tournaments 
        WHERE tournaments.status = 'open'
        AND registration_end_date IS NOT NULL
        AND registration_end_date <= NOW()
    LOOP
        SELECT COUNT(*) INTO p_count
        FROM tournament_participants
        WHERE tournament_participants.tournament_id = t.id;
        
        is_player_created := COALESCE(t.created_by_player, false);
        total_collected := COALESCE(t.entry_fee, 0) * p_count;
        
        IF is_player_created THEN
            prize_amount := total_collected * 0.60;
            creator_fee := total_collected * 0.20;
            platform_fee := total_collected * 0.20;
        ELSE
            prize_amount := total_collected * 0.70;
            creator_fee := 0;
            platform_fee := total_collected * 0.30;
        END IF;
        
        IF p_count >= COALESCE(t.min_participants, 4) THEN
            UPDATE tournaments
            SET 
                status = 'registration_closed',
                current_participants = p_count,
                total_collected = total_collected,
                prize_pool = prize_amount,
                platform_fee = platform_fee,
                creator_fee = creator_fee,
                updated_at = NOW()
            WHERE id = t.id;
            
            tournament_id := t.id;
            tournament_name := t.name;
            participant_count := p_count;
            close_tournament_registrations.prize_pool := prize_amount;
            close_tournament_registrations.status := 'registration_closed';
            RETURN NEXT;
        ELSE
            UPDATE tournaments
            SET 
                status = 'cancelled',
                cancellation_reason = 'Número mínimo de participantes não atingido',
                cancelled_at = NOW(),
                updated_at = NOW()
            WHERE id = t.id;
            
            IF t.entry_fee > 0 THEN
                UPDATE wallet w
                SET winnings_balance = winnings_balance + t.entry_fee, updated_at = NOW()
                FROM tournament_participants tp
                WHERE tp.tournament_id = t.id AND w.user_id = tp.user_id;
                
                INSERT INTO transactions (user_id, type, amount, description, reference_id)
                SELECT tp.user_id, 'tournament_refund', t.entry_fee,
                    'Reembolso - Torneio "' || t.name || '" cancelado', t.id
                FROM tournament_participants tp
                WHERE tp.tournament_id = t.id;
            END IF;
            
            tournament_id := t.id;
            tournament_name := t.name;
            participant_count := p_count;
            close_tournament_registrations.prize_pool := 0;
            close_tournament_registrations.status := 'cancelled';
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$;

-- 5. Função para iniciar torneios automaticamente
CREATE OR REPLACE FUNCTION start_scheduled_tournaments()
RETURNS TABLE(
    tournament_id UUID,
    tournament_name TEXT,
    participant_count INTEGER,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    t RECORD;
    p_count INTEGER;
BEGIN
    FOR t IN 
        SELECT * FROM tournaments 
        WHERE tournaments.status = 'registration_closed'
        AND start_date IS NOT NULL
        AND start_date <= NOW()
    LOOP
        SELECT COUNT(*) INTO p_count
        FROM tournament_participants
        WHERE tournament_participants.tournament_id = t.id;
        
        PERFORM generate_tournament_bracket(
            t.id,
            ARRAY(SELECT user_id FROM tournament_participants 
                  WHERE tournament_participants.tournament_id = t.id ORDER BY RANDOM())
        );
        
        UPDATE tournaments
        SET status = 'in_progress', started_at = NOW(), updated_at = NOW()
        WHERE id = t.id;
        
        tournament_id := t.id;
        tournament_name := t.name;
        participant_count := p_count;
        start_scheduled_tournaments.status := 'in_progress';
        RETURN NEXT;
    END LOOP;
END;
$$;

-- 6. Atualizar torneios existentes
UPDATE tournaments
SET 
    registration_end_date = registration_deadline,
    registration_start_date = created_at
WHERE registration_end_date IS NULL
AND registration_deadline IS NOT NULL;

-- =====================================================
-- PRONTO! Sistema de datas de inscrição configurado.
-- 
-- Novos status de torneio:
-- - scheduled: Aguardando abertura das inscrições
-- - registration_closed: Inscrições encerradas, aguardando início
--
-- Funções automáticas (chamar via cron ou manualmente):
-- - SELECT open_scheduled_tournaments();
-- - SELECT * FROM close_tournament_registrations();
-- - SELECT * FROM start_scheduled_tournaments();
-- =====================================================
