// =====================================================
// SERVIÇO DE GESTÃO DE TORNEIOS
// 
// TORNEIOS CRIADOS POR ADMIN:
// - 70% premiação para vencedores
// - 30% taxa da plataforma
//
// TORNEIOS CRIADOS POR JOGADORES:
// - 60% premiação para vencedores
// - 20% para o jogador criador
// - 20% taxa da plataforma
// =====================================================

import { supabaseAdmin } from '../../services/supabase.js';
import { auditService } from './audit.service.js';

// Configurações de premiação por tipo de criador
const TOURNAMENT_CONFIG = {
  // Torneios criados por ADMIN
  ADMIN: {
    PRIZE_PERCENTAGE: 70,      // 70% premiação
    PLATFORM_FEE_PERCENTAGE: 30, // 30% plataforma
    CREATOR_FEE_PERCENTAGE: 0,   // 0% criador (é admin)
  },
  // Torneios criados por JOGADORES
  PLAYER: {
    PRIZE_PERCENTAGE: 60,        // 60% premiação
    PLATFORM_FEE_PERCENTAGE: 20, // 20% plataforma
    CREATOR_FEE_PERCENTAGE: 20,  // 20% criador
  },
  // Distribuição padrão dos prêmios
  DEFAULT_PRIZE_DISTRIBUTION: {
    '1': 60, // 1º lugar: 60% do prêmio
    '2': 25, // 2º lugar: 25% do prêmio
    '3': 10, // 3º lugar: 10% do prêmio
    '4': 5,  // 4º lugar: 5% do prêmio
  },
};

export interface CreateTournamentDTO {
  name: string;
  description?: string;
  registration_start_date?: string;  // Data início inscrições
  registration_end_date?: string;    // Data término inscrições
  start_date: string;                // Data início torneio
  registration_deadline?: string;    // Legado - usar registration_end_date
  entry_fee?: number;
  prize_pool?: number;
  prize_distribution?: Record<string, number>;
  max_participants?: number;
  min_participants?: number;
  game_mode?: string;
  format?: string;
  is_vip_only?: boolean;
  created_by_player?: boolean; // Se foi criado por jogador
  is_featured?: boolean;       // Se deve aparecer em destaque
  featured_order?: number;     // Ordem no carrossel
  banner_image_url?: string;   // Imagem do banner
  banner_color?: string;       // Cor do banner (gradiente)
}

export interface TournamentPrizeInfo {
  totalCollected: number;      // Total arrecadado com inscrições
  prizePool: number;           // Valor da premiação
  platformFee: number;         // Taxa da plataforma
  creatorFee: number;          // Taxa do criador (se for jogador)
  participantCount: number;    // Número de participantes
  entryFee: number;            // Taxa de inscrição
  isPlayerCreated: boolean;    // Se foi criado por jogador
  distribution: {              // Distribuição dos prêmios
    position: number;
    percentage: number;
    amount: number;
  }[];
}

// Status de pagamento de torneio
export type TournamentPaymentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface TournamentPayment {
  id: string;
  tournament_id: string;
  user_id: string;
  payment_type: 'prize' | 'creator_fee' | 'platform_fee';
  amount: number;
  status: TournamentPaymentStatus;
  position?: number;
  proof_url?: string;
  processed_by?: string;
  processed_at?: string;
  notes?: string;
}

class TournamentsService {
  /**
   * Calcular premiação do torneio baseado nas inscrições
   */
  calculatePrizePool(
    entryFee: number, 
    participantCount: number, 
    isPlayerCreated: boolean = false,
    prizeDistribution?: Record<string, number>
  ): TournamentPrizeInfo {
    const totalCollected = entryFee * participantCount;
    
    // Usar configuração baseada no tipo de criador
    const config = isPlayerCreated ? TOURNAMENT_CONFIG.PLAYER : TOURNAMENT_CONFIG.ADMIN;
    
    const prizePool = (totalCollected * config.PRIZE_PERCENTAGE) / 100;
    const platformFee = (totalCollected * config.PLATFORM_FEE_PERCENTAGE) / 100;
    const creatorFee = (totalCollected * config.CREATOR_FEE_PERCENTAGE) / 100;
    
    const distribution = prizeDistribution || TOURNAMENT_CONFIG.DEFAULT_PRIZE_DISTRIBUTION;
    
    const prizeBreakdown = Object.entries(distribution).map(([position, percentage]) => ({
      position: parseInt(position),
      percentage,
      amount: (prizePool * percentage) / 100,
    })).sort((a, b) => a.position - b.position);

    return {
      totalCollected,
      prizePool,
      platformFee,
      creatorFee,
      participantCount,
      entryFee,
      isPlayerCreated,
      distribution: prizeBreakdown,
    };
  }

  /**
   * Atualizar prize_pool do torneio baseado nos participantes atuais
   */
  async updateTournamentPrizePool(tournamentId: string): Promise<TournamentPrizeInfo | null> {
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('entry_fee, prize_distribution, created_by_player, participants:tournament_participants(count)')
      .eq('id', tournamentId)
      .single();

    if (!tournament) return null;

    const participantCount = (tournament.participants as any)?.[0]?.count || 0;
    const prizeInfo = this.calculatePrizePool(
      tournament.entry_fee || 0,
      participantCount,
      tournament.created_by_player || false,
      tournament.prize_distribution
    );

    // Atualizar prize_pool no banco
    await supabaseAdmin
      .from('tournaments')
      .update({
        prize_pool: prizeInfo.prizePool,
        total_collected: prizeInfo.totalCollected,
        platform_fee: prizeInfo.platformFee,
        creator_fee: prizeInfo.creatorFee,
        current_participants: participantCount,
      })
      .eq('id', tournamentId);

    return prizeInfo;
  }

  /**
   * Listar torneios
   */
  async listTournaments(params: {
    status?: string;
    limit?: number;
    offset?: number;
    createdByPlayer?: boolean;
  }) {
    let query = supabaseAdmin
      .from('tournaments')
      .select(`
        *,
        created_by_user:users!created_by(id, username, avatar_url),
        participants:tournament_participants(count)
      `, { count: 'exact' })
      .order('start_date', { ascending: false });

    if (params.status) {
      query = query.eq('status', params.status);
    }

    if (params.createdByPlayer !== undefined) {
      query = query.eq('created_by_player', params.createdByPlayer);
    }

    const limit = params.limit || 20;
    const offset = params.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    // Calcular premiação atualizada para cada torneio
    const tournamentsWithPrize = (data || []).map(t => {
      const participantCount = (t.participants as any)?.[0]?.count || 0;
      const prizeInfo = this.calculatePrizePool(
        t.entry_fee || 0, 
        participantCount, 
        t.created_by_player || false,
        t.prize_distribution
      );
      return {
        ...t,
        calculated_prize_pool: prizeInfo.prizePool,
        total_collected: prizeInfo.totalCollected,
        platform_fee: prizeInfo.platformFee,
        creator_fee: prizeInfo.creatorFee,
        current_participants: participantCount,
      };
    });

    return { tournaments: tournamentsWithPrize, total: count || 0 };
  }

  /**
   * Detalhes do torneio
   */
  async getTournamentDetail(tournamentId: string) {
    const { data: tournament, error } = await supabaseAdmin
      .from('tournaments')
      .select(`
        *,
        created_by_user:users!created_by(id, username, avatar_url),
        participants:tournament_participants(
          *,
          user:users(id, username, avatar_url)
        ),
        matches:tournament_matches(
          *,
          player1:users!player1_id(id, username),
          player2:users!player2_id(id, username),
          winner:users!winner_id(id, username)
        )
      `)
      .eq('id', tournamentId)
      .single();

    if (error) return null;

    // Calcular premiação atualizada
    const participantCount = tournament.participants?.length || 0;
    const isPlayerCreated = tournament.created_by_player || false;
    const config = isPlayerCreated ? TOURNAMENT_CONFIG.PLAYER : TOURNAMENT_CONFIG.ADMIN;
    
    const prizeInfo = this.calculatePrizePool(
      tournament.entry_fee || 0,
      participantCount,
      isPlayerCreated,
      tournament.prize_distribution
    );

    return {
      ...tournament,
      prize_info: prizeInfo,
      prize_rules: {
        prize_percentage: config.PRIZE_PERCENTAGE,
        platform_fee_percentage: config.PLATFORM_FEE_PERCENTAGE,
        creator_fee_percentage: config.CREATOR_FEE_PERCENTAGE,
        is_player_created: isPlayerCreated,
        description: isPlayerCreated
          ? `Torneio criado por jogador: ${config.PRIZE_PERCENTAGE}% premiação, ${config.CREATOR_FEE_PERCENTAGE}% para o criador, ${config.PLATFORM_FEE_PERCENTAGE}% taxa da plataforma.`
          : `Torneio oficial: ${config.PRIZE_PERCENTAGE}% premiação, ${config.PLATFORM_FEE_PERCENTAGE}% taxa da plataforma.`,
      },
    };
  }

  /**
   * Criar torneio (por admin)
   */
  async createTournament(adminId: string, data: CreateTournamentDTO, ipAddress?: string) {
    const config = TOURNAMENT_CONFIG.ADMIN;
    
    // Formatar datas para exibição
    const regStartDate = data.registration_start_date ? new Date(data.registration_start_date) : null;
    const regEndDate = data.registration_end_date ? new Date(data.registration_end_date) : null;
    const startDate = new Date(data.start_date);
    
    const formatDate = (d: Date) => d.toLocaleDateString('pt-BR', { 
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    
    const defaultDescription = `
🏆 TORNEIO OFICIAL

📅 CRONOGRAMA:
${regStartDate ? `• Inscrições: ${formatDate(regStartDate)} até ${regEndDate ? formatDate(regEndDate) : 'N/A'}` : ''}
• Início do Torneio: ${formatDate(startDate)}

📊 REGRAS DE PREMIAÇÃO:
• ${config.PRIZE_PERCENTAGE}% do valor arrecadado vai para os vencedores
• ${config.PLATFORM_FEE_PERCENTAGE}% é destinado à manutenção da plataforma
• A premiação é calculada automaticamente ao encerrar as inscrições!

🥇 DISTRIBUIÇÃO DOS PRÊMIOS:
• 1º Lugar: 60% da premiação
• 2º Lugar: 25% da premiação  
• 3º Lugar: 10% da premiação
• 4º Lugar: 5% da premiação

${data.description || ''}
    `.trim();

    // Determinar status inicial baseado na data de início das inscrições
    let initialStatus = 'draft';
    if (regStartDate) {
      const now = new Date();
      if (regStartDate <= now) {
        initialStatus = 'open'; // Inscrições já podem começar
      } else {
        initialStatus = 'scheduled'; // Aguardando data de abertura
      }
    }

    const { data: tournament, error } = await supabaseAdmin
      .from('tournaments')
      .insert({
        name: data.name,
        description: defaultDescription,
        registration_start_date: data.registration_start_date || null,
        registration_end_date: data.registration_end_date || null,
        start_date: data.start_date,
        registration_deadline: data.registration_end_date || data.start_date, // Compatibilidade
        entry_fee: data.entry_fee || 0,
        prize_pool: 0, // Será calculado ao encerrar inscrições
        total_collected: 0,
        platform_fee: 0,
        creator_fee: 0,
        prize_distribution: data.prize_distribution || TOURNAMENT_CONFIG.DEFAULT_PRIZE_DISTRIBUTION,
        max_participants: data.max_participants || 16,
        min_participants: data.min_participants || 4,
        game_mode: data.game_mode || '15ball',
        format: data.format || 'single_elimination',
        is_vip_only: data.is_vip_only || false,
        is_featured: data.is_featured ?? true, // Destacado por padrão
        featured_order: data.featured_order || 0,
        banner_image_url: data.banner_image_url || null,
        banner_color: data.banner_color || null,
        status: initialStatus,
        created_by: adminId,
        created_by_player: false, // Criado por admin
        prize_percentage: config.PRIZE_PERCENTAGE,
        platform_fee_percentage: config.PLATFORM_FEE_PERCENTAGE,
        creator_fee_percentage: 0,
      })
      .select()
      .single();

    if (error) throw error;

    await auditService.log({
      adminId,
      action: 'tournament_create',
      targetType: 'tournament',
      targetId: tournament.id,
      details: { 
        name: data.name, 
        entry_fee: data.entry_fee,
        type: 'admin_tournament',
        registration_start: data.registration_start_date,
        registration_end: data.registration_end_date,
        start_date: data.start_date,
        is_featured: data.is_featured,
      },
      ipAddress,
    });

    return tournament;
  }

  /**
   * Criar torneio (por jogador)
   */
  async createPlayerTournament(playerId: string, data: CreateTournamentDTO) {
    const config = TOURNAMENT_CONFIG.PLAYER;
    
    // Buscar dados do jogador
    const { data: player } = await supabaseAdmin
      .from('users')
      .select('username')
      .eq('id', playerId)
      .single();

    // Formatar datas para exibição
    const regStartDate = data.registration_start_date ? new Date(data.registration_start_date) : null;
    const regEndDate = data.registration_end_date ? new Date(data.registration_end_date) : null;
    const startDate = new Date(data.start_date);
    
    const formatDate = (d: Date) => d.toLocaleDateString('pt-BR', { 
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    const defaultDescription = `
🎮 TORNEIO CRIADO POR ${player?.username?.toUpperCase() || 'JOGADOR'}

📅 CRONOGRAMA:
${regStartDate ? `• Inscrições: ${formatDate(regStartDate)} até ${regEndDate ? formatDate(regEndDate) : 'N/A'}` : ''}
• Início do Torneio: ${formatDate(startDate)}

📊 REGRAS DE PREMIAÇÃO:
• ${config.PRIZE_PERCENTAGE}% do valor arrecadado vai para os vencedores
• ${config.CREATOR_FEE_PERCENTAGE}% vai para o organizador do torneio
• ${config.PLATFORM_FEE_PERCENTAGE}% é destinado à manutenção da plataforma
• A premiação é calculada automaticamente ao encerrar as inscrições!

🥇 DISTRIBUIÇÃO DOS PRÊMIOS:
• 1º Lugar: 60% da premiação
• 2º Lugar: 25% da premiação  
• 3º Lugar: 10% da premiação
• 4º Lugar: 5% da premiação

${data.description || ''}
    `.trim();

    // Determinar status inicial baseado na data de início das inscrições
    let initialStatus = 'draft';
    if (regStartDate) {
      const now = new Date();
      if (regStartDate <= now) {
        initialStatus = 'open'; // Inscrições já podem começar
      } else {
        initialStatus = 'scheduled'; // Aguardando data de abertura
      }
    }

    const { data: tournament, error } = await supabaseAdmin
      .from('tournaments')
      .insert({
        name: data.name,
        description: defaultDescription,
        registration_start_date: data.registration_start_date || null,
        registration_end_date: data.registration_end_date || null,
        start_date: data.start_date,
        registration_deadline: data.registration_end_date || data.start_date, // Compatibilidade
        entry_fee: data.entry_fee || 0,
        prize_pool: 0, // Será calculado ao encerrar inscrições
        total_collected: 0,
        platform_fee: 0,
        creator_fee: 0,
        prize_distribution: data.prize_distribution || TOURNAMENT_CONFIG.DEFAULT_PRIZE_DISTRIBUTION,
        max_participants: data.max_participants || 16,
        min_participants: data.min_participants || 4,
        game_mode: data.game_mode || '15ball',
        format: data.format || 'single_elimination',
        is_vip_only: data.is_vip_only || false,
        status: initialStatus,
        created_by: playerId,
        created_by_player: true, // Criado por jogador
        prize_percentage: config.PRIZE_PERCENTAGE,
        platform_fee_percentage: config.PLATFORM_FEE_PERCENTAGE,
        creator_fee_percentage: config.CREATOR_FEE_PERCENTAGE,
      })
      .select()
      .single();

    if (error) throw error;

    return tournament;
  }


  /**
   * Atualizar torneio
   */
  async updateTournament(adminId: string, tournamentId: string, data: Partial<CreateTournamentDTO>, ipAddress?: string) {
    const { data: oldTournament } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (!oldTournament) {
      return { success: false, error: 'Torneio não encontrado' };
    }
    if (oldTournament.status === 'finished' || oldTournament.status === 'cancelled') {
      return { success: false, error: 'Torneio já finalizado ou cancelado' };
    }

    const { error } = await supabaseAdmin
      .from('tournaments')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tournamentId);

    if (error) throw error;

    await auditService.log({
      adminId,
      action: 'tournament_update',
      targetType: 'tournament',
      targetId: tournamentId,
      details: { action: 'update', changes: data },
      oldValue: oldTournament,
      ipAddress,
    });

    return { success: true };
  }

  /**
   * Abrir inscrições
   */
  async openRegistration(adminId: string, tournamentId: string, ipAddress?: string) {
    const { error } = await supabaseAdmin
      .from('tournaments')
      .update({ status: 'open' })
      .eq('id', tournamentId)
      .eq('status', 'draft');

    if (error) throw error;
    return { success: true };
  }

  /**
   * Iniciar torneio
   */
  async startTournament(adminId: string, tournamentId: string, ipAddress?: string) {
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('*, participants:tournament_participants(*)')
      .eq('id', tournamentId)
      .single();

    if (!tournament) {
      return { success: false, error: 'Torneio não encontrado' };
    }
    if (tournament.status !== 'open') {
      return { success: false, error: 'Torneio não está aberto para inscrições' };
    }

    const participantCount = tournament.participants?.length || 0;
    if (participantCount < tournament.min_participants) {
      return { success: false, error: `Mínimo de ${tournament.min_participants} participantes necessário` };
    }

    // Gerar bracket
    await this.generateBracket(tournamentId, tournament.participants);

    await supabaseAdmin
      .from('tournaments')
      .update({ status: 'in_progress' })
      .eq('id', tournamentId);

    return { success: true };
  }

  /**
   * Gerar bracket do torneio (versão melhorada)
   * Suporta 8, 16, 32 e 64 participantes
   */
  private async generateBracket(tournamentId: string, participants: any[]) {
    const playerIds = participants.map(p => p.user_id);
    
    // Usar função do banco de dados para gerar bracket
    const { error } = await supabaseAdmin.rpc('generate_tournament_bracket', {
      p_tournament_id: tournamentId,
      p_participant_ids: playerIds,
    });

    if (error) {
      console.error('Erro ao gerar bracket via RPC, usando fallback:', error);
      // Fallback para geração manual
      await this.generateBracketManual(tournamentId, participants);
    }
  }

  /**
   * Fallback: Gerar bracket manualmente (caso RPC falhe)
   */
  private async generateBracketManual(tournamentId: string, participants: any[]) {
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const numParticipants = shuffled.length;
    const numRounds = Math.ceil(Math.log2(numParticipants));
    
    // Determinar estrutura do bracket
    const bracketSize = Math.pow(2, numRounds); // 8, 16, 32, 64
    const byes = bracketSize - numParticipants;
    
    const allMatches: any[] = [];
    let matchIdCounter = 1;
    
    // Criar todas as partidas de todas as rodadas
    const matchesByRound: any[][] = [];
    
    for (let round = numRounds; round >= 1; round--) {
      const matchesInRound = Math.pow(2, numRounds - round);
      const roundMatches: any[] = [];
      
      for (let i = 0; i < matchesInRound; i++) {
        const groupSide = i < matchesInRound / 2 ? 'A' : 'B';
        let bracketPosition = '';
        
        if (round === numRounds) bracketPosition = 'FINAL';
        else if (round === numRounds - 1) bracketPosition = `SF${i + 1}`;
        else if (round === numRounds - 2) bracketPosition = `QF${i + 1}`;
        else bracketPosition = `R${round}M${i + 1}`;
        
        roundMatches.push({
          tournament_id: tournamentId,
          round,
          match_number: i + 1,
          bracket_position: bracketPosition,
          group_side: round === numRounds ? null : groupSide,
          status: 'pending',
          player1_id: null,
          player2_id: null,
          winner_id: null,
          is_bye: false,
        });
      }
      
      matchesByRound[round] = roundMatches;
    }
    
    // Preencher primeira rodada com jogadores
    const firstRound = matchesByRound[1];
    for (let i = 0; i < firstRound.length; i++) {
      const player1Index = i * 2;
      const player2Index = i * 2 + 1;
      
      firstRound[i].player1_id = shuffled[player1Index]?.user_id || null;
      firstRound[i].player2_id = shuffled[player2Index]?.user_id || null;
      
      // Se não tem player2, é BYE
      if (!firstRound[i].player2_id && firstRound[i].player1_id) {
        firstRound[i].is_bye = true;
        firstRound[i].status = 'bye';
        firstRound[i].winner_id = firstRound[i].player1_id;
      }
    }
    
    // Inserir todas as partidas
    for (let round = 1; round <= numRounds; round++) {
      for (const match of matchesByRound[round]) {
        const { data: inserted } = await supabaseAdmin
          .from('tournament_matches')
          .insert(match)
          .select()
          .single();
        
        if (inserted) {
          match.id = inserted.id;
        }
      }
    }
    
    // Atualizar next_match_id para cada partida
    for (let round = 1; round < numRounds; round++) {
      const currentRoundMatches = matchesByRound[round];
      const nextRoundMatches = matchesByRound[round + 1];
      
      for (let i = 0; i < currentRoundMatches.length; i++) {
        const nextMatchIndex = Math.floor(i / 2);
        const nextMatch = nextRoundMatches[nextMatchIndex];
        
        if (nextMatch?.id) {
          await supabaseAdmin
            .from('tournament_matches')
            .update({ next_match_id: nextMatch.id })
            .eq('id', currentRoundMatches[i].id);
        }
      }
    }
    
    // Processar BYEs - avançar jogadores
    for (const match of matchesByRound[1]) {
      if (match.is_bye && match.winner_id) {
        await this.advanceWinnerToNextMatch(match.id, match.winner_id);
      }
    }
  }

  /**
   * Avançar vencedor para próxima partida
   */
  private async advanceWinnerToNextMatch(matchId: string, winnerId: string) {
    const { data: match } = await supabaseAdmin
      .from('tournament_matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (!match?.next_match_id) return;

    // Determinar slot (ímpar = player1, par = player2)
    const slot = match.match_number % 2 === 1 ? 'player1_id' : 'player2_id';
    
    await supabaseAdmin
      .from('tournament_matches')
      .update({ [slot]: winnerId })
      .eq('id', match.next_match_id);
  }

  /**
   * Registrar resultado de partida do torneio
   */
  async setMatchWinner(
    tournamentId: string,
    matchId: string,
    winnerId: string,
    player1Score: number = 0,
    player2Score: number = 0
  ): Promise<{ success: boolean; error?: string; isTournamentFinished?: boolean; tournamentWinnerId?: string }> {
    // Tentar usar RPC
    const { data, error } = await supabaseAdmin.rpc('set_match_winner', {
      p_match_id: matchId,
      p_winner_id: winnerId,
      p_player1_score: player1Score,
      p_player2_score: player2Score,
    });

    if (error) {
      console.error('Erro ao registrar vencedor via RPC:', error);
      // Fallback manual
      return this.setMatchWinnerManual(tournamentId, matchId, winnerId, player1Score, player2Score);
    }

    const result = data?.[0];
    return {
      success: result?.success || false,
      error: result?.message,
      isTournamentFinished: result?.is_tournament_finished || false,
      tournamentWinnerId: result?.tournament_winner_id,
    };
  }

  /**
   * Fallback: Registrar vencedor manualmente
   */
  private async setMatchWinnerManual(
    tournamentId: string,
    matchId: string,
    winnerId: string,
    player1Score: number,
    player2Score: number
  ): Promise<{ success: boolean; error?: string; isTournamentFinished?: boolean; tournamentWinnerId?: string }> {
    const { data: match } = await supabaseAdmin
      .from('tournament_matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (!match) {
      return { success: false, error: 'Partida não encontrada' };
    }

    if (match.status === 'finished') {
      return { success: false, error: 'Partida já finalizada' };
    }

    const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;

    // Atualizar partida
    await supabaseAdmin
      .from('tournament_matches')
      .update({
        winner_id: winnerId,
        player1_score: player1Score,
        player2_score: player2Score,
        status: 'finished',
        finished_at: new Date().toISOString(),
      })
      .eq('id', matchId);

    // Eliminar perdedor
    if (loserId) {
      await supabaseAdmin
        .from('tournament_participants')
        .update({
          status: 'eliminated',
          eliminated_at: new Date().toISOString(),
          eliminated_by: winnerId,
        })
        .eq('tournament_id', tournamentId)
        .eq('user_id', loserId);
    }

    // Avançar vencedor
    if (match.next_match_id) {
      await this.advanceWinnerToNextMatch(matchId, winnerId);
      return { success: true, isTournamentFinished: false };
    }

    // Era a final - torneio acabou!
    await supabaseAdmin
      .from('tournaments')
      .update({
        status: 'finished',
        finished_at: new Date().toISOString(),
      })
      .eq('id', tournamentId);

    // Marcar colocações
    await supabaseAdmin
      .from('tournament_participants')
      .update({ placement: 1, status: 'winner' })
      .eq('tournament_id', tournamentId)
      .eq('user_id', winnerId);

    if (loserId) {
      await supabaseAdmin
        .from('tournament_participants')
        .update({ placement: 2 })
        .eq('tournament_id', tournamentId)
        .eq('user_id', loserId);
    }

    return { success: true, isTournamentFinished: true, tournamentWinnerId: winnerId };
  }

  /**
   * Obter bracket completo do torneio
   */
  async getTournamentBracket(tournamentId: string) {
    const { data: matches, error } = await supabaseAdmin
      .from('tournament_matches')
      .select(`
        *,
        player1:users!player1_id(id, username, avatar_url),
        player2:users!player2_id(id, username, avatar_url),
        winner:users!winner_id(id, username, avatar_url)
      `)
      .eq('tournament_id', tournamentId)
      .order('round', { ascending: true })
      .order('match_number', { ascending: true });

    if (error) throw error;

    // Organizar por rodadas e grupos
    const bracket = {
      groupA: [] as any[],
      groupB: [] as any[],
      semifinals: [] as any[],
      final: null as any,
      rounds: {} as Record<number, any[]>,
    };

    for (const match of matches || []) {
      // Adicionar ao objeto de rounds
      if (!bracket.rounds[match.round]) {
        bracket.rounds[match.round] = [];
      }
      bracket.rounds[match.round].push(match);

      // Organizar por posição no bracket
      if (match.bracket_position === 'FINAL') {
        bracket.final = match;
      } else if (match.bracket_position?.startsWith('SF')) {
        bracket.semifinals.push(match);
      } else if (match.group_side === 'A') {
        bracket.groupA.push(match);
      } else if (match.group_side === 'B') {
        bracket.groupB.push(match);
      }
    }

    return bracket;
  }

  /**
   * Cancelar torneio (com reembolso)
   */
  async cancelTournament(adminId: string, tournamentId: string, reason: string, ipAddress?: string) {
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('*, participants:tournament_participants(*)')
      .eq('id', tournamentId)
      .single();

    if (!tournament) {
      return { success: false, error: 'Torneio não encontrado' };
    }
    if (tournament.status === 'finished' || tournament.status === 'cancelled') {
      return { success: false, error: 'Torneio já finalizado ou cancelado' };
    }

    // Reembolsar participantes
    if (tournament.entry_fee > 0 && tournament.participants?.length > 0) {
      for (const participant of tournament.participants) {
        await supabaseAdmin.rpc('add_winnings_balance', {
          p_user_id: participant.user_id,
          p_amount: tournament.entry_fee,
          p_description: `Reembolso - Torneio "${tournament.name}" cancelado`,
        });
      }
    }

    await supabaseAdmin
      .from('tournaments')
      .update({
        status: 'cancelled',
        cancelled_by: adminId,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq('id', tournamentId);

    await auditService.log({
      adminId,
      action: 'tournament_cancel',
      targetType: 'tournament',
      targetId: tournamentId,
      details: { reason, refunded_count: tournament.participants?.length || 0 },
      ipAddress,
    });

    return { success: true, refunded: tournament.participants?.length || 0 };
  }

  /**
   * Inscrever jogador no torneio
   */
  async registerPlayer(userId: string, tournamentId: string): Promise<{ success: boolean; error?: string; prizeInfo?: TournamentPrizeInfo }> {
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('*, participants:tournament_participants(count)')
      .eq('id', tournamentId)
      .single();

    if (!tournament) {
      return { success: false, error: 'Torneio não encontrado' };
    }

    if (tournament.status !== 'open') {
      return { success: false, error: 'Inscrições não estão abertas' };
    }

    const currentParticipants = (tournament.participants as any)?.[0]?.count || 0;
    if (currentParticipants >= tournament.max_participants) {
      return { success: false, error: 'Torneio lotado' };
    }

    // Verificar se já está inscrito
    const { data: existing } = await supabaseAdmin
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      return { success: false, error: 'Você já está inscrito neste torneio' };
    }

    // Cobrar taxa de inscrição
    if (tournament.entry_fee > 0) {
      const { data: wallet } = await supabaseAdmin
        .from('wallet')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (!wallet || wallet.balance < tournament.entry_fee) {
        return { success: false, error: `Saldo insuficiente. Taxa: R$ ${tournament.entry_fee.toFixed(2)}` };
      }

      await supabaseAdmin
        .from('wallet')
        .update({ balance: wallet.balance - tournament.entry_fee })
        .eq('user_id', userId);

      await supabaseAdmin.from('transactions').insert({
        user_id: userId,
        type: 'tournament_entry',
        amount: -tournament.entry_fee,
        description: `Inscrição: ${tournament.name}`,
        reference_id: tournamentId,
      });
    }

    // Criar inscrição
    await supabaseAdmin.from('tournament_participants').insert({
      tournament_id: tournamentId,
      user_id: userId,
      entry_fee: tournament.entry_fee,
      status: 'registered',
    });

    const prizeInfo = await this.updateTournamentPrizePool(tournamentId);
    return { success: true, prizeInfo: prizeInfo || undefined };
  }

  /**
   * Cancelar inscrição
   */
  async unregisterPlayer(userId: string, tournamentId: string): Promise<{ success: boolean; error?: string }> {
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (!tournament) {
      return { success: false, error: 'Torneio não encontrado' };
    }

    if (tournament.status !== 'open' && tournament.status !== 'draft') {
      return { success: false, error: 'Não é possível cancelar após início do torneio' };
    }

    const { data: participant } = await supabaseAdmin
      .from('tournament_participants')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId)
      .single();

    if (!participant) {
      return { success: false, error: 'Você não está inscrito' };
    }

    await supabaseAdmin
      .from('tournament_participants')
      .delete()
      .eq('id', participant.id);

    // Reembolsar
    if (tournament.entry_fee > 0) {
      await supabaseAdmin.rpc('add_winnings_balance', {
        p_user_id: userId,
        p_amount: tournament.entry_fee,
        p_description: `Reembolso: ${tournament.name}`,
      });

      await supabaseAdmin.from('transactions').insert({
        user_id: userId,
        type: 'tournament_refund',
        amount: tournament.entry_fee,
        description: `Reembolso: ${tournament.name}`,
        reference_id: tournamentId,
      });
    }

    await this.updateTournamentPrizePool(tournamentId);
    return { success: true };
  }


  /**
   * Finalizar torneio e criar solicitações de pagamento
   * NÃO distribui automaticamente - cria pendências para aprovação manual
   */
  async finishTournamentAndDistributePrizes(
    tournamentId: string, 
    placements: { userId: string; position: number }[]
  ): Promise<{ success: boolean; error?: string; payments?: any[] }> {
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('*, participants:tournament_participants(*), created_by_user:users!created_by(id, username)')
      .eq('id', tournamentId)
      .single();

    if (!tournament) {
      return { success: false, error: 'Torneio não encontrado' };
    }

    if (tournament.status === 'finished') {
      return { success: false, error: 'Torneio já finalizado' };
    }

    // Calcular premiação final
    const participantCount = tournament.participants?.length || 0;
    const isPlayerCreated = tournament.created_by_player || false;
    const prizeInfo = this.calculatePrizePool(
      tournament.entry_fee || 0,
      participantCount,
      isPlayerCreated,
      tournament.prize_distribution
    );

    const payments: any[] = [];

    // 1. Criar pagamentos de prêmios para vencedores
    for (const placement of placements) {
      const prizeForPosition = prizeInfo.distribution.find(d => d.position === placement.position);
      
      if (prizeForPosition && prizeForPosition.amount > 0) {
        const { data: payment } = await supabaseAdmin
          .from('tournament_payments')
          .insert({
            tournament_id: tournamentId,
            user_id: placement.userId,
            payment_type: 'prize',
            amount: prizeForPosition.amount,
            position: placement.position,
            status: 'pending',
            description: `🏆 ${placement.position}º lugar - ${tournament.name}`,
          })
          .select()
          .single();

        if (payment) payments.push(payment);

        // Atualizar colocação do participante
        await supabaseAdmin
          .from('tournament_participants')
          .update({ 
            placement: placement.position,
            prize_amount: prizeForPosition.amount,
          })
          .eq('tournament_id', tournamentId)
          .eq('user_id', placement.userId);
      }
    }

    // 2. Se for torneio de jogador, criar pagamento para o criador (20%)
    if (isPlayerCreated && prizeInfo.creatorFee > 0) {
      const { data: creatorPayment } = await supabaseAdmin
        .from('tournament_payments')
        .insert({
          tournament_id: tournamentId,
          user_id: tournament.created_by,
          payment_type: 'creator_fee',
          amount: prizeInfo.creatorFee,
          status: 'pending',
          description: `💰 Taxa de organizador (20%) - ${tournament.name}`,
        })
        .select()
        .single();

      if (creatorPayment) payments.push(creatorPayment);
    }

    // 3. Registrar taxa da plataforma
    if (prizeInfo.platformFee > 0) {
      await supabaseAdmin.from('revenue_records').insert({
        revenue_type: 'tournament_commission',
        amount: prizeInfo.platformFee,
        description: `Taxa de plataforma (${isPlayerCreated ? '20%' : '30%'}) - ${tournament.name}`,
        reference_id: tournamentId,
      });
    }

    // 4. Atualizar status do torneio
    await supabaseAdmin
      .from('tournaments')
      .update({
        status: 'finished',
        finished_at: new Date().toISOString(),
        final_prize_pool: prizeInfo.prizePool,
        final_platform_fee: prizeInfo.platformFee,
        final_creator_fee: prizeInfo.creatorFee,
        final_total_collected: prizeInfo.totalCollected,
      })
      .eq('id', tournamentId);

    return { success: true, payments };
  }

  /**
   * Listar pagamentos pendentes de torneios (para admin)
   */
  async listPendingPayments(params: { status?: string; limit?: number; offset?: number }) {
    let query = supabaseAdmin
      .from('tournament_payments')
      .select(`
        *,
        tournament:tournaments(id, name, created_by_player),
        user:users(id, username, avatar_url, pix_key, pix_key_type)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (params.status) {
      query = query.eq('status', params.status);
    } else {
      query = query.in('status', ['pending', 'processing']);
    }

    const limit = params.limit || 50;
    const offset = params.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return { payments: data || [], total: count || 0 };
  }

  /**
   * Aprovar e processar pagamento de torneio
   */
  async processPayment(
    adminId: string,
    paymentId: string,
    action: 'approve' | 'complete' | 'reject',
    data?: { proofUrl?: string; notes?: string }
  ): Promise<{ success: boolean; error?: string }> {
    const { data: payment } = await supabaseAdmin
      .from('tournament_payments')
      .select('*, tournament:tournaments(name), user:users(id, username)')
      .eq('id', paymentId)
      .single();

    if (!payment) {
      return { success: false, error: 'Pagamento não encontrado' };
    }

    if (action === 'approve') {
      // Marcar como em processamento
      await supabaseAdmin
        .from('tournament_payments')
        .update({
          status: 'processing',
          processed_by: adminId,
          notes: data?.notes,
        })
        .eq('id', paymentId);

      return { success: true };
    }

    if (action === 'complete') {
      // Marcar como concluído e creditar na carteira do usuário
      await supabaseAdmin
        .from('tournament_payments')
        .update({
          status: 'completed',
          processed_by: adminId,
          processed_at: new Date().toISOString(),
          proof_url: data?.proofUrl,
          notes: data?.notes,
        })
        .eq('id', paymentId);

      // Creditar no winnings_balance do usuário
      await supabaseAdmin.rpc('add_winnings_balance', {
        p_user_id: payment.user_id,
        p_amount: payment.amount,
        p_description: payment.description,
      });

      // Registrar transação
      await supabaseAdmin.from('transactions').insert({
        user_id: payment.user_id,
        type: payment.payment_type === 'prize' ? 'tournament_prize' : 'tournament_creator_fee',
        amount: payment.amount,
        description: payment.description,
        reference_id: payment.tournament_id,
      });

      return { success: true };
    }

    if (action === 'reject') {
      await supabaseAdmin
        .from('tournament_payments')
        .update({
          status: 'failed',
          processed_by: adminId,
          processed_at: new Date().toISOString(),
          notes: data?.notes,
        })
        .eq('id', paymentId);

      return { success: true };
    }

    return { success: false, error: 'Ação inválida' };
  }

  /**
   * Obter informações de premiação de um torneio
   */
  async getTournamentPrizeInfo(tournamentId: string): Promise<TournamentPrizeInfo | null> {
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('entry_fee, prize_distribution, created_by_player, participants:tournament_participants(count)')
      .eq('id', tournamentId)
      .single();

    if (!tournament) return null;

    const participantCount = (tournament.participants as any)?.[0]?.count || 0;
    return this.calculatePrizePool(
      tournament.entry_fee || 0,
      participantCount,
      tournament.created_by_player || false,
      tournament.prize_distribution
    );
  }

  /**
   * Obter torneios do jogador
   */
  async getPlayerTournaments(userId: string) {
    const { data: participations } = await supabaseAdmin
      .from('tournament_participants')
      .select(`
        *,
        tournament:tournaments(
          id, name, status, start_date, entry_fee, prize_pool,
          total_collected, platform_fee, creator_fee, current_participants, 
          max_participants, created_by_player, created_by
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Também buscar torneios criados pelo jogador
    const { data: createdTournaments } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('created_by', userId)
      .eq('created_by_player', true)
      .order('created_at', { ascending: false });

    return {
      participating: (participations || []).map(p => ({
        ...p.tournament,
        my_status: p.status,
        my_placement: p.placement,
        my_prize: p.prize_amount,
        registered_at: p.created_at,
      })),
      created: createdTournaments || [],
    };
  }

  /**
   * Obter pagamentos do jogador
   */
  async getPlayerPayments(userId: string) {
    const { data: payments } = await supabaseAdmin
      .from('tournament_payments')
      .select(`
        *,
        tournament:tournaments(id, name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return { payments: payments || [] };
  }

  /**
   * Avançar jogador manualmente
   */
  async advancePlayer(
    adminId: string,
    tournamentId: string,
    matchId: string,
    winnerId: string,
    reason: string,
    ipAddress?: string
  ) {
    const { data: match } = await supabaseAdmin
      .from('tournament_matches')
      .select('*')
      .eq('id', matchId)
      .eq('tournament_id', tournamentId)
      .single();

    if (!match) {
      return { success: false, error: 'Partida não encontrada' };
    }
    if (match.status === 'finished') {
      return { success: false, error: 'Partida já finalizada' };
    }

    await supabaseAdmin
      .from('tournament_matches')
      .update({
        winner_id: winnerId,
        status: 'finished',
        finished_at: new Date().toISOString(),
      })
      .eq('id', matchId);

    const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;
    if (loserId) {
      await supabaseAdmin
        .from('tournament_participants')
        .update({
          status: 'eliminated',
          eliminated_at: new Date().toISOString(),
          eliminated_by: winnerId,
        })
        .eq('tournament_id', tournamentId)
        .eq('user_id', loserId);
    }

    await this.advanceToNextRound(tournamentId, match.round, match.match_number, winnerId);

    await auditService.log({
      adminId,
      action: 'tournament_advance_player',
      targetType: 'tournament_match',
      targetId: matchId,
      details: { tournament_id: tournamentId, winner_id: winnerId, reason },
      ipAddress,
    });

    return { success: true };
  }

  private async advanceToNextRound(tournamentId: string, currentRound: number, matchNumber: number, winnerId: string) {
    const nextRound = currentRound + 1;

    const { data: nextMatch } = await supabaseAdmin
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round', nextRound)
      .single();

    if (!nextMatch) {
      await supabaseAdmin
        .from('tournament_participants')
        .update({ placement: 1 })
        .eq('tournament_id', tournamentId)
        .eq('user_id', winnerId);

      await supabaseAdmin
        .from('tournaments')
        .update({ status: 'finished' })
        .eq('id', tournamentId);

      return;
    }

    const isFirstSlot = matchNumber % 2 === 1;
    const updateField = isFirstSlot ? 'player1_id' : 'player2_id';

    await supabaseAdmin
      .from('tournament_matches')
      .update({ [updateField]: winnerId })
      .eq('id', nextMatch.id);
  }
}

export const tournamentsService = new TournamentsService();
