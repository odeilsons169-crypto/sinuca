// =====================================================
// MIDDLEWARE DE MANUTENÇÃO
// Verifica se o sistema está em manutenção
// =====================================================

import { FastifyRequest, FastifyReply } from 'fastify';
import { settingsService } from '../modules/admin/settings.service.js';

// Cache para evitar consultas excessivas ao banco
let maintenanceCache: { enabled: boolean; message: string; timestamp: number } | null = null;
const CACHE_TTL = 10000; // 10 segundos

async function getMaintenanceStatus(): Promise<{ enabled: boolean; message: string }> {
  const now = Date.now();
  
  // Usar cache se ainda válido
  if (maintenanceCache && (now - maintenanceCache.timestamp) < CACHE_TTL) {
    return { enabled: maintenanceCache.enabled, message: maintenanceCache.message };
  }

  try {
    const status = await settingsService.getMaintenanceStatus();
    maintenanceCache = {
      enabled: status.enabled,
      message: status.message,
      timestamp: now,
    };
    return { enabled: status.enabled, message: status.message };
  } catch (err) {
    console.error('Erro ao verificar status de manutenção:', err);
    return { enabled: false, message: '' };
  }
}

/**
 * Middleware que bloqueia requisições quando em manutenção
 * Permite acesso apenas para admins
 */
export async function maintenanceMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Rotas que sempre devem funcionar (mesmo em manutenção)
  const allowedPaths = [
    '/api/auth/login',
    '/api/auth/me',
    '/api/admin',
    '/api/settings/maintenance',
    '/health',
    '/api/health',
  ];

  // Verificar se é rota permitida
  const isAllowedPath = allowedPaths.some(path => request.url.startsWith(path));
  if (isAllowedPath) {
    return;
  }

  // Verificar status de manutenção
  const { enabled, message } = await getMaintenanceStatus();

  if (!enabled) {
    return;
  }

  // Se está em manutenção, verificar se é admin
  const user = request.user;
  const isAdmin = user && ['admin', 'super_admin', 'manager'].includes(user.role || '');

  if (isAdmin) {
    // Admins podem acessar mesmo em manutenção
    return;
  }

  // Bloquear acesso
  return reply.status(503).send({
    error: 'maintenance',
    message: message || 'Sistema em manutenção. Voltamos em breve!',
    maintenance: true,
    estimatedReturn: 'Em breve',
  });
}

/**
 * Limpar cache de manutenção (chamar quando configuração mudar)
 */
export function clearMaintenanceCache() {
  maintenanceCache = null;
}
