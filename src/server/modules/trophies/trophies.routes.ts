// =====================================================
// ROTAS DE TROFÉUS VIRTUAIS
// =====================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { trophiesService } from './trophies.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRole } from '../../middlewares/rbac.middleware.js';

export async function trophiesRoutes(fastify: FastifyInstance) {
  // =====================================================
  // ROTAS PÚBLICAS
  // =====================================================

  // GET /trophies - Listar troféus disponíveis
  fastify.get('/', async (request: FastifyRequest<{ 
    Querystring: { category?: string; rarity?: string } 
  }>, reply: FastifyReply) => {
    try {
      const trophies = await trophiesService.listTrophies(request.query);
      return reply.send({ trophies });
    } catch (error: any) {
      return reply.status(500).send({ error: 'Erro ao listar troféus' });
    }
  });

  // GET /trophies/:id - Detalhes do troféu
  fastify.get('/:id', async (request: FastifyRequest<{ 
    Params: { id: string } 
  }>, reply: FastifyReply) => {
    try {
      const trophy = await trophiesService.getTrophy(request.params.id);
      if (!trophy) {
        return reply.status(404).send({ error: 'Troféu não encontrado' });
      }
      return reply.send(trophy);
    } catch (error: any) {
      return reply.status(500).send({ error: 'Erro ao carregar troféu' });
    }
  });

  // GET /trophies/room/:userId - Sala de troféus de um usuário
  fastify.get('/room/:userId', async (request: FastifyRequest<{ 
    Params: { userId: string } 
  }>, reply: FastifyReply) => {
    try {
      const requesterId = (request as any).user?.id;
      const room = await trophiesService.getUserTrophyRoom(
        request.params.userId,
        requesterId
      );
      
      if (!room.canView) {
        return reply.status(403).send({ 
          error: 'Sala de troféus privada',
          isPrivate: true 
        });
      }
      
      return reply.send(room);
    } catch (error: any) {
      return reply.status(500).send({ error: 'Erro ao carregar sala de troféus' });
    }
  });

  // =====================================================
  // ROTAS AUTENTICADAS
  // =====================================================

  // GET /trophies/my/room - Minha sala de troféus
  fastify.get('/my/room', {
    preHandler: authMiddleware,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const room = await trophiesService.getUserTrophyRoom(
        request.user!.id,
        request.user!.id
      );
      return reply.send(room);
    } catch (error: any) {
      return reply.status(500).send({ error: 'Erro ao carregar sua sala de troféus' });
    }
  });

  // GET /trophies/my/featured - Meus troféus em destaque
  fastify.get('/my/featured', {
    preHandler: authMiddleware,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const trophies = await trophiesService.getFeaturedTrophies(request.user!.id);
      return reply.send({ trophies });
    } catch (error: any) {
      return reply.status(500).send({ error: 'Erro ao carregar troféus em destaque' });
    }
  });

  // PUT /trophies/my/settings - Atualizar configurações da sala
  fastify.put('/my/settings', {
    preHandler: authMiddleware,
  }, async (request: FastifyRequest<{ 
    Body: { is_public?: boolean; display_style?: string; background_theme?: string } 
  }>, reply: FastifyReply) => {
    try {
      const settings = await trophiesService.updateTrophyRoomSettings(
        request.user!.id,
        request.body
      );
      return reply.send({ settings, message: 'Configurações atualizadas' });
    } catch (error: any) {
      return reply.status(500).send({ error: 'Erro ao atualizar configurações' });
    }
  });

  // POST /trophies/my/:trophyId/toggle-featured - Destacar/remover destaque
  fastify.post('/my/:trophyId/toggle-featured', {
    preHandler: authMiddleware,
  }, async (request: FastifyRequest<{ 
    Params: { trophyId: string } 
  }>, reply: FastifyReply) => {
    try {
      const isFeatured = await trophiesService.toggleFeaturedTrophy(
        request.user!.id,
        request.params.trophyId
      );
      return reply.send({ 
        isFeatured, 
        message: isFeatured ? 'Troféu destacado!' : 'Destaque removido' 
      });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message || 'Erro ao atualizar destaque' });
    }
  });

  // =====================================================
  // ROTAS ADMIN
  // =====================================================

  // POST /trophies - Criar troféu (admin)
  fastify.post('/', {
    preHandler: [authMiddleware, requireRole('admin')],
  }, async (request: FastifyRequest<{ 
    Body: { name: string; description?: string; image_url: string; rarity?: string; category?: string } 
  }>, reply: FastifyReply) => {
    try {
      const trophy = await trophiesService.createTrophy(request.user!.id, request.body);
      return reply.status(201).send({ trophy, message: 'Troféu criado!' });
    } catch (error: any) {
      return reply.status(500).send({ error: 'Erro ao criar troféu' });
    }
  });

  // PUT /trophies/:id - Atualizar troféu (admin)
  fastify.put('/:id', {
    preHandler: [authMiddleware, requireRole('admin')],
  }, async (request: FastifyRequest<{ 
    Params: { id: string };
    Body: Partial<{ name: string; description: string; image_url: string; rarity: string; category: string; is_active: boolean }> 
  }>, reply: FastifyReply) => {
    try {
      const trophy = await trophiesService.updateTrophy(request.params.id, request.body);
      return reply.send({ trophy, message: 'Troféu atualizado!' });
    } catch (error: any) {
      return reply.status(500).send({ error: 'Erro ao atualizar troféu' });
    }
  });

  // POST /trophies/award - Conceder troféu manualmente (admin)
  fastify.post('/award', {
    preHandler: [authMiddleware, requireRole('admin')],
  }, async (request: FastifyRequest<{ 
    Body: { userId: string; trophyId: string; tournamentId?: string; position?: number } 
  }>, reply: FastifyReply) => {
    try {
      const { userId, trophyId, tournamentId, position } = request.body;
      const userTrophy = await trophiesService.awardTrophy(userId, trophyId, tournamentId, position);
      return reply.send({ userTrophy, message: 'Troféu concedido!' });
    } catch (error: any) {
      return reply.status(500).send({ error: 'Erro ao conceder troféu' });
    }
  });
}
