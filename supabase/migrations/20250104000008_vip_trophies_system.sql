-- =====================================================
-- SISTEMA VIP E TROFÉUS VIRTUAIS
-- =====================================================

-- 1. BIBLIOTECA DE TROFÉUS VIRTUAIS
-- =====================================================
CREATE TABLE IF NOT EXISTS trophies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    rarity VARCHAR(20) DEFAULT 'common', -- common, rare, epic, legendary
    category VARCHAR(50) DEFAULT 'tournament', -- tournament, achievement, special
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Inserir troféus padrão
INSERT INTO trophies (name, description, image_url, rarity, category) VALUES
('🏆 Troféu de Ouro', 'Troféu dourado para campeões', '/trophies/gold.png', 'legendary', 'tournament'),
('🥈 Troféu de Prata', 'Troféu prateado para vice-campeões', '/trophies/silver.png', 'epic', 'tournament'),
('🥉 Troféu de Bronze', 'Troféu de bronze para terceiro lugar', '/trophies/bronze.png', 'rare', 'tournament'),
('⭐ Estrela de Campeão', 'Estrela especial para campeões', '/trophies/star.png', 'legendary', 'tournament'),
('🎱 Mestre da Sinuca', 'Para mestres do taco', '/trophies/master.png', 'epic', 'tournament'),
('👑 Coroa Real', 'Coroa para reis do torneio', '/trophies/crown.png', 'legendary', 'tournament'),
('🔥 Fênix de Fogo', 'Troféu flamejante', '/trophies/phoenix.png', 'epic', 'tournament'),
('💎 Diamante', 'Troféu de diamante', '/trophies/diamond.png', 'legendary', 'tournament'),
('🌟 Supernova', 'Brilho de supernova', '/trophies/supernova.png', 'rare', 'tournament'),
('🎯 Precisão Perfeita', 'Para jogadas perfeitas', '/trophies/precision.png', 'rare', 'achievement')
ON CONFLICT DO NOTHING;

-- 2. TROFÉUS DOS USUÁRIOS (SALA DE TROFÉUS)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_trophies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trophy_id UUID NOT NULL REFERENCES trophies(id),
    tournament_id UUID REFERENCES tournaments(id),
    position INTEGER, -- 1, 2, 3, etc.
    awarded_at TIMESTAMPTZ DEFAULT NOW(),
    is_featured BOOLEAN DEFAULT false, -- Troféu em destaque no perfil
    UNIQUE(user_id, trophy_id, tournament_id)
);

CREATE INDEX IF NOT EXISTS idx_user_trophies_user ON user_trophies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trophies_featured ON user_trophies(user_id, is_featured) WHERE is_featured = true;

-- 3. CONFIGURAÇÃO DA SALA DE TROFÉUS
-- =====================================================
CREATE TABLE IF NOT EXISTS trophy_room_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT true,
    display_style VARCHAR(20) DEFAULT 'grid', -- grid, list, showcase
    background_theme VARCHAR(50) DEFAULT 'default',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ADICIONAR TROFÉU AO TORNEIO
-- =====================================================
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS trophy_id UUID REFERENCES trophies(id),
ADD COLUMN IF NOT EXISTS trophy_2nd_id UUID REFERENCES trophies(id),
ADD COLUMN IF NOT EXISTS trophy_3rd_id UUID REFERENCES trophies(id);

-- 5. PLANOS VIP
-- =====================================================
CREATE TABLE IF NOT EXISTS vip_plans (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    duration_days INTEGER NOT NULL,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO vip_plans (id, name, price, duration_days, features) VALUES
('monthly', 'VIP Mensal', 19.90, 30, '["Créditos ilimitados", "Criar torneios", "Selo VIP", "Sem anúncios", "Suporte prioritário"]'),
('yearly', 'VIP Anual', 149.90, 365, '["Créditos ilimitados", "Criar torneios", "Selo VIP", "Sem anúncios", "Suporte prioritário", "2 meses grátis", "Troféu exclusivo"]')
ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, features = EXCLUDED.features;

-- 6. PAGAMENTOS DE ASSINATURA VIP
-- =====================================================
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) DEFAULT 'credits', -- credits, vip_subscription
ADD COLUMN IF NOT EXISTS vip_plan_id VARCHAR(20) REFERENCES vip_plans(id),
ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES subscriptions(id);

-- 7. FUNÇÃO PARA ATIVAR VIP APÓS PAGAMENTO
-- =====================================================
CREATE OR REPLACE FUNCTION activate_vip_subscription(
    p_user_id UUID,
    p_plan_id VARCHAR(20),
    p_payment_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan RECORD;
    v_subscription_id UUID;
    v_ends_at TIMESTAMPTZ;
BEGIN
    -- Buscar plano
    SELECT * INTO v_plan FROM vip_plans WHERE id = p_plan_id AND is_active = true;
    
    IF v_plan IS NULL THEN
        RAISE EXCEPTION 'Plano VIP não encontrado';
    END IF;
    
    -- Calcular data de expiração (meia-noite do último dia)
    v_ends_at := (NOW() + (v_plan.duration_days || ' days')::INTERVAL)::DATE + INTERVAL '23 hours 59 minutes 59 seconds';
    
    -- Verificar se já tem assinatura ativa
    SELECT id INTO v_subscription_id 
    FROM subscriptions 
    WHERE user_id = p_user_id AND status = 'active' AND ends_at > NOW();
    
    IF v_subscription_id IS NOT NULL THEN
        -- Estender assinatura existente
        UPDATE subscriptions SET
            ends_at = ends_at + (v_plan.duration_days || ' days')::INTERVAL,
            plan = p_plan_id,
            payment_id = p_payment_id
        WHERE id = v_subscription_id;
    ELSE
        -- Criar nova assinatura
        INSERT INTO subscriptions (
            user_id, plan, status, starts_at, ends_at, auto_renew, payment_id
        ) VALUES (
            p_user_id, p_plan_id, 'active', NOW(), v_ends_at, false, p_payment_id
        ) RETURNING id INTO v_subscription_id;
    END IF;
    
    -- Ativar créditos ilimitados
    UPDATE credits SET is_unlimited = true WHERE user_id = p_user_id;
    
    -- Criar configuração da sala de troféus se não existir
    INSERT INTO trophy_room_settings (user_id) 
    VALUES (p_user_id) 
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Notificar usuário
    INSERT INTO notifications (user_id, type, title, message)
    VALUES (
        p_user_id,
        'system',
        '👑 VIP Ativado!',
        'Sua assinatura VIP foi ativada com sucesso! Aproveite os créditos ilimitados e crie seus próprios torneios!'
    );
    
    -- Se for plano anual, dar troféu exclusivo
    IF p_plan_id = 'yearly' THEN
        INSERT INTO user_trophies (user_id, trophy_id, position)
        SELECT p_user_id, id, NULL
        FROM trophies 
        WHERE name = '💎 Diamante'
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Atualizar pagamento com subscription_id
    UPDATE payments SET subscription_id = v_subscription_id WHERE id = p_payment_id;
    
    RETURN v_subscription_id;
END;
$$;

-- 8. FUNÇÃO PARA CONCEDER TROFÉU AO VENCEDOR
-- =====================================================
CREATE OR REPLACE FUNCTION award_tournament_trophy(
    p_tournament_id UUID,
    p_user_id UUID,
    p_position INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trophy_id UUID;
BEGIN
    -- Buscar troféu baseado na posição
    SELECT 
        CASE p_position
            WHEN 1 THEN trophy_id
            WHEN 2 THEN trophy_2nd_id
            WHEN 3 THEN trophy_3rd_id
        END INTO v_trophy_id
    FROM tournaments 
    WHERE id = p_tournament_id;
    
    -- Se não tem troféu específico, usar padrão
    IF v_trophy_id IS NULL THEN
        SELECT id INTO v_trophy_id 
        FROM trophies 
        WHERE category = 'tournament' 
        AND rarity = CASE p_position
            WHEN 1 THEN 'legendary'
            WHEN 2 THEN 'epic'
            WHEN 3 THEN 'rare'
            ELSE 'common'
        END
        LIMIT 1;
    END IF;
    
    IF v_trophy_id IS NOT NULL THEN
        INSERT INTO user_trophies (user_id, trophy_id, tournament_id, position)
        VALUES (p_user_id, v_trophy_id, p_tournament_id, p_position)
        ON CONFLICT DO NOTHING;
        
        -- Notificar usuário
        INSERT INTO notifications (user_id, type, title, message)
        VALUES (
            p_user_id,
            'achievement',
            '🏆 Novo Troféu!',
            'Parabéns! Você ganhou um troféu por sua conquista no torneio!'
        );
    END IF;
END;
$$;

-- 9. VIEW PARA SALA DE TROFÉUS
-- =====================================================
CREATE OR REPLACE VIEW user_trophy_room AS
SELECT 
    ut.id,
    ut.user_id,
    ut.trophy_id,
    ut.tournament_id,
    ut.position,
    ut.awarded_at,
    ut.is_featured,
    t.name AS trophy_name,
    t.description AS trophy_description,
    t.image_url AS trophy_image,
    t.rarity AS trophy_rarity,
    t.category AS trophy_category,
    tn.name AS tournament_name,
    trs.is_public,
    trs.display_style,
    trs.background_theme
FROM user_trophies ut
JOIN trophies t ON ut.trophy_id = t.id
LEFT JOIN tournaments tn ON ut.tournament_id = tn.id
LEFT JOIN trophy_room_settings trs ON ut.user_id = trs.user_id;

SELECT 'Sistema VIP e Troféus criado com sucesso!' as status;
