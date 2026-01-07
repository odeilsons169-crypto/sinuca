import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authService } from './auth.service.js';
import { referralsService } from '../referrals/referrals.service.js';

interface RegisterBody {
  email: string;
  password: string;
  username: string;
  fullname: string;
  cpf: string;
  phone: string;
  country_code: string;
  country_name: string;
  state_code: string;
  state_name: string;
  city: string;
  referral_code?: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface ResetPasswordBody {
  email: string;
}

interface UpdatePasswordBody {
  password: string;
}

interface RefreshBody {
  refresh_token: string;
}

interface VerifyCodeBody {
  email: string;
  code: string;
}

interface StartRegisterBody {
  email: string;
  password: string;
  username: string;
}

export async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/start-register - Inicia registro e envia código
  fastify.post('/start-register', async (request: FastifyRequest<{ Body: StartRegisterBody }>, reply: FastifyReply) => {
    const { email, password, username } = request.body;

    if (!email || !password || !username) {
      return reply.status(400).send({ error: 'Email, senha e username são obrigatórios' });
    }

    if (password.length < 6) {
      return reply.status(400).send({ error: 'Senha deve ter no mínimo 6 caracteres' });
    }

    if (username.length < 3) {
      return reply.status(400).send({ error: 'Username deve ter no mínimo 3 caracteres' });
    }

    const result = await authService.startRegistration({ email, password, username });

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({
      success: true,
      message: 'Código de verificação enviado para seu email',
    });
  });

  // POST /auth/verify-code - Verifica código e cria conta
  fastify.post('/verify-code', async (request: FastifyRequest<{ Body: VerifyCodeBody }>, reply: FastifyReply) => {
    const { email, code } = request.body;

    if (!email || !code) {
      return reply.status(400).send({ error: 'Email e código são obrigatórios' });
    }

    const result = await authService.verifyAndRegister(email, code);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.status(201).send({
      message: 'Conta criada com sucesso!',
      user: result.user,
      session: result.session,
    });
  });

  // POST /auth/register - Registro direto (sem verificação)
  fastify.post('/register', async (request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => {
    const { email, password, username, fullname, cpf, phone, country_code, country_name, state_code, state_name, city, referral_code } = request.body;

    // Validações básicas
    if (!email || !password || !username) {
      return reply.status(400).send({ error: 'Email, senha e username são obrigatórios' });
    }

    if (!fullname || fullname.trim().split(' ').length < 2) {
      return reply.status(400).send({ error: 'Digite seu nome completo (nome e sobrenome)' });
    }

    if (!cpf || cpf.length !== 11) {
      return reply.status(400).send({ error: 'CPF inválido' });
    }

    if (!phone || phone.length < 10) {
      return reply.status(400).send({ error: 'Telefone inválido' });
    }

    if (!country_code) {
      return reply.status(400).send({ error: 'Selecione seu país' });
    }

    if (!state_code) {
      return reply.status(400).send({ error: 'Selecione seu estado' });
    }

    if (!city || city.length < 2) {
      return reply.status(400).send({ error: 'Digite sua cidade' });
    }

    if (password.length < 6) {
      return reply.status(400).send({ error: 'Senha deve ter no mínimo 6 caracteres' });
    }

    if (username.length < 3) {
      return reply.status(400).send({ error: 'Username deve ter no mínimo 3 caracteres' });
    }

    // Validar CPF (algoritmo)
    if (!validateCpf(cpf)) {
      return reply.status(400).send({ error: 'CPF inválido. Verifique os dígitos.' });
    }

    // Validar código de indicação se fornecido
    let referrerId: string | null = null;
    if (referral_code) {
      const referrer = await referralsService.getUserByReferralCode(referral_code);
      if (!referrer) {
        return reply.status(400).send({ error: 'Código de indicação inválido' });
      }
      referrerId = referrer.id;
    }

    const result = await authService.register({ 
      email, password, username, fullname, cpf, phone,
      country_code, country_name, state_code, state_name, city
    });

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    // Registrar indicação se houver código válido
    if (referrerId && result.user?.id) {
      try {
        await referralsService.registerReferral(referrerId, result.user.id);
      } catch (err) {
        console.error('Erro ao registrar indicação:', err);
        // Não falhar o registro por causa da indicação
      }
    }

    return reply.status(201).send({
      message: 'Conta criada com sucesso!',
      user: result.user,
      session: result.session,
    });
  });

// Função de validação de CPF
function validateCpf(cpf: string): boolean {
  if (cpf.length !== 11) return false;
  
  // Verificar se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cpf)) return false;
  
  // Validar primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf[9])) return false;
  
  // Validar segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf[10])) return false;
  
  return true;
}

  // POST /auth/login
  fastify.post('/login', async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email e senha são obrigatórios' });
    }

    const result = await authService.login({ email, password });

    if (result.error) {
      return reply.status(401).send({ error: result.error });
    }

    return reply.send({
      user: result.user,
      session: result.session,
    });
  });

  // POST /auth/logout
  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return reply.status(401).send({ error: 'Token não fornecido' });
    }

    const result = await authService.logout(token);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: 'Logout realizado com sucesso' });
  });

  // GET /auth/me
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return reply.status(401).send({ error: 'Token não fornecido' });
    }

    const result = await authService.getUser(token);

    if (result.error) {
      return reply.status(401).send({ error: result.error });
    }

    return reply.send({ user: result.user });
  });

  // POST /auth/reset-password
  fastify.post('/reset-password', async (request: FastifyRequest<{ Body: ResetPasswordBody }>, reply: FastifyReply) => {
    const { email } = request.body;

    if (!email) {
      return reply.status(400).send({ error: 'Email é obrigatório' });
    }

    const result = await authService.resetPassword(email);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: 'E-mail de recuperação enviado' });
  });

  // POST /auth/update-password
  fastify.post('/update-password', async (request: FastifyRequest<{ Body: UpdatePasswordBody }>, reply: FastifyReply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');
    const { password } = request.body;

    if (!token) {
      return reply.status(401).send({ error: 'Token não fornecido' });
    }

    if (!password || password.length < 6) {
      return reply.status(400).send({ error: 'Senha deve ter no mínimo 6 caracteres' });
    }

    const result = await authService.updatePassword(token, password);

    if (result.error) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: 'Senha atualizada com sucesso' });
  });

  // POST /auth/refresh
  fastify.post('/refresh', async (request: FastifyRequest<{ Body: RefreshBody }>, reply: FastifyReply) => {
    const { refresh_token } = request.body;

    if (!refresh_token) {
      return reply.status(400).send({ error: 'Refresh token é obrigatório' });
    }

    const result = await authService.refreshSession(refresh_token);

    if (result.error) {
      return reply.status(401).send({ error: result.error });
    }

    return reply.send({
      user: result.user,
      session: result.session,
    });
  });
}
