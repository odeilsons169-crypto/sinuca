// =====================================================
// SERVIÇO DE GERENCIAMENTO DE BANNERS
// =====================================================

import { supabaseAdmin } from '../../services/supabase.js';

export interface CreateBannerDTO {
  title: string;
  subtitle?: string;
  image_url?: string;
  link_url?: string;
  link_text?: string;
  position?: string;
  display_order?: number;
  background_color?: string;
  text_color?: string;
  is_active?: boolean;
  starts_at?: string;
  ends_at?: string;
  tournament_id?: string;
}

class BannersService {
  /**
   * Listar todos os banners (admin)
   */
  async listBanners(params: { position?: string; is_active?: boolean; limit?: number; offset?: number }) {
    let query = supabaseAdmin
      .from('banners')
      .select(`
        *,
        tournament:tournaments(id, name, status),
        created_by_user:users!created_by(id, username)
      `, { count: 'exact' })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (params.position) {
      query = query.eq('position', params.position);
    }

    if (params.is_active !== undefined) {
      query = query.eq('is_active', params.is_active);
    }

    const limit = params.limit || 50;
    const offset = params.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return { banners: data || [], total: count || 0 };
  }

  /**
   * Obter banners ativos para exibição pública
   */
  async getActiveBanners(position?: string) {
    const { data, error } = await supabaseAdmin.rpc('get_active_banners', {
      p_position: position || null,
    });

    if (error) {
      console.error('Erro ao buscar banners ativos:', error);
      // Fallback para query direta
      let query = supabaseAdmin
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (position) {
        query = query.eq('position', position);
      }

      const { data: fallbackData } = await query;
      return fallbackData || [];
    }

    return data || [];
  }

  /**
   * Criar banner
   */
  async createBanner(adminId: string, data: CreateBannerDTO) {
    const { data: banner, error } = await supabaseAdmin
      .from('banners')
      .insert({
        ...data,
        created_by: adminId,
      })
      .select()
      .single();

    if (error) throw error;
    return banner;
  }

  /**
   * Atualizar banner
   */
  async updateBanner(bannerId: string, data: Partial<CreateBannerDTO>) {
    const { data: banner, error } = await supabaseAdmin
      .from('banners')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bannerId)
      .select()
      .single();

    if (error) throw error;
    return banner;
  }

  /**
   * Excluir banner
   */
  async deleteBanner(bannerId: string) {
    const { error } = await supabaseAdmin
      .from('banners')
      .delete()
      .eq('id', bannerId);

    if (error) throw error;
    return { success: true };
  }

  /**
   * Registrar visualização de banner
   */
  async trackView(bannerId: string) {
    await supabaseAdmin.rpc('increment_banner_view', { p_banner_id: bannerId });
  }

  /**
   * Registrar clique em banner
   */
  async trackClick(bannerId: string) {
    await supabaseAdmin.rpc('increment_banner_click', { p_banner_id: bannerId });
  }

  /**
   * Reordenar banners
   */
  async reorderBanners(bannerIds: string[]) {
    for (let i = 0; i < bannerIds.length; i++) {
      await supabaseAdmin
        .from('banners')
        .update({ display_order: i })
        .eq('id', bannerIds[i]);
    }
    return { success: true };
  }

  /**
   * Obter torneios em destaque
   */
  async getFeaturedTournaments(limit: number = 6) {
    const { data, error } = await supabaseAdmin.rpc('get_featured_tournaments', {
      p_limit: limit,
    });

    if (error) {
      console.error('Erro ao buscar torneios em destaque:', error);
      // Fallback
      const { data: fallbackData } = await supabaseAdmin
        .from('tournaments')
        .select('*')
        .in('status', ['open', 'scheduled', 'registration_closed'])
        .order('is_featured', { ascending: false })
        .order('featured_order', { ascending: true })
        .order('start_date', { ascending: true })
        .limit(limit);

      return fallbackData || [];
    }

    return data || [];
  }

  /**
   * Destacar/remover destaque de torneio
   */
  async toggleTournamentFeatured(tournamentId: string, isFeatured: boolean, featuredOrder?: number) {
    const { data, error } = await supabaseAdmin
      .from('tournaments')
      .update({
        is_featured: isFeatured,
        featured_order: featuredOrder || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tournamentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Atualizar imagem/cor do banner do torneio
   */
  async updateTournamentBanner(tournamentId: string, bannerImageUrl?: string, bannerColor?: string) {
    const { data, error } = await supabaseAdmin
      .from('tournaments')
      .update({
        banner_image_url: bannerImageUrl,
        banner_color: bannerColor,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tournamentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

export const bannersService = new BannersService();
