// =====================================================
// SERVIÇO DE TROFÉUS VIRTUAIS
// =====================================================

import { supabaseAdmin } from '../../services/supabase.js';

export interface Trophy {
  id: string;
  name: string;
  description: string;
  image_url: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: 'tournament' | 'achievement' | 'special';
  is_active: boolean;
  created_at: string;
}

export interface UserTrophy {
  id: string;
  user_id: string;
  trophy_id: string;
  tournament_id?: string;
  position?: number;
  awarded_at: string;
  is_featured: boolean;
  trophy?: Trophy;
  tournament?: { id: string; name: string };
}

export interface TrophyRoomSettings {
  user_id: string;
  is_public: boolean;
  display_style: 'grid' | 'list' | 'showcase';
  background_theme: string;
}

class TrophiesService {
  /**
   * Listar todos os troféus disponíveis
   */
  async listTrophies(params?: { category?: string; rarity?: string }): Promise<Trophy[]> {
    let query = supabaseAdmin
      .from('trophies')
      .select('*')
      .eq('is_active', true)
      .order('rarity', { ascending: false });

    if (params?.category) {
      query = query.eq('category', params.category);
    }
    if (params?.rarity) {
      query = query.eq('rarity', params.rarity);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Obter troféu por ID
   */
  async getTrophy(trophyId: string): Promise<Trophy | null> {
    const { data, error } = await supabaseAdmin
      .from('trophies')
      .select('*')
      .eq('id', trophyId)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Criar novo troféu (admin)
   */
  async createTrophy(adminId: string, data: Partial<Trophy>): Promise<Trophy> {
    const { data: trophy, error } = await supabaseAdmin
      .from('trophies')
      .insert({
        name: data.name,
        description: data.description,
        image_url: data.image_url,
        rarity: data.rarity || 'common',
        category: data.category || 'tournament',
        is_active: true,
        created_by: adminId,
      })
      .select()
      .single();

    if (error) throw error;
    return trophy;
  }

  /**
   * Atualizar troféu (admin)
   */
  async updateTrophy(trophyId: string, data: Partial<Trophy>): Promise<Trophy> {
    const { data: trophy, error } = await supabaseAdmin
      .from('trophies')
      .update(data)
      .eq('id', trophyId)
      .select()
      .single();

    if (error) throw error;
    return trophy;
  }

  /**
   * Obter sala de troféus do usuário
   */
  async getUserTrophyRoom(userId: string, requesterId?: string): Promise<{
    trophies: UserTrophy[];
    settings: TrophyRoomSettings;
    stats: { total: number; legendary: number; epic: number; rare: number; common: number };
    canView: boolean;
  }> {
    // Buscar configurações
    const { data: settings } = await supabaseAdmin
      .from('trophy_room_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    const roomSettings: TrophyRoomSettings = settings || {
      user_id: userId,
      is_public: true,
      display_style: 'grid',
      background_theme: 'default',
    };

    // Verificar se pode visualizar
    const isOwner = requesterId === userId;
    const canView = isOwner || roomSettings.is_public;

    if (!canView) {
      return {
        trophies: [],
        settings: roomSettings,
        stats: { total: 0, legendary: 0, epic: 0, rare: 0, common: 0 },
        canView: false,
      };
    }

    // Buscar troféus
    const { data: userTrophies, error } = await supabaseAdmin
      .from('user_trophies')
      .select(`
        *,
        trophy:trophies(*),
        tournament:tournaments(id, name)
      `)
      .eq('user_id', userId)
      .order('awarded_at', { ascending: false });

    if (error) throw error;

    // Calcular estatísticas
    const stats = {
      total: userTrophies?.length || 0,
      legendary: 0,
      epic: 0,
      rare: 0,
      common: 0,
    };

    for (const ut of userTrophies || []) {
      const rarity = (ut.trophy as any)?.rarity || 'common';
      if (rarity in stats) {
        (stats as any)[rarity]++;
      }
    }

    return {
      trophies: userTrophies || [],
      settings: roomSettings,
      stats,
      canView: true,
    };
  }

  /**
   * Atualizar configurações da sala de troféus
   */
  async updateTrophyRoomSettings(
    userId: string,
    settings: Partial<TrophyRoomSettings>
  ): Promise<TrophyRoomSettings> {
    const { data, error } = await supabaseAdmin
      .from('trophy_room_settings')
      .upsert({
        user_id: userId,
        ...settings,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Destacar/remover destaque de troféu
   */
  async toggleFeaturedTrophy(userId: string, userTrophyId: string): Promise<boolean> {
    // Verificar se pertence ao usuário
    const { data: trophy } = await supabaseAdmin
      .from('user_trophies')
      .select('is_featured')
      .eq('id', userTrophyId)
      .eq('user_id', userId)
      .single();

    if (!trophy) {
      throw new Error('Troféu não encontrado');
    }

    const newFeatured = !trophy.is_featured;

    // Se vai destacar, limitar a 3 troféus em destaque
    if (newFeatured) {
      const { data: featured } = await supabaseAdmin
        .from('user_trophies')
        .select('id')
        .eq('user_id', userId)
        .eq('is_featured', true);

      if ((featured?.length || 0) >= 3) {
        throw new Error('Máximo de 3 troféus em destaque');
      }
    }

    await supabaseAdmin
      .from('user_trophies')
      .update({ is_featured: newFeatured })
      .eq('id', userTrophyId);

    return newFeatured;
  }

  /**
   * Conceder troféu a usuário
   */
  async awardTrophy(
    userId: string,
    trophyId: string,
    tournamentId?: string,
    position?: number
  ): Promise<UserTrophy> {
    const { data, error } = await supabaseAdmin
      .from('user_trophies')
      .insert({
        user_id: userId,
        trophy_id: trophyId,
        tournament_id: tournamentId,
        position,
      })
      .select(`
        *,
        trophy:trophies(*)
      `)
      .single();

    if (error) throw error;

    // Notificar usuário
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type: 'achievement',
      title: '🏆 Novo Troféu!',
      message: `Você ganhou o troféu "${(data.trophy as any)?.name}"!`,
    });

    return data;
  }

  /**
   * Conceder troféus de torneio (1º, 2º, 3º lugar)
   */
  async awardTournamentTrophies(
    tournamentId: string,
    placements: { userId: string; position: number }[]
  ): Promise<void> {
    // Buscar troféus do torneio
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('trophy_id, trophy_2nd_id, trophy_3rd_id, name')
      .eq('id', tournamentId)
      .single();

    if (!tournament) return;

    for (const placement of placements) {
      let trophyId: string | null = null;

      switch (placement.position) {
        case 1:
          trophyId = tournament.trophy_id;
          break;
        case 2:
          trophyId = tournament.trophy_2nd_id;
          break;
        case 3:
          trophyId = tournament.trophy_3rd_id;
          break;
      }

      // Se não tem troféu específico, usar padrão
      if (!trophyId) {
        const rarity = placement.position === 1 ? 'legendary' : 
                       placement.position === 2 ? 'epic' : 'rare';
        
        const { data: defaultTrophy } = await supabaseAdmin
          .from('trophies')
          .select('id')
          .eq('category', 'tournament')
          .eq('rarity', rarity)
          .limit(1)
          .single();

        trophyId = defaultTrophy?.id;
      }

      if (trophyId) {
        try {
          await this.awardTrophy(placement.userId, trophyId, tournamentId, placement.position);
        } catch (err) {
          console.error(`Erro ao conceder troféu para posição ${placement.position}:`, err);
        }
      }
    }
  }

  /**
   * Obter troféus em destaque do usuário (para exibir no perfil)
   */
  async getFeaturedTrophies(userId: string): Promise<UserTrophy[]> {
    const { data, error } = await supabaseAdmin
      .from('user_trophies')
      .select(`
        *,
        trophy:trophies(*)
      `)
      .eq('user_id', userId)
      .eq('is_featured', true)
      .order('awarded_at', { ascending: false })
      .limit(3);

    if (error) throw error;
    return data || [];
  }
}

export const trophiesService = new TrophiesService();
