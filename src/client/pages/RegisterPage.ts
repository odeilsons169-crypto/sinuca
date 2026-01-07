export function RegisterPage(app: any): string {
  return `
    <div class="auth-container">
      <div class="auth-card animate-fadeIn">
        <div class="auth-logo">🎱</div>
        <h1 class="auth-title">Criar Conta</h1>
        <p class="auth-subtitle">Junte-se à comunidade de jogadores</p>
        
        <form id="register-form" class="auth-form">
          <div class="input-group">
            <label>Nome Completo *</label>
            <input 
              type="text" 
              id="fullname" 
              class="input" 
              placeholder="Seu nome completo"
              autocomplete="name"
              required
            >
          </div>

          <div class="input-group">
            <label>CPF *</label>
            <input 
              type="text" 
              id="cpf" 
              class="input" 
              placeholder="000.000.000-00"
              maxlength="14"
              autocomplete="off"
              required
            >
            <small class="input-hint">Necessário para pagamentos e segurança</small>
          </div>

          <div class="input-group">
            <label>Telefone (WhatsApp) *</label>
            <input 
              type="tel" 
              id="phone" 
              class="input" 
              placeholder="(00) 00000-0000"
              maxlength="15"
              autocomplete="tel"
              required
            >
          </div>

          <div class="location-section">
            <h3 class="section-title">📍 Localização</h3>
            
            <div class="input-group">
              <label>País *</label>
              <select id="country" class="input select-input" required>
                <option value="">Selecione seu país</option>
              </select>
            </div>

            <div class="input-row">
              <div class="input-group flex-1">
                <label>Estado *</label>
                <select id="state" class="input select-input" required disabled>
                  <option value="">Selecione o estado</option>
                </select>
              </div>

              <div class="input-group flex-1">
                <label>Cidade *</label>
                <input 
                  type="text" 
                  id="city" 
                  class="input" 
                  placeholder="Sua cidade"
                  required
                  disabled
                >
              </div>
            </div>
          </div>
          
          <div class="input-group">
            <label>Nome de usuário *</label>
            <input 
              type="text" 
              id="username" 
              class="input" 
              placeholder="Seu apelido no jogo"
              autocomplete="username"
              required
            >
            <small class="input-hint">Este será seu nome visível no jogo</small>
          </div>
          
          <div class="input-group">
            <label>Email *</label>
            <input 
              type="email" 
              id="email" 
              class="input" 
              placeholder="seu@email.com"
              autocomplete="email"
              required
            >
          </div>
          
          <div class="input-group">
            <label>Senha *</label>
            <input 
              type="password" 
              id="password" 
              class="input" 
              placeholder="Mínimo 6 caracteres"
              autocomplete="new-password"
              required
            >
          </div>

          <div class="input-group">
            <label>Confirmar Senha *</label>
            <input 
              type="password" 
              id="password-confirm" 
              class="input" 
              placeholder="Digite a senha novamente"
              autocomplete="new-password"
              required
            >
          </div>

          <div class="terms-checkbox">
            <label class="checkbox-label-inline">
              <input type="checkbox" id="terms-accept" required>
              <span>Li e aceito os <a href="#" data-navigate="terms">Termos de Uso</a> e <a href="#" data-navigate="privacy">Política de Privacidade</a></span>
            </label>
          </div>

          <div class="input-group referral-input-group">
            <label>Código de Indicação (opcional)</label>
            <input 
              type="text" 
              id="referral-code" 
              class="input" 
              placeholder="Ex: ABC12345"
              maxlength="10"
              style="text-transform: uppercase;"
            >
            <small class="input-hint" id="referral-hint">Tem um amigo que joga? Use o código dele!</small>
          </div>
          
          <p id="auth-error" class="auth-error hidden"></p>
          
          <button type="submit" class="btn btn-primary w-full btn-lg">
            Criar Conta
          </button>
        </form>

        <div class="security-notice">
          <div class="security-icon">🔒</div>
          <div class="security-text">
            <strong>Ambiente 100% Seguro</strong>
            <p>Seus dados são protegidos com criptografia. Solicitamos localização para:</p>
            <ul>
              <li>✅ Garantir que você joga com pessoas reais</li>
              <li>✅ Exibir sua bandeira no ranking e perfil</li>
              <li>✅ Evitar fraudes e contas fake</li>
              <li>✅ Pagamentos seguros via PIX</li>
            </ul>
          </div>
        </div>
        
        <p class="auth-link">
          Já tem conta? <a href="#" data-navigate="login">Fazer login</a>
        </p>
      </div>
    </div>
  `;
}

export async function bindRegisterEvents(app: any) {
  // Verificar código de indicação na URL
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');
  
  if (refCode) {
    const refInput = document.getElementById('referral-code') as HTMLInputElement;
    const refHint = document.getElementById('referral-hint');
    
    if (refInput) {
      refInput.value = refCode.toUpperCase();
      
      // Validar código
      try {
        const response = await fetch(`/api/referrals/validate/${refCode}`);
        const data = await response.json();
        
        if (data.valid && refHint) {
          refHint.innerHTML = `✅ Indicado por <strong>${data.referrer.username}</strong>`;
          refHint.style.color = 'var(--accent-green)';
        }
      } catch (err) {
        console.error('Erro ao validar código:', err);
      }
    }
  }

  // Carregar países
  await loadCountries();

  // Máscara CPF
  const cpfInput = document.getElementById('cpf') as HTMLInputElement;
  cpfInput?.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    input.value = formatCpf(input.value);
  });

  // Máscara Telefone
  const phoneInput = document.getElementById('phone') as HTMLInputElement;
  phoneInput?.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    input.value = formatPhone(input.value);
  });

  // Evento de mudança de país
  const countrySelect = document.getElementById('country') as HTMLSelectElement;
  countrySelect?.addEventListener('change', async (e) => {
    const select = e.target as HTMLSelectElement;
    const countryCode = select.value;
    const stateSelect = document.getElementById('state') as HTMLSelectElement;
    const cityInput = document.getElementById('city') as HTMLInputElement;

    if (countryCode) {
      await loadStates(countryCode);
      stateSelect.disabled = false;
      cityInput.disabled = false;
    } else {
      stateSelect.innerHTML = '<option value="">Selecione o estado</option>';
      stateSelect.disabled = true;
      cityInput.value = '';
      cityInput.disabled = true;
    }
  });

  // Submit do formulário
  const form = document.getElementById('register-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fullname = (document.getElementById('fullname') as HTMLInputElement).value.trim();
    const cpf = (document.getElementById('cpf') as HTMLInputElement).value.trim();
    const phone = (document.getElementById('phone') as HTMLInputElement).value.trim();
    const countrySelect = document.getElementById('country') as HTMLSelectElement;
    const stateSelect = document.getElementById('state') as HTMLSelectElement;
    const city = (document.getElementById('city') as HTMLInputElement).value.trim();
    const username = (document.getElementById('username') as HTMLInputElement).value.trim();
    const email = (document.getElementById('email') as HTMLInputElement).value.trim();
    const password = (document.getElementById('password') as HTMLInputElement).value;
    const passwordConfirm = (document.getElementById('password-confirm') as HTMLInputElement).value;
    const termsAccepted = (document.getElementById('terms-accept') as HTMLInputElement).checked;
    
    const errorEl = document.getElementById('auth-error');
    
    // Validações
    if (!fullname || fullname.split(' ').length < 2) {
      showError(errorEl, 'Digite seu nome completo (nome e sobrenome)');
      return;
    }

    if (!validateCpf(cpf)) {
      showError(errorEl, 'CPF inválido. Verifique e tente novamente.');
      return;
    }

    if (!validatePhone(phone)) {
      showError(errorEl, 'Telefone inválido. Use o formato (00) 00000-0000');
      return;
    }

    if (!countrySelect.value) {
      showError(errorEl, 'Selecione seu país');
      return;
    }

    if (!stateSelect.value) {
      showError(errorEl, 'Selecione seu estado');
      return;
    }

    if (!city || city.length < 2) {
      showError(errorEl, 'Digite sua cidade');
      return;
    }

    if (username.length < 3) {
      showError(errorEl, 'Nome de usuário deve ter no mínimo 3 caracteres');
      return;
    }

    if (password.length < 6) {
      showError(errorEl, 'Senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (password !== passwordConfirm) {
      showError(errorEl, 'As senhas não coincidem');
      return;
    }

    if (!termsAccepted) {
      showError(errorEl, 'Você precisa aceitar os termos de uso');
      return;
    }

    // Pegar dados de localização
    const countryCode = countrySelect.value;
    const countryName = countrySelect.options[countrySelect.selectedIndex].text.replace(/^[^\s]+\s/, ''); // Remove emoji
    const stateCode = stateSelect.value;
    const stateName = stateSelect.options[stateSelect.selectedIndex].text;

    // Pegar código de indicação (se houver)
    const referralCode = (document.getElementById('referral-code') as HTMLInputElement)?.value.trim().toUpperCase() || undefined;

    // Desabilitar botão
    const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Criando conta...';

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullname,
          cpf: cpf.replace(/\D/g, ''),
          phone: phone.replace(/\D/g, ''),
          country_code: countryCode,
          country_name: countryName,
          state_code: stateCode,
          state_name: stateName,
          city,
          username,
          email,
          password,
          referral_code: referralCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showError(errorEl, data.error || 'Erro ao criar conta');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Criar Conta';
        return;
      }

      // Sucesso - salvar token e redirecionar
      if (data.session?.access_token) {
        localStorage.setItem('access_token', data.session.access_token);
        localStorage.setItem('refresh_token', data.session.refresh_token);
      }

      // Redirecionar para lobby
      app.navigate('lobby');
    } catch (err) {
      showError(errorEl, 'Erro de conexão. Tente novamente.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Criar Conta';
    }
  });
}

async function loadCountries() {
  try {
    const response = await fetch('/api/location/countries');
    const data = await response.json();
    
    const select = document.getElementById('country') as HTMLSelectElement;
    if (!select) return;

    select.innerHTML = '<option value="">Selecione seu país</option>';
    
    data.countries?.forEach((country: any) => {
      const option = document.createElement('option');
      option.value = country.code;
      option.textContent = `${country.flag_emoji} ${country.name_pt}`;
      option.dataset.flag = country.flag_emoji;
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Erro ao carregar países:', err);
  }
}

async function loadStates(countryCode: string) {
  try {
    const response = await fetch(`/api/location/states/${countryCode}`);
    const data = await response.json();
    
    const select = document.getElementById('state') as HTMLSelectElement;
    if (!select) return;

    select.innerHTML = '<option value="">Selecione o estado</option>';
    
    data.states?.forEach((state: any) => {
      const option = document.createElement('option');
      option.value = state.code;
      option.textContent = state.name;
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Erro ao carregar estados:', err);
  }
}

function showError(el: HTMLElement | null, message: string) {
  if (el) {
    el.textContent = message;
    el.classList.remove('hidden');
  }
}

function formatCpf(value: string): string {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
}

function formatPhone(value: string): string {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{4})\d+?$/, '$1');
}

function validateCpf(cpf: string): boolean {
  const cleanCpf = cpf.replace(/\D/g, '');
  if (cleanCpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleanCpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf[10])) return false;
  
  return true;
}

function validatePhone(phone: string): boolean {
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length === 10 || cleanPhone.length === 11;
}
