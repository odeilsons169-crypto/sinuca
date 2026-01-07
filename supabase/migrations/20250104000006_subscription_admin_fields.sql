-- =====================================================
-- CAMPOS ADICIONAIS PARA ASSINATURAS (ADMIN)
-- =====================================================

-- Adicionar campos para controle de concessão por admin
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS grant_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Índice para buscar assinaturas concedidas por admin
CREATE INDEX IF NOT EXISTS idx_subscriptions_granted_by ON subscriptions(granted_by) WHERE granted_by IS NOT NULL;

-- Comentários
COMMENT ON COLUMN subscriptions.granted_by IS 'Admin que concedeu a assinatura (se aplicável)';
COMMENT ON COLUMN subscriptions.grant_reason IS 'Motivo da concessão pelo admin';
COMMENT ON COLUMN subscriptions.cancelled_by IS 'Admin que revogou a assinatura (se aplicável)';
COMMENT ON COLUMN subscriptions.cancel_reason IS 'Motivo da revogação';
COMMENT ON COLUMN subscriptions.cancelled_at IS 'Data/hora da revogação';

-- =====================================================
-- FUNÇÃO PARA VERIFICAR E EXPIRAR ASSINATURAS
-- Executa à meia-noite para expirar assinaturas vencidas
-- =====================================================

CREATE OR REPLACE FUNCTION check_expired_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    expired_sub RECORD;
BEGIN
    -- Buscar assinaturas que expiraram (ends_at < agora)
    FOR expired_sub IN 
        SELECT s.id, s.user_id, s.plan, s.ends_at
        FROM subscriptions s
        WHERE s.status = 'active'
        AND s.ends_at < NOW()
    LOOP
        -- Atualizar status para expirado
        UPDATE subscriptions 
        SET status = 'expired'
        WHERE id = expired_sub.id;
        
        -- Remover créditos ilimitados
        UPDATE credits 
        SET is_unlimited = false
        WHERE user_id = expired_sub.user_id;
        
        -- Criar notificação
        INSERT INTO notifications (user_id, type, title, message)
        VALUES (
            expired_sub.user_id,
            'system',
            'Assinatura Expirada',
            'Sua assinatura VIP expirou. Renove para continuar com créditos ilimitados e poder criar torneios!'
        );
        
        RAISE NOTICE 'Assinatura % do usuário % expirada', expired_sub.id, expired_sub.user_id;
    END LOOP;
END;
$$;

-- =====================================================
-- CRON JOB PARA VERIFICAR ASSINATURAS EXPIRADAS
-- Executa todo dia à meia-noite
-- =====================================================

-- Habilitar extensão pg_cron se disponível (Supabase tem por padrão)
-- SELECT cron.schedule('check-expired-subscriptions', '0 0 * * *', 'SELECT check_expired_subscriptions()');

-- Alternativa: Trigger que verifica na consulta
CREATE OR REPLACE FUNCTION auto_expire_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Se a assinatura está ativa mas já passou da data de expiração
    IF NEW.status = 'active' AND NEW.ends_at < NOW() THEN
        NEW.status := 'expired';
        
        -- Remover créditos ilimitados
        UPDATE credits 
        SET is_unlimited = false
        WHERE user_id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger para auto-expirar ao consultar
DROP TRIGGER IF EXISTS trg_auto_expire_subscription ON subscriptions;
CREATE TRIGGER trg_auto_expire_subscription
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION auto_expire_subscription();
