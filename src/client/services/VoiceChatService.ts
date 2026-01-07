import { realtimeService } from './realtime.js';
import { VOICE_EVENTS, VoiceSignalPayload } from '../../shared/realtime/events.js';

export interface VoiceState {
  isActive: boolean;
  isMuted: boolean;
  isRemoteMuted: boolean;
  localVolume: number;
  remoteVolume: number;
  isSpeaking: boolean;
  isRemoteSpeaking: boolean;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'failed';
}

export class VoiceChatService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private userId: string | null = null;
  private roomId: string | null = null;
  
  // Estado
  private state: VoiceState = {
    isActive: false,
    isMuted: false,
    isRemoteMuted: false,
    localVolume: 1.0,
    remoteVolume: 1.0,
    isSpeaking: false,
    isRemoteSpeaking: false,
    connectionState: 'disconnected',
  };

  // Audio elements
  private remoteAudio: HTMLAudioElement | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private remoteAnalyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private speakingCheckInterval: number | null = null;

  // Callbacks
  private onStateChangeCallback: ((state: VoiceState) => void) | null = null;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;

  // STUN/TURN servers
  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
  };

  constructor() {
    this.handleSignal = this.handleSignal.bind(this);
  }

  getState(): VoiceState {
    return { ...this.state };
  }

  onStateChange(callback: (state: VoiceState) => void) {
    this.onStateChangeCallback = callback;
  }

  private updateState(updates: Partial<VoiceState>) {
    this.state = { ...this.state, ...updates };
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.state);
    }
  }

  async start(userId: string, roomId: string, isInitiator: boolean): Promise<boolean> {
    if (this.localStream) {
      console.log('[VoiceChat] Já iniciado');
      return true;
    }

    this.userId = userId;
    this.roomId = roomId;
    this.updateState({ connectionState: 'connecting' });

    console.log('[VoiceChat] Iniciando chat de voz...');

    // 1. Obter áudio do microfone
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
        video: false,
      });
    } catch (err: any) {
      console.error('[VoiceChat] Erro ao acessar microfone:', err);
      this.updateState({ connectionState: 'failed' });
      
      if (err.name === 'NotAllowedError') {
        throw new Error('Permissão de microfone negada. Habilite nas configurações do navegador.');
      } else if (err.name === 'NotFoundError') {
        throw new Error('Nenhum microfone encontrado.');
      }
      throw new Error('Erro ao acessar microfone: ' + err.message);
    }

    // 2. Configurar análise de áudio local (para detectar fala)
    this.setupAudioAnalysis();

    // 3. Criar Peer Connection
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    // 4. Monitorar estado da conexão
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[VoiceChat] Estado da conexão:', state);
      
      if (state === 'connected') {
        this.updateState({ connectionState: 'connected', isActive: true });
      } else if (state === 'failed' || state === 'disconnected') {
        this.updateState({ connectionState: 'failed' });
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[VoiceChat] ICE state:', this.peerConnection?.iceConnectionState);
    };

    // 5. Adicionar trilhas locais
    this.localStream.getTracks().forEach(track => {
      this.peerConnection?.addTrack(track, this.localStream!);
    });

    // 6. Receber stream remoto
    this.peerConnection.ontrack = (event) => {
      console.log('[VoiceChat] Stream remoto recebido!');
      this.remoteStream = event.streams[0];
      
      // Criar elemento de áudio para reproduzir
      this.setupRemoteAudio();
      
      // Configurar análise de áudio remoto
      this.setupRemoteAudioAnalysis();
      
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
      
      this.updateState({ connectionState: 'connected', isActive: true });
    };

    // 7. Tratar candidatos ICE
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        realtimeService.sendVoiceSignal({
          senderId: this.userId!,
          signal: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    // 8. Ouvir sinais
    realtimeService.on(VOICE_EVENTS.SIGNAL, this.handleSignal);

    // 9. Criar oferta se for o iniciador (Host)
    if (isInitiator) {
      console.log('[VoiceChat] Criando oferta...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await this.peerConnection.setLocalDescription(offer);
      realtimeService.sendVoiceSignal({
        senderId: this.userId!,
        signal: { type: 'offer', sdp: offer },
      });
    }

    // 10. Iniciar verificação de fala
    this.startSpeakingDetection();

    this.updateState({ isActive: true });
    return true;
  }

  private setupAudioAnalysis() {
    if (!this.localStream) return;

    try {
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.localAnalyser = this.audioContext.createAnalyser();
      this.localAnalyser.fftSize = 256;
      source.connect(this.localAnalyser);
    } catch (err) {
      console.error('[VoiceChat] Erro ao configurar análise de áudio:', err);
    }
  }

  private setupRemoteAudioAnalysis() {
    if (!this.remoteStream || !this.audioContext) return;

    try {
      const source = this.audioContext.createMediaStreamSource(this.remoteStream);
      this.remoteAnalyser = this.audioContext.createAnalyser();
      this.remoteAnalyser.fftSize = 256;
      source.connect(this.remoteAnalyser);
    } catch (err) {
      console.error('[VoiceChat] Erro ao configurar análise de áudio remoto:', err);
    }
  }

  private setupRemoteAudio() {
    if (!this.remoteStream) return;

    // Remover áudio anterior se existir
    if (this.remoteAudio) {
      this.remoteAudio.srcObject = null;
      this.remoteAudio.remove();
    }

    // Criar novo elemento de áudio
    this.remoteAudio = document.createElement('audio');
    this.remoteAudio.srcObject = this.remoteStream;
    this.remoteAudio.autoplay = true;
    this.remoteAudio.volume = this.state.remoteVolume;
    
    // Adicionar ao DOM (necessário para alguns navegadores)
    this.remoteAudio.style.display = 'none';
    document.body.appendChild(this.remoteAudio);

    // Tentar reproduzir
    this.remoteAudio.play().catch(err => {
      console.error('[VoiceChat] Erro ao reproduzir áudio remoto:', err);
    });
  }

  private startSpeakingDetection() {
    if (this.speakingCheckInterval) {
      clearInterval(this.speakingCheckInterval);
    }

    this.speakingCheckInterval = window.setInterval(() => {
      // Verificar fala local
      if (this.localAnalyser && !this.state.isMuted) {
        const dataArray = new Uint8Array(this.localAnalyser.frequencyBinCount);
        this.localAnalyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const isSpeaking = average > 30; // Threshold
        
        if (isSpeaking !== this.state.isSpeaking) {
          this.updateState({ isSpeaking });
        }
      }

      // Verificar fala remota
      if (this.remoteAnalyser) {
        const dataArray = new Uint8Array(this.remoteAnalyser.frequencyBinCount);
        this.remoteAnalyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const isRemoteSpeaking = average > 30;
        
        if (isRemoteSpeaking !== this.state.isRemoteSpeaking) {
          this.updateState({ isRemoteSpeaking });
        }
      }
    }, 100);
  }

  async createOffer() {
    if (!this.peerConnection) return;
    
    console.log('[VoiceChat] Criando oferta manual...');
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await this.peerConnection.setLocalDescription(offer);
    realtimeService.sendVoiceSignal({
      senderId: this.userId!,
      signal: { type: 'offer', sdp: offer },
    });
  }

  private async handleSignal(payload: VoiceSignalPayload) {
    if (payload.senderId === this.userId) return;
    if (!this.peerConnection) return;

    try {
      const signal = payload.signal;

      if (signal.type === 'offer') {
        console.log('[VoiceChat] Oferta recebida');
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        realtimeService.sendVoiceSignal({
          senderId: this.userId!,
          signal: { type: 'answer', sdp: answer },
        });
      } else if (signal.type === 'answer') {
        console.log('[VoiceChat] Resposta recebida');
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'candidate') {
        console.log('[VoiceChat] Candidato ICE recebido');
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    } catch (err) {
      console.error('[VoiceChat] Erro ao processar sinal:', err);
    }
  }

  stop() {
    console.log('[VoiceChat] Parando serviço...');

    // Parar detecção de fala
    if (this.speakingCheckInterval) {
      clearInterval(this.speakingCheckInterval);
      this.speakingCheckInterval = null;
    }

    // Parar streams
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Remover áudio remoto
    if (this.remoteAudio) {
      this.remoteAudio.srcObject = null;
      this.remoteAudio.remove();
      this.remoteAudio = null;
    }

    // Fechar peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Fechar audio context
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.localAnalyser = null;
    this.remoteAnalyser = null;
    this.remoteStream = null;

    this.updateState({
      isActive: false,
      isMuted: false,
      isSpeaking: false,
      isRemoteSpeaking: false,
      connectionState: 'disconnected',
    });
  }

  toggleMute(): boolean {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });

      const track = this.localStream.getAudioTracks()[0];
      const isMuted = !track?.enabled;
      
      this.updateState({ isMuted, isSpeaking: false });
      return isMuted;
    }
    return this.state.isMuted;
  }

  setLocalVolume(volume: number) {
    // Volume local não afeta o que é enviado, apenas para referência
    this.updateState({ localVolume: Math.max(0, Math.min(1, volume)) });
  }

  setRemoteVolume(volume: number) {
    const normalizedVolume = Math.max(0, Math.min(1, volume));
    this.updateState({ remoteVolume: normalizedVolume });
    
    if (this.remoteAudio) {
      this.remoteAudio.volume = normalizedVolume;
    }
  }

  muteRemote(muted: boolean) {
    this.updateState({ isRemoteMuted: muted });
    
    if (this.remoteAudio) {
      this.remoteAudio.muted = muted;
    }
  }

  isMicMuted(): boolean {
    return this.state.isMuted;
  }

  onRemoteStream(callback: (stream: MediaStream) => void) {
    this.onRemoteStreamCallback = callback;
  }

  isActive(): boolean {
    return this.state.isActive;
  }

  isConnected(): boolean {
    return this.state.connectionState === 'connected';
  }
}

export const voiceChatService = new VoiceChatService();
