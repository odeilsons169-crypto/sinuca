/**
 * Serviço de Bandeiras - Usa API externa para bandeiras de países
 * API: flagcdn.com (gratuita, sem autenticação)
 */

export interface Country {
  code: string;
  name: string;
  name_pt: string;
  flagUrl: string;
  flagEmoji: string;
}

// Países disponíveis no sistema
const AVAILABLE_COUNTRIES: Country[] = [
  {
    code: 'BR',
    name: 'Brazil',
    name_pt: 'Brasil',
    flagUrl: 'https://flagcdn.com/w80/br.png',
    flagEmoji: '🇧🇷',
  },
  {
    code: 'US',
    name: 'United States',
    name_pt: 'Estados Unidos',
    flagUrl: 'https://flagcdn.com/w80/us.png',
    flagEmoji: '🇺🇸',
  },
];

// Cache de URLs de bandeiras
const flagCache = new Map<string, string>();

class FlagService {
  private baseUrl = 'https://flagcdn.com';

  /**
   * Obtém URL da bandeira por código do país
   * @param countryCode Código ISO 3166-1 alpha-2 (ex: BR, US)
   * @param size Tamanho da imagem (w20, w40, w80, w160, w320)
   */
  getFlagUrl(countryCode: string, size: 'w20' | 'w40' | 'w80' | 'w160' | 'w320' = 'w80'): string {
    const code = countryCode.toLowerCase();
    const cacheKey = `${code}-${size}`;
    
    if (flagCache.has(cacheKey)) {
      return flagCache.get(cacheKey)!;
    }

    const url = `${this.baseUrl}/${size}/${code}.png`;
    flagCache.set(cacheKey, url);
    return url;
  }

  /**
   * Obtém URL da bandeira em SVG (melhor qualidade)
   */
  getFlagSvgUrl(countryCode: string): string {
    const code = countryCode.toLowerCase();
    return `${this.baseUrl}/${code}.svg`;
  }

  /**
   * Obtém emoji da bandeira
   */
  getFlagEmoji(countryCode: string): string {
    const code = countryCode.toUpperCase();
    const country = AVAILABLE_COUNTRIES.find(c => c.code === code);
    
    if (country) {
      return country.flagEmoji;
    }

    // Gerar emoji a partir do código do país
    // Cada letra do código é convertida para um Regional Indicator Symbol
    const codePoints = [...code].map(char => 
      0x1F1E6 + char.charCodeAt(0) - 65
    );
    return String.fromCodePoint(...codePoints);
  }

  /**
   * Lista países disponíveis
   */
  getAvailableCountries(): Country[] {
    return AVAILABLE_COUNTRIES;
  }

  /**
   * Obtém país por código
   */
  getCountryByCode(code: string): Country | undefined {
    return AVAILABLE_COUNTRIES.find(c => c.code === code.toUpperCase());
  }

  /**
   * Renderiza elemento HTML da bandeira
   */
  renderFlag(countryCode: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
    const sizeMap = {
      small: { width: 20, apiSize: 'w20' as const },
      medium: { width: 32, apiSize: 'w40' as const },
      large: { width: 48, apiSize: 'w80' as const },
    };

    const { width, apiSize } = sizeMap[size];
    const url = this.getFlagUrl(countryCode, apiSize);
    const country = this.getCountryByCode(countryCode);
    const alt = country?.name_pt || countryCode;

    return `
      <img 
        src="${url}" 
        alt="${alt}" 
        class="country-flag country-flag-${size}"
        style="width: ${width}px; height: auto; border-radius: 2px; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"
        loading="lazy"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"
      /><span style="display: none; font-size: ${width * 0.8}px;">${this.getFlagEmoji(countryCode)}</span>
    `;
  }

  /**
   * Renderiza seletor de país
   */
  renderCountrySelector(selectedCode?: string, inputId = 'country-select'): string {
    const countries = this.getAvailableCountries();
    
    return `
      <div class="country-selector">
        <label for="${inputId}">País</label>
        <div class="country-select-wrapper">
          <select id="${inputId}" class="country-select">
            <option value="">Selecione o país</option>
            ${countries.map(country => `
              <option value="${country.code}" ${selectedCode === country.code ? 'selected' : ''}>
                ${country.flagEmoji} ${country.name_pt}
              </option>
            `).join('')}
          </select>
          <div class="country-flag-preview" id="${inputId}-preview">
            ${selectedCode ? this.renderFlag(selectedCode, 'medium') : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renderiza bandeira inline com nome do país
   */
  renderFlagWithName(countryCode: string, showName = true): string {
    const country = this.getCountryByCode(countryCode);
    const name = country?.name_pt || countryCode;
    
    return `
      <span class="country-badge">
        ${this.renderFlag(countryCode, 'small')}
        ${showName ? `<span class="country-name">${name}</span>` : ''}
      </span>
    `;
  }

  /**
   * Adiciona estilos CSS para bandeiras
   */
  addStyles(): void {
    if (document.getElementById('flag-service-styles')) return;

    const style = document.createElement('style');
    style.id = 'flag-service-styles';
    style.textContent = `
      .country-flag {
        display: inline-block;
        vertical-align: middle;
        object-fit: cover;
      }

      .country-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.25rem 0.5rem;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
      }

      .country-name {
        font-size: 0.85rem;
        color: var(--text-secondary, #aaa);
      }

      .country-selector {
        margin-bottom: 1rem;
      }

      .country-selector label {
        display: block;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
        color: var(--text-secondary, #aaa);
      }

      .country-select-wrapper {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .country-select {
        flex: 1;
        padding: 0.75rem 1rem;
        background: var(--bg-tertiary, #252540);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: var(--text-primary, #fff);
        font-size: 1rem;
        cursor: pointer;
        transition: border-color 0.2s;
      }

      .country-select:hover,
      .country-select:focus {
        border-color: var(--accent-green, #00ff88);
        outline: none;
      }

      .country-flag-preview {
        min-width: 40px;
        min-height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      /* Avatar com bandeira */
      .avatar-with-flag {
        position: relative;
        display: inline-block;
      }

      .avatar-flag-badge {
        position: absolute;
        bottom: -2px;
        right: -2px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--bg-primary, #0f0f1a);
        padding: 2px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .avatar-flag-badge img {
        width: 100%;
        height: 100%;
        border-radius: 2px;
        object-fit: cover;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Renderiza avatar com bandeira do país
   */
  renderAvatarWithFlag(
    avatarUrl: string | null,
    username: string,
    countryCode?: string,
    size: 'small' | 'medium' | 'large' = 'medium'
  ): string {
    const sizeMap = {
      small: 32,
      medium: 48,
      large: 64,
    };
    const avatarSize = sizeMap[size];
    const initial = username?.charAt(0).toUpperCase() || '?';

    const avatarContent = avatarUrl
      ? `<img src="${avatarUrl}" alt="${username}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
      : `<span style="font-size: ${avatarSize * 0.4}px;">${initial}</span>`;

    const flagBadge = countryCode
      ? `<div class="avatar-flag-badge">${this.renderFlag(countryCode, 'small')}</div>`
      : '';

    return `
      <div class="avatar-with-flag" style="width: ${avatarSize}px; height: ${avatarSize}px;">
        <div class="avatar" style="
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-blue, #0088ff), var(--accent-green, #00ff88));
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
}

export const flagService = new FlagService();

// Inicializar estilos automaticamente
if (typeof document !== 'undefined') {
  flagService.addStyles();
}
