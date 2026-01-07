// =====================================================
// MIDDLEWARE RBAC - Controle de Acesso por Roles
// =====================================================

import { FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../services/supabase.js';

export type UserRole = 'user' | 'employee' | 'moderator' | 'manager' | 'admin' | 'super_admin';

// Hierarquia de roles (maior número = mais permissões)
const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 1,
  employee: 2,
  moderator: 3,
  manager: 4,
  admin: 5,
  super_admin: 6,
};

// Permissões por funcionalidade
export const PERMISSIONS = {
  // Usuários
  view_users: ['employee', 'moderator', 'manager', 'admin', 'super_admin'] as UserRole[],
  edit_users: ['manager', 'admin', 'super_admin'] as UserRole[],
  ban_users: ['moderator', 'manager', 'admin', 'super_admin'] as UserRole[],
  delete_users: ['super_admin'] as UserRole[],
  
  // Finanças
  view_finances: ['manager', 'admin', 'super_admin'] as UserRole[],
  approve_withdrawals: ['employee', 'manager', 'admin', 'super_admin'] as UserRole[],
  adjust_balance: ['super_admin'] as UserRole[],
  
  // Partidas
  view_matches: ['employee', 'moderator', 'manager', 'admin', 'super_admin'] as UserRole[],
  cancel_matches: ['manager', 'admin', 'super_admin'] as UserRole[],
  
  // Torneios
  view_tournaments: ['employee', 'moderator', 'manager', 'admin', 'super_admin'] as UserRole[],
  manage_tournaments: ['manager', 'admin', 'super_admin'] as UserRole[],
  
  // Configurações
  view_settings: ['admin', 'super_admin'] as UserRole[],
  edit_settings: ['super_admin'] as UserRole[],
  manage_settings: ['manager', 'admin', 'super_admin'] as UserRole[],
  
  // Música/Playlist
  manage_music: ['manager', 'admin', 'super_admin'] as UserRole[],
  
  // Banners/Marketing
  manage_banners: ['manager', 'admin', 'super_admin'] as UserRole[],
  manage_coupons: ['manager', 'admin', 'super_admin'] as UserRole[],
  manage_missions: ['manager', 'admin', 'super_admin'] as UserRole[],
  
  // Logs
  view_logs: ['employee', 'moderator', 'manager', 'admin', 'super_admin'] as UserRole[],
  
  // Moderação
  moderate_chat: ['moderator', 'manager', 'admin', 'super_admin'] as UserRole[],
  
  // Funcionários
  manage_employees: ['admin', 'super_admin'] as UserRole[],
};

export type Permission = keyof typeof PERMISSIONS;

/**
 * Verifica se um role tem permissão para uma ação
 */
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  if (!userRole) return false;
  const allowedRoles = PERMISSIONS[permission];
  return allowedRoles?.includes(userRole) || false;
}

/**
 * Verifica se um role atende ao nível mínimo requerido
 */
export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Middleware factory para verificar role mínimo
 */
export function requireRole(minimumRole: UserRole) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    
    if (!user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    // Buscar role atualizado do banco
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role, is_banned, is_suspended, suspended_until')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return reply.status(401).send({ error: 'Usuário não encontrado' });
    }

    // Verificar se está banido
    if (userData.is_banned) {
      return reply.status(403).send({ error: 'Conta banida' });
    }

    // Verificar se está suspenso
    if (userData.is_suspended && userData.suspended_until) {
      const suspendedUntil = new Date(userData.suspended_until);
      if (suspendedUntil > new Date()) {
        return reply.status(403).send({ 
          error: 'Conta suspensa',
          suspended_until: userData.suspended_until 
        });
      }
    }

    const userRole = userData.role as UserRole;
    
    if (!hasMinimumRole(userRole, minimumRole)) {
      return reply.status(403).send({ 
        error: 'Permissão negada',
        required_role: minimumRole,
        your_role: userRole
      });
    }

    // Adicionar role ao request
    (request as any).userRole = userRole;
  };
}

/**
 * Middleware factory para verificar permissão específica
 */
export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    
    if (!user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return reply.status(401).send({ error: 'Usuário não encontrado' });
    }

    const userRole = (userData.role || 'user') as UserRole;
    
    if (!hasPermission(userRole, permission)) {
      return reply.status(403).send({ 
        error: 'Permissão negada',
        required_permission: permission,
        your_role: userRole
      });
    }

    (request as any).userRole = userRole;
  };
}

/**
 * Helper para obter IP do request
 */
export function getClientIP(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
  }
  return request.ip || '0.0.0.0';
}
