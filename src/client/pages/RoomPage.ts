import { gameStore } from '../store/gameStore';
import { api } from '../services/api';
import { realtimeService } from '../services/realtime';
import { ROOM_EVENTS } from '../../shared/realtime/events';
import { renderHeader } from '../components/Header';

let pollingInterval: number | null = null;
let isNavigating: boolean = false; // Flag para evitar navegações duplicadas

export function RoomPage(app: any, roomData: any): string {
  const state = gameStore.getState();
  const user = state.user;

  const room = roomData || { id: '0', mode: 'casual', owner: user, guest: null, status: 'open' };
  
  // Reset flag de navegação
  isNavigating = false;
  
  // Se é modo AI, vai direto pro jogo
  if (room.mode === 'ai') {
    setTimeout(() => {
      app.navigate('game', { ...room, guest: { username: '🤖 CPU' } });
    }, 100);
    return `
      <div class="auth-container">
        <div class="loading">
          <div class="spinner"></div>
          <p class="loading-text">Iniciando partida contra a CPU...</p>
        </div>
      </div>
    `;
  }

  const isOwner = room.owner_id === user?.id || room.owner?.id === user?.id;
  const hasGuest = !!room.guest_id || !!room.guest;
  const canStart = isOwner && hasGuest;

  // Conectar ao realtime e configurar eventos
  setTimeout(() => {
    setupRealtime(room, app, user);
    bindRoomEvents(app, room);
    
    // Polling como fallback para detectar mudanças de estado
    // Tanto o dono quanto o convidado fazem polling
    startPolling(room.id, app);
  }, 100);

  const modeLabels: Record<string, string> = {
    casual: '🎮 Partida Casual',
    ranked: '🏆 Partida Ranqueada',
    bet: '💰 Partida com Aposta',
    ai: '🤖 vs CPU'
  };

  const ownerName = room.owner?.username || 'Jogador 1';
  const guestName = room.guest?.username || null;

  return `
    ${renderHeader({ showStats: true, logoClickable: true, navigateTo: 'lobby' })}

    <div class="room-page">
      <div class="room-container animate-fadeIn">
        <h1 class="room-title">Sala de ${ownerName}</h1>
        <div class="room-mode-badge">${modeLabels[room.mode] || modeLabels.casual}</div>

        ${room.is_private && room.invite_code ? `
          <div style="margin-bottom: 1rem; padding: 0.75rem 1rem; background: rgba(0, 212, 255, 0.1); border-radius: 8px; border: 1px solid rgba(0, 212, 255, 0.3);">
            <span style="color: var(--text-secondary);">🔒 Código da sala: </span>
            <strong style="color: var(--accent-blue); font-size: 1.2rem; letter-spacing: 2px;">${room.invite_code}</strong>
            <button class="btn btn-ghost btn-sm" style="margin-left: 0.5rem;" onclick="navigator.clipboard.writeText('${room.invite_code}'); this.textContent='Copiado!';">📋</button>
          </div>
        ` : ''}

        ${room.bet_amount ? `
          <div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(255, 165, 2, 0.1); border-radius: 12px; border: 1px solid rgba(255, 165, 2, 0.3);">
            <span style="color: var(--accent-yellow); font-weight: 700;">💰 Aposta: R$ ${room.bet_amount.toFixed(2)}</span>
          </div>
        ` : ''}

        <div class="players-container">
          <div class="player-slot">
            <div class="player-avatar">
              ${ownerName.charAt(0).toUpperCase()}
            </div>
            <p class="player-name">${ownerName}</p>
            <p class="player-label">${isOwner ? 'Você (Dono)' : 'Dono da Sala'}</p>
          </div>

          <div class="vs-text">VS</div>

          <div class="player-slot">
            <div class="player-avatar ${!hasGuest ? 'waiting' : ''}">
              ${hasGuest ? (guestName?.charAt(0).toUpperCase() || '👤') : '?'}
            </div>
            <p class="player-name">${hasGuest ? guestName : 'Aguardando...'}</p>
            <p class="player-label">${hasGuest ? (!isOwner ? 'Você' : 'Desafiante') : 'Slot Vazio'}</p>
          </div>
        </div>

        <p class="room-status-text" id="room-status">
          ${hasGuest ? '✅ Sala completa! Pronto para iniciar.' : '⏳ Aguardando outro jogador entrar...'}
        </p>

        <div class="room-actions">
          <button id="leave-room-btn" class="btn btn-secondary">← Sair da Sala</button>
          ${isOwner ? `
            <button id="start-match-btn" class="btn btn-primary btn-lg" ${!canStart ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
              🎯 Iniciar Partida
            </button>
          ` : `
            ${hasGuest ? '<p style="color: var(--accent-green);">Aguardando o dono iniciar...</p>' : ''}
          `}
        </div>

        ${!hasGuest && isOwner ? `
          <p style="margin-top: 2rem; color: var(--text-muted); font-size: 0.9rem;">
            ${room.is_private 
              ? 'Compartilhe o código acima com um amigo para ele entrar.' 
              : 'Sua sala está visível no lobby. Aguarde alguém entrar ou compartilhe o link.'}
          </p>
        ` : ''}
      </div>
    </div>
  `;
}

async function setupRealtime(room: any, app: any, user: any) {
  // Conectar ao canal da sala
  console.log('[RoomPage] Conectando ao realtime da sala:', room.id);
  await realtimeService.joinRoom(room.id, user.id);
  console.log('[RoomPage] Conectado ao realtime!');

  // Listener para quando jogador entrar
  realtimeService.on(ROOM_EVENTS.PLAYER_JOINED, (payload) => {
    console.log('[RoomPage] Jogador entrou:', payload);
    if (isNavigating) return;
    
    // Atualizar UI sem recarregar a página inteira
    const statusEl = document.getElementById('room-status');
    if (statusEl) {
      statusEl.textContent = '✅ Sala completa! Pronto para iniciar.';
    }
    
    // Habilitar botão de iniciar se for o dono
    const startBtn = document.getElementById('start-match-btn') as HTMLButtonElement;
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.style.opacity = '1';
      startBtn.style.cursor = 'pointer';
    }
    
    // Atualizar avatar do convidado
    const guestSlot = document.querySelector('.player-slot:last-child .player-avatar');
    if (guestSlot && payload.player) {
      guestSlot.textContent = payload.player.username?.charAt(0).toUpperCase() || '👤';
      guestSlot.classList.remove('waiting');
    }
    
    const guestName = document.querySelector('.player-slot:last-child .player-name');
    if (guestName && payload.player) {
      guestName.textContent = payload.player.username || 'Jogador';
    }
  });

  // Listener para quando jogador sair
  realtimeService.on(ROOM_EVENTS.PLAYER_LEFT, (payload) => {
    console.log('[RoomPage] Jogador saiu:', payload);
    if (isNavigating) return;
    
    // Atualizar UI
    const statusEl = document.getElementById('room-status');
    if (statusEl) {
      statusEl.textContent = '⏳ Aguardando outro jogador entrar...';
    }
    
    // Desabilitar botão de iniciar
    const startBtn = document.getElementById('start-match-btn') as HTMLButtonElement;
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.style.opacity = '0.5';
      startBtn.style.cursor = 'not-allowed';
    }
  });

  // CRÍTICO: Listener para quando o jogo começar
  realtimeService.on(ROOM_EVENTS.GAME_STARTED, (payload) => {
    console.log('[RoomPage] 🎮 GAME_STARTED recebido!', payload);
    if (isNavigating) return;
    isNavigating = true;
    
    stopPolling();
    
    // Navegar para o jogo com os dados da partida
    const gameData = {
      ...room,
      match: { id: payload.matchId },
      matchId: payload.matchId,
      gameMode: payload.gameMode || '15ball',
      player1: payload.player1,
      player2: payload.player2,
      owner: payload.player1,
      guest: payload.player2,
      owner_id: payload.player1?.id,
      guest_id: payload.player2?.id,
      firstPlayerId: payload.firstPlayerId,
      isMultiplayer: true
    };
    
    console.log('[RoomPage] Navegando para game com dados:', gameData);
    app.navigate('game', gameData);
  });

  // Listener para sala fechada
  realtimeService.on(ROOM_EVENTS.CLOSED, () => {
    console.log('[RoomPage] Sala fechada');
    if (isNavigating) return;
    isNavigating = true;
    
    stopPolling();
    realtimeService.leaveRoom();
    app.navigate('lobby');
  });
}

function bindRoomEvents(app: any, room: any) {
  // Leave room
  document.getElementById('leave-room-btn')?.addEventListener('click', async () => {
    stopPolling();
    await realtimeService.leaveRoom();
    const { error } = await api.leaveRoom(room.id);
    if (error) {
      console.error('Erro ao sair:', error);
    }
    app.navigate('lobby');
  });

  // Start match - CRÍTICO: Envia broadcast para todos na sala
  document.getElementById('start-match-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('start-match-btn') as HTMLButtonElement;
    if (btn.disabled || isNavigating) return;

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div> Iniciando...';

    stopPolling();

    console.log('[RoomPage] Iniciando partida...');

    try {
      // Criar e iniciar partida no servidor
      const { data: matchData, error } = await api.createMatch(room.id);

      if (error) {
        console.error('[RoomPage] Erro ao criar partida:', error);
        btn.disabled = false;
        btn.innerHTML = '🎯 Iniciar Partida';
        alert(error);
        return;
      }

      console.log('[RoomPage] Partida criada:', matchData);

      // Iniciar a partida
      await api.startMatch(matchData.id);
      console.log('[RoomPage] Partida iniciada no servidor');

      // Preparar dados do jogo
      const gameStartPayload = {
        roomId: room.id,
        matchId: matchData.id,
        player1: { 
          id: room.owner_id || room.owner?.id, 
          username: room.owner?.username || 'Jogador 1' 
        },
        player2: { 
          id: room.guest_id || room.guest?.id, 
          username: room.guest?.username || 'Jogador 2' 
        },
        gameMode: room.gameMode || '15ball',
        firstPlayerId: room.owner_id || room.owner?.id
      };

      console.log('[RoomPage] Enviando GAME_STARTED broadcast:', gameStartPayload);

      // CRÍTICO: Enviar broadcast para TODOS na sala
      await realtimeService.broadcastGameStarted(gameStartPayload);

      console.log('[RoomPage] Broadcast enviado! Navegando para o jogo...');

      // Marcar como navegando para evitar duplicação
      isNavigating = true;

      // Navegar imediatamente (o outro jogador receberá o broadcast)
      app.navigate('game', {
        ...room,
        match: matchData,
        matchId: matchData.id,
        gameMode: room.gameMode || '15ball',
        player1: gameStartPayload.player1,
        player2: gameStartPayload.player2,
        owner: gameStartPayload.player1,
        guest: gameStartPayload.player2,
        owner_id: gameStartPayload.player1.id,
        guest_id: gameStartPayload.player2.id,
        firstPlayerId: gameStartPayload.firstPlayerId,
        isMultiplayer: true
      });
    } catch (err) {
      console.error('[RoomPage] Erro ao iniciar partida:', err);
      btn.disabled = false;
      btn.innerHTML = '🎯 Iniciar Partida';
      alert('Erro ao iniciar partida. Tente novamente.');
    }
  });
}

function startPolling(roomId: string, app: any) {
  if (pollingInterval) return;

  // Polling mais lento como fallback (5 segundos)
  pollingInterval = window.setInterval(async () => {
    if (isNavigating) {
      stopPolling();
      return;
    }
    
    const { data, error } = await api.getRoom(roomId);
    
    if (error || !data) {
      stopPolling();
      return;
    }

    // Se a sala foi fechada
    if (data.status === 'closed') {
      if (isNavigating) return;
      isNavigating = true;
      stopPolling();
      realtimeService.leaveRoom();
      app.navigate('lobby');
      return;
    }

    // Se a partida começou (fallback caso o broadcast não chegue)
    if (data.status === 'playing') {
      if (isNavigating) return;
      isNavigating = true;
      console.log('[RoomPage] Polling detectou status playing - navegando para o jogo');
      stopPolling();
      app.navigate('game', {
        ...data,
        isMultiplayer: true,
        gameMode: data.gameMode || '15ball'
      });
      return;
    }

    // Se alguém entrou, apenas atualizar UI (não recarregar página)
    if (data.guest_id || data.guest) {
      const statusEl = document.getElementById('room-status');
      if (statusEl && statusEl.textContent?.includes('Aguardando')) {
        statusEl.textContent = '✅ Sala completa! Pronto para iniciar.';
        
        // Habilitar botão de iniciar
        const startBtn = document.getElementById('start-match-btn') as HTMLButtonElement;
        if (startBtn) {
          startBtn.disabled = false;
          startBtn.style.opacity = '1';
          startBtn.style.cursor = 'pointer';
        }
        
        // Notificar via realtime
        realtimeService.broadcastPlayerJoined({
          id: data.guest_id || data.guest?.id,
          username: data.guest?.username || 'Jogador'
        });
      }
    }
  }, 5000); // Polling a cada 5 segundos (mais lento)
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}
