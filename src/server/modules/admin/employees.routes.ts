// =====================================================
// ROTAS DE GESTÃO DE FUNCIONÁRIOS (ADMIN)
// =====================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../../services/supabase.js';
import crypto from 'crypto';

interface InviteEmployeeBody {
  email: string;
  role: 'employee' | 'manager' | 'moderator';
}

interface UpdateEmployeeRoleBody {
  userId: string;
  role: 'employee' | 'manager' | 'moderator' | 'admin';
}

// Middleware para verificar se é admin
async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return reply.status(401).send({ error: 'Token não fornecido' });
  }

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) {
    return reply.status(401).send({ error: 'Token inválido' });
  }

  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('role, is_admin')
    .eq('id', user.id)
    .single();

  if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
    return reply.status(403).send({ error: 'Acesso negado. Apenas administradores.' });
  }

  (request as any).adminUser = { ...user, role: userData.role };
}

export async function employeesRoutes(fastify: FastifyInstance) {
  // Middleware de autenticação admin
  fastify.addHook('preHandler', requireAdmin);

  // GET /employees - Listar funcionários
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, username, email, fullname, role, is_admin, status, created_at, last_login_at, country_code, city, state_code')
      .or('is_admin.eq.true,role.in.(admin,super_admin,moderator)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching employees:', error);
      return reply.status(500).send({ error: error.message });
    }

    // Ordenar por hierarquia
    const roleOrder: Record<string, number> = {
      'super_admin': 1,
      'admin': 2,
      'manager': 3,
      'moderator': 4,
      'employee': 5,
    };

    const sorted = (data || []).sort((a, b) => 
      (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99)
    );

    return reply.send({ employees: sorted });
  });

  // GET /employees/permissions - Listar permissões por role
  fastify.get('/permissions', async (request: FastifyRequest, reply: FastifyReply) => {
    const { data, error } = await supabaseAdmin
      .from('role_permissions')
      .select('*')
      .order('role');

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    // Agrupar por role
    const grouped: Record<string, string[]> = {};
    (data || []).forEach(item => {
      if (!grouped[item.role]) grouped[item.role] = [];
      grouped[item.role].push(item.permission);
    });

    return reply.send({ permissions: grouped });
  });

  // POST /employees/invite - Convidar novo funcionário
  fastify.post('/invite', async (request: FastifyRequest<{ Body: InviteEmployeeBody }>, reply: FastifyReply) => {
    const { email, role } = request.body;
    const adminUser = (request as any).adminUser;

    if (!email || !role) {
      return reply.status(400).send({ error: 'Email e cargo são obrigatórios' });
    }

    if (!['employee', 'manager', 'moderator'].includes(role)) {
      return reply.status(400).send({ error: 'Cargo inválido' });
    }

    // Verificar se email já está cadastrado
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('email', email)
      .single();

    if (existingUser) {
      // Se já existe, apenas atualizar o role
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ 
          role, 
          is_admin: ['manager', 'admin'].includes(role) 
        })
        .eq('email', email);

      if (updateError) {
        return reply.status(500).send({ error: updateError.message });
      }

      // Log de auditoria
      await supabaseAdmin.from('admin_logs').insert({
        admin_id: adminUser.id,
        action: 'employee_role_updated',
        target_type: 'user',
        target_id: existingUser.id,
        details: { email, old_role: existingUser.role, new_role: role },
      });

      return reply.send({ 
        success: true, 
        message: `Usuário ${email} promovido a ${getRoleName(role)}`,
        updated: true,
      });
    }

    // Gerar código de convite
    const inviteCode = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

    // Criar convite
    const { error: inviteError } = await supabaseAdmin
      .from('employee_invites')
      .insert({
        email,
        role,
        invited_by: adminUser.id,
        invite_code: inviteCode,
        expires_at: expiresAt.toISOString(),
      });

    if (inviteError) {
      return reply.status(500).send({ error: inviteError.message });
    }

    // Log de auditoria
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminUser.id,
      action: 'employee_invited',
      target_type: 'invite',
      details: { email, role, invite_code: inviteCode },
    });

    return reply.send({
      success: true,
      message: `Convite enviado para ${email}`,
      invite: {
        email,
        role,
        code: inviteCode,
        expires_at: expiresAt.toISOString(),
        link: `/register?invite=${inviteCode}`,
      },
    });
  });

  // GET /employees/invites - Listar convites pendentes
  fastify.get('/invites', async (request: FastifyRequest, reply: FastifyReply) => {
    const { data, error } = await supabaseAdmin
      .from('employee_invites')
      .select('*, inviter:invited_by(username)')
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    return reply.send({ invites: data });
  });

  // DELETE /employees/invites/:id - Cancelar convite
  fastify.delete('/invites/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const adminUser = (request as any).adminUser;

    const { error } = await supabaseAdmin
      .from('employee_invites')
      .delete()
      .eq('id', id);

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminUser.id,
      action: 'invite_cancelled',
      target_type: 'invite',
      target_id: id,
    });

    return reply.send({ success: true, message: 'Convite cancelado' });
  });

  // PUT /employees/:id/role - Alterar cargo de funcionário
  fastify.put('/:id/role', async (request: FastifyRequest<{ Params: { id: string }; Body: { role: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { role } = request.body;
    const adminUser = (request as any).adminUser;

    if (!['user', 'employee', 'manager', 'moderator', 'admin'].includes(role)) {
      return reply.status(400).send({ error: 'Cargo inválido' });
    }

    // Não permitir promover a super_admin
    if (role === 'super_admin') {
      return reply.status(403).send({ error: 'Não é possível promover a Super Admin' });
    }

    // Apenas super_admin pode promover a admin
    if (role === 'admin' && adminUser.role !== 'super_admin') {
      return reply.status(403).send({ error: 'Apenas Super Admin pode promover a Admin' });
    }

    // Buscar usuário atual
    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('role, email')
      .eq('id', id)
      .single();

    if (!targetUser) {
      return reply.status(404).send({ error: 'Usuário não encontrado' });
    }

    // Não permitir rebaixar super_admin
    if (targetUser.role === 'super_admin') {
      return reply.status(403).send({ error: 'Não é possível alterar cargo de Super Admin' });
    }

    // Atualizar
    const { error } = await supabaseAdmin
      .from('users')
      .update({ 
        role, 
        is_admin: ['manager', 'admin', 'super_admin'].includes(role) 
      })
      .eq('id', id);

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    // Log de auditoria
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminUser.id,
      action: 'employee_role_changed',
      target_type: 'user',
      target_id: id,
      details: { 
        email: targetUser.email, 
        old_role: targetUser.role, 
        new_role: role 
      },
    });

    return reply.send({ 
      success: true, 
      message: `Cargo alterado para ${getRoleName(role)}` 
    });
  });

  // DELETE /employees/:id - Remover funcionário (rebaixar a user)
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const adminUser = (request as any).adminUser;

    // Buscar usuário
    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('role, email')
      .eq('id', id)
      .single();

    if (!targetUser) {
      return reply.status(404).send({ error: 'Usuário não encontrado' });
    }

    // Não permitir remover super_admin
    if (targetUser.role === 'super_admin') {
      return reply.status(403).send({ error: 'Não é possível remover Super Admin' });
    }

    // Não permitir admin remover outro admin (apenas super_admin)
    if (targetUser.role === 'admin' && adminUser.role !== 'super_admin') {
      return reply.status(403).send({ error: 'Apenas Super Admin pode remover Admin' });
    }

    // Rebaixar a user
    const { error } = await supabaseAdmin
      .from('users')
      .update({ role: 'user', is_admin: false })
      .eq('id', id);

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    // Log de auditoria
    await supabaseAdmin.from('admin_logs').insert({
      admin_id: adminUser.id,
      action: 'employee_removed',
      target_type: 'user',
      target_id: id,
      details: { email: targetUser.email, old_role: targetUser.role },
    });

    return reply.send({ success: true, message: 'Funcionário removido da equipe' });
  });
}

function getRoleName(role: string): string {
  const names: Record<string, string> = {
    'super_admin': 'Super Administrador',
    'admin': 'Administrador',
    'manager': 'Gerente',
    'moderator': 'Moderador',
    'employee': 'Funcionário',
    'user': 'Usuário',
  };
  return names[role] || role;
}
