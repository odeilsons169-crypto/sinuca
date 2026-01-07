// Serviço de Realtime para sincronização multiplayer - OTIMIZADO
import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import { REALTIME_CHANNELS, ROOM_EVENTS, GAME_EVENTS, VOICE_EVENTS } from '../../shared/realtime/events.js';
import type {
  GameStartedPayload,
  ShotPayload,
  BallsUpdatePayload,
  TurnChangePayload,
  BallPocketedPayload,
  FoulPayload,
  TypeAssignedPayload,
  GameOverPayload,
  GameStateSyncPayload,
  AimUpdatePayload,
  VoiceSignalPayload
} from '../../shared/realtime/events';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 30
    }
  }
});

type GameEventCallback = (payload: any) => void;

// Throttle para eventos muito frequentes
function throttle<T extends (...args: any[]) => void>(fn: T, limit: number): T {
  let inThrottle = false;
  return ((...args: any[]) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  }) as T;
}

class RealtimeService {
  private roomChannel: RealtimeChannel | null = null;
  private gameChannel: RealtimeChannel | null = null;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private callbacks: Map<string, GameEventCallback[]> = new Map();
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private lastBallsUpdate: number = 0;

  // Conectar a uma sala
  async joinRoom(roomId: string, userId: string): Promise<void> {
    // Evitar múltiplas conexões simultâneas
    if (this.isConnecting) {
      console.log('[Realtime] Já está conectando, ignorando...');
      return;
    }
    
    // Se já está conectado à mesma sala, não reconectar
    if (this.currentRoomId === roomId && this.roomChannel && this.gameChannel) {
      console.log('[Realtime] Já conectado à sala', roomId);
      return;
    }

    this.isConnecting = true;
    this.currentUserId = userId;

    try {
      // Desconectar de sala anterior se existir
      if (this.currentRoomId && this.currentRoomId !== roomId) {
        await this.leaveRoom();
      }

      this.currentRoomId = roomId;
      this.reconnectAttempts = 0;

      // Canal da sala
      this.roomChannel = supabase.channel(REALTIME_CHANNELS.ROOM(roomId), {
        config: { 
          presence: { key: userId },
          broadcast: { self: false }
        }
      });

      // Canal do jogo
      this.gameChannel = supabase.channel(REALTIME_CHANNELS.GAME(roomId), {
        config: { broadcast: { self: false } }
      });

      // Configurar listeners do canal da sala
      this.roomChannel
        .on('broadcast', { event: ROOM_EVENTS.PLAYER_JOINED }, (payload) => {
          console.log('[Realtime] PLAYER_JOINED:', payload);
          this.emit(ROOM_EVENTS.PLAYER_JOINED, payload.payload);
        })
        .on('broadcast', { event: ROOM_EVENTS.PLAYER_LEFT }, (payload) => {
          console.log('[Realtime] PLAYER_LEFT:', payload);
          this.emit(ROOM_EVENTS.PLAYER_LEFT, payload.payload);
        })
        .on('broadcast', { event: ROOM_EVENTS.GAME_STARTED }, (payload) => {
          console.log('[Realtime] 🎮 GAME_STARTED:', payload);
          this.emit(ROOM_EVENTS.GAME_STARTED, payload.payload);
        })
        .on('broadcast', { event: ROOM_EVENTS.CLOSED }, (payload) => {
          console.log('[Realtime] CLOSED:', payload);
          this.emit(ROOM_EVENTS.CLOSED, payload.payload);
        });

      // Configurar listeners do canal do jogo
      this.gameChannel
        .on('broadcast', { event: GAME_EVENTS.SHOT_MADE }, (payload) => {
          this.emit(GAME_EVENTS.SHOT_MADE, payload.payload);
        })
        .on('broadcast', { event: GAME_EVENTS.BALLS_UPDATE }, (payload) => {
          // Throttle interno
          const now = Date.now();
          if (now - this.lastBallsUpdate >= 50) {
            this.lastBallsUpdate = now;
            this.emit(GAME_EVENTS.BALLS_UPDATE, payload.payload);
          }
        })
        .on('broadcast', { event: GAME_EVENTS.BALL_POCKETED }, (payload) => {
          this.emit(GAME_EVENTS.BALL_POCKETED, payload.payload);
        })
        .on('broadcast', { event: GAME_EVENTS.TURN_CHANGE }, (payload) => {
          this.emit(GAME_EVENTS.TURN_CHANGE, payload.payload);
        })
        .on('broadcast', { event: GAME_EVENTS.FOUL_COMMITTED }, (payload) => {
          this.emit(GAME_EVENTS.FOUL_COMMITTED, payload.payload);
        })
        .on('broadcast', { event: GAME_EVENTS.TYPE_ASSIGNED }, (payload) => {
          this.emit(GAME_EVENTS.TYPE_ASSIGNED, payload.payload);
        })
        .on('broadcast', { event: GAME_EVENTS.GAME_OVER }, (payload) => {
          this.emit(GAME_EVENTS.GAME_OVER, payload.payload);
        })
        .on('broadcast', { event: GAME_EVENTS.STATE_SYNC }, (payload) => {
          this.emit(GAME_EVENTS.STATE_SYNC, payload.payload);
        })
        .on('broadcast', { event: GAME_EVENTS.AIM_UPDATE }, (payload) => {
          this.emit(GAME_EVENTS.AIM_UPDATE, payload.payload);
        })
        .on('broadcast', { event: VOICE_EVENTS.SIGNAL }, (payload) => {
          this.emit(VOICE_EVENTS.SIGNAL, payload.payload);
        });

      // Subscrever aos canais
      await this.roomChannel.subscribe((status) => {
        console.log('[Realtime] Room status:', status);
        if (status === 'CHANNEL_ERROR') this.handleReconnect();
      });
      
      await this.gameChannel.subscribe((status) => {
        console.log('[Realtime] Game status:', status);
        if (status === 'CHANNEL_ERROR') this.handleReconnect();
      });

      console.log(`[Realtime] ✅ Conectado à sala ${roomId}`);
    } catch (error) {
      console.error('[Realtime] Erro ao conectar:', error);
      this.handleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || !this.currentRoomId || !this.currentUserId) {
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    console.log(`[Realtime] Reconectando em ${delay}ms...`);
    
    setTimeout(async () => {
      const roomId = this.currentRoomId;
      const userId = this.currentUserId;
      this.roomChannel = null;
      this.gameChannel = null;
      this.currentRoomId = null;
      if (roomId && userId) await this.joinRoom(roomId, userId);
    }, delay);
  }

  async leaveRoom(): Promise<void> {
    try {
      if (this.roomChannel) await this.roomChannel.unsubscribe();
      if (this.gameChannel) await this.gameChannel.unsubscribe();
    } catch (e) { /* ignore */ }
    this.roomChannel = null;
    this.gameChannel = null;
    this.currentRoomId = null;
    this.callbacks.clear();
    this.reconnectAttempts = 0;
  }

  on(event: string, callback: GameEventCallback): void {
    if (!this.callbacks.has(event)) this.callbacks.set(event, []);
    this.callbacks.get(event)!.push(callback);
  }

  off(event: string, callback?: GameEventCallback): void {
    if (!callback) {
      this.callbacks.delete(event);
    } else {
      const cbs = this.callbacks.get(event);
      if (cbs) {
        const idx = cbs.indexOf(callback);
        if (idx > -1) cbs.splice(idx, 1);
      }
    }
  }

  private emit(event: string, payload: any): void {
    const cbs = this.callbacks.get(event);
    if (cbs) cbs.forEach(cb => { try { cb(payload); } catch (e) { console.error(e); } });
  }

  // ==================== EVENTOS DE SALA ====================

  async broadcastPlayerJoined(player: { id: string; username: string }): Promise<void> {
    if (!this.roomChannel) return;
    await this.roomChannel.send({
      type: 'broadcast', event: ROOM_EVENTS.PLAYER_JOINED,
      payload: { player, roomId: this.currentRoomId }
    });
  }

  async broadcastPlayerLeft(playerId: string): Promise<void> {
    if (!this.roomChannel) return;
    await this.roomChannel.send({
      type: 'broadcast', event: ROOM_EVENTS.PLAYER_LEFT,
      payload: { playerId, roomId: this.currentRoomId }
    });
  }

  async broadcastGameStarted(payload: GameStartedPayload): Promise<void> {
    if (!this.roomChannel) return;
    console.log('[Realtime] Enviando GAME_STARTED:', payload);
    await this.roomChannel.send({ type: 'broadcast', event: ROOM_EVENTS.GAME_STARTED, payload });
  }

  // ==================== EVENTOS DE JOGO ====================

  async sendShot(payload: Omit<ShotPayload, 'roomId' | 'timestamp'>): Promise<void> {
    if (!this.gameChannel || !this.currentRoomId) return;
    await this.gameChannel.send({
      type: 'broadcast', event: GAME_EVENTS.SHOT_MADE,
      payload: { ...payload, roomId: this.currentRoomId, timestamp: Date.now() }
    });
  }

  // Throttled balls update
  private _lastBallsSent = 0;
  async sendBallsUpdate(balls: BallsUpdatePayload['balls']): Promise<void> {
    if (!this.gameChannel || !this.currentRoomId) return;
    const now = Date.now();
    if (now - this._lastBallsSent < 100) return; // Max 10/sec
    this._lastBallsSent = now;
    await this.gameChannel.send({
      type: 'broadcast', event: GAME_EVENTS.BALLS_UPDATE,
      payload: { balls, roomId: this.currentRoomId, timestamp: now }
    });
  }

  async sendBallPocketed(payload: Omit<BallPocketedPayload, 'roomId' | 'timestamp'>): Promise<void> {
    if (!this.gameChannel || !this.currentRoomId) return;
    await this.gameChannel.send({
      type: 'broadcast', event: GAME_EVENTS.BALL_POCKETED,
      payload: { ...payload, roomId: this.currentRoomId, timestamp: Date.now() }
    });
  }

  async sendTurnChange(payload: Omit<TurnChangePayload, 'roomId'>): Promise<void> {
    if (!this.gameChannel || !this.currentRoomId) return;
    await this.gameChannel.send({
      type: 'broadcast', event: GAME_EVENTS.TURN_CHANGE,
      payload: { ...payload, roomId: this.currentRoomId }
    });
  }

  async sendFoul(payload: Omit<FoulPayload, 'roomId' | 'timestamp'>): Promise<void> {
    if (!this.gameChannel || !this.currentRoomId) return;
    await this.gameChannel.send({
      type: 'broadcast', event: GAME_EVENTS.FOUL_COMMITTED,
      payload: { ...payload, roomId: this.currentRoomId, timestamp: Date.now() }
    });
  }

  async sendTypeAssigned(payload: Omit<TypeAssignedPayload, 'roomId'>): Promise<void> {
    if (!this.gameChannel || !this.currentRoomId) return;
    await this.gameChannel.send({
      type: 'broadcast', event: GAME_EVENTS.TYPE_ASSIGNED,
      payload: { ...payload, roomId: this.currentRoomId }
    });
  }

  async sendGameOver(payload: Omit<GameOverPayload, 'roomId'>): Promise<void> {
    if (!this.gameChannel || !this.currentRoomId) return;
    await this.gameChannel.send({
      type: 'broadcast', event: GAME_EVENTS.GAME_OVER,
      payload: { ...payload, roomId: this.currentRoomId }
    });
  }

  async sendStateSync(payload: Omit<GameStateSyncPayload, 'roomId'>): Promise<void> {
    if (!this.gameChannel || !this.currentRoomId) return;
    await this.gameChannel.send({
      type: 'broadcast', event: GAME_EVENTS.STATE_SYNC,
      payload: { ...payload, roomId: this.currentRoomId }
    });
  }

  // Throttled aim update
  private _lastAimSent = 0;
  async sendAimUpdate(payload: Omit<AimUpdatePayload, 'roomId'>): Promise<void> {
    if (!this.gameChannel || !this.currentRoomId) return;
    const now = Date.now();
    if (now - this._lastAimSent < 50) return; // Max 20/sec
    this._lastAimSent = now;
    await this.gameChannel.send({
      type: 'broadcast', event: GAME_EVENTS.AIM_UPDATE,
      payload: { ...payload, roomId: this.currentRoomId }
    });
  }

  async sendVoiceSignal(payload: Omit<VoiceSignalPayload, 'roomId'>): Promise<void> {
    if (!this.gameChannel || !this.currentRoomId) return;
    await this.gameChannel.send({
      type: 'broadcast', event: VOICE_EVENTS.SIGNAL,
      payload: { ...payload, roomId: this.currentRoomId }
    });
  }

  isConnected(): boolean {
    return this.roomChannel !== null && this.gameChannel !== null;
  }

  getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }
}

export const realtimeService = new RealtimeService();
