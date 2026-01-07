import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { musicService } from './music.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';

interface TrackBody {
  title: string;
  artist?: string;
  source_type: 'upload' | 'youtube';
  file_url?: string;
  youtube_url?: string;
  youtube_id?: string;
  youtube_embed?: string; // Código de incorporação do YouTube
  duration?: number;
  thumbnail_url?: string;
  genre?: string;
  display_order?: number;
  is_active?: boolean;
}

export async function musicRoutes(fastify: FastifyInstance) {
  // ==================== ROTAS PÚBLICAS ====================

  // GET /music/playlist - Listar músicas ativas
  fastify.get('/playlist', async (request: FastifyRequest<{ Querystring: { genre?: string } }>, reply: FastifyReply) => {
    const genre = request.query.genre;
    const tracks = await musicService.getActiveTracks(genre);
    return reply.send({ tracks });
  });

  // GET /music/genres - Listar gêneros disponíveis
  fastify.get('/genres', async (request: FastifyRequest, reply: FastifyReply) => {
    const genres = await musicService.getGenres();
    return reply.send({ genres });
  });

  // GET /music/track/:id - Buscar música por ID
  fastify.get('/track/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const track = await musicService.getTrackById(request.params.id);
    if (!track) {
      return reply.status(404).send({ error: 'Música não encontrada' });
    }
    return reply.send({ track });
  });

  // ==================== ROTAS DO USUÁRIO ====================

  // GET /music/preferences - Obter preferências do usuário
  fastify.get('/preferences', { preHandler: authMiddleware }, async (request: FastifyRequest, reply: FastifyReply) => {
    const prefs = await musicService.getUserPreferences(request.user!.id);
    return reply.send({ preferences: prefs });
  });

  // PUT /music/preferences - Salvar preferências do usuário
  fastify.put('/preferences', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const result = await musicService.saveUserPreferences(request.user!.id, request.body);
    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }
    return reply.send(result);
  });

  // POST /music/log-play - Registrar reprodução
  fastify.post('/log-play', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Body: { trackId: string; context?: string } }>, reply: FastifyReply) => {
    await musicService.logPlayback(request.user!.id, request.body.trackId, request.body.context);
    return reply.send({ success: true });
  });

  // ==================== ROTAS ADMIN ====================

  // GET /music/admin/tracks - Listar todas as músicas (admin)
  fastify.get('/admin/tracks', {
    preHandler: [authMiddleware, requirePermission('manage_music')],
  }, async (request: FastifyRequest<{ Querystring: { includeInactive?: string } }>, reply: FastifyReply) => {
    const includeInactive = request.query.includeInactive === 'true';
    const tracks = await musicService.getAllTracks(includeInactive);
    return reply.send({ tracks });
  });

  // POST /music/admin/tracks - Adicionar música (admin)
  fastify.post('/admin/tracks', {
    preHandler: [authMiddleware, requirePermission('manage_music')],
  }, async (request: FastifyRequest<{ Body: TrackBody }>, reply: FastifyReply) => {
    const body = request.body;

    // Extrair ID do YouTube de várias fontes
    let youtubeId = body.youtube_id;
    
    // Tentar extrair do código de incorporação (embed)
    if (!youtubeId && body.youtube_embed) {
      youtubeId = musicService.extractYouTubeIdFromEmbed(body.youtube_embed);
    }
    
    // Tentar extrair da URL
    if (!youtubeId && body.youtube_url) {
      youtubeId = musicService.extractYouTubeId(body.youtube_url);
    }
    
    if (body.source_type === 'youtube' && !youtubeId) {
      return reply.status(400).send({ error: 'Código de incorporação ou URL do YouTube inválido' });
    }

    const result = await musicService.addTrack({
      title: body.title,
      artist: body.artist,
      source_type: body.source_type,
      file_url: body.file_url,
      youtube_id: youtubeId,
      duration: body.duration,
      thumbnail_url: body.thumbnail_url || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg` : undefined),
      genre: body.genre,
      display_order: body.display_order,
      is_active: body.is_active,
    }, request.user!.id);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send(result);
  });

  // PUT /music/admin/tracks/:id - Atualizar música (admin)
  fastify.put('/admin/tracks/:id', {
    preHandler: [authMiddleware, requirePermission('manage_music')],
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: TrackBody }>, reply: FastifyReply) => {
    const body = request.body;

    // Extrair ID do YouTube de várias fontes
    let youtubeId = body.youtube_id;
    
    // Tentar extrair do código de incorporação (embed)
    if (!youtubeId && body.youtube_embed) {
      youtubeId = musicService.extractYouTubeIdFromEmbed(body.youtube_embed);
    }
    
    // Tentar extrair da URL
    if (!youtubeId && body.youtube_url) {
      youtubeId = musicService.extractYouTubeId(body.youtube_url);
    }
    
    if (body.source_type === 'youtube' && !youtubeId) {
      return reply.status(400).send({ error: 'Código de incorporação ou URL do YouTube inválido' });
    }

    const result = await musicService.updateTrack(request.params.id, {
      title: body.title,
      artist: body.artist,
      source_type: body.source_type,
      file_url: body.file_url,
      youtube_id: youtubeId,
      duration: body.duration,
      thumbnail_url: body.thumbnail_url || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg` : undefined),
      genre: body.genre,
      display_order: body.display_order,
      is_active: body.is_active,
    });

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send(result);
  });

  // DELETE /music/admin/tracks/:id - Deletar música (admin)
  fastify.delete('/admin/tracks/:id', {
    preHandler: [authMiddleware, requirePermission('manage_music')],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const result = await musicService.deleteTrack(request.params.id);
    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }
    return reply.send(result);
  });

  // PATCH /music/admin/tracks/:id/toggle - Toggle ativo/inativo (admin)
  fastify.patch('/admin/tracks/:id/toggle', {
    preHandler: [authMiddleware, requirePermission('manage_music')],
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { is_active: boolean } }>, reply: FastifyReply) => {
    const result = await musicService.toggleTrackActive(request.params.id, request.body.is_active);
    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }
    return reply.send(result);
  });

  // PUT /music/admin/reorder - Reordenar músicas (admin)
  fastify.put('/admin/reorder', {
    preHandler: [authMiddleware, requirePermission('manage_music')],
  }, async (request: FastifyRequest<{ Body: { trackIds: string[] } }>, reply: FastifyReply) => {
    const result = await musicService.reorderTracks(request.body.trackIds);
    return reply.send(result);
  });

  // GET /music/admin/stats - Estatísticas de reprodução (admin)
  fastify.get('/admin/stats', {
    preHandler: [authMiddleware, requirePermission('manage_music')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = await musicService.getPlaybackStats();
    return reply.send({ stats });
  });

  // POST /music/admin/youtube-info - Obter info do YouTube (admin)
  fastify.post('/admin/youtube-info', {
    preHandler: [authMiddleware, requirePermission('manage_music')],
  }, async (request: FastifyRequest<{ Body: { url?: string; embed?: string } }>, reply: FastifyReply) => {
    let youtubeId: string | null = null;
    
    // Tentar extrair do embed primeiro
    if (request.body.embed) {
      youtubeId = musicService.extractYouTubeIdFromEmbed(request.body.embed);
    }
    
    // Tentar extrair da URL
    if (!youtubeId && request.body.url) {
      youtubeId = musicService.extractYouTubeId(request.body.url);
    }
    
    if (!youtubeId) {
      return reply.status(400).send({ error: 'Código de incorporação ou URL do YouTube inválido' });
    }

    // Retornar info básica (thumbnail)
    return reply.send({
      youtube_id: youtubeId,
      thumbnail_url: `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`,
      embed_url: `https://www.youtube.com/embed/${youtubeId}`,
    });
  });
}
