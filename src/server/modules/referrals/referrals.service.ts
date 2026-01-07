// =====================================================
// SERVIÇO DE INDICAÇÕES (INDIQUE E GANHE)
// =====================================================

import { supabaseAdmin } from '../../services/supabase.js';

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  status: 'pending' | 'qualified' | 'rewarded';
  reward_credits: number;
  qualified_at?: string;
  rewarded_at?: string;
  created_at: string;
  referred?: {
    username: string;
    avatar_url?: string;
    created_at: string;
  };
}

export interface ReferralStats {
  total_referrals: number;
  pending_referrals: number;
  qualified_referrals: number;
  total_earnings: number;
  referral_code: string;
}

class ReferralsService {
  // Obter código de referência do usuário
  async getReferralCode(userId: string): Promise<string | null> {
    const { data } = await supabaseAdmin
      .from('users')
      .select('referral_code')
      .eq('id', userId)
      .single();

    return data?.referral_code || null;
  }

  // Gerar código se não existir
  async ensureReferralCode(userId: string): Promise<string> {
    let code = await this.getReferralCode(userId);
    
    if (!code) {
      // Gerar código único
      code = this.generateCode();
      
      const { error } = await supabaseAdmin
        .from('users')
        .update({ referral_code: code })
        .eq('id', userId);

      if (error) {
        // Se der conflito, tentar novamente
        code = this.generateCode();
        await supabaseAdmin
          .from('users')
          .update({ referral_code: code })
          .eq('id', userId);
      }
    }

    return code;
  }

  // Gerar código aleatório
  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Buscar usuário por código de referência
  async getUserByReferralCode(code: string): Promise<{ id: string; username: string } | null> {
    const { data } = await supabaseAdmin
      .from('users')
      .select('id, username')
      .eq('referral_code', code.toUpperCase())
      .single();

    return data;
  }

  // Registrar indicação (quando novo usuário se cadastra com código)
  async registerReferral(referrerId: string, referredId: string): Promise<{ success: boolean; error?: string }> {
    // Verificar se o usuário já foi indicado
    const { data: existing } = await supabaseAdmin
      .from('referrals')
      .select('id')
      .eq('referred_id', referredId)
      .single();

    if (existing) {
      return { success: false, error: 'Usuário já foi indicado por outra pessoa' };
    }

    // Verificar se não está tentando se auto-indicar
    if (referrerId === referredId) {
      return { success: false, error: 'Não é possível se auto-indicar' };
    }

    // Buscar configuração de recompensa
    const { data: settings } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'referral_reward_credits')
      .single();

    const rewardCredits = settings?.value ? Number(settings.value) : 2;

    // Criar indicação
    const { error } = await supabaseAdmin
      .from('referrals')
      .insert({
        referrer_id: referrerId,
        referred_id: referredId,
        reward_credits: rewardCredits,
        status: 'pending',
      });

    if (error) {
      return { success: false, error: error.message };
    }

    // Atualizar referred_by no usuário
    await supabaseAdmin
      .from('users')
      .update({ referred_by: referrerId })
      .eq('id', referredId);

    // Incrementar contador de indicações
    await supabaseAdmin.rpc('increment_referral_count', { user_id: referrerId });

    return { success: true };
  }

  // Obter estatísticas de indicação do usuário
  async getStats(userId: string): Promise<ReferralStats> {
    const [userRes, referralsRes] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('referral_code, referral_count, referral_earnings')
        .eq('id', userId)
        .single(),
      supabaseAdmin
        .from('referrals')
        .select('status')
        .eq('referrer_id', userId),
    ]);

    const user = userRes.data;
    const referrals = referralsRes.data || [];

    const pending = referrals.filter(r => r.status === 'pending').length;
    const qualified = referrals.filter(r => r.status === 'rewarded').length;

    return {
      total_referrals: user?.referral_count || referrals.length,
      pending_referrals: pending,
      qualified_referrals: qualified,
      total_earnings: user?.referral_earnings || 0,
      referral_code: user?.referral_code || '',
    };
  }

  // Listar indicações do usuário
  async listReferrals(userId: string): Promise<Referral[]> {
    const { data } = await supabaseAdmin
      .from('referrals')
      .select(`
        *,
        referred:referred_id(username, avatar_url, created_at)
      `)
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false });

    return data || [];
  }

  // Obter mensagem de compartilhamento
  async getShareMessage(): Promise<string> {
    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'referral_share_message')
      .single();

    return data?.value || '🎱 Venha jogar Sinuca Online comigo! Cadastre-se pelo meu link e ganhe créditos grátis para jogar. 🏆';
  }

  // Verificar se indicações estão habilitadas
  async isEnabled(): Promise<boolean> {
    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'referral_enabled')
      .single();

    return data?.value === 'true' || data?.value === true;
  }

  // Processar recompensa manualmente (caso o trigger falhe)
  async processReward(referralId: string): Promise<{ success: boolean; error?: string }> {
    const { data: referral } = await supabaseAdmin
      .from('referrals')
      .select('*')
      .eq('id', referralId)
      .single();

    if (!referral) {
      return { success: false, error: 'Indicação não encontrada' };
    }

    if (referral.status === 'rewarded') {
      return { success: false, error: 'Recompensa já foi creditada' };
    }

    // Creditar recompensa
    await supabaseAdmin
      .from('credits')
      .update({ 
        amount: supabaseAdmin.rpc('increment_credits', { 
          p_user_id: referral.referrer_id, 
          p_amount: referral.reward_credits 
        })
      })
      .eq('user_id', referral.referrer_id);

    // Registrar bônus de indicação
    await supabaseAdmin.from('bonus_records').insert({
      user_id: referral.referrer_id,
      bonus_type: 'referral',
      amount: referral.reward_credits,
      amount_type: 'credits',
      description: 'Bônus de indicação',
      reference_id: referralId,
    });

    // Atualizar status
    await supabaseAdmin
      .from('referrals')
      .update({ 
        status: 'rewarded', 
        rewarded_at: new Date().toISOString() 
      })
      .eq('id', referralId);

    // Atualizar earnings do usuário
    await supabaseAdmin
      .from('users')
      .update({ 
        referral_earnings: supabaseAdmin.rpc('increment_referral_earnings', {
          user_id: referral.referrer_id,
          amount: referral.reward_credits
        })
      })
      .eq('id', referral.referrer_id);

    return { success: true };
  }
}

export const referralsService = new ReferralsService();
