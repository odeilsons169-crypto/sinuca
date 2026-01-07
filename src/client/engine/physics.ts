// =====================================================
// ENGINE DE FÍSICA PROFISSIONAL PARA SINUCA
// Versão 3.3 - Física Realista com Bola na Beira da Caçapa
// =====================================================

// =====================================================
// CONSTANTES DE FÍSICA - BALANCEADAS PARA JOGABILIDADE
// Meio termo entre realismo e diversão
// =====================================================
export const PHYSICS = {
  // Mesa (proporção 2:1 aumentada)
  TABLE_WIDTH: 1400,
  TABLE_HEIGHT: 700,
  CUSHION_WIDTH: 22,
  RAIL_WIDTH: 70,

  // Bolas - tamanho proporcional realista (57.15mm = 2.25")
  BALL_RADIUS: 14,
  BALL_MASS: 0.17, // kg - bola de sinuca padrão

  // =====================================================
  // COLISÕES - Valores balanceados
  // =====================================================

  // Restituição bola-bola: bolas se espalham bem
  BALL_BALL_RESTITUTION: 0.94,

  // Restituição tabela: rebote bom nas tabelas
  BALL_CUSHION_RESTITUTION: 0.80,

  // =====================================================
  // ATRITO - REDUZIDO para movimento mais fluido
  // =====================================================

  // Atrito do pano: baixo para bolas deslizarem bem
  CLOTH_FRICTION: 0.006,

  // Atrito de rolamento: mínimo
  ROLLING_FRICTION: 0.003,

  // Atrito nas tabelas (borracha)
  CUSHION_FRICTION: 0.08,

  // Atrito de deslizamento
  SLIDING_FRICTION: 0.01,

  // =====================================================
  // VELOCIDADES E LIMITES - AUMENTADOS
  // =====================================================

  // Velocidade mínima antes de parar
  MIN_VELOCITY: 0.2,

  // Força máxima da tacada
  MAX_SHOT_POWER: 50,

  // Multiplicador de força da tacada - AUMENTADO para mais velocidade
  SHOT_POWER_MULTIPLIER: 1.8,

  // Amortecimento por frame - quase nenhum para movimento livre
  VELOCITY_DAMPING: 0.9995,

  // =====================================================
  // CAÇAPAS - Área de DETECÇÃO (física) vs VISUAL
  // A área de detecção é maior que o visual para melhor jogabilidade
  // =====================================================

  // Raios das caçapas para DETECÇÃO FÍSICA - área onde a bola pode cair
  // Estes valores são MAIORES para garantir que o "funil" funcione bem
  CORNER_POCKET_RADIUS: 42,  // Aumentado para cobrir a área do chanfro
  SIDE_POCKET_RADIUS: 38,    // Aumentado para as laterais

  // Tolerância de entrada - quanto da bola precisa entrar para cair
  // Valor MAIOR = mais difícil (precisa estar mais centralizado)
  POCKET_TOLERANCE: 0.65,

  // Velocidade máxima para entrar na caçapa (bola muito rápida pode pular fora)
  MAX_POCKET_ENTRY_SPEED: 50,

  // =====================================================
  // FÍSICA DA BEIRA DA CAÇAPA (Lip/Edge Physics)
  // Simplificada para evitar bolas "penduradas" irreais
  // =====================================================

  // Velocidade mínima para a bola cair quando está na beira
  POCKET_EDGE_FALL_SPEED: 0.8,

  // Força de "gravidade" puxando a bola para dentro da caçapa
  POCKET_GRAVITY_FORCE: 0.6, // Aumentado para melhor sucção no funil

  // Zona onde a bola pode ficar "pendurada" (% do raio da caçapa) - REDUZIDA
  POCKET_EDGE_ZONE: 0.85,

  // Atrito extra na beira da caçapa (bola desacelera mais)
  POCKET_EDGE_FRICTION: 0.08,

  // =====================================================
  // SIMULAÇÃO DE ALTA PRECISÃO
  // =====================================================

  // Substeps para precisão de colisão
  SUBSTEPS: 5,

  // Gravidade (para cálculos de atrito)
  GRAVITY: 9.81,

  // =====================================================
  // SPIN (Efeito) - Sistema avançado
  // =====================================================
  SPIN_DECAY: 0.99,
  SPIN_TRANSFER: 0.3,
  SPIN_FRICTION_MULTIPLIER: 1.0,

  // Throw effect (desvio causado por spin na colisão)
  THROW_FACTOR: 0.015,

  // Curva da bola com efeito lateral (massé)
  CURVE_FACTOR: 0.008,
};

// =====================================================
// CAÇAPAS - Posições e configurações
// Bocas posicionadas nos cantos e laterais da mesa
// Posições ajustadas para visual mais realista
// =====================================================
export const POCKETS = [
  // Cantos - Exatamente na junção física (0,0)
  { x: 0, y: 0, radius: 45, type: 'corner' as const },
  { x: 1400, y: 0, radius: 45, type: 'corner' as const },
  { x: 0, y: 700, radius: 45, type: 'corner' as const },
  { x: 1400, y: 700, radius: 45, type: 'corner' as const },
  // Laterais
  { x: 1400 / 2, y: -8, radius: 38, type: 'side' as const },
  { x: 1400 / 2, y: 708, radius: 38, type: 'side' as const },
];

// =====================================================
// INTERFACE DA BOLA
// =====================================================
export interface PhysicsBall {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Spin components
  spinX: number;      // Efeito lateral
  spinY: number;      // Efeito frontal
  spinZ: number;      // Rotação vertical
  angularVelocity: number;
  mass: number;
  radius: number;
  pocketed: boolean;
  inMotion: boolean;
  // Animação de queda
  falling: boolean;
  fallProgress: number;
  fallPocket: { x: number; y: number } | null;
  inPocketAnimation: boolean;
  pocketAnimationProgress: number;
  // Visual
  color: string;
  number: number;
  type: 'solid' | 'stripe' | 'cue' | 'eight';
}

// =====================================================
// FUNÇÕES DE FÍSICA
// =====================================================

/**
 * Aplica tacada na bola branca
 * Força proporcional ao quanto o taco é puxado
 */
export function applyCueShot(
  cueBall: PhysicsBall,
  directionX: number,
  directionY: number,
  power: number,
  spinX: number = 0,
  spinY: number = 0
): void {
  // Limitar força máxima
  const clampedPower = Math.min(power, PHYSICS.MAX_SHOT_POWER);

  // Curva de potência mais linear - resposta direta à força do jogador
  // Tacada fraca = movimento suave, tacada forte = movimento rápido
  const normalizedPower = clampedPower / PHYSICS.MAX_SHOT_POWER;

  // Curva suave: tacadas fracas têm boa resposta, fortes são proporcionais
  const curvedPower = Math.pow(normalizedPower, 1.1) * PHYSICS.MAX_SHOT_POWER;

  // Aplicar velocidade
  const velocity = curvedPower * PHYSICS.SHOT_POWER_MULTIPLIER;
  cueBall.vx = directionX * velocity;
  cueBall.vy = directionY * velocity;

  // Sistema de spin (efeito)
  cueBall.spinX = spinX * normalizedPower * 0.1;
  cueBall.spinY = spinY * normalizedPower * 0.1;

  // Rotação inicial
  cueBall.angularVelocity = velocity / cueBall.radius;
  cueBall.spinZ = velocity * 0.05;

  cueBall.inMotion = true;
}

/**
 * Aplica atrito do pano - desaceleração suave e natural
 * Bolas devem rolar livremente e parar gradualmente
 */
function applyFriction(ball: PhysicsBall, dt: number): void {
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

  // Parar se velocidade muito baixa
  if (speed < PHYSICS.MIN_VELOCITY) {
    ball.vx = 0;
    ball.vy = 0;
    ball.angularVelocity = 0;
    ball.spinX = 0;
    ball.spinY = 0;
    ball.spinZ = 0;
    return;
  }

  // ========== ATRITO SIMPLES E SUAVE ==========
  // Atrito baixo para movimento fluido
  // A bola desacelera gradualmente

  const baseFriction = PHYSICS.CLOTH_FRICTION + PHYSICS.ROLLING_FRICTION;

  // Desaceleração proporcional (mais suave que constante)
  // Bolas rápidas mantêm velocidade, bolas lentas param mais rápido
  const frictionFactor = 1 - (baseFriction * dt * 60);

  ball.vx *= frictionFactor;
  ball.vy *= frictionFactor;

  // Velocidade angular proporcional à velocidade linear
  ball.angularVelocity = speed / ball.radius;

  // Decaimento do spin
  ball.spinX *= PHYSICS.SPIN_DECAY;
  ball.spinY *= PHYSICS.SPIN_DECAY;
  ball.spinZ *= PHYSICS.SPIN_DECAY;

  // Efeito lateral causa leve curva
  if (Math.abs(ball.spinX) > 0.05 && speed > 1) {
    const curveForce = ball.spinX * PHYSICS.CURVE_FACTOR * dt * 60;
    if (speed > 0) {
      const perpX = -ball.vy / speed;
      const perpY = ball.vx / speed;
      ball.vx += perpX * curveForce;
      ball.vy += perpY * curveForce;
    }
    ball.spinX *= 0.995;
  }
}

/**
 * Colisão bola-bola - Conservação de momento realista
 * Usa física de colisão elástica com restituição e throw effect
 * Inclui separação robusta para evitar sobreposição
 */
export function resolveBallCollision(b1: PhysicsBall, b2: PhysicsBall): { impactSpeed: number } | null {
  const dx = b2.x - b1.x;
  const dy = b2.y - b1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = b1.radius + b2.radius;

  // Sem colisão
  if (dist >= minDist || dist === 0) return null;

  // Vetor normal da colisão (evitar divisão por zero)
  const nx = dist > 0.001 ? dx / dist : 1;
  const ny = dist > 0.001 ? dy / dist : 0;

  // Vetor tangente
  const tx = -ny;
  const ty = nx;

  // Velocidade relativa
  const dvx = b1.vx - b2.vx;
  const dvy = b1.vy - b2.vy;
  const dvn = dvx * nx + dvy * ny;

  // Bolas se afastando - ainda precisamos separar se estão sobrepostas
  if (dvn <= 0 && dist >= minDist * 0.95) return null;

  // Coeficiente de restituição
  const e = PHYSICS.BALL_BALL_RESTITUTION;

  // Impulso (considerando massas iguais)
  const j = -(1 + e) * dvn / 2;

  // Aplicar impulso às bolas (apenas se estavam se aproximando)
  if (dvn > 0) {
    b1.vx += j * nx;
    b1.vy += j * ny;
    b2.vx -= j * nx;
    b2.vy -= j * ny;
  }

  // ========== THROW EFFECT ==========
  // Spin lateral da bola 1 causa desvio na bola 2
  if (Math.abs(b1.spinX) > 0.1) {
    const throwForce = b1.spinX * PHYSICS.THROW_FACTOR * Math.abs(dvn);
    b2.vx += tx * throwForce;
    b2.vy += ty * throwForce;
  }

  // ========== TRANSFERÊNCIA DE SPIN ==========
  const spinTransfer = PHYSICS.SPIN_TRANSFER;

  // Transferir parte do spin
  const avgSpinX = (b1.spinX + b2.spinX) / 2;
  const avgSpinY = (b1.spinY + b2.spinY) / 2;
  const avgSpinZ = (b1.spinZ + b2.spinZ) / 2;

  b1.spinX = b1.spinX * (1 - spinTransfer) + avgSpinX * spinTransfer;
  b1.spinY = b1.spinY * (1 - spinTransfer) + avgSpinY * spinTransfer;
  b2.spinX = b2.spinX * (1 - spinTransfer) + avgSpinX * spinTransfer;
  b2.spinY = b2.spinY * (1 - spinTransfer) + avgSpinY * spinTransfer;

  // Spin Z (rotação) baseado na velocidade tangencial
  const vt = dvx * tx + dvy * ty;
  b2.spinZ += vt * 0.05;

  // ========== SEPARAÇÃO ROBUSTA ==========
  // Separar bolas completamente para evitar sobreposição persistente
  const overlap = minDist - dist;
  if (overlap > 0) {
    // Separação com margem extra para garantir que não fiquem grudadas
    const separation = (overlap / 2) + 0.5;
    b1.x -= separation * nx;
    b1.y -= separation * ny;
    b2.x += separation * nx;
    b2.y += separation * ny;
  }

  return { impactSpeed: Math.abs(dvn) };
}

// =====================================================
// GEOMETRIA DAS TABELAS (Cushions & Knuckles)
// =====================================================
// Define os obstáculos físicos das tabelas para colisão realista
// Knuckles são as pontas arredondadas das tabelas perto das caçapas

const KNUCKLE_RADIUS = 5; // Raio da ponta da tabela (quina arredondada)

// Geometria das tabelas sincronizada com o Renderer.ts
const C_H = 28;     // Espessura da tabela (Cushion Height)
const C_GAP = 55;   // Gap da caçapa de canto
const S_GAP = 45;   // Gap da caçapa lateral
const BEVEL = 45;   // Comprimento do chanfro (funil)

// Segmentos das tabelas (Linhas de colisão) posicionados para mesa 1400x700
export const CUSHION_SEGMENTS = [
  // --- SUPERIOR ESQUERDA ---
  { x1: C_GAP + BEVEL, y1: C_H, x2: 1400 / 2 - S_GAP - BEVEL, y2: C_H, normal: { x: 0, y: 1 } }, // Reta
  { x1: C_GAP, y1: 0, x2: C_GAP + BEVEL, y2: C_H, normal: { x: 0.707, y: 0.707 } }, // Bevel Canto
  { x1: 1400 / 2 - S_GAP - BEVEL, y2: C_H, x2: 1400 / 2 - S_GAP, y1: 0, normal: { x: -0.707, y: 0.707 } }, // Bevel Lateral

  // --- SUPERIOR DIREITA ---
  { x1: 1400 / 2 + S_GAP + BEVEL, y1: C_H, x2: 1400 - C_GAP - BEVEL, y2: C_H, normal: { x: 0, y: 1 } }, // Reta
  { x1: 1400 / 2 + S_GAP, y1: 0, x2: 1400 / 2 + S_GAP + BEVEL, y2: C_H, normal: { x: 0.707, y: 0.707 } }, // Bevel Lateral
  { x1: 1400 - C_GAP - BEVEL, y1: C_H, x2: 1400 - C_GAP, y2: 0, normal: { x: -0.707, y: 0.707 } }, // Bevel Canto

  // --- INFERIOR ESQUERDA ---
  { x1: C_GAP + BEVEL, y1: 700 - C_H, x2: 1400 / 2 - S_GAP - BEVEL, y2: 700 - C_H, normal: { x: 0, y: -1 } }, // Reta
  { x1: C_GAP, y1: 700, x2: C_GAP + BEVEL, y2: 700 - C_H, normal: { x: 0.707, y: -0.707 } }, // Bevel Canto
  { x1: 1400 / 2 - S_GAP - BEVEL, y1: 700 - C_H, x2: 1400 / 2 - S_GAP, y2: 700, normal: { x: -0.707, y: -0.707 } }, // Bevel Lateral

  // --- INFERIOR DIREITA ---
  { x1: 1400 / 2 + S_GAP + BEVEL, y1: 700 - C_H, x2: 1400 - C_GAP - BEVEL, y2: 700 - C_H, normal: { x: 0, y: -1 } }, // Reta
  { x1: 1400 / 2 + S_GAP, y1: 700, x2: 1400 / 2 + S_GAP + BEVEL, y2: 700 - C_H, normal: { x: 0.707, y: -0.707 } }, // Bevel Lateral
  { x1: 1400 - C_GAP - BEVEL, y1: 700 - C_H, x2: 1400 - C_GAP, y2: 700, normal: { x: -0.707, y: -0.707 } }, // Bevel Canto

  // --- LATERAL ESQUERDA ---
  { x1: C_H, y1: C_GAP + BEVEL, x2: C_H, y2: 700 - C_GAP - BEVEL, normal: { x: 1, y: 0 } }, // Reta
  { x1: 0, y1: C_GAP, x2: C_H, y2: C_GAP + BEVEL, normal: { x: 0.707, y: 0.707 } }, // Bevel Superior
  { x1: 0, y1: 700 - C_GAP, x2: C_H, y2: 700 - C_GAP - BEVEL, normal: { x: 0.707, y: -0.707 } }, // Bevel Inferior

  // --- LATERAL DIREITA ---
  { x1: 1400 - C_H, y1: C_GAP + BEVEL, x2: 1400 - C_H, y2: 700 - C_GAP - BEVEL, normal: { x: -1, y: 0 } }, // Reta
  { x1: 1400, y1: C_GAP, x2: 1400 - C_H, y2: C_GAP + BEVEL, normal: { x: -0.707, y: 0.707 } }, // Bevel Superior
  { x1: 1400, y1: 700 - C_GAP, x2: 1400 - C_H, y2: 700 - C_GAP - BEVEL, normal: { x: -0.707, y: -0.707 } }, // Bevel Inferior
];

// Pontas arredondadas (Quinas)
export const CUSHION_KNUCKLES = [
  // Pontos de transição onde o chanfro termina e começa a reta
  { x: C_GAP + BEVEL, y: C_H }, { x: 1400 / 2 - S_GAP - BEVEL, y: C_H },
  { x: 1400 / 2 + S_GAP + BEVEL, y: C_H }, { x: 1400 - C_GAP - BEVEL, y: C_H },
  { x: C_GAP + BEVEL, y: 700 - C_H }, { x: 1400 / 2 - S_GAP - BEVEL, y: 700 - C_H },
  { x: 1400 / 2 + S_GAP + BEVEL, y: 700 - C_H }, { x: 1400 - C_GAP - BEVEL, y: 700 - C_H },
  { x: C_H, y: C_GAP + BEVEL }, { x: C_H, y: 700 - C_GAP - BEVEL },
  { x: 1400 - C_H, y: C_GAP + BEVEL }, { x: 1400 - C_H, y: 700 - C_GAP - BEVEL }
];


/**
 * Verifica proximidade de caçapa para evitar colisão com tabela
 */
function getNearestPocket(ball: PhysicsBall): { pocket: typeof POCKETS[0]; dist: number } | null {
  let nearest: { pocket: typeof POCKETS[0]; dist: number } | null = null;

  for (const pocket of POCKETS) {
    const dx = ball.x - pocket.x;
    const dy = ball.y - pocket.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!nearest || dist < nearest.dist) {
      nearest = { pocket, dist };
    }
  }

  return nearest;
}

/**
 * Colisão com Tabelas - Física realista de rebote
 * Implementa reflexão precisa para permitir tabelas (bank shots)
 * NÃO bloqueia bolas que estão perto das caçapas
 */
export function resolveCushionCollision(ball: PhysicsBall): { hit: boolean; impactSpeed: number; side: string } {
  let hit = false;
  let impactSpeed = 0;
  let side = '';
  const e = PHYSICS.BALL_CUSHION_RESTITUTION;
  const friction = PHYSICS.CUSHION_FRICTION;

  // NUNCA ignora colisão por proximidade de caçapa se a bola estiver rápida
  // Isso evita que ela "atravesse" a tabela na boca
  const distToNearest = getNearestPocket(ball)?.dist || 999;
  if (distToNearest < 20) {
    return { hit: false, impactSpeed: 0, side: '' };
  }

  // 1. Colisão com Segmentos Retos das Tabelas
  for (const seg of CUSHION_SEGMENTS) {
    // Verificar se bola está no intervalo do segmento
    const minX = Math.min(seg.x1, seg.x2) - ball.radius;
    const maxX = Math.max(seg.x1, seg.x2) + ball.radius;
    const minY = Math.min(seg.y1, seg.y2) - ball.radius;
    const maxY = Math.max(seg.y1, seg.y2) + ball.radius;

    if (ball.x >= minX && ball.x <= maxX && ball.y >= minY && ball.y <= maxY) {
      let dist = 0;
      let relativeV = 0;

      if (seg.normal.x !== 0) { // Tabela vertical (esquerda/direita)
        dist = (ball.x - seg.x1) * seg.normal.x;
        relativeV = ball.vx * seg.normal.x;
      } else { // Tabela horizontal (cima/baixo)
        dist = (ball.y - seg.y1) * seg.normal.y;
        relativeV = ball.vy * seg.normal.y;
      }

      // Colisão se distância < raio E bola se movendo contra a tabela
      if (dist < ball.radius && relativeV < 0) {
        // Resolver penetração
        const overlap = ball.radius - dist;
        ball.x += seg.normal.x * overlap;
        ball.y += seg.normal.y * overlap;

        // Reflexão realista - ângulo de entrada = ângulo de saída
        if (seg.normal.x !== 0) {
          impactSpeed = Math.abs(ball.vx);
          // Reflexão com restituição
          ball.vx = -ball.vx * e;
          // Atrito lateral reduzido para manter a direção
          ball.vy *= (1 - friction * 0.15);
          // Transferência de spin
          ball.vy += ball.spinX * 0.1;
          ball.spinX *= -0.6;
          side = seg.normal.x > 0 ? 'left' : 'right';
        } else {
          impactSpeed = Math.abs(ball.vy);
          ball.vy = -ball.vy * e;
          ball.vx *= (1 - friction * 0.15);
          ball.vx += ball.spinY * 0.1;
          ball.spinY *= -0.6;
          side = seg.normal.y > 0 ? 'top' : 'bottom';
        }
        hit = true;
      }
    }
  }

  // 2. Colisão com Knuckles (Quinas arredondadas perto das caçapas)
  // Apenas se não colidiu com segmento e não está perto de caçapa
  if (!hit) {
    for (const knuckle of CUSHION_KNUCKLES) {
      const dx = ball.x - knuckle.x;
      const dy = ball.y - knuckle.y;
      const distSq = dx * dx + dy * dy;
      const minDist = ball.radius + KNUCKLE_RADIUS;

      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        if (dist < 0.001) continue; // Evitar divisão por zero

        const nx = dx / dist;
        const ny = dy / dist;
        const vn = ball.vx * nx + ball.vy * ny;

        // Apenas colide se estiver se aproximando
        if (vn < 0) {
          // Resolver penetração
          const overlap = minDist - dist;
          ball.x += nx * overlap;
          ball.y += ny * overlap;

          // Reflexão na quina
          const impulse = -(1 + e) * vn;
          ball.vx += impulse * nx;
          ball.vy += impulse * ny;

          // Atrito tangencial
          const tx = -ny;
          const ty = nx;
          const vt = ball.vx * tx + ball.vy * ty;
          ball.vx -= vt * friction * 0.5 * tx;
          ball.vy -= vt * friction * 0.5 * ty;

          hit = true;
          impactSpeed = Math.abs(vn);
          side = 'knuckle';
        }
      }
    }
  }

  return { hit, impactSpeed, side };
}

/**
 * Verificação de caçapa - Sistema SIMPLIFICADO e REALISTA
 * A bola cai quando está suficientemente dentro da caçapa
 * Sem efeito de "bola pendurada" irreal
 */
export function checkPocket(ball: PhysicsBall): {
  pocketed: boolean;
  nearMiss: boolean;
  bounceOut: boolean;
  jawHit: boolean;
  onEdge: boolean;
} {
  const ballSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

  for (const pocket of POCKETS) {
    const dx = ball.x - pocket.x;
    const dy = ball.y - pocket.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // ========== CONDIÇÃO 1: Bola dentro da caçapa - CAI SEMPRE ==========
    // Se o centro da bola está dentro de 70% do raio da caçapa, cai
    if (dist < pocket.radius * 0.7) {
      return { pocketed: true, nearMiss: false, bounceOut: false, jawHit: false, onEdge: false };
    }

    // ========== CONDIÇÃO 2: Bola na borda da caçapa ==========
    // Entre 70% e 95% do raio - verificar velocidade e direção
    if (dist < pocket.radius * 0.95) {
      // Bola lenta perto da caçapa - aplicar gravidade para puxar para dentro
      if (ballSpeed < 3) {
        // Puxar a bola para o centro da caçapa
        const pullStrength = PHYSICS.POCKET_GRAVITY_FORCE;
        const pullX = -dx / dist * pullStrength;
        const pullY = -dy / dist * pullStrength;

        ball.vx += pullX;
        ball.vy += pullY;

        // Se está muito perto e lenta, cai
        if (dist < pocket.radius * 0.8 && ballSpeed < 1.5) {
          return { pocketed: true, nearMiss: false, bounceOut: false, jawHit: false, onEdge: false };
        }
      }

      // Bola com velocidade - verificar direção
      if (ballSpeed > 0.5) {
        const toPocketX = pocket.x - ball.x;
        const toPocketY = pocket.y - ball.y;
        const toPocketDist = Math.sqrt(toPocketX * toPocketX + toPocketY * toPocketY);

        if (toPocketDist > 0.001) {
          const toPocketNormX = toPocketX / toPocketDist;
          const toPocketNormY = toPocketY / toPocketDist;
          const velNormX = ball.vx / ballSpeed;
          const velNormY = ball.vy / ballSpeed;
          const dotProduct = velNormX * toPocketNormX + velNormY * toPocketNormY;

          // Bola indo em direção ao centro - cai
          if (dotProduct > 0.2) {
            return { pocketed: true, nearMiss: false, bounceOut: false, jawHit: false, onEdge: false };
          }
        }
      }
    }

    // ========== CONDIÇÃO 3: Bola parcialmente sobre a caçapa ==========
    if (dist < pocket.radius + ball.radius * 0.3) {
      // Bola em movimento - verificar se está indo em direção ao centro
      if (ballSpeed > 1) {
        const toPocketX = pocket.x - ball.x;
        const toPocketY = pocket.y - ball.y;
        const toPocketDist = Math.sqrt(toPocketX * toPocketX + toPocketY * toPocketY);

        if (toPocketDist > 0.001) {
          const dotProduct = (ball.vx * toPocketX + ball.vy * toPocketY) / (ballSpeed * toPocketDist);

          // Bola muito rápida pode "pular" fora da caçapa
          if (ballSpeed > PHYSICS.MAX_POCKET_ENTRY_SPEED) {
            if (dotProduct > 0.8 && dist < pocket.radius * 0.6) {
              return { pocketed: true, nearMiss: false, bounceOut: false, jawHit: false, onEdge: false };
            }
            return { pocketed: false, nearMiss: false, bounceOut: true, jawHit: true, onEdge: false };
          }

          // Bola em velocidade normal indo para a caçapa
          if (dotProduct > 0.3 && dist < pocket.radius * 0.9) {
            return { pocketed: true, nearMiss: false, bounceOut: false, jawHit: false, onEdge: false };
          }
        }
      }

      // Near miss - bola passou perto mas não entrou
      const overlap = (pocket.radius + ball.radius * 0.3 - dist) / ball.radius;
      if (overlap > 0.1 && overlap < 0.3) {
        return { pocketed: false, nearMiss: true, bounceOut: false, jawHit: false, onEdge: false };
      }
    }

    // ========== CONDIÇÃO 4: Bola batendo na borda da caçapa (jaw) ==========
    const jawDistance = pocket.radius + ball.radius * 0.6;
    if (dist < jawDistance && dist > pocket.radius * 0.8) {
      if (ballSpeed > 5) {
        const toPocketX = pocket.x - ball.x;
        const toPocketY = pocket.y - ball.y;
        const toPocketDist = Math.sqrt(toPocketX * toPocketX + toPocketY * toPocketY);

        if (toPocketDist > 0.001) {
          const dotProduct = (ball.vx * toPocketX + ball.vy * toPocketY) / (ballSpeed * toPocketDist);

          if (dotProduct > 0.1 && dotProduct < 0.5) {
            applyJawBounce(ball, pocket, dx, dy, dist);
            return { pocketed: false, nearMiss: false, bounceOut: false, jawHit: true, onEdge: false };
          }
        }
      }
    }
  }

  return { pocketed: false, nearMiss: false, bounceOut: false, jawHit: false, onEdge: false };
}

/**
 * Aplica ricochete quando a bola bate na borda (jaw) da caçapa
 */
function applyJawBounce(ball: PhysicsBall, pocket: typeof POCKETS[0], dx: number, dy: number, dist: number): void {
  // Vetor normal da borda da caçapa (apontando para fora)
  const nx = dx / dist;
  const ny = dy / dist;

  // Velocidade na direção normal
  const vn = ball.vx * nx + ball.vy * ny;

  // Só aplica bounce se a bola está se movendo em direção à caçapa
  if (vn < 0) {
    // Coeficiente de restituição para a borda da caçapa (menor que tabela)
    const jawRestitution = 0.6;

    // Reflexão
    ball.vx -= (1 + jawRestitution) * vn * nx;
    ball.vy -= (1 + jawRestitution) * vn * ny;

    // Empurrar a bola para fora da zona de colisão
    const pushOut = pocket.radius + ball.radius * 0.9 - dist;
    if (pushOut > 0) {
      ball.x += nx * pushOut;
      ball.y += ny * pushOut;
    }
  }
}

/**
 * LIMITE RÍGIDO DA MESA - Garante que bolas NUNCA saiam da área de jogo
 * Esta é uma verificação de segurança final que corrige qualquer erro de física
 * que possa fazer a bola "escapar" da mesa em colisões muito fortes
 */
/**
 * Verifica se a bola está perto de uma caçapa
 * Se estiver, não aplica o limite rígido para permitir que caia
 * Zona de tolerância REDUZIDA para física mais realista
 */
function isNearPocket(ball: PhysicsBall): boolean {
  for (const pocket of POCKETS) {
    const dx = ball.x - pocket.x;
    const dy = ball.y - pocket.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Zona de tolerância maior para permitir entrada no funil
    // Se a bola está a menos de 100px ( Mouth do chanfro), ela pode cair
    const toleranceZone = 110;

    if (dist < toleranceZone) {
      return true;
    }
  }
  return false;
}

/**
 * LIMITE RÍGIDO DA MESA - Garante que bolas NUNCA saiam da área de jogo
 * MAS permite que bolas cheguem às caçapas para cair
 */
function enforceTableBounds(ball: PhysicsBall): void {
  // Só permite atravessar o limite se a bola já estiver "caindo"
  if (ball.pocketed || ball.falling) {
    return;
  }

  const minX = ball.radius;
  const maxX = PHYSICS.TABLE_WIDTH - ball.radius;
  const minY = ball.radius;
  const maxY = PHYSICS.TABLE_HEIGHT - ball.radius;

  // Verificar se a bola está fora dos limites
  let corrected = false;

  // Limite esquerdo
  if (ball.x < minX) {
    ball.x = minX;
    ball.vx = Math.abs(ball.vx) * PHYSICS.BALL_CUSHION_RESTITUTION;
    corrected = true;
  }

  // Limite direito
  if (ball.x > maxX) {
    ball.x = maxX;
    ball.vx = -Math.abs(ball.vx) * PHYSICS.BALL_CUSHION_RESTITUTION;
    corrected = true;
  }

  // Limite superior
  if (ball.y < minY) {
    ball.y = minY;
    ball.vy = Math.abs(ball.vy) * PHYSICS.BALL_CUSHION_RESTITUTION;
    corrected = true;
  }

  // Limite inferior
  if (ball.y > maxY) {
    ball.y = maxY;
    ball.vy = -Math.abs(ball.vy) * PHYSICS.BALL_CUSHION_RESTITUTION;
    corrected = true;
  }

  // Verificação extra: limitar velocidade máxima para movimento realista
  const maxVelocity = 60;
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  if (speed > maxVelocity) {
    const scale = maxVelocity / speed;
    ball.vx *= scale;
    ball.vy *= scale;
  }
}

/**
 * Atualiza física de todas as bolas - Loop principal
 */
export function updatePhysics(balls: PhysicsBall[], deltaTime: number = 1 / 60): {
  ballCollisions: { ball1: PhysicsBall; ball2: PhysicsBall; impactSpeed: number }[];
  cushionHits: { ball: PhysicsBall; impactSpeed: number; side: string }[];
  pocketEvents: { ball: PhysicsBall; pocketed: boolean }[];
} {
  const ballCollisions: { ball1: PhysicsBall; ball2: PhysicsBall; impactSpeed: number }[] = [];
  const cushionHits: { ball: PhysicsBall; impactSpeed: number; side: string }[] = [];
  const pocketEvents: { ball: PhysicsBall; pocketed: boolean }[] = [];

  const activeBalls = balls.filter(b => !b.pocketed);
  const subDelta = deltaTime / PHYSICS.SUBSTEPS;

  // Fator de escala de tempo - 60 para movimento normal
  const timeScale = 60;

  // Substeps para precisão de colisão
  for (let step = 0; step < PHYSICS.SUBSTEPS; step++) {
    // Integração de velocidade (mover bolas)
    for (const ball of activeBalls) {
      // Se já caiu neste frame, ignora
      if (ball.pocketed) continue;

      // Movimento suave com escala de tempo
      ball.x += ball.vx * subDelta * timeScale;
      ball.y += ball.vy * subDelta * timeScale;

      // Amortecimento por frame (muito sutil)
      ball.vx *= PHYSICS.VELOCITY_DAMPING;
      ball.vy *= PHYSICS.VELOCITY_DAMPING;

      // 1. Verificar Caçapas PRIMEIRO (Prioridade máxima)
      // Evita que bola quique na tabela se já deveria ter caído
      const pocketResult = checkPocket(ball);
      if (pocketResult.pocketed) {
        pocketEvents.push({ ball, pocketed: true });
        ball.pocketed = true;
        ball.vx = 0;
        ball.vy = 0;
        continue; // Para de processar esta bola
      }

      // Se a bola está na beira da caçapa, não processar colisões com tabela
      // Isso permite que a bola "balance" na beira sem ser empurrada para fora
      if (pocketResult.onEdge) {
        continue; // Pula colisões com tabela para esta bola
      }

      // 2. Colisões com Tabelas (Geometria Realista)
      const cushionResult = resolveCushionCollision(ball);
      if (cushionResult.hit) {
        cushionHits.push({
          ball,
          impactSpeed: cushionResult.impactSpeed,
          side: cushionResult.side
        });
      }

      // 3. LIMITE RÍGIDO - Garantir que bola NUNCA saia da mesa
      // Esta é uma verificação de segurança final após todas as colisões
      enforceTableBounds(ball);
    }

    // 4. Detecção e resolução de colisões bola-bola
    for (let i = 0; i < activeBalls.length; i++) {
      if (activeBalls[i].pocketed) continue;

      for (let j = i + 1; j < activeBalls.length; j++) {
        if (activeBalls[j].pocketed) continue;

        const result = resolveBallCollision(activeBalls[i], activeBalls[j]);
        if (result) {
          ballCollisions.push({
            ball1: activeBalls[i],
            ball2: activeBalls[j],
            impactSpeed: result.impactSpeed
          });

          // Após colisão bola-bola, garantir que ambas estão dentro dos limites
          enforceTableBounds(activeBalls[i]);
          enforceTableBounds(activeBalls[j]);
        }
      }
    }
  }

  // Aplicar atrito (uma vez por frame, não por substep)
  for (const ball of activeBalls) {
    if (!ball.pocketed) {
      applyFriction(ball, deltaTime);

      // Verificação final de segurança - garantir que bola está dentro da mesa
      enforceTableBounds(ball);
    }
  }

  return { ballCollisions, cushionHits, pocketEvents };
}

/**
 * Verifica se alguma bola está em movimento
 */
export function areBallsMoving(balls: PhysicsBall[]): boolean {
  return balls.some(b => !b.pocketed &&
    (Math.abs(b.vx) > PHYSICS.MIN_VELOCITY || Math.abs(b.vy) > PHYSICS.MIN_VELOCITY)
  );
}

/**
 * Cria uma nova bola com valores padrão
 */
export function createBall(
  id: number,
  x: number,
  y: number,
  color: string,
  number: number,
  type: 'solid' | 'stripe' | 'cue' | 'eight'
): PhysicsBall {
  return {
    id,
    x,
    y,
    vx: 0,
    vy: 0,
    spinX: 0,
    spinY: 0,
    spinZ: 0,
    angularVelocity: 0,
    mass: PHYSICS.BALL_MASS,
    radius: PHYSICS.BALL_RADIUS,
    pocketed: false,
    inMotion: false,
    falling: false,
    fallProgress: 0,
    fallPocket: null,
    inPocketAnimation: false,
    pocketAnimationProgress: 0,
    color,
    number,
    type,
  };
}
