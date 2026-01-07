// =====================================================
// ROTAS ADMIN DE INDICAÇÕES
// =====================================================

import { FastifyInstance } from 'fastify';
import { supabaseAdmin } from '../../services/supabase.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { adminMiddleware } from '../../middlewares/admin.middleware.js';
import { referralsService } from '../referrals/referrals.service.js';

export async function adminReferralsRoutes(fastify: FastifyInstance) {
  // Listar todas as indicações
  fastify.get('/', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const { status, limit = 50, offset = 0 } = request.query as { status?: string; limit?: number; offset?: number };

      let query = supabaseAdmin
        .from('referrals')
        .select(`
          *,
          referrer:referrer_id(id, username, email, avatar_url),
          referred:referred_id(id, username, email, avatar_url, created_at)
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return { success: true, referrals: data || [] };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Estatísticas de indicações
  fastify.get('/stats', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      // Total de indicações
      const { count: totalReferrals } = await supabaseAdmin
        .from('referrals')
        .select('*', { count: 'exact', head: true });

      // Pendentes
      const { count: pendingReferrals } = await supabaseAdmin
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Recompensadas
      const { count: rewardedReferrals } = await supabaseAdmin
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'rewarded');

      // Total de créditos distribuídos
      const { data: creditsData } = await supabaseAdmin
        .from('referrals')
        .select('reward_credits')
        .eq('status', 'rewarded');

      const totalCreditsGiven = creditsData?.reduce((sum, r) => sum + (r.reward_credits || 0), 0) || 0;

      // Top indicadores
      const { data: topReferrers } = await supabaseAdmin
        .from('users')
        .select('id, username, referral_count, referral_earnings')
        .gt('referral_count', 0)
        .order('referral_count', { ascending: false })
        .limit(10);

      return {
        success: true,
        total_referrals: totalReferrals || 0,
        pending_referrals: pendingReferrals || 0,
        rewarded_referrals: rewardedReferrals || 0,
        total_credits_given: totalCreditsGiven,
        top_referrers: topReferrers || [],
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Processar recompensa manualmente
  fastify.post('/:id/process', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const adminId = (request as any).user.id;

      // Buscar indicação
      const { data: referral, error: refError } = await supabaseAdmin
        .from('referrals')
        .select('*')
        .eq('id', id)
        .single();

      if (refError || !referral) {
        return reply.status(404).send({ error: 'Indicação não encontrada' });
      }

      if (referral.status === 'rewarded') {
        return reply.status(400).send({ error: 'Recompensa já foi processada' });
      }

      // Creditar recompensa ao indicador
      const { data: credits } = await supabaseAdmin
        .from('credits')
        .select('amount')
        .eq('user_id', referral.referrer_id)
        .single();

      if (credits) {
        await supabaseAdmin
          .from('credits')
          .update({ amount: credits.amount + referral.reward_credits, updated_at: new Date().toISOString() })
          .eq('user_id', referral.referrer_id);
      }

      // Atualizar status da indicação
      await supabaseAdmin
        .from('referrals')
        .update({
          status: 'rewarded',
          qualified_at: referral.qualified_at || new Date().toISOString(),
          rewarded_at: new Date().toISOString(),
        })
        .eq('id', id);

      // Atualizar earnings do usuário
      await supabaseAdmin
        .from('users')
        .update({
          referral_earnings: supabaseAdmin.rpc('increment_referral_earnings', {
            user_id: referral.referrer_id,
            amount: referral.reward_credits,
          }),
        })
        .eq('id', referral.referrer_id);

      // Log
      await supabaseAdmin.from('admin_logs').insert({
        admin_id: adminId,
        action: 'process_referral_reward',
        target_type: 'referral',
        target_id: id,
        details: { referrer_id: referral.referrer_id, credits: referral.reward_credits },
      });

      // Notificar indicador
      await supabaseAdmin.from('notifications').insert({
        user_id: referral.referrer_id,
        type: 'referral_reward',
        title: '🎉 Indicação Recompensada!',
        message: `Você ganhou ${referral.reward_credits} créditos! Seu amigo fez a primeira compra.`,
      });

      return { success: true, message: 'Recompensa processada com sucesso' };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });

  // Buscar indicações por usuário
  fastify.get('/user/:userId', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };

      const { data: asReferrer } = await supabaseAdmin
        .from('referrals')
        .select(`
          *,
          referred:referred_id(id, username, email)
        `)
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });

      const { data: asReferred } = await supabaseAdmin
        .from('referrals')
        .select(`
          *,
          referrer:referrer_id(id, username, email)
        `)
        .eq('referred_id', userId)
        .single();

      return {
        success: true,
        as_referrer: asReferrer || [],
        as_referred: asReferred || null,
      };
    } catch (error: any) {
      return reply.status(500).send({ error: error.message });
    }
  });
}
