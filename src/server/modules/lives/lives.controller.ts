
import { FastifyRequest, FastifyReply } from 'fastify';
import { livesService } from './lives.service.js';

export const livesController = {
    // Listar todas as lives
    async list(req: FastifyRequest, reply: FastifyReply) {
        const streams = livesService.listStreams();
        return reply.send({ success: true, streams });
    },

    // Obter configuração (custo)
    async getConfig(req: FastifyRequest, reply: FastifyReply) {
        const config = livesService.getConfig();
        return reply.send({ success: true, config });
    },

    // Iniciar transmissão
    async start(req: FastifyRequest, reply: FastifyReply) {
        const { roomId, userId, hostName, gameMode, title } = req.body as any;

        if (!roomId || !userId) {
            return reply.status(400).send({ error: 'RoomID and UserID required' });
        }

        // TODO: Integração real com sistema de créditos/wallet
        // Por enquanto, validamos que o request chegou
        // Em produção: await walletService.debit(userId, livesService.getConfig().streamCost);

        const stream = livesService.startStream(roomId, userId, {
            hostName, gameMode, title
        });

        return reply.send({ success: true, stream });
    },

    // Parar transmissão
    async stop(req: FastifyRequest, reply: FastifyReply) {
        const { roomId } = req.body as any;
        livesService.stopStream(roomId);
        return reply.send({ success: true });
    },

    // Registrar espectador
    async addViewer(req: FastifyRequest, reply: FastifyReply) {
        const { roomId } = req.params as any;
        const count = livesService.addViewer(roomId);
        return reply.send({ success: true, viewers: count });
    }
};
