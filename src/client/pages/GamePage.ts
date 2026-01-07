/// <reference lib="dom" />
import { gameStore } from '../store/gameStore.js';
import { api } from '../services/api.js';
import { realtimeService } from '../services/realtime.js';
import { voiceChatService } from '../services/VoiceChatService.js';
import { GAME_EVENTS, ROOM_EVENTS } from '../../shared/realtime/events.js';
import type { BallState, ShotPayload, BallsUpdatePayload } from '../../shared/realtime/events.js';
import {
  PHYSICS,
  POCKETS,
  updatePhysics,
  areBallsMoving,
  applyCueShot,
  type PhysicsBall
} from '../engine/physics.js';
import { audioEngine } from '../engine/audio.js';
import { PoolRenderer, type RenderState } from '../engine/renderer.js';
import { musicPlayer } from '../services/musicPlayer.js';

// ==================== TIPOS ====================

interface CueState {
  visible: boolean;
  angle: number;
  pullBack: number;
  power: number;
  x: number;
  y: number;
  contactX: number;
  contactY: number;
}
interface Ball extends Omit<PhysicsBall, 'type' | 'number'> {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pocketed: boolean;
  color: string;
  number: number;
  type: 'cue' | 'solid' | 'stripe' | 'eight' | 'red' | 'blue';
  spinX: number;
  spinY: number;
  spinZ: number;
  inMotion: boolean;
  falling: boolean;
  fallProgress: number;
  fallPocket: { x: number; y: number } | null;
}

interface GameState {
  balls: Ball[];
  currentPlayer: 1 | 2;
  // Para 15 bolas: 'solid' (lisas) ou 'stripe' (listradas) - COMPATIBILIDADE 8-BALL
  // Legado: 'odd'/'even' (14ball), 'red'/'blue' (9ball)
  player1Type: 'solid' | 'stripe' | 'odd' | 'even' | 'red' | 'blue' | null;
  player2Type: 'solid' | 'stripe' | 'odd' | 'even' | 'red' | 'blue' | null;
  player1Score: number;
  player2Score: number;
  player1Balls: number[]; // Bolas do jogador 1
  player2Balls: number[]; // Bolas do jogador 2
  turn: number;
  isAiming: boolean;
  aimAngle: number;
  aimPower: number;
  gameOver: boolean;
  winner: string | null;
  turnTimer: number;
  isAI: boolean;
  isMultiplayer: boolean;
  gameMode: '9ball' | '14ball';
  myPlayerId: string | null;
  isMyTurn: boolean;
  lastPocketedBall: Ball | null;
  foulCommitted: boolean;
  wrongBallHit: boolean;
  ballInHand: boolean;
  cueState: CueState;
  unlimitedCredits?: boolean;
  isSpectator?: boolean;
}

let gameState: GameState;
let canvas: HTMLCanvasElement | null = null;
let renderer: PoolRenderer | null = null;
let animationId: number | null = null;
let timerInterval: number | null = null;
let matchTimerInterval: number | null = null; // Timer da partida (30 min)
let matchStartTime: number | null = null; // Timestamp de início da partida
let roomData: any = null;
let firstBallHit: Ball | null = null;
let isDraggingCueBall = false;
let sessionScore = { p1: 0, p2: 0 };
let aimLineEnabled = true; // Controla se a linha de mira está habilitada

// ==================== CONSTANTES ====================

const TABLE_WIDTH = 1400; // Mesa maior
const TABLE_HEIGHT = 700;
const BALL_RADIUS = PHYSICS.BALL_RADIUS;
const TURN_TIME = 30;
const CANVAS_PADDING = 140; // Exatamente 2x a woodBorder do renderizador (70px cada lado)
const MATCH_MAX_DURATION_MS = 30 * 60 * 1000; // 30 minutos em milissegundos

// ==================== INICIALIZAÇÃO DE BOLAS ====================

function initBalls14(): Ball[] {
  const balls: Ball[] = [
    {
      id: 0, x: TABLE_WIDTH * 0.25, y: TABLE_HEIGHT / 2, vx: 0, vy: 0,
      spinX: 0, spinY: 0, spinZ: 0,
      angularVelocity: 0, mass: PHYSICS.BALL_MASS, radius: BALL_RADIUS,
      pocketed: false, inMotion: false, falling: false, fallProgress: 0, fallPocket: null,
      inPocketAnimation: false, pocketAnimationProgress: 0,
      color: '#ffffff', number: 0, type: 'cue'
    },
  ];

  // Triângulo de 15 bolas - posicionado a 70% da largura
  const startX = TABLE_WIDTH * 0.70;
  const startY = TABLE_HEIGHT / 2;
  const spacing = BALL_RADIUS * 2.05;

  // 15 bolas: 1-7 Lisas (Solids), 8 Preta, 9-15 Listradas (Stripes)
  // IMPORTANTE: O ID da bola DEVE ser igual ao número da bola para identificação correta
  const ballData = [
    { num: 1, color: '#F7D000', type: 'solid' as const },
    { num: 2, color: '#0055AA', type: 'solid' as const },
    { num: 3, color: '#E02020', type: 'solid' as const },
    { num: 4, color: '#7B2D8E', type: 'solid' as const },
    { num: 5, color: '#FF6B00', type: 'solid' as const },
    { num: 6, color: '#007744', type: 'solid' as const },
    { num: 7, color: '#8B1538', type: 'solid' as const },
    { num: 8, color: '#000000', type: 'eight' as const },
    { num: 9, color: '#F7D000', type: 'stripe' as const },
    { num: 10, color: '#0055AA', type: 'stripe' as const },
    { num: 11, color: '#E02020', type: 'stripe' as const },
    { num: 12, color: '#7B2D8E', type: 'stripe' as const },
    { num: 13, color: '#FF6B00', type: 'stripe' as const },
    { num: 14, color: '#007744', type: 'stripe' as const },
    { num: 15, color: '#8B1538', type: 'stripe' as const },
  ];

  // Posições do triângulo (5 fileiras)
  const positions = [
    { row: 0, col: 0 },
    { row: 1, col: -0.5 }, { row: 1, col: 0.5 },
    { row: 2, col: -1 }, { row: 2, col: 0 }, { row: 2, col: 1 },
    { row: 3, col: -1.5 }, { row: 3, col: -0.5 }, { row: 3, col: 0.5 }, { row: 3, col: 1.5 },
    { row: 4, col: -2 }, { row: 4, col: -1 }, { row: 4, col: 0 }, { row: 4, col: 1 }, { row: 4, col: 2 },
  ];

  // Ordem de posicionamento: bola 8 no centro (posição 4)
  // Cantos inferiores devem ter uma solid e uma stripe
  const rackingOrder = [
    0,      // pos 0: bola 1 (ponta)
    8, 1,   // pos 1-2: bola 9, 2
    9, 7, 2, // pos 3-5: bola 10, 8 (CENTRO), 3
    10, 3, 11, 4, // pos 6-9: bola 11, 4, 12, 5
    12, 5, 13, 6, 14 // pos 10-14: bola 13, 6, 14, 7, 15
  ];

  for (let i = 0; i < 15; i++) {
    const pos = positions[i];
    const ballIdx = rackingOrder[i];
    const data = ballData[ballIdx];

    // IMPORTANTE: id = number da bola para identificação correta
    balls.push({
      id: data.num, // ID = número da bola
      x: startX + pos.row * spacing * 0.866,
      y: startY + pos.col * spacing,
      vx: 0, vy: 0,
      spinX: 0, spinY: 0, spinZ: 0,
      angularVelocity: 0,
      mass: PHYSICS.BALL_MASS,
      radius: BALL_RADIUS,
      pocketed: false,
      inMotion: false,
      falling: false,
      fallProgress: 0,
      fallPocket: null,
      inPocketAnimation: false,
      pocketAnimationProgress: 0,
      color: data.color,
      number: data.num, // Número da bola
      type: data.type,
    });
  }

  console.log('[initBalls14] Bolas criadas:', balls.map(b => ({ id: b.id, num: b.number, type: b.type })));
  return balls;
}

function initBalls9(): Ball[] {
  const balls: Ball[] = [
    {
      id: 0, x: TABLE_WIDTH / 2, y: TABLE_HEIGHT / 2, vx: 0, vy: 0,
      spinX: 0, spinY: 0, spinZ: 0,
      angularVelocity: 0, mass: PHYSICS.BALL_MASS, radius: BALL_RADIUS,
      pocketed: false, inMotion: false, falling: false, fallProgress: 0, fallPocket: null,
      inPocketAnimation: false, pocketAnimationProgress: 0,
      color: '#ffffff', number: 0, type: 'cue'
    },
  ];

  // Modo 9 bolas: 4 vermelhas vs 4 azuis
  // Posicionamento: 2 de cada cor em cada lado da mesa
  // Lado esquerdo: 2 vermelhas em cima, 2 azuis embaixo
  // Lado direito: 2 azuis em cima, 2 vermelhas embaixo

  const marginX = 150; // Distância da borda lateral
  const marginY = 100; // Distância da borda superior/inferior
  const spacingX = BALL_RADIUS * 3;
  const spacingY = BALL_RADIUS * 3;

  // Posições das 8 bolas (4 vermelhas ímpares, 4 azuis pares)
  // Posições das 8 bolas - Layout Cruzado (Referência Visual)
  const ballPositions = [
    // --- LADO ESQUERDO ---
    // Superior: 2 Vermelhas
    { x: marginX, y: marginY, color: '#E02020', num: 1, type: 'red' as const },
    { x: marginX + spacingX, y: marginY, color: '#E02020', num: 3, type: 'red' as const },
    // Inferior: 2 Azuis
    { x: marginX, y: TABLE_HEIGHT - marginY, color: '#0066CC', num: 2, type: 'blue' as const },
    { x: marginX + spacingX, y: TABLE_HEIGHT - marginY, color: '#0066CC', num: 4, type: 'blue' as const },

    // --- LADO DIREITO ---
    // Superior: 2 Azuis
    { x: TABLE_WIDTH - marginX - spacingX, y: marginY, color: '#0066CC', num: 6, type: 'blue' as const },
    { x: TABLE_WIDTH - marginX, y: marginY, color: '#0066CC', num: 8, type: 'blue' as const },
    // Inferior: 2 Vermelhas
    { x: TABLE_WIDTH - marginX - spacingX, y: TABLE_HEIGHT - marginY, color: '#E02020', num: 5, type: 'red' as const },
    { x: TABLE_WIDTH - marginX, y: TABLE_HEIGHT - marginY, color: '#E02020', num: 7, type: 'red' as const },
  ];

  for (let i = 0; i < 8; i++) {
    const pos = ballPositions[i];
    // IMPORTANTE: id = number da bola para identificação correta
    balls.push({
      id: pos.num, // ID = número da bola (não i+1!)
      x: pos.x,
      y: pos.y,
      vx: 0, vy: 0,
      spinX: 0, spinY: 0, spinZ: 0,
      angularVelocity: 0,
      mass: PHYSICS.BALL_MASS,
      radius: BALL_RADIUS,
      pocketed: false,
      inMotion: false,
      falling: false,
      fallProgress: 0,
      fallPocket: null,
      inPocketAnimation: false,
      pocketAnimationProgress: 0,
      color: pos.color,
      number: pos.num,
      type: pos.type,
    });
  }

  console.log('[initBalls9] Bolas criadas:', balls.map(b => ({ id: b.id, num: b.number, type: b.type })));
  return balls;
}

function initGameState(mode: '9ball' | '14ball' = '14ball'): GameState {
  const is9Ball = mode === '9ball';
  const redBalls = [1, 3, 5, 7];
  const blueBalls = [2, 4, 6, 8];

  return {
    balls: is9Ball ? initBalls9() : initBalls14(), // initBalls14 agora gera 15 bolas (8-ball)
    currentPlayer: 1,
    player1Type: is9Ball ? 'red' : null,
    player2Type: is9Ball ? 'blue' : null,
    player1Score: 0,
    player2Score: 0,
    player1Balls: is9Ball ? [...redBalls] : [], // Vazio no início do 8-ball
    player2Balls: is9Ball ? [...blueBalls] : [], // Vazio no início do 8-ball
    turn: 1,
    isAiming: false,
    aimAngle: 0,
    aimPower: 0,
    gameOver: false,
    winner: null,
    turnTimer: TURN_TIME,
    isAI: false,
    isMultiplayer: false,
    gameMode: mode,
    myPlayerId: null,
    isMyTurn: true,
    lastPocketedBall: null,
    foulCommitted: false,
    wrongBallHit: false,
    ballInHand: false,
    cueState: { visible: false, angle: 0, pullBack: 0, power: 0, x: 0, y: 0, contactX: 0, contactY: 0 },
  };
}

// ==================== DEBITAR CRÉDITO IA ====================

async function debitAICredit() {
  try {
    await api.request('/credits/debit-ai', { method: 'POST' });
    const { data } = await api.getCredits();
    if (data) {
      gameStore.setCredits(data.amount, data.is_unlimited);
    }
  } catch (err) {
    console.error('Erro ao debitar crédito AI:', err);
  }
}

// ==================== DEBUG ====================

// Função de debug global para verificar estado das bolas
// Pode ser chamada do console: window.debugBalls()
(window as any).debugBalls = function () {
  if (!gameState) {
    console.log('❌ gameState não inicializado');
    return;
  }

  console.log('=== DEBUG BOLAS ===');
  console.log('Player 1 Type:', gameState.player1Type);
  console.log('Player 2 Type:', gameState.player2Type);
  console.log('Player 1 Balls:', gameState.player1Balls);
  console.log('Player 2 Balls:', gameState.player2Balls);
  console.log('');
  console.log('Estado de todas as bolas:');
  gameState.balls.forEach(b => {
    const isP1 = gameState.player1Balls.includes(Number(b.number));
    const isP2 = gameState.player2Balls.includes(Number(b.number));
    const owner = isP1 ? 'P1' : (isP2 ? 'P2' : (b.type === 'eight' ? '8' : (b.type === 'cue' ? 'CUE' : '?')));
    console.log(`  Bola ${b.number} (id:${b.id}, type:${b.type}): pocketed=${b.pocketed}, owner=${owner}`);
  });
  console.log('');

  // Verificar bolas restantes
  const p1Remaining = gameState.player1Balls.filter(num => {
    const ball = gameState.balls.find(b => Number(b.number) === num);
    return ball && !ball.pocketed;
  });
  const p2Remaining = gameState.player2Balls.filter(num => {
    const ball = gameState.balls.find(b => Number(b.number) === num);
    return ball && !ball.pocketed;
  });

  console.log('P1 Restantes:', p1Remaining, `(${p1Remaining.length})`);
  console.log('P2 Restantes:', p2Remaining, `(${p2Remaining.length})`);
  console.log('==================');

  return { gameState, p1Remaining, p2Remaining };
};

// ==================== PERSISTÊNCIA ====================

function saveGameState() {
  if (!gameState) return;
  const data = {
    gameState,
    roomData,
    sessionScore, // Persistir placar da sessão
    matchStartTime, // Persistir tempo de início da partida
    timestamp: Date.now()
  };
  localStorage.setItem('sinuca_save_v1', JSON.stringify(data));
}

function tryLoadGameState(): boolean {
  try {
    const raw = localStorage.getItem('sinuca_save_v1');
    if (!raw) return false;
    const data = JSON.parse(raw);

    // Validade de 24h
    if (Date.now() - data.timestamp > 86400000) {
      localStorage.removeItem('sinuca_save_v1');
      return false;
    }

    gameState = data.gameState;
    roomData = data.roomData || roomData; // Recuperar contexto da sala
    sessionScore = data.sessionScore || { p1: 0, p2: 0 };
    matchStartTime = data.matchStartTime || null; // Recuperar tempo de início

    // Verificar integridade das bolas após restaurar
    console.log('[tryLoadGameState] Estado restaurado:', {
      balls: gameState.balls.map(b => ({ id: b.id, num: b.number, type: b.type, pocketed: b.pocketed })),
      player1Balls: gameState.player1Balls,
      player2Balls: gameState.player2Balls,
      player1Type: gameState.player1Type,
      player2Type: gameState.player2Type,
      matchStartTime: matchStartTime ? new Date(matchStartTime).toISOString() : null
    });

    return true;
  } catch (error) {
    console.error('Falha ao restaurar jogo salvo:', error);
    return false;
  }
}

// ==================== PÁGINA PRINCIPAL ====================

export function GamePage(app: any, data: any): string {
  const state = gameStore.getState();
  roomData = data || { owner: { username: 'Jogador 1' }, guest: { username: 'Jogador 2' }, mode: 'casual' };

  const mode = roomData.gameMode || '14ball';
  const isMultiplayer = roomData.isMultiplayer || false;
  const isAI = roomData.mode === 'ai';

  // Configuração de mira da sala (default: true)
  aimLineEnabled = roomData.aim_line_enabled !== false;

  if (!gameState && !tryLoadGameState()) {
    // Se não há gameState em memória E não conseguiu restaurar do localStorage -> Iniciar Novo
    gameState = initGameState(mode);
    gameState.isAI = isAI;
    gameState.isMultiplayer = isMultiplayer;
    gameState.isSpectator = !!roomData.isSpectator;
    gameState.myPlayerId = state.user?.id || null;

    if (isMultiplayer) {
      const isOwner = roomData.owner_id === state.user?.id || roomData.owner?.id === state.user?.id;
      gameState.isMyTurn = isOwner;
      gameState.currentPlayer = 1;
    }

    if (isAI && !roomData.creditDebited) {
      debitAICredit();
      roomData.creditDebited = true;
    }

    // Salvar estado inicial
    saveGameState();
  } else if (gameState && gameState.gameOver) {
    // Se já existe mas está Game Over -> Deixa quieto, o usuário decide se reinicia.
    // Mas se ele recarregou na tela de Game Over, o restore recuperou o estado Game Over.
  }

  setTimeout(() => initGame(app, roomData), 100);

  const player1Name = roomData.owner?.username || roomData.player1?.username || 'Jogador 1';
  const player2Name = isAI ? '🤖 CPU' : (roomData.guest?.username || roomData.player2?.username || 'Jogador 2');
  const modeLabel = mode === '9ball' ? '🔴🔵 Modo 4x4' : '🎱 Modo 8 Bolas';

  // Detectar mobile e preparar modo paisagem
  const isMobileDevice = window.innerWidth <= 900 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Adicionar classe ao body para indicar jogo ativo (esconde nav mobile)
  setTimeout(() => {
    document.body.classList.add('game-active');

    // Tentar forçar modo paisagem em mobile
    if (isMobileDevice && screen.orientation && (screen.orientation as any).lock) {
      (screen.orientation as any).lock('landscape').catch(() => {
        console.log('[GamePage] Não foi possível travar orientação');
      });
    }
  }, 50);

  // Renderizar overlay de rotação para mobile (só aparece em portrait)
  const rotateOverlayHtml = isMobileDevice ? `
    <div class="rotate-screen-overlay" id="rotate-overlay">
      <div class="rotate-screen-icon">📱↻</div>
      <h2 class="rotate-screen-title">Gire seu celular</h2>
      <p class="rotate-screen-text">Para jogar, coloque o celular no modo paisagem (deitado)</p>
    </div>
  ` : '';

  return `
    <style>
      /* ==================== HUD MELHORADO ==================== */
      .game-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        background: linear-gradient(180deg, rgba(20,20,30,0.95) 0%, rgba(15,15,25,0.9) 100%);
        border-radius: 16px;
        margin-bottom: 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        position: relative;
        overflow: hidden;
      }
      
      .game-header::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, var(--accent-blue), var(--accent-green), var(--accent-yellow));
      }
      
      .player-card {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.75rem 1rem;
        background: rgba(255,255,255,0.03);
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.05);
        transition: all 0.3s ease;
        min-width: 200px;
      }
      
      .player-card.active {
        background: rgba(0,255,136,0.1);
        border-color: var(--accent-green);
        box-shadow: 0 0 20px rgba(0,255,136,0.2);
      }
      
      .player-card.active .player-avatar {
        animation: pulse-glow 1.5s ease-in-out infinite;
      }
      
      @keyframes pulse-glow {
        0%, 100% { box-shadow: 0 0 10px rgba(0,255,136,0.4); }
        50% { box-shadow: 0 0 25px rgba(0,255,136,0.8); }
      }
      
      .player-avatar {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(145deg, #2a2a3a, #1a1a2a);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        border: 3px solid rgba(255,255,255,0.1);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: all 0.3s ease;
        overflow: hidden;
      }
      
      .player-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
      }
      
      .player-info-content {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      
      .player-name {
        font-size: 1rem;
        font-weight: 700;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 120px;
      }
      
      .player-type-badge {
        font-size: 0.7rem;
        padding: 0.2rem 0.5rem;
        border-radius: 20px;
        background: rgba(255,255,255,0.1);
        color: var(--text-muted);
        display: inline-block;
        width: fit-content;
      }
      
      .player-balls-row {
        margin-top: 0.5rem;
      }
      
      .center-info {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 0 1rem;
      }
      
      .vs-badge {
        font-size: 1.8rem;
        font-weight: 900;
        background: linear-gradient(135deg, #f8b500, #fceabb);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0 2px 10px rgba(248,181,0,0.3);
        letter-spacing: 2px;
      }
      
      .timer-display {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        background: rgba(0,0,0,0.3);
        border-radius: 25px;
        border: 1px solid rgba(255,255,255,0.1);
      }
      
      .timer-display.warning {
        background: rgba(255,68,68,0.2);
        border-color: rgba(255,68,68,0.5);
        animation: timer-pulse 0.5s ease-in-out infinite;
      }
      
      @keyframes timer-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      
      .timer-icon {
        font-size: 1.2rem;
      }
      
      .timer-value {
        font-size: 1.3rem;
        font-weight: 700;
        font-family: 'Courier New', monospace;
        min-width: 35px;
        text-align: center;
      }
      
      .mode-label {
        font-size: 0.75rem;
        color: var(--accent-yellow);
        text-transform: uppercase;
        letter-spacing: 1px;
        font-weight: 600;
      }
      
      .turn-indicator {
        font-size: 0.8rem;
        color: var(--text-muted);
        padding: 0.25rem 0.75rem;
        background: rgba(255,255,255,0.05);
        border-radius: 15px;
      }
      
      .session-score {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--accent-blue);
        padding: 0.25rem 0.75rem;
        background: rgba(0,136,255,0.1);
        border-radius: 15px;
      }
      
      /* Mensagens animadas */
      .game-message-container {
        position: relative;
        min-height: 60px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      
      .game-message {
        font-size: 1.1rem;
        font-weight: 600;
        text-align: center;
        transition: all 0.3s ease;
      }
      
      .animated-message {
        position: absolute;
        font-size: 1.5rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 2px;
        animation: message-pop 2s ease-out forwards;
        pointer-events: none;
        z-index: 100;
      }
      
      @keyframes message-pop {
        0% { transform: scale(0.5) translateY(20px); opacity: 0; }
        20% { transform: scale(1.2) translateY(0); opacity: 1; }
        40% { transform: scale(1) translateY(0); opacity: 1; }
        100% { transform: scale(0.8) translateY(-30px); opacity: 0; }
      }
      
      .message-nice-shot {
        color: #00ff88;
        text-shadow: 0 0 20px rgba(0,255,136,0.8);
      }
      
      .message-foul {
        color: #ff4444;
        text-shadow: 0 0 20px rgba(255,68,68,0.8);
      }
      
      .message-turn-change {
        color: #ffd700;
        text-shadow: 0 0 20px rgba(255,215,0,0.8);
      }
      
      .message-combo {
        color: #00bfff;
        text-shadow: 0 0 20px rgba(0,191,255,0.8);
      }
      
      /* Spectator badge */
      .spectator-badge {
        position: absolute;
        top: -35px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #ff0000, #cc0000);
        color: white;
        padding: 6px 16px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: bold;
        box-shadow: 0 0 20px rgba(255,0,0,0.5);
        animation: pulse 2s infinite;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      
      /* Music Player Mini */
      .music-player-mini {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(20,20,30,0.95);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        padding: 0.75rem 1rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        z-index: 1000;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        transition: all 0.3s ease;
      }
      
      .music-player-mini:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 25px rgba(0,0,0,0.5);
      }
      
      .music-player-mini.hidden {
        transform: translateX(120%);
        opacity: 0;
        pointer-events: none;
      }
      
      .music-player-mini.playing {
        border-color: var(--accent-green);
        box-shadow: 0 4px 20px rgba(0,200,100,0.3);
      }
      
      .music-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: none;
        background: var(--accent-green);
        color: white;
        font-size: 1rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      
      .music-btn:hover {
        transform: scale(1.1);
        background: var(--accent-blue);
      }
      
      .music-info {
        display: flex;
        flex-direction: column;
        max-width: 150px;
      }
      
      .music-title {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .music-artist {
        font-size: 0.7rem;
        color: var(--text-muted);
      }
      
      .music-volume {
        width: 60px;
        height: 4px;
        -webkit-appearance: none;
        background: rgba(255,255,255,0.2);
        border-radius: 2px;
        outline: none;
      }
      
      .music-volume::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--accent-green);
        cursor: pointer;
      }
      
      .game-over-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: radial-gradient(circle at center, rgba(20,20,30,0.95), rgba(0,0,0,0.98));
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
        backdrop-filter: blur(12px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.6s ease;
      }
      .game-over-overlay.active {
        opacity: 1;
        pointer-events: all;
      }
      .game-over-modal {
        background: linear-gradient(145deg, rgba(30,30,45,0.95), rgba(15,15,25,0.98));
        border: 2px solid rgba(255, 215, 0, 0.3);
        border-radius: 28px;
        padding: 2.5rem;
        text-align: center;
        max-width: 480px;
        width: 90%;
        box-shadow: 
          0 0 100px rgba(255,215,0,0.15),
          0 25px 50px rgba(0,0,0,0.5),
          inset 0 1px 0 rgba(255,255,255,0.1);
        transform: scale(0.8) translateY(40px);
        transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        position: relative;
        overflow: hidden;
      }
      .game-over-modal::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: conic-gradient(from 0deg, transparent, rgba(255,215,0,0.1), transparent, rgba(255,215,0,0.05), transparent);
        animation: rotate-glow 8s linear infinite;
        pointer-events: none;
      }
      @keyframes rotate-glow {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .game-over-overlay.active .game-over-modal {
        transform: scale(1) translateY(0);
      }
      .game-over-overlay.defeat .game-over-modal {
        border-color: rgba(255, 100, 100, 0.3);
        box-shadow: 0 0 60px rgba(255,100,100,0.1), 0 25px 50px rgba(0,0,0,0.5);
      }
      .winner-avatar-container {
        font-size: 5rem;
        margin-bottom: 0.5rem;
        animation: winner-bounce 1s ease-out, float 3s ease-in-out 1s infinite;
        filter: drop-shadow(0 0 25px rgba(255,215,0,0.5));
        position: relative;
        z-index: 1;
      }
      @keyframes winner-bounce {
        0% { transform: scale(0) rotate(-20deg); opacity: 0; }
        50% { transform: scale(1.3) rotate(10deg); }
        70% { transform: scale(0.9) rotate(-5deg); }
        100% { transform: scale(1) rotate(0deg); opacity: 1; }
      }
      @keyframes float { 
        0% { transform: translateY(0px); } 
        50% { transform: translateY(-12px); } 
        100% { transform: translateY(0px); } 
      }
      
      .winner-title {
        font-size: 2.8rem;
        margin: 0.5rem 0;
        background: linear-gradient(135deg, #ffd700, #ffec8b, #ffd700);
        background-size: 200% 200%;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 3px;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.5));
        animation: title-appear 0.8s ease-out 0.3s both, shimmer 3s ease-in-out infinite;
        position: relative;
        z-index: 1;
      }
      @keyframes title-appear {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes shimmer {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .game-over-overlay.defeat .winner-title {
        background: linear-gradient(135deg, #ff6b6b, #ffa8a8, #ff6b6b);
        background-size: 200% 200%;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .winner-message {
        color: rgba(255,255,255,0.8);
        font-size: 1.1rem;
        margin-bottom: 1.5rem;
        animation: fade-up 0.6s ease-out 0.5s both;
        position: relative;
        z-index: 1;
      }
      @keyframes fade-up {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      
      .stats-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.8rem;
        margin-bottom: 2rem;
        animation: fade-up 0.6s ease-out 0.7s both;
        position: relative;
        z-index: 1;
      }
      .stat-card {
        background: rgba(0,0,0,0.3);
        padding: 1rem;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.05);
        transition: transform 0.2s;
      }
      .stat-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.1); }
      .stat-label { font-size: 0.75rem; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
      .stat-value { font-size: 1.2rem; font-weight: bold; color: #fff; }

      .game-over-actions {
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
        animation: fade-up 0.6s ease-out 0.9s both;
        position: relative;
        z-index: 1;
      }
      .game-over-actions .btn {
        width: 100%;
        justify-content: center;
        padding: 1rem;
        font-size: 1rem;
        border-radius: 12px;
        font-weight: 600;
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
      }
      .game-over-actions .btn::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        transition: left 0.5s ease;
      }
      .game-over-actions .btn:hover::before {
        left: 100%;
      }
      .game-over-actions .btn-primary {
        background: linear-gradient(135deg, #00c853, #00e676);
        border: none;
        box-shadow: 0 4px 15px rgba(0, 200, 83, 0.3);
      }
      .game-over-actions .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 200, 83, 0.4);
      }
      .game-over-actions .btn-secondary {
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
      }
      .game-over-actions .btn-secondary:hover {
        background: rgba(255,255,255,0.15);
        transform: translateY(-2px);
      }
      
      /* Confetti Helper */
      .confetti {
        position: absolute;
        pointer-events: none;
      }
      @keyframes confetti-fall { 
        0% { 
          transform: translateY(0) translateX(0) rotate(0deg) scale(1); 
          opacity: 1;
        }
        100% { 
          transform: translateY(100vh) translateX(var(--drift, 0)) rotate(var(--rotation, 720deg)) scale(0.5); 
          opacity: 0;
        } 
      }
    </style>

    <div class="game-container ${isMobileDevice ? 'game-page-mobile' : ''}">
      ${rotateOverlayHtml}
      <div id="game-over-overlay" class="game-over-overlay hidden">
        <div id="confetti-container" style="position: absolute; top:0; left:0; width:100%; height:100%; pointer-events: none; overflow: hidden;"></div>
        <div class="game-over-modal">
          <div class="winner-avatar-container">👑</div>
          <h2 id="winner-title" class="winner-title">VENCEDOR!</h2>
          <p id="winner-message" class="winner-message">O jogo terminou.</p>
          
          <div class="stats-grid">
             <div class="stat-card">
               <div class="stat-label">Turnos</div>
               <div class="stat-value" id="stat-turns">-</div>
             </div>
             <div class="stat-card">
               <div class="stat-label">Tempo</div>
               <div class="stat-value" id="stat-time">-</div>
             </div>
          </div>

          <!-- Progresso de Nível -->
          <div id="level-progress-container" style="margin-bottom: 1.5rem; background: rgba(0,0,0,0.3); padding: 1.2rem; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05); position: relative; overflow: hidden;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 0.8rem;">
              <div style="text-align: left;">
                <div style="font-size: 0.7rem; color: #888; text-transform: uppercase; letter-spacing: 1px;">Sua Progressão</div>
                <div style="font-size: 1.4rem; font-weight: 900; color: #fff;">Nível <span id="current-level-display" style="background: linear-gradient(135deg, #fff, #aaa); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">1</span></div>
              </div>
              <div style="text-align: right;">
                <div id="xp-gained-display" style="font-size: 1rem; color: #00ff88; font-weight: 900; text-shadow: 0 0 10px rgba(0,255,136,0.3); transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); transform: translateY(10px); opacity: 0;">+0 XP</div>
              </div>
            </div>
            
            <div style="width: 100%; height: 12px; background: rgba(255,255,255,0.05); border-radius: 6px; padding: 2px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 0.5rem; position: relative;">
              <div id="xp-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #00c853, #b2ff59); border-radius: 4px; transition: width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1); box-shadow: 0 0 15px rgba(0,200,83,0.4);"></div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
               <span id="level-title-display" style="font-size: 0.75rem; font-weight: 600; color: #888; text-transform: uppercase;">Novato</span>
               <span id="xp-text-display" style="font-size: 0.8rem; font-weight: 700; color: #fff; font-family: 'Courier New', monospace;">0 / 100 XP</span>
            </div>
          </div>
          
          <!-- Review Section -->
          <div id="review-section" style="margin-bottom: 1.5rem; text-align: left; background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
            <p style="color: var(--text-primary); font-size: 0.9rem; margin-bottom: 0.5rem; text-align: center;">O que achou da partida?</p>
            <div id="star-rating" style="display: flex; gap: 0.5rem; justify-content: center; margin-bottom: 0.8rem;">
              <span class="star-btn" data-rating="1" style="font-size: 1.8rem; cursor: pointer; color: #555; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">⭐</span>
              <span class="star-btn" data-rating="2" style="font-size: 1.8rem; cursor: pointer; color: #555; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">⭐</span>
              <span class="star-btn" data-rating="3" style="font-size: 1.8rem; cursor: pointer; color: #555; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">⭐</span>
              <span class="star-btn" data-rating="4" style="font-size: 1.8rem; cursor: pointer; color: #555; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">⭐</span>
              <span class="star-btn" data-rating="5" style="font-size: 1.8rem; cursor: pointer; color: #555; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">⭐</span>
            </div>
            <textarea id="review-comment" placeholder="Comentário (opcional)..." style="width: 100%; height: 60px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.5rem; color: #fff; font-size: 0.9rem; resize: none; margin-bottom: 0.5rem;"></textarea>
            <button id="submit-review-btn" class="btn btn-primary btn-sm w-full" disabled>Enviar Avaliação</button>
          </div>
          <div id="review-success" style="display: none; margin-bottom: 1.5rem; background: rgba(0, 255, 136, 0.1); color: var(--accent-green); padding: 1rem; border-radius: 12px; font-weight: bold;">
            ✅ Avaliação enviada! Obrigado.
          </div>

          <div class="game-over-actions">
             <button class="btn btn-primary" id="play-again-btn">🔄 Jogar Novamente</button>
             <button class="btn btn-secondary" id="exit-room-btn">🚪 Sair da Sala</button>
          </div>
          <p id="credit-warning" style="display:none; color: #ff4444; font-size: 0.9rem; margin-top: 15px; background: rgba(255,0,0,0.1); padding: 0.5rem; border-radius: 6px;">
            ⚠️ Saldo insuficiente para nova partida.
          </p>
        </div>
      </div>
    
      <div class="game-header">
        ${roomData.isSpectator ? '<div class="spectator-badge">👁️ ESPECTADOR</div>' : ''}
        
        <!-- Player 1 Card -->
        <div class="player-card ${gameState.currentPlayer === 1 ? 'active' : ''}" id="player1-info">
          <div class="player-avatar" id="player1-avatar">
            ${roomData.owner?.avatar_url ? `<img src="${roomData.owner.avatar_url}" alt="${player1Name}">` : '🎱'}
          </div>
          <div class="player-info-content">
            <div class="player-name">${player1Name}</div>
            <div class="player-type-badge" id="player1-type">${getTypeLabel(gameState.player1Type)}</div>
            <div class="player-balls-row" id="player1-balls">${renderPlayerBalls(gameState.player1Balls, gameState.balls)}</div>
          </div>
        </div>
        
        <!-- Center Info -->
        <div class="center-info">
          <div class="mode-label">${modeLabel}</div>
          
          <!-- Cronômetro da Partida (30 min máx) -->
          <div class="match-timer-display" id="match-timer-container" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.8rem; background: rgba(0,136,255,0.15); border-radius: 20px; border: 1px solid rgba(0,136,255,0.3); margin-bottom: 0.25rem;">
            <span style="font-size: 0.9rem;">⏰</span>
            <span id="match-timer" style="font-size: 1rem; font-weight: 700; font-family: 'Courier New', monospace; color: var(--accent-blue);">30:00</span>
          </div>
          
          <!-- Timer de Turno -->
          <div class="timer-display ${gameState.turnTimer <= 10 ? 'warning' : ''}" id="timer-container">
            <span class="timer-icon">⏱️</span>
            <span class="timer-value" id="game-timer">${gameState.turnTimer}</span>
            <span style="font-size: 0.8rem; color: var(--text-muted);">s</span>
          </div>
          <div class="vs-badge">VS</div>
          ${isAI ? `<div class="session-score" id="session-score">Você ${sessionScore.p1} x ${sessionScore.p2} CPU</div>` : ''}
          <div class="turn-indicator" id="turn-info">Turno ${gameState.turn}</div>
        </div>
        
        <!-- Player 2 Card -->
        <div class="player-card ${gameState.currentPlayer === 2 ? 'active' : ''}" id="player2-info">
          <div class="player-avatar" id="player2-avatar">
            ${isAI ? '🤖' : (roomData.guest?.avatar_url ? `<img src="${roomData.guest.avatar_url}" alt="${player2Name}">` : '🎯')}
          </div>
          <div class="player-info-content">
            <div class="player-name">${player2Name}</div>
            <div class="player-type-badge" id="player2-type">${getTypeLabel(gameState.player2Type)}</div>
            <div class="player-balls-row" id="player2-balls">${renderPlayerBalls(gameState.player2Balls, gameState.balls)}</div>
          </div>
        </div>
      </div>

      <div class="game-table">
        <canvas id="pool-canvas" width="${TABLE_WIDTH + CANVAS_PADDING}" height="${TABLE_HEIGHT + CANVAS_PADDING}"></canvas>
        <audio id="remote-voice" autoplay style="display:none;"></audio>
        
        <!-- HUD Mobile - Só aparece em dispositivos mobile em landscape -->
        ${isMobileDevice ? `
          <div class="game-hud-mobile mobile-only" id="mobile-hud">
            <!-- Jogador 1 (Esquerda) -->
            <div class="hud-player-left">
              <div class="hud-player-avatar ${gameState.currentPlayer === 1 ? 'active' : ''}" id="hud-p1-avatar"
                   style="background-image: url('${roomData.owner?.avatar_url || ''}')">
                ${!roomData.owner?.avatar_url ? '🎱' : ''}
              </div>
              <div class="hud-player-info">
                <div class="hud-player-name" id="hud-p1-name">${player1Name}</div>
                <div class="hud-player-balls" id="hud-p1-balls">
                  <!-- Bolas serão atualizadas via JS -->
                </div>
              </div>
            </div>
            
            <!-- Jogador 2 (Direita) -->
            <div class="hud-player-right">
              <div class="hud-player-avatar ${gameState.currentPlayer === 2 ? 'active' : ''}" id="hud-p2-avatar"
                   style="background-image: url('${roomData.guest?.avatar_url || ''}')">
                ${!roomData.guest?.avatar_url ? (isAI ? '🤖' : '🎱') : ''}
              </div>
              <div class="hud-player-info">
                <div class="hud-player-name" id="hud-p2-name">${player2Name}</div>
                <div class="hud-player-balls" id="hud-p2-balls">
                  <!-- Bolas serão atualizadas via JS -->
                </div>
              </div>
            </div>
          </div>
          
          <!-- Barra de Controles Mobile (Inferior) -->
          <div class="game-controls-bar mobile-only" id="mobile-controls">
            <!-- Botões de Menu (Esquerda) -->
            <div class="game-menu-buttons">
              <button class="game-btn-icon" id="mobile-pause-btn" title="Pausar">⏸️</button>
              <button class="game-btn-icon" id="mobile-sound-btn" title="Som">🔊</button>
            </div>
            
            <!-- Info Central -->
            <div class="game-turn-info">
              <div class="game-turn-label">Turno</div>
              <div class="game-turn-text" id="mobile-turn-text">${gameState.currentPlayer === 1 ? player1Name : player2Name}</div>
            </div>
            
            <!-- Controles de Tacada (Direita) -->
            <div class="game-shot-controls">
              <div class="power-slider-mobile" id="mobile-power-slider">
                <div class="power-slider-fill-mobile" id="mobile-power-fill" style="width: 0%;"></div>
              </div>
              <button class="game-shoot-btn-mobile" id="mobile-shoot-btn" title="Tacada">🎱</button>
            </div>
          </div>
          
          <!-- Menu de Pausa Mobile -->
          <div class="game-pause-overlay hidden" id="mobile-pause-menu">
            <h2 class="game-pause-title">⏸️ Jogo Pausado</h2>
            <button class="game-pause-btn game-pause-btn-primary" id="mobile-resume-btn">▶️ Continuar</button>
            <button class="game-pause-btn game-pause-btn-secondary" id="mobile-settings-btn">⚙️ Configurações</button>
            <button class="game-pause-btn game-pause-btn-danger" id="mobile-quit-btn">🚪 Abandonar</button>
          </div>
        ` : ''}
      </div>

      <div class="game-controls desktop-only">
        <div class="game-message-container">
          <p class="game-message" id="game-message">🎯 ${gameState.currentPlayer === 1 ? player1Name : player2Name}, sua vez!</p>
          <div id="animated-message-container"></div>
        </div>
        
        <!-- Legenda de bolas do jogador atual -->
        <div class="ball-legend" id="ball-legend" style="display: flex; justify-content: center; gap: 1.5rem; margin: 0.75rem 0; padding: 0.5rem 1rem; background: rgba(0,0,0,0.3); border-radius: 8px; flex-wrap: wrap;">
          <div class="legend-item" id="my-balls-legend" style="display: flex; align-items: center; gap: 0.5rem;">
            <div style="width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(0, 255, 100, 0.8); box-shadow: 0 0 6px rgba(0, 255, 100, 0.5);"></div>
            <span style="font-size: 0.8rem; color: var(--accent-green);" id="my-balls-label">Suas bolas</span>
          </div>
          <div class="legend-item" style="display: flex; align-items: center; gap: 0.5rem;">
            <div style="width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255, 80, 80, 0.5);"></div>
            <span style="font-size: 0.8rem; color: rgba(255, 80, 80, 0.8);" id="opponent-balls-label">Oponente</span>
          </div>
          <div class="legend-item" style="display: flex; align-items: center; gap: 0.5rem;">
            <div style="width: 14px; height: 14px; border-radius: 50%; background: #000; border: 2px solid #333;"></div>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Bola 8</span>
          </div>
          <div class="legend-item" id="aim-mode-indicator" style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 0.8rem; color: var(--text-muted);">${aimLineEnabled ? '🎯 Mira: ON' : '🚫 Mira: OFF'}</span>
          </div>
        </div>
        
        <p class="game-instructions" id="game-instructions">📱 Toque na bola branca e arraste para trás para mirar. Solte para dar a tacada. 🖱️ No PC: clique e arraste.</p>
        <div style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" id="reset-game-btn">🔄 Reiniciar</button>
          <button class="btn btn-ghost btn-sm" id="toggle-sound-btn">🔊 Som</button>
          <button class="btn btn-ghost btn-sm" id="toggle-music-btn" style="color: var(--accent-yellow);">🎵 Música</button>
          ${isMultiplayer ? `
            <button class="btn btn-ghost btn-sm" id="toggle-voice-btn" style="color: var(--text-muted); user-select: none;">🎙️ Segure p/ Falar</button>
            <div id="voice-indicator" style="font-size: 0.75rem; min-width: 120px; text-align: center;"></div>
          ` : ''}
          <button class="btn btn-danger btn-sm" id="leave-game-btn">🚪 Abandonar</button>
        </div>
      </div>
      
      <!-- Music Player Mini -->
      <div class="music-player-mini hidden" id="music-player">
        <button class="music-btn" id="music-play-btn">▶️</button>
        <div class="music-info">
          <span class="music-title" id="music-title">Nenhuma música</span>
          <span class="music-artist" id="music-artist">-</span>
        </div>
        <input type="range" class="music-volume" id="music-volume" min="0" max="100" value="50">
        <button class="music-btn" id="music-next-btn" style="background: rgba(255,255,255,0.1);">⏭️</button>
      </div>
    </div>
  `;
}

// Renderiza as bolas do jogador em linha horizontal organizada
// Mostra apenas as bolas que ainda NÃO foram encaçapadas
function renderPlayerBalls(playerBalls: number[], allBalls: Ball[]): string {
  if (playerBalls.length === 0) return '<span style="color: var(--text-muted); font-size: 0.75rem;">Aguardando...</span>';

  // Filtrar apenas bolas que ainda estão na mesa (não encaçapadas)
  const activeBalls = playerBalls.filter(num => {
    const ball = allBalls.find(b => Number(b.number) === num);
    if (!ball) {
      console.warn(`[renderPlayerBalls] Bola ${num} não encontrada no array de bolas!`);
      return false;
    }
    return !ball.pocketed;
  });

  // Debug: Log detalhado do estado das bolas
  console.log('[renderPlayerBalls] Estado das bolas:', {
    playerBalls,
    activeBalls,
    allBallsStatus: playerBalls.map(num => {
      const ball = allBalls.find(b => Number(b.number) === num);
      return { num, found: !!ball, pocketed: ball?.pocketed };
    })
  });

  if (activeBalls.length === 0) {
    return '<span style="color: var(--accent-green); font-size: 0.75rem;">✓ Todas encaçapadas!</span>';
  }

  // Ordenar para ficar organizado (1,2,3... ou 9,10,11...)
  const sorted = [...activeBalls].sort((a, b) => a - b);

  const ballsHtml = sorted.map(num => {
    const ball = allBalls.find(b => Number(b.number) === num);
    if (!ball) return '';

    const color = ball.color || '#888';
    const isStripe = ball.type === 'stripe';

    // Estilo base da bola
    const baseSize = 28;
    const textColor = ['#F7D000', '#ffffff'].includes(color) ? '#000' : '#fff';

    // Bola ativa: com gradiente 3D e número
    const stripeStyle = isStripe ? `
      background: radial-gradient(circle at 30% 30%, #fff 0%, #fff 35%, ${color} 35%, ${color} 65%, #fff 65%);
    ` : `
      background: radial-gradient(circle at 30% 30%, ${color}ee, ${color} 50%, ${color}aa 100%);
    `;

    return `
      <div class="ball-item active" style="
        width: ${baseSize}px; 
        height: ${baseSize}px; 
        border-radius: 50%; 
        ${stripeStyle}
        box-shadow: 
          0 2px 4px rgba(0,0,0,0.4),
          inset 0 -2px 4px rgba(0,0,0,0.2),
          inset 0 2px 4px rgba(255,255,255,0.3);
        display: inline-flex; 
        justify-content: center; 
        align-items: center;
        font-size: 11px;
        font-weight: bold;
        color: ${textColor};
        margin: 0 3px;
        transition: transform 0.2s, box-shadow 0.2s;
        cursor: default;
      " title="Bola ${num}">
        ${num}
      </div>
    `;
  }).join('');

  return `<div style="display: flex; align-items: center; gap: 2px; flex-wrap: nowrap;">${ballsHtml}</div>`;
}

function getTypeLabel(type: string | null): string {
  if (!type) return '❓ Aguardando...';
  const labels: Record<string, string> = {
    red: '🔴 Vermelhas', blue: '🔵 Azuis',
    solid: '🟡 Lisas (1-7)', stripe: '🟣 Listradas (9-15)',
    odd: '🟡 Ímpares', even: '🔵 Pares' // Manter compatibilidade se precisar
  };
  return labels[type] || '❓';
}

// Determina se o jogador local é player 1 ou player 2
function isLocalPlayerOne(): boolean {
  // Em modo IA, você é sempre player 1
  if (gameState.isAI) return true;

  // Em multiplayer, verificar pelo myPlayerId
  if (gameState.isMultiplayer && gameState.myPlayerId) {
    const isOwner = roomData?.owner_id === gameState.myPlayerId ||
      roomData?.owner?.id === gameState.myPlayerId;
    return isOwner;
  }

  // Default: player 1
  return true;
}

// Retorna o tipo de bola do jogador LOCAL
function getMyBallType(): typeof gameState.player1Type {
  return isLocalPlayerOne() ? gameState.player1Type : gameState.player2Type;
}

// Retorna as bolas do jogador LOCAL
function getMyBalls(): number[] {
  return isLocalPlayerOne() ? gameState.player1Balls : gameState.player2Balls;
}

// Retorna as bolas do OPONENTE
function getOpponentBalls(): number[] {
  return isLocalPlayerOne() ? gameState.player2Balls : gameState.player1Balls;
}


// ==================== INICIALIZAÇÃO DO JOGO ====================

function initGame(app: any, room: any) {
  canvas = document.getElementById('pool-canvas') as HTMLCanvasElement;
  if (!canvas) return;

  renderer = new PoolRenderer(canvas);

  console.log('[GamePage] Inicializando jogo com física avançada');

  // Iniciar áudio
  audioEngine.resume();
  audioEngine.startAmbient();

  // Event listeners para mouse
  if (!gameState.isSpectator) {
    canvas.addEventListener('mousedown', (e) => {
      handleMouseDown(e);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp, { once: true });
    });

    // Touch support (mobile)
    // Touch support (mobile) - Mantendo no canvas mas com lógica melhorada
    canvas.addEventListener('touchstart', (e) => {
      handleTouchStart(e);
      const moveHandler = (evt: TouchEvent) => handleTouchMove(evt);
      const endHandler = (evt: TouchEvent) => {
        handleTouchEnd(evt);
        window.removeEventListener('touchmove', moveHandler);
        window.removeEventListener('touchend', endHandler);
      };
      window.addEventListener('touchmove', moveHandler, { passive: false });
      window.addEventListener('touchend', endHandler, { passive: false });
    }, { passive: false });

    // Botão de reiniciar (Só para jogadores)
    document.getElementById('reset-game-btn')?.addEventListener('click', () => {
      if (timerInterval) clearInterval(timerInterval);
      gameState = initGameState(gameState.gameMode);
      gameState.isAI = room.mode === 'ai';
      gameState.isMultiplayer = room.isMultiplayer || false;
      firstBallHit = null;
      startTurnTimer(room);
      updateUI(room);
    });
  } else {
    // Esconder controles de jogador
    const resetBtn = document.getElementById('reset-game-btn');
    if (resetBtn) resetBtn.style.display = 'none';

    // Auto-join no canal de visualização se necessário
    if (gameState.isMultiplayer && room.id) {
      api.viewLive(room.id).catch(err => console.error('Erro ao registrar visualização', err));
    }
  }

  document.getElementById('toggle-sound-btn')?.addEventListener('click', () => {
    const settings = audioEngine.getSettings();
    audioEngine.setEnabled(!settings.enabled);
    const btn = document.getElementById('toggle-sound-btn');
    if (btn) btn.textContent = settings.enabled ? '🔇 Mudo' : '🔊 Som';
  });

  // ==================== PUSH-TO-TALK ====================
  // Segura o botão para falar, solta para parar
  const voiceBtn = document.getElementById('toggle-voice-btn');
  if (voiceBtn) {
    // Função para iniciar fala (unmute)
    const startTalking = (e: Event) => {
      e.preventDefault();
      if (voiceChatService.isMicMuted()) {
        voiceChatService.toggleMute(); // Unmute
        voiceBtn.textContent = '🎤 Falando...';
        voiceBtn.style.color = 'var(--accent-green)';
        voiceBtn.style.background = 'rgba(0,255,136,0.2)';
      }
    };

    // Função para parar de falar (mute)
    const stopTalking = (e: Event) => {
      e.preventDefault();
      if (!voiceChatService.isMicMuted()) {
        voiceChatService.toggleMute(); // Mute
        voiceBtn.textContent = '🎙️ Segure p/ Falar';
        voiceBtn.style.color = 'var(--text-muted)';
        voiceBtn.style.background = '';
      }
    };

    // Mouse events
    voiceBtn.addEventListener('mousedown', startTalking);
    voiceBtn.addEventListener('mouseup', stopTalking);
    voiceBtn.addEventListener('mouseleave', stopTalking);

    // Touch events (mobile)
    voiceBtn.addEventListener('touchstart', startTalking);
    voiceBtn.addEventListener('touchend', stopTalking);
    voiceBtn.addEventListener('touchcancel', stopTalking);

    // Iniciar mutado (push-to-talk)
    if (!voiceChatService.isMicMuted()) {
      voiceChatService.toggleMute();
    }
    voiceBtn.textContent = '🎙️ Segure p/ Falar';
    voiceBtn.style.color = 'var(--text-muted)';
  }

  document.getElementById('leave-game-btn')?.addEventListener('click', async () => {
    // Confirmar abandono
    const confirmMessage = gameState.isMultiplayer && roomData?.mode === 'bet'
      ? '⚠️ Você perderá a aposta se abandonar! Tem certeza?'
      : 'Tem certeza que deseja abandonar a partida?';

    if (!confirm(confirmMessage)) return;

    // Se for multiplayer, processar forfeit
    if (gameState.isMultiplayer && roomData?.id) {
      try {
        const state = gameStore.getState();
        const myId = state.user?.id;

        // Chamar API de forfeit
        const result = await api.forfeitRoom(roomData.id);

        if (result.data?.success) {
          // Enviar evento GAME_OVER para o oponente
          await realtimeService.sendGameOver({
            matchId: roomData.match_id || roomData.id,
            winnerId: result.data.winnerId || '',
            winnerUsername: result.data.winnerUsername || 'Oponente',
            loserId: result.data.loserId || myId || '',
            loserUsername: state.user?.username || 'Jogador',
            player1Score: gameState.player1Score,
            player2Score: gameState.player2Score,
            reason: 'forfeit',
          });

          // Enviar evento PLAYER_LEFT para o oponente saber que saímos
          await realtimeService.broadcastPlayerLeft(myId || '');

          console.log('[GamePage] Forfeit processado:', result.data);
        }
      } catch (err) {
        console.error('[GamePage] Erro ao processar forfeit:', err);
      }
    }

    // Limpar estado e voltar ao lobby
    if (timerInterval) clearInterval(timerInterval);
    if (animationId) cancelAnimationFrame(animationId);

    // Marcar jogo como finalizado
    gameState.gameOver = true;

    // Parar áudio
    audioEngine.stopAmbient();
    musicPlayer.stop();
    voiceChatService.stop();

    // Sair da sala
    realtimeService.leaveRoom();

    // Limpar estado salvo
    sessionScore = { p1: 0, p2: 0 };
    localStorage.removeItem('sinuca_save_v1');

    // Resetar variáveis globais
    gameState = null as any;
    roomData = null;
    canvas = null;
    renderer = null;

    app.navigate('lobby');
  });

  // Configurar realtime para multiplayer
  if (gameState.isMultiplayer && room.id) {
    setupMultiplayerEvents(room);
    const state = gameStore.getState();
    if (!realtimeService.isConnected()) {
      realtimeService.joinRoom(room.id, state.user?.id || '');
    }
  }

  // Listeners do Modal de Game Over
  const playAgainBtn = document.getElementById('play-again-btn');
  const exitRoomBtn = document.getElementById('exit-room-btn');
  const overlay = document.getElementById('game-over-overlay');

  if (playAgainBtn) {
    playAgainBtn.addEventListener('click', async () => {
      // Verificar saldo se for contra IA
      if (gameState.isAI) {
        const state = gameStore.getState() as any;
        const credits = state.credits;

        // Se crédito for 0 e não for ilimitado (assumindo que 1 crédito custa 1 partida)
        // Nota: A lógica exata de custo deve vir do backend, mas aqui prevenimos o loop se tiver zerado
        if (credits <= 0 && !state.unlimitedCredits) {
          const warning = document.getElementById('credit-warning');
          if (warning) {
            warning.style.display = 'block';
            warning.textContent = '❌ Saldo insuficiente! Compre mais créditos.';
          }
          return;
        }

        // Tentar debitar e reiniciar
        playAgainBtn.setAttribute('disabled', 'true');
        playAgainBtn.textContent = 'Verificando saldo...';

        try {
          await debitAICredit(); // Tenta debitar
          // Se chegou aqui, sucesso (se falhar o debitAICredit lança erro ou não atualiza credits?)
          // O ideal seria debitAICredit retornar true/false. Assumindo que ele joga erro se falhar.

          if (timerInterval) clearInterval(timerInterval);
          gameState = initGameState(gameState.gameMode);
          gameState.isAI = true;
          gameState.isMultiplayer = false;
          gameState.gameOver = false;
          firstBallHit = null;

          if (overlay) {
            overlay.classList.remove('active');
            overlay.classList.add('hidden');
          }
          startTurnTimer(room);
          updateUI(room);

          // Resetar botão
          playAgainBtn.removeAttribute('disabled');
          playAgainBtn.textContent = '🔄 Jogar Novamente';

        } catch (error) {
          console.error("Erro ao reiniciar jogo:", error);
          const warning = document.getElementById('credit-warning');
          if (warning) {
            warning.style.display = 'block';
            warning.textContent = 'Erro ao processar pagamento. Tente novamente.';
          }
          playAgainBtn.removeAttribute('disabled');
          playAgainBtn.textContent = '🔄 Jogar Novamente';
        }

      } else {
        // Multiplayer ou Treino (sem custo por enquanto)
        // Em multiplayer real, ambos teriam que aceitar o rematch.
        if (gameState.isMultiplayer) {
          alert("Rematch em multiplayer não implementado ainda.");
          return;
        }

        if (timerInterval) clearInterval(timerInterval);
        gameState = initGameState(gameState.gameMode);
        gameState.gameOver = false;
        firstBallHit = null;
        if (overlay) {
          overlay.classList.remove('active');
          overlay.classList.add('hidden');
        }
        startTurnTimer(room);
        updateUI(room);
      }
    });
  }

  if (exitRoomBtn) {
    exitRoomBtn.addEventListener('click', () => {
      // Limpar tudo ao sair
      if (animationId) cancelAnimationFrame(animationId);
      if (timerInterval) clearInterval(timerInterval);

      // Resetar estado do jogo
      gameState.gameOver = true; // Marcar como finalizado

      // Limpar estado salvo
      localStorage.removeItem('sinuca_save_v1');

      // Parar áudio
      audioEngine.stopAmbient();
      musicPlayer.stop();

      // Sair da sala multiplayer
      realtimeService.leaveRoom();

      // Resetar variáveis globais
      gameState = null as any;
      roomData = null;
      canvas = null;
      renderer = null;

      // Navegar para o lobby
      app.navigate('lobby');
    });
  }

  // --- Review Logic ---
  let selectedRating = 0;
  const stars = document.querySelectorAll('.star-btn');
  const commentInput = document.getElementById('review-comment') as HTMLTextAreaElement;
  const submitBtn = document.getElementById('submit-review-btn') as HTMLButtonElement;
  const reviewSection = document.getElementById('review-section');
  const reviewSuccess = document.getElementById('review-success');

  stars.forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.getAttribute('data-rating') || '0');
      updateStars(selectedRating);
      if (submitBtn) submitBtn.disabled = false;
    });
  });

  function updateStars(rating: number) {
    stars.forEach((s: any) => {
      const r = parseInt(s.getAttribute('data-rating') || '0');
      s.style.color = r <= rating ? 'gold' : '#555';
      s.style.transform = r <= rating ? 'scale(1.2)' : 'scale(1)';
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      if (selectedRating === 0) return;
      submitBtn.textContent = 'Enviando...';
      submitBtn.disabled = true;

      try {
        const state = gameStore.getState();
        await api.createReview({
          userId: state.user?.id,
          username: state.user?.username,
          game: 'sinuca',
          rating: selectedRating,
          comment: commentInput.value
        });

        if (reviewSection) reviewSection.style.display = 'none';
        if (reviewSuccess) reviewSuccess.style.display = 'block';
      } catch (err) {
        console.error('Error submitting review:', err);
        submitBtn.textContent = 'Erro. Tente novamente.';
        submitBtn.disabled = false;
      }
    });
  }

  if (gameState.isMultiplayer) {
    setupMultiplayerEvents(room);
  }

  // ==================== MUSIC PLAYER SETUP ====================
  initMusicPlayer();

  // Atualizar HUD inicial
  updateBallsDisplay();
  updateUI(room);

  // ==================== RESTAURAR TELA DE VITÓRIA SE JOGO ACABOU ====================
  // Se o jogo foi restaurado e já estava em gameOver, mostrar a tela de vitória novamente
  if (gameState.gameOver && gameState.winner) {
    console.log('[GamePage] Jogo restaurado em estado de Game Over, mostrando tela de vitória');
    setTimeout(() => {
      showVictoryMessage(gameState.winner || 'Vencedor');
    }, 500);
  }

  // Iniciar cronômetro da partida (30 minutos máximo)
  startMatchTimer(room);

  startTurnTimer(room);
  gameLoop(room);
}

// ==================== MUSIC PLAYER INITIALIZATION ====================

async function initMusicPlayer() {
  try {
    // Carregar playlist
    await musicPlayer.loadPlaylist();
    await musicPlayer.loadPreferences();

    const playlist = musicPlayer.getPlaylist();
    const musicPlayerEl = document.getElementById('music-player');
    const musicBtn = document.getElementById('toggle-music-btn');
    const playBtn = document.getElementById('music-play-btn');
    const nextBtn = document.getElementById('music-next-btn');
    const volumeSlider = document.getElementById('music-volume') as HTMLInputElement;
    const titleEl = document.getElementById('music-title');
    const artistEl = document.getElementById('music-artist');

    // Se há músicas na playlist, mostrar o player
    if (playlist.length > 0 && musicPlayerEl) {
      musicPlayerEl.classList.remove('hidden');
      console.log(`[MusicPlayer] ${playlist.length} músicas disponíveis`);
    }

    // Configurar volume inicial
    if (volumeSlider) {
      volumeSlider.value = String(musicPlayer.getVolume());
    }

    // Callback para mudança de track
    musicPlayer.onTrackChange((track) => {
      if (titleEl) titleEl.textContent = track?.title || 'Nenhuma música';
      if (artistEl) artistEl.textContent = track?.artist || '-';
    });

    // Callback para mudança de estado de reprodução
    musicPlayer.onPlayStateChange((isPlaying) => {
      if (playBtn) playBtn.textContent = isPlaying ? '⏸️' : '▶️';
      if (musicBtn) {
        musicBtn.style.color = isPlaying ? 'var(--accent-green)' : 'var(--accent-yellow)';
      }
      if (musicPlayerEl) {
        if (isPlaying) {
          musicPlayerEl.classList.add('playing');
        } else {
          musicPlayerEl.classList.remove('playing');
        }
      }
    });

    // Botão toggle música (mostra/esconde player)
    musicBtn?.addEventListener('click', () => {
      if (!musicPlayerEl) return;

      if (playlist.length === 0) {
        alert('Nenhuma música na playlist. Configure músicas no painel admin.');
        return;
      }

      const isHidden = musicPlayerEl.classList.contains('hidden');
      if (isHidden) {
        musicPlayerEl.classList.remove('hidden');
        // Auto-play se não estiver tocando
        if (!musicPlayer.getIsPlaying()) {
          musicPlayer.play();
        }
      } else {
        musicPlayerEl.classList.add('hidden');
      }
    });

    // Botão play/pause
    playBtn?.addEventListener('click', () => {
      if (musicPlayer.getIsPlaying()) {
        musicPlayer.pause();
      } else {
        musicPlayer.play();
      }
    });

    // Botão próxima música
    nextBtn?.addEventListener('click', () => {
      musicPlayer.next();
    });

    // Controle de volume
    volumeSlider?.addEventListener('input', (e) => {
      const volume = parseInt((e.target as HTMLInputElement).value);
      musicPlayer.setVolume(volume);
    });

  } catch (err) {
    console.error('[MusicPlayer] Erro ao inicializar:', err);
  }
}

// ... (Rest of code)

// ==================== EVENTOS MULTIPLAYER ====================

function setupMultiplayerEvents(room: any) {
  // --- Voice Chat Integration ---
  const myId = gameStore.getState().user?.id || 'anon';
  const roomId = room.id || 'unknown';
  // Check both ID and object structure variations
  const isOwner = room.owner_id === myId || room.owner?.id === myId;

  voiceChatService.start(myId, roomId, isOwner).then(() => {
    console.log('[GamePage] Voice Chat Started');

    // Configurar callback para mudanças de estado
    voiceChatService.onStateChange((state) => {
      const btn = document.getElementById('toggle-voice-btn');
      const voiceIndicator = document.getElementById('voice-indicator');

      if (btn) {
        if (state.connectionState === 'connected') {
          // Push-to-talk: não alterar texto do botão aqui, apenas cor de status
          if (!state.isMuted) {
            // Está falando
            btn.style.color = 'var(--accent-green)';
            btn.style.background = 'rgba(0,255,136,0.2)';
          } else {
            // Não está falando (mutado)
            btn.style.color = 'var(--text-muted)';
            btn.style.background = '';
          }
        } else if (state.connectionState === 'connecting') {
          btn.textContent = '⏳ Conectando...';
          btn.style.color = 'var(--accent-yellow)';
        } else if (state.connectionState === 'failed') {
          btn.textContent = '❌ Sem Voz';
          btn.style.color = '#ff4444';
        }
      }

      // Indicador visual de quem está falando
      if (voiceIndicator) {
        if (state.isSpeaking) {
          voiceIndicator.innerHTML = '🎤 Você está falando';
          voiceIndicator.style.color = 'var(--accent-green)';
        } else if (state.isRemoteSpeaking) {
          voiceIndicator.innerHTML = '🔊 Oponente falando';
          voiceIndicator.style.color = 'var(--accent-blue)';
        } else {
          voiceIndicator.innerHTML = '';
        }
      }

      // ==================== MUSIC DUCKING ====================
      // Quando alguém está falando, baixa o volume da música
      if (state.isSpeaking || state.isRemoteSpeaking) {
        musicPlayer.duckVolume();
      } else {
        musicPlayer.restoreVolume();
      }
    });

    // Iniciar mutado para push-to-talk
    if (!voiceChatService.isMicMuted()) {
      voiceChatService.toggleMute();
    }

    const btn = document.getElementById('toggle-voice-btn');
    if (btn) {
      btn.textContent = '🎙️ Segure p/ Falar';
      btn.style.color = 'var(--text-muted)';
    }
  }).catch(err => {
    console.error('[GamePage] Voice Chat Init Error:', err);
    const btn = document.getElementById('toggle-voice-btn');
    if (btn) {
      btn.textContent = '❌ Sem Voz';
      btn.style.color = '#ff4444';
      btn.setAttribute('title', err.message || 'Microfone não detectado ou permissão negada');
    }
  });

  // Re-offer logic when new player connects
  realtimeService.on(ROOM_EVENTS.PLAYER_JOINED, (payload: any) => {
    if (isOwner) {
      console.log('[GamePage] Player Joined -> Sending Voice Offer');
      voiceChatService.createOffer();
    }
  });

  // Detectar quando oponente sai da sala (abandono)
  realtimeService.on(ROOM_EVENTS.PLAYER_LEFT, (payload: any) => {
    console.log('[GamePage] PLAYER_LEFT recebido:', payload);

    // Se o jogo não acabou e o oponente saiu, é abandono
    if (!gameState.gameOver && payload.playerId !== myId) {
      const state = gameStore.getState();
      gameState.gameOver = true;
      gameState.winner = state.user?.username || 'Você';

      // Mostrar tela de vitória por abandono
      showVictoryMessage(
        state.user?.username || 'Você',
        '🎉 Seu oponente abandonou a partida! Você venceu!',
        'forfeit'
      );

      // Parar timer
      if (timerInterval) clearInterval(timerInterval);

      updateUI(room);
    }
  });

  realtimeService.on(GAME_EVENTS.SHOT_MADE, (payload: ShotPayload) => {
    if (payload.playerId === gameState.myPlayerId) return;

    const cueBall = gameState.balls.find(b => b.type === 'cue' && !b.pocketed);
    if (cueBall) {
      applyCueShot(cueBall as unknown as PhysicsBall, payload.directionX, payload.directionY, payload.power);
      audioEngine.playCueHit(payload.power);
    }
  });

  realtimeService.on(GAME_EVENTS.BALLS_UPDATE, (payload: BallsUpdatePayload) => {
    let hadPocketChange = false;
    payload.balls.forEach((remoteBall: BallState) => {
      const localBall = gameState.balls.find(b => b.id === remoteBall.id);
      if (localBall) {
        // Detectar se houve mudança no estado pocketed
        if (localBall.pocketed !== remoteBall.pocketed) {
          hadPocketChange = true;
        }
        localBall.x = remoteBall.x;
        localBall.y = remoteBall.y;
        localBall.vx = remoteBall.vx;
        localBall.vy = remoteBall.vy;
        localBall.pocketed = remoteBall.pocketed;
      }
    });

    // Atualizar HUD se houve mudança no estado das bolas encaçapadas
    if (hadPocketChange) {
      updateBallsDisplay();
    }
  });

  realtimeService.on(GAME_EVENTS.TURN_CHANGE, (payload) => {
    console.log('[GamePage] TURN_CHANGE recebido:', payload);
    gameState.currentPlayer = payload.currentPlayerId === roomData.owner_id || payload.currentPlayerId === roomData.owner?.id ? 1 : 2;
    gameState.isMyTurn = payload.currentPlayerId === gameState.myPlayerId;
    gameState.turn = payload.turnNumber;
    gameState.turnTimer = TURN_TIME; // Resetar timer
    gameState.foulCommitted = false;
    gameState.wrongBallHit = false;
    firstBallHit = null;

    // Reiniciar timer local
    if (timerInterval) clearInterval(timerInterval);
    startTurnTimer(room);

    updateUI(room);
  });

  realtimeService.on(GAME_EVENTS.FOUL_COMMITTED, (payload) => {
    showFoulMessage(payload.foulType);
    if (payload.penaltyBallId !== undefined) {
      const ball = gameState.balls.find(b => b.id === payload.penaltyBallId);
      if (ball) {
        ball.pocketed = true;
        updateBallsDisplay(); // Atualizar HUD após penalidade
      }
    }
  });

  realtimeService.on(GAME_EVENTS.TYPE_ASSIGNED, (payload) => {
    console.log('[GamePage] TYPE_ASSIGNED recebido:', payload);
    gameState.player1Type = payload.player1Type as any;
    gameState.player2Type = payload.player2Type as any;

    // Atualizar as bolas de cada jogador baseado no tipo
    const allSolids = [1, 2, 3, 4, 5, 6, 7];
    const allStripes = [9, 10, 11, 12, 13, 14, 15];

    gameState.player1Balls = payload.player1Type === 'solid' ? allSolids : allStripes;
    gameState.player2Balls = payload.player2Type === 'solid' ? allSolids : allStripes;

    // Atualizar UI
    updateBallsDisplay();
    updateUI(room);
  });

  realtimeService.on(GAME_EVENTS.GAME_OVER, (payload) => {
    console.log('[GamePage] GAME_OVER recebido:', payload);
    gameState.gameOver = true;
    gameState.winner = payload.winnerUsername;

    // Parar timer
    if (timerInterval) clearInterval(timerInterval);

    // Verificar se EU sou o vencedor
    const state = gameStore.getState();
    const myId = state.user?.id;
    const isWinner = payload.winnerId === myId;

    // Mostrar mensagem apropriada baseada no motivo
    let victoryMessage = '';
    if (payload.reason === 'forfeit') {
      if (isWinner) {
        victoryMessage = '🏆 Seu oponente abandonou a partida! Você venceu!';
      } else {
        victoryMessage = '😔 Você abandonou a partida.';
      }
    } else if (payload.reason === 'timeout') {
      victoryMessage = isWinner ? '⏱️ Tempo esgotado! Você venceu!' : '⏱️ Tempo esgotado!';
    } else {
      victoryMessage = isWinner ? '🎉 Parabéns! Você venceu!' : `${payload.winnerUsername} venceu!`;
    }

    // Mostrar tela de vitória
    showVictoryMessage(payload.winnerUsername, victoryMessage, payload.reason);
    updateUI(room);
  });

  // Handler para sincronização completa de estado
  realtimeService.on(GAME_EVENTS.STATE_SYNC, (payload: any) => {
    console.log('[GamePage] STATE_SYNC recebido:', payload);

    // Sincronizar bolas
    if (payload.balls) {
      payload.balls.forEach((remoteBall: any) => {
        const localBall = gameState.balls.find(b => b.id === remoteBall.id);
        if (localBall) {
          localBall.x = remoteBall.x;
          localBall.y = remoteBall.y;
          localBall.vx = remoteBall.vx;
          localBall.vy = remoteBall.vy;
          localBall.pocketed = remoteBall.pocketed;
        }
      });
    }

    // Sincronizar tipos
    if (payload.player1Type) {
      gameState.player1Type = payload.player1Type as any;
      gameState.player2Type = payload.player2Type as any;

      const allSolids = [1, 2, 3, 4, 5, 6, 7];
      const allStripes = [9, 10, 11, 12, 13, 14, 15];

      gameState.player1Balls = payload.player1Type === 'solid' ? allSolids : allStripes;
      gameState.player2Balls = payload.player2Type === 'solid' ? allSolids : allStripes;
    }

    // Sincronizar turno
    if (payload.currentPlayerId) {
      gameState.currentPlayer = payload.currentPlayerId === roomData.owner_id || payload.currentPlayerId === roomData.owner?.id ? 1 : 2;
      gameState.isMyTurn = payload.currentPlayerId === gameState.myPlayerId;
    }

    if (payload.turnNumber) {
      gameState.turn = payload.turnNumber;
    }

    // Sincronizar scores
    if (payload.player1Score !== undefined) {
      gameState.player1Score = payload.player1Score;
      gameState.player2Score = payload.player2Score;
    }

    updateBallsDisplay();
    updateUI(room);
  });
}

function showFoulMessage(foulType: string) {
  const messages: Record<string, string> = {
    wrong_ball: '⚠️ FALTA! Bola errada!',
    cue_pocketed: '⚠️ FALTA! Branca encaçapada!',
    no_hit: '⚠️ FALTA! Não acertou nada!',
    opponent_ball: '⚠️ Encaçapou adversário (Turno passa)',
    penalty_ball: '🎱 Penalidade aplicada',
    ball_in_hand: '🖐️ Bola na mão!',
    ball_15_win: '🏆 Bola 8 finalizada! VITÓRIA!',
    ball_15_early: '❌ Bola 8 cedo demais! PERDEU!',
    ball_8_foul_loss: '❌ Falta na Bola 8! PERDEU!'
  };
  const msgEl = document.getElementById('game-message');
  if (msgEl) {
    msgEl.textContent = messages[foulType] || '⚠️ FALTA!';
    msgEl.style.color = foulType.includes('win') ? 'var(--accent-green)' : (foulType.includes('loss') || foulType.includes('early') ? 'var(--accent-red)' : 'var(--accent-orange)');
    setTimeout(() => { msgEl.style.color = ''; }, 3000);
  }

  // Mostrar mensagem animada e tocar som
  if (!foulType.includes('win')) {
    showAnimatedMessage(audioEngine.getRandomFoulMessage(), 'foul');
    audioEngine.playFoul();
  }
}

// Mostra mensagem animada flutuante
function showAnimatedMessage(text: string, type: 'nice-shot' | 'foul' | 'turn-change' | 'combo') {
  const container = document.getElementById('animated-message-container');
  if (!container) return;

  const msg = document.createElement('div');
  msg.className = `animated-message message-${type}`;
  msg.textContent = text;

  container.appendChild(msg);

  // Remover após animação
  setTimeout(() => {
    msg.remove();
  }, 2000);
}

// Mostra mensagem de Nice Shot quando encaçapa bola correta
function showNiceShotMessage() {
  showAnimatedMessage(audioEngine.getRandomNiceShotMessage(), 'nice-shot');
  audioEngine.playNiceShot();
}

// Mostra mensagem de troca de turno
function showTurnChangeMessage(playerName: string) {
  showAnimatedMessage(`${audioEngine.getRandomTurnChangeMessage()} ${playerName}`, 'turn-change');
  audioEngine.playTurnChange();
}

// ==================== TIMER ====================

function startTurnTimer(room: any) {
  if (timerInterval) clearInterval(timerInterval);
  gameState.turnTimer = TURN_TIME;
  updateTimerDisplay();

  timerInterval = window.setInterval(() => {
    if (gameState.gameOver || areBallsMoving(gameState.balls as unknown as PhysicsBall[])) return;

    gameState.turnTimer--;
    updateTimerDisplay();

    if (gameState.turnTimer <= 0) {
      handleTurnEnd(false, room);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const timerEl = document.getElementById('game-timer');
  if (timerEl) {
    timerEl.textContent = `⏱️ ${gameState.turnTimer}s`;
    timerEl.style.color = gameState.turnTimer <= 10 ? 'var(--accent-red)' : 'var(--text-primary)';
  }
}

// ==================== CRONÔMETRO DA PARTIDA (30 MIN) ====================

async function startMatchTimer(room: any) {
  // Se já existe um timer, não iniciar outro
  if (matchTimerInterval) return;

  // Definir tempo de início - SEMPRE buscar do servidor para persistência
  if (!matchStartTime) {
    // Primeiro, tentar obter do roomData (se veio da navegação)
    if (room.started_at) {
      matchStartTime = new Date(room.started_at).getTime();
      console.log('[GamePage] Usando started_at do roomData:', room.started_at);
    }
    // Se for multiplayer e tiver match_id, buscar do servidor
    else if (room.match_id || room.matchId) {
      try {
        const matchId = room.match_id || room.matchId;
        const { data } = await api.getMatch(matchId);
        if (data?.started_at) {
          matchStartTime = new Date(data.started_at).getTime();
          console.log('[GamePage] Usando started_at do servidor:', data.started_at);
          // Atualizar roomData para futuras referências
          room.started_at = data.started_at;

          // Se o servidor diz que a partida expirou, encerrar imediatamente
          if (data.time_info?.is_expired) {
            console.log('[GamePage] ⏰ Servidor indica que partida já expirou!');
            handleMatchTimeout(room);
            return;
          }
        } else {
          // Match existe mas não tem started_at (ainda não iniciou)
          matchStartTime = Date.now();
          console.log('[GamePage] Match sem started_at, usando tempo atual');
        }
      } catch (err) {
        console.error('[GamePage] Erro ao buscar match do servidor:', err);
        matchStartTime = Date.now();
      }
    }
    // Se for AI ou não tiver match_id, usar tempo atual
    else {
      matchStartTime = Date.now();
      console.log('[GamePage] Modo local/AI, usando tempo atual');
    }
  }

  // Verificar se o tempo já expirou
  const elapsed = Date.now() - matchStartTime;
  if (elapsed >= MATCH_MAX_DURATION_MS) {
    console.log('[GamePage] ⏰ Partida já expirou! Tempo decorrido:', Math.floor(elapsed / 60000), 'minutos');
    handleMatchTimeout(room);
    return;
  }

  const remainingMinutes = Math.floor((MATCH_MAX_DURATION_MS - elapsed) / 60000);
  console.log(`[GamePage] Iniciando cronômetro da partida - Restam: ${remainingMinutes} minutos`);

  // Atualizar display imediatamente
  updateMatchTimerDisplay(room);

  // Atualizar a cada segundo
  matchTimerInterval = window.setInterval(() => {
    updateMatchTimerDisplay(room);
  }, 1000);
}

function stopMatchTimer() {
  if (matchTimerInterval) {
    clearInterval(matchTimerInterval);
    matchTimerInterval = null;
  }
}

function updateMatchTimerDisplay(room: any) {
  if (!matchStartTime) return;

  const elapsed = Date.now() - matchStartTime;
  const remaining = Math.max(0, MATCH_MAX_DURATION_MS - elapsed);

  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const timerEl = document.getElementById('match-timer');
  const containerEl = document.getElementById('match-timer-container');

  if (timerEl) {
    timerEl.textContent = formattedTime;

    // Mudar cor baseado no tempo restante
    if (remaining <= 60000) { // Último minuto - vermelho piscando
      timerEl.style.color = '#ff4444';
      if (containerEl) {
        containerEl.style.background = 'rgba(255,68,68,0.2)';
        containerEl.style.borderColor = 'rgba(255,68,68,0.5)';
        containerEl.style.animation = 'timer-pulse 0.5s ease-in-out infinite';
      }
    } else if (remaining <= 300000) { // Últimos 5 minutos - amarelo
      timerEl.style.color = '#ffa500';
      if (containerEl) {
        containerEl.style.background = 'rgba(255,165,0,0.15)';
        containerEl.style.borderColor = 'rgba(255,165,0,0.3)';
        containerEl.style.animation = 'none';
      }
    } else {
      timerEl.style.color = 'var(--accent-blue)';
      if (containerEl) {
        containerEl.style.background = 'rgba(0,136,255,0.15)';
        containerEl.style.borderColor = 'rgba(0,136,255,0.3)';
        containerEl.style.animation = 'none';
      }
    }
  }

  // Verificar se o tempo acabou
  if (remaining <= 0) {
    handleMatchTimeout(room);
  }
}

function handleMatchTimeout(room: any) {
  console.log('[GamePage] ⏰ Tempo da partida esgotado!');

  // Parar timers
  stopMatchTimer();
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // Determinar vencedor baseado na pontuação
  let winner: string | null = null;
  let winnerName = '';
  let reason = 'timeout';

  if (gameState.player1Score > gameState.player2Score) {
    winner = room.owner?.id || room.player1_id;
    winnerName = room.owner?.username || 'Jogador 1';
  } else if (gameState.player2Score > gameState.player1Score) {
    winner = room.guest?.id || room.player2_id;
    winnerName = room.guest?.username || (gameState.isAI ? 'CPU' : 'Jogador 2');
  }
  // Se empate, winner fica null

  gameState.gameOver = true;
  gameState.winner = winnerName || null;

  // Mostrar overlay de fim de jogo
  showTimeoutOverlay(winner, winnerName, room);

  // Se for multiplayer, notificar servidor
  if (gameState.isMultiplayer && room.match_id) {
    // O servidor vai lidar com isso via cleanup service
    console.log('[GamePage] Partida multiplayer - servidor irá processar timeout');
  }
}

function showTimeoutOverlay(winnerId: string | null, winnerName: string, room: any) {
  const state = gameStore.getState();
  const myId = state.user?.id;
  const isWinner = winnerId === myId;
  const isDraw = !winnerId;

  let title = '';
  let message = '';
  let icon = '';

  if (isDraw) {
    title = 'TEMPO ESGOTADO!';
    message = 'A partida terminou empatada. Vocês atingiram o tempo máximo de 30 minutos.';
    icon = '⏰';
  } else if (isWinner) {
    title = 'VITÓRIA!';
    message = `O tempo acabou! Você venceu por ${gameState.player1Score} x ${gameState.player2Score}`;
    icon = '🏆';
  } else {
    title = 'DERROTA';
    message = `O tempo acabou! ${winnerName} venceu por ${gameState.player2Score} x ${gameState.player1Score}`;
    icon = '😔';
  }

  // Criar overlay
  const overlay = document.createElement('div');
  overlay.className = 'game-over-overlay active' + (isWinner ? '' : ' defeat');
  overlay.innerHTML = `
    <div class="game-over-modal">
      <div class="winner-avatar-container">${icon}</div>
      <h2 class="winner-title">${title}</h2>
      <p class="winner-message">${message}</p>
      <div style="background: rgba(255,165,0,0.1); padding: 1rem; border-radius: 12px; margin: 1rem 0;">
        <p style="color: #ffa500; font-size: 0.9rem; margin: 0;">
          ⏰ Tempo limite de 30 minutos atingido
        </p>
        <p style="color: var(--text-muted); font-size: 0.8rem; margin: 0.5rem 0 0 0;">
          Para continuar jogando, inicie uma nova partida.
        </p>
      </div>
      <div class="game-over-actions">
        <button class="btn btn-primary btn-lg" id="timeout-new-game-btn">🎱 Nova Partida</button>
        <button class="btn btn-secondary" id="timeout-leave-btn">🚪 Voltar ao Lobby</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Limpar estado salvo para evitar restaurar partida expirada
  localStorage.removeItem('sinuca_save_v1');

  // Event listeners
  document.getElementById('timeout-new-game-btn')?.addEventListener('click', () => {
    overlay.remove();
    // Resetar estado completamente
    matchStartTime = null;
    sessionScore = { p1: 0, p2: 0 };
    gameState = initGameState(gameState.gameMode);
    gameState.isAI = room.mode === 'ai';
    gameState.isMultiplayer = room.isMultiplayer || false;
    startMatchTimer(room);
    startTurnTimer(room);
    updateUI(room);
  });

  document.getElementById('timeout-leave-btn')?.addEventListener('click', () => {
    overlay.remove();
    // Limpar tudo
    if (animationId) cancelAnimationFrame(animationId);
    if (timerInterval) clearInterval(timerInterval);
    audioEngine.stopAmbient();
    musicPlayer.stop();
    realtimeService.leaveRoom();
    window.location.href = '/lobby';
  });
}

// ==================== CONTROLES ====================

function getCanvasCoords(e: MouseEvent | Touch): { x: number; y: number } {
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

function handleMouseDown(e: MouseEvent) {
  if (gameState.gameOver || areBallsMoving(gameState.balls as unknown as PhysicsBall[])) return;
  if (gameState.isMultiplayer && !gameState.isMyTurn) return;

  const { x, y } = getCanvasCoords(e);
  const cueBall = gameState.balls.find(b => b.type === 'cue' && !b.pocketed);

  if (cueBall) {
    const offsetX = 70; // Margem fixa woodBorder
    const offsetY = 70;
    const ballScreenX = cueBall.x + offsetX;
    const ballScreenY = cueBall.y + offsetY;
    const dist = Math.sqrt((x - ballScreenX) ** 2 + (y - ballScreenY) ** 2);

    // Se tiver Ball in Hand e clicar longe da bola, posicionar
    if (gameState.ballInHand && !gameState.isAiming && dist > BALL_RADIUS * 3) {
      const newX = x - offsetX;
      const newY = y - offsetY;

      if (newX > TableBounds.minX && newX < TableBounds.maxX &&
        newY > TableBounds.minY && newY < TableBounds.maxY) {
        if (!checkCollisionWithOthers(newX, newY, cueBall.id)) {
          cueBall.x = newX;
          cueBall.y = newY;
          isDraggingCueBall = true;
          return;
        }
      }
    }

    // Clicou perto da bola branca - iniciar mira
    // Aumentado para facilitar o clique em telas de alta resolução
    if (dist < BALL_RADIUS * 12) {
      gameState.isAiming = true;
      accumulatedPower = 0;
      pullBackDistance = 0;

      // Direção inicial: oposta ao mouse (Taco está no mouse, ponta para a bola)
      const dx = ballScreenX - x;
      const dy = ballScreenY - y;
      shotDirection = Math.atan2(dy, dx);

      gameState.aimAngle = shotDirection;
      gameState.aimPower = 0;

      gameState.cueState = {
        visible: true,
        angle: shotDirection,
        pullBack: 0,
        power: 0,
        x: cueBall.x,
        y: cueBall.y,
        contactX: cueBall.x,
        contactY: cueBall.y
      };
    }
  }
}


// Helper para validar posição Ball in Hand
function checkCollisionWithOthers(x: number, y: number, ignoreId: number): boolean {
  return gameState.balls.some(b => {
    if (b.id === ignoreId || b.pocketed) return false;
    const dist = Math.sqrt((b.x - x) ** 2 + (b.y - y) ** 2);
    return dist < BALL_RADIUS * 2;
  });
}
const TableBounds = { minX: BALL_RADIUS, maxX: TABLE_WIDTH - BALL_RADIUS, minY: BALL_RADIUS, maxY: TABLE_HEIGHT - BALL_RADIUS };

// =====================================================
// SISTEMA DE CONTROLE DO TACO - SIMPLIFICADO
// =====================================================
// 
// COMO FUNCIONA:
// 1. Clica e arrasta NA DIREÇÃO que quer atirar → define DIREÇÃO
// 2. Quando começa a puxar para TRÁS → TRAVA direção
// 3. Continua puxando para trás → aumenta FORÇA (pullback)
// 4. Solta → atira na direção travada
//
// IMPORTANTE:
// - shotDirection = ângulo para onde a BOLA vai
// - O taco fica no lado OPOSTO (renderer faz isso)
// - Puxar para trás = puxar na direção OPOSTA ao tiro
//
// =====================================================

let clickStartX = 0;
let clickStartY = 0;
let shotDirection = 0;           // Ângulo para onde a BOLA vai
let isDirectionLocked = false;   // true = direção travada, só força muda
let accumulatedPower = 0;
let pullBackDistance = 0;

function handleMouseMove(e: MouseEvent) {
  const { x, y } = getCanvasCoords(e);
  const cueBall = gameState.balls.find(b => b.type === 'cue' && !b.pocketed);

  if (!cueBall) return;

  const offsetX = 70;
  const offsetY = 70;
  const ballScreenX = cueBall.x + offsetX;
  const ballScreenY = cueBall.y + offsetY;

  if (gameState.isAiming) {
    // Vetor do MOUSE para a BOLA (direção para onde a bola vai)
    const dx = ballScreenX - x;
    const dy = ballScreenY - y;
    const distToMouse = Math.sqrt(dx * dx + dy * dy);

    // Só atualiza o ângulo se o mouse estiver a uma distância mínima (Deadzone)
    if (distToMouse > 25) {
      const currentAngle = Math.atan2(dy, dx);

      let angleDiff = currentAngle - shotDirection;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

      // Estabilização dinámica: quanto mais longe você puxa para ganhar força, 
      // mais estável e lenta fica a mira (evita virar o taco por acidente).
      const stabilityFactor = distToMouse > 180 ? 0.05 : 0.8;
      shotDirection = shotDirection + angleDiff * stabilityFactor;
    }

    // Pullback: Curso longo de 400px para precisão de força
    const minDist = 30;
    const maxPullBack = 400;
    pullBackDistance = Math.max(0, Math.min(distToMouse - minDist, maxPullBack));

    // Potência acumulada (0 a 100)
    accumulatedPower = (pullBackDistance / maxPullBack) * 100;

    // Atualizar estado
    gameState.aimAngle = shotDirection;
    gameState.aimPower = (accumulatedPower / 100) * PHYSICS.MAX_SHOT_POWER;

    gameState.cueState = {
      visible: true,
      angle: shotDirection,
      pullBack: pullBackDistance,
      power: accumulatedPower / 100,
      x: cueBall.x,
      y: cueBall.y,
      contactX: cueBall.x,
      contactY: cueBall.y
    };

    // Multiplayer sync
    if (gameState.isMultiplayer) {
      realtimeService.sendAimUpdate({
        playerId: gameState.myPlayerId!,
        aimX: x,
        aimY: y,
        power: gameState.aimPower
      });
    }
  } else if (isDraggingCueBall && gameState.ballInHand) {
    // Arrastando bola na mão
    let newX = x - offsetX;
    let newY = y - offsetY;

    newX = Math.max(TableBounds.minX, Math.min(TableBounds.maxX, newX));
    newY = Math.max(TableBounds.minY, Math.min(TableBounds.maxY, newY));

    if (!checkCollisionWithOthers(newX, newY, cueBall.id)) {
      cueBall.x = newX;
      cueBall.y = newY;
    }
  }
}

function handleMouseUp(e: MouseEvent) {
  if (!gameState.isAiming) return;

  const cueBall = gameState.balls.find(b => b.type === 'cue' && !b.pocketed);

  if (cueBall && accumulatedPower > 5) {
    // Aplicar tacada na direção definida
    const dirX = Math.cos(shotDirection);
    const dirY = Math.sin(shotDirection);

    // Força proporcional ao pullback
    const shotPower = (accumulatedPower / 100) * PHYSICS.MAX_SHOT_POWER;

    applyCueShot(cueBall as unknown as PhysicsBall, dirX, dirY, shotPower);
    audioEngine.playCueHit(shotPower / PHYSICS.MAX_SHOT_POWER);

    console.log('[Taco] TACADA! Direção:', (shotDirection * 180 / Math.PI).toFixed(1), '° Força:', shotPower.toFixed(1));

    // Fim de ball in hand ao tacar
    if (gameState.ballInHand) {
      gameState.ballInHand = false;
    }

    // Enviar tacada para oponente em multiplayer
    if (gameState.isMultiplayer) {
      realtimeService.sendShot({
        playerId: gameState.myPlayerId!,
        cueBallX: cueBall.x,
        cueBallY: cueBall.y,
        directionX: dirX,
        directionY: dirY,
        power: shotPower
      });
    }

    // Resetar estado de primeira bola atingida
    firstBallHit = null;
  }

  // Resetar tudo
  gameState.isAiming = false;
  gameState.aimPower = 0;
  gameState.cueState.visible = false;
  isDirectionLocked = false;
  accumulatedPower = 0;
  pullBackDistance = 0;
}

function handleMouseLeave(e: MouseEvent) {
  // Se estava mirando, cancela a mira
  if (gameState.isAiming) {
    gameState.isAiming = false;
    gameState.aimPower = 0;
    gameState.cueState.visible = false;
    isDirectionLocked = false;
    accumulatedPower = 0;
    pullBackDistance = 0;
  }
}

// ==================== SUPORTE TOUCH (MOBILE) ====================

function getTouchCoords(touch: Touch): { x: number; y: number } {
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (touch.clientX - rect.left) * scaleX,
    y: (touch.clientY - rect.top) * scaleY,
  };
}

function handleTouchStart(e: TouchEvent) {
  e.preventDefault();
  e.stopPropagation();

  if (e.touches.length === 0) return;
  if (gameState.gameOver || areBallsMoving(gameState.balls as unknown as PhysicsBall[])) return;
  if (gameState.isMultiplayer && !gameState.isMyTurn) return;

  const touch = e.touches[0];
  const { x, y } = getTouchCoords(touch);
  const cueBall = gameState.balls.find(b => b.type === 'cue' && !b.pocketed);

  if (cueBall) {
    const offsetX = CANVAS_PADDING / 2;
    const offsetY = CANVAS_PADDING / 2;
    const ballScreenX = cueBall.x + offsetX;
    const ballScreenY = cueBall.y + offsetY;

    const dist = Math.sqrt((x - ballScreenX) ** 2 + (y - ballScreenY) ** 2);
    console.log('[GamePage] Touch at', x, y, 'Ball at', ballScreenX, ballScreenY, 'Dist:', dist);

    if (dist < BALL_RADIUS * 10) {
      gameState.isAiming = true;
      isDirectionLocked = false;
      accumulatedPower = 0;
      pullBackDistance = 0;
      clickStartX = x;
      clickStartY = y;

      const dx = x - ballScreenX;
      const dy = y - ballScreenY;

      shotDirection = Math.atan2(dy, dx);

      gameState.aimAngle = shotDirection;
      gameState.aimPower = 0;

      gameState.cueState = {
        visible: true,
        angle: shotDirection,
        pullBack: 0,
        power: 0,
        x: cueBall.x,
        y: cueBall.y,
        contactX: cueBall.x,
        contactY: cueBall.y
      };
      console.log('[GamePage] Touch: Iniciando mira');
    }
  }
}

function handleTouchMove(e: TouchEvent) {
  e.preventDefault();
  e.stopPropagation();

  if (e.touches.length === 0) return;
  if (!gameState.isAiming) return;

  const touch = e.touches[0];
  const { x, y } = getTouchCoords(touch);
  const cueBall = gameState.balls.find(b => b.type === 'cue' && !b.pocketed);

  if (!cueBall) return;

  const offsetX = 70;
  const offsetY = 70;
  const ballScreenX = cueBall.x + offsetX;
  const ballScreenY = cueBall.y + offsetY;

  const dx = x - ballScreenX;
  const dy = y - ballScreenY;
  const distToTouch = Math.sqrt(dx * dx + dy * dy);

  if (distToTouch > 20) {
    const touchAngle = Math.atan2(dy, dx);

    let angleDiff = touchAngle - shotDirection;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    shotDirection = shotDirection + angleDiff * 0.8;

    // Pullback Mobile
    const minDist = 30;
    const maxPullBack = 350; // Um pouco menor no mobile por causa da tela
    pullBackDistance = Math.max(0, Math.min(distToTouch - minDist, maxPullBack));
    accumulatedPower = (pullBackDistance / maxPullBack) * 100;
  }

  gameState.aimAngle = shotDirection;
  gameState.aimPower = (accumulatedPower / 100) * PHYSICS.MAX_SHOT_POWER;

  gameState.cueState = {
    visible: true,
    angle: shotDirection,
    pullBack: pullBackDistance,
    power: accumulatedPower / 100,
    x: cueBall.x,
    y: cueBall.y,
    contactX: cueBall.x,
    contactY: cueBall.y
  };

  // Enviar mira para oponente em multiplayer
  if (gameState.isMultiplayer) {
    realtimeService.sendAimUpdate({
      playerId: gameState.myPlayerId!,
      aimX: x,
      aimY: y,
      power: gameState.aimPower
    });
  }

}

function handleTouchEnd(e: TouchEvent) {
  e.preventDefault();
  e.stopPropagation();

  if (!gameState.isAiming) return;

  const cueBall = gameState.balls.find(b => b.type === 'cue' && !b.pocketed);

  if (cueBall && accumulatedPower > 5) {
    // Aplicar tacada na direção definida
    const dirX = Math.cos(shotDirection);
    const dirY = Math.sin(shotDirection);

    const shotPower = (accumulatedPower / 100) * PHYSICS.MAX_SHOT_POWER;

    applyCueShot(cueBall as unknown as PhysicsBall, dirX, dirY, shotPower);
    audioEngine.playCueHit(shotPower / PHYSICS.MAX_SHOT_POWER);

    console.log('[GamePage] Touch: Tacada aplicada com força', shotPower, 'ângulo:', (shotDirection * 180 / Math.PI).toFixed(1), '°');

    // Enviar tacada para oponente em multiplayer
    if (gameState.isMultiplayer) {
      realtimeService.sendShot({
        playerId: gameState.myPlayerId!,
        cueBallX: cueBall.x,
        cueBallY: cueBall.y,
        directionX: dirX,
        directionY: dirY,
        power: shotPower
      });
    }

    // Resetar estado de primeira bola atingida
    firstBallHit = null;
  }

  // Resetar tudo
  gameState.isAiming = false;
  gameState.aimPower = 0;
  gameState.cueState.visible = false;
  isDirectionLocked = false;
  accumulatedPower = 0;
  pullBackDistance = 0;
}

function handleTouchCancel(e: TouchEvent) {
  e.preventDefault();
  // Cancelar mira se o touch for cancelado
  gameState.isAiming = false;
  gameState.aimPower = 0;
  gameState.cueState.visible = false;
  isDirectionLocked = false;
  accumulatedPower = 0;
  pullBackDistance = 0;
}


// ==================== IA ====================

function makeAIMove() {
  if (gameState.gameOver || areBallsMoving(gameState.balls as unknown as PhysicsBall[]) || gameState.currentPlayer !== 2) return;

  const cueBall = gameState.balls.find(b => b.type === 'cue' && !b.pocketed);
  if (!cueBall) return;

  // Encontrar bolas válidas para mirar
  let targetBalls: Ball[] = [];

  if (gameState.gameMode === '9ball') {
    targetBalls = gameState.balls.filter(b => !b.pocketed && b.type === gameState.player2Type);
  } else {
    const targetType = gameState.player2Type;
    if (targetType) {
      targetBalls = gameState.balls.filter(b => !b.pocketed && b.type === targetType);
    } else {
      targetBalls = gameState.balls.filter(b => !b.pocketed && b.type !== 'cue' && b.type !== 'eight');
    }
  }

  if (targetBalls.length === 0) {
    const eightBall = gameState.balls.find(b => b.type === 'eight' && !b.pocketed);
    if (eightBall) targetBalls.push(eightBall);
  }

  if (targetBalls.length === 0) return;

  // Encontrar melhor jogada (bola + caçapa)
  let bestShot = { ball: targetBalls[0], pocket: POCKETS[0], score: -Infinity };

  for (const ball of targetBalls) {
    for (const pocket of POCKETS) {
      // Calcular ângulo necessário
      const ballToPocket = Math.atan2(pocket.y - ball.y, pocket.x - ball.x);
      const cueToBall = Math.atan2(ball.y - cueBall.y, ball.x - cueBall.x);

      // Verificar se há linha de visão
      const distToBall = Math.sqrt((ball.x - cueBall.x) ** 2 + (ball.y - cueBall.y) ** 2);
      const distToPocket = Math.sqrt((pocket.x - ball.x) ** 2 + (pocket.y - ball.y) ** 2);

      // Score baseado em distância e ângulo
      const angleDiff = Math.abs(ballToPocket - cueToBall);
      const score = 1000 / (distToBall + distToPocket) - angleDiff * 10;

      if (score > bestShot.score) {
        bestShot = { ball, pocket, score };
      }
    }
  }

  // Calcular direção e força
  const dx = bestShot.ball.x - cueBall.x;
  const dy = bestShot.ball.y - cueBall.y;
  const angle = Math.atan2(dy, dx);
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Força baseada na distância
  const power = Math.min(8 + dist * 0.02 + Math.random() * 4, PHYSICS.MAX_SHOT_POWER * 0.8);

  // Adicionar imprecisão
  const imprecision = (Math.random() - 0.5) * 0.15;

  applyCueShot(cueBall as unknown as PhysicsBall, Math.cos(angle + imprecision), Math.sin(angle + imprecision), power);
  audioEngine.playCueHit(power);

  firstBallHit = null;
}

// ==================== REGRAS DE FALTA ====================

function checkFoul(hitBall: Ball) {
  if (firstBallHit) return;
  firstBallHit = hitBall;

  const currentType = gameState.currentPlayer === 1 ? gameState.player1Type : gameState.player2Type;
  const currentBalls = gameState.currentPlayer === 1 ? gameState.player1Balls : gameState.player2Balls;

  // Se ainda não definiu tipo, qualquer bola é válida
  if (!currentType) return;

  const hitNum = hitBall.number;
  let isFoul = false;

  // Modo 8-Ball ("14ball" legacy name): Lisas vs Listradas
  // 9-Ball: Vermelhas vs Azuis
  if (gameState.gameMode === '9ball') {
    isFoul = hitBall.type !== currentType && hitBall.type !== 'cue';
  } else {
    // 8-Ball: Deve acertar bola do seu grupo.
    // Se tipo não definido, qualque bola (exceto 8 e cue) é válida para tocar?
    // Regra: Em mesa aberta, pode acertar qualquer bola (exceto 8? Depende da regra, geralmente pode usar combo, mas 8 não pode ser a primeira).
    // Aqui, se type é null, mesa aberta.
    if (!currentType) {
      // Mesa aberta: Pode bater em qualquer sólida ou listrada. Não pode bater na 8 de primeira.
      if (hitBall.type === 'eight') isFoul = true;
    } else {
      // Mesa fechada
      if (currentType === 'solid' && hitBall.type !== 'solid') isFoul = true;
      if (currentType === 'stripe' && hitBall.type !== 'stripe') isFoul = true;
      if (hitBall.type === 'eight' && !canPlayEightBall(gameState.currentPlayer)) isFoul = true; // Só pode bater na 8 se for a vez dela
    }
  }

  if (isFoul) {
    gameState.foulCommitted = true;
    gameState.wrongBallHit = true;
    showFoulMessage('wrong_ball');
    // Ball in Hand para o próximo
    // A penalidade é aplicada no fim do turno em handleTurnEnd
  }
}

function canPlayEightBall(playerIdx: number): boolean {
  const balls = playerIdx === 1 ? gameState.player1Balls : gameState.player2Balls;

  // Se o jogador ainda não tem tipo definido, não pode jogar na 8
  const playerType = playerIdx === 1 ? gameState.player1Type : gameState.player2Type;
  if (!playerType) {
    console.log('[canPlayEightBall] Player', playerIdx, 'ainda não tem tipo definido');
    return false;
  }

  // Se não tem bolas atribuídas, não pode jogar na 8
  if (!balls || balls.length === 0) {
    console.log('[canPlayEightBall] Player', playerIdx, 'não tem bolas atribuídas');
    return false;
  }

  // Verificar quantas bolas ainda NÃO foram encaçapadas
  const remaining = balls.filter(num => {
    const ball = gameState.balls.find(b => Number(b.number) === num);
    return ball && !ball.pocketed; // Bola existe e NÃO está encaçapada
  });

  console.log('[canPlayEightBall] Player:', playerIdx,
    'Type:', playerType,
    'Balls:', balls,
    'Remaining:', remaining,
    'CanPlay8:', remaining.length === 0);

  // Pode jogar na 8 APENAS se todas as suas bolas foram encaçapadas (remaining = 0)
  return remaining.length === 0;
}

// Aplica penalidade quando jogador erra (acerta bola do adversário ou não acerta nenhuma)
// Aplica penalidade quando jogador erra (acerta bola do adversário ou não acerta nenhuma)
// Aplica penalidade: Ball in Hand para adversário
function applyFoulPenalty() {
  if (gameState.gameMode === '9ball') {
    // REGRA BRASILEIRA: "Perde uma bola" -> Oponente ganha uma bola encaçapada
    const opponentId = gameState.currentPlayer === 1 ? 2 : 1;
    const opponentBalls = opponentId === 1 ? gameState.player1Balls : gameState.player2Balls;

    // Encontrar uma bola do oponente que ainda está em jogo
    // balls contém os NÚMEROS das bolas. Precisamos achar o objeto Ball correspondente.
    const activeOpponentBall = gameState.balls.find(b =>
      opponentBalls.includes(Number(b.number)) && !b.pocketed
    );

    if (activeOpponentBall) {
      // "Encaçapar" a bola automaticamente
      activeOpponentBall.pocketed = true;
      activeOpponentBall.x = -1000; // Mover para fora da tela visualmente ou deixar o renderer tratar
      activeOpponentBall.inMotion = false;

      showFoulMessage('penalty_ball'); // "Penalidade aplicada"

      // Atualizar UI e checar vitória imediatamente, pois isso pode encerrar o jogo
      updateBallsDisplay();
      checkVictory();
    } else {
      // Se o oponente não tem mais bolas (mas o jogo não acabou??), nada a fazer.
      // Tecnicamente se o oponente não tem bolas, ele já venceu ou vence agora.
      showFoulMessage('wrong_ball');
    }
  } else {
    // Regra Padrão (8-ball): Ball in Hand
    const opponent = gameState.currentPlayer === 1 ? 'Jogador 2' : 'Jogador 1';
    showFoulMessage('ball_in_hand');
  }
}

// ==================== ENCAÇAPAR BOLA ====================

// Set para rastrear bolas já processadas neste frame (evita duplicação)
const processedPocketedBalls = new Set<number>();

function handlePocket(ball: Ball) {
  // Evitar processar a mesma bola múltiplas vezes no mesmo frame
  // Usamos o ID da bola para rastrear, não o estado pocketed
  // porque a física já marca pocketed=true antes de chamar esta função
  if (processedPocketedBalls.has(ball.id) && ball.type !== 'cue') {
    console.log('[handlePocket] Bola já foi processada neste ciclo, ignorando:', ball.number);
    return;
  }

  // Marcar como processada (exceto bola branca que pode ser reposicionada)
  if (ball.type !== 'cue') {
    processedPocketedBalls.add(ball.id);
  }

  // Log detalhado da bola encaçapada
  console.log('[handlePocket] Bola encaçapada:', {
    id: ball.id,
    number: ball.number,
    type: ball.type,
    pocketed: ball.pocketed,
    color: ball.color
  });

  gameState.lastPocketedBall = ball;
  audioEngine.playPocketFall();

  // IMPORTANTE: Garantir que a bola está marcada como pocketed
  // A física já marca, mas vamos garantir
  ball.pocketed = true;
  console.log('[handlePocket] Bola marcada como pocketed:', ball.number, ball.pocketed);

  // Bola branca encaçapada - falta (scratch/suicídio)
  if (ball.type === 'cue') {
    gameState.foulCommitted = true;
    showFoulMessage('cue_pocketed');

    // Reposicionar bola branca IMEDIATAMENTE no centro da mesa
    // Usar setTimeout apenas para dar um pequeno delay visual
    setTimeout(() => {
      // Garantir que a bola branca volte para a mesa
      ball.pocketed = false;
      ball.x = TABLE_WIDTH / 2; // Centro da mesa
      ball.y = TABLE_HEIGHT / 2;
      ball.vx = 0;
      ball.vy = 0;
      ball.inMotion = false;

      // Forçar atualização do estado
      gameState.ballInHand = true;

      console.log('🎱 Bola branca reposicionada no centro:', ball.x, ball.y);
    }, 300);

    // Aplicar penalidade (bola do adversário removida)
    applyFoulPenalty();
    saveGameState(); // Salvar após penalidade
    return;
  }

  const ballNum = Number(ball.number);
  const currentType = gameState.currentPlayer === 1 ? gameState.player1Type : gameState.player2Type;
  const currentBalls = gameState.currentPlayer === 1 ? gameState.player1Balls : gameState.player2Balls;
  const opponentBalls = gameState.currentPlayer === 1 ? gameState.player2Balls : gameState.player1Balls;

  // Lógica da Bola 8
  if (ball.type === 'eight') {
    console.log('[handlePocket] 🎱 BOLA 8 ENCAÇAPADA!');
    console.log('[handlePocket] Jogador atual:', gameState.currentPlayer);
    console.log('[handlePocket] Player1 (owner):', roomData?.owner?.username);
    console.log('[handlePocket] Player2 (guest/CPU):', gameState.isAI ? 'CPU' : roomData?.guest?.username);
    console.log('[handlePocket] Player1 Balls:', gameState.player1Balls);
    console.log('[handlePocket] Player2 Balls:', gameState.player2Balls);

    const canPlay8 = canPlayEightBall(gameState.currentPlayer);
    console.log('[handlePocket] Pode jogar na 8?', canPlay8);
    console.log('[handlePocket] Falta cometida?', gameState.foulCommitted);

    // Regra: Só pode encaçapar a 8 se já encaçapou todas as suas.
    if (canPlay8) {
      // Se cometeu falta na mesma jogada (ex: branca caiu) -> PERDEU
      if (gameState.foulCommitted) {
        console.log('[handlePocket] ❌ PERDEU - Encaçapou a 8 com falta!');
        gameState.gameOver = true;
        // Quem encaçapou a 8 com falta PERDE, então o adversário ganha
        if (gameState.currentPlayer === 1) {
          gameState.winner = gameState.isAI ? '🤖 CPU' : (roomData?.guest?.username || 'Jogador 2');
        } else {
          gameState.winner = roomData?.owner?.username || 'Jogador 1';
        }
        showFoulMessage('ball_8_foul_loss'); // Perdeu na 8 com falta
        showVictoryMessage(gameState.winner || 'Unknown');
      } else {
        // VENCEU! Encaçapou a 8 corretamente após todas as suas bolas
        console.log('[handlePocket] 🏆 VENCEU - Encaçapou a 8 corretamente!');
        gameState.gameOver = true;
        // Quem encaçapou a 8 corretamente GANHA
        if (gameState.currentPlayer === 1) {
          gameState.winner = roomData?.owner?.username || 'Jogador 1';
        } else {
          gameState.winner = gameState.isAI ? '🤖 CPU' : (roomData?.guest?.username || 'Jogador 2');
        }
        showFoulMessage('ball_15_win'); // Reusando msg "Vitória"
        showVictoryMessage(gameState.winner || 'Unknown');
      }
    } else {
      // Encaçapou 8 antes da hora -> PERDEU
      console.log('[handlePocket] ❌ PERDEU - Encaçapou a 8 antes de terminar suas bolas!');
      gameState.gameOver = true;
      // Quem encaçapou a 8 antes da hora PERDE, então o adversário ganha
      if (gameState.currentPlayer === 1) {
        gameState.winner = gameState.isAI ? '🤖 CPU' : (roomData?.guest?.username || 'Jogador 2');
      } else {
        gameState.winner = roomData?.owner?.username || 'Jogador 1';
      }
      showFoulMessage('ball_15_early'); // "Perdeu jogo"
      showVictoryMessage(gameState.winner || 'Unknown');
    }

    // Atualizar placar da sessão se for AI
    if (gameState.isAI) {
      if (gameState.winner === (roomData?.owner?.username || 'Jogador 1')) {
        sessionScore.p1++;
      } else {
        sessionScore.p2++;
      }
      updateSessionScoreDisplay();
    }

    saveGameState();
    return;
  }

  // Primeira bola encaçapada define o tipo (ímpar/par) no modo 14 bolas
  if (!gameState.player1Type && !gameState.player2Type && gameState.gameMode === '14ball') {
    assignTypes(ball);
    // Não incrementa score numérico
    updateBallsDisplay();
    checkVictory();
    return;
  }

  // Verificar se é bola do jogador atual
  const isMyBall = currentBalls.includes(ballNum);
  const isOpponentBall = opponentBalls.includes(ballNum);

  if (isMyBall) {
    // Encaçapou bola própria - OK, segue o jogo (joga de novo se não cometeu falta antes)
    showNiceShotMessage(); // Mostrar mensagem animada de Nice Shot
  } else if (isOpponentBall) {
    // Encaçapou bola do adversário - Falta (ajudou o adversário)
    gameState.foulCommitted = true;
    showFoulMessage('opponent_ball');
  } else {
    // Encaçapou bola que não é de ninguém (ex: bola 15 se for neutra e não tratada acima, ou bug)
    // Se for 8-ball mode, trataria a 8 aqui.
  }

  updateBallsDisplay();
  checkVictory();
  saveGameState(); // Salvar estado após cada bola encaçapada
}

// Atribui tipos: Solids (1-7) ou Stripes (9-15)
function assignTypes(ball: Ball) {
  if (gameState.gameMode === '14ball') { // 8-ball logic map
    const type = ball.type; // solid or stripe
    // Se a bola for 8 ou branca, ignora (já tratado em handlePocket/foul)
    if (type !== 'solid' && type !== 'stripe') return;

    const allSolids = [1, 2, 3, 4, 5, 6, 7];
    const allStripes = [9, 10, 11, 12, 13, 14, 15];

    if (gameState.currentPlayer === 1) {
      gameState.player1Type = type;
      gameState.player2Type = type === 'solid' ? 'stripe' : 'solid';
      gameState.player1Balls = type === 'solid' ? allSolids : allStripes;
      gameState.player2Balls = type === 'solid' ? allStripes : allSolids;
    } else {
      gameState.player2Type = type;
      gameState.player1Type = type === 'solid' ? 'stripe' : 'solid';
      gameState.player2Balls = type === 'solid' ? allSolids : allStripes;
      gameState.player1Balls = type === 'solid' ? allStripes : allSolids;
    }

    console.log('[GamePage] Tipos atribuídos:', {
      player1Type: gameState.player1Type,
      player2Type: gameState.player2Type,
      player1Balls: gameState.player1Balls,
      player2Balls: gameState.player2Balls
    });

    updateBallsDisplay();

    if (gameState.isMultiplayer) {
      // Enviar evento de tipo atribuído
      realtimeService.sendTypeAssigned({
        player1Id: roomData.owner_id || roomData.owner?.id,
        player1Type: gameState.player1Type!,
        player2Id: roomData.guest_id || roomData.guest?.id,
        player2Type: gameState.player2Type!
      });

      // Também enviar sincronização completa de estado
      realtimeService.sendStateSync({
        matchId: roomData.id,
        balls: gameState.balls.map(b => ({
          id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy,
          pocketed: b.pocketed, color: b.color, number: String(b.number), type: b.type
        })),
        currentPlayerId: gameState.currentPlayer === 1
          ? (roomData.owner_id || roomData.owner?.id)
          : (roomData.guest_id || roomData.guest?.id),
        player1Id: roomData.owner_id || roomData.owner?.id,
        player1Type: gameState.player1Type,
        player1Score: gameState.player1Score,
        player2Id: roomData.guest_id || roomData.guest?.id,
        player2Type: gameState.player2Type,
        player2Score: gameState.player2Score,
        turnNumber: gameState.turn,
        gameMode: '15ball',
        status: 'playing'
      });
    }
  }
}

// Atualiza a exibição das bolas de cada jogador
function updateBallsDisplay() {
  const p1BallsEl = document.getElementById('player1-balls');
  const p2BallsEl = document.getElementById('player2-balls');

  if (p1BallsEl) {
    p1BallsEl.innerHTML = renderPlayerBalls(gameState.player1Balls, gameState.balls);
  }
  if (p2BallsEl) {
    p2BallsEl.innerHTML = renderPlayerBalls(gameState.player2Balls, gameState.balls);
  }

  // Atualizar legenda com o tipo de bola do jogador local
  const myBallsLabel = document.getElementById('my-balls-label');
  const opponentBallsLabel = document.getElementById('opponent-balls-label');

  if (myBallsLabel) {
    const myType = getMyBallType();
    if (myType === 'solid') {
      myBallsLabel.textContent = '🟡 Suas (Lisas 1-7)';
    } else if (myType === 'stripe') {
      myBallsLabel.textContent = '🟣 Suas (Listradas 9-15)';
    } else if (myType === 'red') {
      myBallsLabel.textContent = '🔴 Suas (Vermelhas)';
    } else if (myType === 'blue') {
      myBallsLabel.textContent = '🔵 Suas (Azuis)';
    } else {
      myBallsLabel.textContent = 'Suas bolas';
    }
  }

  if (opponentBallsLabel) {
    const opponentType = isLocalPlayerOne() ? gameState.player2Type : gameState.player1Type;
    if (opponentType === 'solid') {
      opponentBallsLabel.textContent = '🟡 Oponente (Lisas)';
    } else if (opponentType === 'stripe') {
      opponentBallsLabel.textContent = '🟣 Oponente (Listradas)';
    } else if (opponentType === 'red') {
      opponentBallsLabel.textContent = '🔴 Oponente';
    } else if (opponentType === 'blue') {
      opponentBallsLabel.textContent = '🔵 Oponente';
    } else {
      opponentBallsLabel.textContent = 'Oponente';
    }
  }
}

// Verifica vitória - regras diferentes para cada modo
// 9-ball: quem encaçapar todas as suas 4 bolas primeiro VENCE!
// 8-ball: quem encaçapar todas as suas 7 bolas E depois a bola 8 VENCE!
function checkVictory() {
  const p1Type = gameState.player1Type;
  const p2Type = gameState.player2Type;

  if (!p1Type || !p2Type) return;

  // Contar bolas restantes de cada jogador
  const p1Remaining = gameState.player1Balls.filter(num => {
    const ball = gameState.balls.find(b => Number(b.number) === num);
    return ball && !ball.pocketed;
  }).length;

  const p2Remaining = gameState.player2Balls.filter(num => {
    const ball = gameState.balls.find(b => Number(b.number) === num);
    return ball && !ball.pocketed;
  }).length;

  // Debug: Log detalhado do estado das bolas
  console.log('[checkVictory] Estado:', {
    gameMode: gameState.gameMode,
    p1Type, p2Type,
    p1Balls: gameState.player1Balls,
    p2Balls: gameState.player2Balls,
    p1Remaining, p2Remaining,
    allBallsStatus: gameState.balls.map(b => ({
      id: b.id,
      num: b.number,
      type: b.type,
      pocketed: b.pocketed
    }))
  });

  // Atualizar placar para mostrar RESTANTES (invés de score crescente)
  const p1ScoreEl = document.getElementById('player1-score');
  const p2ScoreEl = document.getElementById('player2-score');

  if (p1ScoreEl) {
    p1ScoreEl.textContent = `${p1Remaining}`;
    p1ScoreEl.style.color = p1Remaining === 0 ? 'var(--accent-green)' : '';
  }
  if (p2ScoreEl) {
    p2ScoreEl.textContent = `${p2Remaining}`;
    p2ScoreEl.style.color = p2Remaining === 0 ? 'var(--accent-green)' : '';
  }

  // Modo 9-ball (4x4): Vitória quando todas as 4 bolas são encaçapadas
  if (gameState.gameMode === '9ball') {
    if (p1Remaining === 0) {
      gameState.gameOver = true;
      gameState.winner = roomData?.owner?.username || 'Jogador 1';

      if (gameState.isAI) {
        sessionScore.p1++;
        updateSessionScoreDisplay();
      }

      showVictoryMessage(gameState.winner || 'Unknown');
    } else if (p2Remaining === 0) {
      gameState.gameOver = true;
      gameState.winner = gameState.isAI ? '🤖 CPU' : (roomData?.guest?.username || 'Jogador 2');

      if (gameState.isAI) {
        sessionScore.p2++;
        updateSessionScoreDisplay();
      }

      showVictoryMessage(gameState.winner || 'Unknown');
    }
  }
  // Modo 8-ball (14ball): Vitória é determinada em handlePocket quando a bola 8 é encaçapada
  // Aqui apenas atualizamos o display e salvamos o estado
  // A vitória real acontece quando o jogador encaçapa a bola 8 após todas as suas bolas

  if (gameState.gameOver || p1Remaining !== gameState.player1Balls.length || p2Remaining !== gameState.player2Balls.length) {
    saveGameState();
  }
}

function updateSessionScoreDisplay() {
  const el = document.getElementById('session-score');
  if (el) el.textContent = `Placar: Voce ${sessionScore.p1} x ${sessionScore.p2} CPU`;
}

// Helper de Confete - Versão melhorada
function spawnConfetti() {
  const container = document.getElementById('confetti-container');
  if (!container) return;

  const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#fd79a8'];
  const shapes = ['square', 'circle', 'triangle'];

  for (let i = 0; i < 100; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';

    const startX = Math.random() * 100;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const size = Math.random() * 10 + 6;
    const duration = Math.random() * 3 + 2;
    const delay = Math.random() * 0.8;
    const rotation = Math.random() * 720 - 360;
    const drift = (Math.random() - 0.5) * 200;

    confetti.style.cssText = `
      position: absolute;
      left: ${startX}%;
      top: -20px;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      opacity: 0.9;
      animation: confetti-fall ${duration}s ease-out ${delay}s forwards;
      --drift: ${drift}px;
      --rotation: ${rotation}deg;
    `;

    if (shape === 'circle') {
      confetti.style.borderRadius = '50%';
    } else if (shape === 'triangle') {
      confetti.style.width = '0';
      confetti.style.height = '0';
      confetti.style.background = 'transparent';
      confetti.style.borderLeft = `${size / 2}px solid transparent`;
      confetti.style.borderRight = `${size / 2}px solid transparent`;
      confetti.style.borderBottom = `${size}px solid ${color}`;
    }

    container.appendChild(confetti);

    // Remover após animação
    setTimeout(() => confetti.remove(), (duration + delay) * 1000 + 100);
  }
}

// Mostra mensagem de vitória
function showVictoryMessage(winner: string, customMessage?: string, reason?: string) {
  // Parar cronômetro da partida
  stopMatchTimer();

  const msgEl = document.getElementById('game-message');
  if (msgEl) {
    msgEl.innerHTML = `🏆 <strong>${winner}</strong> VENCEU! 🎉`;
    msgEl.style.color = 'var(--accent-green)';
    msgEl.style.fontSize = '1.5rem';
  }

  const instructionsEl = document.getElementById('game-instructions');
  if (instructionsEl) {
    instructionsEl.textContent = 'Parabéns!';
  }

  // Exibir Overlay de Game Over
  const overlay = document.getElementById('game-over-overlay');
  const winnerTitle = document.getElementById('winner-title');
  const winnerMsg = document.getElementById('winner-message');
  const statTurns = document.getElementById('stat-turns');
  const statTime = document.getElementById('stat-time');
  const avatarContainer = document.querySelector('.winner-avatar-container');

  // Personalizar mensagem baseada no contexto
  if (winnerTitle) winnerTitle.textContent = `${winner}`;

  const isWinnerMe = winner === (gameStore.getState().user?.username || 'Você');

  // Atualizar avatar/emoji baseado no resultado
  if (avatarContainer) {
    if (isWinnerMe) {
      avatarContainer.textContent = '👑';
    } else if (gameState.isAI) {
      avatarContainer.textContent = '🤖';
    } else {
      avatarContainer.textContent = '😔';
    }
  }

  if (winnerMsg) {
    if (customMessage) {
      winnerMsg.textContent = customMessage;
    } else if (reason === 'forfeit') {
      winnerMsg.textContent = isWinnerMe ? '🎉 Seu oponente abandonou! Vitória garantida!' : 'Você abandonou a partida.';
    } else if (isWinnerMe) {
      winnerMsg.textContent = '🎱 Você dominou a mesa! Parabéns!';
    } else if (gameState.isAI) {
      winnerMsg.textContent = '🤖 A máquina venceu desta vez. Tente novamente!';
    } else {
      winnerMsg.textContent = '💪 Boa tentativa! Na próxima você consegue!';
    }
  }

  if (statTurns) statTurns.textContent = `${gameState.turn}`;
  if (statTime) statTime.textContent = gameState.gameMode === '9ball' ? '4x4' : '8 Bolas';

  if (overlay) {
    // Adicionar classe de derrota se não for o vencedor
    if (!isWinnerMe) {
      overlay.classList.add('defeat');
    } else {
      overlay.classList.remove('defeat');
    }

    overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
      overlay.classList.add('active');
    });

    // Tocar som e disparar confetes
    if (isWinnerMe) {
      audioEngine.playVictory();
      spawnConfetti();
      // Mais confetes após um delay
      setTimeout(() => spawnConfetti(), 500);
      setTimeout(() => spawnConfetti(), 1000);
    } else {
      audioEngine.playDefeat();
    }
  }

  // Atualizar ranking vs CPU se for partida contra IA
  if (gameState.isAI) {
    updateAIRanking(isWinnerMe);
  }

  // Buscar informações de nível atualizadas
  updateLevelProgressUI();

  // IMPORTANTE: Salvar o estado com gameOver = true
  // Assim se a página recarregar, a tela de vitória será mostrada novamente
  // O estado só será limpo quando o jogador sair do jogo ou jogar novamente
  saveGameState();
}

// Atualiza o ranking vs CPU no backend
async function updateAIRanking(isWin: boolean) {
  try {
    await api.request('/ai-ranking/record', {
      method: 'POST',
      body: JSON.stringify({
        won: isWin
      })
    });
    console.log('[GamePage] Ranking vs CPU atualizado:', isWin ? 'Vitória' : 'Derrota');
  } catch (err) {
    console.error('[GamePage] Erro ao atualizar ranking vs CPU:', err);
  }
}

// Atualiza a UI de progresso de nível no Game Over
async function updateLevelProgressUI() {
  try {
    // Buscar perfil atual do usuário
    const response = await api.request('/auth/me');
    const user = (response as any)?.user;

    if (!user) return;

    const levelDisplay = document.getElementById('current-level-display');
    const xpBar = document.getElementById('xp-progress-bar');
    const xpText = document.getElementById('xp-text-display');
    const xpGained = document.getElementById('xp-gained-display');

    if (levelDisplay) levelDisplay.textContent = String(user.level || 1);
    if (xpText) xpText.textContent = `${user.xp || 0} / 100 XP`;
    if (xpBar) {
      const percentage = Math.min(100, (user.xp || 0));
      xpBar.style.width = `${percentage}%`;
    }

    // Mostrar animação de XP ganho (valor fixo baseado na regra atual)
    if (xpGained) {
      const isWinner = gameState.winner === (user.username || 'Você');
      const gained = gameState.isAI ? (isWinner ? 30 : 10) : (isWinner ? 50 : 15);

      xpGained.textContent = `+${gained} XP`;
      setTimeout(() => {
        xpGained.style.opacity = '1';
        xpGained.style.transform = 'translateY(0)';
      }, 500);
    }

    // Atualizar store global
    gameStore.setUser(user);

  } catch (err) {
    console.error('[GamePage] Erro ao atualizar UI de nível:', err);
  }
}

// ==================== TROCA DE TURNO ====================

function handleTurnEnd(pocketedValidBall: boolean, room: any) {
  // Se encaçapou bola válida e não cometeu falta, continua jogando
  if (pocketedValidBall && !gameState.foulCommitted) {
    gameState.turnTimer = TURN_TIME;
    gameState.wrongBallHit = false;
    firstBallHit = null;
    saveGameState(); // Salvar estado (bolas moveram)
    return;
  }

  // Se não acertou nenhuma bola ou acertou bola errada, aplica penalidade
  if (!firstBallHit && gameState.player1Type && gameState.player2Type) {
    // Não acertou nenhuma bola - falta
    showFoulMessage('no_hit');
    applyFoulPenalty();
  } else if (gameState.wrongBallHit) {
    // Acertou bola do adversário - penalidade já aplicada em checkFoul
    applyFoulPenalty();
  }

  switchPlayer();
  // Se houve falta, ativa Ball in Hand APENAS se não for 9ball (regra brasileira usa penalidade de bola)
  if (gameState.foulCommitted) {
    if (gameState.gameMode !== '9ball') {
      gameState.ballInHand = true;
    } else {
      gameState.ballInHand = false; // Sem ball in hand no modo BR
    }
  } else {
    gameState.ballInHand = false;
  }

  gameState.turnTimer = TURN_TIME;
  gameState.foulCommitted = false;
  gameState.wrongBallHit = false;
  firstBallHit = null;

  if (gameState.isMultiplayer) {
    const newPlayerId = gameState.currentPlayer === 1
      ? (roomData.owner_id || roomData.owner?.id)
      : (roomData.guest_id || roomData.guest?.id);

    realtimeService.sendTurnChange({
      currentPlayerId: newPlayerId,
      previousPlayerId: gameState.myPlayerId!,
      reason: gameState.foulCommitted ? 'foul' : 'miss',
      turnNumber: gameState.turn
    });
  }

  // Salvar progresso
  saveGameState();

  updateUI(room);
  updateBallsDisplay();

  if (gameState.isAI && gameState.currentPlayer === 2 && !gameState.gameOver) {
    setTimeout(makeAIMove, 1000);
  }
}

function switchPlayer() {
  const previousPlayer = gameState.currentPlayer;
  gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
  gameState.turn++;

  if (gameState.isMultiplayer) {
    const isOwner = roomData.owner_id === gameState.myPlayerId || roomData.owner?.id === gameState.myPlayerId;
    gameState.isMyTurn = (gameState.currentPlayer === 1 && isOwner) || (gameState.currentPlayer === 2 && !isOwner);
  }

  // Mostra mensagem de troca de turno usando a função existente
  const currentPlayerName = gameState.currentPlayer === 1
    ? (roomData?.owner?.username || roomData?.player1?.username || 'Jogador 1')
    : (gameState.isAI ? '🤖 CPU' : (roomData?.guest?.username || roomData?.player2?.username || 'Jogador 2'));

  showTurnChangeMessage(currentPlayerName);
}

// ==================== UI ====================

function updateUI(room: any) {
  const p1Score = document.getElementById('player1-score');
  const p2Score = document.getElementById('player2-score');
  const p1Type = document.getElementById('player1-type');
  const p2Type = document.getElementById('player2-type');
  const p1Info = document.getElementById('player1-info');
  const p2Info = document.getElementById('player2-info');
  const turnInfo = document.getElementById('turn-info');
  const message = document.getElementById('game-message');
  const instructions = document.getElementById('game-instructions');

  if (p1Score) p1Score.textContent = String(gameState.player1Score);
  if (p2Score) p2Score.textContent = String(gameState.player2Score);
  if (p1Type) p1Type.textContent = getTypeLabel(gameState.player1Type);
  if (p2Type) p2Type.textContent = getTypeLabel(gameState.player2Type);
  if (p1Info) p1Info.classList.toggle('active', gameState.currentPlayer === 1);
  if (p2Info) p2Info.classList.toggle('active', gameState.currentPlayer === 2);
  if (turnInfo) turnInfo.textContent = `Turno ${gameState.turn}`;

  const player1Name = room.owner?.username || room.player1?.username || 'Jogador 1';
  const player2Name = gameState.isAI ? '🤖 CPU' : (room.guest?.username || room.player2?.username || 'Jogador 2');

  if (message) {
    if (gameState.gameOver) {
      message.innerHTML = `🏆 <strong style="color:var(--accent-green)">${gameState.winner}</strong> VENCEU! 🎉`;
    } else {
      const currentName = gameState.currentPlayer === 1 ? player1Name : player2Name;
      const isMyTurn = gameState.isMultiplayer ? gameState.isMyTurn : (gameState.currentPlayer === 1);

      let targetInfo = '';
      if (!gameState.player1Type) {
        targetInfo = ' <span style="color:var(--accent-yellow)">(Mesa Aberta!)</span>';
      } else {
        const myBalls = gameState.currentPlayer === 1 ? gameState.player1Balls : gameState.player2Balls;
        const remaining = myBalls.filter(n => {
          const ball = gameState.balls.find(b => b.number === n);
          return ball && !ball.pocketed;
        });

        if (remaining.length === 0) {
          targetInfo = ' <span style="color:#ffcc00">(Bata na BOLA 8!)</span>';
        } else {
          const pType = gameState.currentPlayer === 1 ? gameState.player1Type : gameState.player2Type;
          const typeLabel = (pType === 'solid') ? 'Lisas' : 'Listradas';
          targetInfo = ` <span style="color:var(--accent-green)">(Bata nas ${typeLabel})</span>`;
        }
      }

      message.innerHTML = `🎯 <strong>${isMyTurn ? 'Sua vez!' : currentName}</strong>${targetInfo}`;
    }
  }

  if (instructions) {
    if (gameState.isMultiplayer) {
      if (gameState.isMyTurn) {
        instructions.innerHTML = '🎯 <strong>Sua vez!</strong> Arraste a bola branca para mirar e solte para tacar.';
        instructions.style.color = 'var(--accent-green)';
      } else {
        instructions.textContent = `Aguardando ${gameState.currentPlayer === 1 ? player1Name : player2Name} jogar...`;
        instructions.style.color = 'var(--text-muted)';
      }
    }
  }

  updateTimerDisplay();
}

// ==================== GAME LOOP ====================

let lastMoving = false;
let lastBallsSyncTime = 0;

function gameLoop(room: any) {
  // Limpar o set de bolas processadas no início de cada frame
  processedPocketedBalls.clear();
  // ==================== VERIFICAÇÃO DE SEGURANÇA DA BOLA BRANCA ====================
  // Garantir que a bola branca sempre exista e esteja visível na mesa
  const cueBallCheck = gameState.balls.find(b => b.type === 'cue');
  if (cueBallCheck) {
    // Se a bola branca está fora dos limites da mesa ou marcada como pocketed por muito tempo
    const isOutOfBounds = cueBallCheck.x < 0 || cueBallCheck.x > TABLE_WIDTH ||
      cueBallCheck.y < 0 || cueBallCheck.y > TABLE_HEIGHT;

    if (isOutOfBounds || (cueBallCheck.pocketed && !cueBallCheck.inMotion)) {
      // Reposicionar bola branca no centro da mesa
      cueBallCheck.pocketed = false;
      cueBallCheck.x = TABLE_WIDTH / 2;
      cueBallCheck.y = TABLE_HEIGHT / 2;
      cueBallCheck.vx = 0;
      cueBallCheck.vy = 0;
      cueBallCheck.inMotion = false;
      console.log('🎱 Bola branca recuperada - estava fora da mesa ou encaçapada');
    }
  }

  // Atualizar física
  const physicsResult = updatePhysics(gameState.balls as unknown as PhysicsBall[]);

  // Processar eventos de física
  for (const collision of physicsResult.ballCollisions) {
    audioEngine.playBallCollision(collision.impactSpeed);

    // Verificar falta na primeira colisão com bola branca
    const cueBall = gameState.balls.find(b => b.type === 'cue');
    if (collision.ball1 === cueBall || collision.ball2 === cueBall) {
      const otherBall = collision.ball1 === cueBall ? collision.ball2 : collision.ball1;
      checkFoul(otherBall as Ball);
    }
  }

  for (const cushionHit of physicsResult.cushionHits) {
    audioEngine.playCushionHit(cushionHit.impactSpeed);
  }

  for (const pocketEvent of physicsResult.pocketEvents) {
    if (pocketEvent.pocketed) {
      handlePocket(pocketEvent.ball as Ball);
    }
  }

  // Sincronizar bolas durante movimento (multiplayer)
  const moving = areBallsMoving(gameState.balls as unknown as PhysicsBall[]);
  const now = Date.now();

  if (gameState.isMultiplayer && gameState.isMyTurn && moving) {
    // Enviar atualizações a cada 100ms durante movimento
    if (now - lastBallsSyncTime >= 100) {
      lastBallsSyncTime = now;
      realtimeService.sendBallsUpdate(gameState.balls.map(b => ({
        id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy,
        pocketed: b.pocketed, color: b.color, number: String(b.number), type: b.type
      })));
    }
  }

  // Renderizar
  if (renderer) {
    const cueBall = gameState.balls.find(b => b.type === 'cue' && !b.pocketed);
    const player1Name = room.owner?.username || room.player1?.username || 'Jogador 1';
    const player2Name = gameState.isAI ? '🤖 CPU' : (room.guest?.username || room.player2?.username || 'Jogador 2');

    const renderState: RenderState = {
      balls: gameState.balls as unknown as PhysicsBall[],
      cue: gameState.cueState,
      showAimLine: gameState.isAiming && aimLineEnabled, // Respeita configuração da sala
      showPowerBar: gameState.isAiming && gameState.aimPower > 0,
      showSpinIndicator: false,
      gamePhase: gameState.gameOver ? 'gameover' : (!gameState.player1Type ? 'opening' : (gameState.isAiming ? 'aiming' : (moving ? 'watching' : 'aiming'))),
      currentPlayer: gameState.currentPlayer === 1 ? player1Name : player2Name,
      player1: {
        name: player1Name,
        score: gameState.player1Score,
        ballType: gameState.player1Type === 'solid' ? 'solid' : (gameState.player1Type === 'stripe' ? 'stripe' : undefined)
      },
      player2: {
        name: player2Name,
        score: gameState.player2Score,
        ballType: gameState.player2Type === 'solid' ? 'solid' : (gameState.player2Type === 'stripe' ? 'stripe' : undefined)
      },
      winner: gameState.winner || undefined,
      message: gameState.gameOver ? `🏆 ${gameState.winner} venceu!` : undefined,
      // Informações para destacar bolas - baseado no jogador LOCAL, não no turno atual
      // Em single player (IA): você é sempre player 1
      // Em multiplayer: verificar myPlayerId
      myBallType: getMyBallType(),
      myBalls: getMyBalls(),
      opponentBalls: getOpponentBalls()
    };

    renderer.render(renderState);
  }

  // Verificar fim de movimento
  if (lastMoving && !moving) {
    const validPocket = gameState.lastPocketedBall && !gameState.foulCommitted;

    // Enviar estado final das bolas
    if (gameState.isMultiplayer && gameState.isMyTurn) {
      realtimeService.sendBallsUpdate(gameState.balls.map(b => ({
        id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy,
        pocketed: b.pocketed, color: b.color, number: String(b.number), type: b.type
      })));
    }

    handleTurnEnd(!!validPocket, room);
    gameState.lastPocketedBall = null;

    if (gameState.isAI && gameState.currentPlayer === 2 && !gameState.gameOver) {
      setTimeout(() => makeAIMove(), 1000);
    }
  }

  lastMoving = moving;
  animationId = requestAnimationFrame(() => gameLoop(room));
}
