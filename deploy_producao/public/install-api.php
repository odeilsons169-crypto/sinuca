<?php
/**
 * 🎱 SINUCA GAME - API de Instalação
 * 
 * Este script processa as requisições do instalador web.
 * IMPORTANTE: Delete este arquivo após a instalação!
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Prevenir acesso se já estiver instalado
if (file_exists(__DIR__ . '/.installed') && !isset($_GET['force'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Sistema já instalado. Delete o arquivo .installed para reinstalar.']);
    exit;
}

// Diretório do projeto
$projectDir = dirname(__DIR__);

// Receber dados JSON
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'check_requirements':
            checkRequirements();
            break;
            
        case 'save_env':
            saveEnvFile($input['config'] ?? []);
            break;
            
        case 'npm_install':
            runNpmInstall();
            break;
            
        case 'npm_build':
            runNpmBuild();
            break;
            
        case 'start_server':
            startServer();
            break;
            
        case 'finalize':
            finalizeInstallation();
            break;
            
        default:
            echo json_encode(['success' => false, 'error' => 'Ação inválida']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

/**
 * Verificar requisitos do sistema
 */
function checkRequirements() {
    global $projectDir;
    
    $checks = [
        'php' => version_compare(PHP_VERSION, '7.4.0', '>='),
        'node' => checkCommand('node -v'),
        'npm' => checkCommand('npm -v'),
        'write' => is_writable($projectDir),
        'env' => is_writable($projectDir) || file_exists($projectDir . '/.env'),
    ];
    
    $allPassed = !in_array(false, $checks, true);
    
    echo json_encode([
        'success' => true,
        'checks' => $checks,
        'all_passed' => $allPassed,
        'php_version' => PHP_VERSION,
    ]);
}

/**
 * Verificar se um comando existe
 */
function checkCommand($command) {
    $output = [];
    $return = null;
    exec($command . ' 2>&1', $output, $return);
    return $return === 0;
}

/**
 * Salvar arquivo .env
 */
function saveEnvFile($config) {
    global $projectDir;
    
    if (empty($config['supabase_url']) || empty($config['supabase_anon']) || empty($config['supabase_service'])) {
        throw new Exception('Credenciais do Supabase são obrigatórias');
    }
    
    if (empty($config['jwt_secret'])) {
        throw new Exception('JWT Secret é obrigatório');
    }
    
    if (empty($config['site_url'])) {
        throw new Exception('URL do site é obrigatória');
    }
    
    $envContent = "# ================================================
# 🎱 SINUCA GAME - Configuração de Produção
# Gerado automaticamente pelo instalador
# Data: " . date('Y-m-d H:i:s') . "
# ================================================

# Servidor
PORT=3000
NODE_ENV=production

# Supabase
SUPABASE_URL={$config['supabase_url']}
SUPABASE_ANON_KEY={$config['supabase_anon']}
SUPABASE_SERVICE_KEY={$config['supabase_service']}

# JWT
JWT_SECRET={$config['jwt_secret']}

# URLs
VITE_API_URL={$config['site_url']}
APP_URL={$config['site_url']}

# Admin Setup
ADMIN_SETUP_KEY=SINUCA_SETUP_" . date('Y') . "_" . bin2hex(random_bytes(8)) . "
";
    
    $envFile = $projectDir . '/.env';
    
    if (file_put_contents($envFile, $envContent) === false) {
        throw new Exception('Erro ao salvar arquivo .env. Verifique as permissões.');
    }
    
    // Proteger o arquivo
    chmod($envFile, 0600);
    
    echo json_encode(['success' => true, 'message' => 'Arquivo .env salvo com sucesso']);
}

/**
 * Executar npm install
 */
function runNpmInstall() {
    global $projectDir;
    
    $output = [];
    $return = null;
    
    // Tentar encontrar o npm
    $npmPath = findNpmPath();
    
    $command = "cd {$projectDir} && {$npmPath} install --production=false 2>&1";
    exec($command, $output, $return);
    
    if ($return !== 0) {
        throw new Exception('Erro ao instalar dependências: ' . implode("\n", array_slice($output, -10)));
    }
    
    echo json_encode(['success' => true, 'message' => 'Dependências instaladas', 'output' => $output]);
}

/**
 * Executar npm run build
 */
function runNpmBuild() {
    global $projectDir;
    
    $output = [];
    $return = null;
    
    $npmPath = findNpmPath();
    
    $command = "cd {$projectDir} && {$npmPath} run build 2>&1";
    exec($command, $output, $return);
    
    if ($return !== 0) {
        throw new Exception('Erro ao compilar projeto: ' . implode("\n", array_slice($output, -10)));
    }
    
    echo json_encode(['success' => true, 'message' => 'Projeto compilado', 'output' => $output]);
}

/**
 * Iniciar servidor com PM2
 */
function startServer() {
    global $projectDir;
    
    $output = [];
    $return = null;
    
    // Verificar se PM2 está instalado
    if (!checkCommand('pm2 -v')) {
        // Tentar instalar PM2
        exec('npm install -g pm2 2>&1', $output, $return);
    }
    
    // Parar instância anterior se existir
    exec("cd {$projectDir} && pm2 delete sinuca-server 2>&1");
    
    // Criar pasta de logs
    if (!is_dir($projectDir . '/logs')) {
        mkdir($projectDir . '/logs', 0755, true);
    }
    
    // Iniciar com PM2 usando ecosystem.config.js
    $command = "cd {$projectDir} && pm2 start ecosystem.config.js 2>&1";
    exec($command, $output, $return);
    
    if ($return !== 0) {
        // Fallback: iniciar diretamente
        $command = "cd {$projectDir} && pm2 start dist/server/index.js --name sinuca-server 2>&1";
        exec($command, $output, $return);
    }
    
    // Salvar configuração do PM2
    exec('pm2 save 2>&1');
    
    // Configurar startup
    exec('pm2 startup 2>&1');
    
    echo json_encode(['success' => true, 'message' => 'Servidor iniciado', 'output' => $output]);
}

/**
 * Finalizar instalação
 */
function finalizeInstallation() {
    global $projectDir;
    
    // Criar arquivo de marcação de instalação completa
    $installInfo = [
        'installed_at' => date('Y-m-d H:i:s'),
        'version' => '1.0.0',
        'php_version' => PHP_VERSION,
    ];
    
    file_put_contents($projectDir . '/.installed', json_encode($installInfo, JSON_PRETTY_PRINT));
    
    // Criar pasta de uploads se não existir
    $uploadsDir = $projectDir . '/uploads/avatars';
    if (!is_dir($uploadsDir)) {
        mkdir($uploadsDir, 0755, true);
    }
    
    echo json_encode([
        'success' => true, 
        'message' => 'Instalação finalizada!',
        'next_steps' => [
            'Configure o Nginx no aaPanel usando o arquivo nginx.conf.example',
            'Ative o SSL em Website → Seu site → SSL → Let\'s Encrypt',
            'Acesse o jogo!'
        ]
    ]);
}

/**
 * Encontrar caminho do NPM
 */
function findNpmPath() {
    $paths = [
        'npm',
        '/usr/bin/npm',
        '/usr/local/bin/npm',
        '/www/server/nodejs/v18.*/bin/npm',
        '/www/server/nodejs/v20.*/bin/npm',
    ];
    
    foreach ($paths as $path) {
        if (strpos($path, '*') !== false) {
            $matches = glob($path);
            if (!empty($matches)) {
                return $matches[0];
            }
        } elseif (file_exists($path) || checkCommand("which {$path}")) {
            return $path;
        }
    }
    
    return 'npm';
}
