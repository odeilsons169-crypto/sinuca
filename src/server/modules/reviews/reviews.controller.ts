
import { FastifyReply, FastifyRequest } from 'fastify';
import { reviewsService } from './reviews.service.js';

export const reviewsController = {
    async create(request: FastifyRequest, reply: FastifyReply) {
        try {
            const data = request.body as any;

            // Simple validation
            if (!data.game || !data.rating || !data.comment) {
                return reply.status(400).send({ error: 'Missing fields' });
            }

            const review = await reviewsService.create({
                userId: data.userId,
                username: data.username || 'Anônimo',
                userAvatar: data.userAvatar,
                game: data.game,
                rating: Math.min(5, Math.max(1, Number(data.rating))),
                comment: data.comment
            });

            return reply.send(review);
        } catch (error) {
            console.error('Error creating review:', error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    },

    async list(request: FastifyRequest, reply: FastifyReply) {
        try {
            const reviews = await reviewsService.list();
            return reply.send({ reviews });
        } catch (error) {
            console.error('Error listing reviews:', error);
            return reply.status(500).send({ error: 'Internal Server Error' });
        }
    }
};
