import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { matchesService } from './matches.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { cleanupService } from '../../services/cleanup.service.js';

// Função auxiliar para formatar tempo restante
function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

interface ListQuery {
  status?: string;
  limit?: number;
  offset?: number;
}

interface UpdateScoreBody {
  player1_score: number;
  player2_score: number;
}

interface FinishBody {
  winner_id: string;
}

export async function matchesRoutes(fastify: FastifyInstance) {
  // POST /matches - Criar partida a partir de sala
  fastify.post('/', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Body: { room_id: string } }>, reply: FastifyReply) => {
    const { room_id } = request.body;

    if (!room_id) {
      return reply.status(400).send({ error: 'room_id é obrigatório' });
    }

    const result = await matchesService.createFromRoom(room_id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.status(201).send(result.match);
  });

  // GET /matches - Listar partidas do usuário
  fastify.get('/', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
    const { status, limit, offset } = request.query;

    const result = await matchesService.getByUser(
      request.user!.id,
      status,
      Math.min(limit || 20, 50),
      offset || 0
    );

    return reply.send(result);
  });

  // GET /matches/:id - Detalhes da partida
  fastify.get('/:id', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const match = await matchesService.getById(request.params.id);

    if (!match) {
      return reply.status(404).send({ error: 'Partida não encontrada' });
    }

    // Verificar se usuário é participante
    if (match.player1_id !== request.user!.id && match.player2_id !== request.user!.id && request.user!.role !== 'admin') {
      return reply.status(403).send({ error: 'Acesso negado' });
    }

    // Adicionar informações de tempo
    const timeConstants = cleanupService.getTimeConstants();
    const timeRemaining = match.started_at 
      ? cleanupService.getMatchTimeRemaining(match.started_at)
      : timeConstants.matchMaxDurationMs;
    const isExpired = match.started_at ? cleanupService.isMatchExpired(match.started_at) : false;

    return reply.send({
      ...match,
      time_info: {
        max_duration_ms: timeConstants.matchMaxDurationMs,
        max_duration_minutes: timeConstants.matchMaxDurationMinutes,
        time_remaining_ms: timeRemaining,
        time_remaining_seconds: Math.floor(timeRemaining / 1000),
        is_expired: isExpired,
      },
    });
  });

  // GET /matches/:id/time - Obter apenas informações de tempo da partida
  fastify.get('/:id/time', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const match = await matchesService.getById(request.params.id);

    if (!match) {
      return reply.status(404).send({ error: 'Partida não encontrada' });
    }

    const timeConstants = cleanupService.getTimeConstants();
    const timeRemaining = match.started_at 
      ? cleanupService.getMatchTimeRemaining(match.started_at)
      : timeConstants.matchMaxDurationMs;
    const isExpired = match.started_at ? cleanupService.isMatchExpired(match.started_at) : false;

    return reply.send({
      match_id: match.id,
      started_at: match.started_at,
      max_duration_ms: timeConstants.matchMaxDurationMs,
      max_duration_minutes: timeConstants.matchMaxDurationMinutes,
      time_remaining_ms: timeRemaining,
      time_remaining_seconds: Math.floor(timeRemaining / 1000),
      time_remaining_formatted: formatTimeRemaining(timeRemaining),
      is_expired: isExpired,
    });
  });

  // GET /matches/time-constants - Obter constantes de tempo do sistema
  fastify.get('/time-constants', async (request: FastifyRequest, reply: FastifyReply) => {
    const timeConstants = cleanupService.getTimeConstants();
    return reply.send(timeConstants);
  });

  // POST /matches/:id/start - Iniciar partida
  fastify.post('/:id/start', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await matchesService.start(request.params.id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send(result.match);
  });

  // PUT /matches/:id/score - Atualizar pontuação
  fastify.put('/:id/score', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateScoreBody }>, reply: FastifyReply) => {
    const { player1_score, player2_score } = request.body;

    const result = await matchesService.updateScore(request.params.id, player1_score, player2_score);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: 'Pontuação atualizada' });
  });

  // POST /matches/:id/finish - Finalizar partida
  fastify.post('/:id/finish', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Params: { id: string }; Body: FinishBody }>, reply: FastifyReply) => {
    const { winner_id } = request.body;

    if (!winner_id) {
      return reply.status(400).send({ error: 'winner_id é obrigatório' });
    }

    const result = await matchesService.finish(request.params.id, winner_id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send(result.match);
  });

  // POST /matches/:id/cancel - Cancelar partida
  fastify.post('/:id/cancel', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await matchesService.cancel(request.params.id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: 'Partida cancelada' });
  });
}
