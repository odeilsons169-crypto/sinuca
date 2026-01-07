// ================================================
// 🎱 SINUCA GAME - Service Worker (PWA)
// ================================================

const CACHE_NAME = 'sinuca-v1.0.0';
const STATIC_CACHE = 'sinuca-static-v1';
const DYNAMIC_CACHE = 'sinuca-dynamic-v1';

// Arquivos para cache estático (offline first)
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// Arquivos que nunca devem ser cacheados
const NEVER_CACHE = [
    '/api/',
    '/socket.io/',
    '/install.html',
    '/install-api.php',
    '/update.html',
    '/update-api.php'
];

// Instalação - cachear arquivos estáticos
self.addEventListener('install', (event) => {
    console.log('[SW] Instalando Service Worker...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Cacheando arquivos estáticos');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Service Worker instalado!');
                return self.skipWaiting();
            })
            .catch((err) => {
                console.error('[SW] Erro na instalação:', err);
            })
    );
});

// Ativação - limpar caches antigos
self.addEventListener('activate', (event) => {
    console.log('[SW] Ativando Service Worker...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('[SW] Removendo cache antigo:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] Service Worker ativado!');
                return self.clients.claim();
            })
    );
});

// Fetch - estratégia de cache
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignorar requisições para outros domínios
    if (url.origin !== location.origin) {
        return;
    }

    // Nunca cachear APIs e WebSocket
    if (NEVER_CACHE.some(path => url.pathname.startsWith(path))) {
        event.respondWith(fetch(request));
        return;
    }

    // Estratégia: Network First com fallback para cache
    if (request.method === 'GET') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cachear resposta válida
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(DYNAMIC_CACHE).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback para cache se offline
                    return caches.match(request).then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }

                        // Fallback final para páginas HTML
                        if (request.headers.get('accept').includes('text/html')) {
                            return caches.match('/index.html');
                        }

                        return new Response('Offline', { status: 503 });
                    });
                })
        );
    }
});

// Push Notifications (para futuro)
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();

    const options = {
        body: data.body || 'Nova notificação',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        },
        actions: [
            { action: 'open', title: 'Abrir' },
            { action: 'close', title: 'Fechar' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Sinuca Online', options)
    );
});

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'close') return;

    const url = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Se já tem uma janela aberta, focar nela
                for (const client of clientList) {
                    if (client.url.includes(location.origin) && 'focus' in client) {
                        client.navigate(url);
                        return client.focus();
                    }
                }
                // Senão, abrir nova janela
                return clients.openWindow(url);
            })
    );
});

// Background Sync (para futuro - enviar dados offline)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-matches') {
        console.log('[SW] Sincronizando partidas offline...');
        // Implementar sincronização de dados offline
    }
});

console.log('[SW] Service Worker carregado!');
