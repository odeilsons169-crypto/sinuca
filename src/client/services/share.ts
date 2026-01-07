// Serviço de compartilhamento social

interface ShareData {
  title: string;
  text: string;
  url: string;
}

interface MatchShareData {
  winner: string;
  loser: string;
  score: string;
  mode: string;
}

class ShareService {
  private baseUrl = window.location.origin;

  // Compartilhar resultado de partida
  shareMatchResult(data: MatchShareData): void {
    const text = `🎱 ${data.winner} venceu ${data.loser} no Sinuca Online!\n📊 Placar: ${data.score}\n🎮 Modo: ${data.mode}\n\nJogue você também!`;
    const url = this.baseUrl;

    this.share({
      title: 'Sinuca Online - Resultado',
      text,
      url,
    });
  }

  // Compartilhar convite para jogar
  shareInvite(roomId: string, username: string): void {
    const text = `🎱 ${username} te convidou para jogar Sinuca Online!\n\nEntre agora e desafie seus amigos!`;
    const url = `${this.baseUrl}?room=${roomId}`;

    this.share({
      title: 'Sinuca Online - Convite',
      text,
      url,
    });
  }

  // Compartilhar ranking
  shareRanking(position: number, points: number, username: string): void {
    const text = `🏆 ${username} está em #${position} no ranking do Sinuca Online com ${points} pontos!\n\nVenha competir!`;
    const url = this.baseUrl;

    this.share({
      title: 'Sinuca Online - Ranking',
      text,
      url,
    });
  }

  // Método principal de compartilhamento
  private async share(data: ShareData): Promise<void> {
    // Tentar usar Web Share API (mobile)
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch (err) {
        // Usuário cancelou ou erro
      }
    }

    // Fallback: mostrar modal com opções
    this.showShareModal(data);
  }

  // Modal de compartilhamento
  private showShareModal(data: ShareData): void {
    const encodedText = encodeURIComponent(data.text);
    const encodedUrl = encodeURIComponent(data.url);
    const encodedTitle = encodeURIComponent(data.title);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal share-modal">
        <div class="modal-header">
          <h3 class="modal-title">📤 Compartilhar</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="share-buttons">
            <a href="https://wa.me/?text=${encodedText}%20${encodedUrl}" target="_blank" class="share-btn whatsapp">
              <span class="share-icon">📱</span>
              <span>WhatsApp</span>
            </a>
            <a href="https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}" target="_blank" class="share-btn twitter">
              <span class="share-icon">🐦</span>
              <span>Twitter</span>
            </a>
            <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}" target="_blank" class="share-btn facebook">
              <span class="share-icon">📘</span>
              <span>Facebook</span>
            </a>
            <a href="https://t.me/share/url?url=${encodedUrl}&text=${encodedText}" target="_blank" class="share-btn telegram">
              <span class="share-icon">✈️</span>
              <span>Telegram</span>
            </a>
            <button class="share-btn copy" id="copy-link-btn">
              <span class="share-icon">📋</span>
              <span>Copiar Link</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    modal.querySelector('.modal-close')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // Copy link
    modal.querySelector('#copy-link-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(`${data.text}\n${data.url}`);
      const btn = modal.querySelector('#copy-link-btn span:last-child');
      if (btn) btn.textContent = 'Copiado!';
      setTimeout(() => modal.remove(), 1000);
    });
  }

  // Gerar imagem do resultado (canvas)
  async generateResultImage(data: MatchShareData): Promise<Blob | null> {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background
    const gradient = ctx.createLinearGradient(0, 0, 600, 400);
    gradient.addColorStop(0, '#0f0f1a');
    gradient.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 400);

    // Border
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 580, 380);

    // Title
    ctx.fillStyle = '#00ff88';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎱 SINUCA ONLINE', 300, 60);

    // Winner
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('🏆 VENCEDOR', 300, 120);
    ctx.font = 'bold 32px Arial';
    ctx.fillText(data.winner, 300, 160);

    // Score
    ctx.fillStyle = '#00d4ff';
    ctx.font = 'bold 48px Arial';
    ctx.fillText(data.score, 300, 230);

    // Loser
    ctx.fillStyle = '#a0a0b0';
    ctx.font = '24px Arial';
    ctx.fillText(`vs ${data.loser}`, 300, 280);

    // Mode
    ctx.fillStyle = '#ffa502';
    ctx.font = '20px Arial';
    ctx.fillText(`Modo: ${data.mode}`, 300, 330);

    // URL
    ctx.fillStyle = '#6b6b80';
    ctx.font = '16px Arial';
    ctx.fillText('sinuca-online.com', 300, 370);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }
}

export const shareService = new ShareService();
