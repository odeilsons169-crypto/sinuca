import { api } from '../services/api';

export function ForgotPasswordPage(app: any): string {
  setTimeout(() => bindForgotEvents(app), 100);

  return `
    <div class="auth-container">
      <div class="auth-card animate-fadeIn">
        <div class="auth-header">
          <div class="auth-logo">🎱</div>
          <h1 class="auth-title">Recuperar Senha</h1>
          <p class="auth-subtitle">Digite seu e-mail para receber o link de recuperação</p>
        </div>

        <form id="forgot-form" class="auth-form">
          <div id="auth-error" class="auth-error hidden"></div>
          <div id="auth-success" class="auth-success hidden"></div>

          <div class="form-group">
            <label for="email">E-mail</label>
            <input type="email" id="email" placeholder="seu@email.com" required>
          </div>

          <button type="submit" class="btn btn-primary btn-lg w-full">
            Enviar Link
          </button>
        </form>

        <div class="auth-footer">
          <p>Lembrou a senha? <a href="#" data-navigate="login">Fazer login</a></p>
        </div>
      </div>
    </div>
  `;
}

export function ResetPasswordPage(app: any, token: string): string {
  setTimeout(() => bindResetEvents(app, token), 100);

  return `
    <div class="auth-container">
      <div class="auth-card animate-fadeIn">
        <div class="auth-header">
          <div class="auth-logo">🎱</div>
          <h1 class="auth-title">Nova Senha</h1>
          <p class="auth-subtitle">Digite sua nova senha</p>
        </div>

        <form id="reset-form" class="auth-form">
          <div id="auth-error" class="auth-error hidden"></div>
          <div id="auth-success" class="auth-success hidden"></div>

          <div class="form-group">
            <label for="password">Nova Senha</label>
            <input type="password" id="password" placeholder="••••••••" required minlength="6">
          </div>

          <div class="form-group">
            <label for="confirm-password">Confirmar Senha</label>
            <input type="password" id="confirm-password" placeholder="••••••••" required minlength="6">
          </div>

          <button type="submit" class="btn btn-primary btn-lg w-full">
            Alterar Senha
          </button>
        </form>
      </div>
    </div>
  `;
}

function bindForgotEvents(app: any) {
  document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (document.getElementById('email') as HTMLInputElement)?.value;

    if (!email) {
      showError('Digite seu e-mail');
      return;
    }

    const btn = document.querySelector('#forgot-form button[type="submit"]') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>';

    const { error } = await api.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    btn.disabled = false;
    btn.innerHTML = 'Enviar Link';

    if (error) {
      showError(error);
      return;
    }

    showSuccess('Link enviado! Verifique seu e-mail.');
  });
}

function bindResetEvents(app: any, token: string) {
  document.getElementById('reset-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = (document.getElementById('password') as HTMLInputElement)?.value;
    const confirmPassword = (document.getElementById('confirm-password') as HTMLInputElement)?.value;

    if (!password || !confirmPassword) {
      showError('Preencha todos os campos');
      return;
    }

    if (password !== confirmPassword) {
      showError('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      showError('Senha deve ter no mínimo 6 caracteres');
      return;
    }

    const btn = document.querySelector('#reset-form button[type="submit"]') as HTMLButtonElement;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;"></div>';

    const { error } = await api.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });

    btn.disabled = false;
    btn.innerHTML = 'Alterar Senha';

    if (error) {
      showError(error);
      return;
    }

    showSuccess('Senha alterada! Redirecionando...');
    setTimeout(() => app.navigate('login'), 1500);
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
