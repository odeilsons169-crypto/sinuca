// =====================================================
// ROTAS DE GESTÃO DE USUÁRIOS (ADMIN AVANÇADO)
// =====================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { usersAdminService } from './users.admin.service.js';
import { subscriptionsService } from '../subscriptions/subscriptions.service.js';
import { requireRole, requirePermission, getClientIP } from '../../middlewares/rbac.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { auditService } from './audit.service.js';

interface ListUsersQuery {
  search?: string;
  status?: 'active' | 'banned' | 'suspended' | 'vip';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

interface BanUserBody {
  reason: string;
}

interface SuspendUserBody {
  reason: string;
  duration_hours: number;
}

interface AdjustBalanceBody {
  amount: number;
  balance_type: 'deposit' | 'winnings' | 'bonus';
  reason: string;
}

interface GrantVipBody {
  plan: 'monthly' | 'yearly';
  reason?: string;
}

interface RevokeVipBody {
  reason?: string;
}

export async function usersAdminRoutes(fastify: FastifyInstance) {
  // Auth + RBAC
  fastify.addHook('preHandler', authMiddleware);

  // GET /users - Listar usuários (moderator+)
  fastify.get<{ Querystring: ListUsersQuery }>('/', {
    preHandler: requirePermission('view_users'),
  }, async (request: any, reply: any) => {
    const result = await usersAdminService.listUsers(request.query);
    return reply.send(result);
  });

  // GET /users/:id - Detalhes do usuário (moderator+)
  fastify.get<{ Params: { id: string } }>('/:id', {
    preHandler: requirePermission('view_users'),
  }, async (request: any, reply: any) => {
    const user = await usersAdminService.getUserDetail(request.params.id);
    if (!user) {
      return reply.status(404).send({ error: 'Usuário não encontrado' });
    }
    return reply.send(user);
  });

  // GET /users/:id/transactions - Histórico de transações
  fastify.get<{ Params: { id: string }; Querystring: { limit?: number } }>('/:id/transactions', {
    preHandler: requirePermission('view_finances'),
  }, async (request: any, reply: any) => {
    const transactions = await usersAdminService.getUserTransactions(
      request.params.id,
      request.query.limit || 50
    );
    return reply.send({ transactions });
  });

  // GET /users/:id/matches - Histórico de partidas
  fastify.get<{ Params: { id: string }; Querystring: { limit?: number } }>('/:id/matches', {
    preHandler: requirePermission('view_matches'),
  }, async (request: any, reply: any) => {
    const matches = await usersAdminService.getUserMatches(
      request.params.id,
      request.query.limit || 50
    );
    return reply.send({ matches });
  });

  // GET /users/:id/credits-history - Histórico de créditos e bônus
  fastify.get<{ Params: { id: string }; Querystring: { limit?: number } }>('/:id/credits-history', {
    preHandler: requirePermission('view_finances'),
  }, async (request: any, reply: any) => {
    const history = await usersAdminService.getUserCreditsHistory(
      request.params.id,
      request.query.limit || 50
    );
    return reply.send(history);
  });

  // GET /users/:id/withdrawals - Histórico de saques do usuário
  fastify.get<{ Params: { id: string }; Querystring: { limit?: number } }>('/:id/withdrawals', {
    preHandler: requirePermission('view_finances'),
  }, async (request: any, reply: any) => {
    const withdrawals = await usersAdminService.getUserWithdrawals(
      request.params.id,
      request.query.limit || 50
    );
    return reply.send({ withdrawals });
  });

  // POST /users/:id/ban - Banir usuário (moderator+)
  fastify.post<{ Params: { id: string }; Body: BanUserBody }>('/:id/ban', {
    preHandler: requirePermission('ban_users'),
  }, async (request: any, reply: any) => {
    const { reason } = request.body;
    if (!reason || reason.trim().length < 5) {
      return reply.status(400).send({ error: 'Motivo obrigatório (mínimo 5 caracteres)' });
    }

    const result = await usersAdminService.banUser(
      request.user!.id,
      request.params.id,
      reason,
      getClientIP(request)
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error_message });
    }
    return reply.send({ message: 'Usuário banido com sucesso' });
  });

  // POST /users/:id/suspend - Suspender temporariamente (moderator+)
  fastify.post<{ Params: { id: string }; Body: SuspendUserBody }>('/:id/suspend', {
    preHandler: requirePermission('ban_users'),
  }, async (request: any, reply: any) => {
    const { reason, duration_hours } = request.body;
    if (!reason || reason.trim().length < 5) {
      return reply.status(400).send({ error: 'Motivo obrigatório (mínimo 5 caracteres)' });
    }
    if (!duration_hours || duration_hours < 1) {
      return reply.status(400).send({ error: 'Duração inválida' });
    }

    const result = await usersAdminService.suspendUser(
      request.user!.id,
      request.params.id,
      reason,
      duration_hours,
      getClientIP(request)
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error_message });
    }
    return reply.send({ message: `Usuário suspenso por ${duration_hours} horas` });
  });

  // POST /users/:id/unban - Desbanir usuário (admin+)
  fastify.post<{ Params: { id: string }; Body: { reason: string } }>('/:id/unban', {
    preHandler: requireRole('admin'),
  }, async (request: any, reply: any) => {
    const { reason } = request.body;
    const result = await usersAdminService.unbanUser(
      request.user!.id,
      request.params.id,
      reason || 'Desbloqueio administrativo',
      getClientIP(request)
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error_message });
    }
    return reply.send({ message: 'Usuário desbloqueado' });
  });

  // POST /users/:id/adjust-balance - Ajustar saldo (SUPER_ADMIN ONLY)
  fastify.post<{ Params: { id: string }; Body: AdjustBalanceBody }>('/:id/adjust-balance', {
    preHandler: requirePermission('adjust_balance'),
  }, async (request: any, reply: any) => {
    const { amount, balance_type, reason } = request.body;

    if (amount === undefined || amount === 0) {
      return reply.status(400).send({ error: 'Valor inválido' });
    }
    if (!['deposit', 'winnings', 'bonus'].includes(balance_type)) {
      return reply.status(400).send({ error: 'Tipo de saldo inválido' });
    }
    if (!reason || reason.trim().length < 10) {
      return reply.status(400).send({ error: 'Justificativa obrigatória (mínimo 10 caracteres)' });
    }

    const result = await usersAdminService.adjustBalance(
      request.user!.id,
      request.params.id,
      amount,
      balance_type,
      reason,
      getClientIP(request)
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error_message });
    }
    return reply.send({ message: 'Saldo ajustado', new_balance: result.new_balance });
  });

  // POST /users/:id/reset-password - Resetar senha (admin+)
  fastify.post<{ Params: { id: string } }>('/:id/reset-password', {
    preHandler: requireRole('admin'),
  }, async (request: any, reply: any) => {
    const result = await usersAdminService.resetPassword(
      request.user!.id,
      request.params.id,
      getClientIP(request)
    );
    return reply.send({ message: 'Email de reset enviado' });
  });

  // POST /users/:id/reset-ranking - Resetar ranking (admin+)
  fastify.post<{ Params: { id: string } }>('/:id/reset-ranking', {
    preHandler: requireRole('admin'),
  }, async (request: any, reply: any) => {
    await usersAdminService.resetRanking(
      request.user!.id,
      request.params.id,
      getClientIP(request)
    );
    return reply.send({ message: 'Ranking resetado' });
  });

  // POST /users/:id/grant-vip - Conceder VIP para usuário (admin+)
  fastify.post<{ Params: { id: string }; Body: GrantVipBody }>('/:id/grant-vip', {
    preHandler: requireRole('admin'),
  }, async (request: any, reply: any) => {
    const { plan, reason } = request.body;

    if (!plan || !['monthly', 'yearly'].includes(plan)) {
      return reply.status(400).send({ error: 'Plano inválido. Use "monthly" ou "yearly"' });
    }

    const result = await subscriptionsService.grantVip(
      request.user!.id,
      request.params.id,
      plan,
      reason
    );

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    // Log de auditoria
    await auditService.log({
      adminId: request.user!.id,
      action: 'user_update',
      targetType: 'subscription',
      targetId: request.params.id,
      details: {
        action: 'grant_vip',
        plan,
        reason,
        expires_at: result.subscription?.ends_at
      },
      ipAddress: getClientIP(request),
    });

    return reply.send({
      message: `VIP ${plan === 'yearly' ? 'Anual' : 'Mensal'} concedido com sucesso!`,
      subscription: result.subscription
    });
  });

  // POST /users/:id/revoke-vip - Revogar VIP de usuário (admin+)
  fastify.post<{ Params: { id: string }; Body: RevokeVipBody }>('/:id/revoke-vip', {
    preHandler: requireRole('admin'),
  }, async (request: any, reply: any) => {
    const { reason } = request.body;

    const result = await subscriptionsService.revokeVip(
      request.user!.id,
      request.params.id,
      reason
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    // Log de auditoria
    await auditService.log({
      adminId: request.user!.id,
      action: 'user_update',
      targetType: 'subscription',
      targetId: request.params.id,
      details: { action: 'revoke_vip', reason },
      ipAddress: getClientIP(request),
    });

    return reply.send({ message: 'VIP revogado com sucesso' });
  });

  // GET /users/:id/subscription - Ver assinatura do usuário (admin+)
  fastify.get<{ Params: { id: string } }>('/:id/subscription', {
    preHandler: requirePermission('view_users'),
  }, async (request: any, reply: any) => {
    const subscription = await subscriptionsService.getActive(request.params.id);
    const history = await subscriptionsService.getHistory(request.params.id);

    return reply.send({
      active: subscription,
      history,
      is_vip: !!subscription
    });
  });
}
