-- Tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ler/escrever
CREATE POLICY "Admins can read settings" ON system_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update settings" ON system_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Inserir configurações padrão
INSERT INTO system_settings (key, value) VALUES
  ('credits_price_per_unit', '0.50'),
  ('credits_packages', '[{"amount": 4, "price": 2.00, "bonus": 0}, {"amount": 20, "price": 10.00, "bonus": 0}, {"amount": 40, "price": 20.00, "bonus": 0}, {"amount": 100, "price": 50.00, "bonus": 0}]'),
  ('free_credits_on_register', '2'),
  ('daily_free_credits', '0'),
  ('platform_fee_percent', '10'),
  ('withdrawal_fee_percent', '0'),
  ('min_withdrawal_amount', '20.00'),
  ('min_bet_amount', '5.00'),
  ('max_bet_amount', '1000.00'),
  ('bet_enabled', 'true'),
  ('casual_mode_enabled', 'true'),
  ('ranked_mode_enabled', 'true'),
  ('bet_mode_enabled', 'true'),
  ('ai_mode_enabled', 'false'),
  ('credits_per_match', '1'),
  ('match_timeout_minutes', '30'),
  ('turn_timeout_seconds', '60'),
  ('points_per_win', '25'),
  ('points_per_loss', '-10'),
  ('ranking_reset_day', '1'),
  ('max_rooms_per_user', '1'),
  ('max_active_matches', '1'),
  ('max_daily_matches', '50'),
  ('maintenance_mode', 'false'),
  ('maintenance_message', '"Sistema em manutenção. Voltamos em breve!"')
ON CONFLICT (key) DO NOTHING;
