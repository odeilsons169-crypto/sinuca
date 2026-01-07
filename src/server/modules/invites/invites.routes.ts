import { FastifyInstance } from 'fastify';
import { invitesService } from './invites.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

export async function invitesRoutes(fastify: FastifyInstance) {
  // Listar convites pendentes
  fastify.get('/', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = (request as any).user.id;
    const invites = await invitesService.getPending(userId);
    return { invites };
  });

  // Criar convite
  fastify.post('/', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = (request as any).user.id;
    const { to_user_id, room_id } = request.body as { to_user_id: string; room_id: string };

    if (!to_user_id || !room_id) {
      return reply.status(400).send({ error: 'Dados incompletos' });
    }

    if (to_user_id === userId) {
      return reply.status(400).send({ error: 'Não pode convidar a si mesmo' });
    }

    const result = await invitesService.create(userId, to_user_id, room_id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return { success: true, invite: result.invite };
  });

  // Aceitar convite
  fastify.post('/:id/accept', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };

    const result = await invitesService.accept(id, userId);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return { success: true, room_id: result.roomId };
  });

  // Rejeitar convite
  fastify.post('/:id/reject', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };

    const result = await invitesService.reject(id, userId);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return { success: true };
  });

  // Cancelar convite
  fastify.delete('/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };

    const result = await invitesService.cancel(id, userId);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return { success: true };
  });
}
