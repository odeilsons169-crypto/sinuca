import { gameStore } from '../store/gameStore.js';
import { api } from '../services/api.js';
import { imageService } from '../services/imageService.js';
import { flagService } from '../services/flagService.js';
import { renderHeader } from '../components/Header.js';

let isLoadingProfile = false;
let isEditing = false;

// Helpers de nível (replicados para o frontend)
function getLevelColor(level: number): string {
  if (level >= 100) return '#ff0000';
  if (level >= 80) return '#ff00ff';
  if (level >= 60) return '#ffd700';
  if (level >= 50) return '#ff8c00';
  if (level >= 40) return '#9400d3';
  if (level >= 30) return '#00bfff';
  if (level >= 20) return '#32cd32';
  if (level >= 10) return '#87ceeb';
  if (level >= 5) return '#daa520';
  return '#808080';
}

function getLevelTitle(level: number): string {
  if (level >= 100) return 'Lenda';
  if (level >= 80) return 'Mestre Supremo';
  if (level >= 60) return 'Grão-Mestre';
  if (level >= 50) return 'Mestre';
  if (level >= 40) return 'Especialista';
  if (level >= 30) return 'Veterano';
  if (level >= 20) return 'Experiente';
  if (level >= 15) return 'Habilidoso';
  if (level >= 10) return 'Intermediário';
  if (level >= 5) return 'Aprendiz';
  return 'Novato';
}

// Helper para formatar URL do avatar
function formatAvatarUrl(url: string | null | undefined, username: string = 'U'): string {
  if (!url) return username.charAt(0).toUpperCase();
  if (url.startsWith('http') || url.startsWith('/') || url.startsWith('data:')) return url;
  // Se for apenas o nome do arquivo, adiciona o prefixo correto
  return `/uploads/avatars/${url}`;
}

export function ProfilePage(app: any): string {
  const state = gameStore.getState();
  const user = state.user;

  // Carregar perfil após render
  setTimeout(() => {
    if (!isLoadingProfile) {
      isLoadingProfile = true;
      loadProfile().finally(() => { isLoadingProfile = false; });
    }
    bindProfileEvents(app);
  }, 100);

  // Verificar jogo salvo
  const savedGameStr = localStorage.getItem('sinuca_save_v1');
  let hasSavedGame = false;
  if (savedGameStr) {
    try {
      const d = JSON.parse(savedGameStr);
      if (Date.now() - d.timestamp < 86400000) hasSavedGame = true;
    } catch (e) { }
  }

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
            <li class="sidebar-item" data-page="games">
              <span class="sidebar-item-icon">🎮</span> Jogos
            </li>
            <li class="sidebar-item" data-page="wallet">
              <span class="sidebar-item-icon">💰</span> Carteira
            </li>
            <li class="sidebar-item" data-page="ranking">
              <span class="sidebar-item-icon">🏆</span> Ranking
            </li>
            <li class="sidebar-item active" data-page="profile">
              <span class="sidebar-item-icon">👤</span> Perfil
            </li>
          </ul>
        </div>
        
        <!-- Indicador de Sincronização -->
        <div class="lobby-sync-indicator" id="profile-sync-indicator">
          <span class="sync-dot"></span>
          <span class="sync-text">Sincronizado</span>
        </div>
        
        <div style="margin-top: auto;">
          <button id="logout-btn" class="btn btn-ghost w-full">Sair</button>
        </div>
      </aside>

      <main class="main-content">
        ${hasSavedGame ? `
          <div class="card" style="background: linear-gradient(90deg, #2c3e50, #4ca1af); margin-bottom: 2rem; border: 1px solid #4ca1af; animation: fadeIn 0.5s;">
             <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                   <div style="font-size: 2rem;">🎱</div>
                   <div>
                      <h3 style="margin: 0; color: white;">Partida em Andamento</h3>
                      <p style="margin: 0; color: #eee; font-size: 0.9rem;">Você tem um jogo não finalizado. Deseja continuar?</p>
                   </div>
                </div>
                <button class="btn btn-primary" id="resume-game-btn" style="background: #fff; color: #2c3e50; border: none; font-weight: bold;">▶️ Continuar Jogo</button>
             </div>
          </div>
        ` : ''}
        <div class="profile-container animate-fadeIn">
          <div class="profile-header">
            <div class="profile-avatar-wrapper">
              <div class="profile-avatar-large" id="profile-avatar">
                ${user?.avatar_url
      ? `<img src="${formatAvatarUrl(user.avatar_url, user.username)}" alt="Avatar" class="avatar-img">`
      : user?.username?.charAt(0).toUpperCase() || '👤'}
              </div>
              ${user?.country_code ? `
                <div class="avatar-country-badge">
                  ${flagService.renderFlag(user.country_code, 'small')}
                </div>
              ` : ''}
              <button class="avatar-upload-btn" id="avatar-upload-btn" title="Alterar foto">
                📷
              </button>
            </div>
            <div class="profile-info">
              <div class="profile-name-row">
                <h1 id="profile-username">${user?.username || 'Jogador'}</h1>
                ${state.isUnlimited ? '<span class="vip-badge-profile" style="background: linear-gradient(135deg, #ffd700, #ff8c00); color: #000; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; margin-left: 0.5rem; display: inline-flex; align-items: center; gap: 4px;">👑 VIP</span>' : ''}
                ${user?.country_code ? flagService.renderFlagWithName(user.country_code, true) : ''}
                <button class="btn btn-ghost btn-sm" id="edit-profile-btn">✏️ Editar</button>
              </div>
              <p>${user?.email || ''}</p>
              <div class="profile-rank" id="profile-rank">
                🏆 Carregando...
              </div>

              <!-- Novo sistema de nível -->
              <div class="level-card-mini" style="margin-top: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                   <span id="player-level-title" style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: ${getLevelColor(user?.level || 1)}">${getLevelTitle(user?.level || 1)}</span>
                   <span style="font-size: 0.75rem; color: var(--text-muted);">Nível ${user?.level || 1}</span>
                </div>
                <div class="xp-bar-container" style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; position: relative;">
                   <div id="player-xp-progress" style="width: ${(user?.xp || 0) / (user?.xp_to_next_level || 1) * 100}%; height: 100%; background: ${getLevelColor(user?.level || 1)}; box-shadow: 0 0 10px ${getLevelColor(user?.level || 1)}; transition: width 0.5s ease;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 0.2rem; font-size: 0.65rem; color: var(--text-muted);">
                   <span id="player-xp-current">${(user?.xp || 0).toLocaleString()} XP</span>
                   <span id="player-xp-needed">${(user?.xp_to_next_level || 0).toLocaleString()} XP para level ${(user?.level || 1) + 1}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Edit Form (hidden by default) -->
          <div id="edit-form" class="card edit-form hidden">
            <h3>✏️ Editar Perfil</h3>
            <form id="profile-edit-form">
              <div class="form-group">
                <label for="edit-username">Nome de usuário</label>
                <input type="text" id="edit-username" value="${user?.username || ''}" maxlength="20">
              </div>
              ${flagService.renderCountrySelector(user?.country_code || '', 'edit-country')}
              <div class="form-actions">
                <button type="button" class="btn btn-ghost" id="cancel-edit-btn">Cancelar</button>
                <button type="submit" class="btn btn-primary">Salvar</button>
              </div>
            </form>
          </div>

          <div id="stats-grid" class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon">🎮</div>
              <div class="stat-value" id="stat-matches">0</div>
              <div class="stat-label">Partidas</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">✅</div>
              <div class="stat-value" id="stat-wins">0</div>
              <div class="stat-label">Vitórias</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">❌</div>
              <div class="stat-value red" id="stat-losses">0</div>
              <div class="stat-label">Derrotas</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">📊</div>
              <div class="stat-value" id="stat-winrate">0%</div>
              <div class="stat-label">Taxa de Vitória</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">⭐</div>
              <div class="stat-value" id="stat-points">0</div>
              <div class="stat-label">Pontos</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">🎫</div>
              <div class="stat-value" id="stat-credits">${state.credits}</div>
              <div class="stat-label">Créditos</div>
            </div>
          </div>

          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 style="font-size: 1.1rem;">📋 Histórico Recente</h3>
            </div>
            <div id="matches-list">
              <p style="text-align: center; color: var(--text-muted); padding: 2rem;">
                Jogue partidas para ver seu histórico aqui!
              </p>
            </div>
          </div>

          <!-- Seção Estatísticas vs CPU -->
          <div class="card ai-stats-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 style="font-size: 1.1rem;">🤖 Estatísticas vs CPU</h3>
              <span id="ai-rank-position" style="font-size: 0.85rem; color: var(--accent-purple); background: rgba(155, 89, 182, 0.15); padding: 0.25rem 0.75rem; border-radius: 20px;">
                Carregando...
              </span>
            </div>
            
            <div class="ai-stats-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem;">
              <div class="ai-stat-item" style="text-align: center; padding: 1rem; background: rgba(155, 89, 182, 0.1); border-radius: 12px;">
                <div id="ai-stat-matches" style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">0</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Partidas</div>
              </div>
              <div class="ai-stat-item" style="text-align: center; padding: 1rem; background: rgba(0, 255, 136, 0.1); border-radius: 12px;">
                <div id="ai-stat-wins" style="font-size: 1.5rem; font-weight: 700; color: var(--accent-green);">0</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Vitórias</div>
              </div>
              <div class="ai-stat-item" style="text-align: center; padding: 1rem; background: rgba(255, 107, 107, 0.1); border-radius: 12px;">
                <div id="ai-stat-losses" style="font-size: 1.5rem; font-weight: 700; color: #ff6b6b;">0</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Derrotas</div>
              </div>
              <div class="ai-stat-item" style="text-align: center; padding: 1rem; background: rgba(241, 196, 15, 0.1); border-radius: 12px;">
                <div id="ai-stat-winrate" style="font-size: 1.5rem; font-weight: 700; color: #f1c40f;">0%</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Taxa</div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(155, 89, 182, 0.05); border-radius: 10px;">
              <div style="display: flex; align-items: center; gap: 1rem;">
                <div>
                  <span style="font-size: 0.85rem; color: var(--text-muted);">Pontos:</span>
                  <span id="ai-stat-points" style="font-weight: 700; color: #9b59b6; margin-left: 0.5rem;">0</span>
                </div>
                <div>
                  <span style="font-size: 0.85rem; color: var(--text-muted);">Sequência atual:</span>
                  <span id="ai-stat-streak" style="font-weight: 700; color: #ff6b6b; margin-left: 0.5rem;">0🔥</span>
                </div>
                <div>
                  <span style="font-size: 0.85rem; color: var(--text-muted);">Melhor:</span>
                  <span id="ai-stat-best" style="font-weight: 700; color: #f1c40f; margin-left: 0.5rem;">0🔥</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Seção Indique e Ganhe -->
          <div class="card referral-card">
            <div class="referral-header">
              <h3>🎁 Indique e Ganhe</h3>
              <span class="referral-badge">+2 créditos por indicação</span>
            </div>
            
            <p class="referral-description">
              Convide seus amigos para jogar! Quando eles se cadastrarem pelo seu link e fizerem a primeira compra, 
              você ganha <strong>2 créditos grátis</strong> automaticamente.
            </p>

            <div class="referral-stats" id="referral-stats">
              <div class="referral-stat">
                <span class="referral-stat-value" id="ref-total">0</span>
                <span class="referral-stat-label">Indicados</span>
              </div>
              <div class="referral-stat">
                <span class="referral-stat-value" id="ref-pending">0</span>
                <span class="referral-stat-label">Pendentes</span>
              </div>
              <div class="referral-stat">
                <span class="referral-stat-value green" id="ref-earnings">0</span>
                <span class="referral-stat-label">Créditos Ganhos</span>
              </div>
            </div>

            <div class="referral-link-box">
              <label>Seu link de indicação:</label>
              <div class="referral-link-input">
                <input type="text" id="referral-link" readonly value="Carregando...">
                <button class="btn btn-sm" id="copy-referral-link" title="Copiar link">📋</button>
              </div>
            </div>

            <div class="referral-share-buttons">
              <button class="share-btn whatsapp" id="share-whatsapp" title="Compartilhar no WhatsApp">
                <span>📱</span> WhatsApp
              </button>
              <button class="share-btn telegram" id="share-telegram" title="Compartilhar no Telegram">
                <span>✈️</span> Telegram
              </button>
              <button class="share-btn twitter" id="share-twitter" title="Compartilhar no Twitter">
                <span>🐦</span> Twitter
              </button>
              <button class="share-btn facebook" id="share-facebook" title="Compartilhar no Facebook">
                <span>📘</span> Facebook
              </button>
            </div>

            <div class="referral-message-box">
              <label>Mensagem para compartilhar:</label>
              <textarea id="referral-message" readonly rows="3">🎱 Venha jogar Sinuca Online comigo! Cadastre-se pelo meu link e ganhe créditos grátis para jogar. 🏆</textarea>
              <button class="btn btn-sm btn-ghost" id="copy-referral-message">📋 Copiar mensagem</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;
}

function bindProfileEvents(app: any) {
  // Carregar dados de indicação
  loadReferralData();
  bindReferralEvents(); // Bind listeners immediately

  // Resume game
  document.getElementById('resume-game-btn')?.addEventListener('click', () => {
    app.navigate('game');
  });

  // Edit button
  document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
    document.getElementById('edit-form')?.classList.remove('hidden');
  });

  // Cancel edit
  document.getElementById('cancel-edit-btn')?.addEventListener('click', () => {
    document.getElementById('edit-form')?.classList.add('hidden');
  });

  // Save profile
  document.getElementById('profile-edit-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = (document.getElementById('edit-username') as HTMLInputElement)?.value;
    const countryCode = (document.getElementById('edit-country') as HTMLSelectElement)?.value;

    if (username && username.length >= 3) {
      const updateData: any = { username };
      if (countryCode) {
        updateData.country_code = countryCode;
        const country = flagService.getCountryByCode(countryCode);
        if (country) {
          updateData.country_name = country.name_pt;
        }
      }

      const { data, error } = await api.updateProfile(updateData);
      if (error) {
        showToast(error, 'error');
      } else {
        gameStore.setUser({ ...gameStore.getState().user, ...updateData });
        document.getElementById('profile-username')!.textContent = username;
        document.getElementById('edit-form')?.classList.add('hidden');
        showToast('Perfil atualizado!', 'success');

        // Recarregar página para atualizar bandeira
        if (countryCode) {
          setTimeout(() => window.location.reload(), 500);
        }
      }
    } else {
      showToast('Nome deve ter pelo menos 3 caracteres', 'error');
    }
  });

  // Avatar upload - Novo sistema com suporte a câmera
  document.getElementById('avatar-upload-btn')?.addEventListener('click', async () => {
    try {
      // Mostrar picker (câmera ou galeria)
      const imageResult = await imageService.showImagePicker({
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.85,
        aspectRatio: 1,
      });

      if (!imageResult) {
        return; // Usuário cancelou
      }

      showToast('Enviando avatar...', 'info');

      // Fazer upload
      const result = await imageService.uploadAvatar(imageResult);

      if (result.success && result.url) {
        // Atualizar avatar na UI (perfil)
        const avatarEl = document.getElementById('profile-avatar');
        if (avatarEl) {
          avatarEl.innerHTML = `<img src="${formatAvatarUrl(result.url)}" alt="Avatar" class="avatar-img">`;
        }

        // Atualizar avatar no header também
        const headerAvatar = document.querySelector('.header-avatar');
        if (headerAvatar) {
          headerAvatar.innerHTML = `<img src="${formatAvatarUrl(result.url)}" alt="Avatar" class="header-avatar-img">`;
        }

        const currentUser = gameStore.getState().user;
        if (currentUser) {
          gameStore.setUser({ ...currentUser, avatar_url: result.url });
        }
        showToast('Avatar atualizado!', 'success');
      } else {
        showToast(result.error || 'Erro ao enviar avatar', 'error');
      }
    } catch (err) {
      console.error('Erro no upload de avatar:', err);
      showToast('Erro ao processar imagem', 'error');
    }
  });

  // Atualizar preview da bandeira ao mudar país
  document.getElementById('edit-country')?.addEventListener('change', (e) => {
    const select = e.target as HTMLSelectElement;
    const preview = document.getElementById('edit-country-preview');
    if (preview && select.value) {
      preview.innerHTML = flagService.renderFlag(select.value, 'medium');
    } else if (preview) {
      preview.innerHTML = '';
    }
  });
}

async function loadProfile() {
  try {
    const { data: profileData } = await api.getProfile();

    if (profileData?.stats) {
      const stats = profileData.stats;
      updateElement('stat-matches', stats.total_matches || 0);
      updateElement('stat-wins', stats.wins || 0);
      updateElement('stat-losses', stats.losses || 0);
      updateElement('stat-winrate', `${stats.win_rate || 0}%`);
      updateElement('stat-points', stats.ranking_points || 0);
    }

    const { data: rankingData } = await api.getMyRanking();
    if (rankingData) {
      updateElement('profile-rank', `🏆 #${rankingData.position || '-'} no ranking • ${rankingData.points || 0} pontos`);
    } else {
      updateElement('profile-rank', '🏆 Jogue para entrar no ranking!');
    }

    // Atualizar UI de nível se houver dados novos
    if (profileData) {
      const level = profileData.level || 1;
      const xp = profileData.xp || 0;
      const xpNeeded = profileData.xp_to_next_level || 100;

      updateElement('player-level-title', getLevelTitle(level));
      const titleEl = document.getElementById('player-level-title');
      if (titleEl) titleEl.style.color = getLevelColor(level);

      updateElement('player-xp-current', `${xp.toLocaleString()} XP`);
      updateElement('player-xp-needed', `${xpNeeded.toLocaleString()} XP para level ${level + 1}`);

      const progressBar = document.getElementById('player-xp-progress');
      if (progressBar) {
        progressBar.style.width = `${(xp / xpNeeded) * 100}%`;
        progressBar.style.background = getLevelColor(level);
        progressBar.style.boxShadow = `0 0 10px ${getLevelColor(level)}`;
      }
    }

    // Carregar histórico de partidas
    await loadMatchHistory();

    // Carregar estatísticas vs CPU
    await loadAIStats();
  } catch (err) {
    console.error('Erro ao carregar perfil:', err);
    updateElement('profile-rank', '🏆 Jogue para entrar no ranking!');
  }
}

async function loadAIStats() {
  try {
    const { data } = await api.getMyAIRanking();

    if (data?.stats) {
      const stats = data.stats;
      updateElement('ai-stat-matches', stats.total_matches || 0);
      updateElement('ai-stat-wins', stats.wins || 0);
      updateElement('ai-stat-losses', stats.losses || 0);
      updateElement('ai-stat-winrate', `${stats.win_rate || 0}%`);
      updateElement('ai-stat-points', stats.points || 0);
      updateElement('ai-stat-streak', `${stats.current_streak || 0}🔥`);
      updateElement('ai-stat-best', `${stats.best_streak || 0}🔥`);

      if (stats.position) {
        updateElement('ai-rank-position', `#${stats.position} no ranking`);
      } else {
        updateElement('ai-rank-position', 'Sem ranking');
      }
    } else {
      updateElement('ai-rank-position', 'Jogue vs CPU!');
    }
  } catch (err) {
    console.error('Erro ao carregar stats AI:', err);
    updateElement('ai-rank-position', 'Erro');
  }
}

async function loadMatchHistory() {
  const container = document.getElementById('matches-list');
  if (!container) return;

  try {
    const { data } = await api.getMatchHistory(10);
    const matches = data?.matches || [];

    if (matches.length === 0) {
      container.innerHTML = `
        <p style="text-align: center; color: var(--text-muted); padding: 2rem;">
          Jogue partidas para ver seu histórico aqui!
        </p>
      `;
      return;
    }

    const userId = gameStore.getState().user?.id;

    container.innerHTML = matches.map((match: any) => {
      const isWinner = match.winner_id === userId;
      const isPlayer1 = match.player1_id === userId;
      const opponent = isPlayer1 ? match.player2 : match.player1;
      const opponentName = opponent?.username || 'Oponente';

      // Determinar resultado
      let resultText = '';
      let resultClass = '';
      let resultIcon = '';

      if (match.status === 'finished') {
        if (isWinner) {
          resultText = 'Vitória';
          resultClass = 'positive';
          resultIcon = '🏆';
        } else if (match.winner_id) {
          resultText = 'Derrota';
          resultClass = 'negative';
          resultIcon = '❌';
        } else {
          resultText = 'Empate';
          resultClass = '';
          resultIcon = '🤝';
        }
      } else if (match.status === 'cancelled') {
        resultText = 'Cancelada';
        resultClass = '';
        resultIcon = '🚫';
      } else if (match.status === 'playing') {
        resultText = 'Em andamento';
        resultClass = '';
        resultIcon = '🎮';
      } else {
        resultText = 'Aguardando';
        resultClass = '';
        resultIcon = '⏳';
      }

      // Modo da partida
      const modeIcon = match.mode === 'bet' ? '💰' : match.mode === 'ai' ? '🤖' : '🎮';
      const modeText = match.mode === 'bet' ? 'Aposta' : match.mode === 'ai' ? 'vs IA' : 'Casual';

      // Valor da aposta (se houver)
      let betInfo = '';
      if (match.mode === 'bet') {
        // Buscar valor da aposta da sala ou bet
        const betAmount = match.bet_amount || 0;
        if (betAmount > 0) {
          if (isWinner) {
            const prize = betAmount * 2 * 0.9; // 90% do pool
            betInfo = `<span class="positive">+R$ ${prize.toFixed(2)}</span>`;
          } else if (match.winner_id) {
            betInfo = `<span class="negative">-R$ ${betAmount.toFixed(2)}</span>`;
          }
        }
      }

      return `
        <div class="transaction-item" style="cursor: pointer;" data-match-id="${match.id}">
          <div class="transaction-icon ${resultClass === 'positive' ? 'deposit' : resultClass === 'negative' ? 'withdraw' : ''}">
            ${resultIcon}
          </div>
          <div class="transaction-info">
            <div class="transaction-title">vs ${opponentName}</div>
            <div class="transaction-date">
              ${modeIcon} ${modeText} • ${new Date(match.created_at).toLocaleString('pt-BR')}
            </div>
          </div>
          <div style="text-align: right;">
            <div class="transaction-amount ${resultClass}">${resultText}</div>
            ${betInfo ? `<div style="font-size: 0.85rem;">${betInfo}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Erro ao carregar histórico de partidas:', err);
    container.innerHTML = `
      <p style="text-align: center; color: var(--text-muted); padding: 2rem;">
        Erro ao carregar histórico.
      </p>
    `;
  }
}

function updateElement(id: string, value: any) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

// Dados de indicação em cache
let referralData: any = null;

async function loadReferralData() {
  try {
    const { data } = await api.request('/api/referrals/my-code') as {
      data: {
        referral_link?: string;
        share_message?: string;
        stats?: {
          total_referrals?: number;
          pending_referrals?: number;
          total_earnings?: number;
        }
      } | null
    };

    if (data) {
      referralData = data;

      // Atualizar link
      const linkInput = document.getElementById('referral-link') as HTMLInputElement;
      if (linkInput) linkInput.value = data.referral_link || '';

      // Atualizar mensagem
      const messageInput = document.getElementById('referral-message') as HTMLTextAreaElement;
      if (messageInput) messageInput.value = data.share_message || '';

      // Atualizar estatísticas
      if (data.stats) {
        updateElement('ref-total', data.stats.total_referrals);
        updateElement('ref-pending', data.stats.pending_referrals);
        updateElement('ref-earnings', data.stats.total_earnings);
      }

      // Bind share buttons (já chamados no init, mas atualiza UI se precisar)
    }
  } catch (err) {
    console.error('Erro ao carregar dados de indicação:', err);
  }
}

function bindReferralEvents() { // Funcao agnóstica a dados (usa variável global)
  // Copiar link
  document.getElementById('copy-referral-link')?.addEventListener('click', () => {
    if (!referralData) return showToast('Carregando link...', 'info');
    const linkInput = document.getElementById('referral-link') as HTMLInputElement;
    if (linkInput) {
      navigator.clipboard.writeText(linkInput.value);
      showToast('Link copiado!', 'success');
    }
  });

  // Copiar mensagem
  document.getElementById('copy-referral-message')?.addEventListener('click', () => {
    if (!referralData) return showToast('Carregando mensagem...', 'info');
    const messageInput = document.getElementById('referral-message') as HTMLTextAreaElement;
    if (messageInput) {
      const fullMessage = messageInput.value + '\n\n' + (referralData?.referral_link || '');
      navigator.clipboard.writeText(fullMessage);
      showToast('Mensagem copiada!', 'success');
    }
  });

  // Compartilhar WhatsApp
  document.getElementById('share-whatsapp')?.addEventListener('click', () => {
    if (!referralData) return showToast('Aguarde...', 'info');
    const message = encodeURIComponent(referralData.share_message + '\n\n' + referralData.referral_link);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  });

  // Compartilhar Telegram
  document.getElementById('share-telegram')?.addEventListener('click', () => {
    if (!referralData) return showToast('Aguarde...', 'info');
    const url = encodeURIComponent(referralData.referral_link);
    const text = encodeURIComponent(referralData.share_message);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
  });

  // Compartilhar Twitter
  document.getElementById('share-twitter')?.addEventListener('click', () => {
    if (!referralData) return showToast('Aguarde...', 'info');
    const text = encodeURIComponent(referralData.share_message);
    const url = encodeURIComponent(referralData.referral_link);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  });

  // Compartilhar Facebook
  document.getElementById('share-facebook')?.addEventListener('click', () => {
    if (!referralData) return showToast('Aguarde...', 'info');
    const url = encodeURIComponent(referralData.referral_link);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
  });
}

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 4000);
}
