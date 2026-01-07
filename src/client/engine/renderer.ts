import * as THREE from 'three';
import { type PhysicsBall } from './physics.js';

// =====================================================
// RENDERIZADOR SINUCA 2D PROFISSIONAL V2
// Tabelas verde escuro, caçapas dentro da madeira
// =====================================================

export interface CueState {
  visible: boolean;
  angle: number;
  pullBack: number;
  power: number;
  x: number;
  y: number;
  contactX: number;
  contactY: number;
}

export interface PlayerInfo {
  name: string;
  score: number;
  ballType?: 'solid' | 'stripe' | 'red' | 'blue' | 'odd' | 'even';
}

export interface RenderState {
  balls: PhysicsBall[];
  cue: CueState;
  showAimLine: boolean;
  showPowerBar: boolean;
  showSpinIndicator: boolean;
  gamePhase: string;
  currentPlayer?: string;
  player1?: PlayerInfo;
  player2?: PlayerInfo;
  winner?: string;
  message?: string;
  myBallType?: 'solid' | 'stripe' | 'red' | 'blue' | 'odd' | 'even' | null;
  myBalls?: number[];
  opponentBalls?: number[];
}

// Dimensões da mesa
const TABLE = {
  width: 1400,
  height: 700,
  woodBorder: 70,
  cushion: 28,
  pocketR: 26,
  cornerCut: 45,
};

// Cores como na REFERÊNCIA
const COLORS = {
  felt: '#1a7a3a',           // Feltro verde escuro tradicional
  feltLight: '#1f8a42',
  feltDark: '#156830',
  cushion: '#083316',        // Tabela verde floresta ultra escuro (mais alto destaque)
  cushionTop: '#0a3d1b',
  wood: '#4a2810',
  woodDark: '#2c1808',
  woodLight: '#6a3820',
  pocket: '#000000',
  pocketInner: '#000000',
};

export class PoolRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private ballImages: Map<number, HTMLCanvasElement> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.canvas.width = TABLE.width + TABLE.woodBorder * 2 + 80;
    this.canvas.height = TABLE.height + TABLE.woodBorder * 2;
  }

  // =====================================================
  // DESENHAR MESA COMPLETA
  // =====================================================
  private drawTable() {
    const ctx = this.ctx;
    const W = TABLE.width;
    const H = TABLE.height;
    const B = TABLE.woodBorder;

    // Fundo escuro
    ctx.fillStyle = '#0d1a0d';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // ========== BORDA DE MADEIRA ==========
    this.drawWoodBorder();

    // ========== FELTRO VERDE (cor tradicional de sinuca) ==========
    // Gradiente sutil do centro para as bordas
    const feltGrad = ctx.createRadialGradient(
      B + W / 2, B + H / 2, 0,
      B + W / 2, B + H / 2, W * 0.55
    );
    feltGrad.addColorStop(0, COLORS.feltLight);
    feltGrad.addColorStop(0.4, COLORS.felt);
    feltGrad.addColorStop(1, COLORS.feltDark);
    ctx.fillStyle = feltGrad;
    ctx.fillRect(B, B, W, H);

    // Textura sutil do feltro (linhas horizontais muito sutis)
    ctx.globalAlpha = 0.03;
    for (let y = B; y < B + H; y += 3) {
      ctx.fillStyle = y % 6 === 0 ? '#0d3d18' : '#2a8040';
      ctx.fillRect(B, y, W, 1);
    }
    ctx.globalAlpha = 1;

    // ========== CAÇAPAS (buracos pretos) ==========
    this.drawPockets();

    // ========== TABELAS EMBORRACHADAS ==========
    this.drawCushions();

    // ========== LINHA DE CABECEIRA ==========
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(B + W * 0.25, B + TABLE.cushion + 8);
    ctx.lineTo(B + W * 0.25, B + H - TABLE.cushion - 8);
    ctx.stroke();

    // Semicírculo D
    ctx.beginPath();
    ctx.arc(B + W * 0.25, B + H / 2, 55, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    // Foot spot
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(B + W * 0.75, B + H / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // ========== DIAMANTES ==========
    this.drawDiamonds();
  }

  // =====================================================
  // BORDA DE MADEIRA REALISTA
  // =====================================================
  private drawWoodBorder() {
    const ctx = this.ctx;
    const W = TABLE.width;
    const H = TABLE.height;
    const B = TABLE.woodBorder;

    // Sombra externa profunda
    ctx.fillStyle = '#0a0805';
    ctx.fillRect(B - 15, B - 15, W + 30, H + 30);

    // Camada externa (madeira escura)
    this.drawWoodTexture(B - 10, B - 10, W + 20, H + 20, COLORS.woodDark, '#3a2010');

    // Camada principal (madeira marrom)
    this.drawWoodTexture(B - 5, B - 5, W + 10, H + 10, COLORS.wood, COLORS.woodDark);

    // Friso dourado interno (mais sutil)
    ctx.strokeStyle = '#a08020';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(B + 1, B + 1, W - 2, H - 2);
  }

  // =====================================================
  // TEXTURA DE MADEIRA
  // =====================================================
  private drawWoodTexture(x: number, y: number, w: number, h: number, color1: string, color2: string) {
    const ctx = this.ctx;

    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, color1);
    grad.addColorStop(0.25, color2);
    grad.addColorStop(0.5, color1);
    grad.addColorStop(0.75, color2);
    grad.addColorStop(1, color1);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    // Veios da madeira
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#2a1508';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      const startY = y + Math.random() * h;
      ctx.moveTo(x, startY);
      ctx.bezierCurveTo(
        x + w * 0.3, startY + (Math.random() - 0.5) * 15,
        x + w * 0.7, startY + (Math.random() - 0.5) * 15,
        x + w, startY + (Math.random() - 0.5) * 10
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // =====================================================
  // CAÇAPAS - ESTILO REFERÊNCIA
  // =====================================================
  private drawPockets() {
    const ctx = this.ctx;
    const W = TABLE.width;
    const H = TABLE.height;
    const B = TABLE.woodBorder;
    const R = TABLE.pocketR;

    // Caçapas dos cantos - círculos pretos simples
    const corners = [
      { x: B + 8, y: B + 8 },           // Superior esquerdo
      { x: B + W - 8, y: B + 8 },       // Superior direito
      { x: B + 8, y: B + H - 8 },       // Inferior esquerdo
      { x: B + W - 8, y: B + H - 8 },   // Inferior direito
    ];

    corners.forEach(c => {
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
      ctx.fill();
    });

    // Caçapas do meio - um pouco menores
    const sides = [
      { x: B + W / 2, y: B - 2 },
      { x: B + W / 2, y: B + H + 2 },
    ];

    sides.forEach(s => {
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(s.x, s.y, R - 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // =====================================================
  // TABELAS - ESTILO REFERÊNCIA (cobrindo a madeira)
  // =====================================================
  private drawCushions() {
    const ctx = this.ctx;
    const W = TABLE.width;
    const H = TABLE.height;
    const B = TABLE.woodBorder;
    const CW = TABLE.cushion;
    const R = TABLE.pocketR;

    // Parâmetros de realismo das bocas
    const cornerGap = R + 8;    // Espaço aberto para a boca nos cantos
    const sideGap = R - 5;       // Espaço aberto para a boca no meio
    const bevel = 25;           // Inclinação diagonal profissional (funil)

    ctx.fillStyle = COLORS.cushion;

    // Função auxiliar para desenhar tabela com volume
    const drawStyledCushion = (points: { x: number, y: number }[], vertical = false) => {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();

      // Gradiente de volume
      const grad = vertical
        ? ctx.createLinearGradient(points[0].x, points[0].y, points[2].x, points[0].y)
        : ctx.createLinearGradient(points[0].x, points[0].y, points[0].x, points[2].y);

      grad.addColorStop(0, COLORS.cushionTop);
      grad.addColorStop(1, COLORS.cushion);

      ctx.fillStyle = grad;
      ctx.fill();

      // Sombra interna (quina da tabela)
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(points[3].x, points[3].y);
      ctx.lineTo(points[2].x, points[2].y);
      ctx.stroke();

      // Brilho na quina
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    ctx.shadowBlur = 0;

    // ========== TABELAS SUPERIORES ==========
    // Topo Esquerda
    drawStyledCushion([
      { x: B + cornerGap, y: B },
      { x: B + W / 2 - sideGap, y: B },
      { x: B + W / 2 - sideGap - bevel, y: B + CW },
      { x: B + cornerGap + bevel, y: B + CW }
    ]);

    // Topo Direita
    drawStyledCushion([
      { x: B + W / 2 + sideGap, y: B },
      { x: B + W - cornerGap, y: B },
      { x: B + W - cornerGap - bevel, y: B + CW },
      { x: B + W / 2 + sideGap + bevel, y: B + CW }
    ]);

    // ========== TABELAS INFERIORES ==========
    // Baixo Esquerda
    drawStyledCushion([
      { x: B + cornerGap, y: B + H },
      { x: B + W / 2 - sideGap, y: B + H },
      { x: B + W / 2 - sideGap - bevel, y: B + H - CW },
      { x: B + cornerGap + bevel, y: B + H - CW }
    ]);

    // Baixo Direita
    drawStyledCushion([
      { x: B + W / 2 + sideGap, y: B + H },
      { x: B + W - cornerGap, y: B + H },
      { x: B + W - cornerGap - bevel, y: B + H - CW },
      { x: B + W / 2 + sideGap + bevel, y: B + H - CW }
    ]);

    // ========== TABELAS LATERAIS ==========
    // Esquerda
    drawStyledCushion([
      { x: B, y: B + cornerGap },
      { x: B, y: B + H - cornerGap },
      { x: B + CW, y: B + H - cornerGap - bevel },
      { x: B + CW, y: B + cornerGap + bevel }
    ], true);

    // Direita
    drawStyledCushion([
      { x: B + W, y: B + cornerGap },
      { x: B + W, y: B + H - cornerGap },
      { x: B + W - CW, y: B + H - cornerGap - bevel },
      { x: B + W - CW, y: B + cornerGap + bevel }
    ], true);

  }

  // =====================================================
  // DIAMANTES NAS BORDAS
  // =====================================================
  private drawDiamonds() {
    const ctx = this.ctx;
    const W = TABLE.width;
    const H = TABLE.height;
    const B = TABLE.woodBorder;

    ctx.fillStyle = '#e8d9a0';

    // Horizontais
    const hPos = [0.12, 0.24, 0.38, 0.62, 0.76, 0.88];
    hPos.forEach(p => {
      this.drawDiamond(B + W * p, B - 28);
      this.drawDiamond(B + W * p, B + H + 28);
    });

    // Verticais
    const vPos = [0.2, 0.5, 0.8];
    vPos.forEach(p => {
      this.drawDiamond(B - 28, B + H * p);
      this.drawDiamond(B + W + 28, B + H * p);
    });
  }

  private drawDiamond(x: number, y: number) {
    const ctx = this.ctx;
    const s = 5;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.5, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s * 0.5, y);
    ctx.closePath();
    ctx.fill();
  }

  // =====================================================
  // CRIAR IMAGEM DA BOLA (REALISTA)
  // =====================================================
  private getBallImage(ball: PhysicsBall): HTMLCanvasElement {
    let img = this.ballImages.get(ball.id);
    if (img) return img;

    const size = 80;
    img = document.createElement('canvas');
    img.width = size;
    img.height = size;
    const ctx = img.getContext('2d')!;

    const r = size / 2 - 4;
    const cx = size / 2;
    const cy = size / 2;

    // ========== BOLA BASE ==========
    if (ball.type === 'cue') {
      // Bola branca perolada
      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, '#f5f5f5');
      grad.addColorStop(0.8, '#d8d8d8');
      grad.addColorStop(1, '#a0a0a0');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (ball.type === 'stripe') {
      // Listrada - base branca
      const whiteGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
      whiteGrad.addColorStop(0, '#ffffff');
      whiteGrad.addColorStop(0.5, '#f0f0f0');
      whiteGrad.addColorStop(1, '#c8c8c8');
      ctx.fillStyle = whiteGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Faixa colorida
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      const stripeGrad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
      stripeGrad.addColorStop(0, this.lightenColor(ball.color, 60));
      stripeGrad.addColorStop(0.5, ball.color);
      stripeGrad.addColorStop(1, this.darkenColor(ball.color, 50));
      ctx.fillStyle = stripeGrad;
      ctx.fillRect(cx - r, cy - r * 0.42, r * 2, r * 0.84);
      ctx.restore();
    } else {
      // Sólida ou bola 8
      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
      grad.addColorStop(0, this.lightenColor(ball.color, 80));
      grad.addColorStop(0.3, this.lightenColor(ball.color, 40));
      grad.addColorStop(0.7, ball.color);
      grad.addColorStop(1, this.darkenColor(ball.color, 70));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // ========== CÍRCULO DO NÚMERO ==========
    if (ball.number > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.36, 0, Math.PI * 2);
      ctx.fill();

      // Sombra sutil
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.36, 0, Math.PI * 2);
      ctx.stroke();

      // Número
      ctx.fillStyle = '#000000';
      ctx.font = `bold ${r * 0.42}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ball.number.toString(), cx, cy + 1);
    }

    // ========== BRILHO ESPECULAR ==========
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.28, cy - r * 0.28, r * 0.22, r * 0.14, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.12, cy - r * 0.42, r * 0.1, r * 0.06, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    // Borda sutil
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    this.ballImages.set(ball.id, img);
    return img;
  }

  private lightenColor(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + amount);
    const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + amount);
    const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + amount);
    return `rgb(${r},${g},${b})`;
  }

  private darkenColor(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - amount);
    const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - amount);
    const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - amount);
    return `rgb(${r},${g},${b})`;
  }

  // =====================================================
  // DESENHAR BOLAS COM INDICADOR DE POSSE
  // =====================================================
  private drawBalls(balls: PhysicsBall[], state?: RenderState) {
    const ctx = this.ctx;
    const B = TABLE.woodBorder;

    balls.forEach(ball => {
      if (ball.pocketed) return;

      const x = B + ball.x;
      const y = B + ball.y;
      const r = ball.radius;

      // Determinar se é bola do jogador atual para mostrar indicador
      const isMyBall = state?.myBalls?.includes(ball.number);
      const isOpponentBall = state?.opponentBalls?.includes(ball.number);
      const isActivePlayerBall = isMyBall; // No futuro podemos expandir para p1/p2

      let scale = 1;
      if (ball.falling || ball.inPocketAnimation) {
        const progress = ball.fallProgress || ball.pocketAnimationProgress || 0;
        scale = 1 - progress * 0.8;
      }

      // 1. INDICADORES DE POSSE (Anéis de Identificação Premium)
      if (!ball.falling && !ball.inPocketAnimation) {
        const time = Date.now() / 1000;
        const pulse = Math.sin(time * 6) * 0.5 + 0.5;

        // Lógica de Detecção da Bola 8 como Alvo
        const isEightBall = ball.number === 8;
        const myRemainingBalls = state?.myBalls?.filter(num => {
          const b = balls.find(bb => bb.number === num);
          return b && !b.pocketed;
        }) || [];

        // No modo 8-ball, a 8 é alvo se não restarem outras bolas E o tipo já foi definido
        const typesDefined = state?.myBallType !== null && state?.myBallType !== undefined;
        const isEightBallTarget = isEightBall && typesDefined && myRemainingBalls.length === 0 && state?.gamePhase !== 'gameover';

        if (isMyBall || isEightBallTarget) {
          // Bola Alvo do Jogador - Brilho Pulsante Neon
          ctx.save();

          // Efeito de Glow Externo
          ctx.shadowBlur = 8 + pulse * 10;
          ctx.shadowColor = isEightBallTarget ? '#ffcc00' : '#00ff88';

          ctx.beginPath();
          ctx.arc(x, y, r + 3, 0, Math.PI * 2);

          if (isEightBallTarget) {
            // Bola 8 Final - Destaque Dourado Especial
            ctx.strokeStyle = `rgba(255, 204, 0, ${0.4 + pulse * 0.6})`;
            ctx.lineWidth = 3 + pulse;
            ctx.setLineDash([2, 3]);
          } else {
            // Bolas Normais do Jogador - Verde Neon
            ctx.strokeStyle = `rgba(0, 255, 136, ${0.4 + pulse * 0.6})`;
            ctx.lineWidth = 2 + pulse;
            ctx.setLineDash([6, 3]);
          }

          ctx.stroke();

          // Pequeno indicador de seta flutuante para a Bola 8 Final
          if (isEightBallTarget) {
            ctx.setLineDash([]);
            ctx.fillStyle = '#ffcc00';
            const arrowY = y - r - 15 - pulse * 5;
            ctx.beginPath();
            ctx.moveTo(x, arrowY);
            ctx.lineTo(x - 6, arrowY - 10);
            ctx.lineTo(x + 6, arrowY - 10);
            ctx.fill();
          }

          ctx.restore();
        } else if (isOpponentBall) {
          // Bola do Oponente - Indicador Estático Discreto para não distrair
          ctx.beginPath();
          ctx.arc(x, y, r + 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Sombra projetada
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(x + 3, y + 3, r * scale, r * scale * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Desenhar a bola
      const img = this.getBallImage(ball);
      const drawSize = r * 2.2 * scale;
      ctx.drawImage(img, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
    });
  }

  // =====================================================
  // DESENHAR TACO
  // O taco fica ATRÁS da bola branca (oposto à direção do tiro)
  // cue.angle = direção do TIRO (para onde a bola vai)
  // Taco visual = cue.angle + PI (lado oposto)
  // =====================================================
  private drawCue(cue: CueState) {
    if (!cue.visible) return;

    const ctx = this.ctx;
    const B = TABLE.woodBorder;
    const x = B + cue.x;
    const y = B + cue.y;

    // O taco fica no lado OPOSTO à direção do tiro
    // cue.angle = direção do tiro (para onde a bola vai)
    // Taco visual = cue.angle + PI (atrás da bola)
    const cueVisualAngle = cue.angle + Math.PI;
    const pullBack = cue.pullBack || (cue.power * 100);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(cueVisualAngle);

    // Distância da ponta do taco até a bola
    const dist = 22 + pullBack;
    const cueLength = 400;

    // Sombra do taco
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.moveTo(dist + 4, 2);
    ctx.lineTo(dist + cueLength + 4, 4);
    ctx.lineTo(dist + cueLength + 4, 10);
    ctx.lineTo(dist + 4, 6);
    ctx.closePath();
    ctx.fill();

    // Corpo do taco (gradiente de madeira)
    const cueGrad = ctx.createLinearGradient(dist, 0, dist + cueLength, 0);
    cueGrad.addColorStop(0, '#f5deb3');
    cueGrad.addColorStop(0.2, '#deb887');
    cueGrad.addColorStop(0.5, '#d2a679');
    cueGrad.addColorStop(0.8, '#b8860b');
    cueGrad.addColorStop(1, '#8b4513');

    ctx.fillStyle = cueGrad;
    ctx.beginPath();
    ctx.moveTo(dist, -3.5);
    ctx.lineTo(dist + cueLength, -7);
    ctx.lineTo(dist + cueLength, 7);
    ctx.lineTo(dist, 3.5);
    ctx.closePath();
    ctx.fill();

    // Borda do taco
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Ponta azul (sola)
    ctx.fillStyle = '#4169e1';
    ctx.fillRect(dist, -3.5, 14, 7);

    // Virola (parte branca)
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(dist + 14, -4, 10, 8);

    // Anéis decorativos
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(dist + 100, -5, 3, 10);
    ctx.fillRect(dist + 200, -6, 3, 12);

    ctx.restore();
  }

  // =====================================================
  // LINHA DE MIRA (sai da ponta do taco na direção do tiro)
  // cue.angle = direção do TIRO (para onde a bola vai)
  // A linha de mira vai NA DIREÇÃO do tiro (cue.angle)
  // =====================================================
  private drawAimLine(cue: CueState, show: boolean, balls: PhysicsBall[], state?: RenderState) {
    if (!show || !cue.visible) return;

    const ctx = this.ctx;
    const B = TABLE.woodBorder;
    const W = TABLE.width;
    const H = TABLE.height;
    const x = B + cue.x;
    const y = B + cue.y;

    // Direção do tiro: cue.angle já é a direção correta
    const shotAngle = cue.angle;
    const dirX = Math.cos(shotAngle);
    const dirY = Math.sin(shotAngle);

    // Limites da mesa
    const cushion = TABLE.cushion;
    const minX = B + cushion;
    const maxX = B + W - cushion;
    const minY = B + cushion;
    const maxY = B + H - cushion;

    // Encontrar primeira bola na trajetória
    let hitBall: PhysicsBall | null = null;
    let hitDist = Infinity;
    let hitPointX = 0;
    let hitPointY = 0;

    if (balls) {
      const BALL_R = 13;

      for (const ball of balls) {
        if (ball.pocketed || ball.type === 'cue') continue;

        const ballX = B + ball.x;
        const ballY = B + ball.y;

        const toBallX = ballX - x;
        const toBallY = ballY - y;

        const proj = toBallX * dirX + toBallY * dirY;
        if (proj < 0) continue;

        const perpX = toBallX - proj * dirX;
        const perpY = toBallY - proj * dirY;
        const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);

        const collisionDist = BALL_R * 2;
        if (perpDist < collisionDist) {
          const offset = Math.sqrt(collisionDist * collisionDist - perpDist * perpDist);
          const hitT = proj - offset;

          if (hitT > BALL_R && hitT < hitDist) {
            hitDist = hitT;
            hitBall = ball;
            hitPointX = x + dirX * hitT;
            hitPointY = y + dirY * hitT;
          }
        }
      }
    }

    // Calcular ponto final
    let endX = x;
    let endY = y;
    let maxDist = 600;

    if (hitBall !== null && hitDist < maxDist) {
      endX = hitPointX;
      endY = hitPointY;
      maxDist = hitDist;
    } else {
      // Interseção com bordas
      if (dirX > 0.001) {
        const t = (maxX - x) / dirX;
        if (t > 0 && t < maxDist) {
          const testY = y + dirY * t;
          if (testY >= minY && testY <= maxY) {
            maxDist = t;
            endX = maxX;
            endY = testY;
          }
        }
      } else if (dirX < -0.001) {
        const t = (minX - x) / dirX;
        if (t > 0 && t < maxDist) {
          const testY = y + dirY * t;
          if (testY >= minY && testY <= maxY) {
            maxDist = t;
            endX = minX;
            endY = testY;
          }
        }
      }

      if (dirY > 0.001) {
        const t = (maxY - y) / dirY;
        if (t > 0 && t < maxDist) {
          const testX = x + dirX * t;
          if (testX >= minX && testX <= maxX) {
            maxDist = t;
            endX = testX;
            endY = maxY;
          }
        }
      } else if (dirY < -0.001) {
        const t = (minY - y) / dirY;
        if (t > 0 && t < maxDist) {
          const testX = x + dirX * t;
          if (testX >= minX && testX <= maxX) {
            maxDist = t;
            endX = testX;
            endY = minY;
          }
        }
      }
    }

    ctx.save();

    // Linha principal de mira
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(x + dirX * 18, y + dirY * 18);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Se acertou uma bola, mostrar previsão de direção
    if (hitBall !== null) {
      const ballX = B + hitBall.x;
      const ballY = B + hitBall.y;

      // Direção que a bola alvo vai seguir (do ponto de contato para o centro da bola)
      const targetDirX = ballX - hitPointX;
      const targetDirY = ballY - hitPointY;
      const targetLen = Math.sqrt(targetDirX * targetDirX + targetDirY * targetDirY);

      if (targetLen > 0.1) {
        const normTargetX = targetDirX / targetLen;
        const normTargetY = targetDirY / targetLen;

        // Linha de previsão da bola alvo (mais longa)
        ctx.strokeStyle = 'rgba(255,200,100,0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(ballX, ballY);
        ctx.lineTo(ballX + normTargetX * 150, ballY + normTargetY * 150);
        ctx.stroke();

        // Círculo de destaque na bola alvo
        ctx.setLineDash([]);

        // COR DO INDICADOR: Verde se for sua bola, Vermelho se for do oponente ou má fase
        const isMyBall = state?.myBalls?.includes(hitBall.number);
        const isEightBall = hitBall.number === 8;

        // Verificar se pode atingir a 8
        const myRemainingBalls = state?.myBalls?.filter(num => {
          const b = balls.find(bb => bb.number === num);
          return b && !b.pocketed;
        }) || [];
        const canHitEight = myRemainingBalls.length === 0;
        const typesDefined = state?.myBallType !== null && state?.myBallType !== undefined;

        let indicatorColor = 'rgba(255, 255, 255, 0.4)'; // Neutro (cue ou fase de abertura)

        if (typesDefined) {
          if (isMyBall) {
            indicatorColor = 'rgba(0, 255, 136, 0.7)'; // Verde (Válida)
          } else if (isEightBall) {
            indicatorColor = canHitEight ? 'rgba(255, 204, 0, 0.8)' : 'rgba(255, 68, 68, 0.8)'; // Amarelo (OK) ou Vermelho (Falta)
          } else if (hitBall.type !== 'cue') {
            indicatorColor = 'rgba(255, 68, 68, 0.8)'; // Vermelho (Oponente - Falta)
          }
        } else if (isEightBall && state?.gamePhase !== 'opening') {
          indicatorColor = 'rgba(255, 68, 68, 0.8)'; // Não pode bater na 8 antes de definir tipos
        }

        ctx.strokeStyle = indicatorColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ballX, ballY, 16, 0, Math.PI * 2);
        ctx.stroke();

        // Glow sutil na bola atingida
        ctx.shadowBlur = 10;
        ctx.shadowColor = indicatorColor;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // Ponto de mira no final
    ctx.setLineDash([]);
    ctx.fillStyle = hitBall !== null ? 'rgba(255,200,100,0.8)' : 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(endX, endY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // =====================================================
  // BARRA DE FORÇA
  // =====================================================
  private drawPowerBar(power: number, show: boolean) {
    if (!show) return;

    const ctx = this.ctx;
    const x = TABLE.width + TABLE.woodBorder * 2 + 25;
    const y = TABLE.woodBorder + 40;
    const w = 28;
    const h = TABLE.height - 80;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x, y, w, h);

    const barH = h * power;
    let color: string;
    if (power < 0.35) color = '#00cc00';
    else if (power < 0.65) color = '#cccc00';
    else color = '#cc3300';

    const barGrad = ctx.createLinearGradient(x, y + h, x, y + h - barH);
    barGrad.addColorStop(0, this.darkenColor(color, 30));
    barGrad.addColorStop(0.5, color);
    barGrad.addColorStop(1, this.lightenColor(color, 30));
    ctx.fillStyle = barGrad;
    ctx.fillRect(x + 3, y + h - barH, w - 6, barH);

    ctx.fillStyle = '#555555';
    for (let i = 0; i <= 10; i++) {
      const my = y + h - (h * i / 10);
      ctx.fillRect(x - 5, my - 1, 5, 2);
    }

    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }

  // =====================================================
  // MÉTODOS PÚBLICOS
  // =====================================================
  resize(width: number, height: number) { }

  render(state: RenderState) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawTable();
    this.drawBalls(state.balls, state);
    this.drawAimLine(state.cue, state.showAimLine, state.balls, state);
    this.drawCue(state.cue);
    this.drawPowerBar(state.cue.power, state.showPowerBar);
  }

  destroy() {
    this.ballImages.clear();
  }
}
