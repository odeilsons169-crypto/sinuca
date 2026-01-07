// =====================================================
// GAME DETAIL PAGE - Página de Detalhes do Jogo
// =====================================================

import { gameStore } from '../store/gameStore.js';

interface GameInfo {
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  genre: string;
  icon: string;
  status: 'active' | 'coming_soon';
  description: string;
  longDescription: string;
  features: string[];
  rules: { title: string; items: string[] }[];
  creditCost: number;
  rating: number;
  players: string;
  color: string;
}

const GAMES_DATA: Record<string, GameInfo> = {
  'sinuca': {
    id: 'sinuca',
    slug: 'sinuca',
    name: 'Sinuca Online',
    subtitle: '8-Ball Pool',
    genre: 'Esportes',
    icon: '🎱',
    status: 'active',
    description: 'O clássico jogo de sinuca com física realista.',
    longDescription: `
      Sinuca Online é o jogo de sinuca mais realista da internet brasileira. 
      Com física avançada que simula tacadas reais, você vai sentir como se estivesse 
      em uma mesa de sinuca profissional.
      
      Jogue contra amigos ou desafie jogadores de todo o Brasil no modo online. 
      Suba no ranking, participe de torneios e prove que você é o melhor!
    `,
    features: [
      '🎯 Física realista de tacadas',
      '🏆 Ranking competitivo mensal',
      '👥 Multiplayer em tempo real',
      '🤖 Modo treino contra CPU',
      '🎮 Dois modos de jogo',
      '📱 Jogue no celular ou PC',
    ],
    rules: [
      {
        title: '9 Bolas (4x4)',
        items: [
          '4 bolas vermelhas vs 4 bolas azuis',
          'Sua cor é definida no início',
          'Encaçape todas as 4 bolas da sua cor para vencer',
        ]
      },
      {
        title: '8 Bolas (Lisas/Listradas)',
        items: [
          'Bolas numeradas de 1 a 15',
          'Lisas (1-7) vs Listradas (9-15)',
          'Encaçape seu grupo e por fim a Bola 8',
        ]
      },
      {
        title: 'Regra de Falta',
        items: [
          'Acertar bola do adversário = FALTA',
          'Você perde a vez',
          'Adversário ganha 1 bola de bonificação',
        ]
      }
    ],
    creditCost: 1,
    rating: 4.8,
    players: '10.000+',
    color: '#00ff88'
  },
  'tenis-de-mesa': {
    id: 'tenis',
    slug: 'tenis-de-mesa',
    name: 'Tênis de Mesa',
    subtitle: 'Ping Pong',
    genre: 'Esportes',
    icon: '🏓',
    status: 'coming_soon',
    description: 'Ping pong competitivo online.',
    longDescription: 'Em breve você poderá jogar tênis de mesa online contra jogadores de todo o Brasil!',
    features: [],
    rules: [],
    creditCost: 1,
    rating: 0,
    players: '-',
    color: '#ff6b6b'
  },
  'banco-imobiliario': {
    id: 'banco',
    slug: 'banco-imobiliario',
    name: 'Banco Imobiliário',
    subtitle: 'Monopoly Online',
    genre: 'Tabuleiro',
    icon: '🏠',
    status: 'coming_soon',
    description: 'O clássico jogo de tabuleiro online.',
    longDescription: 'Em breve você poderá jogar Banco Imobiliário online!',
    features: [],
    rules: [],
    creditCost: 1,
    rating: 0,
    players: '-',
    color: '#ffa502'
  }
};

export function GameDetailPage(app: any, gameSlug: string): string {
  const game = GAMES_DATA[gameSlug] || GAMES_DATA['sinuca'];
  const state = gameStore.getState();
  const isLoggedIn = !!state.user;

  if (game.status === 'coming_soon') {
    return renderComingSoonPage(game);
  }

  return `
    <div class="game-detail-page">
      <!-- Header -->
      <header class="game-detail-header">
        <a href="#" data-navigate="landing" class="back-btn">← Voltar</a>
        <div class="landing-logo">🎱 Sinuca Online</div>
        <div class="header-actions">
          ${isLoggedIn ? `
            <button class="btn btn-primary" data-navigate="lobby">Ir para Lobby</button>
          ` : `
            <button class="btn btn-ghost" data-navigate="login">Entrar</button>
            <button class="btn btn-primary" data-navigate="register">Criar Conta</button>
          `}
        </div>
      </header>

      <!-- Hero Banner -->
      <section class="game-hero" style="background: linear-gradient(135deg, ${game.color}22, ${game.color}44);">
        <div class="game-hero-content">
          <div class="game-hero-icon">${game.icon}</div>
          <div class="game-hero-info">
            <span class="game-hero-genre">${game.genre}</span>
            <h1 class="game-hero-title">${game.name}</h1>
            <p class="game-hero-subtitle">${game.subtitle}</p>
            <div class="game-hero-meta">
              <span class="game-hero-rating">⭐ ${game.rating}</span>
              <span class="game-hero-players">👥 ${game.players} jogadores</span>
              <span class="game-hero-cost">🎫 ${game.creditCost} crédito/partida</span>
            </div>
            <div class="game-hero-actions">
              ${isLoggedIn ? `
                <button class="btn btn-primary btn-xl" data-navigate="lobby">
                  🎮 JOGAR AGORA
                </button>
              ` : `
                <button class="btn btn-primary btn-xl" data-navigate="register">
                  🎮 CRIAR CONTA E JOGAR
                </button>
              `}
              <button class="btn btn-secondary btn-xl" id="buy-credits-btn">
                💳 Comprar Créditos
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Main Content -->
      <main class="game-detail-content">
        <div class="game-detail-grid">
          <!-- Left Column: Description & Rules -->
          <div class="game-detail-main">
            <!-- Description -->
            <section class="game-section">
              <h2>📖 Sobre o Jogo</h2>
              <p class="game-description">${game.longDescription}</p>
            </section>

            <!-- Features -->
            <section class="game-section">
              <h2>✨ Recursos</h2>
              <div class="game-features-list">
                ${game.features.map(f => `<div class="game-feature-item">${f}</div>`).join('')}
              </div>
            </section>

            <!-- Rules -->
            <section class="game-section">
              <h2>📋 Regras</h2>
              <div class="game-rules-grid">
                ${game.rules.map(rule => `
                  <div class="game-rule-card">
                    <h3>${rule.title}</h3>
                    <ul>
                      ${rule.items.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                  </div>
                `).join('')}
              </div>
              <a href="#" data-navigate="rules" class="btn btn-ghost" style="margin-top: 1rem;">
                📖 Ver Regras Completas
              </a>
            </section>
          </div>

          <!-- Right Column: Buy Credits (Upsell) -->
          <aside class="game-detail-sidebar">
            <!-- Credits Box -->
            <div class="credits-upsell-box">
              <h3>💳 Recarregar Créditos</h3>
              ${isLoggedIn ? `
                <div class="current-credits">
                  <span>Seus créditos:</span>
                  <strong>${state.isUnlimited ? '∞' : state.credits}</strong>
                </div>
              ` : ''}
              <p class="credits-info">1 crédito = R$ 0,50</p>
              <p class="credits-info">Cada partida custa ${game.creditCost} crédito</p>
              
              <div class="credits-packages">
                <div class="credit-package" data-credits="4" data-price="2">
                  <span class="package-credits">4 créditos</span>
                  <span class="package-price">R$ 2,00</span>
                </div>
                <div class="credit-package popular" data-credits="20" data-price="10">
                  <span class="package-badge">Popular</span>
                  <span class="package-credits">20 créditos</span>
                  <span class="package-price">R$ 10,00</span>
                </div>
                <div class="credit-package" data-credits="50" data-price="25">
                  <span class="package-credits">50 créditos</span>
                  <span class="package-price">R$ 25,00</span>
                </div>
                <div class="credit-package" data-credits="100" data-price="50">
                  <span class="package-credits">100 créditos</span>
                  <span class="package-price">R$ 50,00</span>
                </div>
              </div>

              ${isLoggedIn ? `
                <button class="btn btn-primary w-full btn-lg" id="open-checkout-btn">
                  💳 Comprar Créditos
                </button>
              ` : `
                <button class="btn btn-primary w-full btn-lg" data-navigate="register">
                  Criar Conta para Comprar
                </button>
              `}

              <div class="vip-promo">
                <h4>👑 Plano VIP</h4>
                <p>Créditos ilimitados por apenas</p>
                <strong>R$ 19,99/mês</strong>
                <button class="btn btn-secondary w-full" data-navigate="${isLoggedIn ? 'wallet' : 'register'}">
                  Ver Planos VIP
                </button>
              </div>
            </div>

            <!-- Quick Stats -->
            <div class="game-stats-box">
              <h3>📊 Estatísticas</h3>
              <div class="stat-row">
                <span>Jogadores online</span>
                <strong class="online-count">~500</strong>
              </div>
              <div class="stat-row">
                <span>Partidas hoje</span>
                <strong>2.500+</strong>
              </div>
              <div class="stat-row">
                <span>Avaliação</span>
                <strong>⭐ ${game.rating}</strong>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <!-- Footer CTA -->
      <section class="game-detail-cta">
        <h2>Pronto para jogar?</h2>
        ${isLoggedIn ? `
          <button class="btn btn-primary btn-xl" data-navigate="lobby">
            🎮 Ir para o Lobby
          </button>
        ` : `
          <button class="btn btn-primary btn-xl" data-navigate="register">
            🚀 Criar Conta Grátis
          </button>
        `}
      </section>
    </div>
  `;
}

function renderComingSoonPage(game: GameInfo): string {
  return `
    <div class="game-detail-page coming-soon-page">
      <header class="game-detail-header">
        <a href="#" data-navigate="landing" class="back-btn">← Voltar</a>
        <div class="landing-logo">🎱 Sinuca Online</div>
      </header>

      <section class="coming-soon-hero" style="background: linear-gradient(135deg, ${game.color}22, ${game.color}44);">
        <div class="coming-soon-content">
          <div class="coming-soon-icon">${game.icon}</div>
          <h1>${game.name}</h1>
          <p class="coming-soon-subtitle">${game.subtitle}</p>
          <div class="coming-soon-badge">🔜 EM BREVE</div>
          <p class="coming-soon-desc">${game.description}</p>
          <p class="coming-soon-notify">Fique ligado! Este jogo será lançado em breve.</p>
          <button class="btn btn-primary btn-xl" data-navigate="landing">
            ← Ver Outros Jogos
          </button>
        </div>
      </section>
    </div>
  `;
}

// Bind events após renderização
export function bindGameDetailEvents(app: any): void {
  // Pacotes de créditos
  document.querySelectorAll('.credit-package').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.credit-package').forEach(p => p.classList.remove('selected'));
      el.classList.add('selected');
    });
  });

  // Botão de comprar créditos
  const buyBtn = document.getElementById('buy-credits-btn');
  const openCheckoutBtn = document.getElementById('open-checkout-btn');

  [buyBtn, openCheckoutBtn].forEach(btn => {
    btn?.addEventListener('click', () => {
      const state = gameStore.getState();
      if (!state.user) {
        app.navigate('register');
        return;
      }
      // Abrir modal de checkout ou ir para wallet
      app.navigate('wallet');
    });
  });
}
