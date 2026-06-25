// Service Worker untuk AEON Mobile Tools PWA
const CACHE_NAME = 'aeon-tools-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    '/css/app.css',
    '/css/theme.css',
    '/css/components.css',
    '/css/login.css',
    '/css/dashboard.css',
    '/js/app.js',
    '/js/router.js',
    '/js/config.js',
    '/js/storage.js',
    '/js/auth.js',
    '/js/ui.js',
    '/js/api.js',
    '/js/pwa.js',
    '/pages/login.html',
    '/pages/dashboard.html',
    '/pages/splash.html',
    '/pages/settings.html',
    '/pages/download.html',
    '/pages/history.html',
    '/pages/about.html',
    '/pages/price-checker.html',
    '/database/indexeddb.js',
    '/assets/logo.svg'
];

// Install Service Worker
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching assets...');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('[Service Worker] Install complete!');
                return self.skipWaiting();
            })
    );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Claiming clients...');
            return self.clients.claim();
        })
    );
});

// Fetch Strategy: Cache First, then Network
self.addEventListener('fetch', (event) => {
    console.log('[Service Worker] Fetching:', event.request.url);
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Return cached response if available
                if (cachedResponse) {
                    console.log('[Service Worker] Serving from cache:', event.request.url);
                    return cachedResponse;
                }

                // Otherwise fetch from network
                console.log('[Service Worker] Fetching from network:', event.request.url);
                return fetch(event.request)
                    .then((response) => {
                        // Cache the fetched response for future use
                        if (response && response.status === 200) {
                            const clonedResponse = response.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, clonedResponse);
                                });
                        }
                        return response;
                    })
                    .catch((error) => {
                        console.error('[Service Worker] Fetch failed:', error);
                        // Return fallback page if available
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        return new Response('Offline - Please connect to the internet', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});