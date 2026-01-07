// =====================================================
// ROTAS DE GESTÃO FINANCEIRA (ADMIN)
// =====================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { financeAdminService } from './finance.admin.service.js';
import { requirePermission, getClientIP } from '../../middlewares/rbac.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

interface ListQuery {
  status?: string;
  method?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export async function financeAdminRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /finance/dashboard - Dashboard financeiro (admin+)
  fastify.get('/dashboard', {
    preHandler: requirePermission('view_finances'),
  }, async (request: any, reply: any) => {
    const dashboard = await financeAdminService.getDashboard();
    return reply.send(dashboard);
  });

  // GET /finance/withdrawals - Listar saques (admin+)
  fastify.get('/withdrawals', {
    preHandler: requirePermission('approve_withdrawals'),
  }, async (request: any, reply: any) => {
    const result = await financeAdminService.listWithdrawals(request.query);
    return reply.send(result);
  });

  // POST /finance/withdrawals/:id/approve - Aprovar saque (admin+)
  fastify.post('/withdrawals/:id/approve', {
    preHandler: requirePermission('approve_withdrawals'),
  }, async (request: any, reply: any) => {
    const result = await financeAdminService.approveWithdrawal(
      request.user!.id,
      request.params.id,
      request.body.notes,
      getClientIP(request)
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }
    return reply.send({ message: 'Saque aprovado' });
  });

  // POST /finance/withdrawals/:id/reject - Rejeitar saque (admin+)
  fastify.post('/withdrawals/:id/reject', {
    preHandler: requirePermission('approve_withdrawals'),
  }, async (request: any, reply: any) => {
    const { reason } = request.body;
    if (!reason || reason.trim().length < 5) {
      return reply.status(400).send({ error: 'Motivo obrigatório' });
    }

    const result = await financeAdminService.rejectWithdrawal(
      request.user!.id,
      request.params.id,
      reason,
      getClientIP(request)
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }
    return reply.send({ message: 'Saque rejeitado, valor devolvido ao usuário' });
  });

  // GET /finance/payments - Histórico de pagamentos (admin+)
  fastify.get('/payments', {
    preHandler: requirePermission('view_finances'),
  }, async (request: any, reply: any) => {
    const result = await financeAdminService.listPayments(request.query);
    return reply.send(result);
  });

  // GET /finance/commissions - Relatório de comissões (admin+)
  fastify.get('/commissions', {
    preHandler: requirePermission('view_finances'),
  }, async (request: any, reply: any) => {
    const report = await financeAdminService.getCommissionReport(
      request.query.startDate,
      request.query.endDate
    );
    return reply.send(report);
  });

  // GET /finance/bonus - Relatório de bônus (admin+)
  fastify.get('/bonus', {
    preHandler: requirePermission('view_finances'),
  }, async (request: any, reply: any) => {
    const report = await financeAdminService.getBonusReport(
      request.query.startDate,
      request.query.endDate
    );
    return reply.send(report);
  });

  // GET /finance/bonus/records - Listar registros de bônus (admin+)
  fastify.get('/bonus/records', {
    preHandler: requirePermission('view_finances'),
  }, async (request: any, reply: any) => {
    const result = await financeAdminService.listBonusRecords({
      bonusType: request.query.bonusType,
      adminOnly: request.query.adminOnly === 'true',
      startDate: request.query.startDate,
      endDate: request.query.endDate,
      limit: request.query.limit,
      offset: request.query.offset,
    });
    return reply.send(result);
  });

  // GET /finance/report - Relatório financeiro completo (admin+)
  fastify.get('/report', {
    preHandler: requirePermission('view_finances'),
  }, async (request: any, reply: any) => {
    const report = await financeAdminService.getFullFinancialReport(
      request.query.period || 'month',
      request.query.startDate,
      request.query.endDate
    );
    return reply.send(report);
  });

  // GET /finance/report/withdrawals - Relatório de saques detalhado (admin+)
  fastify.get('/report/withdrawals', {
    preHandler: requirePermission('view_finances'),
  }, async (request: any, reply: any) => {
    const report = await financeAdminService.getWithdrawalsReport(request.query.period || 'month');
    return reply.send(report);
  });

  // GET /finance/report/bonus - Relatório de bônus detalhado (admin+)
  fastify.get('/report/bonus', {
    preHandler: requirePermission('view_finances'),
  }, async (request: any, reply: any) => {
    const report = await financeAdminService.getBonusDetailedReport(request.query.period || 'month');
    return reply.send(report);
  });
}
