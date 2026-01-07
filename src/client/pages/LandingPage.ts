// =====================================================
// LANDING PAGE - Sinuca Online
// Página inicial completa e organizada
// =====================================================

export function LandingPage(app: any): string {
  return `
    <div class="landing">
      <!-- Header Fixo -->
      <header class="landing-header">
        <div class="container">
          <div class="landing-header-inner">
            <div class="landing-logo" data-navigate="landing">🎱 Sinuca Online</div>
            <nav class="landing-nav">
              <a href="#games" class="nav-link">Jogos</a>
              <a href="#how-it-works" class="nav-link">Como Funciona</a>
              <a href="#pricing" class="nav-link">Preços</a>
              <a href="#features" class="nav-link">Recursos</a>
              <a href="#" data-navigate="rules" class="nav-link">Regras</a>
            </nav>
            <div class="landing-header-actions">
              <button class="btn btn-ghost" data-navigate="login">Entrar</button>
              <button class="btn btn-primary" data-navigate="register">Criar Conta</button>
            </div>
          </div>
        </div>
      </header>

      <!-- Hero Section -->
      <section class="hero">
        <div class="container">
          <div class="hero-content">
            <div class="hero-badge">🎮 A Melhor Plataforma de Sinuca Online</div>
            <h1 class="hero-title">
              Jogue Sinuca Online<br>
              <span class="gradient-text">com Amigos</span>
            </h1>
            <p class="hero-subtitle">
              Física realista, multiplayer em tempo real, ranking competitivo e muito mais. 
              Crie sua conta grátis e ganhe 1 crédito por dia!
            </p>
            <div class="hero-cta">
              <button class="btn btn-primary btn-lg" data-navigate="register">
                🚀 Começar Agora - É Grátis!
              </button>
              <button class="btn btn-secondary btn-lg" data-navigate="game-detail" data-game="sinuca">
                🎱 Ver Detalhes do Jogo
              </button>
            </div>
            <div class="hero-stats">
              <div class="hero-stat">
                <span class="hero-stat-value">10.000+</span>
                <span class="hero-stat-label">Jogadores</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-value">50.000+</span>
                <span class="hero-stat-label">Partidas</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-value">4.8⭐</span>
                <span class="hero-stat-label">Avaliação</span>
              </div>
            </div>
          </div>
          <div class="hero-image">
            <div class="preview-table">🎱</div>
          </div>
        </div>
      </section>

      <!-- Seção: Jogos Disponíveis -->
      <section id="games" class="section games-section">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title-lg">Nossos <span class="gradient-text">Jogos</span></h2>
            <p class="section-desc">Escolha seu jogo favorito e comece a jogar agora</p>
          </div>
          
          <div class="games-carousel">
            <button class="carousel-btn prev" id="games-prev">‹</button>
            
            <div class="games-track" id="games-track">
              <!-- Sinuca - Ativo -->
              <div class="game-card active" data-navigate="game-detail" data-game="sinuca">
                <div class="game-card-cover green">
                  <span class="game-card-icon">🎱</span>
                </div>
                <div class="game-card-body">
                  <span class="game-card-genre">Esportes</span>
                  <h3 class="game-card-title">Sinuca Online</h3>
                  <p class="game-card-subtitle">8-Ball Pool</p>
                  <div class="game-card-meta">
                    <span>⭐ 4.8</span>
                    <span>👥 10.000+</span>
                  </div>
                  <button class="btn btn-primary w-full">JOGAR AGORA</button>
                </div>
              </div>

              <!-- Tênis de Mesa - Em Breve -->
              <div class="game-card coming-soon">
                <div class="game-card-cover red">
                  <span class="game-card-icon">🏓</span>
                  <div class="game-card-overlay"><span>EM BREVE</span></div>
                </div>
                <div class="game-card-body">
                  <span class="game-card-genre">Esportes</span>
                  <h3 class="game-card-title">Tênis de Mesa</h3>
                  <p class="game-card-subtitle">Ping Pong</p>
                  <div class="game-card-coming-badge">🔜 Em Breve</div>
                </div>
              </div>

              <!-- Banco Imobiliário - Em Breve -->
              <div class="game-card coming-soon">
                <div class="game-card-cover yellow">
                  <span class="game-card-icon">🏠</span>
                  <div class="game-card-overlay"><span>EM BREVE</span></div>
                </div>
                <div class="game-card-body">
                  <span class="game-card-genre">Tabuleiro</span>
                  <h3 class="game-card-title">Banco Imobiliário</h3>
                  <p class="game-card-subtitle">Monopoly Online</p>
                  <div class="game-card-coming-badge">🔜 Em Breve</div>
                </div>
              </div>

              <!-- Dominó - Em Breve -->
              <div class="game-card coming-soon">
                <div class="game-card-cover purple">
                  <span class="game-card-icon">🀄</span>
                  <div class="game-card-overlay"><span>EM BREVE</span></div>
                </div>
                <div class="game-card-body">
                  <span class="game-card-genre">Tabuleiro</span>
                  <h3 class="game-card-title">Dominó</h3>
                  <p class="game-card-subtitle">Classic Domino</p>
                  <div class="game-card-coming-badge">🔜 Em Breve</div>
                </div>
              </div>

              <!-- Truco - Em Breve -->
              <div class="game-card coming-soon">
                <div class="game-card-cover blue">
                  <span class="game-card-icon">🃏</span>
                  <div class="game-card-overlay"><span>EM BREVE</span></div>
                </div>
                <div class="game-card-body">
                  <span class="game-card-genre">Cartas</span>
                  <h3 class="game-card-title">Truco</h3>
                  <p class="game-card-subtitle">Truco Paulista</p>
                  <div class="game-card-coming-badge">🔜 Em Breve</div>
                </div>
              </div>

              <!-- Damas - Em Breve -->
              <div class="game-card coming-soon">
                <div class="game-card-cover red">
                  <span class="game-card-icon">⚫</span>
                  <div class="game-card-overlay"><span>EM BREVE</span></div>
                </div>
                <div class="game-card-body">
                  <span class="game-card-genre">Tabuleiro</span>
                  <h3 class="game-card-title">Damas</h3>
                  <p class="game-card-subtitle">Checkers</p>
                  <div class="game-card-coming-badge">🔜 Em Breve</div>
                </div>
              </div>
            </div>
            
            <button class="carousel-btn next" id="games-next">›</button>
          </div>
        </div>
      </section>

      <!-- Seção: Torneios em Destaque -->
      <section id="tournaments" class="section tournaments-section" style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 4rem 0;">
        <div class="container">
          <div class="section-header" style="text-align: center; margin-bottom: 2rem;">
            <h2 class="section-title-lg">🏆 Torneios <span class="gradient-text">em Destaque</span></h2>
            <p class="section-desc">Participe dos maiores torneios de sinuca online e ganhe prêmios incríveis!</p>
          </div>
          
          <div class="tournaments-carousel" style="position: relative;">
            <button class="carousel-btn prev" id="tournaments-prev" style="left: -20px;">‹</button>
            
            <div class="tournaments-track-container" style="overflow: hidden; border-radius: 16px;">
              <div class="tournaments-track" id="tournaments-track" style="display: flex; gap: 1.5rem; transition: transform 0.5s ease; padding: 1rem 0;">
                <!-- Torneios carregados dinamicamente -->
                <div class="tournament-loading" style="width: 100%; text-align: center; padding: 3rem;">
                  <div class="spinner" style="margin: 0 auto 1rem;"></div>
                  <p style="color: var(--text-muted);">Carregando torneios...</p>
                </div>
              </div>
            </div>
            
            <button class="carousel-btn next" id="tournaments-next" style="right: -20px;">›</button>
          </div>
          
          <div class="section-cta" style="text-align: center; margin-top: 2rem;">
            <button class="btn btn-secondary btn-lg" data-navigate="register">
              🎮 Ver Todos os Torneios
            </button>
          </div>
        </div>
      </section>

      <!-- Seção: Rankings e Comunidade -->
      <section id="community" class="section community-section" style="background: linear-gradient(to bottom, #1a1a24 0%, #16213e 100%);">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title-lg">🏆 Comunidade <span class="gradient-text">Global</span></h2>
            <p class="section-desc">Os melhores jogadores e o que eles dizem sobre a plataforma</p>
          </div>

          <div class="community-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 3rem; margin-top: 3rem;">
            
            <!-- Coluna 1: Rankings -->
            <div class="ranking-column">
              <!-- Container: Ranking Global -->
              <div class="ranking-card" style="background: rgba(255, 255, 255, 0.03); border-radius: 20px; padding: 2rem; margin-bottom: 2rem; border: 1px solid rgba(255, 165, 2, 0.2); backdrop-filter: blur(10px);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                   <h3 class="ranking-title" style="margin: 0; color: var(--text-primary); display: flex; align-items: center; gap: 0.75rem; font-size: 1.4rem;">
                      <span>🌍</span> Ranking Global
                   </h3>
                   <span style="font-size: 0.8rem; color: var(--accent-green); background: rgba(0, 255, 136, 0.1); padding: 0.25rem 0.75rem; border-radius: 20px;">Top Players</span>
                </div>
                
                <ul class="ranking-list" style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 1rem;">
                  <li style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 10px;">
                     <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="font-size: 1.5rem;">👑</span>
                        <div>
                           <div style="font-weight: 700; color: gold;">MestreDaSinuca</div>
                           <div style="font-size: 0.8rem; color: var(--text-muted);">Lendário</div>
                        </div>
                     </div>
                     <span style="font-weight: 700; color: var(--accent-green);">15.420 pts</span>
                  </li>
                  <li style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; background: rgba(0,0,0,0.1); border-radius: 10px;">
                     <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="font-size: 1.2rem; margin-left: 0.3rem;">🥈</span>
                        <div style="margin-left: 0.2rem;">
                           <div style="font-weight: 600; color: #e0e0e0;">JogadorPro_BR</div>
                           <div style="font-size: 0.8rem; color: var(--text-muted);">Diamante</div>
                        </div>
                     </div>
                     <span style="font-weight: 600; color: var(--accent-green);">12.100 pts</span>
                  </li>
                  <li style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; background: rgba(0,0,0,0.1); border-radius: 10px;">
                     <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="font-size: 1.2rem; margin-left: 0.3rem;">🥉</span>
                        <div style="margin-left: 0.2rem;">
                           <div style="font-weight: 600; color: #cd7f32;">Sniper8Ball</div>
                           <div style="font-size: 0.8rem; color: var(--text-muted);">Platina</div>
                        </div>
                     </div>
                     <span style="font-weight: 600; color: var(--accent-green);">10.500 pts</span>
                  </li>
                </ul>
              </div>

              <!-- Container: Top 10 da Semana -->
              <div class="ranking-card" style="background: rgba(255, 255, 255, 0.03); border-radius: 20px; padding: 2rem; border: 1px solid rgba(102, 126, 234, 0.2); backdrop-filter: blur(10px);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                   <h3 class="ranking-title" style="margin: 0; color: var(--text-primary); display: flex; align-items: center; gap: 0.75rem; font-size: 1.4rem;">
                      <span>🔥</span> Em Alta (Top 10)
                   </h3>
                   <span style="font-size: 0.8rem; color: #ff6b6b; background: rgba(255, 107, 107, 0.1); padding: 0.25rem 0.75rem; border-radius: 20px;">Semanal</span>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                   <!-- Mock List 1-5 -->
                   <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9rem;">
                      <li style="color: var(--text-secondary);">4. @PauloC</li>
                      <li style="color: var(--text-secondary);">5. @AnaJulia</li>
                      <li style="color: var(--text-secondary);">6. @RobertoK</li>
                      <li style="color: var(--text-secondary);">7. @Vini_Gamer</li>
                   </ul>
                   <!-- Mock List 6-10 -->
                   <ul style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9rem;">
                      <li style="color: var(--text-secondary);">8. @CarlaS</li>
                      <li style="color: var(--text-secondary);">9. @PedroH</li>
                      <li style="color: var(--text-secondary);">10. @LuizaM</li>
                      <li style="color: var(--text-muted); font-style: italic; font-size: 0.8rem; margin-top: 0.5rem;">...e mais 1.2k</li>
                   </ul>
                </div>
              </div>

              <!-- Container: Mestres da Sinuca (Ranking vs CPU) -->
              <div class="ranking-card ai-ranking-card" id="ai-ranking-card" style="background: rgba(255, 255, 255, 0.03); border-radius: 20px; padding: 2rem; margin-top: 2rem; border: 1px solid rgba(138, 43, 226, 0.3); backdrop-filter: blur(10px);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                   <h3 class="ranking-title" style="margin: 0; color: var(--text-primary); display: flex; align-items: center; gap: 0.75rem; font-size: 1.4rem;">
                      <span>🤖</span> Mestres da Sinuca
                   </h3>
                   <span style="font-size: 0.8rem; color: #9b59b6; background: rgba(155, 89, 182, 0.15); padding: 0.25rem 0.75rem; border-radius: 20px;">vs CPU</span>
                </div>
                
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">Os melhores jogadores contra a máquina</p>
                
                <ul class="ai-ranking-list" id="ai-ranking-list" style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.75rem;">
                  <li style="text-align: center; color: var(--text-muted); padding: 1rem;">
                    <div class="spinner" style="margin: 0 auto 0.5rem;"></div>
                    Carregando ranking...
                  </li>
                </ul>
              </div>
            </div>

            <!-- Coluna 2: Avaliações -->
            <div class="reviews-column">
               <h3 class="section-title" style="font-size: 1.8rem; margin-bottom: 2rem; color: var(--text-primary); text-align: left;">
                  <span>💬</span> Sistema de <span class="gradient-text">Avaliação</span>
               </h3>

               <div class="reviews-list" id="reviews-list-container" style="display: flex; flex-direction: column; gap: 1.5rem;">
                  <div class="live-rooms-loading">
                    <div class="spinner"></div>
                    <p>Carregando avaliações...</p>
                  </div>
               </div>
            </div>

          </div>
        </div>
      </section>

      <!-- Seção: Salas Ao Vivo -->
      <section id="live-rooms" class="section live-rooms-section">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title-lg">🔴 Salas <span class="gradient-text">Ao Vivo</span></h2>
            <p class="section-desc">Veja quem está jogando agora e entre na partida</p>
          </div>
          
          <div class="live-rooms-container" id="live-rooms-list">
            <div class="live-rooms-loading">
              <div class="spinner"></div>
              <p>Carregando salas...</p>
            </div>
          </div>
          
          <div class="section-cta">
            <button class="btn btn-primary btn-lg" data-navigate="register">
              🎮 Criar Conta e Jogar
            </button>
          </div>
        </div>
      </section>

      <!-- Seção: Como Funciona -->
      <section id="how-it-works" class="section how-section">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title-lg">Como <span class="gradient-text">Funciona</span></h2>
            <p class="section-desc">Comece a jogar em 3 passos simples</p>
          </div>
          
          <div class="steps-grid">
            <div class="step-card">
              <div class="step-number">1</div>
              <div class="step-icon">📝</div>
              <h3>Crie sua Conta</h3>
              <p>Cadastro rápido e gratuito. Você ganha 1 crédito grátis por dia automaticamente!</p>
            </div>
            <div class="step-card">
              <div class="step-number">2</div>
              <div class="step-icon">🎫</div>
              <h3>Compre Créditos</h3>
              <p>Cada partida custa 1 crédito. Compre pacotes via Pix ou Cartão de forma segura.</p>
            </div>
            <div class="step-card">
              <div class="step-number">3</div>
              <div class="step-icon">🎱</div>
              <h3>Jogue e Divirta-se</h3>
              <p>Entre em uma sala ou crie a sua. Desafie jogadores de todo o Brasil!</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Seção: Preços e Planos -->
      <section id="pricing" class="section pricing-section">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title-lg">Planos de <span class="gradient-text">Créditos</span></h2>
            <p class="section-desc">1 crédito = 1 partida • Compre e jogue na hora!</p>
          </div>
          
          <div class="credits-grid">
            <div class="credit-card" data-navigate="register">
              <div class="credit-amount">4 créditos</div>
              <div class="credit-price">R$ 2,00</div>
              <div class="credit-per">R$ 0,50/crédito</div>
              <button class="btn btn-secondary w-full">Comprar</button>
            </div>
            
            <div class="credit-card popular" data-navigate="register">
              <span class="credit-badge">⭐ Mais Popular</span>
              <div class="credit-amount">20 créditos</div>
              <div class="credit-price">R$ 10,00</div>
              <div class="credit-per">R$ 0,50/crédito</div>
              <button class="btn btn-primary w-full">Comprar</button>
            </div>
            
            <div class="credit-card" data-navigate="register">
              <div class="credit-amount">50 créditos</div>
              <div class="credit-price">R$ 25,00</div>
              <div class="credit-per">R$ 0,50/crédito</div>
              <button class="btn btn-secondary w-full">Comprar</button>
            </div>
            
            <div class="credit-card" data-navigate="register">
              <div class="credit-amount">100 créditos</div>
              <div class="credit-price">R$ 50,00</div>
              <div class="credit-per">R$ 0,50/crédito</div>
              <button class="btn btn-secondary w-full">Comprar</button>
            </div>
          </div>

          <!-- Plano VIP -->
          <div class="vip-banner">
            <div class="vip-icon">👑</div>
            <div class="vip-info">
              <h3>Plano VIP - Créditos Ilimitados</h3>
              <p>Jogue quantas partidas quiser por apenas <strong>R$ 19,99/mês</strong></p>
            </div>
            <button class="btn btn-primary btn-lg" data-navigate="register">
              Assinar VIP
            </button>
          </div>
        </div>
      </section>

      <!-- Seção: Recursos -->
      <section id="features" class="section features-section">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title-lg">Por que <span class="gradient-text">nos escolher</span>?</h2>
            <p class="section-desc">Recursos que fazem a diferença</p>
          </div>
          
          <div class="features-grid">
            <div class="feature-card">
              <div class="feature-icon">🎯</div>
              <h3 class="feature-title">Física Realista</h3>
              <p class="feature-desc">Motor de física avançado que simula tacadas reais de sinuca profissional</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon">⚡</div>
              <h3 class="feature-title">Multiplayer Instantâneo</h3>
              <p class="feature-desc">Encontre oponentes em segundos. Jogue com amigos ou desconhecidos</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon">🏆</div>
              <h3 class="feature-title">Ranking Competitivo</h3>
              <p class="feature-desc">Suba no ranking mensal e ganhe prêmios. Prove que você é o melhor!</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon">🔒</div>
              <h3 class="feature-title">100% Seguro</h3>
              <p class="feature-desc">Pagamentos via Pix e Cartão com criptografia. Seus dados protegidos</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon">📱</div>
              <h3 class="feature-title">Multiplataforma</h3>
              <p class="feature-desc">Jogue no celular, tablet ou computador. Onde você estiver!</p>
            </div>
            <div class="feature-card">
              <div class="feature-icon">🤖</div>
              <h3 class="feature-title">Modo Treino</h3>
              <p class="feature-desc">Pratique contra a CPU antes de enfrentar jogadores reais</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Seção: Modos de Jogo -->
      <section class="section rules-section">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title-lg">Modos de <span class="gradient-text">Jogo</span></h2>
            <p class="section-desc">Dois modos clássicos de sinuca para você escolher</p>
          </div>
          
          <div class="rules-grid">
            <div class="rule-card">
              <div class="rule-icon">🔴🔵</div>
              <h3>9 Bolas (4x4)</h3>
              <p>4 bolas vermelhas vs 4 bolas azuis</p>
              <ul class="rule-list">
                <li>✓ Sua cor é definida no início</li>
                <li>✓ Encaçape todas as 4 bolas da sua cor</li>
                <li>✓ Partidas mais rápidas</li>
              </ul>
            </div>
            <div class="rule-card">
              <div class="rule-icon">🎱</div>
              <h3>15 Bolas (Par/Ímpar)</h3>
              <p>Bolas numeradas de 1 a 15</p>
              <ul class="rule-list">
                <li>✓ Tipo definido na primeira encaçapada</li>
                <li>✓ Encaçape todas as 7 bolas do seu tipo</li>
                <li>✓ Modo clássico tradicional</li>
              </ul>
            </div>
          </div>
          
          <div class="section-cta">
            <button class="btn btn-secondary btn-lg" data-navigate="rules">
              📖 Ver Regras Completas
            </button>
          </div>
        </div>
      </section>

      <!-- Seção: Depoimentos -->
      <section class="section testimonials-section">
        <div class="container">
          <div class="section-header">
            <h2 class="section-title-lg">O que nossos <span class="gradient-text">jogadores</span> dizem</h2>
          </div>
          
          <div class="testimonials-grid">
            <div class="testimonial-card">
              <div class="testimonial-stars">⭐⭐⭐⭐⭐</div>
              <p class="testimonial-text">"Melhor jogo de sinuca online que já joguei! A física é muito realista e encontro partidas rapidinho."</p>
              <div class="testimonial-author">
                <div class="testimonial-avatar">M</div>
                <div>
                  <strong>Marcos Silva</strong>
                  <span>São Paulo, SP</span>
                </div>
              </div>
            </div>
            <div class="testimonial-card">
              <div class="testimonial-stars">⭐⭐⭐⭐⭐</div>
              <p class="testimonial-text">"Jogo todo dia com meus amigos. O sistema de créditos é justo e o suporte é excelente!"</p>
              <div class="testimonial-author">
                <div class="testimonial-avatar">A</div>
                <div>
                  <strong>Ana Costa</strong>
                  <span>Rio de Janeiro, RJ</span>
                </div>
              </div>
            </div>
            <div class="testimonial-card">
              <div class="testimonial-stars">⭐⭐⭐⭐⭐</div>
              <p class="testimonial-text">"Assinei o VIP e não me arrependo. Jogo ilimitado por um preço muito bom. Recomendo!"</p>
              <div class="testimonial-author">
                <div class="testimonial-avatar">P</div>
                <div>
                  <strong>Pedro Santos</strong>
                  <span>Belo Horizonte, MG</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Seção: CTA Final -->
      <section class="section final-cta">
        <div class="container">
          <div class="cta-box">
            <h2>Pronto para <span class="gradient-text">jogar</span>?</h2>
            <p>Crie sua conta grátis agora e ganhe 1 crédito por dia!</p>
            <div class="cta-buttons">
              <button class="btn btn-primary btn-lg" data-navigate="register">
                🚀 Criar Conta Grátis
              </button>
              <button class="btn btn-secondary btn-lg" data-navigate="login">
                Já tenho conta
              </button>
            </div>
            <p class="cta-note">Sem cartão de crédito • Comece em segundos</p>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer class="landing-footer">
        <div class="container">
          <div class="footer-content">
            <div class="footer-brand">
              <div class="landing-logo">🎱 Sinuca Online</div>
              <p>A melhor plataforma de sinuca online do Brasil</p>
            </div>
            <div class="footer-links">
              <div class="footer-col">
                <h4>Jogos</h4>
                <a href="#" data-navigate="game-detail" data-game="sinuca">Sinuca</a>
                <a href="#">Tênis de Mesa</a>
                <a href="#">Banco Imobiliário</a>
                <a href="#">Dominó</a>
              </div>
              <div class="footer-col">
                <h4>Plataforma</h4>
                <a href="#how-it-works">Como Funciona</a>
                <a href="#pricing">Preços</a>
                <a href="#features">Recursos</a>
                <a href="#" data-navigate="rules">Regras</a>
              </div>
              <div class="footer-col">
                <h4>Suporte</h4>
                <a href="#">FAQ</a>
                <a href="#">Contato</a>
                <a href="#">Central de Ajuda</a>
              </div>
              <div class="footer-col">
                <h4>Legal</h4>
                <a href="#" data-navigate="terms">Termos de Uso</a>
                <a href="#" data-navigate="privacy">Privacidade</a>
                <a href="#" data-navigate="rules">Regras dos Jogos</a>
              </div>
            </div>
          </div>
          <div class="footer-bottom">
            <p>© 2024 Sinuca Online. Todos os direitos reservados.</p>
            <p>Feito com ❤️ no Brasil</p>
          </div>
        </div>
      </footer>
    </div>
  `;
}


// Função para carregar salas ao vivo
export async function loadLiveRooms(): Promise<void> {
  const container = document.getElementById('live-rooms-list');
  if (!container) return;

  // Garantir que o carrossel funcione
  initGamesCarousel();

  try {
    const response = await fetch('/api/lives');
    if (!response.ok) throw new Error('Erro ao buscar lives');

    const data = await response.json();

    if (data.streams && data.streams.length > 0) {
      container.innerHTML = `
        <div class="live-rooms-grid">
          ${data.streams.map((stream: any) => `
            <div class="live-room-card" style="position:relative; overflow:hidden;">
               <div class="live-room-header">
                  <span class="live-indicator">🔴 AO VIVO</span>
                  <span class="live-viewers">👁️ ${stream.viewers}</span>
               </div>
               <div class="live-room-body" style="padding: 1rem;">
                  <div class="live-player-info" style="display:flex; align-items:center; gap:0.8rem; margin-bottom:0.5rem;">
                     <div style="width:40px;height:40px;background:#333;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;">${stream.hostName.charAt(0)}</div>
                     <div>
                        <div style="font-weight:bold; color:#fff;">${stream.hostName}</div>
                        <div style="font-size:0.8rem; color:#aaa;">${stream.gameMode === '9ball' ? '9 Bolas' : '8 Bolas'}</div>
                     </div>
                  </div>
                  <div style="font-size:0.9rem; color:#ccc; margin-bottom:1rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${stream.title}</div>
                  
                  <button class="btn btn-primary btn-sm w-full" 
                    onclick="(window as any).app.navigate('game', { 
                        roomId: '${stream.roomId}', 
                        isSpectator: true,
                        gameMode: '${stream.gameMode}',
                        owner: { username: '${stream.hostName}' },
                        guest: { username: 'Desafiante' }
                    })">
                    Assistir Agora
                  </button>
               </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      container.innerHTML = `
          <div class="live-rooms-empty">
            <div class="empty-icon">📺</div>
            <h3>Nenhuma transmissão ao vivo</h3>
            <p>Seja o primeiro a transmitir sua partida para o mundo!</p>
          </div>
        `;
    }
  } catch (err) {
    console.error('Erro lives:', err);
    container.innerHTML = `
      <div class="live-rooms-empty">
         <p>Não foi possível carregar as transmissões.</p>
      </div>
    `;
  }
}




// Função para inicializar o carrossel de jogos
function initGamesCarousel(): void {
  const track = document.getElementById('games-track');
  const prevBtn = document.getElementById('games-prev');
  const nextBtn = document.getElementById('games-next');

  if (!track || !prevBtn || !nextBtn) return;

  const scrollAmount = 300; // Largura do card + gap

  prevBtn.addEventListener('click', () => {
    track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  });

  nextBtn.addEventListener('click', () => {
    track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  });
}

export async function loadReviews() {
  const container = document.getElementById('reviews-list-container');
  if (!container) return;

  try {
    const response = await fetch('/api/reviews');
    if (!response.ok) throw new Error('Failed to fetch reviews');
    const data = await response.json();

    if (data.reviews && data.reviews.length > 0) {
      container.innerHTML = `
        ${data.reviews.map((r: any) => `
          <div class="review-card" style="background: var(--bg-card); padding: 1.5rem; border-radius: 16px; border-left: 5px solid var(--accent-green); box-shadow: 0 4px 20px rgba(0,0,0,0.2); animation: fadeIn 0.5s;">
             <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                   <div style="width: 40px; height: 40px; background: #333; border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                      ${r.userAvatar ? `<img src="${r.userAvatar}" style="width:100%;height:100%;object-fit:cover;">` : '👤'}
                   </div>
                   <div>
                      <div style="font-weight: 600; color: var(--text-primary);">${r.username || 'Anônimo'}</div>
                      <div style="font-size: 0.8rem; color: var(--text-muted);">${r.game === 'sinuca' ? 'Sinuca Online' : r.game}</div>
                   </div>
                </div>
                <div style="color: gold; letter-spacing: 2px;">${'⭐'.repeat(r.rating || 5)}</div>
             </div>
             <p style="color: var(--text-secondary); line-height: 1.5; font-style: italic;">"${r.comment}"</p>
          </div>
        `).join('')}
        
        <div class="rating-summary" style="background: linear-gradient(135deg, rgba(26,26,36,0.8), rgba(66,220,142,0.1)); padding: 1.5rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); text-align: center; margin-top: 1rem;">
           <div style="font-size: 3rem; font-weight: 800; color: var(--text-primary);">4.8<span style="font-size: 1.5rem; color: var(--text-muted);">/5</span></div>
           <div style="color: gold; letter-spacing: 4px; margin: 0.5rem 0;">⭐⭐⭐⭐⭐</div>
           <p style="color: var(--text-secondary);">Baseado em <strong>2.450+</strong> avaliações</p>
        </div>
      `;
    } else {
      container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Seja o primeiro a avaliar!</p>';
    }
  } catch (e) {
    container.innerHTML = '<p class="error" style="text-align: center; color: var(--text-muted);">Não foi possível carregar as avaliações.</p>';
  }
}

// Função para carregar torneios em destaque
export async function loadTournaments(): Promise<void> {
  const container = document.getElementById('tournaments-track');
  if (!container) return;

  try {
    const response = await fetch('/api/tournaments?status=open&limit=6');
    if (!response.ok) throw new Error('Failed to fetch tournaments');
    const data = await response.json();

    if (data.tournaments && data.tournaments.length > 0) {
      container.innerHTML = data.tournaments.map((t: any) => {
        // Calcular premiação dinâmica
        const participantCount = t.current_participants || t.participant_count || 0;
        const entryFee = Number(t.entry_fee || 0);
        const totalCollected = entryFee * participantCount;
        const prizePool = t.calculated_prize_pool || t.prize_pool || (totalCollected * 0.70);
        
        // Distribuição de prêmios
        const prize1st = prizePool * 0.60;
        const prize2nd = prizePool * 0.25;
        const prize3rd = prizePool * 0.10;
        
        return `
        <div class="tournament-card" style="min-width: 340px; background: linear-gradient(145deg, rgba(0,0,0,0.6), rgba(26,26,46,0.8)); border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,165,2,0.3); box-shadow: 0 10px 40px rgba(0,0,0,0.4);">
          <div class="tournament-banner" style="height: 100px; background: linear-gradient(135deg, ${t.is_vip_only ? '#ffd700' : '#00ff88'}40, ${t.is_vip_only ? '#ff6b00' : '#0099ff'}40); display: flex; align-items: center; justify-content: center; position: relative;">
            <span style="font-size: 3.5rem;">🏆</span>
            ${t.is_vip_only ? '<span style="position: absolute; top: 10px; right: 10px; background: gold; color: #000; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.7rem; font-weight: 700;">👑 VIP</span>' : ''}
            <div style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.7rem; color: #00ff88;">
              70% premiação • 30% plataforma
            </div>
          </div>
          <div class="tournament-body" style="padding: 1.25rem;">
            <h4 style="color: var(--text-primary); font-size: 1rem; margin-bottom: 0.5rem; font-weight: 700;">${t.name}</h4>
            
            <!-- Premiação Dinâmica -->
            <div style="background: linear-gradient(135deg, rgba(0,255,136,0.1), rgba(0,153,255,0.1)); border: 1px solid rgba(0,255,136,0.3); border-radius: 12px; padding: 0.75rem; margin-bottom: 0.75rem;">
              <div style="text-align: center; margin-bottom: 0.5rem;">
                <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">Premiação Total</div>
                <div style="font-size: 1.5rem; font-weight: 800; color: #00ff88; text-shadow: 0 0 10px rgba(0,255,136,0.5);">
                  R$ ${prizePool.toFixed(2)}
                </div>
                <div style="font-size: 0.6rem; color: var(--text-muted);">
                  ${participantCount > 0 ? `(${participantCount} inscritos × R$ ${entryFee.toFixed(0)} × 70%)` : 'Aumenta com cada inscrição!'}
                </div>
              </div>
              
              <!-- Distribuição -->
              <div style="display: flex; justify-content: space-around; font-size: 0.7rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.5rem;">
                <div style="text-align: center;">
                  <div style="color: gold;">🥇 1º</div>
                  <div style="color: var(--text-primary); font-weight: 600;">R$ ${prize1st.toFixed(0)}</div>
                </div>
                <div style="text-align: center;">
                  <div style="color: #c0c0c0;">🥈 2º</div>
                  <div style="color: var(--text-primary); font-weight: 600;">R$ ${prize2nd.toFixed(0)}</div>
                </div>
                <div style="text-align: center;">
                  <div style="color: #cd7f32;">🥉 3º</div>
                  <div style="color: var(--text-primary); font-weight: 600;">R$ ${prize3rd.toFixed(0)}</div>
                </div>
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.75rem;">
              <div style="background: rgba(0,0,0,0.3); padding: 0.4rem; border-radius: 8px; text-align: center;">
                <div style="font-size: 0.65rem; color: var(--text-muted);">INSCRIÇÃO</div>
                <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">${entryFee > 0 ? `R$ ${entryFee.toFixed(0)}` : 'GRÁTIS'}</div>
              </div>
              <div style="background: rgba(0,0,0,0.3); padding: 0.4rem; border-radius: 8px; text-align: center;">
                <div style="font-size: 0.65rem; color: var(--text-muted);">PARTICIPANTES</div>
                <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">👥 ${participantCount}/${t.max_participants || '∞'}</div>
              </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; font-size: 0.75rem; color: var(--text-muted);">
              <span>📅 ${new Date(t.start_date).toLocaleDateString('pt-BR')}</span>
              <span>🎱 ${t.game_mode === '15ball' ? '15 Bolas' : t.game_mode === '9ball' ? '9 Bolas' : t.game_mode}</span>
            </div>
            
            <button class="btn btn-primary w-full" data-navigate="register" style="background: linear-gradient(135deg, #00ff88, #00cc66); font-weight: 600; font-size: 0.9rem;">
              ⚡ INSCREVER-SE
            </button>
          </div>
        </div>
      `}).join('');

      // Inicializar carrossel de torneios
      initTournamentsCarousel();
    } else {
      container.innerHTML = `
        <div style="width: 100%; text-align: center; padding: 3rem; color: var(--text-muted);">
          <div style="font-size: 4rem; margin-bottom: 1rem;">🏆</div>
          <h4 style="color: var(--text-primary); margin-bottom: 0.5rem;">Nenhum torneio aberto no momento</h4>
          <p>Fique ligado! Novos torneios serão anunciados em breve.</p>
        </div>
      `;
    }
  } catch (e) {
    console.error('Erro ao carregar torneios:', e);
    container.innerHTML = `
      <div style="width: 100%; text-align: center; padding: 3rem; color: var(--text-muted);">
        <p>Não foi possível carregar os torneios.</p>
      </div>
    `;
  }
}

// Função para inicializar o carrossel de torneios
function initTournamentsCarousel(): void {
  const track = document.getElementById('tournaments-track');
  const prevBtn = document.getElementById('tournaments-prev');
  const nextBtn = document.getElementById('tournaments-next');

  if (!track || !prevBtn || !nextBtn) return;

  let position = 0;
  const cardWidth = 340;
  const cards = track.querySelectorAll('.tournament-card');
  const maxPosition = Math.max(0, (cards.length * cardWidth) - track.parentElement!.clientWidth);

  prevBtn.addEventListener('click', () => {
    position = Math.max(0, position - cardWidth);
    track.style.transform = `translateX(-${position}px)`;
  });

  nextBtn.addEventListener('click', () => {
    position = Math.min(maxPosition, position + cardWidth);
    track.style.transform = `translateX(-${position}px)`;
  });
}

// Função para carregar rankings reais
export async function loadRankings(): Promise<void> {
  const globalContainer = document.querySelector('.ranking-column .ranking-card:first-child .ranking-list');
  const weeklyContainer = document.querySelector('.ranking-column .ranking-card:last-child');

  if (!globalContainer) return;

  try {
    // Carregar ranking global (Top 3)
    const globalResponse = await fetch('/api/ranking?limit=5');
    if (!globalResponse.ok) throw new Error('Failed to fetch global rankings');
    const globalData = await globalResponse.json();

    if (globalData.rankings && globalData.rankings.length > 0) {
      const medals = ['👑', '🥈', '🥉'];
      const colors = ['gold', '#e0e0e0', '#cd7f32'];

      globalContainer.innerHTML = globalData.rankings.slice(0, 3).map((player: any, i: number) => `
        <li style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; background: rgba(0,0,0,${i === 0 ? '0.2' : '0.1'}); border-radius: 10px;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <span style="font-size: ${i === 0 ? '1.5rem' : '1.2rem'}; ${i > 0 ? 'margin-left: 0.3rem;' : ''}">${medals[i] || `#${i + 1}`}</span>
            <div ${i > 0 ? 'style="margin-left: 0.2rem;"' : ''}>
              <div style="font-weight: ${i === 0 ? '700' : '600'}; color: ${colors[i] || '#fff'};">${player.user?.username || 'Jogador'}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${getTier(player.points || 0)}</div>
            </div>
          </div>
          <span style="font-weight: ${i === 0 ? '700' : '600'}; color: var(--accent-green);">${(player.points || 0).toLocaleString('pt-BR')} pts</span>
        </li>
      `).join('');
    }

    // Carregar Top 10 semanal
    if (weeklyContainer) {
      try {
        const weeklyResponse = await fetch('/api/ranking/weekly/top10');
        if (weeklyResponse.ok) {
          const weeklyData = await weeklyResponse.json();
          const weeklyRankings = weeklyData.rankings || [];
          
          // Atualizar badge da semana
          const weekBadge = weeklyContainer.querySelector('span[style*="background: rgba(255, 107, 107"]');
          if (weekBadge && weeklyData.weekLabel) {
            weekBadge.textContent = weeklyData.weekLabel;
          }

          if (weeklyRankings.length > 0) {
            const weeklyList1 = weeklyContainer.querySelector('ul:first-of-type');
            const weeklyList2 = weeklyContainer.querySelector('ul:last-of-type');

            if (weeklyList1 && weeklyList2) {
              // Dividir em duas colunas
              const firstHalf = weeklyRankings.slice(0, 5);
              const secondHalf = weeklyRankings.slice(5, 10);

              weeklyList1.innerHTML = firstHalf.map((p: any) =>
                `<li style="color: var(--text-secondary); display: flex; justify-content: space-between;">
                  <span>${p.position}. @${p.user?.username || 'user'}</span>
                  <span style="color: var(--accent-green); font-size: 0.8rem;">${p.points} pts</span>
                </li>`
              ).join('');

              weeklyList2.innerHTML = secondHalf.map((p: any) =>
                `<li style="color: var(--text-secondary); display: flex; justify-content: space-between;">
                  <span>${p.position}. @${p.user?.username || 'user'}</span>
                  <span style="color: var(--accent-green); font-size: 0.8rem;">${p.points} pts</span>
                </li>`
              ).join('') + (weeklyRankings.length >= 10 ? '<li style="color: var(--text-muted); font-style: italic; font-size: 0.8rem; margin-top: 0.5rem;">Reseta toda segunda!</li>' : '');
            }
          } else {
            // Sem dados semanais ainda
            const weeklyList1 = weeklyContainer.querySelector('ul:first-of-type');
            const weeklyList2 = weeklyContainer.querySelector('ul:last-of-type');
            if (weeklyList1) weeklyList1.innerHTML = '<li style="color: var(--text-muted);">Nenhum jogador ainda</li>';
            if (weeklyList2) weeklyList2.innerHTML = '<li style="color: var(--text-muted); font-style: italic; font-size: 0.8rem;">Jogue para aparecer!</li>';
          }
        }
      } catch (weeklyErr) {
        console.error('Erro ao carregar ranking semanal:', weeklyErr);
      }
    }

    // Carregar Ranking vs CPU (Mestres da Sinuca)
    await loadAIRanking();
  } catch (e) {
    console.error('Erro ao carregar rankings:', e);
  }
}

// Função para carregar ranking vs CPU
async function loadAIRanking(): Promise<void> {
  const container = document.getElementById('ai-ranking-list');
  if (!container) return;

  try {
    const response = await fetch('/api/ai-ranking/top?limit=5');
    if (!response.ok) throw new Error('Erro ao buscar ranking AI');

    const data = await response.json();
    const ranking = data.ranking || [];

    if (ranking.length > 0) {
      container.innerHTML = ranking.map((player: any, index: number) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        const streakBadge = player.current_streak >= 3 
          ? `<span style="font-size: 0.7rem; color: #ff6b6b; margin-left: 0.5rem;">🔥${player.current_streak}</span>` 
          : '';
        
        return `
          <li style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.8rem; background: rgba(155, 89, 182, ${0.15 - index * 0.02}); border-radius: 10px; transition: transform 0.2s;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="font-size: ${index < 3 ? '1.2rem' : '0.9rem'}; min-width: 24px;">${medal}</span>
              <div>
                <div style="font-weight: 600; color: ${index === 0 ? '#f1c40f' : '#e0e0e0'}; font-size: 0.9rem;">
                  ${player.username}${streakBadge}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">
                  ${player.wins}V/${player.losses}D (${player.win_rate}%)
                </div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 700; color: #9b59b6; font-size: 0.95rem;">${player.points} pts</div>
              ${player.best_streak > 0 ? `<div style="font-size: 0.7rem; color: var(--text-muted);">Melhor: ${player.best_streak}🔥</div>` : ''}
            </div>
          </li>
        `;
      }).join('');
    } else {
      container.innerHTML = `
        <li style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🤖</div>
          <p>Nenhum jogador ainda</p>
          <p style="font-size: 0.8rem;">Seja o primeiro a dominar a CPU!</p>
        </li>
      `;
    }
  } catch (err) {
    console.error('Erro ao carregar ranking AI:', err);
    container.innerHTML = `
      <li style="text-align: center; color: var(--text-muted); padding: 1rem;">
        Erro ao carregar ranking
      </li>
    `;
  }
}

// Helper function to get player tier based on points
function getTier(points: number): string {
  if (points >= 15000) return 'Lendário';
  if (points >= 10000) return 'Diamante';
  if (points >= 5000) return 'Platina';
  if (points >= 2000) return 'Ouro';
  if (points >= 500) return 'Prata';
  return 'Bronze';
}
