-- =====================================================
-- MIGRATION: Sistema de Playlist/Música
-- Upload de arquivos ou YouTube (apenas áudio)
-- =====================================================

-- 1. Tabela de músicas/playlists
CREATE TABLE IF NOT EXISTS music_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    artist TEXT,
    source_type TEXT NOT NULL CHECK (source_type IN ('upload', 'youtube')),
    -- Para upload: URL do arquivo no storage
    file_url TEXT,
    -- Para YouTube: ID do vídeo
    youtube_id TEXT,
    -- Duração em segundos
    duration INTEGER,
    -- Thumbnail/capa
    thumbnail_url TEXT,
    -- Gênero/categoria
    genre TEXT,
    -- Ordem na playlist
    display_order INTEGER DEFAULT 0,
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    -- Quem adicionou
    added_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Tabela de preferências de música do usuário
CREATE TABLE IF NOT EXISTS user_music_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    -- Música está habilitada durante partidas
    music_enabled BOOLEAN DEFAULT TRUE,
    -- Volume (0-100)
    volume INTEGER DEFAULT 50 CHECK (volume >= 0 AND volume <= 100),
    -- Músicas favoritas
    favorite_tracks UUID[] DEFAULT '{}',
    -- Última música tocada
    last_played_track UUID REFERENCES music_tracks(id),
    -- Modo de reprodução: 'sequential', 'shuffle', 'repeat_one', 'repeat_all'
    play_mode TEXT DEFAULT 'shuffle',
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Tabela de histórico de reprodução (opcional, para analytics)
CREATE TABLE IF NOT EXISTS music_play_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
    played_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    -- Contexto: 'match', 'lobby', 'menu'
    context TEXT DEFAULT 'match'
);

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_music_tracks_active ON music_tracks(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_music_tracks_genre ON music_tracks(genre) WHERE genre IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_music_prefs_user ON user_music_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_music_history_user ON music_play_history(user_id, played_at DESC);

-- 5. Trigger para updated_at
CREATE TRIGGER trigger_music_tracks_updated_at
    BEFORE UPDATE ON music_tracks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_user_music_prefs_updated_at
    BEFORE UPDATE ON user_music_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6. RLS
ALTER TABLE music_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_music_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_play_history ENABLE ROW LEVEL SECURITY;

-- Músicas: todos podem ver ativas, admin pode tudo
CREATE POLICY music_tracks_select ON music_tracks
    FOR SELECT USING (is_active = TRUE OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (is_admin = TRUE OR role IN ('admin', 'super_admin'))));

CREATE POLICY music_tracks_admin ON music_tracks
    FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (is_admin = TRUE OR role IN ('admin', 'super_admin'))));

-- Preferências: usuário vê/edita as próprias
CREATE POLICY user_music_prefs_own ON user_music_preferences
    FOR ALL USING (user_id = auth.uid());

-- Histórico: usuário vê o próprio
CREATE POLICY music_history_own ON music_play_history
    FOR ALL USING (user_id = auth.uid());

-- 7. Função para obter playlist ativa
CREATE OR REPLACE FUNCTION get_active_playlist(p_genre TEXT DEFAULT NULL)
RETURNS TABLE (
    track_id UUID,
    title TEXT,
    artist TEXT,
    source_type TEXT,
    file_url TEXT,
    youtube_id TEXT,
    duration INTEGER,
    thumbnail_url TEXT,
    genre TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mt.id,
        mt.title,
        mt.artist,
        mt.source_type,
        mt.file_url,
        mt.youtube_id,
        mt.duration,
        mt.thumbnail_url,
        mt.genre
    FROM music_tracks mt
    WHERE mt.is_active = TRUE
    AND (p_genre IS NULL OR mt.genre = p_genre)
    ORDER BY mt.display_order, mt.title;
END;
$$ LANGUAGE plpgsql;

-- 8. Configurações de música no sistema (se a tabela settings existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings') THEN
        INSERT INTO settings (key, value, description) VALUES
            ('music_enabled', 'true', 'Habilitar sistema de música'),
            ('music_max_volume', '100', 'Volume máximo permitido'),
            ('music_default_genre', 'all', 'Gênero padrão'),
            ('music_youtube_enabled', 'true', 'Permitir músicas do YouTube')
        ON CONFLICT (key) DO NOTHING;
    END IF;
END $$;

-- 9. Comentários
COMMENT ON TABLE music_tracks IS 'Músicas disponíveis para reprodução durante partidas';
COMMENT ON TABLE user_music_preferences IS 'Preferências de música de cada usuário';
COMMENT ON TABLE music_play_history IS 'Histórico de reprodução para analytics';
