// =====================================================
// ROTAS PÚBLICAS E DE JOGADORES PARA TORNEIOS
// =====================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tournamentsService } from './admin/tournaments.service.js';
import { subscriptionsService } from './subscriptions/subscriptions.service.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

interface ListQuery {
    status?: string;
    limit?: number;
}

export async function publicTournamentsRoutes(fastify: FastifyInstance) {
    // =====================================================
    // ROTAS PÚBLICAS (sem autenticação)
    // =====================================================

    // GET /tournaments - Listar torneios abertos (público)
    fastify.get('/', async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
        try {
            const { status = 'open', limit = 6 } = request.query;

            // Apenas torneios com status 'open' ou 'in_progress' são públicos
            const allowedStatuses = ['open', 'in_progress'];
            const queryStatus = allowedStatuses.includes(status) ? status : 'open';

            const result = await tournamentsService.listTournaments({
                status: queryStatus,
                limit: Math.min(Number(limit) || 6, 20), // Máximo 20
            });

            return reply.send(result);
        } catch (error: any) {
            console.error('Erro ao listar torneios públicos:', error);
            return reply.status(500).send({ error: 'Erro ao carregar torneios' });
        }
    });

    // GET /tournaments/:id - Detalhes de um torneio (público)
    fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        try {
            const tournament = await tournamentsService.getTournamentDetail(request.params.id);

            if (!tournament) {
                return reply.status(404).send({ error: 'Torneio não encontrado' });
            }

            // Apenas torneios abertos ou em progresso são públicos
            if (!['open', 'in_progress', 'finished'].includes(tournament.status)) {
                return reply.status(404).send({ error: 'Torneio não encontrado' });
            }

            return reply.send(tournament);
        } catch (error: any) {
            console.error('Erro ao carregar torneio:', error);
            return reply.status(500).send({ error: 'Erro ao carregar torneio' });
        }
    });

    // GET /tournaments/:id/prize-info - Informações de premiação (público)
    fastify.get('/:id/prize-info', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        try {
            const prizeInfo = await tournamentsService.getTournamentPrizeInfo(request.params.id);

            if (!prizeInfo) {
                return reply.status(404).send({ error: 'Torneio não encontrado' });
            }

            return reply.send({
                ...prizeInfo,
                rules: {
                    prize_percentage: 70,
                    platform_fee_percentage: 30,
                    description: 'A premiação é calculada automaticamente: 70% do valor total arrecadado com as inscrições vai para os vencedores. Os outros 30% são destinados à manutenção da plataforma.',
                },
            });
        } catch (error: any) {
            console.error('Erro ao carregar premiação:', error);
            return reply.status(500).send({ error: 'Erro ao carregar informações de premiação' });
        }
    });

    // GET /tournaments/:id/bracket - Bracket visual do torneio (público)
    fastify.get('/:id/bracket', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        try {
            const bracket = await tournamentsService.getTournamentBracket(request.params.id);
            
            if (!bracket) {
                return reply.status(404).send({ error: 'Bracket não encontrado' });
            }

            return reply.send(bracket);
        } catch (error: any) {
            console.error('Erro ao carregar bracket:', error);
            return reply.status(500).send({ error: 'Erro ao carregar bracket' });
        }
    });

    // =====================================================
    // ROTAS AUTENTICADAS (para jogadores logados)
    // =====================================================

    // POST /tournaments/:id/register - Inscrever no torneio
    fastify.post('/:id/register', {
        preHandler: authMiddleware,
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        try {
            const result = await tournamentsService.registerPlayer(
                request.user!.id,
                request.params.id
            );

            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }

            return reply.send({
                message: 'Inscrição realizada com sucesso!',
                prizeInfo: result.prizeInfo,
            });
        } catch (error: any) {
            console.error('Erro ao inscrever no torneio:', error);
            return reply.status(500).send({ error: 'Erro ao processar inscrição' });
        }
    });

    // DELETE /tournaments/:id/register - Cancelar inscrição
    fastify.delete('/:id/register', {
        preHandler: authMiddleware,
    }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        try {
            const result = await tournamentsService.unregisterPlayer(
                request.user!.id,
                request.params.id
            );

            if (!result.success) {
                return reply.status(400).send({ error: result.error });
            }

            return reply.send({ message: 'Inscrição cancelada. Reembolso processado.' });
        } catch (error: any) {
            console.error('Erro ao cancelar inscrição:', error);
            return reply.status(500).send({ error: 'Erro ao cancelar inscrição' });
        }
    });

    // GET /tournaments/my/list - Meus torneios
    fastify.get('/my/list', {
        preHandler: authMiddleware,
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await tournamentsService.getPlayerTournaments(request.user!.id);
            return reply.send(result);
        } catch (error: any) {
            console.error('Erro ao carregar meus torneios:', error);
            return reply.status(500).send({ error: 'Erro ao carregar seus torneios' });
        }
    });

    // GET /tournaments/my/payments - Meus pagamentos de torneios
    fastify.get('/my/payments', {
        preHandler: authMiddleware,
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = await tournamentsService.getPlayerPayments(request.user!.id);
            return reply.send(result);
        } catch (error: any) {
            console.error('Erro ao carregar pagamentos:', error);
            return reply.status(500).send({ error: 'Erro ao carregar seus pagamentos' });
        }
    });

    // POST /tournaments/create - Criar torneio (por jogador VIP)
    fastify.post('/create', {
        preHandler: authMiddleware,
    }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
        try {
            // Verificar se usuário é VIP
            const isVip = await subscriptionsService.isSubscriber(request.user!.id);
            
            if (!isVip) {
                return reply.status(403).send({ 
                    error: 'Apenas assinantes VIP podem criar torneios',
                    requiresVip: true,
                    message: 'Assine o plano VIP para criar seus próprios torneios e ganhar 20% do valor arrecadado!'
                });
            }

            const { 
                name, 
                registration_start_date,
                registration_end_date,
                start_date, 
                entry_fee, 
                max_participants, 
                min_participants, 
                game_mode, 
                description 
            } = request.body as any;

            if (!name || !start_date) {
                return reply.status(400).send({ error: 'Nome e data de início são obrigatórios' });
            }

            if (!registration_start_date || !registration_end_date) {
                return reply.status(400).send({ error: 'Datas de início e término das inscrições são obrigatórias' });
            }

            // Validar datas
            const regStart = new Date(registration_start_date);
            const regEnd = new Date(registration_end_date);
            const tournamentStart = new Date(start_date);
            const now = new Date();

            if (regStart < now) {
                return reply.status(400).send({ error: 'A data de início das inscrições deve ser no futuro' });
            }

            if (regEnd <= regStart) {
                return reply.status(400).send({ error: 'A data de término das inscrições deve ser após o início' });
            }

            if (tournamentStart <= regEnd) {
                return reply.status(400).send({ error: 'O torneio deve iniciar após o término das inscrições' });
            }

            const tournament = await tournamentsService.createPlayerTournament(
                request.user!.id,
                {
                    name,
                    registration_start_date,
                    registration_end_date,
                    start_date,
                    entry_fee: entry_fee || 0,
                    max_participants: max_participants || 16,
                    min_participants: min_participants || 4,
                    game_mode: game_mode || '15ball',
                    description,
                }
            );

            return reply.status(201).send({
                message: 'Torneio criado com sucesso!',
                tournament,
                rules: {
                    prize_percentage: 60,
                    creator_fee_percentage: 20,
                    platform_fee_percentage: 20,
                    description: 'Como organizador, você receberá 20% do valor arrecadado. 60% vai para premiação e 20% para a plataforma.',
                },
            });
        } catch (error: any) {
            console.error('Erro ao criar torneio:', error);
            return reply.status(500).send({ error: 'Erro ao criar torneio' });
        }
    });

    // GET /tournaments/can-create - Verificar se pode criar torneio
    fastify.get('/can-create', {
        preHandler: authMiddleware,
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const isVip = await subscriptionsService.isSubscriber(request.user!.id);
            
            return reply.send({
                canCreate: isVip,
                requiresVip: !isVip,
                message: isVip 
                    ? 'Você pode criar torneios! Como organizador, você recebe 20% do valor arrecadado.'
                    : 'Assine o plano VIP para criar seus próprios torneios e ganhar 20% do valor arrecadado!',
                rules: {
                    prize_percentage: 60,
                    creator_fee_percentage: 20,
                    platform_fee_percentage: 20,
                },
            });
        } catch (error: any) {
            console.error('Erro ao verificar permissão:', error);
            return reply.status(500).send({ error: 'Erro ao verificar permissão' });
        }
    });
}
