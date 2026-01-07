-- Adicionar campo is_private na tabela rooms
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- Adicionar campo invite_code para salas privadas
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS invite_code VARCHAR(8);

-- Adicionar campo last_free_credit na tabela credits
ALTER TABLE credits ADD COLUMN IF NOT EXISTS last_free_credit TIMESTAMPTZ;

-- Criar índice para busca por código de convite
CREATE INDEX IF NOT EXISTS idx_rooms_invite_code ON rooms(invite_code) WHERE invite_code IS NOT NULL;

-- Criar índice para salas públicas abertas
CREATE INDEX IF NOT EXISTS idx_rooms_public_open ON rooms(status, is_private) WHERE status = 'open' AND is_private = FALSE;

-- Função para gerar código de convite
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_private = TRUE AND NEW.invite_code IS NULL THEN
    NEW.invite_code := upper(substring(md5(random()::text) from 1 for 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar código automaticamente
DROP TRIGGER IF EXISTS trigger_generate_invite_code ON rooms;
CREATE TRIGGER trigger_generate_invite_code
  BEFORE INSERT ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION generate_invite_code();
