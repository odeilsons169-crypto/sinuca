import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
    // Redirecionar todas as rotas para index.html (SPA)
    historyApiFallback: true,
    // Desabilitar HMR para evitar recarregamentos automáticos durante o jogo
    // O jogador deve atualizar manualmente a página para ver mudanças
    hmr: false,
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: './index.html',
    },
  },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://bfazqquuxcrcdusdclwm.supabase.co'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmYXpxcXV1eGNyY2R1c2RjbHdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNDg0MzEsImV4cCI6MjA4MjcyNDQzMX0.0oaJWIF8xEppyLiW9Vhmmyx2_PIvMvJmRVEOFgkejyU'),
  },
  // Configuração para SPA - redireciona rotas não encontradas para index.html
  appType: 'spa',
});
