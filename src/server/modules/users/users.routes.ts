import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { usersService } from './users.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

interface UpdateProfileBody {
  username?: string;
  avatar_url?: string;
}

interface SearchQuery {
  q: string;
  limit?: number;
}

interface HistoryQuery {
  limit?: number;
  offset?: number;
}

export async function usersRoutes(fastify: FastifyInstance) {
  // GET /users/me - Perfil completo do usuário logado
  fastify.get('/me', { preHandler: authMiddleware }, async (request: FastifyRequest, reply: FastifyReply) => {
    const profile = await usersService.getFullProfile(request.user!.id);

    if (!profile) {
      return reply.status(404).send({ error: 'Perfil não encontrado' });
    }

    return reply.send(profile);
  });

  // PUT /users/me - Atualizar perfil
  fastify.put('/me', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Body: UpdateProfileBody }>, reply: FastifyReply) => {
    const { username, avatar_url } = request.body;

    if (username && username.length < 3) {
      return reply.status(400).send({ error: 'Username deve ter no mínimo 3 caracteres' });
    }

    const result = await usersService.updateProfile(request.user!.id, { username, avatar_url });

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ user: result.user });
  });

  // GET /users/me/stats - Estatísticas do usuário
  fastify.get('/me/stats', { preHandler: authMiddleware }, async (request: FastifyRequest, reply: FastifyReply) => {
    const stats = await usersService.getStats(request.user!.id);

    if (!stats) {
      return reply.status(404).send({ error: 'Estatísticas não encontradas' });
    }

    return reply.send(stats);
  });

  // GET /users/me/history - Histórico de partidas
  fastify.get('/me/history', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Querystring: HistoryQuery }>, reply: FastifyReply) => {
    const limit = Math.min(request.query.limit || 20, 100);
    const offset = request.query.offset || 0;

    const result = await usersService.getMatchHistory(request.user!.id, limit, offset);

    return reply.send(result);
  });

  // GET /users/search - Buscar usuários
  fastify.get('/search', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Querystring: SearchQuery }>, reply: FastifyReply) => {
    const { q, limit } = request.query;

    if (!q || q.length < 2) {
      return reply.status(400).send({ error: 'Busca deve ter no mínimo 2 caracteres' });
    }

    const users = await usersService.search(q, Math.min(limit || 10, 50));

    return reply.send({ users });
  });

  // GET /users/:id - Perfil público de outro usuário
  fastify.get('/:id', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const profile = await usersService.getFullProfile(request.params.id);

    if (!profile) {
      return reply.status(404).send({ error: 'Usuário não encontrado' });
    }

    // Remover dados sensíveis para perfil público
    const { email, ...publicProfile } = profile;

    return reply.send(publicProfile);
  });
}
