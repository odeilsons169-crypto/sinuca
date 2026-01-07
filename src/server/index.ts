import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

// Serviços
import { cleanupService } from './services/cleanup.service.js';

// Rotas
import { authRoutes } from './modules/auth/auth.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { walletRoutes } from './modules/wallet/wallet.routes.js';
import { withdrawalRoutes } from './modules/wallet/withdrawal.routes.js';
import { creditsRoutes } from './modules/credits/credits.routes.js';
import { roomsRoutes } from './modules/rooms/rooms.routes.js';
import { matchesRoutes } from './modules/matches/matches.routes.js';
import { rankingRoutes } from './modules/ranking/ranking.routes.js';
import { aiRankingRoutes } from './modules/ranking/ai-ranking.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { paymentsRoutes } from './modules/payments/payments.routes.js';
import { paymentSettingsRoutes } from './modules/payments/payment-settings.routes.js';
import { moderationRoutes } from './modules/moderation/moderation.routes.js';
import { settingsRoutes } from './modules/admin/settings.routes.js';
import { uploadRoutes } from './modules/upload/upload.routes.js';
import { notificationsRoutes } from './modules/notifications/notifications.routes.js';
import { invitesRoutes } from './modules/invites/invites.routes.js';
import { subscriptionsRoutes } from './modules/subscriptions/subscriptions.routes.js';
// Admin Panel Avançado
import { usersAdminRoutes } from './modules/admin/users.admin.routes.js';
import { financeAdminRoutes } from './modules/admin/finance.admin.routes.js';
import { auditRoutes } from './modules/admin/audit.routes.js';
import { matchesAdminRoutes } from './modules/admin/matches.admin.routes.js';
import { tournamentsRoutes } from './modules/admin/tournaments.routes.js';
import { setupRoutes } from './modules/admin/setup.routes.js';
import { locationRoutes } from './modules/location/location.routes.js';
import { employeesRoutes } from './modules/admin/employees.routes.js';
import { couponsRoutes } from './modules/admin/coupons.routes.js';
import { missionsRoutes } from './modules/admin/missions.routes.js';
import { referralsRoutes } from './modules/referrals/referrals.routes.js';
import { adminReferralsRoutes } from './modules/admin/referrals-admin.routes.js';
import { reviewsRoutes } from './modules/reviews/reviews.routes.js';
import { livesRoutes } from './modules/lives/lives.routes.js';
import { publicTournamentsRoutes } from './modules/public-tournaments.routes.js';
import { trophiesRoutes } from './modules/trophies/trophies.routes.js';
import { tournamentMatchRoutes } from './modules/tournaments/tournament-match.routes.js';
import { publicBannersRoutes, adminBannersRoutes } from './modules/admin/banners.routes.js';
import { musicRoutes } from './modules/music/music.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ logger: true });

const PORT = Number(process.env.PORT) || 3000;

// CORS
fastify.register(fastifyCors, {
  origin: true,
  credentials: true,
});

// Servir uploads (avatares, etc) - DEVE vir ANTES do static principal
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../uploads'),
  prefix: '/uploads/',
  decorateReply: false,
});

// Servir arquivos estáticos (frontend buildado)
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../../dist/client'),
  prefix: '/',
  decorateReply: false,
});

// Fallback para SPA - redireciona rotas não-API para index.html
fastify.setNotFoundHandler((request, reply) => {
  if (!request.url.startsWith('/api') && !request.url.startsWith('/uploads')) {
    return reply.sendFile('index.html');
  }
  reply.code(404).send({ error: 'Not Found' });
});

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Registrar rotas da API
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(usersRoutes, { prefix: '/api/users' });
fastify.register(walletRoutes, { prefix: '/api/wallet' });
fastify.register(withdrawalRoutes, { prefix: '/api/withdrawals' });
fastify.register(creditsRoutes, { prefix: '/api/credits' });
fastify.register(roomsRoutes, { prefix: '/api/rooms' });
fastify.register(matchesRoutes, { prefix: '/api/matches' });
fastify.register(rankingRoutes, { prefix: '/api/ranking' });
// Ranking vs CPU - Mestres da Sinuca
fastify.register(aiRankingRoutes, { prefix: '/api/ai-ranking' });
fastify.register(adminRoutes, { prefix: '/api/admin' });
fastify.register(paymentsRoutes, { prefix: '/api/payments' });
fastify.register(paymentSettingsRoutes, { prefix: '/api/admin/payments' });
fastify.register(moderationRoutes, { prefix: '/api/moderation' });
fastify.register(settingsRoutes, { prefix: '/api/settings' });
fastify.register(uploadRoutes, { prefix: '/api/upload' });
fastify.register(notificationsRoutes, { prefix: '/api/notifications' });
fastify.register(invitesRoutes, { prefix: '/api/invites' });
fastify.register(subscriptionsRoutes, { prefix: '/api/subscriptions' });
// Admin Panel Avançado (RBAC)
fastify.register(usersAdminRoutes, { prefix: '/api/admin/v2/users' });
fastify.register(financeAdminRoutes, { prefix: '/api/admin/v2/finance' });
fastify.register(auditRoutes, { prefix: '/api/admin/v2/audit' });
fastify.register(matchesAdminRoutes, { prefix: '/api/admin/v2/matches' });
fastify.register(tournamentsRoutes, { prefix: '/api/admin/v2/tournaments' });
// Setup inicial (desabilitar em produção após configuração)
fastify.register(setupRoutes, { prefix: '/api/setup' });
// Localização (países, estados)
fastify.register(locationRoutes, { prefix: '/api/location' });
// Gestão de funcionários (admin)
fastify.register(employeesRoutes, { prefix: '/api/admin/employees' });
// Cupons de desconto
fastify.register(couponsRoutes, { prefix: '/api/coupons' });
// Missões e competições
fastify.register(missionsRoutes, { prefix: '/api/missions' });
// Sistema de indicações
fastify.register(referralsRoutes, { prefix: '/api/referrals' });
// Admin de indicações
fastify.register(adminReferralsRoutes, { prefix: '/api/admin/referrals' });
// Sistema de avaliações
fastify.register(reviewsRoutes, { prefix: '/api/reviews' });
// Torneios públicos (para Landing Page)
fastify.register(publicTournamentsRoutes, { prefix: '/api/tournaments' });
// Partidas de torneio (sincronização automática)
fastify.register(tournamentMatchRoutes, { prefix: '/api/tournament-matches' });
// Lives API
fastify.register(livesRoutes, { prefix: '/api/lives' });
// Troféus virtuais
fastify.register(trophiesRoutes, { prefix: '/api/trophies' });
// Banners públicos
fastify.register(publicBannersRoutes, { prefix: '/api/banners' });
// Banners admin
fastify.register(adminBannersRoutes, { prefix: '/api/admin/banners' });
// Sistema de música/playlist
fastify.register(musicRoutes, { prefix: '/api/music' });

// Iniciar servidor
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🎱 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📡 API disponível em http://localhost:${PORT}/api`);
    
    // Iniciar serviço de limpeza automática
    cleanupService.start();
    console.log(`🧹 Serviço de limpeza automática iniciado`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Recebido SIGTERM, encerrando...');
  cleanupService.stop();
  fastify.close();
});

process.on('SIGINT', () => {
  console.log('Recebido SIGINT, encerrando...');
  cleanupService.stop();
  fastify.close();
});

start();
