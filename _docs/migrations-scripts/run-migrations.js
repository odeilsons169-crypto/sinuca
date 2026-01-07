// Script para executar migrations no Supabase
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bfazqquuxcrcdusdclwm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmYXpxcXV1eGNyY2R1c2RjbHdtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzE0ODQzMSwiZXhwIjoyMDgyNzI0NDMxfQ.Rg5zH_NWvkqKJAvx564MZWKt6iM8vpewDZL4ApnxBQ8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigrations() {
  console.log('🚀 Executando migrations...\n');

  // 1. Adicionar colunas na tabela users
  console.log('1. Adicionando colunas fullname, cpf, phone, is_admin...');
  
  const { error: e1 } = await supabase.rpc('exec_sql', { 
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS fullname VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf VARCHAR(11);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(15);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code VARCHAR(2);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS country_name VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS state_code VARCHAR(10);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS state_name VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
    `
  });

  if (e1) {
    console.log('   Nota: RPC não disponível, tentando via REST...');
  }

  // Testar se as colunas existem
  const { data: testUser, error: testError } = await supabase
    .from('users')
    .select('id, fullname, cpf, phone, is_admin, country_code')
    .limit(1);

  if (testError) {
    console.log('❌ Colunas ainda não existem:', testError.message);
    console.log('\n⚠️  Execute o SQL manualmente no Supabase Dashboard:');
    console.log('   Dashboard > SQL Editor > Cole o conteúdo de EXECUTE_IN_SUPABASE.sql');
  } else {
    console.log('✅ Colunas já existem na tabela users');
  }

  // 2. Verificar tabela available_countries
  const { data: countries, error: countriesError } = await supabase
    .from('available_countries')
    .select('*')
    .limit(1);

  if (countriesError) {
    console.log('❌ Tabela available_countries não existe');
  } else {
    console.log('✅ Tabela available_countries existe');
  }

  // 3. Verificar tabela role_permissions
  const { data: perms, error: permsError } = await supabase
    .from('role_permissions')
    .select('*')
    .limit(1);

  if (permsError) {
    console.log('❌ Tabela role_permissions não existe');
  } else {
    console.log('✅ Tabela role_permissions existe');
  }

  console.log('\n📋 Status das migrations verificado.');
}

runMigrations().catch(console.error);
