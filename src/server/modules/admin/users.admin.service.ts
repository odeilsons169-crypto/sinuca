// =====================================================
// SERVIÇO DE GESTÃO DE USUÁRIOS (ADMIN)
// =====================================================

import { supabaseAdmin } from '../../services/supabase.js';
import { auditService } from './audit.service.js';

export interface UserSearchParams {
  search?: string;
  status?: 'active' | 'banned' | 'suspended' | 'vip';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface UserDetailedProfile {
  id: string;
  username: string;
  email: string;
  cpf?: string;
  phone?: string;
  role: string;
  avatar_url?: string;
  registration_ip?: string;
  last_login_ip?: string;
  last_login_at?: string;
  is_banned: boolean;
  ban_reason?: string;
  banned_at?: string;
  is_suspended: boolean;
  suspended_until?: string;
  suspension_reason?: string;
  created_at: string;
  // Econômico
  wallet?: {
    balance: number;
    deposit_balance: number;
    winnings_balance: number;
    bonus_balance: number;
  };
  credits?: {
    amount: number;
    is_unlimited: boolean;
  };
  subscription?: {
    plan: string;
    status: string;
    expires_at: string;
  };
  // Performance
  stats?: {
    total_matches: number;
    wins: number;
    losses: number;
    win_rate: number;
    ranking_position?: number;
    ranking_points: number;
    level: number;
    xp: number;
    total_xp: number;
    xp_to_next_level: number;
  };
  // Financeiro
  financial?: {
    total_deposited: number;
    total_withdrawn: number;
    total_spent: number;
  };
}

class UsersAdminService {
  /**
   * Listar usuários com filtros
   */
  async listUsers(params: UserSearchParams) {
    let query = supabaseAdmin
      .from('users')
      .select(`
        id, username, email, role, avatar_url, 
        is_banned, is_suspended, suspended_until,
        created_at, last_login_at,
        level, total_xp,
        wallet(balance, deposit_balance, winnings_balance, bonus_balance),
        credits(amount, is_unlimited)
      `, { count: 'exact' });

    // Busca por texto
    if (params.search) {
      const search = params.search.trim();
      query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Filtro por status
    if (params.status === 'banned') {
      query = query.eq('is_banned', true);
    } else if (params.status === 'suspended') {
      query = query.eq('is_suspended', true);
    } else if (params.status === 'active') {
      query = query.eq('is_banned', false).eq('is_suspended', false);
    } else if (params.status === 'vip') {
      // Precisa join com subscriptions
    }

    // Ordenação
    const sortBy = params.sortBy || 'created_at';
    const sortOrder = params.sortOrder === 'asc' ? true : false;
    query = query.order(sortBy, { ascending: sortOrder });

    // Paginação
    const limit = params.limit || 20;
    const offset = params.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    return { users: data || [], total: count || 0 };
  }

  /**
   * Obter perfil detalhado de um usuário
   */
  async getUserDetail(userId: string): Promise<UserDetailedProfile | null> {
    // Dados básicos
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        wallet(*),
        credits(*),
        subscriptions(*)
      `)
      .eq('id', userId)
      .single();

    if (error || !user) return null;

    // Estatísticas de partidas
    const { data: matchStats } = await supabaseAdmin
      .from('matches')
      .select('winner_id')
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .eq('status', 'finished');

    const totalMatches = matchStats?.length || 0;
    const wins = matchStats?.filter(m => m.winner_id === userId).length || 0;
    const losses = totalMatches - wins;
    const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

    // Ranking
    const { data: ranking } = await supabaseAdmin
      .from('rankings')
      .select('points')
      .eq('user_id', userId)
      .eq('period', 'all_time')
      .single();

    // Totais financeiros
    const { data: deposits } = await supabaseAdmin
      .from('payments')
      .select('amount_brl')
      .eq('user_id', userId)
      .eq('status', 'paid');

    const { data: withdrawals } = await supabaseAdmin
      .from('withdrawals')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'completed');

    const totalDeposited = deposits?.reduce((sum, p) => sum + Number(p.amount_brl), 0) || 0;
    const totalWithdrawn = withdrawals?.reduce((sum, w) => sum + Number(w.amount), 0) || 0;

    // Subscription ativa
    const activeSubscription = user.subscriptions?.find(
      (s: any) => s.status === 'active' && new Date(s.expires_at) > new Date()
    );

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      cpf: user.cpf,
      phone: user.phone,
      role: user.role,
      avatar_url: user.avatar_url,
      registration_ip: user.registration_ip,
      last_login_ip: user.last_login_ip,
      last_login_at: user.last_login_at,
      is_banned: user.is_banned,
      ban_reason: user.ban_reason,
      banned_at: user.banned_at,
      is_suspended: user.is_suspended,
      suspended_until: user.suspended_until,
      suspension_reason: user.suspension_reason,
      created_at: user.created_at,
      wallet: user.wallet ? {
        balance: Number(user.wallet.balance),
        deposit_balance: Number(user.wallet.deposit_balance || 0),
        winnings_balance: Number(user.wallet.winnings_balance || 0),
        bonus_balance: Number(user.wallet.bonus_balance || 0),
      } : undefined,
      credits: user.credits ? {
        amount: user.credits.amount,
        is_unlimited: user.credits.is_unlimited,
      } : undefined,
      subscription: activeSubscription ? {
        plan: activeSubscription.plan,
        status: activeSubscription.status,
        expires_at: activeSubscription.expires_at,
      } : undefined,
      stats: {
        total_matches: totalMatches,
        wins: wins,
        losses: losses,
        win_rate: Math.round(winRate * 10) / 10,
        ranking_points: ranking?.points || 0,
        level: user.level || 1,
        xp: user.xp || 0,
        total_xp: user.total_xp || 0,
        xp_to_next_level: user.xp_to_next_level || 100,
      },
      financial: {
        total_deposited: totalDeposited,
        total_withdrawn: totalWithdrawn,
        total_spent: totalDeposited - totalWithdrawn,
      },
    };
  }

  /**
   * Banir usuário
   */
  async banUser(adminId: string, userId: string, reason: string, ipAddress?: string) {
    const { data, error } = await supabaseAdmin.rpc('admin_ban_user', {
      p_admin_id: adminId,
      p_user_id: userId,
      p_reason: reason,
      p_is_permanent: true,
      p_duration_hours: null,
      p_ip_address: ipAddress,
    });

    if (error) throw error;
    return data?.[0] || { success: false, error_message: 'Erro desconhecido' };
  }

  /**
   * Suspender usuário temporariamente
   */
  async suspendUser(adminId: string, userId: string, reason: string, durationHours: number, ipAddress?: string) {
    const { data, error } = await supabaseAdmin.rpc('admin_ban_user', {
      p_admin_id: adminId,
      p_user_id: userId,
      p_reason: reason,
      p_is_permanent: false,
      p_duration_hours: durationHours,
      p_ip_address: ipAddress,
    });

    if (error) throw error;
    return data?.[0] || { success: false, error_message: 'Erro desconhecido' };
  }

  /**
   * Desbanir usuário
   */
  async unbanUser(adminId: string, userId: string, reason: string, ipAddress?: string) {
    const { data, error } = await supabaseAdmin.rpc('admin_unban_user', {
      p_admin_id: adminId,
      p_user_id: userId,
      p_reason: reason,
      p_ip_address: ipAddress,
    });

    if (error) throw error;
    return data?.[0] || { success: false, error_message: 'Erro desconhecido' };
  }

  /**
   * Ajustar saldo (CRÍTICO - apenas super_admin)
   */
  async adjustBalance(
    adminId: string,
    userId: string,
    amount: number,
    balanceType: 'deposit' | 'winnings' | 'bonus',
    reason: string,
    ipAddress?: string
  ) {
    const { data, error } = await supabaseAdmin.rpc('admin_adjust_balance', {
      p_admin_id: adminId,
      p_user_id: userId,
      p_amount: amount,
      p_balance_type: balanceType,
      p_reason: reason,
      p_ip_address: ipAddress,
    });

    if (error) throw error;
    return data?.[0] || { success: false, error_message: 'Erro desconhecido' };
  }

  /**
   * Resetar senha (envia email)
   */
  async resetPassword(adminId: string, userId: string, ipAddress?: string) {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (!user) throw new Error('Usuário não encontrado');

    // Enviar email de reset via Supabase Auth
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: user.email,
    });

    if (error) throw error;

    // Log de auditoria
    await auditService.log({
      adminId,
      action: 'user_suspend', // Usando como "reset_password"
      targetType: 'user',
      targetId: userId,
      details: { action: 'password_reset', email: user.email },
      ipAddress,
    });

    return { success: true };
  }

  /**
   * Resetar ranking
   */
  async resetRanking(adminId: string, userId: string, ipAddress?: string) {
    const { data: oldRanking } = await supabaseAdmin
      .from('rankings')
      .select('points')
      .eq('user_id', userId)
      .eq('period', 'all_time')
      .single();

    await supabaseAdmin
      .from('rankings')
      .update({ points: 0 })
      .eq('user_id', userId);

    await auditService.log({
      adminId,
      action: 'balance_adjust', // Usando como "ranking_reset"
      targetType: 'ranking',
      targetId: userId,
      details: { action: 'ranking_reset' },
      oldValue: { points: oldRanking?.points || 0 },
      newValue: { points: 0 },
      ipAddress,
    });

    return { success: true };
  }

  /**
   * Histórico de transações do usuário
   */
  async getUserTransactions(userId: string, limit = 50) {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Histórico de partidas do usuário
   */
  async getUserMatches(userId: string, limit = 50) {
    const { data, error } = await supabaseAdmin
      .from('matches')
      .select(`
        *,
        player1:users!player1_id(id, username),
        player2:users!player2_id(id, username),
        winner:users!winner_id(id, username),
        room:rooms!room_id(id, mode, bet_amount)
      `)
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    // Adicionar bet_amount no nível da partida para facilitar acesso no frontend
    return (data || []).map((m: any) => ({
      ...m,
      bet_amount: m.room?.bet_amount || null
    }));
  }

  /**
   * Histórico de créditos e bônus do usuário
   */
  async getUserCreditsHistory(userId: string, limit = 50) {
    // Buscar registros de bônus
    const { data: bonusRecords, error: bonusError } = await supabaseAdmin
      .from('bonus_records')
      .select(`
        id, bonus_type, amount, amount_type, description, created_at,
        admin:users!admin_id(id, username)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (bonusError) throw bonusError;

    // Buscar transações de créditos (compras, uso)
    const { data: creditTransactions, error: transError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .or('type.eq.credit_purchase,type.eq.credit_debit,description.ilike.%crédito%')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (transError) throw transError;

    // Calcular totais
    let creditsEarned = 0;
    let creditsSpent = 0;
    let creditsBonus = 0;

    bonusRecords?.forEach((b: any) => {
      if (b.amount_type === 'credits') {
        creditsBonus += Number(b.amount);
      }
    });

    creditTransactions?.forEach((t: any) => {
      const amount = Math.abs(Number(t.amount));
      if (t.type === 'credit_purchase' || t.amount > 0) {
        creditsEarned += amount;
      } else if (t.type === 'credit_debit' || t.amount < 0) {
        creditsSpent += amount;
      }
    });

    // Mesclar e ordenar por data
    const allRecords = [
      ...(bonusRecords || []).map((b: any) => ({
        id: b.id,
        type: 'bonus',
        subtype: b.bonus_type,
        amount: Number(b.amount),
        amountType: b.amount_type,
        description: b.description,
        adminName: b.admin?.username || null,
        createdAt: b.created_at,
      })),
      ...(creditTransactions || []).map((t: any) => ({
        id: t.id,
        type: 'transaction',
        subtype: t.type,
        amount: Number(t.amount),
        amountType: 'credits',
        description: t.description,
        adminName: null,
        createdAt: t.created_at,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return {
      history: allRecords,
      totals: {
        creditsEarned,
        creditsSpent,
        creditsBonus,
        netCredits: creditsEarned + creditsBonus - creditsSpent,
      },
    };
  }

  /**
   * Histórico de saques do usuário
   */
  async getUserWithdrawals(userId: string, limit = 50) {
    const { data, error } = await supabaseAdmin
      .from('withdrawals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }
}

export const usersAdminService = new UsersAdminService();
