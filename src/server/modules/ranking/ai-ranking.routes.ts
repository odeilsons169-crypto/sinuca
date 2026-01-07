// =====================================================
// ROTAS DE RANKING VS CPU - "Mestres da Sinuca"
// =====================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { aiRankingService } from './ai-ranking.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

interface RecordMatchBody {
  won: boolean;
}

export async function aiRankingRoutes(fastify: FastifyInstance) {
  // GET /ai-ranking/top - Top 10 do ranking vs CPU (público)
  fastify.get('/top', async (request: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
    const limit = parseInt(request.query.limit || '10');
    const ranking = await aiRankingService.getTopRanking(Math.min(limit, 50));
    
    return {
      success: true,
      ranking,
      title: '🏆 Mestres da Sinuca',
      subtitle: 'Os melhores jogadores contra a CPU',
    };
  });

  // GET /ai-ranking/me - Minhas estatísticas vs CPU
  fastify.get('/me', { preHandler: authMiddleware }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.id;
    const stats = await aiRankingService.getUserStats(userId);
    
    if (!stats) {
      return {
        success: true,
        stats: {
          total_matches: 0,
          wins: 0,
          losses: 0,
          win_rate: 0,
          best_streak: 0,
          current_streak: 0,
          points: 0,
          position: null,
        },
        message: 'Você ainda não jogou contra a CPU',
      };
    }

    return {
      success: true,
      stats,
    };
  });

  // GET /ai-ranking/user/:userId - Estatísticas de um usuário específico
  fastify.get('/user/:userId', async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
    const { userId } = request.params;
    const stats = await aiRankingService.getUserStats(userId);
    
    if (!stats) {
      return reply.status(404).send({
        success: false,
        error: 'Usuário não encontrado no ranking',
      });
    }

    return {
      success: true,
      stats,
    };
  });

  // POST /ai-ranking/record - Registrar resultado de partida vs CPU
  fastify.post('/record', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Body: RecordMatchBody }>, reply: FastifyReply) => {
    const userId = (request as any).user.id;
    const { won } = request.body;

    if (typeof won !== 'boolean') {
      return reply.status(400).send({
        success: false,
        error: 'Campo "won" é obrigatório (true/false)',
      });
    }

    const result = await aiRankingService.recordMatch(userId, won);

    if (!result.success) {
      return reply.status(500).send({
        success: false,
        error: result.error || 'Erro ao registrar partida',
      });
    }

    return {
      success: true,
      stats: result.stats,
      message: won ? '🏆 Vitória registrada!' : '😔 Derrota registrada',
    };
  });

  // GET /ai-ranking/history - Histórico de partidas vs CPU do usuário
  fastify.get('/history', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
    const userId = (request as any).user.id;
    const limit = parseInt(request.query.limit || '20');
    
    const history = await aiRankingService.getUserMatchHistory(userId, Math.min(limit, 50));

    return {
      success: true,
      matches: history,
      total: history.length,
    };
  });
}
