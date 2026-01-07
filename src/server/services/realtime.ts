import { supabase } from './supabase.js';
import { REALTIME_CHANNELS } from '../../shared/realtime/events.js';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Gerenciador de canais Realtime
class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map();

  // Subscrever a mudanças em uma tabela
  subscribeToTable(
    tableName: string,
    callback: (payload: unknown) => void,
    filter?: string
  ): RealtimeChannel {
    const channelName = filter ? `${tableName}:${filter}` : tableName;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter,
        },
        callback
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscrever ao lobby (salas abertas)
  subscribeToLobby(callback: (payload: unknown) => void): RealtimeChannel {
    return this.subscribeToTable('rooms', callback, 'status=eq.open');
  }

  // Subscrever a uma sala específica
  subscribeToRoom(roomId: string, callback: (payload: unknown) => void): RealtimeChannel {
    return this.subscribeToTable('rooms', callback, `id=eq.${roomId}`);
  }

  // Subscrever a uma partida específica
  subscribeToMatch(matchId: string, callback: (payload: unknown) => void): RealtimeChannel {
    return this.subscribeToTable('matches', callback, `id=eq.${matchId}`);
  }

  // Subscrever ao chat de uma sala
  subscribeToChat(roomId: string, callback: (payload: unknown) => void): RealtimeChannel {
    return this.subscribeToTable('chat_messages', callback, `room_id=eq.${roomId}`);
  }

  // Subscrever a convites do usuário
  subscribeToInvites(userId: string, callback: (payload: unknown) => void): RealtimeChannel {
    return this.subscribeToTable('invites', callback, `to_user_id=eq.${userId}`);
  }

  // Subscrever ao ranking
  subscribeToRanking(callback: (payload: unknown) => void): RealtimeChannel {
    return this.subscribeToTable('rankings', callback, 'period=eq.global');
  }

  // Broadcast para canal customizado
  broadcast(channelName: string, event: string, payload: unknown): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.send({
        type: 'broadcast',
        event,
        payload,
      });
    }
  }

  // Criar canal de broadcast
  createBroadcastChannel(channelName: string): RealtimeChannel {
    const channel = supabase.channel(channelName);
    this.channels.set(channelName, channel);
    return channel;
  }

  // Remover subscrição
  unsubscribe(channelName: string): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    }
  }

  // Remover todas as subscrições
  unsubscribeAll(): void {
    this.channels.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
  }
}

export const realtimeManager = new RealtimeManager();
