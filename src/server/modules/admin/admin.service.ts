import { supabaseAdmin } from '../../services/supabase.js';
import { walletService } from '../wallet/wallet.service.js';
import { creditsService } from '../credits/credits.service.js';
import type { User, UserStatus, PunishmentType } from '../../../shared/types/index.js';

export const adminService = {
  // ==================== GESTÃO DE USUÁRIOS ====================

  // Listar todos os usuários
  async listUsers(limit = 50, offset = 0, status?: UserStatus) {
    let query = supabaseAdmin
      .from('users')
      .select('*, user_stats(*), wallet(*), credits(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      if (status === 'banned') {
        // Filtrar por is_banned = true OU status = 'banned'
        query = query.or('is_banned.eq.true,status.eq.banned');
      } else if (status === 'suspended') {
        // Filtrar por is_suspended = true OU status = 'suspended'
        query = query.or('is_suspended.eq.true,status.eq.suspended');
      } else if (status === 'active') {
        // Filtrar por usuários ativos (não banidos e não suspensos)
        query = query.eq('is_banned', false).eq('is_suspended', false);
      } else {
        query = query.eq('status', status);
      }
    }

    const { data, count } = await query;
    return { users: data || [], total: count || 0 };
  },

  // Buscar usuário completo
  async getUserFull(userId: string) {
    const { data } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        user_stats(*),
        wallet(*),
        credits(*),
        rankings(*),
        punishments(*)
      `)
      .eq('id', userId)
      .single();

    return data;
  },

  // Atualizar status do usuário
  async updateUserStatus(userId: string, status: UserStatus, adminId: string): Promise<{ error: string | null }> {
    // Preparar dados de atualização baseado no status
    let updateData: any = { status };
    
    if (status === 'active') {
      // Desbanir/dessuspender
      updateData = {
        status: 'active',
        is_banned: false,
        ban_reason: null,
        banned_at: null,
        banned_by: null,
        is_suspended: false,
        suspended_until: null,
        suspension_reason: null,
      };
    } else if (status === 'banned') {
      updateData = {
        status: 'banned',
        is_banned: true,
        banned_at: new Date().toISOString(),
        banned_by: adminId,
        is_suspended: false,
        suspended_until: null,
        suspension_reason: null,
      };
    } else if (status === 'suspended') {
      updateData = {
        status: 'suspended',
        is_suspended: true,
        is_banned: false,
        ban_reason: null,
        banned_at: null,
        banned_by: null,
      };
    }
    
    const { error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (!error) {
      await this.logAction(adminId, 'update_user_status', 'user', userId, { status });
    }

    return { error: error?.message || null };
  },

  // Atualizar role do usuário
  async updateUserRole(userId: string, role: 'user' | 'admin', adminId: string): Promise<{ error: string | null }> {
    const { error } = await supabaseAdmin
      .from('users')
      .update({ role })
      .eq('id', userId);

    if (!error) {
      await this.logAction(adminId, 'update_user_role', 'user', userId, { role });
    }

    return { error: error?.message || null };
  },

  // Deletar usuário permanentemente
  async deleteUser(userId: string, adminId: string): Promise<{ error: string | null }> {
    // Verificar se o usuário existe
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, username, role')
      .eq('id', userId)
      .single();

    if (!user) {
      return { error: 'Usuário não encontrado' };
    }

    // Não permitir deletar super_admin
    if (user.role === 'super_admin') {
      return { error: 'Não é possível deletar um Super Admin' };
    }

    try {
      // Deletar dados relacionados em ordem
      await supabaseAdmin.from('user_missions').delete().eq('user_id', userId);
      await supabaseAdmin.from('referrals').delete().eq('referrer_id', userId);
      await supabaseAdmin.from('referrals').delete().eq('referred_id', userId);
      await supabaseAdmin.from('coupon_uses').delete().eq('user_id', userId);
      await supabaseAdmin.from('notifications').delete().eq('user_id', userId);
      await supabaseAdmin.from('punishments').delete().eq('user_id', userId);
      await supabaseAdmin.from('rankings').delete().eq('user_id', userId);
      await supabaseAdmin.from('user_stats').delete().eq('user_id', userId);
      await supabaseAdmin.from('credits').delete().eq('user_id', userId);
      await supabaseAdmin.from('wallet').delete().eq('user_id', userId);
      
      // Deletar o usuário
      const { error } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) {
        return { error: error.message };
      }

      // Deletar do auth
      await supabaseAdmin.auth.admin.deleteUser(userId);

      // Log
      await this.logAction(adminId, 'delete_user', 'user', userId, { username: user.username });

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Erro ao deletar usuário' };
    }
  },

  // ==================== PUNIÇÕES ====================

  // Aplicar punição
  async applyPunishment(
    userId: string,
    adminId: string,
    type: PunishmentType,
    reason: string,
    durationHours?: number
  ): Promise<{ error: string | null }> {
    const expiresAt = durationHours
      ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
      : null;

    // Criar punição
    const { error } = await supabaseAdmin.from('punishments').insert({
      user_id: userId,
      admin_id: adminId,
      type,
      reason,
      expires_at: expiresAt,
      is_active: true,
    });

    if (error) {
      return { error: error.message };
    }

    // Atualizar status do usuário diretamente nos campos corretos
    if (type === 'ban') {
      await supabaseAdmin
        .from('users')
        .update({
          status: 'banned',
          is_banned: true,
          ban_reason: reason,
          banned_at: new Date().toISOString(),
          banned_by: adminId,
          is_suspended: false,
          suspended_until: null,
          suspension_reason: null,
        })
        .eq('id', userId);
    } else if (type === 'suspension') {
      await supabaseAdmin
        .from('users')
        .update({
          status: 'suspended',
          is_suspended: true,
          suspended_until: expiresAt,
          suspension_reason: reason,
          is_banned: false,
          ban_reason: null,
          banned_at: null,
          banned_by: null,
        })
        .eq('id', userId);
    }

    await this.logAction(adminId, 'apply_punishment', 'user', userId, { type, reason, durationHours });

    return { error: null };
  },

  // Remover punição
  async removePunishment(punishmentId: string, adminId: string): Promise<{ error: string | null }> {
    const { data: punishment } = await supabaseAdmin
      .from('punishments')
      .select('*')
      .eq('id', punishmentId)
      .single();

    if (!punishment) {
      return { error: 'Punição não encontrada' };
    }

    await supabaseAdmin
      .from('punishments')
      .update({ is_active: false })
      .eq('id', punishmentId);

    // Reativar usuário se era ban ou suspensão - limpar todos os campos
    if (punishment.type === 'ban' || punishment.type === 'suspension') {
      await supabaseAdmin
        .from('users')
        .update({
          status: 'active',
          is_banned: false,
          ban_reason: null,
          banned_at: null,
          banned_by: null,
          is_suspended: false,
          suspended_until: null,
          suspension_reason: null,
        })
        .eq('id', punishment.user_id);
    }

    await this.logAction(adminId, 'remove_punishment', 'punishment', punishmentId, { user_id: punishment.user_id });

    return { error: null };
  },

  // Listar punições
  async listPunishments(userId?: string, active?: boolean, limit = 50, offset = 0) {
    let query = supabaseAdmin
      .from('punishments')
      .select('*, user:users!user_id(id, username), admin:users!admin_id(id, username)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (active !== undefined) {
      query = query.eq('is_active', active);
    }

    const { data, count } = await query;
    return { punishments: data || [], total: count || 0 };
  },

  // ==================== GESTÃO FINANCEIRA ====================

  // Dashboard financeiro
  async getFinancialDashboard() {
    const [wallets, transactions, bets, payments] = await Promise.all([
      supabaseAdmin.from('wallet').select('balance'),
      supabaseAdmin.from('transactions').select('type, amount'),
      supabaseAdmin.from('bets').select('status, total_pool, platform_fee'),
      supabaseAdmin.from('payments').select('status, amount'),
    ]);

    const totalBalance = wallets.data?.reduce((sum, w) => sum + Number(w.balance), 0) || 0;
    const totalDeposits = transactions.data?.filter(t => t.type === 'deposit').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const totalWithdrawals = Math.abs(transactions.data?.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + Number(t.amount), 0) || 0);
    const totalBetPool = bets.data?.filter(b => b.status === 'settled').reduce((sum, b) => sum + Number(b.total_pool), 0) || 0;
    const totalPlatformFee = bets.data?.filter(b => b.status === 'settled').reduce((sum, b) => sum + Number(b.platform_fee || 0), 0) || 0;
    const pendingPayments = payments.data?.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    
    // Calcular bônus dados pelo admin
    const adminBonusLogs = await supabaseAdmin
      .from('admin_logs')
      .select('details')
      .eq('action', 'give_bonus');
    
    const totalAdminBonus = adminBonusLogs.data?.reduce((sum, log: any) => {
      return sum + (log.details?.amount || 0);
    }, 0) || 0;

    return {
      total_balance_users: totalBalance,
      total_deposits: totalDeposits,
      total_withdrawals: totalWithdrawals,
      total_bet_pool: totalBetPool,
      platform_revenue: totalPlatformFee,
      pending_payments: pendingPayments,
      total_admin_bonus: totalAdminBonus,
    };
  },

  // ==================== BÔNUS (NOVA FUNÇÃO UNIFICADA) ====================
  
  // Dar bônus para usuário (adiciona créditos)
  // Substitui as funções antigas de adjustWallet e adjustCredits para admin
  async giveBonus(
    userId: string, 
    amount: number, 
    reason: string, 
    adminId: string
  ): Promise<{ error: string | null; credits?: any }> {
    if (amount <= 0) {
      return { error: 'Quantidade de bônus deve ser maior que zero' };
    }

    // Verificar se usuário existe
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, username')
      .eq('id', userId)
      .single();

    if (!user) {
      return { error: 'Usuário não encontrado' };
    }

    // Adicionar créditos (bônus = créditos)
    const result = await creditsService.adminAdjust(userId, amount, adminId);

    if (result.error) {
      return { error: result.error };
    }

    // Registrar transação de bônus
    await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      type: 'bonus',
      amount: amount,
      description: `Bônus do administrador: ${reason}`,
      reference_id: null,
    });

    // Log detalhado
    await this.logAction(adminId, 'give_bonus', 'user', userId, { 
      amount, 
      reason,
      username: user.username,
      type: 'credits',
    });

    // Notificar usuário
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type: 'bonus_received',
      title: '🎁 Bônus Recebido!',
      message: `Você recebeu ${amount} crédito${amount > 1 ? 's' : ''} de bônus! Motivo: ${reason}`,
      data: { amount, reason, admin_id: adminId },
    });

    return { error: null, credits: result.credits };
  },

  // Ajustar carteira (MANTIDO para compatibilidade, mas não deve ser usado pelo admin)
  // Usado internamente pelo sistema para depósitos/saques
  async adjustWallet(userId: string, amount: number, description: string, adminId: string) {
    return walletService.adminAdjust(userId, amount, description, adminId);
  },

  // Ajustar créditos (MANTIDO para compatibilidade interna)
  async adjustCredits(userId: string, amount: number, adminId: string) {
    return creditsService.adminAdjust(userId, amount, adminId);
  },

  // Bloquear/desbloquear carteira
  async setWalletBlocked(userId: string, blocked: boolean, adminId: string): Promise<{ error: string | null }> {
    const result = await walletService.setBlocked(userId, blocked);

    if (!result.error) {
      await this.logAction(adminId, blocked ? 'block_wallet' : 'unblock_wallet', 'wallet', userId, {});
    }

    return result;
  },

  // ==================== GESTÃO DE SAQUES ====================

  // Listar solicitações de saque
  async listWithdrawals(status?: string, limit = 50, offset = 0) {
    let query = supabaseAdmin
      .from('withdrawal_requests')
      .select('*, user:users(id, username, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count } = await query;
    return { withdrawals: data || [], total: count || 0 };
  },

  // Aprovar/rejeitar saque
  async processWithdrawal(
    withdrawalId: string,
    adminId: string,
    approved: boolean,
    notes?: string
  ): Promise<{ error: string | null }> {
    const { data: withdrawal } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('*')
      .eq('id', withdrawalId)
      .single();

    if (!withdrawal) {
      return { error: 'Solicitação não encontrada' };
    }

    if (withdrawal.status !== 'pending') {
      return { error: 'Solicitação já processada' };
    }

    const newStatus = approved ? 'approved' : 'rejected';

    await supabaseAdmin
      .from('withdrawal_requests')
      .update({
        status: newStatus,
        admin_id: adminId,
        admin_notes: notes,
        processed_at: new Date().toISOString(),
      })
      .eq('id', withdrawalId);

    // Se rejeitado, devolver o valor para a carteira
    if (!approved) {
      await walletService.addBalance(withdrawal.user_id, withdrawal.amount, 'Saque rejeitado - reembolso');
    }

    await this.logAction(adminId, 'process_withdrawal', 'withdrawal', withdrawalId, { approved, notes });

    return { error: null };
  },

  // ==================== GESTÃO DE PARTIDAS ====================

  // Listar todas as partidas
  async listMatches(status?: string, limit = 50, offset = 0) {
    let query = supabaseAdmin
      .from('matches')
      .select(`
        *,
        player1:users!player1_id(id, username),
        player2:users!player2_id(id, username),
        room:rooms(*)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count } = await query;
    return { matches: data || [], total: count || 0 };
  },

  // Encerrar partida manualmente
  async forceEndMatch(matchId: string, winnerId: string | null, adminId: string): Promise<{ error: string | null }> {
    const { data: match } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (!match) {
      return { error: 'Partida não encontrada' };
    }

    if (match.status === 'finished') {
      return { error: 'Partida já finalizada' };
    }

    // Se tem vencedor, finaliza normalmente
    if (winnerId) {
      await supabaseAdmin
        .from('matches')
        .update({
          status: 'finished',
          winner_id: winnerId,
          finished_at: new Date().toISOString(),
        })
        .eq('id', matchId);
    } else {
      // Cancela a partida
      await supabaseAdmin
        .from('matches')
        .update({ status: 'cancelled' })
        .eq('id', matchId);

      // Cancelar aposta se existir
      const { data: bet } = await supabaseAdmin
        .from('bets')
        .select('*')
        .eq('match_id', matchId)
        .single();

      if (bet && bet.status !== 'settled') {
        await walletService.addBalance(match.player1_id, bet.amount, 'Partida cancelada pelo admin - reembolso');
        await walletService.addBalance(match.player2_id, bet.amount, 'Partida cancelada pelo admin - reembolso');

        await supabaseAdmin
          .from('bets')
          .update({ status: 'cancelled' })
          .eq('id', bet.id);
      }
    }

    // Fechar sala
    await supabaseAdmin
      .from('rooms')
      .update({ status: 'closed' })
      .eq('id', match.room_id);

    await this.logAction(adminId, 'force_end_match', 'match', matchId, { winner_id: winnerId });

    return { error: null };
  },

  // ==================== LOGS E AUDITORIA ====================

  // Registrar ação administrativa
  async logAction(adminId: string, action: string, targetType: string, targetId: string | null, details: Record<string, unknown>) {
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminId,
      action,
      target_type: targetType,
      target_id: targetId,
      details,
    });
  },

  // Listar logs
  async listLogs(adminId?: string, action?: string, limit = 100, offset = 0) {
    let query = supabaseAdmin
      .from('admin_logs')
      .select('*, admin:users!admin_id(id, username)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (adminId) {
      query = query.eq('admin_id', adminId);
    }
    if (action) {
      query = query.eq('action', action);
    }

    const { data, count } = await query;
    return { logs: data || [], total: count || 0 };
  },

  // ==================== ESTATÍSTICAS ====================

  // Dashboard geral
  async getDashboard() {
    const [users, matches, rooms, bets] = await Promise.all([
      supabaseAdmin.from('users').select('status', { count: 'exact' }),
      supabaseAdmin.from('matches').select('status', { count: 'exact' }),
      supabaseAdmin.from('rooms').select('status', { count: 'exact' }),
      supabaseAdmin.from('bets').select('status', { count: 'exact' }),
    ]);

    const activeUsers = users.data?.filter(u => u.status === 'active').length || 0;
    const totalUsers = users.count || 0;
    const activeMatches = matches.data?.filter(m => m.status === 'playing').length || 0;
    const totalMatches = matches.count || 0;
    const openRooms = rooms.data?.filter(r => r.status === 'open').length || 0;
    const activeBets = bets.data?.filter(b => b.status === 'active').length || 0;

    return {
      users: { total: totalUsers, active: activeUsers },
      matches: { total: totalMatches, active: activeMatches },
      rooms: { open: openRooms },
      bets: { active: activeBets },
    };
  },
};
