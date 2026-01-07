/**
 * Componente de Header - Reutilizável em todas as páginas
 */

import { gameStore } from '../store/gameStore.js';
import { flagService } from '../services/flagService.js';
import { formatAvatarUrl } from '../services/imageService.js';

export interface HeaderOptions {
  showStats?: boolean;
  logoClickable?: boolean;
  navigateTo?: string;
}

/**
 * Renderiza o header padrão do app
 */
export function renderHeader(options: HeaderOptions = {}): string {
  const { showStats = true, logoClickable = true, navigateTo = 'lobby' } = options;
  const state = gameStore.getState();
  const user = state.user;

  const avatarContent = user?.avatar_url
    ? `<img src="${formatAvatarUrl(user.avatar_url, user.username)}" alt="${user.username}" class="header-avatar-img">`
    : user?.username?.charAt(0).toUpperCase() || 'J';

  const countryBadge = user?.country_code
    ? `<div class="header-avatar-flag">${flagService.renderFlag(user.country_code, 'small')}</div>`
    : '';

  const logoStyle = logoClickable ? 'cursor: pointer;' : '';
  const logoAttr = logoClickable ? `data-navigate="${navigateTo}"` : '';

  return `
    <div class="header">
      <div class="header-logo" ${logoAttr} style="${logoStyle}">🎱 Sinuca Online</div>
      <div class="header-user">
        ${showStats ? `
          <div class="header-stats">
            <div class="header-stat">
              <span class="header-stat-icon">💰</span>
              <span class="header-stat-value green">R$ ${state.balance.toFixed(2)}</span>
            </div>
            <div class="header-stat">
              <span class="header-stat-icon">🎫</span>
              <span class="header-stat-value blue">${state.isUnlimited ? '∞' : state.credits}</span>
            </div>
          </div>
        ` : ''}
        <div class="header-avatar-wrapper">
          <div class="header-avatar">${avatarContent}</div>
          ${countryBadge}
        </div>
      </div>
    </div>
  `;
}

/**
 * Renderiza avatar com bandeira para uso em listas/cards
 */
export function renderUserAvatar(
  user: { avatar_url?: string; username?: string; country_code?: string },
  size: 'small' | 'medium' | 'large' = 'medium'
): string {
  const sizeMap = {
    small: 32,
    medium: 40,
    large: 56,
  };
  const avatarSize = sizeMap[size];

  const avatarContent = user?.avatar_url
    ? `<img src="${formatAvatarUrl(user.avatar_url, user.username)}" alt="${user.username}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
    : `<span style="font-size: ${avatarSize * 0.4}px;">${user?.username?.charAt(0).toUpperCase() || '?'}</span>`;

  const flagBadge = user?.country_code
    ? `<div class="user-avatar-flag">${flagService.renderFlag(user.country_code, 'small')}</div>`
    : '';

  return `
    <div class="user-avatar-container" style="position: relative; width: ${avatarSize}px; height: ${avatarSize}px;">
      <div class="user-avatar" style="
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--accent-blue), var(--accent-green));
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        overflow: hidden;
      ">
        ${avatarContent}
      </div>
      ${flagBadge}
    </div>
  `;
}

// Adicionar estilos do header
export function addHeaderStyles(): void {
  if (document.getElementById('header-component-styles')) return;

  const style = document.createElement('style');
  style.id = 'header-component-styles';
  style.textContent = `
    .header-avatar-wrapper {
      position: relative;
    }

    .header-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }

    .header-avatar-flag {
      position: absolute;
      bottom: -2px;
      right: -2px;
      background: var(--bg-primary);
      border-radius: 50%;
      padding: 2px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    .header-avatar-flag img {
      width: 14px;
      height: auto;
      border-radius: 2px;
    }

    .user-avatar-flag {
      position: absolute;
      bottom: -2px;
      right: -2px;
      background: var(--bg-primary);
      border-radius: 50%;
      padding: 2px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    .user-avatar-flag img {
      width: 12px;
      height: auto;
      border-radius: 2px;
    }
  `;
  document.head.appendChild(style);
}

// Auto-inicializar estilos
if (typeof document !== 'undefined') {
  addHeaderStyles();
}
