// =====================================================
// PÁGINAS DE SISTEMA - MANUTENÇÃO E ERROS
// Páginas padronizadas para manutenção, erros e falhas
// =====================================================

export interface MaintenanceConfig {
  enabled: boolean;
  message?: string;
  estimatedReturn?: string;
  contactWhatsapp?: string;
  contactInstagram?: string;
  contactEmail?: string;
}

export interface ErrorConfig {
  code?: string | number;
  title?: string;
  message?: string;
  showRetry?: boolean;
  showHome?: boolean;
  showContact?: boolean;
}

// Configurações de contato padrão
const DEFAULT_CONTACTS = {
  whatsapp: '5511999999999', // Substituir pelo número real
  instagram: 'sinucaonline',
  email: 'suporte@sinucaonline.com',
};

/**
 * Página de Manutenção
 * Mostrada quando usuário tenta acessar área restrita durante manutenção
 */
export function MaintenancePage(config: MaintenanceConfig = { enabled: true }): string {
  const message = config.message || 'Estamos realizando melhorias no sistema para você!';
  const estimatedReturn = config.estimatedReturn || 'Em breve';
  const whatsapp = config.contactWhatsapp || DEFAULT_CONTACTS.whatsapp;
  const instagram = config.contactInstagram || DEFAULT_CONTACTS.instagram;
  const email = config.contactEmail || DEFAULT_CONTACTS.email;

  return `
    <div class="system-page maintenance-page">
      <div class="system-page-container">
        <!-- Logo e Ícone -->
        <div class="system-page-header">
          <div class="system-page-icon maintenance-icon">
            <span class="icon-main">🔧</span>
            <span class="icon-pulse"></span>
          </div>
          <div class="system-page-logo">🎱 Sinuca Online</div>
        </div>

        <!-- Conteúdo Principal -->
        <div class="system-page-content">
          <h1 class="system-page-title">Sistema em Manutenção</h1>
          
          <div class="system-page-message">
            <p>${message}</p>
          </div>

          <div class="maintenance-info">
            <div class="maintenance-info-item">
              <span class="info-icon">🛡️</span>
              <span class="info-text">Melhorias de segurança</span>
            </div>
            <div class="maintenance-info-item">
              <span class="info-icon">⚡</span>
              <span class="info-text">Otimização de desempenho</span>
            </div>
            <div class="maintenance-info-item">
              <span class="info-icon">🚀</span>
              <span class="info-text">Novas funcionalidades</span>
            </div>
          </div>

          <div class="maintenance-return">
            <span class="return-label">Previsão de retorno:</span>
            <span class="return-time">${estimatedReturn}</span>
          </div>

          <!-- Botões de ação -->
          <div class="maintenance-actions" style="margin: 1.5rem 0; display: flex; flex-direction: column; gap: 0.75rem; align-items: center;">
            <button onclick="window.location.href='/'" class="btn btn-primary btn-lg" style="background: linear-gradient(135deg, #00ff88, #00cc66); border: none; padding: 1rem 2rem; font-size: 1rem; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
              <span>🏠</span>
              <span>Voltar para o Início</span>
            </button>
            <button id="check-maintenance-btn" class="btn btn-secondary btn-lg" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 0.75rem 1.5rem; font-size: 0.9rem; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; color: var(--text-primary);">
              <span id="check-icon">🔄</span>
              <span id="check-text">Verificar se voltou</span>
            </button>
            <p id="check-status" style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.25rem; text-align: center;">
              Clique para verificar se o sistema já voltou
            </p>
          </div>

          <div class="system-page-divider"></div>

          <p class="contact-intro">Ficou com alguma dúvida? Entre em contato conosco:</p>

          <div class="contact-buttons">
            <a href="https://wa.me/${whatsapp}" target="_blank" class="contact-btn whatsapp">
              <span class="contact-icon">📱</span>
              <span class="contact-label">WhatsApp</span>
            </a>
            <a href="https://instagram.com/${instagram}" target="_blank" class="contact-btn instagram">
              <span class="contact-icon">📸</span>
              <span class="contact-label">Instagram</span>
            </a>
            <a href="mailto:${email}" class="contact-btn email">
              <span class="contact-icon">✉️</span>
              <span class="contact-label">E-mail</span>
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div class="system-page-footer">
          <p>Agradecemos sua compreensão! 💚</p>
          <p class="footer-sub">Voltaremos com muitas melhorias para você.</p>
        </div>
      </div>

      <!-- Animação de fundo -->
      <div class="maintenance-bg-animation">
        <div class="floating-ball ball-1">🎱</div>
        <div class="floating-ball ball-2">🎱</div>
        <div class="floating-ball ball-3">🎱</div>
      </div>
    </div>
    
    <script>
      (function() {
        const checkBtn = document.getElementById('check-maintenance-btn');
        const checkIcon = document.getElementById('check-icon');
        const checkText = document.getElementById('check-text');
        const checkStatus = document.getElementById('check-status');
        
        if (checkBtn) {
          checkBtn.addEventListener('click', async function() {
            if (checkIcon) checkIcon.textContent = '⏳';
            if (checkText) checkText.textContent = 'Verificando...';
            if (checkStatus) checkStatus.textContent = 'Consultando servidor...';
            
            try {
              const response = await fetch('/api/settings/public/maintenance');
              const data = await response.json();
              
              if (!data.enabled) {
                if (checkIcon) checkIcon.textContent = '✅';
                if (checkText) checkText.textContent = 'Sistema disponível!';
                if (checkStatus) checkStatus.innerHTML = '<span style="color: #00ff88; font-weight: 600;">🎉 O sistema voltou! Redirecionando...</span>';
                
                setTimeout(function() {
                  window.location.href = '/';
                }, 1500);
              } else {
                if (checkIcon) checkIcon.textContent = '🔄';
                if (checkText) checkText.textContent = 'Verificar se voltou';
                if (checkStatus) checkStatus.textContent = 'Ainda em manutenção. Tente novamente em alguns minutos.';
              }
            } catch (err) {
              if (checkIcon) checkIcon.textContent = '⚠️';
              if (checkText) checkText.textContent = 'Erro na verificação';
              if (checkStatus) checkStatus.textContent = 'Não foi possível verificar. Tente novamente.';
            }
          });
        }
      })();
    </script>
  `;
}

/**
 * Página de Erro Genérico
 */
export function ErrorPage(config: ErrorConfig = {}): string {
  const code = config.code || '500';
  const title = config.title || 'Ops! Algo deu errado';
  const message = config.message || 'Ocorreu um erro inesperado. Nossa equipe já foi notificada e está trabalhando para resolver.';
  const showRetry = config.showRetry !== false;
  const showHome = config.showHome !== false;
  const showContact = config.showContact !== false;

  return `
    <div class="system-page error-page">
      <div class="system-page-container">
        <!-- Logo e Ícone -->
        <div class="system-page-header">
          <div class="system-page-icon error-icon">
            <span class="icon-main">⚠️</span>
          </div>
          <div class="system-page-logo">🎱 Sinuca Online</div>
        </div>

        <!-- Conteúdo Principal -->
        <div class="system-page-content">
          <div class="error-code">${code}</div>
          <h1 class="system-page-title">${title}</h1>
          
          <div class="system-page-message">
            <p>${message}</p>
          </div>

          <div class="error-actions">
            ${showRetry ? `
              <button class="btn btn-primary btn-lg" onclick="window.location.reload()">
                🔄 Tentar Novamente
              </button>
            ` : ''}
            ${showHome ? `
              <button class="btn btn-secondary btn-lg" onclick="window.location.href='/'">
                🏠 Voltar ao Início
              </button>
            ` : ''}
          </div>

          ${showContact ? `
            <div class="system-page-divider"></div>
            <p class="contact-intro">Problema persiste? Fale conosco:</p>
            <div class="contact-buttons compact">
              <a href="https://wa.me/${DEFAULT_CONTACTS.whatsapp}" target="_blank" class="contact-btn whatsapp">
                <span class="contact-icon">📱</span>
                <span class="contact-label">WhatsApp</span>
              </a>
              <a href="mailto:${DEFAULT_CONTACTS.email}" class="contact-btn email">
                <span class="contact-icon">✉️</span>
                <span class="contact-label">E-mail</span>
              </a>
            </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div class="system-page-footer">
          <p>Pedimos desculpas pelo inconveniente.</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Página de Erro 404 - Não Encontrado
 */
export function NotFoundPage(): string {
  return ErrorPage({
    code: '404',
    title: 'Página não encontrada',
    message: 'A página que você está procurando não existe ou foi movida.',
    showRetry: false,
    showHome: true,
    showContact: false,
  });
}

/**
 * Página de Erro de Conexão
 */
export function ConnectionErrorPage(): string {
  return ErrorPage({
    code: '🔌',
    title: 'Erro de Conexão',
    message: 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.',
    showRetry: true,
    showHome: true,
    showContact: true,
  });
}

/**
 * Página de Erro de Carregamento
 */
export function LoadingErrorPage(details?: string): string {
  return ErrorPage({
    code: '⏳',
    title: 'Erro ao Carregar',
    message: details || 'Não foi possível carregar os dados. Por favor, tente novamente em alguns instantes.',
    showRetry: true,
    showHome: true,
    showContact: true,
  });
}

/**
 * Página de Sessão Expirada
 */
export function SessionExpiredPage(): string {
  return `
    <div class="system-page session-page">
      <div class="system-page-container">
        <div class="system-page-header">
          <div class="system-page-icon session-icon">
            <span class="icon-main">🔐</span>
          </div>
          <div class="system-page-logo">🎱 Sinuca Online</div>
        </div>

        <div class="system-page-content">
          <h1 class="system-page-title">Sessão Expirada</h1>
          
          <div class="system-page-message">
            <p>Sua sessão expirou por segurança. Por favor, faça login novamente para continuar.</p>
          </div>

          <div class="error-actions">
            <button class="btn btn-primary btn-lg" onclick="window.location.href='/login'">
              🔑 Fazer Login
            </button>
            <button class="btn btn-secondary btn-lg" onclick="window.location.href='/'">
              🏠 Página Inicial
            </button>
          </div>
        </div>

        <div class="system-page-footer">
          <p>Sua segurança é nossa prioridade! 🛡️</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Componente de Loading com fallback de erro
 */
export function LoadingWithError(isLoading: boolean, hasError: boolean, errorMessage?: string): string {
  if (hasError) {
    return LoadingErrorPage(errorMessage);
  }

  if (isLoading) {
    return `
      <div class="system-page loading-page">
        <div class="system-page-container">
          <div class="loading-spinner-large"></div>
          <p class="loading-text">Carregando...</p>
        </div>
      </div>
    `;
  }

  return '';
}

/**
 * Toast de erro padronizado
 */
export function showErrorToast(message: string, duration: number = 5000): void {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast error';
  toast.innerHTML = `
    <span class="toast-icon">❌</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), duration);
}

/**
 * Toast de aviso padronizado
 */
export function showWarningToast(message: string, duration: number = 5000): void {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast warning';
  toast.innerHTML = `
    <span class="toast-icon">⚠️</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), duration);
}

/**
 * Modal de erro com ações
 */
export function showErrorModal(title: string, message: string, actions?: { label: string; onClick: () => void }[]): void {
  // Remover modal existente
  document.getElementById('error-modal-container')?.remove();

  const defaultActions = actions || [
    { label: '🔄 Tentar Novamente', onClick: () => window.location.reload() },
    { label: '🏠 Voltar ao Início', onClick: () => window.location.href = '/' },
  ];

  const container = document.createElement('div');
  container.id = 'error-modal-container';
  container.innerHTML = `
    <div class="modal-overlay active" id="error-modal-overlay">
      <div class="modal-box error-modal">
        <div class="modal-header error-header">
          <span class="error-modal-icon">⚠️</span>
          <h3 class="modal-title">${title}</h3>
        </div>
        <div class="modal-body">
          <p class="error-modal-message">${message}</p>
        </div>
        <div class="modal-footer error-footer">
          ${defaultActions.map((action, i) => `
            <button class="btn ${i === 0 ? 'btn-primary' : 'btn-secondary'}" id="error-action-${i}">
              ${action.label}
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  // Bind actions
  defaultActions.forEach((action, i) => {
    document.getElementById(`error-action-${i}`)?.addEventListener('click', () => {
      container.remove();
      action.onClick();
    });
  });
}

// =====================================================
// PÁGINA DE BANIMENTO
// Mostrada quando usuário banido tenta acessar o sistema
// =====================================================

export interface BannedConfig {
  username?: string;
  reason?: string;
  bannedAt?: string;
  contactWhatsapp?: string;
  contactEmail?: string;
}

/**
 * Página de Conta Banida
 * Mostrada quando usuário banido tenta acessar qualquer área do sistema
 */
export function BannedPage(config: BannedConfig = {}): string {
  const username = config.username || 'Usuário';
  const reason = config.reason || 'Violação dos termos de uso da plataforma.';
  const bannedAt = config.bannedAt ? new Date(config.bannedAt).toLocaleDateString('pt-BR') : null;
  const whatsapp = config.contactWhatsapp || DEFAULT_CONTACTS.whatsapp;
  const email = config.contactEmail || DEFAULT_CONTACTS.email;

  return `
    <div class="system-page banned-page">
      <div class="system-page-container">
        <!-- Logo e Ícone -->
        <div class="system-page-header">
          <div class="system-page-icon banned-icon">
            <span class="icon-main">🚫</span>
          </div>
          <div class="system-page-logo">🎱 Sinuca Online</div>
        </div>

        <!-- Conteúdo Principal -->
        <div class="system-page-content">
          <h1 class="system-page-title" style="color: #ff6b6b;">Conta Banida</h1>
          
          <div class="system-page-message" style="background: rgba(255,107,107,0.1); border: 1px solid rgba(255,107,107,0.3); border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0;">
            <p style="margin-bottom: 0.5rem;">Olá, <strong>${username}</strong>.</p>
            <p style="margin-bottom: 1rem;">Sua conta foi <strong style="color: #ff6b6b;">permanentemente banida</strong> da plataforma.</p>
            
            <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 1rem; margin-top: 1rem;">
              <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem;">📋 Motivo do banimento:</p>
              <p style="font-weight: 600; color: var(--text-primary);">${reason}</p>
              ${bannedAt ? `<p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">📅 Data: ${bannedAt}</p>` : ''}
            </div>
          </div>

          <div class="banned-info" style="margin: 1.5rem 0;">
            <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 0.5rem;">
              <span>❌</span>
              <span style="color: var(--text-muted);">Você não pode mais acessar sua conta</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 0.5rem;">
              <span>❌</span>
              <span style="color: var(--text-muted);">Você não pode criar uma nova conta</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
              <span>❌</span>
              <span style="color: var(--text-muted);">Saldos e créditos foram bloqueados</span>
            </div>
          </div>

          <div class="system-page-divider"></div>

          <div style="text-align: center; margin: 1.5rem 0;">
            <p style="color: var(--text-muted); margin-bottom: 1rem;">
              Se você acredita que houve um engano ou deseja contestar esta decisão, entre em contato com nossa equipe de suporte:
            </p>
          </div>

          <div class="contact-buttons" style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
            <a href="https://wa.me/${whatsapp}?text=Olá! Minha conta (${username}) foi banida e gostaria de entender o motivo ou contestar a decisão." target="_blank" class="contact-btn whatsapp" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem; background: #25D366; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">
              <span>📱</span>
              <span>WhatsApp</span>
            </a>
            <a href="mailto:${email}?subject=Contestação de Banimento - ${username}&body=Olá! Minha conta (${username}) foi banida e gostaria de entender o motivo ou contestar a decisão." class="contact-btn email" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem; background: rgba(255,255,255,0.1); color: var(--text-primary); border-radius: 8px; text-decoration: none; font-weight: 600; border: 1px solid rgba(255,255,255,0.2);">
              <span>✉️</span>
              <span>E-mail</span>
            </a>
          </div>

          <div style="margin-top: 2rem; text-align: center;">
            <button onclick="localStorage.clear(); window.location.href='/'" class="btn btn-secondary" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; color: var(--text-muted);">
              🚪 Sair da Conta
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="system-page-footer" style="margin-top: 2rem;">
          <p style="color: var(--text-muted); font-size: 0.85rem;">
            Leia nossos <a href="/terms" style="color: var(--accent-blue);">Termos de Uso</a> e 
            <a href="/rules" style="color: var(--accent-blue);">Regras da Comunidade</a>
          </p>
        </div>
      </div>

      <!-- Animação de fundo (mais sutil) -->
      <div class="maintenance-bg-animation" style="opacity: 0.3;">
        <div class="floating-ball ball-1">🎱</div>
        <div class="floating-ball ball-2">🎱</div>
      </div>
    </div>
  `;
}

/**
 * Página de Conta Suspensa Temporariamente
 * Mostrada quando usuário suspenso tenta acessar o sistema
 */
export function SuspendedPage(config: { username?: string; reason?: string; suspendedUntil?: string; contactWhatsapp?: string; contactEmail?: string } = {}): string {
  const username = config.username || 'Usuário';
  const reason = config.reason || 'Violação temporária dos termos de uso.';
  const suspendedUntil = config.suspendedUntil ? new Date(config.suspendedUntil) : null;
  const whatsapp = config.contactWhatsapp || DEFAULT_CONTACTS.whatsapp;
  const email = config.contactEmail || DEFAULT_CONTACTS.email;

  const formatDate = (date: Date) => date.toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <div class="system-page suspended-page">
      <div class="system-page-container">
        <!-- Logo e Ícone -->
        <div class="system-page-header">
          <div class="system-page-icon suspended-icon">
            <span class="icon-main">⏸️</span>
          </div>
          <div class="system-page-logo">🎱 Sinuca Online</div>
        </div>

        <!-- Conteúdo Principal -->
        <div class="system-page-content">
          <h1 class="system-page-title" style="color: #ffa500;">Conta Suspensa</h1>
          
          <div class="system-page-message" style="background: rgba(255,165,0,0.1); border: 1px solid rgba(255,165,0,0.3); border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0;">
            <p style="margin-bottom: 0.5rem;">Olá, <strong>${username}</strong>.</p>
            <p style="margin-bottom: 1rem;">Sua conta foi <strong style="color: #ffa500;">temporariamente suspensa</strong>.</p>
            
            <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 1rem; margin-top: 1rem;">
              <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem;">📋 Motivo da suspensão:</p>
              <p style="font-weight: 600; color: var(--text-primary);">${reason}</p>
              ${suspendedUntil ? `
                <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(0,255,136,0.1); border-radius: 8px;">
                  <p style="font-size: 0.9rem; color: var(--accent-green);">
                    ⏰ Sua conta será liberada em: <strong>${formatDate(suspendedUntil)}</strong>
                  </p>
                </div>
              ` : ''}
            </div>
          </div>

          <div style="text-align: center; margin: 1.5rem 0; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
            <p style="color: var(--text-muted);">
              ⚠️ Durante a suspensão, você não pode jogar partidas ou acessar funcionalidades da plataforma.
            </p>
          </div>

          <div class="system-page-divider"></div>

          <div style="text-align: center; margin: 1.5rem 0;">
            <p style="color: var(--text-muted); margin-bottom: 1rem;">
              Se você acredita que houve um engano, entre em contato:
            </p>
          </div>

          <div class="contact-buttons" style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
            <a href="https://wa.me/${whatsapp}?text=Olá! Minha conta (${username}) foi suspensa e gostaria de entender o motivo." target="_blank" class="contact-btn whatsapp" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem; background: #25D366; color: white; border-radius: 8px; text-decoration: none; font-weight: 600;">
              <span>📱</span>
              <span>WhatsApp</span>
            </a>
            <a href="mailto:${email}?subject=Suspensão de Conta - ${username}" class="contact-btn email" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem; background: rgba(255,255,255,0.1); color: var(--text-primary); border-radius: 8px; text-decoration: none; font-weight: 600; border: 1px solid rgba(255,255,255,0.2);">
              <span>✉️</span>
              <span>E-mail</span>
            </a>
          </div>

          <div style="margin-top: 2rem; text-align: center;">
            <button onclick="localStorage.clear(); window.location.href='/'" class="btn btn-secondary" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; color: var(--text-muted);">
              🚪 Sair da Conta
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="system-page-footer" style="margin-top: 2rem;">
          <p style="color: var(--text-muted); font-size: 0.85rem;">
            Leia nossos <a href="/terms" style="color: var(--accent-blue);">Termos de Uso</a> para evitar futuras suspensões.
          </p>
        </div>
      </div>
    </div>
  `;
}
