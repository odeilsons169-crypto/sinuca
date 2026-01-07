import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const deployDir = path.join(rootDir, 'deploy_producao');

async function prepare() {
    console.log('🚀 Iniciando preparação para o deploy (MODO PRODUÇÃO)...');

    // 1. Limpar pastas antigas
    if (fs.existsSync(deployDir)) {
        console.log('🧹 Limpando deploy_producao...');
        fs.rmSync(deployDir, { recursive: true, force: true });
    }

    // 2. Build do projeto
    console.log('📦 Gerando build completo (Vite + TSC)...');
    try {
        execSync('npm run build', { stdio: 'inherit', cwd: rootDir });
    } catch (err) {
        console.warn('⚠️ Build terminou com avisos/erros de tipo, mas tentaremos continuar...');
    }

    // 3. Criar pasta de deploy
    fs.mkdirSync(deployDir, { recursive: true });

    // 4. Copiar dist
    console.log('📂 Copiando arquivos do build...');
    if (fs.existsSync(path.join(rootDir, 'dist'))) {
        fs.cpSync(path.join(rootDir, 'dist'), path.join(deployDir, 'dist'), { recursive: true });
    } else {
        console.error('❌ Erro: Pasta dist não encontrada! O build falhou.');
        process.exit(1);
    }

    // 5. Copiar package files
    console.log('📄 Configurando dependências...');
    fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(deployDir, 'package.json'));
    fs.copyFileSync(path.join(rootDir, 'package-lock.json'), path.join(deployDir, 'package-lock.json'));

    // 6. Garantir pastas de sistema
    console.log('📁 Criando diretórios persistentes...');
    fs.mkdirSync(path.join(deployDir, 'dist', 'uploads', 'avatars'), { recursive: true });
    fs.writeFileSync(path.join(deployDir, 'dist', 'uploads', '.gitkeep'), '');

    // 7. Criar .env.example completo
    console.log('🔧 Gerando template de variáveis de ambiente...');
    const envContent = `# CONFIGURAÇÕES DO SERVIDOR (PRODUÇÃO)
PORT=3000
NODE_ENV=production

# SUPABASE (NECESSÁRIO)
VITE_SUPABASE_URL=https://sua-url.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_URL=https://sua-url.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_KEY=sua-chave-service-role

# CONFIGURAÇÕES ADICIONAIS
CORS_ORIGIN=https://seu-dominio.com.br
`;
    fs.writeFileSync(path.join(deployDir, '.env.example'), envContent);

    // 8. Criar script de execução rápida PM2 (opcional mas recomendado)
    console.log('⚙️ Gerando configuração do PM2...');
    const pm2Config = `module.exports = {
  apps: [{
    name: 'sinuca-online',
    script: 'dist/server/index.js',
    instances: '1',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};`;
    fs.writeFileSync(path.join(deployDir, 'ecosystem.config.cjs'), pm2Config);

    console.log('\n====================================================');
    console.log('✅ PROJETO PRONTO PARA PRODUÇÃO!');
    console.log('====================================================');
    console.log('A pasta "deploy_producao" contém tudo que você precisa.');
    console.log('Passos para subir:');
    console.log('1. Suba o conteúdo da pasta "deploy_producao" para o seu servidor.');
    console.log('2. No servidor, renomeie ".env.example" para ".env" e preencha os dados.');
    console.log('3. Execute: npm install --omit=dev');
    console.log('4. Execute: npm start');
    console.log('====================================================\n');
}

prepare().catch(console.error);
