-- =====================================================
-- MIGRATION: Adicionar CPF, Telefone e Nome Completo
-- =====================================================
-- Objetivo: Garantir dados válidos para pagamentos e segurança
-- - CPF único por conta (uma conta por pessoa)
-- - Telefone para contato
-- - Nome completo para pagamentos

-- Adicionar colunas na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS fullname VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf VARCHAR(11);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(15);

-- Criar índice único para CPF (uma conta por CPF)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cpf_unique ON users(cpf) WHERE cpf IS NOT NULL;

-- Criar índice para busca por telefone
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;

-- Comentários nas colunas
COMMENT ON COLUMN users.fullname IS 'Nome completo do usuário (para pagamentos)';
COMMENT ON COLUMN users.cpf IS 'CPF do usuário (único, para pagamentos e identificação)';
COMMENT ON COLUMN users.phone IS 'Telefone/WhatsApp do usuário (para contato)';

-- Função para validar CPF (algoritmo brasileiro)
CREATE OR REPLACE FUNCTION validate_cpf(cpf_input VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  cpf_clean VARCHAR;
  sum1 INT := 0;
  sum2 INT := 0;
  digit1 INT;
  digit2 INT;
  i INT;
BEGIN
  -- Remover caracteres não numéricos
  cpf_clean := regexp_replace(cpf_input, '[^0-9]', '', 'g');
  
  -- Verificar se tem 11 dígitos
  IF length(cpf_clean) != 11 THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar se todos os dígitos são iguais
  IF cpf_clean ~ '^(\d)\1+$' THEN
    RETURN FALSE;
  END IF;
  
  -- Calcular primeiro dígito verificador
  FOR i IN 1..9 LOOP
    sum1 := sum1 + (substring(cpf_clean, i, 1)::INT * (11 - i));
  END LOOP;
  digit1 := (sum1 * 10) % 11;
  IF digit1 = 10 OR digit1 = 11 THEN
    digit1 := 0;
  END IF;
  
  -- Verificar primeiro dígito
  IF digit1 != substring(cpf_clean, 10, 1)::INT THEN
    RETURN FALSE;
  END IF;
  
  -- Calcular segundo dígito verificador
  FOR i IN 1..10 LOOP
    sum2 := sum2 + (substring(cpf_clean, i, 1)::INT * (12 - i));
  END LOOP;
  digit2 := (sum2 * 10) % 11;
  IF digit2 = 10 OR digit2 = 11 THEN
    digit2 := 0;
  END IF;
  
  -- Verificar segundo dígito
  IF digit2 != substring(cpf_clean, 11, 1)::INT THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger para validar CPF antes de inserir/atualizar
CREATE OR REPLACE FUNCTION check_cpf_valid()
RETURNS TRIGGER AS $$
BEGIN
  -- Se CPF foi fornecido, validar
  IF NEW.cpf IS NOT NULL AND NEW.cpf != '' THEN
    -- Limpar CPF (apenas números)
    NEW.cpf := regexp_replace(NEW.cpf, '[^0-9]', '', 'g');
    
    -- Validar formato
    IF NOT validate_cpf(NEW.cpf) THEN
      RAISE EXCEPTION 'CPF inválido';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_check_cpf ON users;
CREATE TRIGGER trigger_check_cpf
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION check_cpf_valid();

-- Política RLS para proteger dados sensíveis
-- Usuários só podem ver seu próprio CPF completo
CREATE POLICY "Users can view own sensitive data" ON users
  FOR SELECT
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

-- Log de auditoria para alterações de CPF
CREATE OR REPLACE FUNCTION log_cpf_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.cpf IS DISTINCT FROM NEW.cpf THEN
    INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
    VALUES (
      COALESCE(auth.uid(), NEW.id),
      'cpf_change',
      'user',
      NEW.id,
      jsonb_build_object(
        'old_cpf_masked', CASE WHEN OLD.cpf IS NOT NULL THEN '***' || right(OLD.cpf, 4) ELSE NULL END,
        'new_cpf_masked', CASE WHEN NEW.cpf IS NOT NULL THEN '***' || right(NEW.cpf, 4) ELSE NULL END
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_cpf_change ON users;
CREATE TRIGGER trigger_log_cpf_change
  AFTER UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION log_cpf_change();
