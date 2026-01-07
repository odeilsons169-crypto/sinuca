// =====================================================
// ROTAS DE INDICAÇÕES (INDIQUE E GANHE)
// =====================================================

import { FastifyInstance } from 'fastify';
import { referralsService } from './referrals.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

export async function referralsRoutes(fastify: FastifyInstance) {
  // Obter código de referência e estatísticas do usuário
  fastify.get('/my-code', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      
      // Garantir que o usuário tem um código
      const code = await referralsService.ensureReferralCode(userId);
      const stats = await referralsService.getStats(userId);
      const shareMessage = await referralsService.getShareMessage();
      const isEnabled = await referralsService.isEnabled();

      // Gerar link de indicação
      const baseUrl = process.env.APP_URL || 'https://sinuca.online';
      const referralLink = `${baseUrl}/register?ref=${code}`;

      return {
        success: true,
        referral_code: code,
        referral_link: referralLink,
        share_message: shareMessage,
        stats,
        enabled: isEnabled,
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Listar minhas indicações
  fastify.get('/my-referrals', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const referrals = await referralsService.listReferrals(userId);

      return { success: true, referrals };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Validar código de referência (público - para tela de registro)
  fastify.get('/validate/:code', async (request, reply) => {
    try {
      const { code } = request.params as { code: string };
      
      const user = await referralsService.getUserByReferralCode(code);
      
      if (!user) {
        return reply.status(404).send({ error: 'Código de indicação inválido' });
      }

      return {
        success: true,
        valid: true,
        referrer: {
          username: user.username,
        },
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Registrar indicação (chamado após registro com código)
  fastify.post('/register', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const { referral_code } = request.body as { referral_code: string };
      const referredId = (request as any).user.id;

      if (!referral_code) {
        return reply.status(400).send({ error: 'Código de indicação é obrigatório' });
      }

      // Buscar quem indicou
      const referrer = await referralsService.getUserByReferralCode(referral_code);
      
      if (!referrer) {
        return reply.status(404).send({ error: 'Código de indicação inválido' });
      }

      const result = await referralsService.registerReferral(referrer.id, referredId);

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return { 
        success: true, 
        message: 'Indicação registrada! Você ganhará créditos quando fizer sua primeira compra.' 
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Obter dados para compartilhamento
  fastify.get('/share-data', { preHandler: authMiddleware }, async (request, reply) => {
    try {
      const userId = (request as any).user.id;
      const code = await referralsService.ensureReferralCode(userId);
      const shareMessage = await referralsService.getShareMessage();
      
      const baseUrl = process.env.APP_URL || 'https://sinuca.online';
      const referralLink = `${baseUrl}/register?ref=${code}`;

      // Dados para compartilhamento em redes sociais
      return {
        success: true,
        share: {
          link: referralLink,
          message: shareMessage,
          title: '🎱 Sinuca Online - Indique e Ganhe!',
          description: 'Jogue sinuca online com amigos e ganhe créditos! Cadastre-se agora.',
          image: `${baseUrl}/images/share-banner.png`,
          whatsapp: `https://wa.me/?text=${encodeURIComponent(shareMessage + '\n\n' + referralLink)}`,
          telegram: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareMessage)}`,
          twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}&url=${encodeURIComponent(referralLink)}`,
          facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}&quote=${encodeURIComponent(shareMessage)}`,
        },
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
