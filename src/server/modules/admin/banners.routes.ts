// =====================================================
// ROTAS DE GERENCIAMENTO DE BANNERS
// =====================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { bannersService, CreateBannerDTO } from './banners.service.js';
import { requirePermission, getClientIP } from '../../middlewares/rbac.middleware.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { auditService } from './audit.service.js';

interface ListQuery {
  position?: string;
  is_active?: string;
  limit?: number;
  offset?: number;
}

// =====================================================
// ROTAS PÚBLICAS (para exibição)
// =====================================================
export async function publicBannersRoutes(fastify: FastifyInstance) {
  // GET /banners - Obter banners ativos
  fastify.get('/', async (request: FastifyRequest<{ Querystring: { position?: string } }>, reply: FastifyReply) => {
    try {
      const banners = await bannersService.getActiveBanners(request.query.position);
      return reply.send({ banners });
    } catch (error: any) {
      console.error('Erro ao buscar banners:', error);
      return reply.status(500).send({ error: 'Erro ao carregar banners' });
    }
  });

  // GET /banners/featured-tournaments - Torneios em destaque
  fastify.get('/featured-tournaments', async (request: FastifyRequest<{ Querystring: { limit?: number } }>, reply: FastifyReply) => {
    try {
      const limit = request.query.limit || 6;
      const tournaments = await bannersService.getFeaturedTournaments(limit);
      return reply.send({ tournaments });
    } catch (error: any) {
      console.error('Erro ao buscar torneios em destaque:', error);
      return reply.status(500).send({ error: 'Erro ao carregar torneios' });
    }
  });

  // POST /banners/:id/view - Registrar visualização
  fastify.post('/:id/view', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      await bannersService.trackView(request.params.id);
      return reply.send({ success: true });
    } catch (error) {
      return reply.send({ success: false });
    }
  });

  // POST /banners/:id/click - Registrar clique
  fastify.post('/:id/click', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      await bannersService.trackClick(request.params.id);
      return reply.send({ success: true });
    } catch (error) {
      return reply.send({ success: false });
    }
  });
}

// =====================================================
// ROTAS ADMIN (gerenciamento)
// =====================================================
export async function adminBannersRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /admin/banners - Listar todos os banners
  fastify.get('/', {
    preHandler: requirePermission('manage_settings'),
  }, async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
    try {
      const result = await bannersService.listBanners({
        position: request.query.position,
        is_active: request.query.is_active === 'true' ? true : request.query.is_active === 'false' ? false : undefined,
        limit: request.query.limit,
        offset: request.query.offset,
      });
      return reply.send(result);
    } catch (error: any) {
      console.error('Erro ao listar banners:', error);
      return reply.status(500).send({ error: 'Erro ao listar banners' });
    }
  });

  // POST /admin/banners - Criar banner
  fastify.post('/', {
    preHandler: requirePermission('manage_settings'),
  }, async (request: FastifyRequest<{ Body: CreateBannerDTO }>, reply: FastifyReply) => {
    try {
      const { title } = request.body;
      if (!title) {
        return reply.status(400).send({ error: 'Título é obrigatório' });
      }

      const banner = await bannersService.createBanner(request.user!.id, request.body);

      await auditService.log({
        adminId: request.user!.id,
        action: 'banner_create',
        targetType: 'banner',
        targetId: banner.id,
        details: { title: banner.title, position: banner.position },
        ipAddress: getClientIP(request),
      });

      return reply.status(201).send({ banner, message: 'Banner criado com sucesso' });
    } catch (error: any) {
      console.error('Erro ao criar banner:', error);
      return reply.status(500).send({ error: 'Erro ao criar banner' });
    }
  });

  // PUT /admin/banners/:id - Atualizar banner
  fastify.put('/:id', {
    preHandler: requirePermission('manage_settings'),
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: Partial<CreateBannerDTO> }>, reply: FastifyReply) => {
    try {
      const banner = await bannersService.updateBanner(request.params.id, request.body);

      await auditService.log({
        adminId: request.user!.id,
        action: 'banner_update',
        targetType: 'banner',
        targetId: request.params.id,
        details: request.body,
        ipAddress: getClientIP(request),
      });

      return reply.send({ banner, message: 'Banner atualizado' });
    } catch (error: any) {
      console.error('Erro ao atualizar banner:', error);
      return reply.status(500).send({ error: 'Erro ao atualizar banner' });
    }
  });

  // DELETE /admin/banners/:id - Excluir banner
  fastify.delete('/:id', {
    preHandler: requirePermission('manage_settings'),
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      await bannersService.deleteBanner(request.params.id);

      await auditService.log({
        adminId: request.user!.id,
        action: 'banner_delete',
        targetType: 'banner',
        targetId: request.params.id,
        ipAddress: getClientIP(request),
      });

      return reply.send({ message: 'Banner excluído' });
    } catch (error: any) {
      console.error('Erro ao excluir banner:', error);
      return reply.status(500).send({ error: 'Erro ao excluir banner' });
    }
  });

  // POST /admin/banners/reorder - Reordenar banners
  fastify.post('/reorder', {
    preHandler: requirePermission('manage_settings'),
  }, async (request: FastifyRequest<{ Body: { bannerIds: string[] } }>, reply: FastifyReply) => {
    try {
      const { bannerIds } = request.body;
      if (!bannerIds || !Array.isArray(bannerIds)) {
        return reply.status(400).send({ error: 'Lista de IDs é obrigatória' });
      }

      await bannersService.reorderBanners(bannerIds);
      return reply.send({ message: 'Ordem atualizada' });
    } catch (error: any) {
      console.error('Erro ao reordenar banners:', error);
      return reply.status(500).send({ error: 'Erro ao reordenar' });
    }
  });

  // POST /admin/banners/tournaments/:id/feature - Destacar torneio
  fastify.post('/tournaments/:id/feature', {
    preHandler: requirePermission('manage_tournaments'),
  }, async (request: FastifyRequest<{ 
    Params: { id: string }; 
    Body: { is_featured: boolean; featured_order?: number } 
  }>, reply: FastifyReply) => {
    try {
      const { is_featured, featured_order } = request.body;
      const tournament = await bannersService.toggleTournamentFeatured(
        request.params.id,
        is_featured,
        featured_order
      );

      await auditService.log({
        adminId: request.user!.id,
        action: is_featured ? 'tournament_feature' : 'tournament_unfeature',
        targetType: 'tournament',
        targetId: request.params.id,
        details: { is_featured, featured_order },
        ipAddress: getClientIP(request),
      });

      return reply.send({ 
        tournament, 
        message: is_featured ? 'Torneio destacado' : 'Destaque removido' 
      });
    } catch (error: any) {
      console.error('Erro ao destacar torneio:', error);
      return reply.status(500).send({ error: 'Erro ao destacar torneio' });
    }
  });

  // PUT /admin/banners/tournaments/:id/banner - Atualizar banner do torneio
  fastify.put('/tournaments/:id/banner', {
    preHandler: requirePermission('manage_tournaments'),
  }, async (request: FastifyRequest<{ 
    Params: { id: string }; 
    Body: { banner_image_url?: string; banner_color?: string } 
  }>, reply: FastifyReply) => {
    try {
      const { banner_image_url, banner_color } = request.body;
      const tournament = await bannersService.updateTournamentBanner(
        request.params.id,
        banner_image_url,
        banner_color
      );

      return reply.send({ tournament, message: 'Banner do torneio atualizado' });
    } catch (error: any) {
      console.error('Erro ao atualizar banner do torneio:', error);
      return reply.status(500).send({ error: 'Erro ao atualizar banner' });
    }
  });
}
