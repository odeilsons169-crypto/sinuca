import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { adminService } from './admin.service.js';
import { adminMiddleware } from '../../middlewares/auth.middleware.js';
import { supabaseAdmin } from '../../services/supabase.js';
import type { UserStatus, PunishmentType } from '../../../shared/types/index.js';

interface ListQuery {
  limit?: number;
  offset?: number;
  status?: string;
}

interface PunishmentBody {
  user_id: string;
  type: PunishmentType;
  reason: string;
  duration_hours?: number;
}

interface AdjustWalletBody {
  user_id: string;
  amount: number;
  description: string;
}

interface AdjustCreditsBody {
  user_id: string;
  amount: number;
}

interface ProcessWithdrawalBody {
  approved: boolean;
  notes?: string;
}

interface ForceEndMatchBody {
  winner_id?: string;
}

export async function adminRoutes(fastify: FastifyInstance) {
  // Todas as rotas admin requerem autenticação de admin
  fastify.addHook('preHandler', adminMiddleware);

  // ==================== DASHBOARD ====================

  // GET /admin/dashboard - Dashboard geral
  fastify.get('/dashboard', async (request: any, reply: any) => {
    const dashboard = await adminService.getDashboard();
    return reply.send(dashboard);
  });

  // GET /admin/financial - Dashboard financeiro
  fastify.get('/financial', async (request: any, reply: any) => {
    const financial = await adminService.getFinancialDashboard();
    return reply.send(financial);
  });

  // ==================== USUÁRIOS ====================

  // GET /admin/users - Listar usuários
  fastify.get('/users', async (request: any, reply: any) => {
    const { limit, offset, status } = request.query;
    const result = await adminService.listUsers(
      Math.min(limit || 50, 100),
      offset || 0,
      status as UserStatus
    );
    return reply.send(result);
  });

  // GET /admin/users/:id - Detalhes do usuário
  fastify.get('/users/:id', async (request: any, reply: any) => {
    const user = await adminService.getUserFull(request.params.id);

    if (!user) {
      return reply.status(404).send({ error: 'Usuário não encontrado' });
    }

    return reply.send(user);
  });

  // PUT /admin/users/:id/status - Atualizar status
  fastify.put('/users/:id/status', async (request: any, reply: any) => {
    const { status, reason } = request.body;

    if (!['active', 'suspended', 'banned'].includes(status)) {
      return reply.status(400).send({ error: 'Status inválido' });
    }

    const result = await adminService.updateUserStatus(request.params.id, status, request.user!.id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    // Se for desbanir, também atualizar o motivo
    if (status === 'active' && reason) {
      await supabaseAdmin.from('admin_logs').insert({
        admin_id: request.user!.id,
        action: 'user_unban',
        target_type: 'user',
        target_id: request.params.id,
        details: { reason },
      });
    }

    return reply.send({ message: 'Status atualizado' });
  });

  // POST /admin/users/:id/ban - Banir usuário com opções avançadas
  fastify.post('/users/:id/ban', async (request: any, reply: any) => {
    const { reason, reason_code, is_permanent, duration_hours, delete_data } = request.body;
    const userId = request.params.id;
    const adminId = request.user!.id;

    if (!reason) {
      return reply.status(400).send({ error: 'Motivo é obrigatório' });
    }

    // Se for banimento permanente com exclusão de dados
    if (is_permanent && delete_data) {
      // Apenas super_admin pode deletar dados
      if (request.user!.role !== 'super_admin') {
        return reply.status(403).send({ error: 'Apenas Super Admin pode deletar dados de usuários' });
      }

      // Deletar usuário permanentemente
      const deleteResult = await adminService.deleteUser(userId, adminId);
      if (deleteResult.error) {
        return reply.status(400).send({ error: deleteResult.error });
      }

      return reply.send({
        message: 'Usuário banido permanentemente e dados deletados',
        deleted: true
      });
    }

    // Banimento normal (temporário ou permanente sem exclusão)
    const punishmentType = is_permanent ? 'ban' : 'suspension';
    const result = await adminService.applyPunishment(
      userId,
      adminId,
      punishmentType,
      `[${reason_code || 'OUTROS'}] ${reason}`,
      is_permanent ? undefined : (duration_hours || 24)
    );

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({
      message: is_permanent ? 'Usuário banido permanentemente' : `Usuário suspenso por ${duration_hours || 24} horas`,
      is_permanent,
      duration_hours: is_permanent ? null : (duration_hours || 24)
    });
  });

  // POST /admin/users/:id/unban - Desbanir usuário
  fastify.post('/users/:id/unban', async (request: any, reply: any) => {
    const userId = request.params.id;
    const adminId = request.user!.id;
    const { reason } = request.body;

    // Atualizar status do usuário
    await supabaseAdmin
      .from('users')
      .update({
        status: 'active',
        is_banned: false,
        ban_reason: null,
        banned_at: null,
        banned_by: null,
        is_suspended: false,
        suspended_until: null,
        suspension_reason: null,
      })
      .eq('id', userId);

    // Desativar punições ativas
    await supabaseAdmin
      .from('punishments')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    // Log de auditoria
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminId,
      action: 'user_unban',
      target_type: 'user',
      target_id: userId,
      details: { reason: reason || 'Desbanido pelo administrador' },
    });

    return reply.send({ message: 'Usuário desbanido com sucesso' });
  });

  // GET /admin/ban-reasons - Listar motivos de banimento pré-definidos
  fastify.get('/ban-reasons', async (request: any, reply: any) => {
    const reasons = [
      { code: 'FRAUDE', label: '🚨 Fraude/Golpe', description: 'Tentativa de fraude ou golpe na plataforma', severity: 'high' },
      { code: 'HACK', label: '💻 Hack/Trapaça', description: 'Uso de hacks, cheats ou exploits', severity: 'high' },
      { code: 'MULTI_CONTA', label: '👥 Múltiplas Contas', description: 'Criação de múltiplas contas para burlar regras', severity: 'medium' },
      { code: 'ABUSO_BONUS', label: '🎁 Abuso de Bônus', description: 'Abuso do sistema de bônus ou promoções', severity: 'medium' },
      { code: 'LINGUAGEM', label: '🗣️ Linguagem Ofensiva', description: 'Uso de linguagem ofensiva, racista ou discriminatória', severity: 'medium' },
      { code: 'ASSEDIO', label: '⚠️ Assédio', description: 'Assédio a outros jogadores', severity: 'high' },
      { code: 'SPAM', label: '📢 Spam', description: 'Envio de spam ou publicidade não autorizada', severity: 'low' },
      { code: 'ABANDONO', label: '🚪 Abandono Recorrente', description: 'Abandono frequente de partidas', severity: 'low' },
      { code: 'MANIPULACAO', label: '🎲 Manipulação de Partidas', description: 'Manipulação de resultados de partidas', severity: 'high' },
      { code: 'PAGAMENTO', label: '💳 Problema de Pagamento', description: 'Chargeback ou problemas com pagamentos', severity: 'high' },
      { code: 'MENOR_IDADE', label: '🔞 Menor de Idade', description: 'Usuário menor de 18 anos', severity: 'high' },
      { code: 'OUTROS', label: '📋 Outros', description: 'Outros motivos não listados', severity: 'medium' },
    ];

    const durations = [
      { hours: 1, label: '1 hora' },
      { hours: 6, label: '6 horas' },
      { hours: 12, label: '12 horas' },
      { hours: 24, label: '24 horas (1 dia)' },
      { hours: 48, label: '48 horas (2 dias)' },
      { hours: 72, label: '72 horas (3 dias)' },
      { hours: 168, label: '7 dias (1 semana)' },
      { hours: 336, label: '14 dias (2 semanas)' },
      { hours: 720, label: '30 dias (1 mês)' },
      { hours: null, label: 'Permanente' },
    ];

    return reply.send({ reasons, durations });
  });

  // ==================== BÔNUS ====================

  // POST /admin/users/:id/bonus - Dar bônus para usuário (créditos)
  fastify.post('/users/:id/bonus', async (request: any, reply: any) => {
    const { amount, reason } = request.body;
    const userId = request.params.id;
    const adminId = request.user!.id;

    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: 'Quantidade de bônus deve ser maior que zero' });
    }

    if (!reason || reason.trim().length < 3) {
      return reply.status(400).send({ error: 'Motivo do bônus é obrigatório (mínimo 3 caracteres)' });
    }

    const result = await adminService.giveBonus(userId, amount, reason.trim(), adminId);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({
      success: true,
      message: `${amount} crédito(s) de bônus adicionado(s) com sucesso`,
      credits: result.credits,
    });
  });

  // PUT /admin/users/:id/role - Atualizar role
  fastify.put('/users/:id/role', async (request: any, reply: any) => {
    const { role } = request.body;

    if (!['user', 'admin'].includes(role)) {
      return reply.status(400).send({ error: 'Role inválido' });
    }

    const result = await adminService.updateUserRole(request.params.id, role, request.user!.id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: 'Role atualizado' });
  });

  // DELETE /admin/users/:id - Deletar usuário permanentemente (apenas super_admin)
  fastify.delete('/users/:id', async (request: any, reply: any) => {
    const adminUser = request.user!;

    // Apenas super_admin pode deletar usuários
    if (adminUser.role !== 'super_admin') {
      return reply.status(403).send({ error: 'Apenas Super Admin pode deletar usuários' });
    }

    const result = await adminService.deleteUser(request.params.id, adminUser.id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: 'Usuário deletado permanentemente' });
  });

  // ==================== PUNIÇÕES ====================

  // GET /admin/punishments - Listar punições
  fastify.get('/punishments', async (request: any, reply: any) => {
    const { limit, offset, user_id, active } = request.query;
    const result = await adminService.listPunishments(
      user_id,
      active === 'true' ? true : active === 'false' ? false : undefined,
      Math.min(limit || 50, 100),
      offset || 0
    );
    return reply.send(result);
  });

  // POST /admin/punishments - Aplicar punição
  fastify.post('/punishments', async (request: any, reply: any) => {
    const { user_id, type, reason, duration_hours } = request.body;

    if (!user_id || !type || !reason) {
      return reply.status(400).send({ error: 'user_id, type e reason são obrigatórios' });
    }

    if (!['warning', 'mute', 'suspension', 'ban'].includes(type)) {
      return reply.status(400).send({ error: 'Tipo de punição inválido' });
    }

    const result = await adminService.applyPunishment(user_id, request.user!.id, type, reason, duration_hours);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.status(201).send({ message: 'Punição aplicada' });
  });

  // DELETE /admin/punishments/:id - Remover punição
  fastify.delete('/punishments/:id', async (request: any, reply: any) => {
    const result = await adminService.removePunishment(request.params.id, request.user!.id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: 'Punição removida' });
  });

  // ==================== CARTEIRAS ====================

  // POST /admin/wallet/adjust - Ajustar carteira
  fastify.post('/wallet/adjust', async (request: any, reply: any) => {
    const { user_id, amount, description } = request.body;

    if (!user_id || amount === undefined || !description) {
      return reply.status(400).send({ error: 'user_id, amount e description são obrigatórios' });
    }

    const result = await adminService.adjustWallet(user_id, amount, description, request.user!.id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ wallet: result.wallet });
  });

  // POST /admin/wallet/:userId/block - Bloquear carteira
  fastify.post('/wallet/:userId/block', async (request: any, reply: any) => {
    const result = await adminService.setWalletBlocked(request.params.userId, true, request.user!.id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: 'Carteira bloqueada' });
  });

  // POST /admin/wallet/:userId/unblock - Desbloquear carteira
  fastify.post('/wallet/:userId/unblock', async (request: any, reply: any) => {
    const result = await adminService.setWalletBlocked(request.params.userId, false, request.user!.id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: 'Carteira desbloqueada' });
  });

  // ==================== CRÉDITOS ====================

  // POST /admin/credits/adjust - Ajustar créditos
  fastify.post('/credits/adjust', async (request: any, reply: any) => {
    const { user_id, amount } = request.body;

    if (!user_id || amount === undefined) {
      return reply.status(400).send({ error: 'user_id e amount são obrigatórios' });
    }

    const result = await adminService.adjustCredits(user_id, amount, request.user!.id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ credits: result.credits });
  });

  // ==================== SAQUES ====================

  // GET /admin/withdrawals - Listar saques
  fastify.get('/withdrawals', async (request: any, reply: any) => {
    const { limit, offset, status } = request.query;
    const result = await adminService.listWithdrawals(
      status,
      Math.min(limit || 50, 100),
      offset || 0
    );
    return reply.send(result);
  });

  // POST /admin/withdrawals/:id/process - Processar saque
  fastify.post('/withdrawals/:id/process', async (request: any, reply: any) => {
    const { approved, notes } = request.body;

    if (approved === undefined) {
      return reply.status(400).send({ error: 'approved é obrigatório' });
    }

    const result = await adminService.processWithdrawal(request.params.id, request.user!.id, approved, notes);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: approved ? 'Saque aprovado' : 'Saque rejeitado' });
  });

  // ==================== PARTIDAS ====================

  // GET /admin/matches - Listar partidas
  fastify.get('/matches', async (request: any, reply: any) => {
    const { limit, offset, status } = request.query;
    const result = await adminService.listMatches(
      status,
      Math.min(limit || 50, 100),
      offset || 0
    );
    return reply.send(result);
  });

  // POST /admin/matches/:id/force-end - Encerrar partida
  fastify.post('/matches/:id/force-end', async (request: any, reply: any) => {
    const { winner_id } = request.body;

    const result = await adminService.forceEndMatch(request.params.id, winner_id || null, request.user!.id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: winner_id ? 'Partida finalizada' : 'Partida cancelada' });
  });

  // ==================== LOGS ====================

  // GET /admin/logs - Listar logs
  fastify.get('/logs', async (request: any, reply: any) => {
    const { limit, offset, admin_id, action } = request.query;
    const result = await adminService.listLogs(
      admin_id,
      action,
      Math.min(limit || 100, 500),
      offset || 0
    );
    return reply.send(result);
  });
}
