// App principal - Gerencia as telas e navegação

// Importar estilos
import './styles/main.css';
import './styles/landing-extra.css';
import './styles/checkout.css';
import './styles/mobile.css'; // CSS Responsivo para Mobile/PWA

import { LandingPage, loadLiveRooms, loadReviews, loadTournaments, loadRankings } from './pages/LandingPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage, bindRegisterEvents } from './pages/RegisterPage.js';
import { LobbyPage } from './pages/LobbyPage.js';
import { RoomPage } from './pages/RoomPage.js';
import { GamePage } from './pages/GamePage.js';
import { GamesPage } from './pages/GamesPage.js';
import { RankingPage } from './pages/RankingPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { WalletPage } from './pages/WalletPage.js';
import { AdminPage, bindAdminEvents, resetAdminState } from './pages/AdminPage.js';
import { TermsPage } from './pages/TermsPage.js';
import { PrivacyPage } from './pages/PrivacyPage.js';
import { RulesPage } from './pages/RulesPage.js';
import { GameDetailPage, bindGameDetailEvents } from './pages/GameDetailPage.js';
import { MaintenancePage, ErrorPage, ConnectionErrorPage, BannedPage, SuspendedPage } from './components/SystemPages.js';
import { TournamentBracketPage } from './pages/TournamentBracketPage.js';
import { gameStore } from './store/gameStore.js';
import { api } from './services/api.js';
import { toast } from './services/toast.js'; // Sistema de notificações
import { renderMobileBottomNav, initMobileNavEvents, isMobile } from './components/MobileNav.js';

type Page = 'landing' | 'login' | 'register' | 'lobby' | 'games' | 'room' | 'game' | 'ranking' | 'profile' | 'wallet' | 'admin' | 'terms' | 'privacy' | 'rules' | 'faq' | 'responsible' | 'game-detail' | 'maintenance' | 'error' | 'tournament-bracket';

// Mapeamento de rotas URL para páginas
const urlRoutes: Record<string, Page> = {
  '/': 'landing',
  '/login': 'login',
  '/register': 'register',
  '/lobby': 'lobby',
  '/games': 'games',
  '/ranking': 'ranking',
  '/profile': 'profile',
  '/wallet': 'wallet',
  '/admin': 'admin',
  '/terms': 'terms',
  '/privacy': 'privacy',
  '/rules': 'rules',
  '/maintenance': 'maintenance',
};

// Estado de manutenção - IMPORTANTE: começa como false e só muda se a API retornar true
let maintenanceStatus: {
  enabled: boolean;
  message: string;
  contacts?: {
    whatsapp: string;
    instagram: string;
    email: string;
  };
} = { enabled: false, message: '' };
let maintenanceStatusLoaded = false; // Flag para saber se já carregou do servidor
let lastMaintenanceCheck = 0;
const MAINTENANCE_CHECK_INTERVAL = 30000; // 30 segundos

// Páginas que SEMPRE funcionam, mesmo em manutenção
const PUBLIC_PAGES: Page[] = ['landing', 'terms', 'privacy', 'rules', 'faq', 'responsible', 'game-detail', 'maintenance', 'tournament-bracket'];

// Páginas que requerem autenticação (bloqueadas em manutenção para usuários comuns)
const PROTECTED_PAGES: Page[] = ['lobby', 'games', 'room', 'game', 'ranking', 'profile', 'wallet'];

// Páginas de autenticação (bloqueadas em manutenção)
const AUTH_PAGES: Page[] = ['login', 'register'];

class App {
  private currentPage: Page = 'landing';
  private pageData: any = null;
  private errorData: any = null;

  constructor() {
    (window as any).app = this;
    this.init();
  }

  private async init() {
    // Verificar rota da URL PRIMEIRO
    const urlPage = this.getPageFromUrl();

    // Se a URL é /admin, permitir SEMPRE
    if (urlPage === 'admin') {
      this.currentPage = 'admin';
    }

    // Buscar status de manutenção (silenciosamente)
    await this.fetchMaintenanceStatus();

    const token = localStorage.getItem('access_token');
    if (token) {
      gameStore.setState({ isLoading: true });
      await this.loadUserData();

      // Se tem uma rota específica na URL, usar ela
      if (urlPage && urlPage !== 'landing' && this.currentPage !== 'admin') {
        // Se está em manutenção e é página protegida, verificar se pode acessar
        if (maintenanceStatus.enabled && PROTECTED_PAGES.includes(urlPage)) {
          const state = gameStore.getState();
          const isAdminUser = state.user && ['admin', 'super_admin', 'manager', 'employee'].includes(state.user.role || '');
          if (!isAdminUser) {
            this.currentPage = 'maintenance';
          } else {
            this.currentPage = urlPage;
          }
        } else {
          this.currentPage = urlPage;
        }
      }
    } else {
      // Sem token, verificar se a rota é pública
      if (urlPage && PUBLIC_PAGES.includes(urlPage)) {
        this.currentPage = urlPage;
      } else if (urlPage === 'login' || urlPage === 'register') {
        // Se está em manutenção, não permitir login/registro
        if (maintenanceStatus.enabled) {
          this.currentPage = 'maintenance';
        } else {
          this.currentPage = urlPage;
        }
      }
    }

    gameStore.setState({ isLoading: false });
    this.render();
    gameStore.subscribe(() => this.render());

    // Escutar mudanças de URL (botão voltar/avançar)
    window.addEventListener('popstate', () => {
      const page = this.getPageFromUrl();
      if (page) {
        // Se for admin, sempre permitir
        if (page === 'admin') {
          this.currentPage = page;
          this.render();
          return;
        }
        // Se for página pública, sempre permitir
        if (PUBLIC_PAGES.includes(page)) {
          this.currentPage = page;
          this.render();
          return;
        }
        this.currentPage = page;
        this.render();
      }
    });

    // Verificar manutenção periodicamente (apenas para atualizar o status)
    setInterval(() => this.fetchMaintenanceStatus(), MAINTENANCE_CHECK_INTERVAL);
  }

  /**
   * Busca status de manutenção do servidor (sem redirecionar)
   */
  private async fetchMaintenanceStatus(): Promise<void> {
    try {
      const response = await fetch('/api/settings/public/maintenance');
      const data = await response.json();

      if (data) {
        // Só considera manutenção ativa se enabled for EXATAMENTE true
        const isEnabled = data.enabled === true;

        maintenanceStatus = {
          enabled: isEnabled,
          message: data.message || '',
          contacts: data.contacts,
        };
        maintenanceStatusLoaded = true;

        // Log para debug
        console.log('[Manutenção] Status do servidor:', {
          enabled: isEnabled,
          rawValue: data.enabled,
          typeOf: typeof data.enabled
        });
      }
    } catch (err) {
      // Em caso de erro, assume que NÃO está em manutenção
      maintenanceStatus.enabled = false;
      maintenanceStatusLoaded = true;
      console.log('[Manutenção] Erro ao carregar status, assumindo desativado');
    }
  }

  /**
   * Verifica se deve mostrar manutenção para uma página específica
   * REGRAS:
   * 1. Se ainda não carregou o status, NÃO bloqueia (assume desativado)
   * 2. Landing page e páginas públicas SEMPRE funcionam
   * 3. Página /admin SEMPRE funciona
   * 4. Login/Registro são bloqueados em manutenção
   * 5. Páginas protegidas são bloqueadas para usuários comuns em manutenção
   * 6. Usuários admin/manager/employee podem acessar tudo
   */
  private shouldShowMaintenance(page: Page): boolean {
    // Se ainda não carregou o status do servidor, não bloqueia
    if (!maintenanceStatusLoaded) {
      return false;
    }

    // Se manutenção não está ativa, nunca mostrar
    if (!maintenanceStatus.enabled) {
      return false;
    }

    // Admin page NUNCA é bloqueada
    if (page === 'admin') {
      return false;
    }

    // Páginas públicas NUNCA são bloqueadas
    if (PUBLIC_PAGES.includes(page)) {
      return false;
    }

    // Verificar se é usuário admin
    const state = gameStore.getState();
    const isAdminUser = state.user && ['admin', 'super_admin', 'manager', 'employee'].includes(state.user.role || '');

    // Usuários admin podem acessar tudo
    if (isAdminUser) {
      return false;
    }

    // Para usuários comuns: bloquear login, registro e páginas protegidas
    if (AUTH_PAGES.includes(page) || PROTECTED_PAGES.includes(page)) {
      console.log(`[Manutenção] Bloqueando acesso à página: ${page}`);
      return true;
    }

    return false;
  }

  private getPageFromUrl(): Page | null {
    const path = window.location.pathname;
    return urlRoutes[path] || null;
  }

  private updateUrl(page: Page) {
    // Encontrar a URL correspondente à página
    const url = Object.entries(urlRoutes).find(([_, p]) => p === page)?.[0];
    if (url && window.location.pathname !== url) {
      window.history.pushState({}, '', url);
    }
  }

  private async loadUserData() {
    try {
      const { data: authData, error: authError } = await api.getMe();
      if (authError || !authData?.user) {
        localStorage.removeItem('access_token');
        this.currentPage = 'landing';
        return;
      }

      const user = authData.user;

      // Verificar se usuário está banido
      if (user.is_banned || user.status === 'banned') {
        console.log('[App] Usuário banido detectado');
        this.currentPage = 'banned' as Page;
        this.pageData = {
          username: user.username,
          reason: user.ban_reason,
          bannedAt: user.banned_at,
        };
        gameStore.setUser(null);
        return;
      }

      // Verificar se usuário está suspenso
      if (user.is_suspended || user.status === 'suspended') {
        const suspendedUntil = user.suspended_until ? new Date(user.suspended_until) : null;

        // Se a suspensão já expirou, permitir acesso
        if (suspendedUntil && suspendedUntil < new Date()) {
          console.log('[App] Suspensão expirada, permitindo acesso');
        } else {
          console.log('[App] Usuário suspenso detectado');
          this.currentPage = 'suspended' as Page;
          this.pageData = {
            username: user.username,
            reason: user.suspension_reason,
            suspendedUntil: user.suspended_until,
          };
          gameStore.setUser(null);
          return;
        }
      }

      gameStore.setUser(user);

      // Só muda para lobby se não tiver uma rota específica
      if (this.currentPage === 'landing') {
        this.currentPage = 'lobby';
      }

      // Carregar wallet e créditos em paralelo
      const [walletRes, creditsRes] = await Promise.all([
        api.getWallet(),
        api.getCredits()
      ]);

      if (walletRes.data) {
        gameStore.setWallet(walletRes.data.balance || 0);
      }
      if (creditsRes.data) {
        gameStore.setCredits(creditsRes.data.amount || 0, creditsRes.data.is_unlimited || false);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      this.currentPage = 'landing';
    }
  }

  navigate(page: Page, data?: any) {
    // Resetar estado do admin se estiver saindo da página admin
    if (this.currentPage === 'admin' && page !== 'admin') {
      resetAdminState();
    }

    // Verificar se deve mostrar manutenção
    if (this.shouldShowMaintenance(page)) {
      console.log(`[Manutenção] Acesso bloqueado para página: ${page}`);
      this.currentPage = 'maintenance';
      this.pageData = null;
      this.updateUrl('maintenance');
      this.render();
      return;
    }

    this.currentPage = page;
    this.pageData = data;
    this.updateUrl(page);
    this.render();
    window.scrollTo(0, 0);
  }

  render() {
    const app = document.getElementById('app');
    if (!app) return;

    const state = gameStore.getState();

    if (state.isLoading) {
      app.innerHTML = `
        <div class="auth-container">
          <div class="loading">
            <div class="spinner"></div>
            <p class="loading-text">Carregando...</p>
          </div>
        </div>
      `;
      return;
    }

    let content = '';
    switch (this.currentPage) {
      case 'landing': content = LandingPage(this); break;
      case 'login': content = LoginPage(this); break;
      case 'register': content = RegisterPage(this); break;
      case 'lobby': content = LobbyPage(this); break;
      case 'games': content = GamesPage(this); break;
      case 'room': content = RoomPage(this, this.pageData); break;
      case 'game': content = GamePage(this, this.pageData); break;
      case 'ranking': content = RankingPage(this); break;
      case 'profile': content = ProfilePage(this); break;
      case 'wallet': content = WalletPage(this); break;
      case 'admin': content = AdminPage(this); break;
      case 'terms': content = TermsPage(); break;
      case 'privacy': content = PrivacyPage(); break;
      case 'rules': content = RulesPage(); break;
      case 'faq': content = RulesPage(); break; // Redireciona para regras por enquanto
      case 'responsible': content = TermsPage(); break; // Redireciona para termos por enquanto
      case 'game-detail': content = GameDetailPage(this, this.pageData?.game || 'sinuca'); break;
      case 'tournament-bracket': content = TournamentBracketPage(this, this.pageData); break;
      case 'maintenance': content = MaintenancePage({
        enabled: true,
        message: maintenanceStatus.message || 'Estamos realizando melhorias no sistema para você!',
        estimatedReturn: 'Em breve',
        contactWhatsapp: maintenanceStatus.contacts?.whatsapp || '5511999999999',
        contactInstagram: maintenanceStatus.contacts?.instagram || 'sinucaonline',
        contactEmail: maintenanceStatus.contacts?.email || 'suporte@sinucaonline.com',
      }); break;
      case 'banned' as Page: content = BannedPage({
        username: this.pageData?.username,
        reason: this.pageData?.reason,
        bannedAt: this.pageData?.bannedAt,
      }); break;
      case 'suspended' as Page: content = SuspendedPage({
        username: this.pageData?.username,
        reason: this.pageData?.reason,
        suspendedUntil: this.pageData?.suspendedUntil,
      }); break;
      case 'error': content = ErrorPage(this.errorData || {}); break;
      default: content = LandingPage(this);
    }

    app.innerHTML = content;

    // Injetar navegação mobile em páginas internas (não em landing, login, register, game)
    const pagesWithMobileNav: Page[] = ['lobby', 'games', 'ranking', 'profile', 'wallet', 'admin', 'room'];
    if (pagesWithMobileNav.includes(this.currentPage) && isMobile()) {
      const mobileNavHtml = renderMobileBottomNav(this.currentPage);
      app.insertAdjacentHTML('beforeend', mobileNavHtml);
    }

    this.bindEvents();

    // Inicializar eventos do mobile nav
    initMobileNavEvents(this);

    // Bind admin events se estiver na página admin
    if (this.currentPage === 'admin') {
      bindAdminEvents(this);
    }

    // Bind register events
    if (this.currentPage === 'register') {
      bindRegisterEvents(this);
    }

    // Bind game detail events
    if (this.currentPage === 'game-detail') {
      bindGameDetailEvents(this);
    }

    // Carregar dados dinâmicos na landing page
    if (this.currentPage === 'landing') {
      loadLiveRooms();
      loadReviews();
      loadTournaments();
      loadRankings();
    }
  }

  private bindEvents() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    // Register form - handled by bindRegisterEvents
    // (não precisa mais aqui, o bindRegisterEvents cuida)

    // Navigation links
    document.querySelectorAll('[data-navigate]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const page = (el as HTMLElement).dataset.navigate as Page;
        const data = (el as HTMLElement).dataset.navigateData;
        const game = (el as HTMLElement).dataset.game;

        // Se for game-detail, passar o slug do jogo
        if (page === 'game-detail' && game) {
          this.navigate(page, { game });
        } else {
          this.navigate(page, data ? JSON.parse(data) : null);
        }
      });
    });

    // Sidebar items
    document.querySelectorAll('.sidebar-item').forEach(el => {
      el.addEventListener('click', () => {
        const page = (el as HTMLElement).dataset.page as Page;
        if (page) this.navigate(page);
      });
    });

    // Create room button
    document.querySelectorAll('#create-room-btn, #create-room-btn-empty').forEach(btn => {
      btn?.addEventListener('click', () => this.showCreateRoomModal());
    });

    // Modal close
    document.querySelectorAll('.modal-close').forEach(el => {
      el.addEventListener('click', () => this.closeModal());
    });

    document.querySelectorAll('.modal-overlay').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el) this.closeModal();
      });
    });

    // Room mode selection
    document.querySelectorAll('.mode-option, .room-mode-option').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.mode-option, .room-mode-option').forEach(opt => {
          opt.classList.remove('active');
          (opt as HTMLElement).style.borderColor = 'transparent';
        });
        el.classList.add('active');
        (el as HTMLElement).style.borderColor = 'var(--accent-green)';
      });
    });

    // Create room confirm
    const confirmCreateRoom = document.getElementById('confirm-create-room');
    if (confirmCreateRoom) {
      confirmCreateRoom.addEventListener('click', () => this.handleCreateRoom());
    }

    // Join room buttons
    document.querySelectorAll('.join-room-btn').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const roomId = (el as HTMLElement).dataset.roomId;
        if (roomId) this.handleJoinRoom(roomId);
      });
    });

    // Room card click
    document.querySelectorAll('.room-card[data-room-id]').forEach(el => {
      el.addEventListener('click', () => {
        const roomId = (el as HTMLElement).dataset.roomId;
        if (roomId) this.handleJoinRoom(roomId);
      });
    });

    // Leave room
    const leaveRoomBtn = document.getElementById('leave-room-btn');
    if (leaveRoomBtn) {
      leaveRoomBtn.addEventListener('click', () => this.handleLeaveRoom());
    }

    // Start match
    const startMatchBtn = document.getElementById('start-match-btn');
    if (startMatchBtn) {
      startMatchBtn.addEventListener('click', () => this.handleStartMatch());
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // Wallet buttons
    this.bindWalletEvents();

    // Carousel controls
    this.bindCarouselEvents();

    // Payment method selection
    document.querySelectorAll('.payment-method').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('active'));
        el.classList.add('active');
        const method = (el as HTMLElement).dataset.method;
        this.togglePaymentMethod(method!);
      });
    });

    // Quick value cards
    document.querySelectorAll('.quick-value-card').forEach(el => {
      el.addEventListener('click', () => {
        const amount = (el as HTMLElement).dataset.amount;
        this.showCheckoutModal(Number(amount));
      });
    });

    // Refresh rooms
    const refreshBtn = document.getElementById('refresh-rooms-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadRooms());
    }

    // Join private room button
    const joinPrivateBtn = document.getElementById('join-private-room-btn');
    if (joinPrivateBtn) {
      joinPrivateBtn.addEventListener('click', () => {
        document.getElementById('join-private-modal')?.classList.remove('hidden');
      });
    }

    // Join private room confirm
    const joinPrivateConfirm = document.getElementById('join-private-btn');
    if (joinPrivateConfirm) {
      joinPrivateConfirm.addEventListener('click', () => this.handleJoinPrivateRoom());
    }
  }

  private bindWalletEvents() {
    const depositBtn = document.getElementById('deposit-btn');
    if (depositBtn) {
      depositBtn.addEventListener('click', () => this.showCheckoutModal(10));
    }

    const withdrawBtn = document.getElementById('withdraw-btn');
    if (withdrawBtn) {
      withdrawBtn.addEventListener('click', () => this.showToast('Saque solicitado! Processando...', 'info'));
    }
  }

  private bindCarouselEvents() {
    const track = document.querySelector('.videos-track') as HTMLElement;
    const prevBtn = document.querySelector('.carousel-btn.prev');
    const nextBtn = document.querySelector('.carousel-btn.next');

    if (track && prevBtn && nextBtn) {
      prevBtn.addEventListener('click', () => track.scrollBy({ left: -300, behavior: 'smooth' }));
      nextBtn.addEventListener('click', () => track.scrollBy({ left: 300, behavior: 'smooth' }));
    }

    document.querySelectorAll('.video-card').forEach(card => {
      card.addEventListener('click', () => this.showToast('Vídeo em breve!', 'info'));
    });

    document.querySelectorAll('.credit-card').forEach(card => {
      card.addEventListener('click', () => this.navigate('register'));
    });
  }

  private togglePaymentMethod(method: string) {
    const pixContent = document.getElementById('pix-content');
    const cardContent = document.getElementById('card-content');
    if (method === 'pix') {
      pixContent?.classList.remove('hidden');
      cardContent?.classList.add('hidden');
    } else {
      pixContent?.classList.add('hidden');
      cardContent?.classList.remove('hidden');
    }
  }

  private showCheckoutModal(amount: number) {
    const modal = document.getElementById('checkout-modal');
    const valueEl = document.getElementById('checkout-value');
    if (modal) modal.classList.remove('hidden');
    if (valueEl) valueEl.textContent = `R$ ${amount.toFixed(2)}`;
  }

  // ==================== AUTH HANDLERS ====================

  private async handleLogin() {
    const email = (document.getElementById('email') as HTMLInputElement)?.value;
    const password = (document.getElementById('password') as HTMLInputElement)?.value;
    const errorEl = document.getElementById('auth-error');
    const submitBtn = document.querySelector('#login-form button[type="submit"]') as HTMLButtonElement;

    if (!email || !password) {
      this.showAuthError(errorEl, 'Preencha todos os campos');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>';
    }

    const { data, error } = await api.login(email, password);

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Entrar';
    }

    if (error) {
      this.showAuthError(errorEl, error);
      return;
    }

    if (data?.user) {
      gameStore.setUser(data.user);
      await this.loadUserData();
      this.showToast('Login realizado com sucesso!', 'success');
      this.navigate('lobby');
    }
  }

  private async handleRegister() {
    const username = (document.getElementById('username') as HTMLInputElement)?.value;
    const email = (document.getElementById('email') as HTMLInputElement)?.value;
    const password = (document.getElementById('password') as HTMLInputElement)?.value;
    const errorEl = document.getElementById('auth-error');
    const submitBtn = document.querySelector('#register-form button[type="submit"]') as HTMLButtonElement;

    if (!username || !email || !password) {
      this.showAuthError(errorEl, 'Preencha todos os campos');
      return;
    }

    if (password.length < 6) {
      this.showAuthError(errorEl, 'Senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>';
    }

    const { data, error } = await api.register(email, password, username);

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Criar Conta';
    }

    if (error) {
      this.showAuthError(errorEl, error);
      return;
    }

    this.showToast('Conta criada com sucesso!', 'success');

    if (data?.session) {
      gameStore.setUser(data.user);
      await this.loadUserData();
      this.navigate('lobby');
    } else {
      this.navigate('login');
    }
  }

  private showAuthError(el: HTMLElement | null, message: string) {
    if (el) {
      el.textContent = message;
      el.classList.remove('hidden');
    }
  }

  private async handleLogout() {
    await api.logout();
    gameStore.logout();
    this.showToast('Até logo!', 'info');
    this.navigate('landing');
  }

  // ==================== ROOM HANDLERS ====================

  private showCreateRoomModal() {
    const modal = document.getElementById('create-room-modal');
    if (modal) modal.classList.remove('hidden');
  }

  private closeModal() {
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.add('hidden'));
  }

  private async handleCreateRoom() {
    const activeMode = document.querySelector('.mode-option.active, .room-mode-option.active');
    const mode = (activeMode?.getAttribute('data-mode') || 'casual') as 'casual' | 'bet';
    const isPrivate = (document.getElementById('room-private-check') as HTMLInputElement)?.checked || false;
    const confirmBtn = document.getElementById('confirm-create-room') as HTMLButtonElement;

    // Pegar modo de jogo selecionado
    const activeGameMode = document.querySelector('.game-mode-option[style*="accent-green"]') ||
      document.querySelector('.game-mode-option.active');
    const gameMode = activeGameMode?.getAttribute('data-game-mode') || '15ball';

    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>';
    }

    const { data, error } = await api.createRoom(mode, undefined, isPrivate);

    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = 'Criar Sala';
    }

    if (error) {
      this.showToast(error, 'error');
      return;
    }

    this.closeModal();

    if (isPrivate && data?.invite_code) {
      this.showToast(`Sala criada! Código: ${data.invite_code}`, 'success');
    } else {
      this.showToast('Sala criada! Aguardando oponente...', 'success');
    }

    // Buscar sala completa com dados do owner
    const { data: roomData } = await api.getRoom(data.id);
    this.navigate('room', { ...(roomData || data), gameMode });
  }

  private async handleJoinRoom(roomId: string) {
    this.showToast('Entrando na sala...', 'info');

    const { data, error } = await api.joinRoom(roomId);

    if (error) {
      this.showToast(error, 'error');
      return;
    }

    // Buscar sala completa
    const { data: roomData } = await api.getRoom(roomId);
    this.showToast('Você entrou na sala!', 'success');
    this.navigate('room', roomData || data);
  }

  private async handleJoinPrivateRoom() {
    const codeInput = document.getElementById('room-code') as HTMLInputElement;
    const code = codeInput?.value?.toUpperCase().trim();

    if (!code || code.length < 4) {
      this.showToast('Digite um código válido', 'error');
      return;
    }

    const { data, error } = await api.joinRoomByCode(code);

    if (error) {
      this.showToast(error, 'error');
      return;
    }

    this.closeModal();
    this.showToast('Você entrou na sala!', 'success');
    this.navigate('room', data);
  }

  private async handleLeaveRoom() {
    const room = this.pageData;
    if (!room?.id) {
      this.navigate('lobby');
      return;
    }

    const { error } = await api.leaveRoom(room.id);

    if (error) {
      this.showToast(error, 'error');
      return;
    }

    this.showToast('Você saiu da sala', 'info');
    this.navigate('lobby');
  }

  private async handleStartMatch() {
    // NOTA: O start match é tratado diretamente no RoomPage.ts
    // que usa o realtimeService para broadcast para todos os jogadores
    // Este método é mantido apenas como fallback/compatibilidade
    console.log('[App] handleStartMatch chamado - delegando para RoomPage');
  }

  private async loadRooms() {
    const { data } = await api.getRooms();
    if (data?.rooms) {
      gameStore.setState({ rooms: data.rooms } as any);
      this.render();
    }
  }

  // ==================== TOAST ====================

  private showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => toast.remove(), 4000);
  }
}

// Iniciar app
const app = new App();
(window as any).app = app;
