import { supabaseAdmin } from '../../services/supabase.js';

export interface MusicTrack {
  id: string;
  title: string;
  artist?: string;
  source_type: 'upload' | 'youtube';
  file_url?: string;
  youtube_id?: string;
  duration?: number;
  thumbnail_url?: string;
  genre?: string;
  display_order: number;
  is_active: boolean;
  added_by?: string;
  created_at: string;
}

export const musicService = {
  // Listar todas as músicas (admin)
  async getAllTracks(includeInactive = false) {
    let query = supabaseAdmin
      .from('music_tracks')
      .select('*, added_by_user:users!added_by(username)')
      .order('display_order', { ascending: true })
      .order('title', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar músicas:', error);
      return [];
    }

    return data || [];
  },

  // Listar músicas ativas (para usuários)
  async getActiveTracks(genre?: string) {
    let query = supabaseAdmin
      .from('music_tracks')
      .select('id, title, artist, source_type, file_url, youtube_id, duration, thumbnail_url, genre')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('title', { ascending: true });

    if (genre && genre !== 'all') {
      query = query.eq('genre', genre);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar playlist:', error);
      return [];
    }

    return data || [];
  },

  // Buscar música por ID
  async getTrackById(id: string) {
    const { data, error } = await supabaseAdmin
      .from('music_tracks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar música:', error);
      return null;
    }

    return data;
  },

  // Adicionar música
  async addTrack(track: Partial<MusicTrack>, addedBy: string) {
    const { data, error } = await supabaseAdmin
      .from('music_tracks')
      .insert({
        title: track.title,
        artist: track.artist,
        source_type: track.source_type,
        file_url: track.file_url,
        youtube_id: track.youtube_id,
        duration: track.duration,
        thumbnail_url: track.thumbnail_url,
        genre: track.genre,
        display_order: track.display_order || 0,
        is_active: track.is_active !== false,
        added_by: addedBy,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao adicionar música:', error);
      return { error: error.message };
    }

    return { track: data };
  },

  // Atualizar música
  async updateTrack(id: string, updates: Partial<MusicTrack>) {
    const { data, error } = await supabaseAdmin
      .from('music_tracks')
      .update({
        title: updates.title,
        artist: updates.artist,
        source_type: updates.source_type,
        file_url: updates.file_url,
        youtube_id: updates.youtube_id,
        duration: updates.duration,
        thumbnail_url: updates.thumbnail_url,
        genre: updates.genre,
        display_order: updates.display_order,
        is_active: updates.is_active,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar música:', error);
      return { error: error.message };
    }

    return { track: data };
  },

  // Deletar música
  async deleteTrack(id: string) {
    const { error } = await supabaseAdmin
      .from('music_tracks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar música:', error);
      return { error: error.message };
    }

    return { success: true };
  },

  // Toggle ativo/inativo
  async toggleTrackActive(id: string, isActive: boolean) {
    const { error } = await supabaseAdmin
      .from('music_tracks')
      .update({ is_active: isActive })
      .eq('id', id);

    if (error) {
      console.error('Erro ao alterar status:', error);
      return { error: error.message };
    }

    return { success: true };
  },

  // Reordenar músicas
  async reorderTracks(trackIds: string[]) {
    const updates = trackIds.map((id, index) => ({
      id,
      display_order: index,
    }));

    for (const update of updates) {
      await supabaseAdmin
        .from('music_tracks')
        .update({ display_order: update.display_order })
        .eq('id', update.id);
    }

    return { success: true };
  },

  // Obter gêneros disponíveis
  async getGenres() {
    const { data } = await supabaseAdmin
      .from('music_tracks')
      .select('genre')
      .eq('is_active', true)
      .not('genre', 'is', null);

    const genres = [...new Set((data || []).map(d => d.genre).filter(Boolean))];
    return genres;
  },

  // ==================== PREFERÊNCIAS DO USUÁRIO ====================

  // Obter preferências do usuário
  async getUserPreferences(userId: string) {
    const { data, error } = await supabaseAdmin
      .from('user_music_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar preferências:', error);
    }

    // Retornar padrões se não existir
    return data || {
      music_enabled: true,
      volume: 50,
      favorite_tracks: [],
      play_mode: 'shuffle',
    };
  },

  // Salvar preferências do usuário
  async saveUserPreferences(userId: string, prefs: any) {
    const { data, error } = await supabaseAdmin
      .from('user_music_preferences')
      .upsert({
        user_id: userId,
        music_enabled: prefs.music_enabled,
        volume: prefs.volume,
        favorite_tracks: prefs.favorite_tracks,
        last_played_track: prefs.last_played_track,
        play_mode: prefs.play_mode,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar preferências:', error);
      return { error: error.message };
    }

    return { preferences: data };
  },

  // Registrar reprodução (para analytics)
  async logPlayback(userId: string, trackId: string, context: string = 'match') {
    await supabaseAdmin
      .from('music_play_history')
      .insert({
        user_id: userId,
        track_id: trackId,
        context,
      });
  },

  // Estatísticas de reprodução (admin)
  async getPlaybackStats() {
    const { data } = await supabaseAdmin
      .from('music_play_history')
      .select('track_id, music_tracks(title, artist)')
      .order('played_at', { ascending: false })
      .limit(1000);

    // Contar reproduções por música
    const counts: Record<string, { title: string; artist: string; count: number }> = {};
    
    for (const play of data || []) {
      const track = play.music_tracks as any;
      if (!counts[play.track_id]) {
        counts[play.track_id] = {
          title: track?.title || 'Desconhecido',
          artist: track?.artist || '',
          count: 0,
        };
      }
      counts[play.track_id].count++;
    }

    return Object.entries(counts)
      .map(([id, info]) => ({ id, ...info }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  },

  // Extrair ID do YouTube de uma URL
  extractYouTubeId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  },

  // Extrair ID do YouTube de um código de incorporação (embed code)
  extractYouTubeIdFromEmbed(embedCode: string): string | null {
    // Padrões para extrair o ID do código de incorporação
    const patterns = [
      // <iframe ... src="https://www.youtube.com/embed/VIDEO_ID" ...>
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      // <iframe ... src="https://www.youtube-nocookie.com/embed/VIDEO_ID" ...>
      /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      // Apenas o ID se for passado diretamente
      /^([a-zA-Z0-9_-]{11})$/,
    ];

    for (const pattern of patterns) {
      const match = embedCode.match(pattern);
      if (match) return match[1];
    }

    // Tentar extrair de qualquer URL do YouTube no código
    const urlMatch = embedCode.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (urlMatch) return urlMatch[1];

    return null;
  },
};
