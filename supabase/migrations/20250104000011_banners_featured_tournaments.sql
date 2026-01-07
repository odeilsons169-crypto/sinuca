-- =====================================================
-- MIGRATION: Sistema de Banners e Torneios em Destaque
-- =====================================================

-- 1. Tabela de Banners
CREATE TABLE IF NOT EXISTS banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    subtitle VARCHAR(500),
    image_url TEXT,
    link_url TEXT,
    link_text VARCHAR(100) DEFAULT 'Saiba mais',
    position VARCHAR(50) DEFAULT 'home_top', -- home_top, home_middle, tournaments, lobby
    display_order INTEGER DEFAULT 0,
    background_color VARCHAR(50),
    text_color VARCHAR(50) DEFAULT '#ffffff',
    is_active BOOLEAN DEFAULT true,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    click_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    tournament_id UUID REFERENCES tournaments(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para banners
CREATE INDEX IF NOT EXISTS idx_banners_position ON banners(position);
CREATE INDEX IF NOT EXISTS idx_banners_active ON banners(is_active);
CREATE INDEX IF NOT EXISTS idx_banners_order ON banners(display_order);
CREATE INDEX IF NOT EXISTS idx_banners_dates ON banners(starts_at, ends_at);

-- 2. Adicionar campo de destaque nos torneios
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS featured_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS banner_image_url TEXT,
ADD COLUMN IF NOT EXISTS banner_color VARCHAR(50);

-- Índice para torneios em destaque
CREATE INDEX IF NOT EXISTS idx_tournaments_featured ON tournaments(is_featured, featured_order);

-- 3. Função para obter banners ativos
CREATE OR REPLACE FUNCTION get_active_banners(p_position TEXT DEFAULT NULL)
RETURNS TABLE(
    banner_id UUID,
    banner_title VARCHAR,
    banner_subtitle VARCHAR,
    banner_image_url TEXT,
    banner_link_url TEXT,
    banner_link_text VARCHAR,
    banner_position VARCHAR,
    banner_display_order INTEGER,
    banner_background_color VARCHAR,
    banner_text_color VARCHAR,
    banner_tournament_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.title,
        b.subtitle,
        b.image_url,
        b.link_url,
        b.link_text,
        b.position,
        b.display_order,
        b.background_color,
        b.text_color,
        b.tournament_id
    FROM banners b
    WHERE b.is_active = true
    AND (b.starts_at IS NULL OR b.starts_at <= NOW())
    AND (b.ends_at IS NULL OR b.ends_at > NOW())
    AND (p_position IS NULL OR b.position = p_position)
    ORDER BY b.display_order ASC, b.created_at DESC;
END;
$$;

-- 4. Função para obter torneios em destaque
CREATE OR REPLACE FUNCTION get_featured_tournaments(p_limit INTEGER DEFAULT 6)
RETURNS TABLE(
    tournament_id UUID,
    tournament_name VARCHAR,
    tournament_description TEXT,
    tournament_start_date TIMESTAMPTZ,
    tournament_registration_start_date TIMESTAMPTZ,
    tournament_registration_end_date TIMESTAMPTZ,
    tournament_entry_fee DECIMAL,
    tournament_prize_pool DECIMAL,
    tournament_max_participants INTEGER,
    tournament_current_participants INTEGER,
    tournament_status VARCHAR,
    tournament_game_mode VARCHAR,
    tournament_is_vip_only BOOLEAN,
    tournament_is_featured BOOLEAN,
    tournament_featured_order INTEGER,
    tournament_banner_image_url TEXT,
    tournament_banner_color VARCHAR,
    tournament_created_by_player BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.description,
        t.start_date,
        t.registration_start_date,
        t.registration_end_date,
        t.entry_fee,
        t.prize_pool,
        t.max_participants,
        t.current_participants,
        t.status,
        t.game_mode,
        t.is_vip_only,
        t.is_featured,
        t.featured_order,
        t.banner_image_url,
        t.banner_color,
        t.created_by_player
    FROM tournaments t
    WHERE t.status IN ('open', 'scheduled', 'registration_closed')
    AND (t.is_featured = true OR t.status = 'open')
    ORDER BY 
        t.is_featured DESC,
        t.featured_order ASC,
        t.start_date ASC
    LIMIT p_limit;
END;
$$;

-- 5. Função para incrementar visualização de banner
CREATE OR REPLACE FUNCTION increment_banner_view(p_banner_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE banners
    SET view_count = view_count + 1
    WHERE id = p_banner_id;
END;
$$;

-- 6. Função para incrementar clique de banner
CREATE OR REPLACE FUNCTION increment_banner_click(p_banner_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE banners
    SET click_count = click_count + 1
    WHERE id = p_banner_id;
END;
$$;

-- Comentários
COMMENT ON TABLE banners IS 'Banners promocionais para exibição na plataforma';
COMMENT ON COLUMN banners.position IS 'Posição do banner: home_top, home_middle, tournaments, lobby';
COMMENT ON COLUMN tournaments.is_featured IS 'Se o torneio deve aparecer em destaque no carrossel';
COMMENT ON COLUMN tournaments.featured_order IS 'Ordem de exibição no carrossel (menor = primeiro)';
