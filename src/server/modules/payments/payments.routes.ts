// =====================================================
// ROTAS DE PAGAMENTOS - PIX E CARTÃO
// =====================================================

import { FastifyInstance } from 'fastify';
import { paymentsService } from './payments.service.js';
import { subscriptionsService } from '../subscriptions/subscriptions.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

export async function paymentsRoutes(fastify: FastifyInstance) {
  // ==================== PIX ====================

  // Criar pagamento PIX
  fastify.post('/pix/create', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { amount, credits, payerName, payerCpf } = request.body as any;
      const userId = (request as any).user.id;

      if (!payerName || !payerCpf) {
        return reply.status(400).send({ error: 'Nome e CPF são obrigatórios' });
      }

      if (!amount || amount < 2) {
        return reply.status(400).send({ error: 'Valor mínimo é R$ 2,00' });
      }

      const creditsAmount = credits || paymentsService.calculateCredits(amount);

      const result = await paymentsService.createPixPayment({
        userId,
        amountBrl: amount,
        creditsAmount,
        payerName,
        payerCpf,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return {
        success: true,
        payment: {
          id: result.paymentId,
          txid: result.txid,
          qrcode: result.qrcode,
          copyPaste: result.copyPaste,
          expiresAt: result.expiresAt,
        },
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // ==================== VIP SUBSCRIPTION ====================

  // Criar pagamento PIX para assinatura VIP
  fastify.post('/vip/pix/create', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { planId, payerName, payerCpf } = request.body as any;
      const userId = (request as any).user.id;

      if (!payerName || !payerCpf) {
        return reply.status(400).send({ error: 'Nome e CPF são obrigatórios' });
      }

      if (!planId || !['monthly', 'yearly'].includes(planId)) {
        return reply.status(400).send({ error: 'Plano inválido' });
      }

      // Verificar se já é VIP
      const isVip = await subscriptionsService.isSubscriber(userId);
      if (isVip) {
        return reply.status(400).send({ error: 'Você já possui uma assinatura VIP ativa' });
      }

      // Obter preço do plano
      const plans = subscriptionsService.getPlans();
      const plan = plans.find(p => p.id === planId);
      if (!plan) {
        return reply.status(400).send({ error: 'Plano não encontrado' });
      }

      const result = await paymentsService.createVipPixPayment({
        userId,
        planId,
        amountBrl: plan.price,
        payerName,
        payerCpf,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return {
        success: true,
        payment: {
          id: result.paymentId,
          txid: result.txid,
          qrcode: result.qrcode,
          copyPaste: result.copyPaste,
          expiresAt: result.expiresAt,
          plan: {
            id: plan.id,
            name: plan.name,
            price: plan.price,
            duration_days: plan.duration_days,
            features: plan.features,
          },
        },
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Obter planos VIP disponíveis
  fastify.get('/vip/plans', async () => {
    const plans = subscriptionsService.getPlans();
    return {
      success: true,
      plans: plans.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        duration_days: p.duration_days,
        features: p.features,
        pricePerMonth: p.id === 'yearly' ? (p.price / 12).toFixed(2) : p.price.toFixed(2),
        savings: p.id === 'yearly' ? ((19.90 * 12) - p.price).toFixed(2) : '0',
      })),
    };
  });

  // Verificar status do pagamento VIP
  fastify.get('/vip/status/:paymentId', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { paymentId } = request.params as any;
      const userId = (request as any).user.id;

      const payment = await paymentsService.getPaymentById(paymentId, userId);

      if (!payment) {
        return reply.status(404).send({ error: 'Pagamento não encontrado' });
      }

      if (payment.payment_type !== 'vip_subscription') {
        return reply.status(400).send({ error: 'Este não é um pagamento de assinatura VIP' });
      }

      // Verificar status atualizado
      const status = await paymentsService.checkVipPaymentStatus(paymentId);

      return {
        success: true,
        payment: {
          id: payment.id,
          status: status.status,
          paid: status.paid,
          activated: status.activated,
          plan: payment.vip_plan_id,
          amount: payment.amount_brl,
          createdAt: payment.created_at,
          paidAt: payment.paid_at,
        },
        subscription: status.subscription,
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // ==================== CARTÃO ====================

  // Criar pagamento com cartão
  fastify.post('/card/create', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { amount, credits, payerName, payerCpf, payerEmail, paymentToken, installments } = request.body as any;
      const userId = (request as any).user.id;

      if (!payerName || !payerCpf || !payerEmail) {
        return reply.status(400).send({ error: 'Nome, CPF e email são obrigatórios' });
      }

      if (!paymentToken) {
        return reply.status(400).send({ error: 'Token de pagamento é obrigatório' });
      }

      if (!amount || amount < 2) {
        return reply.status(400).send({ error: 'Valor mínimo é R$ 2,00' });
      }

      const creditsAmount = credits || paymentsService.calculateCredits(amount);

      const result = await paymentsService.createCardPayment({
        userId,
        amountBrl: amount,
        creditsAmount,
        payerName,
        payerCpf,
        payerEmail,
        paymentToken,
        installments: installments || 1,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return {
        success: true,
        payment: { id: result.paymentId },
        message: 'Pagamento aprovado!',
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // ==================== WEBHOOK ====================

  // Webhook Pix (público - chamado pelo Gerencianet)
  fastify.post('/webhook/pix', async (request, reply) => {
    try {
      const payload = request.body;
      console.log('[Webhook Pix] Recebido:', JSON.stringify(payload));

      await paymentsService.processPixWebhook(payload);

      return { received: true };
    } catch (error: any) {
      console.error('[Webhook Pix] Erro:', error);
      return reply.status(500).send({ error: error.message });
    }
  });

  // Webhook Pix (GET para validação do Gerencianet)
  fastify.get('/webhook/pix', async () => {
    return { status: 'ok' };
  });

  // ==================== CONSULTAS ====================

  // Verificar status do pagamento
  fastify.get('/status/:paymentId', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { paymentId } = request.params as any;
      const userId = (request as any).user.id;

      const payment = await paymentsService.getPaymentById(paymentId, userId);

      if (!payment) {
        return reply.status(404).send({ error: 'Pagamento não encontrado' });
      }

      // Verificar status atualizado
      const status = await paymentsService.checkPaymentStatus(paymentId);

      return {
        success: true,
        payment: {
          id: payment.id,
          status: status.status,
          paid: status.paid,
          method: payment.method,
          amount: payment.amount_brl,
          credits: payment.credits_amount,
          createdAt: payment.created_at,
          paidAt: payment.paid_at,
        },
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Histórico de pagamentos
  fastify.get('/history', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const payments = await paymentsService.getUserPayments(userId);

      return {
        success: true,
        payments: payments.map((p: any) => ({
          id: p.id,
          method: p.method,
          amount: p.amount_brl,
          credits: p.credits_amount,
          status: p.status,
          createdAt: p.created_at,
          paidAt: p.paid_at,
        })),
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Pacotes de créditos disponíveis
  fastify.get('/packages', async () => {
    return {
      success: true,
      packages: paymentsService.getPackages(),
    };
  });

  // Validar CPF
  fastify.post('/validate-cpf', async (request) => {
    const { cpf } = request.body as any;
    const valid = paymentsService.validateCPF(cpf || '');
    return { valid };
  });

  // ==================== DEPÓSITO PARA APOSTAS ====================

  // Criar depósito PIX para saldo de apostas
  fastify.post('/bet-deposit/pix/create', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { amount, payerName, payerCpf } = request.body as any;
      const userId = (request as any).user.id;

      if (!payerName || !payerCpf) {
        return reply.status(400).send({ error: 'Nome e CPF são obrigatórios' });
      }

      if (!amount || amount < 5) {
        return reply.status(400).send({ error: 'Valor mínimo para depósito é R$ 5,00' });
      }

      const result = await paymentsService.createBetDepositPix({
        userId,
        amountBrl: amount,
        payerName,
        payerCpf,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return {
        success: true,
        payment: {
          id: result.paymentId,
          txid: result.txid,
          qrcode: result.qrcode,
          copyPaste: result.copyPaste,
          expiresAt: result.expiresAt,
        },
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Verificar status do depósito para apostas
  fastify.get('/bet-deposit/status/:paymentId', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { paymentId } = request.params as any;
      const userId = (request as any).user.id;

      const payment = await paymentsService.getPaymentById(paymentId, userId);

      if (!payment) {
        return reply.status(404).send({ error: 'Pagamento não encontrado' });
      }

      if (payment.payment_type !== 'bet_deposit') {
        return reply.status(400).send({ error: 'Este não é um depósito para apostas' });
      }

      const status = await paymentsService.checkBetDepositStatus(paymentId);

      return {
        success: true,
        payment: {
          id: payment.id,
          status: status.status,
          paid: status.paid,
          amount: payment.amount_brl,
          createdAt: payment.created_at,
          paidAt: payment.paid_at,
        },
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Valores sugeridos para depósito de apostas
  fastify.get('/bet-deposit/amounts', async () => {
    return {
      success: true,
      amounts: [
        { value: 10, label: 'R$ 10,00', popular: false },
        { value: 20, label: 'R$ 20,00', popular: true },
        { value: 50, label: 'R$ 50,00', popular: false },
        { value: 100, label: 'R$ 100,00', popular: false },
        { value: 200, label: 'R$ 200,00', popular: false },
      ],
      minAmount: 5,
      maxAmount: 1000,
    };
  });
}
