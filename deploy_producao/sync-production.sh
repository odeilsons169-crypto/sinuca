#!/bin/bash

# ================================================
# 🔄 SINUCA GAME - Script de Sincronização
# Sincroniza o ambiente de produção com o desenvolvimento
# ================================================

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}🔄 =============================================${NC}"
echo -e "${BLUE}   SINUCA GAME - Sincronização de Produção${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

# Configurações (edite conforme necessário)
PRODUCTION_HOST=""
PRODUCTION_USER="root"
PRODUCTION_PATH="/www/wwwroot/sinuca"
PRODUCTION_PORT="22"

# Verificar se as configurações foram definidas
if [ -z "$PRODUCTION_HOST" ]; then
    echo -e "${YELLOW}📝 Configure as variáveis de conexão:${NC}"
    echo ""
    read -p "Host do servidor (IP ou domínio): " PRODUCTION_HOST
    read -p "Usuário SSH [root]: " input_user
    PRODUCTION_USER=${input_user:-root}
    read -p "Caminho no servidor [/www/wwwroot/sinuca]: " input_path
    PRODUCTION_PATH=${input_path:-/www/wwwroot/sinuca}
    read -p "Porta SSH [22]: " input_port
    PRODUCTION_PORT=${input_port:-22}
    echo ""
fi

# Funções
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Menu de opções
show_menu() {
    echo ""
    echo "Escolha uma opção:"
    echo ""
    echo "  1) 📥 Sincronizar código (git pull no servidor)"
    echo "  2) 🔨 Atualizar e recompilar (git pull + build)"
    echo "  3) 🚀 Deploy completo (pull + install + build + restart)"
    echo "  4) 📊 Ver status do servidor"
    echo "  5) 📜 Ver logs do PM2"
    echo "  6) 🔄 Reiniciar servidor"
    echo "  7) 💾 Criar backup remoto"
    echo "  8) ↩️  Restaurar backup"
    echo "  9) 🔧 Executar migrations SQL"
    echo "  0) ❌ Sair"
    echo ""
    read -p "Opção: " choice
    
    case $choice in
        1) sync_code ;;
        2) update_and_build ;;
        3) full_deploy ;;
        4) check_status ;;
        5) view_logs ;;
        6) restart_server ;;
        7) create_backup ;;
        8) restore_backup ;;
        9) run_migrations ;;
        0) exit 0 ;;
        *) log_error "Opção inválida"; show_menu ;;
    esac
}

# Executar comando remoto
remote_exec() {
    ssh -p $PRODUCTION_PORT $PRODUCTION_USER@$PRODUCTION_HOST "$1"
}

# 1. Sincronizar código
sync_code() {
    log_info "Sincronizando código do repositório..."
    
    remote_exec "cd $PRODUCTION_PATH && git stash && git pull origin main"
    
    log_success "Código sincronizado!"
    show_menu
}

# 2. Atualizar e recompilar
update_and_build() {
    log_info "Atualizando e recompilando..."
    
    remote_exec "cd $PRODUCTION_PATH && git stash && git pull origin main && npm run build"
    
    log_success "Projeto atualizado e compilado!"
    show_menu
}

# 3. Deploy completo
full_deploy() {
    log_warning "Iniciando deploy completo. Isso pode demorar alguns minutos..."
    echo ""
    
    # Backup
    log_info "Criando backup..."
    remote_exec "cd $PRODUCTION_PATH && mkdir -p backups && cp -r dist backups/dist_\$(date +%Y%m%d_%H%M%S) 2>/dev/null || true"
    
    # Git pull
    log_info "Baixando atualizações..."
    remote_exec "cd $PRODUCTION_PATH && git stash && git pull origin main"
    
    # npm install
    log_info "Instalando dependências..."
    remote_exec "cd $PRODUCTION_PATH && npm install"
    
    # Build
    log_info "Compilando projeto..."
    remote_exec "cd $PRODUCTION_PATH && npm run build"
    
    # Restart
    log_info "Reiniciando servidor..."
    remote_exec "cd $PRODUCTION_PATH && pm2 restart sinuca-server || pm2 start ecosystem.config.js"
    
    log_success "Deploy completo finalizado!"
    echo ""
    
    # Verificar status
    check_status
}

# 4. Ver status
check_status() {
    log_info "Status do servidor:"
    echo ""
    
    remote_exec "pm2 status sinuca-server"
    echo ""
    
    log_info "Versão instalada:"
    remote_exec "cd $PRODUCTION_PATH && cat package.json | grep version | head -1"
    echo ""
    
    log_info "Último commit:"
    remote_exec "cd $PRODUCTION_PATH && git log -1 --oneline"
    echo ""
    
    show_menu
}

# 5. Ver logs
view_logs() {
    log_info "Exibindo logs (Ctrl+C para sair)..."
    echo ""
    
    remote_exec "pm2 logs sinuca-server --lines 50"
    
    show_menu
}

# 6. Reiniciar servidor
restart_server() {
    log_info "Reiniciando servidor..."
    
    remote_exec "cd $PRODUCTION_PATH && pm2 restart sinuca-server"
    
    log_success "Servidor reiniciado!"
    show_menu
}

# 7. Criar backup
create_backup() {
    log_info "Criando backup..."
    
    BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
    remote_exec "cd $PRODUCTION_PATH && mkdir -p backups/$BACKUP_NAME && cp -r dist backups/$BACKUP_NAME/ && cp .env backups/$BACKUP_NAME/ 2>/dev/null || true"
    
    log_success "Backup criado: $BACKUP_NAME"
    show_menu
}

# 8. Restaurar backup
restore_backup() {
    log_info "Backups disponíveis:"
    remote_exec "ls -la $PRODUCTION_PATH/backups/"
    echo ""
    
    read -p "Nome do backup para restaurar: " backup_name
    
    if [ -n "$backup_name" ]; then
        log_info "Restaurando $backup_name..."
        remote_exec "cd $PRODUCTION_PATH && rm -rf dist && cp -r backups/$backup_name/dist . && pm2 restart sinuca-server"
        log_success "Backup restaurado!"
    else
        log_error "Nome do backup não informado"
    fi
    
    show_menu
}

# 9. Executar migrations
run_migrations() {
    log_info "As migrations devem ser executadas diretamente no Supabase Dashboard."
    echo ""
    echo "1. Acesse: https://app.supabase.com"
    echo "2. Vá em: SQL Editor"
    echo "3. Execute os arquivos de: supabase/migrations/"
    echo ""
    
    log_warning "O banco de dados é compartilhado entre desenvolvimento e produção."
    
    show_menu
}

# Verificar conexão SSH
test_connection() {
    log_info "Testando conexão SSH..."
    
    if ssh -p $PRODUCTION_PORT -o ConnectTimeout=5 $PRODUCTION_USER@$PRODUCTION_HOST "echo 'Conexão OK'" 2>/dev/null; then
        log_success "Conexão SSH estabelecida!"
        return 0
    else
        log_error "Não foi possível conectar ao servidor."
        echo ""
        echo "Verifique:"
        echo "  - Host: $PRODUCTION_HOST"
        echo "  - Usuário: $PRODUCTION_USER"
        echo "  - Porta: $PRODUCTION_PORT"
        echo "  - Chave SSH configurada"
        echo ""
        exit 1
    fi
}

# Main
test_connection
show_menu
