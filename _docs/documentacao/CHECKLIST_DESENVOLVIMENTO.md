# CHECKLIST DE DESENVOLVIMENTO - SINUCA ONLINE

## 📋 Visão Geral do Sistema

### Descrição
Plataforma de sinuca online com sistema de créditos, apostas, ranking e modos multiplayer/CPU.

### Stack Tecnológico
- **Backend**: Node.js + TypeScript + Fastify
- **Frontend**: Vanilla HTML/CSS/TypeScript + Vite
- **Database**: Supabase (PostgreSQL + Auth + Realtime)
- **Game Engine**: Canvas 2D com física customizada → WebGL/Three.js (futuro)
- **Áudio**: Web Audio API

---

## 💰 REGRAS DE NEGÓCIO - SISTEMA DE CRÉDITOS

### Valores e Preços
| Item | Valor |
|------|-------|
| 1 Crédito (Ficha) | R$ 0,50 |
| Pacote Mínimo | 4 créditos = R$ 2,00 |
| Plano VIP Mensal | R$ 19,99 (créditos ilimitados) |
| Plano VIP Anual | R$ 199,90 (créditos ilimitados) |

### Regras de Crédito
- [x] **Crédito Grátis Diário**: Todo jogador recebe 1 crédito grátis por dia (renova à 00:00)
- [x] **Crédito Grátis**: Não debita da carteira (é cortesia da plataforma)
- [x] **Crédito Pago**: Ao usar, debita R$ 0,50 da carteira do jogador → credita na carteira do admin
- [x] **VIP**: Créditos ilimitados, não debita nada da carteira
- [x] **Compra Mínima**: 4 créditos por vez (R$ 2,00)

### Fluxo Financeiro
```
Jogador compra créditos → Debita da carteira do jogador
                        → Credita na carteira do Admin (receita)

Jogador usa crédito pago → Debita 1 crédito
                         → Debita R$ 0,50 da carteira
                         → Credita R$ 0,50 na carteira do Admin

Jogador usa crédito grátis → Debita 1 crédito apenas
                           → NÃO debita da carteira
```

---

## 🎮 REGRAS DO JOGO - MODOS DE PARTIDA

### Modo A: "9 Bolas" (4x4)
- **Configuração**: 4 Bolas Vermelhas + 4 Bolas Azuis + Bola Branca (tacadeira)
- **Definição de Cor**: Atribuída no início (Jogador A = Vermelho, Jogador B = Azul)
- **Objetivo**: Encaçapar as 4 bolas da sua cor antes do adversário
- **Vitória**: Primeiro a encaçapar todas as 4 bolas da sua cor

### Modo B: "15 Bolas" (Par ou Ímpar)
- **Configuração**: Bolas numeradas de 1 a 15 + Bola Branca (tacadeira)
- **Definição de Tipo**: Definido na PRIMEIRA bola encaçapada:
  - Se encaçapar bola PAR → Jogador fica com PARES, oponente fica com ÍMPARES
  - Se encaçapar bola ÍMPAR → Jogador fica com ÍMPARES, oponente fica com PARES
- **Objetivo**: Encaçapar todas as bolas do seu tipo
- **Vitória**: Primeiro a encaçapar todas as bolas do seu tipo (7 bolas)

### Regras Gerais de Turno
- [x] **Acerto (Sucesso)**: Encaçapou bola válida (sua cor/tipo) → Continua jogando
- [x] **Erro (Falha)**: Não encaçapou ou errou → Passa a vez para o oponente
- [x] **Timer**: 30 segundos por jogada (tempo esgotado = passa a vez)

### Regra de Penalidade ("A Cega" / Falta)
- **Aplicável**: Ambos os modos (4x4 e Par/Ímpar) + CPU
- **Falta**: Acertar ou encaçapar bola do ADVERSÁRIO
- **Penalidades**:
  1. Perde a vez imediatamente
  2. Uma bola do adversário é "encaçapada" automaticamente (bonificação)
  3. Vez passa para o oponente

---

## 🏠 TIPOS DE SALA

### Sala vs CPU (IA)
- **Localização**: Fixa no topo do Lobby (sempre visível)
- **Acesso**: Qualquer jogador logado
- **Custo**: 1 crédito por partida
- **Funcionamento**: Jogo local contra inteligência artificial

### Sala Online (Multiplayer)
- **Criação**: Por convite (privada por padrão)
- **Código**: Gerado automaticamente para salas privadas
- **Custo**: 1 crédito por jogador ao iniciar
- **Funcionamento**: Tempo real via WebSocket/Realtime

---

## 🐞 BUGS CRÍTICOS - PRIORIDADE ALTA

### Bug 1: Inicialização da Sala (Multiplayer)
- [x] **Problema**: Dono clica "Iniciar Jogo" → partida abre só para ele, convidado vê sala fechar
- [x] **Correção**: Implementado broadcast via Supabase Realtime para evento `GAME_STARTED`
- [ ] **Validação**: Testar com 2 jogadores reais

### Bug 2: Sincronização em Tempo Real
- [x] **Problema**: Jogador B não vê as jogadas do Jogador A em tempo real
- [x] **Correção**: Implementado via Supabase Realtime:
  - `SHOT_MADE` - Transmite tacadas
  - `BALLS_UPDATE` - Sincroniza posições das bolas
  - `TURN_CHANGE` - Troca de turno
  - `FOUL_COMMITTED` - Faltas
- [ ] **Validação**: Testar delay entre as telas

### Bug 3: Estado da Sala Dessincronizado
- [x] **Problema**: Estado do jogo diferente entre jogadores
- [x] **Correção**: Estado sincronizado via eventos realtime
  - Quais bolas foram encaçapadas
  - De quem é a vez
  - Pontuação atual
- [ ] **Validação**: Testar estado idêntico em ambas as telas

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Fase 0: Setup Inicial
- [x] Estrutura de pastas (monorepo)
- [x] package.json com scripts
- [x] tsconfig.json (strict mode)
- [x] Dependências base (fastify, typescript, tsx)
- [x] Arquivo .env.example
- [x] .gitignore configurado

### Fase 1: Database (Supabase)
- [x] Projeto Supabase criado
- [x] Variáveis de ambiente configuradas
- [x] Cliente Supabase (server + client)

#### Tabelas Principais
- [x] `users` (perfil, avatar, role, stats)
- [x] `wallet` (saldo, status, bloqueio)
- [x] `credits` (quantidade, is_unlimited, last_free_credit)
- [x] `rooms` (sala, status, mode, is_private, invite_code)
- [x] `matches` (partidas, estado, resultado)
- [x] `bets` (apostas, valor, custódia)
- [x] `rankings` (pontuação global/mensal)
- [x] `transactions` (movimentações financeiras)
- [x] `subscriptions` (assinaturas VIP)
- [x] `notifications` (notificações in-app)

#### Triggers e Functions
- [x] Trigger: débito de crédito ao iniciar partida
- [x] Trigger: atualização de ranking após partida
- [x] Trigger: liquidação de apostas
- [x] Trigger: geração de invite_code para salas privadas
- [x] Function: cálculo de comissão (10%)

### Fase 2: Backend - Módulos

#### Auth
- [x] Registro (email/password)
- [x] **Registro com CPF e Telefone obrigatórios** ✅ NOVO
- [x] **Validação de CPF (algoritmo brasileiro)** ✅ NOVO
- [x] **CPF único por conta (uma pessoa = uma conta)** ✅ NOVO
- [x] **Localização obrigatória (País, Estado, Cidade)** ✅ NOVO
- [x] **Bandeira do país no perfil e ranking** ✅ NOVO
- [x] Login
- [x] Verificação de e-mail
- [x] Recuperação de senha
- [x] Logout
- [x] Middleware de autenticação

#### Location (NOVO)
- [x] **API de países disponíveis** ✅ NOVO
- [x] **API de estados por país (BR, US)** ✅ NOVO
- [x] **Componente de bandeira com emoji** ✅ NOVO
- [x] **Exibição de localização no perfil** ✅ NOVO

#### Users
- [x] CRUD de perfil
- [x] Upload de avatar
- [x] Busca de usuários
- [x] Estatísticas

#### Wallet
- [x] Consulta de saldo
- [x] Histórico de transações
- [x] Depósito
- [x] Saque
- [x] Débito para compra de créditos
- [x] Crédito de receita para admin

#### Credits
- [x] Consulta de créditos
- [x] Crédito diário grátis
- [x] Compra de créditos (mín. 4)
- [x] Uso de crédito (com débito de R$ 0,50 se pago)
- [x] Verificação de créditos

#### Rooms
- [x] Criar sala (1 por usuário)
- [x] Listar salas públicas
- [x] Entrar em sala
- [x] Entrar por código (privada)
- [x] Sair de sala
- [x] Fechar sala

#### Matches
- [x] Criar partida
- [x] Iniciar partida
- [x] Atualizar estado
- [x] Finalizar partida
- [x] Histórico

#### Subscriptions
- [x] Criar assinatura VIP
- [x] Verificar status
- [x] Cancelar assinatura

### Fase 3: Frontend - Páginas

#### Autenticação
- [x] Landing Page
- [x] Login Page
- [x] Register Page
- [x] Verify Email Page
- [x] Forgot Password Page

#### Principal
- [x] Lobby Page (com sala CPU fixa)
- [x] Room Page (aguardando jogador)
- [x] Game Page (jogo em si)
- [x] Ranking Page
- [x] Profile Page
- [x] Wallet Page (com plano VIP)
- [x] Admin Page

### Fase 4: Game Engine - Base

#### Física Básica (Original)
- [x] Mesa de sinuca (Canvas 2D)
- [x] Bolas com física
- [x] Colisões bola-bola
- [x] Colisões bola-parede
- [x] Caçapas (pockets)
- [x] Fricção

#### Mecânicas Básicas
- [x] Sistema de mira (arrastar)
- [x] Força da tacada
- [x] Timer por jogada (30s)
- [x] Troca de turno

#### IA (CPU)
- [x] Jogadas automáticas
- [x] Mira em bola válida
- [x] Imprecisão simulada

### Fase 5: Multiplayer (IMPLEMENTADO)

#### WebSocket/Realtime
- [x] Canal por sala (room_id) - `REALTIME_CHANNELS.ROOM(roomId)`
- [x] Canal de jogo (game_id) - `REALTIME_CHANNELS.GAME(roomId)`
- [x] Evento: jogador entrou - `ROOM_EVENTS.PLAYER_JOINED`
- [x] Evento: jogador saiu - `ROOM_EVENTS.PLAYER_LEFT`
- [x] Evento: partida iniciada (broadcast) - `ROOM_EVENTS.GAME_STARTED`
- [x] Evento: tacada realizada - `GAME_EVENTS.SHOT_MADE`
- [x] Evento: bola encaçapada - `GAME_EVENTS.BALL_POCKETED`
- [x] Evento: troca de turno - `GAME_EVENTS.TURN_CHANGE`
- [x] Evento: partida finalizada - `GAME_EVENTS.GAME_OVER`

#### Sincronização
- [x] Broadcast de posições das bolas - `GAME_EVENTS.BALLS_UPDATE`
- [x] Broadcast de tacadas - `GAME_EVENTS.SHOT_MADE`
- [x] Broadcast de faltas - `GAME_EVENTS.FOUL_COMMITTED`
- [x] Broadcast de atribuição de tipo - `GAME_EVENTS.TYPE_ASSIGNED`
- [ ] Estado autoritativo no servidor (atualmente client-authoritative)

### Fase 6: Regras de Jogo (IMPLEMENTADO)

#### Modo 9 Bolas (4x4)
- [x] Configuração inicial (4 vermelhas + 4 azuis) - `initBalls9()`
- [x] Atribuição de cores no início (Jogador 1 = Vermelho, Jogador 2 = Azul)
- [x] Detecção de bola encaçapada por cor
- [x] Contagem de bolas por jogador
- [x] Detecção de vitória (4 bolas)

#### Modo 15 Bolas (Par/Ímpar)
- [x] Configuração inicial (1-15) - `initBalls15()`
- [x] Definição de tipo na primeira encaçapada - `assignTypes()`
- [x] Detecção de bola par/ímpar
- [x] Contagem de bolas por tipo
- [x] Detecção de vitória (7 bolas) - `checkVictory()`

#### Regra de Penalidade (A Cega)
- [x] Detecção de falta (acertar bola adversária) - `checkFoul()`
- [x] Perda de vez imediata
- [x] Bonificação ao adversário (1 bola)
- [x] Notificação visual da falta - `showFoulMessage()`

### Fase 7: Admin (EXPANDIDO)
- [x] Dashboard básico
- [x] Gestão de usuários (listagem)
- [x] Gestão de partidas
- [x] Gestão financeira básica
- [x] Gestão de carteiras
- [x] Configurações do sistema
- [x] Logs e auditoria básica
- [x] **RBAC completo** (Super Admin, Admin Operacional, Moderador) ✅
- [x] **CRM avançado** (perfil detalhado do jogador) ✅
- [x] **Live Ops** (monitoramento em tempo real) ✅
- [x] **Gestão de Torneios** ✅
- [x] **Frontend Admin** (páginas do painel) ✅

### Fase 8: Extras
- [x] Compartilhamento social
- [x] Sistema de convites
- [x] Rate limiting
- [x] Upload de arquivos

### Fase 9: Deploy
- [ ] Build de produção
- [ ] Configuração de ambiente
- [ ] Deploy do backend
- [ ] Configuração de domínio
- [ ] SSL/HTTPS
- [ ] Monitoramento

---

## 🎱 FÍSICA AVANÇADA DO JOGO (NOVO MÓDULO)

### Física das Bolas (Ball Physics)

#### Atrito e Desaceleração
- [x] **Rolling Friction**: Atrito de rolamento realista - `applyRollingFriction()`
- [x] **Angular Drag**: Arrasto angular para rotação natural - `ANGULAR_DAMPING`
- [x] **Desaceleração Suave**: Bolas perdem velocidade naturalmente
- [x] **Coeficiente de Atrito**: Ajustável - `ROLLING_FRICTION = 0.015`

#### Colisões Bola-Bola
- [x] **Conservação de Momento**: Energia transferida corretamente - `resolveBallCollision()`
- [x] **Colisão Elástica**: Coeficiente ~0.95 - `BALL_RESTITUTION`
- [x] **Ângulo de Deflexão**: Cálculo preciso baseado no ponto de contato
- [ ] **Spin Transfer**: Transferência de efeito entre bolas (futuro)

#### Física das Tabelas (Cushions)
- [x] **Coeficiente de Restituição**: ~0.75 (borracha) - `CUSHION_RESTITUTION`
- [x] **Ângulo de Reflexão**: Correto com perda de velocidade
- [x] **Imperfeição da Borracha**: Leve variação no ângulo
- [ ] **Efeito nas Tabelas**: Bola com spin reage diferente (futuro)

### Detecção de Caçapas (Pockets)

#### Hitbox e Condições de Queda
- [x] **Hitbox Precisa**: Bola NÃO é "sugada" - `checkPocket()`
- [x] **Condição de Queda**: Baseada em vetor de direção + velocidade
- [x] **Quina da Caçapa**: Bola repica para fora se muito rápida - `bounceOut`
- [x] **Tremor/Hesitação**: Bola pode "quase entrar" - `nearMiss`
- [x] **Velocidade Máxima**: `POCKET_ENTRY_SPEED_MAX = 25`
- [x] **Ângulo Máximo**: `POCKET_ENTRY_ANGLE_MAX = 60°`

### Constantes de Física
```typescript
BALL_RADIUS = 12
BALL_MASS = 0.17
BALL_RESTITUTION = 0.95
ROLLING_FRICTION = 0.015
ANGULAR_DAMPING = 0.05
CUSHION_RESTITUTION = 0.75
POCKET_RADIUS = 22
MIN_VELOCITY = 0.05
MAX_SHOT_POWER = 25
SUBSTEPS = 4 // Sub-passos por frame
```

---

## 🖱️ CONTROLES E MECÂNICA DO TACO (NOVO MÓDULO)

### Taco (Cue Stick)

#### Visualização
- [x] **Taco Visível**: Objeto 2D que orbita a bola branca - `drawCue()`
- [x] **Rotação Suave**: Taco segue o mouse suavemente
- [x] **Posicionamento**: Sempre apontando para o centro da bola branca
- [ ] **Modelo 3D**: Migrar para Three.js (futuro)

#### Mecânica de Tacada (Mouse Drag)
- [x] **Puxar e Soltar**: Clica, segura, arrasta para trás, solta
- [x] **Feedback Visual**: Taco se afasta da bola ao arrastar - `pullBack`
- [x] **Força Proporcional**: Distância puxada = força da tacada
- [x] **Limite de Força**: Máximo `MAX_SHOT_POWER = 25`
- [x] **Animação de Tacada**: Taco avança visualmente

#### Linha de Guia (Aim Guide)
- [x] **Linha de Direção**: Linha pontilhada projetando direção - `drawAimLine()`
- [x] **Indicador de Força**: Barra lateral com gradiente - `drawPowerIndicator()`
- [ ] **Previsão de Trajetória**: Linha mostrando caminho da bola (futuro)
- [ ] **Ghost Ball**: Indicador de onde a bola alvo será atingida (futuro)

### Controles do Jogador
```
Mouse:
- Movimento: Rotaciona o taco ao redor da bola branca
- Clique + Arrastar para trás: Prepara a tacada (define força)
- Soltar: Executa a tacada

Touch (Mobile):
- Touch + Drag: Mesmo comportamento do mouse
```

---

## 🖥️ GRÁFICOS E RENDERIZAÇÃO (NOVO MÓDULO)

### Renderizador 2D Avançado

#### Engine
- [x] **Renderizador Modular**: `PoolRenderer` class - `renderer.ts`
- [x] **Canvas 2D Otimizado**: 60 FPS estável
- [ ] **WebGL/Three.js**: Migração futura para 3D
- [ ] **Fallback 2D**: Opção para dispositivos sem WebGL

#### Iluminação e Sombras (2D Simulado)
- [x] **Sombras das Bolas**: Elipse escura embaixo - profundidade
- [x] **Brilho Especular**: Reflexo de luz nas bolas (gradiente)
- [x] **Efeito 3D**: Gradiente radial nas bolas
- [ ] **Sombras Dinâmicas Reais**: Three.js (futuro)
- [ ] **Spotlight**: Luminária de mesa (futuro)

#### Texturas e Materiais (2D)
- [x] **Feltro da Mesa**: Cor verde com linhas sutis de textura
- [x] **Bordas de Madeira**: Gradiente marrom simulando madeira
- [x] **Bolas com Gradiente**: Efeito 3D com highlight
- [x] **Bolas Listradas**: Padrão correto (9-15)
- [x] **Taco com Gradiente**: Madeira + ponteira azul
- [ ] **Texturas de Alta Resolução**: Arquivos de imagem (futuro)

#### Câmera (Futuro - 3D)
- [ ] Vista padrão (toda a mesa)
- [ ] Vista de mira (atrás do taco)
- [ ] Transições suaves
- [ ] Zoom com scroll

---

## 🔊 SOUND DESIGN - ÁUDIO (NOVO MÓDULO)

### Sistema de Áudio

#### Engine
- [x] **Web Audio API**: `AudioEngine` class - `audio.ts`
- [x] **Sons Procedurais**: Gerados em tempo real (sem arquivos)
- [x] **Controle de Volume**: Master, SFX, Ambient
- [x] **Toggle de Som**: Botão no jogo para ligar/desligar

### Efeitos Sonoros (SFX)

#### Sons de Tacada
- [x] **Tacada**: Som seco e firme - `playCueHit(power)`
- [x] **Variação de Volume**: Proporcional à força
- [x] **Variação de Pitch**: Baseado na força

#### Sons de Colisão
- [x] **Bola-Bola**: "Clack" característico - `playBallCollision(impactSpeed)`
- [x] **Volume Dinâmico**: Baseado na velocidade do impacto
- [x] **Bola-Tabela**: Som mais abafado - `playCushionHit(impactSpeed)`

#### Sons de Caçapa
- [x] **Queda na Caçapa**: Som abafado - `playPocketFall()`
- [x] **Rolagem no Trilho**: Som sutil de rolagem

### Ambiente e Mixagem

#### Som Ambiente
- [x] **Sala de Sinuca**: Ruído browniano sutil - `startAmbient()`
- [x] **Low Volume**: Não distrai, apenas preenche silêncio
- [x] **Sem Música**: Foco nos sons do jogo

#### Configurações de Áudio
```typescript
MASTER_VOLUME = 0.8
SFX_VOLUME = 1.0
AMBIENT_VOLUME = 0.15
```

---

## 🛡️ PAINEL ADMINISTRATIVO AVANÇADO ✅ COMPLETO (95%)

### Status: IMPLEMENTADO
- Ver arquivo `ADMIN_PANEL_STATUS.md` para detalhes completos

### 🔐 Controle de Acesso e Segurança (RBAC)

#### Autenticação Admin
- [x] **Login Separado**: Rota `/admin/login` exclusiva para administradores
- [x] **Supabase Auth**: Autenticação via Supabase com verificação de role
- [ ] **2FA (Futuro)**: Autenticação de dois fatores para admins
- [x] **Sessão Segura**: Token JWT com expiração curta (1h)
- [ ] **IP Whitelist (Futuro)**: Restringir acesso por IP

#### Hierarquia de Perfis (Roles) ✅ ATUALIZADO
| Role | Descrição | Permissões |
|------|-----------|------------|
| 👑 **super_admin** | Acesso total irrestrito | Tudo, incluindo gerenciar outros admins |
| 🛡️ **admin** | Admin Operacional | Gerencia usuários, finanças, funcionários |
| 📋 **manager** | Gerente | Gerencia usuários, saques, torneios |
| 🔧 **moderator** | Moderador | Banimentos, visualização de partidas |
| 👤 **employee** | Funcionário | Visualização, aprovar saques |

#### Gestão de Equipe ✅ NOVO
- [x] **Aba Equipe no Admin**: Listar todos os funcionários
- [x] **Convidar Funcionário**: Por email com código de convite
- [x] **Alterar Cargo**: Promover/rebaixar funcionários
- [x] **Remover Funcionário**: Rebaixar a usuário comum
- [x] **Permissões por Cargo**: Tabs visíveis baseadas no role
- [x] **Tabela role_permissions**: Permissões granulares por role
- [x] **Função has_permission()**: Verificar permissão no banco

#### Implementação RBAC ✅ IMPLEMENTADO
- [x] **Coluna `role`**: Campo na tabela `users` com enum ('user', 'employee', 'moderator', 'manager', 'admin', 'super_admin')
- [x] **Coluna `is_admin`**: Flag booleana para acesso rápido
- [x] **Middleware de Permissão**: `requireRole()` e `requirePermission()` - verifica nível de acesso
- [x] **Decorators de Rota**: Proteger endpoints por role mínimo
- [x] **UI Condicional**: Tabs visíveis baseado no role do admin logado

```typescript
// Exemplo de hierarquia
const ROLE_HIERARCHY = {
  user: 0,
  employee: 1,
  moderator: 2,
  manager: 3,
  admin: 4,
  super_admin: 5
};

// Permissões por funcionalidade
const PERMISSIONS = {
  view_users: ['moderator', 'manager', 'admin', 'super_admin'],
  edit_users: ['manager', 'admin', 'super_admin'],
  delete_users: ['super_admin'],
  view_finances: ['manager', 'admin', 'super_admin'],
  edit_finances: ['admin', 'super_admin'],
  manage_employees: ['admin', 'super_admin'],
  adjust_balance: ['super_admin'],
  view_logs: ['moderator', 'admin', 'super_admin'],
  system_settings: ['super_admin'],
};
```

### 👥 Gestão de Usuários (CRM) ✅ IMPLEMENTADO

#### Listagem e Busca
- [x] **Tabela de Usuários**: Listagem paginada com ordenação
- [x] **Busca Rápida**: Por Nome, CPF, E-mail ou ID
- [x] **Filtros Avançados**: Status (ativo/banido), VIP, data de cadastro
- [ ] **Exportar Lista**: CSV/Excel com dados filtrados

#### Perfil Detalhado do Jogador
- [x] **Dados Pessoais**:
  - Nome completo
  - CPF (mascarado: ***.XXX.XXX-**)
  - E-mail
  - Telefone
  - IP de cadastro
  - Data de cadastro
  - Último acesso

- [x] **Dados Econômicos**:
  - Saldo atual (Créditos)
  - Saldo em R$ (total, depósito, ganhos, bônus)
  - Status VIP (ativo/inativo, data de expiração)
  - Total depositado (lifetime)
  - Total sacado (lifetime)
  - Histórico de transações (últimas 50)

- [x] **Performance de Jogo**:
  - Total de partidas jogadas
  - Vitórias / Derrotas / Taxa de vitória
  - Posição no ranking global
  - Posição no ranking mensal
  - Torneios disputados
  - Torneios vencidos

#### Ações de Intervenção
- [x] **Bloqueio/Ban**:
  - Botão "Suspender" (temporário, com duração)
  - Botão "Banir" (permanente)
  - Campo obrigatório: Motivo do ban
  - Notificação automática ao usuário
  - Log de auditoria gerado

- [x] **Ajuste Manual de Saldo** (⚠️ CRÍTICO):
  - Input para valor (positivo = crédito, negativo = débito)
  - Seletor: Tipo de saldo (deposit, winnings, bonus)
  - Campo obrigatório: Justificativa
  - Confirmação em duas etapas
  - Log de auditoria IMUTÁVEL
  - Notificação ao usuário

- [x] **Reset de Conta**:
  - Reset de senha (envia e-mail)
  - Reset de ranking (zera pontuação)
  - Desconectar sessões ativas

### 🕹️ Gestão de Partidas e Salas (Live Ops) ✅ IMPLEMENTADO

#### Monitoramento em Tempo Real
- [x] **Dashboard Live**:
  - Número de salas ativas
  - Número de jogadores online
  - Partidas em andamento
  - Gráfico de atividade (últimas 24h)

- [x] **Listagem de Salas**:
  - ID da sala
  - Jogadores (dono + convidado)
  - Modo de jogo (9 bolas / 15 bolas)
  - Status (aguardando, em jogo, finalizada)
  - Tempo de duração
  - Valor apostado (se houver)

- [x] **Filtros**:
  - Por data/hora
  - Por ID do usuário
  - Por modo de jogo
  - Por status
  - Por valor de aposta

#### Intervenção em Partidas
- [x] **Kill Switch**: Botão "Encerrar Sala Forçosamente"
  - Motivo obrigatório
  - Opção: Reembolsar créditos
  - Opção: Declarar empate
  - Log de auditoria

- [x] **Logs da Partida**:
  - Replay de ações (quem tacou, quando)
  - Bolas encaçapadas (por quem, quando)
  - Faltas cometidas
  - Tempo por jogada
  - Resultado final

- [x] **Resolução de Disputas**:
  - Visualizar histórico completo
  - Declarar vencedor manualmente
  - Anular partida
  - Reembolsar apostas

### 💸 Gestão Financeira e Apostas (O Banco) ✅ IMPLEMENTADO

#### Dashboard Financeiro
- [x] **Métricas Principais**:
  - Receita total (hoje, semana, mês)
  - Receita por fonte (créditos, VIP, taxas)
  - Saques pendentes (valor total)
  - Saques processados (hoje)

- [x] **Gráficos**:
  - Receita diária (últimos 30 dias)
  - Venda de Créditos vs Assinaturas VIP
  - Taxas de aposta coletadas
  - Comparativo mês atual vs anterior

#### Solicitações de Saque
- [x] **Lista de Pedidos**:
  - ID do pedido
  - Usuário (nome, CPF)
  - Valor solicitado
  - Chave Pix
  - Data da solicitação
  - Status (pendente, aprovado, rejeitado)

- [x] **Ações**:
  - Aprovar saque (processa pagamento)
  - Rejeitar saque (com motivo)
  - Aprovar em lote (múltiplos saques)

#### Controle de Apostas
- [x] **Custódia**:
  - Valores "presos" em partidas em andamento
  - Detalhamento por partida
  - Alerta se valor em custódia muito alto

- [x] **Comissão da Casa**:
  - Relatório de taxas retidas (10%)
  - Por período (dia, semana, mês)
  - Por partida individual
  - Total acumulado

- [x] **Liquidação Manual**:
  - Forçar vitória de um lado
  - Pagar aposta manualmente
  - Anular aposta (reembolso)
  - Motivo obrigatório + log

### 🏆 Gestão de Torneios ✅ IMPLEMENTADO

#### CRUD de Torneios
- [x] **Criar Torneio**:
  - Nome do torneio
  - Data/Hora de início
  - Tipo: Gratuito ou Pago
  - Taxa de entrada (se pago)
  - Premiação (distribuição)
  - Número máximo de participantes
  - Modo de jogo (9 ou 15 bolas)
  - Formato (eliminatória simples, dupla)

- [x] **Editar Torneio**: Alterar dados antes do início
- [x] **Cancelar Torneio**: Com reembolso automático

#### Chaves e Brackets
- [x] **Visualização da Árvore**: Bracket visual do torneio
- [x] **Avançar Jogador**: Manualmente (WO, desistência)
- [x] **Registrar Resultado**: Inserir placar manualmente
- [x] **Distribuir Premiação**: Ao finalizar torneio

### ⚙️ Configurações Globais (CMS)

#### Configurações sem Deploy
- [ ] **Créditos e Preços**:
  - Valor do crédito (R$)
  - Pacotes disponíveis (quantidade + preço)
  - Créditos grátis no cadastro
  - Créditos grátis diários

- [ ] **Planos VIP**:
  - Preço mensal
  - Preço anual
  - Benefícios (texto)

- [ ] **Taxas e Comissões**:
  - Taxa da casa em apostas (%)
  - Taxa de saque (%)
  - Valor mínimo de saque

- [ ] **Jogo**:
  - Tempo por jogada (segundos)
  - Créditos por partida
  - Modos habilitados

- [ ] **Textos do Sistema**:
  - Regras do jogo
  - Termos de uso
  - Política de privacidade
  - Mensagens de manutenção

#### Modo Manutenção
- [ ] **Ativar/Desativar**: Toggle para modo manutenção
- [ ] **Mensagem Customizada**: Texto exibido aos usuários
- [ ] **Whitelist**: IPs que podem acessar durante manutenção

### 🛡️ Moderação, Logs e Auditoria ✅ IMPLEMENTADO

#### Polícia do Chat (Futuro)
- [ ] **Histórico de Mensagens**: Por usuário ou sala
- [ ] **Filtro de Palavras**: Lista de palavras proibidas
- [ ] **Flag Automática**: IA para detectar ofensas
- [ ] **Ações**: Mute, warn, ban

#### Auditoria (Logs do Sistema)
- [x] **Registro Completo**:
  - Quem fez (admin_id)
  - O que fez (action)
  - Quando fez (timestamp)
  - Detalhes (JSON com dados)
  - IP de origem

- [x] **Tipos de Ação Logados**:
  - `user_ban` - Banimento de usuário
  - `user_unban` - Desbanimento
  - `balance_adjust` - Ajuste de saldo
  - `match_cancel` - Cancelamento de partida
  - `bet_liquidate` - Liquidação manual de aposta
  - `withdrawal_approve` - Aprovação de saque
  - `withdrawal_reject` - Rejeição de saque
  - `settings_update` - Alteração de configuração
  - `tournament_create` - Criação de torneio
  - `tournament_cancel` - Cancelamento de torneio

- [x] **Imutabilidade**: Logs não podem ser editados ou deletados
- [x] **Busca e Filtros**: Por admin, ação, data, usuário afetado
- [ ] **Exportar Logs**: CSV para auditoria externa

### 📊 Tabelas do Admin (Database)

```sql
-- Tabela: admin_logs (EXISTENTE - expandir)
- id (uuid)
- admin_id (uuid, FK users)
- action (varchar) -- tipo da ação
- target_type (varchar) -- 'user', 'match', 'withdrawal', etc
- target_id (uuid) -- ID do objeto afetado
- details (jsonb) -- dados completos da ação
- ip_address (inet)
- user_agent (text)
- created_at (timestamp)

-- Tabela: tournaments (NOVA)
- id (uuid)
- name (varchar)
- description (text)
- start_date (timestamp)
- entry_fee (decimal)
- prize_pool (decimal)
- max_participants (int)
- game_mode (varchar)
- format (varchar) -- 'single_elimination', 'double_elimination'
- status (varchar) -- 'draft', 'open', 'in_progress', 'finished', 'cancelled'
- created_by (uuid, FK users)
- created_at (timestamp)

-- Tabela: tournament_participants (NOVA)
- id (uuid)
- tournament_id (uuid, FK tournaments)
- user_id (uuid, FK users)
- seed (int) -- posição no bracket
- status (varchar) -- 'registered', 'eliminated', 'winner'
- eliminated_at (timestamp)
- created_at (timestamp)

-- Tabela: tournament_matches (NOVA)
- id (uuid)
- tournament_id (uuid, FK tournaments)
- round (int)
- match_number (int)
- player1_id (uuid, FK users)
- player2_id (uuid, FK users)
- winner_id (uuid, FK users)
- match_id (uuid, FK matches) -- partida real
- status (varchar)
- created_at (timestamp)
```

### 📁 Estrutura de Arquivos (Admin)

```
src/server/modules/admin/
├── admin.routes.ts           # Rotas principais
├── admin.service.ts          # Lógica de negócio
├── settings.routes.ts        # Configurações do sistema
├── settings.service.ts       # Serviço de configurações
├── users.admin.routes.ts     # 🆕 Gestão de usuários
├── users.admin.service.ts    # 🆕 Serviço de usuários
├── matches.admin.routes.ts   # 🆕 Gestão de partidas
├── matches.admin.service.ts  # 🆕 Serviço de partidas
├── finance.admin.routes.ts   # 🆕 Gestão financeira
├── finance.admin.service.ts  # 🆕 Serviço financeiro
├── tournaments.routes.ts     # 🆕 Gestão de torneios
├── tournaments.service.ts    # 🆕 Serviço de torneios
├── audit.routes.ts           # 🆕 Logs de auditoria
├── audit.service.ts          # 🆕 Serviço de auditoria
└── rbac.middleware.ts        # 🆕 Middleware RBAC

src/client/pages/admin/       # 🆕 Páginas do painel admin
├── AdminDashboard.ts         # Dashboard principal
├── AdminUsers.ts             # Gestão de usuários
├── AdminUserDetail.ts        # Perfil detalhado
├── AdminMatches.ts           # Gestão de partidas
├── AdminFinance.ts           # Gestão financeira
├── AdminWithdrawals.ts       # Solicitações de saque
├── AdminTournaments.ts       # Gestão de torneios
├── AdminSettings.ts          # Configurações
├── AdminLogs.ts              # Logs de auditoria
└── AdminLogin.ts             # Login separado
```

---

## 🎯 PRÓXIMOS PASSOS - ADMIN (PRIORIDADE)

### 🔴 CRÍTICO ✅ CONCLUÍDO
1. [x] Implementar RBAC (roles e permissões)
2. [x] Middleware de verificação de permissão
3. [x] Ajuste manual de saldo com log de auditoria
4. [x] Logs imutáveis de todas as ações admin

### 🟡 ALTO ✅ CONCLUÍDO
5. [x] CRM - Perfil detalhado do jogador
6. [x] Gestão de saques (aprovar/rejeitar)
7. [x] Kill switch para salas problemáticas
8. [x] Dashboard financeiro com gráficos

### 🟢 MÉDIO ✅ CONCLUÍDO
9. [x] Gestão de torneios (CRUD)
10. [ ] Configurações sem deploy (CMS)
11. [ ] Exportar relatórios (CSV)
12. [x] Busca avançada de usuários

### 🔵 BAIXO
13. [ ] Sistema de chat e moderação
14. [ ] 2FA para admins
15. [ ] IP whitelist
16. [ ] Replay de partidas

### 🟣 FRONTEND ADMIN ✅ CONCLUÍDO
17. [x] Criar páginas do painel admin em `src/client/pages/AdminPage.ts`
18. [x] Dashboard principal com estatísticas
19. [x] Gestão de usuários (listagem, ban/unban, ajuste de saldo/créditos)
20. [x] Gestão financeira (dashboard, saques pendentes)
21. [x] Gestão de torneios (CRUD completo)
22. [x] Logs de auditoria (visualização)
23. [x] Configurações do sistema (geral, créditos, apostas, jogo, gateway de pagamento)

---

## 📝 NOTAS DE DESENVOLVIMENTO - ADMIN

### Mensagem para o Desenvolvedor
> "Este é o escopo do Painel Admin. Ele precisa ser separado do front-end do jogo (outra rota ou subdomínio). A prioridade é a segurança: use o Supabase Auth para gerenciar os níveis de permissão. Lembre-se que o 'Ajuste Manual de Saldo' é a função mais crítica e precisa de um log de auditoria rigoroso para evitar fraudes internas."

### Princípios de Segurança
1. **Menor Privilégio**: Cada role tem apenas as permissões necessárias
2. **Auditoria Total**: TODA ação administrativa é logada
3. **Imutabilidade**: Logs não podem ser alterados ou deletados
4. **Rastreabilidade**: Sempre saber quem fez o quê e quando
5. **Confirmação Dupla**: Ações críticas exigem confirmação

---

## 📁 ESTRUTURA DE ARQUIVOS

```
src/
├── client/
│   ├── pages/
│   │   ├── LandingPage.ts
│   │   ├── LoginPage.ts
│   │   ├── RegisterPage.ts
│   │   ├── LobbyPage.ts
│   │   ├── RoomPage.ts
│   │   ├── GamePage.ts        # Atualizado com engine modular
│   │   ├── RankingPage.ts
│   │   ├── ProfilePage.ts
│   │   ├── WalletPage.ts
│   │   └── AdminPage.ts
│   ├── pages/admin/            # 🆕 NOVO - Páginas do painel admin
│   │   ├── AdminDashboard.ts
│   │   ├── AdminUsers.ts
│   │   ├── AdminUserDetail.ts
│   │   ├── AdminMatches.ts
│   │   ├── AdminFinance.ts
│   │   ├── AdminWithdrawals.ts
│   │   ├── AdminTournaments.ts
│   │   ├── AdminSettings.ts
│   │   ├── AdminLogs.ts
│   │   └── AdminLogin.ts
│   ├── components/             # 🆕 NOVO - Componentes reutilizáveis
│   │   ├── CheckoutModal.ts   # Modal de checkout transparente
│   │   ├── PixPayment.ts      # Componente Pix (QR Code)
│   │   ├── CardPayment.ts     # Componente Cartão de Crédito
│   │   └── PaymentStatus.ts   # Status do pagamento
│   ├── services/
│   │   ├── api.ts
│   │   ├── realtime.ts        # Serviço de realtime multiplayer
│   │   └── share.ts
│   ├── engine/                 # 🆕 NOVO - Engine do jogo
│   │   ├── index.ts           # Exportações
│   │   ├── physics.ts         # Física avançada
│   │   ├── audio.ts           # Sistema de áudio
│   │   └── renderer.ts        # Renderizador 2D
│   ├── store/
│   │   └── gameStore.ts
│   ├── styles/
│   │   └── main.css
│   ├── app.ts
│   └── main.ts
├── server/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── wallet/
│   │   ├── credits/
│   │   ├── rooms/
│   │   ├── matches/
│   │   ├── ranking/
│   │   ├── admin/              # 🔄 EXPANDIDO - Módulo admin
│   │   │   ├── admin.routes.ts
│   │   │   ├── admin.service.ts
│   │   │   ├── settings.routes.ts
│   │   │   ├── settings.service.ts
│   │   │   ├── users.admin.routes.ts    # ✅ IMPLEMENTADO
│   │   │   ├── users.admin.service.ts   # ✅ IMPLEMENTADO
│   │   │   ├── finance.admin.routes.ts  # ✅ IMPLEMENTADO
│   │   │   ├── finance.admin.service.ts # ✅ IMPLEMENTADO
│   │   │   ├── matches.admin.routes.ts  # ✅ IMPLEMENTADO
│   │   │   ├── matches.admin.service.ts # ✅ IMPLEMENTADO
│   │   │   ├── tournaments.routes.ts    # ✅ IMPLEMENTADO
│   │   │   ├── tournaments.service.ts   # ✅ IMPLEMENTADO
│   │   │   ├── audit.routes.ts          # ✅ IMPLEMENTADO
│   │   │   └── audit.service.ts         # ✅ IMPLEMENTADO
│   │   ├── payments/           # 🆕 NOVO - Módulo de pagamentos
│   │   │   ├── payments.service.ts
│   │   │   ├── payments.routes.ts
│   │   │   ├── gerencianet.client.ts
│   │   │   ├── payment-settings.service.ts
│   │   │   └── payment-settings.routes.ts
│   │   ├── tournaments/        # 🆕 NOVO - Módulo de torneios
│   │   │   ├── tournaments.routes.ts
│   │   │   └── tournaments.service.ts
│   │   ├── moderation/
│   │   ├── notifications/
│   │   ├── invites/
│   │   ├── subscriptions/
│   │   └── upload/
│   ├── services/
│   │   └── supabase.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   └── rbac.middleware.ts  # ✅ IMPLEMENTADO
│   └── index.ts
├── shared/
│   ├── constants/
│   │   └── index.ts
│   ├── types/
│   │   └── index.ts
│   └── realtime/
│       └── events.ts
├── uploads/
│   └── avatars/
└── certificates/               # 🆕 NOVO - Certificados seguros
    └── .gitkeep               # Diretório para certificados .p12
```

---

## 🔧 CONSTANTES DO SISTEMA

```typescript
// Créditos
CREDIT_VALUE_BRL = 0.50        // 1 crédito = R$ 0,50
CREDITS_PER_PURCHASE = 4       // Mínimo 4 créditos
PURCHASE_PRICE_BRL = 2         // R$ 2,00 = 4 créditos
CREDITS_PER_MATCH = 1          // 1 crédito por partida

// Assinatura VIP
VIP_MONTHLY_PRICE = 19.99      // R$ 19,99/mês
VIP_YEARLY_PRICE = 199.90      // R$ 199,90/ano

// Apostas
PLATFORM_FEE_PERCENT = 10      // 10% para plataforma
WINNER_PAYOUT_PERCENT = 90     // 90% para vencedor
MIN_BET_AMOUNT = 5             // R$ 5,00 mínimo

// Ranking
POINTS_PER_WIN = 10
POINTS_PER_LOSS = -3
POINTS_PER_BET_WIN = 15

// Jogo
TURN_TIME = 30                 // 30 segundos por turno

// Física (NOVO)
BALL_RADIUS = 12
BALL_MASS = 0.17
BALL_RESTITUTION = 0.95
ROLLING_FRICTION = 0.015
CUSHION_RESTITUTION = 0.75
POCKET_RADIUS = 22
MAX_SHOT_POWER = 25

// Áudio (NOVO)
MASTER_VOLUME = 0.8
SFX_VOLUME = 1.0
AMBIENT_VOLUME = 0.15
```

---

## 🎯 PRÓXIMOS PASSOS (PRIORIDADE)

### 🔴 CRÍTICO
1. [x] **PAGAMENTOS**: Integrar API Gerencianet/Efí (Pix + Cartão)
2. [x] **COMPLIANCE**: Implementar segregação de saldos (depósito vs ganhos)
3. [x] **ADMIN RBAC**: Implementar controle de acesso por roles ✅
4. [ ] Testar multiplayer com 2 jogadores reais
5. [ ] Validar sincronização de estado entre jogadores

### 🟡 ALTO
6. [x] Checkout transparente (modal sem redirect)
7. [x] Bloqueio de saque para saldo de depósito
8. [x] **ADMIN**: Ajuste manual de saldo com auditoria ✅
9. [x] **ADMIN**: Gestão de saques (aprovar/rejeitar) ✅
10. [ ] Fine-tuning dos parâmetros de física
11. [ ] Migrar para Three.js (gráficos 3D)

### 🟢 MÉDIO
12. [x] **ADMIN**: Dashboard financeiro com gráficos ✅
13. [x] **ADMIN**: CRM - Perfil detalhado do jogador ✅
14. [ ] Adicionar sons com arquivos de áudio reais
15. [ ] Texturas de alta qualidade
16. [ ] Câmera dinâmica (3D)

### 🔵 BAIXO
17. [x] **ADMIN**: Gestão de torneios ✅
18. [ ] Efeitos visuais avançados (partículas)
19. [ ] Spin/efeito nas bolas
20. [ ] Deploy para produção

### 🟣 CONCLUÍDO RECENTEMENTE
21. [x] **LANDING PAGE**: Atualizada com novas seções ✅
22. [x] **SALAS AO VIVO**: Painel de social proof na landing ✅
23. [x] **MULTI-JOGOS**: Menu de seleção de games ✅
24. [x] **PÁGINAS LEGAIS**: Termos, Privacidade, Regras ✅
25. [x] **FRONTEND ADMIN**: Criar páginas do painel administrativo ✅

---

## 🏠 LANDING PAGE E PÁGINAS INSTITUCIONAIS (NOVO MÓDULO)

### Landing Page Atualizada ✅
- [x] **Sincronização de Regras**: Textos atualizados (foco em habilidade, competição)
- [x] **Display de Preços**: Valores sincronizados com sistema (R$ 0,50/crédito)
- [x] **Pacotes de Créditos**: 4, 10, 20, 50, 100 créditos
- [x] **Planos VIP**: Mensal (R$ 19,99) e Anual (R$ 199,90)

### Painel de Salas Ao Vivo (Social Proof) ✅
- [x] **Seção Dinâmica**: "Salas Disponíveis" na landing
- [x] **Tempo Real**: Lista de salas abertas aguardando jogadores
- [x] **CTA Direto**: Botão para entrar/criar conta

### Menu de Seleção de Games (Multi-Jogos) ✅
- [x] **Sinuca (Pool)**: Status "Jogar Agora" (Ativo)
- [x] **Tênis de Mesa**: Status "Em Breve"
- [x] **Banco Imobiliário**: Status "Em Breve"
- [x] **Visual Atraente**: Cards com thumbnails e descrições

### Páginas Legais e Institucionais ✅
- [x] **Termos de Uso**: Responsabilidades, sistema de créditos, política de saques
- [x] **Política de Privacidade**: LGPD, coleta de dados, CPF para pagamentos
- [x] **Regras do Jogo**: Mecânica 9 Bolas, 15 Bolas, faltas, ranking
- [x] **Links no Footer**: Acessíveis em todas as páginas

### Arquivos Criados
```
src/client/pages/
├── LandingPage.ts      # Atualizada com novas seções
├── TermsPage.ts        # Termos de Uso
├── PrivacyPage.ts      # Política de Privacidade
├── RulesPage.ts        # Regras do Jogo

src/client/styles/
├── landing-extra.css   # Estilos das novas seções
```

---

## 📝 NOTAS DE DESENVOLVIMENTO

### Mensagem para o Desenvolvedor
> "Vamos elevar o nível do jogo agora. O foco é sair da mecânica simples e ir para uma simulação mais fiel. Precisamos que a física das tabelas e das caçapas seja rigorosa (a bola só entra se a física permitir, sem 'imãs'). No visual, quero o taco 3D reagindo ao mouse do usuário e sons que passem a sensação de peso das bolas."

### Princípios de Design
1. **Realismo > Simplicidade**: Física fiel mesmo que mais complexa
2. **Feedback Satisfatório**: Sons e visuais que dão prazer ao jogar
3. **Performance**: 60 FPS é obrigatório
4. **Acessibilidade**: Fallback 2D para dispositivos limitados

---

## 💳 INTEGRAÇÃO DE PAGAMENTOS - GERENCIANET/EFÍ (NOVO MÓDULO)

### ⚙️ Configuração e Infraestrutura (Painel Admin)

#### Gestão de Credenciais API
- [x] **Campo Client_ID (Homologação)**: Input seguro no painel admin
- [x] **Campo Client_Secret (Homologação)**: Input seguro no painel admin
- [x] **Campo Client_ID (Produção)**: Input seguro no painel admin
- [x] **Campo Client_Secret (Produção)**: Input seguro no painel admin
- [x] **Seletor de Ambiente**: Toggle Sandbox/Produção
- [x] **Validação de Credenciais**: Testar conexão com API antes de salvar

#### Upload de Certificado Digital
- [x] **Campo Upload .p12**: Input de arquivo para certificado digital
- [x] **Validação de Formato**: Aceitar apenas arquivos .p12
- [x] **Armazenamento Seguro**: Salvar em diretório protegido do servidor
- [x] **Acesso Restrito**: Apenas backend pode ler o certificado
- [x] **Renovação de Certificado**: Permitir substituição do arquivo

#### Tabela de Configuração (Database)
```sql
-- Tabela: payment_settings (IMPLEMENTADA)
- id (uuid)
- environment ('sandbox' | 'production')
- client_id (encrypted)
- client_secret (encrypted)
- certificate_path (string)
- certificate_uploaded_at (timestamp)
- is_active (boolean)
- created_at (timestamp)
- updated_at (timestamp)
```

### 💳 Checkout Transparente (Frontend/UX)

#### Interface Modal/Pop-up
- [x] **Modal de Checkout**: Abre sobre a tela atual (sem redirect)
- [x] **Zero Redirecionamento**: Usuário permanece no site
- [x] **Design Responsivo**: Funciona em desktop e mobile
- [x] **Animação de Abertura**: Transição suave
- [x] **Botão Fechar**: X no canto + clique fora fecha

#### Coleta de Dados Obrigatória
- [x] **Campo Nome Completo**: Input obrigatório
- [x] **Campo CPF**: Input com máscara (000.000.000-00)
- [x] **Validação de CPF**: Algoritmo de validação antes de enviar
- [x] **Bloqueio sem CPF**: Não permitir pagamento sem CPF válido
- [x] **Mensagem de Erro**: Feedback claro para CPF inválido

#### Aba Pix
- [x] **Geração de QR Code**: Exibir QR Code instantaneamente
- [x] **Código Copia e Cola**: Botão para copiar código Pix
- [x] **Timer de Expiração**: Mostrar tempo restante do QR Code
- [x] **Status em Tempo Real**: Atualizar quando pagamento confirmado (polling)
- [x] **Animação de Sucesso**: Feedback visual ao confirmar

#### Aba Cartão de Crédito
- [x] **Campo Número do Cartão**: Input com máscara
- [x] **Campo Validade**: MM/AA
- [x] **Campo CVV**: 3-4 dígitos
- [x] **Campo Nome no Cartão**: Como impresso no cartão
- [x] **Tokenização Segura**: Enviar direto para API (não salvar localmente)
- [ ] **Bandeiras Aceitas**: Exibir ícones (Visa, Master, etc.)
- [x] **Validação em Tempo Real**: Verificar formato enquanto digita

#### Seleção de Pacotes
- [x] **Pacote Mínimo**: 4 créditos = R$ 2,00
- [x] **Pacotes Pré-definidos**: 10, 20, 50, 100 créditos
- [ ] **Valor Personalizado**: Input para quantidade customizada
- [x] **Cálculo Automático**: Mostrar valor em R$ ao selecionar

### 🔄 Processamento e Webhooks (Backend)

#### Endpoints de Pagamento
- [x] **POST /payments/pix/create**: Gerar cobrança Pix
- [x] **POST /payments/card/create**: Processar cartão de crédito
- [x] **GET /payments/status/:id**: Consultar status do pagamento
- [x] **POST /payments/webhook/pix**: Receber callbacks da Gerencianet

#### Webhook Handler
- [x] **Validação de Assinatura**: Verificar autenticidade do webhook
- [x] **Processamento de Status**: Interpretar status `paid`, `waiting`, `refused`
- [x] **Idempotência**: Evitar processamento duplicado
- [x] **Logging**: Registrar todos os webhooks recebidos

#### Conversão Automática (BRL → Créditos)
- [x] **Confirmar Transação**: Atualizar status no banco
- [x] **Calcular Créditos**: R$ / 0.50 = quantidade de créditos
- [x] **Creditar Usuário**: Adicionar créditos à conta
- [x] **Atualizar Saldo**: Refresh em tempo real na tela
- [x] **Notificação**: Exibir "Pagamento Aprovado!" ao usuário
- [x] **Registro de Transação**: Salvar em `transactions` com tipo `deposit`

#### Tabela de Pagamentos (Database)
```sql
-- Tabela: payments (IMPLEMENTADA)
- id (uuid)
- user_id (uuid, FK)
- external_id (string) -- ID da Gerencianet
- txid (string) -- TxID do Pix
- method ('pix' | 'credit_card')
- amount_brl (decimal)
- credits_amount (integer)
- status ('pending' | 'paid' | 'refused' | 'expired')
- pix_qrcode (text, nullable)
- pix_copy_paste (text, nullable)
- paid_at (timestamp, nullable)
- created_at (timestamp)
- updated_at (timestamp)
```

### 🔒 Regras de Saque e Compliance (CRÍTICO)

#### Segregação de Saldo (Lógica Interna)

##### Tipos de Saldo
- [x] **Saldo de Depósito**: Valores de Pix/Cartão (BLOQUEADO para saque)
- [x] **Saldo de Ganhos**: Valores de vitórias/apostas (LIBERADO para saque)
- [x] **Saldo de Bônus**: Valores concedidos pelo Admin (LIBERADO para saque)

##### Campos na Tabela Wallet (IMPLEMENTADO)
```sql
-- Atualização: wallet
- balance (decimal)           -- Saldo total (visualização)
- deposit_balance (decimal)   -- Saldo de depósitos (bloqueado)
- winnings_balance (decimal)  -- Saldo de ganhos (liberado)
- bonus_balance (decimal)     -- Saldo de bônus (liberado)
```

#### Regras de Movimentação
- [x] **Depósito**: Credita em `deposit_balance` via `add_deposit_balance()`
- [x] **Vitória em Partida**: Credita em `winnings_balance` via `add_winnings_balance()`
- [x] **Aposta Ganha**: Credita em `winnings_balance`
- [x] **Bônus Admin**: Credita em `bonus_balance` via `add_bonus_balance()`
- [x] **Uso de Crédito**: Debita de `deposit_balance` primeiro via `debit_balance()`

#### Bloqueio de Saque
- [x] **Validação de Saque**: Verificar se valor está em `winnings_balance` ou `bonus_balance`
- [x] **Bloqueio de Depósito**: Negar saque de valores em `deposit_balance`
- [x] **Mensagem de Erro**: "Apenas ganhos e premiações estão disponíveis para saque..."
- [x] **Saque Parcial**: Permitir sacar apenas a parte liberada
- [x] **Endpoint GET /withdrawals/balance**: Retorna saldos segregados

#### Compliance Anti-Fraude
- [x] **Rastreamento de Origem**: Toda transação registra `balance_type`
- [x] **Auditoria**: Log completo de movimentações em `admin_logs`
- [ ] **Relatório Admin**: Visualizar saldos segregados por usuário
- [ ] **Alerta de Suspeita**: Notificar admin se padrão suspeito detectado

### 📊 Constantes de Pagamento
```typescript
// Pagamentos
PAYMENT_PROVIDER = 'gerencianet'
PIX_EXPIRATION_SECONDS = 3600    // 1 hora
MIN_DEPOSIT_BRL = 2.00           // R$ 2,00 mínimo
MAX_DEPOSIT_BRL = 1000.00        // R$ 1.000,00 máximo
CREDIT_VALUE_BRL = 0.50          // 1 crédito = R$ 0,50

// Saque
MIN_WITHDRAWAL_BRL = 10.00       // R$ 10,00 mínimo
MAX_WITHDRAWAL_BRL = 500.00      // R$ 500,00 máximo por dia
WITHDRAWAL_FEE_PERCENT = 0       // Sem taxa (por enquanto)
```

### 📁 Estrutura de Arquivos (Pagamentos)
```
src/server/modules/payments/
├── payments.controller.ts    # Rotas de pagamento
├── payments.service.ts       # Lógica de negócio
├── payments.routes.ts        # Definição de rotas
├── gerencianet.client.ts     # Cliente da API Gerencianet
├── webhook.handler.ts        # Processador de webhooks
└── payments.types.ts         # Tipos TypeScript

src/client/components/
├── CheckoutModal.ts          # Modal de checkout
├── PixPayment.ts             # Componente Pix
├── CardPayment.ts            # Componente Cartão
└── PaymentStatus.ts          # Status do pagamento
```

---

## 🎯 PRÓXIMOS PASSOS - PAGAMENTOS (PRIORIDADE)

### 🔴 CRÍTICO (Fazer Primeiro)
1. [x] Configurar credenciais Gerencianet no Admin
2. [x] Implementar upload de certificado .p12
3. [x] Criar endpoint de geração de Pix
4. [x] Implementar webhook handler
5. [x] Segregar saldos na wallet (deposit vs winnings)

### 🟡 ALTO
6. [x] Criar modal de checkout transparente
7. [x] Implementar validação de CPF
8. [x] Conversão automática BRL → Créditos
9. [x] Bloquear saque de saldo de depósito

### 🟢 MÉDIO
10. [x] Implementar pagamento com cartão de crédito
11. [x] Notificações em tempo real de pagamento
12. [ ] Relatórios financeiros no Admin

### 🔵 BAIXO
13. [ ] Histórico detalhado de transações
14. [ ] Exportar relatórios (CSV/PDF)
15. [ ] Integração com outros gateways (futuro)

---

## 📝 NOTAS DE DESENVOLVIMENTO - PAGAMENTOS

### Mensagem para o Desenvolvedor
> "Prioridade total na integração da API do Gerencianet (Efí). O checkout deve ser 100% transparente (sem redirect). Atenção redobrada na lógica do 'Saldo de Saque': precisamos travar o saque de dinheiro depositado para evitar que usem a plataforma apenas para transitar dinheiro sem jogar (lavagem de dinheiro/fraude). O saque é exclusivo para ganhos."

### Princípios de Compliance
1. **Segregação Obrigatória**: Depósito ≠ Ganhos (nunca misturar)
2. **Rastreabilidade**: Toda movimentação tem origem registrada
3. **Anti-Lavagem**: Bloquear saque de valores não jogados
4. **Transparência**: Usuário vê claramente o que pode sacar
5. **Auditoria**: Admin tem visão completa das movimentações

### Fluxo de Saldo
```
DEPÓSITO (Pix/Cartão)
    ↓
deposit_balance (BLOQUEADO para saque)
    ↓
Jogador USA créditos em partidas
    ↓
Se GANHAR → winnings_balance (LIBERADO para saque)
Se PERDER → Valor vai para adversário/plataforma

SAQUE
    ↓
Verificar: winnings_balance + bonus_balance >= valor_solicitado
    ↓
Se SIM → Processar saque
Se NÃO → Negar com mensagem explicativa
```

---

**Última atualização**: 31/12/2024

---

## 📡 API ENDPOINTS - ADMIN V2 (RBAC)

### Rotas de Usuários (`/api/admin/v2/users`)
| Método | Endpoint | Permissão | Descrição |
|--------|----------|-----------|-----------|
| GET | `/` | view_users | Listar usuários com filtros |
| GET | `/:id` | view_users | Detalhes do usuário |
| GET | `/:id/transactions` | view_finances | Histórico de transações |
| GET | `/:id/matches` | view_matches | Histórico de partidas |
| POST | `/:id/ban` | ban_users | Banir usuário |
| POST | `/:id/suspend` | ban_users | Suspender temporariamente |
| POST | `/:id/unban` | admin+ | Desbanir usuário |
| POST | `/:id/adjust-balance` | adjust_balance | Ajustar saldo (super_admin) |
| POST | `/:id/reset-password` | admin+ | Resetar senha |
| POST | `/:id/reset-ranking` | admin+ | Resetar ranking |

### Rotas Financeiras (`/api/admin/v2/finance`)
| Método | Endpoint | Permissão | Descrição |
|--------|----------|-----------|-----------|
| GET | `/dashboard` | view_finances | Dashboard financeiro |
| GET | `/withdrawals` | approve_withdrawals | Listar saques |
| POST | `/withdrawals/:id/approve` | approve_withdrawals | Aprovar saque |
| POST | `/withdrawals/:id/reject` | approve_withdrawals | Rejeitar saque |
| GET | `/payments` | view_finances | Histórico de pagamentos |
| GET | `/commissions` | view_finances | Relatório de comissões |

### Rotas de Partidas (`/api/admin/v2/matches`)
| Método | Endpoint | Permissão | Descrição |
|--------|----------|-----------|-----------|
| GET | `/` | view_matches | Listar partidas |
| GET | `/rooms/active` | view_matches | Salas ativas (Live Ops) |
| GET | `/:id` | view_matches | Detalhes da partida |
| POST | `/rooms/:id/close` | cancel_matches | Kill Switch |
| POST | `/:id/force-result` | cancel_matches | Forçar resultado |
| POST | `/bets/:id/liquidate` | cancel_matches | Liquidar aposta |

### Rotas de Torneios (`/api/admin/v2/tournaments`)
| Método | Endpoint | Permissão | Descrição |
|--------|----------|-----------|-----------|
| GET | `/` | view_tournaments | Listar torneios |
| GET | `/:id` | view_tournaments | Detalhes do torneio |
| POST | `/` | manage_tournaments | Criar torneio |
| PUT | `/:id` | manage_tournaments | Atualizar torneio |
| POST | `/:id/open` | manage_tournaments | Abrir inscrições |
| POST | `/:id/start` | manage_tournaments | Iniciar torneio |
| POST | `/:id/cancel` | manage_tournaments | Cancelar torneio |
| POST | `/:id/matches/:matchId/advance` | manage_tournaments | Avançar jogador |

### Rotas de Auditoria (`/api/admin/v2/audit`)
| Método | Endpoint | Permissão | Descrição |
|--------|----------|-----------|-----------|
| GET | `/logs` | view_logs | Listar logs de auditoria |
| GET | `/user/:userId` | view_logs | Logs de ações sobre usuário |
| GET | `/admin/:adminId` | view_logs | Logs de ações de um admin |
| GET | `/stats` | view_logs | Estatísticas de auditoria |

### Permissões por Role
```typescript
const PERMISSIONS = {
  view_users: ['moderator', 'admin', 'super_admin'],
  edit_users: ['admin', 'super_admin'],
  ban_users: ['moderator', 'admin', 'super_admin'],
  delete_users: ['super_admin'],
  view_finances: ['admin', 'super_admin'],
  approve_withdrawals: ['admin', 'super_admin'],
  adjust_balance: ['super_admin'],
  view_matches: ['moderator', 'admin', 'super_admin'],
  cancel_matches: ['admin', 'super_admin'],
  view_tournaments: ['moderator', 'admin', 'super_admin'],
  manage_tournaments: ['admin', 'super_admin'],
  view_settings: ['admin', 'super_admin'],
  edit_settings: ['super_admin'],
  view_logs: ['moderator', 'admin', 'super_admin'],
  moderate_chat: ['moderator', 'admin', 'super_admin'],
};
```
