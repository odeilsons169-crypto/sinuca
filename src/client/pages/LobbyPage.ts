import { gameStore } from '../store/gameStore.js';
import { api } from '../services/api.js';
import { renderHeader } from '../components/Header.js';

// Flag para evitar múltiplas chamadas
let isLoadingRooms = false;

// Intervalo de sincronização em tempo real
let lobbySyncInterval: ReturnType<typeof setInterval> | null = null;
const LOBBY_SYNC_INTERVAL = 15000; // 15 segundos

// Cleanup function when leaving lobby
export function cleanupLobbyPage() {
  if (lobbySyncInterval) {
    clearInterval(lobbySyncInterval);
    lobbySyncInterval = null;
  }
}

// Setup realtime sync for lobby
function setupLobbySyncInterval() {
  // Clear any existing interval
  if (lobbySyncInterval) {
    clearInterval(lobbySyncInterval);
  }
  
  // Sync every 15 seconds
  lobbySyncInterval = setInterval(async () => {
    // Check if we're still on lobby page
    const lobbyEl = document.querySelector('.lobby');
    if (!lobbyEl) {
      cleanupLobbyPage();
      return;
    }
    
    // Update sync indicator
    const indicator = document.getElementById('lobby-sync-indicator');
    if (indicator) {
      indicator.classList.add('syncing');
      const textEl = indicator.querySelector('.sync-text');
      if (textEl) textEl.textContent = 'Atualizando...';
    }
    
    // Reload data silently
    await Promise.all([
      loadRooms(true),
      loadTopPlayers(true),
      loadLives(true),
      refreshUserBalance(),
    ]);
    
    // Reset indicator
    if (indicator) {
      indicator.classList.remove('syncing');
      const textEl = indicator.querySelector('.sync-text');
      if (textEl) textEl.textContent = 'Sincronizado';
    }
  }, LOBBY_SYNC_INTERVAL);
}

// Refresh user balance from API
async function refreshUserBalance() {
  try {
    const { data } = await api.getProfile();
    if (data) {
      gameStore.setState({
        balance: data.wallet?.balance || 0,
        credits: data.credits?.amount || 0,
        isUnlimited: data.credits?.is_unlimited || false,
      });
      
      // Update UI
      const balanceEl = document.querySelector('.header-stat-value.green');
      const creditsEl = document.querySelector('.header-stat-value.blue');
      
      if (balanceEl) {
        balanceEl.textContent = `R$ ${(data.wallet?.balance || 0).toFixed(2)}`;
      }
      if (creditsEl) {
        creditsEl.textContent = data.credits?.is_unlimited ? '∞' : String(data.credits?.amount || 0);
      }
    }
  } catch (err) {
    console.error('Erro ao atualizar saldo:', err);
  }
}

export function LobbyPage(app: any): string {
  const state = gameStore.getState();
  const user = state.user;

  // Carregar salas após render (com debounce)
  setTimeout(() => {
    if (!isLoadingRooms) {
      isLoadingRooms = true;
      loadRooms().finally(() => { isLoadingRooms = false; });
    }

    // Resume game event
    document.getElementById('resume-game-lobby-btn')?.addEventListener('click', () => {
      app.navigate('game');
    });
    
    // Botão criar sala
    document.getElementById('create-room-btn')?.addEventListener('click', () => {
      document.getElementById('create-room-modal')?.classList.remove('hidden');
    });
    
    // Botão refresh salas
    document.getElementById('refresh-rooms-btn')?.addEventListener('click', () => {
      if (!isLoadingRooms) {
        isLoadingRooms = true;
        loadRooms().finally(() => { isLoadingRooms = false; });
      }
    });
    
    // Botão entrar por código
    document.getElementById('join-private-room-btn')?.addEventListener('click', () => {
      document.getElementById('join-private-modal')?.classList.remove('hidden');
    });
    
    // Modal entrar por código - fechar
    document.querySelector('#join-private-modal .modal-close')?.addEventListener('click', () => {
      document.getElementById('join-private-modal')?.classList.add('hidden');
    });
    
    // Modal entrar por código - confirmar
    document.getElementById('join-private-btn')?.addEventListener('click', async () => {
      const codeInput = document.getElementById('room-code') as HTMLInputElement;
      const code = codeInput?.value?.toUpperCase()?.trim();
      
      if (!code || code.length < 4) {
        alert('Digite um código válido');
        return;
      }
      
      const { data: roomData, error } = await api.joinRoomByCode(code);
      if (error) {
        alert(error);
        return;
      }
      
      document.getElementById('join-private-modal')?.classList.add('hidden');
      
      if (roomData) {
        const { data: fullRoom } = await api.getRoom(roomData.id);
        app.navigate('room', fullRoom || roomData);
      }
    });
    
    // Modal criar sala - fechar
    document.querySelector('#create-room-modal .modal-close')?.addEventListener('click', () => {
      document.getElementById('create-room-modal')?.classList.add('hidden');
    });

    // ==================== CARREGAR TOP 10 E LIVES ====================
    loadTopPlayers();
    loadLives();
    
    // ==================== INICIAR SINCRONIZAÇÃO EM TEMPO REAL ====================
    setupLobbySyncInterval();

    // Botão refresh lives
    document.getElementById('refresh-lives-btn')?.addEventListener('click', () => {
      loadLives();
    });

    // ==================== EVENTOS DE TORNEIOS ====================
    
    // Carregar torneios
    loadTournaments();

    // Botão criar torneio
    document.getElementById('create-tournament-btn')?.addEventListener('click', async () => {
      const modal = document.getElementById('create-tournament-modal');
      const body = document.getElementById('create-tournament-body');
      if (!modal || !body) return;
      
      modal.classList.remove('hidden');
      body.innerHTML = `<div class="loading"><div class="spinner"></div><p class="loading-text">Verificando permissão...</p></div>`;
      
      // Verificar se pode criar torneio (VIP)
      const { data, error } = await api.canCreateTournament();
      
      if (error) {
        body.innerHTML = `<div class="empty-state"><p class="empty-state-text">Erro ao verificar permissão</p></div>`;
        return;
      }
      
      if (!data?.canCreate) {
        // Não é VIP - mostrar planos para assinar
        const { data: plansData } = await api.getVipPlans();
        const plans = plansData?.plans || [];
        
        body.innerHTML = `
          <div style="text-align: center; padding: 0.5rem;">
            <div style="font-size: 4rem; margin-bottom: 0.5rem;">👑</div>
            <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">Recurso Exclusivo VIP</h3>
            <p style="color: var(--text-secondary); margin-bottom: 1rem;">
              ${data?.message || 'Assine o plano VIP para criar seus próprios torneios!'}
            </p>
            
            <div style="background: rgba(255, 165, 2, 0.1); padding: 1rem; border-radius: 12px; border: 1px solid rgba(255, 165, 2, 0.3); margin-bottom: 1rem;">
              <h4 style="color: var(--accent-yellow); margin-bottom: 0.5rem;">💰 Benefícios VIP:</h4>
              <ul style="text-align: left; color: var(--text-secondary); font-size: 0.85rem; list-style: none; padding: 0;">
                <li style="margin-bottom: 0.25rem;">✅ Créditos <strong>ilimitados</strong></li>
                <li style="margin-bottom: 0.25rem;">✅ Criar torneios e ganhar <strong style="color: var(--accent-green);">20%</strong></li>
                <li style="margin-bottom: 0.25rem;">✅ Selo VIP no perfil</li>
                <li>✅ Suporte prioritário</li>
              </ul>
            </div>
            
            <!-- Planos VIP -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
              ${plans.map((plan: any) => `
                <div class="vip-plan-card" data-plan-id="${plan.id}" style="background: var(--bg-secondary); border: 2px solid ${plan.id === 'yearly' ? 'var(--accent-yellow)' : 'var(--border-color)'}; border-radius: 12px; padding: 1rem; cursor: pointer; transition: all 0.2s; position: relative;">
                  ${plan.id === 'yearly' ? '<span style="position: absolute; top: -8px; right: 10px; background: var(--accent-yellow); color: #000; padding: 0.15rem 0.5rem; border-radius: 8px; font-size: 0.7rem; font-weight: bold;">MELHOR</span>' : ''}
                  <h4 style="color: var(--text-primary); margin-bottom: 0.25rem;">${plan.name}</h4>
                  <p style="color: var(--accent-green); font-size: 1.5rem; font-weight: bold; margin-bottom: 0.25rem;">R$ ${plan.price.toFixed(2)}</p>
                  <p style="color: var(--text-muted); font-size: 0.75rem;">${plan.id === 'yearly' ? `R$ ${plan.pricePerMonth}/mês` : `${plan.duration_days} dias`}</p>
                  ${plan.id === 'yearly' ? `<p style="color: var(--accent-yellow); font-size: 0.75rem; margin-top: 0.25rem;">Economia de R$ ${plan.savings}!</p>` : ''}
                </div>
              `).join('')}
            </div>
            
            <button id="checkout-vip-btn" class="btn btn-primary btn-lg" style="width: 100%;" disabled>
              Selecione um plano
            </button>
          </div>
        `;
        
        let selectedPlan: string | null = null;
        
        // Eventos de seleção de plano
        document.querySelectorAll('.vip-plan-card').forEach(card => {
          card.addEventListener('click', () => {
            document.querySelectorAll('.vip-plan-card').forEach(c => {
              (c as HTMLElement).style.borderColor = 'var(--border-color)';
            });
            (card as HTMLElement).style.borderColor = 'var(--accent-green)';
            selectedPlan = (card as HTMLElement).dataset.planId || null;
            
            const btn = document.getElementById('checkout-vip-btn') as HTMLButtonElement;
            if (btn && selectedPlan) {
              const plan = plans.find((p: any) => p.id === selectedPlan);
              btn.disabled = false;
              btn.textContent = `👑 Assinar ${plan?.name} - R$ ${plan?.price.toFixed(2)}`;
            }
          });
        });
        
        // Evento de checkout
        document.getElementById('checkout-vip-btn')?.addEventListener('click', async () => {
          if (!selectedPlan) return;
          
          const plan = plans.find((p: any) => p.id === selectedPlan);
          if (!plan) return;
          
          // Mostrar modal de checkout PIX direto
          body.innerHTML = `
            <div style="text-align: center; padding: 0.5rem;">
              <div style="font-size: 3rem; margin-bottom: 0.5rem;">👑</div>
              <h3 style="color: var(--text-primary); margin-bottom: 0.5rem;">Checkout VIP - ${plan.name}</h3>
              <p style="color: var(--accent-green); font-size: 1.8rem; font-weight: bold; margin-bottom: 1rem;">R$ ${plan.price.toFixed(2)}</p>
              
              <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 12px; margin-bottom: 1rem; text-align: left;">
                <h4 style="color: var(--text-primary); margin-bottom: 0.5rem;">📋 Dados para pagamento PIX:</h4>
                <div class="form-group" style="margin-bottom: 0.75rem;">
                  <label style="color: var(--text-secondary); font-size: 0.85rem;">Nome Completo *</label>
                  <input type="text" id="vip-payer-name" placeholder="Seu nome completo" style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary);">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label style="color: var(--text-secondary); font-size: 0.85rem;">CPF *</label>
                  <input type="text" id="vip-payer-cpf" placeholder="000.000.000-00" maxlength="14" style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary);">
                </div>
              </div>
              
              <button id="generate-vip-pix-btn" class="btn btn-primary btn-lg" style="width: 100%;">
                💳 Gerar PIX - R$ ${plan.price.toFixed(2)}
              </button>
              
              <p style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.75rem;">
                Pagamento processado via PIX. Ativação automática após confirmação.
              </p>
            </div>
          `;
          
          // Máscara de CPF
          const cpfInput = document.getElementById('vip-payer-cpf') as HTMLInputElement;
          cpfInput?.addEventListener('input', (e) => {
            let value = (e.target as HTMLInputElement).value.replace(/\D/g, '');
            if (value.length > 11) value = value.slice(0, 11);
            if (value.length > 9) {
              value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            } else if (value.length > 6) {
              value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
            } else if (value.length > 3) {
              value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
            }
            (e.target as HTMLInputElement).value = value;
          });
          
          // Gerar PIX
          document.getElementById('generate-vip-pix-btn')?.addEventListener('click', async () => {
            const payerName = (document.getElementById('vip-payer-name') as HTMLInputElement)?.value?.trim();
            const payerCpf = (document.getElementById('vip-payer-cpf') as HTMLInputElement)?.value?.replace(/\D/g, '');
            
            if (!payerName || payerName.length < 3) {
              alert('Digite seu nome completo');
              return;
            }
            
            if (!payerCpf || payerCpf.length !== 11) {
              alert('Digite um CPF válido');
              return;
            }
            
            const btn = document.getElementById('generate-vip-pix-btn') as HTMLButtonElement;
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0 auto;"></div>';
            
            const { data: pixData, error: pixError } = await api.createVipPixPayment(selectedPlan!, payerName, payerCpf);
            
            if (pixError || !pixData?.payment) {
              btn.disabled = false;
              btn.innerHTML = `💳 Gerar PIX - R$ ${plan.price.toFixed(2)}`;
              alert(pixError || 'Erro ao gerar PIX. Tente novamente.');
              return;
            }
            
            // Mostrar QR Code
            body.innerHTML = `
              <div style="text-align: center; padding: 0.5rem;">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📱</div>
                <h3 style="color: var(--text-primary); margin-bottom: 0.25rem;">Pague com PIX</h3>
                <p style="color: var(--accent-green); font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">R$ ${plan.price.toFixed(2)}</p>
                
                <div style="background: #fff; padding: 1rem; border-radius: 12px; display: inline-block; margin-bottom: 1rem;">
                  <img src="${pixData.payment.qrcode}" alt="QR Code PIX" style="width: 200px; height: 200px;">
                </div>
                
                <div style="background: var(--bg-secondary); padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem;">
                  <p style="color: var(--text-muted); font-size: 0.75rem; margin-bottom: 0.5rem;">Ou copie o código:</p>
                  <div style="display: flex; gap: 0.5rem;">
                    <input type="text" value="${pixData.payment.copyPaste}" readonly style="flex: 1; padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary); font-size: 0.7rem;">
                    <button id="copy-pix-code" class="btn btn-sm btn-primary">📋</button>
                  </div>
                </div>
                
                <div id="payment-status" style="background: rgba(255, 165, 2, 0.1); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255, 165, 2, 0.3);">
                  <p style="color: var(--accent-yellow); font-size: 0.85rem;">
                    ⏳ Aguardando pagamento...
                  </p>
                </div>
                
                <p style="color: var(--text-muted); font-size: 0.7rem; margin-top: 0.75rem;">
                  Expira em: ${new Date(pixData.payment.expiresAt).toLocaleString('pt-BR')}
                </p>
              </div>
            `;
            
            // Copiar código PIX
            document.getElementById('copy-pix-code')?.addEventListener('click', () => {
              navigator.clipboard.writeText(pixData.payment.copyPaste);
              const btn = document.getElementById('copy-pix-code');
              if (btn) {
                btn.textContent = '✅';
                setTimeout(() => { btn.textContent = '📋'; }, 2000);
              }
            });
            
            // Verificar status do pagamento a cada 5 segundos
            const paymentId = pixData.payment.id;
            const checkInterval = setInterval(async () => {
              const { data: statusData } = await api.checkVipPaymentStatus(paymentId);
              
              if (statusData?.payment?.paid) {
                clearInterval(checkInterval);
                
                const statusEl = document.getElementById('payment-status');
                if (statusEl) {
                  statusEl.style.background = 'rgba(0, 255, 136, 0.1)';
                  statusEl.style.borderColor = 'rgba(0, 255, 136, 0.3)';
                  statusEl.innerHTML = `
                    <p style="color: var(--accent-green); font-size: 1rem; font-weight: bold;">
                      ✅ Pagamento Confirmado!
                    </p>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.5rem;">
                      Sua assinatura VIP foi ativada. Aproveite!
                    </p>
                  `;
                }
                
                // Atualizar estado e fechar modal após 3 segundos
                setTimeout(() => {
                  modal.classList.add('hidden');
                  window.location.reload(); // Recarregar para atualizar estado VIP
                }, 3000);
              }
            }, 5000);
            
            // Parar verificação após 15 minutos
            setTimeout(() => clearInterval(checkInterval), 15 * 60 * 1000);
          });
        });
        return;
      }
      
      // É VIP - mostrar formulário de criação
      const today = new Date();
      const minDate = today.toISOString().slice(0, 16);
      
      // Calcular datas sugeridas
      const suggestedRegStart = new Date(today.getTime() + 24 * 60 * 60 * 1000); // +1 dia
      const suggestedRegEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 dias
      const suggestedTournamentStart = new Date(suggestedRegEnd.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 dias após fim inscrições
      
      body.innerHTML = `
        <div style="padding: 0.5rem;">
          <div style="background: rgba(0, 255, 136, 0.1); padding: 1rem; border-radius: 12px; border: 1px solid rgba(0, 255, 136, 0.3); margin-bottom: 1.5rem;">
            <p style="color: var(--accent-green); font-size: 0.9rem;">
              👑 <strong>Você é VIP!</strong> Como organizador, você receberá 20% do valor arrecadado.
            </p>
          </div>
          
          <div class="form-group">
            <label for="tournament-name">Nome do Torneio *</label>
            <input type="text" id="tournament-name" placeholder="Ex: Torneio de Sinuca Pro" maxlength="100" required>
          </div>
          
          <!-- DATAS DE INSCRIÇÃO -->
          <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid var(--border-color);">
            <h4 style="color: var(--accent-yellow); margin-bottom: 0.75rem; font-size: 0.9rem;">📅 Período de Inscrições</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group" style="margin-bottom: 0;">
                <label for="tournament-reg-start" style="font-size: 0.85rem;">Início das Inscrições *</label>
                <input type="datetime-local" id="tournament-reg-start" min="${minDate}" value="${suggestedRegStart.toISOString().slice(0, 16)}" required>
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label for="tournament-reg-end" style="font-size: 0.85rem;">Término das Inscrições *</label>
                <input type="datetime-local" id="tournament-reg-end" min="${minDate}" value="${suggestedRegEnd.toISOString().slice(0, 16)}" required>
              </div>
            </div>
          </div>
          
          <!-- DATA DO TORNEIO -->
          <div class="form-group">
            <label for="tournament-start-date">📆 Data de Início do Torneio *</label>
            <input type="datetime-local" id="tournament-start-date" min="${minDate}" value="${suggestedTournamentStart.toISOString().slice(0, 16)}" required>
            <small style="color: var(--text-muted);">Recomendado: 2-3 dias após o término das inscrições</small>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label for="tournament-entry-fee">Taxa de Inscrição (R$)</label>
              <input type="number" id="tournament-entry-fee" value="10" min="0" step="5">
              <small style="color: var(--text-muted);">0 = Torneio gratuito</small>
            </div>
            
            <div class="form-group">
              <label for="tournament-max">Máx. Participantes</label>
              <select id="tournament-max">
                <option value="8">8 jogadores</option>
                <option value="16" selected>16 jogadores</option>
                <option value="32">32 jogadores</option>
                <option value="64">64 jogadores</option>
              </select>
            </div>
          </div>
          
          <div class="form-group">
            <label for="tournament-game-mode">Modo de Jogo</label>
            <select id="tournament-game-mode">
              <option value="15ball">🎱 8 Bolas (Lisas vs Listradas)</option>
              <option value="9ball">🔴🔵 9 Bolas (4x4)</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="tournament-description">Descrição (opcional)</label>
            <textarea id="tournament-description" rows="2" placeholder="Regras especiais, informações adicionais..." maxlength="500"></textarea>
          </div>
          
          <!-- INFO DE PREMIAÇÃO -->
          <div style="background: linear-gradient(135deg, rgba(255, 165, 2, 0.1), rgba(0, 255, 136, 0.1)); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid rgba(255, 165, 2, 0.3);">
            <h4 style="color: var(--text-primary); margin-bottom: 0.5rem;">💰 Premiação (calculada ao encerrar inscrições)</h4>
            <p style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 0.75rem;">
              O valor total da premiação será definido automaticamente com base no número de inscritos × taxa de inscrição.
            </p>
            <div style="display: flex; justify-content: space-between; color: var(--text-secondary); font-size: 0.85rem;">
              <span>🏆 Premiação:</span>
              <span style="color: var(--accent-green); font-weight: bold;">60%</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: var(--text-secondary); font-size: 0.85rem;">
              <span>👑 Você (organizador):</span>
              <span style="color: var(--accent-yellow); font-weight: bold;">20%</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: var(--text-secondary); font-size: 0.85rem;">
              <span>🏢 Plataforma:</span>
              <span>20%</span>
            </div>
            <div id="prize-preview" style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color); display: none;">
              <p style="color: var(--accent-green); font-size: 0.85rem; text-align: center;">
                <strong>Exemplo:</strong> Com <span id="preview-players">16</span> jogadores × R$ <span id="preview-fee">10</span> = 
                <span style="color: var(--accent-yellow);">R$ <span id="preview-prize">96</span></span> de premiação
              </p>
            </div>
          </div>
          
          <button id="confirm-create-tournament" class="btn btn-primary w-full btn-lg">
            🏆 Criar Torneio
          </button>
        </div>
      `;
      
      // Atualizar preview de premiação quando mudar taxa ou participantes
      const updatePrizePreview = () => {
        const entryFee = parseFloat((document.getElementById('tournament-entry-fee') as HTMLInputElement)?.value || '0');
        const maxParticipants = parseInt((document.getElementById('tournament-max') as HTMLSelectElement)?.value || '16');
        const previewDiv = document.getElementById('prize-preview');
        
        if (entryFee > 0 && previewDiv) {
          const totalCollected = entryFee * maxParticipants;
          const prizePool = totalCollected * 0.6; // 60% premiação
          
          (document.getElementById('preview-players') as HTMLElement).textContent = maxParticipants.toString();
          (document.getElementById('preview-fee') as HTMLElement).textContent = entryFee.toFixed(0);
          (document.getElementById('preview-prize') as HTMLElement).textContent = prizePool.toFixed(2);
          previewDiv.style.display = 'block';
        } else if (previewDiv) {
          previewDiv.style.display = 'none';
        }
      };
      
      document.getElementById('tournament-entry-fee')?.addEventListener('input', updatePrizePreview);
      document.getElementById('tournament-max')?.addEventListener('change', updatePrizePreview);
      updatePrizePreview();
      
      // Validar e sugerir data do torneio quando mudar data de término das inscrições
      document.getElementById('tournament-reg-end')?.addEventListener('change', () => {
        const regEndInput = document.getElementById('tournament-reg-end') as HTMLInputElement;
        const startDateInput = document.getElementById('tournament-start-date') as HTMLInputElement;
        
        if (regEndInput?.value) {
          const regEndDate = new Date(regEndInput.value);
          const suggestedStart = new Date(regEndDate.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 dias
          startDateInput.value = suggestedStart.toISOString().slice(0, 16);
          startDateInput.min = regEndInput.value;
        }
      });
      
      // Evento de criar torneio
      document.getElementById('confirm-create-tournament')?.addEventListener('click', async () => {
        const name = (document.getElementById('tournament-name') as HTMLInputElement)?.value?.trim();
        const regStartDate = (document.getElementById('tournament-reg-start') as HTMLInputElement)?.value;
        const regEndDate = (document.getElementById('tournament-reg-end') as HTMLInputElement)?.value;
        const startDate = (document.getElementById('tournament-start-date') as HTMLInputElement)?.value;
        const entryFee = parseFloat((document.getElementById('tournament-entry-fee') as HTMLInputElement)?.value || '0');
        const maxParticipants = parseInt((document.getElementById('tournament-max') as HTMLSelectElement)?.value || '16');
        const gameMode = (document.getElementById('tournament-game-mode') as HTMLSelectElement)?.value || '15ball';
        const description = (document.getElementById('tournament-description') as HTMLTextAreaElement)?.value?.trim();
        
        if (!name) {
          alert('Digite o nome do torneio');
          return;
        }
        
        if (!regStartDate || !regEndDate) {
          alert('Defina o período de inscrições');
          return;
        }
        
        if (!startDate) {
          alert('Selecione a data de início do torneio');
          return;
        }
        
        // Validar datas
        const regStart = new Date(regStartDate);
        const regEnd = new Date(regEndDate);
        const tournamentStart = new Date(startDate);
        const now = new Date();
        
        if (regStart < now) {
          alert('A data de início das inscrições deve ser no futuro');
          return;
        }
        
        if (regEnd <= regStart) {
          alert('A data de término das inscrições deve ser após o início');
          return;
        }
        
        if (tournamentStart <= regEnd) {
          alert('O torneio deve iniciar após o término das inscrições');
          return;
        }
        
        const btn = document.getElementById('confirm-create-tournament') as HTMLButtonElement;
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>';
        }
        
        const { data: result, error: createError } = await api.createTournament({
          name,
          registration_start_date: regStart.toISOString(),
          registration_end_date: regEnd.toISOString(),
          start_date: tournamentStart.toISOString(),
          entry_fee: entryFee,
          max_participants: maxParticipants,
          min_participants: 4,
          game_mode: gameMode,
          description,
        });
        
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '🏆 Criar Torneio';
        }
        
        if (createError) {
          alert(createError);
          return;
        }
        
        alert('Torneio criado com sucesso! 🎉\n\nAs inscrições abrirão automaticamente na data definida.');
        modal.classList.add('hidden');
        loadTournaments();
      });
    });
    
    // Fechar modal criar torneio
    document.getElementById('close-create-tournament-modal')?.addEventListener('click', () => {
      document.getElementById('create-tournament-modal')?.classList.add('hidden');
    });
    
    // Botão meus torneios
    document.getElementById('my-tournaments-btn')?.addEventListener('click', async () => {
      const modal = document.getElementById('my-tournaments-modal');
      const body = document.getElementById('my-tournaments-body');
      if (!modal || !body) return;
      
      modal.classList.remove('hidden');
      body.innerHTML = `<div class="loading"><div class="spinner"></div><p class="loading-text">Carregando seus torneios...</p></div>`;
      
      const { data, error } = await api.getMyTournaments();
      
      if (error) {
        body.innerHTML = `<div class="empty-state"><p class="empty-state-text">Erro ao carregar torneios</p></div>`;
        return;
      }
      
      const participating = data?.participating || [];
      const created = data?.created || [];
      
      if (participating.length === 0 && created.length === 0) {
        body.innerHTML = `
          <div class="empty-state" style="padding: 2rem;">
            <div class="empty-state-icon">🏆</div>
            <p class="empty-state-title">Nenhum torneio encontrado</p>
            <p class="empty-state-text">Você ainda não está participando de nenhum torneio.</p>
          </div>
        `;
        return;
      }
      
      let html = '';
      
      // Torneios criados por mim
      if (created.length > 0) {
        html += `
          <div style="margin-bottom: 1.5rem;">
            <h4 style="color: var(--accent-yellow); margin-bottom: 1rem;">👑 Torneios que Criei (${created.length})</h4>
            ${created.map((t: any) => renderTournamentCard(t, true)).join('')}
          </div>
        `;
      }
      
      // Torneios que estou participando
      if (participating.length > 0) {
        html += `
          <div>
            <h4 style="color: var(--accent-green); margin-bottom: 1rem;">🎮 Participando (${participating.length})</h4>
            ${participating.map((t: any) => renderTournamentCard(t, false)).join('')}
          </div>
        `;
      }
      
      body.innerHTML = html;
      
      // Bind eventos dos cards
      body.querySelectorAll('.tournament-card-mini').forEach(card => {
        card.addEventListener('click', () => {
          const tournamentId = (card as HTMLElement).dataset.tournamentId;
          if (tournamentId) {
            showTournamentDetail(tournamentId);
          }
        });
      });
    });
    
    // Fechar modal meus torneios
    document.getElementById('close-my-tournaments-modal')?.addEventListener('click', () => {
      document.getElementById('my-tournaments-modal')?.classList.add('hidden');
    });
    
    // Fechar modal detalhes torneio
    document.getElementById('close-tournament-detail-modal')?.addEventListener('click', () => {
      document.getElementById('tournament-detail-modal')?.classList.add('hidden');
    });
  }, 100);

  // Check saved game
  const savedGameStr = localStorage.getItem('sinuca_save_v1');
  let hasSavedGame = false;
  if (savedGameStr) {
    try {
      const d = JSON.parse(savedGameStr);
      if (Date.now() - d.timestamp < 86400000) hasSavedGame = true;
    } catch (e) { }
  }

  return `
    ${renderHeader({ showStats: true, logoClickable: false })}

    <div class="lobby">
      <aside class="sidebar">
        <div class="sidebar-section">
          <div class="sidebar-title">Menu</div>
          <ul class="sidebar-menu">
            <li class="sidebar-item active" data-page="lobby">
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
        
        <!-- Indicador de Sincronização em Tempo Real -->
        <div class="lobby-sync-indicator" id="lobby-sync-indicator">
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
                      <p style="margin: 0; color: #eee; font-size: 0.9rem;">Você tem um jogo não finalizado.</p>
                   </div>
                </div>
                <button class="btn btn-primary" id="resume-game-lobby-btn" style="background: #fff; color: #2c3e50; border: none; font-weight: bold;">▶️ Continuar</button>
             </div>
          </div>
        ` : ''}
        <!-- Banner Indique e Ganhe -->
        <div class="referral-banner" style="background: linear-gradient(135deg, rgba(255, 107, 107, 0.15), rgba(255, 165, 2, 0.15)); border: 1px solid rgba(255, 165, 2, 0.4); border-radius: 16px; padding: 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="font-size: 2.5rem;">🎁</div>
            <div>
              <h3 style="color: var(--text-primary); font-size: 1.1rem; margin-bottom: 0.25rem;">Indique e Ganhe!</h3>
              <p style="color: var(--text-secondary); font-size: 0.85rem;">Convide amigos e ganhe <strong style="color: var(--accent-green);">2 créditos</strong> por cada indicação!</p>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" data-navigate="profile" style="white-space: nowrap;">Ver meu link →</button>
        </div>

        <!-- Seção: Jogar contra IA (sempre visível) -->
        <div class="section-header">
          <div>
            <h2 class="section-title">🤖 Treino contra CPU</h2>
            <p class="section-subtitle">Pratique suas habilidades contra a inteligência artificial</p>
          </div>
        </div>

        <div class="ai-room-card" id="ai-room-card" style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2)); border: 1px solid rgba(102, 126, 234, 0.4); border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem; cursor: pointer; transition: all 0.3s ease;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.8rem;">🤖</div>
              <div>
                <h3 style="color: var(--text-primary); font-size: 1.2rem; margin-bottom: 0.25rem;">Jogar contra a CPU</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem;">Treine suas jogadas sem pressão</p>
                <p style="color: var(--accent-yellow); font-size: 0.8rem; margin-top: 0.25rem;">🎫 Custa 1 crédito por partida</p>
              </div>
            </div>
            <button class="btn btn-primary btn-lg" id="play-ai-btn">▶️ Jogar</button>
          </div>
        </div>

        <!-- Modal de Seleção de Modo de Jogo (CPU) -->
        <div id="ai-mode-modal" class="modal-overlay hidden">
          <div class="modal-box" style="max-width: 500px;">
            <div class="modal-header">
              <h3 class="modal-title">🎱 Escolha o Modo de Jogo</h3>
              <button class="modal-close" id="close-ai-modal">&times;</button>
            </div>
            <div class="modal-body">
              <p style="color: var(--text-secondary); margin-bottom: 1.5rem; text-align: center;">Selecione como deseja jogar contra a CPU:</p>
              
              <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div class="ai-mode-option" data-mode="14ball" style="background: var(--bg-secondary); border: 2px solid var(--border-color); border-radius: 12px; padding: 1.25rem; cursor: pointer; transition: all 0.2s;">
                  <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="font-size: 2rem;">🎱</div>
                    <div style="flex: 1;">
                      <h4 style="color: var(--text-primary); margin-bottom: 0.25rem;">Modo 8 Bolas (Lisas/Listradas)</h4>
                      <p style="color: var(--text-muted); font-size: 0.85rem;">7 lisas vs 7 listradas + Bola 8</p>
                      <p style="color: var(--accent-green); font-size: 0.8rem; margin-top: 0.25rem;">Derrube seu grupo e depois a 8 para vencer!</p>
                    </div>
                  </div>
                </div>
                
                <div class="ai-mode-option" data-mode="9ball" style="background: var(--bg-secondary); border: 2px solid var(--border-color); border-radius: 12px; padding: 1.25rem; cursor: pointer; transition: all 0.2s;">
                  <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="font-size: 2rem;">🔴🔵</div>
                    <div style="flex: 1;">
                      <h4 style="color: var(--text-primary); margin-bottom: 0.25rem;">Modo 9 Bolas (4x4)</h4>
                      <p style="color: var(--text-muted); font-size: 0.85rem;">4 vermelhas vs 4 azuis + bolão</p>
                      <p style="color: var(--accent-green); font-size: 0.8rem; margin-top: 0.25rem;">Quem derrubar suas 4 bolas primeiro vence!</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Opção de Mira para IA -->
              <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
                <p style="color: var(--text-secondary); margin-bottom: 0.75rem; font-size: 0.9rem;">🎯 Linha de Mira:</p>
                <div class="ai-aim-options" style="display: flex; gap: 0.5rem;">
                  <div class="ai-aim-option active" data-aim="true" style="flex: 1; padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; cursor: pointer; border: 2px solid var(--accent-green); text-align: center;">
                    <div style="font-size: 1rem;">🎯</div>
                    <div style="font-size: 0.8rem; font-weight: 600;">Com Mira</div>
                  </div>
                  <div class="ai-aim-option" data-aim="false" style="flex: 1; padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; cursor: pointer; border: 2px solid transparent; text-align: center;">
                    <div style="font-size: 1rem;">🚫</div>
                    <div style="font-size: 0.8rem; font-weight: 600;">Sem Mira</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Seção: Salas Online -->
        <div class="section-header">
          <div>
            <h2 class="section-title">🎮 Salas Online</h2>
            <p class="section-subtitle" id="rooms-count">Carregando...</p>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button id="join-private-room-btn" class="btn btn-ghost btn-sm">🔒 Código</button>
            <button id="refresh-rooms-btn" class="btn btn-ghost btn-sm">🔄</button>
            <button id="create-room-btn" class="btn btn-primary">+ Criar Sala</button>
          </div>
        </div>

        <div id="rooms-container" class="room-grid">
          <div class="loading" style="grid-column: 1/-1;">
            <div class="spinner"></div>
            <p class="loading-text">Carregando salas...</p>
          </div>
        </div>

        <!-- Info sobre créditos -->
        <div style="margin-top: 2rem; padding: 1rem; background: rgba(255, 165, 2, 0.1); border-radius: 12px; border: 1px solid rgba(255, 165, 2, 0.3);">
          <p style="color: var(--accent-yellow); font-size: 0.9rem;">
            💡 <strong>Dica:</strong> Você ganha 1 crédito grátis por dia (renova à meia-noite). 
            Seus créditos: <strong>${state.isUnlimited ? '∞' : state.credits}</strong>
          </p>
        </div>

        <!-- Seção: Torneios -->
        <div class="section-header" style="margin-top: 2rem;">
          <div>
            <h2 class="section-title">🏆 Torneios</h2>
            <p class="section-subtitle">Participe de torneios e ganhe prêmios!</p>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button id="my-tournaments-btn" class="btn btn-ghost btn-sm">📋 Meus Torneios</button>
            <button id="create-tournament-btn" class="btn btn-primary">+ Criar Torneio</button>
          </div>
        </div>

        <div id="tournaments-container" class="tournaments-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
          <div class="loading" style="grid-column: 1/-1;">
            <div class="spinner"></div>
            <p class="loading-text">Carregando torneios...</p>
          </div>
        </div>

        <!-- Seção: Top 10 Jogadores -->
        <div class="section-header" style="margin-top: 2rem;">
          <div>
            <h2 class="section-title">🏅 Top 10 Jogadores</h2>
            <p class="section-subtitle">Os melhores competidores da plataforma</p>
          </div>
          <button class="btn btn-ghost btn-sm" data-navigate="ranking">Ver ranking completo →</button>
        </div>

        <div id="top-players-container" class="top-players-container">
          <div class="loading">
            <div class="spinner"></div>
            <p class="loading-text">Carregando ranking...</p>
          </div>
        </div>

        <!-- Seção: Transmissões Ao Vivo -->
        <div class="section-header" style="margin-top: 2rem;">
          <div>
            <h2 class="section-title">🔴 Ao Vivo Agora</h2>
            <p class="section-subtitle">Assista partidas em tempo real</p>
          </div>
          <button class="btn btn-ghost btn-sm" id="refresh-lives-btn">🔄 Atualizar</button>
        </div>

        <div id="lives-container" class="lives-container">
          <div class="loading">
            <div class="spinner"></div>
            <p class="loading-text">Carregando transmissões...</p>
          </div>
        </div>
      </main>
    </div>

    <!-- Modal Criar Sala -->
    <div id="create-room-modal" class="modal-overlay hidden">
      <div class="modal-box">
        <div class="modal-header">
          <h3 class="modal-title">🎱 Criar Sala Online</h3>
          <button class="modal-close">&times;</button>
        </div>
        
        <div class="modal-body">
          <p style="color: var(--text-secondary); margin-bottom: 1rem;">Escolha o tipo de partida:</p>
          
          <div class="mode-options">
            <div class="mode-option active" data-mode="casual">
              <div class="mode-option-icon">🎮</div>
              <div class="mode-option-title">Casual</div>
              <div class="mode-option-desc">Jogo livre, sem apostas</div>
            </div>
            <div class="mode-option" data-mode="bet">
              <div class="mode-option-icon">💰</div>
              <div class="mode-option-title">Aposta</div>
              <div class="mode-option-desc">Jogue valendo dinheiro</div>
            </div>
          </div>

          <!-- Seleção de valor de aposta (aparece quando modo bet é selecionado) -->
          <div id="bet-amount-section" class="hidden" style="margin-top: 1rem;">
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">💰 Valor da aposta:</p>
            <div class="bet-options" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;">
              <div class="bet-option" data-bet="5" style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; cursor: pointer; border: 2px solid transparent; text-align: center;">
                <div style="font-weight: 700; color: var(--accent-yellow);">R$ 5</div>
              </div>
              <div class="bet-option active" data-bet="10" style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; cursor: pointer; border: 2px solid var(--accent-green); text-align: center;">
                <div style="font-weight: 700; color: var(--accent-yellow);">R$ 10</div>
              </div>
              <div class="bet-option" data-bet="20" style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; cursor: pointer; border: 2px solid transparent; text-align: center;">
                <div style="font-weight: 700; color: var(--accent-yellow);">R$ 20</div>
              </div>
              <div class="bet-option" data-bet="50" style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; cursor: pointer; border: 2px solid transparent; text-align: center;">
                <div style="font-weight: 700; color: var(--accent-yellow);">R$ 50</div>
              </div>
            </div>
            <p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.5rem;">
              ⚠️ Você e seu oponente precisam ter saldo suficiente. Vencedor leva 90%, 10% taxa da plataforma.
            </p>
            <div style="background: rgba(255, 165, 2, 0.1); padding: 0.75rem; border-radius: 8px; margin-top: 0.5rem; border: 1px solid rgba(255, 165, 2, 0.3);">
              <p style="font-size: 0.9rem; color: var(--text-secondary);">
                💰 Disponível para apostas: <strong id="available-bet-balance" style="color: var(--accent-green);">R$ ${state.balance.toFixed(2)}</strong>
              </p>
              <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                ⚠️ Bônus não pode ser usado em apostas (apenas depósitos e ganhos)
              </p>
            </div>
          </div>

          <p style="color: var(--text-secondary); margin: 1rem 0 0.5rem;">Modo de jogo:</p>
          
          <div class="game-mode-options" style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
            <div class="game-mode-option active" data-game-mode="15ball" style="flex: 1; padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; cursor: pointer; border: 2px solid var(--accent-green); text-align: center;">
              <div style="font-size: 1.2rem;">🎱</div>
              <div style="font-size: 0.85rem; font-weight: 600;">8 Bolas</div>
              <div style="font-size: 0.7rem; color: var(--text-muted);">Lisas vs Listradas</div>
            </div>
            <div class="game-mode-option" data-game-mode="9ball" style="flex: 1; padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; cursor: pointer; border: 2px solid transparent; text-align: center;">
              <div style="font-size: 1.2rem;">🔴🔵</div>
              <div style="font-size: 0.85rem; font-weight: 600;">9 Bolas</div>
              <div style="font-size: 0.7rem; color: var(--text-muted);">4x4 (Vermelho vs Azul)</div>
            </div>
          </div>

          <p style="color: var(--text-secondary); margin: 1rem 0 0.5rem;">🎯 Linha de Mira:</p>
          
          <div class="aim-mode-options" style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
            <div class="aim-mode-option active" data-aim-mode="true" style="flex: 1; padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; cursor: pointer; border: 2px solid var(--accent-green); text-align: center;">
              <div style="font-size: 1.2rem;">🎯</div>
              <div style="font-size: 0.85rem; font-weight: 600;">Com Mira</div>
              <div style="font-size: 0.7rem; color: var(--text-muted);">Linha de trajetória visível</div>
            </div>
            <div class="aim-mode-option" data-aim-mode="false" style="flex: 1; padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; cursor: pointer; border: 2px solid transparent; text-align: center;">
              <div style="font-size: 1.2rem;">🚫</div>
              <div style="font-size: 0.85rem; font-weight: 600;">Sem Mira</div>
              <div style="font-size: 0.7rem; color: var(--text-muted);">Modo profissional</div>
            </div>
          </div>

          <div class="room-visibility" style="margin: 1rem 0;">
            <label class="checkbox-label">
              <input type="checkbox" id="room-private-check" checked>
              <span>🔒 Sala Privada (por convite)</span>
              <small style="display: block; color: var(--text-muted); margin-top: 0.25rem;">
                Você receberá um código para compartilhar com seu oponente
              </small>
            </label>
            
            <label class="checkbox-label" style="margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05); paddingTop: 1rem;">
              <input type="checkbox" id="room-live-check">
              <span>🔴 Transmitir Partida Ao Vivo (Streaming)</span>
              <small style="display: block; color: var(--text-muted); margin-top: 0.25rem;">
                Sua partida aparecerá na página inicial para todos.
                <strong style="color:var(--accent-yellow);">Custo: +10 Créditos</strong>
              </small>
            </label>
          </div>

          <div class="credits-info" style="background: var(--bg-secondary); padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem;">
            <p style="font-size: 0.9rem; color: var(--text-secondary);">
              🎫 Seus créditos: <strong style="color: var(--accent-green);">${state.isUnlimited ? '∞' : state.credits}</strong>
            </p>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
              💡 Cada partida custa 1 crédito. Você ganha 1 grátis por dia!
            </p>
          </div>

          <button id="confirm-create-room" class="btn btn-primary w-full btn-lg">Criar Sala</button>
        </div>
      </div>
    </div>

    <!-- Modal Entrar Sala Privada -->
    <div id="join-private-modal" class="modal-overlay hidden">
      <div class="modal-box">
        <div class="modal-header">
          <h3 class="modal-title">🔒 Entrar em Sala Privada</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="room-code">Código da Sala</label>
            <input type="text" id="room-code" placeholder="Ex: ABC123" maxlength="6" style="text-transform: uppercase;">
          </div>
          <button id="join-private-btn" class="btn btn-primary w-full">Entrar</button>
        </div>
      </div>
    </div>

    <!-- Modal Compartilhar Sala Privada -->
    <div id="share-room-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width: 450px;">
        <div class="modal-header">
          <h3 class="modal-title">🎉 Sala Criada!</h3>
          <button class="modal-close" id="close-share-modal">&times;</button>
        </div>
        <div class="modal-body" style="text-align: center;">
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
            Compartilhe o código abaixo com seu amigo para ele entrar na sala:
          </p>
          
          <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.5rem;">Código da sala:</p>
            <div id="invite-code-display" style="font-size: 2.5rem; font-weight: 800; letter-spacing: 0.3em; color: var(--accent-green); font-family: monospace;">
              ------
            </div>
          </div>
          
          <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem;">
            <button id="copy-code-btn" class="btn btn-secondary" style="flex: 1;">📋 Copiar Código</button>
            <button id="copy-link-btn" class="btn btn-secondary" style="flex: 1;">🔗 Copiar Link</button>
          </div>
          
          <div style="background: rgba(255, 165, 2, 0.1); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255, 165, 2, 0.3);">
            <p style="font-size: 0.9rem; color: var(--text-secondary);">
              ⏳ Aguardando oponente entrar na sala...
            </p>
          </div>
          
          <button id="go-to-room-btn" class="btn btn-primary w-full btn-lg" style="margin-top: 1rem;">
            Ir para a Sala →
          </button>
        </div>
      </div>
    </div>

    <!-- Seção Minha Sala Ativa (placeholder dinâmico) -->
    <div id="my-active-room" class="hidden"></div>

    <!-- Modal Criar Torneio -->
    <div id="create-tournament-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width: 550px;">
        <div class="modal-header">
          <h3 class="modal-title">🏆 Criar Torneio</h3>
          <button class="modal-close" id="close-create-tournament-modal">&times;</button>
        </div>
        <div class="modal-body" id="create-tournament-body">
          <div class="loading">
            <div class="spinner"></div>
            <p class="loading-text">Verificando permissão...</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Meus Torneios -->
    <div id="my-tournaments-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width: 650px; max-height: 80vh;">
        <div class="modal-header">
          <h3 class="modal-title">📋 Meus Torneios</h3>
          <button class="modal-close" id="close-my-tournaments-modal">&times;</button>
        </div>
        <div class="modal-body" id="my-tournaments-body" style="overflow-y: auto; max-height: 60vh;">
          <div class="loading">
            <div class="spinner"></div>
            <p class="loading-text">Carregando seus torneios...</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Detalhes do Torneio -->
    <div id="tournament-detail-modal" class="modal-overlay hidden">
      <div class="modal-box" style="max-width: 600px; max-height: 85vh;">
        <div class="modal-header">
          <h3 class="modal-title">🏆 Detalhes do Torneio</h3>
          <button class="modal-close" id="close-tournament-detail-modal">&times;</button>
        </div>
        <div class="modal-body" id="tournament-detail-body" style="overflow-y: auto; max-height: 65vh;">
          <div class="loading">
            <div class="spinner"></div>
            <p class="loading-text">Carregando...</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function loadRooms(silent: boolean = false) {
  const container = document.getElementById('rooms-container');
  const countEl = document.getElementById('rooms-count');
  const myRoomSection = document.getElementById('my-active-room');

  if (!container) return;

  // Verificar se usuário tem sala ativa
  try {
    const { data: activeRoom, error: activeError } = await api.getActiveRoom();

    if (myRoomSection && activeRoom && !activeError) {
      const state = gameStore.getState();
      const isOwner = activeRoom.owner_id === state.user?.id;
      
      // Inserir seção de sala ativa ANTES do container de salas
      const mainContent = container.parentElement;
      if (mainContent) {
        // Remover seção anterior se existir
        const existingSection = document.getElementById('my-active-room-section');
        if (existingSection) existingSection.remove();
        
        const sectionHtml = `
          <div id="my-active-room-section" style="background: linear-gradient(135deg, rgba(0, 255, 136, 0.15), rgba(96, 165, 250, 0.15)); border: 1px solid rgba(0, 255, 136, 0.4); border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem; position: relative;">
            <div style="position: absolute; top: 1rem; right: 1rem;">
              <span style="background: var(--accent-green); color: #000; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">
                ${activeRoom.status === 'open' ? '⏳ Aguardando' : activeRoom.status === 'full' ? '👥 Sala Cheia' : '🎮 Jogando'}
              </span>
            </div>
            <h3 style="color: var(--text-primary); font-size: 1.2rem; margin-bottom: 0.5rem;">
              ${isOwner ? '🎱 Sua Sala Ativa' : '🎱 Você está em uma Sala'}
            </h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem;">
              ${activeRoom.mode === 'bet' ? `💰 Aposta: R$ ${Number(activeRoom.bet_amount || 0).toFixed(2)}` : '🎮 Modo Casual'}
              ${activeRoom.is_private ? ' • 🔒 Privada' : ' • 🌐 Pública'}
            </p>
            ${activeRoom.invite_code ? `
              <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.5rem;">Código de convite:</p>
                <div style="display: flex; align-items: center; gap: 1rem;">
                  <span style="font-size: 1.8rem; font-weight: 800; letter-spacing: 0.2em; color: var(--accent-green); font-family: monospace;">${activeRoom.invite_code}</span>
                  <button class="btn btn-secondary btn-sm" id="copy-active-code-btn">📋 Copiar</button>
                  <button class="btn btn-secondary btn-sm" id="copy-active-link-btn">🔗 Link</button>
                </div>
              </div>
            ` : ''}
            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
              <button class="btn btn-primary" id="go-my-room-btn">▶️ Entrar na Sala</button>
              ${isOwner ? `<button class="btn btn-danger btn-outline" id="cancel-my-room-btn">❌ Cancelar Sala</button>` :
            `<button class="btn btn-secondary" id="leave-my-room-btn">🚪 Sair</button>`}
            </div>
          </div>
        `;
        
        // Inserir antes do container de salas
        container.insertAdjacentHTML('beforebegin', sectionHtml);
        
        // Handler para copiar código
        document.getElementById('copy-active-code-btn')?.addEventListener('click', () => {
          navigator.clipboard.writeText(activeRoom.invite_code).then(() => {
            const btn = document.getElementById('copy-active-code-btn');
            if (btn) {
              btn.textContent = '✅ Copiado!';
              setTimeout(() => btn.textContent = '📋 Copiar', 2000);
            }
          });
        });
        
        // Handler para copiar link
        document.getElementById('copy-active-link-btn')?.addEventListener('click', () => {
          const shareLink = `${window.location.origin}/join/${activeRoom.invite_code}`;
          navigator.clipboard.writeText(shareLink).then(() => {
            const btn = document.getElementById('copy-active-link-btn');
            if (btn) {
              btn.textContent = '✅ Copiado!';
              setTimeout(() => btn.textContent = '🔗 Link', 2000);
            }
          });
        });

        // Handler para entrar na sala
        document.getElementById('go-my-room-btn')?.addEventListener('click', async () => {
          const { data: fullRoom } = await api.getRoom(activeRoom.id);
          (window as any).app.navigate('room', fullRoom || activeRoom);
        });

        // Handler para cancelar sala (dono)
        document.getElementById('cancel-my-room-btn')?.addEventListener('click', async () => {
          if (!confirm('Deseja realmente cancelar sua sala?')) return;
          const { error } = await api.cancelRoom(activeRoom.id);
          if (error) {
            alert('Erro ao cancelar sala: ' + error);
          } else {
            location.reload();
          }
        });

        // Handler para sair da sala (convidado)
        document.getElementById('leave-my-room-btn')?.addEventListener('click', async () => {
          if (!confirm('Deseja realmente sair desta sala?')) return;
          const { error } = await api.leaveRoom(activeRoom.id);
          if (error) {
            // Se o erro for de token ou sala não encontrada, apenas recarrega
            if (error.includes('Token') || error.includes('não encontrada') || error.includes('401')) {
              console.log('[LobbyPage] Sala já fechada ou token expirado, recarregando...');
              location.reload();
              return;
            }
            alert('Erro ao sair da sala: ' + error);
          } else {
            location.reload();
          }
        });
      }
    }
  } catch (err) {
    console.log('Erro ao verificar sala ativa:', err);
  }

  // Bind evento do botão de jogar contra IA - abre modal de seleção
  document.getElementById('play-ai-btn')?.addEventListener('click', async () => {
    const modal = document.getElementById('ai-mode-modal');
    if (modal) {
      modal.classList.remove('hidden');
    }
  });

  // Fechar modal de seleção de modo IA
  document.getElementById('close-ai-modal')?.addEventListener('click', () => {
    const modal = document.getElementById('ai-mode-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  });

  // Seleção de modo de jogo contra IA
  document.querySelectorAll('.ai-mode-option').forEach(el => {
    el.addEventListener('mouseenter', () => {
      (el as HTMLElement).style.borderColor = 'var(--accent-green)';
      (el as HTMLElement).style.background = 'rgba(0, 255, 136, 0.1)';
    });
    el.addEventListener('mouseleave', () => {
      (el as HTMLElement).style.borderColor = 'var(--border-color)';
      (el as HTMLElement).style.background = 'var(--bg-secondary)';
    });
    el.addEventListener('click', async () => {
      const mode = (el as HTMLElement).dataset.mode as '14ball' | '9ball';

      // Pegar opção de mira selecionada
      const activeAimOption = document.querySelector('.ai-aim-option.active') ||
        document.querySelector('.ai-aim-option[style*="accent-green"]');
      const aimLineEnabled = activeAimOption?.getAttribute('data-aim') !== 'false';

      // Fechar modal
      const modal = document.getElementById('ai-mode-modal');
      if (modal) modal.classList.add('hidden');

      // Verificar créditos antes de iniciar
      const { data: creditsData } = await api.getCredits();
      const hasCredits = creditsData?.is_unlimited || (creditsData?.amount || 0) >= 1;

      if (!hasCredits) {
        // Tentar pegar crédito diário
        const { data: dailyData, error: dailyError } = await api.request<any>('/credits/daily', { method: 'POST' });

        if (dailyError) {
          alert('Você não tem créditos suficientes. Aguarde seu crédito grátis amanhã ou compre mais créditos.');
          return;
        }

        // Atualizar créditos no store
        const { data: newCredits } = await api.getCredits();
        if (newCredits) {
          const { gameStore } = await import('../store/gameStore.js');
          gameStore.setCredits(newCredits.amount, newCredits.is_unlimited);
        }
      }

      // Ir para o jogo contra IA com o modo selecionado
      const state = (await import('../store/gameStore.js')).gameStore.getState();
      (window as any).app.navigate('game', {
        mode: 'ai',
        owner: state.user,
        guest: { username: '🤖 CPU' },
        gameMode: mode, // Modo selecionado pelo jogador
        aim_line_enabled: aimLineEnabled // Opção de mira
      });
    });
  });

  // Seleção de opção de mira no modo IA
  document.querySelectorAll('.ai-aim-option').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.ai-aim-option').forEach(opt => {
        (opt as HTMLElement).style.borderColor = 'transparent';
        opt.classList.remove('active');
      });
      (el as HTMLElement).style.borderColor = 'var(--accent-green)';
      el.classList.add('active');
    });
  });

  // Hover effect no card de IA
  const aiCard = document.getElementById('ai-room-card');
  if (aiCard) {
    aiCard.addEventListener('mouseenter', () => {
      aiCard.style.transform = 'translateY(-4px)';
      aiCard.style.boxShadow = '0 8px 32px rgba(102, 126, 234, 0.3)';
    });
    aiCard.addEventListener('mouseleave', () => {
      aiCard.style.transform = 'translateY(0)';
      aiCard.style.boxShadow = 'none';
    });
  }

  // Bind eventos de seleção de modo de jogo
  document.querySelectorAll('.game-mode-option').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.game-mode-option').forEach(opt => {
        (opt as HTMLElement).style.borderColor = 'transparent';
      });
      (el as HTMLElement).style.borderColor = 'var(--accent-green)';
    });
  });

  // Bind eventos de seleção de modo de mira
  document.querySelectorAll('.aim-mode-option').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.aim-mode-option').forEach(opt => {
        (opt as HTMLElement).style.borderColor = 'transparent';
        opt.classList.remove('active');
      });
      (el as HTMLElement).style.borderColor = 'var(--accent-green)';
      el.classList.add('active');
    });
  });

  // Bind eventos de seleção de modo (casual/bet)
  document.querySelectorAll('.mode-option').forEach(el => {
    el.addEventListener('click', async () => {
      document.querySelectorAll('.mode-option').forEach(opt => opt.classList.remove('active'));
      el.classList.add('active');

      const mode = (el as HTMLElement).dataset.mode;
      const betSection = document.getElementById('bet-amount-section');
      if (betSection) {
        if (mode === 'bet') {
          betSection.classList.remove('hidden');
          // Carregar saldo disponível para apostas
          try {
            const { data } = await api.getAvailableForBet();
            if (data) {
              const balanceEl = document.getElementById('available-bet-balance');
              if (balanceEl) {
                balanceEl.textContent = `R$ ${(data.available_for_bet || 0).toFixed(2)}`;
              }
            }
          } catch (err) {
            console.error('Erro ao carregar saldo para apostas:', err);
          }
        } else {
          betSection.classList.add('hidden');
        }
      }
    });
  });

  // Bind eventos de seleção de valor de aposta
  document.querySelectorAll('.bet-option').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.bet-option').forEach(opt => {
        (opt as HTMLElement).style.borderColor = 'transparent';
        opt.classList.remove('active');
      });
      (el as HTMLElement).style.borderColor = 'var(--accent-green)';
      el.classList.add('active');
    });
  });

  // Bind evento de criar sala
  document.getElementById('confirm-create-room')?.addEventListener('click', async () => {
    const activeMode = document.querySelector('.mode-option.active');
    const mode = (activeMode?.getAttribute('data-mode') || 'casual') as 'casual' | 'bet';
    const isPrivate = (document.getElementById('room-private-check') as HTMLInputElement)?.checked || false;
    const isLive = (document.getElementById('room-live-check') as HTMLInputElement)?.checked || false;

    // Pegar modo de jogo selecionado
    const activeGameMode = document.querySelector('.game-mode-option[style*="accent-green"]') ||
      document.querySelector('.game-mode-option.active');
    const gameMode = (activeGameMode?.getAttribute('data-game-mode') || '15ball') as '15ball' | '9ball';

    // Pegar modo de mira selecionado
    const activeAimMode = document.querySelector('.aim-mode-option.active') ||
      document.querySelector('.aim-mode-option[style*="accent-green"]');
    const aimLineEnabled = activeAimMode?.getAttribute('data-aim-mode') !== 'false';

    const state = gameStore.getState();

    // Pegar valor da aposta se modo bet
    let betAmount: number | undefined;
    if (mode === 'bet') {
      const activeBet = document.querySelector('.bet-option.active');
      betAmount = parseFloat(activeBet?.getAttribute('data-bet') || '10');

      if (state.balance < betAmount) {
        alert(`Saldo insuficiente! Você precisa de R$ ${betAmount.toFixed(2)} para criar esta sala. Seu saldo: R$ ${state.balance.toFixed(2)}`);
        return;
      }
    }

    // Validar Créditos para Live
    if (isLive) {
      // Assumindo 1 crédito sala + 10 live = 11. Se unlimited, ignora.
      if (!state.isUnlimited && state.credits < 11) {
        alert('Créditos insuficientes para transmissão! Custo da Live: 10 créditos + 1 do jogo.');
        return;
      }
    }

    const confirmBtn = document.getElementById('confirm-create-room') as HTMLButtonElement;
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>';
    }

    const { data, error } = await api.createRoom(mode, betAmount, isPrivate, aimLineEnabled, gameMode);

    if (error) {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'Criar Sala';
      }
      alert(error);
      return;
    }

    // Iniciar Live se selecionado
    if (isLive && data?.id) {
      try {
        await api.startLive({
          roomId: data.id,
          userId: state.user?.id || 'unknown',
          hostName: state.user?.username || 'Host',
          gameMode,
          title: mode === 'bet' ? `Valendo R$ ${betAmount?.toFixed(2)}` : 'Partida Casual'
        });
      } catch (e) {
        console.error('Erro ao iniciar live:', e);
        alert('Sala criada, mas erro ao iniciar streaming. Verifique seus créditos.');
      }
    }

    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = 'Criar Sala';
    }

    document.getElementById('create-room-modal')?.classList.add('hidden');

    // Se sala privada, mostrar modal estilizado com código de convite
    if (isPrivate && data?.invite_code) {
      const shareModal = document.getElementById('share-room-modal');
      const codeDisplay = document.getElementById('invite-code-display');
      if (shareModal && codeDisplay) {
        codeDisplay.textContent = data.invite_code;
        shareModal.classList.remove('hidden');

        // Guardar dados da sala para navegação posterior
        (window as any)._createdRoomData = { ...(data), gameMode };

        // Handler para copiar código
        document.getElementById('copy-code-btn')?.addEventListener('click', () => {
          navigator.clipboard.writeText(data.invite_code).then(() => {
            const btn = document.getElementById('copy-code-btn');
            if (btn) {
              btn.textContent = '✅ Copiado!';
              setTimeout(() => btn.textContent = '📋 Copiar Código', 2000);
            }
          });
        });

        // Handler para copiar link
        document.getElementById('copy-link-btn')?.addEventListener('click', () => {
          const shareLink = `${window.location.origin}/join/${data.invite_code}`;
          navigator.clipboard.writeText(shareLink).then(() => {
            const btn = document.getElementById('copy-link-btn');
            if (btn) {
              btn.textContent = '✅ Copiado!';
              setTimeout(() => btn.textContent = '🔗 Copiar Link', 2000);
            }
          });
        });

        // Handler para ir para a sala
        document.getElementById('go-to-room-btn')?.addEventListener('click', async () => {
          const roomDataSaved = (window as any)._createdRoomData;
          const { data: fullRoomData } = await api.getRoom(data.id);
          shareModal.classList.add('hidden');
          (window as any).app.navigate('room', { ...(fullRoomData || roomDataSaved), gameMode });
        });

        // Handler para fechar modal
        document.getElementById('close-share-modal')?.addEventListener('click', async () => {
          const roomDataSaved = (window as any)._createdRoomData;
          const { data: fullRoomData } = await api.getRoom(data.id);
          shareModal.classList.add('hidden');
          (window as any).app.navigate('room', { ...(fullRoomData || roomDataSaved), gameMode });
        });
      }
    } else {
      // Sala pública - navegar direto
      const { data: roomData } = await api.getRoom(data.id);
      (window as any).app.navigate('room', { ...(roomData || data), gameMode });
    }
  });

  // Timeout de segurança - se demorar mais de 8 segundos, mostrar estado vazio
  const timeoutId = setTimeout(() => {
    if (container.querySelector('.loading')) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-state-icon">🎱</div>
          <p class="empty-state-title">Nenhuma sala online disponível</p>
          <p class="empty-state-text">Crie uma sala e convide um amigo para jogar!</p>
          <button id="create-room-btn-empty" class="btn btn-primary" style="margin-top: 1rem;">+ Criar Sala</button>
        </div>
      `;
      if (countEl) countEl.textContent = '0 salas disponíveis';
      document.getElementById('create-room-btn-empty')?.addEventListener('click', () => {
        document.getElementById('create-room-modal')?.classList.remove('hidden');
      });
    }
  }, 8000);

  try {
    const { data, error } = await api.getRooms();
    clearTimeout(timeoutId);

    if (error) {
      container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><p class="empty-state-text">Erro ao carregar salas</p></div>`;
      if (countEl) countEl.textContent = 'Erro ao carregar';
      return;
    }

    const rooms = data?.rooms || [];
    const openRooms = rooms.filter((r: any) => r.status === 'open');

    if (countEl) {
      countEl.textContent = `${openRooms.length} sala${openRooms.length !== 1 ? 's' : ''} disponíve${openRooms.length !== 1 ? 'is' : 'l'}`;
    }

    if (rooms.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-state-icon">🎱</div>
          <p class="empty-state-title">Nenhuma sala online disponível</p>
          <p class="empty-state-text">Crie uma sala e convide um amigo para jogar!</p>
          <button id="create-room-btn-empty" class="btn btn-primary" style="margin-top: 1rem;">+ Criar Sala</button>
        </div>
      `;

      document.getElementById('create-room-btn-empty')?.addEventListener('click', () => {
        document.getElementById('create-room-modal')?.classList.remove('hidden');
      });
      return;
    }

    const currentUserId = gameStore.getState().user?.id;
    
    container.innerHTML = rooms.map((room: any) => {
      const isMyRoom = room.owner_id === currentUserId;
      
      return `
      <div class="room-card ${isMyRoom ? 'my-room' : ''}" data-room-id="${room.id}" data-is-private="${room.is_private || false}" style="${isMyRoom ? 'border: 2px solid var(--accent-green);' : ''}">
        <div class="room-card-header">
          <div>
            <div class="room-card-title">
              ${room.is_private ? '🔒 ' : ''}${isMyRoom ? '⭐ Minha Sala' : `Sala de ${room.owner?.username || 'Jogador'}`}
            </div>
            <div class="room-card-mode">
              ${room.mode === 'bet' ? '💰 Aposta' : '🎮 Casual'}
              ${room.is_private ? ' • Privada' : ' • Pública'}
            </div>
          </div>
          <span class="room-status-badge ${room.status}">${room.status === 'open' ? 'Aberta' : room.status === 'full' ? 'Cheia' : 'Jogando'}</span>
        </div>
        <div class="room-card-players">
          <div class="room-player-avatar">${room.owner?.username?.charAt(0).toUpperCase() || '?'}</div>
          <span class="room-vs">VS</span>
          <div class="room-player-avatar ${!room.guest_id ? 'empty' : ''}">
            ${room.guest?.username?.charAt(0).toUpperCase() || '?'}
          </div>
        </div>
        <div class="room-card-footer">
          <span class="room-bet-value">
            ${room.bet_amount ? `Aposta: <strong>R$ ${room.bet_amount.toFixed(2)}</strong>` : 'Sem aposta'}
          </span>
          ${isMyRoom ? `
            <button class="btn btn-secondary btn-sm view-my-room-btn" data-room-id="${room.id}">👁️ Ver Sala</button>
          ` : (room.status === 'open' ? `
            <button class="btn btn-primary btn-sm join-room-btn" data-room-id="${room.id}" data-is-private="${room.is_private || false}">${room.is_private ? '🔒 Entrar' : 'Entrar'}</button>
          ` : '')}
        </div>
      </div>
    `}).join('');

    // Bind events para botão "Ver Sala" (minha sala)
    document.querySelectorAll('.view-my-room-btn').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const roomId = (el as HTMLElement).dataset.roomId;
        if (!roomId) return;
        
        const { data: fullRoom } = await api.getRoom(roomId);
        if (fullRoom) {
          // Mostrar modal com detalhes da sala e opção de compartilhar
          showMyRoomModal(fullRoom);
        }
      });
    });

    // Bind events para os botões de entrar (outras salas)
    document.querySelectorAll('.join-room-btn').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const roomId = (el as HTMLElement).dataset.roomId;
        const isPrivate = (el as HTMLElement).dataset.isPrivate === 'true';
        
        if (!roomId) return;
        
        // Se sala privada, pedir código
        if (isPrivate) {
          const code = prompt('Digite o código da sala privada:');
          if (!code) return;
          
          const { data: roomData, error } = await api.joinRoomByCode(code.toUpperCase());
          if (error) {
            alert(error);
            return;
          }
          if (roomData) {
            const { data: fullRoom } = await api.getRoom(roomData.id);
            (window as any).app.navigate('room', fullRoom || roomData);
          }
        } else {
          // Sala pública - entrar direto
          const { data: roomData, error } = await api.joinRoom(roomId);
          if (error) {
            alert(error);
            return;
          }
          if (roomData) {
            const { data: fullRoom } = await api.getRoom(roomId);
            (window as any).app.navigate('room', fullRoom || roomData);
          }
        }
      });
    });

// Função para mostrar modal da minha sala
function showMyRoomModal(room: any) {
  // Remover modal anterior se existir
  document.getElementById('my-room-detail-modal')?.remove();
  
  const shareLink = `${window.location.origin}/join/${room.invite_code || room.id}`;
  
  const modalHtml = `
    <div id="my-room-detail-modal" class="modal-overlay">
      <div class="modal-box" style="max-width: 500px;">
        <div class="modal-header">
          <h3 class="modal-title">🎱 Sua Sala</h3>
          <button class="modal-close" id="close-my-room-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div style="text-align: center; margin-bottom: 1.5rem;">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎱</div>
            <p style="color: var(--text-secondary);">
              ${room.mode === 'bet' ? `💰 Aposta: R$ ${Number(room.bet_amount || 0).toFixed(2)}` : '🎮 Modo Casual'}
              ${room.is_private ? ' • 🔒 Privada' : ' • 🌐 Pública'}
            </p>
            <p style="color: var(--accent-yellow); font-size: 0.9rem; margin-top: 0.5rem;">
              ⏳ Aguardando oponente...
            </p>
          </div>
          
          ${room.invite_code ? `
            <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; text-align: center;">
              <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.5rem;">Código de convite:</p>
              <div style="font-size: 2.5rem; font-weight: 800; letter-spacing: 0.3em; color: var(--accent-green); font-family: monospace;">
                ${room.invite_code}
              </div>
            </div>
            
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem;">
              <button id="modal-copy-code-btn" class="btn btn-secondary" style="flex: 1;">📋 Copiar Código</button>
              <button id="modal-copy-link-btn" class="btn btn-secondary" style="flex: 1;">🔗 Copiar Link</button>
            </div>
            
            <div style="background: rgba(255, 165, 2, 0.1); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255, 165, 2, 0.3); margin-bottom: 1rem;">
              <p style="font-size: 0.85rem; color: var(--text-secondary);">
                📤 Envie o <strong>código</strong> ou <strong>link</strong> para seu amigo entrar na sala!
              </p>
            </div>
          ` : ''}
          
          <div style="display: flex; gap: 0.75rem;">
            <button id="modal-go-room-btn" class="btn btn-primary" style="flex: 1;">▶️ Ir para Sala</button>
            <button id="modal-cancel-room-btn" class="btn btn-danger btn-outline" style="flex: 1;">❌ Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Event listeners
  document.getElementById('close-my-room-modal')?.addEventListener('click', () => {
    document.getElementById('my-room-detail-modal')?.remove();
  });
  
  document.getElementById('modal-copy-code-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(room.invite_code).then(() => {
      const btn = document.getElementById('modal-copy-code-btn');
      if (btn) {
        btn.textContent = '✅ Copiado!';
        setTimeout(() => btn.textContent = '📋 Copiar Código', 2000);
      }
    });
  });
  
  document.getElementById('modal-copy-link-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      const btn = document.getElementById('modal-copy-link-btn');
      if (btn) {
        btn.textContent = '✅ Copiado!';
        setTimeout(() => btn.textContent = '🔗 Copiar Link', 2000);
      }
    });
  });
  
  document.getElementById('modal-go-room-btn')?.addEventListener('click', () => {
    document.getElementById('my-room-detail-modal')?.remove();
    (window as any).app.navigate('room', room);
  });
  
  document.getElementById('modal-cancel-room-btn')?.addEventListener('click', async () => {
    if (!confirm('Deseja realmente cancelar sua sala?')) return;
    const { error } = await api.cancelRoom(room.id);
    if (error) {
      alert('Erro ao cancelar sala: ' + error);
    } else {
      document.getElementById('my-room-detail-modal')?.remove();
      location.reload();
    }
  });
  
  // Fechar ao clicar fora
  document.getElementById('my-room-detail-modal')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'my-room-detail-modal') {
      document.getElementById('my-room-detail-modal')?.remove();
    }
  });
}

  } catch (err) {
    clearTimeout(timeoutId);
    container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><p class="empty-state-text">Erro de conexão</p></div>`;
    if (countEl) countEl.textContent = 'Erro de conexão';
  }
}

// ==================== FUNÇÕES DE TORNEIOS ====================

async function loadTournaments() {
  const container = document.getElementById('tournaments-container');
  if (!container) return;
  
  try {
    const { data, error } = await api.getTournaments('open', 6);
    
    if (error) {
      container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><p class="empty-state-text">Erro ao carregar torneios</p></div>`;
      return;
    }
    
    const tournaments = data?.tournaments || [];
    
    if (tournaments.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="empty-state-icon">🏆</div>
          <p class="empty-state-title">Nenhum torneio disponível</p>
          <p class="empty-state-text">Seja o primeiro a criar um torneio!</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = tournaments.map((t: any) => `
      <div class="tournament-card" data-tournament-id="${t.id}" style="background: var(--bg-secondary); border-radius: 16px; padding: 1.25rem; cursor: pointer; transition: all 0.2s; border: 1px solid var(--border-color);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
          <div>
            <h3 style="color: var(--text-primary); font-size: 1.1rem; margin-bottom: 0.25rem;">${t.name}</h3>
            <p style="color: var(--text-muted); font-size: 0.8rem;">
              ${t.created_by_player ? '👑 Por jogador' : '🏢 Oficial'}
            </p>
          </div>
          <span style="background: ${t.status === 'open' ? 'var(--accent-green)' : 'var(--accent-yellow)'}; color: #000; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">
            ${t.status === 'open' ? '🟢 Aberto' : t.status === 'in_progress' ? '🎮 Em andamento' : t.status}
          </span>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
          <div style="background: var(--bg-primary); padding: 0.75rem; border-radius: 8px;">
            <p style="color: var(--text-muted); font-size: 0.75rem;">💰 Inscrição</p>
            <p style="color: var(--accent-yellow); font-weight: 700;">${t.entry_fee > 0 ? `R$ ${Number(t.entry_fee).toFixed(2)}` : 'Grátis'}</p>
          </div>
          <div style="background: var(--bg-primary); padding: 0.75rem; border-radius: 8px;">
            <p style="color: var(--text-muted); font-size: 0.75rem;">👥 Participantes</p>
            <p style="color: var(--text-primary); font-weight: 700;">${t.participant_count || 0}/${t.max_participants}</p>
          </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <p style="color: var(--text-muted); font-size: 0.8rem;">
            📅 ${new Date(t.start_date).toLocaleDateString('pt-BR')} às ${new Date(t.start_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <button class="btn btn-primary btn-sm view-tournament-btn" data-tournament-id="${t.id}">Ver mais →</button>
        </div>
      </div>
    `).join('');
    
    // Hover effects
    container.querySelectorAll('.tournament-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        (card as HTMLElement).style.borderColor = 'var(--accent-green)';
        (card as HTMLElement).style.transform = 'translateY(-2px)';
      });
      card.addEventListener('mouseleave', () => {
        (card as HTMLElement).style.borderColor = 'var(--border-color)';
        (card as HTMLElement).style.transform = 'translateY(0)';
      });
      card.addEventListener('click', () => {
        const tournamentId = (card as HTMLElement).dataset.tournamentId;
        if (tournamentId) {
          showTournamentDetail(tournamentId);
        }
      });
    });
    
  } catch (err) {
    console.error('Erro ao carregar torneios:', err);
    container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><p class="empty-state-text">Erro de conexão</p></div>`;
  }
}

function renderTournamentCard(t: any, isCreator: boolean): string {
  const statusColors: Record<string, string> = {
    'open': 'var(--accent-green)',
    'in_progress': 'var(--accent-yellow)',
    'finished': 'var(--text-muted)',
    'cancelled': 'var(--accent-red)',
  };
  
  const statusLabels: Record<string, string> = {
    'open': '🟢 Aberto',
    'in_progress': '🎮 Em andamento',
    'finished': '✅ Finalizado',
    'cancelled': '❌ Cancelado',
  };
  
  return `
    <div class="tournament-card-mini" data-tournament-id="${t.id}" style="background: var(--bg-secondary); border-radius: 12px; padding: 1rem; margin-bottom: 0.75rem; cursor: pointer; transition: all 0.2s; border: 1px solid var(--border-color);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h4 style="color: var(--text-primary); font-size: 1rem; margin-bottom: 0.25rem;">${t.name}</h4>
          <p style="color: var(--text-muted); font-size: 0.8rem;">
            📅 ${new Date(t.start_date).toLocaleDateString('pt-BR')} • 
            👥 ${t.participant_count || 0}/${t.max_participants} • 
            💰 ${t.entry_fee > 0 ? `R$ ${Number(t.entry_fee).toFixed(2)}` : 'Grátis'}
          </p>
        </div>
        <span style="background: ${statusColors[t.status] || 'var(--text-muted)'}; color: #000; padding: 0.25rem 0.5rem; border-radius: 8px; font-size: 0.7rem; font-weight: 600;">
          ${statusLabels[t.status] || t.status}
        </span>
      </div>
      ${isCreator && t.status === 'finished' ? `
        <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
          <p style="color: var(--accent-yellow); font-size: 0.85rem;">
            💰 Seu ganho: <strong>R$ ${((t.entry_fee * (t.participant_count || 0)) * 0.2).toFixed(2)}</strong> (20%)
          </p>
        </div>
      ` : ''}
    </div>
  `;
}

async function showTournamentDetail(tournamentId: string) {
  const modal = document.getElementById('tournament-detail-modal');
  const body = document.getElementById('tournament-detail-body');
  if (!modal || !body) return;
  
  modal.classList.remove('hidden');
  body.innerHTML = `<div class="loading"><div class="spinner"></div><p class="loading-text">Carregando...</p></div>`;
  
  try {
    const [tournamentRes, prizeRes] = await Promise.all([
      api.getTournament(tournamentId),
      api.getTournamentPrizeInfo(tournamentId),
    ]);
    
    if (tournamentRes.error) {
      body.innerHTML = `<div class="empty-state"><p class="empty-state-text">Erro ao carregar torneio</p></div>`;
      return;
    }
    
    const t = tournamentRes.data;
    const prize = prizeRes.data;
    const state = gameStore.getState();
    const isParticipant = t.participants?.some((p: any) => p.user_id === state.user?.id);
    const isCreator = t.created_by === state.user?.id;
    
    body.innerHTML = `
      <div style="padding: 0.5rem;">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🏆</div>
          <h2 style="color: var(--text-primary); font-size: 1.5rem; margin-bottom: 0.5rem;">${t.name}</h2>
          <span style="background: ${t.status === 'open' ? 'var(--accent-green)' : 'var(--accent-yellow)'}; color: #000; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600;">
            ${t.status === 'open' ? '🟢 Inscrições Abertas' : t.status === 'in_progress' ? '🎮 Em Andamento' : t.status === 'finished' ? '✅ Finalizado' : t.status}
          </span>
          ${t.created_by_player ? `<p style="color: var(--accent-yellow); font-size: 0.85rem; margin-top: 0.5rem;">👑 Torneio criado por jogador</p>` : ''}
        </div>
        
        <!-- Info Grid -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 12px; text-align: center;">
            <p style="color: var(--text-muted); font-size: 0.8rem;">📅 Início</p>
            <p style="color: var(--text-primary); font-weight: 600;">${new Date(t.start_date).toLocaleDateString('pt-BR')}</p>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">${new Date(t.start_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 12px; text-align: center;">
            <p style="color: var(--text-muted); font-size: 0.8rem;">💰 Inscrição</p>
            <p style="color: var(--accent-yellow); font-weight: 700; font-size: 1.2rem;">${t.entry_fee > 0 ? `R$ ${Number(t.entry_fee).toFixed(2)}` : 'Grátis'}</p>
          </div>
          <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 12px; text-align: center;">
            <p style="color: var(--text-muted); font-size: 0.8rem;">👥 Participantes</p>
            <p style="color: var(--text-primary); font-weight: 600; font-size: 1.2rem;">${t.participant_count || 0}/${t.max_participants}</p>
          </div>
          <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 12px; text-align: center;">
            <p style="color: var(--text-muted); font-size: 0.8rem;">🎱 Modo</p>
            <p style="color: var(--text-primary); font-weight: 600;">${t.game_mode === '9ball' ? '9 Bolas' : '8 Bolas'}</p>
          </div>
        </div>
        
        <!-- Premiação -->
        ${prize ? `
          <div style="background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 165, 2, 0.1)); border: 1px solid rgba(255, 215, 0, 0.3); border-radius: 12px; padding: 1rem; margin-bottom: 1.5rem;">
            <h4 style="color: var(--accent-yellow); margin-bottom: 1rem;">🏆 Premiação Estimada</h4>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">Total Arrecadado:</span>
              <span style="color: var(--text-primary); font-weight: 600;">R$ ${Number(prize.totalCollected || 0).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span style="color: var(--text-secondary);">Premiação (${t.created_by_player ? '60%' : '70%'}):</span>
              <span style="color: var(--accent-green); font-weight: 700;">R$ ${Number(prize.prizePool || 0).toFixed(2)}</span>
            </div>
            ${t.created_by_player ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span style="color: var(--text-secondary);">Organizador (20%):</span>
                <span style="color: var(--accent-yellow);">R$ ${(Number(prize.totalCollected || 0) * 0.2).toFixed(2)}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-secondary);">Plataforma (${t.created_by_player ? '20%' : '30%'}):</span>
              <span style="color: var(--text-muted);">R$ ${Number(prize.platformFee || 0).toFixed(2)}</span>
            </div>
          </div>
        ` : ''}
        
        <!-- Descrição -->
        ${t.description ? `
          <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem;">
            <h4 style="color: var(--text-primary); margin-bottom: 0.5rem;">📝 Descrição</h4>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">${t.description}</p>
          </div>
        ` : ''}
        
        <!-- Ações -->
        ${t.status === 'open' ? `
          <div style="display: flex; gap: 0.75rem;">
            ${isParticipant ? `
              <button class="btn btn-secondary w-full" disabled style="flex: 1;">✅ Você está inscrito</button>
              <button id="unregister-tournament-btn" class="btn btn-danger btn-outline" style="flex: 0 0 auto;">Cancelar</button>
            ` : isCreator ? `
              <button class="btn btn-secondary w-full" disabled>👑 Você é o organizador</button>
            ` : `
              <button id="register-tournament-btn" class="btn btn-primary w-full btn-lg">
                ${t.entry_fee > 0 ? `Inscrever-se (R$ ${Number(t.entry_fee).toFixed(2)})` : 'Inscrever-se (Grátis)'}
              </button>
            `}
          </div>
        ` : ''}
        
        <!-- Botão Ver Bracket (quando torneio iniciou) -->
        ${['in_progress', 'finished'].includes(t.status) ? `
          <div style="margin-top: 1rem;">
            <button id="view-bracket-btn" class="btn btn-primary w-full btn-lg" style="background: linear-gradient(135deg, #667eea, #764ba2);">
              🏆 Ver Bracket do Torneio
            </button>
          </div>
        ` : ''}
      </div>
    `;
    
    // Evento de inscrição
    document.getElementById('register-tournament-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('register-tournament-btn') as HTMLButtonElement;
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>';
      }
      
      const { data: result, error } = await api.registerTournament(tournamentId);
      
      if (error) {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = t.entry_fee > 0 ? `Inscrever-se (R$ ${Number(t.entry_fee).toFixed(2)})` : 'Inscrever-se (Grátis)';
        }
        alert(error);
        return;
      }
      
      alert('Inscrição realizada com sucesso! 🎉');
      showTournamentDetail(tournamentId); // Recarregar
      loadTournaments(); // Atualizar lista
    });
    
    // Evento de ver bracket
    document.getElementById('view-bracket-btn')?.addEventListener('click', () => {
      modal.classList.add('hidden');
      (window as any).app.navigate('tournament-bracket', { id: tournamentId, tournamentId });
    });
    
    // Evento de cancelar inscrição
    document.getElementById('unregister-tournament-btn')?.addEventListener('click', async () => {
      if (!confirm('Deseja realmente cancelar sua inscrição? O valor será reembolsado.')) return;
      
      const btn = document.getElementById('unregister-tournament-btn') as HTMLButtonElement;
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '...';
      }
      
      const { error } = await api.unregisterTournament(tournamentId);
      
      if (error) {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = 'Cancelar';
        }
        alert(error);
        return;
      }
      
      alert('Inscrição cancelada. Reembolso processado.');
      showTournamentDetail(tournamentId); // Recarregar
      loadTournaments(); // Atualizar lista
    });
    
  } catch (err) {
    console.error('Erro ao carregar detalhes do torneio:', err);
    body.innerHTML = `<div class="empty-state"><p class="empty-state-text">Erro de conexão</p></div>`;
  }
}


// ==================== TOP 10 JOGADORES ====================
async function loadTopPlayers(silent: boolean = false) {
  const container = document.getElementById('top-players-container');
  if (!container) return;

  try {
    const { data } = await api.getTopPlayers(10);
    const players = data?.players || [];

    if (players.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 2rem; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🏆</div>
          <p style="color: var(--text-muted);">Nenhum jogador no ranking ainda.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="top-players-grid">
        ${players.map((player: any, index: number) => {
          const position = index + 1;
          const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `#${position}`;
          const bgClass = position <= 3 ? `top-${position}` : '';
          
          return `
            <div class="top-player-card ${bgClass}">
              <div class="top-player-position">${medal}</div>
              <div class="top-player-avatar">${player.user?.username?.charAt(0).toUpperCase() || '?'}</div>
              <div class="top-player-info">
                <div class="top-player-name">${player.user?.username || 'Jogador'}</div>
                <div class="top-player-points">${(player.points || 0).toLocaleString()} pts</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      
      <style>
        .top-players-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 1rem;
        }
        
        .top-player-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 1rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          transition: all 0.2s;
        }
        
        .top-player-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        
        .top-player-card.top-1 {
          background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.1));
          border-color: rgba(255, 215, 0, 0.5);
        }
        
        .top-player-card.top-2 {
          background: linear-gradient(135deg, rgba(192, 192, 192, 0.2), rgba(169, 169, 169, 0.1));
          border-color: rgba(192, 192, 192, 0.5);
        }
        
        .top-player-card.top-3 {
          background: linear-gradient(135deg, rgba(205, 127, 50, 0.2), rgba(139, 69, 19, 0.1));
          border-color: rgba(205, 127, 50, 0.5);
        }
        
        .top-player-position {
          font-size: 1.5rem;
          min-width: 40px;
          text-align: center;
        }
        
        .top-player-avatar {
          width: 45px;
          height: 45px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-green), var(--accent-blue));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          font-weight: 700;
          color: #000;
        }
        
        .top-player-info {
          flex: 1;
          min-width: 0;
        }
        
        .top-player-name {
          font-weight: 700;
          color: var(--text-primary);
          font-size: 0.95rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .top-player-points {
          font-size: 0.85rem;
          color: var(--accent-green);
          font-weight: 600;
        }
        
        @media (max-width: 768px) {
          .top-players-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      </style>
    `;
  } catch (err) {
    console.error('Erro ao carregar top players:', err);
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem; text-align: center;">
        <p style="color: var(--text-muted);">Erro ao carregar ranking.</p>
      </div>
    `;
  }
}

// ==================== TRANSMISSÕES AO VIVO ====================
async function loadLives(silent: boolean = false) {
  const container = document.getElementById('lives-container');
  if (!container) return;

  try {
    const { data } = await api.getLives();
    const streams = data?.streams || [];

    if (streams.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 2rem; text-align: center; background: var(--bg-secondary); border-radius: 12px;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">📺</div>
          <p style="color: var(--text-muted); margin-bottom: 0.5rem;">Nenhuma transmissão ao vivo no momento</p>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Crie uma sala e ative a opção "Transmitir Ao Vivo" para aparecer aqui!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="lives-grid">
        ${streams.map((stream: any) => {
          const duration = Math.floor((Date.now() - stream.startedAt) / 60000);
          const durationText = duration < 60 ? `${duration}min` : `${Math.floor(duration / 60)}h ${duration % 60}min`;
          const gameModeLabel = stream.gameMode === '9ball' ? '🔴🔵 9 Bolas' : '🎱 8 Bolas';
          
          return `
            <div class="live-card" data-room-id="${stream.roomId}">
              <div class="live-card-header">
                <div class="live-badge">
                  <span class="live-dot"></span>
                  AO VIVO
                </div>
                <div class="live-viewers">
                  <span>👁️</span>
                  <span>${stream.viewers || 0}</span>
                </div>
              </div>
              
              <div class="live-card-thumbnail">
                <div class="live-thumbnail-placeholder">
                  <span style="font-size: 3rem;">🎱</span>
                </div>
              </div>
              
              <div class="live-card-info">
                <div class="live-title">${stream.title || `Partida de ${stream.hostName}`}</div>
                <div class="live-meta">
                  <span class="live-host">👤 ${stream.hostName}</span>
                  <span class="live-mode">${gameModeLabel}</span>
                </div>
                <div class="live-duration">⏱️ ${durationText}</div>
              </div>
              
              <button class="btn btn-primary w-full live-watch-btn">
                👁️ Assistir
              </button>
            </div>
          `;
        }).join('')}
      </div>
      
      <style>
        .lives-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.5rem;
        }
        
        .live-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          overflow: hidden;
          transition: all 0.3s;
          cursor: pointer;
        }
        
        .live-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(255, 0, 0, 0.2);
          border-color: rgba(255, 0, 0, 0.5);
        }
        
        .live-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: rgba(255, 0, 0, 0.1);
        }
        
        .live-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #ff0000;
          color: #fff;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 700;
        }
        
        .live-dot {
          width: 8px;
          height: 8px;
          background: #fff;
          border-radius: 50%;
          animation: live-pulse 1.5s ease-in-out infinite;
        }
        
        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .live-viewers {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }
        
        .live-card-thumbnail {
          aspect-ratio: 16/9;
          background: var(--bg-tertiary);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .live-thumbnail-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-muted);
        }
        
        .live-card-info {
          padding: 1rem;
        }
        
        .live-title {
          font-weight: 700;
          color: var(--text-primary);
          font-size: 1rem;
          margin-bottom: 0.5rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .live-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }
        
        .live-duration {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        
        .live-watch-btn {
          margin: 0 1rem 1rem;
          width: calc(100% - 2rem);
        }
        
        @media (max-width: 768px) {
          .lives-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>
    `;

    // Bind eventos de assistir
    container.querySelectorAll('.live-card').forEach(card => {
      card.addEventListener('click', async () => {
        const roomId = (card as HTMLElement).dataset.roomId;
        if (roomId) {
          // Registrar visualização
          await api.viewLive(roomId);
          // Navegar para assistir (por enquanto, vai para a sala)
          const { data: room } = await api.getRoom(roomId);
          if (room) {
            (window as any).app.navigate('room', { ...room, isSpectator: true });
          } else {
            alert('Esta transmissão não está mais disponível.');
            loadLives(); // Recarregar lista
          }
        }
      });
    });

  } catch (err) {
    console.error('Erro ao carregar lives:', err);
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem; text-align: center;">
        <p style="color: var(--text-muted);">Erro ao carregar transmissões.</p>
      </div>
    `;
  }
}
