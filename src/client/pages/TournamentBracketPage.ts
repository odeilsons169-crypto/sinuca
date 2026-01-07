// =====================================================
// PÁGINA DE BRACKET DO TORNEIO
// Visualização estilo esports com Grupo A e Grupo B
// =====================================================

import { api } from '../services/api.js';
import { gameStore } from '../store/gameStore.js';

interface BracketMatch {
  id: string;
  round: number;
  match_number: number;
  bracket_position: string;
  group_side: string | null;
  status: string;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  player1_score: number;
  player2_score: number;
  player1?: { id: string; username: string; avatar_url?: string };
  player2?: { id: string; username: string; avatar_url?: string };
  winner?: { id: string; username: string };
  is_bye: boolean;
}

export function TournamentBracketPage(app: any, params?: any): string {
  const tournamentId = params?.id || params?.tournamentId;
  
  if (!tournamentId) {
    return `
      <div class="bracket-page">
        <div class="bracket-error">
          <h2>❌ Torneio não encontrado</h2>
          <button class="btn btn-primary" data-navigate="lobby">Voltar ao Lobby</button>
        </div>
      </div>
    `;
  }

  // Carregar dados após render
  setTimeout(() => loadBracketData(tournamentId), 100);

  return `
    <div class="bracket-page">
      <div class="bracket-header">
        <button class="btn btn-ghost" data-navigate="lobby">← Voltar</button>
        <h1 id="tournament-title">🏆 Carregando...</h1>
        <div id="tournament-status"></div>
      </div>
      
      <div id="bracket-container" class="bracket-container">
        <div class="bracket-loading">
          <div class="spinner"></div>
          <p>Carregando bracket...</p>
        </div>
      </div>
      
      <div id="tournament-info" class="tournament-info-panel"></div>
    </div>
    
    <style>
      .bracket-page {
        min-height: 100vh;
        background: linear-gradient(135deg, #0a1628 0%, #1a2744 50%, #0d1f3c 100%);
        padding: 1rem;
        overflow-x: auto;
      }
      
      .bracket-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 2rem;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 12px;
        margin-bottom: 2rem;
      }
      
      .bracket-header h1 {
        color: #fff;
        font-size: 1.5rem;
        text-transform: uppercase;
        letter-spacing: 2px;
        text-shadow: 0 0 20px rgba(0, 200, 255, 0.5);
      }
      
      .bracket-container {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        gap: 0;
        min-width: 1200px;
        padding: 2rem;
      }
      
      .bracket-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 400px;
        color: #fff;
      }
      
      .bracket-group {
        display: flex;
        flex-direction: column;
        gap: 0;
      }
      
      .bracket-group-title {
        text-align: center;
        color: #00d4ff;
        font-size: 1.2rem;
        font-weight: bold;
        margin-bottom: 1rem;
        text-transform: uppercase;
        letter-spacing: 3px;
      }
      
      .bracket-round {
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        min-width: 200px;
        padding: 0 0.5rem;
      }
      
      .bracket-round-title {
        text-align: center;
        color: #8892a0;
        font-size: 0.75rem;
        text-transform: uppercase;
        margin-bottom: 0.5rem;
        letter-spacing: 1px;
      }
      
      .bracket-match {
        background: linear-gradient(135deg, rgba(20, 40, 80, 0.9), rgba(30, 50, 90, 0.9));
        border: 1px solid rgba(0, 200, 255, 0.3);
        border-radius: 8px;
        margin: 0.5rem 0;
        overflow: hidden;
        transition: all 0.3s ease;
        position: relative;
      }
      
      .bracket-match:hover {
        border-color: rgba(0, 200, 255, 0.8);
        box-shadow: 0 0 20px rgba(0, 200, 255, 0.3);
        transform: scale(1.02);
      }
      
      .bracket-match.finished {
        border-color: rgba(0, 255, 136, 0.5);
      }
      
      .bracket-match.in-progress {
        border-color: rgba(255, 200, 0, 0.8);
        animation: pulse-border 2s infinite;
      }
      
      @keyframes pulse-border {
        0%, 100% { box-shadow: 0 0 5px rgba(255, 200, 0, 0.5); }
        50% { box-shadow: 0 0 20px rgba(255, 200, 0, 0.8); }
      }
      
      .bracket-player {
        display: flex;
        align-items: center;
        padding: 0.5rem 0.75rem;
        gap: 0.5rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        transition: background 0.2s;
      }
      
      .bracket-player:last-child {
        border-bottom: none;
      }
      
      .bracket-player.winner {
        background: linear-gradient(90deg, rgba(0, 255, 136, 0.2), transparent);
      }
      
      .bracket-player.loser {
        opacity: 0.5;
      }
      
      .bracket-player.empty {
        opacity: 0.3;
      }
      
      .bracket-player-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea, #764ba2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        font-weight: bold;
        color: #fff;
        flex-shrink: 0;
      }
      
      .bracket-player-name {
        flex: 1;
        color: #fff;
        font-size: 0.85rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .bracket-player-score {
        background: rgba(0, 0, 0, 0.3);
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        color: #fff;
        font-weight: bold;
        font-size: 0.8rem;
        min-width: 24px;
        text-align: center;
      }
      
      .bracket-player.winner .bracket-player-score {
        background: rgba(0, 255, 136, 0.3);
        color: #00ff88;
      }
      
      .bracket-connector {
        position: relative;
      }
      
      .bracket-connector::after {
        content: '';
        position: absolute;
        right: -20px;
        top: 50%;
        width: 20px;
        height: 2px;
        background: rgba(0, 200, 255, 0.5);
      }
      
      .bracket-final {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 0 2rem;
      }
      
      .bracket-trophy {
        font-size: 4rem;
        margin-bottom: 1rem;
        animation: trophy-glow 2s infinite;
      }
      
      @keyframes trophy-glow {
        0%, 100% { filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.5)); }
        50% { filter: drop-shadow(0 0 30px rgba(255, 215, 0, 0.9)); }
      }
      
      .bracket-winner-label {
        color: #ffd700;
        font-size: 1.2rem;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 3px;
        margin-bottom: 1rem;
        text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
      }
      
      .bracket-final-match {
        min-width: 220px;
      }
      
      .tournament-info-panel {
        background: rgba(0, 0, 0, 0.3);
        border-radius: 12px;
        padding: 1.5rem;
        margin-top: 2rem;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
      }
      
      .info-card {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 1rem;
        text-align: center;
      }
      
      .info-card-label {
        color: #8892a0;
        font-size: 0.8rem;
        text-transform: uppercase;
        margin-bottom: 0.5rem;
      }
      
      .info-card-value {
        color: #fff;
        font-size: 1.2rem;
        font-weight: bold;
      }
      
      .info-card-value.prize {
        color: #ffd700;
      }
      
      .bracket-bye {
        opacity: 0.5;
        font-style: italic;
      }
      
      /* Responsivo */
      @media (max-width: 1200px) {
        .bracket-container {
          flex-direction: column;
          min-width: auto;
        }
        
        .bracket-group {
          flex-direction: row;
          overflow-x: auto;
        }
      }
    </style>
  `;
}

async function loadBracketData(tournamentId: string) {
  const container = document.getElementById('bracket-container');
  const titleEl = document.getElementById('tournament-title');
  const statusEl = document.getElementById('tournament-status');
  const infoEl = document.getElementById('tournament-info');
  
  if (!container) return;

  try {
    // Carregar dados do torneio e bracket em paralelo
    const [tournamentRes, bracketRes] = await Promise.all([
      api.getTournament(tournamentId),
      api.getTournamentBracket(tournamentId),
    ]);

    if (tournamentRes.error || !tournamentRes.data) {
      container.innerHTML = `
        <div class="bracket-error">
          <h2>❌ Erro ao carregar torneio</h2>
          <p>${tournamentRes.error || 'Torneio não encontrado'}</p>
        </div>
      `;
      return;
    }

    const tournament = tournamentRes.data;
    const bracket = bracketRes.data;

    // Atualizar título
    if (titleEl) {
      titleEl.textContent = `🏆 ${tournament.name}`;
    }

    // Atualizar status
    if (statusEl) {
      const statusColors: Record<string, string> = {
        'draft': '#888',
        'open': '#00ff88',
        'in_progress': '#ffc800',
        'finished': '#00d4ff',
        'cancelled': '#ff4444',
      };
      const statusLabels: Record<string, string> = {
        'draft': 'Rascunho',
        'open': 'Inscrições Abertas',
        'in_progress': 'Em Andamento',
        'finished': 'Finalizado',
        'cancelled': 'Cancelado',
      };
      statusEl.innerHTML = `
        <span style="background: ${statusColors[tournament.status] || '#888'}; color: #000; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: bold;">
          ${statusLabels[tournament.status] || tournament.status}
        </span>
      `;
    }

    // Renderizar bracket
    if (!bracket || !bracket.rounds || Object.keys(bracket.rounds).length === 0) {
      container.innerHTML = `
        <div class="bracket-loading">
          <p>⏳ O bracket será gerado quando o torneio iniciar</p>
          <p style="color: #8892a0; font-size: 0.9rem;">Participantes: ${tournament.participants?.length || 0}/${tournament.max_participants}</p>
        </div>
      `;
    } else {
      container.innerHTML = renderBracket(bracket, tournament);
    }

    // Renderizar info panel
    if (infoEl) {
      const prizeInfo = tournament.prize_info;
      infoEl.innerHTML = `
        <div class="info-card">
          <div class="info-card-label">💰 Premiação Total</div>
          <div class="info-card-value prize">R$ ${(prizeInfo?.prizePool || 0).toFixed(2)}</div>
        </div>
        <div class="info-card">
          <div class="info-card-label">👥 Participantes</div>
          <div class="info-card-value">${tournament.participants?.length || 0}/${tournament.max_participants}</div>
        </div>
        <div class="info-card">
          <div class="info-card-label">🎫 Inscrição</div>
          <div class="info-card-value">${tournament.entry_fee > 0 ? `R$ ${tournament.entry_fee.toFixed(2)}` : 'Grátis'}</div>
        </div>
        <div class="info-card">
          <div class="info-card-label">🎱 Modo</div>
          <div class="info-card-value">${tournament.game_mode === '9ball' ? '9 Bolas' : '8 Bolas'}</div>
        </div>
      `;
    }

  } catch (err) {
    console.error('Erro ao carregar bracket:', err);
    container.innerHTML = `
      <div class="bracket-error">
        <h2>❌ Erro de conexão</h2>
        <button class="btn btn-primary" onclick="location.reload()">Tentar novamente</button>
      </div>
    `;
  }
}

function renderBracket(bracket: any, tournament: any): string {
  const rounds = bracket.rounds;
  const numRounds = Object.keys(rounds).length;
  
  // Separar partidas por grupo
  const groupAMatches: Record<number, BracketMatch[]> = {};
  const groupBMatches: Record<number, BracketMatch[]> = {};
  let finalMatch: BracketMatch | null = null;
  const semifinalMatches: BracketMatch[] = [];

  for (const [roundNum, matches] of Object.entries(rounds)) {
    const round = parseInt(roundNum);
    for (const match of matches as BracketMatch[]) {
      if (match.bracket_position === 'FINAL') {
        finalMatch = match;
      } else if (match.bracket_position?.startsWith('SF')) {
        semifinalMatches.push(match);
      } else if (match.group_side === 'A') {
        if (!groupAMatches[round]) groupAMatches[round] = [];
        groupAMatches[round].push(match);
      } else if (match.group_side === 'B') {
        if (!groupBMatches[round]) groupBMatches[round] = [];
        groupBMatches[round].push(match);
      }
    }
  }

  // Ordenar semifinais
  semifinalMatches.sort((a, b) => a.match_number - b.match_number);

  return `
    <!-- Grupo A (Esquerda) -->
    <div class="bracket-group bracket-group-left">
      <div class="bracket-group-title">Grupo A</div>
      <div style="display: flex;">
        ${renderGroupRounds(groupAMatches, 'left')}
        ${semifinalMatches.length > 0 ? renderSemifinal(semifinalMatches[0], 'left') : ''}
      </div>
    </div>
    
    <!-- Final (Centro) -->
    <div class="bracket-final">
      <div class="bracket-trophy">🏆</div>
      <div class="bracket-winner-label">WINNER</div>
      ${finalMatch ? renderMatch(finalMatch, true) : '<div class="bracket-match bracket-final-match"><div class="bracket-player empty"><span class="bracket-player-name">Aguardando...</span></div><div class="bracket-player empty"><span class="bracket-player-name">Aguardando...</span></div></div>'}
      <div style="margin-top: 1rem; color: #8892a0; font-size: 0.9rem;">FINAL</div>
    </div>
    
    <!-- Grupo B (Direita) -->
    <div class="bracket-group bracket-group-right">
      <div class="bracket-group-title">Grupo B</div>
      <div style="display: flex; flex-direction: row-reverse;">
        ${renderGroupRounds(groupBMatches, 'right')}
        ${semifinalMatches.length > 1 ? renderSemifinal(semifinalMatches[1], 'right') : ''}
      </div>
    </div>
  `;
}

function renderGroupRounds(groupMatches: Record<number, BracketMatch[]>, side: 'left' | 'right'): string {
  const rounds = Object.keys(groupMatches).map(Number).sort((a, b) => side === 'left' ? a - b : b - a);
  
  return rounds.map(round => {
    const matches = groupMatches[round];
    const roundName = getRoundName(round, matches[0]?.bracket_position);
    
    return `
      <div class="bracket-round">
        <div class="bracket-round-title">${roundName}</div>
        ${matches.map(m => renderMatch(m)).join('')}
      </div>
    `;
  }).join('');
}

function renderSemifinal(match: BracketMatch, side: 'left' | 'right'): string {
  return `
    <div class="bracket-round">
      <div class="bracket-round-title">Semifinal</div>
      ${renderMatch(match)}
    </div>
  `;
}

function renderMatch(match: BracketMatch, isFinal: boolean = false): string {
  const statusClass = match.status === 'finished' ? 'finished' : 
                      match.status === 'in_progress' ? 'in-progress' : '';
  
  return `
    <div class="bracket-match ${statusClass} ${isFinal ? 'bracket-final-match' : ''}" data-match-id="${match.id}">
      ${renderPlayer(match, 1)}
      ${renderPlayer(match, 2)}
    </div>
  `;
}

function renderPlayer(match: BracketMatch, playerNum: 1 | 2): string {
  const player = playerNum === 1 ? match.player1 : match.player2;
  const playerId = playerNum === 1 ? match.player1_id : match.player2_id;
  const score = playerNum === 1 ? match.player1_score : match.player2_score;
  
  const isWinner = match.winner_id && match.winner_id === playerId;
  const isLoser = match.winner_id && match.winner_id !== playerId && playerId;
  const isEmpty = !playerId;
  const isBye = match.is_bye && playerNum === 2;
  
  let className = 'bracket-player';
  if (isWinner) className += ' winner';
  if (isLoser) className += ' loser';
  if (isEmpty) className += ' empty';
  
  const avatar = player?.username?.charAt(0).toUpperCase() || '?';
  const name = isBye ? 'BYE' : (player?.username || 'Aguardando...');
  
  return `
    <div class="${className}">
      <div class="bracket-player-avatar ${isBye ? 'bracket-bye' : ''}">${isBye ? '-' : avatar}</div>
      <span class="bracket-player-name ${isBye ? 'bracket-bye' : ''}">${name}</span>
      ${match.status === 'finished' && !isBye ? `<span class="bracket-player-score">${score}</span>` : ''}
    </div>
  `;
}

function getRoundName(round: number, bracketPosition?: string): string {
  if (bracketPosition?.startsWith('QF')) return 'Quartas';
  if (bracketPosition?.startsWith('R1')) return 'Oitavas';
  if (bracketPosition?.startsWith('R2')) return 'Rodada 2';
  return `Rodada ${round}`;
}

export default TournamentBracketPage;
