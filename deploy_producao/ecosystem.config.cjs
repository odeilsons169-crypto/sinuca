module.exports = {
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
};