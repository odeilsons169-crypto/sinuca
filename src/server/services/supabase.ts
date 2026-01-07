import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Validar variáveis de ambiente
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || supabaseUrl === 'https://SEU_PROJETO.supabase.co') {
    console.error('❌ ERRO: SUPABASE_URL não configurado no arquivo .env');
    console.error('   Edite o arquivo .env e configure as credenciais do Supabase.');
    console.error('   Obtenha em: https://app.supabase.com → Settings → API');
    process.exit(1);
}

if (!supabaseAnonKey || supabaseAnonKey.startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')) {
    console.error('❌ ERRO: SUPABASE_ANON_KEY não configurado no arquivo .env');
    console.error('   Edite o arquivo .env e configure as credenciais do Supabase.');
    process.exit(1);
}

if (!supabaseServiceKey || supabaseServiceKey.startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')) {
    console.error('❌ ERRO: SUPABASE_SERVICE_KEY não configurado no arquivo .env');
    console.error('   Edite o arquivo .env e configure as credenciais do Supabase.');
    process.exit(1);
}

console.log('✅ Supabase: Conectado a', supabaseUrl);

// Cliente público (para operações do usuário)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente admin (para operações privilegiadas - bypassa RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
