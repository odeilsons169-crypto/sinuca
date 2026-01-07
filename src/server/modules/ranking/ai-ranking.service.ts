// =====================================================
// SERVIÇO DE RANKING VS CPU - "Mestres da Sinuca"
// =====================================================

import { supabaseAdmin } from '../../services/supabase.js';
import { levelService } from '../levels/level.service.js';

export interface AIRankingEntry {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  country_code: string | null;
  total_matches: number;
  wins: number;
  losses: number;
  win_rate: number;
  best_streak: number;
  current_streak: number;
  points: number;
  position: number;
  last_match_at: string | null;
}

export interface AIRankingStats {
  total_matches: number;
  wins: number;
  losses: number;
  win_rate: number;
  best_streak: number;
  current_streak: number;
  points: number;
  position: number | null;
}

export const aiRankingService = {
  /**
   * Buscar Top N do ranking vs CPU
   */
  async getTopRanking(limit: number = 10): Promise<AIRankingEntry[]> {
    const { data, error } = await supabaseAdmin
      .from('ai_rankings')
      .select(`
        id,
        user_id,
        total_matches,
        wins,
        losses,
        win_rate,
        best_streak,
        current_streak,
        points,
        last_match_at,
        user:users(username, avatar_url, country_code)
      `)
      .gt('total_matches', 0)
      .order('points', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar ranking AI:', error);
      return [];
    }

    return (data || []).map((entry: any, index: number) => ({
      id: entry.id,
      user_id: entry.user_id,
      username: entry.user?.username || 'Jogador',
      avatar_url: entry.user?.avatar_url || null,
      country_code: entry.user?.country_code || null,
      total_matches: entry.total_matches,
      wins: entry.wins,
      losses: entry.losses,
      win_rate: entry.win_rate,
      best_streak: entry.best_streak,
      current_streak: entry.current_streak,
      points: entry.points,
      position: index + 1,
      last_match_at: entry.last_match_at,
    }));
  },

  /**
   * Buscar estatísticas de um usuário específico
   */
  async getUserStats(userId: string): Promise<AIRankingStats | null> {
    // Buscar dados do usuário
    const { data: userRanking, error } = await supabaseAdmin
      .from('ai_rankings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !userRanking) {
      return null;
    }

    // Calcular posição
    const { count } = await supabaseAdmin
      .from('ai_rankings')
      .select('*', { count: 'exact', head: true })
      .gt('points', userRanking.points);

    const position = (count || 0) + 1;

    return {
      total_matches: userRanking.total_matches,
      wins: userRanking.wins,
      losses: userRanking.losses,
      win_rate: userRanking.win_rate,
      best_streak: userRanking.best_streak,
      current_streak: userRanking.current_streak,
      points: userRanking.points,
      position,
    };
  },

  /**
   * Registrar resultado de partida vs CPU
   */
  async recordMatch(userId: string, won: boolean): Promise<{ success: boolean; stats?: AIRankingStats; error?: string }> {
    try {
      // Chamar function do banco que atualiza o ranking
      const { error: rpcError } = await supabaseAdmin.rpc('update_ai_ranking', {
        p_user_id: userId,
        p_won: won,
      });

      if (rpcError) {
        await this.updateRankingManually(userId, won);
      }

      // Processar XP da partida (Novo !)
      // Como não temos dificuldade explícita vindo do client ainda, usamos 'medium'
      await levelService.processMatchXp(userId, won, 'cpu', 'medium', 'casual');

      // Buscar estatísticas atualizadas
      const stats = await this.getUserStats(userId);

      return { success: true, stats: stats || undefined };
    } catch (err: any) {
      console.error('Erro ao registrar partida AI:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Atualização manual do ranking (fallback)
   */
  async updateRankingManually(userId: string, won: boolean): Promise<void> {
    // Buscar ranking atual
    const { data: current } = await supabaseAdmin
      .from('ai_rankings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!current) {
      // Criar novo registro
      await supabaseAdmin.from('ai_rankings').insert({
        user_id: userId,
        total_matches: 1,
        wins: won ? 1 : 0,
        losses: won ? 0 : 1,
        win_rate: won ? 100 : 0,
        current_streak: won ? 1 : 0,
        best_streak: won ? 1 : 0,
        points: won ? 100 : 0,
        last_match_at: new Date().toISOString(),
      });
    } else {
      // Atualizar registro existente
      const newWins = current.wins + (won ? 1 : 0);
      const newLosses = current.losses + (won ? 0 : 1);
      const newTotal = current.total_matches + 1;
      const newStreak = won ? current.current_streak + 1 : 0;
      const newBestStreak = Math.max(current.best_streak, newStreak);
      const streakBonus = won ? newStreak * 10 : 0;
      const newPoints = won
        ? current.points + 100 + streakBonus
        : Math.max(0, current.points - 20);

      await supabaseAdmin
        .from('ai_rankings')
        .update({
          total_matches: newTotal,
          wins: newWins,
          losses: newLosses,
          win_rate: Math.round((newWins / newTotal) * 100 * 100) / 100,
          current_streak: newStreak,
          best_streak: newBestStreak,
          points: newPoints,
          last_match_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }
  },

  /**
   * Buscar histórico de partidas vs CPU de um usuário
   */
  async getUserMatchHistory(userId: string, limit: number = 20): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('player1_id', userId)
      .eq('mode', 'ai')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar histórico AI:', error);
      return [];
    }

    return data || [];
  },
};
