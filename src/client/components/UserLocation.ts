// Componente para exibir localização do usuário com bandeira

// Mapa de bandeiras por código de país
const FLAGS: Record<string, string> = {
  'BR': '🇧🇷',
  'US': '🇺🇸',
  'AR': '🇦🇷',
  'MX': '🇲🇽',
  'PT': '🇵🇹',
  'ES': '🇪🇸',
  'FR': '🇫🇷',
  'DE': '🇩🇪',
  'IT': '🇮🇹',
  'GB': '🇬🇧',
  'CA': '🇨🇦',
  'JP': '🇯🇵',
  'CN': '🇨🇳',
  'KR': '🇰🇷',
};

export function getFlag(countryCode: string | null | undefined): string {
  if (!countryCode) return '🏳️';
  return FLAGS[countryCode.toUpperCase()] || '🏳️';
}

// Componente de localização completa (bandeira + cidade, estado)
export function UserLocationBadge(user: { 
  country_code?: string | null; 
  city?: string | null; 
  state_code?: string | null;
}): string {
  const flag = getFlag(user.country_code);
  const location = user.city && user.state_code 
    ? `${user.city}, ${user.state_code}` 
    : user.city || user.state_code || '';

  return `
    <span class="user-location">
      <span class="flag">${flag}</span>
      ${location ? `<span class="city-state">${location}</span>` : ''}
    </span>
  `;
}

// Apenas a bandeira (para espaços pequenos)
export function FlagOnly(countryCode: string | null | undefined): string {
  return `<span class="player-flag">${getFlag(countryCode)}</span>`;
}

// Para o ranking (bandeira + nome)
export function RankingUserWithFlag(user: {
  username: string;
  country_code?: string | null;
  avatar_url?: string | null;
}): string {
  const flag = getFlag(user.country_code);
  const avatar = user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;
  
  return `
    <div class="ranking-user">
      <img src="${avatar}" alt="${user.username}" class="ranking-avatar">
      <span class="ranking-flag">${flag}</span>
      <span class="ranking-username">${user.username}</span>
    </div>
  `;
}

// Para o chat (nome + bandeira + localização)
export function ChatUserInfo(user: {
  username: string;
  country_code?: string | null;
  city?: string | null;
  state_code?: string | null;
}): string {
  const flag = getFlag(user.country_code);
  const location = user.city && user.state_code 
    ? `${user.city}, ${user.state_code}` 
    : '';

  return `
    <span class="chat-user-info">
      <strong>${user.username}</strong>
      <span class="chat-user-flag">${flag}</span>
      ${location ? `<span class="chat-user-location">${location}</span>` : ''}
    </span>
  `;
}

// Para cards de jogador (avatar + nome + bandeira + localização)
export function PlayerCardWithLocation(user: {
  username: string;
  country_code?: string | null;
  city?: string | null;
  state_code?: string | null;
  avatar_url?: string | null;
}): string {
  const flag = getFlag(user.country_code);
  const avatar = user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;
  const location = user.city && user.state_code 
    ? `${user.city}, ${user.state_code}` 
    : user.city || '';

  return `
    <div class="player-card-info">
      <img src="${avatar}" alt="${user.username}" class="player-avatar">
      <div class="player-details">
        <div class="player-name">
          <span class="player-flag">${flag}</span>
          ${user.username}
        </div>
        ${location ? `<div class="player-location-text">${location}</div>` : ''}
      </div>
    </div>
  `;
}
