import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { roomsService, CreateRoomInput } from './rooms.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

interface ListQuery {
  limit?: number;
  offset?: number;
}

export async function roomsRoutes(fastify: FastifyInstance) {
  // POST /rooms - Criar sala
  fastify.post('/', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Body: CreateRoomInput }>, reply: FastifyReply) => {
    const { mode, bet_amount, is_private, aim_line_enabled, game_mode } = request.body;

    if (!mode || !['casual', 'bet', 'ai'].includes(mode)) {
      return reply.status(400).send({ error: 'Modo inválido' });
    }

    const result = await roomsService.create(request.user!.id, { 
      mode, 
      bet_amount, 
      is_private,
      aim_line_enabled,
      game_mode 
    });

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.status(201).send(result.room);
  });

  // GET /rooms - Listar salas abertas
  fastify.get('/', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
    const limit = Math.min(request.query.limit || 20, 50);
    const offset = request.query.offset || 0;

    const result = await roomsService.listOpen(limit, offset);

    return reply.send(result);
  });

  // GET /rooms/active - Sala ativa do usuário
  fastify.get('/active', { preHandler: authMiddleware }, async (request: FastifyRequest, reply: FastifyReply) => {
    const room = await roomsService.getActiveByUser(request.user!.id);

    if (!room) {
      return reply.status(404).send({ error: 'Nenhuma sala ativa' });
    }

    return reply.send(room);
  });

  // GET /rooms/:id - Detalhes da sala
  fastify.get('/:id', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const room = await roomsService.getById(request.params.id);

    if (!room) {
      return reply.status(404).send({ error: 'Sala não encontrada' });
    }

    return reply.send(room);
  });

  // POST /rooms/:id/join - Entrar na sala
  fastify.post('/:id/join', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await roomsService.join(request.params.id, request.user!.id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send(result.room);
  });

  // POST /rooms/code/:code/join - Entrar na sala por código
  fastify.post('/code/:code/join', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Params: { code: string } }>, reply: FastifyReply) => {
    const room = await roomsService.getByCode(request.params.code);

    if (!room) {
      return reply.status(404).send({ error: 'Sala não encontrada com este código' });
    }

    const result = await roomsService.join(room.id, request.user!.id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send(result.room);
  });

  // POST /rooms/:id/leave - Sair da sala
  fastify.post('/:id/leave', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await roomsService.leave(request.params.id, request.user!.id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: 'Saiu da sala' });
  });

  // DELETE /rooms/:id - Fechar sala
  fastify.delete('/:id', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await roomsService.close(request.params.id, request.user!.id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: 'Sala fechada' });
  });

  // POST /rooms/:id/forfeit - Abandonar partida
  fastify.post('/:id/forfeit', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await roomsService.forfeit(request.params.id, request.user!.id);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({
      success: true,
      winnerId: result.winnerId,
      winnerUsername: result.winnerUsername,
      loserId: result.loserId,
      loserUsername: result.loserUsername,
      prizeAmount: result.prizeAmount,
      adminFee: result.adminFee,
    });
  });
}
