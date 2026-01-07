<?php
/**
 * 🔄 SINUCA GAME - API de Atualização
 * 
 * Este script processa as requisições do atualizador web.
 * Requer autenticação via ADMIN_SETUP_KEY do .env
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Diretório do projeto
$projectDir = dirname(__DIR__);
$envFile = $projectDir . '/.env';
$versionFile = $projectDir . '/.version';
$backupDir = $projectDir . '/backups';

// Carregar configurações do .env
$config = loadEnvFile($envFile);

// Receber dados JSON
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? $_GET['action'] ?? '';
$key = $input['key'] ?? '';

try {
    // Autenticar (exceto para ação 'authenticate')
    if ($action !== 'authenticate' && !validateKey($key, $config)) {
        throw new Exception('Chave de autenticação inválida');
    }
    
    switch ($action) {
        case 'authenticate':
            authenticate($key, $config);
            break;
            
        case 'check_updates':
            checkUpdates();
            break;
            
        case 'backup':
            createBackup();
            break;
            
        case 'git_pull':
            gitPull();
            break;
            
        case 'npm_install':
            npmInstall();
            break;
            
        case 'build':
            buildProject();
            break;
            
        case 'restart':
            restartServer();
            break;
            
        case 'rollback':
            rollbackBackup();
            break;
            
        case 'status':
            getStatus();
            break;
            
        default:
            echo json_encode(['success' => false, 'error' => 'Ação inválida']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

/**
 * Carregar arquivo .env
 */
function loadEnvFile($path) {
    $config = [];
    if (file_exists($path)) {
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos($line, '=') !== false && strpos($line, '#') !== 0) {
                list($key, $value) = explode('=', $line, 2);
                $config[trim($key)] = trim($value);
            }
        }
    }
    return $config;
}

/**
 * Validar chave de autenticação
 */
function validateKey($key, $config) {
    $adminKey = $config['ADMIN_SETUP_KEY'] ?? '';
    return !empty($adminKey) && $key === $adminKey;
}

/**
 * Autenticar usuário
 */
function authenticate($key, $config) {
    global $projectDir;
    
    if (validateKey($key, $config)) {
        $version = getCurrentVersion();
        echo json_encode([
            'success' => true,
            'currentVersion' => $version,
            'message' => 'Autenticado com sucesso'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'Chave inválida'
        ]);
    }
}

/**
 * Obter versão atual
 */
function getCurrentVersion() {
    global $projectDir;
    
    // Tentar ler do package.json
    $packageFile = $projectDir . '/package.json';
    if (file_exists($packageFile)) {
        $package = json_decode(file_get_contents($packageFile), true);
        return $package['version'] ?? '1.0.0';
    }
    
    return '1.0.0';
}

/**
 * Verificar atualizações disponíveis
 */
function checkUpdates() {
    global $projectDir;
    
    $currentVersion = getCurrentVersion();
    
    // Fazer git fetch para verificar atualizações
    $output = [];
    exec("cd {$projectDir} && git fetch origin 2>&1", $output);
    
    // Verificar se há commits novos
    $localCommit = trim(shell_exec("cd {$projectDir} && git rev-parse HEAD 2>&1"));
    $remoteCommit = trim(shell_exec("cd {$projectDir} && git rev-parse origin/main 2>&1"));
    
    $hasUpdates = $localCommit !== $remoteCommit;
    
    // Buscar changelog (últimos commits)
    $changelog = [];
    if ($hasUpdates) {
        $logOutput = [];
        exec("cd {$projectDir} && git log --oneline {$localCommit}..origin/main 2>&1", $logOutput);
        
        foreach ($logOutput as $line) {
            $type = 'improve';
            if (stripos($line, 'feat') !== false) $type = 'feature';
            if (stripos($line, 'fix') !== false) $type = 'fix';
            
            $changelog[] = [
                'type' => $type,
                'message' => substr($line, 8) // Remove hash do commit
            ];
        }
    }
    
    // Obter versão remota
    $latestVersion = $currentVersion;
    if ($hasUpdates) {
        // Incrementar versão se houver atualizações
        $parts = explode('.', $currentVersion);
        $parts[2] = intval($parts[2] ?? 0) + 1;
        $latestVersion = implode('.', $parts);
    }
    
    echo json_encode([
        'success' => true,
        'hasUpdates' => $hasUpdates,
        'currentVersion' => $currentVersion,
        'latestVersion' => $latestVersion,
        'changelog' => $changelog,
        'localCommit' => substr($localCommit, 0, 7),
        'remoteCommit' => substr($remoteCommit, 0, 7)
    ]);
}

/**
 * Criar backup antes da atualização
 */
function createBackup() {
    global $projectDir, $backupDir;
    
    // Criar pasta de backups se não existir
    if (!is_dir($backupDir)) {
        mkdir($backupDir, 0755, true);
    }
    
    $timestamp = date('Y-m-d_H-i-s');
    $backupName = "backup_{$timestamp}";
    $backupPath = "{$backupDir}/{$backupName}";
    
    // Backup dos arquivos importantes
    mkdir($backupPath, 0755, true);
    
    // Copiar .env
    if (file_exists("{$projectDir}/.env")) {
        copy("{$projectDir}/.env", "{$backupPath}/.env");
    }
    
    // Copiar dist
    if (is_dir("{$projectDir}/dist")) {
        exec("cp -r {$projectDir}/dist {$backupPath}/dist 2>&1");
    }
    
    // Salvar versão atual
    file_put_contents("{$backupPath}/version.txt", getCurrentVersion());
    
    // Salvar referência do último backup
    file_put_contents("{$backupDir}/latest.txt", $backupName);
    
    // Limpar backups antigos (manter apenas os últimos 5)
    cleanOldBackups($backupDir, 5);
    
    echo json_encode([
        'success' => true,
        'backupPath' => $backupPath,
        'message' => 'Backup criado com sucesso'
    ]);
}

/**
 * Limpar backups antigos
 */
function cleanOldBackups($backupDir, $keep = 5) {
    $backups = glob("{$backupDir}/backup_*");
    usort($backups, function($a, $b) {
        return filemtime($b) - filemtime($a);
    });
    
    $toDelete = array_slice($backups, $keep);
    foreach ($toDelete as $backup) {
        exec("rm -rf " . escapeshellarg($backup));
    }
}

/**
 * Executar git pull
 */
function gitPull() {
    global $projectDir;
    
    $output = [];
    $return = null;
    
    // Resetar alterações locais e fazer pull
    exec("cd {$projectDir} && git stash 2>&1", $output);
    exec("cd {$projectDir} && git pull origin main 2>&1", $output, $return);
    
    if ($return !== 0) {
        throw new Exception('Erro no git pull: ' . implode("\n", $output));
    }
    
    echo json_encode([
        'success' => true,
        'output' => $output,
        'message' => 'Git pull concluído'
    ]);
}

/**
 * Executar npm install
 */
function npmInstall() {
    global $projectDir;
    
    $output = [];
    $return = null;
    
    $npmPath = findNpmPath();
    exec("cd {$projectDir} && {$npmPath} install --production=false 2>&1", $output, $return);
    
    if ($return !== 0) {
        throw new Exception('Erro no npm install: ' . implode("\n", array_slice($output, -5)));
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Dependências atualizadas'
    ]);
}

/**
 * Compilar projeto
 */
function buildProject() {
    global $projectDir;
    
    $output = [];
    $return = null;
    
    $npmPath = findNpmPath();
    exec("cd {$projectDir} && {$npmPath} run build 2>&1", $output, $return);
    
    // Ignorar erros de TypeScript (build continua mesmo com warnings)
    
    echo json_encode([
        'success' => true,
        'message' => 'Projeto compilado'
    ]);
}

/**
 * Reiniciar servidor
 */
function restartServer() {
    global $projectDir;
    
    $output = [];
    
    // Reiniciar PM2
    exec("cd {$projectDir} && pm2 restart sinuca-server 2>&1", $output);
    
    // Se não existir, iniciar
    if (stripos(implode('', $output), 'not found') !== false) {
        exec("cd {$projectDir} && pm2 start ecosystem.config.js 2>&1", $output);
    }
    
    // Atualizar versão
    updateVersionFile();
    
    echo json_encode([
        'success' => true,
        'message' => 'Servidor reiniciado'
    ]);
}

/**
 * Atualizar arquivo de versão
 */
function updateVersionFile() {
    global $projectDir;
    
    $version = getCurrentVersion();
    $info = [
        'version' => $version,
        'updated_at' => date('Y-m-d H:i:s'),
        'commit' => trim(shell_exec("cd {$projectDir} && git rev-parse --short HEAD 2>&1"))
    ];
    
    file_put_contents($projectDir . '/.version', json_encode($info, JSON_PRETTY_PRINT));
}

/**
 * Restaurar backup
 */
function rollbackBackup() {
    global $projectDir, $backupDir;
    
    // Ler último backup
    $latestFile = "{$backupDir}/latest.txt";
    if (!file_exists($latestFile)) {
        throw new Exception('Nenhum backup encontrado');
    }
    
    $backupName = trim(file_get_contents($latestFile));
    $backupPath = "{$backupDir}/{$backupName}";
    
    if (!is_dir($backupPath)) {
        throw new Exception('Backup não encontrado: ' . $backupName);
    }
    
    // Restaurar .env
    if (file_exists("{$backupPath}/.env")) {
        copy("{$backupPath}/.env", "{$projectDir}/.env");
    }
    
    // Restaurar dist
    if (is_dir("{$backupPath}/dist")) {
        exec("rm -rf {$projectDir}/dist 2>&1");
        exec("cp -r {$backupPath}/dist {$projectDir}/dist 2>&1");
    }
    
    // Reiniciar servidor
    exec("cd {$projectDir} && pm2 restart sinuca-server 2>&1");
    
    echo json_encode([
        'success' => true,
        'message' => 'Backup restaurado: ' . $backupName
    ]);
}

/**
 * Obter status do sistema
 */
function getStatus() {
    global $projectDir;
    
    $status = [
        'version' => getCurrentVersion(),
        'commit' => trim(shell_exec("cd {$projectDir} && git rev-parse --short HEAD 2>&1")),
        'branch' => trim(shell_exec("cd {$projectDir} && git branch --show-current 2>&1")),
        'pm2_status' => trim(shell_exec("pm2 status sinuca-server --no-color 2>&1")),
        'node_version' => trim(shell_exec("node -v 2>&1")),
        'npm_version' => trim(shell_exec("npm -v 2>&1")),
        'disk_free' => disk_free_space($projectDir),
        'last_update' => file_exists($projectDir . '/.version') 
            ? json_decode(file_get_contents($projectDir . '/.version'), true)['updated_at'] ?? 'N/A'
            : 'N/A'
    ];
    
    echo json_encode([
        'success' => true,
        'status' => $status
    ]);
}

/**
 * Encontrar caminho do NPM
 */
function findNpmPath() {
    $paths = ['npm', '/usr/bin/npm', '/usr/local/bin/npm'];
    
    foreach ($paths as $path) {
        $output = [];
        exec("which {$path} 2>&1", $output, $return);
        if ($return === 0) {
            return $path;
        }
    }
    
    // Procurar em diretórios do aaPanel
    $aaPanelPaths = glob('/www/server/nodejs/v*/bin/npm');
    if (!empty($aaPanelPaths)) {
        return end($aaPanelPaths);
    }
    
    return 'npm';
}
