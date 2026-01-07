// =====================================================
// SERVIÇO DE GESTÃO DE PARTIDAS (ADMIN)
// =====================================================

import { supabaseAdmin } from '../../services/supabase.js';
import { auditService } from './audit.service.js';

class MatchesAdminService {
  /**
   * Listar partidas com filtros
   */
  async listMatches(params: {
    status?: string;
    userId?: string;
    gameMode?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabaseAdmin
      .from('matches')
      .select(`
        *,
        player1:users!player1_id(id, username, avatar_url),
        player2:users!player2_id(id, username, avatar_url),
        winner:users!winner_id(id, username),
        room:rooms(id, name, game_mode, bet_amount)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (params.status) query = query.eq('status', params.status);
    if (params.userId) {
      query = query.or(`player1_id.eq.${params.userId},player2_id.eq.${params.userId}`);
    }
    if (params.gameMode) query = query.eq('room.game_mode', params.gameMode);
    if (params.startDate) query = query.gte('created_at', params.startDate);
    if (params.endDate) query = query.lte('created_at', params.endDate);

    const limit = params.limit || 20;
    const offset = params.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return { matches: data || [], total: count || 0 };
  }

  /**
   * Listar salas ativas (Live Ops)
   */
  async listActiveRooms() {
    const { data, error } = await supabaseAdmin
      .from('rooms')
      .select(`
        *,
        host:users!host_id(id, username),
        match:matches(id, status, player1_id, player2_id)
      `)
      .in('status', ['open', 'playing'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Detalhes de uma partida
   */
  async getMatchDetail(matchId: string) {
    const { data: match, error } = await supabaseAdmin
      .from('matches')
      .select(`
        *,
        player1:users!player1_id(*),
        player2:users!player2_id(*),
        winner:users!winner_id(id, username),
        room:rooms(*),
        bet:bets(*)
      `)
      .eq('id', matchId)
      .single();

    if (error) return null;

    // Buscar logs da partida (se existir tabela de match_logs)
    const { data: logs } = await supabaseAdmin
      .from('match_logs')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });

    return { ...match, logs: logs || [] };
  }

  /**
   * Kill Switch - Encerrar sala forçosamente
   */
  async forceCloseRoom(adminId: string, roomId: string, reason: string, ipAddress?: string) {
    const { data: room } = await supabaseAdmin
      .from('rooms')
      .select('*, match:matches(*)')
      .eq('id', roomId)
      .single();

    if (!room) {
      return { success: false, error: 'Sala não encontrada' };
    }

    // Fechar sala
    await supabaseAdmin
      .from('rooms')
      .update({ status: 'closed' })
      .eq('id', roomId);

    // Cancelar partida se existir
    if (room.match && room.match.status !== 'finished') {
      await supabaseAdmin
        .from('matches')
        .update({ status: 'cancelled' })
        .eq('id', room.match.id);

      // Reembolsar apostas
      const { data: bet } = await supabaseAdmin
        .from('bets')
        .select('*')
        .eq('match_id', room.match.id)
        .single();

      if (bet && bet.status === 'active') {
        // Reembolsar ambos jogadores
        if (room.match.player1_id) {
          await supabaseAdmin.rpc('add_winnings_balance', {
            p_user_id: room.match.player1_id,
            p_amount: bet.amount,
            p_description: 'Sala encerrada pelo admin - reembolso',
          });
        }
        if (room.match.player2_id) {
          await supabaseAdmin.rpc('add_winnings_balance', {
            p_user_id: room.match.player2_id,
            p_amount: bet.amount,
            p_description: 'Sala encerrada pelo admin - reembolso',
          });
        }

        await supabaseAdmin
          .from('bets')
          .update({ status: 'cancelled' })
          .eq('id', bet.id);
      }
    }

    await auditService.log({
      adminId,
      action: 'room_force_close',
      targetType: 'room',
      targetId: roomId,
      details: { reason, match_id: room.match?.id },
      ipAddress,
    });

    return { success: true };
  }

  /**
   * Forçar resultado de partida
   */
  async forceMatchResult(
    adminId: string,
    matchId: string,
    winnerId: string | null,
    reason: string,
    ipAddress?: string
  ) {
    const { data: match } = await supabaseAdmin
      .from('matches')
      .select('*, bet:bets(*)')
      .eq('id', matchId)
      .single();

    if (!match) {
      return { success: false, error: 'Partida não encontrada' };
    }
    if (match.status === 'finished') {
      return { success: false, error: 'Partida já finalizada' };
    }

    if (winnerId) {
      // Finalizar com vencedor
      await supabaseAdmin
        .from('matches')
        .update({
          status: 'finished',
          winner_id: winnerId,
          finished_at: new Date().toISOString(),
        })
        .eq('id', matchId);

      // Liquidar aposta se existir
      if (match.bet && match.bet.status === 'active') {
        const totalPool = Number(match.bet.total_pool);
        const platformFee = totalPool * 0.1; // 10%
        const winnerPrize = totalPool - platformFee;

        await supabaseAdmin.rpc('add_winnings_balance', {
          p_user_id: winnerId,
          p_amount: winnerPrize,
          p_description: 'Vitória em partida (admin)',
        });

        await supabaseAdmin
          .from('bets')
          .update({
            status: 'settled',
            winner_id: winnerId,
            platform_fee: platformFee,
            settled_at: new Date().toISOString(),
          })
          .eq('id', match.bet.id);
      }

      await auditService.log({
        adminId,
        action: 'match_force_result',
        targetType: 'match',
        targetId: matchId,
        details: { winner_id: winnerId, reason },
        ipAddress,
      });
    } else {
      // Cancelar partida
      await supabaseAdmin
        .from('matches')
        .update({ status: 'cancelled' })
        .eq('id', matchId);

      // Reembolsar apostas
      if (match.bet && match.bet.status === 'active') {
        const betAmount = Number(match.bet.amount);
        
        if (match.player1_id) {
          await supabaseAdmin.rpc('add_winnings_balance', {
            p_user_id: match.player1_id,
            p_amount: betAmount,
            p_description: 'Partida cancelada pelo admin - reembolso',
          });
        }
        if (match.player2_id) {
          await supabaseAdmin.rpc('add_winnings_balance', {
            p_user_id: match.player2_id,
            p_amount: betAmount,
            p_description: 'Partida cancelada pelo admin - reembolso',
          });
        }

        await supabaseAdmin
          .from('bets')
          .update({ status: 'cancelled' })
          .eq('id', match.bet.id);
      }

      await auditService.log({
        adminId,
        action: 'match_cancel',
        targetType: 'match',
        targetId: matchId,
        details: { reason },
        ipAddress,
      });
    }

    // Fechar sala
    if (match.room_id) {
      await supabaseAdmin
        .from('rooms')
        .update({ status: 'closed' })
        .eq('id', match.room_id);
    }

    return { success: true };
  }

  /**
   * Liquidar aposta manualmente
   */
  async liquidateBet(
    adminId: string,
    betId: string,
    winnerId: string,
    reason: string,
    ipAddress?: string
  ) {
    const { data: bet } = await supabaseAdmin
      .from('bets')
      .select('*')
      .eq('id', betId)
      .single();

    if (!bet) {
      return { success: false, error: 'Aposta não encontrada' };
    }
    if (bet.status !== 'active') {
      return { success: false, error: 'Aposta já liquidada ou cancelada' };
    }

    const totalPool = Number(bet.total_pool);
    const platformFee = totalPool * 0.1;
    const winnerPrize = totalPool - platformFee;

    await supabaseAdmin.rpc('add_winnings_balance', {
      p_user_id: winnerId,
      p_amount: winnerPrize,
      p_description: 'Liquidação manual de aposta (admin)',
    });

    await supabaseAdmin
      .from('bets')
      .update({
        status: 'settled',
        winner_id: winnerId,
        platform_fee: platformFee,
        settled_at: new Date().toISOString(),
      })
      .eq('id', betId);

    await auditService.log({
      adminId,
      action: 'bet_liquidate',
      targetType: 'bet',
      targetId: betId,
      details: { winner_id: winnerId, prize: winnerPrize, platform_fee: platformFee, reason },
      ipAddress,
    });

    return { success: true, prize: winnerPrize };
  }
}

export const matchesAdminService = new MatchesAdminService();
