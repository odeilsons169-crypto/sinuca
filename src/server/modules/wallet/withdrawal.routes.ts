import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../../services/supabase.js';
import { walletService } from './wallet.service.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

interface WithdrawalBody {
  amount: number;
  pix_key: string;
  pix_key_type?: string;
}

interface ListQuery {
  limit?: number;
  offset?: number;
}

export async function withdrawalRoutes(fastify: FastifyInstance) {
  // POST /withdrawals - Solicitar saque
  fastify.post('/', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Body: WithdrawalBody }>, reply: FastifyReply) => {
    const { amount, pix_key, pix_key_type } = request.body;

    if (!amount || amount <= 0) {
      return reply.status(400).send({ error: 'Valor inválido' });
    }

    if (!pix_key) {
      return reply.status(400).send({ error: 'Chave PIX é obrigatória' });
    }

    // Buscar configurações de saque
    const { data: settings } = await supabaseAdmin
      .from('payment_settings')
      .select('min_withdrawal_amount, max_withdrawal_amount')
      .limit(1)
      .single();

    const minAmount = settings?.min_withdrawal_amount || 10;
    const maxAmount = settings?.max_withdrawal_amount || 10000;

    if (amount < minAmount) {
      return reply.status(400).send({ error: `Valor mínimo para saque é R$ ${minAmount.toFixed(2)}` });
    }

    if (amount > maxAmount) {
      return reply.status(400).send({ error: `Valor máximo para saque é R$ ${maxAmount.toFixed(2)}` });
    }

    // Verificar carteira
    const wallet = await walletService.getByUserId(request.user!.id);

    if (!wallet) {
      return reply.status(404).send({ error: 'Carteira não encontrada' });
    }

    if (wallet.is_blocked) {
      return reply.status(403).send({ error: 'Carteira bloqueada' });
    }

    // IMPORTANTE: Verificar saldo DISPONÍVEL para saque (APENAS winnings_balance)
    const withdrawableBalance = await walletService.getWithdrawableBalance(request.user!.id);

    if (withdrawableBalance < amount) {
      return reply.status(400).send({ 
        error: 'Saldo insuficiente para saque. Apenas ganhos de partidas podem ser sacados. Depósitos devem ser usados em partidas e bônus não são sacáveis.',
        withdrawable: withdrawableBalance,
        requested: amount
      });
    }

    // Verificar se já tem saque pendente
    const { data: pending } = await supabaseAdmin
      .from('withdrawals')
      .select('id')
      .eq('user_id', request.user!.id)
      .eq('status', 'pending')
      .single();

    if (pending) {
      return reply.status(400).send({ error: 'Você já tem uma solicitação de saque pendente' });
    }

    // Processar saque usando a função que debita APENAS de winnings_balance
    const { data: result } = await supabaseAdmin.rpc('process_withdrawal', {
      p_user_id: request.user!.id,
      p_amount: amount
    });

    if (result && result[0] && !result[0].success) {
      return reply.status(400).send({ error: result[0].error_message });
    }

    // Criar solicitação de saque
    const { data, error } = await supabaseAdmin
      .from('withdrawals')
      .insert({
        user_id: request.user!.id,
        amount,
        fee: 0,
        net_amount: amount,
        pix_key,
        pix_key_type: pix_key_type || 'cpf',
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      // Reverter - adicionar de volta aos ganhos
      await supabaseAdmin.rpc('add_winnings_balance', {
        p_user_id: request.user!.id,
        p_amount: amount,
        p_description: 'Erro na solicitação de saque - reembolso'
      });
      return reply.status(500).send({ error: 'Erro ao criar solicitação' });
    }

    return reply.status(201).send({
      success: true,
      withdrawal: data,
      message: 'Solicitação de saque criada com sucesso. O valor foi debitado do seu saldo de ganhos.'
    });
  });

  // GET /withdrawals - Listar minhas solicitações
  fastify.get('/', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
    const limit = Math.min(request.query.limit || 20, 50);
    const offset = request.query.offset || 0;

    const { data, count } = await supabaseAdmin
      .from('withdrawals')
      .select('*', { count: 'exact' })
      .eq('user_id', request.user!.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Também retornar saldo disponível para saque
    const withdrawableBalance = await walletService.getWithdrawableBalance(request.user!.id);

    return reply.send({ 
      withdrawals: data || [], 
      total: count || 0,
      withdrawableBalance 
    });
  });

  // GET /withdrawals/balance - Saldo disponível para saque
  fastify.get('/balance', { preHandler: authMiddleware }, async (request: FastifyRequest, reply: FastifyReply) => {
    const wallet = await walletService.getByUserId(request.user!.id);
    const withdrawableBalance = await walletService.getWithdrawableBalance(request.user!.id);

    // Buscar configurações de saque
    const { data: settings } = await supabaseAdmin
      .from('payment_settings')
      .select('min_withdrawal_amount, max_withdrawal_amount')
      .limit(1)
      .single();

    return reply.send({
      totalBalance: wallet?.balance || 0,
      depositBalance: wallet?.deposit_balance || 0,
      winningsBalance: wallet?.winnings_balance || 0,
      bonusBalance: wallet?.bonus_balance || 0,
      withdrawableBalance,
      minWithdrawal: settings?.min_withdrawal_amount || 10,
      maxWithdrawal: settings?.max_withdrawal_amount || 10000,
      rules: {
        canWithdraw: ['winnings_balance'],
        cannotWithdraw: ['deposit_balance', 'bonus_balance'],
        message: 'Apenas ganhos de partidas (winnings_balance) podem ser sacados. Depósitos devem ser usados em partidas e bônus não são sacáveis.'
      }
    });
  });

  // DELETE /withdrawals/:id - Cancelar solicitação pendente
  fastify.delete('/:id', { preHandler: authMiddleware }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { data: withdrawal } = await supabaseAdmin
      .from('withdrawals')
      .select('*')
      .eq('id', request.params.id)
      .eq('user_id', request.user!.id)
      .single();

    if (!withdrawal) {
      return reply.status(404).send({ error: 'Solicitação não encontrada' });
    }

    if (withdrawal.status !== 'pending') {
      return reply.status(400).send({ error: 'Apenas solicitações pendentes podem ser canceladas' });
    }

    // Devolver valor para winnings_balance
    await supabaseAdmin.rpc('add_winnings_balance', {
      p_user_id: request.user!.id,
      p_amount: withdrawal.amount,
      p_description: 'Saque cancelado pelo usuário - reembolso'
    });

    // Atualizar status
    await supabaseAdmin
      .from('withdrawals')
      .update({ status: 'rejected', rejection_reason: 'Cancelado pelo usuário' })
      .eq('id', request.params.id);

    return reply.send({ success: true, message: 'Solicitação cancelada' });
  });
}
