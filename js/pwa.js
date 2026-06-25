/**
 * PWA Module - Handles Progressive Web App functionality
 * @module pwa
 */

/**
 * Initialize PWA features
 */
export async function initPWA() {
    console.log('[PWA] Initializing...');
    
    // Check if service worker is supported
    if ('serviceWorker' in navigator) {
        try {
            // Register service worker
            const registration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/'
            });
            
            console.log('[PWA] Service Worker registered:', registration);
            
            // Handle updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('[PWA] Service Worker update found');
                
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[PWA] New Service Worker installed, ready for update');
                        // Notify user about update
                        showUpdateNotification();
                    }
                });
            });
            
            // Check for updates periodically
            setInterval(() => {
                registration.update();
            }, 3600000); // Check every hour
            
        } catch (error) {
            console.error('[PWA] Service Worker registration failed:', error);
        }
    }
    
    // Check if app can be installed
    if ('BeforeInstallPromptEvent' in window) {
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            console.log('[PWA] App can be installed');
            
            // Show install prompt when user is ready
            // This can be triggered by a button click
            window.showInstallPrompt = () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then((choiceResult) => {
                        if (choiceResult.outcome === 'accepted') {
                            console.log('[PWA] User accepted install');
                        } else {
                            console.log('[PWA] User dismissed install');
                        }
                        deferredPrompt = null;
                    });
                }
            };
        });
        
        window.addEventListener('appinstalled', () => {
            console.log('[PWA] App installed successfully');
            // Track installation
        });
    }
    
    // Check if app is installed
    checkIfInstalled();
    
    console.log('[PWA] Initialization complete');
}

/**
 * Check if app is installed (standalone mode)
 */
function checkIfInstalled() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInstalled = navigator.standalone || isStandalone;
    
    if (isInstalled) {
        console.log('[PWA] App is installed and running in standalone mode');
        document.documentElement.classList.add('pwa-installed');
    }
    
    // Listen for display mode changes
    window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
        if (e.matches) {
            document.documentElement.classList.add('pwa-installed');
        } else {
            document.documentElement.classList.remove('pwa-installed');
        }
    });
}

/**
 * Show update notification to user
 */
function showUpdateNotification() {
    // Create update notification
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-0 left-0 right-0 bg-white shadow-lg p-4 z-50';
    notification.id = 'update-notification';
    notification.style.transform = 'translateY(100%)';
    notification.style.transition = 'transform 0.3s ease';
    
    notification.innerHTML = `
        <div class="flex items-center justify-between max-w-md mx-auto">
            <div class="flex items-center gap-3">
                <span class="material-icons text-primary">system_update</span>
                <div>
                    <p class="font-medium text-gray-800">Update Available</p>
                    <p class="text-sm text-gray-500">A new version is ready to install</p>
                </div>
            </div>
            <button onclick="updateApp()" class="btn btn-primary btn-sm">
                Update
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateY(0)';
    }, 100);
    
    // Add update function
    window.updateApp = async () => {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            await registration.update();
            // Reload to apply updates
            window.location.reload();
        }
    };
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        notification.style.transform = 'translateY(100%)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 10000);
}

/**
 * Get PWA status
 */
export function getPWAStatus() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInstalled = navigator.standalone || isStandalone;
    const isOnline = navigator.onLine;
    const isServiceWorkerSupported = 'serviceWorker' in navigator;
    
    return {
        isInstalled,
        isStandalone,
        isOnline,
        isServiceWorkerSupported,
        canInstall: 'BeforeInstallPromptEvent' in window
    };
}

export default {
    initPWA,
    getPWAStatus
};