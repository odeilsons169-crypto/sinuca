#!/bin/bash

# ================================================
# 🎱 SINUCA GAME - Script de Instalação Automática
# Para servidores com aaPanel
# ================================================

set -e

echo ""
echo "🎱 ============================================="
echo "   SINUCA GAME - Instalador de Produção"
echo "   Para aaPanel / Node.js"
echo "============================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se está rodando como root ou com sudo
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}❌ Execute este script como root ou com sudo${NC}"
  exit 1
fi

# Diretório atual
PROJECT_DIR=$(pwd)

echo -e "${YELLOW}📁 Diretório do projeto: $PROJECT_DIR${NC}"

# 1. Verificar Node.js
echo ""
echo "🔍 Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✅ Node.js instalado: $NODE_VERSION${NC}"
else
    echo -e "${RED}❌ Node.js não encontrado. Instale via aaPanel → App Store → Node.js${NC}"
    exit 1
fi

# 2. Verificar PM2
echo ""
echo "🔍 Verificando PM2..."
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✅ PM2 instalado${NC}"
else
    echo "📦 Instalando PM2..."
    npm install -g pm2
    echo -e "${GREEN}✅ PM2 instalado com sucesso${NC}"
fi

# 3. Instalar dependências
echo ""
echo "📦 Instalando dependências do projeto..."
npm install --production=false
echo -e "${GREEN}✅ Dependências instaladas${NC}"

# 4. Verificar arquivo .env
echo ""
echo "🔧 Verificando configuração..."
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado. Criando a partir do exemplo...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}📝 Edite o arquivo .env com suas credenciais do Supabase!${NC}"
        echo "   nano $PROJECT_DIR/.env"
    else
        echo -e "${RED}❌ Arquivo .env.example não encontrado!${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Arquivo .env encontrado${NC}"
fi

# 5. Criar pasta de logs
echo ""
echo "📁 Criando pasta de logs..."
mkdir -p logs
chmod 755 logs
echo -e "${GREEN}✅ Pasta de logs criada${NC}"

# 6. Criar pasta de uploads (se não existir)
echo ""
echo "📁 Verificando pasta de uploads..."
mkdir -p uploads
mkdir -p uploads/avatars
chmod -R 755 uploads
echo -e "${GREEN}✅ Pasta de uploads configurada${NC}"

# 7. Compilar o projeto
echo ""
echo "🔨 Compilando projeto para produção..."
npm run build
echo -e "${GREEN}✅ Projeto compilado com sucesso${NC}"

# 8. Parar instância anterior (se existir)
echo ""
echo "🔄 Verificando instâncias anteriores..."
pm2 delete sinuca-server 2>/dev/null || true

# 9. Iniciar com PM2
echo ""
echo "🚀 Iniciando servidor com PM2..."
pm2 start ecosystem.config.js
pm2 save

# 10. Configurar startup
echo ""
echo "⚙️  Configurando inicialização automática..."
pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup

echo ""
echo -e "${GREEN}============================================="
echo "   ✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!"
echo "=============================================${NC}"
echo ""
echo "📋 Próximos passos:"
echo ""
echo "1. Configure o arquivo .env com suas credenciais:"
echo "   nano $PROJECT_DIR/.env"
echo ""
echo "2. Configure o Nginx no aaPanel:"
echo "   - Website → Seu site → Config"
echo "   - Use o arquivo: nginx.conf.example"
echo ""
echo "3. Ative o SSL no aaPanel:"
echo "   - Website → Seu site → SSL → Let's Encrypt"
echo ""
echo "4. Reinicie o servidor após configurar o .env:"
echo "   pm2 restart sinuca-server"
echo ""
echo "📊 Comandos úteis:"
echo "   pm2 status          - Ver status do servidor"
echo "   pm2 logs            - Ver logs em tempo real"
echo "   pm2 restart all     - Reiniciar servidor"
echo ""
echo -e "${GREEN}🎱 Acesse: http://seu-dominio.com.br${NC}"
echo ""
