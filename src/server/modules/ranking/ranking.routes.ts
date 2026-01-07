import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { rankingService } from './ranking.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

interface ListQuery {
  limit?: number;
  offset?: number;
}

interface MonthlyQuery extends ListQuery {
  month?: string;
}

interface WeeklyQuery extends ListQuery {
  week?: string;
}

export async function rankingRoutes(fastify: FastifyInstance) {
  // GET /ranking - Ranking global
  fastify.get('/', async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
    const limit = Math.min(request.query.limit || 50, 100);
    const offset = request.query.offset || 0;

    const result = await rankingService.getGlobal(limit, offset);

    return reply.send(result);
  });

  // GET /ranking/top - Top jogadores (global)
  fastify.get('/top', async (request: FastifyRequest<{ Querystring: { limit?: number } }>, reply: FastifyReply) => {
    const limit = Math.min(request.query.limit || 10, 50);

    const players = await rankingService.getTopPlayers(limit);

    return reply.send({ players });
  });

  // GET /ranking/weekly - Ranking semanal
  fastify.get('/weekly', async (request: FastifyRequest<{ Querystring: WeeklyQuery }>, reply: FastifyReply) => {
    const week = request.query.week;
    const limit = Math.min(request.query.limit || 50, 100);
    const offset = request.query.offset || 0;

    const result = await rankingService.getWeekly(week, limit, offset);

    return reply.send(result);
  });

  // GET /ranking/weekly/top10 - Top 10 da semana (para landing page)
  fastify.get('/weekly/top10', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await rankingService.getWeeklyTop10();
    return reply.send(result);
  });

  // GET /ranking/monthly - Ranking mensal
  fastify.get('/monthly', async (request: FastifyRequest<{ Querystring: MonthlyQuery }>, reply: FastifyReply) => {
    const month = request.query.month || new Date().toISOString().slice(0, 7);
    const limit = Math.min(request.query.limit || 50, 100);
    const offset = request.query.offset || 0;

    const result = await rankingService.getMonthly(month, limit, offset);

    return reply.send({ ...result, month });
  });

  // GET /ranking/me - Posição do usuário logado (global, mensal e semanal)
  fastify.get('/me', { preHandler: authMiddleware }, async (request: FastifyRequest, reply: FastifyReply) => {
    const rankings = await rankingService.getUserRankings(request.user!.id);

    return reply.send(rankings);
  });

  // GET /ranking/history - Histórico de ranking do usuário logado
  fastify.get('/history', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Querystring: { period?: string; limit?: number } }>, reply: FastifyReply) => {
    const periodType = request.query.period; // 'global', 'monthly', 'weekly' ou undefined para todos
    const limit = Math.min(request.query.limit || 20, 50);

    const history = await rankingService.getUserRankingHistory(request.user!.id, periodType, limit);

    return reply.send({ history });
  });

  // GET /ranking/user/:id - Posição de um usuário específico
  fastify.get('/user/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const position = await rankingService.getUserPosition(request.params.id);

    return reply.send(position);
  });

  // GET /ranking/user/:id/history - Histórico de ranking de um usuário específico
  fastify.get('/user/:id/history', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { period?: string; limit?: number } }>, reply: FastifyReply) => {
    const periodType = request.query.period;
    const limit = Math.min(request.query.limit || 20, 50);

    const history = await rankingService.getUserRankingHistory(request.params.id, periodType, limit);

    return reply.send({ history });
  });

  // GET /ranking/stats - Estatísticas do ranking (admin)
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = await rankingService.getRankingStats();
    return reply.send({ stats });
  });
}