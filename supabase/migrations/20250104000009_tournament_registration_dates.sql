-- =====================================================
-- MIGRATION: Adicionar campos de data de inscrição em torneios
-- 
-- Novos campos:
-- - registration_start_date: Data de início das inscrições
-- - registration_end_date: Data de término das inscrições
-- - O campo start_date passa a ser a data de início do TORNEIO
-- =====================================================

-- Adicionar novas colunas
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS registration_start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS registration_end_date TIMESTAMPTZ;

-- Adicionar comentários
COMMENT ON COLUMN tournaments.registration_start_date IS 'Data e hora de início das inscrições';
COMMENT ON COLUMN tournaments.registration_end_date IS 'Data e hora de término das inscrições';
COMMENT ON COLUMN tournaments.start_date IS 'Data e hora de início do torneio (após encerrar inscrições)';

-- Criar índices para consultas
CREATE INDEX IF NOT EXISTS idx_tournaments_registration_start ON tournaments(registration_start_date);
CREATE INDEX IF NOT EXISTS idx_tournaments_registration_end ON tournaments(registration_end_date);

-- =====================================================
-- FUNÇÃO: Abrir inscrições automaticamente
-- Executada por cron job para abrir torneios agendados
-- =====================================================
CREATE OR REPLACE FUNCTION open_scheduled_tournaments()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    opened_count INTEGER := 0;
BEGIN
    -- Abrir torneios que estão agendados e a data de início das inscrições já passou
    UPDATE tournaments
    SET 
        status = 'open',
        updated_at = NOW()
    WHERE 
        status = 'scheduled'
        AND registration_start_date IS NOT NULL
        AND registration_start_date <= NOW();
    
    GET DIAGNOSTICS opened_count = ROW_COUNT;
    
    RETURN opened_count;
END;
$$;

-- =====================================================
-- FUNÇÃO: Fechar inscrições automaticamente
-- Executada por cron job para fechar inscrições de torneios
-- =====================================================
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
    -- Buscar torneios com inscrições abertas que já passaram da data de término
    FOR t IN 
        SELECT * FROM tournaments 
        WHERE status = 'open'
        AND registration_end_date IS NOT NULL
        AND registration_end_date <= NOW()
    LOOP
        -- Contar participantes
        SELECT COUNT(*) INTO p_count
        FROM tournament_participants
        WHERE tournament_participants.tournament_id = t.id;
        
        -- Verificar se é torneio de jogador
        is_player_created := COALESCE(t.created_by_player, false);
        
        -- Calcular valores
        total_collected := COALESCE(t.entry_fee, 0) * p_count;
        
        IF is_player_created THEN
            -- Torneio de jogador: 60% premiação, 20% criador, 20% plataforma
            prize_amount := total_collected * 0.60;
            creator_fee := total_collected * 0.20;
            platform_fee := total_collected * 0.20;
        ELSE
            -- Torneio de admin: 70% premiação, 30% plataforma
            prize_amount := total_collected * 0.70;
            creator_fee := 0;
            platform_fee := total_collected * 0.30;
        END IF;
        
        -- Verificar mínimo de participantes
        IF p_count >= COALESCE(t.min_participants, 4) THEN
            -- Fechar inscrições e atualizar valores
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
            prize_pool := prize_amount;
            status := 'registration_closed';
            RETURN NEXT;
        ELSE
            -- Não atingiu mínimo - cancelar torneio e reembolsar
            UPDATE tournaments
            SET 
                status = 'cancelled',
                cancellation_reason = 'Número mínimo de participantes não atingido',
                cancelled_at = NOW(),
                updated_at = NOW()
            WHERE id = t.id;
            
            -- Reembolsar participantes
            IF t.entry_fee > 0 THEN
                -- Adicionar ao winnings_balance de cada participante
                UPDATE wallet w
                SET 
                    winnings_balance = winnings_balance + t.entry_fee,
                    updated_at = NOW()
                FROM tournament_participants tp
                WHERE tp.tournament_id = t.id
                AND w.user_id = tp.user_id;
                
                -- Registrar transações de reembolso
                INSERT INTO transactions (user_id, type, amount, description, reference_id)
                SELECT 
                    tp.user_id,
                    'tournament_refund',
                    t.entry_fee,
                    'Reembolso - Torneio "' || t.name || '" cancelado (mínimo não atingido)',
                    t.id
                FROM tournament_participants tp
                WHERE tp.tournament_id = t.id;
            END IF;
            
            tournament_id := t.id;
            tournament_name := t.name;
            participant_count := p_count;
            prize_pool := 0;
            status := 'cancelled';
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$;

-- =====================================================
-- FUNÇÃO: Iniciar torneios automaticamente
-- Executada por cron job para iniciar torneios na data programada
-- =====================================================
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
    -- Buscar torneios com inscrições fechadas que já chegou a hora de iniciar
    FOR t IN 
        SELECT * FROM tournaments 
        WHERE status = 'registration_closed'
        AND start_date IS NOT NULL
        AND start_date <= NOW()
    LOOP
        -- Contar participantes
        SELECT COUNT(*) INTO p_count
        FROM tournament_participants
        WHERE tournament_participants.tournament_id = t.id;
        
        -- Gerar bracket e iniciar torneio
        PERFORM generate_tournament_bracket(
            t.id,
            ARRAY(
                SELECT user_id FROM tournament_participants 
                WHERE tournament_participants.tournament_id = t.id
                ORDER BY RANDOM()
            )
        );
        
        -- Atualizar status
        UPDATE tournaments
        SET 
            status = 'in_progress',
            started_at = NOW(),
            updated_at = NOW()
        WHERE id = t.id;
        
        tournament_id := t.id;
        tournament_name := t.name;
        participant_count := p_count;
        status := 'in_progress';
        RETURN NEXT;
    END LOOP;
END;
$$;

-- =====================================================
-- Adicionar status 'scheduled' e 'registration_closed'
-- =====================================================
-- Nota: Se a coluna status for um ENUM, precisaria alterar o tipo
-- Como provavelmente é VARCHAR, apenas documentamos os novos valores:
-- 'draft' - Rascunho
-- 'scheduled' - Agendado (aguardando data de abertura das inscrições)
-- 'open' - Inscrições abertas
-- 'registration_closed' - Inscrições encerradas (aguardando início)
-- 'in_progress' - Em andamento
-- 'finished' - Finalizado
-- 'cancelled' - Cancelado

COMMENT ON TABLE tournaments IS 'Tabela de torneios. Status: draft, scheduled, open, registration_closed, in_progress, finished, cancelled';

-- =====================================================
-- Atualizar torneios existentes
-- =====================================================
-- Para torneios existentes sem as novas datas, usar registration_deadline como fallback
UPDATE tournaments
SET 
    registration_end_date = registration_deadline,
    registration_start_date = created_at
WHERE registration_end_date IS NULL
AND registration_deadline IS NOT NULL;
