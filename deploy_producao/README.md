# 📦 SINUCA GAME - Pacote de Produção

Este é o pacote pronto para deploy em servidores com **aaPanel**.

---

## 🚀 Instalação Rápida

### Opção 1: Instalador Visual (Recomendado)

1. Faça upload desta pasta para `/www/wwwroot/sinuca/`
2. Configure um site no aaPanel apontando para `/www/wwwroot/sinuca/public`
3. Acesse `http://seudominio.com.br/install.html`
4. Siga os 4 passos do instalador

### Opção 2: Instalação Manual

```bash
# 1. Navegue até a pasta
cd /www/wwwroot/sinuca

# 2. Configure o .env
cp .env.example .env
nano .env  # Preencha as credenciais

# 3. Instale dependências
npm install --production

# 4. Inicie com PM2
pm2 start ecosystem.config.js
pm2 save
```

---

## 📁 Estrutura do Pacote

```
deploy_producao/
├── dist/                 # Código compilado (pronto para rodar)
│   ├── client/           # Frontend (HTML, JS, CSS)
│   └── server/           # Backend Node.js
├── public/               # Arquivos públicos + instalador
│   ├── install.html      # Instalador visual
│   └── install-api.php   # API do instalador
├── supabase/             # Migrations do banco de dados
├── logs/                 # Logs do PM2
├── uploads/              # Uploads de usuários
├── package.json          # Dependências (produção)
├── ecosystem.config.js   # Configuração PM2
├── nginx.conf.example    # Configuração Nginx
├── .env.example          # Template de variáveis
└── README.md             # Este arquivo
```

---

## ⚙️ Configuração do Nginx

Após instalar, configure o Nginx no aaPanel:

1. Website → Seu site → Config
2. Cole o conteúdo de `nginx.conf.example`
3. Substitua `seudominio.com.br` pelo seu domínio
4. Salve e reinicie o Nginx

---

## 🔒 Ativar SSL (HTTPS)

1. Website → Seu site → SSL
2. Let's Encrypt → Apply
3. Force HTTPS → On

---

## 📊 Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `pm2 status` | Ver status |
| `pm2 logs` | Ver logs |
| `pm2 restart sinuca-server` | Reiniciar |
| `pm2 stop sinuca-server` | Parar |

---

## 🗃️ Banco de Dados

Execute as migrations do Supabase:

1. Acesse app.supabase.com → SQL Editor
2. Execute os arquivos de `supabase/migrations/` em ordem

---

**Versão**: 1.0.0  
**Data**: Janeiro 2026
