// =====================================================
// ROTAS DE MISSÕES E COMPETIÇÕES
// =====================================================

import { FastifyInstance } from 'fastify';
import { missionsService } from './missions.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { adminMiddleware } from '../../middlewares/admin.middleware.js';

export async function missionsRoutes(fastify: FastifyInstance) {
  // ==================== ADMIN ====================

  // Listar todas as missões
  fastify.get('/admin', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const missions = await missionsService.listAll();
      return { success: true, missions };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Criar missão
  fastify.post('/admin', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const {
        title,
        description,
        type,
        requirement_type,
        requirement_value,
        reward_type,
        reward_value,
        icon,
        start_date,
        end_date,
        max_completions,
      } = request.body as any;

      const adminId = (request as any).user.id;

      if (!title || !type || !requirement_type || !requirement_value || !reward_value) {
        return reply.status(400).send({ error: 'Campos obrigatórios: title, type, requirement_type, requirement_value, reward_value' });
      }

      const result = await missionsService.create({
        title,
        description,
        type,
        requirement_type,
        requirement_value: Number(requirement_value),
        reward_type: reward_type || 'credits',
        reward_value: Number(reward_value),
        icon,
        start_date,
        end_date,
        max_completions: max_completions ? Number(max_completions) : undefined,
        adminId,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { success: true, mission: result.mission };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Atualizar missão
  fastify.put('/admin/:id', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const updates = request.body as any;
      const adminId = (request as any).user.id;

      const result = await missionsService.update(id, updates, adminId);

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { success: true, message: 'Missão atualizada' };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Desativar missão
  fastify.delete('/admin/:id', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const adminId = (request as any).user.id;

      const result = await missionsService.deleteMission(id, adminId);

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { success: true, message: 'Missão deletada' };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Toggle ativar/desativar missão
  fastify.put('/admin/:id/toggle', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { is_active } = request.body as { is_active: boolean };
      const adminId = (request as any).user.id;

      const result = await missionsService.toggleActive(id, is_active, adminId);

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { success: true, message: is_active ? 'Missão ativada' : 'Missão desativada' };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Estatísticas de missão
  fastify.get('/admin/:id/stats', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const stats = await missionsService.getStats(id);
      return { success: true, stats };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // ==================== USUÁRIO ====================

  // Listar missões disponíveis para o usuário
  fastify.get('/', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const missions = await missionsService.getAvailableForUser(userId);
      return { success: true, missions };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Reclamar recompensa
  fastify.post('/:id/claim', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = (request as any).user.id;

      const result = await missionsService.claimReward(userId, id);

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { success: true, reward: result.reward, message: 'Recompensa reclamada!' };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
