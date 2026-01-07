
import { FastifyInstance } from 'fastify';
import { livesController } from './lives.controller.js';

export async function livesRoutes(fastify: FastifyInstance) {
    fastify.get('/', livesController.list);
    fastify.get('/config', livesController.getConfig);
    fastify.post('/start', livesController.start);
    fastify.post('/stop', livesController.stop);
    fastify.post('/:roomId/view', livesController.addViewer);
}
