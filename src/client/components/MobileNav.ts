import { gameStore } from '../store/gameStore.js';

/**
 * Componente de Menu Bottom para navegação mobile
 */
export function MobileBottomNav(): string {
    const state = gameStore.getState();
    const currentPath = window.location.pathname;

    // Definir itens do menu
    const navItems = [
        { icon: '🏠', label: 'Início', path: '/lobby', page: 'lobby' },
        { icon: '🎮', label: 'Jogar', path: '/games', page: 'games' },
        { icon: '🏆', label: 'Ranking', path: '/ranking', page: 'ranking' },
        { icon: '💰', label: 'Carteira', path: '/wallet', page: 'wallet' },
        { icon: '👤', label: 'Perfil', path: '/profile', page: 'profile' },
    ];

    // Se for admin, mostrar item de admin
    const isAdmin = state.user && ['admin', 'super_admin', 'manager', 'employee'].includes(state.user.role || '');
    if (isAdmin) {
        navItems.push({ icon: '⚙️', label: 'Admin', path: '/admin', page: 'admin' });
    }

    return `
    <nav class="mobile-bottom-nav" id="mobile-bottom-nav">
      ${navItems.map(item => `
        <a href="${item.path}" 
           class="mobile-nav-item ${currentPath === item.path ? 'active' : ''}"
           data-navigate="${item.page}">
          <span class="mobile-nav-item-icon">${item.icon}</span>
          <span class="mobile-nav-item-label">${item.label}</span>
        </a>
      `).join('')}
    </nav>
  `;
}

/**
 * Componente de Header Mobile
 */
export function MobileHeader(title?: string): string {
    const state = gameStore.getState();

    return `
    <header class="header mobile-header">
      <div class="header-content">
        <div class="header-left">
          <button class="mobile-menu-btn" id="mobile-menu-toggle" aria-label="Menu">
            <span>☰</span>
          </button>
          <span class="header-logo">🎱</span>
          ${title ? `<h1 class="mobile-header-title">${title}</h1>` : ''}
        </div>
        
        <div class="header-stats">
          <div class="header-stat">
            <span class="stat-icon">🪙</span>
            <span class="stat-value">${state.credits ?? 0}</span>
          </div>
          <div class="header-stat">
            <span class="stat-icon">💰</span>
            <span class="stat-value">R$ ${(state.wallet ?? 0).toFixed(2)}</span>
          </div>
        </div>
        
        <div class="header-user">
          <div class="user-avatar-small" style="background-image: url('${state.user?.avatar_url || '/icons/icon-72x72.png'}')"></div>
        </div>
      </div>
    </header>
  `;
}

/**
 * Inicializar eventos de navegação mobile
 */
export function initMobileNavigation(): void {
    // Toggle do menu lateral (se existir)
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.querySelector('.admin-sidebar, .sidebar');

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        // Fechar ao clicar fora
        document.addEventListener('click', (e) => {
            if (!sidebar.contains(e.target as Node) && !menuToggle.contains(e.target as Node)) {
                sidebar.classList.remove('open');
            }
        });
    }

    // Navegação do bottom nav
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = (item as HTMLElement).dataset.navigate;
            if (page && (window as any).app) {
                (window as any).app.navigate(page);
            }
        });
    });
}

/**
 * Detectar se está em modo mobile
 */
export function isMobile(): boolean {
    return window.innerWidth <= 768 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Detectar se está em modo PWA (standalone)
 */
export function isPWA(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
}

/**
 * Detectar orientação
 */
export function isLandscape(): boolean {
    return window.innerWidth > window.innerHeight;
}

/**
 * Forçar modo paisagem (para o jogo)
 */
export function requestLandscape(): void {
    if (screen.orientation && (screen.orientation as any).lock) {
        (screen.orientation as any).lock('landscape').catch(() => {
            // Navegador não suporta ou usuário negou
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
 * Vibrar dispositivo (feedback tátil)
 */
export function vibrate(pattern: number | number[] = 50): void {
    if (navigator.vibrate) {
        navigator.vibrate(pattern);
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
