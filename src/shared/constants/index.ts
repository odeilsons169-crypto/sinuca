// Constantes do sistema

// Créditos/Fichas
export const CREDIT_VALUE_BRL = 0.50; // 1 crédito = R$ 0,50
export const CREDITS_PER_PURCHASE = 4; // Pacote mínimo = 4 créditos
export const PURCHASE_PRICE_BRL = 2; // R$ 2,00 = 4 créditos
export const CREDITS_PER_MATCH = 1; // 1 crédito por partida

// Assinatura VIP
export const VIP_MONTHLY_PRICE = 19.90; // R$ 19,90/mês
export const VIP_YEARLY_PRICE = 149.90; // R$ 149,90/ano (desconto)

// Apostas
export const PLATFORM_FEE_PERCENT = 10; // 10% para a plataforma
export const WINNER_PAYOUT_PERCENT = 90; // 90% para o vencedor
export const MIN_BET_AMOUNT = 5; // R$5 mínimo

// Ranking
export const POINTS_PER_WIN = 10;
export const POINTS_PER_LOSS = -3;
export const POINTS_PER_BET_WIN = 15;

// Punições (duração em horas)
export const MUTE_DURATION_HOURS = 24;
export const SUSPENSION_DURATION_HOURS = 72;

// Limites
export const MAX_ROOMS_PER_USER = 1;
export const MAX_GUESTS_PER_ROOM = 1;

// Admin (ID do administrador para receber comissões)
export const ADMIN_USER_ID = process.env.ADMIN_USER_ID || 'admin';
