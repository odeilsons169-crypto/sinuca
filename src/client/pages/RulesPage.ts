// =====================================================
// REGRAS DO JOGO - Sinuca Online
// =====================================================

export function RulesPage(): string {
  return `
    <div class="legal-page rules-page">
      <header class="legal-header">
        <a href="#" data-navigate="landing" class="legal-back">← Voltar</a>
        <div class="landing-logo">🎱 Sinuca Online</div>
      </header>
      
      <main class="legal-content">
        <h1>📖 Regras do Jogo</h1>
        <p class="legal-updated">Guia completo dos modos de jogo</p>
        
        <!-- Modo 9 Bolas -->
        <section class="legal-section rules-mode">
          <div class="rules-mode-header">
            <span class="rules-mode-icon">🔴🔵</span>
            <h2>Modo A: 9 Bolas (4x4)</h2>
          </div>
          
          <div class="rules-box">
            <h3>⚙️ Configuração</h3>
            <ul>
              <li><strong>4 Bolas Vermelhas</strong> + <strong>4 Bolas Azuis</strong> + <strong>Bola Branca</strong> (tacadeira)</li>
              <li>Total: 9 bolas na mesa</li>
            </ul>
          </div>

          <div class="rules-box">
            <h3>🎯 Definição de Cor</h3>
            <p>A cor é atribuída <strong>no início da partida</strong>:</p>
            <ul>
              <li><strong>Jogador 1 (Dono da sala):</strong> Bolas Vermelhas 🔴</li>
              <li><strong>Jogador 2 (Convidado):</strong> Bolas Azuis 🔵</li>
            </ul>
          </div>

          <div class="rules-box">
            <h3>🏆 Objetivo</h3>
            <p>Encaçapar todas as <strong>4 bolas da sua cor</strong> antes do adversário.</p>
          </div>

          <div class="rules-box success">
            <h3>✅ Vitória</h3>
            <p>O primeiro jogador a encaçapar todas as 4 bolas da sua cor vence a partida.</p>
          </div>
        </section>

        <!-- Modo 15 Bolas -->
        <!-- Modo 8 Bolas -->
        <section class="legal-section rules-mode">
          <div class="rules-mode-header">
            <span class="rules-mode-icon">🎱</span>
            <h2>Modo B: 8 Bolas (Lisas vs Listradas)</h2>
          </div>
          
          <div class="rules-box">
            <h3>⚙️ Configuração</h3>
            <ul>
              <li><strong>Bolas 1-7:</strong> Lisas (Cores Sólidas)</li>
              <li><strong>Bola 8:</strong> Preta (Decisiva)</li>
              <li><strong>Bolas 9-15:</strong> Listradas</li>
            </ul>
          </div>

          <div class="rules-box highlight">
            <h3>🎯 Objetivo</h3>
            <p>Seu grupo é definido na <strong>PRIMEIRA bola encaçapada</strong>:</p>
            <ul>
              <li>Se encaçapar uma LISA, você joga com as <strong>LISAS</strong>.</li>
              <li>Se encaçapar uma LISTRADA, você joga com as <strong>LISTRADAS</strong>.</li>
              <li>Encaçape todas as 7 bolas do seu grupo.</li>
              <li><strong>Por fim, a Bola 8 para vencer.</strong></li>
            </ul>
          </div>

          <div class="rules-box warning">
            <h3>⚠️ Regras da Bola 8</h3>
            <ul>
              <li>Encaçapar a 8 antes de limpar seu grupo = <strong>DERROTA</strong></li>
              <li>Encaçapar a 8 cometendo falta (ex: cair branca) = <strong>DERROTA</strong></li>
            </ul>
          </div>

          <div class="rules-box success">
            <h3>✅ Vitória</h3>
            <p>Vence quem encaçapar legalmente a Bola 8 após limpar seu grupo.</p>
          </div>
        </section>

        <!-- Regras Gerais -->
        <section class="legal-section">
          <h2>📋 Regras Gerais de Turno</h2>
          
          <div class="rules-grid">
            <div class="rules-box success">
              <h3>✅ Acerto (Sucesso)</h3>
              <p>Se você encaçapar uma bola <strong>válida</strong> (da sua cor/tipo):</p>
              <ul>
                <li>A bola é removida da mesa</li>
                <li>Você <strong>continua jogando</strong></li>
              </ul>
            </div>

            <div class="rules-box warning">
              <h3>❌ Erro (Falha)</h3>
              <p>Se você <strong>não encaçapar</strong> nenhuma bola ou encaçapar a bola branca:</p>
              <ul>
                <li>A vez <strong>passa para o adversário</strong></li>
              </ul>
            </div>
          </div>

          <div class="rules-box">
            <h3>⏱️ Timer</h3>
            <p>Cada jogador tem <strong>30 segundos</strong> para realizar sua tacada.</p>
            <p>Se o tempo esgotar, a vez passa automaticamente para o adversário.</p>
          </div>
        </section>

        <!-- Regra de Penalidade -->
        <!-- Regras de Falta e Penalidade -->
        <section class="legal-section">
          <h2>⚠️ Regras de Falta e Penalidades</h2>
          
          <div class="rules-box danger">
            <h3>🚫 O que é Falta?</h3>
            <ul>
              <li>Não acertar nenhuma bola.</li>
              <li>Acertar primeiro a bola do adversário (ou a 8, se não for a vez dela).</li>
              <li>Encaçapar a bola branca.</li>
            </ul>
          </div>

          <div class="rules-grid">
            <div class="rules-box">
              <h3>Modo 9 Bolas (Regra Brasileira)</h3>
              <p><strong>Penalidade:</strong> Você perde a vez e o adversário ganha 1 bola "encaçapada" (bonificação).</p>
            </div>
            
            <div class="rules-box">
              <h3>Modo 8 Bolas (Regra Padrão)</h3>
              <p><strong>Ball in Hand:</strong> O adversário pode pegar a bola branca e colocar <strong>onde quiser na mesa</strong> para sua próxima tacada.</p>
            </div>
          </div>
        </section>

        <!-- Sistema de Créditos -->
        <section class="legal-section">
          <h2>💰 Sistema de Créditos</h2>
          
          <div class="rules-box">
            <h3>Como funciona?</h3>
            <ul>
              <li><strong>1 crédito = R$ 0,50</strong></li>
              <li><strong>1 crédito</strong> é consumido ao iniciar uma partida</li>
              <li>Você recebe <strong>1 crédito grátis por dia</strong></li>
              <li>Compra mínima: <strong>4 créditos (R$ 2,00)</strong></li>
            </ul>
          </div>

          <div class="rules-box">
            <h3>Plano VIP</h3>
            <p>Assinantes VIP têm <strong>créditos ilimitados</strong> e não precisam se preocupar com saldo.</p>
          </div>
        </section>

        <!-- Ranking -->
        <section class="legal-section">
          <h2>🏆 Sistema de Ranking</h2>
          
          <div class="rules-box">
            <h3>Pontuação</h3>
            <ul>
              <li><strong>Vitória:</strong> +10 pontos</li>
              <li><strong>Derrota:</strong> -3 pontos</li>
              <li><strong>Vitória em aposta:</strong> +15 pontos</li>
            </ul>
          </div>

          <div class="rules-box">
            <h3>Rankings</h3>
            <ul>
              <li><strong>Ranking Global:</strong> Pontuação acumulada de todas as partidas</li>
              <li><strong>Ranking Mensal:</strong> Resetado todo dia 1º do mês</li>
            </ul>
          </div>
        </section>

        <!-- Dicas -->
        <section class="legal-section">
          <h2>💡 Dicas para Iniciantes</h2>
          
          <div class="tips-grid">
            <div class="tip-card">
              <span class="tip-icon">🎯</span>
              <h4>Mire com calma</h4>
              <p>Use os 30 segundos para planejar sua tacada. Pressa leva a erros.</p>
            </div>
            <div class="tip-card">
              <span class="tip-icon">🔄</span>
              <h4>Pense no próximo</h4>
              <p>Não basta encaçapar - posicione a bola branca para a próxima tacada.</p>
            </div>
            <div class="tip-card">
              <span class="tip-icon">🛡️</span>
              <h4>Jogue defensivo</h4>
              <p>Se não tiver tacada boa, dificulte a vida do adversário.</p>
            </div>
            <div class="tip-card">
              <span class="tip-icon">⚡</span>
              <h4>Controle a força</h4>
              <p>Tacadas muito fortes podem fazer a bola pular da caçapa.</p>
            </div>
          </div>
        </section>

        <div class="rules-cta">
          <button class="btn btn-primary btn-xl" data-navigate="register">
            🎱 Começar a Jogar
          </button>
        </div>
      </main>

      <footer class="legal-footer">
        <p>© 2024 Sinuca Online. Todos os direitos reservados.</p>
      </footer>
    </div>
  `;
}
