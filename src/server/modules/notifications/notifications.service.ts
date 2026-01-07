import { supabaseAdmin } from '../../services/supabase.js';

// Tipos de notificação
type NotificationType = 
  | 'welcome' 
  | 'match_invite' 
  | 'match_result' 
  | 'credits_purchased' 
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'punishment'
  | 'ranking_update'
  | 'system';

interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  created_at: string;
}

class NotificationsService {
  // Criar notificação in-app
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: any
  ): Promise<Notification | null> {
    const { data: notification, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        data,
        read: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar notificação:', error);
      return null;
    }

    return notification;
  }

  // Listar notificações do usuário
  async getByUser(userId: string, limit = 50): Promise<Notification[]> {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar notificações:', error);
      return [];
    }

    return data || [];
  }

  // Contar não lidas
  async countUnread(userId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) return 0;
    return count || 0;
  }

  // Marcar como lida
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);

    return !error;
  }

  // Marcar todas como lidas
  async markAllAsRead(userId: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    return !error;
  }

  // Deletar notificação
  async delete(notificationId: string, userId: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId);

    return !error;
  }

  // Deletar todas do usuário
  async deleteAll(userId: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('user_id', userId);

    return !error;
  }

  // ==================== NOTIFICAÇÕES PRÉ-DEFINIDAS ====================

  async sendWelcome(userId: string, username: string) {
    return this.create(
      userId,
      'welcome',
      'Bem-vindo ao Sinuca Online! 🎱',
      `Olá ${username}! Você ganhou 2 créditos grátis para começar. Boa sorte nas mesas!`
    );
  }

  async sendMatchInvite(userId: string, inviterName: string, roomId: string) {
    return this.create(
      userId,
      'match_invite',
      'Convite para Partida 🎯',
      `${inviterName} te convidou para uma partida!`,
      { room_id: roomId }
    );
  }

  async sendMatchResult(userId: string, won: boolean, points: number) {
    return this.create(
      userId,
      'match_result',
      won ? 'Vitória! 🏆' : 'Derrota 😔',
      won 
        ? `Parabéns! Você ganhou ${points} pontos no ranking.`
        : `Não foi dessa vez. Você perdeu ${Math.abs(points)} pontos.`,
      { won, points }
    );
  }

  async sendCreditsPurchased(userId: string, amount: number, credits: number) {
    return this.create(
      userId,
      'credits_purchased',
      'Créditos Adicionados! 💰',
      `Você comprou ${credits} créditos por R$ ${amount.toFixed(2)}.`
    );
  }

  async sendWithdrawalApproved(userId: string, amount: number) {
    return this.create(
      userId,
      'withdrawal_approved',
      'Saque Aprovado! ✅',
      `Seu saque de R$ ${amount.toFixed(2)} foi aprovado e será processado em breve.`
    );
  }

  async sendWithdrawalRejected(userId: string, amount: number, reason: string) {
    return this.create(
      userId,
      'withdrawal_rejected',
      'Saque Rejeitado ❌',
      `Seu saque de R$ ${amount.toFixed(2)} foi rejeitado. Motivo: ${reason}`
    );
  }

  async sendPunishment(userId: string, type: string, reason: string, duration?: string) {
    const titles: Record<string, string> = {
      warn: 'Aviso Recebido ⚠️',
      mute: 'Você foi Silenciado 🔇',
      suspend: 'Conta Suspensa ⏸️',
      ban: 'Conta Banida 🚫',
    };

    return this.create(
      userId,
      'punishment',
      titles[type] || 'Penalidade Aplicada',
      `Motivo: ${reason}${duration ? `. Duração: ${duration}` : ''}`,
      { type, reason, duration }
    );
  }

  async sendRankingUpdate(userId: string, position: number, change: number) {
    const direction = change > 0 ? 'subiu' : 'desceu';
    return this.create(
      userId,
      'ranking_update',
      'Ranking Atualizado 📊',
      `Você ${direction} ${Math.abs(change)} posições! Agora está em ${position}º lugar.`,
      { position, change }
    );
  }

  async sendSystemNotification(userId: string, title: string, message: string) {
    return this.create(userId, 'system', title, message);
  }

  // Enviar para múltiplos usuários
  async broadcast(userIds: string[], type: NotificationType, title: string, message: string) {
    const notifications = userIds.map(userId => ({
      user_id: userId,
      type,
      title,
      message,
      read: false,
    }));

    const { error } = await supabaseAdmin
      .from('notifications')
      .insert(notifications);

    return !error;
  }

  // ==================== EMAIL (SIMULADO) ====================

  async sendEmail(to: string, subject: string, body: string, userId?: string) {
    // Log do email
    await supabaseAdmin.from('email_logs').insert({
      user_id: userId,
      to_email: to,
      subject,
      body,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    console.log(`📧 Email enviado para ${to}: ${subject}`);
    return true;
  }
}

export const notificationsService = new NotificationsService();
