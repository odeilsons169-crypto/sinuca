import { FastifyRequest, FastifyReply } from 'fastify';

export async function adminMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user;

  if (!user) {
    return reply.status(401).send({ error: 'Não autenticado' });
  }

  // Verificar se é admin por role ou is_admin
  const isAdmin = user.is_admin === true || 
                  ['admin', 'super_admin', 'manager', 'moderator', 'employee'].includes(user.role);
  
  if (!isAdmin) {
    return reply.status(403).send({ error: 'Acesso negado. Apenas administradores.' });
  }
}
