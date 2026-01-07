// Script para executar migration de assinaturas VIP
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bfazqquuxcrcdusdclwm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmYXpxcXV1eGNyY2R1c2RjbHdtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzE0ODQzMSwiZXhwIjoyMDgyNzI0NDMxfQ.Rg5zH_NWvkqKJAvx564MZWKt6iM8vpewDZL4ApnxBQ8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Executando migration de assinaturas VIP...\n');

  // 1. Adicionar colunas na tabela subscriptions
  console.log('1. Adicionando colunas de controle admin...');
  
  const alterTableSQL = `
    ALTER TABLE subscriptions 
    ADD COLUMN IF NOT EXISTS granted_by UUID,
    ADD COLUMN IF NOT EXISTS grant_reason TEXT,
    ADD COLUMN IF NOT EXISTS cancelled_by UUID,
    ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
  `;

  const { error: alterError } = await supabase.rpc('exec_sql', { sql: alterTableSQL });
  
  if (alterError) {
    console.log('   Nota: RPC exec_sql não disponível, verificando colunas...');
  }

  // Verificar se as colunas existem testando uma query
  const { data: testSub, error: testError } = await supabase
    .from('subscriptions')
    .select('id, granted_by, grant_reason, cancelled_by, cancel_reason, cancelled_at')
    .limit(1);

  if (testError && testError.message.includes('granted_by')) {
    console.log('❌ Colunas não existem. Execute o SQL manualmente:');
    console.log('\n--- COPIE E EXECUTE NO SUPABASE SQL EDITOR ---\n');
    console.log(alterTableSQL);
    console.log('\n--- FIM DO SQL ---\n');
  } else {
    console.log('✅ Colunas de controle admin OK');
  }

  // 2. Criar função de verificação de expiração
  console.log('\n2. Criando função check_expired_subscriptions...');
  
  const checkExpiredSQL = `
    CREATE OR REPLACE FUNCTION check_expired_subscriptions()
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
        expired_sub RECORD;
    BEGIN
        FOR expired_sub IN 
            SELECT s.id, s.user_id, s.plan, s.ends_at
            FROM subscriptions s
            WHERE s.status = 'active'
            AND s.ends_at < NOW()
        LOOP
            UPDATE subscriptions SET status = 'expired' WHERE id = expired_sub.id;
            UPDATE credits SET is_unlimited = false WHERE user_id = expired_sub.user_id;
            
            INSERT INTO notifications (user_id, type, title, message)
            VALUES (
                expired_sub.user_id,
                'system',
                'Assinatura Expirada',
                'Sua assinatura VIP expirou. Renove para continuar com créditos ilimitados!'
            );
        END LOOP;
    END;
    $$;
  `;

  const { error: funcError } = await supabase.rpc('exec_sql', { sql: checkExpiredSQL });
  
  if (funcError) {
    console.log('   ⚠️  Função precisa ser criada manualmente no SQL Editor');
  } else {
    console.log('✅ Função check_expired_subscriptions criada');
  }

  // 3. Criar trigger de auto-expiração
  console.log('\n3. Criando trigger de auto-expiração...');
  
  const triggerSQL = `
    CREATE OR REPLACE FUNCTION auto_expire_subscription()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
        IF NEW.status = 'active' AND NEW.ends_at < NOW() THEN
            NEW.status := 'expired';
            UPDATE credits SET is_unlimited = false WHERE user_id = NEW.user_id;
        END IF;
        RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS trg_auto_expire_subscription ON subscriptions;
    CREATE TRIGGER trg_auto_expire_subscription
        BEFORE UPDATE ON subscriptions
        FOR EACH ROW
        EXECUTE FUNCTION auto_expire_subscription();
  `;

  const { error: triggerError } = await supabase.rpc('exec_sql', { sql: triggerSQL });
  
  if (triggerError) {
    console.log('   ⚠️  Trigger precisa ser criado manualmente no SQL Editor');
  } else {
    console.log('✅ Trigger de auto-expiração criado');
  }

  // 4. Criar índice
  console.log('\n4. Criando índice...');
  
  const indexSQL = `
    CREATE INDEX IF NOT EXISTS idx_subscriptions_granted_by 
    ON subscriptions(granted_by) 
    WHERE granted_by IS NOT NULL;
  `;

  const { error: indexError } = await supabase.rpc('exec_sql', { sql: indexSQL });
  
  if (indexError) {
    console.log('   ⚠️  Índice precisa ser criado manualmente');
  } else {
    console.log('✅ Índice criado');
  }

  console.log('\n📋 Migration de assinaturas VIP concluída!');
  console.log('\n💡 Se algum item falhou, execute o arquivo EXECUTE_SUBSCRIPTION_ADMIN.sql no Supabase SQL Editor.');
}

runMigration().catch(console.error);
