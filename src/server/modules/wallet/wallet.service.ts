import { supabaseAdmin } from '../../services/supabase.js';
import type { Wallet, Transaction } from '../../../shared/types/index.js';

export interface WalletWithSegregation extends Wallet {
  deposit_balance?: number;
  winnings_balance?: number;
  bonus_balance?: number;
}

export const walletService = {
  // Buscar carteira do usuário (com saldos segregados)
  async getByUserId(userId: string): Promise<WalletWithSegregation | null> {
    const { data } = await supabaseAdmin
      .from('wallet')
      .select('*')
      .eq('user_id', userId)
      .single();

    return data as WalletWithSegregation | null;
  },

  // Obter saldo disponível para saque (apenas winnings + bonus)
  async getWithdrawableBalance(userId: string): Promise<number> {
    const { data } = await supabaseAdmin.rpc('get_withdrawable_balance', { p_user_id: userId });
    return data || 0;
  },

  // Adicionar saldo (depósito)
  async addBalance(userId: string, amount: number, description: string, referenceId?: string): Promise<{ wallet: Wallet | null; error: string | null }> {
    const wallet = await this.getByUserId(userId);

    if (!wallet) {
      return { wallet: null, error: 'Carteira não encontrada' };
    }

    if (wallet.is_blocked) {
      return { wallet: null, error: 'Carteira bloqueada' };
    }

    const newBalance = Number(wallet.balance) + amount;

    // Atualizar saldo
    const { data, error } = await supabaseAdmin
      .from('wallet')
      .update({ balance: newBalance })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { wallet: null, error: error.message };
    }

    // Registrar transação
    await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      type: 'deposit',
      amount,
      balance_after: newBalance,
      reference_id: referenceId,
      description,
    });

    return { wallet: data as Wallet, error: null };
  },

  // Remover saldo (saque ou aposta)
  async removeBalance(userId: string, amount: number, type: 'withdrawal' | 'bet_loss', description: string, referenceId?: string): Promise<{ wallet: Wallet | null; error: string | null }> {
    const wallet = await this.getByUserId(userId);

    if (!wallet) {
      return { wallet: null, error: 'Carteira não encontrada' };
    }

    if (wallet.is_blocked) {
      return { wallet: null, error: 'Carteira bloqueada' };
    }

    if (Number(wallet.balance) < amount) {
      return { wallet: null, error: 'Saldo insuficiente' };
    }

    const newBalance = Number(wallet.balance) - amount;

    const { data, error } = await supabaseAdmin
      .from('wallet')
      .update({ balance: newBalance })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { wallet: null, error: error.message };
    }

    await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      type,
      amount: -amount,
      balance_after: newBalance,
      reference_id: referenceId,
      description,
    });

    return { wallet: data as Wallet, error: null };
  },

  // Debitar saldo para aposta (usa deposit_balance e winnings_balance, NÃO bonus)
  // Ordem de débito: deposit_balance → winnings_balance
  async debitForBet(userId: string, amount: number, description: string, referenceId?: string): Promise<{ wallet: Wallet | null; error: string | null }> {
    const wallet = await this.getByUserId(userId);

    if (!wallet) {
      return { wallet: null, error: 'Carteira não encontrada' };
    }

    if (wallet.is_blocked) {
      return { wallet: null, error: 'Carteira bloqueada' };
    }

    // Saldo disponível para aposta = deposit + winnings (NÃO bonus)
    const depositBalance = Number(wallet.deposit_balance || 0);
    const winningsBalance = Number(wallet.winnings_balance || 0);
    const availableForBet = depositBalance + winningsBalance;

    if (availableForBet < amount) {
      return { wallet: null, error: `Saldo insuficiente para aposta. Disponível: R$ ${availableForBet.toFixed(2)}. Bônus não pode ser usado em apostas.` };
    }

    // Calcular quanto debitar de cada saldo
    let remaining = amount;
    let fromDeposit = 0;
    let fromWinnings = 0;

    // Primeiro debita de deposit_balance
    if (remaining > 0 && depositBalance > 0) {
      fromDeposit = Math.min(remaining, depositBalance);
      remaining -= fromDeposit;
    }

    // Depois debita de winnings_balance
    if (remaining > 0 && winningsBalance > 0) {
      fromWinnings = Math.min(remaining, winningsBalance);
      remaining -= fromWinnings;
    }

    // Atualizar saldos
    const newBalance = Number(wallet.balance) - amount;
    const newDepositBalance = depositBalance - fromDeposit;
    const newWinningsBalance = winningsBalance - fromWinnings;

    const { data, error } = await supabaseAdmin
      .from('wallet')
      .update({ 
        balance: newBalance,
        deposit_balance: newDepositBalance,
        winnings_balance: newWinningsBalance,
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { wallet: null, error: error.message };
    }

    await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      type: 'bet_loss',
      amount: -amount,
      balance_after: newBalance,
      balance_type: 'bet',
      reference_id: referenceId,
      description,
    });

    return { wallet: data as Wallet, error: null };
  },

  // Obter saldo disponível para apostas (deposit + winnings, NÃO bonus)
  async getAvailableForBet(userId: string): Promise<number> {
    const wallet = await this.getByUserId(userId);
    if (!wallet) return 0;
    
    const depositBalance = Number(wallet.deposit_balance || 0);
    const winningsBalance = Number(wallet.winnings_balance || 0);
    return depositBalance + winningsBalance;
  },

  // Debitar saldo (compra de créditos, uso de crédito pago)
  async debitBalance(userId: string, amount: number, description: string): Promise<{ wallet: Wallet | null; error: string | null }> {
    const wallet = await this.getByUserId(userId);

    if (!wallet) {
      return { wallet: null, error: 'Carteira não encontrada' };
    }

    if (wallet.is_blocked) {
      return { wallet: null, error: 'Carteira bloqueada' };
    }

    if (Number(wallet.balance) < amount) {
      return { wallet: null, error: 'Saldo insuficiente' };
    }

    const newBalance = Number(wallet.balance) - amount;

    const { data, error } = await supabaseAdmin
      .from('wallet')
      .update({ balance: newBalance })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { wallet: null, error: error.message };
    }

    await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      type: 'credit_purchase',
      amount: -amount,
      balance_after: newBalance,
      description,
    });

    return { wallet: data as Wallet, error: null };
  },

  // Debitar saldo para compra de créditos (NÃO usa bonus_balance)
  // Ordem de débito: deposit_balance → winnings_balance
  async debitForPurchase(userId: string, amount: number, description: string): Promise<{ wallet: Wallet | null; error: string | null }> {
    const wallet = await this.getByUserId(userId);

    if (!wallet) {
      return { wallet: null, error: 'Carteira não encontrada' };
    }

    if (wallet.is_blocked) {
      return { wallet: null, error: 'Carteira bloqueada' };
    }

    // Saldo disponível para compra = deposit + winnings (NÃO bonus)
    const depositBalance = Number(wallet.deposit_balance || 0);
    const winningsBalance = Number(wallet.winnings_balance || 0);
    const availableForPurchase = depositBalance + winningsBalance;

    if (availableForPurchase < amount) {
      return { wallet: null, error: `Saldo insuficiente. Disponível: R$ ${availableForPurchase.toFixed(2)}` };
    }

    // Calcular quanto debitar de cada saldo
    let remaining = amount;
    let fromDeposit = 0;
    let fromWinnings = 0;

    // Primeiro debita de deposit_balance
    if (remaining > 0 && depositBalance > 0) {
      fromDeposit = Math.min(remaining, depositBalance);
      remaining -= fromDeposit;
    }

    // Depois debita de winnings_balance
    if (remaining > 0 && winningsBalance > 0) {
      fromWinnings = Math.min(remaining, winningsBalance);
      remaining -= fromWinnings;
    }

    // Atualizar saldos
    const newBalance = Number(wallet.balance) - amount;
    const newDepositBalance = depositBalance - fromDeposit;
    const newWinningsBalance = winningsBalance - fromWinnings;

    const { data, error } = await supabaseAdmin
      .from('wallet')
      .update({ 
        balance: newBalance,
        deposit_balance: newDepositBalance,
        winnings_balance: newWinningsBalance,
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { wallet: null, error: error.message };
    }

    await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      type: 'credit_purchase',
      amount: -amount,
      balance_after: newBalance,
      balance_type: 'purchase',
      description,
    });

    return { wallet: data as Wallet, error: null };
  },

  // Buscar histórico de transações
  async getTransactions(userId: string, limit = 20, offset = 0) {
    const { data, count } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return { transactions: data || [], total: count || 0 };
  },

  // Bloquear/desbloquear carteira (admin)
  async setBlocked(userId: string, blocked: boolean): Promise<{ error: string | null }> {
    const { error } = await supabaseAdmin
      .from('wallet')
      .update({ is_blocked: blocked })
      .eq('user_id', userId);

    return { error: error?.message || null };
  },

  // Ajuste administrativo
  async adminAdjust(userId: string, amount: number, description: string, adminId: string, balanceType: 'deposit' | 'winnings' | 'bonus' = 'bonus'): Promise<{ wallet: Wallet | null; error: string | null }> {
    const wallet = await this.getByUserId(userId);

    if (!wallet) {
      return { wallet: null, error: 'Carteira não encontrada' };
    }

    const newBalance = Math.max(0, Number(wallet.balance) + amount);

    const { data, error } = await supabaseAdmin
      .from('wallet')
      .update({ balance: newBalance })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { wallet: null, error: error.message };
    }

    // Registrar transação
    await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      type: 'admin_adjustment',
      amount,
      balance_after: newBalance,
      description: `[ADMIN] ${description}`,
    });

    // Log de auditoria
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminId,
      action: 'wallet_adjustment',
      target_type: 'wallet',
      target_id: wallet.id,
      details: { amount, description, new_balance: newBalance, balance_type: balanceType },
    });

    // Registrar como bônus se for adição (amount > 0) e tipo for bonus
    if (amount > 0 && balanceType === 'bonus') {
      await supabaseAdmin.from('bonus_records').insert({
        user_id: userId,
        admin_id: adminId,
        bonus_type: 'admin_balance',
        amount: amount,
        amount_type: 'balance',
        description: description || 'Saldo de bônus adicionado pelo administrador',
      });
    }

    return { wallet: data as Wallet, error: null };
  },
};
