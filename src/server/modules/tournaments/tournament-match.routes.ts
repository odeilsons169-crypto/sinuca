// =====================================================
// ROTAS DE PARTIDAS DE TORNEIO
// 
// Endpoints para:
// - Criar partidas de torneio
// - Iniciar partidas
// - Finalizar partidas (sincroniza tudo automaticamente)
// - Obter classificação/standings
// - Obter partidas ao vivo
// =====================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tournamentMatchService } from './tournament-match.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

interface TournamentParams {
  tournamentId: string;
}

interface MatchParams {
  matchId: string;
}

interface BracketMatchParams {
  tournamentId: string;
  bracketMatchId: string;
}

interface FinishMatchBody {
  winnerId: string;
  player1Score?: number;
  player2Score?: number;
}

export async function tournamentMatchRoutes(fastify: FastifyInstance) {
  // =====================================================
  // ROTAS PÚBLICAS
  // =====================================================

  // GET /tournament-matches/:tournamentId/standings - Classificação do torneio
  fastify.get('/:tournamentId/standings', async (
    request: FastifyRequest<{ Params: TournamentParams }>,
    reply: FastifyReply
  ) => {
    try {
      const standings = await tournamentMatchService.getTournamentStandings(
        request.params.tournamentId
      );
      return reply.send({ standings });
    } catch (error: any) {
      console.error('Erro ao buscar classificação:', error);
      return reply.status(500).send({ error: 'Erro ao buscar classificação' });
    }
  });

  // GET /tournament-matches/:tournamentId/live - Partidas ao vivo
  fastify.get('/:tournamentId/live', async (
    request: FastifyRequest<{ Params: TournamentParams }>,
    reply: FastifyReply
  ) => {
    try {
      const matches = await tournamentMatchService.getLiveMatches(
        request.params.tournamentId
      );
      return reply.send({ matches });
    } catch (error: any) {
      console.error('Erro ao buscar partidas ao vivo:', error);
      return reply.status(500).send({ error: 'Erro ao buscar partidas ao vivo' });
    }
  });

  // GET /tournament-matches/:tournamentId/upcoming - Próximas partidas
  fastify.get('/:tournamentId/upcoming', async (
    request: FastifyRequest<{ Params: TournamentParams }>,
    reply: FastifyReply
  ) => {
    try {
      const matches = await tournamentMatchService.getUpcomingMatches(
        request.params.tournamentId
      );
      return reply.send({ matches });
    } catch (error: any) {
      console.error('Erro ao buscar próximas partidas:', error);
      return reply.status(500).send({ error: 'Erro ao buscar próximas partidas' });
    }
  });

  // GET /tournament-matches/:tournamentId/history - Histórico de partidas
  fastify.get('/:tournamentId/history', async (
    request: FastifyRequest<{ Params: TournamentParams }>,
    reply: FastifyReply
  ) => {
    try {
      const matches = await tournamentMatchService.getFinishedMatches(
        request.params.tournamentId
      );
      return reply.send({ matches });
    } catch (error: any) {
      console.error('Erro ao buscar histórico:', error);
      return reply.status(500).send({ error: 'Erro ao buscar histórico' });
    }
  });

  // =====================================================
  // ROTAS AUTENTICADAS
  // =====================================================

  // POST /tournament-matches/:tournamentId/:bracketMatchId/create - Criar partida
  fastify.post('/:tournamentId/:bracketMatchId/create', {
    preHandler: authMiddleware,
  }, async (
    request: FastifyRequest<{ Params: BracketMatchParams }>,
    reply: FastifyReply
  ) => {
    try {
      const result = await tournamentMatchService.createTournamentMatch(
        request.params.tournamentId,
        request.params.bracketMatchId
      );

      if (result.error) {
        return reply.status(400).send({ error: result.error });
      }

      return reply.status(201).send({
        message: 'Partida criada com sucesso',
        roomId: result.roomId,
        matchId: result.matchId,
      });
    } catch (error: any) {
      console.error('Erro ao criar partida de torneio:', error);
      return reply.status(500).send({ error: 'Erro ao criar partida' });
    }
  });

  // POST /tournament-matches/:matchId/start - Iniciar partida
  fastify.post('/match/:matchId/start', {
    preHandler: authMiddleware,
  }, async (
    request: FastifyRequest<{ Params: MatchParams }>,
    reply: FastifyReply
  ) => {
    try {
      const result = await tournamentMatchService.startTournamentMatch(
        request.params.matchId
      );

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return reply.send({ message: 'Partida iniciada' });
    } catch (error: any) {
      console.error('Erro ao iniciar partida:', error);
      return reply.status(500).send({ error: 'Erro ao iniciar partida' });
    }
  });

  // POST /tournament-matches/:matchId/finish - Finalizar partida
  // ESTE É O ENDPOINT PRINCIPAL - sincroniza TUDO automaticamente
  fastify.post('/match/:matchId/finish', {
    preHandler: authMiddleware,
  }, async (
    request: FastifyRequest<{ Params: MatchParams; Body: FinishMatchBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { winnerId, player1Score = 0, player2Score = 0 } = request.body;

      if (!winnerId) {
        return reply.status(400).send({ error: 'winnerId é obrigatório' });
      }

      const result = await tournamentMatchService.finishTournamentMatch(
        request.params.matchId,
        winnerId,
        player1Score,
        player2Score
      );

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return reply.send({
        message: result.result?.tournamentFinished 
          ? 'Torneio finalizado! Parabéns ao campeão!' 
          : 'Partida finalizada. Vencedor avançou para próxima fase.',
        result: result.result,
      });
    } catch (error: any) {
      console.error('Erro ao finalizar partida:', error);
      return reply.status(500).send({ error: 'Erro ao finalizar partida' });
    }
  });
}
