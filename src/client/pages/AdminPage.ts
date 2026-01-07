import { gameStore } from '../store/gameStore.js';
import { api } from '../services/api.js';
import { toast } from '../services/toast.js';

type AdminTab = 'dashboard' | 'users' | 'matches' | 'finance' | 'withdrawals' | 'tournaments' | 'banners' | 'coupons' | 'missions' | 'referrals' | 'employees' | 'logs' | 'settings' | 'music';

let currentTab: AdminTab = 'dashboard';
let adminData: any = {
  stats: null,
  users: [],
  matches: [],
  withdrawals: [],
  tournaments: [],
  banners: [],
  coupons: [],
  missions: [],
  referrals: [],
  referralStats: null,
  employees: [],
  invites: [],
  logs: [],
  settings: null,
  financeDashboard: null,
  musicTracks: [],
  musicStats: [],
};
let isLoading = false;
let selectedUser: any = null;
let selectedMatch: any = null;
let dataLoadStarted = false;

// Estado dos grupos colapsáveis do menu
let collapsedGroups: Set<string> = new Set();

// Intervalo de sincronização em tempo real
let realtimeSyncInterval: ReturnType<typeof setInterval> | null = null;
const REALTIME_SYNC_INTERVAL = 10000; // 10 segundos

// Timestamp da última atualização
let lastUpdateTime: Date | null = null;

// Função para resetar o estado do admin (chamada quando sai da página)
export function resetAdminState() {
  // Parar sincronização em tempo real
  if (realtimeSyncInterval) {
    clearInterval(realtimeSyncInterval);
    realtimeSyncInterval = null;
  }
  
  adminData = {
    stats: null,
    users: [],
    matches: [],
    withdrawals: [],
    tournaments: [],
    banners: [],
    referrals: [],
    referralStats: null,
    employees: [],
    invites: [],
    logs: [],
    settings: null,
    financeDashboard: null,
    musicTracks: [],
    musicStats: [],
  };
  isLoading = false;
  dataLoadStarted = false;
  selectedUser = null;
  selectedMatch = null;
  currentTab = 'dashboard';
  collapsedGroups = new Set();
}

// Verifica se usuário é admin (por role ou is_admin)
function isUserAdmin(user: any): boolean {
  if (!user) return false;
  if (user.is_admin === true) return true;
  if (['admin', 'super_admin', 'manager', 'moderator', 'employee'].includes(user.role)) return true;
  return false;
}

export function AdminPage(app: any): string {
  const state = gameStore.getState();
  const user = state.user;

  // Guardar referência do app para re-render
  setAppInstance(app);

  // Se não está autenticado, mostrar tela de login
  if (!user) {
    return `
      <div class="auth-container">
        <div class="auth-card">
          <h2>🔐 Área Administrativa</h2>
          <p>Você precisa estar logado para acessar esta área.</p>
          <button class="btn btn-primary" data-navigate="login" style="margin-top: 1rem;">Fazer Login</button>
        </div>
      </div>
    `;
  }

  if (!isUserAdmin(user)) {
    setTimeout(() => app.navigate('lobby'), 100);
    return `<div class="auth-container"><p>Acesso negado. Você não tem permissão para acessar esta área.</p></div>`;
  }

  // Mostrar loading enquanto carrega
  if (isLoading) {
    return `
      <div class="admin-layout">
        <div class="admin-loading" style="width: 100%; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: var(--bg-primary);">
          <div class="spinner"></div>
          <p style="margin-left: 1rem; color: var(--text-primary);">Carregando painel...</p>
        </div>
      </div>
    `;
  }

  // Carregar dados se ainda não carregou (apenas uma vez)
  if (!adminData.stats && !dataLoadStarted) {
    dataLoadStarted = true;
    loadAdminData(app);
    // Retornar loading enquanto carrega
    return `
      <div class="admin-layout">
        <div class="admin-loading" style="width: 100%; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: var(--bg-primary);">
          <div class="spinner"></div>
          <p style="margin-left: 1rem; color: var(--text-primary);">Carregando painel...</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="admin-layout">
      ${renderAdminSidebar(user)}
      <main class="admin-main">
        ${renderAdminHeader()}
        <div class="admin-content">
          ${renderTabContent()}
        </div>
      </main>
      ${renderModals()}
    </div>
  `;
}

function renderAdminSidebar(user: any): string {
  const userRole = user?.role || 'user';

  // Menu organizado por grupos/módulos
  const menuGroups = [
    {
      id: 'main',
      label: null, // Sem label = itens principais
      collapsible: false,
      items: [
        { id: 'dashboard', icon: '📊', label: 'Dashboard', roles: ['employee', 'moderator', 'manager', 'admin', 'super_admin'] },
      ]
    },
    {
      id: 'users-group',
      label: '👥 Usuários',
      collapsible: true,
      items: [
        { id: 'users', icon: '👤', label: 'Gestão de Usuários', roles: ['moderator', 'manager', 'admin', 'super_admin'] },
        { id: 'employees', icon: '👔', label: 'Equipe Interna', roles: ['admin', 'super_admin'] },
      ]
    },
    {
      id: 'games-group',
      label: '🎮 Jogos',
      collapsible: true,
      items: [
        { id: 'matches', icon: '🎱', label: 'Partidas', roles: ['employee', 'moderator', 'manager', 'admin', 'super_admin'] },
        { id: 'tournaments', icon: '🏆', label: 'Torneios', roles: ['manager', 'admin', 'super_admin'] },
      ]
    },
    {
      id: 'finance-group',
      label: '💰 Financeiro',
      collapsible: true,
      items: [
        { id: 'finance', icon: '📈', label: 'Visão Geral', roles: ['manager', 'admin', 'super_admin'] },
        { id: 'withdrawals', icon: '💸', label: 'Saques', roles: ['employee', 'manager', 'admin', 'super_admin'] },
      ]
    },
    {
      id: 'marketing-group',
      label: '📢 Marketing',
      collapsible: true,
      items: [
        { id: 'banners', icon: '🖼️', label: 'Banners', roles: ['manager', 'admin', 'super_admin'] },
        { id: 'coupons', icon: '🎟️', label: 'Cupons', roles: ['manager', 'admin', 'super_admin'] },
        { id: 'missions', icon: '🎯', label: 'Missões', roles: ['manager', 'admin', 'super_admin'] },
        { id: 'referrals', icon: '🎁', label: 'Indicações', roles: ['manager', 'admin', 'super_admin'] },
        { id: 'music', icon: '🎵', label: 'Músicas', roles: ['manager', 'admin', 'super_admin'] },
      ]
    },
    {
      id: 'system-group',
      label: '⚙️ Sistema',
      collapsible: true,
      items: [
        { id: 'settings', icon: '🔧', label: 'Configurações', roles: ['admin', 'super_admin'] },
        { id: 'logs', icon: '📋', label: 'Logs de Auditoria', roles: ['manager', 'admin', 'super_admin'] },
      ]
    },
  ];

  // Filtrar grupos e itens baseado no role
  const filteredGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => item.roles.includes(userRole))
  })).filter(group => group.items.length > 0);

  // Contadores para badges
  const pendingWithdrawals = (adminData.withdrawals || []).filter((w: any) => w.status === 'pending').length;

  return `
    <aside class="admin-sidebar">
      <div class="admin-logo">
        <span class="logo-icon">🎱</span>
        <span class="logo-text">Admin</span>
      </div>
      <div class="admin-role-badge">${getRoleBadge(userRole)}</div>
      
      <!-- Indicador de sincronização em tempo real -->
      <div class="realtime-indicator" id="realtime-indicator">
        <span class="realtime-dot"></span>
        <span class="realtime-text">Sincronizado</span>
      </div>
      
      <nav class="admin-nav">
        ${filteredGroups.map(group => {
          const isCollapsed = collapsedGroups.has(group.id);
          const hasActiveItem = group.items.some(item => item.id === currentTab);
          
          // Verificar se há alertas no grupo
          const hasAlerts = group.id === 'finance-group' && pendingWithdrawals > 0;
          
          if (!group.collapsible) {
            // Itens sem grupo (Dashboard)
            return group.items.map(item => `
              <button class="admin-nav-item ${currentTab === item.id ? 'active' : ''}" 
                      data-admin-tab="${item.id}">
                <span class="nav-icon">${item.icon}</span>
                <span class="nav-label">${item.label}</span>
              </button>
            `).join('');
          }
          
          return `
            <div class="admin-nav-group ${isCollapsed ? 'collapsed' : ''} ${hasActiveItem ? 'has-active' : ''}">
              <button class="admin-nav-group-header" data-toggle-group="${group.id}">
                <span class="group-label">${group.label}</span>
                ${hasAlerts ? `<span class="group-badge">${pendingWithdrawals}</span>` : ''}
                <span class="group-chevron">${isCollapsed ? '▶' : '▼'}</span>
              </button>
              <div class="admin-nav-group-items" style="${isCollapsed ? 'display: none;' : ''}">
                ${group.items.map(item => {
                  const itemBadge = item.id === 'withdrawals' && pendingWithdrawals > 0 
                    ? `<span class="nav-badge">${pendingWithdrawals}</span>` 
                    : '';
                  return `
                    <button class="admin-nav-item ${currentTab === item.id ? 'active' : ''}" 
                            data-admin-tab="${item.id}">
                      <span class="nav-icon">${item.icon}</span>
                      <span class="nav-label">${item.label}</span>
                      ${itemBadge}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </nav>
      <div class="admin-sidebar-footer">
        <button class="btn btn-sm btn-ghost" id="refresh-all-btn" style="width: 100%; margin-bottom: 0.5rem;">
          🔄 Atualizar Tudo
        </button>
        <button class="admin-nav-item" data-navigate="lobby">
          <span class="nav-icon">🏠</span>
          <span class="nav-label">Voltar ao Jogo</span>
        </button>
      </div>
    </aside>
    
    <style>
      /* Sidebar com rolagem */
      .admin-sidebar {
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      
      .admin-nav {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0.5rem 0;
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,0.2) transparent;
      }
      
      .admin-nav::-webkit-scrollbar {
        width: 6px;
      }
      
      .admin-nav::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .admin-nav::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.2);
        border-radius: 3px;
      }
      
      .admin-nav::-webkit-scrollbar-thumb:hover {
        background: rgba(255,255,255,0.3);
      }
      
      /* Indicador de sincronização em tempo real */
      .realtime-indicator {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        margin: 0 1rem 0.5rem;
        background: rgba(0, 255, 136, 0.1);
        border-radius: 6px;
        font-size: 0.75rem;
        color: var(--accent-green);
      }
      
      .realtime-dot {
        width: 8px;
        height: 8px;
        background: var(--accent-green);
        border-radius: 50%;
        animation: pulse 2s infinite;
      }
      
      .realtime-indicator.syncing .realtime-dot {
        background: var(--accent-yellow);
        animation: spin 1s linear infinite;
      }
      
      .realtime-indicator.syncing .realtime-text {
        color: var(--accent-yellow);
      }
      
      .realtime-indicator.error .realtime-dot {
        background: #ff6b6b;
        animation: none;
      }
      
      .realtime-indicator.error .realtime-text {
        color: #ff6b6b;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.8); }
      }
      
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      
      /* Grupos colapsáveis */
      .admin-nav-group {
        margin-bottom: 0.25rem;
      }
      
      .admin-nav-group-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 0.75rem 1rem;
        background: transparent;
        border: none;
        color: var(--text-muted);
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        cursor: pointer;
        transition: all 0.2s;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
      }
      
      .admin-nav-group:first-child .admin-nav-group-header {
        border-top: none;
      }
      
      .admin-nav-group-header:hover {
        background: rgba(255, 255, 255, 0.03);
        color: var(--text-secondary);
      }
      
      .admin-nav-group.has-active .admin-nav-group-header {
        color: var(--accent-green);
      }
      
      .group-label {
        flex: 1;
        text-align: left;
      }
      
      .group-chevron {
        font-size: 0.6rem;
        transition: transform 0.2s;
      }
      
      .admin-nav-group.collapsed .group-chevron {
        transform: rotate(0deg);
      }
      
      .group-badge {
        background: #ff6b6b;
        color: #fff;
        font-size: 0.65rem;
        padding: 2px 6px;
        border-radius: 10px;
        margin-right: 0.5rem;
        font-weight: 600;
      }
      
      .admin-nav-group-items {
        overflow: hidden;
        transition: all 0.2s ease;
      }
      
      .admin-nav-group.collapsed .admin-nav-group-items {
        display: none;
      }
      
      /* Badge nos itens do menu */
      .nav-badge {
        background: #ff6b6b;
        color: #fff;
        font-size: 0.65rem;
        padding: 2px 6px;
        border-radius: 10px;
        margin-left: auto;
        font-weight: 600;
      }
      
      /* Ajuste do item de navegação para acomodar badge */
      .admin-nav-item {
        position: relative;
      }
      
      .admin-nav-item .nav-label {
        flex: 1;
      }
    </style>
  `;
}

function getRoleBadge(role: string): string {
  const badges: Record<string, string> = {
    'super_admin': '👑 Super Admin',
    'admin': '🛡️ Admin',
    'manager': '📋 Gerente',
    'moderator': '🔧 Moderador',
    'employee': '👤 Funcionário',
  };
  return badges[role] || '👤 Usuário';
}

function renderAdminHeader(): string {
  const state = gameStore.getState();
  return `
    <header class="admin-header">
      <h1 class="admin-title">${getTabTitle()}</h1>
      <div class="admin-user">
        <span>${state.user?.username || 'Admin'}</span>
        <div class="admin-avatar">${state.user?.username?.[0]?.toUpperCase() || 'A'}</div>
      </div>
    </header>
  `;
}

function getTabTitle(): string {
  const titles: Record<AdminTab, string> = {
    dashboard: '📊 Dashboard',
    users: '👤 Gestão de Usuários',
    employees: '👔 Equipe Interna',
    matches: '🎱 Gestão de Partidas',
    tournaments: '🏆 Gestão de Torneios',
    finance: '📈 Visão Financeira',
    withdrawals: '💸 Solicitações de Saque',
    banners: '🖼️ Banners e Destaques',
    coupons: '🎟️ Cupons de Desconto',
    missions: '🎯 Missões e Competições',
    referrals: '🎁 Programa de Indicações',
    settings: '🔧 Configurações do Sistema',
    logs: '📋 Logs de Auditoria',
    music: '🎵 Gestão de Músicas',
  };
  return titles[currentTab];
}

function renderTabContent(): string {
  if (isLoading) {
    return `<div class="admin-loading"><div class="spinner"></div><p>Carregando...</p></div>`;
  }

  try {
    switch (currentTab) {
      case 'dashboard': return renderDashboard();
      case 'users': return renderUsers();
      case 'matches': return renderMatches();
      case 'finance': return renderFinance();
      case 'withdrawals': return renderWithdrawals();
      case 'tournaments': return renderTournaments();
      case 'banners': return renderBanners();
      case 'coupons': return renderCoupons();
      case 'missions': return renderMissions();
      case 'referrals': return renderReferrals();
      case 'employees': return renderEmployees();
      case 'logs': return renderLogs();
      case 'settings': return renderSettings();
      case 'music': return renderMusic();
      default: return renderDashboard();
    }
  } catch (err) {
    console.error('Erro ao renderizar tab:', err);
    return `<div class="admin-loading"><p style="color: #ff6b6b;">Erro ao carregar conteúdo. Tente novamente.</p></div>`;
  }
}

function renderModals(): string {
  return `
    <div id="user-modal" class="modal ${selectedUser ? 'active' : ''}">
      <div class="modal-overlay" data-close-modal="user-modal"></div>
      <div class="modal-content">
        ${selectedUser ? renderUserModal() : ''}
      </div>
    </div>
    <div id="match-modal" class="modal ${selectedMatch ? 'active' : ''}">
      <div class="modal-overlay" data-close-modal="match-modal"></div>
      <div class="modal-content">
        ${selectedMatch ? renderMatchModal() : ''}
      </div>
    </div>
    <div id="tournament-modal" class="modal">
      <div class="modal-overlay" data-close-modal="tournament-modal"></div>
      <div class="modal-content">
        ${renderTournamentForm()}
      </div>
    </div>
    <div id="invite-modal" class="modal">
      <div class="modal-overlay" data-close-modal="invite-modal"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>Convidar Funcionário</h2>
          <button class="modal-close" data-close-modal="invite-modal">✕</button>
        </div>
        <div class="modal-body">
          <div class="input-group">
            <label>Email do Funcionário</label>
            <input type="email" id="invite-email" class="input" placeholder="email@exemplo.com">
          </div>
          <div class="input-group">
            <label>Cargo</label>
            <select id="invite-role" class="input">
              <option value="employee">Funcionário</option>
              <option value="moderator">Moderador</option>
              <option value="manager">Gerente</option>
            </select>
          </div>
          <p class="text-muted">Se o email já estiver cadastrado, o cargo será atualizado automaticamente.</p>
        </div>
        <div class="modal-footer">
          <button class="btn" data-close-modal="invite-modal">Cancelar</button>
          <button class="btn btn-success" id="confirm-invite-btn">Enviar Convite</button>
        </div>
      </div>
    </div>
  `;
}

function renderUserModal(): string {
  const u = selectedUser;
  const vipBadge = u.credits?.is_unlimited ? '<span style="background: linear-gradient(135deg, #ffd700, #ff8c00); color: #000; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 700; margin-left: 0.5rem;">👑 VIP</span>' : '';
  const roleBadge = u.role && u.role !== 'user' ? `<span style="background: rgba(96,165,250,0.2); color: var(--accent-blue); padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600; margin-left: 0.5rem;">${u.role.toUpperCase()}</span>` : '';
  
  // Determinar status do usuário
  let statusBadge = '';
  let banInfoSection = '';
  
  if (u.is_banned || u.status === 'banned') {
    statusBadge = '<span style="background: rgba(255,107,107,0.2); color: #ff6b6b; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600;">🚫 BANIDO</span>';
    const bannedAt = u.banned_at ? new Date(u.banned_at).toLocaleDateString('pt-BR') : 'N/A';
    banInfoSection = `
      <div style="background: rgba(255,107,107,0.1); border: 1px solid rgba(255,107,107,0.3); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
        <h4 style="margin: 0 0 0.75rem 0; color: #ff6b6b; font-size: 0.9rem;">🚫 Informações do Banimento</h4>
        <div style="font-size: 0.85rem;">
          <div style="margin-bottom: 0.5rem;"><span style="color: var(--text-muted);">Motivo:</span> <strong>${u.ban_reason || 'Não especificado'}</strong></div>
          <div><span style="color: var(--text-muted);">Data:</span> ${bannedAt}</div>
        </div>
      </div>
    `;
  } else if (u.is_suspended || u.status === 'suspended') {
    const suspendedUntil = u.suspended_until ? new Date(u.suspended_until).toLocaleString('pt-BR') : 'N/A';
    statusBadge = `<span style="background: rgba(255,165,0,0.2); color: #ffa500; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600;">⏸️ SUSPENSO</span>`;
    banInfoSection = `
      <div style="background: rgba(255,165,0,0.1); border: 1px solid rgba(255,165,0,0.3); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
        <h4 style="margin: 0 0 0.75rem 0; color: #ffa500; font-size: 0.9rem;">⏸️ Informações da Suspensão</h4>
        <div style="font-size: 0.85rem;">
          <div style="margin-bottom: 0.5rem;"><span style="color: var(--text-muted);">Motivo:</span> <strong>${u.suspension_reason || u.ban_reason || 'Não especificado'}</strong></div>
          <div><span style="color: var(--text-muted);">Liberação em:</span> <strong style="color: var(--accent-green);">${suspendedUntil}</strong></div>
        </div>
      </div>
    `;
  } else {
    statusBadge = '<span style="background: rgba(0,255,136,0.2); color: var(--accent-green); padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600;">✅ ATIVO</span>';
  }
  
  const sacavel = (u.wallet?.winnings_balance || 0);
  const totalBalance = (u.wallet?.balance || 0);
  
  return `
    <div class="modal-header" style="border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem;">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-green), var(--accent-blue)); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; color: #000;">
          ${u.username?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <h2 style="margin: 0; display: flex; align-items: center; gap: 0.5rem;">
            ${u.username}
            ${vipBadge}
            ${roleBadge}
          </h2>
          <div style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem;">${u.email}</div>
          <div style="margin-top: 0.5rem;">${statusBadge}</div>
        </div>
      </div>
      <button class="modal-close" data-close-modal="user-modal">✕</button>
    </div>
    <div class="modal-body" style="max-height: 75vh; overflow-y: auto; padding: 1.5rem;">
      <!-- Navegação por abas -->
      <div class="user-modal-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; flex-wrap: wrap;">
        <button class="user-tab active" data-user-tab="profile" style="padding: 0.5rem 1rem; background: var(--accent-green); border: none; border-radius: 8px; color: #000; font-weight: 600; cursor: pointer;">👤 Perfil</button>
        <button class="user-tab" data-user-tab="wallet" style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.1); border: none; border-radius: 8px; color: var(--text-secondary); cursor: pointer;">💰 Carteira</button>
        <button class="user-tab" data-user-tab="transactions" style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.1); border: none; border-radius: 8px; color: var(--text-secondary); cursor: pointer;">💳 Transações</button>
        <button class="user-tab" data-user-tab="credits" style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.1); border: none; border-radius: 8px; color: var(--text-secondary); cursor: pointer;">🎫 Créditos</button>
        <button class="user-tab" data-user-tab="matches" style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.1); border: none; border-radius: 8px; color: var(--text-secondary); cursor: pointer;">🎮 Partidas</button>
        <button class="user-tab" data-user-tab="withdrawals" style="padding: 0.5rem 1rem; background: rgba(255,255,255,0.1); border: none; border-radius: 8px; color: var(--text-secondary); cursor: pointer;">💸 Saques</button>
      </div>

      <!-- Tab: Perfil -->
      <div class="user-tab-content" id="tab-profile">
        ${banInfoSection}
        
        <!-- Estatísticas em Grid Visual -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: rgba(0,255,136,0.1); padding: 1rem; border-radius: 12px; text-align: center;">
            <div style="font-size: 1.8rem; font-weight: 700; color: var(--accent-green);">${u.stats?.wins || 0}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Vitórias</div>
          </div>
          <div style="background: rgba(255,107,107,0.1); padding: 1rem; border-radius: 12px; text-align: center;">
            <div style="font-size: 1.8rem; font-weight: 700; color: #ff6b6b;">${u.stats?.losses || 0}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Derrotas</div>
          </div>
          <div style="background: rgba(96,165,250,0.1); padding: 1rem; border-radius: 12px; text-align: center;">
            <div style="font-size: 1.8rem; font-weight: 700; color: var(--accent-blue);">${u.stats?.win_rate || 0}%</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Win Rate</div>
          </div>
          <div style="background: rgba(255,165,2,0.1); padding: 1rem; border-radius: 12px; text-align: center;">
            <div style="font-size: 1.8rem; font-weight: 700; color: var(--accent-yellow);">${u.stats?.ranking_points || 0}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Ranking</div>
          </div>
        </div>

        <!-- Informações Básicas -->
        <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem;">
          <h4 style="margin: 0 0 1rem 0; color: var(--text-primary); font-size: 0.9rem;">📋 Informações Básicas</h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; font-size: 0.85rem;">
            <div><span style="color: var(--text-muted);">ID:</span> <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">${u.id?.slice(0, 8)}...</code></div>
            <div><span style="color: var(--text-muted);">CPF:</span> ${u.cpf || 'Não informado'}</div>
            <div><span style="color: var(--text-muted);">Criado em:</span> ${new Date(u.created_at).toLocaleDateString('pt-BR')}</div>
            <div><span style="color: var(--text-muted);">Partidas:</span> ${u.stats?.total_matches || 0}</div>
          </div>
        </div>

        <!-- Ações Rápidas -->
        <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 1.25rem;">
          <h4 style="margin: 0 0 1rem 0; color: var(--text-primary); font-size: 0.9rem;">⚡ Ações Rápidas</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            <button class="btn btn-sm btn-success" data-give-bonus="${u.id}" data-username="${u.username}" style="font-size: 0.8rem;">🎁 Dar Bônus</button>
            ${(u.is_banned || u.status === 'banned' || u.is_suspended || u.status === 'suspended')
              ? `<button class="btn btn-sm btn-success" data-unban-user="${u.id}" data-username="${u.username}" style="font-size: 0.8rem;">✅ Desbanir</button>`
              : `<button class="btn btn-sm btn-warning" data-open-ban-modal="${u.id}" data-username="${u.username}" style="font-size: 0.8rem;">🚫 Banir/Suspender</button>`
            }
            <button class="btn btn-sm" data-send-notification="${u.id}" style="font-size: 0.8rem;">📧 Notificar</button>
          </div>
        </div>
      </div>

      <!-- Tab: Carteira -->
      <div class="user-tab-content hidden" id="tab-wallet">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,255,136,0.05)); padding: 1.25rem; border-radius: 12px; text-align: center; border: 1px solid rgba(0,255,136,0.2);">
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-green);">R$ ${totalBalance.toFixed(2)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">💵 Saldo Total</div>
          </div>
          <div style="background: rgba(96,165,250,0.1); padding: 1.25rem; border-radius: 12px; text-align: center;">
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-blue);">R$ ${(u.wallet?.deposit_balance || 0).toFixed(2)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">📥 Depósitos</div>
          </div>
          <div style="background: rgba(0,255,136,0.1); padding: 1.25rem; border-radius: 12px; text-align: center;">
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-green);">R$ ${(u.wallet?.winnings_balance || 0).toFixed(2)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">🏆 Ganhos</div>
          </div>
          <div style="background: rgba(255,165,2,0.1); padding: 1.25rem; border-radius: 12px; text-align: center;">
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-yellow);">R$ ${(u.wallet?.bonus_balance || 0).toFixed(2)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">🎁 Bônus</div>
          </div>
        </div>
        
        <div style="background: linear-gradient(135deg, rgba(0,255,136,0.1), rgba(96,165,250,0.1)); padding: 1.25rem; border-radius: 12px; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">💸 Saldo Sacável</div>
              <div style="font-size: 1.3rem; font-weight: 700; color: var(--accent-green);">R$ ${sacavel.toFixed(2)}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.85rem; color: var(--text-muted);">🎫 Créditos</div>
              <div style="font-size: 1.3rem; font-weight: 700; color: var(--accent-yellow);">${u.credits?.amount || 0} ${u.credits?.is_unlimited ? '(∞)' : ''}</div>
            </div>
          </div>
        </div>

        <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 1.25rem;">
          <h4 style="margin: 0 0 1rem 0; color: var(--text-primary); font-size: 0.9rem;">🎁 Dar Bônus</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            <button class="btn btn-sm btn-success" data-give-bonus="${u.id}" data-username="${u.username}">🎁 Dar Bônus (Créditos)</button>
          </div>
        </div>
      </div>

      <!-- Tab: Transações -->
      <div class="user-tab-content hidden" id="tab-transactions">
        <div id="user-transactions-list" style="max-height: 400px; overflow-y: auto;">
          <p style="text-align: center; color: var(--text-muted); padding: 2rem;">
            <button class="btn btn-sm" id="load-user-transactions-btn" data-user-id="${u.id}">📋 Carregar Transações</button>
          </p>
        </div>
      </div>

      <!-- Tab: Créditos -->
      <div class="user-tab-content hidden" id="tab-credits">
        <div id="user-credits-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: rgba(0,255,136,0.1); padding: 1rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-green);" id="credits-earned">-</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Ganhos</div>
          </div>
          <div style="background: rgba(255,107,107,0.1); padding: 1rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 1.5rem; font-weight: 700; color: #ff6b6b;" id="credits-spent">-</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Usados</div>
          </div>
          <div style="background: rgba(255,165,2,0.1); padding: 1rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-yellow);" id="credits-bonus">-</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Bônus</div>
          </div>
          <div style="background: rgba(96,165,250,0.1); padding: 1rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-blue);" id="credits-net">-</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Saldo Líq.</div>
          </div>
        </div>
        <div id="user-credits-list" style="max-height: 300px; overflow-y: auto;">
          <p style="text-align: center; color: var(--text-muted); padding: 2rem;">
            <button class="btn btn-sm" id="load-user-credits-btn" data-user-id="${u.id}">🎫 Carregar Histórico de Créditos</button>
          </p>
        </div>
      </div>

      <!-- Tab: Partidas -->
      <div class="user-tab-content hidden" id="tab-matches">
        <div id="user-matches-list" style="max-height: 400px; overflow-y: auto;">
          <p style="text-align: center; color: var(--text-muted); padding: 2rem;">
            <button class="btn btn-sm" id="load-user-matches-btn" data-user-id="${u.id}">🎮 Carregar Histórico de Partidas</button>
          </p>
        </div>
      </div>

      <!-- Tab: Saques -->
      <div class="user-tab-content hidden" id="tab-withdrawals">
        <div id="user-withdrawals-list" style="max-height: 400px; overflow-y: auto;">
          <p style="text-align: center; color: var(--text-muted); padding: 2rem;">
            <button class="btn btn-sm" id="load-user-withdrawals-btn" data-user-id="${u.id}">💸 Carregar Histórico de Saques</button>
          </p>
        </div>
      </div>
    </div>
  `;
}

function renderMatchModal(): string {
  const m = selectedMatch;
  return `
    <div class="modal-header">
      <h2>Detalhes da Partida</h2>
      <button class="modal-close" data-close-modal="match-modal">✕</button>
    </div>
    <div class="modal-body">
      <div class="match-detail-grid">
        <p><strong>ID:</strong> ${m.id}</p>
        <p><strong>Status:</strong> <span class="status-badge ${m.status}">${m.status}</span></p>
        <p><strong>Modo:</strong> ${m.room?.mode || 'casual'}</p>
        <p><strong>Jogador 1:</strong> ${m.player1?.username || '?'}</p>
        <p><strong>Jogador 2:</strong> ${m.player2?.username || '?'}</p>
        <p><strong>Vencedor:</strong> ${m.winner?.username || 'Em andamento'}</p>
        <p><strong>Criada em:</strong> ${new Date(m.created_at).toLocaleString('pt-BR')}</p>
        ${m.bet ? `<p><strong>Aposta:</strong> R$ ${m.bet.total_pool?.toFixed(2)}</p>` : ''}
      </div>
      ${m.status === 'playing' ? `
        <div class="match-actions-section">
          <h4>Ações</h4>
          <button class="btn btn-danger" data-force-end-match="${m.id}">⏹️ Encerrar Partida</button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderTournamentForm(): string {
  // Calcular datas sugeridas
  const today = new Date();
  const minDate = today.toISOString().slice(0, 16);
  const suggestedRegStart = new Date(today.getTime() + 24 * 60 * 60 * 1000); // +1 dia
  const suggestedRegEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 dias
  const suggestedTournamentStart = new Date(suggestedRegEnd.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 dias após fim inscrições

  return `
    <div class="modal-header">
      <h2>Criar Torneio</h2>
      <button class="modal-close" data-close-modal="tournament-modal">✕</button>
    </div>
    <div class="modal-body">
      <form id="tournament-form" class="form-grid">
        <div class="form-group">
          <label>Nome do Torneio *</label>
          <input type="text" name="name" required placeholder="Ex: Torneio Semanal">
        </div>
        <div class="form-group">
          <label>Descrição</label>
          <textarea name="description" rows="2" placeholder="Descrição do torneio"></textarea>
        </div>
        
        <!-- PERÍODO DE INSCRIÇÕES -->
        <div style="background: rgba(255, 165, 2, 0.1); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid rgba(255, 165, 2, 0.3);">
          <h4 style="color: #ffa502; margin-bottom: 0.75rem; font-size: 0.9rem;">📅 Período de Inscrições</h4>
          <div class="form-row">
            <div class="form-group">
              <label>Início das Inscrições *</label>
              <input type="datetime-local" name="registration_start_date" min="${minDate}" value="${suggestedRegStart.toISOString().slice(0, 16)}" required>
            </div>
            <div class="form-group">
              <label>Término das Inscrições *</label>
              <input type="datetime-local" name="registration_end_date" min="${minDate}" value="${suggestedRegEnd.toISOString().slice(0, 16)}" required>
            </div>
          </div>
        </div>
        
        <!-- DATA DO TORNEIO -->
        <div class="form-group">
          <label>📆 Data de Início do Torneio *</label>
          <input type="datetime-local" name="start_date" min="${minDate}" value="${suggestedTournamentStart.toISOString().slice(0, 16)}" required>
          <small style="color: #888;">Recomendado: 2-3 dias após o término das inscrições</small>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Taxa de Inscrição (R$) *</label>
            <input type="number" step="1" name="entry_fee" value="10" min="0">
            <small style="color: #888;">0 = Torneio gratuito</small>
          </div>
          <div class="form-group">
            <label>Modo de Jogo</label>
            <select name="game_mode">
              <option value="15ball">🎱 8 Bolas (Lisas vs Listradas)</option>
              <option value="9ball">🔴🔵 9 Bolas (4x4)</option>
            </select>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Mín. Participantes</label>
            <input type="number" name="min_participants" value="4" min="4">
          </div>
          <div class="form-group">
            <label>Máx. Participantes</label>
            <select name="max_participants">
              <option value="8">8 jogadores</option>
              <option value="16" selected>16 jogadores</option>
              <option value="32">32 jogadores</option>
              <option value="64">64 jogadores</option>
            </select>
          </div>
        </div>
        
        <!-- INFO DE PREMIAÇÃO -->
        <div style="background: linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 153, 255, 0.1)); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid rgba(0, 255, 136, 0.3);">
          <h4 style="color: #00ff88; margin-bottom: 0.5rem;">💰 Premiação (calculada automaticamente)</h4>
          <p style="color: #888; font-size: 0.8rem; margin-bottom: 0.75rem;">
            O valor da premiação será definido automaticamente quando as inscrições encerrarem, baseado no total arrecadado.
          </p>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; text-align: center;">
            <div style="background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 6px;">
              <div style="font-size: 1.2rem; font-weight: bold; color: #00ff88;">70%</div>
              <div style="font-size: 0.7rem; color: #888;">Premiação</div>
            </div>
            <div style="background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 6px;">
              <div style="font-size: 1.2rem; font-weight: bold; color: #ffa502;">30%</div>
              <div style="font-size: 0.7rem; color: #888;">Plataforma</div>
            </div>
            <div style="background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 6px;">
              <div style="font-size: 0.9rem; font-weight: bold; color: #fff;" id="prize-estimate">-</div>
              <div style="font-size: 0.7rem; color: #888;">Estimativa</div>
            </div>
          </div>
        </div>
        
        <div class="form-group checkbox-group">
          <label><input type="checkbox" name="is_vip_only"> Apenas VIP</label>
        </div>
        <div class="form-group checkbox-group">
          <label><input type="checkbox" name="is_featured" checked> ⭐ Destacar no Carrossel</label>
          <small style="color: #888; display: block; margin-top: 0.25rem;">Torneios destacados aparecem no carrossel da página inicial</small>
        </div>
        <div class="form-row" id="featured-options" style="display: block;">
          <div class="form-group">
            <label>Ordem no Carrossel</label>
            <input type="number" name="featured_order" value="0" min="0" max="99">
            <small style="color: #888;">Menor número = aparece primeiro</small>
          </div>
          <div class="form-group">
            <label>Cor do Banner</label>
            <select name="banner_color">
              <option value="">Padrão (verde/azul)</option>
              <option value="#ffd700,#ff6b00">🏆 Dourado (VIP)</option>
              <option value="#00ff88,#0099ff">💚 Verde/Azul</option>
              <option value="#ff6b6b,#ee5a24">🔥 Vermelho/Laranja</option>
              <option value="#a55eea,#8854d0">💜 Roxo</option>
              <option value="#00d2d3,#01a3a4">🌊 Ciano</option>
            </select>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">🏆 Criar Torneio</button>
        </div>
      </form>
    </div>
  `;
}

// ==================== DASHBOARD ====================
function renderDashboard(): string {
  const stats = adminData.stats || {};
  const finance = adminData.financeDashboard || {};
  const pendingWithdrawals = (adminData.withdrawals || []).filter((w: any) => w.status === 'pending').length;
  const activeTournaments = (adminData.tournaments || []).filter((t: any) => ['open', 'in_progress'].includes(t.status)).length;
  
  // Atualizar timestamp
  lastUpdateTime = new Date();
  const lastUpdateStr = lastUpdateTime.toLocaleTimeString('pt-BR');

  return `
    <div class="admin-dashboard">
      <!-- Header com última atualização -->
      <div class="dashboard-header-info" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding: 0.75rem 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: var(--accent-green);">🔄</span>
          <span style="font-size: 0.85rem; color: var(--text-muted);">Atualização automática a cada 10s</span>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">
          Última atualização: <span id="last-update-time" style="color: var(--text-primary);">${lastUpdateStr}</span>
        </div>
      </div>
      
      <!-- Cards de Resumo Rápido -->
      <div class="dashboard-summary">
        <div class="summary-card users">
          <div class="summary-icon">👥</div>
          <div class="summary-content">
            <span class="summary-value">${stats.total_users || 0}</span>
            <span class="summary-label">Usuários Totais</span>
          </div>
          <div class="summary-trend">
            <span class="trend-value positive">+${stats.new_users_today || 0}</span>
            <span class="trend-label">hoje</span>
          </div>
        </div>
        
        <div class="summary-card games">
          <div class="summary-icon">🎮</div>
          <div class="summary-content">
            <span class="summary-value">${stats.total_matches || 0}</span>
            <span class="summary-label">Partidas Totais</span>
          </div>
          <div class="summary-trend">
            <span class="trend-value">${stats.matches_today || 0}</span>
            <span class="trend-label">hoje</span>
          </div>
        </div>
        
        <div class="summary-card finance">
          <div class="summary-icon">💰</div>
          <div class="summary-content">
            <span class="summary-value">R$ ${(finance.revenue?.total || 0).toFixed(2)}</span>
            <span class="summary-label">Receita Total</span>
          </div>
          <div class="summary-trend">
            <span class="trend-value positive">+R$ ${(finance.revenue?.today || 0).toFixed(2)}</span>
            <span class="trend-label">hoje</span>
          </div>
        </div>
        
        <div class="summary-card alerts ${pendingWithdrawals > 0 ? 'has-alerts' : ''}">
          <div class="summary-icon">⚠️</div>
          <div class="summary-content">
            <span class="summary-value">${pendingWithdrawals}</span>
            <span class="summary-label">Saques Pendentes</span>
          </div>
          ${pendingWithdrawals > 0 ? `
            <button class="summary-action" data-admin-tab="withdrawals">Ver →</button>
          ` : ''}
        </div>
      </div>

      <!-- Módulos do Dashboard -->
      <div class="dashboard-modules">
        <!-- Módulo Financeiro -->
        <div class="dashboard-module finance-module">
          <div class="module-header">
            <h3>💰 Financeiro</h3>
            <button class="btn btn-ghost btn-sm" data-admin-tab="finance">Ver detalhes →</button>
          </div>
          <div class="module-content">
            <div class="finance-grid">
              <div class="finance-item">
                <span class="finance-label">Receita Hoje</span>
                <span class="finance-value positive">R$ ${(finance.revenue?.today || 0).toFixed(2)}</span>
              </div>
              <div class="finance-item">
                <span class="finance-label">Receita Semana</span>
                <span class="finance-value">R$ ${(finance.revenue?.week || 0).toFixed(2)}</span>
              </div>
              <div class="finance-item">
                <span class="finance-label">Receita Mês</span>
                <span class="finance-value">R$ ${(finance.revenue?.month || 0).toFixed(2)}</span>
              </div>
              <div class="finance-item">
                <span class="finance-label">Apostas Ativas</span>
                <span class="finance-value">${finance.bets?.active_count || 0}</span>
              </div>
              <div class="finance-item">
                <span class="finance-label">Pool de Apostas</span>
                <span class="finance-value">R$ ${(finance.bets?.active_pool || 0).toFixed(2)}</span>
              </div>
              <div class="finance-item">
                <span class="finance-label">Taxa Plataforma (Hoje)</span>
                <span class="finance-value positive">R$ ${(finance.bets?.platform_fee_today || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Módulo Jogos -->
        <div class="dashboard-module games-module">
          <div class="module-header">
            <h3>🎮 Jogos</h3>
            <button class="btn btn-ghost btn-sm" data-admin-tab="matches">Ver partidas →</button>
          </div>
          <div class="module-content">
            <div class="games-stats">
              <div class="game-stat">
                <div class="game-stat-icon">🎱</div>
                <div class="game-stat-info">
                  <span class="game-stat-value">${stats.matches_today || 0}</span>
                  <span class="game-stat-label">Partidas Hoje</span>
                </div>
              </div>
              <div class="game-stat">
                <div class="game-stat-icon">🏆</div>
                <div class="game-stat-info">
                  <span class="game-stat-value">${activeTournaments}</span>
                  <span class="game-stat-label">Torneios Ativos</span>
                </div>
              </div>
              <div class="game-stat">
                <div class="game-stat-icon">🔴</div>
                <div class="game-stat-info">
                  <span class="game-stat-value">${stats.live_matches || 0}</span>
                  <span class="game-stat-label">Ao Vivo Agora</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Módulo Usuários -->
        <div class="dashboard-module users-module">
          <div class="module-header">
            <h3>👥 Usuários Recentes</h3>
            <button class="btn btn-ghost btn-sm" data-admin-tab="users">Ver todos →</button>
          </div>
          <div class="module-content">
            <div class="users-list">
              ${(stats.recent_users || []).slice(0, 5).map((u: any) => `
                <div class="user-item">
                  <div class="user-avatar">${u.username?.[0]?.toUpperCase() || '?'}</div>
                  <div class="user-info">
                    <span class="user-name">${u.username}</span>
                    <span class="user-date">${new Date(u.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              `).join('') || '<p class="empty-text">Nenhum usuário recente</p>'}
            </div>
          </div>
        </div>

        <!-- Módulo Ações Rápidas -->
        <div class="dashboard-module actions-module">
          <div class="module-header">
            <h3>⚡ Ações Rápidas</h3>
          </div>
          <div class="module-content">
            <div class="quick-actions">
              <button class="quick-action" data-admin-tab="users">
                <span class="quick-action-icon">👤</span>
                <span class="quick-action-label">Gerenciar Usuários</span>
              </button>
              <button class="quick-action" data-admin-tab="withdrawals">
                <span class="quick-action-icon">💸</span>
                <span class="quick-action-label">Processar Saques</span>
                ${pendingWithdrawals > 0 ? `<span class="quick-action-badge">${pendingWithdrawals}</span>` : ''}
              </button>
              <button class="quick-action" data-admin-tab="tournaments">
                <span class="quick-action-icon">🏆</span>
                <span class="quick-action-label">Criar Torneio</span>
              </button>
              <button class="quick-action" data-admin-tab="banners">
                <span class="quick-action-icon">🖼️</span>
                <span class="quick-action-label">Gerenciar Banners</span>
              </button>
              <button class="quick-action" data-admin-tab="coupons">
                <span class="quick-action-icon">🎟️</span>
                <span class="quick-action-label">Criar Cupom</span>
              </button>
              <button class="quick-action" data-admin-tab="settings">
                <span class="quick-action-icon">⚙️</span>
                <span class="quick-action-label">Configurações</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <style>
      .admin-dashboard {
        padding: 0;
      }

      /* Summary Cards */
      .dashboard-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
      }

      .summary-card {
        background: var(--bg-secondary);
        border-radius: 16px;
        padding: 1.5rem;
        display: flex;
        align-items: center;
        gap: 1rem;
        border: 1px solid var(--border-color);
        transition: all 0.2s;
      }

      .summary-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }

      .summary-card.users { border-left: 4px solid #60a5fa; }
      .summary-card.games { border-left: 4px solid #a78bfa; }
      .summary-card.finance { border-left: 4px solid #34d399; }
      .summary-card.alerts { border-left: 4px solid #fbbf24; }
      .summary-card.alerts.has-alerts { border-left-color: #f87171; background: rgba(248, 113, 113, 0.1); }

      .summary-icon {
        font-size: 2.5rem;
      }

      .summary-content {
        flex: 1;
      }

      .summary-value {
        display: block;
        font-size: 1.8rem;
        font-weight: 800;
        color: var(--text-primary);
      }

      .summary-label {
        font-size: 0.85rem;
        color: var(--text-muted);
      }

      .summary-trend {
        text-align: right;
      }

      .trend-value {
        display: block;
        font-size: 1rem;
        font-weight: 700;
        color: var(--text-secondary);
      }

      .trend-value.positive { color: var(--accent-green); }
      .trend-value.negative { color: var(--accent-red); }

      .trend-label {
        font-size: 0.75rem;
        color: var(--text-muted);
      }

      .summary-action {
        background: var(--accent-yellow);
        color: #000;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.85rem;
      }

      /* Dashboard Modules */
      .dashboard-modules {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1.5rem;
      }

      @media (max-width: 1200px) {
        .dashboard-modules {
          grid-template-columns: 1fr;
        }
      }

      .dashboard-module {
        background: var(--bg-secondary);
        border-radius: 16px;
        border: 1px solid var(--border-color);
        overflow: hidden;
      }

      .module-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--border-color);
        background: rgba(255, 255, 255, 0.02);
      }

      .module-header h3 {
        margin: 0;
        font-size: 1rem;
        color: var(--text-primary);
      }

      .module-content {
        padding: 1.5rem;
      }

      /* Finance Module */
      .finance-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
      }

      .finance-item {
        text-align: center;
        padding: 1rem;
        background: var(--bg-tertiary);
        border-radius: 8px;
      }

      .finance-label {
        display: block;
        font-size: 0.75rem;
        color: var(--text-muted);
        margin-bottom: 0.5rem;
      }

      .finance-value {
        font-size: 1.2rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .finance-value.positive { color: var(--accent-green); }

      /* Games Module */
      .games-stats {
        display: flex;
        gap: 1.5rem;
      }

      .game-stat {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex: 1;
        padding: 1rem;
        background: var(--bg-tertiary);
        border-radius: 8px;
      }

      .game-stat-icon {
        font-size: 2rem;
      }

      .game-stat-value {
        display: block;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .game-stat-label {
        font-size: 0.8rem;
        color: var(--text-muted);
      }

      /* Users Module */
      .users-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .user-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem;
        background: var(--bg-tertiary);
        border-radius: 8px;
      }

      .user-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--accent-green), var(--accent-blue));
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        color: #000;
      }

      .user-info {
        flex: 1;
      }

      .user-name {
        display: block;
        font-weight: 600;
        color: var(--text-primary);
      }

      .user-date {
        font-size: 0.8rem;
        color: var(--text-muted);
      }

      .empty-text {
        color: var(--text-muted);
        text-align: center;
        padding: 1rem;
      }

      /* Quick Actions */
      .quick-actions {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
      }

      .quick-action {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1.25rem 1rem;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
      }

      .quick-action:hover {
        background: rgba(0, 255, 136, 0.1);
        border-color: var(--accent-green);
      }

      .quick-action-icon {
        font-size: 1.5rem;
      }

      .quick-action-label {
        font-size: 0.8rem;
        color: var(--text-secondary);
        text-align: center;
      }

      .quick-action-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background: var(--accent-red);
        color: #fff;
        font-size: 0.7rem;
        font-weight: 700;
        padding: 0.2rem 0.5rem;
        border-radius: 10px;
        min-width: 20px;
        text-align: center;
      }

      @media (max-width: 768px) {
        .finance-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        .games-stats {
          flex-direction: column;
        }

        .quick-actions {
          grid-template-columns: repeat(2, 1fr);
        }
      }
    </style>
  `;
}

// ==================== USERS ====================
function renderUsers(): string {
  const users = adminData.users || [];
  const state = gameStore.getState();
  const isSuperAdmin = state.user?.role === 'super_admin';

  // Função para determinar status do usuário
  const getUserStatus = (u: any) => {
    if (u.is_banned || u.status === 'banned') {
      return { label: '🚫 Banido', class: 'banned', color: '#ff6b6b' };
    }
    if (u.is_suspended || u.status === 'suspended') {
      const until = u.suspended_until ? new Date(u.suspended_until) : null;
      const untilStr = until ? ` até ${until.toLocaleDateString('pt-BR')}` : '';
      return { label: `⏸️ Suspenso${untilStr}`, class: 'suspended', color: '#ffa500' };
    }
    return { label: '✅ Ativo', class: 'active', color: '#00ff88' };
  };

  return `
    <div class="admin-users">
      <div class="admin-toolbar">
        <input type="text" class="admin-search" placeholder="Buscar usuário..." id="user-search">
        <select class="admin-select" id="user-status-filter" style="margin-left: 0.5rem;">
          <option value="">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="suspended">Suspensos</option>
          <option value="banned">Banidos</option>
        </select>
        <button class="btn btn-primary" id="refresh-users-btn">🔄 Atualizar</button>
      </div>

      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Email</th>
              <th>Créditos</th>
              <th>Saldo</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${users.map((u: any) => {
              const status = getUserStatus(u);
              const isBannedOrSuspended = u.is_banned || u.status === 'banned' || u.is_suspended || u.status === 'suspended';
              return `
              <tr style="${isBannedOrSuspended ? 'opacity: 0.8; background: rgba(255,107,107,0.05);' : ''}">
                <td>
                  <div class="user-cell">
                    <span class="user-avatar" style="${isBannedOrSuspended ? 'opacity: 0.6;' : ''}">${u.username?.[0]?.toUpperCase() || '?'}</span>
                    <div style="display: flex; flex-direction: column;">
                      <span>${u.username}</span>
                      ${u.ban_reason ? `<small style="color: var(--text-muted); font-size: 0.7rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${u.ban_reason}">📋 ${u.ban_reason.substring(0, 30)}...</small>` : ''}
                    </div>
                  </div>
                </td>
                <td>${u.email}</td>
                <td>${u.credits?.amount || 0}</td>
                <td>R$ ${(u.wallet?.balance || 0).toFixed(2)}</td>
                <td>
                  <span class="status-badge ${status.class}" style="background: ${status.color}20; color: ${status.color}; border: 1px solid ${status.color}40;">
                    ${status.label}
                  </span>
                </td>
                <td>
                  <div class="action-buttons">
                    <button class="btn-icon" title="Detalhes" data-view-user="${u.id}">👁️</button>
                    <button class="btn-icon" title="Dar Bônus" data-give-bonus="${u.id}" data-username="${u.username}">🎁</button>
                    ${(u.is_banned || u.status === 'banned' || u.is_suspended || u.status === 'suspended')
                      ? `<button class="btn-icon btn-success" title="Desbanir/Dessuspender" data-unban-user="${u.id}" data-username="${u.username}">✅</button>`
                      : `<button class="btn-icon btn-warning" title="Banir/Suspender" data-open-ban-modal="${u.id}" data-username="${u.username}">🚫</button>`
                    }
                    ${isSuperAdmin && u.role !== 'super_admin' ? `<button class="btn-icon btn-danger" title="Deletar Permanentemente" data-delete-user="${u.id}" data-username="${u.username}">🗑️</button>` : ''}
                  </div>
                </td>
              </tr>
            `;}).join('') || '<tr><td colspan="6" class="empty">Nenhum usuário encontrado</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Dar Bônus -->
    <div id="give-bonus-modal" class="modal">
      <div class="modal-overlay" data-close-modal="give-bonus-modal"></div>
      <div class="modal-content">
        <div class="modal-header" style="background: linear-gradient(135deg, rgba(0,255,136,0.1), rgba(255,215,0,0.1)); border-bottom: 1px solid rgba(0,255,136,0.2);">
          <h2 style="display: flex; align-items: center; gap: 0.5rem;">🎁 Dar Bônus</h2>
          <button class="modal-close" data-close-modal="give-bonus-modal">✕</button>
        </div>
        <div class="modal-body">
          <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <p style="margin: 0;">Dar bônus para: <strong id="bonus-username" style="color: var(--accent-green);"></strong></p>
          </div>
          <input type="hidden" id="bonus-user-id">
          
          <div class="input-group" style="margin-bottom: 1rem;">
            <label style="font-weight: 600;">Quantidade de Bônus (Créditos)</label>
            <input type="number" id="bonus-amount" class="input" min="1" value="10" placeholder="Ex: 10">
            <small class="input-hint">Cada bônus = 1 crédito para jogar partidas</small>
          </div>
          
          <div class="input-group" style="margin-bottom: 1rem;">
            <label style="font-weight: 600;">Motivo do Bônus</label>
            <select id="bonus-reason-preset" class="input" style="margin-bottom: 0.5rem;">
              <option value="">Selecione um motivo...</option>
              <option value="Bônus promocional">🎉 Bônus Promocional</option>
              <option value="Compensação por problema técnico">🔧 Compensação Técnica</option>
              <option value="Prêmio de evento">🏆 Prêmio de Evento</option>
              <option value="Bônus de fidelidade">💎 Bônus de Fidelidade</option>
              <option value="Recompensa por indicação">👥 Recompensa por Indicação</option>
              <option value="Bônus de boas-vindas">👋 Bônus de Boas-vindas</option>
              <option value="Missão completada">🎯 Missão Completada</option>
              <option value="custom">✏️ Outro (personalizado)</option>
            </select>
            <input type="text" id="bonus-reason-custom" class="input" placeholder="Digite o motivo personalizado..." style="display: none;">
          </div>
          
          <div style="background: rgba(0,136,255,0.1); padding: 1rem; border-radius: 8px; font-size: 0.85rem;">
            <strong>ℹ️ Informação:</strong>
            <ul style="margin: 0.5rem 0 0 1rem; padding: 0; color: var(--text-muted);">
              <li>Bônus são convertidos em créditos para jogar</li>
              <li>O usuário será notificado sobre o bônus recebido</li>
              <li>Esta ação é registrada nos logs de auditoria</li>
            </ul>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" data-close-modal="give-bonus-modal">Cancelar</button>
          <button class="btn btn-success" id="confirm-give-bonus-btn">🎁 Dar Bônus</button>
        </div>
      </div>
    </div>

    <!-- Modal Banir/Suspender Usuário -->
    <div id="ban-user-modal" class="modal">
      <div class="modal-overlay" data-close-modal="ban-user-modal"></div>
      <div class="modal-content" style="max-width: 550px;">
        <div class="modal-header" style="background: linear-gradient(135deg, rgba(255,107,107,0.2), rgba(255,165,0,0.2)); border-bottom: 1px solid rgba(255,107,107,0.3);">
          <h2 style="display: flex; align-items: center; gap: 0.5rem;">🚫 Banir/Suspender Usuário</h2>
          <button class="modal-close" data-close-modal="ban-user-modal">✕</button>
        </div>
        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
          <input type="hidden" id="ban-user-id">
          
          <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <p style="margin: 0;">Aplicar punição para: <strong id="ban-username" style="color: var(--accent-yellow);"></strong></p>
          </div>

          <!-- Tipo de Punição -->
          <div class="input-group" style="margin-bottom: 1rem;">
            <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Tipo de Punição</label>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; background: rgba(255,165,0,0.1); border: 2px solid rgba(255,165,0,0.3); border-radius: 8px; cursor: pointer; flex: 1; min-width: 150px;">
                <input type="radio" name="ban-type" value="suspension" checked style="accent-color: #ffa500;">
                <div>
                  <div style="font-weight: 600; color: #ffa500;">⏸️ Suspensão</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">Temporária - conta volta após período</div>
                </div>
              </label>
              <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; background: rgba(255,107,107,0.1); border: 2px solid rgba(255,107,107,0.3); border-radius: 8px; cursor: pointer; flex: 1; min-width: 150px;">
                <input type="radio" name="ban-type" value="ban" style="accent-color: #ff6b6b;">
                <div>
                  <div style="font-weight: 600; color: #ff6b6b;">🚫 Banimento</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">Permanente - conta bloqueada</div>
                </div>
              </label>
            </div>
          </div>

          <!-- Duração (apenas para suspensão) -->
          <div class="input-group" id="ban-duration-group" style="margin-bottom: 1rem;">
            <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Duração da Suspensão</label>
            <select id="ban-duration" class="input" style="width: 100%;">
              <option value="1">1 hora</option>
              <option value="6">6 horas</option>
              <option value="12">12 horas</option>
              <option value="24" selected>24 horas (1 dia)</option>
              <option value="48">48 horas (2 dias)</option>
              <option value="72">72 horas (3 dias)</option>
              <option value="168">7 dias (1 semana)</option>
              <option value="336">14 dias (2 semanas)</option>
              <option value="720">30 dias (1 mês)</option>
            </select>
          </div>

          <!-- Motivo Pré-definido -->
          <div class="input-group" style="margin-bottom: 1rem;">
            <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Motivo da Punição</label>
            <select id="ban-reason-code" class="input" style="width: 100%;">
              <option value="FRAUDE">🚨 Fraude/Golpe - Tentativa de fraude ou golpe na plataforma</option>
              <option value="HACK">💻 Hack/Trapaça - Uso de hacks, cheats ou exploits</option>
              <option value="MULTI_CONTA">👥 Múltiplas Contas - Criação de múltiplas contas para burlar regras</option>
              <option value="ABUSO_BONUS">🎁 Abuso de Bônus - Abuso do sistema de bônus ou promoções</option>
              <option value="LINGUAGEM">🗣️ Linguagem Ofensiva - Uso de linguagem ofensiva ou discriminatória</option>
              <option value="ASSEDIO">⚠️ Assédio - Assédio a outros jogadores</option>
              <option value="SPAM">📢 Spam - Envio de spam ou publicidade não autorizada</option>
              <option value="ABANDONO">🚪 Abandono Recorrente - Abandono frequente de partidas</option>
              <option value="MANIPULACAO">🎲 Manipulação de Partidas - Manipulação de resultados</option>
              <option value="PAGAMENTO">💳 Problema de Pagamento - Chargeback ou problemas com pagamentos</option>
              <option value="MENOR_IDADE">🔞 Menor de Idade - Usuário menor de 18 anos</option>
              <option value="OUTROS">📋 Outros - Outros motivos não listados</option>
            </select>
          </div>

          <!-- Descrição Adicional -->
          <div class="input-group" style="margin-bottom: 1rem;">
            <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">Descrição Adicional (opcional)</label>
            <textarea id="ban-reason-detail" class="input" rows="3" placeholder="Descreva detalhes adicionais sobre a punição..." style="width: 100%; resize: vertical;"></textarea>
          </div>

          <!-- Opção de deletar dados (apenas para banimento permanente) -->
          <div id="ban-delete-data-group" style="display: none; margin-bottom: 1rem; padding: 1rem; background: rgba(255,71,87,0.1); border: 1px solid rgba(255,71,87,0.3); border-radius: 8px;">
            <label style="display: flex; align-items: flex-start; gap: 0.75rem; cursor: pointer;">
              <input type="checkbox" id="ban-delete-data" style="margin-top: 0.25rem; accent-color: #ff4757;">
              <div>
                <div style="font-weight: 600; color: #ff4757;">🗑️ Deletar todos os dados do usuário</div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                  ⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL! Todos os dados do usuário serão permanentemente excluídos do banco de dados (histórico, saldos, créditos, estatísticas, etc).
                </div>
              </div>
            </label>
          </div>

          <!-- Aviso -->
          <div style="padding: 0.75rem; background: rgba(255,165,0,0.1); border-radius: 8px; font-size: 0.85rem; color: var(--text-muted);">
            <strong>ℹ️ Informação:</strong> O usuário verá o motivo da punição ao tentar acessar a plataforma.
          </div>
        </div>
        <div class="modal-footer" style="border-top: 1px solid rgba(255,255,255,0.1);">
          <button class="btn" data-close-modal="ban-user-modal">Cancelar</button>
          <button class="btn btn-danger" id="confirm-ban-user-btn" style="background: linear-gradient(135deg, #ff6b6b, #ff4757);">🚫 Aplicar Punição</button>
        </div>
      </div>
    </div>
  `;
}

// ==================== MATCHES ====================
function renderMatches(): string {
  const matches = adminData.matches || [];

  return `
    <div class="admin-matches">
      <div class="admin-toolbar">
        <select class="admin-select" id="match-filter">
          <option value="">Todos os status</option>
          <option value="waiting">Aguardando</option>
          <option value="playing">Em andamento</option>
          <option value="finished">Finalizadas</option>
        </select>
        <button class="btn btn-primary" id="refresh-matches-btn">🔄 Atualizar</button>
      </div>

      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Jogadores</th>
              <th>Modo</th>
              <th>Status</th>
              <th>Data</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${matches.map((m: any) => `
              <tr>
                <td><code>${m.id?.slice(0, 8)}...</code></td>
                <td>${m.player1?.username || '?'} vs ${m.player2?.username || '?'}</td>
                <td>${m.room?.mode || 'casual'}</td>
                <td>
                  <span class="status-badge ${m.status}">
                    ${m.status === 'playing' ? 'Em jogo' : m.status === 'finished' ? 'Finalizada' : 'Aguardando'}
                  </span>
                </td>
                <td>${new Date(m.created_at).toLocaleDateString('pt-BR')}</td>
                <td>
                  <div class="action-buttons">
                    <button class="btn-icon" title="Ver" data-view-match="${m.id}">👁️</button>
                    ${m.status === 'playing' ? `<button class="btn-icon" title="Encerrar" data-end-match="${m.id}">⏹️</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="6" class="empty">Nenhuma partida encontrada</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ==================== FINANCE ====================
function renderFinance(): string {
  const finance = adminData.financeDashboard || {};
  const bonus = finance.bonus || {};
  const revenue = finance.revenue || {};

  // Calcular gastos totais
  const expenseWithdrawals = finance.withdrawals?.pending_amount || 0;
  const expenseBonusBalance = bonus.adminGiven?.balance || 0;
  const expenseBonusCredits = (bonus.adminGiven?.credits || 0) * 0.5;
  const expenseDailyCredits = (bonus.byType?.daily_free || 0) * 0.5;
  const expenseReferral = (bonus.byType?.referral || 0) * 0.5;
  const expenseWelcome = (bonus.byType?.welcome || 0) * 0.5;
  const expenseCoupon = bonus.byType?.coupon || 0;
  const expenseMission = (bonus.byType?.mission || 0) * 0.5;

  const totalExpenses = expenseWithdrawals + expenseBonusBalance + expenseBonusCredits + 
                        expenseDailyCredits + expenseReferral + expenseWelcome + expenseCoupon + expenseMission;
  const totalRevenue = revenue.total || 0;
  const netProfit = totalRevenue - totalExpenses;

  return `
    <div class="admin-finance">
      <!-- SELETOR DE PERÍODO -->
      <div class="finance-period-selector" style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; align-items: center;">
        <span style="color: var(--text-muted); margin-right: 0.5rem;">Período:</span>
        <button class="btn btn-sm btn-primary" data-finance-period="today">📅 Hoje</button>
        <button class="btn btn-sm" data-finance-period="week">📆 Semana</button>
        <button class="btn btn-sm" data-finance-period="month">🗓️ Mês</button>
        <button class="btn btn-sm btn-ghost" id="refresh-finance-btn">🔄 Atualizar</button>
      </div>

      <!-- RESUMO GERAL - LUCRO/PREJUÍZO -->
      <div class="finance-summary-card" style="background: linear-gradient(135deg, ${netProfit >= 0 ? 'rgba(0,255,136,0.15)' : 'rgba(255,71,87,0.15)'}, var(--bg-card)); border: 2px solid ${netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}; border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; text-align: center;">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">📥 RECEITA TOTAL</div>
            <div style="font-size: 2rem; font-weight: 800; color: var(--accent-green);">R$ ${totalRevenue.toFixed(2)}</div>
          </div>
          <div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">📤 GASTOS TOTAIS</div>
            <div style="font-size: 2rem; font-weight: 800; color: var(--accent-red);">R$ ${totalExpenses.toFixed(2)}</div>
          </div>
          <div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">${netProfit >= 0 ? '📈 LUCRO LÍQUIDO' : '📉 PREJUÍZO'}</div>
            <div style="font-size: 2rem; font-weight: 800; color: ${netProfit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">R$ ${Math.abs(netProfit).toFixed(2)}</div>
          </div>
        </div>
      </div>

      <!-- SEÇÃO: RECEITAS -->
      <h3 style="margin-bottom: 1rem; color: var(--accent-green);">📥 RECEITAS (Entradas)</h3>
      <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">Dinheiro que entra na plataforma</p>
      
      <div class="stats-grid" style="margin-bottom: 1.5rem;">
        <div class="stat-card green">
          <div class="stat-icon">💳</div>
          <div class="stat-info">
            <span class="stat-value">R$ ${(revenue.byType?.payments || 0).toFixed(2)}</span>
            <span class="stat-label">Depósitos PIX/Cartão</span>
          </div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">🎰</div>
          <div class="stat-info">
            <span class="stat-value">R$ ${(revenue.byType?.bet_commissions || 0).toFixed(2)}</span>
            <span class="stat-label">Comissão Apostas (10%)</span>
          </div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">👑</div>
          <div class="stat-info">
            <span class="stat-value">R$ ${(revenue.byType?.subscriptions || 0).toFixed(2)}</span>
            <span class="stat-label">Assinaturas VIP</span>
          </div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">🏆</div>
          <div class="stat-info">
            <span class="stat-value">R$ ${(revenue.byType?.tournament_commissions || 0).toFixed(2)}</span>
            <span class="stat-label">Comissão Torneios</span>
          </div>
        </div>
      </div>

      <!-- SEÇÃO: GASTOS -->
      <h3 style="margin-bottom: 1rem; color: var(--accent-red);">📤 GASTOS (Saídas)</h3>
      <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">Dinheiro que sai da plataforma - saques e bônus</p>
      
      <div class="admin-card" style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem;">💸 Detalhamento de Gastos</h4>
        <div class="balance-breakdown">
          <div class="balance-item" style="border-left: 3px solid var(--accent-red); padding-left: 1rem;">
            <span>💸 Saques Pagos aos Jogadores</span>
            <span style="color: var(--accent-red);">-R$ ${expenseWithdrawals.toFixed(2)}</span>
          </div>
          <div class="balance-item" style="border-left: 3px solid var(--accent-yellow); padding-left: 1rem;">
            <span>🎁 Bônus Admin (Saldo R$)</span>
            <span style="color: var(--accent-red);">-R$ ${expenseBonusBalance.toFixed(2)}</span>
          </div>
          <div class="balance-item" style="border-left: 3px solid var(--accent-yellow); padding-left: 1rem;">
            <span>🎫 Bônus Admin (${bonus.adminGiven?.credits || 0} créditos)</span>
            <span style="color: var(--accent-red);">-R$ ${expenseBonusCredits.toFixed(2)}</span>
          </div>
          <div class="balance-item" style="border-left: 3px solid var(--accent-blue); padding-left: 1rem;">
            <span>📅 Créditos Diários Grátis (${bonus.byType?.daily_free || 0} créditos)</span>
            <span style="color: var(--accent-red);">-R$ ${expenseDailyCredits.toFixed(2)}</span>
          </div>
          <div class="balance-item" style="border-left: 3px solid var(--accent-purple); padding-left: 1rem;">
            <span>👥 Bônus Indicação (${bonus.byType?.referral || 0} créditos)</span>
            <span style="color: var(--accent-red);">-R$ ${expenseReferral.toFixed(2)}</span>
          </div>
          <div class="balance-item" style="border-left: 3px solid var(--accent-purple); padding-left: 1rem;">
            <span>👋 Bônus Boas-vindas (${bonus.byType?.welcome || 0} créditos)</span>
            <span style="color: var(--accent-red);">-R$ ${expenseWelcome.toFixed(2)}</span>
          </div>
          <div class="balance-item" style="border-left: 3px solid var(--accent-purple); padding-left: 1rem;">
            <span>🎟️ Cupons de Desconto</span>
            <span style="color: var(--accent-red);">-R$ ${expenseCoupon.toFixed(2)}</span>
          </div>
          <div class="balance-item" style="border-left: 3px solid var(--accent-purple); padding-left: 1rem;">
            <span>🎯 Recompensas Missões (${bonus.byType?.mission || 0} créditos)</span>
            <span style="color: var(--accent-red);">-R$ ${expenseMission.toFixed(2)}</span>
          </div>
          <div class="balance-item" style="background: rgba(255,71,87,0.1); padding: 1rem; border-radius: 8px; font-weight: 700; margin-top: 0.5rem;">
            <span>📤 TOTAL DE GASTOS</span>
            <span style="color: var(--accent-red); font-size: 1.1rem;">-R$ ${totalExpenses.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <!-- SEÇÃO: SAQUES E SALDOS -->
      <div class="admin-grid" style="margin-bottom: 2rem;">
        <div class="admin-card">
          <h4>💸 Saques</h4>
          <div class="balance-breakdown">
            <div class="balance-item">
              <span>⏳ Pendentes</span>
              <span style="color: var(--accent-yellow);">${finance.withdrawals?.pending_count || 0} (R$ ${(finance.withdrawals?.pending_amount || 0).toFixed(2)})</span>
            </div>
            <div class="balance-item">
              <span>✅ Aprovados Hoje</span>
              <span style="color: var(--accent-green);">${finance.withdrawals?.approved_today || 0}</span>
            </div>
            <div class="balance-item">
              <span>❌ Rejeitados Hoje</span>
              <span style="color: var(--accent-red);">${finance.withdrawals?.rejected_today || 0}</span>
            </div>
          </div>
          <button class="btn btn-sm btn-primary" data-admin-tab="withdrawals" style="margin-top: 1rem;">Ver Saques →</button>
        </div>

        <div class="admin-card">
          <h4>👛 Saldos dos Usuários</h4>
          <div class="balance-breakdown">
            <div class="balance-item">
              <span>💵 Total na Plataforma</span>
              <span style="font-weight: 700;">R$ ${(finance.users?.total_balance || 0).toFixed(2)}</span>
            </div>
            <div class="balance-item">
              <span>📥 Depósitos</span>
              <span>R$ ${(finance.users?.total_deposit_balance || 0).toFixed(2)}</span>
            </div>
            <div class="balance-item">
              <span>🏆 Ganhos (sacável)</span>
              <span style="color: var(--accent-green);">R$ ${(finance.users?.total_winnings_balance || 0).toFixed(2)}</span>
            </div>
            <div class="balance-item">
              <span>🎁 Bônus (sacável)</span>
              <span style="color: var(--accent-yellow);">R$ ${(finance.users?.total_bonus_balance || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- APOSTAS -->
      <div class="admin-card" style="margin-bottom: 2rem;">
        <h4>🎰 Apostas em Andamento</h4>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">🎮</div>
            <div class="stat-info">
              <span class="stat-value">${finance.bets?.active_count || 0}</span>
              <span class="stat-label">Apostas Ativas</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div class="stat-info">
              <span class="stat-value">R$ ${(finance.bets?.active_pool || 0).toFixed(2)}</span>
              <span class="stat-label">Pool Total</span>
            </div>
          </div>
          <div class="stat-card green">
            <div class="stat-icon">📅</div>
            <div class="stat-info">
              <span class="stat-value">R$ ${(finance.bets?.platform_fee_today || 0).toFixed(2)}</span>
              <span class="stat-label">Comissão Hoje</span>
            </div>
          </div>
          <div class="stat-card green">
            <div class="stat-icon">🗓️</div>
            <div class="stat-info">
              <span class="stat-value">R$ ${(finance.bets?.platform_fee_month || 0).toFixed(2)}</span>
              <span class="stat-label">Comissão Mês</span>
            </div>
          </div>
        </div>
      </div>

      <!-- LEGENDA -->
      <div class="admin-card" style="background: rgba(255,255,255,0.02);">
        <h4>📖 Como Interpretar os Relatórios</h4>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; font-size: 0.85rem; margin-top: 1rem;">
          <div>
            <p style="color: var(--accent-green); font-weight: 600;">📥 Receitas (Entradas):</p>
            <ul style="margin-left: 1rem; color: var(--text-muted);">
              <li>Depósitos dos jogadores (PIX/Cartão)</li>
              <li>10% de comissão de cada aposta</li>
              <li>Assinaturas VIP mensais</li>
              <li>Taxas de inscrição em torneios</li>
            </ul>
          </div>
          <div>
            <p style="color: var(--accent-red); font-weight: 600;">📤 Gastos (Saídas):</p>
            <ul style="margin-left: 1rem; color: var(--text-muted);">
              <li>Saques pagos aos jogadores</li>
              <li>Bônus dados pelo admin (saldo e créditos)</li>
              <li>Créditos diários grátis</li>
              <li>Bônus de indicação</li>
              <li>Cupons e promoções</li>
            </ul>
          </div>
        </div>
        <p style="margin-top: 1rem; color: var(--text-muted); font-size: 0.8rem;">
          💡 <strong>Nota:</strong> Créditos são convertidos para R$ usando R$ 0,50 por crédito.
        </p>
      </div>
    </div>
  `;
}


// ==================== WITHDRAWALS ====================
function renderWithdrawals(): string {
  const withdrawals = adminData.withdrawals || [];

  return `
    <div class="admin-withdrawals">
      <div class="admin-toolbar">
        <select class="admin-select" id="withdrawal-filter">
          <option value="">Todos</option>
          <option value="pending" selected>Pendentes</option>
          <option value="completed">Aprovados</option>
          <option value="rejected">Rejeitados</option>
        </select>
        <button class="btn btn-primary" id="refresh-withdrawals-btn">🔄 Atualizar</button>
      </div>

      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Valor</th>
              <th>Chave PIX</th>
              <th>Data</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${withdrawals.map((w: any) => `
              <tr>
                <td>
                  <div class="user-cell">
                    <span class="user-avatar">${w.user?.username?.[0]?.toUpperCase() || '?'}</span>
                    <div>
                      <span>${w.user?.username || '?'}</span>
                      <small class="text-muted">${w.user?.email || ''}</small>
                    </div>
                  </div>
                </td>
                <td><strong>R$ ${Number(w.amount).toFixed(2)}</strong></td>
                <td>
                  <small>${w.pix_key_type}: ${w.pix_key}</small>
                </td>
                <td>${new Date(w.created_at).toLocaleString('pt-BR')}</td>
                <td>
                  <span class="status-badge ${w.status}">
                    ${w.status === 'pending' ? 'Pendente' : w.status === 'completed' ? 'Aprovado' : 'Rejeitado'}
                  </span>
                </td>
                <td>
                  ${w.status === 'pending' ? `
                    <div class="action-buttons">
                      <button class="btn-icon btn-success" title="Aprovar" data-approve-withdrawal="${w.id}">✅</button>
                      <button class="btn-icon btn-danger" title="Rejeitar" data-reject-withdrawal="${w.id}">❌</button>
                    </div>
                  ` : `<span class="text-muted">-</span>`}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="6" class="empty">Nenhum saque encontrado</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ==================== TOURNAMENTS ====================
function renderTournaments(): string {
  const tournaments = adminData.tournaments || [];

  return `
    <div class="admin-tournaments">
      <div class="admin-toolbar">
        <select class="admin-select" id="tournament-filter">
          <option value="">Todos</option>
          <option value="draft">Rascunho</option>
          <option value="open">Inscrições Abertas</option>
          <option value="in_progress">Em Andamento</option>
          <option value="finished">Finalizados</option>
        </select>
        <button class="btn btn-success" id="create-tournament-btn">+ Criar Torneio</button>
        <button class="btn btn-primary" id="refresh-tournaments-btn">🔄</button>
      </div>

      <!-- Info sobre sistema de premiação -->
      <div style="background: linear-gradient(135deg, rgba(0,255,136,0.1), rgba(0,153,255,0.1)); border: 1px solid rgba(0,255,136,0.3); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
          <span style="font-size: 1.2rem;">💰</span>
          <strong style="color: var(--text-primary);">Sistema de Premiação Dinâmica</strong>
        </div>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0;">
          <strong style="color: #00ff88;">70%</strong> do valor arrecadado com inscrições vai para premiação dos vencedores.
          <strong style="color: #ff6b6b;">30%</strong> fica para a plataforma (taxa de manutenção).
          A premiação aumenta automaticamente conforme mais jogadores se inscrevem!
        </p>
      </div>

      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Data</th>
              <th>Inscrição</th>
              <th>Arrecadado</th>
              <th>Premiação (70%)</th>
              <th>Taxa (30%)</th>
              <th>Participantes</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${tournaments.map((t: any) => {
              const participantCount = t.current_participants || t.participants?.[0]?.count || 0;
              const entryFee = Number(t.entry_fee || 0);
              const totalCollected = t.total_collected || (entryFee * participantCount);
              const prizePool = t.calculated_prize_pool || t.prize_pool || (totalCollected * 0.70);
              const platformFee = t.platform_fee || (totalCollected * 0.30);
              
              return `
              <tr>
                <td><strong>${t.name}</strong></td>
                <td>${new Date(t.start_date).toLocaleString('pt-BR')}</td>
                <td>R$ ${entryFee.toFixed(2)}</td>
                <td style="color: var(--text-muted);">R$ ${totalCollected.toFixed(2)}</td>
                <td style="color: #00ff88; font-weight: 600;">R$ ${prizePool.toFixed(2)}</td>
                <td style="color: #ff6b6b;">R$ ${platformFee.toFixed(2)}</td>
                <td>${participantCount}/${t.max_participants}</td>
                <td>
                  <span class="status-badge ${t.status}">
                    ${getTournamentStatusLabel(t.status)}
                  </span>
                </td>
                <td>
                  <div class="action-buttons">
                    <button class="btn-icon" title="Ver Detalhes" data-view-tournament="${t.id}">👁️</button>
                    ${t.status === 'draft' ? `<button class="btn-icon" title="Abrir Inscrições" data-open-tournament="${t.id}">📢</button>` : ''}
                    ${t.status === 'open' ? `<button class="btn-icon" title="Iniciar Torneio" data-start-tournament="${t.id}">▶️</button>` : ''}
                    ${t.status === 'in_progress' ? `<button class="btn-icon" title="Finalizar e Distribuir Prêmios" data-finish-tournament="${t.id}">🏆</button>` : ''}
                    ${['draft', 'open'].includes(t.status) ? `<button class="btn-icon btn-danger" title="Cancelar (com reembolso)" data-cancel-tournament="${t.id}">❌</button>` : ''}
                  </div>
                </td>
              </tr>
            `}).join('') || '<tr><td colspan="9" class="empty">Nenhum torneio encontrado</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function getTournamentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    open: 'Inscrições Abertas',
    scheduled: 'Agendado',
    registration_closed: 'Inscrições Encerradas',
    in_progress: 'Em Andamento',
    finished: 'Finalizado',
    cancelled: 'Cancelado',
  };
  return labels[status] || status;
}

// ==================== BANNERS ====================
function renderBanners(): string {
  const banners = adminData.banners || [];
  const tournaments = adminData.tournaments || [];

  return `
    <div class="admin-banners">
      <div class="admin-toolbar">
        <select class="admin-select" id="banner-position-filter">
          <option value="">Todas as Posições</option>
          <option value="home_top">Topo da Home</option>
          <option value="home_middle">Meio da Home</option>
          <option value="tournaments">Seção Torneios</option>
          <option value="lobby">Lobby</option>
        </select>
        <button class="btn btn-success" id="create-banner-btn">+ Criar Banner</button>
        <button class="btn btn-primary" id="refresh-banners-btn">🔄</button>
      </div>

      <!-- Torneios em Destaque -->
      <div style="background: linear-gradient(135deg, rgba(255,165,2,0.1), rgba(255,107,107,0.1)); border: 1px solid rgba(255,165,2,0.3); border-radius: 12px; padding: 1rem; margin-bottom: 1.5rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.5rem;">⭐</span>
            <strong style="color: var(--text-primary); font-size: 1.1rem;">Torneios em Destaque</strong>
          </div>
          <small style="color: var(--text-muted);">Aparecem no carrossel da página inicial</small>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem;">
          ${tournaments.filter((t: any) => ['open', 'scheduled', 'registration_closed', 'in_progress'].includes(t.status)).map((t: any) => `
            <div style="background: var(--bg-secondary); border-radius: 8px; padding: 0.75rem; border: 2px solid ${t.is_featured ? '#ffa502' : 'var(--border-color)'};">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                <div>
                  <strong style="color: var(--text-primary); font-size: 0.9rem;">${t.name}</strong>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">${getTournamentStatusLabel(t.status)}</div>
                </div>
                ${t.is_featured ? '<span style="background: #ffa502; color: #000; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">⭐ DESTAQUE</span>' : ''}
              </div>
              <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                <button class="btn btn-sm ${t.is_featured ? 'btn-ghost' : 'btn-primary'}" data-toggle-featured="${t.id}" data-featured="${t.is_featured ? 'true' : 'false'}">
                  ${t.is_featured ? '❌ Remover' : '⭐ Destacar'}
                </button>
                ${t.is_featured ? `<input type="number" value="${t.featured_order || 0}" min="0" max="99" style="width: 60px; padding: 0.25rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary);" data-order-input="${t.id}" title="Ordem (menor = primeiro)">` : ''}
              </div>
            </div>
          `).join('') || '<p style="color: var(--text-muted); text-align: center; grid-column: 1/-1;">Nenhum torneio ativo para destacar</p>'}
        </div>
      </div>

      <!-- Lista de Banners -->
      <h3 style="color: var(--text-primary); margin-bottom: 1rem;">🖼️ Banners Promocionais</h3>
      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Posição</th>
              <th>Link</th>
              <th>Período</th>
              <th>Views</th>
              <th>Cliques</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${banners.map((b: any) => `
              <tr>
                <td>
                  <strong>${b.title}</strong>
                  ${b.subtitle ? `<br><small style="color: var(--text-muted);">${b.subtitle.substring(0, 50)}...</small>` : ''}
                </td>
                <td>${getBannerPositionLabel(b.position)}</td>
                <td>${b.link_url ? `<a href="${b.link_url}" target="_blank" style="color: var(--accent-blue);">🔗 ${b.link_text || 'Link'}</a>` : '-'}</td>
                <td>
                  ${b.starts_at ? new Date(b.starts_at).toLocaleDateString('pt-BR') : 'Sempre'}
                  ${b.ends_at ? ` - ${new Date(b.ends_at).toLocaleDateString('pt-BR')}` : ''}
                </td>
                <td>${b.view_count || 0}</td>
                <td>${b.click_count || 0}</td>
                <td>
                  <span class="status-badge ${b.is_active ? 'active' : 'inactive'}">
                    ${b.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td>
                  <div class="action-buttons">
                    <button class="btn-icon" title="Editar" data-edit-banner="${b.id}">✏️</button>
                    <button class="btn-icon" title="${b.is_active ? 'Desativar' : 'Ativar'}" data-toggle-banner="${b.id}" data-active="${b.is_active}">
                      ${b.is_active ? '🔴' : '🟢'}
                    </button>
                    <button class="btn-icon btn-danger" title="Excluir" data-delete-banner="${b.id}">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="8" class="empty">Nenhum banner cadastrado</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Criar/Editar Banner -->
    <div class="modal" id="banner-modal">
      <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
          <h2 id="banner-modal-title">Criar Banner</h2>
          <button class="modal-close" data-close-modal="banner-modal">✕</button>
        </div>
        <div class="modal-body">
          <form id="banner-form" class="form-grid">
            <input type="hidden" name="banner_id" id="banner-id">
            <div class="form-group">
              <label>Título *</label>
              <input type="text" name="title" required placeholder="Ex: Torneio de Verão">
            </div>
            <div class="form-group">
              <label>Subtítulo</label>
              <input type="text" name="subtitle" placeholder="Descrição curta do banner">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Posição</label>
                <select name="position">
                  <option value="home_top">Topo da Home</option>
                  <option value="home_middle">Meio da Home</option>
                  <option value="tournaments">Seção Torneios</option>
                  <option value="lobby">Lobby</option>
                </select>
              </div>
              <div class="form-group">
                <label>Ordem</label>
                <input type="number" name="display_order" value="0" min="0">
              </div>
            </div>
            <div class="form-group">
              <label>URL da Imagem</label>
              <input type="url" name="image_url" placeholder="https://...">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Link de Destino</label>
                <input type="url" name="link_url" placeholder="https://...">
              </div>
              <div class="form-group">
                <label>Texto do Botão</label>
                <input type="text" name="link_text" value="Saiba mais" placeholder="Saiba mais">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Cor de Fundo</label>
                <select name="background_color">
                  <option value="">Padrão</option>
                  <option value="linear-gradient(135deg, #667eea, #764ba2)">Roxo</option>
                  <option value="linear-gradient(135deg, #00ff88, #0099ff)">Verde/Azul</option>
                  <option value="linear-gradient(135deg, #ffd700, #ff6b00)">Dourado</option>
                  <option value="linear-gradient(135deg, #ff6b6b, #ee5a24)">Vermelho</option>
                  <option value="linear-gradient(135deg, #00d2d3, #01a3a4)">Ciano</option>
                </select>
              </div>
              <div class="form-group">
                <label>Torneio Vinculado</label>
                <select name="tournament_id">
                  <option value="">Nenhum</option>
                  ${tournaments.filter((t: any) => ['open', 'scheduled'].includes(t.status)).map((t: any) => `
                    <option value="${t.id}">${t.name}</option>
                  `).join('')}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Data Início</label>
                <input type="datetime-local" name="starts_at">
              </div>
              <div class="form-group">
                <label>Data Fim</label>
                <input type="datetime-local" name="ends_at">
              </div>
            </div>
            <div class="form-group checkbox-group">
              <label><input type="checkbox" name="is_active" checked> Ativo</label>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Salvar Banner</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

function getBannerPositionLabel(position: string): string {
  const labels: Record<string, string> = {
    home_top: 'Topo da Home',
    home_middle: 'Meio da Home',
    tournaments: 'Seção Torneios',
    lobby: 'Lobby',
  };
  return labels[position] || position;
}

// ==================== COUPONS ====================
function renderCoupons(): string {
  const coupons = adminData.coupons || [];

  return `
    <div class="admin-coupons">
      <div class="admin-toolbar">
        <button class="btn btn-success" id="create-coupon-btn">+ Criar Cupom</button>
        <button class="btn btn-primary" id="refresh-coupons-btn">🔄 Atualizar</button>
      </div>

      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Desconto</th>
              <th>Compra Mín.</th>
              <th>Usos</th>
              <th>Validade</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${coupons.map((c: any) => `
              <tr>
                <td><code class="coupon-code">${c.code}</code></td>
                <td>
                  ${c.discount_type === 'percentage'
      ? `${c.discount_value}%${c.max_discount ? ` (máx R$ ${c.max_discount})` : ''}`
      : `R$ ${Number(c.discount_value).toFixed(2)}`
    }
                </td>
                <td>R$ ${Number(c.min_purchase || 0).toFixed(2)}</td>
                <td>${c.current_uses}${c.max_uses ? `/${c.max_uses}` : ''}</td>
                <td>
                  ${c.valid_until
      ? new Date(c.valid_until).toLocaleDateString('pt-BR')
      : 'Sem limite'
    }
                </td>
                <td>
                  <span class="status-badge ${c.is_active ? 'active' : 'inactive'}">
                    ${c.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td>
                  <div class="action-buttons">
                    ${c.is_active
      ? `<button class="btn-icon btn-danger" title="Desativar" data-deactivate-coupon="${c.id}">🚫</button>`
      : ''
    }
                  </div>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="7" class="empty">Nenhum cupom cadastrado</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Criar Cupom -->
    <div id="coupon-modal" class="modal">
      <div class="modal-overlay" data-close-modal="coupon-modal"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>Criar Cupom de Desconto</h2>
          <button class="modal-close" data-close-modal="coupon-modal">✕</button>
        </div>
        <div class="modal-body">
          <form id="coupon-form" class="form-grid">
            <div class="form-group">
              <label>Código do Cupom</label>
              <input type="text" name="code" required placeholder="Ex: DESCONTO20" style="text-transform: uppercase;">
            </div>
            <div class="form-group">
              <label>Descrição</label>
              <input type="text" name="description" placeholder="Descrição do cupom">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Tipo de Desconto</label>
                <select name="discount_type" id="coupon-discount-type">
                  <option value="percentage">Porcentagem (%)</option>
                  <option value="fixed">Valor Fixo (R$)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Valor do Desconto</label>
                <input type="number" step="0.01" name="discount_value" required min="1" placeholder="10">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Compra Mínima (R$)</label>
                <input type="number" step="0.01" name="min_purchase" value="0" min="0">
              </div>
              <div class="form-group">
                <label>Desconto Máximo (R$)</label>
                <input type="number" step="0.01" name="max_discount" placeholder="Opcional">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Limite Total de Usos</label>
                <input type="number" name="max_uses" placeholder="Ilimitado">
              </div>
              <div class="form-group">
                <label>Usos por Usuário</label>
                <input type="number" name="max_uses_per_user" value="1" min="1">
              </div>
            </div>
            <div class="form-group">
              <label>Válido Até</label>
              <input type="datetime-local" name="valid_until">
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">Criar Cupom</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

// ==================== MISSIONS ====================
function renderMissions(): string {
  const missions = adminData.missions || [];

  const typeLabels: Record<string, string> = {
    daily: '📅 Diária',
    weekly: '📆 Semanal',
    special: '⭐ Especial',
    achievement: '🏆 Conquista',
  };

  const requirementLabels: Record<string, string> = {
    wins: 'Vitórias',
    matches: 'Partidas',
    streak: 'Sequência',
    points: 'Pontos',
    deposit: 'Depósitos',
    invite: 'Convites',
  };

  return `
    <div class="admin-missions">
      <div class="admin-toolbar">
        <select class="admin-select" id="mission-filter">
          <option value="">Todas</option>
          <option value="active">Ativas</option>
          <option value="inactive">Inativas</option>
          <option value="daily">Diárias</option>
          <option value="weekly">Semanais</option>
          <option value="special">Especiais</option>
        </select>
        <button class="btn btn-success" id="create-mission-btn">+ Criar Missão</button>
        <button class="btn btn-primary" id="refresh-missions-btn">🔄 Atualizar</button>
      </div>

      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Missão</th>
              <th>Tipo</th>
              <th>Requisito</th>
              <th>Recompensa</th>
              <th>Completações</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${missions.map((m: any) => `
              <tr>
                <td>
                  <div class="mission-cell">
                    <span class="mission-icon">${m.icon || '🎯'}</span>
                    <div>
                      <strong>${m.title}</strong>
                      ${m.description ? `<br><small class="text-muted">${m.description}</small>` : ''}
                    </div>
                  </div>
                </td>
                <td>${typeLabels[m.type] || m.type}</td>
                <td>${m.requirement_value} ${requirementLabels[m.requirement_type] || m.requirement_type}</td>
                <td>
                  <span class="reward-badge">
                    ${m.reward_type === 'credits' ? '🎫' : m.reward_type === 'bonus_balance' ? '💰' : '👑'}
                    ${m.reward_value} ${m.reward_type === 'credits' ? 'créditos' : m.reward_type === 'bonus_balance' ? 'R$' : 'dias VIP'}
                  </span>
                </td>
                <td>${m.current_completions || 0}${m.max_completions ? `/${m.max_completions}` : ''}</td>
                <td>
                  <span class="status-badge ${m.is_active ? 'active' : 'inactive'}">
                    ${m.is_active ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td>
                  <div class="action-buttons">
                    <button class="btn-icon" title="Editar" data-edit-mission="${m.id}">✏️</button>
                    ${m.is_active
      ? `<button class="btn-icon" title="Desativar" data-toggle-mission="${m.id}" data-active="false">🚫</button>`
      : `<button class="btn-icon btn-success" title="Ativar" data-toggle-mission="${m.id}" data-active="true">✅</button>`
    }
                    <button class="btn-icon btn-danger" title="Deletar" data-delete-mission="${m.id}">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="7" class="empty">Nenhuma missão cadastrada</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Criar/Editar Missão -->
    <div id="mission-modal" class="modal">
      <div class="modal-overlay" data-close-modal="mission-modal"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="mission-modal-title">Criar Missão</h2>
          <button class="modal-close" data-close-modal="mission-modal">✕</button>
        </div>
        <div class="modal-body">
          <form id="mission-form" class="form-grid">
            <input type="hidden" name="mission_id" id="mission-id">
            <div class="form-group">
              <label>Título da Missão</label>
              <input type="text" name="title" id="mission-title" required placeholder="Ex: Vença 5 partidas">
            </div>
            <div class="form-group">
              <label>Descrição</label>
              <textarea name="description" id="mission-description" rows="2" placeholder="Descrição da missão"></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Tipo</label>
                <select name="type" id="mission-type" required>
                  <option value="daily">Diária</option>
                  <option value="weekly">Semanal</option>
                  <option value="special">Especial</option>
                  <option value="achievement">Conquista</option>
                </select>
              </div>
              <div class="form-group">
                <label>Ícone</label>
                <input type="text" name="icon" id="mission-icon" value="🎯" maxlength="2">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Tipo de Requisito</label>
                <select name="requirement_type" id="mission-req-type" required>
                  <option value="wins">Vitórias</option>
                  <option value="matches">Partidas Jogadas</option>
                  <option value="streak">Sequência de Vitórias</option>
                  <option value="points">Pontos de Ranking</option>
                  <option value="deposit">Depósitos</option>
                  <option value="invite">Convites</option>
                </select>
              </div>
              <div class="form-group">
                <label>Quantidade Necessária</label>
                <input type="number" name="requirement_value" id="mission-req-value" required min="1" value="1">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Tipo de Recompensa</label>
                <select name="reward_type" id="mission-reward-type">
                  <option value="credits">Créditos</option>
                  <option value="bonus_balance">Saldo Bônus (R$)</option>
                  <option value="vip_days">Dias VIP</option>
                </select>
              </div>
              <div class="form-group">
                <label>Valor da Recompensa</label>
                <input type="number" name="reward_value" id="mission-reward-value" required min="1" value="5">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Data de Início</label>
                <input type="datetime-local" name="start_date" id="mission-start">
              </div>
              <div class="form-group">
                <label>Data de Término</label>
                <input type="datetime-local" name="end_date" id="mission-end">
              </div>
            </div>
            <div class="form-group">
              <label>Limite de Completações</label>
              <input type="number" name="max_completions" id="mission-max" placeholder="Ilimitado">
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" id="mission-submit-btn">Criar Missão</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

// ==================== REFERRALS ====================
function renderReferrals(): string {
  const referrals = adminData.referrals || [];
  const stats = adminData.referralStats || {};
  const settings = adminData.settings || {};

  return `
    <div class="admin-referrals">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-info">
            <span class="stat-value">${stats.total_referrals || 0}</span>
            <span class="stat-label">Total de Indicações</span>
          </div>
        </div>
        <div class="stat-card orange">
          <div class="stat-icon">⏳</div>
          <div class="stat-info">
            <span class="stat-value">${stats.pending_referrals || 0}</span>
            <span class="stat-label">Pendentes</span>
          </div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">✅</div>
          <div class="stat-info">
            <span class="stat-value">${stats.rewarded_referrals || 0}</span>
            <span class="stat-label">Recompensadas</span>
          </div>
        </div>
        <div class="stat-card blue">
          <div class="stat-icon">🎫</div>
          <div class="stat-info">
            <span class="stat-value">${stats.total_credits_given || 0}</span>
            <span class="stat-label">Créditos Distribuídos</span>
          </div>
        </div>
      </div>

      <div class="admin-grid">
        <div class="admin-card">
          <h3>⚙️ Configurações do Sistema</h3>
          <form id="referral-settings-form" class="form-grid">
            <div class="form-group checkbox-group">
              <label>
                <input type="checkbox" name="referral_enabled" ${settings.referral_enabled === 'true' || settings.referral_enabled === true ? 'checked' : ''}>
                Sistema de Indicações Ativo
              </label>
            </div>
            <div class="form-group">
              <label>Créditos por Indicação</label>
              <input type="number" name="referral_reward_credits" value="${settings.referral_reward_credits || 2}" min="1">
            </div>
            <div class="form-group">
              <label>Mensagem de Compartilhamento</label>
              <textarea name="referral_share_message" rows="3">${settings.referral_share_message || '🎱 Venha jogar Sinuca Online comigo! Cadastre-se pelo meu link e ganhe créditos grátis para jogar. 🏆'}</textarea>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">💾 Salvar Configurações</button>
            </div>
          </form>
        </div>

        <div class="admin-card">
          <h3>🏆 Top Indicadores</h3>
          <div class="admin-list" id="top-referrers">
            ${(stats.top_referrers || []).map((u: any, i: number) => `
              <div class="admin-list-item">
                <span class="rank-badge">#${i + 1}</span>
                <div class="item-info">
                  <span class="item-name">${u.username}</span>
                  <span class="item-sub">${u.referral_count} indicações • ${u.referral_earnings} créditos ganhos</span>
                </div>
              </div>
            `).join('') || '<p class="empty">Nenhum indicador ainda</p>'}
          </div>
        </div>
      </div>

      <div class="admin-section">
        <div class="admin-toolbar">
          <h3>📋 Histórico de Indicações</h3>
          <select class="admin-select" id="referral-filter">
            <option value="">Todas</option>
            <option value="pending">Pendentes</option>
            <option value="qualified">Qualificadas</option>
            <option value="rewarded">Recompensadas</option>
          </select>
          <input type="text" class="admin-search" placeholder="Buscar por usuário..." id="referral-search">
          <button class="btn btn-primary" id="refresh-referrals-btn">🔄 Atualizar</button>
        </div>

        <div class="admin-table-container">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Indicador</th>
                <th>Indicado</th>
                <th>Data</th>
                <th>Status</th>
                <th>Recompensa</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${referrals.map((r: any) => `
                <tr>
                  <td>
                    <div class="user-cell">
                      <span class="user-avatar">${r.referrer?.username?.[0]?.toUpperCase() || '?'}</span>
                      <div>
                        <strong>${r.referrer?.username || 'Desconhecido'}</strong>
                        <br><small class="text-muted">${r.referrer?.email || ''}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="user-cell">
                      <span class="user-avatar">${r.referred?.username?.[0]?.toUpperCase() || '?'}</span>
                      <div>
                        <strong>${r.referred?.username || 'Desconhecido'}</strong>
                        <br><small class="text-muted">${r.referred?.email || ''}</small>
                      </div>
                    </div>
                  </td>
                  <td>${new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <span class="status-badge ${r.status}">
                      ${r.status === 'pending' ? '⏳ Pendente' : r.status === 'qualified' ? '✅ Qualificado' : '🎁 Recompensado'}
                    </span>
                  </td>
                  <td>${r.reward_credits} créditos</td>
                  <td>
                    <div class="action-buttons">
                      ${r.status === 'qualified' ? `<button class="btn-icon btn-success" title="Processar Recompensa" data-process-referral="${r.id}">💰</button>` : ''}
                      <button class="btn-icon" title="Ver Detalhes" data-view-referral="${r.id}">👁️</button>
                    </div>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="6" class="empty">Nenhuma indicação encontrada</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ==================== EMPLOYEES ====================
function renderEmployees(): string {
  const employees = adminData.employees || [];
  const invites = adminData.invites || [];
  const state = gameStore.getState();
  const isSuperAdmin = state.user?.role === 'super_admin';

  return `
    <div class="admin-employees">
      <div class="admin-toolbar">
        <button class="btn btn-success" id="invite-employee-btn">+ Convidar Funcionário</button>
        <button class="btn btn-primary" id="refresh-employees-btn">🔄 Atualizar</button>
      </div>

      <div class="admin-section">
        <h3>👔 Equipe Atual</h3>
        <div class="admin-table-container">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Email</th>
                <th>Cargo</th>
                <th>Status</th>
                <th>Último Acesso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${employees.map((e: any) => `
                <tr>
                  <td>
                    <div class="user-cell">
                      <div class="user-avatar-sm">${e.username?.[0]?.toUpperCase() || '?'}</div>
                      <div>
                        <strong>${e.username}</strong>
                        ${e.fullname ? `<br><small>${e.fullname}</small>` : ''}
                      </div>
                    </div>
                  </td>
                  <td>${e.email}</td>
                  <td>
                    <span class="role-badge role-${e.role}">${getRoleBadge(e.role)}</span>
                  </td>
                  <td>
                    <span class="status-badge ${e.status}">${e.status === 'active' ? 'Ativo' : e.status}</span>
                  </td>
                  <td>${e.last_login_at ? new Date(e.last_login_at).toLocaleString('pt-BR') : 'Nunca'}</td>
                  <td>
                    <div class="action-buttons">
                      ${e.role !== 'super_admin' ? `
                        <select class="role-select" data-change-role="${e.id}" data-current="${e.role}">
                          <option value="employee" ${e.role === 'employee' ? 'selected' : ''}>Funcionário</option>
                          <option value="moderator" ${e.role === 'moderator' ? 'selected' : ''}>Moderador</option>
                          <option value="manager" ${e.role === 'manager' ? 'selected' : ''}>Gerente</option>
                          ${isSuperAdmin ? `<option value="admin" ${e.role === 'admin' ? 'selected' : ''}>Admin</option>` : ''}
                        </select>
                        <button class="btn-icon btn-danger" title="Remover" data-remove-employee="${e.id}">🗑️</button>
                      ` : '<span class="text-muted">-</span>'}
                    </div>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="6" class="empty">Nenhum funcionário cadastrado</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      ${invites.length > 0 ? `
        <div class="admin-section">
          <h3>📨 Convites Pendentes</h3>
          <div class="admin-table-container">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Cargo</th>
                  <th>Convidado por</th>
                  <th>Expira em</th>
                  <th>Código</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${invites.map((i: any) => `
                  <tr>
                    <td>${i.email}</td>
                    <td><span class="role-badge role-${i.role}">${getRoleBadge(i.role)}</span></td>
                    <td>${i.inviter?.username || '-'}</td>
                    <td>${new Date(i.expires_at).toLocaleString('pt-BR')}</td>
                    <td><code>${i.invite_code.substring(0, 8)}...</code></td>
                    <td>
                      <button class="btn-icon" title="Copiar Link" data-copy-invite="${i.invite_code}">📋</button>
                      <button class="btn-icon btn-danger" title="Cancelar" data-cancel-invite="${i.id}">❌</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <div class="admin-section">
        <h3>📊 Permissões por Cargo</h3>
        <div class="permissions-grid">
          <div class="permission-card">
            <h4>👑 Super Admin</h4>
            <ul>
              <li>✅ Acesso total ao sistema</li>
              <li>✅ Gerenciar outros admins</li>
              <li>✅ Configurações críticas</li>
            </ul>
          </div>
          <div class="permission-card">
            <h4>🛡️ Admin</h4>
            <ul>
              <li>✅ Gerenciar usuários</li>
              <li>✅ Gerenciar finanças</li>
              <li>✅ Gerenciar funcionários</li>
              <li>❌ Não pode criar admins</li>
            </ul>
          </div>
          <div class="permission-card">
            <h4>📋 Gerente</h4>
            <ul>
              <li>✅ Gerenciar usuários</li>
              <li>✅ Aprovar saques</li>
              <li>✅ Ver financeiro</li>
              <li>❌ Sem configurações</li>
            </ul>
          </div>
          <div class="permission-card">
            <h4>🔧 Moderador</h4>
            <ul>
              <li>✅ Banir usuários</li>
              <li>✅ Ver partidas</li>
              <li>❌ Sem acesso financeiro</li>
            </ul>
          </div>
          <div class="permission-card">
            <h4>👤 Funcionário</h4>
            <ul>
              <li>✅ Ver usuários</li>
              <li>✅ Aprovar saques</li>
              <li>❌ Acesso limitado</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==================== LOGS ====================
function renderLogs(): string {
  const logs = adminData.logs || [];

  return `
    <div class="admin-logs">
      <div class="admin-toolbar">
        <select class="admin-select" id="log-action-filter">
          <option value="">Todas as ações</option>
          <option value="user_ban">Banimentos</option>
          <option value="withdrawal_approve">Saques Aprovados</option>
          <option value="withdrawal_reject">Saques Rejeitados</option>
          <option value="balance_adjust">Ajustes de Saldo</option>
          <option value="settings_update">Configurações</option>
          <option value="tournament_create">Torneios</option>
        </select>
        <button class="btn btn-primary" id="refresh-logs-btn">🔄 Atualizar</button>
      </div>

      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Admin</th>
              <th>Ação</th>
              <th>Alvo</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map((log: any) => `
              <tr>
                <td>${new Date(log.created_at).toLocaleString('pt-BR')}</td>
                <td>${log.admin?.username || log.admin_id?.slice(0, 8)}</td>
                <td><span class="action-badge">${formatLogAction(log.action)}</span></td>
                <td><code>${log.target_type}: ${log.target_id?.slice(0, 8)}...</code></td>
                <td><small>${JSON.stringify(log.details || {}).slice(0, 50)}...</small></td>
              </tr>
            `).join('') || '<tr><td colspan="5" class="empty">Nenhum log encontrado</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function formatLogAction(action: string): string {
  const labels: Record<string, string> = {
    user_ban: '🚫 Ban',
    user_unban: '✅ Unban',
    withdrawal_approve: '💰 Saque OK',
    withdrawal_reject: '❌ Saque Rejeitado',
    balance_adjust: '💵 Ajuste Saldo',
    settings_update: '⚙️ Config',
    tournament_create: '🏆 Torneio',
    tournament_cancel: '❌ Torneio Cancelado',
    match_cancel: '🎮 Partida Cancelada',
  };
  return labels[action] || action;
}

// ==================== SETTINGS ====================
function renderSettings(): string {
  const settings = adminData.settings || {};

  return `
    <div class="admin-settings">
      <div class="settings-tabs">
        <button class="settings-tab active" data-settings-tab="general">Geral</button>
        <button class="settings-tab" data-settings-tab="credits">Créditos</button>
        <button class="settings-tab" data-settings-tab="bets">Apostas</button>
        <button class="settings-tab" data-settings-tab="withdrawals">Saques</button>
        <button class="settings-tab" data-settings-tab="game">Jogo</button>
        <button class="settings-tab" data-settings-tab="time">⏰ Tempo/Limpeza</button>
        <button class="settings-tab" data-settings-tab="referral">Indicações</button>
        <button class="settings-tab" data-settings-tab="payment">Gateway de Pagamento</button>
      </div>

      <form id="settings-form" class="settings-form">
        <!-- Geral -->
        <div class="settings-section" data-section="general">
          <h3>⚙️ Configurações Gerais</h3>
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" name="maintenance_mode" ${settings.maintenance_mode ? 'checked' : ''}>
              Modo Manutenção
            </label>
          </div>
          <div class="form-group">
            <label>Mensagem de Manutenção</label>
            <input type="text" name="maintenance_message" value="${settings.maintenance_message || 'Sistema em manutenção'}">
          </div>
          <div class="settings-grid">
            <div class="form-group">
              <label>Máx. Salas por Usuário</label>
              <input type="number" name="max_rooms_per_user" value="${settings.max_rooms_per_user || 1}" min="1">
            </div>
            <div class="form-group">
              <label>Máx. Partidas Diárias</label>
              <input type="number" name="max_daily_matches" value="${settings.max_daily_matches || 50}" min="1">
            </div>
          </div>

          <h4 style="margin-top: 1.5rem; margin-bottom: 1rem; color: var(--text-primary);">📞 Contatos de Suporte</h4>
          <div class="alert alert-info" style="margin-bottom: 1rem;">
            Estes contatos aparecem nas páginas de manutenção e erro para os usuários.
          </div>
          <div class="settings-grid">
            <div class="form-group">
              <label>WhatsApp (com código do país)</label>
              <input type="text" name="contact_whatsapp" value="${settings.contact_whatsapp || '5511999999999'}" placeholder="5511999999999">
              <small class="input-hint">Apenas números, ex: 5511999999999</small>
            </div>
            <div class="form-group">
              <label>Instagram (sem @)</label>
              <input type="text" name="contact_instagram" value="${settings.contact_instagram || 'sinucaonline'}" placeholder="sinucaonline">
            </div>
            <div class="form-group">
              <label>E-mail de Suporte</label>
              <input type="email" name="contact_email" value="${settings.contact_email || 'suporte@sinucaonline.com'}" placeholder="suporte@exemplo.com">
            </div>
          </div>
        </div>

        <!-- Créditos -->
        <div class="settings-section hidden" data-section="credits">
          <h3>🎫 Créditos</h3>
          <div class="settings-grid">
            <div class="form-group">
              <label>Preço por Crédito (R$)</label>
              <input type="number" step="0.01" name="credits_price_per_unit" value="${settings.credits_price_per_unit || 0.50}">
            </div>
            <div class="form-group">
              <label>Créditos Grátis (Registro)</label>
              <input type="number" name="free_credits_on_register" value="${settings.free_credits_on_register || 2}">
            </div>
            <div class="form-group">
              <label>Créditos Diários Grátis</label>
              <input type="number" name="daily_free_credits" value="${settings.daily_free_credits || 0}">
            </div>
            <div class="form-group">
              <label>Créditos por Partida</label>
              <input type="number" name="credits_per_match" value="${settings.credits_per_match || 1}">
            </div>
          </div>
        </div>

        <!-- Apostas -->
        <div class="settings-section hidden" data-section="bets">
          <h3>🎰 Apostas</h3>
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" name="bet_enabled" ${settings.bet_enabled !== false ? 'checked' : ''}>
              Apostas Habilitadas
            </label>
          </div>
          <div class="settings-grid">
            <div class="form-group">
              <label>Aposta Mínima (R$)</label>
              <input type="number" step="0.01" name="min_bet_amount" value="${settings.min_bet_amount || 5.00}">
            </div>
            <div class="form-group">
              <label>Aposta Máxima (R$)</label>
              <input type="number" step="0.01" name="max_bet_amount" value="${settings.max_bet_amount || 1000.00}">
            </div>
            <div class="form-group">
              <label>Taxa da Plataforma (%)</label>
              <input type="number" step="0.1" name="platform_fee_percent" value="${settings.platform_fee_percent || 10}" min="0" max="50">
            </div>
          </div>
        </div>

        <!-- Saques -->
        <div class="settings-section hidden" data-section="withdrawals">
          <h3>💸 Configurações de Saque</h3>
          <div class="alert alert-info">
            Configure as regras de saque. Apenas o saldo de <strong>ganhos (winnings_balance)</strong> pode ser sacado. 
            Depósitos devem ser usados em partidas e bônus não são sacáveis.
          </div>
          <div class="settings-grid">
            <div class="form-group">
              <label>Valor Mínimo de Saque (R$)</label>
              <input type="number" step="0.01" name="min_withdrawal_amount" value="${settings.min_withdrawal_amount || 10.00}" min="1">
              <small class="input-hint">Valor mínimo que o usuário pode solicitar de saque</small>
            </div>
            <div class="form-group">
              <label>Valor Máximo de Saque (R$)</label>
              <input type="number" step="0.01" name="max_withdrawal_amount" value="${settings.max_withdrawal_amount || 10000.00}" min="10">
              <small class="input-hint">Valor máximo por solicitação de saque</small>
            </div>
            <div class="form-group">
              <label>Taxa de Saque (%)</label>
              <input type="number" step="0.1" name="withdrawal_fee_percent" value="${settings.withdrawal_fee_percent || 0}" min="0" max="20">
              <small class="input-hint">Percentual descontado do valor do saque (0 = sem taxa)</small>
            </div>
            <div class="form-group">
              <label>Taxa Fixa de Saque (R$)</label>
              <input type="number" step="0.01" name="withdrawal_fee_fixed" value="${settings.withdrawal_fee_fixed || 0}" min="0">
              <small class="input-hint">Valor fixo descontado por saque (0 = sem taxa fixa)</small>
            </div>
          </div>
          <div style="background: rgba(255,165,2,0.1); padding: 1rem; border-radius: 8px; margin-top: 1rem;">
            <h4 style="margin: 0 0 0.5rem 0; color: var(--accent-yellow);">📋 Regras de Saldo</h4>
            <ul style="margin: 0; padding-left: 1.5rem; font-size: 0.9rem; color: var(--text-secondary);">
              <li><strong>Depósitos (deposit_balance):</strong> Deve ser usado em partidas, NÃO pode ser sacado</li>
              <li><strong>Ganhos (winnings_balance):</strong> Prêmios de partidas, PODE ser sacado</li>
              <li><strong>Bônus (bonus_balance):</strong> Bônus do sistema, NÃO pode ser sacado</li>
            </ul>
          </div>
        </div>

        <!-- Jogo -->
        <div class="settings-section hidden" data-section="game">
          <h3>🎮 Configurações de Jogo</h3>
          <div class="form-group checkbox-group">
            <label><input type="checkbox" name="casual_mode_enabled" ${settings.casual_mode_enabled !== false ? 'checked' : ''}> Modo Casual</label>
            <label><input type="checkbox" name="ranked_mode_enabled" ${settings.ranked_mode_enabled !== false ? 'checked' : ''}> Modo Ranqueado</label>
            <label><input type="checkbox" name="bet_mode_enabled" ${settings.bet_mode_enabled !== false ? 'checked' : ''}> Modo Aposta</label>
            <label><input type="checkbox" name="ai_mode_enabled" ${settings.ai_mode_enabled ? 'checked' : ''}> Modo vs IA</label>
          </div>
          <div class="settings-grid">
            <div class="form-group">
              <label>Pontos por Vitória</label>
              <input type="number" name="points_per_win" value="${settings.points_per_win || 25}">
            </div>
            <div class="form-group">
              <label>Pontos por Derrota</label>
              <input type="number" name="points_per_loss" value="${settings.points_per_loss || -10}">
            </div>
            <div class="form-group">
              <label>Timeout da Partida (min)</label>
              <input type="number" name="match_timeout_minutes" value="${settings.match_timeout_minutes || 30}">
            </div>
            <div class="form-group">
              <label>Timeout do Turno (seg)</label>
              <input type="number" name="turn_timeout_seconds" value="${settings.turn_timeout_seconds || 60}">
            </div>
          </div>
        </div>

        <!-- Tempo e Limpeza Automática -->
        <div class="settings-section hidden" data-section="time">
          <h3>⏰ Configurações de Tempo e Limpeza</h3>
          <div class="alert alert-info">
            O sistema executa limpeza automática para garantir qualidade e performance. Estas configurações são fixas no código.
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin: 1.5rem 0;">
            <!-- Partidas -->
            <div style="background: rgba(0,136,255,0.1); padding: 1.25rem; border-radius: 12px; border: 1px solid rgba(0,136,255,0.2);">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                <span style="font-size: 1.5rem;">🎱</span>
                <h4 style="margin: 0; color: var(--accent-blue);">Partidas</h4>
              </div>
              <div style="font-size: 2rem; font-weight: 700; color: var(--text-primary);">30 minutos</div>
              <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0.5rem 0 0 0;">
                Duração máxima de cada partida. Após esse tempo, a partida é encerrada automaticamente e o vencedor é determinado pela pontuação.
              </p>
            </div>
            
            <!-- Salas -->
            <div style="background: rgba(0,255,136,0.1); padding: 1.25rem; border-radius: 12px; border: 1px solid rgba(0,255,136,0.2);">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                <span style="font-size: 1.5rem;">🚪</span>
                <h4 style="margin: 0; color: var(--accent-green);">Salas</h4>
              </div>
              <div style="font-size: 2rem; font-weight: 700; color: var(--text-primary);">24 horas</div>
              <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0.5rem 0 0 0;">
                Tempo máximo de inatividade. Salas abertas ou cheias sem atividade são fechadas automaticamente.
              </p>
            </div>
            
            <!-- Transmissões -->
            <div style="background: rgba(255,165,0,0.1); padding: 1.25rem; border-radius: 12px; border: 1px solid rgba(255,165,0,0.2);">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                <span style="font-size: 1.5rem;">📺</span>
                <h4 style="margin: 0; color: var(--accent-yellow);">Transmissões</h4>
              </div>
              <div style="font-size: 2rem; font-weight: 700; color: var(--text-primary);">1 hora</div>
              <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0.5rem 0 0 0;">
                Verificação de inatividade. Transmissões sem atividade por 1 hora são encerradas automaticamente.
              </p>
            </div>
          </div>
          
          <div style="background: rgba(255,255,255,0.03); padding: 1.25rem; border-radius: 12px; margin-top: 1.5rem;">
            <h4 style="margin: 0 0 1rem 0; color: var(--text-primary);">🧹 Limpeza Manual</h4>
            <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
              O sistema executa limpeza automática a cada minuto. Use o botão abaixo para forçar uma limpeza imediata.
            </p>
            <button type="button" class="btn btn-primary" id="run-cleanup-btn">
              🧹 Executar Limpeza Agora
            </button>
            <span id="cleanup-status" style="margin-left: 1rem; font-size: 0.85rem; color: var(--text-muted);"></span>
          </div>
          
          <div style="background: rgba(255,107,107,0.1); padding: 1rem; border-radius: 8px; margin-top: 1.5rem; border: 1px solid rgba(255,107,107,0.2);">
            <h4 style="margin: 0 0 0.5rem 0; color: #ff6b6b;">⚠️ Importante</h4>
            <ul style="margin: 0; padding-left: 1.5rem; font-size: 0.85rem; color: var(--text-secondary);">
              <li>Partidas expiradas por tempo: vencedor determinado pela pontuação</li>
              <li>Em caso de empate na expiração: partida cancelada e apostas reembolsadas</li>
              <li>Jogadores são notificados quando suas partidas/salas são encerradas</li>
              <li>Estas configurações garantem melhor performance do servidor</li>
            </ul>
          </div>
        </div>

        <!-- Indicações -->
        <div class="settings-section hidden" data-section="referral">
          <h3>🎁 Sistema de Indicações</h3>
          <div class="alert alert-info">
            Configure o sistema "Indique e Ganhe" para incentivar usuários a convidarem amigos.
          </div>
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" name="referral_enabled" ${settings.referral_enabled === 'true' || settings.referral_enabled === true ? 'checked' : ''}>
              Sistema de Indicações Ativo
            </label>
          </div>
          <div class="settings-grid">
            <div class="form-group">
              <label>Créditos por Indicação</label>
              <input type="number" name="referral_reward_credits" value="${settings.referral_reward_credits || 2}" min="1">
              <small class="input-hint">Créditos que o indicador ganha quando o indicado faz a primeira compra</small>
            </div>
          </div>
          <div class="form-group">
            <label>Mensagem de Compartilhamento</label>
            <textarea name="referral_share_message" rows="3" placeholder="Mensagem que aparece para o usuário compartilhar">${settings.referral_share_message || '🎱 Venha jogar Sinuca Online comigo! Cadastre-se pelo meu link e ganhe créditos grátis para jogar. 🏆'}</textarea>
            <small class="input-hint">Esta mensagem será usada quando o usuário compartilhar seu link de indicação</small>
          </div>
        </div>

        <!-- Gateway de Pagamento -->
        <div class="settings-section hidden" data-section="payment">
          <h3>💳 Gateway de Pagamento (Gerencianet/Efí)</h3>
          <div class="alert alert-info">
            Configure as credenciais da API Gerencianet/Efí para processar pagamentos PIX e cartão.
          </div>
          <div class="form-group">
            <label>Ambiente</label>
            <select id="payment_environment" name="payment_environment">
              <option value="sandbox" ${settings.payment_environment === 'sandbox' || !settings.payment_environment ? 'selected' : ''}>Sandbox (Testes)</option>
              <option value="production" ${settings.payment_environment === 'production' ? 'selected' : ''}>Produção</option>
            </select>
          </div>
          <div class="settings-grid">
            <div class="form-group">
              <label>Client ID</label>
              <input type="text" id="payment_client_id" name="payment_client_id" value="${settings.payment_client_id || ''}" placeholder="Client_Id_xxx">
            </div>
            <div class="form-group">
              <label>Client Secret</label>
              <input type="password" id="payment_client_secret" name="payment_client_secret" value="" placeholder="Client_Secret_xxx">
            </div>
          </div>
          <div class="form-group">
            <label>Chave PIX (para recebimentos)</label>
            <input type="text" id="payment_pix_key" name="payment_pix_key" value="${settings.payment_pix_key || ''}" placeholder="email@exemplo.com ou CPF">
          </div>
          <div class="form-group">
            <label>Certificado .p12</label>
            <div class="file-upload">
              <input type="file" id="certificate-upload" accept=".p12,.pem">
              <span class="file-status" id="certificate-status">${settings.certificate_uploaded ? '✅ Certificado enviado' : '⚠️ Nenhum certificado'}</span>
            </div>
          </div>
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" id="payment_active" name="payment_active" ${settings.payment_active ? 'checked' : ''}>
              Ativar Integração de Pagamentos
            </label>
          </div>
          <div class="settings-actions" style="margin-top: 1rem; margin-bottom: 1rem;">
            <button type="button" class="btn btn-primary" id="save-payment-settings-btn">💾 Salvar Credenciais</button>
            <button type="button" class="btn btn-secondary" id="test-payment-btn">🔌 Testar Conexão</button>
          </div>
        </div>

        <div class="settings-actions">
          <button type="submit" class="btn btn-primary">💾 Salvar Configurações</button>
          <button type="button" class="btn btn-secondary" id="reset-settings-btn">🔄 Restaurar Padrões</button>
        </div>
      </form>
    </div>
  `;
}

// ==================== MUSIC MANAGEMENT ====================
function renderMusic(): string {
  const tracks = adminData.musicTracks || [];
  const stats = adminData.musicStats || [];

  return `
    <div class="admin-music">
      <div class="admin-toolbar">
        <button class="btn btn-primary" id="add-music-btn">➕ Adicionar Música</button>
        <button class="btn" id="refresh-music-btn">🔄 Atualizar</button>
      </div>

      <!-- Estatísticas de Reprodução -->
      <div class="admin-card" style="margin-bottom: 1.5rem;">
        <h3 style="margin-bottom: 1rem;">📊 Músicas Mais Tocadas</h3>
        ${stats.length === 0 ? `
          <p style="color: var(--text-muted); text-align: center; padding: 1rem;">Nenhuma estatística disponível ainda.</p>
        ` : `
          <div style="display: grid; gap: 0.5rem;">
            ${stats.slice(0, 5).map((s: any, i: number) => `
              <div style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
                <span style="font-size: 1.2rem; font-weight: 700; color: ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? '#cd7f32' : 'var(--text-muted)'};">#${i + 1}</span>
                <div style="flex: 1;">
                  <div style="font-weight: 600;">${s.title}</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">${s.artist || 'Artista desconhecido'}</div>
                </div>
                <span style="color: var(--accent-green); font-weight: 600;">${s.count} plays</span>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Lista de Músicas -->
      <div class="admin-card">
        <h3 style="margin-bottom: 1rem;">🎵 Playlist (${tracks.length} músicas)</h3>
        ${tracks.length === 0 ? `
          <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🎵</div>
            <p>Nenhuma música cadastrada ainda.</p>
            <p style="font-size: 0.9rem;">Clique em "Adicionar Música" para começar.</p>
          </div>
        ` : `
          <div class="music-list" style="display: grid; gap: 0.75rem;">
            ${tracks.map((track: any, index: number) => `
              <div class="music-item" style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); ${!track.is_active ? 'opacity: 0.5;' : ''}">
                <!-- Thumbnail -->
                <div style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden; flex-shrink: 0; background: rgba(0,0,0,0.3);">
                  ${track.thumbnail_url ? `
                    <img src="${track.thumbnail_url}" alt="${track.title}" style="width: 100%; height: 100%; object-fit: cover;">
                  ` : `
                    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
                      ${track.source_type === 'youtube' ? '📺' : '🎵'}
                    </div>
                  `}
                </div>
                
                <!-- Info -->
                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${track.title}
                  </div>
                  <div style="font-size: 0.85rem; color: var(--text-muted);">
                    ${track.artist || 'Artista desconhecido'}
                  </div>
                  <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem;">
                    <span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: ${track.source_type === 'youtube' ? 'rgba(255,0,0,0.2); color: #ff6b6b;' : 'rgba(0,255,136,0.2); color: var(--accent-green);'}">
                      ${track.source_type === 'youtube' ? '📺 YouTube' : '📁 Upload'}
                    </span>
                    ${track.genre ? `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(96,165,250,0.2); color: var(--accent-blue);">${track.genre}</span>` : ''}
                    <span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: ${track.is_active ? 'rgba(0,255,136,0.2); color: var(--accent-green);' : 'rgba(255,107,107,0.2); color: #ff6b6b;'}">
                      ${track.is_active ? '✅ Ativo' : '❌ Inativo'}
                    </span>
                  </div>
                </div>
                
                <!-- Actions -->
                <div style="display: flex; gap: 0.5rem; flex-shrink: 0;">
                  <button class="btn btn-sm" data-edit-music="${track.id}" title="Editar">✏️</button>
                  <button class="btn btn-sm ${track.is_active ? 'btn-warning' : 'btn-success'}" data-toggle-music="${track.id}" data-active="${track.is_active}" title="${track.is_active ? 'Desativar' : 'Ativar'}">
                    ${track.is_active ? '⏸️' : '▶️'}
                  </button>
                  <button class="btn btn-sm btn-danger" data-delete-music="${track.id}" title="Excluir">🗑️</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Modal de Adicionar/Editar Música -->
      <div id="music-modal" class="modal">
        <div class="modal-overlay" data-close-modal="music-modal"></div>
        <div class="modal-content" style="max-width: 500px;">
          <div class="modal-header">
            <h2 id="music-modal-title">Adicionar Música</h2>
            <button class="modal-close" data-close-modal="music-modal">✕</button>
          </div>
          <div class="modal-body">
            <form id="music-form">
              <input type="hidden" id="music-id" name="music_id">
              
              <div class="form-group">
                <label>Tipo de Fonte *</label>
                <select id="music-source-type" name="source_type" class="input" required>
                  <option value="youtube">📺 YouTube (Código de Incorporação)</option>
                  <option value="upload">📁 Upload de Arquivo</option>
                </select>
              </div>

              <!-- YouTube Embed Code -->
              <div id="youtube-input-group" class="form-group">
                <label>Código de Incorporação do YouTube *</label>
                <textarea id="music-youtube-embed" name="youtube_embed" class="input" rows="4" placeholder='Cole aqui o código de incorporação do YouTube. Ex: <iframe width="560" height="315" src="https://www.youtube.com/embed/VIDEO_ID" ...'></textarea>
                <small style="color: var(--text-muted);">
                  No YouTube, clique em "Compartilhar" → "Incorporar" e copie o código. Apenas o áudio será reproduzido.
                </small>
                <div id="youtube-preview" style="margin-top: 0.75rem; display: none;">
                  <p style="font-size: 0.85rem; color: var(--accent-green); margin-bottom: 0.5rem;">✅ Vídeo detectado:</p>
                  <img id="youtube-thumbnail" style="width: 100%; max-width: 200px; border-radius: 8px;">
                </div>
              </div>

              <!-- File Upload -->
              <div id="upload-input-group" class="form-group" style="display: none;">
                <label>Arquivo de Áudio *</label>
                <input type="file" id="music-file" name="file" accept="audio/*" class="input">
                <small style="color: var(--text-muted);">Formatos aceitos: MP3, WAV, OGG, M4A</small>
              </div>

              <div class="form-group">
                <label>Título *</label>
                <input type="text" id="music-title" name="title" class="input" required placeholder="Nome da música">
              </div>

              <div class="form-group">
                <label>Artista</label>
                <input type="text" id="music-artist" name="artist" class="input" placeholder="Nome do artista">
              </div>

              <div class="form-group">
                <label>Gênero</label>
                <select id="music-genre" name="genre" class="input">
                  <option value="">Selecione...</option>
                  <option value="pop">Pop</option>
                  <option value="rock">Rock</option>
                  <option value="eletronica">Eletrônica</option>
                  <option value="hiphop">Hip Hop</option>
                  <option value="sertanejo">Sertanejo</option>
                  <option value="funk">Funk</option>
                  <option value="pagode">Pagode</option>
                  <option value="mpb">MPB</option>
                  <option value="jazz">Jazz</option>
                  <option value="classica">Clássica</option>
                  <option value="lofi">Lo-Fi</option>
                  <option value="outro">Outro</option>
                </select>
              </div>

              <div class="form-group">
                <label style="display: flex; align-items: center; gap: 0.5rem;">
                  <input type="checkbox" id="music-active" name="is_active" checked>
                  Música ativa (visível para usuários)
                </label>
              </div>

              <div class="modal-footer" style="margin-top: 1.5rem;">
                <button type="button" class="btn" data-close-modal="music-modal">Cancelar</button>
                <button type="submit" class="btn btn-primary" id="save-music-btn">💾 Salvar</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <style>
      .admin-music .admin-toolbar {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
      }
      
      .music-item:hover {
        background: rgba(255,255,255,0.05) !important;
        border-color: rgba(0,255,136,0.2) !important;
      }
    </style>
  `;
}


// ==================== DATA LOADING ====================
let appInstance: any = null;

export function setAppInstance(app: any) {
  appInstance = app;
}

// Função para atualizar indicador de sincronização
function updateSyncIndicator(status: 'synced' | 'syncing' | 'error') {
  const indicator = document.getElementById('realtime-indicator');
  if (!indicator) return;
  
  indicator.classList.remove('syncing', 'error');
  const textEl = indicator.querySelector('.realtime-text');
  
  switch (status) {
    case 'syncing':
      indicator.classList.add('syncing');
      if (textEl) textEl.textContent = 'Sincronizando...';
      break;
    case 'error':
      indicator.classList.add('error');
      if (textEl) textEl.textContent = 'Erro de conexão';
      break;
    default:
      if (textEl) textEl.textContent = 'Sincronizado';
  }
}

// Sincronização em tempo real - atualiza dados críticos
async function realtimeSync() {
  if (isLoading) return;
  
  updateSyncIndicator('syncing');
  
  try {
    // Carregar apenas dados que mudam frequentemente
    const results = await Promise.allSettled([
      api.request('/api/admin/dashboard'),
      api.request('/api/admin/withdrawals'),
      api.request('/api/admin/v2/finance/dashboard'),
      api.request('/api/admin/matches?status=playing'), // Partidas ao vivo
    ]);
    
    const getData = (result: PromiseSettledResult<any>, fallback: any = {}) => {
      if (result.status === 'fulfilled' && result.value?.data) {
        return result.value.data;
      }
      return fallback;
    };
    
    // Atualizar dados sem re-render completo
    const newStats = getData(results[0], null);
    const newWithdrawals = getData(results[1], { withdrawals: [] }).withdrawals || [];
    const newFinance = getData(results[2], null);
    const liveMatches = getData(results[3], { matches: [] }).matches || [];
    
    let hasChanges = false;
    
    // Verificar se houve mudanças nos dados críticos
    if (newStats && JSON.stringify(newStats) !== JSON.stringify(adminData.stats)) {
      adminData.stats = newStats;
      hasChanges = true;
    }
    
    if (JSON.stringify(newWithdrawals) !== JSON.stringify(adminData.withdrawals)) {
      adminData.withdrawals = newWithdrawals;
      hasChanges = true;
    }
    
    if (newFinance && JSON.stringify(newFinance) !== JSON.stringify(adminData.financeDashboard)) {
      adminData.financeDashboard = newFinance;
      hasChanges = true;
    }
    
    // Atualizar partidas ao vivo
    if (adminData.stats) {
      adminData.stats.live_matches = liveMatches.length;
    }
    
    updateSyncIndicator('synced');
    
    // Re-render apenas se houver mudanças e estiver na dashboard ou finance
    if (hasChanges && appInstance && (currentTab === 'dashboard' || currentTab === 'finance' || currentTab === 'withdrawals')) {
      // Atualizar apenas os elementos específicos sem re-render completo
      updateDashboardElements();
    }
    
  } catch (err) {
    console.error('Erro na sincronização em tempo real:', err);
    updateSyncIndicator('error');
  }
}

// Atualiza elementos específicos do dashboard sem re-render completo
function updateDashboardElements() {
  const stats = adminData.stats || {};
  const finance = adminData.financeDashboard || {};
  const pendingWithdrawals = (adminData.withdrawals || []).filter((w: any) => w.status === 'pending').length;
  
  // Atualizar timestamp
  lastUpdateTime = new Date();
  const lastUpdateEl = document.getElementById('last-update-time');
  if (lastUpdateEl) {
    lastUpdateEl.textContent = lastUpdateTime.toLocaleTimeString('pt-BR');
  }
  
  // Atualizar cards de resumo
  const updateElement = (selector: string, value: string) => {
    const el = document.querySelector(selector);
    if (el && el.textContent !== value) {
      el.textContent = value;
      el.classList.add('value-updated');
      setTimeout(() => el.classList.remove('value-updated'), 500);
    }
  };
  
  // Cards principais
  updateElement('.summary-card.users .summary-value', String(stats.total_users || 0));
  updateElement('.summary-card.users .trend-value', `+${stats.new_users_today || 0}`);
  updateElement('.summary-card.games .summary-value', String(stats.total_matches || 0));
  updateElement('.summary-card.games .trend-value', String(stats.matches_today || 0));
  updateElement('.summary-card.finance .summary-value', `R$ ${(finance.revenue?.total || 0).toFixed(2)}`);
  updateElement('.summary-card.finance .trend-value', `+R$ ${(finance.revenue?.today || 0).toFixed(2)}`);
  updateElement('.summary-card.alerts .summary-value', String(pendingWithdrawals));
  
  // Atualizar badge de saques pendentes no menu
  const withdrawalBadge = document.querySelector('[data-admin-tab="withdrawals"] .nav-badge');
  if (withdrawalBadge) {
    withdrawalBadge.textContent = String(pendingWithdrawals);
    (withdrawalBadge as HTMLElement).style.display = pendingWithdrawals > 0 ? 'inline' : 'none';
  }
  
  // Atualizar badge do grupo financeiro
  const groupBadge = document.querySelector('[data-toggle-group="finance-group"] .group-badge');
  if (groupBadge) {
    groupBadge.textContent = String(pendingWithdrawals);
    (groupBadge as HTMLElement).style.display = pendingWithdrawals > 0 ? 'inline' : 'none';
  }
}

// Iniciar sincronização em tempo real
function startRealtimeSync() {
  if (realtimeSyncInterval) return; // Já está rodando
  
  realtimeSyncInterval = setInterval(realtimeSync, REALTIME_SYNC_INTERVAL);
  console.log('🔄 Sincronização em tempo real iniciada');
}

// Parar sincronização em tempo real
function stopRealtimeSync() {
  if (realtimeSyncInterval) {
    clearInterval(realtimeSyncInterval);
    realtimeSyncInterval = null;
    console.log('⏹️ Sincronização em tempo real parada');
  }
}

async function loadAdminData(app?: any) {
  if (isLoading) return; // Evitar chamadas duplicadas

  isLoading = true;

  // Usar app passado ou appInstance
  const renderApp = app || appInstance;

  // Forçar re-render para mostrar loading
  if (renderApp) {
    renderApp.render();
  }

  try {
    // Carregar dados em paralelo - tratando erros individualmente
    const results = await Promise.allSettled([
      api.request('/api/admin/dashboard'),
      api.request('/api/admin/users'),
      api.request('/api/admin/matches'),
      api.request('/api/settings'),
      api.request('/api/admin/withdrawals'),
      api.request('/api/admin/v2/tournaments'),
      api.request('/api/admin/v2/audit/logs?limit=50'),
      api.request('/api/admin/employees'),
      api.request('/api/admin/employees/invites'),
      api.request('/api/coupons'),
      api.request('/api/missions/admin'),
      api.request('/api/admin/referrals'),
      api.request('/api/admin/referrals/stats'),
      api.request('/api/admin/payments/settings'), // Configurações de pagamento
      api.request('/api/admin/v2/finance/dashboard'), // Dashboard financeiro
      api.request('/api/admin/banners'), // Banners
      api.request('/api/music/admin/tracks?includeInactive=true'), // Músicas
      api.request('/api/music/admin/stats'), // Estatísticas de música
    ]);

    // Extrair dados com fallback para valores vazios
    const getData = (result: PromiseSettledResult<any>, fallback: any = {}) => {
      if (result.status === 'fulfilled' && result.value?.data) {
        return result.value.data;
      }
      return fallback;
    };

    adminData.stats = getData(results[0], { users: {}, matches: {}, rooms: {}, bets: {} });
    adminData.users = getData(results[1], { users: [] }).users || [];
    adminData.matches = getData(results[2], { matches: [] }).matches || [];
    adminData.settings = getData(results[3], {});
    adminData.withdrawals = getData(results[4], { withdrawals: [] }).withdrawals || [];
    adminData.tournaments = getData(results[5], { tournaments: [] }).tournaments || [];
    adminData.logs = getData(results[6], { logs: [] }).logs || [];
    adminData.employees = getData(results[7], { employees: [] }).employees || [];
    adminData.invites = getData(results[8], { invites: [] }).invites || [];
    adminData.coupons = getData(results[9], { coupons: [] }).coupons || [];
    adminData.missions = getData(results[10], { missions: [] }).missions || [];
    adminData.referrals = getData(results[11], { referrals: [] }).referrals || [];
    adminData.referralStats = getData(results[12], {});

    // Mesclar configurações de pagamento nas configurações gerais
    const paymentSettings = getData(results[13], { settings: null }).settings;
    if (paymentSettings) {
      adminData.settings.payment_environment = paymentSettings.environment;
      adminData.settings.payment_client_id = paymentSettings.clientId;
      adminData.settings.payment_pix_key = paymentSettings.pixKey;
      adminData.settings.payment_active = paymentSettings.isActive;
      adminData.settings.certificate_uploaded = paymentSettings.certificateUploaded;
    }

    // Usar dados reais do dashboard financeiro se disponíveis
    const financeData = getData(results[14], null);

    // Banners
    adminData.banners = getData(results[15], { banners: [] }).banners || [];

    // Músicas
    adminData.musicTracks = getData(results[16], { tracks: [] }).tracks || [];
    adminData.musicStats = getData(results[17], { stats: [] }).stats || [];

    if (financeData) {
      adminData.financeDashboard = financeData;
    } else {
      // Fallback para dados calculados localmente
      adminData.financeDashboard = {
        revenue: { total: 0, today: 0, week: 0, month: 0 },
        withdrawals: { pending_count: adminData.withdrawals.filter((w: any) => w.status === 'pending').length },
        bets: { active_count: 0, active_pool: 0 },
        users: { total_balance: 0 },
        bonus: {},
      };
    }
    
    // Iniciar sincronização em tempo real após carregar dados iniciais
    startRealtimeSync();
    
  } catch (err) {
    console.error('Erro ao carregar dados admin:', err);
  }

  isLoading = false;

  // Forçar re-render após carregar dados
  if (renderApp) {
    renderApp.render();
  }
}

// ==================== EVENT BINDINGS ====================
export function bindAdminEvents(app: any) {
  // Guardar referência do app
  setAppInstance(app);

  // Toggle grupos colapsáveis do menu
  document.querySelectorAll('[data-toggle-group]').forEach(el => {
    el.addEventListener('click', () => {
      const groupId = (el as HTMLElement).dataset.toggleGroup!;
      if (collapsedGroups.has(groupId)) {
        collapsedGroups.delete(groupId);
      } else {
        collapsedGroups.add(groupId);
      }
      app.render();
      setTimeout(() => bindAdminEvents(app), 50);
    });
  });

  // Botão de atualizar tudo
  document.getElementById('refresh-all-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refresh-all-btn') as HTMLButtonElement;
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Atualizando...';
    }
    
    // Resetar estado e recarregar
    dataLoadStarted = false;
    adminData.stats = null;
    await loadAdminData(app);
    
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 Atualizar Tudo';
    }
    
    toast.success('Dados atualizados!');
    bindAdminEvents(app);
  });

  // Tab navigation
  document.querySelectorAll('[data-admin-tab]').forEach(el => {
    el.addEventListener('click', () => {
      currentTab = (el as HTMLElement).dataset.adminTab as AdminTab;
      app.render();
      // Re-bind events após render
      setTimeout(() => bindAdminEvents(app), 50);
    });
  });

  // Settings tabs
  document.querySelectorAll('.settings-tab').forEach(el => {
    el.addEventListener('click', () => {
      const tab = (el as HTMLElement).dataset.settingsTab;
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      el.classList.add('active');
      document.querySelectorAll('.settings-section').forEach(s => {
        (s as HTMLElement).classList.toggle('hidden', (s as HTMLElement).dataset.section !== tab);
      });
    });
  });

  // Close modals
  document.querySelectorAll('[data-close-modal]').forEach(el => {
    el.addEventListener('click', () => {
      const modalId = (el as HTMLElement).dataset.closeModal;
      if (modalId === 'user-modal') selectedUser = null;
      if (modalId === 'match-modal') selectedMatch = null;
      document.getElementById(modalId!)?.classList.remove('active');
    });
  });

  // Refresh buttons
  document.getElementById('refresh-users-btn')?.addEventListener('click', async () => {
    const statusFilter = (document.getElementById('user-status-filter') as HTMLSelectElement)?.value || '';
    const url = statusFilter ? `/api/admin/users?status=${statusFilter}` : '/api/admin/users';
    const res = await api.request(url);
    adminData.users = res.data?.users || res.users || [];
    app.render();
    bindAdminEvents(app);
  });

  // Filtro de status de usuários
  document.getElementById('user-status-filter')?.addEventListener('change', async () => {
    const statusFilter = (document.getElementById('user-status-filter') as HTMLSelectElement)?.value || '';
    const url = statusFilter ? `/api/admin/users?status=${statusFilter}` : '/api/admin/users';
    const res = await api.request(url);
    adminData.users = res.data?.users || res.users || [];
    app.render();
    bindAdminEvents(app);
  });

  document.getElementById('refresh-matches-btn')?.addEventListener('click', async () => {
    const res = await api.request('/api/admin/matches');
    adminData.matches = res.data?.matches || [];
    app.render();
    bindAdminEvents(app);
  });

  document.getElementById('refresh-withdrawals-btn')?.addEventListener('click', async () => {
    const filter = (document.getElementById('withdrawal-filter') as HTMLSelectElement)?.value || 'pending';
    const res = await api.request(`/api/admin/v2/finance/withdrawals?status=${filter}`);
    adminData.withdrawals = res.data?.withdrawals || [];
    app.render();
    bindAdminEvents(app);
  });

  document.getElementById('refresh-tournaments-btn')?.addEventListener('click', async () => {
    const res = await api.request('/api/admin/v2/tournaments');
    adminData.tournaments = res.data?.tournaments || [];
    app.render();
    bindAdminEvents(app);
  });

  // ==================== BANNERS HANDLERS ====================
  
  document.getElementById('refresh-banners-btn')?.addEventListener('click', async () => {
    const res = await api.request('/api/admin/banners');
    adminData.banners = res.data?.banners || [];
    app.render();
    bindAdminEvents(app);
  });

  document.getElementById('create-banner-btn')?.addEventListener('click', () => {
    // Limpar formulário
    const form = document.getElementById('banner-form') as HTMLFormElement;
    if (form) form.reset();
    (document.getElementById('banner-id') as HTMLInputElement).value = '';
    (document.getElementById('banner-modal-title') as HTMLElement).textContent = 'Criar Banner';
    document.getElementById('banner-modal')?.classList.add('active');
  });

  // Banner form submit
  document.getElementById('banner-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const bannerId = formData.get('banner_id') as string;

    const data = {
      title: formData.get('title'),
      subtitle: formData.get('subtitle') || undefined,
      position: formData.get('position') || 'home_top',
      display_order: Number(formData.get('display_order')) || 0,
      image_url: formData.get('image_url') || undefined,
      link_url: formData.get('link_url') || undefined,
      link_text: formData.get('link_text') || 'Saiba mais',
      background_color: formData.get('background_color') || undefined,
      tournament_id: formData.get('tournament_id') || undefined,
      starts_at: formData.get('starts_at') || undefined,
      ends_at: formData.get('ends_at') || undefined,
      is_active: formData.get('is_active') === 'on',
    };

    try {
      const url = bannerId ? `/api/admin/banners/${bannerId}` : '/api/admin/banners';
      const method = bannerId ? 'PUT' : 'POST';
      
      const res = await api.request(url, { method, body: JSON.stringify(data) });

      if (res.error) {
        toast.error('Erro', res.error);
        return;
      }

      toast.success(bannerId ? 'Banner atualizado!' : 'Banner criado!');
      document.getElementById('banner-modal')?.classList.remove('active');
      form.reset();

      const listRes = await api.request('/api/admin/banners');
      adminData.banners = listRes.data?.banners || [];
      app.render();
      bindAdminEvents(app);
    } catch (err: any) {
      toast.error('Erro', err.message);
    }
  });

  // Toggle banner active
  document.querySelectorAll('[data-toggle-banner]').forEach(el => {
    el.addEventListener('click', async () => {
      const bannerId = (el as HTMLElement).dataset.toggleBanner;
      const isActive = (el as HTMLElement).dataset.active === 'true';

      const res = await api.request(`/api/admin/banners/${bannerId}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !isActive }),
      });

      if (res.error) {
        toast.error('Erro', res.error);
        return;
      }

      toast.success(isActive ? 'Banner desativado' : 'Banner ativado');
      const listRes = await api.request('/api/admin/banners');
      adminData.banners = listRes.data?.banners || [];
      app.render();
      bindAdminEvents(app);
    });
  });

  // Delete banner
  document.querySelectorAll('[data-delete-banner]').forEach(el => {
    el.addEventListener('click', async () => {
      const bannerId = (el as HTMLElement).dataset.deleteBanner;
      if (!confirm('Excluir este banner?')) return;

      const res = await api.request(`/api/admin/banners/${bannerId}`, { method: 'DELETE' });

      if (res.error) {
        toast.error('Erro', res.error);
        return;
      }

      toast.success('Banner excluído');
      const listRes = await api.request('/api/admin/banners');
      adminData.banners = listRes.data?.banners || [];
      app.render();
      bindAdminEvents(app);
    });
  });

  // Edit banner
  document.querySelectorAll('[data-edit-banner]').forEach(el => {
    el.addEventListener('click', () => {
      const bannerId = (el as HTMLElement).dataset.editBanner;
      const banner = adminData.banners?.find((b: any) => b.id === bannerId);
      if (!banner) return;

      // Preencher formulário
      const form = document.getElementById('banner-form') as HTMLFormElement;
      if (!form) return;

      (document.getElementById('banner-id') as HTMLInputElement).value = banner.id;
      (document.getElementById('banner-modal-title') as HTMLElement).textContent = 'Editar Banner';
      
      (form.querySelector('[name="title"]') as HTMLInputElement).value = banner.title || '';
      (form.querySelector('[name="subtitle"]') as HTMLInputElement).value = banner.subtitle || '';
      (form.querySelector('[name="position"]') as HTMLSelectElement).value = banner.position || 'home_top';
      (form.querySelector('[name="display_order"]') as HTMLInputElement).value = banner.display_order?.toString() || '0';
      (form.querySelector('[name="image_url"]') as HTMLInputElement).value = banner.image_url || '';
      (form.querySelector('[name="link_url"]') as HTMLInputElement).value = banner.link_url || '';
      (form.querySelector('[name="link_text"]') as HTMLInputElement).value = banner.link_text || 'Saiba mais';
      (form.querySelector('[name="background_color"]') as HTMLSelectElement).value = banner.background_color || '';
      (form.querySelector('[name="tournament_id"]') as HTMLSelectElement).value = banner.tournament_id || '';
      (form.querySelector('[name="starts_at"]') as HTMLInputElement).value = banner.starts_at ? banner.starts_at.slice(0, 16) : '';
      (form.querySelector('[name="ends_at"]') as HTMLInputElement).value = banner.ends_at ? banner.ends_at.slice(0, 16) : '';
      (form.querySelector('[name="is_active"]') as HTMLInputElement).checked = banner.is_active !== false;

      document.getElementById('banner-modal')?.classList.add('active');
    });
  });

  // Toggle tournament featured
  document.querySelectorAll('[data-toggle-featured]').forEach(el => {
    el.addEventListener('click', async () => {
      const tournamentId = (el as HTMLElement).dataset.toggleFeatured;
      const isFeatured = (el as HTMLElement).dataset.featured === 'true';
      const orderInput = document.querySelector(`[data-order-input="${tournamentId}"]`) as HTMLInputElement;
      const featuredOrder = orderInput ? parseInt(orderInput.value) : 0;

      const res = await api.request(`/api/admin/banners/tournaments/${tournamentId}/feature`, {
        method: 'POST',
        body: JSON.stringify({ is_featured: !isFeatured, featured_order: featuredOrder }),
      });

      if (res.error) {
        toast.error('Erro', res.error);
        return;
      }

      toast.success(isFeatured ? 'Destaque removido' : 'Torneio destacado!');
      const listRes = await api.request('/api/admin/v2/tournaments');
      adminData.tournaments = listRes.data?.tournaments || [];
      app.render();
      bindAdminEvents(app);
    });
  });

  // Update featured order on blur
  document.querySelectorAll('[data-order-input]').forEach(el => {
    el.addEventListener('blur', async () => {
      const tournamentId = (el as HTMLElement).dataset.orderInput;
      const featuredOrder = parseInt((el as HTMLInputElement).value) || 0;

      await api.request(`/api/admin/banners/tournaments/${tournamentId}/feature`, {
        method: 'POST',
        body: JSON.stringify({ is_featured: true, featured_order: featuredOrder }),
      });
    });
  });

  document.getElementById('refresh-logs-btn')?.addEventListener('click', async () => {
    const action = (document.getElementById('log-action-filter') as HTMLSelectElement)?.value;
    const url = action ? `/api/admin/v2/audit/logs?action=${action}&limit=50` : '/api/admin/v2/audit/logs?limit=50';
    const res = await api.request(url);
    adminData.logs = res.data?.logs || [];
    app.render();
    bindAdminEvents(app);
  });

  // View user
  document.querySelectorAll('[data-view-user]').forEach(el => {
    el.addEventListener('click', async () => {
      const userId = (el as HTMLElement).dataset.viewUser;
      const res = await api.request(`/api/admin/users/${userId}`);
      if (res.data) {
        selectedUser = res.data;
        // Re-renderizar para mostrar o modal com os dados
        app.render();
        // Aguardar o DOM atualizar antes de bind events
        setTimeout(() => {
          bindAdminEvents(app);
        }, 50);
      }
    });
  });

  // User modal tabs
  document.querySelectorAll('[data-user-tab]').forEach(el => {
    el.addEventListener('click', () => {
      const tab = (el as HTMLElement).dataset.userTab;

      // Update active tab button styles
      document.querySelectorAll('.user-tab').forEach(t => {
        t.classList.remove('active');
        (t as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
        (t as HTMLElement).style.color = 'var(--text-secondary)';
      });
      el.classList.add('active');
      (el as HTMLElement).style.background = 'var(--accent-green)';
      (el as HTMLElement).style.color = '#000';

      // Show/hide tab content
      document.querySelectorAll('.user-tab-content').forEach(c => {
        c.classList.add('hidden');
      });
      document.getElementById(`tab-${tab}`)?.classList.remove('hidden');
    });
  });

  // Load user transactions
  document.getElementById('load-user-transactions-btn')?.addEventListener('click', async (e) => {
    const btn = e.target as HTMLButtonElement;
    const userId = btn.dataset.userId;
    if (!userId) return;

    btn.textContent = '⏳ Carregando...';
    btn.disabled = true;

    try {
      const res = await api.request(`/api/admin/v2/users/${userId}/transactions?limit=30`);
      const transactions = res.data?.transactions || [];

      const container = document.getElementById('user-transactions-list');
      if (container) {
        if (transactions.length === 0) {
          container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhuma transação encontrada.</p>';
        } else {
          container.innerHTML = transactions.map((t: any) => {
            const isPositive = t.amount > 0;
            return `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 0.5rem;">
                <div>
                  <div style="font-weight: 600; color: var(--text-primary);">${t.type}</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">${new Date(t.created_at).toLocaleString('pt-BR')}</div>
                </div>
                <div style="font-weight: 700; color: ${isPositive ? 'var(--accent-green)' : '#ff6b6b'};">
                  ${isPositive ? '+' : ''}R$ ${t.amount.toFixed(2)}
                </div>
              </div>
            `;
          }).join('');
        }
      }
    } catch (err) {
      btn.textContent = '❌ Erro ao carregar';
    }
  });

  // Load user credits history
  document.getElementById('load-user-credits-btn')?.addEventListener('click', async (e) => {
    const btn = e.target as HTMLButtonElement;
    const userId = btn.dataset.userId;
    if (!userId) return;

    btn.textContent = '⏳ Carregando...';
    btn.disabled = true;

    try {
      const res = await api.request(`/api/admin/v2/users/${userId}/credits-history?limit=30`);
      const data = res.data || {};
      const history = data.history || [];
      const totals = data.totals || {};

      // Update totals
      const earnedEl = document.getElementById('credits-earned');
      const spentEl = document.getElementById('credits-spent');
      const bonusEl = document.getElementById('credits-bonus');
      const netEl = document.getElementById('credits-net');

      if (earnedEl) earnedEl.textContent = String(totals.creditsEarned || 0);
      if (spentEl) spentEl.textContent = String(totals.creditsSpent || 0);
      if (bonusEl) bonusEl.textContent = String(totals.creditsBonus || 0);
      if (netEl) netEl.textContent = String(totals.netCredits || 0);

      const container = document.getElementById('user-credits-list');
      if (container) {
        if (history.length === 0) {
          container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhum registro encontrado.</p>';
        } else {
          container.innerHTML = history.map((h: any) => {
            const isBonus = h.type === 'bonus';
            const isPositive = h.amount > 0;
            return `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 0.5rem;">
                <div>
                  <div style="font-weight: 600; color: var(--text-primary);">
                    ${isBonus ? '🎁' : '🎫'} ${h.subtype || h.type}
                  </div>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">
                    ${h.description || ''}
                    ${h.adminName ? `(por ${h.adminName})` : ''}
                  </div>
                  <div style="font-size: 0.7rem; color: var(--text-muted);">${new Date(h.createdAt).toLocaleString('pt-BR')}</div>
                </div>
                <div style="font-weight: 700; color: ${isPositive ? 'var(--accent-green)' : '#ff6b6b'};">
                  ${isPositive ? '+' : ''}${h.amount} ${h.amountType === 'credits' ? 'créditos' : 'reais'}
                </div>
              </div>
            `;
          }).join('');
        }
      }
    } catch (err) {
      btn.textContent = '❌ Erro ao carregar';
    }
  });

  // Load user matches history
  document.getElementById('load-user-matches-btn')?.addEventListener('click', async (e) => {
    const btn = e.target as HTMLButtonElement;
    const userId = btn.dataset.userId;
    if (!userId) return;

    btn.textContent = '⏳ Carregando...';
    btn.disabled = true;

    try {
      const res = await api.request(`/api/admin/v2/users/${userId}/matches?limit=30`);
      const matches = res.data?.matches || [];

      const container = document.getElementById('user-matches-list');
      if (container) {
        if (matches.length === 0) {
          container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhuma partida encontrada.</p>';
        } else {
          container.innerHTML = matches.map((m: any) => {
            const isWinner = m.winner_id === userId;
            const opponent = m.player1_id === userId ? m.player2 : m.player1;
            const statusColors: Record<string, string> = {
              'finished': isWinner ? 'var(--accent-green)' : '#ff6b6b',
              'playing': 'var(--accent-yellow)',
              'waiting': 'var(--text-muted)'
            };
            const statusIcons: Record<string, string> = {
              'finished': isWinner ? '🏆' : '❌',
              'playing': '🎮',
              'waiting': '⏳'
            };
            return `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 0.5rem;">
                <div style="flex: 1;">
                  <div style="font-weight: 600; color: var(--text-primary);">
                    ${statusIcons[m.status] || '🎮'} vs ${opponent?.username || 'Desconhecido'}
                  </div>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">
                    ${m.room?.mode || 'casual'} • ${new Date(m.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-weight: 700; color: ${statusColors[m.status] || 'var(--text-muted)'};">
                    ${m.status === 'finished' ? (isWinner ? 'Vitória' : 'Derrota') : m.status === 'playing' ? 'Em jogo' : 'Aguardando'}
                  </div>
                  ${m.bet_amount ? `<div style="font-size: 0.8rem; color: var(--accent-yellow);">R$ ${m.bet_amount.toFixed(2)}</div>` : ''}
                </div>
              </div>
            `;
          }).join('');
        }
      }
    } catch (err) {
      btn.textContent = '❌ Erro ao carregar';
    }
  });

  // Load user withdrawals history
  document.getElementById('load-user-withdrawals-btn')?.addEventListener('click', async (e) => {
    const btn = e.target as HTMLButtonElement;
    const userId = btn.dataset.userId;
    if (!userId) return;

    btn.textContent = '⏳ Carregando...';
    btn.disabled = true;

    try {
      const res = await api.request(`/api/admin/v2/users/${userId}/withdrawals?limit=30`);
      const withdrawals = res.data?.withdrawals || [];

      const container = document.getElementById('user-withdrawals-list');
      if (container) {
        if (withdrawals.length === 0) {
          container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhum saque encontrado.</p>';
        } else {
          container.innerHTML = withdrawals.map((w: any) => {
            const statusColors: Record<string, string> = {
              'pending': 'var(--accent-yellow)',
              'approved': 'var(--accent-green)',
              'rejected': '#ff6b6b',
              'cancelled': 'var(--text-muted)'
            };
            const statusLabels: Record<string, string> = {
              'pending': '⏳ Pendente',
              'approved': '✅ Aprovado',
              'rejected': '❌ Rejeitado',
              'cancelled': '🚫 Cancelado'
            };
            return `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 0.5rem;">
                <div>
                  <div style="font-weight: 600; color: var(--text-primary);">
                    💸 Saque via ${w.pix_key_type || 'PIX'}
                  </div>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">
                    ${w.pix_key ? `Chave: ${w.pix_key.slice(0, 10)}...` : ''}
                  </div>
                  <div style="font-size: 0.7rem; color: var(--text-muted);">${new Date(w.created_at).toLocaleString('pt-BR')}</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-weight: 700; color: #ff6b6b;">R$ ${w.amount.toFixed(2)}</div>
                  <div style="font-size: 0.8rem; color: ${statusColors[w.status] || 'var(--text-muted)'};">
                    ${statusLabels[w.status] || w.status}
                  </div>
                </div>
              </div>
            `;
          }).join('');
        }
      }
    } catch (err) {
      btn.textContent = '❌ Erro ao carregar';
    }
  });

  // View match
  document.querySelectorAll('[data-view-match]').forEach(el => {
    el.addEventListener('click', () => {
      const matchId = (el as HTMLElement).dataset.viewMatch;
      selectedMatch = adminData.matches.find((m: any) => m.id === matchId);
      if (selectedMatch) {
        app.render();
        setTimeout(() => {
          bindAdminEvents(app);
        }, 50);
      }
    });
  });

  // Create tournament button
  document.getElementById('create-tournament-btn')?.addEventListener('click', () => {
    document.getElementById('tournament-modal')?.classList.add('active');
    
    // Atualizar estimativa de premiação quando mudar taxa ou participantes
    setTimeout(() => {
      const updateEstimate = () => {
        const entryFee = parseFloat((document.querySelector('[name="entry_fee"]') as HTMLInputElement)?.value || '0');
        const maxParticipants = parseInt((document.querySelector('[name="max_participants"]') as HTMLSelectElement)?.value || '16');
        const estimateEl = document.getElementById('prize-estimate');
        
        if (estimateEl && entryFee > 0) {
          const totalCollected = entryFee * maxParticipants;
          const prizePool = totalCollected * 0.7; // 70% premiação para admin
          estimateEl.textContent = `R$ ${prizePool.toFixed(0)}`;
        } else if (estimateEl) {
          estimateEl.textContent = '-';
        }
      };
      
      document.querySelector('[name="entry_fee"]')?.addEventListener('input', updateEstimate);
      document.querySelector('[name="max_participants"]')?.addEventListener('change', updateEstimate);
      
      // Atualizar data do torneio quando mudar data de término das inscrições
      document.querySelector('[name="registration_end_date"]')?.addEventListener('change', () => {
        const regEndInput = document.querySelector('[name="registration_end_date"]') as HTMLInputElement;
        const startDateInput = document.querySelector('[name="start_date"]') as HTMLInputElement;
        
        if (regEndInput?.value && startDateInput) {
          const regEndDate = new Date(regEndInput.value);
          const suggestedStart = new Date(regEndDate.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 dias
          startDateInput.value = suggestedStart.toISOString().slice(0, 16);
          startDateInput.min = regEndInput.value;
        }
      });
      
      updateEstimate();
    }, 100);
  });

  // Tournament form submit
  document.getElementById('tournament-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    // Validar datas
    const regStartDate = formData.get('registration_start_date') as string;
    const regEndDate = formData.get('registration_end_date') as string;
    const startDate = formData.get('start_date') as string;

    if (!regStartDate || !regEndDate || !startDate) {
      toast.error('Erro', 'Preencha todas as datas obrigatórias');
      return;
    }

    const regStart = new Date(regStartDate);
    const regEnd = new Date(regEndDate);
    const tournamentStart = new Date(startDate);
    const now = new Date();

    if (regStart < now) {
      toast.error('Erro', 'A data de início das inscrições deve ser no futuro');
      return;
    }

    if (regEnd <= regStart) {
      toast.error('Erro', 'A data de término das inscrições deve ser após o início');
      return;
    }

    if (tournamentStart <= regEnd) {
      toast.error('Erro', 'O torneio deve iniciar após o término das inscrições');
      return;
    }

    // Processar cor do banner
    const bannerColorValue = formData.get('banner_color') as string;
    
    const data = {
      name: formData.get('name'),
      description: formData.get('description') || undefined,
      registration_start_date: regStart.toISOString(),
      registration_end_date: regEnd.toISOString(),
      start_date: tournamentStart.toISOString(),
      entry_fee: Number(formData.get('entry_fee')) || 0,
      game_mode: formData.get('game_mode') || '15ball',
      min_participants: Number(formData.get('min_participants')) || 4,
      max_participants: Number(formData.get('max_participants')) || 16,
      is_vip_only: formData.get('is_vip_only') === 'on',
      is_featured: formData.get('is_featured') === 'on',
      featured_order: Number(formData.get('featured_order')) || 0,
      banner_color: bannerColorValue || undefined,
    };

    try {
      const res = await api.request('/api/admin/v2/tournaments', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (res.error) {
        toast.error('Erro ao criar torneio', res.error);
        return;
      }

      toast.success('Torneio criado com sucesso!', 'As inscrições abrirão na data definida.');
      document.getElementById('tournament-modal')?.classList.remove('active');
      form.reset();

      // Atualizar lista de torneios
      const listRes = await api.request('/api/admin/v2/tournaments');
      adminData.tournaments = listRes.data?.tournaments || [];
      app.render();
      bindAdminEvents(app);
    } catch (err: any) {
      toast.error('Erro ao criar torneio', err.message || 'Erro desconhecido');
    }
  });

  // Open tournament registration
  document.querySelectorAll('[data-open-tournament]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset.openTournament;
      if (!confirm('Deseja abrir as inscrições para este torneio?')) return;

      try {
        await api.request(`/api/admin/v2/tournaments/${id}/open`, { method: 'POST' });
        toast.success('Inscrições abertas com sucesso!');

        const res = await api.request('/api/admin/v2/tournaments');
        adminData.tournaments = res.data?.tournaments || [];
        app.render();
        bindAdminEvents(app);
      } catch (err: any) {
        toast.error('Erro ao abrir inscrições', err.message);
      }
    });
  });

  // Start tournament
  document.querySelectorAll('[data-start-tournament]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset.startTournament;
      if (!confirm('Deseja iniciar este torneio? Esta ação não pode ser desfeita.')) return;

      try {
        const res = await api.request(`/api/admin/v2/tournaments/${id}/start`, { method: 'POST' });
        if (res.error) {
          toast.error('Erro ao iniciar torneio', res.error);
          return;
        }
        toast.success('Torneio iniciado com sucesso!');

        const listRes = await api.request('/api/admin/v2/tournaments');
        adminData.tournaments = listRes.data?.tournaments || [];
        app.render();
        bindAdminEvents(app);
      } catch (err: any) {
        toast.error('Erro ao iniciar torneio', err.message);
      }
    });
  });

  // Cancel tournament
  document.querySelectorAll('[data-cancel-tournament]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset.cancelTournament;
      const reason = prompt('Por favor, informe o motivo do cancelamento:');
      if (!reason || reason.trim().length < 5) {
        toast.warning('Motivo obrigatório (mínimo 5 caracteres)');
        return;
      }

      try {
        const res = await api.request(`/api/admin/v2/tournaments/${id}/cancel`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        });

        if (res.error) {
          toast.error('Erro ao cancelar torneio', res.error);
          return;
        }

        toast.success('Torneio cancelado', res.data?.refunded ? 'Valores reembolsados' : '');

        const listRes = await api.request('/api/admin/v2/tournaments');
        adminData.tournaments = listRes.data?.tournaments || [];
        app.render();
        bindAdminEvents(app);
      } catch (err: any) {
        toast.error('Erro ao cancelar torneio', err.message);
      }
    });
  });

  // Ban/Unban user - Abrir modal de banimento
  document.querySelectorAll('[data-open-ban-modal]').forEach(el => {
    el.addEventListener('click', () => {
      const userId = (el as HTMLElement).dataset.openBanModal;
      const username = (el as HTMLElement).dataset.username;
      
      // Preencher dados do modal
      (document.getElementById('ban-user-id') as HTMLInputElement).value = userId || '';
      (document.getElementById('ban-username') as HTMLElement).textContent = username || '';
      
      // Reset form
      (document.querySelector('input[name="ban-type"][value="suspension"]') as HTMLInputElement).checked = true;
      (document.getElementById('ban-duration') as HTMLSelectElement).value = '24';
      (document.getElementById('ban-reason-code') as HTMLSelectElement).selectedIndex = 0;
      (document.getElementById('ban-reason-detail') as HTMLTextAreaElement).value = '';
      (document.getElementById('ban-delete-data') as HTMLInputElement).checked = false;
      
      // Mostrar/esconder campos baseado no tipo
      document.getElementById('ban-duration-group')!.style.display = 'block';
      document.getElementById('ban-delete-data-group')!.style.display = 'none';
      
      // Abrir modal
      document.getElementById('ban-user-modal')?.classList.add('active');
    });
  });

  // Alternar tipo de punição (suspensão/banimento)
  document.querySelectorAll('input[name="ban-type"]').forEach(el => {
    el.addEventListener('change', (e) => {
      const type = (e.target as HTMLInputElement).value;
      const durationGroup = document.getElementById('ban-duration-group');
      const deleteDataGroup = document.getElementById('ban-delete-data-group');
      
      if (type === 'ban') {
        durationGroup!.style.display = 'none';
        deleteDataGroup!.style.display = 'block';
      } else {
        durationGroup!.style.display = 'block';
        deleteDataGroup!.style.display = 'none';
        (document.getElementById('ban-delete-data') as HTMLInputElement).checked = false;
      }
    });
  });

  // Confirmar banimento/suspensão
  document.getElementById('confirm-ban-user-btn')?.addEventListener('click', async () => {
    const userId = (document.getElementById('ban-user-id') as HTMLInputElement).value;
    const username = (document.getElementById('ban-username') as HTMLElement).textContent;
    const banType = (document.querySelector('input[name="ban-type"]:checked') as HTMLInputElement).value;
    const durationHours = parseInt((document.getElementById('ban-duration') as HTMLSelectElement).value);
    const reasonCode = (document.getElementById('ban-reason-code') as HTMLSelectElement).value;
    const reasonDetail = (document.getElementById('ban-reason-detail') as HTMLTextAreaElement).value;
    const deleteData = (document.getElementById('ban-delete-data') as HTMLInputElement).checked;
    
    const isPermanent = banType === 'ban';
    const reasonText = reasonDetail ? `${reasonDetail}` : (document.getElementById('ban-reason-code') as HTMLSelectElement).options[(document.getElementById('ban-reason-code') as HTMLSelectElement).selectedIndex].text.split(' - ')[1] || reasonCode;
    
    // Confirmação extra para banimento permanente com exclusão de dados
    if (isPermanent && deleteData) {
      const confirmDelete = confirm(`⚠️ ATENÇÃO!\n\nVocê está prestes a BANIR PERMANENTEMENTE e DELETAR TODOS OS DADOS do usuário "${username}".\n\nEsta ação é IRREVERSÍVEL!\n\nTem certeza que deseja continuar?`);
      if (!confirmDelete) return;
      
      const doubleConfirm = confirm(`🚨 ÚLTIMA CONFIRMAÇÃO!\n\nDigite "CONFIRMAR" na próxima caixa para deletar permanentemente o usuário "${username}".`);
      if (!doubleConfirm) return;
      
      const typed = prompt('Digite CONFIRMAR para prosseguir:');
      if (typed !== 'CONFIRMAR') {
        toast.error('Operação cancelada', 'Confirmação incorreta');
        return;
      }
    } else if (isPermanent) {
      if (!confirm(`Tem certeza que deseja BANIR PERMANENTEMENTE o usuário "${username}"?\n\nMotivo: ${reasonCode}\n${reasonText}`)) return;
    } else {
      if (!confirm(`Tem certeza que deseja SUSPENDER o usuário "${username}" por ${durationHours} horas?\n\nMotivo: ${reasonCode}\n${reasonText}`)) return;
    }
    
    try {
      const res = await api.request(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        body: JSON.stringify({
          reason: reasonText,
          reason_code: reasonCode,
          is_permanent: isPermanent,
          duration_hours: isPermanent ? null : durationHours,
          delete_data: isPermanent && deleteData,
        }),
      });
      
      if (res.error) {
        toast.error('Erro ao aplicar punição', res.error);
        return;
      }
      
      // Fechar modal
      document.getElementById('ban-user-modal')?.classList.remove('active');
      
      if (isPermanent && deleteData) {
        toast.success('Usuário deletado', `${username} foi banido e todos os dados foram excluídos.`);
      } else if (isPermanent) {
        toast.success('Usuário banido', `${username} foi banido permanentemente.`);
      } else {
        toast.success('Usuário suspenso', `${username} foi suspenso por ${durationHours} horas.`);
      }
      
      // Recarregar lista de usuários
      const usersRes = await api.request('/api/admin/users');
      adminData.users = usersRes.users || [];
      app.render();
      bindAdminEvents(app);
    } catch (err: any) {
      toast.error('Erro ao aplicar punição', err.message);
    }
  });

  // Desbanir/Dessuspender usuário
  document.querySelectorAll('[data-unban-user]').forEach(el => {
    el.addEventListener('click', async () => {
      const userId = (el as HTMLElement).dataset.unbanUser;
      const username = (el as HTMLElement).dataset.username || 'este usuário';
      
      if (!confirm(`Deseja desbanir/dessuspender "${username}"?\n\nO usuário poderá acessar a plataforma normalmente.`)) return;
      
      try {
        const res = await api.request(`/api/admin/users/${userId}/unban`, {
          method: 'POST',
          body: JSON.stringify({ reason: 'Desbanido pelo administrador' }),
        });
        
        if (res.error) {
          toast.error('Erro ao desbanir', res.error);
          return;
        }
        
        toast.success('Usuário desbanido', `${username} foi desbanido com sucesso.`);
        
        // Recarregar lista de usuários
        const usersRes = await api.request('/api/admin/users');
        adminData.users = usersRes.users || [];
        app.render();
        bindAdminEvents(app);
      } catch (err: any) {
        toast.error('Erro ao desbanir', err.message);
      }
    });
  });

  // Approve/Reject withdrawal
  document.querySelectorAll('[data-approve-withdrawal]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset.approveWithdrawal;
      if (confirm('Aprovar este saque? Certifique-se de ter feito a transferência PIX.')) {
        await api.request(`/api/admin/v2/finance/withdrawals/${id}/approve`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        alert('Saque aprovado!');
        location.reload();
      }
    });
  });

  document.querySelectorAll('[data-reject-withdrawal]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset.rejectWithdrawal;
      const reason = prompt('Motivo da rejeição:');
      if (reason) {
        await api.request(`/api/admin/v2/finance/withdrawals/${id}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        });
        alert('Saque rejeitado. Valor devolvido ao usuário.');
        location.reload();
      }
    });
  });

  document.querySelectorAll('[data-open-tournament]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset.openTournament;
      if (confirm('Abrir inscrições para este torneio?')) {
        await api.request(`/api/admin/v2/tournaments/${id}/open`, { method: 'POST' });
        location.reload();
      }
    });
  });

  document.querySelectorAll('[data-start-tournament]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset.startTournament;
      if (confirm('Iniciar este torneio? As inscrições serão encerradas.')) {
        const res = await api.request(`/api/admin/v2/tournaments/${id}/start`, { method: 'POST' });
        if (res.error) {
          alert('Erro: ' + res.error);
        } else {
          location.reload();
        }
      }
    });
  });

  document.querySelectorAll('[data-cancel-tournament]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset.cancelTournament;
      const reason = prompt('Motivo do cancelamento:');
      if (reason) {
        await api.request(`/api/admin/v2/tournaments/${id}/cancel`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        });
        alert('Torneio cancelado. Participantes reembolsados.');
        location.reload();
      }
    });
  });

  // Botão de limpeza manual
  document.getElementById('run-cleanup-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('run-cleanup-btn') as HTMLButtonElement;
    const status = document.getElementById('cleanup-status');
    
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Executando...';
    }
    if (status) status.textContent = 'Processando...';
    
    try {
      const res = await api.request('/api/settings/cleanup/run', { method: 'POST' });
      
      if (res.success) {
        if (status) {
          status.textContent = `✅ Limpeza concluída em ${new Date().toLocaleTimeString('pt-BR')}`;
          status.style.color = 'var(--accent-green)';
        }
        toast.success('Limpeza executada', 'Partidas, salas e transmissões verificadas');
      } else {
        throw new Error(res.error || 'Erro desconhecido');
      }
    } catch (err: any) {
      if (status) {
        status.textContent = `❌ Erro: ${err.message}`;
        status.style.color = '#ff6b6b';
      }
      toast.error('Erro na limpeza', err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🧹 Executar Limpeza Agora';
      }
    }
  });

  // Settings form
  document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const settings: Record<string, any> = {};

    // Collect all settings
    const fields = [
      'maintenance_mode', 'maintenance_message', 'max_rooms_per_user', 'max_daily_matches',
      'credits_price_per_unit', 'free_credits_on_register', 'daily_free_credits', 'credits_per_match',
      'bet_enabled', 'min_bet_amount', 'max_bet_amount', 'platform_fee_percent',
      'casual_mode_enabled', 'ranked_mode_enabled', 'bet_mode_enabled', 'ai_mode_enabled',
      'points_per_win', 'points_per_loss', 'match_timeout_minutes', 'turn_timeout_seconds',
      'referral_enabled', 'referral_reward_credits', 'referral_share_message',
    ];

    for (const field of fields) {
      const value = formData.get(field);
      if (field.includes('enabled') || field.includes('mode') || field === 'bet_enabled') {
        settings[field] = value === 'on' ? 'true' : 'false';
      } else if (field.includes('amount') || field.includes('price') || field.includes('percent') ||
        field.includes('points') || field.includes('timeout') || field.includes('max') ||
        field.includes('credits') || field.includes('rooms') || field.includes('matches')) {
        settings[field] = Number(value);
      } else {
        settings[field] = value;
      }
    }

    // Save settings
    const res = await api.request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    });

    if (res.error) {
      toast.error('Erro ao salvar: ' + res.error, 'Configurações');
    } else {
      toast.success('Configurações salvas com sucesso!', 'Configurações');
    }
  });

  // Test payment connection
  document.getElementById('test-payment-btn')?.addEventListener('click', async () => {
    toast.info('Testando conexão...', 'Gateway');
    const res = await api.request('/api/admin/payments/settings/test', { method: 'POST' });
    if (res.data?.success) {
      toast.success('Conexão com gateway OK!', 'Gateway');
    } else {
      toast.error('Falha na conexão: ' + (res.error || 'Erro desconhecido'), 'Gateway');
    }
  });

  // Save payment settings
  document.getElementById('save-payment-settings-btn')?.addEventListener('click', async () => {
    const environment = (document.getElementById('payment_environment') as HTMLSelectElement)?.value;
    const clientId = (document.getElementById('payment_client_id') as HTMLInputElement)?.value;
    const clientSecret = (document.getElementById('payment_client_secret') as HTMLInputElement)?.value;
    const pixKey = (document.getElementById('payment_pix_key') as HTMLInputElement)?.value;
    const active = (document.getElementById('payment_active') as HTMLInputElement)?.checked;
    const certificateStatus = document.getElementById('certificate-status')?.textContent || '';
    const hasCertificate = certificateStatus.includes('✅');

    if (!clientId) {
      toast.warning('Client ID é obrigatório', 'Campo Obrigatório');
      return;
    }

    // Salvar credenciais
    const credRes = await api.request('/api/admin/payments/settings/credentials', {
      method: 'PUT',
      body: JSON.stringify({
        environment,
        clientId,
        clientSecret: clientSecret || undefined,
        pixKey: pixKey || undefined,
      }),
    });

    if (credRes.error) {
      toast.error('Erro ao salvar credenciais: ' + credRes.error, 'Erro');
      return;
    }

    // Só tenta atualizar status se:
    // - Quer desativar (active = false), ou
    // - Quer ativar E tem certificado
    if (!active || (active && hasCertificate)) {
      const activeRes = await api.request('/api/admin/payments/settings/active', {
        method: 'PUT',
        body: JSON.stringify({ active }),
      });

      if (activeRes.error) {
        toast.info('Credenciais salvas! Para ativar os pagamentos, envie o certificado .p12 primeiro.', 'Certificado Necessário');
        return;
      }
    } else if (active && !hasCertificate) {
      toast.info('Credenciais salvas! Para ativar os pagamentos, envie o certificado .p12 primeiro.', 'Certificado Necessário');
      // Desmarcar o checkbox já que não pode ativar
      (document.getElementById('payment_active') as HTMLInputElement).checked = false;
      return;
    }

    toast.success('Configurações de pagamento salvas com sucesso!', 'Pagamentos');
  });

  // Certificate upload
  document.getElementById('certificate-upload')?.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('certificate', file);

    const res = await fetch('/api/admin/payments/settings/certificate', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${api.getToken()}` },
      body: formData,
    });

    const data = await res.json();
    if (data.success) {
      alert('✅ Certificado enviado!');
      location.reload();
    } else {
      alert('❌ Erro: ' + data.error);
    }
  });

  // Force end match
  document.querySelectorAll('[data-force-end-match]').forEach(el => {
    el.addEventListener('click', async () => {
      const matchId = (el as HTMLElement).dataset.forceEndMatch;
      if (confirm('Encerrar esta partida? Será cancelada sem vencedor.')) {
        await api.request(`/api/admin/matches/${matchId}/force-end`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        alert('Partida encerrada.');
        location.reload();
      }
    });
  });

  // Adjust wallet
  document.querySelectorAll('[data-adjust-wallet]').forEach(el => {
    el.addEventListener('click', async () => {
      const userId = (el as HTMLElement).dataset.adjustWallet;
      const amountStr = prompt('Valor a ajustar (positivo para adicionar, negativo para remover):');
      if (!amountStr) return;
      const amount = parseFloat(amountStr);
      if (isNaN(amount)) return alert('Valor inválido');

      const description = prompt('Descrição do ajuste:') || 'Ajuste administrativo';

      await api.request('/api/admin/wallet/adjust', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, amount, description }),
      });
      alert('Saldo ajustado!');
      location.reload();
    });
  });

  // Adjust credits (from user modal)
  document.querySelectorAll('[data-adjust-credits]').forEach(el => {
    el.addEventListener('click', async () => {
      const userId = (el as HTMLElement).dataset.adjustCredits;
      const amountStr = prompt('Quantidade de créditos (positivo para adicionar, negativo para remover):');
      if (!amountStr) return;
      const amount = parseInt(amountStr);
      if (isNaN(amount)) return alert('Valor inválido');

      await api.request('/api/admin/credits/adjust', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, amount }),
      });
      alert('Créditos ajustados!');
      location.reload();
    });
  });

  // ==================== GIVE BONUS MODAL ====================

  // Open give bonus modal
  document.querySelectorAll('[data-give-bonus]').forEach(el => {
    el.addEventListener('click', () => {
      const userId = (el as HTMLElement).dataset.giveBonus;
      const username = (el as HTMLElement).dataset.username;

      (document.getElementById('bonus-user-id') as HTMLInputElement).value = userId || '';
      (document.getElementById('bonus-username') as HTMLElement).textContent = username || '';
      (document.getElementById('bonus-amount') as HTMLInputElement).value = '10';
      (document.getElementById('bonus-reason-preset') as HTMLSelectElement).value = '';
      (document.getElementById('bonus-reason-custom') as HTMLInputElement).value = '';
      (document.getElementById('bonus-reason-custom') as HTMLInputElement).style.display = 'none';

      document.getElementById('give-bonus-modal')?.classList.add('active');
    });
  });

  // Toggle custom reason input
  document.getElementById('bonus-reason-preset')?.addEventListener('change', (e) => {
    const value = (e.target as HTMLSelectElement).value;
    const customInput = document.getElementById('bonus-reason-custom') as HTMLInputElement;
    if (value === 'custom') {
      customInput.style.display = 'block';
      customInput.focus();
    } else {
      customInput.style.display = 'none';
      customInput.value = '';
    }
  });

  // Confirm give bonus
  document.getElementById('confirm-give-bonus-btn')?.addEventListener('click', async () => {
    const userId = (document.getElementById('bonus-user-id') as HTMLInputElement).value;
    const username = (document.getElementById('bonus-username') as HTMLElement).textContent;
    const amount = parseInt((document.getElementById('bonus-amount') as HTMLInputElement).value);
    const presetReason = (document.getElementById('bonus-reason-preset') as HTMLSelectElement).value;
    const customReason = (document.getElementById('bonus-reason-custom') as HTMLInputElement).value;
    
    const reason = presetReason === 'custom' ? customReason : presetReason;

    if (!userId || isNaN(amount) || amount <= 0) {
      toast.error('Erro', 'Quantidade inválida. Digite um número maior que zero.');
      return;
    }

    if (!reason || reason.trim().length < 3) {
      toast.error('Erro', 'Selecione ou digite um motivo para o bônus.');
      return;
    }

    const btn = document.getElementById('confirm-give-bonus-btn') as HTMLButtonElement;
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Processando...';
    }

    try {
      const res = await api.request(`/api/admin/users/${userId}/bonus`, {
        method: 'POST',
        body: JSON.stringify({ amount, reason: reason.trim() }),
      });

      if (res.error) {
        toast.error('Erro ao dar bônus', res.error);
      } else {
        toast.success('Bônus enviado!', `${amount} crédito(s) de bônus dado(s) para ${username}`);
        document.getElementById('give-bonus-modal')?.classList.remove('active');
        
        // Recarregar lista de usuários
        const usersRes = await api.request('/api/admin/users');
        adminData.users = usersRes.data?.users || usersRes.users || [];
        app.render();
        bindAdminEvents(app);
      }
    } catch (err: any) {
      toast.error('Erro', err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🎁 Dar Bônus';
      }
    }
  });

  // Close give bonus modal
  document.querySelectorAll('[data-close-modal="give-bonus-modal"]').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById('give-bonus-modal')?.classList.remove('active');
    });
  });

  // ==================== COUPON EVENTS ====================

  // Refresh coupons
  document.getElementById('refresh-coupons-btn')?.addEventListener('click', async () => {
    const res = await api.request('/api/coupons');
    adminData.coupons = res.data?.coupons || [];
    app.render();
    bindAdminEvents(app);
  });

  // Open coupon modal
  document.getElementById('create-coupon-btn')?.addEventListener('click', () => {
    document.getElementById('coupon-modal')?.classList.add('active');
  });

  // Create coupon form
  document.getElementById('coupon-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const data = {
      code: formData.get('code'),
      description: formData.get('description'),
      discount_type: formData.get('discount_type'),
      discount_value: Number(formData.get('discount_value')),
      min_purchase: Number(formData.get('min_purchase')) || 0,
      max_discount: formData.get('max_discount') ? Number(formData.get('max_discount')) : null,
      max_uses: formData.get('max_uses') ? Number(formData.get('max_uses')) : null,
      max_uses_per_user: Number(formData.get('max_uses_per_user')) || 1,
      valid_until: formData.get('valid_until') || null,
    };

    const res = await api.request('/api/coupons', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (res.error) {
      alert('Erro: ' + res.error);
    } else {
      alert('Cupom criado com sucesso!');
      document.getElementById('coupon-modal')?.classList.remove('active');
      form.reset();
      // Refresh
      const couponsRes = await api.request('/api/coupons');
      adminData.coupons = couponsRes.data?.coupons || [];
      app.render();
      bindAdminEvents(app);
    }
  });

  // Deactivate coupon
  document.querySelectorAll('[data-deactivate-coupon]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset.deactivateCoupon;
      if (confirm('Desativar este cupom?')) {
        const res = await api.request(`/api/coupons/${id}`, { method: 'DELETE' });
        if (res.error) {
          alert('Erro: ' + res.error);
        } else {
          alert('Cupom desativado!');
          location.reload();
        }
      }
    });
  });

  // ==================== MISSION EVENTS ====================

  // Refresh missions
  document.getElementById('refresh-missions-btn')?.addEventListener('click', async () => {
    const res = await api.request('/api/missions/admin');
    adminData.missions = res.data?.missions || [];
    app.render();
    bindAdminEvents(app);
  });

  // Open mission modal for create
  document.getElementById('create-mission-btn')?.addEventListener('click', () => {
    // Reset form for create mode
    const form = document.getElementById('mission-form') as HTMLFormElement;
    if (form) form.reset();
    (document.getElementById('mission-id') as HTMLInputElement).value = '';
    (document.getElementById('mission-modal-title') as HTMLElement).textContent = 'Criar Missão';
    (document.getElementById('mission-submit-btn') as HTMLElement).textContent = 'Criar Missão';
    document.getElementById('mission-modal')?.classList.add('active');
  });

  // Edit mission
  document.querySelectorAll('[data-edit-mission]').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.editMission;
      const mission = adminData.missions.find((m: any) => m.id === id);
      if (!mission) return;

      // Fill form with mission data
      (document.getElementById('mission-id') as HTMLInputElement).value = mission.id;
      (document.getElementById('mission-title') as HTMLInputElement).value = mission.title;
      (document.getElementById('mission-description') as HTMLTextAreaElement).value = mission.description || '';
      (document.getElementById('mission-type') as HTMLSelectElement).value = mission.type;
      (document.getElementById('mission-icon') as HTMLInputElement).value = mission.icon || '🎯';
      (document.getElementById('mission-req-type') as HTMLSelectElement).value = mission.requirement_type;
      (document.getElementById('mission-req-value') as HTMLInputElement).value = mission.requirement_value;
      (document.getElementById('mission-reward-type') as HTMLSelectElement).value = mission.reward_type;
      (document.getElementById('mission-reward-value') as HTMLInputElement).value = mission.reward_value;
      (document.getElementById('mission-max') as HTMLInputElement).value = mission.max_completions || '';

      (document.getElementById('mission-modal-title') as HTMLElement).textContent = 'Editar Missão';
      (document.getElementById('mission-submit-btn') as HTMLElement).textContent = 'Salvar Alterações';
      document.getElementById('mission-modal')?.classList.add('active');
    });
  });

  // Create/Update mission form
  document.getElementById('mission-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const missionId = formData.get('mission_id');

    const data = {
      title: formData.get('title'),
      description: formData.get('description'),
      type: formData.get('type'),
      icon: formData.get('icon') || '🎯',
      requirement_type: formData.get('requirement_type'),
      requirement_value: Number(formData.get('requirement_value')),
      reward_type: formData.get('reward_type'),
      reward_value: Number(formData.get('reward_value')),
      start_date: formData.get('start_date') || null,
      end_date: formData.get('end_date') || null,
      max_completions: formData.get('max_completions') ? Number(formData.get('max_completions')) : null,
    };

    const url = missionId ? `/api/missions/admin/${missionId}` : '/api/missions/admin';
    const method = missionId ? 'PUT' : 'POST';

    const res = await api.request(url, {
      method,
      body: JSON.stringify(data),
    });

    if (res.error) {
      alert('Erro: ' + res.error);
    } else {
      alert(missionId ? 'Missão atualizada!' : 'Missão criada com sucesso!');
      document.getElementById('mission-modal')?.classList.remove('active');
      form.reset();
      // Refresh
      const missionsRes = await api.request('/api/missions/admin');
      adminData.missions = missionsRes.data?.missions || [];
      app.render();
      bindAdminEvents(app);
    }
  });

  // Toggle mission active/inactive
  document.querySelectorAll('[data-toggle-mission]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset.toggleMission;
      const active = (el as HTMLElement).dataset.active === 'true';

      const res = await api.request(`/api/missions/admin/${id}/toggle`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: active }),
      });

      if (res.error) {
        alert('Erro: ' + res.error);
      } else {
        alert(active ? 'Missão ativada!' : 'Missão desativada!');
        location.reload();
      }
    });
  });

  // Delete mission
  document.querySelectorAll('[data-delete-mission]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset.deleteMission;
      if (confirm('Tem certeza que deseja DELETAR esta missão? Esta ação não pode ser desfeita.')) {
        const res = await api.request(`/api/missions/admin/${id}`, { method: 'DELETE' });
        if (res.error) {
          alert('Erro: ' + res.error);
        } else {
          alert('Missão deletada!');
          location.reload();
        }
      }
    });
  });

  // ==================== REFERRAL EVENTS ====================

  // Refresh referrals
  document.getElementById('refresh-referrals-btn')?.addEventListener('click', async () => {
    const filter = (document.getElementById('referral-filter') as HTMLSelectElement)?.value;
    const url = filter ? `/api/admin/referrals?status=${filter}` : '/api/admin/referrals';
    const [referralsRes, statsRes] = await Promise.all([
      api.request(url),
      api.request('/api/admin/referrals/stats'),
    ]);
    adminData.referrals = referralsRes.data?.referrals || [];
    adminData.referralStats = statsRes.data || {};
    app.render();
    bindAdminEvents(app);
  });

  // Save referral settings
  document.getElementById('referral-settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const settings = {
      referral_enabled: formData.get('referral_enabled') === 'on' ? 'true' : 'false',
      referral_reward_credits: formData.get('referral_reward_credits'),
      referral_share_message: formData.get('referral_share_message'),
    };

    const res = await api.request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    });

    if (res.error) {
      alert('Erro: ' + res.error);
    } else {
      alert('Configurações de indicação salvas!');
    }
  });

  // Process referral reward manually
  document.querySelectorAll('[data-process-referral]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset.processReferral;
      if (confirm('Processar recompensa manualmente para esta indicação?')) {
        const res = await api.request(`/api/admin/referrals/${id}/process`, { method: 'POST' });
        if (res.error) {
          alert('Erro: ' + res.error);
        } else {
          alert('Recompensa processada!');
          location.reload();
        }
      }
    });
  });

  // ==================== DELETE USER EVENT ====================

  // Delete user
  document.querySelectorAll('[data-delete-user]').forEach(el => {
    el.addEventListener('click', async () => {
      const userId = (el as HTMLElement).dataset.deleteUser;
      const user = adminData.users.find((u: any) => u.id === userId);

      if (!confirm(`ATENÇÃO: Você está prestes a DELETAR permanentemente o usuário "${user?.username}". Esta ação NÃO pode ser desfeita. Todos os dados do usuário serão perdidos.\n\nDeseja continuar?`)) {
        return;
      }

      const confirmText = prompt('Para confirmar, digite o username do usuário:');
      if (confirmText !== user?.username) {
        alert('Username incorreto. Operação cancelada.');
        return;
      }

      const res = await api.request(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (res.error) {
        alert('Erro: ' + res.error);
      } else {
        alert('Usuário deletado permanentemente.');
        location.reload();
      }
    });
  });

  // ==================== EMPLOYEE EVENTS ====================

  // Refresh employees
  document.getElementById('refresh-employees-btn')?.addEventListener('click', async () => {
    const [employeesRes, invitesRes] = await Promise.all([
      api.request('/api/admin/employees'),
      api.request('/api/admin/employees/invites'),
    ]);
    adminData.employees = employeesRes.data?.employees || [];
    adminData.invites = invitesRes.data?.invites || [];
    app.render();
    bindAdminEvents(app);
  });

  // Open invite modal
  document.getElementById('invite-employee-btn')?.addEventListener('click', () => {
    document.getElementById('invite-modal')?.classList.add('active');
  });

  // Confirm invite
  document.getElementById('confirm-invite-btn')?.addEventListener('click', async () => {
    const email = (document.getElementById('invite-email') as HTMLInputElement)?.value;
    const role = (document.getElementById('invite-role') as HTMLSelectElement)?.value;

    if (!email) {
      alert('Digite o email do funcionário');
      return;
    }

    const res = await api.request('/api/admin/employees/invite', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });

    if (res.error) {
      alert('Erro: ' + res.error);
    } else {
      alert(res.data?.message || 'Convite enviado!');
      document.getElementById('invite-modal')?.classList.remove('active');
      location.reload();
    }
  });

  // Change employee role
  document.querySelectorAll('[data-change-role]').forEach(el => {
    el.addEventListener('change', async (e) => {
      const select = e.target as HTMLSelectElement;
      const userId = select.dataset.changeRole;
      const newRole = select.value;
      const currentRole = select.dataset.current;

      if (newRole === currentRole) return;

      if (!confirm(`Alterar cargo para ${newRole}?`)) {
        select.value = currentRole || 'employee';
        return;
      }

      const res = await api.request(`/api/admin/employees/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });

      if (res.error) {
        alert('Erro: ' + res.error);
        select.value = currentRole || 'employee';
      } else {
        alert(res.data?.message || 'Cargo alterado!');
        location.reload();
      }
    });
  });

  // Remove employee
  document.querySelectorAll('[data-remove-employee]').forEach(el => {
    el.addEventListener('click', async () => {
      const userId = (el as HTMLElement).dataset.removeEmployee;

      if (!confirm('Remover este funcionário da equipe? Ele será rebaixado a usuário comum.')) {
        return;
      }

      const res = await api.request(`/api/admin/employees/${userId}`, {
        method: 'DELETE',
      });

      if (res.error) {
        alert('Erro: ' + res.error);
      } else {
        alert(res.data?.message || 'Funcionário removido!');
        location.reload();
      }
    });
  });

  // Copy invite link
  document.querySelectorAll('[data-copy-invite]').forEach(el => {
    el.addEventListener('click', () => {
      const code = (el as HTMLElement).dataset.copyInvite;
      const link = `${window.location.origin}/register?invite=${code}`;
      navigator.clipboard.writeText(link);
      alert('Link copiado!');
    });
  });

  // Cancel invite
  document.querySelectorAll('[data-cancel-invite]').forEach(el => {
    el.addEventListener('click', async () => {
      const id = (el as HTMLElement).dataset.cancelInvite;

      if (!confirm('Cancelar este convite?')) return;

      const res = await api.request(`/api/admin/employees/invites/${id}`, {
        method: 'DELETE',
      });

      if (res.error) {
        alert('Erro: ' + res.error);
      } else {
        alert('Convite cancelado!');
        location.reload();
      }
    });
  });

  // ==================== MUSIC EVENTS ====================

  // Refresh music
  document.getElementById('refresh-music-btn')?.addEventListener('click', async () => {
    const [tracksRes, statsRes] = await Promise.all([
      api.request('/api/music/admin/tracks?includeInactive=true'),
      api.request('/api/music/admin/stats'),
    ]);
    adminData.musicTracks = tracksRes.data?.tracks || [];
    adminData.musicStats = statsRes.data?.stats || [];
    app.render();
    bindAdminEvents(app);
    toast.success('Músicas atualizadas!');
  });

  // Add music button
  document.getElementById('add-music-btn')?.addEventListener('click', () => {
    // Reset form
    const form = document.getElementById('music-form') as HTMLFormElement;
    if (form) form.reset();
    (document.getElementById('music-id') as HTMLInputElement).value = '';
    (document.getElementById('music-modal-title') as HTMLElement).textContent = 'Adicionar Música';
    (document.getElementById('youtube-preview') as HTMLElement).style.display = 'none';
    
    // Show YouTube input by default
    (document.getElementById('youtube-input-group') as HTMLElement).style.display = 'block';
    (document.getElementById('upload-input-group') as HTMLElement).style.display = 'none';
    
    document.getElementById('music-modal')?.classList.add('active');
  });

  // Source type change
  document.getElementById('music-source-type')?.addEventListener('change', (e) => {
    const sourceType = (e.target as HTMLSelectElement).value;
    const youtubeGroup = document.getElementById('youtube-input-group');
    const uploadGroup = document.getElementById('upload-input-group');
    
    if (sourceType === 'youtube') {
      if (youtubeGroup) youtubeGroup.style.display = 'block';
      if (uploadGroup) uploadGroup.style.display = 'none';
    } else {
      if (youtubeGroup) youtubeGroup.style.display = 'none';
      if (uploadGroup) uploadGroup.style.display = 'block';
    }
  });

  // YouTube URL preview
  // YouTube embed code preview
  document.getElementById('music-youtube-embed')?.addEventListener('blur', async (e) => {
    const embedCode = (e.target as HTMLTextAreaElement).value;
    if (!embedCode) return;

    try {
      const res = await api.request('/api/music/admin/youtube-info', {
        method: 'POST',
        body: JSON.stringify({ embed: embedCode }),
      });

      if (res.data?.youtube_id) {
        const preview = document.getElementById('youtube-preview') as HTMLElement;
        const thumbnail = document.getElementById('youtube-thumbnail') as HTMLImageElement;
        
        if (preview && thumbnail) {
          thumbnail.src = res.data.thumbnail_url;
          preview.style.display = 'block';
        }
      } else {
        const preview = document.getElementById('youtube-preview') as HTMLElement;
        if (preview) preview.style.display = 'none';
      }
    } catch (err) {
      console.error('Erro ao obter info do YouTube:', err);
      const preview = document.getElementById('youtube-preview') as HTMLElement;
      if (preview) preview.style.display = 'none';
    }
  });

  // Music form submit
  document.getElementById('music-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const musicId = formData.get('music_id') as string;
    const sourceType = formData.get('source_type') as string;

    const data: any = {
      title: formData.get('title'),
      artist: formData.get('artist') || undefined,
      source_type: sourceType,
      genre: formData.get('genre') || undefined,
      is_active: (document.getElementById('music-active') as HTMLInputElement)?.checked !== false,
    };

    if (sourceType === 'youtube') {
      data.youtube_embed = formData.get('youtube_embed');
      if (!data.youtube_embed) {
        toast.error('Erro', 'Informe o código de incorporação do YouTube');
        return;
      }
    } else {
      // TODO: Implementar upload de arquivo
      toast.error('Erro', 'Upload de arquivo ainda não implementado. Use YouTube por enquanto.');
      return;
    }

    try {
      const url = musicId ? `/api/music/admin/tracks/${musicId}` : '/api/music/admin/tracks';
      const method = musicId ? 'PUT' : 'POST';
      
      const res = await api.request(url, { method, body: JSON.stringify(data) });

      if (res.error) {
        toast.error('Erro', res.error);
        return;
      }

      toast.success(musicId ? 'Música atualizada!' : 'Música adicionada!');
      document.getElementById('music-modal')?.classList.remove('active');
      form.reset();

      // Reload music list
      const [tracksRes, statsRes] = await Promise.all([
        api.request('/api/music/admin/tracks?includeInactive=true'),
        api.request('/api/music/admin/stats'),
      ]);
      adminData.musicTracks = tracksRes.data?.tracks || [];
      adminData.musicStats = statsRes.data?.stats || [];
      app.render();
      bindAdminEvents(app);
    } catch (err: any) {
      toast.error('Erro', err.message);
    }
  });

  // Edit music
  document.querySelectorAll('[data-edit-music]').forEach(el => {
    el.addEventListener('click', () => {
      const musicId = (el as HTMLElement).dataset.editMusic;
      const track = adminData.musicTracks?.find((t: any) => t.id === musicId);
      if (!track) return;

      // Fill form
      (document.getElementById('music-id') as HTMLInputElement).value = track.id;
      (document.getElementById('music-modal-title') as HTMLElement).textContent = 'Editar Música';
      (document.getElementById('music-source-type') as HTMLSelectElement).value = track.source_type;
      (document.getElementById('music-title') as HTMLInputElement).value = track.title || '';
      (document.getElementById('music-artist') as HTMLInputElement).value = track.artist || '';
      (document.getElementById('music-genre') as HTMLSelectElement).value = track.genre || '';
      (document.getElementById('music-active') as HTMLInputElement).checked = track.is_active !== false;

      // Show correct input group
      const youtubeGroup = document.getElementById('youtube-input-group');
      const uploadGroup = document.getElementById('upload-input-group');
      
      if (track.source_type === 'youtube') {
        if (youtubeGroup) youtubeGroup.style.display = 'block';
        if (uploadGroup) uploadGroup.style.display = 'none';
        
        // Set YouTube embed code (reconstruct from ID)
        if (track.youtube_id) {
          const embedTextarea = document.getElementById('music-youtube-embed') as HTMLTextAreaElement;
          if (embedTextarea) {
            embedTextarea.value = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${track.youtube_id}" frameborder="0" allowfullscreen></iframe>`;
          }
          
          // Show thumbnail
          const preview = document.getElementById('youtube-preview') as HTMLElement;
          const thumbnail = document.getElementById('youtube-thumbnail') as HTMLImageElement;
          if (preview && thumbnail && track.thumbnail_url) {
            thumbnail.src = track.thumbnail_url;
            preview.style.display = 'block';
          }
        }
      } else {
        if (youtubeGroup) youtubeGroup.style.display = 'none';
        if (uploadGroup) uploadGroup.style.display = 'block';
      }

      document.getElementById('music-modal')?.classList.add('active');
    });
  });

  // Toggle music active
  document.querySelectorAll('[data-toggle-music]').forEach(el => {
    el.addEventListener('click', async () => {
      const musicId = (el as HTMLElement).dataset.toggleMusic;
      const isActive = (el as HTMLElement).dataset.active === 'true';

      const res = await api.request(`/api/music/admin/tracks/${musicId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !isActive }),
      });

      if (res.error) {
        toast.error('Erro', res.error);
        return;
      }

      toast.success(isActive ? 'Música desativada' : 'Música ativada');
      
      // Reload music list
      const tracksRes = await api.request('/api/music/admin/tracks?includeInactive=true');
      adminData.musicTracks = tracksRes.data?.tracks || [];
      app.render();
      bindAdminEvents(app);
    });
  });

  // Delete music
  document.querySelectorAll('[data-delete-music]').forEach(el => {
    el.addEventListener('click', async () => {
      const musicId = (el as HTMLElement).dataset.deleteMusic;
      if (!confirm('Excluir esta música?')) return;

      const res = await api.request(`/api/music/admin/tracks/${musicId}`, { method: 'DELETE' });

      if (res.error) {
        toast.error('Erro', res.error);
        return;
      }

      toast.success('Música excluída');
      
      // Reload music list
      const [tracksRes, statsRes] = await Promise.all([
        api.request('/api/music/admin/tracks?includeInactive=true'),
        api.request('/api/music/admin/stats'),
      ]);
      adminData.musicTracks = tracksRes.data?.tracks || [];
      adminData.musicStats = statsRes.data?.stats || [];
      app.render();
      bindAdminEvents(app);
    });
  });
}
