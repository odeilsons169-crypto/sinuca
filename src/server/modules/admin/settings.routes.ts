import { FastifyInstance } from 'fastify';
import { settingsService, SettingKey } from './settings.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { adminMiddleware } from '../../middlewares/admin.middleware.js';
import { cleanupService } from '../../services/cleanup.service.js';

export async function settingsRoutes(fastify: FastifyInstance) {
  // Obter todas as configurações (admin)
  fastify.get('/', { preHandler: [authMiddleware, adminMiddleware] }, async (request) => {
    const settings = await settingsService.getAll();
    return { success: true, settings };
  });

  // Obter uma configuração específica (admin)
  fastify.get('/:key', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    const { key } = request.params as { key: string };
    
    try {
      const value = await settingsService.get(key as SettingKey);
      return { success: true, key, value };
    } catch (err) {
      return reply.status(400).send({ error: 'Configuração não encontrada' });
    }
  });

  // Atualizar uma configuração (admin)
  fastify.put('/:key', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    const { key } = request.params as { key: string };
    const { value } = request.body as { value: any };
    const adminId = (request as any).user.id;

    const result = await settingsService.set(key as SettingKey, value, adminId);
    
    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return { success: true, message: 'Configuração atualizada' };
  });

  // Atualizar múltiplas configurações (admin)
  fastify.put('/', { preHandler: [authMiddleware, adminMiddleware] }, async (request, reply) => {
    const { settings } = request.body as { settings: Record<string, any> };
    const adminId = (request as any).user.id;

    if (!settings || typeof settings !== 'object') {
      return reply.status(400).send({ error: 'Configurações inválidas' });
    }

    const result = await settingsService.setMultiple(settings, adminId);
    
    if (!result.success) {
      return reply.status(400).send({ errors: result.errors });
    }

    return { success: true, message: 'Configurações atualizadas' };
  });

  // Resetar para padrões (admin)
  fastify.post('/reset', { preHandler: [authMiddleware, adminMiddleware] }, async (request) => {
    const adminId = (request as any).user.id;
    await settingsService.resetToDefaults(adminId);
    return { success: true, message: 'Configurações resetadas para padrão' };
  });

  // ==================== ENDPOINTS PÚBLICOS ====================

  // Verificar modo manutenção (público) - inclui contatos
  fastify.get('/public/maintenance', async () => {
    const settings = await settingsService.getAll();
    return {
      enabled: settings.maintenance_mode,
      message: settings.maintenance_message,
      contacts: {
        whatsapp: settings.contact_whatsapp || '5511999999999',
        instagram: settings.contact_instagram || 'sinucaonline',
        email: settings.contact_email || 'suporte@sinucaonline.com',
      },
    };
  });

  // Obter pacotes de créditos (público)
  fastify.get('/public/credits', async () => {
    const credits = await settingsService.getCreditSettings();
    return { success: true, ...credits };
  });

  // Obter configurações de apostas (público)
  fastify.get('/public/bets', async () => {
    const bets = await settingsService.getBetSettings();
    return { success: true, ...bets };
  });

  // Verificar modos de jogo habilitados (público)
  fastify.get('/public/game-modes', async () => {
    const settings = await settingsService.getAll();
    return {
      success: true,
      modes: {
        casual: settings.casual_mode_enabled,
        ranked: settings.ranked_mode_enabled,
        bet: settings.bet_mode_enabled,
        ai: settings.ai_mode_enabled,
      },
    };
  });

  // ==================== CLEANUP / TEMPO ====================

  // Obter constantes de tempo do sistema (público)
  fastify.get('/public/time-constants', async () => {
    const timeConstants = cleanupService.getTimeConstants();
    return {
      success: true,
      ...timeConstants,
    };
  });

  // Forçar limpeza manual (admin)
  fastify.post('/cleanup/run', { preHandler: [authMiddleware, adminMiddleware] }, async (request) => {
    await cleanupService.runCleanup();
    return { 
      success: true, 
      message: 'Limpeza executada com sucesso',
      timestamp: new Date().toISOString(),
    };
  });

  // Obter status do serviço de limpeza (admin)
  fastify.get('/cleanup/status', { preHandler: [authMiddleware, adminMiddleware] }, async () => {
    const timeConstants = cleanupService.getTimeConstants();
    return {
      success: true,
      service: 'cleanup',
      status: 'running',
      config: {
        matchMaxDuration: `${timeConstants.matchMaxDurationMinutes} minutos`,
        roomMaxIdle: `${timeConstants.roomMaxIdleHours} horas`,
        livestreamCheckInterval: `${timeConstants.livestreamCheckIntervalMinutes} minutos`,
      },
    };
  });
}
