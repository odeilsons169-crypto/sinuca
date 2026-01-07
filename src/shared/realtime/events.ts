// =====================================================
// MAPA DE EVENTOS SUPABASE REALTIME
// =====================================================

// Canais e eventos para sincronização em tempo real

export const REALTIME_CHANNELS = {
  // Canal de partida específica
  MATCH: (matchId: string) => `match:${matchId}`,

  // Canal de sala específica
  ROOM: (roomId: string) => `room:${roomId}`,

  // Canal de chat da sala
  CHAT: (roomId: string) => `chat:${roomId}`,

  // Canal de convites do usuário
  INVITES: (userId: string) => `invites:${userId}`,

  // Canal de ranking global
  RANKING: 'ranking:global',

  // Canal de notificações do usuário
  NOTIFICATIONS: (userId: string) => `notifications:${userId}`,

  // Canal de lobby (salas abertas)
  LOBBY: 'lobby:rooms',

  // Canal de jogo em tempo real
  GAME: (roomId: string) => `game:${roomId}`,
} as const;

// =====================================================
// EVENTOS DE PARTIDA
// =====================================================

export const MATCH_EVENTS = {
  // Estado da partida mudou
  STATE_CHANGED: 'match:state_changed',

  // Jogada realizada
  MOVE_MADE: 'match:move_made',

  // Turno mudou
  TURN_CHANGED: 'match:turn_changed',

  // Pontuação atualizada
  SCORE_UPDATED: 'match:score_updated',

  // Partida iniciada
  STARTED: 'match:started',

  // Partida finalizada
  FINISHED: 'match:finished',

  // Jogador desconectou
  PLAYER_DISCONNECTED: 'match:player_disconnected',

  // Jogador reconectou
  PLAYER_RECONNECTED: 'match:player_reconnected',
} as const;

// =====================================================
// EVENTOS DE SALA
// =====================================================

export const ROOM_EVENTS = {
  // Jogador entrou na sala
  PLAYER_JOINED: 'room:player_joined',

  // Jogador saiu da sala
  PLAYER_LEFT: 'room:player_left',

  // Sala fechada
  CLOSED: 'room:closed',

  // Partida pronta para iniciar
  READY_TO_START: 'room:ready_to_start',

  // Configurações da sala alteradas
  SETTINGS_CHANGED: 'room:settings_changed',

  // Partida iniciada - BROADCAST para todos na sala
  GAME_STARTED: 'room:game_started',
} as const;

// =====================================================
// EVENTOS DE JOGO EM TEMPO REAL
// =====================================================

export const GAME_EVENTS = {
  // Tacada realizada (posição inicial, direção, força)
  SHOT_MADE: 'game:shot_made',

  // Atualização de posição das bolas
  BALLS_UPDATE: 'game:balls_update',

  // Bola encaçapada
  BALL_POCKETED: 'game:ball_pocketed',

  // Troca de turno
  TURN_CHANGE: 'game:turn_change',

  // Falta cometida (A Cega)
  FOUL_COMMITTED: 'game:foul_committed',

  // Tipo definido (Par/Ímpar ou Cor)
  TYPE_ASSIGNED: 'game:type_assigned',

  // Jogo finalizado
  GAME_OVER: 'game:game_over',

  // Sincronização de estado completo
  STATE_SYNC: 'game:state_sync',

  // Jogador pronto
  PLAYER_READY: 'game:player_ready',

  // Mira do jogador (para mostrar ao oponente)
  AIM_UPDATE: 'game:aim_update',
} as const;

// =====================================================
// EVENTOS DE CHAT
// =====================================================

export const CHAT_EVENTS = {
  // Nova mensagem
  NEW_MESSAGE: 'chat:new_message',

  // Mensagem moderada
  MESSAGE_MODERATED: 'chat:message_moderated',

  // Usuário mutado
  USER_MUTED: 'chat:user_muted',
} as const;

// =====================================================
// EVENTOS DE VOZ
// =====================================================

export const VOICE_EVENTS = {
  // Sinalização WebRTC (Offer, Answer, Candidate)
  SIGNAL: 'voice:signal',
} as const;

// =====================================================
// EVENTOS DE CONVITE
// =====================================================

export const INVITE_EVENTS = {
  // Novo convite recebido
  RECEIVED: 'invite:received',

  // Convite aceito
  ACCEPTED: 'invite:accepted',

  // Convite rejeitado
  REJECTED: 'invite:rejected',

  // Convite expirado
  EXPIRED: 'invite:expired',
} as const;

// =====================================================
// EVENTOS DE RANKING
// =====================================================

export const RANKING_EVENTS = {
  // Ranking atualizado
  UPDATED: 'ranking:updated',

  // Posição do usuário mudou
  POSITION_CHANGED: 'ranking:position_changed',
} as const;

// =====================================================
// EVENTOS FINANCEIROS
// =====================================================

export const FINANCIAL_EVENTS = {
  // Aposta confirmada
  BET_CONFIRMED: 'financial:bet_confirmed',

  // Aposta liquidada
  BET_SETTLED: 'financial:bet_settled',

  // Saldo atualizado
  BALANCE_UPDATED: 'financial:balance_updated',

  // Créditos atualizados
  CREDITS_UPDATED: 'financial:credits_updated',

  // Pagamento confirmado
  PAYMENT_CONFIRMED: 'financial:payment_confirmed',
} as const;

// =====================================================
// EVENTOS DE LOBBY
// =====================================================

export const LOBBY_EVENTS = {
  // Nova sala criada
  ROOM_CREATED: 'lobby:room_created',

  // Sala removida
  ROOM_REMOVED: 'lobby:room_removed',

  // Sala atualizada
  ROOM_UPDATED: 'lobby:room_updated',
} as const;

// =====================================================
// PAYLOADS DOS EVENTOS
// =====================================================

export interface MatchStatePayload {
  matchId: string;
  status: 'waiting' | 'playing' | 'finished' | 'cancelled';
  currentTurn: string;
  player1Score: number;
  player2Score: number;
  gameState: Record<string, unknown>;
}

export interface MovePayload {
  matchId: string;
  playerId: string;
  move: {
    type: string;
    data: Record<string, unknown>;
  };
  timestamp: string;
}

export interface ChatMessagePayload {
  roomId: string;
  userId: string;
  username: string;
  message: string;
  timestamp: string;
}

export interface InvitePayload {
  inviteId: string;
  roomId: string;
  fromUserId: string;
  fromUsername: string;
  mode: 'casual' | 'bet' | 'ai';
  betAmount?: number;
  expiresAt: string;
}

export interface RankingUpdatePayload {
  userId: string;
  newPoints: number;
  newPosition: number;
  previousPosition: number;
}

export interface BalanceUpdatePayload {
  userId: string;
  newBalance: number;
  changeAmount: number;
  reason: string;
}

export interface RoomUpdatePayload {
  roomId: string;
  ownerId: string;
  ownerUsername: string;
  status: 'open' | 'full' | 'playing' | 'closed';
  mode: 'casual' | 'bet' | 'ai';
  betAmount?: number;
}

// =====================================================
// PAYLOADS DE JOGO EM TEMPO REAL
// =====================================================

export interface BallState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pocketed: boolean;
  color: string;
  number: string;
  type: 'cue' | 'solid' | 'stripe' | 'eight' | 'red' | 'blue';
}

export interface ShotPayload {
  roomId: string;
  playerId: string;
  cueBallX: number;
  cueBallY: number;
  directionX: number;
  directionY: number;
  power: number;
  timestamp: number;
}

export interface BallsUpdatePayload {
  roomId: string;
  balls: BallState[];
  timestamp: number;
}

export interface BallPocketedPayload {
  roomId: string;
  ballId: number;
  ballType: string;
  pocketedBy: string;
  isFoul: boolean;
  timestamp: number;
}

export interface TurnChangePayload {
  roomId: string;
  currentPlayerId: string;
  previousPlayerId: string;
  reason: 'miss' | 'foul' | 'timeout' | 'start';
  turnNumber: number;
}

export interface FoulPayload {
  roomId: string;
  playerId: string;
  foulType: 'wrong_ball' | 'cue_pocketed' | 'no_hit';
  penaltyBallId?: number;
  timestamp: number;
}

export interface TypeAssignedPayload {
  roomId: string;
  player1Id: string;
  player1Type: 'solid' | 'stripe' | 'red' | 'blue' | 'even' | 'odd';
  player2Id: string;
  player2Type: 'solid' | 'stripe' | 'red' | 'blue' | 'even' | 'odd';
}

export interface GameOverPayload {
  roomId: string;
  matchId: string;
  winnerId: string;
  winnerUsername: string;
  loserId: string;
  loserUsername: string;
  player1Score: number;
  player2Score: number;
  reason: 'all_balls' | 'opponent_foul' | 'timeout' | 'forfeit';
}

export interface GameStateSyncPayload {
  roomId: string;
  matchId: string;
  balls: BallState[];
  currentPlayerId: string;
  player1Id: string;
  player1Type: string | null;
  player1Score: number;
  player2Id: string;
  player2Type: string | null;
  player2Score: number;
  turnNumber: number;
  gameMode: '9ball' | '15ball';
  status: 'waiting' | 'playing' | 'finished';
}

export interface GameStartedPayload {
  roomId: string;
  matchId: string;
  player1: { id: string; username: string };
  player2: { id: string; username: string };
  gameMode: '9ball' | '15ball';
  firstPlayerId: string;
}

export interface AimUpdatePayload {
  roomId: string;
  playerId: string;
  aimX: number;
  aimY: number;
  power: number;
}

export interface VoiceSignalPayload {
  roomId: string;
  senderId: string;
  targetId?: string;
  signal: any;
}
