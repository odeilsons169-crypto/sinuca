-- =====================================================
-- VERIFICAR E CORRIGIR STATUS DE MANUTENÇÃO
-- Execute este script no Supabase SQL Editor
-- =====================================================

-- 1. Verificar valor atual
SELECT key, value, typeof(value) as tipo
FROM system_settings 
WHERE key = 'maintenance_mode';

-- 2. Se o valor estiver como true, corrigir para false
UPDATE system_settings 
SET value = false, updated_at = NOW()
WHERE key = 'maintenance_mode';

-- 3. Verificar novamente
SELECT key, value 
FROM system_settings 
WHERE key = 'maintenance_mode';

-- 4. Mostrar todas as configurações de manutenção
SELECT key, value 
FROM system_settings 
WHERE key LIKE '%maintenance%' OR key LIKE '%contact%';
