// =====================================================
// DEPOSIT MODAL - Depósito de Saldo para Apostas
// =====================================================

import { api } from '../services/api';
import { gameStore } from '../store/gameStore';

interface DepositOptions {
  onSuccess?: () => void;
  onClose?: () => void;
}

type DepositStep = 'form' | 'processing' | 'pix-waiting' | 'success' | 'error';

class DepositModal {
  private options: DepositOptions | null = null;
  private step: DepositStep = 'form';
  private amount: number = 20;
  private paymentId: string | null = null;
  private pixData: { qrcode: string; copyPaste: string; expiresAt: string } | null = null;
  private errorMessage: string = '';
  private pollingInterval: number | null = null;

  // Valores sugeridos
  private suggestedAmounts = [
    { value: 10, label: 'R$ 10', popular: false },
    { value: 20, label: 'R$ 20', popular: true },
    { value: 50, label: 'R$ 50', popular: false },
    { value: 100, label: 'R$ 100', popular: false },
    { value: 200, label: 'R$ 200', popular: false },
  ];

  open(options?: DepositOptions) {
    this.options = options || {};
    this.step = 'form';
    this.amount = 20;
    this.paymentId = null;
    this.pixData = null;
    this.errorMessage = '';
    this.render();
  }

  close() {
    this.stopPolling();
    const overlay = document.getElementById('deposit-overlay');
    if (overlay) overlay.remove();
    this.options?.onClose?.();
  }

  private render() {
    document.getElementById('deposit-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'deposit-overlay';
    overlay.className = 'deposit-overlay';
    overlay.innerHTML = this.getContent();
    document.body.appendChild(overlay);

    this.bindEvents();
  }

  private getContent(): string {
    return `
      <div class="deposit-container">
        <button class="deposit-close" id="deposit-close">&times;</button>
        <h2 class="deposit-title">💰 Depositar Saldo para Apostas</h2>
        
        ${this.step === 'form' ? this.getFormContent() : ''}
        ${this.step === 'processing' ? this.getProcessingContent() : ''}
        ${this.step === 'pix-waiting' ? this.getPixWaitingContent() : ''}
        ${this.step === 'success' ? this.getSuccessContent() : ''}
        ${this.step === 'error' ? this.getErrorContent() : ''}
        
        <div class="deposit-secure">🔒 Pagamento 100% seguro via PIX</div>
      </div>
      
      <style>
        .deposit-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 1rem;
        }
        
        .deposit-container {
          background: var(--bg-secondary);
          border-radius: 16px;
          padding: 2rem;
          max-width: 480px;
          width: 100%;
          position: relative;
          max-height: 90vh;
          overflow-y: auto;
        }
        
        .deposit-close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.5rem;
          line-height: 1;
        }
        
        .deposit-close:hover {
          color: var(--text-primary);
        }
        
        .deposit-title {
          text-align: center;
          margin-bottom: 1.5rem;
          color: var(--text-primary);
          font-size: 1.25rem;
        }
        
        .deposit-info-box {
          background: rgba(255, 165, 2, 0.1);
          border: 1px solid rgba(255, 165, 2, 0.3);
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }
        
        .deposit-info-box h4 {
          color: var(--accent-yellow);
          margin: 0 0 0.5rem 0;
          font-size: 0.9rem;
        }
        
        .deposit-info-box ul {
          margin: 0;
          padding-left: 1.25rem;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }
        
        .deposit-info-box li {
          margin-bottom: 0.25rem;
        }
        
        .deposit-amounts {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }
        
        .amount-card {
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid transparent;
          border-radius: 12px;
          padding: 1rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }
        
        .amount-card:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        
        .amount-card.selected {
          border-color: var(--accent-green);
          background: rgba(0, 255, 136, 0.1);
        }
        
        .amount-card.popular::before {
          content: '⭐ Popular';
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--accent-yellow);
          color: #000;
          font-size: 0.65rem;
          padding: 2px 8px;
          border-radius: 10px;
          font-weight: 600;
        }
        
        .amount-value {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        
        .custom-amount {
          margin-bottom: 1.5rem;
        }
        
        .custom-amount label {
          display: block;
          color: var(--text-muted);
          font-size: 0.85rem;
          margin-bottom: 0.5rem;
        }
        
        .custom-amount-input {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .custom-amount-input span {
          color: var(--text-muted);
          font-size: 1.1rem;
        }
        
        .custom-amount-input input {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 0.75rem;
          color: var(--text-primary);
          font-size: 1.1rem;
        }
        
        .deposit-form {
          margin-bottom: 1rem;
        }
        
        .deposit-form .form-group {
          margin-bottom: 1rem;
        }
        
        .deposit-form label {
          display: block;
          color: var(--text-muted);
          font-size: 0.85rem;
          margin-bottom: 0.5rem;
        }
        
        .deposit-form input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 0.75rem;
          color: var(--text-primary);
          font-size: 1rem;
        }
        
        .deposit-submit {
          width: 100%;
          padding: 1rem;
          font-size: 1rem;
          font-weight: 600;
        }
        
        .deposit-secure {
          text-align: center;
          color: var(--text-muted);
          font-size: 0.8rem;
          margin-top: 1rem;
        }
        
        .deposit-user-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: rgba(0, 255, 136, 0.1);
          border: 1px solid rgba(0, 255, 136, 0.2);
          border-radius: 8px;
          padding: 0.75rem;
          margin-bottom: 1rem;
        }
        
        .deposit-user-info .user-info-icon {
          font-size: 1.5rem;
        }
        
        .deposit-user-info .user-info-text {
          flex: 1;
        }
        
        .deposit-user-info .user-info-text strong {
          display: block;
          color: var(--text-primary);
          font-size: 0.9rem;
        }
        
        .deposit-user-info .user-info-text span {
          color: var(--text-muted);
          font-size: 0.8rem;
        }
        
        .deposit-user-info .user-info-badge {
          color: var(--accent-green);
          font-size: 0.75rem;
        }
        
        .pix-result {
          text-align: center;
          padding: 1rem 0;
        }
        
        .pix-qrcode {
          width: 200px;
          height: 200px;
          margin: 0 auto 1rem;
          border-radius: 12px;
          background: #fff;
          padding: 0.5rem;
        }
        
        .pix-instruction {
          color: var(--text-secondary);
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }
        
        .pix-code {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        
        .pix-code input {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 0.75rem;
          color: var(--text-primary);
          font-size: 0.8rem;
        }
        
        .pix-timer {
          color: var(--accent-yellow);
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
        }
        
        .pix-waiting {
          color: var(--text-muted);
          font-size: 0.85rem;
        }
        
        .deposit-success {
          text-align: center;
          padding: 2rem 0;
        }
        
        .success-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        
        .deposit-success h3 {
          color: var(--accent-green);
          margin-bottom: 0.5rem;
        }
        
        .deposit-success p {
          color: var(--text-secondary);
          margin-bottom: 1rem;
        }
        
        .amount-added {
          font-size: 2rem;
          font-weight: 700;
          color: var(--accent-green);
          margin-bottom: 1.5rem;
        }
        
        .deposit-error {
          background: rgba(255, 107, 107, 0.1);
          border: 1px solid rgba(255, 107, 107, 0.3);
          border-radius: 8px;
          padding: 0.75rem;
          color: #ff6b6b;
          font-size: 0.9rem;
          margin-bottom: 1rem;
          text-align: center;
        }
      </style>
    `;
  }

  private getFormContent(): string {
    const state = gameStore.getState();
    const user = state.user;
    
    const userName = user?.fullname || '';
    const userCpf = user?.cpf ? this.formatCpf(user.cpf) : '';
    const hasUserData = userName && userCpf;

    return `
      <div class="deposit-info-box">
        <h4>ℹ️ Como funciona o saldo para apostas?</h4>
        <ul>
          <li>Deposite R$ para usar em partidas de aposta</li>
          <li>Ao vencer, você recebe 90% do valor total apostado</li>
          <li>10% é a taxa da plataforma</li>
          <li>Ganhos podem ser sacados a qualquer momento!</li>
        </ul>
      </div>

      <div class="deposit-amounts">
        ${this.suggestedAmounts.map(a => `
          <div class="amount-card ${a.value === this.amount ? 'selected' : ''} ${a.popular ? 'popular' : ''}" 
               data-amount="${a.value}">
            <div class="amount-value">${a.label}</div>
          </div>
        `).join('')}
        <div class="amount-card ${!this.suggestedAmounts.find(a => a.value === this.amount) ? 'selected' : ''}" 
             data-amount="custom">
          <div class="amount-value">Outro</div>
        </div>
      </div>

      <div class="custom-amount">
        <label>Valor do depósito (mínimo R$ 5,00)</label>
        <div class="custom-amount-input">
          <span>R$</span>
          <input type="number" id="deposit-amount" value="${this.amount}" min="5" max="1000" step="1">
        </div>
      </div>

      ${this.errorMessage ? `<div class="deposit-error">${this.errorMessage}</div>` : ''}

      ${hasUserData ? `
        <div class="deposit-user-info">
          <div class="user-info-icon">👤</div>
          <div class="user-info-text">
            <strong>${userName}</strong>
            <span>CPF: ${userCpf}</span>
          </div>
          <div class="user-info-badge">✓ Dados verificados</div>
        </div>
      ` : ''}

      <form class="deposit-form" id="deposit-form">
        ${!hasUserData ? `
          <div class="form-group">
            <label>Nome Completo</label>
            <input type="text" id="payer-name" placeholder="Seu nome completo" value="${userName}" required>
          </div>
          <div class="form-group">
            <label>CPF</label>
            <input type="text" id="payer-cpf" placeholder="000.000.000-00" maxlength="14" value="${userCpf}" required>
          </div>
        ` : `
          <input type="hidden" id="payer-name" value="${userName}">
          <input type="hidden" id="payer-cpf" value="${userCpf}">
        `}
        <button type="submit" class="btn btn-primary deposit-submit">
          💰 Depositar R$ ${this.amount.toFixed(2)}
        </button>
      </form>
    `;
  }

  private getProcessingContent(): string {
    return `
      <div style="text-align: center; padding: 3rem 1rem;">
        <div class="spinner" style="width: 60px; height: 60px; margin: 0 auto 1.5rem;"></div>
        <p style="color: var(--text-secondary);">Gerando QR Code PIX...</p>
      </div>
    `;
  }

  private getPixWaitingContent(): string {
    if (!this.pixData) return '';
    
    const expiresAt = new Date(this.pixData.expiresAt);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);

    return `
      <div class="pix-result">
        <img src="${this.pixData.qrcode}" alt="QR Code PIX" class="pix-qrcode">
        <p class="pix-instruction">Escaneie o QR Code ou copie o código abaixo:</p>
        <div class="pix-code">
          <input type="text" value="${this.pixData.copyPaste}" readonly id="pix-copy-input">
          <button class="btn btn-secondary btn-sm" id="copy-pix-btn">📋 Copiar</button>
        </div>
        <p class="pix-timer">⏱️ Expira em ${minutes}:${seconds.toString().padStart(2, '0')}</p>
        <p class="pix-waiting">Aguardando confirmação do pagamento...</p>
        <p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 1rem;">
          Valor: <strong style="color: var(--accent-green);">R$ ${this.amount.toFixed(2)}</strong>
        </p>
      </div>
    `;
  }

  private getSuccessContent(): string {
    return `
      <div class="deposit-success">
        <div class="success-icon">✅</div>
        <h3>Depósito Confirmado!</h3>
        <p>Seu saldo para apostas foi atualizado.</p>
        <div class="amount-added">+R$ ${this.amount.toFixed(2)}</div>
        <button class="btn btn-primary" id="success-close-btn">Continuar</button>
      </div>
    `;
  }

  private getErrorContent(): string {
    return `
      <div style="text-align: center; padding: 2rem 1rem;">
        <div style="font-size: 4rem; margin-bottom: 1rem;">❌</div>
        <h3 style="color: var(--accent-red); margin-bottom: 0.5rem;">Erro no Depósito</h3>
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">${this.errorMessage}</p>
        <button class="btn btn-secondary" id="try-again-btn">Tentar Novamente</button>
      </div>
    `;
  }

  private bindEvents() {
    // Fechar modal
    document.getElementById('deposit-close')?.addEventListener('click', () => this.close());
    document.getElementById('deposit-overlay')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'deposit-overlay') this.close();
    });

    // Seleção de valor
    document.querySelectorAll('.amount-card').forEach(el => {
      el.addEventListener('click', () => {
        const value = (el as HTMLElement).dataset.amount;
        if (value === 'custom') {
          const input = document.getElementById('deposit-amount') as HTMLInputElement;
          input?.focus();
        } else {
          this.amount = parseFloat(value || '20');
          this.render();
        }
      });
    });

    // Input de valor customizado
    document.getElementById('deposit-amount')?.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value) || 5;
      this.amount = Math.max(5, Math.min(1000, value));
      
      // Atualizar botão
      const btn = document.querySelector('.deposit-submit');
      if (btn) btn.textContent = `💰 Depositar R$ ${this.amount.toFixed(2)}`;
      
      // Atualizar seleção visual
      document.querySelectorAll('.amount-card').forEach(card => {
        const cardValue = (card as HTMLElement).dataset.amount;
        card.classList.toggle('selected', cardValue === this.amount.toString() || 
          (cardValue === 'custom' && !this.suggestedAmounts.find(a => a.value === this.amount)));
      });
    });

    // Máscara CPF
    document.getElementById('payer-cpf')?.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      input.value = this.formatCpf(input.value);
    });

    // Formulário
    document.getElementById('deposit-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleDeposit();
    });

    // Copiar PIX
    document.getElementById('copy-pix-btn')?.addEventListener('click', () => {
      const input = document.getElementById('pix-copy-input') as HTMLInputElement;
      navigator.clipboard.writeText(input.value);
      const btn = document.getElementById('copy-pix-btn');
      if (btn) btn.textContent = '✅ Copiado!';
    });

    // Botões de sucesso/erro
    document.getElementById('success-close-btn')?.addEventListener('click', () => {
      this.options?.onSuccess?.();
      this.close();
    });

    document.getElementById('try-again-btn')?.addEventListener('click', () => {
      this.step = 'form';
      this.errorMessage = '';
      this.render();
    });
  }

  private async handleDeposit() {
    const name = (document.getElementById('payer-name') as HTMLInputElement)?.value;
    const cpf = (document.getElementById('payer-cpf') as HTMLInputElement)?.value;
    const amountInput = document.getElementById('deposit-amount') as HTMLInputElement;
    this.amount = parseFloat(amountInput?.value) || this.amount;

    if (!name || !cpf) {
      this.errorMessage = 'Preencha todos os campos';
      this.render();
      return;
    }

    if (this.amount < 5) {
      this.errorMessage = 'Valor mínimo é R$ 5,00';
      this.render();
      return;
    }

    this.step = 'processing';
    this.render();

    try {
      const { data, error } = await api.request<any>('/payments/bet-deposit/pix/create', {
        method: 'POST',
        body: JSON.stringify({
          amount: this.amount,
          payerName: name,
          payerCpf: cpf.replace(/\D/g, ''),
        }),
      });

      if (error || !data?.success) {
        this.step = 'error';
        this.errorMessage = error || 'Erro ao gerar PIX';
        this.render();
        return;
      }

      this.paymentId = data.payment.id;
      this.pixData = {
        qrcode: data.payment.qrcode,
        copyPaste: data.payment.copyPaste,
        expiresAt: data.payment.expiresAt,
      };
      this.step = 'pix-waiting';
      this.render();
      this.startPolling();
    } catch (err: any) {
      this.step = 'error';
      this.errorMessage = err.message || 'Erro ao processar depósito';
      this.render();
    }
  }

  private startPolling() {
    if (this.pollingInterval) return;

    this.pollingInterval = window.setInterval(async () => {
      if (!this.paymentId) return;

      try {
        const { data } = await api.request<any>(`/payments/bet-deposit/status/${this.paymentId}`);
        
        if (data?.payment?.paid) {
          this.stopPolling();
          await this.refreshWallet();
          this.step = 'success';
          this.render();
        }
      } catch (e) {
        // Ignorar erros de polling
      }
    }, 3000);
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async refreshWallet() {
    try {
      const { data } = await api.getWallet();
      if (data) {
        gameStore.setWallet(data.balance || 0);
      }
    } catch (e) {
      // Ignorar
    }
  }

  private formatCpf(value: string): string {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  }
}

export const depositModal = new DepositModal();
