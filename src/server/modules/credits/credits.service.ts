import { supabaseAdmin } from '../../services/supabase.js';
import { CREDITS_PER_PURCHASE, PURCHASE_PRICE_BRL, CREDITS_PER_MATCH, CREDIT_VALUE_BRL } from '../../../shared/constants/index.js';
import { walletService } from '../wallet/wallet.service.js';
import type { Credits } from '../../../shared/types/index.js';

export const creditsService = {
  // Buscar créditos do usuário
  async getByUserId(userId: string): Promise<Credits | null> {
    const { data } = await supabaseAdmin
      .from('credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    return data as Credits | null;
  },

  // Verificar e dar crédito diário grátis
  async checkDailyFreeCredit(userId: string): Promise<{ credited: boolean; message?: string }> {
    const credits = await this.getByUserId(userId);
    if (!credits) return { credited: false };

    // Se já é ilimitado, não precisa
    if (credits.is_unlimited) return { credited: false };

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastFree = credits.last_free_credit ? new Date(credits.last_free_credit).toISOString().split('T')[0] : null;

    // Se já recebeu hoje, não dá mais
    if (lastFree === today) {
      return { credited: false, message: 'Você já recebeu seu crédito grátis hoje' };
    }

    // Dar 1 crédito grátis (não debita da carteira - é cortesia)
    await supabaseAdmin
      .from('credits')
      .update({ 
        amount: credits.amount + 1,
        last_free_credit: new Date().toISOString()
      })
      .eq('user_id', userId);

    // Registrar como bônus
    await supabaseAdmin.from('bonus_records').insert({
      user_id: userId,
      bonus_type: 'daily_free',
      amount: 1,
      amount_type: 'credits',
      description: 'Crédito diário grátis',
    });

    return { credited: true, message: 'Você recebeu 1 crédito grátis!' };
  },

  // Verificar se tem créditos suficientes
  async hasEnough(userId: string, amount: number = CREDITS_PER_MATCH): Promise<boolean> {
    const credits = await this.getByUserId(userId);

    if (!credits) return false;
    if (credits.is_unlimited) return true;

    return credits.amount >= amount;
  },

  // Comprar créditos (debita da carteira do usuário)
  // IMPORTANTE: Usa apenas deposit_balance e winnings_balance (NÃO usa bonus_balance)
  async purchaseCredits(userId: string, quantity: number): Promise<{ credits: Credits | null; error: string | null }> {
    // Quantidade mínima é 4 créditos
    if (quantity < CREDITS_PER_PURCHASE) {
      return { credits: null, error: `Quantidade mínima é ${CREDITS_PER_PURCHASE} créditos` };
    }

    const totalCost = quantity * CREDIT_VALUE_BRL;

    // Verificar saldo do usuário (apenas deposit + winnings, NÃO bonus)
    const wallet = await walletService.getByUserId(userId);
    if (!wallet) {
      return { credits: null, error: 'Carteira não encontrada' };
    }

    // Saldo disponível para compra = deposit_balance + winnings_balance
    const availableForPurchase = (wallet.deposit_balance || 0) + (wallet.winnings_balance || 0);
    
    if (availableForPurchase < totalCost) {
      return { credits: null, error: `Saldo insuficiente. Disponível: R$ ${availableForPurchase.toFixed(2)}, Necessário: R$ ${totalCost.toFixed(2)}. Bônus não pode ser usado para comprar créditos.` };
    }

    // Debitar da carteira do usuário (usando função que debita de deposit/winnings)
    const debitResult = await walletService.debitForPurchase(userId, totalCost, `Compra de ${quantity} créditos`);
    if (debitResult.error) {
      return { credits: null, error: debitResult.error };
    }

    // Creditar na carteira do admin (receita da plataforma)
    await this.creditAdminRevenue(totalCost, userId, `Venda de ${quantity} créditos`);

    // Adicionar créditos ao usuário
    return this.addCredits(userId, quantity);
  },

  // Usar crédito (para partida) - debita crédito E valor da carteira se não for grátis
  async useCredit(userId: string, isFreeCredit: boolean = false): Promise<{ success: boolean; error: string | null }> {
    const credits = await this.getByUserId(userId);

    if (!credits) {
      return { success: false, error: 'Registro de créditos não encontrado' };
    }

    // Se é ilimitado (VIP), não debita nada
    if (credits.is_unlimited) {
      return { success: true, error: null };
    }

    // Verificar se tem créditos
    if (credits.amount < 1) {
      return { success: false, error: 'Créditos insuficientes' };
    }

    // Debitar 1 crédito
    await supabaseAdmin
      .from('credits')
      .update({ amount: credits.amount - 1 })
      .eq('user_id', userId);

    // Se NÃO é crédito grátis, debita R$ 0,50 da carteira e credita ao admin
    if (!isFreeCredit) {
      const wallet = await walletService.getByUserId(userId);
      if (wallet && Number(wallet.balance) >= CREDIT_VALUE_BRL) {
        await walletService.debitBalance(userId, CREDIT_VALUE_BRL, 'Uso de 1 crédito em partida');
        await this.creditAdminRevenue(CREDIT_VALUE_BRL, userId, 'Receita de crédito usado em partida');
      }
    }

    return { success: true, error: null };
  },

  // Creditar receita na carteira do admin
  async creditAdminRevenue(amount: number, fromUserId: string, description: string): Promise<void> {
    // Buscar admin (primeiro usuário com role admin)
    const { data: admin } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1)
      .single();

    if (admin) {
      await walletService.addBalance(admin.id, amount, `${description} (de usuário ${fromUserId})`);
    }
  },

  // Adicionar créditos (após compra)
  async addCredits(userId: string, amount: number): Promise<{ credits: Credits | null; error: string | null }> {
    const credits = await this.getByUserId(userId);

    if (!credits) {
      return { credits: null, error: 'Registro de créditos não encontrado' };
    }

    const newAmount = credits.amount + amount;

    const { data, error } = await supabaseAdmin
      .from('credits')
      .update({ amount: newAmount })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { credits: null, error: error.message };
    }

    return { credits: data as Credits, error: null };
  },

  // Debitar créditos (ao iniciar partida) - normalmente feito via trigger
  async debitCredits(userId: string, amount: number = CREDITS_PER_MATCH): Promise<{ credits: Credits | null; error: string | null }> {
    const credits = await this.getByUserId(userId);

    if (!credits) {
      return { credits: null, error: 'Registro de créditos não encontrado' };
    }

    if (!credits.is_unlimited && credits.amount < amount) {
      return { credits: null, error: 'Créditos insuficientes' };
    }

    // Se é ilimitado, não debita
    if (credits.is_unlimited) {
      return { credits, error: null };
    }

    const newAmount = credits.amount - amount;

    const { data, error } = await supabaseAdmin
      .from('credits')
      .update({ amount: newAmount })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { credits: null, error: error.message };
    }

    return { credits: data as Credits, error: null };
  },

  // Definir créditos ilimitados (assinante VIP)
  async setUnlimited(userId: string, unlimited: boolean): Promise<{ error: string | null }> {
    const { error } = await supabaseAdmin
      .from('credits')
      .update({ is_unlimited: unlimited })
      .eq('user_id', userId);

    return { error: error?.message || null };
  },

  // Calcular quantidade de créditos por valor
  calculateCredits(amountBRL: number): number {
    return Math.floor(amountBRL / CREDIT_VALUE_BRL);
  },

  // Ajuste administrativo
  async adminAdjust(userId: string, amount: number, adminId: string): Promise<{ credits: Credits | null; error: string | null }> {
    const credits = await this.getByUserId(userId);

    if (!credits) {
      return { credits: null, error: 'Registro de créditos não encontrado' };
    }

    const newAmount = Math.max(0, credits.amount + amount);

    const { data, error } = await supabaseAdmin
      .from('credits')
      .update({ amount: newAmount })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { credits: null, error: error.message };
    }

    // Log de auditoria
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminId,
      action: 'credits_adjustment',
      target_type: 'credits',
      target_id: credits.id,
      details: { amount, new_amount: newAmount },
    });

    // Registrar como bônus se for adição (amount > 0)
    if (amount > 0) {
      await supabaseAdmin.from('bonus_records').insert({
        user_id: userId,
        admin_id: adminId,
        bonus_type: 'admin_credit',
        amount: amount,
        amount_type: 'credits',
        description: 'Créditos adicionados pelo administrador',
      });
    }

    return { credits: data as Credits, error: null };
  },

  // Histórico de créditos do usuário
  async getUserCreditsHistory(userId: string, limit = 50, offset = 0) {
    // Buscar registros de bônus de créditos
    const { data: bonusRecords, count: bonusCount } = await supabaseAdmin
      .from('bonus_records')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('amount_type', 'credits')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Buscar uso de créditos (partidas jogadas)
    const { data: matches } = await supabaseAdmin
      .from('matches')
      .select('id, created_at, mode, status, winner_id')
      .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
      .in('status', ['playing', 'finished'])
      .order('created_at', { ascending: false })
      .limit(limit);

    // Combinar e ordenar
    const history: any[] = [];

    // Adicionar bônus recebidos
    bonusRecords?.forEach(b => {
      const typeLabels: Record<string, string> = {
        daily_free: '🎁 Crédito Diário Grátis',
        admin_credit: '🎫 Créditos do Admin',
        welcome: '👋 Bônus de Boas-vindas',
        referral: '🤝 Bônus de Indicação',
        coupon: '🎟️ Cupom de Desconto',
        mission: '🎯 Recompensa de Missão',
      };

      history.push({
        id: b.id,
        type: 'credit_received',
        amount: b.amount,
        description: typeLabels[b.bonus_type] || b.description || 'Créditos recebidos',
        bonus_type: b.bonus_type,
        created_at: b.created_at,
      });
    });

    // Adicionar uso de créditos (partidas)
    matches?.forEach(m => {
      if (m.mode !== 'ai') { // Modo AI já debita no início
        history.push({
          id: m.id,
          type: 'credit_used',
          amount: -1,
          description: `🎮 Partida ${m.status === 'finished' ? 'finalizada' : 'em andamento'}`,
          match_id: m.id,
          created_at: m.created_at,
        });
      }
    });

    // Ordenar por data
    history.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Calcular totais
    const totalReceived = bonusRecords?.reduce((sum, b) => sum + Number(b.amount), 0) || 0;
    const totalUsed = matches?.length || 0;

    return {
      history: history.slice(0, limit),
      total: (bonusCount || 0) + (matches?.length || 0),
      summary: {
        total_received: totalReceived,
        total_used: totalUsed,
        net: totalReceived - totalUsed,
      },
    };
  },
};
