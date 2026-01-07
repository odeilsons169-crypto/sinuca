// =====================================================
// TERMOS DE USO - Sinuca Online
// =====================================================

export function TermsPage(): string {
  return `
    <div class="legal-page">
      <header class="legal-header">
        <a href="#" data-navigate="landing" class="legal-back">← Voltar</a>
        <div class="landing-logo">🎱 Sinuca Online</div>
      </header>
      
      <main class="legal-content">
        <h1>Termos de Uso</h1>
        <p class="legal-updated">Última atualização: 31 de dezembro de 2024</p>
        
        <section class="legal-section">
          <h2>1. Aceitação dos Termos</h2>
          <p>Ao acessar e utilizar a plataforma Sinuca Online, você concorda com estes Termos de Uso. Se você não concordar com qualquer parte destes termos, não utilize nossos serviços.</p>
        </section>

        <section class="legal-section">
          <h2>2. Descrição do Serviço</h2>
          <p>O Sinuca Online é uma plataforma de jogos de sinuca online que oferece:</p>
          <ul>
            <li>Partidas de sinuca em tempo real contra outros jogadores ou CPU</li>
            <li>Sistema de ranking competitivo</li>
            <li>Sistema de créditos para participação em partidas</li>
            <li>Torneios e competições</li>
          </ul>
        </section>

        <section class="legal-section">
          <h2>3. Cadastro e Conta</h2>
          <p>Para utilizar nossos serviços, você deve:</p>
          <ul>
            <li>Ter pelo menos 18 anos de idade</li>
            <li>Fornecer informações verdadeiras e completas no cadastro</li>
            <li>Manter a confidencialidade de sua senha</li>
            <li>Ser responsável por todas as atividades em sua conta</li>
          </ul>
          <p>Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos.</p>
        </section>

        <section class="legal-section">
          <h2>4. Sistema de Créditos</h2>
          <p>O funcionamento do sistema de créditos:</p>
          <ul>
            <li><strong>Valor:</strong> 1 crédito = R$ 0,50</li>
            <li><strong>Compra mínima:</strong> 4 créditos (R$ 2,00)</li>
            <li><strong>Crédito diário:</strong> Todo usuário recebe 1 crédito grátis por dia</li>
            <li><strong>Uso:</strong> 1 crédito é consumido ao iniciar uma partida</li>
            <li><strong>Validade:</strong> Créditos comprados não expiram</li>
          </ul>
        </section>

        <section class="legal-section">
          <h2>5. Planos VIP</h2>
          <p>Os planos VIP oferecem créditos ilimitados:</p>
          <ul>
            <li><strong>VIP Mensal:</strong> R$ 19,99/mês</li>
            <li><strong>VIP Anual:</strong> R$ 199,90/ano (economia de 17%)</li>
          </ul>
          <p>A assinatura é renovada automaticamente. Você pode cancelar a qualquer momento.</p>
        </section>

        <section class="legal-section highlight">
          <h2>6. Política de Saques (IMPORTANTE)</h2>
          <p>O sistema de carteira possui <strong>segregação de saldos</strong> para garantir a integridade da plataforma:</p>
          
          <div class="legal-box warning">
            <h4>⚠️ Saldo de Depósito (BLOQUEADO para saque)</h4>
            <p>Valores depositados via Pix ou Cartão são destinados exclusivamente para jogar. Este saldo <strong>NÃO pode ser sacado</strong> diretamente.</p>
          </div>
          
          <div class="legal-box success">
            <h4>✅ Saldo de Ganhos (LIBERADO para saque)</h4>
            <p>Valores provenientes de vitórias em partidas, apostas ganhas ou bônus concedidos pela plataforma podem ser sacados.</p>
          </div>
          
          <p><strong>Motivo:</strong> Esta política existe para prevenir o uso da plataforma para lavagem de dinheiro ou fraudes. O saque é exclusivo para ganhos obtidos através do jogo.</p>
          
          <p><strong>Exemplo:</strong> Se você depositar R$ 50,00 e ganhar R$ 30,00 em partidas, você poderá sacar apenas os R$ 30,00 de ganhos. Os R$ 50,00 de depósito devem ser utilizados em partidas.</p>
        </section>

        <section class="legal-section">
          <h2>7. Pagamentos e Reembolsos</h2>
          <ul>
            <li>Pagamentos são processados via Gerencianet (Efí)</li>
            <li>Métodos aceitos: Pix e Cartão de Crédito</li>
            <li>Créditos são adicionados instantaneamente após confirmação do pagamento</li>
            <li>Não há reembolso de créditos já utilizados</li>
            <li>Assinaturas VIP podem ser canceladas, mas não há reembolso proporcional</li>
          </ul>
        </section>

        <section class="legal-section">
          <h2>8. Conduta do Usuário</h2>
          <p>É proibido:</p>
          <ul>
            <li>Usar programas de trapaça ou automação</li>
            <li>Criar múltiplas contas</li>
            <li>Compartilhar conta com terceiros</li>
            <li>Usar linguagem ofensiva ou assediar outros jogadores</li>
            <li>Tentar explorar bugs ou vulnerabilidades do sistema</li>
            <li>Realizar conluio com outros jogadores para manipular resultados</li>
          </ul>
          <p>Violações podem resultar em suspensão ou banimento permanente.</p>
        </section>

        <section class="legal-section">
          <h2>9. Propriedade Intelectual</h2>
          <p>Todo o conteúdo da plataforma, incluindo código, design, gráficos e marcas, é propriedade do Sinuca Online e protegido por leis de direitos autorais.</p>
        </section>

        <section class="legal-section">
          <h2>10. Limitação de Responsabilidade</h2>
          <p>O Sinuca Online não se responsabiliza por:</p>
          <ul>
            <li>Perdas decorrentes de uso indevido da plataforma</li>
            <li>Interrupções temporárias do serviço</li>
            <li>Ações de terceiros que violem estes termos</li>
            <li>Problemas de conexão do usuário</li>
          </ul>
        </section>

        <section class="legal-section">
          <h2>11. Modificações</h2>
          <p>Reservamo-nos o direito de modificar estes termos a qualquer momento. Alterações significativas serão comunicadas por email ou notificação na plataforma.</p>
        </section>

        <section class="legal-section">
          <h2>12. Contato</h2>
          <p>Para dúvidas sobre estes termos, entre em contato:</p>
          <p>Email: suporte@sinucaonline.com.br</p>
        </section>

        <section class="legal-section">
          <h2>13. Foro</h2>
          <p>Estes termos são regidos pelas leis brasileiras. Qualquer disputa será resolvida no foro da comarca de São Paulo/SP.</p>
        </section>
      </main>

      <footer class="legal-footer">
        <p>© 2024 Sinuca Online. Todos os direitos reservados.</p>
      </footer>
    </div>
  `;
}
