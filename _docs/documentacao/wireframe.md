# DOCUMENTAÇÃO OFICIAL – GAME ONLINE DE SINUCA (BROWSER 3D)

---

## 1. Visão Geral do Projeto
Plataforma web de **game online de sinuca**, executado diretamente no navegador, com modos **casual**, **aposta** e **assinatura**, ranking global, carteira virtual, sistema de créditos, IA de moderação e integração total com **Supabase**.

O projeto será desenvolvido em **Node.js + TypeScript**, com **backend e frontend unificados em um único projeto**, seguindo arquitetura modular e componentizada para facilitar manutenção, escalabilidade e desenvolvimento assistido por IA.

---

## 2. Princípios Arquiteturais

- **Projeto único (monorepo simples)**
- Backend e Frontend no mesmo repositório
- Um único comando para rodar tudo
- Arquitetura baseada em **módulos e componentes**
- Realtime e notificações utilizando **Supabase Realtime** (substitui WebSocket próprio)
- Edge Functions do Supabase para lógica crítica e eventos

---

## 3. Stack Tecnológica (FECHADA – NÃO MISTURAR)

### Linguagem
- Node.js 20+
- TypeScript (strict)

### Frontend (Game + UI)
- Phaser.js (engine do jogo)
- HTML5 + Canvas
- Tailwind CSS
- TypeScript

### Backend
- Node.js
- Fastify
- Supabase JS SDK

### Banco de Dados, Auth e Realtime
- **Supabase Auth (Email/Password)**
- **Verificação de e-mail obrigatória (email confirmation)**
- **Sistema de e-mails transacionais do Supabase**
- Supabase Postgres
- Supabase Realtime (subscriptions)
- Supabase Edge Functions

### Pagamentos
- Gerencianet
  - PIX
  - Cartão de Crédito

---

## 4. Estrutura Unificada do Projeto

```txt
project-root/
│
├── src/
│   ├── server/                 # Backend
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── wallet/
│   │   │   ├── credits/
│   │   │   ├── rooms/
│   │   │   ├── matches/
│   │   │   ├── bets/
│   │   │   ├── ranking/
│   │   │   ├── payments/
│   │   │   ├── moderation/
│   │   │   └── notifications/
│   │   ├── services/
│   │   ├── middlewares/
│   │   └── index.ts
│   │
│   ├── client/                 # Frontend
│   │   ├── components/
│   │   ├── scenes/
│   │   ├── systems/
│   │   ├── services/
│   │   ├── store/
│   │   └── main.ts
│   │
│   └── shared/                 # Tipos compartilhados
│       ├── types/
│       └── constants/
│
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── seed.sql
│
├── public/
│   └── index.html
│
├── package.json
├── tsconfig.json
└── README.md
```

---

## 5. Execução Unificada

### Comando Único
```bash
npm run start
```

### Scripts
```json
{
  "scripts": {
    "dev": "tsx watch src/server/index.ts",
    "build": "tsc",
    "start": "node dist/server/index.js"
  }
}
```

O backend serve o frontend compilado.

---

## 6. Sistema de Créditos

- Cada **R$ 2,00** comprados = **4 créditos**
- **1 crédito = 1 partida**
- Débito automático ao iniciar partida
- Compra livre via PIX ou Cartão
- Assinantes: créditos ilimitados

---

## 7. Sistema de Apostas (Custódia)

- Ambos os jogadores apostam o mesmo valor
- Valor total vai para **custódia do administrador**

### Exemplo
- Jogador A: R$ 50
- Jogador B: R$ 50
- Total: R$ 100

### Liquidação
- 90% para o vencedor
- 10% para a plataforma
- Crédito automático na carteira

---

## 8. Regras de Salas

- Apenas 1 sala ativa por usuário
- Apenas 1 convidado por vez
- Sala encerrada após a partida

---

## 9. Modos de Jogo

- Casual (crédito)
- Aposta (dinheiro)
- Contra IA
- Multiplayer online

---

## 10. Ranking, Estatísticas e Perfis de Usuário

### Perfil do Usuário (Jogador)
Cada usuário possui uma área completa de perfil contendo:
- Dados pessoais básicos
- Avatar
- Estatísticas gerais:
  - Total de partidas
  - Vitórias
  - Derrotas
  - Taxa de vitória
  - Créditos utilizados
  - Valor ganho/perdido em apostas
- Histórico completo:
  - Partidas disputadas
  - Resultados
  - Apostas realizadas
  - Premiações recebidas
- Posição no ranking:
  - Global
  - Mensal

Todas essas informações são persistidas no banco de dados.

---


## 11. Módulo de Administração (ADMIN COMPLETO)

### Visão Geral
O sistema possui um **Painel de Administração completo**, com acesso total a todas as áreas do game e do sistema. O administrador tem **controle absoluto** sobre dados, usuários, finanças, partidas e configurações.

---

### Funcionalidades do Painel Admin

#### Gestão de Usuários
- Listar usuários
- Visualizar perfil completo de qualquer usuário
- Visualizar histórico completo do usuário
- Aplicar punições:
  - Aviso
  - Mute
  - Suspensão
  - Banimento
- Desbloquear usuários
- Resetar senha (via Supabase Auth)

#### Gestão de Partidas e Salas
- Visualizar todas as partidas
- Visualizar partidas em tempo real
- Acessar histórico completo de partidas
- Encerrar partidas manualmente
- Analisar partidas suspeitas

#### Gestão Financeira
- Visualizar receitas totais
- Histórico de vendas de créditos
- Histórico de assinaturas
- Histórico de apostas
- Comissão da plataforma (10%)
- Saldo de custódia
- Relatórios por período (dia, mês, ano)

#### Gestão de Carteiras
- Visualizar carteira de qualquer usuário
- Ajustar saldo (crédito/débito administrativo)
- Bloquear carteira
- Autorizar ou negar saques

#### Ranking e Premiações
- Visualizar ranking global e mensal
- Configurar regras de pontuação
- Definir e distribuir premiações
- Ajustar pontuação manualmente

#### Configurações do Sistema
- Valores de créditos (ex: R$2 = 4 créditos)
- Taxa administrativa (default 10%)
- Valores mínimos de aposta
- Ativação/desativação de modos de jogo
- Configurações de assinatura

#### Logs e Auditoria
- Logs de login
- Logs de ações administrativas
- Logs financeiros
- Logs de punições
- Logs de e-mails enviados

---

### Acesso e Segurança
- Área Admin separada
- Controle via RLS (admin role)
- Todas as ações administrativas são auditadas

---


## 12. Realtime, Arquivos e Notificações

### Realtime
- Utilizar **Supabase Realtime** para sincronização em tempo real
- Subscriptions para:
  - Estado da partida
  - Pontuação
  - Chat
  - Ranking
  - Convites

### Armazenamento de Arquivos (REGRA IMPORTANTE)
- O **Supabase NÃO armazenará arquivos binários**
- O banco armazenará **apenas**:
  - Caminho do arquivo
  - Nome do arquivo
  - URL pública ou privada
  - Metadados (tipo, tamanho, data)

### Storage Física
- Arquivos armazenados **diretamente no servidor** (storage local)
- Exemplos de arquivos:
  - Avatares
  - Imagens de compartilhamento
  - Assets temporários
  - Logs visuais de partidas

### Benefícios da Estratégia
- Redução de custos
- Controle total dos arquivos
- Performance previsível
- Facilidade de backup

---


## 13. Compartilhamento Social

- Geração automática de imagem pós-partida
- Texto + link embutidos
- Compartilhamento direto

---

## 14. IA de Monitoramento

### Funções
- Moderação de chat
- Detecção de comportamento abusivo
- Detecção de trapaça

### Penalidades
1. Aviso
2. Mute
3. Suspensão
4. Banimento

---

## 15. Arquivo de Regras de Tecnologia (OBRIGATÓRIO)

### REGRAS
1. NÃO adicionar novas linguagens
2. NÃO misturar frameworks
3. NÃO usar WebSocket próprio
4. Usar APENAS Supabase Realtime
5. Backend APENAS Node + Fastify
6. Frontend APENAS Phaser + TS
7. Banco APENAS Supabase
8. Pagamentos APENAS Gerencianet

Quebra de regra = refatoração obrigatória

---


## 15. Sequência Ideal de Implementação (OBRIGATÓRIA)

Para garantir desenvolvimento organizado, seguro e compatível com automação por IA, a sequência abaixo **deve ser seguida exatamente nesta ordem**:

### Etapa 1 – Schema SQL do Supabase
Criar o schema completo do banco de dados, incluindo no mínimo:
- `users`
- `wallet`
- `credits`
- `matches`
- `rooms`
- `bets`
- `rankings`
- `punishments`
- `emails_logs`

Incluindo:
- Chaves primárias e estrangeiras
- Índices
- Triggers (créditos, apostas, ranking)

---

### Etapa 2 – Políticas RLS (Row Level Security)
Definir políticas de segurança para:
- Leitura e escrita de dados por usuário
- Proteção de apostas e carteira
- Acesso administrativo separado
- Bloqueio automático de usuários punidos

Nenhuma tabela sensível pode existir sem RLS.

---

### Etapa 3 – Mapa de Eventos Supabase Realtime
Definir canais, eventos e payloads:
- Estado da partida
- Jogadas
- Chat
- Convites
- Atualização de ranking
- Liquidação de apostas

Realtime será feito **exclusivamente via Supabase Realtime**.

---

### Etapa 4 – Prompt Mestre para IA
Criar um prompt único e completo para IA:
- Gerar estrutura do projeto
- Criar backend e frontend
- Implementar regras de negócio
- Respeitar TODAS as regras técnicas
- Não misturar tecnologias

Esse prompt será a base para desenvolvimento assistido por IA.

---

## 16. Status do Documento

Documento **FINAL, FECHADO E PRONTO** para:
- Início imediato do desenvolvimento
- Execução por desenvolvedores humanos ou IA
- Evolução futura do produto
- Monetização real

Qualquer alteração fora deste documento deve gerar **nova versão oficial**.

---

FIM DA DOCUMENTAÇÃO
