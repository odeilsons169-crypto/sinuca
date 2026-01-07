import { FastifyRequest, FastifyReply } from 'fastify';
import { supabase, supabaseAdmin } from '../services/supabase.js';
import type { User } from '../../shared/types/index.js';

// Extender o tipo do request para incluir o usuário
declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

// Middleware de autenticação
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return reply.status(401).send({ error: 'Token não fornecido' });
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return reply.status(401).send({ error: 'Token inválido ou expirado' });
  }

  // Buscar perfil completo
  const { data: userProfile } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!userProfile) {
    return reply.status(401).send({ error: 'Usuário não encontrado' });
  }

  if (userProfile.status === 'banned') {
    return reply.status(403).send({ error: 'Usuário banido' });
  }

  if (userProfile.status === 'suspended') {
    return reply.status(403).send({ error: 'Usuário suspenso temporariamente' });
  }

  request.user = userProfile as User;
}

// Middleware de admin
export async function adminMiddleware(request: FastifyRequest, reply: FastifyReply) {
  // Primeiro verifica autenticação
  await authMiddleware(request, reply);

  if (reply.sent) return; // Se já respondeu com erro, para aqui

  // Verificar se é admin por role ou is_admin
  const user = request.user;
  const isAdmin = user?.is_admin === true || 
                  ['admin', 'super_admin', 'manager', 'moderator', 'employee'].includes(user?.role || '');
  
  if (!isAdmin) {
    return reply.status(403).send({ error: 'Acesso negado. Apenas administradores.' });
  }
}
