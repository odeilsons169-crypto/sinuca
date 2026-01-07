import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { walletService } from './wallet.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

interface TransactionsQuery {
  limit?: number;
  offset?: number;
}

export async function walletRoutes(fastify: FastifyInstance) {
  // GET /wallet - Saldo da carteira
  fastify.get('/', { preHandler: authMiddleware }, async (request: FastifyRequest, reply: FastifyReply) => {
    const wallet = await walletService.getByUserId(request.user!.id);

    if (!wallet) {
      return reply.status(404).send({ error: 'Carteira não encontrada' });
    }

    return reply.send(wallet);
  });

  // GET /wallet/available-for-bet - Saldo disponível para apostas (deposit + winnings, NÃO bonus)
  fastify.get('/available-for-bet', { preHandler: authMiddleware }, async (request: FastifyRequest, reply: FastifyReply) => {
    const availableForBet = await walletService.getAvailableForBet(request.user!.id);
    const wallet = await walletService.getByUserId(request.user!.id);

    return reply.send({
      available_for_bet: availableForBet,
      deposit_balance: wallet?.deposit_balance || 0,
      winnings_balance: wallet?.winnings_balance || 0,
      bonus_balance: wallet?.bonus_balance || 0,
      total_balance: wallet?.balance || 0,
    });
  });

  // GET /wallet/transactions - Histórico de transações
  fastify.get('/transactions', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Querystring: TransactionsQuery }>, reply: FastifyReply) => {
    const limit = Math.min(request.query.limit || 20, 100);
    const offset = request.query.offset || 0;

    const result = await walletService.getTransactions(request.user!.id, limit, offset);

    return reply.send(result);
  });
}
