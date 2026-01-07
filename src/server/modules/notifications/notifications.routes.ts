import { FastifyInstance } from 'fastify';
import { notificationsService } from './notifications.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

export async function notificationsRoutes(fastify: FastifyInstance) {
  // Listar notificações do usuário
  fastify.get('/', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = (request as any).user.id;
    const notifications = await notificationsService.getByUser(userId);
    const unread = await notificationsService.countUnread(userId);

    return { notifications, unread_count: unread };
  });

  // Contar não lidas
  fastify.get('/unread', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = (request as any).user.id;
    const count = await notificationsService.countUnread(userId);

    return { unread_count: count };
  });

  // Marcar como lida
  fastify.patch('/:id/read', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };

    const success = await notificationsService.markAsRead(id, userId);
    if (!success) {
      return reply.status(400).send({ error: 'Erro ao marcar notificação' });
    }

    return { success: true };
  });

  // Marcar todas como lidas
  fastify.patch('/read-all', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = (request as any).user.id;
    await notificationsService.markAllAsRead(userId);

    return { success: true };
  });

  // Deletar notificação
  fastify.delete('/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = (request as any).user.id;
    const { id } = request.params as { id: string };

    const success = await notificationsService.delete(id, userId);
    if (!success) {
      return reply.status(400).send({ error: 'Erro ao deletar notificação' });
    }

    return { success: true };
  });

  // Deletar todas
  fastify.delete('/', { preHandler: authMiddleware }, async (request, reply) => {
    const userId = (request as any).user.id;
    await notificationsService.deleteAll(userId);

    return { success: true };
  });
}
