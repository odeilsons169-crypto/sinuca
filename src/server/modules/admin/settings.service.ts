import { supabaseAdmin } from '../../services/supabase.js';

// Configurações padrão do sistema
const DEFAULT_SETTINGS = {
  // Créditos
  credits_price_per_unit: 0.50, // R$ 0,50 por crédito
  credits_packages: [
    { amount: 4, price: 2.00, bonus: 0 },
    { amount: 20, price: 10.00, bonus: 0 },
    { amount: 40, price: 20.00, bonus: 0 },
    { amount: 100, price: 50.00, bonus: 0 },
  ],
  free_credits_on_register: 2,
  daily_free_credits: 0,

  // Taxas
  platform_fee_percent: 10, // 10% de taxa em apostas
  withdrawal_fee_percent: 0, // Taxa de saque
  min_withdrawal_amount: 20.00, // Saque mínimo

  // Apostas
  min_bet_amount: 5.00,
  max_bet_amount: 1000.00,
  bet_enabled: true,

  // Modos de jogo
  casual_mode_enabled: true,
  ranked_mode_enabled: true,
  bet_mode_enabled: true,
  ai_mode_enabled: false,

  // Partidas
  credits_per_match: 1,
  match_timeout_minutes: 30,
  turn_timeout_seconds: 60,

  // Ranking
  points_per_win: 25,
  points_per_loss: -10,
  ranking_reset_day: 1, // Dia do mês para reset mensal

  // Limites
  max_rooms_per_user: 1,
  max_active_matches: 1,
  max_daily_matches: 50,

  // Manutenção
  maintenance_mode: false,
  maintenance_message: 'Sistema em manutenção. Voltamos em breve!',

  // Contatos de suporte
  contact_whatsapp: '5511999999999',
  contact_instagram: 'sinucaonline',
  contact_email: 'suporte@sinucaonline.com',
};

export type SystemSettings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof SystemSettings;

class SettingsService {
  private cache: SystemSettings | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 60000; // 1 minuto

  // Obter todas as configurações
  async getAll(): Promise<SystemSettings> {
    // Verificar cache
    if (this.cache && Date.now() < this.cacheExpiry) {
      return this.cache;
    }

    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('key, value')
      .order('key');

    const settings = { ...DEFAULT_SETTINGS };

    if (data) {
      for (const row of data) {
        if (row.key in settings) {
          (settings as any)[row.key] = row.value;
        }
      }
    }

    // Atualizar cache
    this.cache = settings;
    this.cacheExpiry = Date.now() + this.CACHE_TTL;

    return settings;
  }

  // Obter uma configuração específica
  async get<K extends SettingKey>(key: K): Promise<SystemSettings[K]> {
    const settings = await this.getAll();
    return settings[key];
  }

  // Atualizar uma configuração
  async set<K extends SettingKey>(key: K, value: SystemSettings[K], adminId: string): Promise<{ success: boolean; error?: string }> {
    // Validar valor
    const validation = this.validateSetting(key, value);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Upsert na tabela
    const { error } = await supabaseAdmin
      .from('system_settings')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: adminId,
      }, { onConflict: 'key' });

    if (error) {
      return { success: false, error: error.message };
    }

    // Registrar log
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminId,
      action: 'update_setting',
      target_type: 'setting',
      target_id: key,
      details: { key, value, previous: this.cache?.[key] },
    });

    // Invalidar cache
    this.cache = null;

    return { success: true };
  }

  // Atualizar múltiplas configurações
  async setMultiple(settings: Partial<SystemSettings>, adminId: string): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];

    for (const [key, value] of Object.entries(settings)) {
      const result = await this.set(key as SettingKey, value as any, adminId);
      if (!result.success && result.error) {
        errors.push(`${key}: ${result.error}`);
      }
    }

    return { success: errors.length === 0, errors };
  }

  // Resetar para padrões
  async resetToDefaults(adminId: string): Promise<{ success: boolean }> {
    await supabaseAdmin.from('system_settings').delete().neq('key', '');

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminId,
      action: 'reset_settings',
      target_type: 'setting',
      target_id: 'all',
      details: { reset_to: 'defaults' },
    });

    this.cache = null;
    return { success: true };
  }

  // Validar configuração
  private validateSetting(key: SettingKey, value: any): { valid: boolean; error?: string } {
    switch (key) {
      case 'platform_fee_percent':
        if (typeof value !== 'number' || value < 0 || value > 50) {
          return { valid: false, error: 'Taxa deve ser entre 0% e 50%' };
        }
        break;

      case 'min_bet_amount':
        if (typeof value !== 'number' || value < 1) {
          return { valid: false, error: 'Aposta mínima deve ser pelo menos R$ 1,00' };
        }
        break;

      case 'max_bet_amount':
        if (typeof value !== 'number' || value < 10) {
          return { valid: false, error: 'Aposta máxima deve ser pelo menos R$ 10,00' };
        }
        break;

      case 'credits_per_match':
        if (typeof value !== 'number' || value < 0 || value > 10) {
          return { valid: false, error: 'Créditos por partida deve ser entre 0 e 10' };
        }
        break;

      case 'points_per_win':
        if (typeof value !== 'number' || value < 1 || value > 100) {
          return { valid: false, error: 'Pontos por vitória deve ser entre 1 e 100' };
        }
        break;

      case 'credits_packages':
        if (!Array.isArray(value)) {
          return { valid: false, error: 'Pacotes de créditos deve ser um array' };
        }
        break;
    }

    return { valid: true };
  }

  // Verificar se modo de jogo está habilitado
  async isGameModeEnabled(mode: 'casual' | 'ranked' | 'bet' | 'ai'): Promise<boolean> {
    const settings = await this.getAll();
    switch (mode) {
      case 'casual': return settings.casual_mode_enabled;
      case 'ranked': return settings.ranked_mode_enabled;
      case 'bet': return settings.bet_mode_enabled;
      case 'ai': return settings.ai_mode_enabled;
      default: return false;
    }
  }

  // Verificar modo manutenção
  async isMaintenanceMode(): Promise<{ enabled: boolean; message: string }> {
    const settings = await this.getAll();
    return {
      enabled: settings.maintenance_mode,
      message: settings.maintenance_message,
    };
  }

  // Obter configurações de créditos
  async getCreditSettings() {
    const settings = await this.getAll();
    return {
      pricePerUnit: settings.credits_price_per_unit,
      packages: settings.credits_packages,
      freeOnRegister: settings.free_credits_on_register,
      dailyFree: settings.daily_free_credits,
      perMatch: settings.credits_per_match,
    };
  }

  // Obter configurações de apostas
  async getBetSettings() {
    const settings = await this.getAll();
    return {
      enabled: settings.bet_mode_enabled,
      minAmount: settings.min_bet_amount,
      maxAmount: settings.max_bet_amount,
      platformFee: settings.platform_fee_percent,
    };
  }
}

export const settingsService = new SettingsService();
