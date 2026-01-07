import { gameStore } from '../store/gameStore.js';
import { api } from '../services/api.js';
import { renderHeader } from '../components/Header.js';
import { flagService } from '../services/flagService.js';

// Helpers de nível (replicados do servidor para o frontend)
function getLevelColor(level: number): string {
  if (level >= 100) return '#ff0000'; // Vermelho (Lenda)
  if (level >= 80) return '#ff00ff';  // Magenta
  if (level >= 60) return '#ffd700';  // Dourado
  if (level >= 50) return '#ff8c00';  // Laranja
  if (level >= 40) return '#9400d3';  // Roxo
  if (level >= 30) return '#00bfff';  // Azul claro
  if (level >= 20) return '#32cd32';  // Verde
  if (level >= 10) return '#87ceeb';  // Azul céu
  if (level >= 5) return '#daa520';   // Dourado escuro
  return '#808080'; // Cinza (Novato)
}

let isLoadingRanking = false;
let currentFilter: 'global' | 'monthly' | 'weekly' | 'tournament' = 'global';
let selectedTournamentId: string | null = null;
let currentWeekLabel: string = '';
let syncInterval: ReturnType<typeof setInterval> | null = null;

export function RankingPage(app: any): string {
  const state = gameStore.getState();
  const user = state.user;

  // Carregar ranking após render
  setTimeout(() => {
    if (!isLoadingRanking) {
      isLoadingRanking = true;
      loadRanking().finally(() => { isLoadingRanking = false; });
    }
    bindRankingEvents(app);
    setupRealtimeSync();
  }, 100);

  return `
    ${renderHeader({ showStats: true, logoClickable: true, navigateTo: 'lobby' })}

    <div class="lobby">
      <!-- Sidebar Menu -->
      <aside class="sidebar">
        <div class="sidebar-section">
          <div class="sidebar-title">Menu</div>
          <ul class="sidebar-menu">
            <li class="sidebar-item" data-page="lobby">
              <span class="sidebar-item-icon">🏠</span> Lobby
            </li>
            <li class="sidebar-item" data-page="games">
              <span class="sidebar-item-icon">🎮</span> Jogos
            </li>
            <li class="sidebar-item" data-page="wallet">
              <span class="sidebar-item-icon">💰</span> Carteira
            </li>
            <li class="sidebar-item active" data-page="ranking">
              <span class="sidebar-item-icon">🏆</span> Ranking
            </li>
            <li class="sidebar-item" data-page="profile">
              <span class="sidebar-item-icon">👤</span> Perfil
            </li>
            ${(user?.is_admin || ['admin', 'super_admin', 'manager', 'moderator', 'employee'].includes(user?.role || '')) ? `
            <li class="sidebar-item" data-page="admin">
              <span class="sidebar-item-icon">⚙️</span> Admin
            </li>
            ` : ''}
          </ul>
        </div>
        
        <!-- Indicador de Sincronização -->
        <div class="realtime-sync-indicator" id="ranking-sync-indicator">
          <span class="sync-dot"></span>
          <span class="sync-text">Sincronizado</span>
        </div>
        
        <div style="margin-top: auto;">
          <button id="logout-btn" class="btn btn-ghost w-full">Sair</button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <div class="ranking-page-content">
      <!-- Hero Section -->
      <div class="ranking-hero">
        <div class="ranking-hero-content">
          <h1 class="ranking-hero-title">🏆 Ranking de Jogadores</h1>
          <p class="ranking-hero-subtitle">Os melhores competidores da plataforma</p>
        </div>
        <div class="ranking-hero-decoration">
          <div class="trophy-glow">🏆</div>
        </div>
      </div>

      <!-- Filtros -->
      <div class="ranking-filters">
        <div class="ranking-filter-tabs">
          <button class="ranking-filter-tab ${currentFilter === 'global' ? 'active' : ''}" data-filter="global">
            🌍 Global
          </button>
          <button class="ranking-filter-tab ${currentFilter === 'monthly' ? 'active' : ''}" data-filter="monthly">
            📅 Mensal
          </button>
          <button class="ranking-filter-tab ${currentFilter === 'weekly' ? 'active' : ''}" data-filter="weekly">
            🔥 Semanal
          </button>
          <button class="ranking-filter-tab ${currentFilter === 'tournament' ? 'active' : ''}" data-filter="tournament">
            🏆 Torneios
          </button>
        </div>
        
        <!-- Info do período -->
        <div id="period-info" class="period-info" style="margin-top: 0.75rem; font-size: 0.85rem; color: var(--text-muted);"></div>
        
        <div id="tournament-filter-container" class="tournament-filter-container ${currentFilter === 'tournament' ? '' : 'hidden'}">
          <select id="tournament-select" class="tournament-select">
            <option value="">Selecione um torneio...</option>
          </select>
        </div>
      </div>

      <!-- Minha Posição -->
      <div id="my-ranking-card" class="my-ranking-card hidden">
        <div class="my-ranking-content">
          <div class="my-ranking-position">
            <span class="my-ranking-label">Sua Posição</span>
            <span id="my-position" class="my-ranking-number">#--</span>
          </div>
          <div class="my-ranking-stats">
            <div class="my-ranking-stat">
              <span class="stat-value" id="my-points">0</span>
              <span class="stat-label">Pontos</span>
            </div>
            <div class="my-ranking-stat">
              <span class="stat-value" id="my-wins">0</span>
              <span class="stat-label">Vitórias</span>
            </div>
            <div class="my-ranking-stat">
              <span class="stat-value" id="my-winrate">0%</span>
              <span class="stat-label">Win Rate</span>
            </div>
          </div>
        </div>
        
        <!-- Link para histórico -->
        <div id="history-link" class="history-link" style="margin-top: 1rem; text-align: center;">
          <button class="btn btn-ghost btn-sm" id="view-history-btn">📊 Ver Meu Histórico de Rankings</button>
        </div>
      </div>

      <!-- Top 3 Podium -->
      <div id="podium-section" class="podium-section">
        <div class="podium-container">
          <!-- 2º Lugar -->
          <div class="podium-player podium-silver" id="podium-2">
            <div class="podium-avatar-container">
              <div class="podium-avatar">?</div>
              <div class="podium-medal">🥈</div>
            </div>
            <div class="podium-name">---</div>
            <div class="podium-points">0 pts</div>
            <div class="podium-base silver">2º</div>
          </div>
          
          <!-- 1º Lugar -->
          <div class="podium-player podium-gold" id="podium-1">
            <div class="podium-crown">👑</div>
            <div class="podium-avatar-container">
              <div class="podium-avatar">?</div>
              <div class="podium-medal">🥇</div>
            </div>
            <div class="podium-name">---</div>
            <div class="podium-points">0 pts</div>
            <div class="podium-base gold">1º</div>
          </div>
          
          <!-- 3º Lugar -->
          <div class="podium-player podium-bronze" id="podium-3">
            <div class="podium-avatar-container">
              <div class="podium-avatar">?</div>
              <div class="podium-medal">🥉</div>
            </div>
            <div class="podium-name">---</div>
            <div class="podium-points">0 pts</div>
            <div class="podium-base bronze">3º</div>
          </div>
        </div>
      </div>

      <!-- Lista de Ranking -->
      <div class="ranking-list-container">
        <div id="ranking-list" class="ranking-list">
          <div class="loading">
            <div class="spinner"></div>
            <p class="loading-text">Carregando ranking...</p>
          </div>
        </div>
      </div>
      
      <!-- Modal de Histórico -->
      <div id="history-modal" class="modal">
        <div class="modal-overlay" data-close-modal="history-modal"></div>
        <div class="modal-content" style="max-width: 600px;">
          <div class="modal-header">
            <h2>📊 Histórico de Rankings</h2>
            <button class="modal-close" data-close-modal="history-modal">✕</button>
          </div>
          <div class="modal-body" id="history-content" style="max-height: 60vh; overflow-y: auto;">
            <div class="loading">
              <div class="spinner"></div>
              <p>Carregando histórico...</p>
            </div>
          </div>
        </div>
      </div>
        </div>
      </main>
    </div>

    <style>
      .ranking-page-content {
        padding-bottom: 2rem;
      }
      
      /* Indicador de sincronização */
      .realtime-sync-indicator {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        margin: 1rem;
        background: rgba(0, 255, 136, 0.1);
        border-radius: 8px;
        font-size: 0.8rem;
        color: var(--accent-green);
      }
      
      .sync-dot {
        width: 8px;
        height: 8px;
        background: var(--accent-green);
        border-radius: 50%;
        animation: pulse-sync 2s infinite;
      }
      
      .realtime-sync-indicator.syncing .sync-dot {
        background: var(--accent-yellow);
        animation: spin-sync 1s linear infinite;
      }
      
      .realtime-sync-indicator.syncing .sync-text {
        color: var(--accent-yellow);
      }
      
      @keyframes pulse-sync {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.8); }
      }
      
      @keyframes spin-sync {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      /* Hero Section */
      .ranking-hero {
        background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 165, 0, 0.1));
        border: 1px solid rgba(255, 215, 0, 0.2);
        padding: 1.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
        overflow: hidden;
        border-radius: 12px;
        margin-bottom: 1rem;
      }

      .ranking-hero-title {
        font-size: 1.75rem;
        font-weight: 800;
        color: var(--text-primary);
        margin-bottom: 0.5rem;
        text-shadow: 0 2px 10px rgba(255, 215, 0, 0.3);
      }

      .ranking-hero-subtitle {
        color: var(--text-secondary);
        font-size: 1rem;
      }

      .trophy-glow {
        font-size: 5rem;
        animation: trophy-pulse 2s ease-in-out infinite;
        filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.5));
      }

      @keyframes trophy-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }

      /* Filtros */
      .ranking-filters {
        padding: 1rem 2rem;
        background: var(--bg-secondary);
        border-bottom: 1px solid var(--border-color);
      }

      .ranking-filter-tabs {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .ranking-filter-tab {
        padding: 0.75rem 1.5rem;
        border: none;
        background: var(--bg-tertiary);
        color: var(--text-secondary);
        border-radius: 25px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;
        font-size: 0.9rem;
      }

      .ranking-filter-tab:hover {
        background: rgba(255, 215, 0, 0.1);
        color: var(--text-primary);
      }

      .ranking-filter-tab.active {
        background: linear-gradient(135deg, #ffd700, #ff8c00);
        color: #000;
      }

      .tournament-filter-container {
        margin-top: 1rem;
      }

      .tournament-filter-container.hidden {
        display: none;
      }

      .tournament-select {
        width: 100%;
        max-width: 400px;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        border: 1px solid var(--border-color);
        background: var(--bg-tertiary);
        color: var(--text-primary);
        font-size: 0.9rem;
      }

      /* Minha Posição */
      .my-ranking-card {
        margin: 1.5rem 2rem;
        background: linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 153, 255, 0.1));
        border: 1px solid rgba(0, 255, 136, 0.3);
        border-radius: 16px;
        padding: 1.5rem;
      }

      .my-ranking-card.hidden {
        display: none;
      }

      .my-ranking-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1rem;
      }

      .my-ranking-position {
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .my-ranking-label {
        font-size: 0.85rem;
        color: var(--text-muted);
        margin-bottom: 0.25rem;
      }

      .my-ranking-number {
        font-size: 2.5rem;
        font-weight: 800;
        color: var(--accent-green);
        text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
      }

      .my-ranking-stats {
        display: flex;
        gap: 2rem;
      }

      .my-ranking-stat {
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .my-ranking-stat .stat-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .my-ranking-stat .stat-label {
        font-size: 0.75rem;
        color: var(--text-muted);
      }

      /* Podium */
      .podium-section {
        padding: 2rem;
        background: linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%);
      }

      .podium-container {
        display: flex;
        justify-content: center;
        align-items: flex-end;
        gap: 1rem;
        max-width: 600px;
        margin: 0 auto;
      }

      .podium-player {
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;
        animation: podium-appear 0.5s ease-out;
      }

      @keyframes podium-appear {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .podium-gold { animation-delay: 0.2s; }
      .podium-silver { animation-delay: 0.1s; }
      .podium-bronze { animation-delay: 0.3s; }

      .podium-crown {
        font-size: 2rem;
        animation: crown-bounce 1s ease-in-out infinite;
        margin-bottom: -0.5rem;
      }

      @keyframes crown-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
      }

      .podium-avatar-container {
        position: relative;
        margin-bottom: 0.5rem;
      }

      .podium-avatar {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        background: var(--bg-tertiary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.8rem;
        font-weight: 700;
        color: var(--text-primary);
        border: 3px solid var(--border-color);
      }

      .podium-gold .podium-avatar {
        border-color: #ffd700;
        box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
      }

      .podium-silver .podium-avatar {
        border-color: #c0c0c0;
        box-shadow: 0 0 15px rgba(192, 192, 192, 0.5);
      }

      .podium-bronze .podium-avatar {
        border-color: #cd7f32;
        box-shadow: 0 0 15px rgba(205, 127, 50, 0.5);
      }

      .podium-medal {
        position: absolute;
        bottom: -5px;
        right: -5px;
        font-size: 1.5rem;
      }

      .podium-name {
        font-weight: 700;
        color: var(--text-primary);
        font-size: 0.95rem;
        margin-bottom: 0.25rem;
        max-width: 100px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .podium-points {
        font-size: 0.85rem;
        color: var(--accent-green);
        font-weight: 600;
        margin-bottom: 0.5rem;
      }

      .podium-base {
        width: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 1.2rem;
        color: #000;
        border-radius: 8px 8px 0 0;
      }

      .podium-base.gold {
        height: 100px;
        background: linear-gradient(180deg, #ffd700, #ff8c00);
      }

      .podium-base.silver {
        height: 70px;
        background: linear-gradient(180deg, #e8e8e8, #a8a8a8);
      }

      .podium-base.bronze {
        height: 50px;
        background: linear-gradient(180deg, #cd7f32, #8b4513);
      }

      /* Lista de Ranking */
      .ranking-list-container {
        padding: 0 2rem;
      }

      .ranking-list {
        background: var(--bg-secondary);
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid var(--border-color);
      }

      .ranking-item {
        display: flex;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--border-color);
        transition: background 0.2s;
      }

      .ranking-item:last-child {
        border-bottom: none;
      }

      .ranking-item:hover {
        background: rgba(255, 255, 255, 0.03);
      }

      .ranking-item.highlight {
        background: rgba(0, 255, 136, 0.1);
        border-left: 4px solid var(--accent-green);
      }

      .ranking-position {
        width: 50px;
        font-size: 1.2rem;
        font-weight: 800;
        color: var(--text-muted);
        text-align: center;
      }

      .ranking-position.top-1 { color: #ffd700; }
      .ranking-position.top-2 { color: #c0c0c0; }
      .ranking-position.top-3 { color: #cd7f32; }

      .ranking-player-info {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex: 1;
      }

      .ranking-avatar-wrapper {
        position: relative;
      }

      .ranking-avatar {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--accent-green), var(--accent-blue));
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
        font-weight: 700;
        color: #000;
      }

      .ranking-avatar-flag {
        position: absolute;
        bottom: -2px;
        right: -2px;
        background: var(--bg-primary);
        border-radius: 50%;
        padding: 2px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .ranking-avatar-flag img {
        width: 16px;
        height: auto;
        border-radius: 2px;
      }

      .ranking-player-details {
        flex: 1;
      }

      .ranking-player-name {
        font-weight: 700;
        color: var(--text-primary);
        font-size: 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .user-level-badge {
        font-size: 0.7rem;
        padding: 0.1rem 0.5rem;
        border-radius: 10px;
        color: white;
        font-weight: 800;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      }

      .podium-level {
        display: block;
        font-size: 0.75rem;
        padding: 0.1rem 0.6rem;
        border-radius: 10px;
        color: white;
        margin-top: 0.25rem;
        width: fit-content;
        margin-left: auto;
        margin-right: auto;
      }

      .ranking-player-name .vip-badge {
        background: linear-gradient(135deg, #ffd700, #ff8c00);
        color: #000;
        padding: 0.1rem 0.4rem;
        border-radius: 4px;
        font-size: 0.65rem;
        font-weight: 700;
      }

      .ranking-player-stats {
        display: flex;
        gap: 1rem;
        font-size: 0.8rem;
        color: var(--text-muted);
        margin-top: 0.25rem;
      }

      .ranking-player-stats span {
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      .ranking-points-section {
        text-align: right;
      }

      .ranking-points-value {
        font-size: 1.3rem;
        font-weight: 800;
        color: var(--accent-green);
      }

      .ranking-winrate {
        font-size: 0.8rem;
        color: var(--text-muted);
      }

      .ranking-winrate.high { color: var(--accent-green); }
      .ranking-winrate.medium { color: var(--accent-yellow); }
      .ranking-winrate.low { color: var(--accent-red); }

      /* Botão Voltar */
      .ranking-back {
        padding: 2rem;
        text-align: center;
      }
      
      /* Histórico */
      .history-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        background: var(--bg-tertiary);
        border-radius: 8px;
        margin-bottom: 0.75rem;
      }
      
      .history-period {
        font-weight: 600;
        color: var(--text-primary);
      }
      
      .history-dates {
        font-size: 0.8rem;
        color: var(--text-muted);
      }
      
      .history-stats {
        display: flex;
        gap: 1.5rem;
        text-align: center;
      }
      
      .history-stat-value {
        font-size: 1.2rem;
        font-weight: 700;
        color: var(--accent-green);
      }
      
      .history-stat-label {
        font-size: 0.7rem;
        color: var(--text-muted);
      }
      
      .period-badge {
        background: rgba(255, 107, 107, 0.2);
        color: #ff6b6b;
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
        margin-right: 0.5rem;
      }

      /* Responsivo */
      @media (max-width: 768px) {
        .ranking-hero {
          padding: 1.5rem;
        }

        .ranking-hero-title {
          font-size: 1.5rem;
        }

        .trophy-glow {
          font-size: 3rem;
        }

        .ranking-filters {
          padding: 1rem;
        }

        .ranking-filter-tab {
          padding: 0.5rem 1rem;
          font-size: 0.8rem;
        }

        .podium-container {
          gap: 0.5rem;
        }

        .podium-avatar {
          width: 50px;
          height: 50px;
          font-size: 1.3rem;
        }

        .podium-base {
          width: 80px;
        }

        .podium-base.gold { height: 80px; }
        .podium-base.silver { height: 55px; }
        .podium-base.bronze { height: 40px; }

        .ranking-list-container {
          padding: 0 1rem;
        }

        .ranking-item {
          padding: 0.75rem 1rem;
        }

        .my-ranking-card {
          margin: 1rem;
        }

        .my-ranking-content {
          flex-direction: column;
          text-align: center;
        }

        .my-ranking-stats {
          justify-content: center;
        }
      }
    </style>
  `;
}

function bindRankingEvents(app: any) {
  // Sidebar navigation
  document.querySelectorAll('.sidebar-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const page = (item as HTMLElement).dataset.page;
      if (page) {
        cleanupRankingPage();
        app.navigate(page);
      }
    });
  });

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    cleanupRankingPage();
    localStorage.removeItem('token');
    app.navigate('login');
  });

  // Filtros
  document.querySelectorAll('.ranking-filter-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      const filter = (tab as HTMLElement).dataset.filter as typeof currentFilter;
      if (filter === currentFilter) return;

      currentFilter = filter;

      // Atualizar UI dos tabs
      document.querySelectorAll('.ranking-filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Mostrar/esconder filtro de torneio
      const tournamentContainer = document.getElementById('tournament-filter-container');
      if (filter === 'tournament') {
        tournamentContainer?.classList.remove('hidden');
        await loadTournaments();
      } else {
        tournamentContainer?.classList.add('hidden');
        selectedTournamentId = null;
      }

      // Recarregar ranking
      isLoadingRanking = true;
      await loadRanking();
      isLoadingRanking = false;
    });
  });

  // Seleção de torneio
  document.getElementById('tournament-select')?.addEventListener('change', async (e) => {
    selectedTournamentId = (e.target as HTMLSelectElement).value || null;
    if (selectedTournamentId) {
      isLoadingRanking = true;
      await loadRanking();
      isLoadingRanking = false;
    }
  });

  // Botão de histórico
  document.getElementById('view-history-btn')?.addEventListener('click', async () => {
    await loadRankingHistory();
    document.getElementById('history-modal')?.classList.add('active');
  });

  // Fechar modal
  document.querySelectorAll('[data-close-modal]').forEach(el => {
    el.addEventListener('click', () => {
      const modalId = (el as HTMLElement).dataset.closeModal;
      document.getElementById(modalId!)?.classList.remove('active');
    });
  });

  // Navegação
  document.querySelectorAll('[data-navigate]').forEach(el => {
    el.addEventListener('click', () => {
      const page = (el as HTMLElement).dataset.navigate;
      if (page) {
        cleanupRankingPage();
        app.navigate(page);
      }
    });
  });
}

// Cleanup function when leaving page
export function cleanupRankingPage() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

// Setup realtime sync
function setupRealtimeSync() {
  // Clear any existing interval
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  // Sync every 30 seconds
  syncInterval = setInterval(async () => {
    const indicator = document.getElementById('ranking-sync-indicator');
    if (!indicator) {
      cleanupRankingPage();
      return;
    }

    // Update indicator
    indicator.classList.add('syncing');
    const textEl = indicator.querySelector('.sync-text');
    if (textEl) textEl.textContent = 'Atualizando...';

    // Reload ranking silently
    await loadRanking(true);

    // Reset indicator
    indicator.classList.remove('syncing');
    if (textEl) textEl.textContent = 'Sincronizado';
  }, 30000);
}

async function loadTournaments() {
  const select = document.getElementById('tournament-select') as HTMLSelectElement;
  if (!select) return;

  try {
    const { data } = await api.request('/api/tournaments?status=completed&limit=20');
    const tournaments = data?.tournaments || [];

    select.innerHTML = `
      <option value="">Selecione um torneio...</option>
      ${tournaments.map((t: any) => `
        <option value="${t.id}">${t.name} - ${new Date(t.start_date).toLocaleDateString('pt-BR')}</option>
      `).join('')}
    `;
  } catch (err) {
    console.error('Erro ao carregar torneios:', err);
  }
}

async function loadRankingHistory() {
  const content = document.getElementById('history-content');
  if (!content) return;

  content.innerHTML = `
    <div class="loading" style="padding: 2rem; text-align: center;">
      <div class="spinner"></div>
      <p>Carregando histórico...</p>
    </div>
  `;

  try {
    const { data } = await api.getRankingHistory();
    const history = data?.history || [];

    if (history.length === 0) {
      content.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <div style="font-size: 3rem; margin-bottom: 1rem;">📊</div>
          <p>Você ainda não tem histórico de rankings.</p>
          <p style="font-size: 0.85rem;">Jogue partidas para aparecer nos rankings!</p>
        </div>
      `;
      return;
    }

    content.innerHTML = history.map((h: any) => {
      const periodLabel = h.period_type === 'weekly' ? '🔥 Semanal' : h.period_type === 'monthly' ? '📅 Mensal' : '🌍 Global';
      const startDate = new Date(h.period_start).toLocaleDateString('pt-BR');
      const endDate = new Date(h.period_end).toLocaleDateString('pt-BR');
      const winRate = h.matches_played > 0 ? ((h.wins / h.matches_played) * 100).toFixed(0) : 0;

      return `
        <div class="history-item">
          <div>
            <div class="history-period">${periodLabel}</div>
            <div class="history-dates">${startDate} - ${endDate}</div>
          </div>
          <div class="history-stats">
            <div>
              <div class="history-stat-value">#${h.final_position || '--'}</div>
              <div class="history-stat-label">Posição</div>
            </div>
            <div>
              <div class="history-stat-value">${h.final_points || 0}</div>
              <div class="history-stat-label">Pontos</div>
            </div>
            <div>
              <div class="history-stat-value">${winRate}%</div>
              <div class="history-stat-label">Win Rate</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Erro ao carregar histórico:', err);
    content.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #ff6b6b;">
        <p>Erro ao carregar histórico. Tente novamente.</p>
      </div>
    `;
  }
}


async function loadRanking(silent: boolean = false) {
  const listContainer = document.getElementById('ranking-list');
  const periodInfo = document.getElementById('period-info');
  if (!listContainer) return;

  if (!silent) {
    listContainer.innerHTML = `
      <div class="loading" style="padding: 3rem;">
        <div class="spinner"></div>
        <p class="loading-text">Carregando ranking...</p>
      </div>
    `;
  }

  try {
    let rankings: any[] = [];
    let myRanking: any = null;
    let periodLabel = '';

    // Buscar ranking baseado no filtro
    if (currentFilter === 'global') {
      const { data } = await api.getRanking(50);
      rankings = data?.rankings || [];
      periodLabel = 'Ranking acumulado de todos os tempos';
    } else if (currentFilter === 'monthly') {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const { data } = await api.getMonthlyRanking(50, 0, currentMonth);
      rankings = data?.rankings || [];
      periodLabel = `Competição de ${monthName} • Reseta no próximo mês`;
    } else if (currentFilter === 'weekly') {
      const { data } = await api.getWeeklyRanking(50);
      rankings = data?.rankings || [];
      currentWeekLabel = data?.week || '';
      const weekNum = currentWeekLabel.split('-')[1] || '';
      periodLabel = `<span class="period-badge">🔥 Top 10 da Semana ${weekNum}</span> Reseta toda segunda-feira`;
    } else if (currentFilter === 'tournament' && selectedTournamentId) {
      const { data } = await api.request(`/api/tournament-matches/${selectedTournamentId}/standings`);
      rankings = (data?.standings || []).map((s: any, i: number) => ({
        position: i + 1,
        points: s.points || 0,
        user: {
          id: s.user_id,
          username: s.username || s.user?.username || 'Jogador',
          avatar_url: s.avatar_url,
        },
        wins: s.wins || 0,
        losses: s.losses || 0,
        is_vip: s.is_vip,
      }));
      periodLabel = 'Classificação do torneio selecionado';
    }

    // Atualizar info do período
    if (periodInfo) {
      periodInfo.innerHTML = periodLabel;
    }

    // Buscar minha posição
    const state = gameStore.getState();
    if (state.user) {
      const { data: myData } = await api.getMyRanking();
      myRanking = myData;
    }

    // Renderizar
    renderPodium(rankings.slice(0, 3));
    renderRankingList(rankings.slice(3), state.user?.id);
    renderMyRanking(myRanking, state.user);

  } catch (err) {
    console.error('Erro ao carregar ranking:', err);
    listContainer.innerHTML = `
      <div class="empty-state" style="padding: 3rem; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">😕</div>
        <p style="color: var(--text-muted);">Erro ao carregar ranking. Tente novamente.</p>
      </div>
    `;
  }
}

function renderPodium(top3: any[]) {
  const positions = [2, 1, 3]; // Ordem visual: prata, ouro, bronze

  positions.forEach((pos, visualIndex) => {
    const player = top3[pos - 1];
    const podiumEl = document.getElementById(`podium-${pos}`);
    if (!podiumEl || !player) return;

    const avatar = podiumEl.querySelector('.podium-avatar');
    const name = podiumEl.querySelector('.podium-name');
    const points = podiumEl.querySelector('.podium-points');

    if (avatar) {
      avatar.textContent = player.user?.username?.charAt(0).toUpperCase() || '?';
    }
    if (name) {
      const level = player.user?.level || 1;
      const levelColor = getLevelColor(level);
      name.innerHTML = `
        ${player.user?.username || 'Jogador'}
        <span class="podium-level" style="background: ${levelColor}">Lvl ${level}</span>
      `;
    }
    if (points) {
      points.textContent = `${(player.points || 0).toLocaleString()} pts`;
    }
  });
}

function renderRankingList(rankings: any[], currentUserId?: string) {
  const container = document.getElementById('ranking-list');
  if (!container) return;

  if (rankings.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 3rem; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🏆</div>
        <p style="color: var(--text-muted);">Nenhum jogador no ranking ainda.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = rankings.map((player, index) => {
    const position = index + 4; // Começa do 4º lugar
    const isCurrentUser = player.user?.id === currentUserId;
    const wins = player.wins || player.user?.stats?.wins || 0;
    const losses = player.losses || player.user?.stats?.losses || 0;
    const totalGames = wins + losses;
    const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(0) : 0;
    const winRateClass = Number(winRate) >= 60 ? 'high' : Number(winRate) >= 40 ? 'medium' : 'low';

    // Bandeira do país
    const countryFlag = player.user?.country_code
      ? flagService.renderFlag(player.user.country_code, 'small')
      : '';

    return `
      <div class="ranking-item ${isCurrentUser ? 'highlight' : ''}">
        <div class="ranking-position">#${position}</div>
        <div class="ranking-player-info">
          <div class="ranking-avatar-wrapper">
            <div class="ranking-avatar">${player.user?.username?.charAt(0).toUpperCase() || '?'}</div>
            ${countryFlag ? `<div class="ranking-avatar-flag">${countryFlag}</div>` : ''}
          </div>
          <div class="ranking-player-details">
            <div class="ranking-player-name">
              ${player.user?.username || 'Jogador'}
              <span class="user-level-badge" style="background: ${getLevelColor(player.user?.level || 1)}">
                Lvl ${player.user?.level || 1}
              </span>
              ${player.is_vip ? '<span class="vip-badge">👑 VIP</span>' : ''}
            </div>
            <div class="ranking-player-stats">
              <span>✅ ${wins} vitórias</span>
              <span>❌ ${losses} derrotas</span>
              <span>🎮 ${totalGames} partidas</span>
            </div>
          </div>
        </div>
        <div class="ranking-points-section">
          <div class="ranking-points-value">${(player.points || 0).toLocaleString()}</div>
          <div class="ranking-winrate ${winRateClass}">${winRate}% win rate</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderMyRanking(myRanking: any, user: any) {
  const card = document.getElementById('my-ranking-card');
  if (!card || !user) return;

  const global = myRanking?.global;
  if (!global) return;

  card.classList.remove('hidden');

  const positionEl = document.getElementById('my-position');
  const pointsEl = document.getElementById('my-points');
  const winsEl = document.getElementById('my-wins');
  const winrateEl = document.getElementById('my-winrate');

  if (positionEl) {
    positionEl.textContent = global.position ? `#${global.position}` : '#--';
  }
  if (pointsEl) {
    pointsEl.textContent = (global.points || 0).toLocaleString();
  }
  if (winsEl) {
    winsEl.textContent = (global.wins || 0).toString();
  }
  if (winrateEl) {
    const wins = global.wins || 0;
    const losses = global.losses || 0;
    const total = wins + losses;
    const rate = total > 0 ? ((wins / total) * 100).toFixed(0) : 0;
    winrateEl.textContent = `${rate}%`;
  }
}
