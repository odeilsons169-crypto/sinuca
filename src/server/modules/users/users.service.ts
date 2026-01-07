import { supabaseAdmin } from '../../services/supabase.js';
import type { User, UserStats } from '../../../shared/types/index.js';

export interface UpdateProfileInput {
  username?: string;
  avatar_url?: string;
  country_code?: string;
  country_name?: string;
}

export const usersService = {
  // Buscar usuário por ID
  async getById(userId: string): Promise<User | null> {
    const { data } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    return data as User | null;
  },

  // Buscar usuário por username
  async getByUsername(username: string): Promise<User | null> {
    const { data } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    return data as User | null;
  },

  // Atualizar perfil
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<{ user: User | null; error: string | null }> {
    // Verificar se username já existe (se estiver atualizando)
    if (input.username) {
      const existing = await this.getByUsername(input.username);
      if (existing && existing.id !== userId) {
        return { user: null, error: 'Username já está em uso' };
      }
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(input)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return { user: null, error: error.message };
    }

    return { user: data as User, error: null };
  },

  // Buscar estatísticas do usuário
  async getStats(userId: string): Promise<UserStats | null> {
    const { data } = await supabaseAdmin
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    return data as UserStats | null;
  },

  // Buscar perfil completo (usuário + stats + ranking)
  async getFullProfile(userId: string) {
    const [user, stats, ranking] = await Promise.all([
      this.getById(userId),
      this.getStats(userId),
      supabaseAdmin
        .from('rankings')
        .select('*')
        .eq('user_id', userId)
        .eq('period', 'global')
        .single()
        .then(r => r.data),
    ]);

    if (!user) return null;

    return {
      ...user,
      stats,
      ranking,
    };
  },

  // Buscar histórico de partidas
  async getMatchHistory(userId: string, limit = 20, offset = 0) {
    const { data, count } = await supabaseAdmin
      .from('matches')
      .select('*, rooms(*)', { count: 'exact' })
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .eq('status', 'finished')
      .order('finished_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return { matches: data || [], total: count || 0 };
  },

  // Buscar usuários (para busca/convite)
  async search(query: string, limit = 10) {
    const { data } = await supabaseAdmin
      .from('users')
      .select('id, username, avatar_url, status')
      .eq('status', 'active')
      .ilike('username', `%${query}%`)
      .limit(limit);

    return data || [];
  },

  // Listar todos os usuários (admin)
  async listAll(limit = 50, offset = 0) {
    const { data, count } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return { users: data || [], total: count || 0 };
  },
};
