// =====================================================
// SERVIÇO DE PAGAMENTOS - GERENCIANET/EFÍ
// =====================================================

import { supabaseAdmin } from '../../services/supabase.js';
import { gerencianetClient } from './gerencianet.client.js';
import { subscriptionsService } from '../subscriptions/subscriptions.service.js';
import { CREDIT_VALUE_BRL } from '../../../shared/constants/index.js';

export interface CreatePixPaymentParams {
  userId: string;
  amountBrl: number;
  creditsAmount: number;
  payerName: string;
  payerCpf: string;
}

export interface CreateVipPixPaymentParams {
  userId: string;
  planId: string;
  amountBrl: number;
  payerName: string;
  payerCpf: string;
}

export interface CreateCardPaymentParams {
  userId: string;
  amountBrl: number;
  creditsAmount: number;
  payerName: string;
  payerCpf: string;
  payerEmail: string;
  paymentToken: string;
  installments?: number;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  txid?: string;
  qrcode?: string;
  copyPaste?: string;
  expiresAt?: string;
  error?: string;
}

class PaymentsService {
  // Criar pagamento PIX
  async createPixPayment(params: CreatePixPaymentParams): Promise<PaymentResult> {
    try {
      if (!this.validateCPF(params.payerCpf)) {
        return { success: false, error: 'CPF inválido' };
      }
      if (params.amountBrl < 2) {
        return { success: false, error: 'Valor mínimo é R$ 2,00' };
      }

      const isConfigured = await gerencianetClient.isConfigured();
      let pixData: { txid: string; qrcode: string; copyPaste: string; expiresAt: string };

      if (isConfigured) {
        pixData = await gerencianetClient.createPixCharge({
          value: params.amountBrl,
          payerCpf: params.payerCpf,
          payerName: params.payerName,
          description: `${params.creditsAmount} créditos - Sinuca Online`,
          expirationSeconds: 3600,
        });
      } else {
        pixData = this.generateMockPix(params.amountBrl);
      }

      const { data: payment, error } = await supabaseAdmin
        .from('payments')
        .insert({
          user_id: params.userId,
          txid: pixData.txid,
          method: 'pix',
          amount_brl: params.amountBrl,
          credits_amount: params.creditsAmount,
          status: 'pending',
          payer_name: params.payerName,
          payer_cpf: params.payerCpf.replace(/\D/g, ''),
          pix_qrcode: pixData.qrcode,
          pix_copy_paste: pixData.copyPaste,
          pix_expiration: pixData.expiresAt,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: 'Erro ao criar pagamento' };
      }

      return {
        success: true,
        paymentId: payment.id,
        txid: pixData.txid,
        qrcode: pixData.qrcode,
        copyPaste: pixData.copyPaste,
        expiresAt: pixData.expiresAt,
      };
    } catch (error: any) {
      return { success: false, error: error.message || 'Erro ao processar pagamento' };
    }
  }

  private generateMockPix(amount: number) {
    const txid = `MOCK${Date.now()}${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    const qrcode = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(txid)}`;
    const copyPaste = `00020126580014br.gov.bcb.pix0136${txid}5204000053039865802BR5913SINUCA6008BRASILIA62070503***6304`;
    return { txid, qrcode, copyPaste, expiresAt };
  }

  // Criar pagamento com cartão
  async createCardPayment(params: CreateCardPaymentParams): Promise<PaymentResult> {
    try {
      if (!this.validateCPF(params.payerCpf)) {
        return { success: false, error: 'CPF inválido' };
      }
      if (params.amountBrl < 2) {
        return { success: false, error: 'Valor mínimo é R$ 2,00' };
      }

      const isConfigured = await gerencianetClient.isConfigured();
      let chargeResult: { chargeId: number; status: string };

      if (isConfigured) {
        const result = await gerencianetClient.createCardCharge({
          value: params.amountBrl,
          paymentToken: params.paymentToken,
          customer: { name: params.payerName, cpf: params.payerCpf, email: params.payerEmail },
          installments: params.installments || 1,
        });
        chargeResult = { chargeId: result.chargeId, status: result.status };
      } else {
        chargeResult = { chargeId: Date.now(), status: 'paid' };
      }

      const isPaid = chargeResult.status === 'paid' || chargeResult.status === 'approved';

      const { data: payment, error } = await supabaseAdmin
        .from('payments')
        .insert({
          user_id: params.userId,
          external_id: chargeResult.chargeId.toString(),
          method: 'credit_card',
          amount_brl: params.amountBrl,
          credits_amount: params.creditsAmount,
          status: isPaid ? 'paid' : 'refused',
          payer_name: params.payerName,
          payer_cpf: params.payerCpf.replace(/\D/g, ''),
          paid_at: isPaid ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) return { success: false, error: 'Erro ao salvar pagamento' };

      if (isPaid) {
        await this.creditUser(params.userId, params.amountBrl, params.creditsAmount, payment.id);
      }

      return { success: isPaid, paymentId: payment.id, error: isPaid ? undefined : 'Pagamento recusado' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Erro ao processar pagamento' };
    }
  }

  // Processar webhook do Pix
  async processPixWebhook(payload: any): Promise<boolean> {
    try {
      const pixArray = payload.pix || [payload];
      for (const pix of pixArray) {
        const txid = pix.txid;
        if (!txid) continue;

        const { data: payment } = await supabaseAdmin
          .from('payments')
          .select('*')
          .eq('txid', txid)
          .eq('status', 'pending')
          .single();

        if (!payment) continue;

        await supabaseAdmin
          .from('payments')
          .update({ status: 'paid', paid_at: new Date().toISOString(), metadata: { endToEndId: pix.endToEndId } })
          .eq('id', payment.id);

        // Processar baseado no tipo de pagamento
        if (payment.payment_type === 'bet_deposit') {
          // Depósito para apostas - apenas adiciona ao deposit_balance
          await this.creditBetDeposit(payment.user_id, payment.amount_brl, payment.id);
        } else if (payment.payment_type === 'vip_subscription') {
          // Assinatura VIP - ativar assinatura
          await subscriptionsService.activateAfterPayment(
            payment.user_id,
            payment.vip_plan_id,
            payment.id
          );
        } else {
          // Compra de créditos padrão
          await this.creditUser(payment.user_id, payment.amount_brl, payment.credits_amount, payment.id);
        }
      }
      return true;
    } catch (error) {
      console.error('[Webhook] Erro:', error);
      return false;
    }
  }

  private async creditUser(userId: string, amountBrl: number, creditsAmount: number, paymentId: string): Promise<void> {
    await supabaseAdmin.rpc('add_deposit_balance', {
      p_user_id: userId,
      p_amount: amountBrl,
      p_description: `Depósito via pagamento #${paymentId}`,
    });

    const { data: credits } = await supabaseAdmin.from('credits').select('amount').eq('user_id', userId).single();
    await supabaseAdmin.from('credits').update({ amount: (credits?.amount || 0) + creditsAmount }).eq('user_id', userId);

    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type: 'payment',
      title: 'Pagamento Aprovado! 🎉',
      message: `Você recebeu ${creditsAmount} créditos. Bom jogo!`,
      data: { paymentId, credits: creditsAmount },
    });
  }

  async getPaymentById(paymentId: string, userId?: string) {
    const query = supabaseAdmin.from('payments').select('*').eq('id', paymentId);
    if (userId) query.eq('user_id', userId);
    const { data } = await query.single();
    return data;
  }

  async checkPaymentStatus(paymentId: string): Promise<{ status: string; paid: boolean }> {
    const { data } = await supabaseAdmin.from('payments').select('status, txid').eq('id', paymentId).single();
    if (!data) return { status: 'not_found', paid: false };

    if (data.status === 'pending' && data.txid) {
      try {
        const isConfigured = await gerencianetClient.isConfigured();
        if (isConfigured) {
          const pixStatus = await gerencianetClient.getPixCharge(data.txid);
          if (pixStatus.status === 'CONCLUIDA') {
            await this.processPixWebhook({ txid: data.txid });
            return { status: 'paid', paid: true };
          }
        }
      } catch (e) { /* ignore */ }
    }
    return { status: data.status, paid: data.status === 'paid' };
  }

  async getUserPayments(userId: string, limit = 20) {
    const { data } = await supabaseAdmin.from('payments').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    return data || [];
  }

  validateCPF(cpf: string): boolean {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
    let rem = (sum * 10) % 11;
    if (rem === 10 || rem === 11) rem = 0;
    if (rem !== parseInt(cpf.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
    rem = (sum * 10) % 11;
    if (rem === 10 || rem === 11) rem = 0;
    if (rem !== parseInt(cpf.charAt(10))) return false;

    return true;
  }

  calculateCredits(amountBrl: number): number {
    return Math.floor(amountBrl / CREDIT_VALUE_BRL);
  }

  getPackages() {
    return [
      { id: 1, credits: 4, price: 2.0, popular: false },
      { id: 2, credits: 10, price: 5.0, popular: false },
      { id: 3, credits: 20, price: 10.0, popular: true },
      { id: 4, credits: 50, price: 25.0, popular: false },
      { id: 5, credits: 100, price: 50.0, popular: false },
    ];
  }

  // ==================== DEPÓSITO PARA APOSTAS ====================

  // Criar pagamento PIX para depósito de saldo (apostas)
  async createBetDepositPix(params: {
    userId: string;
    amountBrl: number;
    payerName: string;
    payerCpf: string;
  }): Promise<PaymentResult> {
    try {
      if (!this.validateCPF(params.payerCpf)) {
        return { success: false, error: 'CPF inválido' };
      }
      if (params.amountBrl < 5) {
        return { success: false, error: 'Valor mínimo para depósito é R$ 5,00' };
      }

      const isConfigured = await gerencianetClient.isConfigured();
      let pixData: { txid: string; qrcode: string; copyPaste: string; expiresAt: string };

      if (isConfigured) {
        pixData = await gerencianetClient.createPixCharge({
          value: params.amountBrl,
          payerCpf: params.payerCpf,
          payerName: params.payerName,
          description: `Depósito R$ ${params.amountBrl.toFixed(2)} - Saldo para Apostas`,
          expirationSeconds: 3600,
        });
      } else {
        pixData = this.generateMockPix(params.amountBrl);
      }

      const { data: payment, error } = await supabaseAdmin
        .from('payments')
        .insert({
          user_id: params.userId,
          txid: pixData.txid,
          method: 'pix',
          amount_brl: params.amountBrl,
          credits_amount: 0, // Depósito não dá créditos
          status: 'pending',
          payer_name: params.payerName,
          payer_cpf: params.payerCpf.replace(/\D/g, ''),
          pix_qrcode: pixData.qrcode,
          pix_copy_paste: pixData.copyPaste,
          pix_expiration: pixData.expiresAt,
          payment_type: 'bet_deposit', // Tipo específico para depósito de apostas
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: 'Erro ao criar pagamento' };
      }

      return {
        success: true,
        paymentId: payment.id,
        txid: pixData.txid,
        qrcode: pixData.qrcode,
        copyPaste: pixData.copyPaste,
        expiresAt: pixData.expiresAt,
      };
    } catch (error: any) {
      return { success: false, error: error.message || 'Erro ao processar depósito' };
    }
  }

  // Processar webhook do Pix para depósito de apostas
  async processBetDepositWebhook(payload: any): Promise<boolean> {
    try {
      const pixArray = payload.pix || [payload];
      for (const pix of pixArray) {
        const txid = pix.txid;
        if (!txid) continue;

        const { data: payment } = await supabaseAdmin
          .from('payments')
          .select('*')
          .eq('txid', txid)
          .eq('status', 'pending')
          .eq('payment_type', 'bet_deposit')
          .single();

        if (!payment) continue;

        // Atualizar pagamento
        await supabaseAdmin
          .from('payments')
          .update({ 
            status: 'paid', 
            paid_at: new Date().toISOString(), 
            metadata: { endToEndId: pix.endToEndId } 
          })
          .eq('id', payment.id);

        // Creditar saldo de depósito (para apostas)
        await this.creditBetDeposit(payment.user_id, payment.amount_brl, payment.id);
      }
      return true;
    } catch (error) {
      console.error('[Webhook Bet Deposit] Erro:', error);
      return false;
    }
  }

  // Creditar saldo de depósito para apostas
  private async creditBetDeposit(userId: string, amountBrl: number, paymentId: string): Promise<void> {
    // Adicionar ao deposit_balance (saldo para apostas)
    await supabaseAdmin.rpc('add_deposit_balance', {
      p_user_id: userId,
      p_amount: amountBrl,
      p_description: `Depósito para apostas #${paymentId}`,
    });

    // Notificar usuário
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type: 'bet_deposit',
      title: 'Depósito Confirmado! 💰',
      message: `R$ ${amountBrl.toFixed(2)} foi adicionado ao seu saldo para apostas. Boa sorte!`,
      data: { paymentId, amount: amountBrl },
    });
  }

  // Verificar status do depósito para apostas
  async checkBetDepositStatus(paymentId: string): Promise<{ 
    status: string; 
    paid: boolean; 
    amount?: number;
  }> {
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('status, txid, amount_brl')
      .eq('id', paymentId)
      .single();

    if (!payment) return { status: 'not_found', paid: false };

    if (payment.status === 'paid') {
      return { status: 'paid', paid: true, amount: payment.amount_brl };
    }

    // Se pendente, verificar no Gerencianet
    if (payment.status === 'pending' && payment.txid) {
      try {
        const isConfigured = await gerencianetClient.isConfigured();
        if (isConfigured) {
          const pixStatus = await gerencianetClient.getPixCharge(payment.txid);
          if (pixStatus.status === 'CONCLUIDA') {
            await this.processBetDepositWebhook({ txid: payment.txid });
            return { status: 'paid', paid: true, amount: payment.amount_brl };
          }
        }
      } catch (e) { /* ignore */ }
    }

    return { status: payment.status, paid: false };
  }

  // ==================== VIP SUBSCRIPTION ====================

  // Criar pagamento PIX para assinatura VIP
  async createVipPixPayment(params: CreateVipPixPaymentParams): Promise<PaymentResult> {
    try {
      if (!this.validateCPF(params.payerCpf)) {
        return { success: false, error: 'CPF inválido' };
      }

      const isConfigured = await gerencianetClient.isConfigured();
      let pixData: { txid: string; qrcode: string; copyPaste: string; expiresAt: string };

      const planName = params.planId === 'yearly' ? 'VIP Anual' : 'VIP Mensal';

      if (isConfigured) {
        pixData = await gerencianetClient.createPixCharge({
          value: params.amountBrl,
          payerCpf: params.payerCpf,
          payerName: params.payerName,
          description: `Assinatura ${planName} - Sinuca Online`,
          expirationSeconds: 3600,
        });
      } else {
        pixData = this.generateMockPix(params.amountBrl);
      }

      const { data: payment, error } = await supabaseAdmin
        .from('payments')
        .insert({
          user_id: params.userId,
          txid: pixData.txid,
          method: 'pix',
          amount_brl: params.amountBrl,
          credits_amount: 0, // VIP não dá créditos, dá ilimitado
          status: 'pending',
          payer_name: params.payerName,
          payer_cpf: params.payerCpf.replace(/\D/g, ''),
          pix_qrcode: pixData.qrcode,
          pix_copy_paste: pixData.copyPaste,
          pix_expiration: pixData.expiresAt,
          payment_type: 'vip_subscription',
          vip_plan_id: params.planId,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: 'Erro ao criar pagamento' };
      }

      return {
        success: true,
        paymentId: payment.id,
        txid: pixData.txid,
        qrcode: pixData.qrcode,
        copyPaste: pixData.copyPaste,
        expiresAt: pixData.expiresAt,
      };
    } catch (error: any) {
      return { success: false, error: error.message || 'Erro ao processar pagamento' };
    }
  }

  // Processar webhook do Pix para VIP
  async processVipPixWebhook(payload: any): Promise<boolean> {
    try {
      const pixArray = payload.pix || [payload];
      for (const pix of pixArray) {
        const txid = pix.txid;
        if (!txid) continue;

        const { data: payment } = await supabaseAdmin
          .from('payments')
          .select('*')
          .eq('txid', txid)
          .eq('status', 'pending')
          .eq('payment_type', 'vip_subscription')
          .single();

        if (!payment) continue;

        // Atualizar pagamento
        await supabaseAdmin
          .from('payments')
          .update({ 
            status: 'paid', 
            paid_at: new Date().toISOString(), 
            metadata: { endToEndId: pix.endToEndId } 
          })
          .eq('id', payment.id);

        // Ativar assinatura VIP
        await subscriptionsService.activateAfterPayment(
          payment.user_id,
          payment.vip_plan_id,
          payment.id
        );
      }
      return true;
    } catch (error) {
      console.error('[Webhook VIP] Erro:', error);
      return false;
    }
  }

  // Verificar status do pagamento VIP
  async checkVipPaymentStatus(paymentId: string): Promise<{ 
    status: string; 
    paid: boolean; 
    activated: boolean;
    subscription?: any;
  }> {
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('status, txid, user_id, vip_plan_id, subscription_id')
      .eq('id', paymentId)
      .single();

    if (!payment) return { status: 'not_found', paid: false, activated: false };

    // Se já está pago, verificar se assinatura foi ativada
    if (payment.status === 'paid') {
      const subscription = await subscriptionsService.getActive(payment.user_id);
      return { 
        status: 'paid', 
        paid: true, 
        activated: !!subscription,
        subscription 
      };
    }

    // Se pendente, verificar no Gerencianet
    if (payment.status === 'pending' && payment.txid) {
      try {
        const isConfigured = await gerencianetClient.isConfigured();
        if (isConfigured) {
          const pixStatus = await gerencianetClient.getPixCharge(payment.txid);
          if (pixStatus.status === 'CONCLUIDA') {
            // Processar pagamento
            await this.processVipPixWebhook({ txid: payment.txid });
            
            const subscription = await subscriptionsService.getActive(payment.user_id);
            return { 
              status: 'paid', 
              paid: true, 
              activated: !!subscription,
              subscription 
            };
          }
        }
      } catch (e) { /* ignore */ }
    }

    return { status: payment.status, paid: false, activated: false };
  }
}

export const paymentsService = new PaymentsService();
