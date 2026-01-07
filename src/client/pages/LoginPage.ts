export function LoginPage(app: any): string {
  return `
    <div class="auth-container">
      <div class="auth-card animate-fadeIn">
        <div class="auth-logo">🎱</div>
        <h1 class="auth-title">Sinuca Online</h1>
        <p class="auth-subtitle">Entre para jogar e competir</p>
        
        <form id="login-form" class="auth-form">
          <div class="input-group">
            <label>Email</label>
            <input 
              type="email" 
              id="email" 
              class="input" 
              placeholder="seu@email.com"
              autocomplete="email"
            >
          </div>
          
          <div class="input-group">
            <label>Senha</label>
            <input 
              type="password" 
              id="password" 
              class="input" 
              placeholder="••••••••"
              autocomplete="current-password"
            >
          </div>
          
          <p id="auth-error" class="auth-error hidden"></p>
          
          <button type="submit" class="btn btn-primary w-full btn-lg">
            Entrar
          </button>
        </form>
        
        <p class="auth-link" style="margin-top: 1rem;">
          <a href="#" data-navigate="forgot-password">Esqueci minha senha</a>
        </p>
        
        <p class="auth-link">
          Não tem conta? <a href="#" data-navigate="register">Criar conta grátis</a>
        </p>

        <div class="login-security-badge">
          <span class="icon">🔒</span>
          <span>Ambiente seguro • Dados criptografados</span>
        </div>
      </div>
    </div>
  `;
}
