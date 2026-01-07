import { gameStore } from '../store/gameStore.js';

/**
 * Renderiza a navegação bottom para mobile
 * Esta função retorna o HTML do menu e deve ser inserida no final de cada página
 */
export function renderMobileBottomNav(currentPage: string = 'lobby'): string {
    const state = gameStore.getState();
    const isAdmin = state.user && ['admin', 'super_admin', 'manager', 'employee'].includes(state.user.role || '');

    const navItems = [
        { icon: '🏠', label: 'Início', page: 'lobby' },
        { icon: '🎮', label: 'Jogar', page: 'games' },
        { icon: '🏆', label: 'Ranking', page: 'ranking' },
        { icon: '💰', label: 'Carteira', page: 'wallet' },
        { icon: '👤', label: 'Perfil', page: 'profile' },
    ];

    return `
    <!-- Navegação Bottom Mobile -->
    <nav class="mobile-bottom-nav mobile-only" id="mobile-bottom-nav">
      ${navItems.map(item => `
        <button class="mobile-nav-item ${currentPage === item.page ? 'active' : ''}" data-page="${item.page}">
          <span class="mobile-nav-item-icon">${item.icon}</span>
          <span class="mobile-nav-item-label">${item.label}</span>
        </button>
      `).join('')}
      ${isAdmin ? `
        <button class="mobile-nav-item ${currentPage === 'admin' ? 'active' : ''}" data-page="admin">
          <span class="mobile-nav-item-icon">⚙️</span>
          <span class="mobile-nav-item-label">Admin</span>
        </button>
      ` : ''}
    </nav>
  `;
}

/**
 * Renderiza o header mobile
 */
export function renderMobileHeader(title?: string): string {
    const state = gameStore.getState();
    const balance = state.balance ?? 0;
    const credits = state.credits ?? 0;
    const isUnlimited = state.isUnlimited ?? false;

    return `
    <!-- Header Mobile -->
    <header class="mobile-header mobile-only">
      <div class="header-content">
        <div class="header-logo">
          <span class="header-logo-icon">🎱</span>
          ${title ? `<span class="header-title-text">${title}</span>` : '<span class="header-logo-text">Sinuca</span>'}
        </div>
        
        <div class="header-stats">
          <div class="header-stat">
            <span class="stat-icon">🪙</span>
            <span class="stat-value">${isUnlimited ? '∞' : credits}</span>
          </div>
          <div class="header-stat">
            <span class="stat-icon">💰</span>
            <span class="stat-value">R$ ${balance.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </header>
  `;
}

/**
 * Inicializa os eventos de navegação mobile
 * Deve ser chamado após renderizar a página
 */
export function initMobileNavEvents(app: any): void {
    // Navegação bottom
    document.querySelectorAll('.mobile-nav-item[data-page]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = (item as HTMLElement).dataset.page;
            if (page && app) {
                // Feedback tátil
                if (navigator.vibrate) {
                    navigator.vibrate(10);
                }
                app.navigate(page);
            }
        });
    });

    // Toggle do menu lateral (admin)
    const menuToggle = document.querySelector('.admin-menu-toggle');
    const sidebar = document.querySelector('.admin-sidebar');
    const overlay = document.querySelector('.admin-sidebar-overlay');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay?.classList.toggle('show');
        });

        overlay?.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        });
    }
}

/**
 * Detecta se está em modo mobile
 */
export function isMobile(): boolean {
    return window.innerWidth <= 768 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Detecta se está em modo PWA (standalone)
 */
export function isPWA(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
}

/**
 * Detecta orientação
 */
export function isLandscape(): boolean {
    return window.innerWidth > window.innerHeight;
}

/**
 * Vibrar dispositivo (feedback tátil)
 */
export function vibrate(pattern: number | number[] = 50): void {
    if (navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}

/**
 * Forçar modo paisagem (para o jogo)
 */
export function requestLandscape(): void {
    if (screen.orientation && (screen.orientation as any).lock) {
        (screen.orientation as any).lock('landscape').catch(() => {
            console.log('Não foi possível bloquear orientação');
        });
    }
}

/**
 * Liberar orientação
 */
export function unlockOrientation(): void {
    if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
    }
}

/**
 * Mostrar notificação nativa (se PWA)
 */
export async function showNotification(title: string, options?: NotificationOptions): Promise<void> {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            ...options
        });
    }
}

/**
 * Pedir permissão para notificações
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
}
