import { supabase, supabaseAdmin } from '../../services/supabase.js';
import type { User } from '../../../shared/types/index.js';

export interface RegisterInput {
  email: string;
  password: string;
  username: string;
  fullname?: string;
  cpf?: string;
  phone?: string;
  country_code?: string;
  country_name?: string;
  state_code?: string;
  state_name?: string;
  city?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User | null;
  session: { access_token: string; refresh_token: string } | null;
  error: string | null;
}

// Cache de códigos de verificação (em produção usar Redis)
const verificationCodes = new Map<string, { code: string; expires: number; email: string; password: string; username: string }>();

export const authService = {
  // Gerar código de 6 dígitos
  generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  // Criar registros do usuário manualmente (caso o trigger falhe)
  async ensureUserRecords(userId: string, email: string, username: string, fullname?: string, cpf?: string, phone?: string, location?: { country_code?: string; country_name?: string; state_code?: string; state_name?: string; city?: string }): Promise<void> {
    // Verificar se já existe
    const { data: existing } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (existing) return; // Já existe, trigger funcionou

    // Criar manualmente
    try {
      // Garantir username único
      let finalUsername = username;
      const { data: usernameExists } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (usernameExists) {
        finalUsername = `${username}_${userId.substring(0, 4)}`;
      }

      // Inserir usuário
      await supabaseAdmin.from('users').insert({
        id: userId,
        email,
        username: finalUsername,
        fullname: fullname || null,
        cpf: cpf || null,
        phone: phone || null,
        country_code: location?.country_code || null,
        country_name: location?.country_name || null,
        state_code: location?.state_code || null,
        state_name: location?.state_name || null,
        city: location?.city || null,
        role: 'user',
        status: 'active',
      });

      // Inserir carteira
      await supabaseAdmin.from('wallet').insert({
        user_id: userId,
        balance: 0,
        is_blocked: false,
      });

      // Inserir créditos (2 grátis para novos usuários)
      await supabaseAdmin.from('credits').insert({
        user_id: userId,
        amount: 2,
        is_unlimited: false,
      });

      // Inserir estatísticas
      await supabaseAdmin.from('user_stats').insert({
        user_id: userId,
        total_matches: 0,
        wins: 0,
        losses: 0,
        win_rate: 0,
        total_credits_used: 0,
        total_bet_won: 0,
        total_bet_lost: 0,
        ranking_points: 0,
      });

      // Inserir ranking
      await supabaseAdmin.from('rankings').insert({
        user_id: userId,
        period: 'global',
        points: 0,
      });

      console.log(`✅ Registros criados manualmente para usuário ${userId}`);
    } catch (err) {
      console.error('Erro ao criar registros do usuário:', err);
    }
  },

  // Etapa 1: Iniciar registro (envia código por email)
  async startRegistration({ email, password, username }: RegisterInput): Promise<{ success: boolean; error: string | null }> {
    // Verificar se email já existe
    const { data: existingEmail } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('email', email)
      .single();

    if (existingEmail) {
      return { success: false, error: 'Este email já está cadastrado' };
    }

    // Verificar se username já existe
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('username')
      .eq('username', username)
      .single();

    if (existingUser) {
      return { success: false, error: 'Este nome de usuário já está em uso' };
    }

    // Gerar código
    const code = this.generateCode();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutos

    // Salvar no cache
    verificationCodes.set(email, { code, expires, email, password, username });

    // Enviar email com código (usando Supabase ou serviço externo)
    // Por enquanto, vamos logar o código (em produção, enviar email real)
    console.log(`📧 Código de verificação para ${email}: ${code}`);

    // Tentar enviar via Supabase (se configurado)
    try {
      await supabase.auth.signInWithOtp({
        email,
        options: {
          data: { verification_code: code, username },
          shouldCreateUser: false,
        },
      });
    } catch (e) {
      // Se falhar, o código ainda está no cache
      console.log('OTP via Supabase não disponível, usando código manual');
    }

    return { success: true, error: null };
  },

  // Etapa 2: Verificar código e criar conta
  async verifyAndRegister(email: string, code: string): Promise<AuthResponse> {
    const cached = verificationCodes.get(email);

    if (!cached) {
      return { user: null, session: null, error: 'Código expirado ou inválido. Solicite um novo.' };
    }

    if (Date.now() > cached.expires) {
      verificationCodes.delete(email);
      return { user: null, session: null, error: 'Código expirado. Solicite um novo.' };
    }

    if (cached.code !== code) {
      return { user: null, session: null, error: 'Código incorreto' };
    }

    // Código válido! Criar usuário
    verificationCodes.delete(email);

    const { data, error } = await supabase.auth.signUp({
      email: cached.email,
      password: cached.password,
      options: {
        data: { username: cached.username },
        emailRedirectTo: undefined, // Não precisa de redirect
      },
    });

    if (error) {
      return { user: null, session: null, error: error.message };
    }

    if (!data.user) {
      return { user: null, session: null, error: 'Erro ao criar usuário' };
    }

    // Garantir que os registros foram criados
    await this.ensureUserRecords(data.user.id, cached.email, cached.username);

    // Buscar perfil completo
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return {
      user: userProfile as User,
      session: data.session ? {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      } : null,
      error: null,
    };
  },

  // Registro direto (sem verificação de email - para desenvolvimento)
  async register({ email, password, username, fullname, cpf, phone, country_code, country_name, state_code, state_name, city }: RegisterInput): Promise<AuthResponse> {
    // Verificar se username já existe
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('username')
      .eq('username', username)
      .single();

    if (existingUser) {
      return { user: null, session: null, error: 'Username já está em uso' };
    }

    // Verificar se CPF já existe (uma conta por CPF)
    if (cpf) {
      const { data: existingCpf } = await supabaseAdmin
        .from('users')
        .select('id, cpf')
        .eq('cpf', cpf)
        .single();

      if (existingCpf) {
        return { user: null, session: null, error: 'Já existe uma conta cadastrada com este CPF. Cada pessoa pode ter apenas uma conta.' };
      }
    }

    // Criar usuário no Supabase Auth (sem confirmação de email)
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Já confirma automaticamente
      user_metadata: { username, fullname, cpf, phone, country_code, state_code, city },
    });

    if (error) {
      return { user: null, session: null, error: error.message };
    }

    if (!data.user) {
      return { user: null, session: null, error: 'Erro ao criar usuário' };
    }

    // Garantir que os registros foram criados
    await this.ensureUserRecords(data.user.id, email, username, fullname, cpf, phone, {
      country_code, country_name, state_code, state_name, city
    });

    // Fazer login automático
    const loginResult = await this.login({ email, password });
    
    return loginResult;
  },

  // Login
  async login({ email, password }: LoginInput): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { user: null, session: null, error: error.message };
    }

    // Garantir que os registros existem (fallback)
    await this.ensureUserRecords(data.user.id, data.user.email!, data.user.email!.split('@')[0]);

    // Verificar se usuário está ativo
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (userProfile?.status === 'banned') {
      await supabase.auth.signOut();
      return { user: null, session: null, error: 'Usuário banido' };
    }

    if (userProfile?.status === 'suspended') {
      await supabase.auth.signOut();
      return { user: null, session: null, error: 'Usuário suspenso temporariamente' };
    }

    return {
      user: userProfile as User,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
      error: null,
    };
  },

  // Logout
  async logout(accessToken: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signOut();
    return { error: error?.message || null };
  },

  // Verificar token e retornar usuário
  async getUser(accessToken: string): Promise<{ user: User | null; error: string | null }> {
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      return { user: null, error: error?.message || 'Token inválido' };
    }

    // Garantir registros existem
    await this.ensureUserRecords(user.id, user.email!, user.email!.split('@')[0]);

    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    return { user: userProfile as User, error: null };
  },

  // Recuperar senha
  async resetPassword(email: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/reset-password`,
    });

    return { error: error?.message || null };
  },

  // Atualizar senha
  async updatePassword(accessToken: string, newPassword: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message || null };
  },

  // Refresh token
  async refreshSession(refreshToken: string): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
      return { user: null, session: null, error: error?.message || 'Sessão expirada' };
    }

    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', data.user?.id)
      .single();

    return {
      user: userProfile as User,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
      error: null,
    };
  },
};
