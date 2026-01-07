
import { FastifyInstance } from 'fastify';
import { reviewsController } from './reviews.controller.js';

export async function reviewsRoutes(fastify: FastifyInstance) {
    fastify.post('/', reviewsController.create);
    fastify.get('/', reviewsController.list);
}
