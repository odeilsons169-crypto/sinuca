-- =====================================================
-- MIGRATION: Sistema de Ranking Avançado
-- =====================================================

-- 1. Adicionar tipo weekly ao enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'weekly' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ranking_period')
    ) THEN
        ALTER TYPE ranking_period ADD VALUE IF NOT EXISTS 'weekly';
    END IF;
END $$;

-- 2. Recriar tabela de histórico
DROP TABLE IF EXISTS ranking_history CASCADE;

CREATE TABLE ranking_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    final_position INTEGER,
    final_points INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    matches_played INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_rh_user ON ranking_history(user_id);
CREATE INDEX idx_rh_period ON ranking_history(period_type, period_start);

-- 3. Adicionar colunas na tabela rankings
ALTER TABLE rankings ADD COLUMN IF NOT EXISTS week TEXT;
ALTER TABLE rankings ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0;
ALTER TABLE rankings ADD COLUMN IF NOT EXISTS losses INTEGER DEFAULT 0;
ALTER TABLE rankings ADD COLUMN IF NOT EXISTS matches_played INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_rankings_week ON rankings(week) WHERE week IS NOT NULL;

-- 4. Funções auxiliares
CREATE OR REPLACE FUNCTION get_current_week() RETURNS TEXT AS $$
BEGIN RETURN TO_CHAR(NOW(), 'IYYY-IW'); END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_current_month() RETURNS TEXT AS $$
BEGIN RETURN TO_CHAR(NOW(), 'YYYY-MM'); END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Índices únicos
DROP INDEX IF EXISTS idx_rankings_unique_global;
DROP INDEX IF EXISTS idx_rankings_unique_monthly;
DROP INDEX IF EXISTS idx_rankings_unique_weekly;

CREATE UNIQUE INDEX idx_rankings_unique_global ON rankings(user_id) WHERE period = 'global';
CREATE UNIQUE INDEX idx_rankings_unique_monthly ON rankings(user_id, month) WHERE period = 'monthly';

-- 6. RLS
ALTER TABLE ranking_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rh_select ON ranking_history;
CREATE POLICY rh_select ON ranking_history FOR SELECT USING (TRUE);
