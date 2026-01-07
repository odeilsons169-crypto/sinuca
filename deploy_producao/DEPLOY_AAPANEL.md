# 🎱 Sinuca Game - Guia de Deploy para aaPanel

## 📋 Pré-requisitos

Antes de começar, certifique-se de que seu servidor possui:

- **aaPanel** instalado e funcionando
- **Node.js 18+** (instale via aaPanel → App Store → Node.js)
- **PM2** para gerenciamento de processos
- **Nginx** como proxy reverso
- **Acesso ao Supabase** (banco de dados externo)

---

## 🚀 Passo a Passo de Instalação

### 1. Preparar o Servidor no aaPanel

1. Acesse o **aaPanel** pelo navegador (geralmente `http://seu-ip:8888`)
2. Vá em **App Store** e instale:
   - **Node.js Version Manager** (escolha a versão 18 ou superior)
   - **PM2 Manager** (para manter o servidor rodando)
   - **Nginx** (se não estiver instalado)

### 2. Criar o Website no aaPanel

1. Vá em **Website** → **Add site**
2. Configure:
   - **Domain**: `seudominio.com.br` (ou subdomínio como `jogo.seudominio.com.br`)
   - **Root Directory**: `/www/wwwroot/sinuca`
   - **PHP Version**: Não precisa (marque "Pure Static" se disponível)
3. Clique em **Submit**

### 3. Upload dos Arquivos

**Opção A - Via Git (Recomendado):**

```bash
cd /www/wwwroot/
git clone https://github.com/odeilsons169-crypto/sinuca.git
cd sinuca
```

**Opção B - Via FTP/File Manager:**

1. No aaPanel, vá em **Files**
2. Navegue até `/www/wwwroot/sinuca`
3. Faça upload de todos os arquivos do projeto (exceto `node_modules`)

### 4. Instalar Dependências

Acesse o terminal SSH do servidor ou use o **Terminal** do aaPanel:

```bash
cd /www/wwwroot/sinuca
npm install
```

### 5. Configurar Variáveis de Ambiente

Crie o arquivo `.env` na raiz do projeto:

```bash
nano /www/wwwroot/sinuca/.env
```

Cole o seguinte conteúdo (substitua pelos seus valores reais):

```env
# Servidor
PORT=3000
NODE_ENV=production

# Supabase (Seu banco de dados)
SUPABASE_URL=https://SEU_PROJETO.supabase.co
SUPABASE_ANON_KEY=eyJhbG...sua_chave_anon...
SUPABASE_SERVICE_KEY=eyJhbG...sua_chave_service...

# JWT Secret (gere uma string aleatória longa)
JWT_SECRET=MUDE_PARA_UMA_STRING_ALEATORIA_MUITO_LONGA_123456789

# URL pública do frontend (seu domínio)
VITE_API_URL=https://seudominio.com.br
```

Salve com `Ctrl + O`, `Enter`, `Ctrl + X`.

### 6. Compilar o Projeto

```bash
cd /www/wwwroot/sinuca
npm run build
```

Isso criará a pasta `dist/` com os arquivos otimizados para produção.

### 7. Iniciar o Servidor com PM2

```bash
# Iniciar o servidor backend
pm2 start dist/server/index.js --name "sinuca-server"

# Salvar a configuração para reinício automático
pm2 save

# Configurar para iniciar no boot do servidor
pm2 startup
```

### 8. Configurar Nginx como Proxy Reverso

No aaPanel, vá em **Website** → **Configurações do seu site** → **Config** (ou **Nginx Config**).

Substitua o conteúdo pelo seguinte:

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name seudominio.com.br;

    # Certificado SSL (aaPanel gera automaticamente se você usar Let's Encrypt)
    # ssl_certificate /www/server/panel/vhost/cert/seudominio.com.br/fullchain.pem;
    # ssl_certificate_key /www/server/panel/vhost/cert/seudominio.com.br/privkey.pem;

    # Raiz do frontend (arquivos estáticos compilados)
    root /www/wwwroot/sinuca/dist/client;
    index index.html;

    # Arquivos estáticos do frontend
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy para API Backend (Node.js)
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy para WebSocket (Jogo em tempo real)
    location /socket.io {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Uploads de avatares
    location /uploads {
        alias /www/wwwroot/sinuca/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Logs
    access_log /www/wwwlogs/sinuca.access.log;
    error_log /www/wwwlogs/sinuca.error.log;
}
```

Salve e reinicie o Nginx:

```bash
nginx -t && systemctl reload nginx
```

### 9. Configurar SSL (HTTPS)

1. No aaPanel, vá em **Website** → **Configurações do seu site** → **SSL**
2. Escolha **Let's Encrypt**
3. Preencha seu email e clique em **Apply**
4. Ative **Force HTTPS**

---

## 🔧 Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `pm2 status` | Ver status do servidor |
| `pm2 logs sinuca-server` | Ver logs em tempo real |
| `pm2 restart sinuca-server` | Reiniciar o servidor |
| `pm2 stop sinuca-server` | Parar o servidor |
| `cd /www/wwwroot/sinuca && npm run build` | Recompilar após alterações |

---

## 🔄 Atualizações Futuras

Quando houver uma nova versão:

```bash
cd /www/wwwroot/sinuca

# 1. Baixar atualizações do Git
git pull origin main

# 2. Instalar novas dependências (se houver)
npm install

# 3. Recompilar
npm run build

# 4. Reiniciar o servidor
pm2 restart sinuca-server
```

---

## 📊 Configurar Banco de Dados (Supabase)

### Executar Migrations

1. Acesse o **Supabase Dashboard**: https://app.supabase.com
2. Vá em **SQL Editor**
3. Execute os scripts SQL da pasta `supabase/migrations/` em ordem numérica:
   - `20241231000000_initial_schema.sql`
   - `20250101000001_credits_system.sql`
   - `20250102000002_wallet_system.sql`
   - ... e assim por diante

### Dados Iniciais (Seed)

Execute o arquivo `supabase/seed.sql` para popular dados iniciais.

---

## 🔒 Segurança

### Checklist de Segurança:

- [ ] Altere o `JWT_SECRET` para uma string única e longa
- [ ] Nunca compartilhe o arquivo `.env`
- [ ] Ative o firewall do aaPanel (bloqueie portas desnecessárias)
- [ ] Configure backups automáticos no aaPanel
- [ ] Mantenha o Node.js e dependências atualizados

### Portas Necessárias:

| Porta | Serviço | Status |
|-------|---------|--------|
| 80 | HTTP | Aberta |
| 443 | HTTPS | Aberta |
| 3000 | Node.js (interno) | Fechada (apenas localhost) |
| 8888 | aaPanel | Restrita (seu IP apenas) |

---

## 🆘 Solução de Problemas

### Erro: "502 Bad Gateway"
- O servidor Node.js não está rodando
- Execute: `pm2 start dist/server/index.js --name sinuca-server`

### Erro: "ENOSPC: no space left on device"
- Disco cheio. Limpe logs antigos: `pm2 flush`

### Erro: "Module not found"
- Reinstale dependências: `rm -rf node_modules && npm install`

### WebSocket não funciona
- Verifique se o proxy para `/socket.io` está configurado no Nginx
- Reinicie o Nginx: `systemctl reload nginx`

---

## 📞 Suporte

- **Documentação do aaPanel**: https://www.aapanel.com/new/docs
- **Documentação do PM2**: https://pm2.keymetrics.io/docs
- **Supabase Docs**: https://supabase.com/docs

---

**Versão do Documento**: 1.0.0  
**Data**: Janeiro 2026  
**Projeto**: Sinuca Game - Pro Pool Strategy 🎱
