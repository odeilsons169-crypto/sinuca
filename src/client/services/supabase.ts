// Cliente Supabase para o frontend (Realtime)
import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bfazqquuxcrcdusdclwm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Gerenciador de canais Realtime
class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map();

  // Subscrever a uma sala
  subscribeToRoom(roomId: string, callbacks: {
    onPlayerJoined?: (payload: any) => void;
    onPlayerLeft?: (payload: any) => void;
    onRoomUpdated?: (payload: any) => void;
  }): RealtimeChannel {
    const channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`,
      }, (payload) => {
        callbacks.onRoomUpdated?.(payload.new);
      })
      .subscribe();

    this.channels.set(`room:${roomId}`, channel);
    return channel;
  }

  // Subscrever a uma partida
  subscribeToMatch(matchId: string, callbacks: {
    onStateChanged?: (payload: any) => void;
    onScoreUpdated?: (payload: any) => void;
    onMatchFinished?: (payload: any) => void;
  }): RealtimeChannel {
    const channel = supabase
      .channel(`match:${matchId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'matches',
        filter: `id=eq.${matchId}`,
      }, (payload) => {
        const match = payload.new as any;
        callbacks.onStateChanged?.(match);
        
        if (match.status === 'finished') {
          callbacks.onMatchFinished?.(match);
        }
      })
      .subscribe();

    this.channels.set(`match:${matchId}`, channel);
    return channel;
  }

  // Subscrever ao chat de uma sala
  subscribeToChat(roomId: string, onMessage: (message: any) => void): RealtimeChannel {
    const channel = supabase
      .channel(`chat:${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        onMessage(payload.new);
      })
      .subscribe();

    this.channels.set(`chat:${roomId}`, channel);
    return channel;
  }

  // Subscrever ao lobby (salas abertas)
  subscribeToLobby(callbacks: {
    onRoomCreated?: (room: any) => void;
    onRoomUpdated?: (room: any) => void;
    onRoomClosed?: (room: any) => void;
  }): RealtimeChannel {
    const channel = supabase
      .channel('lobby')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rooms',
      }, (payload) => {
        if (payload.new.status === 'open') {
          callbacks.onRoomCreated?.(payload.new);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
      }, (payload) => {
        const room = payload.new as any;
        if (room.status === 'closed') {
          callbacks.onRoomClosed?.(room);
        } else {
          callbacks.onRoomUpdated?.(room);
        }
      })
      .subscribe();

    this.channels.set('lobby', channel);
    return channel;
  }

  // Remover subscrição
  unsubscribe(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    }
  }

  // Remover todas as subscrições
  unsubscribeAll() {
    this.channels.forEach((channel) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
  }
}

export const realtime = new RealtimeManager();
