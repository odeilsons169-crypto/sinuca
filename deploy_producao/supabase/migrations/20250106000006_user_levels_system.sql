-- Habilitar extensão para UUID se não existir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Adicionar colunas de nível à tabela users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS xp_to_next_level INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0;

-- Tabela de histórico de XP
CREATE TABLE IF NOT EXISTS xp_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    xp_amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    total_xp_after INTEGER NOT NULL,
    level_after INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de subida de nível
CREATE TABLE IF NOT EXISTS level_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    old_level INTEGER NOT NULL,
    new_level INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE xp_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE level_ups ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS (Usuário vê seu próprio histórico)
CREATE POLICY "Users can view own xp history" ON xp_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own level ups" ON level_ups
    FOR SELECT USING (auth.uid() = user_id);

-- Trigger para definir xp_to_next_level padrão se não estiver definido
CREATE OR REPLACE FUNCTION set_default_xp_to_next_level()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.xp_to_next_level IS NULL THEN
        NEW.xp_to_next_level := 100;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_default_xp_on_insert ON users;
CREATE TRIGGER tr_set_default_xp_on_insert
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION set_default_xp_to_next_level();
