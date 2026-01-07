import { supabaseAdmin } from '../../services/supabase.js';
import type { Ranking } from '../../../shared/types/index.js';

// Helper para obter semana atual no formato YYYY-WW
function getCurrentWeek(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-${String(weekNumber).padStart(2, '0')}`;
}

// Helper para obter mês atual no formato YYYY-MM
function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export const rankingService = {
  // Buscar ranking global
  async getGlobal(limit = 50, offset = 0) {
    const { data, count, error } = await supabaseAdmin
      .from('rankings')
      .select(`
        *,
        user:users(id, username, avatar_url, level, country_code)
      `, { count: 'exact' })
      .eq('period', 'global')
      .order('points', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Erro ao buscar ranking:', error);
    }

    return { rankings: data || [], total: count || 0 };
  },

  // Buscar ranking mensal
  async getMonthly(month: string, limit = 50, offset = 0) {
    const { data, count } = await supabaseAdmin
      .from('rankings')
      .select(`
        *,
        user:users(id, username, avatar_url, level, country_code)
      `, { count: 'exact' })
      .eq('period', 'monthly')
      .eq('month', month)
      .order('points', { ascending: false })
      .range(offset, offset + limit - 1);

    return { rankings: data || [], total: count || 0 };
  },

  // Buscar ranking semanal (Top 10)
  async getWeekly(week?: string, limit = 10, offset = 0) {
    const targetWeek = week || getCurrentWeek();

    const { data, count } = await supabaseAdmin
      .from('rankings')
      .select(`
        *,
        user:users(id, username, avatar_url, level, country_code)
      `, { count: 'exact' })
      .eq('period', 'weekly')
      .eq('week', targetWeek)
      .order('points', { ascending: false })
      .order('wins', { ascending: false })
      .range(offset, offset + limit - 1);

    return {
      rankings: data || [],
      total: count || 0,
      week: targetWeek
    };
  },

  // Buscar Top 10 da semana (para landing page)
  async getWeeklyTop10() {
    const currentWeek = getCurrentWeek();

    const { data } = await supabaseAdmin
      .from('rankings')
      .select(`
        points,
        wins,
        losses,
        matches_played,
        user:users(id, username, avatar_url, level, country_code)
      `)
      .eq('period', 'weekly')
      .eq('week', currentWeek)
      .order('points', { ascending: false })
      .order('wins', { ascending: false })
      .limit(10);

    return {
      rankings: (data || []).map((r, i) => ({ ...r, position: i + 1 })),
      week: currentWeek,
      weekLabel: `Semana ${currentWeek.split('-')[1]}/${currentWeek.split('-')[0]}`
    };
  },

  // Buscar posição do usuário no ranking global
  async getUserPosition(userId: string): Promise<{ position: number | null; points: number }> {
    const { data } = await supabaseAdmin
      .from('rankings')
      .select('position, points')
      .eq('user_id', userId)
      .eq('period', 'global')
      .single();

    return {
      position: data?.position || null,
      points: data?.points || 0,
    };
  },

  // Buscar ranking do usuário (global, mensal e semanal)
  async getUserRankings(userId: string) {
    const currentMonth = getCurrentMonth();
    const currentWeek = getCurrentWeek();

    const [global, monthly, weekly] = await Promise.all([
      supabaseAdmin
        .from('rankings')
        .select('*')
        .eq('user_id', userId)
        .eq('period', 'global')
        .single(),
      supabaseAdmin
        .from('rankings')
        .select('*')
        .eq('user_id', userId)
        .eq('period', 'monthly')
        .eq('month', currentMonth)
        .single(),
      supabaseAdmin
        .from('rankings')
        .select('*')
        .eq('user_id', userId)
        .eq('period', 'weekly')
        .eq('week', currentWeek)
        .single(),
    ]);

    return {
      global: global.data,
      monthly: monthly.data,
      weekly: weekly.data,
    };
  },

  // Buscar histórico de ranking do usuário
  async getUserRankingHistory(userId: string, periodType?: string, limit = 20) {
    let query = supabaseAdmin
      .from('ranking_history')
      .select('*')
      .eq('user_id', userId)
      .order('period_end', { ascending: false })
      .limit(limit);

    if (periodType) {
      query = query.eq('period_type', periodType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar histórico de ranking:', error);
    }

    return data || [];
  },

  // Criar/atualizar ranking mensal do usuário
  async ensureMonthlyRanking(userId: string, month: string) {
    const { data: existing } = await supabaseAdmin
      .from('rankings')
      .select('id')
      .eq('user_id', userId)
      .eq('period', 'monthly')
      .eq('month', month)
      .single();

    if (!existing) {
      await supabaseAdmin.from('rankings').insert({
        user_id: userId,
        period: 'monthly',
        month,
        points: 0,
      });
    }
  },

  // Criar/atualizar ranking semanal do usuário
  async ensureWeeklyRanking(userId: string, week?: string) {
    const targetWeek = week || getCurrentWeek();

    const { data: existing } = await supabaseAdmin
      .from('rankings')
      .select('id')
      .eq('user_id', userId)
      .eq('period', 'weekly')
      .eq('week', targetWeek)
      .single();

    if (!existing) {
      await supabaseAdmin.from('rankings').insert({
        user_id: userId,
        period: 'weekly',
        week: targetWeek,
        points: 0,
      });
    }
  },

  // Top jogadores (para exibição rápida)
  async getTopPlayers(limit = 10) {
    const { data } = await supabaseAdmin
      .from('rankings')
      .select(`
        points,
        position,
        wins,
        losses,
        matches_played,
        user:users(id, username, avatar_url, level, country_code)
      `)
      .eq('period', 'global')
      .order('points', { ascending: false })
      .limit(limit);

    return data || [];
  },

  // Recalcular posições (admin)
  async recalculatePositions(): Promise<{ error: string | null }> {
    // O trigger já faz isso automaticamente, mas pode ser chamado manualmente
    const { error } = await supabaseAdmin.rpc('update_ranking_positions');

    return { error: error?.message || null };
  },

  // Arquivar e resetar ranking semanal (chamado por cron job)
  async archiveWeeklyRanking(): Promise<{ success: boolean; error: string | null }> {
    const { error } = await supabaseAdmin.rpc('archive_and_reset_weekly_ranking');
    return { success: !error, error: error?.message || null };
  },

  // Arquivar e resetar ranking mensal (chamado por cron job)
  async archiveMonthlyRanking(): Promise<{ success: boolean; error: string | null }> {
    const { error } = await supabaseAdmin.rpc('archive_and_reset_monthly_ranking');
    return { success: !error, error: error?.message || null };
  },

  // Obter estatísticas do ranking (para admin)
  async getRankingStats() {
    const { data } = await supabaseAdmin
      .from('ranking_dashboard')
      .select('*');

    return data || [];
  },
};
