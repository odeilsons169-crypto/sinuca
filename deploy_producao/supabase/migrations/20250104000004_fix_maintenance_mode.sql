-- =====================================================
-- CORRIGIR STATUS DE MANUTENÇÃO
-- Garante que maintenance_mode está como false
-- =====================================================

-- Atualizar para false se existir (value é JSONB)
UPDATE system_settings 
SET value = 'false'::jsonb
WHERE key = 'maintenance_mode';

-- Se não existir, inserir como false
INSERT INTO system_settings (key, value)
VALUES ('maintenance_mode', 'false'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = 'false'::jsonb;

SELECT 'Maintenance mode definido como FALSE' as status;
