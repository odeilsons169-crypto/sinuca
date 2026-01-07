// Cliente API para comunicação com o backend

const API_URL = '/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('access_token');
    }
    return this.token;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {}),
    };

    // Só adiciona Content-Type se tiver body
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = endpoint.startsWith('/api') ? endpoint : `${API_URL}${endpoint}`;

    try {
      const response = await fetch(url, { ...options, headers });
      
      // Se receber 401, tentar refresh do token
      if (response.status === 401) {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const refreshResult = await this.refreshSession(refreshToken);
          if (refreshResult) {
            // Tentar a requisição novamente com o novo token
            headers['Authorization'] = `Bearer ${this.getToken()}`;
            const retryResponse = await fetch(url, { ...options, headers });
            const retryData = await retryResponse.json();
            if (!retryResponse.ok) {
              return { error: retryData.error || 'Token inválido ou expirado' };
            }
            return { data: retryData };
          }
        }
        return { error: 'Token inválido ou expirado' };
      }
      
      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Erro desconhecido' };
      }

      return { data };
    } catch (err) {
      return { error: 'Erro de conexão' };
    }
  }

  private async refreshSession(refreshToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.session) {
          this.setToken(data.session.access_token);
          localStorage.setItem('refresh_token', data.session.refresh_token);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  // Auth
  async register(email: string, password: string, username: string, fullname?: string, cpf?: string, phone?: string) {
    return this.request<{ user: any; session: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username, fullname, cpf, phone }),
    });
  }

  async login(email: string, password: string) {
    const result = await this.request<{ user: any; session: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (result.data?.session) {
      this.setToken(result.data.session.access_token);
      localStorage.setItem('refresh_token', result.data.session.refresh_token);
    }

    return result;
  }

  async logout() {
    const result = await this.request('/auth/logout', { method: 'POST' });
    this.setToken(null);
    localStorage.removeItem('refresh_token');
    return result;
  }

  async getMe() {
    return this.request<{ user: any }>('/auth/me');
  }

  // Users
  async getProfile() {
    return this.request<any>('/users/me');
  }

  async updateProfile(data: { 
    username?: string; 
    avatar_url?: string;
    country_code?: string;
    country_name?: string;
  }) {
    return this.request<{ user: any }>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async searchUsers(query: string) {
    return this.request<{ users: any[] }>(`/users/search?q=${encodeURIComponent(query)}`);
  }

  // Wallet
  async getWallet() {
    return this.request<any>('/wallet');
  }

  async getAvailableForBet() {
    return this.request<{
      available_for_bet: number;
      deposit_balance: number;
      winnings_balance: number;
      bonus_balance: number;
      total_balance: number;
    }>('/wallet/available-for-bet');
  }

  async getTransactions(limit = 20, offset = 0) {
    return this.request<{ transactions: any[]; total: number }>(
      `/wallet/transactions?limit=${limit}&offset=${offset}`
    );
  }

  // Credits
  async getCredits() {
    return this.request<any>('/credits');
  }

  async checkCredits() {
    return this.request<{ has_credits: boolean }>('/credits/check');
  }

  async getCreditsHistory(limit = 50, offset = 0) {
    return this.request<{
      history: any[];
      total: number;
      summary: { total_received: number; total_used: number; net: number };
    }>(`/credits/history?limit=${limit}&offset=${offset}`);
  }

  // Comprar créditos com saldo da carteira
  async purchaseCreditsWithWallet(quantity: number) {
    return this.request<{
      success: boolean;
      credits?: any;
      message?: string;
      error?: string;
    }>('/credits/purchase', {
      method: 'POST',
      body: JSON.stringify({ quantity }),
    });
  }

  // Rooms
  async getRooms(limit = 20, offset = 0) {
    return this.request<{ rooms: any[]; total: number }>(
      `/rooms?limit=${limit}&offset=${offset}`
    );
  }

  async createRoom(
    mode: 'casual' | 'bet' | 'ai', 
    betAmount?: number, 
    isPrivate?: boolean,
    aimLineEnabled: boolean = true,
    gameMode: '15ball' | '9ball' = '15ball'
  ) {
    return this.request<any>('/rooms', {
      method: 'POST',
      body: JSON.stringify({ 
        mode, 
        bet_amount: betAmount, 
        is_private: isPrivate,
        aim_line_enabled: aimLineEnabled,
        game_mode: gameMode
      }),
    });
  }

  async getRoom(roomId: string) {
    return this.request<any>(`/rooms/${roomId}`);
  }

  async joinRoom(roomId: string) {
    return this.request<any>(`/rooms/${roomId}/join`, { method: 'POST' });
  }

  async joinRoomByCode(code: string) {
    return this.request<any>(`/rooms/code/${code}/join`, { method: 'POST' });
  }

  async leaveRoom(roomId: string) {
    return this.request(`/rooms/${roomId}/leave`, { method: 'POST' });
  }

  async forfeitRoom(roomId: string) {
    return this.request<{
      success: boolean;
      winnerId?: string;
      winnerUsername?: string;
      loserId?: string;
      loserUsername?: string;
      prizeAmount?: number;
      adminFee?: number;
    }>(`/rooms/${roomId}/forfeit`, { method: 'POST' });
  }

  async getActiveRoom() {
    return this.request<any>('/rooms/active');
  }

  // Matches
  async createMatch(roomId: string) {
    return this.request<any>('/matches', {
      method: 'POST',
      body: JSON.stringify({ room_id: roomId }),
    });
  }

  async getMatch(matchId: string) {
    return this.request<any>(`/matches/${matchId}`);
  }

  async startMatch(matchId: string) {
    return this.request<any>(`/matches/${matchId}/start`, { method: 'POST' });
  }

  async finishMatch(matchId: string, winnerId: string) {
    return this.request<any>(`/matches/${matchId}/finish`, {
      method: 'POST',
      body: JSON.stringify({ winner_id: winnerId }),
    });
  }

  // Histórico de partidas do usuário
  async getMatchHistory(limit = 20, offset = 0, status?: string) {
    let url = `/matches?limit=${limit}&offset=${offset}`;
    if (status) url += `&status=${status}`;
    return this.request<{ matches: any[]; total: number }>(url);
  }

  // Ranking
  async getRanking(limit = 50, offset = 0) {
    return this.request<{ rankings: any[]; total: number }>(
      `/ranking?limit=${limit}&offset=${offset}`
    );
  }

  async getTopPlayers(limit = 10) {
    return this.request<{ players: any[] }>(`/ranking/top?limit=${limit}`);
  }

  async getMyRanking() {
    return this.request<any>('/ranking/me');
  }

  async getWeeklyRanking(limit = 50, offset = 0, week?: string) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (week) params.append('week', week);
    return this.request<{ rankings: any[]; total: number; week: string }>(
      `/ranking/weekly?${params.toString()}`
    );
  }

  async getWeeklyTop10() {
    return this.request<{ rankings: any[]; week: string; weekLabel: string }>(
      '/ranking/weekly/top10'
    );
  }

  async getMonthlyRanking(limit = 50, offset = 0, month?: string) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (month) params.append('month', month);
    return this.request<{ rankings: any[]; total: number; month: string }>(
      `/ranking/monthly?${params.toString()}`
    );
  }

  async getRankingHistory(periodType?: string, limit = 20) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (periodType) params.append('period', periodType);
    return this.request<{ history: any[] }>(
      `/ranking/history?${params.toString()}`
    );
  }

  async getUserRankingHistory(userId: string, periodType?: string, limit = 20) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (periodType) params.append('period', periodType);
    return this.request<{ history: any[] }>(
      `/ranking/user/${userId}/history?${params.toString()}`
    );
  }

  // ==================== RANKING VS CPU ====================

  async getAIRankingTop(limit = 10) {
    return this.request<{
      success: boolean;
      ranking: any[];
      title: string;
      subtitle: string;
    }>(`/ai-ranking/top?limit=${limit}`);
  }

  async getMyAIRanking() {
    return this.request<{
      success: boolean;
      stats: {
        total_matches: number;
        wins: number;
        losses: number;
        win_rate: number;
        best_streak: number;
        current_streak: number;
        points: number;
        position: number | null;
      };
    }>('/ai-ranking/me');
  }

  async recordAIMatch(won: boolean) {
    return this.request<{
      success: boolean;
      stats?: any;
      message: string;
    }>('/ai-ranking/record', {
      method: 'POST',
      body: JSON.stringify({ won }),
    });
  }

  async getAIMatchHistory(limit = 20) {
    return this.request<{
      success: boolean;
      matches: any[];
      total: number;
    }>(`/ai-ranking/history?limit=${limit}`);
  }

  // Notifications
  async getNotifications() {
    return this.request<{ notifications: any[]; unread_count: number }>('/notifications');
  }

  async getUnreadCount() {
    return this.request<{ unread_count: number }>('/notifications/unread');
  }

  async markNotificationRead(id: string) {
    return this.request(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  async markAllNotificationsRead() {
    return this.request('/notifications/read-all', { method: 'PATCH' });
  }

  // ==================== PAYMENTS ====================

  // Criar pagamento PIX
  async createPixPayment(amount: number, credits: number, payerName: string, payerCpf: string) {
    return this.request<{
      success: boolean;
      payment: {
        id: string;
        txid: string;
        qrcode: string;
        copyPaste: string;
        expiresAt: string;
      };
    }>('/payments/pix/create', {
      method: 'POST',
      body: JSON.stringify({ amount, credits, payerName, payerCpf }),
    });
  }

  // Criar pagamento com cartão
  async createCardPayment(params: {
    amount: number;
    credits: number;
    payerName: string;
    payerCpf: string;
    payerEmail: string;
    paymentToken: string;
    installments?: number;
  }) {
    return this.request<{ success: boolean; payment: { id: string }; message?: string }>(
      '/payments/card/create',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  }

  // Verificar status do pagamento
  async checkPaymentStatus(paymentId: string) {
    return this.request<{
      success: boolean;
      payment: {
        id: string;
        status: string;
        paid: boolean;
        method: string;
        amount: number;
        credits: number;
      };
    }>(`/payments/status/${paymentId}`);
  }

  // Histórico de pagamentos
  async getPaymentHistory() {
    return this.request<{ success: boolean; payments: any[] }>('/payments/history');
  }

  // Pacotes de créditos
  async getCreditPackages() {
    return this.request<{ success: boolean; packages: any[] }>('/payments/packages');
  }

  // Validar CPF
  async validateCpf(cpf: string) {
    return this.request<{ valid: boolean }>('/payments/validate-cpf', {
      method: 'POST',
      body: JSON.stringify({ cpf }),
    });
  }
  // Debitar crédito para partida contra IA
  async debitAICredit() {
    return this.request<{ success: boolean; new_balance: number }>('/credits/debit-ai', {
      method: 'POST'
    });
  }


  // Avaliações
  async getReviews() {
    return this.request<{ reviews: any[] }>('/reviews');
  }

  async createReview(data: { game: string; rating: number; comment: string; userId?: string; username?: string }) {
    return this.request('/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Cancelar/fechar sala
  async cancelRoom(roomId: string) {
    return this.request(`/rooms/${roomId}`, {
      method: 'DELETE',
    });
  }

  // Lives / Streaming
  async getLives() {
    return this.request<{ success: boolean; streams: any[] }>('/lives');
  }

  async getLiveConfig() {
    return this.request<{ success: boolean; config: { streamCost: number } }>('/lives/config');
  }

  async startLive(data: { roomId: string; userId: string; hostName: string; gameMode: string; title?: string }) {
    return this.request('/lives/start', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async stopLive(data: { roomId: string }) {
    return this.request('/lives/stop', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async viewLive(roomId: string) {
    return this.request(`/lives/${roomId}/view`, { method: 'POST' });
  }

  // ==================== TORNEIOS ====================

  // Listar torneios públicos
  async getTournaments(status = 'open', limit = 20) {
    return this.request<{ tournaments: any[]; total: number }>(
      `/tournaments?status=${status}&limit=${limit}`
    );
  }

  // Detalhes do torneio
  async getTournament(tournamentId: string) {
    return this.request<any>(`/tournaments/${tournamentId}`);
  }

  // Bracket do torneio
  async getTournamentBracket(tournamentId: string) {
    return this.request<{
      groupA: any[];
      groupB: any[];
      semifinals: any[];
      final: any;
      rounds: Record<number, any[]>;
    }>(`/tournaments/${tournamentId}/bracket`);
  }

  // Informações de premiação
  async getTournamentPrizeInfo(tournamentId: string) {
    return this.request<{
      totalCollected: number;
      prizePool: number;
      platformFee: number;
      participantCount: number;
      entryFee: number;
      distribution: { position: number; percentage: number; amount: number }[];
      rules: { prize_percentage: number; platform_fee_percentage: number; description: string };
    }>(`/tournaments/${tournamentId}/prize-info`);
  }

  // Inscrever no torneio
  async registerTournament(tournamentId: string) {
    return this.request<{
      message: string;
      prizeInfo?: any;
    }>(`/tournaments/${tournamentId}/register`, { method: 'POST' });
  }

  // Cancelar inscrição
  async unregisterTournament(tournamentId: string) {
    return this.request<{ message: string }>(`/tournaments/${tournamentId}/register`, {
      method: 'DELETE',
    });
  }

  // Meus torneios
  async getMyTournaments() {
    return this.request<{ participating: any[]; created: any[] }>('/tournaments/my/list');
  }

  // Meus pagamentos de torneios
  async getMyTournamentPayments() {
    return this.request<{ payments: any[] }>('/tournaments/my/payments');
  }

  // Verificar se pode criar torneio (VIP)
  async canCreateTournament() {
    return this.request<{
      canCreate: boolean;
      requiresVip: boolean;
      message: string;
      rules: {
        prize_percentage: number;
        creator_fee_percentage: number;
        platform_fee_percentage: number;
      };
    }>('/tournaments/can-create');
  }

  // Criar torneio (apenas VIP)
  async createTournament(data: {
    name: string;
    registration_start_date: string;
    registration_end_date: string;
    start_date: string;
    entry_fee?: number;
    max_participants?: number;
    min_participants?: number;
    game_mode?: string;
    description?: string;
  }) {
    return this.request<{
      message: string;
      tournament: any;
      rules: any;
    }>('/tournaments/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==================== ASSINATURAS ====================

  // Verificar assinatura VIP
  async getSubscription() {
    return this.request<{
      subscription: any;
      is_subscriber: boolean;
    }>('/subscriptions/me');
  }

  // Listar planos
  async getSubscriptionPlans() {
    return this.request<{ plans: any[] }>('/subscriptions/plans');
  }

  // Obter info VIP do usuário
  async getVipInfo() {
    return this.request<{
      isVip: boolean;
      plan?: string;
      planName?: string;
      expiresAt?: string;
      daysRemaining?: number;
      features?: string[];
    }>('/subscriptions/vip-info');
  }

  // ==================== PAGAMENTO VIP ====================

  // Obter planos VIP com preços
  async getVipPlans() {
    return this.request<{
      plans: {
        id: string;
        name: string;
        price: number;
        duration_days: number;
        features: string[];
        pricePerMonth: string;
        savings: string;
      }[];
    }>('/payments/vip/plans');
  }

  // Criar pagamento PIX para VIP
  async createVipPixPayment(planId: string, payerName: string, payerCpf: string) {
    return this.request<{
      success: boolean;
      payment: {
        id: string;
        txid: string;
        qrcode: string;
        copyPaste: string;
        expiresAt: string;
        plan: any;
      };
    }>('/payments/vip/pix/create', {
      method: 'POST',
      body: JSON.stringify({ planId, payerName, payerCpf }),
    });
  }

  // Verificar status do pagamento VIP
  async checkVipPaymentStatus(paymentId: string) {
    return this.request<{
      success: boolean;
      payment: {
        id: string;
        status: string;
        paid: boolean;
        activated: boolean;
        plan: string;
        amount: number;
      };
      subscription?: any;
    }>(`/payments/vip/status/${paymentId}`);
  }

  // ==================== TROFÉUS ====================

  // Listar troféus disponíveis
  async getTrophies(category?: string) {
    const url = category ? `/trophies?category=${category}` : '/trophies';
    return this.request<{ trophies: any[] }>(url);
  }

  // Minha sala de troféus
  async getMyTrophyRoom() {
    return this.request<{
      trophies: any[];
      settings: any;
      stats: { total: number; legendary: number; epic: number; rare: number; common: number };
      canView: boolean;
    }>('/trophies/my/room');
  }

  // Sala de troféus de outro usuário
  async getUserTrophyRoom(userId: string) {
    return this.request<{
      trophies: any[];
      settings: any;
      stats: any;
      canView: boolean;
    }>(`/trophies/room/${userId}`);
  }

  // Meus troféus em destaque
  async getMyFeaturedTrophies() {
    return this.request<{ trophies: any[] }>('/trophies/my/featured');
  }

  // Atualizar configurações da sala de troféus
  async updateTrophyRoomSettings(settings: { is_public?: boolean; display_style?: string; background_theme?: string }) {
    return this.request<{ settings: any; message: string }>('/trophies/my/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Destacar/remover destaque de troféu
  async toggleFeaturedTrophy(trophyId: string) {
    return this.request<{ isFeatured: boolean; message: string }>(`/trophies/my/${trophyId}/toggle-featured`, {
      method: 'POST',
    });
  }

  // ==================== PARTIDAS DE TORNEIO ====================

  // Classificação do torneio
  async getTournamentStandings(tournamentId: string) {
    return this.request<{ standings: any[] }>(`/tournament-matches/${tournamentId}/standings`);
  }

  // Partidas ao vivo do torneio
  async getTournamentLiveMatches(tournamentId: string) {
    return this.request<{ matches: any[] }>(`/tournament-matches/${tournamentId}/live`);
  }

  // Próximas partidas do torneio
  async getTournamentUpcomingMatches(tournamentId: string) {
    return this.request<{ matches: any[] }>(`/tournament-matches/${tournamentId}/upcoming`);
  }

  // Histórico de partidas do torneio
  async getTournamentMatchHistory(tournamentId: string) {
    return this.request<{ matches: any[] }>(`/tournament-matches/${tournamentId}/history`);
  }

  // Criar partida de torneio
  async createTournamentMatch(tournamentId: string, bracketMatchId: string) {
    return this.request<{ message: string; roomId: string; matchId: string }>(
      `/tournament-matches/${tournamentId}/${bracketMatchId}/create`,
      { method: 'POST' }
    );
  }

  // Iniciar partida de torneio
  async startTournamentMatch(matchId: string) {
    return this.request<{ message: string }>(`/tournament-matches/match/${matchId}/start`, {
      method: 'POST',
    });
  }

  // Finalizar partida de torneio (sincroniza tudo automaticamente)
  async finishTournamentMatch(matchId: string, winnerId: string, player1Score?: number, player2Score?: number) {
    return this.request<{
      message: string;
      result: {
        matchId: string;
        tournamentId: string;
        winnerId: string;
        loserId: string;
        player1Score: number;
        player2Score: number;
        isFinal: boolean;
        tournamentFinished: boolean;
      };
    }>(`/tournament-matches/match/${matchId}/finish`, {
      method: 'POST',
      body: JSON.stringify({ winnerId, player1Score, player2Score }),
    });
  }
}


export const api = new ApiClient();
export const debitAICredit = () => api.debitAICredit();
