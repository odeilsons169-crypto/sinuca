// =====================================================
// SERVIÇO DE PARTIDAS DE TORNEIO
// 
// Sistema automático de:
// - Criação de partidas de torneio
// - Sincronização de resultados
// - Eliminação automática
// - Atualização de bracket/chaveamento
// - Atualização de ranking
// - Classificação em tempo real
// =====================================================

import { supabaseAdmin } from '../../services/supabase.js';
import { tournamentsService } from '../admin/tournaments.service.js';
import { levelService } from '../levels/level.service.js';

// Pontos de ranking por colocação em torneio
const TOURNAMENT_RANKING_POINTS = {
  1: 100,  // Campeão
  2: 60,   // Vice
  3: 35,   // 3º lugar
  4: 20,   // 4º lugar
  5: 10,   // 5º-8º lugar
  9: 5,    // 9º-16º lugar
  17: 2,   // 17º-32º lugar
  33: 1,   // 33º-64º lugar
};

// Pontos por vitória em partida de torneio
const POINTS_PER_TOURNAMENT_WIN = 5;
const POINTS_PER_TOURNAMENT_LOSS = 1; // Participação

export interface TournamentMatchResult {
  matchId: string;
  tournamentId: string;
  winnerId: string;
  loserId: string;
  player1Score: number;
  player2Score: number;
  isFinal: boolean;
  tournamentFinished: boolean;
}

class TournamentMatchService {
  /**
   * Criar sala/partida para um confronto de torneio
   */
  async createTournamentMatch(
    tournamentId: string,
    bracketMatchId: string
  ): Promise<{ roomId?: string; matchId?: string; error?: string }> {
    // Buscar dados do confronto no bracket
    const { data: bracketMatch } = await supabaseAdmin
      .from('tournament_matches')
      .select(`
        *,
        tournament:tournaments(id, name, game_mode, entry_fee),
        player1:users!player1_id(id, username),
        player2:users!player2_id(id, username)
      `)
      .eq('id', bracketMatchId)
      .single();

    if (!bracketMatch) {
      return { error: 'Confronto não encontrado no bracket' };
    }

    if (!bracketMatch.player1_id || !bracketMatch.player2_id) {
      return { error: 'Aguardando jogadores para este confronto' };
    }

    if (bracketMatch.status === 'finished') {
      return { error: 'Este confronto já foi finalizado' };
    }

    // Criar sala para a partida do torneio
    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .insert({
        owner_id: bracketMatch.player1_id,
        guest_id: bracketMatch.player2_id,
        mode: 'tournament',
        status: 'full',
        is_private: true,
        tournament_id: tournamentId,
        tournament_match_id: bracketMatchId,
        game_mode: bracketMatch.tournament?.game_mode || '15ball',
      })
      .select()
      .single();

    if (roomError) {
      return { error: `Erro ao criar sala: ${roomError.message}` };
    }

    // Criar partida
    const { data: match, error: matchError } = await supabaseAdmin
      .from('matches')
      .insert({
        room_id: room.id,
        player1_id: bracketMatch.player1_id,
        player2_id: bracketMatch.player2_id,
        mode: 'tournament',
        status: 'waiting',
        tournament_id: tournamentId,
        tournament_match_id: bracketMatchId,
      })
      .select()
      .single();

    if (matchError) {
      // Limpar sala criada
      await supabaseAdmin.from('rooms').delete().eq('id', room.id);
      return { error: `Erro ao criar partida: ${matchError.message}` };
    }

    // Atualizar bracket match com referência à partida
    await supabaseAdmin
      .from('tournament_matches')
      .update({
        match_id: match.id,
        room_id: room.id,
        status: 'scheduled',
      })
      .eq('id', bracketMatchId);

    return { roomId: room.id, matchId: match.id };
  }

  /**
   * Iniciar partida de torneio
   */
  async startTournamentMatch(matchId: string): Promise<{ success: boolean; error?: string }> {
    const { data: match } = await supabaseAdmin
      .from('matches')
      .select('*, tournament_match_id')
      .eq('id', matchId)
      .single();

    if (!match) {
      return { success: false, error: 'Partida não encontrada' };
    }

    if (match.status !== 'waiting') {
      return { success: false, error: 'Partida já iniciada ou finalizada' };
    }

    // Atualizar partida
    await supabaseAdmin
      .from('matches')
      .update({
        status: 'playing',
        started_at: new Date().toISOString(),
      })
      .eq('id', matchId);

    // Atualizar bracket match
    if (match.tournament_match_id) {
      await supabaseAdmin
        .from('tournament_matches')
        .update({ status: 'in_progress' })
        .eq('id', match.tournament_match_id);
    }

    return { success: true };
  }

  /**
   * FINALIZAR PARTIDA DE TORNEIO
   * Este é o método principal que sincroniza TUDO automaticamente
   */
  async finishTournamentMatch(
    matchId: string,
    winnerId: string,
    player1Score: number = 0,
    player2Score: number = 0
  ): Promise<{ success: boolean; result?: TournamentMatchResult; error?: string }> {
    // 1. Buscar dados da partida
    const { data: match } = await supabaseAdmin
      .from('matches')
      .select(`
        *,
        tournament_match_id,
        tournament_id,
        room:rooms(tournament_id, tournament_match_id)
      `)
      .eq('id', matchId)
      .single();

    if (!match) {
      return { success: false, error: 'Partida não encontrada' };
    }

    if (match.status === 'finished') {
      return { success: false, error: 'Partida já finalizada' };
    }

    const tournamentId = match.tournament_id || match.room?.tournament_id;
    const bracketMatchId = match.tournament_match_id || match.room?.tournament_match_id;

    if (!tournamentId || !bracketMatchId) {
      return { success: false, error: 'Esta partida não pertence a um torneio' };
    }

    const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;

    // 2. Atualizar partida como finalizada
    await supabaseAdmin
      .from('matches')
      .update({
        status: 'finished',
        winner_id: winnerId,
        player1_score: player1Score,
        player2_score: player2Score,
        finished_at: new Date().toISOString(),
      })
      .eq('id', matchId);

    // 3. Fechar sala
    if (match.room_id) {
      await supabaseAdmin
        .from('rooms')
        .update({ status: 'closed' })
        .eq('id', match.room_id);
    }

    // 4. ATUALIZAR BRACKET - Registrar vencedor e avançar
    const bracketResult = await this.updateBracketAndAdvance(
      tournamentId,
      bracketMatchId,
      winnerId,
      loserId,
      player1Score,
      player2Score
    );

    // 5. ATUALIZAR RANKING - Pontos por vitória
    await this.updatePlayerRankingPoints(winnerId, POINTS_PER_TOURNAMENT_WIN, 'tournament_win');
    await this.updatePlayerRankingPoints(loserId, POINTS_PER_TOURNAMENT_LOSS, 'tournament_participation');

    // 6. ATUALIZAR ESTATÍSTICAS dos jogadores
    await this.updatePlayerStats(winnerId, loserId);

    // 7. Se torneio acabou, processar premiação e ranking final
    if (bracketResult.tournamentFinished) {
      await this.processTournamentEnd(tournamentId, winnerId, loserId);
    }

    // 8. ATUALIZAR XP (Novo !)
    try {
      const p1WonTournament = winnerId === match.player1_id;
      const p2WonTournament = !p1WonTournament;

      await Promise.all([
        levelService.processMatchXp(match.player1_id, p1WonTournament, 'player', undefined, 'tournament'),
        levelService.processMatchXp(match.player2_id, p2WonTournament, 'player', undefined, 'tournament')
      ]);
    } catch (xpErr) {
      console.error('[TournamentMatchService] Erro ao processar XP de torneio:', xpErr);
    }

    return {
      success: true,
      result: {
        matchId,
        tournamentId,
        winnerId,
        loserId,
        player1Score,
        player2Score,
        isFinal: bracketResult.isFinal,
        tournamentFinished: bracketResult.tournamentFinished,
      },
    };
  }


  /**
   * Atualizar bracket e avançar vencedor para próxima fase
   */
  private async updateBracketAndAdvance(
    tournamentId: string,
    bracketMatchId: string,
    winnerId: string,
    loserId: string,
    player1Score: number,
    player2Score: number
  ): Promise<{ isFinal: boolean; tournamentFinished: boolean }> {
    // Buscar dados do confronto no bracket
    const { data: bracketMatch } = await supabaseAdmin
      .from('tournament_matches')
      .select('*')
      .eq('id', bracketMatchId)
      .single();

    if (!bracketMatch) {
      return { isFinal: false, tournamentFinished: false };
    }

    // Atualizar confronto no bracket
    await supabaseAdmin
      .from('tournament_matches')
      .update({
        winner_id: winnerId,
        player1_score: player1Score,
        player2_score: player2Score,
        status: 'finished',
        finished_at: new Date().toISOString(),
      })
      .eq('id', bracketMatchId);

    // Eliminar perdedor
    await supabaseAdmin
      .from('tournament_participants')
      .update({
        status: 'eliminated',
        eliminated_at: new Date().toISOString(),
        eliminated_by: winnerId,
        eliminated_in_round: bracketMatch.round,
      })
      .eq('tournament_id', tournamentId)
      .eq('user_id', loserId);

    // Verificar se é a final
    const isFinal = !bracketMatch.next_match_id;

    if (isFinal) {
      // TORNEIO ACABOU!
      return { isFinal: true, tournamentFinished: true };
    }

    // Avançar vencedor para próxima partida
    await this.advanceWinnerToNextMatch(bracketMatch, winnerId);

    // Verificar se a próxima partida está pronta (ambos jogadores definidos)
    await this.checkAndPrepareNextMatch(bracketMatch.next_match_id);

    return { isFinal: false, tournamentFinished: false };
  }

  /**
   * Avançar vencedor para a próxima partida do bracket
   */
  private async advanceWinnerToNextMatch(currentMatch: any, winnerId: string) {
    if (!currentMatch.next_match_id) return;

    // Determinar slot baseado no número da partida
    // Partidas ímpares vão para player1, pares para player2
    const slot = currentMatch.match_number % 2 === 1 ? 'player1_id' : 'player2_id';

    await supabaseAdmin
      .from('tournament_matches')
      .update({ [slot]: winnerId })
      .eq('id', currentMatch.next_match_id);
  }

  /**
   * Verificar se próxima partida está pronta e criar sala/partida
   */
  private async checkAndPrepareNextMatch(nextMatchId: string) {
    const { data: nextMatch } = await supabaseAdmin
      .from('tournament_matches')
      .select('*')
      .eq('id', nextMatchId)
      .single();

    if (!nextMatch) return;

    // Se ambos jogadores estão definidos e partida ainda não foi criada
    if (nextMatch.player1_id && nextMatch.player2_id && !nextMatch.match_id) {
      // Atualizar status para 'ready'
      await supabaseAdmin
        .from('tournament_matches')
        .update({ status: 'ready' })
        .eq('id', nextMatchId);

      // Opcionalmente, criar a sala/partida automaticamente
      // await this.createTournamentMatch(nextMatch.tournament_id, nextMatchId);
    }
  }

  /**
   * Atualizar pontos de ranking do jogador
   */
  private async updatePlayerRankingPoints(
    userId: string,
    points: number,
    reason: string
  ) {
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Atualizar ranking global
    await supabaseAdmin.rpc('add_ranking_points', {
      p_user_id: userId,
      p_points: points,
      p_period: 'global',
    });

    // Atualizar ranking mensal
    await supabaseAdmin.rpc('add_ranking_points', {
      p_user_id: userId,
      p_points: points,
      p_period: 'monthly',
      p_month: currentMonth,
    });

    // Registrar histórico de pontos
    await supabaseAdmin.from('ranking_history').insert({
      user_id: userId,
      points_change: points,
      reason,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Atualizar estatísticas dos jogadores
   */
  private async updatePlayerStats(winnerId: string, loserId: string) {
    // Atualizar vencedor
    await supabaseAdmin.rpc('increment_user_stats', {
      p_user_id: winnerId,
      p_wins: 1,
      p_losses: 0,
      p_tournament_wins: 1,
    });

    // Atualizar perdedor
    await supabaseAdmin.rpc('increment_user_stats', {
      p_user_id: loserId,
      p_wins: 0,
      p_losses: 1,
      p_tournament_losses: 1,
    });
  }

  /**
   * Processar fim do torneio - premiação e ranking final
   */
  private async processTournamentEnd(
    tournamentId: string,
    championId: string,
    runnerId: string
  ) {
    // 1. Atualizar status do torneio
    await supabaseAdmin
      .from('tournaments')
      .update({
        status: 'finished',
        finished_at: new Date().toISOString(),
        winner_id: championId,
      })
      .eq('id', tournamentId);

    // 2. Definir colocações finais
    await this.setFinalPlacements(tournamentId, championId, runnerId);

    // 3. Calcular e distribuir pontos de ranking por colocação
    await this.distributeRankingPointsByPlacement(tournamentId);

    // 4. Conceder troféu ao campeão
    await this.awardChampionTrophy(tournamentId, championId);

    // 5. Criar pagamentos pendentes (premiação)
    await this.createPrizePayments(tournamentId);
  }

  /**
   * Definir colocações finais de todos os participantes
   */
  private async setFinalPlacements(
    tournamentId: string,
    championId: string,
    runnerId: string
  ) {
    // 1º lugar - Campeão
    await supabaseAdmin
      .from('tournament_participants')
      .update({ placement: 1, status: 'winner' })
      .eq('tournament_id', tournamentId)
      .eq('user_id', championId);

    // 2º lugar - Vice
    await supabaseAdmin
      .from('tournament_participants')
      .update({ placement: 2, status: 'eliminated' })
      .eq('tournament_id', tournamentId)
      .eq('user_id', runnerId);

    // Buscar semifinalistas eliminados (3º e 4º lugar)
    const { data: semiFinals } = await supabaseAdmin
      .from('tournament_matches')
      .select('player1_id, player2_id, winner_id')
      .eq('tournament_id', tournamentId)
      .eq('bracket_position', 'FINAL')
      .single();

    // Buscar perdedores das semifinais
    const { data: semiMatches } = await supabaseAdmin
      .from('tournament_matches')
      .select('player1_id, player2_id, winner_id')
      .eq('tournament_id', tournamentId)
      .like('bracket_position', 'SF%');

    if (semiMatches) {
      const semiLosers = semiMatches
        .filter(m => m.winner_id)
        .map(m => m.player1_id === m.winner_id ? m.player2_id : m.player1_id)
        .filter(id => id);

      // 3º e 4º lugar
      for (let i = 0; i < semiLosers.length; i++) {
        await supabaseAdmin
          .from('tournament_participants')
          .update({ placement: 3 + i })
          .eq('tournament_id', tournamentId)
          .eq('user_id', semiLosers[i]);
      }
    }

    // Definir colocações para eliminados em rodadas anteriores
    await this.setEliminatedPlacements(tournamentId);
  }

  /**
   * Definir colocações para jogadores eliminados em cada rodada
   */
  private async setEliminatedPlacements(tournamentId: string) {
    // Buscar torneio para saber número de rodadas
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('max_participants')
      .eq('id', tournamentId)
      .single();

    if (!tournament) return;

    const numRounds = Math.ceil(Math.log2(tournament.max_participants));

    // Mapear rodada para colocação
    // Rodada 1 (primeira) = últimas colocações
    // Rodada N-1 (quartas) = 5º-8º
    // Rodada N (semi) = 3º-4º (já tratado acima)
    const placementByRound: Record<number, number> = {};
    let placement = tournament.max_participants;

    for (let round = 1; round < numRounds - 1; round++) {
      const eliminatedInRound = Math.pow(2, numRounds - round - 1);
      placementByRound[round] = placement - eliminatedInRound + 1;
      placement -= eliminatedInRound;
    }

    // Atualizar colocações dos eliminados que ainda não têm placement
    for (const [round, startPlacement] of Object.entries(placementByRound)) {
      const { data: eliminated } = await supabaseAdmin
        .from('tournament_participants')
        .select('id, user_id')
        .eq('tournament_id', tournamentId)
        .eq('eliminated_in_round', parseInt(round))
        .is('placement', null);

      if (eliminated) {
        for (let i = 0; i < eliminated.length; i++) {
          await supabaseAdmin
            .from('tournament_participants')
            .update({ placement: startPlacement + i })
            .eq('id', eliminated[i].id);
        }
      }
    }
  }


  /**
   * Distribuir pontos de ranking baseado na colocação final
   */
  private async distributeRankingPointsByPlacement(tournamentId: string) {
    const { data: participants } = await supabaseAdmin
      .from('tournament_participants')
      .select('user_id, placement')
      .eq('tournament_id', tournamentId)
      .not('placement', 'is', null)
      .order('placement', { ascending: true });

    if (!participants) return;

    for (const participant of participants) {
      const points = this.getPointsForPlacement(participant.placement);

      if (points > 0) {
        await this.updatePlayerRankingPoints(
          participant.user_id,
          points,
          `tournament_placement_${participant.placement}`
        );
      }
    }
  }

  /**
   * Obter pontos de ranking para uma colocação
   */
  private getPointsForPlacement(placement: number): number {
    if (placement === 1) return TOURNAMENT_RANKING_POINTS[1];
    if (placement === 2) return TOURNAMENT_RANKING_POINTS[2];
    if (placement <= 4) return TOURNAMENT_RANKING_POINTS[3];
    if (placement <= 8) return TOURNAMENT_RANKING_POINTS[5];
    if (placement <= 16) return TOURNAMENT_RANKING_POINTS[9];
    if (placement <= 32) return TOURNAMENT_RANKING_POINTS[17];
    if (placement <= 64) return TOURNAMENT_RANKING_POINTS[33];
    return 0;
  }

  /**
   * Conceder troféu ao campeão
   */
  private async awardChampionTrophy(tournamentId: string, championId: string) {
    // Buscar torneio para pegar o troféu associado
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('id, name, trophy_id')
      .eq('id', tournamentId)
      .single();

    if (!tournament) return;

    // Se tem troféu específico, conceder
    if (tournament.trophy_id) {
      await supabaseAdmin.from('user_trophies').insert({
        user_id: championId,
        trophy_id: tournament.trophy_id,
        tournament_id: tournamentId,
        earned_at: new Date().toISOString(),
        placement: 1,
      });
    }

    // Sempre conceder troféu genérico de campeão
    const { data: genericTrophy } = await supabaseAdmin
      .from('trophies')
      .select('id')
      .eq('category', 'tournament')
      .eq('name', 'Campeão de Torneio')
      .single();

    if (genericTrophy) {
      // Verificar se já não tem esse troféu deste torneio
      const { data: existing } = await supabaseAdmin
        .from('user_trophies')
        .select('id')
        .eq('user_id', championId)
        .eq('trophy_id', genericTrophy.id)
        .eq('tournament_id', tournamentId)
        .single();

      if (!existing) {
        await supabaseAdmin.from('user_trophies').insert({
          user_id: championId,
          trophy_id: genericTrophy.id,
          tournament_id: tournamentId,
          earned_at: new Date().toISOString(),
          placement: 1,
        });
      }
    }
  }

  /**
   * Criar pagamentos pendentes de premiação
   */
  private async createPrizePayments(tournamentId: string) {
    // Usar o método existente do tournamentsService
    const { data: participants } = await supabaseAdmin
      .from('tournament_participants')
      .select('user_id, placement')
      .eq('tournament_id', tournamentId)
      .not('placement', 'is', null)
      .lte('placement', 4) // Top 4 recebem prêmio
      .order('placement', { ascending: true });

    if (!participants || participants.length === 0) return;

    const placements = participants.map(p => ({
      userId: p.user_id,
      position: p.placement,
    }));

    await tournamentsService.finishTournamentAndDistributePrizes(tournamentId, placements);
  }

  /**
   * Obter classificação atual do torneio
   */
  async getTournamentStandings(tournamentId: string) {
    const { data: participants } = await supabaseAdmin
      .from('tournament_participants')
      .select(`
        *,
        user:users(id, username, avatar_url)
      `)
      .eq('tournament_id', tournamentId)
      .order('placement', { ascending: true, nullsFirst: false })
      .order('status', { ascending: true });

    // Calcular estatísticas de cada participante no torneio
    const standings = await Promise.all(
      (participants || []).map(async (p) => {
        const stats = await this.getParticipantTournamentStats(tournamentId, p.user_id);
        return {
          ...p,
          tournament_stats: stats,
        };
      })
    );

    return standings;
  }

  /**
   * Obter estatísticas do participante no torneio
   */
  private async getParticipantTournamentStats(tournamentId: string, userId: string) {
    // Contar vitórias e derrotas no torneio
    const { data: matches } = await supabaseAdmin
      .from('tournament_matches')
      .select('winner_id, player1_id, player2_id')
      .eq('tournament_id', tournamentId)
      .eq('status', 'finished')
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`);

    let wins = 0;
    let losses = 0;

    for (const match of matches || []) {
      if (match.winner_id === userId) {
        wins++;
      } else if (match.player1_id === userId || match.player2_id === userId) {
        losses++;
      }
    }

    return { wins, losses, matches_played: wins + losses };
  }

  /**
   * Obter próximas partidas do torneio
   */
  async getUpcomingMatches(tournamentId: string) {
    const { data: matches } = await supabaseAdmin
      .from('tournament_matches')
      .select(`
        *,
        player1:users!player1_id(id, username, avatar_url),
        player2:users!player2_id(id, username, avatar_url)
      `)
      .eq('tournament_id', tournamentId)
      .in('status', ['ready', 'scheduled', 'pending'])
      .not('player1_id', 'is', null)
      .not('player2_id', 'is', null)
      .order('round', { ascending: true })
      .order('match_number', { ascending: true });

    return matches || [];
  }

  /**
   * Obter partidas em andamento do torneio
   */
  async getLiveMatches(tournamentId: string) {
    const { data: matches } = await supabaseAdmin
      .from('tournament_matches')
      .select(`
        *,
        player1:users!player1_id(id, username, avatar_url),
        player2:users!player2_id(id, username, avatar_url),
        match:matches!match_id(id, status, player1_score, player2_score, started_at)
      `)
      .eq('tournament_id', tournamentId)
      .eq('status', 'in_progress');

    return matches || [];
  }

  /**
   * Obter histórico de partidas finalizadas do torneio
   */
  async getFinishedMatches(tournamentId: string) {
    const { data: matches } = await supabaseAdmin
      .from('tournament_matches')
      .select(`
        *,
        player1:users!player1_id(id, username, avatar_url),
        player2:users!player2_id(id, username, avatar_url),
        winner:users!winner_id(id, username, avatar_url)
      `)
      .eq('tournament_id', tournamentId)
      .eq('status', 'finished')
      .order('finished_at', { ascending: false });

    return matches || [];
  }
}

export const tournamentMatchService = new TournamentMatchService();
