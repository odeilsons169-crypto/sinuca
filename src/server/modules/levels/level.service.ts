// =====================================================
// SERVIÇO DE NÍVEIS - Sistema de XP e Progressão
// =====================================================

import { supabase } from '../../services/supabase.js';

// Configuração de XP por ação (Valores em "pontos" de 0-100)
export const XP_CONFIG = {
  // Vitórias
  WIN_VS_PLAYER: 50,       // Vitória contra jogador real (50% do nível)
  WIN_VS_CPU_EASY: 20,     // Vitória contra CPU fácil (20% do nível)
  WIN_VS_CPU_MEDIUM: 30,   // Vitória contra CPU médio (30% do nível)
  WIN_VS_CPU_HARD: 45,     // Vitória contra CPU difícil (45% do nível)

  // Derrotas (Ainda ganha por jogar, como solicitado)
  LOSS_VS_PLAYER: 15,      // Derrota contra jogador real (15% do nível)
  LOSS_VS_CPU: 10,         // Derrota contra CPU (10% do nível)

  // Bônus
  WIN_STREAK_BONUS: 10,    // Bônus por sequência de vitórias
  FIRST_WIN_OF_DAY: 25,    // Bônus primeira vitória do dia
  TOURNAMENT_WIN: 100,     // Vitória em torneio (sobe 1 nível garantido)
  TOURNAMENT_FINAL: 50,    // Chegar na final de torneio

  // Multiplicadores
  RANKED_MULTIPLIER: 1.2,  // Multiplicador para partidas ranqueadas
  BET_MULTIPLIER: 1.3,     // Multiplicador para partidas com aposta
};

// Fórmula de XP necessário para cada nível
// REGRA: Sempre 100 XP por nível
export function getXpForLevel(level: number): number {
  if (level <= 1) return 0;
  return 100; // Sempre 100 XP para subir do nível X para X+1
}

// Calcula o nível baseado no XP total
export function calculateLevel(totalXp: number): { level: number; currentXp: number; xpToNextLevel: number } {
  const level = Math.floor(totalXp / 100) + 1;
  const currentXp = totalXp % 100;
  const xpToNextLevel = 100;

  return { level, currentXp, xpToNextLevel };
}

// Títulos por nível
export function getLevelTitle(level: number): string {
  if (level >= 100) return 'Lenda';
  if (level >= 80) return 'Mestre Supremo';
  if (level >= 60) return 'Grão-Mestre';
  if (level >= 50) return 'Mestre';
  if (level >= 40) return 'Especialista';
  if (level >= 30) return 'Veterano';
  if (level >= 20) return 'Experiente';
  if (level >= 15) return 'Habilidoso';
  if (level >= 10) return 'Intermediário';
  if (level >= 5) return 'Aprendiz';
  return 'Novato';
}

// Cor do nível (para UI)
export function getLevelColor(level: number): string {
  if (level >= 100) return '#ff0000'; // Vermelho (Lenda)
  if (level >= 80) return '#ff00ff';  // Magenta
  if (level >= 60) return '#ffd700';  // Dourado
  if (level >= 50) return '#ff8c00';  // Laranja
  if (level >= 40) return '#9400d3';  // Roxo
  if (level >= 30) return '#00bfff';  // Azul claro
  if (level >= 20) return '#32cd32';  // Verde
  if (level >= 10) return '#87ceeb';  // Azul céu
  if (level >= 5) return '#daa520';   // Dourado escuro
  return '#808080'; // Cinza (Novato)
}

class LevelService {
  // Adiciona XP ao usuário e atualiza o nível
  async addXp(userId: string, xpAmount: number, reason: string): Promise<{
    success: boolean;
    newLevel?: number;
    leveledUp?: boolean;
    totalXp?: number;
    currentXp?: number;
    xpToNextLevel?: number;
    error?: string;
  }> {
    try {
      // Buscar XP atual do usuário
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('total_xp, level')
        .eq('id', userId)
        .single();

      if (fetchError || !user) {
        return { success: false, error: 'Usuário não encontrado' };
      }

      const currentTotalXp = user.total_xp || 0;
      const oldLevel = user.level || 1;
      const newTotalXp = currentTotalXp + xpAmount;

      // Calcular novo nível
      const { level: newLevel, currentXp, xpToNextLevel } = calculateLevel(newTotalXp);
      const leveledUp = newLevel > oldLevel;

      // Atualizar no banco
      const { error: updateError } = await supabase
        .from('users')
        .update({
          total_xp: newTotalXp,
          xp: currentXp,
          xp_to_next_level: xpToNextLevel,
          level: newLevel,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('[LevelService] Erro ao atualizar XP:', updateError);
        return { success: false, error: 'Erro ao atualizar XP' };
      }

      // Registrar histórico de XP
      await this.logXpGain(userId, xpAmount, reason, newTotalXp, newLevel);

      // Se subiu de nível, registrar
      if (leveledUp) {
        console.log(`[LevelService] Usuário ${userId} subiu para nível ${newLevel}!`);
        await this.logLevelUp(userId, oldLevel, newLevel);
      }

      return {
        success: true,
        newLevel,
        leveledUp,
        totalXp: newTotalXp,
        currentXp,
        xpToNextLevel
      };
    } catch (error) {
      console.error('[LevelService] Erro ao adicionar XP:', error);
      return { success: false, error: 'Erro interno' };
    }
  }

  // Registra ganho de XP no histórico
  private async logXpGain(userId: string, xpAmount: number, reason: string, totalXp: number, level: number): Promise<void> {
    try {
      await supabase.from('xp_history').insert({
        user_id: userId,
        xp_amount: xpAmount,
        reason,
        total_xp_after: totalXp,
        level_after: level
      });
    } catch (error) {
      console.error('[LevelService] Erro ao registrar histórico de XP:', error);
    }
  }

  // Registra subida de nível
  private async logLevelUp(userId: string, oldLevel: number, newLevel: number): Promise<void> {
    try {
      await supabase.from('level_ups').insert({
        user_id: userId,
        old_level: oldLevel,
        new_level: newLevel
      });
    } catch (error) {
      console.error('[LevelService] Erro ao registrar level up:', error);
    }
  }

  // Processa XP após uma partida
  async processMatchXp(
    userId: string,
    isWinner: boolean,
    opponentType: 'player' | 'cpu',
    cpuDifficulty?: 'easy' | 'medium' | 'hard',
    matchMode?: 'casual' | 'ranked' | 'bet' | 'tournament'
  ): Promise<{ xpGained: number; leveledUp: boolean; newLevel: number }> {
    let baseXp = 0;
    let reason = '';

    if (isWinner) {
      if (opponentType === 'player') {
        baseXp = XP_CONFIG.WIN_VS_PLAYER;
        reason = 'Vitória contra jogador';
      } else {
        switch (cpuDifficulty) {
          case 'hard':
            baseXp = XP_CONFIG.WIN_VS_CPU_HARD;
            reason = 'Vitória contra CPU (Difícil)';
            break;
          case 'medium':
            baseXp = XP_CONFIG.WIN_VS_CPU_MEDIUM;
            reason = 'Vitória contra CPU (Médio)';
            break;
          default:
            baseXp = XP_CONFIG.WIN_VS_CPU_EASY;
            reason = 'Vitória contra CPU (Fácil)';
        }
      }
    } else {
      if (opponentType === 'player') {
        baseXp = XP_CONFIG.LOSS_VS_PLAYER;
        reason = 'Partida contra jogador';
      } else {
        baseXp = XP_CONFIG.LOSS_VS_CPU;
        reason = 'Partida contra CPU';
      }
    }

    // Aplicar multiplicadores
    let finalXp = baseXp;
    if (matchMode === 'ranked') {
      finalXp = Math.floor(finalXp * XP_CONFIG.RANKED_MULTIPLIER);
      reason += ' (Ranqueada)';
    } else if (matchMode === 'bet') {
      finalXp = Math.floor(finalXp * XP_CONFIG.BET_MULTIPLIER);
      reason += ' (Aposta)';
    } else if (matchMode === 'tournament') {
      finalXp = isWinner ? XP_CONFIG.TOURNAMENT_WIN : XP_CONFIG.TOURNAMENT_FINAL;
      reason += ' (Torneio)';
    }

    const result = await this.addXp(userId, finalXp, reason);

    return {
      xpGained: finalXp,
      leveledUp: result.leveledUp || false,
      newLevel: result.newLevel || 1
    };
  }

  // Busca informações de nível do usuário
  async getUserLevel(userId: string): Promise<{
    level: number;
    xp: number;
    xpToNextLevel: number;
    totalXp: number;
    title: string;
    color: string;
    progress: number;
  } | null> {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('level, xp, xp_to_next_level, total_xp')
        .eq('id', userId)
        .single();

      if (error || !user) return null;

      const level = user.level || 1;
      const xp = user.xp || 0;
      const xpToNextLevel = user.xp_to_next_level || getXpForLevel(2);
      const totalXp = user.total_xp || 0;

      return {
        level,
        xp,
        xpToNextLevel,
        totalXp,
        title: getLevelTitle(level),
        color: getLevelColor(level),
        progress: xpToNextLevel > 0 ? (xp / xpToNextLevel) * 100 : 0
      };
    } catch (error) {
      console.error('[LevelService] Erro ao buscar nível:', error);
      return null;
    }
  }

  // Ranking por nível
  async getLevelRanking(limit: number = 10): Promise<Array<{
    userId: string;
    username: string;
    avatarUrl: string | null;
    level: number;
    totalXp: number;
    title: string;
    color: string;
  }>> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, avatar_url, level, total_xp')
        .order('level', { ascending: false })
        .order('total_xp', { ascending: false })
        .limit(limit);

      if (error || !data) return [];

      return data.map((user: any) => ({
        userId: user.id,
        username: user.username,
        avatarUrl: user.avatar_url,
        level: user.level || 1,
        totalXp: user.total_xp || 0,
        title: getLevelTitle(user.level || 1),
        color: getLevelColor(user.level || 1)
      }));
    } catch (error) {
      console.error('[LevelService] Erro ao buscar ranking:', error);
      return [];
    }
  }
}

export const levelService = new LevelService();
