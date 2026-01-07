// =====================================================
// SERVIÇO DE CUPONS DE DESCONTO
// =====================================================

import { supabaseAdmin } from '../../services/supabase.js';

export interface Coupon {
  id: string;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_purchase: number;
  max_discount?: number;
  max_uses?: number;
  max_uses_per_user: number;
  current_uses: number;
  valid_from: string;
  valid_until?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
}

class CouponsService {
  // Listar todos os cupons (admin)
  async listAll(): Promise<Coupon[]> {
    const { data, error } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Criar cupom
  async create(params: {
    code: string;
    description?: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    min_purchase?: number;
    max_discount?: number;
    max_uses?: number;
    max_uses_per_user?: number;
    valid_from?: string;
    valid_until?: string;
    adminId: string;
  }): Promise<{ success: boolean; coupon?: Coupon; error?: string }> {
    // Validar código único
    const { data: existing } = await supabaseAdmin
      .from('coupons')
      .select('id')
      .eq('code', params.code.toUpperCase())
      .single();

    if (existing) {
      return { success: false, error: 'Código de cupom já existe' };
    }

    // Validar valores
    if (params.discount_type === 'percentage' && (params.discount_value < 1 || params.discount_value > 100)) {
      return { success: false, error: 'Porcentagem deve ser entre 1% e 100%' };
    }

    if (params.discount_value <= 0) {
      return { success: false, error: 'Valor do desconto deve ser maior que zero' };
    }

    const { data, error } = await supabaseAdmin
      .from('coupons')
      .insert({
        code: params.code.toUpperCase(),
        description: params.description,
        discount_type: params.discount_type,
        discount_value: params.discount_value,
        min_purchase: params.min_purchase || 0,
        max_discount: params.max_discount,
        max_uses: params.max_uses,
        max_uses_per_user: params.max_uses_per_user || 1,
        valid_from: params.valid_from || new Date().toISOString(),
        valid_until: params.valid_until,
        created_by: params.adminId,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Log de auditoria
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: params.adminId,
      action: 'create_coupon',
      target_type: 'coupon',
      target_id: data.id,
      details: { code: params.code, discount_type: params.discount_type, discount_value: params.discount_value },
    });

    return { success: true, coupon: data };
  }

  // Atualizar cupom
  async update(couponId: string, params: Partial<Coupon>, adminId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
      .from('coupons')
      .update({
        ...params,
        updated_at: new Date().toISOString(),
      })
      .eq('id', couponId);

    if (error) {
      return { success: false, error: error.message };
    }

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminId,
      action: 'update_coupon',
      target_type: 'coupon',
      target_id: couponId,
      details: params,
    });

    return { success: true };
  }

  // Desativar cupom
  async deactivate(couponId: string, adminId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
      .from('coupons')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', couponId);

    if (error) {
      return { success: false, error: error.message };
    }

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminId,
      action: 'deactivate_coupon',
      target_type: 'coupon',
      target_id: couponId,
    });

    return { success: true };
  }

  // Validar cupom (para uso pelo usuário)
  async validate(code: string, userId: string, purchaseAmount: number): Promise<{
    valid: boolean;
    coupon?: Coupon;
    discount?: number;
    finalAmount?: number;
    error?: string;
  }> {
    const { data: coupon, error } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error || !coupon) {
      return { valid: false, error: 'Cupom não encontrado ou inválido' };
    }

    // Verificar validade
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return { valid: false, error: 'Cupom ainda não está válido' };
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return { valid: false, error: 'Cupom expirado' };
    }

    // Verificar limite total de usos
    if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
      return { valid: false, error: 'Cupom esgotado' };
    }

    // Verificar limite por usuário
    const { count } = await supabaseAdmin
      .from('coupon_uses')
      .select('*', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .eq('user_id', userId);

    if (count && count >= coupon.max_uses_per_user) {
      return { valid: false, error: 'Você já usou este cupom o máximo de vezes permitido' };
    }

    // Verificar compra mínima
    if (purchaseAmount < coupon.min_purchase) {
      return { valid: false, error: `Compra mínima de R$ ${coupon.min_purchase.toFixed(2)} para usar este cupom` };
    }

    // Calcular desconto
    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      discount = purchaseAmount * (coupon.discount_value / 100);
      if (coupon.max_discount && discount > coupon.max_discount) {
        discount = coupon.max_discount;
      }
    } else {
      discount = coupon.discount_value;
    }

    // Não pode ter desconto maior que o valor da compra
    if (discount > purchaseAmount) {
      discount = purchaseAmount;
    }

    const finalAmount = purchaseAmount - discount;

    return {
      valid: true,
      coupon,
      discount,
      finalAmount,
    };
  }

  // Aplicar cupom (registrar uso)
  async apply(couponId: string, userId: string, paymentId: string, originalAmount: number, discount: number): Promise<{ success: boolean; error?: string }> {
    const finalAmount = originalAmount - discount;

    // Registrar uso
    const { error: useError } = await supabaseAdmin
      .from('coupon_uses')
      .insert({
        coupon_id: couponId,
        user_id: userId,
        payment_id: paymentId,
        discount_applied: discount,
        original_amount: originalAmount,
        final_amount: finalAmount,
      });

    if (useError) {
      return { success: false, error: useError.message };
    }

    // Incrementar contador de usos
    await supabaseAdmin.rpc('increment_coupon_uses', { coupon_id: couponId });

    return { success: true };
  }

  // Estatísticas de cupom
  async getStats(couponId: string): Promise<{
    total_uses: number;
    total_discount: number;
    unique_users: number;
  }> {
    const { data } = await supabaseAdmin
      .from('coupon_uses')
      .select('user_id, discount_applied')
      .eq('coupon_id', couponId);

    if (!data || data.length === 0) {
      return { total_uses: 0, total_discount: 0, unique_users: 0 };
    }

    const uniqueUsers = new Set(data.map(u => u.user_id)).size;
    const totalDiscount = data.reduce((sum, u) => sum + Number(u.discount_applied), 0);

    return {
      total_uses: data.length,
      total_discount: totalDiscount,
      unique_users: uniqueUsers,
    };
  }
}

export const couponsService = new CouponsService();
