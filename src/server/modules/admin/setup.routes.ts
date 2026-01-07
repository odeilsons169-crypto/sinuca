// =====================================================
// ROTAS DE SETUP INICIAL (ADMIN)
// =====================================================
// Estas rotas são usadas apenas para configuração inicial
// Devem ser desabilitadas em produção após o setup

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../../services/supabase.js';

interface CreateSuperAdminBody {
  email: string;
  password: string;
  username: string;
  fullname: string;
  setupKey: string;
}

// Chave de setup (deve ser definida no .env)
const SETUP_KEY = process.env.ADMIN_SETUP_KEY || 'SINUCA_SETUP_2024';

export async function setupRoutes(fastify: FastifyInstance) {
  // POST /setup/create-super-admin - Criar super admin inicial
  fastify.post('/create-super-admin', async (request: FastifyRequest<{ Body: CreateSuperAdminBody }>, reply: FastifyReply) => {
    const { email, password, username, fullname, setupKey } = request.body;

    // Verificar chave de setup
    if (setupKey !== SETUP_KEY) {
      return reply.status(403).send({ error: 'Chave de setup inválida' });
    }

    // Verificar se já existe um super_admin
    const { data: existingAdmin } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'super_admin')
      .single();

    if (existingAdmin) {
      return reply.status(400).send({ error: 'Já existe um Super Admin cadastrado' });
    }

    try {
      // Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, fullname, role: 'super_admin' },
      });

      if (authError) {
        return reply.status(400).send({ error: authError.message });
      }

      if (!authData.user) {
        return reply.status(400).send({ error: 'Erro ao criar usuário' });
      }

      // Criar registro na tabela users
      const { error: userError } = await supabaseAdmin.from('users').insert({
        id: authData.user.id,
        email,
        username,
        fullname,
        role: 'super_admin',
        is_admin: true,
        status: 'active',
      });

      if (userError) {
        // Rollback - deletar usuário do auth
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return reply.status(400).send({ error: userError.message });
      }

      // Criar wallet
      await supabaseAdmin.from('wallet').insert({
        user_id: authData.user.id,
        balance: 0,
        is_blocked: false,
      });

      // Criar créditos (ilimitados para admin)
      await supabaseAdmin.from('credits').insert({
        user_id: authData.user.id,
        amount: 9999,
        is_unlimited: true,
      });

      // Log de auditoria
      await supabaseAdmin.from('admin_logs').insert({
        admin_id: authData.user.id,
        action: 'super_admin_created',
        target_type: 'user',
        target_id: authData.user.id,
        details: { email, username, created_via: 'setup_route' },
      });

      return reply.status(201).send({
        success: true,
        message: 'Super Admin criado com sucesso!',
        user: {
          id: authData.user.id,
          email,
          username,
          role: 'super_admin',
        },
        instructions: [
          '1. Acesse o painel admin em /admin',
          '2. Faça login com as credenciais criadas',
          '3. ALTERE A SENHA imediatamente',
          '4. Desabilite esta rota de setup em produção',
        ],
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /setup/check - Verificar se setup foi feito
  fastify.get('/check', async (request: FastifyRequest, reply: FastifyReply) => {
    const { data: existingAdmin } = await supabaseAdmin
      .from('users')
      .select('id, email, username')
      .eq('role', 'super_admin')
      .single();

    return reply.send({
      setupComplete: !!existingAdmin,
      superAdmin: existingAdmin ? {
        email: existingAdmin.email,
        username: existingAdmin.username,
      } : null,
    });
  });

  // POST /setup/promote-to-admin - Promover usuário existente a admin
  fastify.post('/promote-to-admin', async (request: FastifyRequest<{ Body: { email: string; role: string; setupKey: string } }>, reply: FastifyReply) => {
    const { email, role, setupKey } = request.body;

    if (setupKey !== SETUP_KEY) {
      return reply.status(403).send({ error: 'Chave de setup inválida' });
    }

    if (!['moderator', 'admin', 'super_admin'].includes(role)) {
      return reply.status(400).send({ error: 'Role inválido' });
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update({ role, is_admin: role !== 'moderator' })
      .eq('email', email)
      .select()
      .single();

    if (error) {
      return reply.status(400).send({ error: error.message });
    }

    return reply.send({
      success: true,
      message: `Usuário ${email} promovido a ${role}`,
      user: data,
    });
  });
}
