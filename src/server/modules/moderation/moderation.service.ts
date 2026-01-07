import { supabaseAdmin } from '../../services/supabase.js';

// Palavras proibidas (expandir conforme necessário)
const BANNED_WORDS = [
  'idiota', 'burro', 'otario', 'otário', 'lixo', 'merda', 'porra', 'caralho',
  'fdp', 'pqp', 'vsf', 'tnc', 'vtnc', 'krl', 'arrombado', 'cuzao', 'cuzão',
  'viado', 'bicha', 'gay', 'retardado', 'mongol', 'imbecil', 'babaca',
  'hack', 'hacker', 'cheat', 'cheater', 'bot', 'macro'
];

// Padrões de spam
const SPAM_PATTERNS = [
  /(.)\1{5,}/i,  // Caractere repetido 5+ vezes
  /(.{2,})\1{3,}/i,  // Padrão repetido 3+ vezes
  /https?:\/\/[^\s]+/gi,  // Links
];

// Limites de rate
const RATE_LIMITS = {
  messagesPerMinute: 10,
  warningsBeforeMute: 3,
  muteDurationMinutes: 5,
  suspensionAfterMutes: 3,
  suspensionDurationHours: 24,
  banAfterSuspensions: 3,
};

// Cache de mensagens por usuário (em produção usar Redis)
const userMessageCache = new Map<string, { messages: number; lastReset: number; warnings: number }>();

// Cache de comportamento suspeito
const suspiciousBehaviorCache = new Map<string, { actions: any[]; score: number }>();

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
  action?: 'none' | 'warn' | 'mute' | 'suspend' | 'ban';
  filteredContent?: string;
}

export interface CheatDetectionResult {
  isSuspicious: boolean;
  confidence: number;
  reasons: string[];
  action?: 'none' | 'flag' | 'suspend' | 'ban';
}

class ModerationService {
  // ==================== MODERAÇÃO DE CHAT ====================

  async moderateMessage(userId: string, message: string): Promise<ModerationResult> {
    // 1. Verificar rate limit
    const rateCheck = this.checkRateLimit(userId);
    if (!rateCheck.allowed) {
      return { allowed: false, reason: 'Muitas mensagens. Aguarde um momento.', action: 'warn' };
    }

    // 2. Verificar palavras proibidas
    const contentCheck = this.checkBannedContent(message);
    if (!contentCheck.allowed) {
      await this.applyWarning(userId, 'banned_words', message);
      return contentCheck;
    }

    // 3. Verificar spam
    const spamCheck = this.checkSpam(message);
    if (!spamCheck.allowed) {
      await this.applyWarning(userId, 'spam', message);
      return spamCheck;
    }

    // 4. Filtrar conteúdo (censurar parcialmente)
    const filteredContent = this.filterContent(message);

    return { allowed: true, filteredContent, action: 'none' };
  }

  private checkRateLimit(userId: string): { allowed: boolean } {
    const now = Date.now();
    const userData = userMessageCache.get(userId) || { messages: 0, lastReset: now, warnings: 0 };

    // Reset a cada minuto
    if (now - userData.lastReset > 60000) {
      userData.messages = 0;
      userData.lastReset = now;
    }

    userData.messages++;
    userMessageCache.set(userId, userData);

    return { allowed: userData.messages <= RATE_LIMITS.messagesPerMinute };
  }

  private checkBannedContent(message: string): ModerationResult {
    const lowerMessage = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    for (const word of BANNED_WORDS) {
      const normalizedWord = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (lowerMessage.includes(normalizedWord)) {
        return { 
          allowed: false, 
          reason: 'Mensagem contém conteúdo proibido', 
          action: 'warn' 
        };
      }
    }

    return { allowed: true };
  }

  private checkSpam(message: string): ModerationResult {
    for (const pattern of SPAM_PATTERNS) {
      if (pattern.test(message)) {
        return { 
          allowed: false, 
          reason: 'Mensagem detectada como spam', 
          action: 'warn' 
        };
      }
    }

    // Verificar mensagem muito curta repetida
    if (message.length < 3 && message.length > 0) {
      return { 
        allowed: false, 
        reason: 'Mensagem muito curta', 
        action: 'warn' 
      };
    }

    return { allowed: true };
  }

  private filterContent(message: string): string {
    let filtered = message;
    
    for (const word of BANNED_WORDS) {
      const regex = new RegExp(word, 'gi');
      filtered = filtered.replace(regex, '*'.repeat(word.length));
    }

    return filtered;
  }

  // ==================== SISTEMA DE PENALIDADES ====================

  private async applyWarning(userId: string, type: string, content: string): Promise<void> {
    const userData = userMessageCache.get(userId) || { messages: 0, lastReset: Date.now(), warnings: 0 };
    userData.warnings++;
    userMessageCache.set(userId, userData);

    // Registrar log
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: null, // Sistema automático
      action: 'auto_warning',
      target_type: 'user',
      target_id: userId,
      details: { type, content, warning_count: userData.warnings },
    });

    // Verificar se deve aplicar mute
    if (userData.warnings >= RATE_LIMITS.warningsBeforeMute) {
      await this.applyMute(userId, RATE_LIMITS.muteDurationMinutes);
      userData.warnings = 0;
      userMessageCache.set(userId, userData);
    }
  }

  async applyMute(userId: string, durationMinutes: number): Promise<void> {
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    await supabaseAdmin.from('punishments').insert({
      user_id: userId,
      type: 'mute',
      reason: 'Comportamento inadequado no chat (automático)',
      expires_at: expiresAt.toISOString(),
      applied_by: null, // Sistema
    });

    // Verificar histórico de mutes
    const { count } = await supabaseAdmin
      .from('punishments')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('type', 'mute')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if ((count || 0) >= RATE_LIMITS.suspensionAfterMutes) {
      await this.applySuspension(userId, RATE_LIMITS.suspensionDurationHours);
    }
  }

  async applySuspension(userId: string, durationHours: number): Promise<void> {
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

    await supabaseAdmin.from('punishments').insert({
      user_id: userId,
      type: 'suspension',
      reason: 'Múltiplas violações das regras (automático)',
      expires_at: expiresAt.toISOString(),
      applied_by: null,
    });

    await supabaseAdmin
      .from('users')
      .update({ status: 'suspended' })
      .eq('id', userId);

    // Verificar histórico de suspensões
    const { count } = await supabaseAdmin
      .from('punishments')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('type', 'suspension')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if ((count || 0) >= RATE_LIMITS.banAfterSuspensions) {
      await this.applyBan(userId, 'Múltiplas suspensões');
    }
  }

  async applyBan(userId: string, reason: string): Promise<void> {
    await supabaseAdmin.from('punishments').insert({
      user_id: userId,
      type: 'ban',
      reason: `${reason} (automático)`,
      expires_at: null, // Permanente
      applied_by: null,
    });

    await supabaseAdmin
      .from('users')
      .update({ status: 'banned' })
      .eq('id', userId);
  }

  // ==================== DETECÇÃO DE TRAPAÇA ====================

  async detectCheat(userId: string, matchId: string, action: any): Promise<CheatDetectionResult> {
    const result: CheatDetectionResult = {
      isSuspicious: false,
      confidence: 0,
      reasons: [],
      action: 'none',
    };

    // Obter histórico de ações do usuário
    let userBehavior = suspiciousBehaviorCache.get(userId) || { actions: [], score: 0 };

    // Adicionar ação atual
    userBehavior.actions.push({
      ...action,
      timestamp: Date.now(),
      matchId,
    });

    // Manter apenas últimas 100 ações
    if (userBehavior.actions.length > 100) {
      userBehavior.actions = userBehavior.actions.slice(-100);
    }

    // 1. Verificar velocidade de ações (ações muito rápidas = bot/macro)
    const speedCheck = this.checkActionSpeed(userBehavior.actions);
    if (speedCheck.suspicious) {
      result.reasons.push(speedCheck.reason);
      result.confidence += speedCheck.confidence;
    }

    // 2. Verificar precisão anormal (acertos impossíveis)
    const accuracyCheck = this.checkAbnormalAccuracy(userBehavior.actions);
    if (accuracyCheck.suspicious) {
      result.reasons.push(accuracyCheck.reason);
      result.confidence += accuracyCheck.confidence;
    }

    // 3. Verificar padrões repetitivos (bot)
    const patternCheck = this.checkRepetitivePatterns(userBehavior.actions);
    if (patternCheck.suspicious) {
      result.reasons.push(patternCheck.reason);
      result.confidence += patternCheck.confidence;
    }

    // 4. Verificar win rate anormal
    const winRateCheck = await this.checkAbnormalWinRate(userId);
    if (winRateCheck.suspicious) {
      result.reasons.push(winRateCheck.reason);
      result.confidence += winRateCheck.confidence;
    }

    // Normalizar confiança (0-100)
    result.confidence = Math.min(100, result.confidence);
    result.isSuspicious = result.confidence >= 50;

    // Atualizar score do usuário
    userBehavior.score += result.confidence / 10;
    suspiciousBehaviorCache.set(userId, userBehavior);

    // Determinar ação baseada na confiança
    if (result.confidence >= 90) {
      result.action = 'ban';
      await this.flagForReview(userId, matchId, result, 'critical');
      await this.applyBan(userId, 'Trapaça detectada com alta confiança');
    } else if (result.confidence >= 70) {
      result.action = 'suspend';
      await this.flagForReview(userId, matchId, result, 'high');
      await this.applySuspension(userId, 48);
    } else if (result.confidence >= 50) {
      result.action = 'flag';
      await this.flagForReview(userId, matchId, result, 'medium');
    }

    return result;
  }

  private checkActionSpeed(actions: any[]): { suspicious: boolean; reason: string; confidence: number } {
    if (actions.length < 5) return { suspicious: false, reason: '', confidence: 0 };

    const recentActions = actions.slice(-10);
    const intervals: number[] = [];

    for (let i = 1; i < recentActions.length; i++) {
      intervals.push(recentActions[i].timestamp - recentActions[i - 1].timestamp);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    // Ações muito rápidas (menos de 100ms em média)
    if (avgInterval < 100) {
      return { 
        suspicious: true, 
        reason: 'Ações executadas em velocidade sobre-humana', 
        confidence: 40 
      };
    }

    // Intervalos muito consistentes (bot)
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
    if (variance < 50 && avgInterval < 500) {
      return { 
        suspicious: true, 
        reason: 'Padrão de tempo muito consistente (possível automação)', 
        confidence: 30 
      };
    }

    return { suspicious: false, reason: '', confidence: 0 };
  }

  private checkAbnormalAccuracy(actions: any[]): { suspicious: boolean; reason: string; confidence: number } {
    const shots = actions.filter(a => a.type === 'shot');
    if (shots.length < 10) return { suspicious: false, reason: '', confidence: 0 };

    const successfulShots = shots.filter(s => s.success).length;
    const accuracy = successfulShots / shots.length;

    // Precisão acima de 95% em 10+ tacadas é muito suspeito
    if (accuracy > 0.95) {
      return { 
        suspicious: true, 
        reason: `Precisão anormalmente alta: ${(accuracy * 100).toFixed(1)}%`, 
        confidence: 35 
      };
    }

    // Verificar tacadas "impossíveis" (ângulos muito difíceis com sucesso)
    const impossibleShots = shots.filter(s => s.difficulty === 'impossible' && s.success).length;
    if (impossibleShots > 3) {
      return { 
        suspicious: true, 
        reason: `${impossibleShots} tacadas "impossíveis" bem-sucedidas`, 
        confidence: 40 
      };
    }

    return { suspicious: false, reason: '', confidence: 0 };
  }

  private checkRepetitivePatterns(actions: any[]): { suspicious: boolean; reason: string; confidence: number } {
    if (actions.length < 20) return { suspicious: false, reason: '', confidence: 0 };

    // Converter ações em string para detectar padrões
    const actionString = actions.slice(-20).map(a => `${a.type}-${Math.round(a.angle || 0)}-${Math.round(a.power || 0)}`).join('|');
    
    // Verificar padrões repetidos
    const patterns = actionString.match(/(.{10,})\1+/g);
    if (patterns && patterns.length > 0) {
      return { 
        suspicious: true, 
        reason: 'Padrão de ações repetitivo detectado', 
        confidence: 25 
      };
    }

    return { suspicious: false, reason: '', confidence: 0 };
  }

  private async checkAbnormalWinRate(userId: string): Promise<{ suspicious: boolean; reason: string; confidence: number }> {
    const { data: stats } = await supabaseAdmin
      .from('user_stats')
      .select('total_matches, wins, win_rate')
      .eq('user_id', userId)
      .single();

    if (!stats || stats.total_matches < 20) {
      return { suspicious: false, reason: '', confidence: 0 };
    }

    // Win rate acima de 90% com 20+ partidas é muito suspeito
    if (stats.win_rate > 90) {
      return { 
        suspicious: true, 
        reason: `Win rate anormalmente alto: ${stats.win_rate}% em ${stats.total_matches} partidas`, 
        confidence: 30 
      };
    }

    return { suspicious: false, reason: '', confidence: 0 };
  }

  private async flagForReview(userId: string, matchId: string, result: CheatDetectionResult, priority: string): Promise<void> {
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: null,
      action: 'cheat_detection',
      target_type: 'user',
      target_id: userId,
      details: {
        match_id: matchId,
        confidence: result.confidence,
        reasons: result.reasons,
        priority,
        auto_action: result.action,
      },
    });
  }

  // ==================== VERIFICAÇÃO DE STATUS ====================

  async checkUserStatus(userId: string): Promise<{ canPlay: boolean; reason?: string }> {
    // Verificar status do usuário
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('status')
      .eq('id', userId)
      .single();

    if (user?.status === 'banned') {
      return { canPlay: false, reason: 'Conta banida permanentemente' };
    }

    if (user?.status === 'suspended') {
      // Verificar se suspensão expirou
      const { data: punishment } = await supabaseAdmin
        .from('punishments')
        .select('expires_at')
        .eq('user_id', userId)
        .eq('type', 'suspension')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (punishment?.expires_at && new Date(punishment.expires_at) > new Date()) {
        return { 
          canPlay: false, 
          reason: `Conta suspensa até ${new Date(punishment.expires_at).toLocaleString('pt-BR')}` 
        };
      } else {
        // Suspensão expirou, reativar
        await supabaseAdmin
          .from('users')
          .update({ status: 'active' })
          .eq('id', userId);
      }
    }

    // Verificar mute ativo
    const { data: mute } = await supabaseAdmin
      .from('punishments')
      .select('expires_at')
      .eq('user_id', userId)
      .eq('type', 'mute')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (mute) {
      return { 
        canPlay: true, 
        reason: `Chat silenciado até ${new Date(mute.expires_at).toLocaleString('pt-BR')}` 
      };
    }

    return { canPlay: true };
  }

  // ==================== RELATÓRIOS ====================

  async reportUser(reporterId: string, targetId: string, reason: string, details?: string): Promise<void> {
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: null,
      action: 'user_report',
      target_type: 'user',
      target_id: targetId,
      details: {
        reporter_id: reporterId,
        reason,
        details,
      },
    });

    // Verificar quantidade de reports
    const { count } = await supabaseAdmin
      .from('admin_logs')
      .select('*', { count: 'exact' })
      .eq('action', 'user_report')
      .eq('target_id', targetId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Se muitos reports em 24h, aplicar suspensão automática para análise
    if ((count || 0) >= 5) {
      await this.applySuspension(targetId, 24);
    }
  }
}

export const moderationService = new ModerationService();
