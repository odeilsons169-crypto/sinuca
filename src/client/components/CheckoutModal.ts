// =====================================================
// CHECKOUT MODAL - Componente de Pagamento
// =====================================================

import { api } from '../services/api';
import { gameStore } from '../store/gameStore';

interface CheckoutOptions {
  amount: number;
  credits: number;
  onSuccess?: () => void;
  onClose?: () => void;
}

type PaymentMethod = 'pix' | 'card' | 'wallet';
type CheckoutStep = 'form' | 'processing' | 'pix-waiting' | 'success' | 'error';

class CheckoutModal {
  private options: CheckoutOptions | null = null;
  private method: PaymentMethod = 'pix';
  private step: CheckoutStep = 'form';
  private paymentId: string | null = null;
  private pixData: { qrcode: string; copyPaste: string; expiresAt: string } | null = null;
  private errorMessage: string = '';
  private pollingInterval: number | null = null;

  // Pacotes de créditos
  private packages = [
    { id: 1, credits: 4, price: 2.0, popular: false },
    { id: 2, credits: 10, price: 5.0, popular: false },
    { id: 3, credits: 20, price: 10.0, popular: true },
    { id: 4, credits: 50, price: 25.0, popular: false },
    { id: 5, credits: 100, price: 50.0, popular: false },
  ];

  open(options: CheckoutOptions) {
    this.options = options;
    this.method = 'pix';
    this.step = 'form';
    this.paymentId = null;
    this.pixData = null;
    this.errorMessage = '';
    this.render();
  }

  close() {
    this.stopPolling();
    const overlay = document.getElementById('checkout-overlay');
    if (overlay) overlay.remove();
    this.options?.onClose?.();
  }

  private render() {
    // Remover modal existente
    document.getElementById('checkout-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'checkout-overlay';
    overlay.className = 'checkout-overlay';
    overlay.innerHTML = this.getContent();
    document.body.appendChild(overlay);

    this.bindEvents();
  }

  private getContent(): string {
    return `
      <div class="checkout-container">
        <button class="checkout-close" id="checkout-close">&times;</button>
        <h2 class="checkout-title">💳 Comprar Créditos</h2>
        
        ${this.step === 'form' ? this.getFormContent() : ''}
        ${this.step === 'processing' ? this.getProcessingContent() : ''}
        ${this.step === 'pix-waiting' ? this.getPixWaitingContent() : ''}
        ${this.step === 'success' ? this.getSuccessContent() : ''}
        ${this.step === 'error' ? this.getErrorContent() : ''}
        
        <div class="checkout-secure">🔒 Pagamento 100% seguro</div>
      </div>
    `;
  }

  private getFormContent(): string {
    const selectedPkg = this.packages.find(p => p.price === this.options?.amount) || this.packages[2];
    const state = gameStore.getState();
    const user = state.user;
    
    // Dados do usuário logado
    const userName = user?.fullname || '';
    const userCpf = user?.cpf ? this.formatCpf(user.cpf) : '';
    const userEmail = user?.email || '';
    const hasUserData = userName && userCpf;
    
    return `
      <!-- Pacotes -->
      <div class="checkout-packages">
        ${this.packages.map(pkg => `
          <div class="package-card ${pkg.price === this.options?.amount ? 'selected' : ''} ${pkg.popular ? 'popular' : ''}" 
               data-package-id="${pkg.id}" data-price="${pkg.price}" data-credits="${pkg.credits}">
            ${pkg.popular ? '<span class="popular-badge">Popular</span>' : ''}
            <div class="package-credits">${pkg.credits}</div>
            <div class="package-label">créditos</div>
            <div class="package-price">R$ ${pkg.price.toFixed(2)}</div>
          </div>
        `).join('')}
      </div>

      <!-- Tabs de método -->
      <div class="checkout-tabs">
        <button class="tab-btn ${this.method === 'wallet' ? 'active' : ''}" data-method="wallet">
          <span class="tab-icon">💰</span> Saldo
        </button>
        <button class="tab-btn ${this.method === 'pix' ? 'active' : ''}" data-method="pix">
          <span class="tab-icon">📱</span> PIX
        </button>
        <button class="tab-btn ${this.method === 'card' ? 'active' : ''}" data-method="card">
          <span class="tab-icon">💳</span> Cartão
        </button>
      </div>

      ${this.errorMessage ? `<div class="checkout-error">${this.errorMessage}</div>` : ''}

      <!-- Formulário Saldo da Carteira -->
      ${this.method === 'wallet' ? this.getWalletFormContent() : ''}

      ${hasUserData ? `
        <div class="checkout-user-info">
          <div class="user-info-icon">👤</div>
          <div class="user-info-text">
            <strong>${userName}</strong>
            <span>CPF: ${userCpf}</span>
          </div>
          <div class="user-info-badge">✓ Dados verificados</div>
        </div>
      ` : ''}

      <!-- Formulário PIX -->
      ${this.method === 'pix' ? `
        <form class="checkout-form" id="pix-form">
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
          <button type="submit" class="btn btn-primary checkout-submit">
            Gerar QR Code PIX - R$ ${(this.options?.amount || 10).toFixed(2)}
          </button>
        </form>
      ` : ''}

      <!-- Formulário Cartão -->
      ${this.method === 'card' ? `
        <form class="checkout-form" id="card-form">
          ${!hasUserData ? `
            <div class="form-group">
              <label>Nome no Cartão</label>
              <input type="text" id="card-name" placeholder="Como está no cartão" value="${userName}" required>
            </div>
            <div class="form-group">
              <label>CPF do Titular</label>
              <input type="text" id="card-cpf" placeholder="000.000.000-00" maxlength="14" value="${userCpf}" required>
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="card-email" placeholder="seu@email.com" value="${userEmail}" required>
            </div>
          ` : `
            <input type="hidden" id="card-name" value="${userName}">
            <input type="hidden" id="card-cpf" value="${userCpf}">
            <input type="hidden" id="card-email" value="${userEmail}">
          `}
          <div class="form-group">
            <label>Número do Cartão</label>
            <input type="text" id="card-number" placeholder="0000 0000 0000 0000" maxlength="19" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Validade</label>
              <input type="text" id="card-expiry" placeholder="MM/AA" maxlength="5" required>
            </div>
            <div class="form-group">
              <label>CVV</label>
              <input type="text" id="card-cvv" placeholder="123" maxlength="4" required>
            </div>
          </div>
          <button type="submit" class="btn btn-primary checkout-submit">
            Pagar R$ ${(this.options?.amount || 10).toFixed(2)}
          </button>
        </form>
      ` : ''}
    `;
  }

  private getProcessingContent(): string {
    return `
      <div style="text-align: center; padding: 3rem 1rem;">
        <div class="spinner" style="width: 60px; height: 60px; margin: 0 auto 1.5rem;"></div>
        <p style="color: var(--text-secondary);">Processando pagamento...</p>
      </div>
    `;
  }

  private getWalletFormContent(): string {
    const state = gameStore.getState();
    const walletBalance = state.wallet || 0;
    const requiredAmount = this.options?.amount || 0;
    
    // Nota: O saldo disponível para compra de créditos é deposit + winnings (NÃO inclui bônus)
    // O backend vai validar isso, mas mostramos o saldo total aqui
    // Se o usuário tiver apenas bônus, a compra vai falhar com mensagem explicativa
    const hasEnoughBalance = walletBalance >= requiredAmount;

    return `
      <div class="wallet-payment-section" style="padding: 1.5rem; background: rgba(255,255,255,0.05); border-radius: 12px; margin: 1rem 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.25rem;">Seu saldo disponível:</p>
            <p style="font-size: 1.5rem; font-weight: 700; color: ${hasEnoughBalance ? 'var(--accent-green)' : 'var(--accent-red)'};">
              R$ ${walletBalance.toFixed(2)}
            </p>
          </div>
          <div style="text-align: right;">
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.25rem;">Valor necessário:</p>
            <p style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">
              R$ ${requiredAmount.toFixed(2)}
            </p>
          </div>
        </div>

        <div style="background: rgba(255,165,2,0.1); border: 1px solid rgba(255,165,2,0.3); border-radius: 8px; padding: 0.75rem; margin-bottom: 1rem;">
          <p style="color: var(--accent-yellow); font-size: 0.8rem; margin: 0;">
            ⚠️ <strong>Nota:</strong> Bônus não pode ser usado para comprar créditos. Apenas depósitos e ganhos de partidas.
          </p>
        </div>

        ${hasEnoughBalance ? `
          <div style="background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.3); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
            <p style="color: var(--accent-green); font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>✅</span>
              <span>Você tem saldo suficiente para esta compra!</span>
            </p>
          </div>
          <div style="text-align: center;">
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">
              Ao confirmar, <strong>R$ ${requiredAmount.toFixed(2)}</strong> será debitado do seu saldo e você receberá <strong>${this.options?.credits || 0} créditos</strong>.
            </p>
            <button class="btn btn-primary checkout-submit" id="wallet-pay-btn" style="width: 100%; padding: 1rem; font-size: 1rem;">
              💰 Comprar com Saldo - R$ ${requiredAmount.toFixed(2)}
            </button>
          </div>
        ` : `
          <div style="background: rgba(255,107,107,0.1); border: 1px solid rgba(255,107,107,0.3); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
            <p style="color: var(--accent-red); font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>❌</span>
              <span>Saldo insuficiente. Faltam R$ ${(requiredAmount - walletBalance).toFixed(2)}</span>
            </p>
          </div>
          <div style="text-align: center;">
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">
              Deposite mais saldo ou escolha outro método de pagamento.
            </p>
            <button class="btn btn-secondary" id="switch-to-pix-btn" style="width: 100%; padding: 0.75rem;">
              📱 Pagar com PIX
            </button>
          </div>
        `}
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
      </div>
    `;
  }

  private getSuccessContent(): string {
    return `
      <div class="checkout-success">
        <div class="success-icon">✅</div>
        <h3>Pagamento Aprovado!</h3>
        <p>Seus créditos foram adicionados à sua conta.</p>
        <p class="credits-added">+${this.options?.credits || 0} créditos</p>
        <button class="btn btn-primary" id="success-close-btn">Continuar</button>
      </div>
    `;
  }

  private getErrorContent(): string {
    return `
      <div style="text-align: center; padding: 2rem 1rem;">
        <div style="font-size: 4rem; margin-bottom: 1rem;">❌</div>
        <h3 style="color: var(--accent-red); margin-bottom: 0.5rem;">Erro no Pagamento</h3>
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">${this.errorMessage}</p>
        <button class="btn btn-secondary" id="try-again-btn">Tentar Novamente</button>
      </div>
    `;
  }

  private bindEvents() {
    // Fechar modal
    document.getElementById('checkout-close')?.addEventListener('click', () => this.close());
    document.getElementById('checkout-overlay')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'checkout-overlay') this.close();
    });

    // Seleção de pacote
    document.querySelectorAll('.package-card').forEach(el => {
      el.addEventListener('click', () => {
        const price = parseFloat((el as HTMLElement).dataset.price || '10');
        const credits = parseInt((el as HTMLElement).dataset.credits || '20');
        this.options = { ...this.options!, amount: price, credits };
        this.render();
      });
    });

    // Tabs de método
    document.querySelectorAll('.tab-btn').forEach(el => {
      el.addEventListener('click', () => {
        this.method = (el as HTMLElement).dataset.method as PaymentMethod;
        this.render();
      });
    });

    // Formulário PIX
    document.getElementById('pix-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handlePixPayment();
    });

    // Formulário Cartão
    document.getElementById('card-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleCardPayment();
    });

    // Pagamento com Saldo da Carteira
    document.getElementById('wallet-pay-btn')?.addEventListener('click', () => {
      this.handleWalletPayment();
    });

    // Botão para trocar para PIX quando saldo insuficiente
    document.getElementById('switch-to-pix-btn')?.addEventListener('click', () => {
      this.method = 'pix';
      this.render();
    });

    // Máscara CPF
    document.querySelectorAll('#payer-cpf, #card-cpf').forEach(el => {
      el.addEventListener('input', (e) => {
        const input = e.target as HTMLInputElement;
        input.value = this.formatCpf(input.value);
      });
    });

    // Máscara cartão
    document.getElementById('card-number')?.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      input.value = this.formatCardNumber(input.value);
    });

    // Máscara validade
    document.getElementById('card-expiry')?.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      input.value = this.formatExpiry(input.value);
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

  private async handlePixPayment() {
    const name = (document.getElementById('payer-name') as HTMLInputElement)?.value;
    const cpf = (document.getElementById('payer-cpf') as HTMLInputElement)?.value;

    if (!name || !cpf) {
      this.errorMessage = 'Preencha todos os campos';
      this.render();
      return;
    }

    this.step = 'processing';
    this.render();

    const { data, error } = await api.createPixPayment(
      this.options!.amount,
      this.options!.credits,
      name,
      cpf.replace(/\D/g, '')
    );

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
  }

  private async handleCardPayment() {
    const name = (document.getElementById('card-name') as HTMLInputElement)?.value;
    const cpf = (document.getElementById('card-cpf') as HTMLInputElement)?.value;
    const email = (document.getElementById('card-email') as HTMLInputElement)?.value;
    const cardNumber = (document.getElementById('card-number') as HTMLInputElement)?.value;
    const expiry = (document.getElementById('card-expiry') as HTMLInputElement)?.value;
    const cvv = (document.getElementById('card-cvv') as HTMLInputElement)?.value;

    if (!name || !cpf || !email || !cardNumber || !expiry || !cvv) {
      this.errorMessage = 'Preencha todos os campos';
      this.render();
      return;
    }

    this.step = 'processing';
    this.render();

    // Em produção, usar tokenização do gateway
    // Por enquanto, simular token
    const paymentToken = `MOCK_TOKEN_${Date.now()}`;

    const { data, error } = await api.createCardPayment({
      amount: this.options!.amount,
      credits: this.options!.credits,
      payerName: name,
      payerCpf: cpf.replace(/\D/g, ''),
      payerEmail: email,
      paymentToken,
    });

    if (error || !data?.success) {
      this.step = 'error';
      this.errorMessage = error || 'Pagamento recusado';
      this.render();
      return;
    }

    // Atualizar créditos no store
    await this.refreshCredits();
    
    this.step = 'success';
    this.render();
  }

  private async handleWalletPayment() {
    const state = gameStore.getState();
    const walletBalance = state.wallet || 0;
    const requiredAmount = this.options?.amount || 0;

    if (walletBalance < requiredAmount) {
      this.errorMessage = 'Saldo insuficiente';
      this.render();
      return;
    }

    this.step = 'processing';
    this.render();

    try {
      // Chamar API para comprar créditos com saldo da carteira
      const { data, error } = await api.purchaseCreditsWithWallet(this.options!.credits);

      if (error || !data?.success) {
        this.step = 'error';
        this.errorMessage = error || data?.error || 'Erro ao processar compra';
        this.render();
        return;
      }

      // Atualizar créditos e saldo no store
      await this.refreshCredits();
      
      this.step = 'success';
      this.render();
    } catch (err: any) {
      this.step = 'error';
      this.errorMessage = err.message || 'Erro ao processar compra';
      this.render();
    }
  }

  private startPolling() {
    if (this.pollingInterval) return;

    this.pollingInterval = window.setInterval(async () => {
      if (!this.paymentId) return;

      const { data } = await api.checkPaymentStatus(this.paymentId);
      
      if (data?.payment?.paid) {
        this.stopPolling();
        await this.refreshCredits();
        this.step = 'success';
        this.render();
      }
    }, 3000);
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async refreshCredits() {
    const { data } = await api.getCredits();
    if (data) {
      gameStore.setCredits(data.amount || 0, data.is_unlimited || false);
    }
    const { data: walletData } = await api.getWallet();
    if (walletData) {
      gameStore.setWallet(walletData.balance || 0);
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

  private formatCardNumber(value: string): string {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{4})(\d)/, '$1 $2')
      .replace(/(\d{4})(\d)/, '$1 $2')
      .replace(/(\d{4})(\d)/, '$1 $2')
      .replace(/(\d{4})\d+?$/, '$1');
  }

  private formatExpiry(value: string): string {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '$1/$2')
      .replace(/(\/\d{2})\d+?$/, '$1');
  }
}

export const checkoutModal = new CheckoutModal();
