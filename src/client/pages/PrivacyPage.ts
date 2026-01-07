// =====================================================
// POLÍTICA DE PRIVACIDADE - Sinuca Online
// =====================================================

export function PrivacyPage(): string {
  return `
    <div class="legal-page">
      <header class="legal-header">
        <a href="#" data-navigate="landing" class="legal-back">← Voltar</a>
        <div class="landing-logo">🎱 Sinuca Online</div>
      </header>
      
      <main class="legal-content">
        <h1>Política de Privacidade</h1>
        <p class="legal-updated">Última atualização: 31 de dezembro de 2024</p>
        
        <section class="legal-section">
          <h2>1. Introdução</h2>
          <p>O Sinuca Online está comprometido com a proteção da sua privacidade. Esta política descreve como coletamos, usamos e protegemos suas informações pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).</p>
        </section>

        <section class="legal-section">
          <h2>2. Dados que Coletamos</h2>
          
          <h3>2.1 Dados de Cadastro</h3>
          <ul>
            <li><strong>Nome completo:</strong> Para identificação na plataforma</li>
            <li><strong>Email:</strong> Para login e comunicações</li>
            <li><strong>Senha:</strong> Armazenada de forma criptografada</li>
            <li><strong>CPF:</strong> Obrigatório para processamento de pagamentos (exigência da API de pagamentos)</li>
          </ul>

          <h3>2.2 Dados de Pagamento</h3>
          <ul>
            <li><strong>CPF:</strong> Necessário para emissão de cobranças Pix</li>
            <li><strong>Dados do cartão:</strong> Processados diretamente pela Gerencianet (não armazenamos)</li>
            <li><strong>Histórico de transações:</strong> Para controle financeiro e suporte</li>
          </ul>

          <h3>2.3 Dados de Uso</h3>
          <ul>
            <li>Histórico de partidas</li>
            <li>Estatísticas de jogo</li>
            <li>Posição no ranking</li>
            <li>Endereço IP (para segurança)</li>
            <li>Dados de navegação (cookies)</li>
          </ul>
        </section>

        <section class="legal-section">
          <h2>3. Finalidade do Tratamento</h2>
          <p>Utilizamos seus dados para:</p>
          <ul>
            <li><strong>Prestação do serviço:</strong> Permitir que você jogue e utilize a plataforma</li>
            <li><strong>Processamento de pagamentos:</strong> Realizar cobranças e saques</li>
            <li><strong>Comunicação:</strong> Enviar notificações sobre sua conta e partidas</li>
            <li><strong>Segurança:</strong> Prevenir fraudes e proteger sua conta</li>
            <li><strong>Melhoria do serviço:</strong> Analisar uso para aprimorar a experiência</li>
            <li><strong>Obrigações legais:</strong> Cumprir exigências regulatórias</li>
          </ul>
        </section>

        <section class="legal-section">
          <h2>4. Base Legal (LGPD)</h2>
          <p>O tratamento dos seus dados é realizado com base em:</p>
          <ul>
            <li><strong>Execução de contrato:</strong> Para prestação dos serviços contratados</li>
            <li><strong>Consentimento:</strong> Para comunicações de marketing (opcional)</li>
            <li><strong>Obrigação legal:</strong> Para cumprimento de exigências fiscais e regulatórias</li>
            <li><strong>Legítimo interesse:</strong> Para segurança e prevenção de fraudes</li>
          </ul>
        </section>

        <section class="legal-section">
          <h2>5. Compartilhamento de Dados</h2>
          <p>Seus dados podem ser compartilhados com:</p>
          <ul>
            <li><strong>Gerencianet (Efí):</strong> Processador de pagamentos (Pix e Cartão)</li>
            <li><strong>Supabase:</strong> Provedor de infraestrutura de banco de dados</li>
            <li><strong>Autoridades:</strong> Quando exigido por lei ou ordem judicial</li>
          </ul>
          <p><strong>Não vendemos</strong> seus dados pessoais para terceiros.</p>
        </section>

        <section class="legal-section">
          <h2>6. Segurança dos Dados</h2>
          <p>Implementamos medidas de segurança para proteger seus dados:</p>
          <ul>
            <li>Criptografia de dados em trânsito (HTTPS/TLS)</li>
            <li>Senhas armazenadas com hash seguro (bcrypt)</li>
            <li>Acesso restrito a dados sensíveis</li>
            <li>Monitoramento de atividades suspeitas</li>
            <li>Backups regulares</li>
          </ul>
        </section>

        <section class="legal-section">
          <h2>7. Seus Direitos (LGPD)</h2>
          <p>Você tem direito a:</p>
          <ul>
            <li><strong>Acesso:</strong> Solicitar cópia dos seus dados pessoais</li>
            <li><strong>Correção:</strong> Corrigir dados incompletos ou incorretos</li>
            <li><strong>Exclusão:</strong> Solicitar a exclusão dos seus dados</li>
            <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado</li>
            <li><strong>Revogação:</strong> Retirar consentimento a qualquer momento</li>
            <li><strong>Informação:</strong> Saber com quem seus dados são compartilhados</li>
          </ul>
          <p>Para exercer seus direitos, entre em contato pelo email: privacidade@sinucaonline.com.br</p>
        </section>

        <section class="legal-section">
          <h2>8. Cookies</h2>
          <p>Utilizamos cookies para:</p>
          <ul>
            <li><strong>Essenciais:</strong> Manter sua sessão logada</li>
            <li><strong>Funcionais:</strong> Lembrar suas preferências</li>
            <li><strong>Analíticos:</strong> Entender como você usa a plataforma</li>
          </ul>
          <p>Você pode configurar seu navegador para recusar cookies, mas isso pode afetar a funcionalidade do site.</p>
        </section>

        <section class="legal-section">
          <h2>9. Retenção de Dados</h2>
          <p>Mantemos seus dados pelo tempo necessário para:</p>
          <ul>
            <li>Prestação dos serviços: Enquanto sua conta estiver ativa</li>
            <li>Obrigações legais: Conforme exigido por lei (ex: 5 anos para dados fiscais)</li>
            <li>Defesa em processos: Pelo prazo prescricional aplicável</li>
          </ul>
          <p>Após exclusão da conta, dados são anonimizados ou excluídos em até 30 dias, exceto quando houver obrigação legal de retenção.</p>
        </section>

        <section class="legal-section">
          <h2>10. Menores de Idade</h2>
          <p>Nossos serviços são destinados a maiores de 18 anos. Não coletamos intencionalmente dados de menores. Se identificarmos uma conta de menor, ela será encerrada.</p>
        </section>

        <section class="legal-section">
          <h2>11. Transferência Internacional</h2>
          <p>Seus dados podem ser processados em servidores localizados fora do Brasil (Supabase). Garantimos que esses provedores seguem padrões adequados de proteção de dados.</p>
        </section>

        <section class="legal-section">
          <h2>12. Alterações nesta Política</h2>
          <p>Podemos atualizar esta política periodicamente. Alterações significativas serão comunicadas por email ou notificação na plataforma.</p>
        </section>

        <section class="legal-section">
          <h2>13. Contato do Encarregado (DPO)</h2>
          <p>Para questões relacionadas à privacidade e proteção de dados:</p>
          <p>Email: privacidade@sinucaonline.com.br</p>
        </section>
      </main>

      <footer class="legal-footer">
        <p>© 2024 Sinuca Online. Todos os direitos reservados.</p>
      </footer>
    </div>
  `;
}
