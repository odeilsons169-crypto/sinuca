-- =====================================================
-- SISTEMA DE BRACKET DE TORNEIOS (ELIMINAÇÃO SIMPLES)
-- Suporta 8, 16, 32 e 64 participantes
-- =====================================================

-- Melhorar tabela tournament_matches para suportar bracket completo
ALTER TABLE tournament_matches 
ADD COLUMN IF NOT EXISTS bracket_position VARCHAR(10),  -- 'A1', 'A2', 'B1', 'B2', etc.
ADD COLUMN IF NOT EXISTS group_side VARCHAR(1),         -- 'A' ou 'B'
ADD COLUMN IF NOT EXISTS next_match_id UUID REFERENCES tournament_matches(id),
ADD COLUMN IF NOT EXISTS player1_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS player2_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tournament_matches_bracket ON tournament_matches(tournament_id, round, bracket_position);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_next ON tournament_matches(next_match_id);

-- =====================================================
-- FUNÇÃO: Gerar Bracket de Eliminação Simples
-- =====================================================
CREATE OR REPLACE FUNCTION generate_tournament_bracket(
    p_tournament_id UUID,
    p_participant_ids UUID[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_num_participants INTEGER;
    v_num_rounds INTEGER;
    v_matches_in_round INTEGER;
    v_round INTEGER;
    v_match_num INTEGER;
    v_match_id UUID;
    v_next_match_id UUID;
    v_player1_id UUID;
    v_player2_id UUID;
    v_group_side VARCHAR(1);
    v_bracket_pos VARCHAR(10);
    v_shuffled_ids UUID[];
    v_match_ids UUID[][];
    v_half INTEGER;
BEGIN
    -- Embaralhar participantes
    SELECT array_agg(id ORDER BY random()) INTO v_shuffled_ids
    FROM unnest(p_participant_ids) AS id;
    
    v_num_participants := array_length(v_shuffled_ids, 1);
    
    -- Calcular número de rounds (log2)
    v_num_rounds := ceil(log(2, v_num_participants))::INTEGER;
    
    -- Inicializar array de match_ids para referência
    v_match_ids := ARRAY[]::UUID[][];
    
    -- Criar partidas de todas as rodadas (de trás para frente para ter os IDs)
    -- Começar pela final e ir até as oitavas
    
    -- ROUND FINAL (1 partida)
    INSERT INTO tournament_matches (
        tournament_id, round, match_number, bracket_position, group_side, status
    ) VALUES (
        p_tournament_id, v_num_rounds, 1, 'FINAL', NULL, 'pending'
    ) RETURNING id INTO v_match_id;
    
    v_match_ids := v_match_ids || ARRAY[[v_match_id]];
    
    -- SEMIFINAIS (2 partidas)
    IF v_num_rounds >= 2 THEN
        FOR v_match_num IN 1..2 LOOP
            v_group_side := CASE WHEN v_match_num = 1 THEN 'A' ELSE 'B' END;
            
            INSERT INTO tournament_matches (
                tournament_id, round, match_number, bracket_position, group_side, 
                next_match_id, status
            ) VALUES (
                p_tournament_id, v_num_rounds - 1, v_match_num, 
                'SF' || v_match_num, v_group_side,
                v_match_ids[1][1], 'pending'
            ) RETURNING id INTO v_match_id;
            
            IF v_match_num = 1 THEN
                v_match_ids := v_match_ids || ARRAY[[v_match_id]];
            ELSE
                v_match_ids[2] := v_match_ids[2] || v_match_id;
            END IF;
        END LOOP;
    END IF;
    
    -- QUARTAS DE FINAL (4 partidas)
    IF v_num_rounds >= 3 THEN
        FOR v_match_num IN 1..4 LOOP
            v_group_side := CASE WHEN v_match_num <= 2 THEN 'A' ELSE 'B' END;
            v_next_match_id := CASE 
                WHEN v_match_num <= 2 THEN v_match_ids[2][1]
                ELSE v_match_ids[2][2]
            END;
            
            INSERT INTO tournament_matches (
                tournament_id, round, match_number, bracket_position, group_side,
                next_match_id, status
            ) VALUES (
                p_tournament_id, v_num_rounds - 2, v_match_num,
                'QF' || v_match_num, v_group_side,
                v_next_match_id, 'pending'
            ) RETURNING id INTO v_match_id;
            
            IF v_match_num = 1 THEN
                v_match_ids := v_match_ids || ARRAY[[v_match_id]];
            ELSE
                v_match_ids[3] := v_match_ids[3] || v_match_id;
            END IF;
        END LOOP;
    END IF;
    
    -- OITAVAS DE FINAL (8 partidas) - Primeira rodada para 16 jogadores
    IF v_num_rounds >= 4 THEN
        FOR v_match_num IN 1..8 LOOP
            v_group_side := CASE WHEN v_match_num <= 4 THEN 'A' ELSE 'B' END;
            v_next_match_id := v_match_ids[3][ceil(v_match_num / 2.0)::INTEGER];
            
            -- Pegar jogadores
            v_player1_id := v_shuffled_ids[(v_match_num - 1) * 2 + 1];
            v_player2_id := CASE 
                WHEN (v_match_num - 1) * 2 + 2 <= v_num_participants 
                THEN v_shuffled_ids[(v_match_num - 1) * 2 + 2]
                ELSE NULL
            END;
            
            INSERT INTO tournament_matches (
                tournament_id, round, match_number, bracket_position, group_side,
                player1_id, player2_id, next_match_id, status,
                winner_id, is_bye
            ) VALUES (
                p_tournament_id, 1, v_match_num,
                'R1M' || v_match_num, v_group_side,
                v_player1_id, v_player2_id, v_next_match_id,
                CASE WHEN v_player2_id IS NULL THEN 'bye' ELSE 'pending' END,
                CASE WHEN v_player2_id IS NULL THEN v_player1_id ELSE NULL END,
                v_player2_id IS NULL
            );
        END LOOP;
    ELSIF v_num_rounds = 3 THEN
        -- 8 jogadores - começar nas quartas
        FOR v_match_num IN 1..4 LOOP
            v_player1_id := v_shuffled_ids[(v_match_num - 1) * 2 + 1];
            v_player2_id := CASE 
                WHEN (v_match_num - 1) * 2 + 2 <= v_num_participants 
                THEN v_shuffled_ids[(v_match_num - 1) * 2 + 2]
                ELSE NULL
            END;
            
            UPDATE tournament_matches 
            SET player1_id = v_player1_id,
                player2_id = v_player2_id,
                status = CASE WHEN v_player2_id IS NULL THEN 'bye' ELSE 'pending' END,
                winner_id = CASE WHEN v_player2_id IS NULL THEN v_player1_id ELSE NULL END,
                is_bye = v_player2_id IS NULL
            WHERE id = v_match_ids[3][v_match_num];
        END LOOP;
    END IF;
    
    -- Processar BYEs - avançar jogadores automaticamente
    PERFORM process_tournament_byes(p_tournament_id);
END;
$$;

-- =====================================================
-- FUNÇÃO: Processar BYEs (avanço automático)
-- =====================================================
CREATE OR REPLACE FUNCTION process_tournament_byes(p_tournament_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bye_match RECORD;
BEGIN
    -- Buscar todas as partidas com BYE
    FOR v_bye_match IN 
        SELECT * FROM tournament_matches 
        WHERE tournament_id = p_tournament_id 
        AND is_bye = true 
        AND winner_id IS NOT NULL
        AND next_match_id IS NOT NULL
    LOOP
        -- Avançar vencedor para próxima partida
        PERFORM advance_tournament_winner(v_bye_match.id, v_bye_match.winner_id);
    END LOOP;
END;
$$;

-- =====================================================
-- FUNÇÃO: Avançar Vencedor para Próxima Partida
-- =====================================================
CREATE OR REPLACE FUNCTION advance_tournament_winner(
    p_match_id UUID,
    p_winner_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_match RECORD;
    v_next_match RECORD;
    v_slot VARCHAR(10);
BEGIN
    -- Buscar partida atual
    SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
    
    IF v_match IS NULL OR v_match.next_match_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Buscar próxima partida
    SELECT * INTO v_next_match FROM tournament_matches WHERE id = v_match.next_match_id;
    
    IF v_next_match IS NULL THEN
        RETURN;
    END IF;
    
    -- Determinar qual slot preencher (baseado no match_number)
    -- Partidas ímpares vão para player1, pares para player2
    IF v_match.match_number % 2 = 1 THEN
        UPDATE tournament_matches 
        SET player1_id = p_winner_id
        WHERE id = v_match.next_match_id;
    ELSE
        UPDATE tournament_matches 
        SET player2_id = p_winner_id
        WHERE id = v_match.next_match_id;
    END IF;
END;
$$;

-- =====================================================
-- FUNÇÃO: Registrar Resultado de Partida
-- =====================================================
CREATE OR REPLACE FUNCTION set_match_winner(
    p_match_id UUID,
    p_winner_id UUID,
    p_player1_score INTEGER DEFAULT 0,
    p_player2_score INTEGER DEFAULT 0
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    is_tournament_finished BOOLEAN,
    tournament_winner_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_match RECORD;
    v_tournament RECORD;
    v_loser_id UUID;
    v_remaining_matches INTEGER;
BEGIN
    -- Buscar partida
    SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id;
    
    IF v_match IS NULL THEN
        RETURN QUERY SELECT false, 'Partida não encontrada'::TEXT, false, NULL::UUID;
        RETURN;
    END IF;
    
    IF v_match.status = 'finished' THEN
        RETURN QUERY SELECT false, 'Partida já finalizada'::TEXT, false, NULL::UUID;
        RETURN;
    END IF;
    
    -- Validar que o vencedor é um dos jogadores
    IF p_winner_id NOT IN (v_match.player1_id, v_match.player2_id) THEN
        RETURN QUERY SELECT false, 'Vencedor inválido'::TEXT, false, NULL::UUID;
        RETURN;
    END IF;
    
    -- Determinar perdedor
    v_loser_id := CASE 
        WHEN p_winner_id = v_match.player1_id THEN v_match.player2_id
        ELSE v_match.player1_id
    END;
    
    -- Atualizar partida
    UPDATE tournament_matches SET
        winner_id = p_winner_id,
        player1_score = p_player1_score,
        player2_score = p_player2_score,
        status = 'finished',
        finished_at = NOW()
    WHERE id = p_match_id;
    
    -- Marcar perdedor como eliminado
    IF v_loser_id IS NOT NULL THEN
        UPDATE tournament_participants SET
            status = 'eliminated',
            eliminated_at = NOW(),
            eliminated_by = p_winner_id
        WHERE tournament_id = v_match.tournament_id
        AND user_id = v_loser_id;
    END IF;
    
    -- Avançar vencedor para próxima partida
    IF v_match.next_match_id IS NOT NULL THEN
        PERFORM advance_tournament_winner(p_match_id, p_winner_id);
    END IF;
    
    -- Verificar se torneio acabou (era a final)
    IF v_match.next_match_id IS NULL THEN
        -- Era a final! Torneio acabou
        UPDATE tournaments SET
            status = 'finished',
            finished_at = NOW()
        WHERE id = v_match.tournament_id;
        
        -- Marcar vencedor
        UPDATE tournament_participants SET
            placement = 1,
            status = 'winner'
        WHERE tournament_id = v_match.tournament_id
        AND user_id = p_winner_id;
        
        -- Marcar segundo lugar
        UPDATE tournament_participants SET
            placement = 2
        WHERE tournament_id = v_match.tournament_id
        AND user_id = v_loser_id;
        
        RETURN QUERY SELECT true, 'Torneio finalizado!'::TEXT, true, p_winner_id;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT true, 'Vencedor registrado e avançado'::TEXT, false, NULL::UUID;
END;
$$;

-- =====================================================
-- VIEW: Bracket Completo do Torneio
-- =====================================================
CREATE OR REPLACE VIEW tournament_bracket_view AS
SELECT 
    tm.id,
    tm.tournament_id,
    tm.round,
    tm.match_number,
    tm.bracket_position,
    tm.group_side,
    tm.status,
    tm.is_bye,
    tm.next_match_id,
    tm.player1_score,
    tm.player2_score,
    tm.scheduled_at,
    tm.started_at,
    tm.finished_at,
    -- Player 1
    tm.player1_id,
    p1.username AS player1_username,
    p1.avatar_url AS player1_avatar,
    -- Player 2
    tm.player2_id,
    p2.username AS player2_username,
    p2.avatar_url AS player2_avatar,
    -- Winner
    tm.winner_id,
    w.username AS winner_username,
    -- Torneio
    t.name AS tournament_name,
    t.status AS tournament_status,
    t.game_mode,
    -- Calcular nome da rodada
    CASE 
        WHEN tm.bracket_position = 'FINAL' THEN 'Final'
        WHEN tm.bracket_position LIKE 'SF%' THEN 'Semifinal'
        WHEN tm.bracket_position LIKE 'QF%' THEN 'Quartas de Final'
        WHEN tm.bracket_position LIKE 'R1%' THEN 'Oitavas de Final'
        ELSE 'Rodada ' || tm.round
    END AS round_name
FROM tournament_matches tm
LEFT JOIN users p1 ON tm.player1_id = p1.id
LEFT JOIN users p2 ON tm.player2_id = p2.id
LEFT JOIN users w ON tm.winner_id = w.id
LEFT JOIN tournaments t ON tm.tournament_id = t.id
ORDER BY tm.tournament_id, tm.round, tm.match_number;

SELECT 'Sistema de Bracket de Torneios criado com sucesso!' as status;
