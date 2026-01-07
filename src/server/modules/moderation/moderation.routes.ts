import { FastifyInstance } from 'fastify';
import { moderationService } from './moderation.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

export async function moderationRoutes(fastify: FastifyInstance) {
  // Verificar status do usuário (pode jogar?)
  fastify.get('/status', { preHandler: authMiddleware }, async (request) => {
    const userId = (request as any).user.id;
    const status = await moderationService.checkUserStatus(userId);
    return { success: true, ...status };
  });

  // Moderar mensagem de chat
  fastify.post('/chat', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { message } = request.body as { message: string };
      const userId = (request as any).user.id;

      if (!message || typeof message !== 'string') {
        return reply.status(400).send({ error: 'Mensagem inválida' });
      }

      const result = await moderationService.moderateMessage(userId, message);
      
      return { 
        success: result.allowed, 
        message: result.filteredContent || message,
        blocked: !result.allowed,
        reason: result.reason,
        action: result.action,
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Reportar usuário
  fastify.post('/report', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { targetId, reason, details } = request.body as { 
        targetId: string; 
        reason: string; 
        details?: string;
      };
      const reporterId = (request as any).user.id;

      if (!targetId || !reason) {
        return reply.status(400).send({ error: 'Dados incompletos' });
      }

      if (targetId === reporterId) {
        return reply.status(400).send({ error: 'Você não pode reportar a si mesmo' });
      }

      await moderationService.reportUser(reporterId, targetId, reason, details);
      
      return { success: true, message: 'Denúncia enviada. Obrigado por ajudar a manter a comunidade segura!' };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Verificar ação do jogo (anti-cheat)
  fastify.post('/check-action', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { matchId, action } = request.body as { matchId: string; action: any };
      const userId = (request as any).user.id;

      if (!matchId || !action) {
        return reply.status(400).send({ error: 'Dados incompletos' });
      }

      const result = await moderationService.detectCheat(userId, matchId, action);
      
      // Não revelar detalhes da detecção ao usuário
      return { 
        success: true, 
        flagged: result.isSuspicious,
        // Apenas retornar ação se for grave
        action: result.action === 'ban' || result.action === 'suspend' ? result.action : undefined,
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Obter punições ativas do usuário
  fastify.get('/punishments', { preHandler: authMiddleware }, async (request) => {
    const userId = (request as any).user.id;
    
    const { data: punishments } = await (await import('../../services/supabase.js')).supabaseAdmin
      .from('punishments')
      .select('type, reason, expires_at, created_at')
      .eq('user_id', userId)
      .or(`expires_at.gt.${new Date().toISOString()},expires_at.is.null`)
      .order('created_at', { ascending: false });

    return { success: true, punishments: punishments || [] };
  });
}
