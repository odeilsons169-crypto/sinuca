// =====================================================
// MUSIC PLAYER SERVICE
// Reproduz músicas durante partidas (upload ou YouTube)
// =====================================================

interface MusicTrack {
  id: string;
  title: string;
  artist?: string;
  source_type: 'upload' | 'youtube';
  file_url?: string;
  youtube_id?: string;
  duration?: number;
  thumbnail_url?: string;
  genre?: string;
}

interface MusicPreferences {
  music_enabled: boolean;
  volume: number;
  favorite_tracks: string[];
  play_mode: 'sequential' | 'shuffle' | 'repeat_one' | 'repeat_all';
}

class MusicPlayer {
  private playlist: MusicTrack[] = [];
  private currentIndex: number = -1;
  private audioElement: HTMLAudioElement | null = null;
  private youtubePlayer: any = null;
  private youtubeReady: boolean = false;
  private isPlaying: boolean = false;
  private preferences: MusicPreferences = {
    music_enabled: true,
    volume: 50,
    favorite_tracks: [],
    play_mode: 'shuffle',
  };
  private onTrackChangeCallbacks: ((track: MusicTrack | null) => void)[] = [];
  private onPlayStateChangeCallbacks: ((isPlaying: boolean) => void)[] = [];

  constructor() {
    this.initAudioElement();
    this.loadYouTubeAPI();
  }

  private initAudioElement() {
    this.audioElement = new Audio();
    this.audioElement.volume = this.preferences.volume / 100;
    
    this.audioElement.addEventListener('ended', () => {
      this.handleTrackEnd();
    });

    this.audioElement.addEventListener('error', (e) => {
      console.error('Erro no áudio:', e);
      this.next();
    });
  }

  private loadYouTubeAPI() {
    // Verificar se já foi carregado
    if ((window as any).YT) {
      this.youtubeReady = true;
      return;
    }

    // Carregar API do YouTube
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    // Callback quando API estiver pronta
    (window as any).onYouTubeIframeAPIReady = () => {
      this.youtubeReady = true;
      console.log('YouTube API pronta');
    };
  }

  private createYouTubePlayer(videoId: string) {
    // Criar container se não existir
    let container = document.getElementById('youtube-player-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'youtube-player-container';
      container.style.cssText = 'position: fixed; top: -9999px; left: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none;';
      document.body.appendChild(container);
    }

    // Criar div para o player
    const playerDiv = document.createElement('div');
    playerDiv.id = 'youtube-player';
    container.innerHTML = '';
    container.appendChild(playerDiv);

    // Criar player
    this.youtubePlayer = new (window as any).YT.Player('youtube-player', {
      height: '1',
      width: '1',
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
      },
      events: {
        onReady: (event: any) => {
          event.target.setVolume(this.preferences.volume);
          event.target.playVideo();
        },
        onStateChange: (event: any) => {
          // 0 = ended
          if (event.data === 0) {
            this.handleTrackEnd();
          }
        },
        onError: (event: any) => {
          console.error('Erro no YouTube:', event.data);
          this.next();
        },
      },
    });
  }

  private handleTrackEnd() {
    switch (this.preferences.play_mode) {
      case 'repeat_one':
        this.play();
        break;
      case 'repeat_all':
        this.next();
        break;
      case 'shuffle':
        this.playRandom();
        break;
      case 'sequential':
      default:
        if (this.currentIndex < this.playlist.length - 1) {
          this.next();
        } else {
          this.stop();
        }
    }
  }

  // ==================== API PÚBLICA ====================

  async loadPlaylist(genre?: string) {
    try {
      const response = await fetch(`/api/music/playlist${genre ? `?genre=${genre}` : ''}`);
      const data = await response.json();
      this.playlist = data.tracks || [];
      console.log(`Playlist carregada: ${this.playlist.length} músicas`);
    } catch (err) {
      console.error('Erro ao carregar playlist:', err);
    }
  }

  async loadPreferences() {
    try {
      const response = await fetch('/api/music/preferences', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.preferences) {
        this.preferences = { ...this.preferences, ...data.preferences };
        this.setVolume(this.preferences.volume);
      }
    } catch (err) {
      console.error('Erro ao carregar preferências:', err);
    }
  }

  async savePreferences() {
    try {
      await fetch('/api/music/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(this.preferences),
      });
    } catch (err) {
      console.error('Erro ao salvar preferências:', err);
    }
  }

  play(index?: number) {
    if (this.playlist.length === 0) return;

    if (index !== undefined) {
      this.currentIndex = index;
    } else if (this.currentIndex < 0) {
      this.currentIndex = this.preferences.play_mode === 'shuffle' 
        ? Math.floor(Math.random() * this.playlist.length)
        : 0;
    }

    const track = this.playlist[this.currentIndex];
    if (!track) return;

    // Parar reprodução atual
    this.stopCurrentPlayback();

    if (track.source_type === 'youtube' && track.youtube_id) {
      this.playYouTube(track.youtube_id);
    } else if (track.source_type === 'upload' && track.file_url) {
      this.playAudio(track.file_url);
    }

    this.isPlaying = true;
    this.notifyTrackChange(track);
    this.notifyPlayStateChange(true);

    // Registrar reprodução
    this.logPlayback(track.id);
  }

  private playAudio(url: string) {
    if (!this.audioElement) return;
    this.audioElement.src = url;
    this.audioElement.play().catch(err => {
      console.error('Erro ao reproduzir áudio:', err);
    });
  }

  private playYouTube(videoId: string) {
    if (!this.youtubeReady) {
      console.warn('YouTube API não está pronta');
      // Tentar novamente em 1 segundo
      setTimeout(() => this.playYouTube(videoId), 1000);
      return;
    }

    if (this.youtubePlayer) {
      this.youtubePlayer.loadVideoById(videoId);
    } else {
      this.createYouTubePlayer(videoId);
    }
  }

  private stopCurrentPlayback() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
    if (this.youtubePlayer) {
      try {
        this.youtubePlayer.stopVideo();
      } catch (e) {}
    }
  }

  pause() {
    if (this.audioElement && !this.audioElement.paused) {
      this.audioElement.pause();
    }
    if (this.youtubePlayer) {
      try {
        this.youtubePlayer.pauseVideo();
      } catch (e) {}
    }
    this.isPlaying = false;
    this.notifyPlayStateChange(false);
  }

  resume() {
    const track = this.getCurrentTrack();
    if (!track) return;

    if (track.source_type === 'upload' && this.audioElement) {
      this.audioElement.play();
    } else if (track.source_type === 'youtube' && this.youtubePlayer) {
      try {
        this.youtubePlayer.playVideo();
      } catch (e) {}
    }
    this.isPlaying = true;
    this.notifyPlayStateChange(true);
  }

  stop() {
    this.stopCurrentPlayback();
    this.isPlaying = false;
    this.currentIndex = -1;
    this.notifyTrackChange(null);
    this.notifyPlayStateChange(false);
  }

  next() {
    if (this.playlist.length === 0) return;

    if (this.preferences.play_mode === 'shuffle') {
      this.playRandom();
    } else {
      this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
      this.play();
    }
  }

  previous() {
    if (this.playlist.length === 0) return;

    this.currentIndex = this.currentIndex <= 0 
      ? this.playlist.length - 1 
      : this.currentIndex - 1;
    this.play();
  }

  playRandom() {
    if (this.playlist.length === 0) return;
    
    let newIndex = Math.floor(Math.random() * this.playlist.length);
    // Evitar repetir a mesma música
    if (this.playlist.length > 1 && newIndex === this.currentIndex) {
      newIndex = (newIndex + 1) % this.playlist.length;
    }
    this.currentIndex = newIndex;
    this.play();
  }

  setVolume(volume: number) {
    this.preferences.volume = Math.max(0, Math.min(100, volume));
    
    if (this.audioElement) {
      this.audioElement.volume = this.preferences.volume / 100;
    }
    if (this.youtubePlayer) {
      try {
        this.youtubePlayer.setVolume(this.preferences.volume);
      } catch (e) {}
    }
  }

  // ==================== VOICE DUCKING ====================
  // Quando alguém está falando, baixa o volume da música
  
  private originalVolume: number = 50;
  private isDucked: boolean = false;
  private duckLevel: number = 15; // Volume durante ducking (15%)

  duckVolume() {
    if (this.isDucked) return;
    
    // Salvar volume original antes de baixar
    this.originalVolume = this.preferences.volume;
    this.isDucked = true;
    
    // Baixar para nível de fundo
    this.applyVolume(this.duckLevel);
    console.log('[MusicPlayer] Volume ducked para', this.duckLevel, '% (original:', this.originalVolume, '%)');
  }

  restoreVolume() {
    if (!this.isDucked) return;
    
    this.isDucked = false;
    
    // Restaurar volume original
    this.applyVolume(this.originalVolume);
    console.log('[MusicPlayer] Volume restaurado para', this.originalVolume, '%');
  }

  private applyVolume(volume: number) {
    const normalizedVolume = Math.max(0, Math.min(100, volume));
    
    if (this.audioElement) {
      this.audioElement.volume = normalizedVolume / 100;
    }
    if (this.youtubePlayer) {
      try {
        this.youtubePlayer.setVolume(normalizedVolume);
      } catch (e) {}
    }
  }

  isDuckedState(): boolean {
    return this.isDucked;
  }

  setPlayMode(mode: MusicPreferences['play_mode']) {
    this.preferences.play_mode = mode;
  }

  toggleMute() {
    if (this.preferences.volume > 0) {
      this.setVolume(0);
    } else {
      this.setVolume(50);
    }
  }

  // ==================== GETTERS ====================

  getCurrentTrack(): MusicTrack | null {
    return this.playlist[this.currentIndex] || null;
  }

  getPlaylist(): MusicTrack[] {
    return this.playlist;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getVolume(): number {
    return this.preferences.volume;
  }

  getPlayMode(): string {
    return this.preferences.play_mode;
  }

  getPreferences(): MusicPreferences {
    return this.preferences;
  }

  // ==================== CALLBACKS ====================

  onTrackChange(callback: (track: MusicTrack | null) => void) {
    this.onTrackChangeCallbacks.push(callback);
  }

  onPlayStateChange(callback: (isPlaying: boolean) => void) {
    this.onPlayStateChangeCallbacks.push(callback);
  }

  private notifyTrackChange(track: MusicTrack | null) {
    this.onTrackChangeCallbacks.forEach(cb => cb(track));
  }

  private notifyPlayStateChange(isPlaying: boolean) {
    this.onPlayStateChangeCallbacks.forEach(cb => cb(isPlaying));
  }

  // ==================== ANALYTICS ====================

  private async logPlayback(trackId: string) {
    try {
      await fetch('/api/music/log-play', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ trackId, context: 'match' }),
      });
    } catch (err) {
      // Ignorar erros de log
    }
  }

  // ==================== CLEANUP ====================

  destroy() {
    this.stop();
    if (this.youtubePlayer) {
      try {
        this.youtubePlayer.destroy();
      } catch (e) {}
    }
    const container = document.getElementById('youtube-player-container');
    if (container) {
      container.remove();
    }
  }
}

// Singleton
export const musicPlayer = new MusicPlayer();
