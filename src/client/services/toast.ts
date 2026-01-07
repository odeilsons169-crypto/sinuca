// =====================================================
// TOAST NOTIFICATION SERVICE
// Sistema de notificações visuais para feedback do usuário
// =====================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
    message: string;
    type?: ToastType;
    duration?: number; // Em milissegundos
    title?: string;
}

interface Toast {
    id: string;
    message: string;
    type: ToastType;
    title?: string;
    createdAt: number;
}

class ToastService {
    private container: HTMLDivElement | null = null;
    private toasts: Map<string, Toast> = new Map();
    private readonly DEFAULT_DURATION = 4000; // 4 segundos

    private ensureContainer(): HTMLDivElement {
        if (this.container && document.body.contains(this.container)) {
            return this.container;
        }

        // Remover container antigo se existir
        const existing = document.getElementById('toast-container');
        if (existing) existing.remove();

        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.innerHTML = this.getStyles();
        document.body.appendChild(this.container);
        return this.container;
    }

    private getStyles(): string {
        return `
      <style>
        #toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 12px;
          pointer-events: none;
          max-width: 400px;
        }

        .toast {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px 20px;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          pointer-events: auto;
          animation: toastSlideIn 0.3s ease-out;
          min-width: 300px;
          max-width: 100%;
          cursor: pointer;
          transition: transform 0.2s, opacity 0.2s;
        }

        .toast:hover {
          transform: translateX(-5px);
        }

        .toast.removing {
          animation: toastSlideOut 0.3s ease-in forwards;
        }

        .toast-success {
          background: linear-gradient(135deg, rgba(0, 200, 100, 0.95), rgba(0, 150, 80, 0.95));
          border: 1px solid rgba(0, 255, 120, 0.3);
        }

        .toast-error {
          background: linear-gradient(135deg, rgba(220, 50, 50, 0.95), rgba(180, 30, 30, 0.95));
          border: 1px solid rgba(255, 100, 100, 0.3);
        }

        .toast-warning {
          background: linear-gradient(135deg, rgba(220, 150, 0, 0.95), rgba(180, 120, 0, 0.95));
          border: 1px solid rgba(255, 200, 50, 0.3);
        }

        .toast-info {
          background: linear-gradient(135deg, rgba(50, 120, 220, 0.95), rgba(30, 100, 180, 0.95));
          border: 1px solid rgba(100, 150, 255, 0.3);
        }

        .toast-icon {
          font-size: 24px;
          line-height: 1;
          flex-shrink: 0;
        }

        .toast-content {
          flex: 1;
          min-width: 0;
        }

        .toast-title {
          font-weight: 700;
          font-size: 14px;
          color: #ffffff;
          margin-bottom: 4px;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .toast-message {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.9);
          line-height: 1.4;
          word-break: break-word;
        }

        .toast-close {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 20px;
          height: 20px;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          border-radius: 50%;
          color: #fff;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .toast:hover .toast-close {
          opacity: 1;
        }

        .toast-close:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .toast-progress {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background: rgba(255, 255, 255, 0.4);
          border-radius: 0 0 12px 12px;
          transition: width linear;
        }

        @keyframes toastSlideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes toastSlideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(120%);
            opacity: 0;
          }
        }

        @media (max-width: 480px) {
          #toast-container {
            top: 10px;
            right: 10px;
            left: 10px;
            max-width: none;
          }
          
          .toast {
            min-width: auto;
          }
        }
      </style>
    `;
    }

    private getIcon(type: ToastType): string {
        switch (type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
        }
    }

    private getDefaultTitle(type: ToastType): string {
        switch (type) {
            case 'success': return 'Sucesso!';
            case 'error': return 'Erro!';
            case 'warning': return 'Atenção!';
            case 'info': return 'Informação';
        }
    }

    show(options: ToastOptions): string {
        const container = this.ensureContainer();
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const type = options.type || 'info';
        const duration = options.duration ?? this.DEFAULT_DURATION;
        const title = options.title || this.getDefaultTitle(type);

        const toast: Toast = {
            id,
            message: options.message,
            type,
            title,
            createdAt: Date.now()
        };

        this.toasts.set(id, toast);

        const toastEl = document.createElement('div');
        toastEl.id = id;
        toastEl.className = `toast toast-${type}`;
        toastEl.style.position = 'relative';
        toastEl.innerHTML = `
      <span class="toast-icon">${this.getIcon(type)}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${options.message}</div>
      </div>
      <button class="toast-close">✕</button>
      ${duration > 0 ? `<div class="toast-progress" style="width: 100%;"></div>` : ''}
    `;

        // Fechar ao clicar
        toastEl.addEventListener('click', () => this.remove(id));

        container.appendChild(toastEl);

        // Auto-remover após duração
        if (duration > 0) {
            const progressBar = toastEl.querySelector('.toast-progress') as HTMLElement;
            if (progressBar) {
                progressBar.style.transition = `width ${duration}ms linear`;
                requestAnimationFrame(() => {
                    progressBar.style.width = '0%';
                });
            }

            setTimeout(() => this.remove(id), duration);
        }

        return id;
    }

    remove(id: string): void {
        const toastEl = document.getElementById(id);
        if (toastEl) {
            toastEl.classList.add('removing');
            setTimeout(() => {
                toastEl.remove();
                this.toasts.delete(id);
            }, 300);
        }
    }

    // Métodos convenientes
    success(message: string, title?: string, duration?: number): string {
        return this.show({ message, type: 'success', title, duration });
    }

    error(message: string, title?: string, duration?: number): string {
        return this.show({ message, type: 'error', title, duration: duration ?? 6000 }); // Erros duram mais
    }

    warning(message: string, title?: string, duration?: number): string {
        return this.show({ message, type: 'warning', title, duration });
    }

    info(message: string, title?: string, duration?: number): string {
        return this.show({ message, type: 'info', title, duration });
    }

    // Limpar todos
    clear(): void {
        this.toasts.forEach((_, id) => this.remove(id));
    }
}

// Singleton exportado
export const toast = new ToastService();

// Expor globalmente para facilitar uso
(window as any).toast = toast;
