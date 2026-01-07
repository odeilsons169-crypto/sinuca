// =====================================================
// SISTEMA DE ÁUDIO IMERSIVO PARA SINUCA
// =====================================================

export interface AudioSettings {
  masterVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  musicVolume: number;
  enabled: boolean;
}

const DEFAULT_SETTINGS: AudioSettings = {
  masterVolume: 0.8,
  sfxVolume: 1.0,
  ambientVolume: 0.15,
  musicVolume: 0.5,
  enabled: true,
};

// Mensagens divertidas para eventos do jogo
const NICE_SHOT_MESSAGES = [
  '🎯 NICE SHOT!',
  '🔥 INCRÍVEL!',
  '💫 PERFEITO!',
  '⭐ SENSACIONAL!',
  '🎱 MESTRE!',
  '👏 SHOW!',
  '🏆 CAMPEÃO!',
];

const FOUL_MESSAGES = [
  '😬 FALTA!',
  '💥 OOPS!',
  '😅 ERROU!',
  '🙈 FOUL!',
  '❌ FALHA!',
];

const TURN_CHANGE_MESSAGES = [
  '🔄 SUA VEZ!',
  '👉 AGORA É VOCÊ!',
  '🎯 VAI LÁ!',
  '💪 MOSTRA!',
];

class AudioEngine {
  private audioContext: AudioContext | null = null;
  private settings: AudioSettings = { ...DEFAULT_SETTINGS };
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;
  
  // Sistema de música
  private musicAudio: HTMLAudioElement | null = null;
  private currentPlaylist: { url: string; title: string; artist: string }[] = [];
  private currentTrackIndex: number = 0;
  private isMusicPlaying: boolean = false;
  
  // Cache de buffers de áudio
  private buffers: Map<string, AudioBuffer> = new Map();
  
  constructor() {
    this.initContext();
  }
  
  private initContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('[Audio] Web Audio API não suportada');
    }
  }
  
  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
  
  playCueHit(power: number): void {
    if (!this.audioContext || !this.settings.enabled) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80 + power * 2, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200 + power * 10, now);
    
    const volume = Math.min(0.4, 0.2 + power * 0.01) * this.settings.sfxVolume * this.settings.masterVolume;
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.15);
    
    this.playNoiseBurst(0.05, 100, 0.08);
  }
  
  playBallCollision(impactSpeed: number): void {
    if (!this.audioContext || !this.settings.enabled) return;
    if (impactSpeed < 0.5) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    const normalizedImpact = Math.min(impactSpeed / 15, 1);
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'triangle';
    const baseFreq = 800 + normalizedImpact * 400 + Math.random() * 100;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.05);
    
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.Q.setValueAtTime(2, now);
    
    const volume = (0.15 + normalizedImpact * 0.25) * this.settings.sfxVolume * this.settings.masterVolume;
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.1);
    
    this.playNoiseBurst(0.03 + normalizedImpact * 0.02, 2000, 0.04);
  }
  
  playCushionHit(impactSpeed: number): void {
    if (!this.audioContext || !this.settings.enabled) return;
    if (impactSpeed < 1) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    const normalizedImpact = Math.min(impactSpeed / 12, 1);
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150 + normalizedImpact * 50, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    
    const volume = (0.1 + normalizedImpact * 0.15) * this.settings.sfxVolume * this.settings.masterVolume;
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.12);
  }
  
  playPocketFall(speed: number = 5): void {
    if (!this.audioContext || !this.settings.enabled) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.3);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, now);
    
    const volume = 0.25 * this.settings.sfxVolume * this.settings.masterVolume;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.4);
    
    setTimeout(() => this.playRollSound(), 150);
  }

  // ==================== NOVOS SONS ====================
  
  playNiceShot(): void {
    if (!this.audioContext || !this.settings.enabled) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // Sequência de notas ascendentes (celebração)
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      
      const volume = 0.15 * this.settings.sfxVolume * this.settings.masterVolume;
      gainNode.gain.setValueAtTime(0, now + i * 0.08);
      gainNode.gain.linearRampToValueAtTime(volume, now + i * 0.08 + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.15);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.2);
    });
  }
  
  playFoul(): void {
    if (!this.audioContext || !this.settings.enabled) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // Som descendente (erro)
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.3);
    
    const volume = 0.12 * this.settings.sfxVolume * this.settings.masterVolume;
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.4);
  }
  
  playTurnChange(): void {
    if (!this.audioContext || !this.settings.enabled) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // Som de "ding" suave
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    
    const volume = 0.1 * this.settings.sfxVolume * this.settings.masterVolume;
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.35);
  }
  
  playCombo(count: number): void {
    if (!this.audioContext || !this.settings.enabled) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    const baseFreq = 440 + count * 100;
    
    for (let i = 0; i < Math.min(count, 4); i++) {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * (1 + i * 0.25), now + i * 0.1);
      
      const volume = 0.12 * this.settings.sfxVolume * this.settings.masterVolume;
      gainNode.gain.setValueAtTime(volume, now + i * 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.2);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.25);
    }
  }

  // Som épico de vitória
  playVictory(): void {
    if (!this.audioContext || !this.settings.enabled) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // Fanfarra de vitória - sequência épica de notas
    const melody = [
      { freq: 523.25, time: 0, duration: 0.15 },      // C5
      { freq: 659.25, time: 0.15, duration: 0.15 },   // E5
      { freq: 783.99, time: 0.3, duration: 0.15 },    // G5
      { freq: 1046.50, time: 0.45, duration: 0.3 },   // C6 (sustain)
      { freq: 987.77, time: 0.8, duration: 0.15 },    // B5
      { freq: 1046.50, time: 0.95, duration: 0.4 },   // C6 (final)
    ];
    
    melody.forEach(note => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.time);
      
      const volume = 0.2 * this.settings.sfxVolume * this.settings.masterVolume;
      gainNode.gain.setValueAtTime(0, now + note.time);
      gainNode.gain.linearRampToValueAtTime(volume, now + note.time + 0.02);
      gainNode.gain.setValueAtTime(volume, now + note.time + note.duration - 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.duration);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(now + note.time);
      osc.stop(now + note.time + note.duration + 0.1);
    });
    
    // Adicionar harmônicos para som mais rico
    melody.forEach(note => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq * 2, now + note.time); // Oitava acima
      
      const volume = 0.08 * this.settings.sfxVolume * this.settings.masterVolume;
      gainNode.gain.setValueAtTime(0, now + note.time);
      gainNode.gain.linearRampToValueAtTime(volume, now + note.time + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.duration);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(now + note.time);
      osc.stop(now + note.time + note.duration + 0.1);
    });
    
    // Efeito de "shimmer" no final
    setTimeout(() => {
      this.playShimmer();
    }, 1200);
  }
  
  // Som de derrota (mais suave)
  playDefeat(): void {
    if (!this.audioContext || !this.settings.enabled) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    // Sequência descendente triste
    const notes = [
      { freq: 392, time: 0, duration: 0.3 },      // G4
      { freq: 349.23, time: 0.3, duration: 0.3 }, // F4
      { freq: 329.63, time: 0.6, duration: 0.3 }, // E4
      { freq: 261.63, time: 0.9, duration: 0.5 }, // C4
    ];
    
    notes.forEach(note => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.time);
      
      const volume = 0.12 * this.settings.sfxVolume * this.settings.masterVolume;
      gainNode.gain.setValueAtTime(volume, now + note.time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + note.time + note.duration);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(now + note.time);
      osc.stop(now + note.time + note.duration + 0.1);
    });
  }
  
  // Efeito shimmer (brilho)
  private playShimmer(): void {
    if (!this.audioContext || !this.settings.enabled) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    for (let i = 0; i < 8; i++) {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      const freq = 2000 + Math.random() * 2000;
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      
      const volume = 0.03 * this.settings.sfxVolume * this.settings.masterVolume;
      gainNode.gain.setValueAtTime(volume, now + i * 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.2);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.25);
    }
  }
  
  // ==================== MENSAGENS ALEATÓRIAS ====================
  
  getRandomNiceShotMessage(): string {
    return NICE_SHOT_MESSAGES[Math.floor(Math.random() * NICE_SHOT_MESSAGES.length)];
  }
  
  getRandomFoulMessage(): string {
    return FOUL_MESSAGES[Math.floor(Math.random() * FOUL_MESSAGES.length)];
  }
  
  getRandomTurnChangeMessage(): string {
    return TURN_CHANGE_MESSAGES[Math.floor(Math.random() * TURN_CHANGE_MESSAGES.length)];
  }
  
  // ==================== SONS AUXILIARES ====================
  
  private playRollSound(): void {
    if (!this.audioContext || !this.settings.enabled) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.1;
    }
    
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    source.buffer = buffer;
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    
    const volume = 0.08 * this.settings.sfxVolume * this.settings.masterVolume;
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    source.start(now);
  }
  
  private playNoiseBurst(volume: number, filterFreq: number, duration: number): void {
    if (!this.audioContext) return;
    
    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    source.buffer = buffer;
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    
    const vol = volume * this.settings.sfxVolume * this.settings.masterVolume;
    gainNode.gain.setValueAtTime(vol, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    source.start(now);
  }
  
  // ==================== SOM AMBIENTE ====================
  
  startAmbient(): void {
    if (!this.audioContext || !this.settings.enabled || this.ambientSource) return;
    
    const ctx = this.audioContext;
    
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 0.5;
    }
    
    this.ambientSource = ctx.createBufferSource();
    this.ambientGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    this.ambientSource.buffer = buffer;
    this.ambientSource.loop = true;
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, ctx.currentTime);
    
    this.ambientGain.gain.setValueAtTime(
      this.settings.ambientVolume * this.settings.masterVolume, 
      ctx.currentTime
    );
    
    this.ambientSource.connect(filter);
    filter.connect(this.ambientGain);
    this.ambientGain.connect(ctx.destination);
    
    this.ambientSource.start();
  }
  
  stopAmbient(): void {
    if (this.ambientSource) {
      this.ambientSource.stop();
      this.ambientSource = null;
    }
  }

  // ==================== SISTEMA DE MÚSICA ====================
  
  setPlaylist(tracks: { url: string; title: string; artist: string }[]): void {
    this.currentPlaylist = tracks;
    this.currentTrackIndex = 0;
  }
  
  playMusic(): void {
    if (this.currentPlaylist.length === 0) return;
    
    if (!this.musicAudio) {
      this.musicAudio = new Audio();
      this.musicAudio.addEventListener('ended', () => this.nextTrack());
    }
    
    const track = this.currentPlaylist[this.currentTrackIndex];
    if (this.musicAudio.src !== track.url) {
      this.musicAudio.src = track.url;
    }
    
    this.musicAudio.volume = this.settings.musicVolume * this.settings.masterVolume;
    this.musicAudio.play().catch(e => console.warn('[Audio] Erro ao tocar música:', e));
    this.isMusicPlaying = true;
  }
  
  pauseMusic(): void {
    if (this.musicAudio) {
      this.musicAudio.pause();
      this.isMusicPlaying = false;
    }
  }
  
  toggleMusic(): boolean {
    if (this.isMusicPlaying) {
      this.pauseMusic();
    } else {
      this.playMusic();
    }
    return this.isMusicPlaying;
  }
  
  nextTrack(): void {
    if (this.currentPlaylist.length === 0) return;
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.currentPlaylist.length;
    if (this.isMusicPlaying) {
      this.playMusic();
    }
  }
  
  previousTrack(): void {
    if (this.currentPlaylist.length === 0) return;
    this.currentTrackIndex = (this.currentTrackIndex - 1 + this.currentPlaylist.length) % this.currentPlaylist.length;
    if (this.isMusicPlaying) {
      this.playMusic();
    }
  }
  
  getCurrentTrack(): { title: string; artist: string; index: number; total: number } | null {
    if (this.currentPlaylist.length === 0) return null;
    const track = this.currentPlaylist[this.currentTrackIndex];
    return {
      title: track.title,
      artist: track.artist,
      index: this.currentTrackIndex,
      total: this.currentPlaylist.length
    };
  }
  
  setMusicVolume(volume: number): void {
    this.settings.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicAudio) {
      this.musicAudio.volume = this.settings.musicVolume * this.settings.masterVolume;
    }
  }
  
  isMusicCurrentlyPlaying(): boolean {
    return this.isMusicPlaying;
  }
  
  stopMusic(): void {
    if (this.musicAudio) {
      this.musicAudio.pause();
      this.musicAudio.currentTime = 0;
      this.isMusicPlaying = false;
    }
  }
  
  // ==================== CONFIGURAÇÕES ====================
  
  setSettings(settings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...settings };
    
    if (this.ambientGain && this.audioContext) {
      this.ambientGain.gain.setValueAtTime(
        this.settings.ambientVolume * this.settings.masterVolume,
        this.audioContext.currentTime
      );
    }
    
    if (this.musicAudio) {
      this.musicAudio.volume = this.settings.musicVolume * this.settings.masterVolume;
    }
  }
  
  getSettings(): AudioSettings {
    return { ...this.settings };
  }
  
  setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    if (!enabled) {
      this.stopAmbient();
      this.stopMusic();
    }
  }
}

// Singleton
export const audioEngine = new AudioEngine();

// Wrapper simples para compatibilidade
export const audioManager = {
  play(sound: string, volume: number = 1): void {
    audioEngine.resume();
    
    switch (sound) {
      case 'cue_hit':
        audioEngine.playCueHit(volume * 20);
        break;
      case 'ball_hit':
        audioEngine.playBallCollision(volume * 15);
        break;
      case 'cushion_hit':
        audioEngine.playCushionHit(volume * 12);
        break;
      case 'pocket':
        audioEngine.playPocketFall(volume * 10);
        break;
      case 'nice_shot':
        audioEngine.playNiceShot();
        break;
      case 'foul':
        audioEngine.playFoul();
        break;
      case 'turn_change':
        audioEngine.playTurnChange();
        break;
    }
  },
  
  setVolume(volume: number): void {
    audioEngine.setSettings({ masterVolume: volume });
  },
  
  setEnabled(enabled: boolean): void {
    audioEngine.setEnabled(enabled);
  },
};
