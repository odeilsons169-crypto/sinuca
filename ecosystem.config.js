const path = require('path');
const fs = require('fs');

// Configuração do servidor para produção
// Backend e Frontend rodam no mesmo domínio
module.exports = {
    apps: [{
        name: 'sinuca-server',
        script: './dist/server/index.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '500M',
        env: {
            NODE_ENV: 'production',
            PORT: 3000
        },
        error_file: './logs/error.log',
        out_file: './logs/out.log',
        log_file: './logs/combined.log',
        time: true
    }]
};
