-- =====================================================
-- MIGRATION: Corrigir políticas RLS para incluir super_admin
-- =====================================================

-- 1. Corrigir políticas de system_settings
DROP POLICY IF EXISTS "Admins can read settings" ON system_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON system_settings;

CREATE POLICY "Admins can read settings" ON system_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true))
  );

CREATE POLICY "Admins can manage settings" ON system_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true))
  );

-- 2. Corrigir políticas de payment_settings
DROP POLICY IF EXISTS "Admins can manage payment_settings" ON payment_settings;

CREATE POLICY "Admins can manage payment_settings" ON payment_settings 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin') OR is_admin = true))
  );

-- 3. Corrigir políticas de payments
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;

CREATE POLICY "Admins can view all payments" ON payments 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin', 'manager') OR is_admin = true))
  );

-- 4. Corrigir políticas de withdrawals
DROP POLICY IF EXISTS "Admins can manage withdrawals" ON withdrawals;

CREATE POLICY "Admins can manage withdrawals" ON withdrawals 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin', 'manager', 'employee') OR is_admin = true))
  );

-- 5. Corrigir políticas de admin_logs
DROP POLICY IF EXISTS "Admins can view logs" ON admin_logs;
DROP POLICY IF EXISTS "Admins can insert logs" ON admin_logs;

CREATE POLICY "Admins can view logs" ON admin_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin', 'manager') OR is_admin = true))
  );

CREATE POLICY "Admins can insert logs" ON admin_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role IN ('admin', 'super_admin', 'manager', 'moderator', 'employee') OR is_admin = true))
  );

-- 6. Garantir que a tabela payment_settings tenha pelo menos um registro
INSERT INTO payment_settings (environment, is_active) 
SELECT 'sandbox', false
WHERE NOT EXISTS (SELECT 1 FROM payment_settings);
