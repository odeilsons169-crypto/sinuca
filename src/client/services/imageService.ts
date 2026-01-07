/**
 * Serviço de Imagem - Upload de Avatar com suporte a câmera
 * Suporta: Upload de arquivo, Câmera (mobile/desktop), Crop/Resize
 */

export interface ImageCaptureOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  aspectRatio?: number;
}

export interface ImageResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Helper global para formatar URL do avatar.
 * Garante que nomes de arquivos locais recebam o prefixo /uploads/avatars/
 */
export function formatAvatarUrl(url: string | null | undefined, username: string = 'U'): string {
  if (!url) return username.charAt(0).toUpperCase();
  if (url.startsWith('http') || url.startsWith('/') || url.startsWith('data:')) return url;
  // Se for apenas o nome do arquivo, adiciona o prefixo correto
  return `/uploads/avatars/${url}`;
}

class ImageService {
  private defaultOptions: ImageCaptureOptions = {
    maxWidth: 512,
    maxHeight: 512,
    quality: 0.85,
    aspectRatio: 1, // Quadrado para avatar
  };

  /**
   * Detecta se o dispositivo tem câmera disponível
   */
  async hasCamera(): Promise<boolean> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return false;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(device => device.kind === 'videoinput');
    } catch {
      return false;
    }
  }

  /**
   * Detecta se é dispositivo móvel
   */
  isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Abre seletor de imagem (arquivo ou câmera dependendo do dispositivo)
   */
  async selectImage(options?: ImageCaptureOptions): Promise<ImageResult | null> {
    const opts = { ...this.defaultOptions, ...options };

    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      // Em mobile, permite escolher entre câmera e galeria
      if (this.isMobile()) {
        input.setAttribute('capture', 'environment');
      }

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        try {
          const result = await this.processImage(file, opts);
          resolve(result);
        } catch (err) {
          console.error('Erro ao processar imagem:', err);
          resolve(null);
        }
      };

      input.click();
    });
  }

  /**
   * Abre a câmera diretamente (para desktop ou quando usuário escolhe câmera)
   */
  async captureFromCamera(options?: ImageCaptureOptions): Promise<ImageResult | null> {
    const opts = { ...this.defaultOptions, ...options };

    return new Promise((resolve) => {
      // Criar modal de câmera
      const modal = this.createCameraModal(opts, resolve);
      document.body.appendChild(modal);
    });
  }

  /**
   * Cria modal com preview da câmera
   */
  private createCameraModal(
    options: ImageCaptureOptions,
    resolve: (result: ImageResult | null) => void
  ): HTMLElement {
    const modal = document.createElement('div');
    modal.className = 'camera-modal';
    modal.innerHTML = `
      <div class="camera-modal-content">
        <div class="camera-header">
          <h3>📷 Tirar Foto</h3>
          <button class="camera-close-btn" id="camera-close">✕</button>
        </div>
        <div class="camera-preview-container">
          <video id="camera-video" autoplay playsinline></video>
          <canvas id="camera-canvas" style="display: none;"></canvas>
          <div class="camera-overlay">
            <div class="camera-circle-guide"></div>
          </div>
        </div>
        <div class="camera-controls">
          <button class="camera-btn camera-btn-switch" id="camera-switch" title="Trocar câmera">
            🔄
          </button>
          <button class="camera-btn camera-btn-capture" id="camera-capture" title="Capturar">
            📸
          </button>
          <button class="camera-btn camera-btn-cancel" id="camera-cancel" title="Cancelar">
            ❌
          </button>
        </div>
      </div>
    `;

    // Adicionar estilos
    this.addCameraStyles();

    const video = modal.querySelector('#camera-video') as HTMLVideoElement;
    const canvas = modal.querySelector('#camera-canvas') as HTMLCanvasElement;
    let stream: MediaStream | null = null;
    let facingMode: 'user' | 'environment' = 'user';

    const startCamera = async () => {
      try {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        video.srcObject = stream;
      } catch (err) {
        console.error('Erro ao acessar câmera:', err);
        this.showCameraError(modal);
      }
    };

    const cleanup = () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      modal.remove();
    };

    // Event listeners
    modal.querySelector('#camera-close')?.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    modal.querySelector('#camera-cancel')?.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    modal.querySelector('#camera-switch')?.addEventListener('click', async () => {
      facingMode = facingMode === 'user' ? 'environment' : 'user';
      await startCamera();
    });

    modal.querySelector('#camera-capture')?.addEventListener('click', async () => {
      // Capturar frame do vídeo
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);

      // Converter para blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          cleanup();
          resolve(null);
          return;
        }

        try {
          const result = await this.processImageFromBlob(blob, options);
          cleanup();
          resolve(result);
        } catch (err) {
          console.error('Erro ao processar captura:', err);
          cleanup();
          resolve(null);
        }
      }, 'image/jpeg', options.quality);
    });

    // Fechar ao clicar fora
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(null);
      }
    });

    // Iniciar câmera
    startCamera();

    return modal;
  }

  /**
   * Mostra erro de câmera
   */
  private showCameraError(modal: HTMLElement) {
    const container = modal.querySelector('.camera-preview-container');
    if (container) {
      container.innerHTML = `
        <div class="camera-error">
          <span style="font-size: 3rem;">📷❌</span>
          <p>Não foi possível acessar a câmera.</p>
          <p style="font-size: 0.85rem; color: var(--text-muted);">
            Verifique as permissões do navegador.
          </p>
        </div>
      `;
    }
  }

  /**
   * Processa imagem de arquivo
   */
  async processImage(file: File, options: ImageCaptureOptions): Promise<ImageResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;

        try {
          const result = await this.resizeImage(dataUrl, options);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Processa imagem de blob
   */
  async processImageFromBlob(blob: Blob, options: ImageCaptureOptions): Promise<ImageResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;

        try {
          const result = await this.resizeImage(dataUrl, options);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error('Erro ao processar blob'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Redimensiona e recorta imagem
   */
  private resizeImage(dataUrl: string, options: ImageCaptureOptions): Promise<ImageResult> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        let { width, height } = img;
        const maxWidth = options.maxWidth || 512;
        const maxHeight = options.maxHeight || 512;
        const aspectRatio = options.aspectRatio || 1;

        // Calcular dimensões para crop centralizado (quadrado)
        let cropX = 0;
        let cropY = 0;
        let cropSize = Math.min(width, height);

        if (aspectRatio === 1) {
          // Crop quadrado centralizado
          if (width > height) {
            cropX = (width - height) / 2;
            cropSize = height;
          } else {
            cropY = (height - width) / 2;
            cropSize = width;
          }
        }

        // Definir tamanho do canvas
        const outputSize = Math.min(maxWidth, maxHeight);
        canvas.width = outputSize;
        canvas.height = outputSize;

        // Desenhar imagem recortada e redimensionada
        ctx.drawImage(
          img,
          cropX, cropY, cropSize, cropSize, // Source
          0, 0, outputSize, outputSize // Destination
        );

        // Converter para blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Erro ao criar blob'));
              return;
            }

            resolve({
              blob,
              dataUrl: canvas.toDataURL('image/jpeg', options.quality),
              width: outputSize,
              height: outputSize,
            });
          },
          'image/jpeg',
          options.quality
        );
      };

      img.onerror = () => reject(new Error('Erro ao carregar imagem'));
      img.src = dataUrl;
    });
  }

  /**
   * Adiciona estilos CSS para o modal de câmera
   */
  private addCameraStyles() {
    if (document.getElementById('camera-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'camera-modal-styles';
    style.textContent = `
      .camera-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
      }

      .camera-modal-content {
        background: var(--bg-secondary, #1a1a2e);
        border-radius: 16px;
        overflow: hidden;
        max-width: 500px;
        width: 95%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      }

      .camera-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        background: var(--bg-tertiary, #252540);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .camera-header h3 {
        margin: 0;
        font-size: 1.1rem;
        color: var(--text-primary, #fff);
      }

      .camera-close-btn {
        background: none;
        border: none;
        color: var(--text-muted, #888);
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0.25rem;
        line-height: 1;
        transition: color 0.2s;
      }

      .camera-close-btn:hover {
        color: var(--text-primary, #fff);
      }

      .camera-preview-container {
        position: relative;
        aspect-ratio: 1;
        background: #000;
        overflow: hidden;
      }

      .camera-preview-container video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .camera-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }

      .camera-circle-guide {
        width: 70%;
        height: 70%;
        border: 3px dashed rgba(255, 255, 255, 0.5);
        border-radius: 50%;
      }

      .camera-controls {
        display: flex;
        justify-content: center;
        gap: 1.5rem;
        padding: 1.5rem;
        background: var(--bg-tertiary, #252540);
      }

      .camera-btn {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .camera-btn-capture {
        background: linear-gradient(135deg, #00ff88, #00cc6a);
        color: #000;
        width: 70px;
        height: 70px;
        font-size: 2rem;
        box-shadow: 0 4px 20px rgba(0, 255, 136, 0.4);
      }

      .camera-btn-capture:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 30px rgba(0, 255, 136, 0.6);
      }

      .camera-btn-switch,
      .camera-btn-cancel {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }

      .camera-btn-switch:hover,
      .camera-btn-cancel:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.05);
      }

      .camera-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 2rem;
        text-align: center;
        color: var(--text-primary, #fff);
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Mostra modal de seleção (arquivo ou câmera)
   */
  async showImagePicker(options?: ImageCaptureOptions): Promise<ImageResult | null> {
    const hasCamera = await this.hasCamera();

    if (!hasCamera) {
      // Sem câmera, vai direto para seleção de arquivo
      return this.selectImage(options);
    }

    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'image-picker-modal';
      modal.innerHTML = `
        <div class="image-picker-content">
          <h3>📷 Escolher Foto</h3>
          <div class="image-picker-options">
            <button class="image-picker-btn" id="picker-camera">
              <span class="picker-icon">📸</span>
              <span class="picker-label">Tirar Foto</span>
            </button>
            <button class="image-picker-btn" id="picker-gallery">
              <span class="picker-icon">🖼️</span>
              <span class="picker-label">Galeria</span>
            </button>
          </div>
          <button class="image-picker-cancel" id="picker-cancel">Cancelar</button>
        </div>
      `;

      this.addPickerStyles();

      const cleanup = () => modal.remove();

      modal.querySelector('#picker-camera')?.addEventListener('click', async () => {
        cleanup();
        const result = await this.captureFromCamera(options);
        resolve(result);
      });

      modal.querySelector('#picker-gallery')?.addEventListener('click', async () => {
        cleanup();
        const result = await this.selectImage(options);
        resolve(result);
      });

      modal.querySelector('#picker-cancel')?.addEventListener('click', () => {
        cleanup();
        resolve(null);
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          cleanup();
          resolve(null);
        }
      });

      document.body.appendChild(modal);
    });
  }

  /**
   * Adiciona estilos do picker
   */
  private addPickerStyles() {
    if (document.getElementById('image-picker-styles')) return;

    const style = document.createElement('style');
    style.id = 'image-picker-styles';
    style.textContent = `
      .image-picker-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
      }

      .image-picker-content {
        background: var(--bg-secondary, #1a1a2e);
        border-radius: 16px;
        padding: 1.5rem;
        text-align: center;
        max-width: 320px;
        width: 90%;
      }

      .image-picker-content h3 {
        margin: 0 0 1.5rem;
        color: var(--text-primary, #fff);
      }

      .image-picker-options {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .image-picker-btn {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1.5rem 1rem;
        background: rgba(255, 255, 255, 0.05);
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
        color: var(--text-primary, #fff);
      }

      .image-picker-btn:hover {
        background: rgba(0, 255, 136, 0.1);
        border-color: var(--accent-green, #00ff88);
        transform: translateY(-2px);
      }

      .picker-icon {
        font-size: 2.5rem;
      }

      .picker-label {
        font-size: 0.9rem;
        font-weight: 500;
      }

      .image-picker-cancel {
        width: 100%;
        padding: 0.75rem;
        background: none;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        color: var(--text-muted, #888);
        cursor: pointer;
        transition: all 0.2s;
      }

      .image-picker-cancel:hover {
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-primary, #fff);
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Faz upload do avatar para o servidor
   */
  async uploadAvatar(imageResult: ImageResult): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', imageResult.blob, 'avatar.jpg');

      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        return { success: true, url: result.avatar_url };
      } else {
        return { success: false, error: result.error || 'Erro ao enviar avatar' };
      }
    } catch (err) {
      console.error('Erro no upload:', err);
      return { success: false, error: 'Erro de conexão' };
    }
  }
}

export const imageService = new ImageService();
