import { gameStore } from '../store/gameStore';
import { api } from '../services/api';
import { checkoutModal } from '../components/CheckoutModal';
import { withdrawModal } from '../components/WithdrawModal';
import { depositModal } from '../components/DepositModal';
import { renderHeader } from '../components/Header';

let isLoadingData = false;
let walletData: any = null;

export function WalletPage(app: any): string {
  const state = gameStore.getState();
  const user = state.user;

  // Carregar dados após render
  setTimeout(() => {
    if (!isLoadingData) {
      isLoadingData = true;
      loadAllWalletData().finally(() => { isLoadingData = false; });
    }
    bindWalletPageEvents();
  }, 100);

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
            <li class="sidebar-item active" data-page="wallet">
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
        <div class="lobby-sync-indicator" id="wallet-sync-indicator">
          <span class="sync-dot"></span>
          <span class="sync-text">Sincronizado</span>
        </div>
        
        <div style="margin-top: auto;">
          <button id="logout-btn" class="btn btn-ghost w-full">Sair</button>
        </div>
      </aside>

      <main class="main-content">
        <!-- SEÇÃO 1: RESUMO DA CARTEIRA -->
        <div class="wallet-summary animate-fadeIn">
          <div class="wallet-main-balance">
            <div class="wallet-balance-info">
              <h3>💰 Saldo Total</h3>
              <div class="wallet-balance-value" id="total-balance">R$ ${state.balance.toFixed(2)}</div>
            </div>
            <div class="wallet-actions">
              <button class="btn btn-primary" id="deposit-btn">+ Comprar Créditos</button>
              <button class="btn btn-success" id="bet-deposit-btn">💰 Depositar para Apostas</button>
              <button class="btn btn-secondary" id="withdraw-btn">💸 Sacar</button>
            </div>
          </div>

          <!-- Detalhamento dos Saldos -->
          <div class="wallet-breakdown" id="wallet-breakdown">
            <div class="breakdown-item">
              <div class="breakdown-icon">📥</div>
              <div class="breakdown-info">
                <span class="breakdown-label">Depósitos</span>
                <span class="breakdown-value" id="deposit-balance">R$ 0,00</span>
                <span class="breakdown-hint" style="color: var(--accent-green);">✅ Usar em apostas e créditos</span>
              </div>
            </div>
            <div class="breakdown-item highlight-green">
              <div class="breakdown-icon">🏆</div>
              <div class="breakdown-info">
                <span class="breakdown-label">Ganhos</span>
                <span class="breakdown-value" id="winnings-balance">R$ 0,00</span>
                <span class="breakdown-hint" style="color: var(--accent-green);">✅ Usar em apostas, créditos e saques</span>
              </div>
            </div>
            <div class="breakdown-item highlight-yellow">
              <div class="breakdown-icon">🎁</div>
              <div class="breakdown-info">
                <span class="breakdown-label">Bônus</span>
                <span class="breakdown-value" id="bonus-balance">R$ 0,00</span>
                <span class="breakdown-hint" style="color: var(--accent-yellow);">⚠️ Apenas jogos casuais (não apostas/créditos/saques)</span>
              </div>
            </div>
            <div class="breakdown-item highlight-blue">
              <div class="breakdown-icon">🎰</div>
              <div class="breakdown-info">
                <span class="breakdown-label">Disponível p/ Apostas</span>
                <span class="breakdown-value" id="available-for-bet">R$ 0,00</span>
                <span class="breakdown-hint" style="color: var(--accent-blue);">💰 Depósitos + Ganhos</span>
              </div>
            </div>
            <div class="breakdown-item highlight-green">
              <div class="breakdown-icon">💸</div>
              <div class="breakdown-info">
                <span class="breakdown-label">Sacável</span>
                <span class="breakdown-value" id="withdrawable-balance">R$ 0,00</span>
                <span class="breakdown-hint" style="color: var(--accent-green);">✅ Apenas ganhos de partidas</span>
              </div>
            </div>
          </div>
        </div>

        <!-- SEÇÃO 2: CRÉDITOS -->
        <div class="section-header">
          <h2 class="section-title">🎫 Seus Créditos</h2>
          <span style="color: var(--text-secondary);">
            Saldo: <strong style="color: var(--accent-blue);">${state.isUnlimited ? '∞ (VIP)' : state.credits} créditos</strong>
          </span>
        </div>

        <div id="credits-summary" class="credits-summary-grid">
          <div class="credit-stat-card">
            <div class="credit-stat-icon">🎫</div>
            <div class="credit-stat-value" id="credits-current">${state.credits}</div>
            <div class="credit-stat-label">Créditos Atuais</div>
          </div>
          <div class="credit-stat-card green">
            <div class="credit-stat-icon">📥</div>
            <div class="credit-stat-value" id="credits-received">0</div>
            <div class="credit-stat-label">Total Recebidos</div>
          </div>
          <div class="credit-stat-card red">
            <div class="credit-stat-icon">🎮</div>
            <div class="credit-stat-value" id="credits-used">0</div>
            <div class="credit-stat-label">Total Usados</div>
          </div>
          <div class="credit-stat-card yellow">
            <div class="credit-stat-icon">📅</div>
            <div class="credit-stat-value" id="credits-today">0</div>
            <div class="credit-stat-label">Usados Hoje</div>
          </div>
        </div>

        <!-- Comprar Créditos -->
        <div class="buy-credits-section">
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem; text-align: center;">
            💡 1 crédito = R$ 0,50 | Mínimo: 4 créditos (R$ 2,00) | 1 crédito grátis por dia!
          </p>
          <div class="wallet-quick-values">
            <div class="quick-value-card" data-amount="2" data-credits="4">
              <div class="quick-value-amount">R$ 2,00</div>
              <div class="quick-value-credits">4 créditos</div>
            </div>
            <div class="quick-value-card popular" data-amount="10" data-credits="20">
              <div class="quick-value-badge">Mais Popular</div>
              <div class="quick-value-amount">R$ 10,00</div>
              <div class="quick-value-credits">20 créditos</div>
            </div>
            <div class="quick-value-card" data-amount="20" data-credits="40">
              <div class="quick-value-amount">R$ 20,00</div>
              <div class="quick-value-credits">40 créditos</div>
            </div>
            <div class="quick-value-card" data-amount="50" data-credits="100">
              <div class="quick-value-amount">R$ 50,00</div>
              <div class="quick-value-credits">100 créditos</div>
            </div>
          </div>
        </div>

        <!-- Plano VIP -->
        <div class="vip-card">
          <div class="vip-content">
            <div class="vip-info">
              <h3>👑 Plano VIP - Créditos Ilimitados</h3>
              <p>Jogue quantas partidas quiser sem se preocupar com créditos!</p>
              <ul>
                <li>✅ Créditos ilimitados</li>
                <li>✅ Sem anúncios</li>
                <li>✅ Badge exclusivo</li>
              </ul>
            </div>
            <div class="vip-price">
              <div class="vip-amount">R$ 19,99</div>
              <div class="vip-period">/mês</div>
              <button class="btn btn-primary" id="subscribe-vip-btn" ${state.isUnlimited ? 'disabled' : ''}>
                ${state.isUnlimited ? '✅ Você é VIP' : 'Assinar VIP'}
              </button>
            </div>
          </div>
        </div>

        <!-- SEÇÃO 3: HISTÓRICO DE SAQUES -->
        <div class="section-header" style="margin-top: 2rem;">
          <h2 class="section-title">💸 Histórico de Saques</h2>
          <button class="btn btn-sm btn-ghost" id="refresh-withdrawals-btn">🔄 Atualizar</button>
        </div>

        <div id="withdrawals-list" class="transaction-list">
          <p style="text-align: center; color: var(--text-muted); padding: 2rem;">
            Carregando histórico de saques...
          </p>
        </div>

        <!-- SEÇÃO 4: HISTÓRICO DE TRANSAÇÕES (RECEITAS) -->
        <div class="section-header" style="margin-top: 2rem;">
          <h2 class="section-title">📥 Receitas (Entradas)</h2>
        </div>

        <div id="income-summary" class="income-summary-grid">
          <div class="income-card green">
            <div class="income-icon">📥</div>
            <div class="income-value" id="income-deposits">R$ 0,00</div>
            <div class="income-label">Depósitos</div>
          </div>
          <div class="income-card gold">
            <div class="income-icon">🏆</div>
            <div class="income-value" id="income-wins">R$ 0,00</div>
            <div class="income-label">Prêmios de Apostas</div>
          </div>
          <div class="income-card purple">
            <div class="income-icon">🎁</div>
            <div class="income-value" id="income-bonus">R$ 0,00</div>
            <div class="income-label">Bônus Recebidos</div>
          </div>
          <div class="income-card blue">
            <div class="income-icon">👥</div>
            <div class="income-value" id="income-referral">R$ 0,00</div>
            <div class="income-label">Indicações</div>
          </div>
        </div>

        <div id="income-list" class="transaction-list">
          <p style="text-align: center; color: var(--text-muted); padding: 2rem;">
            Carregando receitas...
          </p>
        </div>

        <!-- SEÇÃO 5: HISTÓRICO DE GASTOS -->
        <div class="section-header" style="margin-top: 2rem;">
          <h2 class="section-title">📤 Gastos (Saídas)</h2>
        </div>

        <div id="expense-summary" class="expense-summary-grid">
          <div class="expense-card red">
            <div class="expense-icon">🎰</div>
            <div class="expense-value" id="expense-bets">R$ 0,00</div>
            <div class="expense-label">Apostas Perdidas</div>
          </div>
          <div class="expense-card orange">
            <div class="expense-icon">💸</div>
            <div class="expense-value" id="expense-withdrawals">R$ 0,00</div>
            <div class="expense-label">Saques Realizados</div>
          </div>
          <div class="expense-card gray">
            <div class="expense-icon">🎫</div>
            <div class="expense-value" id="expense-credits">R$ 0,00</div>
            <div class="expense-label">Compra de Créditos</div>
          </div>
        </div>

        <div id="expense-list" class="transaction-list">
          <p style="text-align: center; color: var(--text-muted); padding: 2rem;">
            Carregando gastos...
          </p>
        </div>

        <!-- SEÇÃO 6: HISTÓRICO DE CRÉDITOS DETALHADO -->
        <div class="section-header" style="margin-top: 2rem;">
          <h2 class="section-title">🎫 Histórico Detalhado de Créditos</h2>
        </div>

        <div id="credits-breakdown" class="credits-breakdown-grid">
          <div class="credits-source-card">
            <div class="source-icon">🛒</div>
            <div class="source-value" id="credits-purchased">0</div>
            <div class="source-label">Comprados</div>
          </div>
          <div class="credits-source-card">
            <div class="source-icon">📅</div>
            <div class="source-value" id="credits-daily">0</div>
            <div class="source-label">Diários Grátis</div>
          </div>
          <div class="credits-source-card">
            <div class="source-icon">👥</div>
            <div class="source-value" id="credits-referral">0</div>
            <div class="source-label">Por Indicação</div>
          </div>
          <div class="credits-source-card">
            <div class="source-icon">⚙️</div>
            <div class="source-value" id="credits-admin">0</div>
            <div class="source-label">Bônus Admin</div>
          </div>
          <div class="credits-source-card">
            <div class="source-icon">🎟️</div>
            <div class="source-value" id="credits-coupon">0</div>
            <div class="source-label">Por Cupom</div>
          </div>
          <div class="credits-source-card">
            <div class="source-icon">🎯</div>
            <div class="source-value" id="credits-mission">0</div>
            <div class="source-label">Por Missão</div>
          </div>
        </div>

        <div id="credits-history-list" class="transaction-list">
          <p style="text-align: center; color: var(--text-muted); padding: 2rem;">
            Carregando histórico de créditos...
          </p>
        </div>
      </main>
    </div>
  `;
}


// Carregar todos os dados da carteira
async function loadAllWalletData() {
  try {
    // Carregar dados em paralelo
    const [walletRes, availableForBetRes, transactionsRes, creditsRes, withdrawalsRes] = await Promise.all([
      api.request<any>('/withdrawals/balance'),
      api.getAvailableForBet(),
      api.getTransactions(100),
      api.getCreditsHistory(100),
      api.request<any>('/withdrawals'),
    ]);

    // Atualizar saldos
    if (walletRes.data) {
      walletData = walletRes.data;
      updateElement('total-balance', `R$ ${(walletRes.data.totalBalance || 0).toFixed(2)}`);
      updateElement('deposit-balance', `R$ ${(walletRes.data.depositBalance || 0).toFixed(2)}`);
      updateElement('winnings-balance', `R$ ${(walletRes.data.winningsBalance || 0).toFixed(2)}`);
      updateElement('bonus-balance', `R$ ${(walletRes.data.bonusBalance || 0).toFixed(2)}`);
      updateElement('withdrawable-balance', `R$ ${(walletRes.data.withdrawableBalance || 0).toFixed(2)}`);
    }

    // Atualizar saldo disponível para apostas
    if (availableForBetRes.data) {
      updateElement('available-for-bet', `R$ ${(availableForBetRes.data.available_for_bet || 0).toFixed(2)}`);
    }

    // Processar transações
    if (transactionsRes.data) {
      processTransactions(transactionsRes.data.transactions || []);
    }

    // Processar créditos
    if (creditsRes.data) {
      processCreditsHistory(creditsRes.data);
    }

    // Processar saques
    if (withdrawalsRes.data) {
      renderWithdrawals(withdrawalsRes.data.withdrawals || []);
    }

  } catch (err) {
    console.error('Erro ao carregar dados da carteira:', err);
  }
}

// Processar e exibir transações separadas por tipo
function processTransactions(transactions: any[]) {
  // Separar receitas e gastos
  const income: any[] = [];
  const expenses: any[] = [];

  // Totais
  let totalDeposits = 0;
  let totalWins = 0;
  let totalBonus = 0;
  let totalReferral = 0;
  let totalBetLoss = 0;
  let totalWithdrawals = 0;
  let totalCreditPurchase = 0;

  transactions.forEach(t => {
    const amount = Number(t.amount);
    
    if (amount > 0) {
      income.push(t);
      
      if (t.type === 'deposit') totalDeposits += amount;
      else if (t.type === 'bet_win' || t.type === 'winnings') totalWins += amount;
      else if (t.type === 'admin_adjustment' && amount > 0) totalBonus += amount;
      else if (t.description?.toLowerCase().includes('indicação') || t.description?.toLowerCase().includes('referral')) {
        totalReferral += amount;
      } else if (t.type === 'bonus') totalBonus += amount;
    } else {
      expenses.push(t);
      
      if (t.type === 'bet_loss') totalBetLoss += Math.abs(amount);
      else if (t.type === 'withdrawal') totalWithdrawals += Math.abs(amount);
      else if (t.type === 'credit_purchase') totalCreditPurchase += Math.abs(amount);
    }
  });

  // Atualizar resumos
  updateElement('income-deposits', `R$ ${totalDeposits.toFixed(2)}`);
  updateElement('income-wins', `R$ ${totalWins.toFixed(2)}`);
  updateElement('income-bonus', `R$ ${totalBonus.toFixed(2)}`);
  updateElement('income-referral', `R$ ${totalReferral.toFixed(2)}`);

  updateElement('expense-bets', `R$ ${totalBetLoss.toFixed(2)}`);
  updateElement('expense-withdrawals', `R$ ${totalWithdrawals.toFixed(2)}`);
  updateElement('expense-credits', `R$ ${totalCreditPurchase.toFixed(2)}`);

  // Renderizar listas
  renderIncomeList(income);
  renderExpenseList(expenses);
}

// Renderizar lista de receitas
function renderIncomeList(transactions: any[]) {
  const container = document.getElementById('income-list');
  if (!container) return;

  if (transactions.length === 0) {
    container.innerHTML = `
      <p style="text-align: center; color: var(--text-muted); padding: 2rem;">
        Nenhuma receita registrada ainda.
      </p>
    `;
    return;
  }

  const icons: Record<string, string> = {
    deposit: '📥',
    bet_win: '🏆',
    winnings: '💰',
    admin_adjustment: '⚙️',
    bonus: '🎁',
  };

  const labels: Record<string, string> = {
    deposit: 'Depósito',
    bet_win: 'Prêmio de Aposta',
    winnings: 'Ganhos',
    admin_adjustment: 'Bônus do Admin',
    bonus: 'Bônus',
  };

  container.innerHTML = transactions.slice(0, 20).map(t => {
    const icon = icons[t.type] || '💰';
    const label = labels[t.type] || t.type;
    const description = t.description || getIncomeDescription(t);

    return `
      <div class="transaction-item">
        <div class="transaction-icon deposit">${icon}</div>
        <div class="transaction-info">
          <div class="transaction-title">${label}</div>
          <div class="transaction-date">${new Date(t.created_at).toLocaleString('pt-BR')}</div>
          <div class="transaction-desc">${description}</div>
        </div>
        <div class="transaction-amount positive">+R$ ${Math.abs(t.amount).toFixed(2)}</div>
      </div>
    `;
  }).join('');
}

// Descrição detalhada da receita
function getIncomeDescription(t: any): string {
  switch (t.type) {
    case 'deposit': return 'Depósito via PIX/Cartão';
    case 'bet_win': return `Vitória em partida de aposta`;
    case 'winnings': return 'Prêmio creditado';
    case 'admin_adjustment': return 'Crédito dado pelo administrador';
    case 'bonus': return 'Bônus promocional';
    default: return t.description || 'Crédito recebido';
  }
}

// Renderizar lista de gastos
function renderExpenseList(transactions: any[]) {
  const container = document.getElementById('expense-list');
  if (!container) return;

  if (transactions.length === 0) {
    container.innerHTML = `
      <p style="text-align: center; color: var(--text-muted); padding: 2rem;">
        Nenhum gasto registrado ainda.
      </p>
    `;
    return;
  }

  const icons: Record<string, string> = {
    bet_loss: '🎰',
    withdrawal: '💸',
    credit_purchase: '🎫',
    debit: '📤',
  };

  const labels: Record<string, string> = {
    bet_loss: 'Aposta Perdida',
    withdrawal: 'Saque',
    credit_purchase: 'Compra de Créditos',
    debit: 'Débito',
  };

  container.innerHTML = transactions.slice(0, 20).map(t => {
    const icon = icons[t.type] || '📤';
    const label = labels[t.type] || t.type;
    const description = t.description || getExpenseDescription(t);

    return `
      <div class="transaction-item">
        <div class="transaction-icon withdraw">${icon}</div>
        <div class="transaction-info">
          <div class="transaction-title">${label}</div>
          <div class="transaction-date">${new Date(t.created_at).toLocaleString('pt-BR')}</div>
          <div class="transaction-desc">${description}</div>
        </div>
        <div class="transaction-amount negative">-R$ ${Math.abs(t.amount).toFixed(2)}</div>
      </div>
    `;
  }).join('');
}

// Descrição detalhada do gasto
function getExpenseDescription(t: any): string {
  switch (t.type) {
    case 'bet_loss': return `Derrota em partida de aposta`;
    case 'withdrawal': return 'Saque para conta bancária';
    case 'credit_purchase': return 'Compra de créditos para jogar';
    case 'debit': return 'Débito na conta';
    default: return t.description || 'Débito realizado';
  }
}

// Renderizar histórico de saques
function renderWithdrawals(withdrawals: any[]) {
  const container = document.getElementById('withdrawals-list');
  if (!container) return;

  if (withdrawals.length === 0) {
    container.innerHTML = `
      <p style="text-align: center; color: var(--text-muted); padding: 2rem;">
        Você ainda não fez nenhum saque. Ganhe partidas para acumular saldo sacável!
      </p>
    `;
    return;
  }

  const statusLabels: Record<string, string> = {
    pending: '⏳ Pendente',
    processing: '🔄 Processando',
    completed: '✅ Concluído',
    rejected: '❌ Rejeitado',
  };

  const statusColors: Record<string, string> = {
    pending: 'orange',
    processing: 'blue',
    completed: 'green',
    rejected: 'red',
  };

  container.innerHTML = withdrawals.map(w => {
    const statusLabel = statusLabels[w.status] || w.status;
    const statusColor = statusColors[w.status] || 'gray';
    const canCancel = w.status === 'pending';

    return `
      <div class="transaction-item withdrawal-item">
        <div class="transaction-icon" style="background: rgba(255,165,2,0.2);">💸</div>
        <div class="transaction-info">
          <div class="transaction-title">Saque via PIX</div>
          <div class="transaction-date">${new Date(w.created_at).toLocaleString('pt-BR')}</div>
          <div class="transaction-desc">
            Chave: ${maskPixKey(w.pix_key, w.pix_key_type)}
          </div>
          <div class="withdrawal-status" style="color: var(--${statusColor}); font-weight: 600; margin-top: 0.25rem;">
            ${statusLabel}
          </div>
          ${w.status === 'rejected' && w.rejection_reason ? `
            <div class="withdrawal-reason" style="color: #ff6b6b; font-size: 0.8rem;">
              Motivo: ${w.rejection_reason}
            </div>
          ` : ''}
          ${w.status === 'completed' && w.processed_at ? `
            <div class="withdrawal-completed" style="color: var(--accent-green); font-size: 0.8rem;">
              Processado em: ${new Date(w.processed_at).toLocaleString('pt-BR')}
            </div>
          ` : ''}
        </div>
        <div style="text-align: right;">
          <div class="transaction-amount negative">-R$ ${Number(w.amount).toFixed(2)}</div>
          ${canCancel ? `
            <button class="btn btn-sm btn-ghost" data-cancel-withdrawal="${w.id}" style="margin-top: 0.5rem; font-size: 0.75rem;">
              ❌ Cancelar
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Bind eventos de cancelamento
  document.querySelectorAll('[data-cancel-withdrawal]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = (e.target as HTMLElement).getAttribute('data-cancel-withdrawal');
      if (id && confirm('Tem certeza que deseja cancelar este saque? O valor será devolvido para sua carteira.')) {
        await cancelWithdrawal(id);
      }
    });
  });
}

// Cancelar saque
async function cancelWithdrawal(id: string) {
  try {
    const { error } = await api.request(`/withdrawals/${id}`, { method: 'DELETE' });
    if (error) {
      showToast(error, 'error');
    } else {
      showToast('Saque cancelado! Valor devolvido para sua carteira.', 'success');
      // Recarregar dados
      loadAllWalletData();
      // Atualizar saldo no store
      const { data: walletData } = await api.getWallet();
      if (walletData) {
        gameStore.setBalance(walletData.balance || 0);
      }
    }
  } catch (err) {
    showToast('Erro ao cancelar saque', 'error');
  }
}

// Mascarar chave PIX
function maskPixKey(key: string, type: string): string {
  if (!key) return '***';
  if (type === 'cpf') {
    return key.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4');
  }
  if (type === 'email') {
    const [user, domain] = key.split('@');
    return `${user.slice(0, 3)}***@${domain}`;
  }
  if (type === 'phone') {
    return key.replace(/(\d{2})(\d{5})(\d{4})/, '($1) *****-$3');
  }
  return `${key.slice(0, 8)}***`;
}

// Processar histórico de créditos
function processCreditsHistory(data: any) {
  const { history, summary } = data;

  // Atualizar resumo
  updateElement('credits-received', summary?.total_received || 0);
  updateElement('credits-used', summary?.total_used || 0);

  // Calcular créditos usados hoje
  const today = new Date().toDateString();
  const usedToday = history?.filter((h: any) => 
    h.type === 'credit_used' && new Date(h.created_at).toDateString() === today
  ).reduce((sum: number, h: any) => sum + Math.abs(h.amount), 0) || 0;
  updateElement('credits-today', usedToday);

  // Calcular por fonte
  let purchased = 0, daily = 0, referral = 0, admin = 0, coupon = 0, mission = 0;

  history?.forEach((h: any) => {
    if (h.type !== 'credit_received') return;
    const desc = (h.description || '').toLowerCase();
    const amount = Math.abs(h.amount);

    if (desc.includes('compra') || desc.includes('purchase')) purchased += amount;
    else if (desc.includes('diário') || desc.includes('daily')) daily += amount;
    else if (desc.includes('indicação') || desc.includes('referral')) referral += amount;
    else if (desc.includes('admin') || desc.includes('bônus admin')) admin += amount;
    else if (desc.includes('cupom') || desc.includes('coupon')) coupon += amount;
    else if (desc.includes('missão') || desc.includes('mission')) mission += amount;
  });

  updateElement('credits-purchased', purchased);
  updateElement('credits-daily', daily);
  updateElement('credits-referral', referral);
  updateElement('credits-admin', admin);
  updateElement('credits-coupon', coupon);
  updateElement('credits-mission', mission);

  // Renderizar lista
  renderCreditsHistoryList(history || []);
}

// Renderizar lista de histórico de créditos
function renderCreditsHistoryList(history: any[]) {
  const container = document.getElementById('credits-history-list');
  if (!container) return;

  if (history.length === 0) {
    container.innerHTML = `
      <p style="text-align: center; color: var(--text-muted); padding: 2rem;">
        Nenhum histórico de créditos ainda.
      </p>
    `;
    return;
  }

  container.innerHTML = history.slice(0, 30).map(item => {
    const isPositive = item.type === 'credit_received';
    const icon = isPositive ? getCreditSourceIcon(item.description) : '🎮';

    return `
      <div class="transaction-item">
        <div class="transaction-icon ${isPositive ? 'deposit' : 'withdraw'}">${icon}</div>
        <div class="transaction-info">
          <div class="transaction-title">${item.description || (isPositive ? 'Crédito recebido' : 'Crédito usado')}</div>
          <div class="transaction-date">${new Date(item.created_at).toLocaleString('pt-BR')}</div>
        </div>
        <div class="transaction-amount ${isPositive ? 'positive' : 'negative'}">
          ${isPositive ? '+' : ''}${item.amount} crédito${Math.abs(item.amount) !== 1 ? 's' : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Ícone baseado na fonte do crédito
function getCreditSourceIcon(description: string): string {
  const desc = (description || '').toLowerCase();
  if (desc.includes('compra') || desc.includes('purchase')) return '🛒';
  if (desc.includes('diário') || desc.includes('daily')) return '📅';
  if (desc.includes('indicação') || desc.includes('referral')) return '👥';
  if (desc.includes('admin')) return '⚙️';
  if (desc.includes('cupom') || desc.includes('coupon')) return '🎟️';
  if (desc.includes('missão') || desc.includes('mission')) return '🎯';
  if (desc.includes('boas-vindas') || desc.includes('welcome')) return '👋';
  return '🎫';
}

// Atualizar elemento
function updateElement(id: string, value: any) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

// Toast
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

function bindWalletPageEvents() {
  // Clique nos cards de créditos
  document.querySelectorAll('.quick-value-card').forEach(el => {
    el.addEventListener('click', () => {
      const amount = parseFloat((el as HTMLElement).dataset.amount || '10');
      const credits = parseInt((el as HTMLElement).dataset.credits || '20');
      
      checkoutModal.open({
        amount,
        credits,
        onSuccess: () => {
          (window as any).app.navigate('wallet');
        },
      });
    });
  });

  // Botão de depósito (comprar créditos)
  document.getElementById('deposit-btn')?.addEventListener('click', () => {
    checkoutModal.open({
      amount: 10,
      credits: 20,
      onSuccess: () => {
        (window as any).app.navigate('wallet');
      },
    });
  });

  // Botão de depósito para apostas
  document.getElementById('bet-deposit-btn')?.addEventListener('click', () => {
    depositModal.open({
      onSuccess: () => {
        loadAllWalletData();
      },
    });
  });

  // Botão de saque
  document.getElementById('withdraw-btn')?.addEventListener('click', () => {
    withdrawModal.open({
      onSuccess: () => {
        (window as any).app.navigate('wallet');
      },
    });
  });

  // Botão VIP
  document.getElementById('subscribe-vip-btn')?.addEventListener('click', () => {
    checkoutModal.open({
      amount: 19.99,
      credits: 0,
      onSuccess: () => {
        (window as any).app.navigate('wallet');
      },
    });
  });

  // Atualizar saques
  document.getElementById('refresh-withdrawals-btn')?.addEventListener('click', () => {
    loadAllWalletData();
  });
}
