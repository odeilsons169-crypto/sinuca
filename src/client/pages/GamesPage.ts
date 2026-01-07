
import { gameStore } from '../store/gameStore.js';
import { renderHeader } from '../components/Header.js';

export function GamesPage(app: any): string {
    const state = gameStore.getState();
    const user = state.user;

    return `
    ${renderHeader({ showStats: true, logoClickable: true, navigateTo: 'lobby' })}

    <div class="lobby">
      <aside class="sidebar">
        <div class="sidebar-section">
          <div class="sidebar-title">Menu</div>
          <ul class="sidebar-menu">
            <li class="sidebar-item" data-page="lobby">
              <span class="sidebar-item-icon">🏠</span> Lobby
            </li>
            <li class="sidebar-item active" data-page="games">
              <span class="sidebar-item-icon">🎮</span> Jogos
            </li>
            <li class="sidebar-item" data-page="wallet">
              <span class="sidebar-item-icon">💰</span> Carteira
            </li>
            <li class="sidebar-item" data-page="ranking">
              <span class="sidebar-item-icon">🏆</span> Ranking
            </li>
            <li class="sidebar-item" data-page="profile">
              <span class="sidebar-item-icon">👤</span> Perfil
            </li>
          </ul>
        </div>
        
        <!-- Indicador de Sincronização -->
        <div class="lobby-sync-indicator" id="games-sync-indicator">
          <span class="sync-dot"></span>
          <span class="sync-text">Sincronizado</span>
        </div>
        
        <div style="margin-top: auto;">
          <button id="logout-btn" class="btn btn-ghost w-full">Sair</button>
        </div>
      </aside>

      <main class="main-content animate-fadeIn">
        <div class="section-header">
          <div>
            <h2 class="section-title">🎮 Catálogo de Jogos</h2>
            <p class="section-subtitle">Escolha seu jogo favorito e divirta-se. Seus créditos valem para todos!</p>
          </div>
        </div>

        <!-- Info sobre créditos -->
        <div style="margin-bottom: 2rem; padding: 1rem; background: rgba(255, 165, 2, 0.1); border-radius: 12px; border: 1px solid rgba(255, 165, 2, 0.3);">
          <p style="color: var(--accent-yellow); font-size: 0.9rem;">
            💡 <strong>Uma conta, todos os jogos!</strong> Seus créditos e saldo podem ser usados em qualquer jogo da plataforma.
          </p>
        </div>

        <div class="games-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;">
          
          <!-- Sinuca (Ativo) -->
          <div class="game-card active" data-navigate="lobby" style="cursor: pointer;">
            <div class="game-card-cover green" style="height: 160px;">
              <span class="game-card-icon" style="font-size: 3rem;">🎱</span>
            </div>
            <div class="game-card-body">
              <span class="game-card-genre">Esportes</span>
              <h3 class="game-card-title">Sinuca Online</h3>
              <p class="game-card-subtitle">8-Ball & 9-Ball</p>
              <div class="game-card-meta">
                <span>⭐ 4.8</span>
                <span>👥 Online</span>
              </div>
              <button class="btn btn-primary w-full" style="margin-top: 1rem;">JOGAR AGORA</button>
            </div>
          </div>

          <!-- Tênis de Mesa (Em Breve) -->
          <div class="game-card coming-soon" style="opacity: 0.8;">
            <div class="game-card-cover red" style="height: 160px;">
              <span class="game-card-icon" style="font-size: 3rem;">🏓</span>
              <div class="game-card-overlay"><span>EM BREVE</span></div>
            </div>
            <div class="game-card-body">
              <span class="game-card-genre">Esportes</span>
              <h3 class="game-card-title">Tênis de Mesa</h3>
              <p class="game-card-subtitle">Ping Pong Rápido</p>
              <div class="game-card-coming-badge" style="margin-top: 1rem;">🔜 Em Breve</div>
            </div>
          </div>

          <!-- Banco Imobiliário (Em Breve) -->
          <div class="game-card coming-soon" style="opacity: 0.8;">
            <div class="game-card-cover yellow" style="height: 160px;">
              <span class="game-card-icon" style="font-size: 3rem;">🏠</span>
              <div class="game-card-overlay"><span>EM BREVE</span></div>
            </div>
            <div class="game-card-body">
              <span class="game-card-genre">Tabuleiro</span>
              <h3 class="game-card-title">Banco Imobiliário</h3>
              <p class="game-card-subtitle">Negocie e Vença</p>
              <div class="game-card-coming-badge" style="margin-top: 1rem;">🔜 Em Breve</div>
            </div>
          </div>

          <!-- Dominó (Em Breve) -->
          <div class="game-card coming-soon" style="opacity: 0.8;">
            <div class="game-card-cover purple" style="height: 160px;">
              <span class="game-card-icon" style="font-size: 3rem;">🀄</span>
              <div class="game-card-overlay"><span>EM BREVE</span></div>
            </div>
            <div class="game-card-body">
              <span class="game-card-genre">Clássico</span>
              <h3 class="game-card-title">Dominó</h3>
              <p class="game-card-subtitle">Estratégia Pura</p>
              <div class="game-card-coming-badge" style="margin-top: 1rem;">🔜 Em Breve</div>
            </div>
          </div>

          <!-- Truco (Em Breve) -->
          <div class="game-card coming-soon" style="opacity: 0.8;">
            <div class="game-card-cover blue" style="height: 160px;">
              <span class="game-card-icon" style="font-size: 3rem;">🃏</span>
              <div class="game-card-overlay"><span>EM BREVE</span></div>
            </div>
            <div class="game-card-body">
              <span class="game-card-genre">Cartas</span>
              <h3 class="game-card-title">Truco</h3>
              <p class="game-card-subtitle">Paulista & Mineiro</p>
              <div class="game-card-coming-badge" style="margin-top: 1rem;">🔜 Em Breve</div>
            </div>
          </div>

        </div>
      </main>
    </div>
  `;
}
