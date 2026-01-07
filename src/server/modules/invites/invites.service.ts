import { supabaseAdmin } from '../../services/supabase.js';
import { notificationsService } from '../notifications/notifications.service.js';

interface Invite {
  id: string;
  from_user_id: string;
  to_user_id: string;
  room_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  created_at: string;
  expires_at: string;
}

class InvitesService {
  // Criar convite
  async create(fromUserId: string, toUserId: string, roomId: string): Promise<{ invite?: Invite; error?: string }> {
    // Verificar se já existe convite pendente
    const { data: existing } = await supabaseAdmin
      .from('invites')
      .select('*')
      .eq('from_user_id', fromUserId)
      .eq('to_user_id', toUserId)
      .eq('room_id', roomId)
      .eq('status', 'pending')
      .single();

    if (existing) {
      return { error: 'Convite já enviado' };
    }

    // Verificar se a sala existe e está aberta
    const { data: room } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .eq('status', 'open')
      .single();

    if (!room) {
      return { error: 'Sala não encontrada ou não está aberta' };
    }

    // Criar convite (expira em 5 minutos)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data: invite, error } = await supabaseAdmin
      .from('invites')
      .insert({
        from_user_id: fromUserId,
        to_user_id: toUserId,
        room_id: roomId,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      return { error: 'Erro ao criar convite' };
    }

    // Buscar nome do remetente
    const { data: fromUser } = await supabaseAdmin
      .from('users')
      .select('username')
      .eq('id', fromUserId)
      .single();

    // Enviar notificação
    await notificationsService.sendMatchInvite(
      toUserId,
      fromUser?.username || 'Jogador',
      roomId
    );

    return { invite };
  }

  // Listar convites pendentes do usuário
  async getPending(userId: string): Promise<Invite[]> {
    const { data, error } = await supabaseAdmin
      .from('invites')
      .select(`
        *,
        from_user:users!from_user_id(id, username, avatar_url),
        room:rooms(id, mode, bet_amount)
      `)
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  }

  // Aceitar convite
  async accept(inviteId: string, userId: string): Promise<{ success: boolean; roomId?: string; error?: string }> {
    // Buscar convite
    const { data: invite } = await supabaseAdmin
      .from('invites')
      .select('*')
      .eq('id', inviteId)
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .single();

    if (!invite) {
      return { success: false, error: 'Convite não encontrado' };
    }

    // Verificar se expirou
    if (new Date(invite.expires_at) < new Date()) {
      await supabaseAdmin
        .from('invites')
        .update({ status: 'expired' })
        .eq('id', inviteId);
      return { success: false, error: 'Convite expirado' };
    }

    // Verificar se a sala ainda está aberta
    const { data: room } = await supabaseAdmin
      .from('rooms')
      .select('*')
      .eq('id', invite.room_id)
      .eq('status', 'open')
      .single();

    if (!room) {
      return { success: false, error: 'Sala não está mais disponível' };
    }

    // Atualizar convite
    await supabaseAdmin
      .from('invites')
      .update({ status: 'accepted' })
      .eq('id', inviteId);

    return { success: true, roomId: invite.room_id };
  }

  // Rejeitar convite
  async reject(inviteId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
      .from('invites')
      .update({ status: 'rejected' })
      .eq('id', inviteId)
      .eq('to_user_id', userId)
      .eq('status', 'pending');

    if (error) {
      return { success: false, error: 'Erro ao rejeitar convite' };
    }

    return { success: true };
  }

  // Cancelar convite (pelo remetente)
  async cancel(inviteId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
      .from('invites')
      .delete()
      .eq('id', inviteId)
      .eq('from_user_id', userId)
      .eq('status', 'pending');

    if (error) {
      return { success: false, error: 'Erro ao cancelar convite' };
    }

    return { success: true };
  }

  // Limpar convites expirados
  async cleanExpired(): Promise<void> {
    await supabaseAdmin
      .from('invites')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());
  }
}

export const invitesService = new InvitesService();
