import { FastifyInstance } from 'fastify';
import { subscriptionsService } from './subscriptions.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

export async function subscriptionsRoutes(fastify: FastifyInstance) {
  // Listar planos disponíveis
  fastify.get('/plans', async (request, reply) => {
    const plans = subscriptionsService.getPlans();
    return { plans };
  });

  // Obter assinatura ativa
  fastify.get('/me', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = (request as any).user.id;
    const subscription = await subscriptionsService.getActive(userId);
    const isSubscriber = !!subscription;

    return { subscription, is_subscriber: isSubscriber };
  });

  // Verificar se é assinante
  fastify.get('/check', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = (request as any).user.id;
    const isSubscriber = await subscriptionsService.isSubscriber(userId);

    return { is_subscriber: isSubscriber };
  });

  // Obter informações VIP detalhadas
  fastify.get('/vip-info', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = (request as any).user.id;
    const vipInfo = await subscriptionsService.getVipInfo(userId);
    return vipInfo;
  });

  // Criar assinatura (após pagamento)
  fastify.post('/', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = (request as any).user.id;
    const { plan_id, payment_id } = request.body as { plan_id: string; payment_id?: string };

    if (!plan_id) {
      return reply.status(400).send({ error: 'Plano não informado' });
    }

    const result = await subscriptionsService.create(userId, plan_id, payment_id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return { success: true, subscription: result.subscription };
  });

  // Cancelar assinatura
  fastify.post('/cancel', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = (request as any).user.id;
    const result = await subscriptionsService.cancel(userId);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return { success: true, message: 'Assinatura cancelada' };
  });

  // Histórico de assinaturas
  fastify.get('/history', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = (request as any).user.id;
    const history = await subscriptionsService.getHistory(userId);

    return { subscriptions: history };
  });
}
