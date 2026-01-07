import { supabaseAdmin } from '../../services/supabase.js';
import { notificationsService } from '../notifications/notifications.service.js';

interface Subscription {
  id: string;
  user_id: string;
  plan: 'monthly' | 'yearly';
  status: 'active' | 'cancelled' | 'expired';
  starts_at: string;
  ends_at: string;
  auto_renew: boolean;
  created_at: string;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  features: string[];
}

const PLANS: Record<string, Plan> = {
  monthly: {
    id: 'monthly',
    name: 'VIP Mensal',
    price: 19.90,
    duration_days: 30,
    features: ['Créditos ilimitados', 'Criar torneios', 'Selo VIP', 'Sem anúncios', 'Suporte prioritário'],
  },
  yearly: {
    id: 'yearly',
    name: 'VIP Anual',
    price: 149.90,
    duration_days: 365,
    features: ['Créditos ilimitados', 'Criar torneios', 'Selo VIP', 'Sem anúncios', 'Suporte prioritário', '2 meses grátis', 'Troféu exclusivo'],
  },
};

class SubscriptionsService {
  // Obter planos disponíveis
  getPlans(): Plan[] {
    return Object.values(PLANS);
  }

  // Obter assinatura ativa do usuário
  async getActive(userId: string): Promise<Subscription | null> {
    const { data } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .gt('ends_at', new Date().toISOString())
      .single();

    return data;
  }

  // Verificar se usuário é assinante
  async isSubscriber(userId: string): Promise<boolean> {
    const subscription = await this.getActive(userId);
    return !!subscription;
  }

  // Criar assinatura
  async create(userId: string, planId: string, paymentId?: string): Promise<{ subscription?: Subscription; error?: string }> {
    const plan = PLANS[planId];
    if (!plan) {
      return { error: 'Plano não encontrado' };
    }

    // Verificar se já tem assinatura ativa
    const existing = await this.getActive(userId);
    if (existing) {
      return { error: 'Você já possui uma assinatura ativa' };
    }

    const startsAt = new Date();
    
    // Calcular data de expiração à meia-noite
    const endsAt = new Date(startsAt.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);
    // Ajustar para meia-noite (00:00:00) do dia de expiração
    endsAt.setHours(23, 59, 59, 999);

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan: planId,
        status: 'active',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        auto_renew: true,
        payment_id: paymentId,
      })
      .select()
      .single();

    if (error) {
      return { error: 'Erro ao criar assinatura' };
    }

    // Atualizar créditos para ilimitado
    await supabaseAdmin
      .from('credits')
      .update({ is_unlimited: true })
      .eq('user_id', userId);

    // Notificar usuário
    await notificationsService.create(
      userId,
      'system',
      '🎉 Assinatura Ativada!',
      `Sua assinatura ${plan.name} foi ativada. Aproveite os créditos ilimitados! Válida até ${endsAt.toLocaleDateString('pt-BR')}.`
    );

    return { subscription: data };
  }

  /**
   * Conceder VIP para usuário (admin)
   * @param adminId ID do admin que está concedendo
   * @param userId ID do usuário que receberá VIP
   * @param planId Plano (monthly ou yearly)
   * @param reason Motivo da concessão
   */
  async grantVip(adminId: string, userId: string, planId: string, reason?: string): Promise<{ subscription?: Subscription; error?: string }> {
    const plan = PLANS[planId];
    if (!plan) {
      return { error: 'Plano não encontrado' };
    }

    // Verificar se já tem assinatura ativa
    const existing = await this.getActive(userId);
    if (existing) {
      // Se já tem, estender a assinatura
      const currentEndsAt = new Date(existing.ends_at);
      const newEndsAt = new Date(currentEndsAt.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);
      newEndsAt.setHours(23, 59, 59, 999);

      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .update({
          ends_at: newEndsAt.toISOString(),
          plan: planId, // Atualiza para o plano concedido
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        return { error: 'Erro ao estender assinatura' };
      }

      // Notificar usuário
      await notificationsService.create(
        userId,
        'system',
        '👑 VIP Estendido!',
        `Sua assinatura VIP foi estendida por um administrador. Nova validade: ${newEndsAt.toLocaleDateString('pt-BR')}.${reason ? ` Motivo: ${reason}` : ''}`
      );

      return { subscription: data };
    }

    // Criar nova assinatura
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);
    endsAt.setHours(23, 59, 59, 999);

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan: planId,
        status: 'active',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        auto_renew: false, // Concedido por admin não renova automaticamente
        granted_by: adminId,
        grant_reason: reason,
      })
      .select()
      .single();

    if (error) {
      return { error: 'Erro ao criar assinatura' };
    }

    // Atualizar créditos para ilimitado
    await supabaseAdmin
      .from('credits')
      .update({ is_unlimited: true })
      .eq('user_id', userId);

    // Notificar usuário
    await notificationsService.create(
      userId,
      'system',
      '👑 VIP Concedido!',
      `Você recebeu uma assinatura VIP ${plan.name} de um administrador! Válida até ${endsAt.toLocaleDateString('pt-BR')}.${reason ? ` Motivo: ${reason}` : ''}`
    );

    return { subscription: data };
  }

  /**
   * Revogar VIP de usuário (admin)
   */
  async revokeVip(adminId: string, userId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    const existing = await this.getActive(userId);
    if (!existing) {
      return { success: false, error: 'Usuário não possui assinatura ativa' };
    }

    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: adminId,
        cancel_reason: reason || 'Revogado por administrador',
      })
      .eq('id', existing.id);

    if (error) {
      return { success: false, error: 'Erro ao revogar assinatura' };
    }

    // Remover créditos ilimitados
    await supabaseAdmin
      .from('credits')
      .update({ is_unlimited: false })
      .eq('user_id', userId);

    // Notificar usuário
    await notificationsService.create(
      userId,
      'system',
      'Assinatura VIP Revogada',
      `Sua assinatura VIP foi revogada por um administrador.${reason ? ` Motivo: ${reason}` : ''}`
    );

    return { success: true };
  }

  // Cancelar assinatura
  async cancel(userId: string): Promise<{ success: boolean; error?: string }> {
    const subscription = await this.getActive(userId);
    if (!subscription) {
      return { success: false, error: 'Nenhuma assinatura ativa' };
    }

    const { error } = await supabaseAdmin
      .from('subscriptions')
      .update({ 
        auto_renew: false,
        status: 'cancelled',
      })
      .eq('id', subscription.id);

    if (error) {
      return { success: false, error: 'Erro ao cancelar assinatura' };
    }

    // Notificar
    await notificationsService.create(
      userId,
      'system',
      'Assinatura Cancelada',
      `Sua assinatura foi cancelada. Você ainda tem acesso até ${new Date(subscription.ends_at).toLocaleDateString('pt-BR')}.`
    );

    return { success: true };
  }

  // Renovar assinatura
  async renew(userId: string): Promise<{ subscription?: Subscription; error?: string }> {
    const current = await this.getActive(userId);
    if (!current) {
      return { error: 'Nenhuma assinatura para renovar' };
    }

    const plan = PLANS[current.plan];
    if (!plan) {
      return { error: 'Plano não encontrado' };
    }

    // Estender data de término
    const newEndsAt = new Date(new Date(current.ends_at).getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update({ 
        ends_at: newEndsAt.toISOString(),
        status: 'active',
        auto_renew: true,
      })
      .eq('id', current.id)
      .select()
      .single();

    if (error) {
      return { error: 'Erro ao renovar assinatura' };
    }

    return { subscription: data };
  }

  // Verificar e expirar assinaturas
  async checkExpired(): Promise<void> {
    // Buscar assinaturas expiradas
    const { data: expired } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('status', 'active')
      .lt('ends_at', new Date().toISOString());

    if (!expired) return;

    for (const sub of expired) {
      // Atualizar status
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'expired' })
        .eq('id', sub.id);

      // Remover créditos ilimitados
      await supabaseAdmin
        .from('credits')
        .update({ is_unlimited: false })
        .eq('user_id', sub.user_id);

      // Notificar
      await notificationsService.create(
        sub.user_id,
        'system',
        'Assinatura Expirada',
        'Sua assinatura expirou. Renove para continuar com créditos ilimitados!'
      );
    }
  }

  // Histórico de assinaturas
  async getHistory(userId: string): Promise<Subscription[]> {
    const { data } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return data || [];
  }

  /**
   * Ativar VIP após pagamento confirmado
   */
  async activateAfterPayment(userId: string, planId: string, paymentId: string): Promise<{ subscription?: Subscription; error?: string }> {
    try {
      // Usar função do banco de dados
      const { data, error } = await supabaseAdmin.rpc('activate_vip_subscription', {
        p_user_id: userId,
        p_plan_id: planId,
        p_payment_id: paymentId,
      });

      if (error) {
        console.error('Erro ao ativar VIP via RPC:', error);
        // Fallback manual
        return this.create(userId, planId, paymentId);
      }

      // Buscar assinatura criada
      const subscription = await this.getActive(userId);
      return { subscription: subscription || undefined };
    } catch (err: any) {
      console.error('Erro ao ativar VIP:', err);
      return { error: err.message || 'Erro ao ativar assinatura' };
    }
  }

  /**
   * Obter informações do usuário VIP para exibição
   */
  async getVipInfo(userId: string): Promise<{
    isVip: boolean;
    plan?: string;
    planName?: string;
    expiresAt?: string;
    daysRemaining?: number;
    features?: string[];
  }> {
    const subscription = await this.getActive(userId);
    
    if (!subscription) {
      return { isVip: false };
    }

    const plan = PLANS[subscription.plan];
    const expiresAt = new Date(subscription.ends_at);
    const now = new Date();
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      isVip: true,
      plan: subscription.plan,
      planName: plan?.name || subscription.plan,
      expiresAt: subscription.ends_at,
      daysRemaining: Math.max(0, daysRemaining),
      features: plan?.features || [],
    };
  }
}

export const subscriptionsService = new SubscriptionsService();
