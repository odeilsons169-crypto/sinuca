-- Remover trigger problemático que causa recursão
DROP TRIGGER IF EXISTS trigger_update_ranking_positions ON rankings;
DROP FUNCTION IF EXISTS update_ranking_positions();

-- Criar função que não causa recursão
CREATE OR REPLACE FUNCTION update_ranking_positions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Atualizar posições do ranking global
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY points DESC) as pos
    FROM rankings
    WHERE period = 'global'
  )
  UPDATE rankings r
  SET position = ranked.pos
  FROM ranked
  WHERE r.id = ranked.id
    AND (r.position IS NULL OR r.position != ranked.pos);
END;
$$;

-- Não criar trigger automático - será chamado manualmente quando necessário
-- Isso evita a recursão infinita
