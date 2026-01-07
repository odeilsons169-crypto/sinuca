// =====================================================
// SERVIÇO DE AUDITORIA - Logs Imutáveis
// =====================================================

import { supabaseAdmin } from '../../services/supabase.js';

export type AuditAction =
  | 'user_ban'
  | 'user_unban'
  | 'user_suspend'
  | 'balance_adjust'
  | 'withdrawal_approve'
  | 'withdrawal_reject'
  | 'match_cancel'
  | 'match_force_result'
  | 'bet_liquidate'
  | 'settings_update'
  | 'tournament_create'
  | 'tournament_cancel'
  | 'tournament_advance_player'
  | 'room_force_close'
  | 'chat_delete'
  | 'chat_flag'
  | 'user_update'
  | 'user_vip_grant'
  | 'user_vip_revoke';

export interface AuditLogEntry {
  adminId: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  details: Record<string, any>;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

class AuditService {
  /**
   * Registrar log de auditoria (IMUTÁVEL)
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await supabaseAdmin.from('admin_logs').insert({
        admin_id: entry.adminId,
        action: entry.action,
        target_type: entry.targetType,
        target_id: entry.targetId,
        details: entry.details,
        old_value: entry.oldValue || null,
        new_value: entry.newValue || null,
        ip_address: entry.ipAddress || null,
        user_agent: entry.userAgent || null,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Audit] Erro ao registrar log:', error);
      // Não lançar erro para não interromper a operação principal
    }
  }

  /**
   * Buscar logs com filtros
   */
  async getLogs(params: {
    adminId?: string;
    action?: AuditAction;
    targetType?: string;
    targetId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabaseAdmin
      .from('admin_logs')
      .select(`
        *,
        admin:users!admin_id(id, username, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (params.adminId) {
      query = query.eq('admin_id', params.adminId);
    }
    if (params.action) {
      query = query.eq('action', params.action);
    }
    if (params.targetType) {
      query = query.eq('target_type', params.targetType);
    }
    if (params.targetId) {
      query = query.eq('target_id', params.targetId);
    }
    if (params.startDate) {
      query = query.gte('created_at', params.startDate);
    }
    if (params.endDate) {
      query = query.lte('created_at', params.endDate);
    }

    const limit = params.limit || 50;
    const offset = params.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    return { logs: data || [], total: count || 0 };
  }

  /**
   * Buscar logs de um usuário específico (todas as ações sobre ele)
   */
  async getUserLogs(userId: string, limit = 50) {
    const { data, error } = await supabaseAdmin
      .from('admin_logs')
      .select(`
        *,
        admin:users!admin_id(id, username, email)
      `)
      .eq('target_type', 'user')
      .eq('target_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Buscar logs de um admin específico (todas as ações dele)
   */
  async getAdminActions(adminId: string, limit = 50) {
    const { data, error } = await supabaseAdmin
      .from('admin_logs')
      .select('*')
      .eq('admin_id', adminId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Estatísticas de auditoria
   */
  async getStats(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabaseAdmin
      .from('admin_logs')
      .select('action, created_at')
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    // Agrupar por ação
    const byAction: Record<string, number> = {};
    const byDay: Record<string, number> = {};

    for (const log of data || []) {
      // Por ação
      byAction[log.action] = (byAction[log.action] || 0) + 1;

      // Por dia
      const day = log.created_at.split('T')[0];
      byDay[day] = (byDay[day] || 0) + 1;
    }

    return { byAction, byDay, total: data?.length || 0 };
  }
}

export const auditService = new AuditService();
