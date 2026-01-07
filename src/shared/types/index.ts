// Tipos compartilhados entre backend e frontend

export type UserRole = 'user' | 'moderator' | 'admin' | 'super_admin';
export type UserStatus = 'active' | 'suspended' | 'banned';
export type MatchStatus = 'waiting' | 'playing' | 'finished' | 'cancelled';
export type MatchMode = 'casual' | 'ranked' | 'bet' | 'ai';
export type RoomStatus = 'open' | 'full' | 'playing' | 'closed';
export type BetStatus = 'pending' | 'active' | 'settled' | 'cancelled';
export type TransactionType = 'deposit' | 'withdrawal' | 'bet_win' | 'bet_loss' | 'credit_purchase' | 'admin_adjustment' | 'bonus' | 'winnings' | 'debit';
export type PunishmentType = 'warning' | 'mute' | 'suspension' | 'ban';
export type BalanceType = 'deposit' | 'winnings' | 'bonus';

export interface User {
  id: string;
  email: string;
  username: string;
  fullname: string | null;
  cpf: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  // Sistema de Níveis
  level: number;
  xp: number;
  xp_to_next_level: number;
  total_xp: number;
  // Localização
  country_code: string | null;
  country_name: string | null;
  state_code: string | null;
  state_name: string | null;
  city: string | null;
  // Admin flags
  is_admin?: boolean;
  is_banned?: boolean;
  ban_reason?: string | null;
  banned_at?: string | null;
  is_suspended?: boolean;
  suspended_until?: string | null;
  suspension_reason?: string | null;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

// Tipos de localização
export interface Country {
  code: string;
  name: string;
  name_pt: string;
  flag_emoji: string;
  is_active: boolean;
}

export interface State {
  code: string;
  name: string;
}

export interface UserStats {
  user_id: string;
  total_matches: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_credits_used: number;
  total_bet_won: number;
  total_bet_lost: number;
  ranking_points: number;
  global_rank: number | null;
  monthly_rank: number | null;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  deposit_balance: number;
  winnings_balance: number;
  bonus_balance: number;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
}

export interface Credits {
  id: string;
  user_id: string;
  amount: number;
  is_unlimited: boolean;
  last_free_credit?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  owner_id: string;
  guest_id: string | null;
  status: RoomStatus;
  mode: MatchMode;
  bet_amount: number | null;
  is_private: boolean;
  invite_code: string | null;
  aim_line_enabled: boolean;
  game_mode: '15ball' | '9ball';
  created_at: string;
}

export interface Match {
  id: string;
  room_id: string;
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  status: MatchStatus;
  mode: MatchMode;
  player1_score: number;
  player2_score: number;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface Bet {
  id: string;
  match_id: string;
  player1_id: string;
  player2_id: string;
  amount: number;
  total_pool: number;
  status: BetStatus;
  winner_id: string | null;
  winner_payout: number | null;
  platform_fee: number | null;
  settled_at: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  balance_after: number;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

export interface Punishment {
  id: string;
  user_id: string;
  admin_id: string;
  type: PunishmentType;
  reason: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Ranking {
  id: string;
  user_id: string;
  points: number;
  period: 'global' | 'monthly';
  month: string | null;
  position: number | null;
  updated_at: string;
}


// =====================================================
// TIPOS ADICIONAIS (Sincronizados com DB)
// =====================================================

export type NotificationType = 
  | 'welcome' 
  | 'match_invite' 
  | 'match_result' 
  | 'credits_purchased' 
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'punishment'
  | 'ranking_update'
  | 'system';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export type TournamentStatus = 'draft' | 'open' | 'in_progress' | 'finished' | 'cancelled';
export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin';

export interface Tournament {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  registration_deadline: string | null;
  entry_fee: number;
  prize_pool: number;
  prize_distribution: Record<string, number>;
  max_participants: number;
  min_participants: number;
  game_mode: string;
  format: TournamentFormat;
  status: TournamentStatus;
  is_vip_only: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string;
  seed: number | null;
  status: string;
  placement: number | null;
  prize_won: number;
  eliminated_at: string | null;
  eliminated_by: string | null;
  registered_at: string;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  match_id: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  status: string;
  is_bye: boolean;
  created_at: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'refused' | 'expired' | 'refunded';
export type PaymentMethod = 'pix' | 'credit_card';

export interface Payment {
  id: string;
  user_id: string;
  external_id: string | null;
  txid: string | null;
  method: PaymentMethod;
  amount_brl: number;
  credits_amount: number;
  status: PaymentStatus;
  payer_name: string | null;
  payer_cpf: string | null;
  pix_qrcode: string | null;
  pix_copy_paste: string | null;
  pix_expiration: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'rejected';
export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

export interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: WithdrawalStatus;
  pix_key: string;
  pix_key_type: PixKeyType;
  rejection_reason: string | null;
  processed_at: string | null;
  processed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SystemSetting {
  key: string;
  value: unknown;
  updated_at: string;
  updated_by: string | null;
}

export interface AdminLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_name: string;
  price: number;
  is_active: boolean;
  starts_at: string;
  expires_at: string;
  created_at: string;
}

export interface Invite {
  id: string;
  room_id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  expires_at: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  message: string;
  is_flagged: boolean;
  flagged_reason: string | null;
  is_deleted: boolean;
  deleted_by: string | null;
  created_at: string;
}
