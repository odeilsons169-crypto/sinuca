// =====================================================
// ROTAS DE NÍVEIS - API de XP e Progressão
// =====================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { levelService, getLevelTitle, getLevelColor, getXpForLevel, XP_CONFIG } from './level.service';

export async function levelRoutes(fastify: FastifyInstance) {
  // Buscar nível do usuário logado
  fastify.get('/me', { preHandler: authMiddleware }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user!.id;
      const levelInfo = await levelService.getUserLevel(userId);
      
      if (!levelInfo) {
        return reply.status(404).send({ error: 'Informações de nível não encontradas' });
      }
      
      return reply.send({
        success: true,
        data: levelInfo
      });
    } catch (error) {
      console.error('[LevelRoutes] Erro ao buscar nível:', error);
      return reply.status(500).send({ error: 'Erro interno do servidor' });
    }
  });
  
  // Buscar nível de um usuário específico
  fastify.get('/:userId', { preHandler: authMiddleware }, async (
    request: FastifyRequest<{ Params: { userId: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { userId } = request.params;
      const levelInfo = await levelService.getUserLevel(userId);
      
      if (!levelInfo) {
        return reply.status(404).send({ error: 'Usuário não encontrado' });
      }
      
      return reply.send({
        success: true,
        data: levelInfo
      });
    } catch (error) {
      console.error('[LevelRoutes] Erro ao buscar nível:', error);
      return reply.status(500).send({ error: 'Erro interno do servidor' });
    }
  });
  
  // Ranking por nível
  fastify.get('/ranking/top', async (
    request: FastifyRequest<{ Querystring: { limit?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const limit = parseInt(request.query.limit || '10', 10);
      const ranking = await levelService.getLevelRanking(Math.min(limit, 100));
      
      return reply.send({
        success: true,
        data: ranking
      });
    } catch (error) {
      console.error('[LevelRoutes] Erro ao buscar ranking:', error);
      return reply.status(500).send({ error: 'Erro interno do servidor' });
    }
  });
  
  // Informações sobre o sistema de níveis
  fastify.get('/info', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Gerar tabela de níveis (1-100)
      const levelTable = [];
      for (let i = 1; i <= 100; i++) {
        levelTable.push({
          level: i,
          xpRequired: getXpForLevel(i),
          title: getLevelTitle(i),
          color: getLevelColor(i)
        });
      }
      
      return reply.send({
        success: true,
        data: {
          xpConfig: XP_CONFIG,
          levelTable: levelTable.slice(0, 20), // Primeiros 20 níveis
          titles: [
            { minLevel: 1, title: 'Novato', color: '#808080' },
            { minLevel: 5, title: 'Aprendiz', color: '#daa520' },
            { minLevel: 10, title: 'Intermediário', color: '#87ceeb' },
            { minLevel: 15, title: 'Habilidoso', color: '#87ceeb' },
            { minLevel: 20, title: 'Experiente', color: '#32cd32' },
            { minLevel: 30, title: 'Veterano', color: '#00bfff' },
            { minLevel: 40, title: 'Especialista', color: '#9400d3' },
            { minLevel: 50, title: 'Mestre', color: '#ff8c00' },
            { minLevel: 60, title: 'Grão-Mestre', color: '#ffd700' },
            { minLevel: 80, title: 'Mestre Supremo', color: '#ff00ff' },
            { minLevel: 100, title: 'Lenda', color: '#ff0000' },
          ]
        }
      });
    } catch (error) {
      console.error('[LevelRoutes] Erro ao buscar info:', error);
      return reply.status(500).send({ error: 'Erro interno do servidor' });
    }
  });
}
