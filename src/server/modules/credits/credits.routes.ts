import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { creditsService } from './credits.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { CREDITS_PER_PURCHASE, PURCHASE_PRICE_BRL, CREDIT_VALUE_BRL, VIP_MONTHLY_PRICE } from '../../../shared/constants/index.js';

export async function creditsRoutes(fastify: FastifyInstance) {
  // GET /credits - Créditos do usuário
  fastify.get('/', { preHandler: authMiddleware }, async (request: FastifyRequest, reply: FastifyReply) => {
    const credits = await creditsService.getByUserId(request.user!.id);

    if (!credits) {
      return reply.status(404).send({ error: 'Créditos não encontrados' });
    }

    return reply.send({
      ...credits,
      price_info: {
        credit_value: CREDIT_VALUE_BRL,
        min_purchase: CREDITS_PER_PURCHASE,
        min_price: PURCHASE_PRICE_BRL,
        vip_monthly: VIP_MONTHLY_PRICE,
        description: `1 crédito = R$ ${CREDIT_VALUE_BRL.toFixed(2)} | Mínimo: ${CREDITS_PER_PURCHASE} créditos (R$ ${PURCHASE_PRICE_BRL.toFixed(2)})`,
      },
    });
  });

  // GET /credits/check - Verificar se tem créditos suficientes
  fastify.get('/check', { preHandler: authMiddleware }, async (request: FastifyRequest, reply: FastifyReply) => {
    const hasCredits = await creditsService.hasEnough(request.user!.id);
    return reply.send({ has_credits: hasCredits });
  });

  // POST /credits/daily - Receber crédito diário grátis
  fastify.post('/daily', { preHandler: authMiddleware }, async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await creditsService.checkDailyFreeCredit(request.user!.id);
    if (result.credited) {
      return reply.send({ success: true, message: result.message });
    }
    return reply.status(400).send({ error: result.message || 'Você já recebeu seu crédito grátis hoje' });
  });

  // POST /credits/purchase - Comprar créditos (debita da carteira)
  fastify.post('/purchase', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Body: { quantity: number } }>, reply: FastifyReply) => {
    const { quantity } = request.body;

    if (!quantity || quantity < CREDITS_PER_PURCHASE) {
      return reply.status(400).send({ error: `Quantidade mínima é ${CREDITS_PER_PURCHASE} créditos` });
    }

    const result = await creditsService.purchaseCredits(request.user!.id, quantity);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ 
      success: true, 
      credits: result.credits,
      message: `${quantity} créditos adicionados com sucesso!`
    });
  });

  // POST /credits/debit-ai - Debitar crédito para partida contra IA
  fastify.post('/debit-ai', { preHandler: authMiddleware }, async (request: FastifyRequest, reply: FastifyReply) => {
    const credits = await creditsService.getByUserId(request.user!.id);
    
    if (!credits) {
      return reply.status(400).send({ error: 'Créditos não encontrados' });
    }

    // Se é ilimitado (VIP), não debita nada
    if (credits.is_unlimited) {
      return reply.send({ success: true, credits });
    }

    // Verificar se tem créditos
    if (credits.amount < 1) {
      return reply.status(400).send({ error: 'Créditos insuficientes' });
    }

    // Verificar se é crédito grátis (recebeu hoje e só tem 1)
    const today = new Date().toISOString().split('T')[0];
    const lastFree = credits.last_free_credit ? new Date(credits.last_free_credit).toISOString().split('T')[0] : null;
    const isFreeCredit = lastFree === today && credits.amount === 1;

    const result = await creditsService.useCredit(request.user!.id, isFreeCredit);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    const updatedCredits = await creditsService.getByUserId(request.user!.id);
    return reply.send({ success: true, credits: updatedCredits });
  });

  // GET /credits/calculate - Calcular créditos por valor
  fastify.get('/calculate', async (request: FastifyRequest<{ Querystring: { amount: number } }>, reply: FastifyReply) => {
    const amount = Number(request.query.amount) || 0;

    if (amount < PURCHASE_PRICE_BRL) {
      return reply.status(400).send({ error: `Valor mínimo é R$ ${PURCHASE_PRICE_BRL.toFixed(2)}` });
    }

    const credits = creditsService.calculateCredits(amount);

    return reply.send({
      amount_brl: amount,
      credits,
      price_per_credit: CREDIT_VALUE_BRL,
    });
  });

  // GET /credits/history - Histórico de créditos do usuário
  fastify.get('/history', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Querystring: { limit?: number; offset?: number } }>, reply: FastifyReply) => {
    const userId = request.user!.id;
    const limit = Math.min(request.query.limit || 50, 100);
    const offset = request.query.offset || 0;

    const history = await creditsService.getUserCreditsHistory(userId, limit, offset);
    return reply.send(history);
  });
}
