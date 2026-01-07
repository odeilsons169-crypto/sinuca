-- =====================================================
-- EXECUTE ESTE SQL NO SUPABASE SQL EDITOR
-- Sistema de Assinaturas VIP com Controle de Admin
-- =====================================================

-- 1. Adicionar campos para controle de concessão por admin
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS granted_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS grant_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 2. Índice para buscar assinaturas concedidas por admin
CREATE INDEX IF NOT EXISTS idx_subscriptions_granted_by ON subscriptions(granted_by) WHERE granted_by IS NOT NULL;

-- 3. Função para verificar e expirar assinaturas vencidas
CREATE OR REPLACE FUNCTION check_expired_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    expired_sub RECORD;
BEGIN
    FOR expired_sub IN 
        SELECT s.id, s.user_id, s.plan, s.ends_at
        FROM subscriptions s
        WHERE s.status = 'active'
        AND s.ends_at < NOW()
    LOOP
        UPDATE subscriptions SET status = 'expired' WHERE id = expired_sub.id;
        UPDATE credits SET is_unlimited = false WHERE user_id = expired_sub.user_id;
        
        INSERT INTO notifications (user_id, type, title, message)
        VALUES (
            expired_sub.user_id,
            'system',
            'Assinatura Expirada',
            'Sua assinatura VIP expirou. Renove para continuar com créditos ilimitados e poder criar torneios!'
        );
    END LOOP;
END;
$$;

-- 4. Trigger para auto-expirar assinaturas
CREATE OR REPLACE FUNCTION auto_expire_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'active' AND NEW.ends_at < NOW() THEN
        NEW.status := 'expired';
        UPDATE credits SET is_unlimited = false WHERE user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_expire_subscription ON subscriptions;
CREATE TRIGGER trg_auto_expire_subscription
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION auto_expire_subscription();

-- 5. (OPCIONAL) Agendar verificação diária à meia-noite
-- Descomente se seu Supabase tiver pg_cron habilitado:
-- SELECT cron.schedule('check-expired-subscriptions', '0 0 * * *', 'SELECT check_expired_subscriptions()');

SELECT 'Migration de assinaturas VIP executada com sucesso!' as status;
