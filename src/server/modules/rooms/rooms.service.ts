import { supabaseAdmin } from '../../services/supabase.js';
import type { Room, MatchMode } from '../../../shared/types/index.js';
import { MIN_BET_AMOUNT } from '../../../shared/constants/index.js';
import { creditsService } from '../credits/credits.service.js';
import { walletService } from '../wallet/wallet.service.js';

export interface CreateRoomInput {
  mode: MatchMode;
  bet_amount?: number;
  is_private?: boolean;
  aim_line_enabled?: boolean;
  game_mode?: '15ball' | '9ball';
}

export const roomsService = {
  // Criar sala
  async create(ownerId: string, input: CreateRoomInput): Promise<{ room: Room | null; error: string | null }> {
    // Verificar se já tem sala ativa
    const { data: existingRoom } = await supabaseAdmin
      .from('rooms')
      .select('id')
      .eq('owner_id', ownerId)
      .in('status', ['open', 'full', 'playing'])
      .single();

    if (existingRoom) {
      return { room: null, error: 'Você já possui uma sala ativa' };
    }

    // Verificar créditos (exceto modo AI que é grátis para treino)
    if (input.mode !== 'ai') {
      const hasCredits = await creditsService.hasEnough(ownerId, 1);
      if (!hasCredits) {
        // Tentar dar crédito diário grátis
        const dailyResult = await creditsService.checkDailyFreeCredit(ownerId);
        if (!dailyResult.credited) {
          return { room: null, error: 'Você não tem créditos suficientes. Compre créditos ou aguarde seu crédito grátis amanhã.' };
        }
      }
    }

    // Validar aposta
    if (input.mode === 'bet') {
      if (!input.bet_amount || input.bet_amount < MIN_BET_AMOUNT) {
        return { room: null, error: `Aposta mínima é R$ ${MIN_BET_AMOUNT.toFixed(2)}` };
      }

      // Verificar saldo disponível para aposta (deposit + winnings, NÃO bonus)
      const availableForBet = await walletService.getAvailableForBet(ownerId);
      if (availableForBet < input.bet_amount) {
        return { room: null, error: `Saldo insuficiente para aposta. Disponível: R$ ${availableForBet.toFixed(2)}. Bônus não pode ser usado em apostas.` };
      }
    }

    // Gerar código de convite para salas privadas
    let inviteCode: string | null = null;
    if (input.is_private) {
      // Gerar código único de 6 caracteres alfanuméricos
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      inviteCode = '';
      for (let i = 0; i < 6; i++) {
        inviteCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }

    const { data, error } = await supabaseAdmin
      .from('rooms')
      .insert({
        owner_id: ownerId,
        mode: input.mode,
        bet_amount: input.mode === 'bet' ? input.bet_amount : null,
        status: 'open',
        is_private: input.is_private || false,
        invite_code: inviteCode,
        aim_line_enabled: input.aim_line_enabled !== false, // Default true
        game_mode: input.game_mode || '15ball',
      })
      .select()
      .single();

    if (error) {
      return { room: null, error: error.message };
    }

    return { room: data as Room, error: null };
  },

  // Buscar sala por ID
  async getById(roomId: string): Promise<Room | null> {
    const { data } = await supabaseAdmin
      .from('rooms')
      .select('*, owner:users!owner_id(id, username, avatar_url), guest:users!guest_id(id, username, avatar_url)')
      .eq('id', roomId)
      .single();

    return data as Room | null;
  },

  // Listar salas abertas (públicas E privadas, mas sem mostrar código das privadas)
  async listOpen(limit = 20, offset = 0) {
    const { data, count, error } = await supabaseAdmin
      .from('rooms')
      .select('id, owner_id, guest_id, mode, bet_amount, status, is_private, created_at, owner:users!owner_id(id, username, avatar_url)', { count: 'exact' })
      .eq('status', 'open')
      .neq('mode', 'ai') // Exclui salas AI da listagem normal
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.log('[rooms.listOpen] Erro:', error.message);
    }

    return { rooms: data || [], total: count || 0 };
  },

  // Entrar em sala
  async join(roomId: string, guestId: string): Promise<{ room: Room | null; error: string | null }> {
    const room = await this.getById(roomId);

    if (!room) {
      console.log('[rooms.join] Sala não encontrada:', roomId);
      return { room: null, error: 'Sala não encontrada' };
    }

    if (room.status !== 'open') {
      console.log('[rooms.join] Sala não está aberta:', room.status);
      return { room: null, error: 'Sala não está disponível' };
    }

    if (room.owner_id === guestId) {
      console.log('[rooms.join] Usuário tentou entrar na própria sala');
      return { room: null, error: 'Você não pode entrar na própria sala' };
    }

    if (room.guest_id) {
      console.log('[rooms.join] Sala já está cheia');
      return { room: null, error: 'Sala já está cheia' };
    }

    // Verificar créditos do convidado
    const hasCredits = await creditsService.hasEnough(guestId, 1);
    if (!hasCredits) {
      const dailyResult = await creditsService.checkDailyFreeCredit(guestId);
      if (!dailyResult.credited) {
        console.log('[rooms.join] Usuário sem créditos:', guestId);
        return { room: null, error: 'Você não tem créditos suficientes para entrar na sala.' };
      }
      console.log('[rooms.join] Crédito diário concedido:', guestId);
    }

    // Verificar saldo para aposta (se for modo bet)
    if (room.mode === 'bet' && room.bet_amount) {
      const availableForBet = await walletService.getAvailableForBet(guestId);
      if (availableForBet < room.bet_amount) {
        console.log('[rooms.join] Usuário sem saldo para aposta:', guestId, 'Disponível:', availableForBet, 'Necessário:', room.bet_amount);
        return { room: null, error: `Saldo insuficiente para aposta. Disponível: R$ ${availableForBet.toFixed(2)}. Necessário: R$ ${room.bet_amount.toFixed(2)}. Bônus não pode ser usado em apostas.` };
      }
    }

    const { data, error } = await supabaseAdmin
      .from('rooms')
      .update({ guest_id: guestId, status: 'full' })
      .eq('id', roomId)
      .eq('status', 'open')
      .select()
      .single();

    if (error) {
      console.log('[rooms.join] Erro ao atualizar sala:', error.message);
      return { room: null, error: error.message };
    }

    console.log('[rooms.join] Usuário entrou na sala com sucesso:', guestId);
    return { room: data as Room, error: null };
  },

  // Sair da sala
  async leave(roomId: string, userId: string): Promise<{ error: string | null }> {
    const room = await this.getById(roomId);

    if (!room) {
      // Sala não existe mais, considerar como sucesso (já foi fechada)
      return { error: null };
    }

    // Se a sala já está fechada, apenas retorna sucesso
    if (room.status === 'closed') {
      return { error: null };
    }

    // Se está jogando, usar forfeit ao invés de leave
    if (room.status === 'playing') {
      // Permitir sair mas processar como forfeit
      const forfeitResult = await this.forfeit(roomId, userId);
      if (!forfeitResult.success) {
        return { error: forfeitResult.error || 'Erro ao processar abandono' };
      }
      return { error: null };
    }

    // Se é o dono, fecha a sala
    if (room.owner_id === userId) {
      await supabaseAdmin
        .from('rooms')
        .update({ status: 'closed' })
        .eq('id', roomId);

      return { error: null };
    }

    // Se é o convidado, apenas sai
    if (room.guest_id === userId) {
      await supabaseAdmin
        .from('rooms')
        .update({ guest_id: null, status: 'open' })
        .eq('id', roomId);

      return { error: null };
    }

    return { error: 'Você não está nesta sala' };
  },

  // Fechar sala
  async close(roomId: string, ownerId: string): Promise<{ error: string | null }> {
    const room = await this.getById(roomId);

    if (!room) {
      return { error: 'Sala não encontrada' };
    }

    if (room.owner_id !== ownerId) {
      return { error: 'Apenas o dono pode fechar a sala' };
    }

    if (room.status === 'playing') {
      return { error: 'Não é possível fechar durante uma partida' };
    }

    const { error } = await supabaseAdmin
      .from('rooms')
      .update({ status: 'closed' })
      .eq('id', roomId);

    return { error: error?.message || null };
  },

  // Buscar sala ativa do usuário
  async getActiveByUser(userId: string): Promise<Room | null> {
    const { data } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .or(`owner_id.eq.${userId},guest_id.eq.${userId}`)
      .in('status', ['open', 'full', 'playing'])
      .single();

    return data as Room | null;
  },

  // Buscar sala por código (para salas privadas)
  async getByCode(code: string): Promise<Room | null> {
    const { data } = await supabaseAdmin
      .from('rooms')
      .select('*, owner:users!owner_id(id, username, avatar_url)')
      .eq('invite_code', code)
      .eq('status', 'open')
      .single();

    return data as Room | null;
  },

  // Abandonar partida (forfeit)
  async forfeit(roomId: string, forfeitingUserId: string): Promise<{
    success: boolean;
    winnerId?: string;
    winnerUsername?: string;
    loserId?: string;
    loserUsername?: string;
    prizeAmount?: number;
    adminFee?: number;
    error?: string;
  }> {
    const room = await this.getById(roomId);

    if (!room) {
      return { success: false, error: 'Sala não encontrada' };
    }

    // Verificar se o usuário está na sala
    const isOwner = room.owner_id === forfeitingUserId;
    const isGuest = room.guest_id === forfeitingUserId;

    if (!isOwner && !isGuest) {
      return { success: false, error: 'Você não está nesta sala' };
    }

    // Determinar vencedor e perdedor
    const winnerId = isOwner ? room.guest_id : room.owner_id;
    const loserId = forfeitingUserId;

    if (!winnerId) {
      // Se não tem oponente, apenas fecha a sala
      await supabaseAdmin
        .from('rooms')
        .update({ status: 'closed' })
        .eq('id', roomId);

      return { success: true };
    }

    // Buscar usernames
    const { data: winnerData } = await supabaseAdmin
      .from('users')
      .select('username')
      .eq('id', winnerId)
      .single();

    const { data: loserData } = await supabaseAdmin
      .from('users')
      .select('username')
      .eq('id', loserId)
      .single();

    const winnerUsername = winnerData?.username || 'Jogador';
    const loserUsername = loserData?.username || 'Jogador';

    let prizeAmount = 0;
    let adminFee = 0;

    // Se for modo aposta, processar distribuição do prêmio
    if (room.mode === 'bet' && room.bet_amount && room.bet_amount > 0) {
      const totalPot = room.bet_amount * 2; // Ambos apostaram
      adminFee = Math.floor(totalPot * 0.10); // 10% para admin
      prizeAmount = totalPot - adminFee; // 90% para o vencedor

      // Creditar o vencedor diretamente na wallet
      const { data: wallet } = await supabaseAdmin
        .from('wallet')
        .select('balance, winnings_balance')
        .eq('user_id', winnerId)
        .single();

      if (wallet) {
        const newBalance = Number(wallet.balance) + prizeAmount;
        const newWinnings = Number(wallet.winnings_balance || 0) + prizeAmount;

        await supabaseAdmin
          .from('wallet')
          .update({
            balance: newBalance,
            winnings_balance: newWinnings,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', winnerId);

        // Registrar transação do vencedor
        await supabaseAdmin.from('transactions').insert({
          user_id: winnerId,
          type: 'bet_win',
          amount: prizeAmount,
          balance_after: newBalance,
          reference_id: roomId,
          description: `Vitória por abandono - Sala ${roomId.slice(0, 8)}`,
        });

        console.log(`[forfeit] Vencedor ${winnerId} creditado com R$${prizeAmount}`);
      }

      // Registrar taxa admin
      if (adminFee > 0) {
        await supabaseAdmin.from('transactions').insert({
          user_id: winnerId,
          type: 'admin_adjustment',
          amount: adminFee,
          balance_after: 0,
          reference_id: roomId,
          description: `Taxa administrativa (10%) - Sala ${roomId.slice(0, 8)}`,
        });
      }
    }

    // Atualizar sala para fechada
    await supabaseAdmin
      .from('rooms')
      .update({
        status: 'closed',
      })
      .eq('id', roomId);

    // Atualizar ranking do vencedor (adicionar pontos) - ignorar se função não existir
    try {
      await supabaseAdmin.rpc('increment_ranking_points', {
        p_user_id: winnerId,
        p_points: 10,
      });
    } catch (e) {
      console.log('[forfeit] Função increment_ranking_points não encontrada ou erro:', e);
    }

    return {
      success: true,
      winnerId,
      winnerUsername,
      loserId,
      loserUsername,
      prizeAmount,
      adminFee,
    };
  },
};
