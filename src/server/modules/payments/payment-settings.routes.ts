// =====================================================
// ROTAS DE CONFIGURAÇÃO DE PAGAMENTOS (ADMIN)
// =====================================================

import { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { paymentSettingsService } from './payment-settings.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { adminMiddleware } from '../../middlewares/admin.middleware.js';

export async function paymentSettingsRoutes(fastify: FastifyInstance) {
  // Registrar multipart para upload de certificado
  await fastify.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });
  
  // Obter configurações atuais
  fastify.get('/settings', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const settings = await paymentSettingsService.getSettings();
      return { success: true, settings };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Atualizar credenciais
  fastify.put('/settings/credentials', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const { environment, clientId, clientSecret, pixKey, webhookUrl } = request.body as any;
      const adminId = (request as any).user.id;

      if (!clientId || !clientSecret) {
        return reply.status(400).send({ error: 'Client ID e Client Secret são obrigatórios' });
      }

      if (!['sandbox', 'production'].includes(environment)) {
        return reply.status(400).send({ error: 'Ambiente inválido' });
      }

      const result = await paymentSettingsService.updateCredentials({
        environment,
        clientId,
        clientSecret,
        pixKey,
        webhookUrl,
        adminId,
      });

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { success: true, message: 'Credenciais atualizadas com sucesso' };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Upload de certificado .p12
  fastify.post('/settings/certificate', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const data = await request.file();
      
      if (!data) {
        return reply.status(400).send({ error: 'Arquivo não enviado' });
      }

      const adminId = (request as any).user.id;
      const buffer = await data.toBuffer();
      const filename = data.filename;

      const result = await paymentSettingsService.uploadCertificate(buffer, filename, adminId);

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { success: true, message: 'Certificado enviado com sucesso' };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Ativar/desativar integração
  fastify.put('/settings/active', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const { active } = request.body as any;
      const adminId = (request as any).user.id;

      const result = await paymentSettingsService.setActive(active, adminId);

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { success: true, message: active ? 'Pagamentos ativados' : 'Pagamentos desativados' };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Testar conexão
  fastify.post('/settings/test', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const result = await paymentSettingsService.testConnection();

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { success: true, message: 'Conexão OK' };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
