# 🎱 Sinuca Game - Pro Pool Strategy

**Versão**: 1.0.0  
**Status**: 🟢 Produção  
**Licença**: Proprietário

---

## 📖 Sobre o Projeto

O **Sinuca Game** é uma plataforma de jogos de sinuca online com mecânicas de progressão, apostas virtuais e torneios. Desenvolvido com tecnologias modernas para garantir performance em tempo real e uma experiência de jogo premium.

### ✨ Funcionalidades Principais

- 🎱 **Jogo de Sinuca 2D** - Física realista com efeitos visuais modernos
- 🤖 **Jogar contra CPU** - Diferentes níveis de dificuldade
- 🏆 **Sistema de Ranking** - Global, Mensal e Semanal
- 📈 **Sistema de Níveis (Level Up)** - Progressão por XP
- 💰 **Carteira Virtual** - Depósitos, saques e apostas
- 🏅 **Torneios** - Competições com premiação
- 👤 **Perfis Personalizados** - Avatares e estatísticas
- 🔐 **Autenticação Segura** - JWT + Supabase Auth

---

## 🛠️ Stack Tecnológica

| Componente | Tecnologia |
|------------|------------|
| **Frontend** | TypeScript, Vite, HTML5 Canvas |
| **Backend** | Node.js, Fastify |
| **Banco de Dados** | PostgreSQL (Supabase) |
| **Real-time** | Socket.io |
| **Autenticação** | JWT + Supabase Auth |
| **Deploy** | PM2, Nginx, aaPanel |

---

## 🚀 Início Rápido

### Pré-requisitos

- Node.js 18+
- npm ou yarn
- Conta no Supabase (gratuita)

### Instalação Local

```bash
# 1. Clone o repositório
git clone https://github.com/odeilsons169-crypto/sinuca.git
cd sinuca

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas credenciais do Supabase

# 4. Inicie em modo desenvolvimento
npm run dev
```

O jogo estará disponível em: `http://localhost:5173`

---

## 📁 Estrutura do Projeto

```
sinuca/
├── src/
│   ├── client/           # Frontend (TypeScript + Canvas)
│   │   ├── components/   # Componentes reutilizáveis
│   │   ├── engine/       # Motor de física e renderização
│   │   ├── pages/        # Páginas da aplicação
│   │   ├── services/     # APIs e serviços
│   │   └── store/        # Estado global
│   ├── server/           # Backend (Fastify)
│   │   ├── middlewares/  # Autenticação e validação
│   │   ├── modules/      # Módulos de negócio
│   │   └── services/     # Integrações externas
│   └── shared/           # Tipos compartilhados
├── supabase/
│   └── migrations/       # Scripts SQL de migração
├── public/               # Arquivos estáticos
├── _docs/                # Documentação técnica
└── dist/                 # Build de produção
```

---

## 📜 Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia frontend e backend em desenvolvimento |
| `npm run build` | Compila para produção |
| `npm start` | Inicia o servidor de produção |
| `npm run lint` | Verifica erros de código |
| `npm run typecheck` | Verifica tipos TypeScript |

---

## 🎮 Sistema de Níveis

O jogador progride através de níveis ganhando XP:

| Ação | XP Ganho |
|------|----------|
| Vitória vs Jogador | +50 XP |
| Vitória vs CPU (Fácil) | +20 XP |
| Vitória vs CPU (Médio) | +30 XP |
| Vitória vs CPU (Difícil) | +45 XP |
| Derrota vs Jogador | +15 XP |
| Derrota vs CPU | +10 XP |
| Vitória em Torneio | +100 XP |

**Regra**: A cada **100 XP**, o jogador sobe de nível automaticamente.

---

## 🔧 Configuração de Produção

Para deploy em servidores com **aaPanel**, consulte o guia completo:

📄 **[DEPLOY_AAPANEL.md](./DEPLOY_AAPANEL.md)**

---

## 🔒 Variáveis de Ambiente

Crie um arquivo `.env` baseado no `.env.example`:

```env
# Servidor
PORT=3000
NODE_ENV=production

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_KEY=eyJhbG...

# JWT
JWT_SECRET=sua_chave_secreta_muito_longa

# URL do Frontend
VITE_API_URL=https://seudominio.com.br
```

---

## 🤝 Contribuição

Este é um projeto proprietário. Para sugestões ou reportar bugs, entre em contato com o administrador.

---

## 📄 Licença

**Todos os direitos reservados** © 2026

Este software é proprietário e seu uso, cópia ou distribuição sem autorização expressa é proibido.

---

**Desenvolvido com 💚 e ☕**
