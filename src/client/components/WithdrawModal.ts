import { api } from '../services/api';
import { gameStore } from '../store/gameStore';

interface WithdrawModalOptions {
  onSuccess?: () => void;
}

interface WithdrawBalanceResponse {
  withdrawableBalance: number;
  totalBalance: number;
  depositBalance: number;
  winningsBalance: number;
  bonusBalance: number;
  minWithdrawal: number;
  maxWithdrawal: number;
  rules?: {
    canWithdraw: string[];
    cannotWithdraw: string[];
    message: string;
  };
}

class WithdrawModal {
  private options: WithdrawModalOptions = {};
  private withdrawableBalance: number = 0;
  private minWithdrawal: number = 10;
  private maxWithdrawal: number = 10000;
  private winningsBalance: number = 0;

  async open(options: WithdrawModalOptions = {}) {
    this.options = options;

    // Buscar saldo disponível para saque e configurações
    try {
      const { data } = await api.request<WithdrawBalanceResponse>('/withdrawals/balance');
      this.withdrawableBalance = data?.withdrawableBalance || 0;
      this.winningsBalance = data?.winningsBalance || 0;
      this.minWithdrawal = data?.minWithdrawal || 10;
      this.maxWithdrawal = data?.maxWithdrawal || 10000;
    } catch (err) {
      this.withdrawableBalance = 0;
      this.winningsBalance = 0;
    }

    this.render();
    this.bindEvents();
  }

  private render() {
    // Remover modal existente
    document.getElementById('withdraw-modal-container')?.remove();

    const canWithdraw = this.withdrawableBalance >= this.minWithdrawal;

    const container = document.createElement('div');
    container.id = 'withdraw-modal-container';
    container.innerHTML = `
      <div class="modal-overlay" id="withdraw-modal-overlay">
        <div class="modal-box" style="max-width: 450px;">
          <div class="modal-header">
            <h3 class="modal-title">💸 Solicitar Saque</h3>
            <button class="modal-close" id="withdraw-modal-close">&times;</button>
          </div>

          <div style="background: rgba(0,255,136,0.1); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid rgba(0,255,136,0.2);">
            <div style="font-size: 0.9rem; color: var(--text-muted);">💰 Saldo disponível para saque</div>
            <div style="font-size: 2rem; font-weight: 700; color: var(--accent-green);">R$ ${this.withdrawableBalance.toFixed(2)}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
              (Ganhos de partidas: R$ ${this.winningsBalance.toFixed(2)})
            </div>
          </div>

          <div style="background: rgba(255,165,2,0.1); padding: 0.75rem; border-radius: 8px; margin-bottom: 1.5rem;">
            <div style="font-size: 0.85rem; color: var(--accent-yellow);">
              ⚠️ <strong>Regras de Saque:</strong>
            </div>
            <ul style="margin: 0.5rem 0 0 1rem; padding: 0; font-size: 0.8rem; color: var(--text-muted);">
              <li>✅ <strong>Ganhos de partidas</strong> podem ser sacados</li>
              <li>❌ <strong>Depósitos</strong> devem ser usados em partidas</li>
              <li>❌ <strong>Bônus</strong> não podem ser sacados</li>
            </ul>
          </div>

          ${!canWithdraw ? `
            <div style="background: rgba(255,107,107,0.1); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; text-align: center;">
              <div style="font-size: 1.2rem; margin-bottom: 0.5rem;">❌</div>
              <div style="color: #ff6b6b; font-weight: 600;">Saldo insuficiente para saque</div>
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">
                Valor mínimo: R$ ${this.minWithdrawal.toFixed(2)}
              </div>
            </div>
          ` : `
            <form id="withdraw-form">
              <div class="form-group">
                <label for="withdraw-amount">Valor do saque</label>
                <input type="number" id="withdraw-amount" class="input" placeholder="0.00" min="${this.minWithdrawal}" max="${Math.min(this.withdrawableBalance, this.maxWithdrawal)}" step="0.01" required>
                <small style="color: var(--text-muted);">Mínimo: R$ ${this.minWithdrawal.toFixed(2)} | Máximo: R$ ${Math.min(this.withdrawableBalance, this.maxWithdrawal).toFixed(2)}</small>
              </div>

              <div class="form-group">
                <label for="pix-key-type">Tipo de chave PIX</label>
                <select id="pix-key-type" class="input" required>
                  <option value="">Selecione...</option>
                  <option value="cpf">CPF</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Telefone</option>
                  <option value="random">Chave aleatória</option>
                </select>
              </div>

              <div class="form-group">
                <label for="pix-key">Chave PIX</label>
                <input type="text" id="pix-key" class="input" placeholder="Digite sua chave PIX" required>
              </div>

              <div id="withdraw-error" style="color: #ff6b6b; font-size: 0.9rem; margin-bottom: 1rem; display: none;"></div>

              <button type="submit" class="btn btn-primary w-full btn-lg" id="withdraw-submit-btn">
                💸 Solicitar Saque
              </button>
            </form>
          `}

          <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(96,165,250,0.1); border-radius: 8px;">
            <div style="font-size: 0.8rem; color: var(--text-muted);">
              ℹ️ Saques são processados em até 24h úteis após aprovação do administrador.
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
  }

  private bindEvents() {
    // Fechar modal
    document.getElementById('withdraw-modal-close')?.addEventListener('click', () => this.close());
    document.getElementById('withdraw-modal-overlay')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'withdraw-modal-overlay') {
        this.close();
      }
    });

    // Máscara para tipo de chave
    document.getElementById('pix-key-type')?.addEventListener('change', (e) => {
      const type = (e.target as HTMLSelectElement).value;
      const input = document.getElementById('pix-key') as HTMLInputElement;
      
      if (type === 'cpf') {
        input.placeholder = '000.000.000-00';
        input.maxLength = 14;
      } else if (type === 'email') {
        input.placeholder = 'seu@email.com';
        input.maxLength = 100;
      } else if (type === 'phone') {
        input.placeholder = '+55 (00) 00000-0000';
        input.maxLength = 20;
      } else if (type === 'random') {
        input.placeholder = 'Chave aleatória';
        input.maxLength = 36;
      }
    });

    // Submit
    document.getElementById('withdraw-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });
  }

  private async handleSubmit() {
    const amount = parseFloat((document.getElementById('withdraw-amount') as HTMLInputElement).value);
    const pixKeyType = (document.getElementById('pix-key-type') as HTMLSelectElement).value;
    const pixKey = (document.getElementById('pix-key') as HTMLInputElement).value;
    const errorEl = document.getElementById('withdraw-error');
    const submitBtn = document.getElementById('withdraw-submit-btn') as HTMLButtonElement;

    // Validações
    if (!amount || amount < this.minWithdrawal) {
      this.showError(`Valor mínimo para saque é R$ ${this.minWithdrawal.toFixed(2)}`);
      return;
    }

    if (amount > this.withdrawableBalance) {
      this.showError('Valor maior que o saldo disponível para saque');
      return;
    }

    if (amount > this.maxWithdrawal) {
      this.showError(`Valor máximo para saque é R$ ${this.maxWithdrawal.toFixed(2)}`);
      return;
    }

    if (!pixKeyType) {
      this.showError('Selecione o tipo de chave PIX');
      return;
    }

    if (!pixKey) {
      this.showError('Digite sua chave PIX');
      return;
    }

    // Desabilitar botão
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Processando...';

    try {
      const { data, error } = await api.request<{ success: boolean; message: string }>('/withdrawals', {
        method: 'POST',
        body: JSON.stringify({
          amount,
          pix_key: pixKey,
          pix_key_type: pixKeyType,
        }),
      });

      if (error) {
        this.showError(error);
        submitBtn.disabled = false;
        submitBtn.textContent = '💸 Solicitar Saque';
        return;
      }

      // Sucesso
      this.close();
      this.showToast('✅ Solicitação de saque enviada! O valor foi debitado do seu saldo de ganhos.', 'success');
      
      // Atualizar saldo no store
      const { data: walletData } = await api.getWallet();
      if (walletData) {
        gameStore.setBalance(walletData.balance || 0);
      }

      this.options.onSuccess?.();
    } catch (err) {
      this.showError('Erro ao processar solicitação');
      submitBtn.disabled = false;
      submitBtn.textContent = '💸 Solicitar Saque';
    }
  }

  private showError(message: string) {
    const errorEl = document.getElementById('withdraw-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }

  private close() {
    document.getElementById('withdraw-modal-container')?.remove();
  }

  private showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
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
}

export const withdrawModal = new WithdrawModal();
