// =====================================================
// SERVIÇO DE LIMPEZA AUTOMÁTICA
// Gerencia timeouts de partidas, salas e transmissões
// =====================================================

import { supabaseAdmin } from './supabase.js';
import { walletService } from '../modules/wallet/wallet.service.js';

// Constantes de tempo (em milissegundos)
const MATCH_MAX_DURATION_MS = 30 * 60 * 1000; // 30 minutos
const ROOM_MAX_IDLE_MS = 24 * 60 * 60 * 1000; // 24 horas
const LIVESTREAM_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hora
const CLEANUP_INTERVAL_MS = 60 * 1000; // Verificar a cada 1 minuto

// Intervalo de limpeza
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export const cleanupService = {
  // Iniciar serviço de limpeza
  start() {
    if (cleanupInterval) {
      console.log('[Cleanup] Serviço já está rodando');
      return;
    }

    console.log('[Cleanup] Iniciando serviço de limpeza automática...');
    console.log(`[Cleanup] - Partidas: máximo ${MATCH_MAX_DURATION_MS / 60000} minutos`);
    console.log(`[Cleanup] - Salas: máximo ${ROOM_MAX_IDLE_MS / 3600000} horas de inatividade`);
    console.log(`[Cleanup] - Transmissões: verificação a cada ${LIVESTREAM_CHECK_INTERVAL_MS / 60000} minutos`);

    // Executar imediatamente na inicialização
    this.runCleanup();

    // Agendar execução periódica
    cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, CLEANUP_INTERVAL_MS);
  },

  // Parar serviço de limpeza
  stop() {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
      console.log('[Cleanup] Serviço de limpeza parado');
    }
  },

  // Executar todas as limpezas
  async runCleanup() {
    try {
      await Promise.all([
        this.cleanupExpiredMatches(),
        this.cleanupIdleRooms(),
        this.cleanupInactiveLivestreams(),
      ]);
    } catch (err) {
      console.error('[Cleanup] Erro durante limpeza:', err);
    }
  },

  // ==================== LIMPEZA DE PARTIDAS ====================
  
  // Encerrar partidas que excederam 30 minutos
  async cleanupExpiredMatches() {
    const cutoffTime = new Date(Date.now() - MATCH_MAX_DURATION_MS).toISOString();

    // Buscar partidas em andamento que excederam o tempo
    const { data: expiredMatches, error } = await supabaseAdmin
      .from('matches')
      .select('id, player1_id, player2_id, player1_score, player2_score, room_id, mode, started_at')
      .eq('status', 'playing')
      .lt('started_at', cutoffTime);

    if (error) {
      console.error('[Cleanup] Erro ao buscar partidas expiradas:', error);
      return;
    }

    if (!expiredMatches || expiredMatches.length === 0) {
      return;
    }

    console.log(`[Cleanup] Encontradas ${expiredMatches.length} partidas expiradas`);

    for (const match of expiredMatches) {
      try {
        await this.expireMatch(match);
      } catch (err) {
        console.error(`[Cleanup] Erro ao expirar partida ${match.id}:`, err);
      }
    }
  },

  // Expirar uma partida específica
  async expireMatch(match: any) {
    console.log(`[Cleanup] Expirando partida ${match.id} (iniciada em ${match.started_at})`);

    // Determinar vencedor baseado na pontuação
    let winnerId: string | null = null;
    let reason = 'timeout_draw';

    if (match.player1_score > match.player2_score) {
      winnerId = match.player1_id;
      reason = 'timeout_p1_wins';
    } else if (match.player2_score > match.player1_score) {
      winnerId = match.player2_id;
      reason = 'timeout_p2_wins';
    }
    // Se empate, não há vencedor - partida é cancelada

    if (winnerId) {
      // Finalizar com vencedor
      await supabaseAdmin
        .from('matches')
        .update({
          status: 'finished',
          winner_id: winnerId,
          finished_at: new Date().toISOString(),
          timeout_reason: reason,
        })
        .eq('id', match.id);

      console.log(`[Cleanup] Partida ${match.id} finalizada por timeout - Vencedor: ${winnerId}`);
    } else {
      // Empate - cancelar partida e reembolsar apostas
      await supabaseAdmin
        .from('matches')
        .update({
          status: 'cancelled',
          finished_at: new Date().toISOString(),
          timeout_reason: 'timeout_draw',
        })
        .eq('id', match.id);

      // Reembolsar apostas se houver
      if (match.mode === 'bet') {
        const { data: bet } = await supabaseAdmin
          .from('bets')
          .select('*')
          .eq('match_id', match.id)
          .single();

        if (bet && bet.status === 'active') {
          await walletService.addBalance(match.player1_id, bet.amount, 'Partida expirada (empate) - reembolso');
          await walletService.addBalance(match.player2_id, bet.amount, 'Partida expirada (empate) - reembolso');

          await supabaseAdmin
            .from('bets')
            .update({ status: 'cancelled' })
            .eq('id', bet.id);
        }
      }

      console.log(`[Cleanup] Partida ${match.id} cancelada por timeout (empate)`);
    }

    // Fechar sala
    if (match.room_id) {
      await supabaseAdmin
        .from('rooms')
        .update({ status: 'closed' })
        .eq('id', match.room_id);
    }

    // Notificar jogadores (criar notificação)
    const notificationMessage = winnerId
      ? 'Sua partida foi encerrada por tempo limite (30 minutos). O vencedor foi determinado pela pontuação.'
      : 'Sua partida foi encerrada por tempo limite (30 minutos). Como houve empate, a partida foi cancelada.';

    await supabaseAdmin.from('notifications').insert([
      {
        user_id: match.player1_id,
        type: 'match_timeout',
        title: '⏰ Partida Encerrada',
        message: notificationMessage,
        data: { match_id: match.id, winner_id: winnerId },
      },
      {
        user_id: match.player2_id,
        type: 'match_timeout',
        title: '⏰ Partida Encerrada',
        message: notificationMessage,
        data: { match_id: match.id, winner_id: winnerId },
      },
    ]);
  },

  // ==================== LIMPEZA DE SALAS ====================

  // Encerrar salas inativas por mais de 24 horas
  async cleanupIdleRooms() {
    const cutoffTime = new Date(Date.now() - ROOM_MAX_IDLE_MS).toISOString();

    // Buscar salas abertas ou cheias que estão inativas há mais de 24h
    const { data: idleRooms, error } = await supabaseAdmin
      .from('rooms')
      .select('id, owner_id, guest_id, status, created_at, updated_at')
      .in('status', ['open', 'full'])
      .lt('updated_at', cutoffTime);

    if (error) {
      console.error('[Cleanup] Erro ao buscar salas inativas:', error);
      return;
    }

    if (!idleRooms || idleRooms.length === 0) {
      return;
    }

    console.log(`[Cleanup] Encontradas ${idleRooms.length} salas inativas`);

    for (const room of idleRooms) {
      try {
        await this.closeIdleRoom(room);
      } catch (err) {
        console.error(`[Cleanup] Erro ao fechar sala ${room.id}:`, err);
      }
    }
  },

  // Fechar uma sala inativa
  async closeIdleRoom(room: any) {
    console.log(`[Cleanup] Fechando sala inativa ${room.id} (última atualização: ${room.updated_at})`);

    await supabaseAdmin
      .from('rooms')
      .update({ status: 'closed' })
      .eq('id', room.id);

    // Notificar dono da sala
    await supabaseAdmin.from('notifications').insert({
      user_id: room.owner_id,
      type: 'room_closed',
      title: '🚪 Sala Encerrada',
      message: 'Sua sala foi encerrada automaticamente após 24 horas de inatividade.',
      data: { room_id: room.id },
    });

    console.log(`[Cleanup] Sala ${room.id} fechada por inatividade`);
  },

  // ==================== LIMPEZA DE TRANSMISSÕES ====================

  // Encerrar transmissões inativas
  async cleanupInactiveLivestreams() {
    const cutoffTime = new Date(Date.now() - LIVESTREAM_CHECK_INTERVAL_MS).toISOString();

    // Buscar transmissões ativas sem atividade na última hora
    const { data: inactiveStreams, error } = await supabaseAdmin
      .from('livestreams')
      .select('id, user_id, title, started_at, last_activity_at')
      .eq('status', 'live')
      .lt('last_activity_at', cutoffTime);

    if (error) {
      // Tabela pode não existir ainda
      if (error.code !== '42P01') {
        console.error('[Cleanup] Erro ao buscar transmissões inativas:', error);
      }
      return;
    }

    if (!inactiveStreams || inactiveStreams.length === 0) {
      return;
    }

    console.log(`[Cleanup] Encontradas ${inactiveStreams.length} transmissões inativas`);

    for (const stream of inactiveStreams) {
      try {
        await this.endInactiveLivestream(stream);
      } catch (err) {
        console.error(`[Cleanup] Erro ao encerrar transmissão ${stream.id}:`, err);
      }
    }
  },

  // Encerrar uma transmissão inativa
  async endInactiveLivestream(stream: any) {
    console.log(`[Cleanup] Encerrando transmissão inativa ${stream.id} (última atividade: ${stream.last_activity_at})`);

    await supabaseAdmin
      .from('livestreams')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        end_reason: 'inactivity',
      })
      .eq('id', stream.id);

    // Notificar streamer
    await supabaseAdmin.from('notifications').insert({
      user_id: stream.user_id,
      type: 'livestream_ended',
      title: '📺 Transmissão Encerrada',
      message: 'Sua transmissão foi encerrada automaticamente após 1 hora sem atividade.',
      data: { livestream_id: stream.id },
    });

    console.log(`[Cleanup] Transmissão ${stream.id} encerrada por inatividade`);
  },

  // ==================== UTILITÁRIOS ====================

  // Verificar tempo restante de uma partida
  getMatchTimeRemaining(startedAt: string): number {
    const startTime = new Date(startedAt).getTime();
    const elapsed = Date.now() - startTime;
    const remaining = MATCH_MAX_DURATION_MS - elapsed;
    return Math.max(0, remaining);
  },

  // Verificar se partida expirou
  isMatchExpired(startedAt: string): boolean {
    return this.getMatchTimeRemaining(startedAt) <= 0;
  },

  // Obter constantes de tempo
  getTimeConstants() {
    return {
      matchMaxDurationMs: MATCH_MAX_DURATION_MS,
      matchMaxDurationMinutes: MATCH_MAX_DURATION_MS / 60000,
      roomMaxIdleMs: ROOM_MAX_IDLE_MS,
      roomMaxIdleHours: ROOM_MAX_IDLE_MS / 3600000,
      livestreamCheckIntervalMs: LIVESTREAM_CHECK_INTERVAL_MS,
      livestreamCheckIntervalMinutes: LIVESTREAM_CHECK_INTERVAL_MS / 60000,
    };
  },
};
