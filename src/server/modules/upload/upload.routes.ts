import { FastifyInstance } from 'fastify';
import { uploadService } from './upload.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import multipart from '@fastify/multipart';

export async function uploadRoutes(fastify: FastifyInstance) {
  // Registrar plugin multipart
  await fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
  });

  // Upload de avatar
  fastify.post('/avatar', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({ error: 'Nenhum arquivo enviado' });
      }

      // Ler buffer do arquivo
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);

      // Fazer upload
      const result = await uploadService.uploadAvatar(
        userId,
        fileBuffer,
        data.mimetype,
        data.filename
      );

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { success: true, avatar_url: result.url };
    } catch (err: any) {
      console.error('Erro no upload:', err);
      return reply.status(500).send({ error: 'Erro ao processar upload' });
    }
  });

  // Deletar avatar
  fastify.delete('/avatar', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const result = await uploadService.deleteAvatar(userId);

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { success: true, message: 'Avatar removido' };
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erro ao remover avatar' });
    }
  });

  // Obter avatar do usuário
  fastify.get('/avatar/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const url = await uploadService.getAvatarUrl(userId);

    if (!url) {
      return reply.status(404).send({ error: 'Avatar não encontrado' });
    }

    return { success: true, avatar_url: url };
  });
}
