// =====================================================
// ROTAS DE GESTÃO DE PARTIDAS (ADMIN)
// =====================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { matchesAdminService } from './matches.admin.service.js';
import { requirePermission, requireRole, getClientIP } from '../../middlewares/rbac.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

interface ListQuery {
  status?: string;
  userId?: string;
  gameMode?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export async function matchesAdminRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /matches - Listar partidas (moderator+)
  fastify.get('/', {
    preHandler: requirePermission('view_matches'),
  }, async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
    const result = await matchesAdminService.listMatches(request.query);
    return reply.send(result);
  });

  // GET /matches/rooms/active - Salas ativas (Live Ops)
  fastify.get('/rooms/active', {
    preHandler: requirePermission('view_matches'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const rooms = await matchesAdminService.listActiveRooms();
    return reply.send({ rooms });
  });

  // GET /matches/:id - Detalhes da partida
  fastify.get('/:id', {
    preHandler: requirePermission('view_matches'),
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const match = await matchesAdminService.getMatchDetail(request.params.id);
    if (!match) {
      return reply.status(404).send({ error: 'Partida não encontrada' });
    }
    return reply.send(match);
  });

  // POST /matches/rooms/:id/close - Kill Switch (admin+)
  fastify.post('/rooms/:id/close', {
    preHandler: requirePermission('cancel_matches'),
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { reason: string } }>, reply: FastifyReply) => {
    const { reason } = request.body;
    if (!reason || reason.trim().length < 5) {
      return reply.status(400).send({ error: 'Motivo obrigatório' });
    }

    const result = await matchesAdminService.forceCloseRoom(
      request.user!.id,
      request.params.id,
      reason,
      getClientIP(request)
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }
    return reply.send({ message: 'Sala encerrada, apostas reembolsadas' });
  });

  // POST /matches/:id/force-result - Forçar resultado (admin+)
  fastify.post('/:id/force-result', {
    preHandler: requirePermission('cancel_matches'),
  }, async (request: FastifyRequest<{ 
    Params: { id: string }; 
    Body: { winner_id?: string; reason: string } 
  }>, reply: FastifyReply) => {
    const { winner_id, reason } = request.body;
    if (!reason || reason.trim().length < 5) {
      return reply.status(400).send({ error: 'Motivo obrigatório' });
    }

    const result = await matchesAdminService.forceMatchResult(
      request.user!.id,
      request.params.id,
      winner_id || null,
      reason,
      getClientIP(request)
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }
    return reply.send({ 
      message: winner_id ? 'Partida finalizada com vencedor' : 'Partida cancelada' 
    });
  });

  // POST /matches/bets/:id/liquidate - Liquidar aposta manualmente (admin+)
  fastify.post('/bets/:id/liquidate', {
    preHandler: requirePermission('cancel_matches'),
  }, async (request: FastifyRequest<{ 
    Params: { id: string }; 
    Body: { winner_id: string; reason: string } 
  }>, reply: FastifyReply) => {
    const { winner_id, reason } = request.body;
    if (!winner_id) {
      return reply.status(400).send({ error: 'ID do vencedor obrigatório' });
    }
    if (!reason || reason.trim().length < 5) {
      return reply.status(400).send({ error: 'Motivo obrigatório' });
    }

    const result = await matchesAdminService.liquidateBet(
      request.user!.id,
      request.params.id,
      winner_id,
      reason,
      getClientIP(request)
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }
    return reply.send({ message: 'Aposta liquidada', prize: result.prize });
  });
}
