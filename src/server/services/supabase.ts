import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// Cliente público (para operações do usuário)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente admin (para operações privilegiadas - bypassa RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
