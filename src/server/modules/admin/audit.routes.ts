// =====================================================
// ROTAS DE AUDITORIA (ADMIN)
// =====================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { auditService, AuditAction } from './audit.service.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

interface LogsQuery {
  adminId?: string;
  action?: AuditAction;
  targetType?: string;
  targetId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export async function auditRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /audit/logs - Listar logs de auditoria (moderator+)
  fastify.get('/logs', {
    preHandler: requirePermission('view_logs'),
  }, async (request: FastifyRequest<{ Querystring: LogsQuery }>, reply: FastifyReply) => {
    const result = await auditService.getLogs(request.query);
    return reply.send(result);
  });

  // GET /audit/user/:userId - Logs de ações sobre um usuário
  fastify.get('/user/:userId', {
    preHandler: requirePermission('view_logs'),
  }, async (request: FastifyRequest<{ Params: { userId: string }; Querystring: { limit?: number } }>, reply: FastifyReply) => {
    const logs = await auditService.getUserLogs(
      request.params.userId,
      request.query.limit || 50
    );
    return reply.send({ logs });
  });

  // GET /audit/admin/:adminId - Logs de ações de um admin
  fastify.get('/admin/:adminId', {
    preHandler: requirePermission('view_logs'),
  }, async (request: FastifyRequest<{ Params: { adminId: string }; Querystring: { limit?: number } }>, reply: FastifyReply) => {
    const logs = await auditService.getAdminActions(
      request.params.adminId,
      request.query.limit || 50
    );
    return reply.send({ logs });
  });

  // GET /audit/stats - Estatísticas de auditoria
  fastify.get('/stats', {
    preHandler: requirePermission('view_logs'),
  }, async (request: FastifyRequest<{ Querystring: { days?: number } }>, reply: FastifyReply) => {
    const stats = await auditService.getStats(request.query.days || 30);
    return reply.send(stats);
  });
}
