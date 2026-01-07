// =====================================================
// SERVIÇO DE GESTÃO FINANCEIRA (ADMIN)
// =====================================================

import { supabaseAdmin } from '../../services/supabase.js';
import { auditService } from './audit.service.js';

export interface FinancialDashboard {
  revenue: {
    today: number;
    week: number;
    month: number;
    total: number;
    byType: {
      payments: number;
      subscriptions: number;
      credit_purchases: number;
      bet_commissions: number;
      tournament_commissions: number;
    };
  };
  bonus: {
    today: number;
    week: number;
    month: number;
    total: number;
    byType: {
      admin_credit: number;
      admin_balance: number;
      welcome: number;
      referral: number;
      coupon: number;
      mission: number;
      daily_free: number;
    };
    adminGiven: {
      credits: number;
      balance: number;
    };
  };
  withdrawals: {
    pending_count: number;
    pending_amount: number;
    approved_today: number;
    rejected_today: number;
  };
  bets: {
    active_count: number;
    active_pool: number;
    platform_fee_today: number;
    platform_fee_month: number;
  };
  users: {
    total_balance: number;
    total_deposit_balance: number;
    total_winnings_balance: number;
    total_bonus_balance: number;
  };
}

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  pix_key: string;
  pix_key_type: string;
  status: string;
  created_at: string;
  user?: {
    id: string;
    username: string;
    email: string;
    cpf?: string;
  };
}

class FinanceAdminService {
  /**
   * Dashboard financeiro completo
   * Separa RECEITA REAL de BÔNUS
   */
  async getDashboard(): Promise<FinancialDashboard> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString();

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthStartISO = monthStart.toISOString();

    // ==================== RECEITA REAL ====================
    // Pagamentos (depósitos, compra de créditos)
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('amount_brl, paid_at, status, payment_type')
      .eq('status', 'paid');

    const revenueToday = payments?.filter(p => p.paid_at >= todayISO)
      .reduce((sum, p) => sum + Number(p.amount_brl), 0) || 0;
    const revenueWeek = payments?.filter(p => p.paid_at >= weekAgoISO)
      .reduce((sum, p) => sum + Number(p.amount_brl), 0) || 0;
    const revenueMonth = payments?.filter(p => p.paid_at >= monthStartISO)
      .reduce((sum, p) => sum + Number(p.amount_brl), 0) || 0;
    const revenueTotal = payments?.reduce((sum, p) => sum + Number(p.amount_brl), 0) || 0;

    // Receita de assinaturas
    const { data: subscriptions } = await supabaseAdmin
      .from('subscriptions')
      .select('price, created_at, status')
      .eq('status', 'active');
    const subscriptionRevenue = subscriptions?.reduce((sum, s) => sum + Number(s.price || 0), 0) || 0;

    // Comissões de apostas
    const { data: bets } = await supabaseAdmin
      .from('bets')
      .select('total_pool, platform_fee, status, settled_at');

    const activeBets = bets?.filter(b => b.status === 'active') || [];
    const settledToday = bets?.filter(b => b.status === 'settled' && b.settled_at >= todayISO) || [];
    const settledMonth = bets?.filter(b => b.status === 'settled' && b.settled_at >= monthStartISO) || [];
    const betCommissionsMonth = settledMonth.reduce((sum, b) => sum + Number(b.platform_fee || 0), 0);

    // Comissões de torneios (inscrições)
    const { data: tournamentEntries } = await supabaseAdmin
      .from('tournament_participants')
      .select('entry_fee, tournament:tournaments(created_by, admin_fee_percent), created_at')
      .gte('created_at', monthStartISO);

    let tournamentCommissions = 0;
    tournamentEntries?.forEach((entry: any) => {
      const fee = Number(entry.entry_fee || 0);
      const adminPercent = Number(entry.tournament?.admin_fee_percent || 10) / 100;
      tournamentCommissions += fee * adminPercent;
    });

    // ==================== BÔNUS (NÃO É RECEITA) ====================
    const { data: bonusRecords } = await supabaseAdmin
      .from('bonus_records')
      .select('*');

    const bonusToday = bonusRecords?.filter(b => b.created_at >= todayISO)
      .reduce((sum, b) => sum + Number(b.amount), 0) || 0;
    const bonusWeek = bonusRecords?.filter(b => b.created_at >= weekAgoISO)
      .reduce((sum, b) => sum + Number(b.amount), 0) || 0;
    const bonusMonth = bonusRecords?.filter(b => b.created_at >= monthStartISO)
      .reduce((sum, b) => sum + Number(b.amount), 0) || 0;
    const bonusTotal = bonusRecords?.reduce((sum, b) => sum + Number(b.amount), 0) || 0;

    // Bônus por tipo
    const bonusByType = {
      admin_credit: 0,
      admin_balance: 0,
      welcome: 0,
      referral: 0,
      coupon: 0,
      mission: 0,
      daily_free: 0,
    };

    bonusRecords?.filter(b => b.created_at >= monthStartISO).forEach(b => {
      const type = b.bonus_type as keyof typeof bonusByType;
      if (bonusByType[type] !== undefined) {
        bonusByType[type] += Number(b.amount);
      }
    });

    // Bônus dados pelo admin (separado)
    const adminGivenCredits = bonusRecords?.filter(b => 
      b.admin_id && b.amount_type === 'credits' && b.created_at >= monthStartISO
    ).reduce((sum, b) => sum + Number(b.amount), 0) || 0;

    const adminGivenBalance = bonusRecords?.filter(b => 
      b.admin_id && b.amount_type === 'balance' && b.created_at >= monthStartISO
    ).reduce((sum, b) => sum + Number(b.amount), 0) || 0;

    // Fallback: se não houver registros na nova tabela, usar credit_adjustments
    let fallbackAdminCredits = 0;
    if (adminGivenCredits === 0) {
      const { data: creditAdjustments } = await supabaseAdmin
        .from('credit_adjustments')
        .select('amount, created_at')
        .gte('created_at', monthStartISO)
        .gt('amount', 0);
      fallbackAdminCredits = creditAdjustments?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;
    }

    // ==================== SAQUES ====================
    const { data: withdrawals } = await supabaseAdmin
      .from('withdrawals')
      .select('amount, status, processed_at, created_at');

    const pendingWithdrawals = withdrawals?.filter(w => w.status === 'pending') || [];
    const approvedToday = withdrawals?.filter(w => 
      w.status === 'completed' && w.processed_at >= todayISO
    ).length || 0;
    const rejectedToday = withdrawals?.filter(w => 
      w.status === 'rejected' && w.processed_at >= todayISO
    ).length || 0;

    // ==================== SALDOS DOS USUÁRIOS ====================
    const { data: wallets } = await supabaseAdmin
      .from('wallet')
      .select('balance, deposit_balance, winnings_balance, bonus_balance');

    const totalBalance = wallets?.reduce((sum, w) => sum + Number(w.balance || 0), 0) || 0;
    const totalDeposit = wallets?.reduce((sum, w) => sum + Number(w.deposit_balance || 0), 0) || 0;
    const totalWinnings = wallets?.reduce((sum, w) => sum + Number(w.winnings_balance || 0), 0) || 0;
    const totalBonus = wallets?.reduce((sum, w) => sum + Number(w.bonus_balance || 0), 0) || 0;

    return {
      revenue: {
        today: revenueToday,
        week: revenueWeek,
        month: revenueMonth,
        total: revenueTotal,
        byType: {
          payments: revenueMonth,
          subscriptions: subscriptionRevenue,
          credit_purchases: 0, // Já incluído em payments
          bet_commissions: betCommissionsMonth,
          tournament_commissions: tournamentCommissions,
        },
      },
      bonus: {
        today: bonusToday,
        week: bonusWeek,
        month: bonusMonth,
        total: bonusTotal,
        byType: bonusByType,
        adminGiven: {
          credits: adminGivenCredits || fallbackAdminCredits,
          balance: adminGivenBalance,
        },
      },
      withdrawals: {
        pending_count: pendingWithdrawals.length,
        pending_amount: pendingWithdrawals.reduce((sum, w) => sum + Number(w.amount), 0),
        approved_today: approvedToday,
        rejected_today: rejectedToday,
      },
      bets: {
        active_count: activeBets.length,
        active_pool: activeBets.reduce((sum, b) => sum + Number(b.total_pool || 0), 0),
        platform_fee_today: settledToday.reduce((sum, b) => sum + Number(b.platform_fee || 0), 0),
        platform_fee_month: betCommissionsMonth,
      },
      users: {
        total_balance: totalBalance,
        total_deposit_balance: totalDeposit,
        total_winnings_balance: totalWinnings,
        total_bonus_balance: totalBonus,
      },
    };
  }

  /**
   * Listar solicitações de saque
   */
  async listWithdrawals(params: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabaseAdmin
      .from('withdrawals')
      .select(`
        *,
        user:users!withdrawals_user_id_fkey(id, username, email, cpf)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (params.status) {
      query = query.eq('status', params.status);
    }

    const limit = params.limit || 20;
    const offset = params.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return { withdrawals: data || [], total: count || 0 };
  }

  /**
   * Aprovar saque
   */
  async approveWithdrawal(adminId: string, withdrawalId: string, notes?: string, ipAddress?: string) {
    const { data: withdrawal } = await supabaseAdmin
      .from('withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single();

    if (!withdrawal) {
      return { success: false, error: 'Solicitação não encontrada' };
    }
    if (withdrawal.status !== 'pending') {
      return { success: false, error: 'Solicitação já processada' };
    }

    const { error } = await supabaseAdmin
      .from('withdrawals')
      .update({
        status: 'completed',
        processed_by: adminId,
        processed_at: new Date().toISOString(),
        admin_notes: notes,
      })
      .eq('id', withdrawalId);

    if (error) throw error;

    await auditService.log({
      adminId,
      action: 'withdrawal_approve',
      targetType: 'withdrawal',
      targetId: withdrawalId,
      details: { user_id: withdrawal.user_id, amount: withdrawal.amount, notes },
      ipAddress,
    });

    return { success: true };
  }

  /**
   * Rejeitar saque (devolve o valor)
   */
  async rejectWithdrawal(adminId: string, withdrawalId: string, reason: string, ipAddress?: string) {
    const { data: withdrawal } = await supabaseAdmin
      .from('withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single();

    if (!withdrawal) {
      return { success: false, error: 'Solicitação não encontrada' };
    }
    if (withdrawal.status !== 'pending') {
      return { success: false, error: 'Solicitação já processada' };
    }

    // Devolver valor para winnings_balance
    await supabaseAdmin.rpc('add_winnings_balance', {
      p_user_id: withdrawal.user_id,
      p_amount: withdrawal.amount,
      p_description: 'Saque rejeitado - reembolso',
    });

    const { error } = await supabaseAdmin
      .from('withdrawals')
      .update({
        status: 'rejected',
        processed_by: adminId,
        processed_at: new Date().toISOString(),
        admin_notes: reason,
      })
      .eq('id', withdrawalId);

    if (error) throw error;

    await auditService.log({
      adminId,
      action: 'withdrawal_reject',
      targetType: 'withdrawal',
      targetId: withdrawalId,
      details: { user_id: withdrawal.user_id, amount: withdrawal.amount, reason },
      ipAddress,
    });

    return { success: true };
  }

  /**
   * Histórico de pagamentos
   */
  async listPayments(params: {
    status?: string;
    method?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabaseAdmin
      .from('payments')
      .select(`
        *,
        user:users(id, username, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (params.status) query = query.eq('status', params.status);
    if (params.method) query = query.eq('payment_method', params.method);
    if (params.startDate) query = query.gte('created_at', params.startDate);
    if (params.endDate) query = query.lte('created_at', params.endDate);

    const limit = params.limit || 20;
    const offset = params.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return { payments: data || [], total: count || 0 };
  }

  /**
   * Relatório de comissões (taxa da casa)
   */
  async getCommissionReport(startDate?: string, endDate?: string) {
    let query = supabaseAdmin
      .from('bets')
      .select('platform_fee, settled_at, match_id')
      .eq('status', 'settled')
      .not('platform_fee', 'is', null);

    if (startDate) query = query.gte('settled_at', startDate);
    if (endDate) query = query.lte('settled_at', endDate);

    const { data, error } = await query;
    if (error) throw error;

    const total = data?.reduce((sum, b) => sum + Number(b.platform_fee || 0), 0) || 0;
    const count = data?.length || 0;

    // Agrupar por dia
    const byDay: Record<string, number> = {};
    for (const bet of data || []) {
      const day = bet.settled_at?.split('T')[0] || 'unknown';
      byDay[day] = (byDay[day] || 0) + Number(bet.platform_fee || 0);
    }

    return { total, count, byDay };
  }

  /**
   * Registrar bônus dado pelo admin
   */
  async registerAdminBonus(
    adminId: string,
    userId: string,
    amount: number,
    amountType: 'credits' | 'balance',
    description?: string
  ) {
    const { data, error } = await supabaseAdmin
      .from('bonus_records')
      .insert({
        user_id: userId,
        admin_id: adminId,
        bonus_type: amountType === 'credits' ? 'admin_credit' : 'admin_balance',
        amount,
        amount_type: amountType,
        description: description || 'Bônus dado pelo administrador',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Registrar bônus automático (boas-vindas, referral, etc.)
   */
  async registerAutoBonus(
    userId: string,
    bonusType: 'welcome' | 'referral' | 'coupon' | 'mission' | 'daily_free',
    amount: number,
    amountType: 'credits' | 'balance',
    referenceId?: string
  ) {
    const descriptions: Record<string, string> = {
      welcome: 'Bônus de boas-vindas',
      referral: 'Bônus de indicação',
      coupon: 'Desconto de cupom',
      mission: 'Recompensa de missão',
      daily_free: 'Crédito diário grátis',
    };

    const { data, error } = await supabaseAdmin
      .from('bonus_records')
      .insert({
        user_id: userId,
        bonus_type: bonusType,
        amount,
        amount_type: amountType,
        description: descriptions[bonusType],
        reference_id: referenceId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Registrar receita real
   */
  async registerRevenue(
    userId: string | null,
    revenueType: 'payment' | 'subscription' | 'credit_purchase' | 'bet_commission' | 'tournament_commission' | 'tournament_entry',
    amount: number,
    description?: string,
    referenceId?: string
  ) {
    const { data, error } = await supabaseAdmin
      .from('revenue_records')
      .insert({
        user_id: userId,
        revenue_type: revenueType,
        amount,
        description,
        reference_id: referenceId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Listar bônus dados (para relatório)
   */
  async listBonusRecords(params: {
    bonusType?: string;
    adminOnly?: boolean;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabaseAdmin
      .from('bonus_records')
      .select(`
        *,
        user:users!bonus_records_user_id_fkey(id, username, email),
        admin:users!bonus_records_admin_id_fkey(id, username)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (params.bonusType) query = query.eq('bonus_type', params.bonusType);
    if (params.adminOnly) query = query.not('admin_id', 'is', null);
    if (params.startDate) query = query.gte('created_at', params.startDate);
    if (params.endDate) query = query.lte('created_at', params.endDate);

    const limit = params.limit || 50;
    const offset = params.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return { records: data || [], total: count || 0 };
  }

  /**
   * Relatório de bônus por período
   */
  async getBonusReport(startDate?: string, endDate?: string) {
    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const end = endDate || new Date().toISOString();

    const { data: bonusRecords } = await supabaseAdmin
      .from('bonus_records')
      .select('*')
      .gte('created_at', start)
      .lte('created_at', end);

    // Totais por tipo
    const byType: Record<string, { count: number; total: number }> = {};
    const adminGiven = { credits: 0, balance: 0, count: 0 };

    bonusRecords?.forEach(b => {
      const type = b.bonus_type;
      if (!byType[type]) {
        byType[type] = { count: 0, total: 0 };
      }
      byType[type].count++;
      byType[type].total += Number(b.amount);

      // Separar bônus dados pelo admin
      if (b.admin_id) {
        adminGiven.count++;
        if (b.amount_type === 'credits') {
          adminGiven.credits += Number(b.amount);
        } else {
          adminGiven.balance += Number(b.amount);
        }
      }
    });

    // Totais gerais
    const totalCredits = bonusRecords?.filter(b => b.amount_type === 'credits')
      .reduce((sum, b) => sum + Number(b.amount), 0) || 0;
    const totalBalance = bonusRecords?.filter(b => b.amount_type === 'balance')
      .reduce((sum, b) => sum + Number(b.amount), 0) || 0;

    return {
      period: { start, end },
      totals: {
        credits: totalCredits,
        balance: totalBalance,
        count: bonusRecords?.length || 0,
      },
      byType,
      adminGiven,
    };
  }

  /**
   * RELATÓRIO FINANCEIRO COMPLETO
   * Receitas vs Gastos - Diário, Semanal, Mensal
   */
  async getFullFinancialReport(period: 'today' | 'week' | 'month' | 'custom' = 'month', startDate?: string, endDate?: string) {
    // Definir período
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'custom':
        start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        end = endDate ? new Date(endDate) : now;
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const startISO = start.toISOString();
    const endISO = end.toISOString();

    // ==================== RECEITAS ====================
    // 1. Pagamentos/Depósitos
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('status', 'paid')
      .gte('paid_at', startISO)
      .lte('paid_at', endISO);

    const revenuePayments = payments?.reduce((sum, p) => sum + Number(p.amount_brl || 0), 0) || 0;

    // 2. Comissões de Apostas (10% do pool)
    const { data: settledBets } = await supabaseAdmin
      .from('bets')
      .select('*')
      .eq('status', 'settled')
      .gte('settled_at', startISO)
      .lte('settled_at', endISO);

    const revenueBetCommissions = settledBets?.reduce((sum, b) => sum + Number(b.platform_fee || 0), 0) || 0;

    // 3. Assinaturas VIP
    const { data: subscriptions } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    const revenueSubscriptions = subscriptions?.reduce((sum, s) => sum + Number(s.price || 0), 0) || 0;

    // 4. Inscrições em Torneios
    const { data: tournamentEntries } = await supabaseAdmin
      .from('tournament_participants')
      .select('entry_fee, created_at')
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    const revenueTournaments = tournamentEntries?.reduce((sum, t) => sum + Number(t.entry_fee || 0) * 0.1, 0) || 0;

    // ==================== GASTOS (SAÍDAS) ====================
    // 1. Saques Pagos
    const { data: completedWithdrawals } = await supabaseAdmin
      .from('withdrawals')
      .select('*')
      .eq('status', 'completed')
      .gte('processed_at', startISO)
      .lte('processed_at', endISO);

    const expenseWithdrawals = completedWithdrawals?.reduce((sum, w) => sum + Number(w.amount || 0), 0) || 0;

    // 2. Bônus Dados (todos os tipos)
    const { data: bonusRecords } = await supabaseAdmin
      .from('bonus_records')
      .select('*')
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    // Separar bônus por tipo
    const bonusByType = {
      admin_credit: { count: 0, credits: 0, balance: 0 },
      admin_balance: { count: 0, credits: 0, balance: 0 },
      daily_free: { count: 0, credits: 0, balance: 0 },
      welcome: { count: 0, credits: 0, balance: 0 },
      referral: { count: 0, credits: 0, balance: 0 },
      coupon: { count: 0, credits: 0, balance: 0 },
      mission: { count: 0, credits: 0, balance: 0 },
    };

    let totalBonusCredits = 0;
    let totalBonusBalance = 0;

    bonusRecords?.forEach(b => {
      const type = b.bonus_type as keyof typeof bonusByType;
      if (bonusByType[type]) {
        bonusByType[type].count++;
        if (b.amount_type === 'credits') {
          bonusByType[type].credits += Number(b.amount);
          totalBonusCredits += Number(b.amount);
        } else {
          bonusByType[type].balance += Number(b.amount);
          totalBonusBalance += Number(b.amount);
        }
      }
    });

    // Valor estimado dos créditos dados (R$ 0,50 cada)
    const bonusCreditsValue = totalBonusCredits * 0.5;

    // 3. Prêmios de Apostas Pagos aos Vencedores
    const expenseBetPrizes = settledBets?.reduce((sum, b) => {
      const pool = Number(b.total_pool || 0);
      const fee = Number(b.platform_fee || 0);
      return sum + (pool - fee); // 90% vai pro vencedor
    }, 0) || 0;

    // ==================== CÁLCULOS FINAIS ====================
    const totalRevenue = revenuePayments + revenueBetCommissions + revenueSubscriptions + revenueTournaments;
    const totalExpenses = expenseWithdrawals + totalBonusBalance + bonusCreditsValue;
    const netProfit = totalRevenue - totalExpenses;

    // ==================== DETALHAMENTO POR DIA ====================
    const dailyBreakdown: Record<string, { revenue: number; expenses: number; net: number }> = {};

    // Agrupar pagamentos por dia
    payments?.forEach(p => {
      const day = p.paid_at?.split('T')[0];
      if (day) {
        if (!dailyBreakdown[day]) dailyBreakdown[day] = { revenue: 0, expenses: 0, net: 0 };
        dailyBreakdown[day].revenue += Number(p.amount_brl || 0);
      }
    });

    // Agrupar comissões por dia
    settledBets?.forEach(b => {
      const day = b.settled_at?.split('T')[0];
      if (day) {
        if (!dailyBreakdown[day]) dailyBreakdown[day] = { revenue: 0, expenses: 0, net: 0 };
        dailyBreakdown[day].revenue += Number(b.platform_fee || 0);
      }
    });

    // Agrupar saques por dia
    completedWithdrawals?.forEach(w => {
      const day = w.processed_at?.split('T')[0];
      if (day) {
        if (!dailyBreakdown[day]) dailyBreakdown[day] = { revenue: 0, expenses: 0, net: 0 };
        dailyBreakdown[day].expenses += Number(w.amount || 0);
      }
    });

    // Agrupar bônus por dia
    bonusRecords?.forEach(b => {
      const day = b.created_at?.split('T')[0];
      if (day) {
        if (!dailyBreakdown[day]) dailyBreakdown[day] = { revenue: 0, expenses: 0, net: 0 };
        if (b.amount_type === 'balance') {
          dailyBreakdown[day].expenses += Number(b.amount || 0);
        } else {
          dailyBreakdown[day].expenses += Number(b.amount || 0) * 0.5; // Créditos = R$ 0,50
        }
      }
    });

    // Calcular net por dia
    Object.keys(dailyBreakdown).forEach(day => {
      dailyBreakdown[day].net = dailyBreakdown[day].revenue - dailyBreakdown[day].expenses;
    });

    return {
      period: {
        type: period,
        start: startISO,
        end: endISO,
        label: period === 'today' ? 'Hoje' : period === 'week' ? 'Últimos 7 dias' : period === 'month' ? 'Este mês' : 'Personalizado',
      },
      revenue: {
        total: totalRevenue,
        breakdown: {
          payments: { amount: revenuePayments, count: payments?.length || 0, label: 'Depósitos/Pagamentos' },
          betCommissions: { amount: revenueBetCommissions, count: settledBets?.length || 0, label: 'Comissões de Apostas (10%)' },
          subscriptions: { amount: revenueSubscriptions, count: subscriptions?.length || 0, label: 'Assinaturas VIP' },
          tournaments: { amount: revenueTournaments, count: tournamentEntries?.length || 0, label: 'Comissões de Torneios' },
        },
      },
      expenses: {
        total: totalExpenses,
        breakdown: {
          withdrawals: { amount: expenseWithdrawals, count: completedWithdrawals?.length || 0, label: 'Saques Pagos' },
          bonusBalance: { amount: totalBonusBalance, count: bonusRecords?.filter(b => b.amount_type === 'balance').length || 0, label: 'Bônus em Saldo (R$)' },
          bonusCredits: { amount: bonusCreditsValue, count: totalBonusCredits, label: 'Bônus em Créditos (estimado)' },
        },
        bonusDetails: bonusByType,
      },
      summary: {
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMargin: totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0',
      },
      dailyBreakdown,
      // Listas detalhadas
      lists: {
        payments: payments || [],
        withdrawals: completedWithdrawals || [],
        bonuses: bonusRecords || [],
        bets: settledBets || [],
      },
    };
  }

  /**
   * Relatório de Saques Detalhado
   */
  async getWithdrawalsReport(period: 'today' | 'week' | 'month' = 'month') {
    const now = new Date();
    let start: Date;

    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const { data: withdrawals } = await supabaseAdmin
      .from('withdrawals')
      .select(`
        *,
        user:users!withdrawals_user_id_fkey(id, username, email)
      `)
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false });

    const pending = withdrawals?.filter(w => w.status === 'pending') || [];
    const completed = withdrawals?.filter(w => w.status === 'completed') || [];
    const rejected = withdrawals?.filter(w => w.status === 'rejected') || [];

    return {
      period,
      summary: {
        total: withdrawals?.length || 0,
        pending: { count: pending.length, amount: pending.reduce((s, w) => s + Number(w.amount), 0) },
        completed: { count: completed.length, amount: completed.reduce((s, w) => s + Number(w.amount), 0) },
        rejected: { count: rejected.length, amount: rejected.reduce((s, w) => s + Number(w.amount), 0) },
      },
      list: withdrawals || [],
    };
  }

  /**
   * Relatório de Bônus Detalhado
   */
  async getBonusDetailedReport(period: 'today' | 'week' | 'month' = 'month') {
    const now = new Date();
    let start: Date;

    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const { data: bonuses } = await supabaseAdmin
      .from('bonus_records')
      .select(`
        *,
        user:users!bonus_records_user_id_fkey(id, username, email),
        admin:users!bonus_records_admin_id_fkey(id, username)
      `)
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false });

    // Agrupar por tipo
    const byType: Record<string, { count: number; credits: number; balance: number; items: any[] }> = {};

    bonuses?.forEach(b => {
      const type = b.bonus_type;
      if (!byType[type]) {
        byType[type] = { count: 0, credits: 0, balance: 0, items: [] };
      }
      byType[type].count++;
      byType[type].items.push(b);
      if (b.amount_type === 'credits') {
        byType[type].credits += Number(b.amount);
      } else {
        byType[type].balance += Number(b.amount);
      }
    });

    const totalCredits = bonuses?.filter(b => b.amount_type === 'credits').reduce((s, b) => s + Number(b.amount), 0) || 0;
    const totalBalance = bonuses?.filter(b => b.amount_type === 'balance').reduce((s, b) => s + Number(b.amount), 0) || 0;

    return {
      period,
      summary: {
        total: bonuses?.length || 0,
        totalCredits,
        totalBalance,
        estimatedCost: totalBalance + (totalCredits * 0.5),
      },
      byType,
      list: bonuses || [],
    };
  }
}

export const financeAdminService = new FinanceAdminService();
