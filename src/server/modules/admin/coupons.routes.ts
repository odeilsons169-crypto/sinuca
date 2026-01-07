// =====================================================
// ROTAS DE CUPONS DE DESCONTO
// =====================================================

import { FastifyInstance } from 'fastify';
import { couponsService } from './coupons.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { adminMiddleware } from '../../middlewares/admin.middleware.js';

export async function couponsRoutes(fastify: FastifyInstance) {
  // ==================== ADMIN ====================

  // Listar todos os cupons
  fastify.get('/', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const coupons = await couponsService.listAll();
      return { success: true, coupons };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Criar cupom
  fastify.post('/', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const {
        code,
        description,
        discount_type,
        discount_value,
        min_purchase,
        max_discount,
        max_uses,
        max_uses_per_user,
        valid_from,
        valid_until,
      } = request.body as any;

      const adminId = (request as any).user.id;

      if (!code || !discount_type || !discount_value) {
        return reply.status(400).send({ error: 'Código, tipo e valor do desconto são obrigatórios' });
      }

      const result = await couponsService.create({
        code,
        description,
        discount_type,
        discount_value: Number(discount_value),
        min_purchase: min_purchase ? Number(min_purchase) : undefined,
        max_discount: max_discount ? Number(max_discount) : undefined,
        max_uses: max_uses ? Number(max_uses) : undefined,
        max_uses_per_user: max_uses_per_user ? Number(max_uses_per_user) : undefined,
        valid_from,
        valid_until,
        adminId,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { success: true, coupon: result.coupon };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Atualizar cupom
  fastify.put('/:id', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const updates = request.body as any;
      const adminId = (request as any).user.id;

      const result = await couponsService.update(id, updates, adminId);

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { success: true, message: 'Cupom atualizado' };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Desativar cupom
  fastify.delete('/:id', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const adminId = (request as any).user.id;

      const result = await couponsService.deactivate(id, adminId);

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { success: true, message: 'Cupom desativado' };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Estatísticas de cupom
  fastify.get('/:id/stats', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const stats = await couponsService.getStats(id);
      return { success: true, stats };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // ==================== USUÁRIO ====================

  // Validar cupom (público para usuários logados)
  fastify.post('/validate', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { code, amount } = request.body as { code: string; amount: number };
      const userId = (request as any).user.id;

      if (!code || !amount) {
        return reply.status(400).send({ error: 'Código e valor são obrigatórios' });
      }

      const result = await couponsService.validate(code, userId, Number(amount));

      if (!result.valid) {
        return reply.status(400).send({ error: result.error });
      }

      return {
        success: true,
        discount: result.discount,
        finalAmount: result.finalAmount,
        coupon: {
          id: result.coupon!.id,
          code: result.coupon!.code,
          description: result.coupon!.description,
          discount_type: result.coupon!.discount_type,
          discount_value: result.coupon!.discount_value,
        },
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
