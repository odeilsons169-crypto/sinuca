import { supabaseAdmin } from '../../services/supabase.js';
import { roomsService } from '../rooms/rooms.service.js';
import { creditsService } from '../credits/credits.service.js';
import { walletService } from '../wallet/wallet.service.js';
import { levelService } from '../levels/level.service.js';
import type { Match, MatchMode } from '../../../shared/types/index.js';

export const matchesService = {
  // Criar partida a partir de uma sala
  async createFromRoom(roomId: string): Promise<{ match: Match | null; error: string | null }> {
    const room = await roomsService.getById(roomId);

    if (!room) {
      return { match: null, error: 'Sala não encontrada' };
    }

    if (room.status !== 'full') {
      return { match: null, error: 'Sala precisa estar cheia para iniciar' };
    }

    if (!room.guest_id) {
      return { match: null, error: 'Aguardando segundo jogador' };
    }

    // Verificar créditos (modo casual)
    if (room.mode === 'casual') {
      const [p1Credits, p2Credits] = await Promise.all([
        creditsService.hasEnough(room.owner_id),
        creditsService.hasEnough(room.guest_id),
      ]);

      if (!p1Credits) {
        return { match: null, error: 'Jogador 1 não tem créditos suficientes' };
      }
      if (!p2Credits) {
        return { match: null, error: 'Jogador 2 não tem créditos suficientes' };
      }
    }

    // Verificar saldo (modo aposta) - usa apenas deposit + winnings, NÃO bonus
    if (room.mode === 'bet' && room.bet_amount) {
      const [p1Available, p2Available] = await Promise.all([
        walletService.getAvailableForBet(room.owner_id),
        walletService.getAvailableForBet(room.guest_id!),
      ]);

      if (p1Available < room.bet_amount) {
        return { match: null, error: `Jogador 1 não tem saldo suficiente. Disponível: R$ ${p1Available.toFixed(2)}. Bônus não pode ser usado em apostas.` };
      }
      if (p2Available < room.bet_amount) {
        return { match: null, error: `Jogador 2 não tem saldo suficiente. Disponível: R$ ${p2Available.toFixed(2)}. Bônus não pode ser usado em apostas.` };
      }
    }

    // Criar partida
    const { data: match, error } = await supabaseAdmin
      .from('matches')
      .insert({
        room_id: roomId,
        player1_id: room.owner_id,
        player2_id: room.guest_id,
        mode: room.mode,
        status: 'waiting',
      })
      .select()
      .single();

    if (error) {
      return { match: null, error: error.message };
    }

    // Criar aposta se for modo bet
    if (room.mode === 'bet' && room.bet_amount) {
      await supabaseAdmin.from('bets').insert({
        match_id: match.id,
        player1_id: room.owner_id,
        player2_id: room.guest_id,
        amount: room.bet_amount,
        total_pool: room.bet_amount * 2,
        status: 'pending',
      });
    }

    // Atualizar status da sala
    await supabaseAdmin
      .from('rooms')
      .update({ status: 'playing' })
      .eq('id', roomId);

    return { match: match as Match, error: null };
  },

  // Buscar partida por ID
  async getById(matchId: string): Promise<Match | null> {
    const { data } = await supabaseAdmin
      .from('matches')
      .select('*, player1:users!player1_id(id, username, avatar_url), player2:users!player2_id(id, username, avatar_url)')
      .eq('id', matchId)
      .single();

    return data as Match | null;
  },

  // Iniciar partida
  async start(matchId: string): Promise<{ match: Match | null; error: string | null }> {
    const match = await this.getById(matchId);

    if (!match) {
      return { match: null, error: 'Partida não encontrada' };
    }

    if (match.status !== 'waiting') {
      return { match: null, error: 'Partida já iniciada ou finalizada' };
    }

    // Se for modo aposta, debitar saldo dos jogadores ANTES de iniciar
    if (match.mode === 'bet') {
      // Buscar aposta
      const { data: bet } = await supabaseAdmin
        .from('bets')
        .select('*')
        .eq('match_id', matchId)
        .single();

      if (bet && bet.status === 'pending') {
        const betAmount = Number(bet.amount);

        // Verificar saldo disponível para aposta (deposit + winnings, NÃO bonus)
        const [p1Available, p2Available] = await Promise.all([
          walletService.getAvailableForBet(match.player1_id),
          walletService.getAvailableForBet(match.player2_id),
        ]);

        if (p1Available < betAmount) {
          return { match: null, error: `Jogador 1 não tem saldo suficiente para a aposta. Disponível: R$ ${p1Available.toFixed(2)}. Bônus não pode ser usado em apostas.` };
        }
        if (p2Available < betAmount) {
          return { match: null, error: `Jogador 2 não tem saldo suficiente para a aposta. Disponível: R$ ${p2Available.toFixed(2)}. Bônus não pode ser usado em apostas.` };
        }

        // Debitar saldo de ambos os jogadores (usando função específica para apostas)
        const [debit1, debit2] = await Promise.all([
          walletService.debitForBet(match.player1_id, betAmount, `Aposta na partida #${matchId.slice(0, 8)}`, matchId),
          walletService.debitForBet(match.player2_id, betAmount, `Aposta na partida #${matchId.slice(0, 8)}`, matchId),
        ]);

        if (debit1.error) {
          return { match: null, error: `Erro ao debitar jogador 1: ${debit1.error}` };
        }
        if (debit2.error) {
          // Reverter débito do jogador 1
          await walletService.addBalance(match.player1_id, betAmount, 'Reembolso - erro na aposta');
          return { match: null, error: `Erro ao debitar jogador 2: ${debit2.error}` };
        }

        // Ativar aposta
        await supabaseAdmin
          .from('bets')
          .update({ status: 'active' })
          .eq('match_id', matchId);
      }
    }

    // O trigger vai debitar os créditos automaticamente (modo casual)
    const { data, error } = await supabaseAdmin
      .from('matches')
      .update({ status: 'playing', started_at: new Date().toISOString() })
      .eq('id', matchId)
      .select()
      .single();

    if (error) {
      return { match: null, error: error.message };
    }

    return { match: data as Match, error: null };
  },

  // Atualizar estado do jogo
  async updateGameState(matchId: string, gameState: Record<string, unknown>): Promise<{ error: string | null }> {
    const { error } = await supabaseAdmin
      .from('matches')
      .update({ game_state: gameState })
      .eq('id', matchId)
      .eq('status', 'playing');

    return { error: error?.message || null };
  },

  // Atualizar pontuação
  async updateScore(matchId: string, player1Score: number, player2Score: number): Promise<{ error: string | null }> {
    const { error } = await supabaseAdmin
      .from('matches')
      .update({ player1_score: player1Score, player2_score: player2Score })
      .eq('id', matchId)
      .eq('status', 'playing');

    return { error: error?.message || null };
  },

  // Finalizar partida
  async finish(matchId: string, winnerId: string): Promise<{ match: Match | null; error: string | null }> {
    const match = await this.getById(matchId);

    if (!match) {
      return { match: null, error: 'Partida não encontrada' };
    }

    if (match.status !== 'playing') {
      return { match: null, error: 'Partida não está em andamento' };
    }

    if (winnerId !== match.player1_id && winnerId !== match.player2_id) {
      return { match: null, error: 'Vencedor inválido' };
    }

    // Verificar se é partida de torneio
    const { data: matchData } = await supabaseAdmin
      .from('matches')
      .select('tournament_id, tournament_match_id')
      .eq('id', matchId)
      .single();

    // Se for partida de torneio, usar o serviço especializado
    if (matchData?.tournament_id || matchData?.tournament_match_id) {
      // Importar dinamicamente para evitar dependência circular
      const { tournamentMatchService } = await import('../tournaments/tournament-match.service.js');
      const result = await tournamentMatchService.finishTournamentMatch(
        matchId,
        winnerId,
        (match as any).player1_score || 0,
        (match as any).player2_score || 0
      );

      if (!result.success) {
        return { match: null, error: result.error || 'Erro ao finalizar partida de torneio' };
      }

      // Buscar partida atualizada
      const updatedMatch = await this.getById(matchId);
      return { match: updatedMatch, error: null };
    }

    // O trigger vai atualizar stats, ranking e liquidar aposta automaticamente
    const { data: finishData, error: finishError } = await supabaseAdmin
      .from('matches')
      .update({
        status: 'finished',
        winner_id: winnerId,
        finished_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .select()
      .single();

    if (finishError) {
      return { match: null, error: finishError.message };
    }

    // Processar XP para os jogadores
    try {
      const p1WonResult = winnerId === match.player1_id;
      const p2WonResult = winnerId === match.player2_id;
      const mMode: any = match.mode;

      await Promise.all([
        levelService.processMatchXp(match.player1_id, p1WonResult, 'player', undefined, mMode),
        levelService.processMatchXp(match.player2_id, p2WonResult, 'player', undefined, mMode)
      ]);
    } catch (xpErr) {
      console.error('[MatchesService] Erro ao processar XP da partida:', xpErr);
    }

    // Fechar sala
    await supabaseAdmin
      .from('rooms')
      .update({ status: 'closed' })
      .eq('id', match.room_id);

    return { match: finishData as Match, error: null };
  },

  // Cancelar partida
  async cancel(matchId: string): Promise<{ error: string | null }> {
    const match = await this.getById(matchId);

    if (!match) {
      return { error: 'Partida não encontrada' };
    }

    if (match.status === 'finished') {
      return { error: 'Partida já finalizada' };
    }

    // Cancelar aposta e devolver valores
    if (match.mode === 'bet') {
      const { data: bet } = await supabaseAdmin
        .from('bets')
        .select('*')
        .eq('match_id', matchId)
        .single();

      if (bet && bet.status !== 'settled') {
        // Devolver valores
        await walletService.addBalance(match.player1_id, bet.amount, 'Aposta cancelada - reembolso');
        await walletService.addBalance(match.player2_id, bet.amount, 'Aposta cancelada - reembolso');

        await supabaseAdmin
          .from('bets')
          .update({ status: 'cancelled' })
          .eq('id', bet.id);
      }
    }

    await supabaseAdmin
      .from('matches')
      .update({ status: 'cancelled' })
      .eq('id', matchId);

    // Fechar sala
    await supabaseAdmin
      .from('rooms')
      .update({ status: 'closed' })
      .eq('id', match.room_id);

    return { error: null };
  },

  // Buscar partidas do usuário
  async getByUser(userId: string, status?: string, limit = 20, offset = 0) {
    let query = supabaseAdmin
      .from('matches')
      .select(`
        *,
        player1:users!player1_id(id, username, avatar_url),
        player2:users!player2_id(id, username, avatar_url),
        room:rooms!room_id(bet_amount)
      `, { count: 'exact' })
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count } = await query;

    // Adicionar bet_amount ao match para facilitar no frontend
    const matches = (data || []).map((match: any) => ({
      ...match,
      bet_amount: match.room?.bet_amount || 0,
    }));

    return { matches, total: count || 0 };
  },
};
