import { api } from '../services/api';

export function VerifyEmailPage(app: any, email: string): string {
  setTimeout(() => bindVerifyEvents(app, email), 100);

  return `
    <div class="auth-container">
      <div class="auth-card animate-fadeIn">
        <div class="auth-header">
          <div class="auth-logo">🎱</div>
          <h1 class="auth-title">Verificar E-mail</h1>
          <p class="auth-subtitle">Digite o código enviado para <strong>${email}</strong></p>
        </div>

        <form id="verify-form" class="auth-form">
          <div id="auth-error" class="auth-error hidden"></div>
          <div id="auth-success" class="auth-success hidden"></div>

          <div class="code-inputs" id="code-inputs">
            <input type="text" maxlength="1" class="code-input" data-index="0" autofocus>
            <input type="text" maxlength="1" class="code-input" data-index="1">
            <input type="text" maxlength="1" class="code-input" data-index="2">
            <input type="text" maxlength="1" class="code-input" data-index="3">
            <input type="text" maxlength="1" class="code-input" data-index="4">
            <input type="text" maxlength="1" class="code-input" data-index="5">
          </div>

          <button type="submit" class="btn btn-primary btn-lg w-full">
            Verificar
          </button>
        </form>

        <div class="auth-footer">
          <p>Não recebeu o código? <a href="#" id="resend-code">Reenviar</a></p>
          <p style="margin-top: 0.5rem;"><a href="#" data-navigate="login">← Voltar ao login</a></p>
        </div>
      </div>
    </div>
  `;
}

function bindVerifyEvents(app: any, email: string) {
  const inputs = document.querySelectorAll('.code-input') as NodeListOf<HTMLInputElement>;
  
  // Auto-focus next input
  inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      if (value && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        inputs[index - 1].focus();
      }
    });

    // Paste support
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const paste = e.clipboardData?.getData('text') || '';
      const chars = paste.replace(/\D/g, '').split('').slice(0, 6);
      chars.forEach((char, i) => {
        if (inputs[i]) inputs[i].value = char;
      });
      if (chars.length > 0) inputs[Math.min(chars.length, 5)].focus();
    });
  });

  // Form submit
  document.getElementById('verify-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = Array.from(inputs).map(i => i.value).join('');
    
    if (code.length !== 6) {
      showError('Digite o código completo');
      return;
    }

    const btn = document.querySelector('#verify-form button[type="submit"]') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>';

    const { data, error } = await api.request('/auth/verify-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });

    btn.disabled = false;
    btn.innerHTML = 'Verificar';

    if (error) {
      showError(error);
      return;
    }

    showSuccess('E-mail verificado! Redirecionando...');
    setTimeout(() => app.navigate('login'), 1500);
  });

  // Resend code
  document.getElementById('resend-code')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const { error } = await api.request('/auth/resend-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    if (error) {
      showError(error);
    } else {
      showSuccess('Código reenviado!');
    }
  });
}

function showError(message: string) {
  const el = document.getElementById('auth-error');
  const success = document.getElementById('auth-success');
  if (el) {
    el.textContent = message;
    el.classList.remove('hidden');
  }
  if (success) success.classList.add('hidden');
}

function showSuccess(message: string) {
  const el = document.getElementById('auth-success');
  const error = document.getElementById('auth-error');
  if (el) {
    el.textContent = message;
    el.classList.remove('hidden');
  }
  if (error) error.classList.add('hidden');
}
