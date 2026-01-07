// =====================================================
// ROTAS DE GESTÃO DE TORNEIOS (ADMIN + PÚBLICO)
// =====================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tournamentsService, CreateTournamentDTO } from './tournaments.service.js';
import { requirePermission, getClientIP } from '../../middlewares/rbac.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { auditService } from './audit.service.js';

// =====================================================
// ROTAS PÚBLICAS (para jogadores)
// =====================================================
export async function publicTournamentsRoutes(fastify: FastifyInstance) {
  // GET /tournaments/public - Listar torneios abertos
  fastify.get('/public', async (request: FastifyRequest<{ Querystring: { status?: string } }>, reply: FastifyReply) => {
    const result = await tournamentsService.listTournaments({
      status: request.query.status || 'open',
      limit: 50,
    });
    return reply.send(result);
  });

  // GET /tournaments/public/:id - Detalhes públicos do torneio
  fastify.get('/public/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tournament = await tournamentsService.getTournamentDetail(request.params.id);
    if (!tournament) {
      return reply.status(404).send({ error: 'Torneio não encontrado' });
    }
    return reply.send(tournament);
  });

  // GET /tournaments/public/:id/prize-info - Informações de premiação
  fastify.get('/public/:id/prize-info', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const prizeInfo = await tournamentsService.getTournamentPrizeInfo(request.params.id);
    if (!prizeInfo) {
      return reply.status(404).send({ error: 'Torneio não encontrado' });
    }
    return reply.send({
      ...prizeInfo,
      rules: {
        prize_percentage: 70,
        platform_fee_percentage: 30,
        description: 'A premiação é calculada automaticamente: 70% do valor total arrecadado com as inscrições vai para os vencedores. Os outros 30% são destinados à manutenção da plataforma.',
      },
    });
  });
}

// =====================================================
// ROTAS AUTENTICADAS (para jogadores logados)
// =====================================================
export async function playerTournamentsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // POST /tournaments/:id/register - Inscrever no torneio
  fastify.post('/:id/register', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await tournamentsService.registerPlayer(
      request.user!.id,
      request.params.id
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({
      message: 'Inscrição realizada com sucesso!',
      prizeInfo: result.prizeInfo,
    });
  });

  // DELETE /tournaments/:id/register - Cancelar inscrição
  fastify.delete('/:id/register', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await tournamentsService.unregisterPlayer(
      request.user!.id,
      request.params.id
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: 'Inscrição cancelada. Reembolso processado.' });
  });

  // GET /tournaments/my - Meus torneios
  fastify.get('/my', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await tournamentsService.getPlayerTournaments(request.user!.id);
    return reply.send(result);
  });
}

interface ListQuery {
  status?: string;
  limit?: number;
  offset?: number;
}

export async function tournamentsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /tournaments - Listar torneios (moderator+)
  fastify.get('/', {
    preHandler: requirePermission('view_tournaments'),
  }, async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
    const result = await tournamentsService.listTournaments(request.query);
    return reply.send(result);
  });

  // GET /tournaments/:id - Detalhes do torneio
  fastify.get('/:id', {
    preHandler: requirePermission('view_tournaments'),
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tournament = await tournamentsService.getTournamentDetail(request.params.id);
    if (!tournament) {
      return reply.status(404).send({ error: 'Torneio não encontrado' });
    }
    return reply.send(tournament);
  });

  // POST /tournaments - Criar torneio (admin+)
  fastify.post('/', {
    preHandler: requirePermission('manage_tournaments'),
  }, async (request: FastifyRequest<{ Body: CreateTournamentDTO }>, reply: FastifyReply) => {
    const { name, start_date } = request.body;
    if (!name || !start_date) {
      return reply.status(400).send({ error: 'Nome e data de início obrigatórios' });
    }

    const tournament = await tournamentsService.createTournament(
      request.user!.id,
      request.body,
      getClientIP(request)
    );
    return reply.status(201).send(tournament);
  });

  // PUT /tournaments/:id - Atualizar torneio (admin+)
  fastify.put('/:id', {
    preHandler: requirePermission('manage_tournaments'),
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<CreateTournamentDTO> }>, reply: FastifyReply) => {
    const result = await tournamentsService.updateTournament(
      request.user!.id,
      request.params.id,
      request.body,
      getClientIP(request)
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }
    return reply.send({ message: 'Torneio atualizado' });
  });

  // POST /tournaments/:id/open - Abrir inscrições (admin+)
  fastify.post('/:id/open', {
    preHandler: requirePermission('manage_tournaments'),
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await tournamentsService.openRegistration(
      request.user!.id,
      request.params.id,
      getClientIP(request)
    );
    return reply.send({ message: 'Inscrições abertas' });
  });

  // POST /tournaments/:id/start - Iniciar torneio (admin+)
  fastify.post('/:id/start', {
    preHandler: requirePermission('manage_tournaments'),
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await tournamentsService.startTournament(
      request.user!.id,
      request.params.id,
      getClientIP(request)
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }
    return reply.send({ message: 'Torneio iniciado' });
  });

  // POST /tournaments/:id/cancel - Cancelar torneio (admin+)
  fastify.post('/:id/cancel', {
    preHandler: requirePermission('manage_tournaments'),
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { reason: string } }>, reply: FastifyReply) => {
    const { reason } = request.body;
    if (!reason || reason.trim().length < 5) {
      return reply.status(400).send({ error: 'Motivo obrigatório' });
    }

    const result = await tournamentsService.cancelTournament(
      request.user!.id,
      request.params.id,
      reason,
      getClientIP(request)
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }
    return reply.send({ message: 'Torneio cancelado', refunded: result.refunded });
  });

  // POST /tournaments/:id/matches/:matchId/advance - Avançar jogador (admin+)
  fastify.post('/:id/matches/:matchId/advance', {
    preHandler: requirePermission('manage_tournaments'),
  }, async (request: FastifyRequest<{ 
    Params: { id: string; matchId: string }; 
    Body: { winner_id: string; reason: string } 
  }>, reply: FastifyReply) => {
    const { winner_id, reason } = request.body;
    if (!winner_id) {
      return reply.status(400).send({ error: 'ID do vencedor obrigatório' });
    }
    if (!reason || reason.trim().length < 5) {
      return reply.status(400).send({ error: 'Motivo obrigatório' });
    }

    const result = await tournamentsService.advancePlayer(
      request.user!.id,
      request.params.id,
      request.params.matchId,
      winner_id,
      reason,
      getClientIP(request)
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }
    return reply.send({ message: 'Jogador avançado' });
  });

  // POST /tournaments/:id/finish - Finalizar torneio e distribuir prêmios (admin+)
  fastify.post('/:id/finish', {
    preHandler: requirePermission('manage_tournaments'),
  }, async (request: FastifyRequest<{ 
    Params: { id: string }; 
    Body: { placements: { userId: string; position: number }[] } 
  }>, reply: FastifyReply) => {
    const { placements } = request.body;
    if (!placements || !Array.isArray(placements) || placements.length === 0) {
      return reply.status(400).send({ error: 'Colocações obrigatórias' });
    }

    const result = await tournamentsService.finishTournamentAndDistributePrizes(
      request.params.id,
      placements
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    await auditService.log({
      adminId: request.user!.id,
      action: 'tournament_finish',
      targetType: 'tournament',
      targetId: request.params.id,
      details: { placements, payments: result.payments },
      ipAddress: getClientIP(request),
    });

    return reply.send({ 
      message: 'Torneio finalizado! Pagamentos criados para aprovação.',
      payments: result.payments,
    });
  });

  // ==================== PAGAMENTOS DE TORNEIOS ====================

  // GET /tournaments/payments - Listar pagamentos pendentes
  fastify.get('/payments/pending', {
    preHandler: requirePermission('manage_tournaments'),
  }, async (request: FastifyRequest<{ Querystring: { status?: string; limit?: number; offset?: number } }>, reply: FastifyReply) => {
    const result = await tournamentsService.listPendingPayments(request.query);
    return reply.send(result);
  });

  // POST /tournaments/payments/:id/approve - Aprovar pagamento (marcar como em processamento)
  fastify.post('/payments/:paymentId/approve', {
    preHandler: requirePermission('manage_tournaments'),
  }, async (request: FastifyRequest<{ 
    Params: { paymentId: string }; 
    Body: { notes?: string } 
  }>, reply: FastifyReply) => {
    const result = await tournamentsService.processPayment(
      request.user!.id,
      request.params.paymentId,
      'approve',
      request.body
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: 'Pagamento aprovado e em processamento' });
  });

  // POST /tournaments/payments/:id/complete - Concluir pagamento (anexar comprovante)
  fastify.post('/payments/:paymentId/complete', {
    preHandler: requirePermission('manage_tournaments'),
  }, async (request: FastifyRequest<{ 
    Params: { paymentId: string }; 
    Body: { proofUrl?: string; notes?: string } 
  }>, reply: FastifyReply) => {
    const result = await tournamentsService.processPayment(
      request.user!.id,
      request.params.paymentId,
      'complete',
      request.body
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    await auditService.log({
      adminId: request.user!.id,
      action: 'tournament_payment_complete',
      targetType: 'tournament_payment',
      targetId: request.params.paymentId,
      details: request.body,
      ipAddress: getClientIP(request),
    });

    return reply.send({ message: 'Pagamento concluído e creditado na carteira do usuário' });
  });

  // POST /tournaments/payments/:id/reject - Rejeitar pagamento
  fastify.post('/payments/:paymentId/reject', {
    preHandler: requirePermission('manage_tournaments'),
  }, async (request: FastifyRequest<{ 
    Params: { paymentId: string }; 
    Body: { notes?: string } 
  }>, reply: FastifyReply) => {
    const result = await tournamentsService.processPayment(
      request.user!.id,
      request.params.paymentId,
      'reject',
      request.body
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: 'Pagamento rejeitado' });
  });
}
