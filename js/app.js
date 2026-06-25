/**
 * AEON Mobile Tools - Main Application Entry Point
 * @module app
 */

import { Router } from './router.js';
import { initPWA } from './pwa.js';
import { initStorage } from './storage.js';
import { logger } from './core/Logger.js';
import { eventBus } from './core/EventBus.js';
import { sessionManager } from './core/SessionManager.js';
import { authService } from './services/AuthService.js';
import { settingRepository } from './repository/SettingRepository.js';
import { errorHandler } from './core/ErrorHandler.js';
import { performanceMonitor } from './core/PerformanceMonitor.js';
import { offlineManager } from './core/OfflineManager.js';
import { logViewer } from './core/LogViewer.js';
import { networkMonitor } from './core/NetworkMonitor.js';
import { debugMode } from './core/DebugMode.js';

import './ui.js';
import './priceChecker.js';
import './scanner.js';

const App = {
    initialized: false,
    currentUser: null,
    config: {}
};

logger.setLevel(2);

async function initApp() {
    try {
        errorHandler.init();
        logger.info('Error handler initialized');

        debugMode.init();
        logger.info('Debug mode initialized');

        performanceMonitor.init();
        logger.info('Performance monitor initialized');

        offlineManager.init();
        logger.info('Offline manager initialized');

        logViewer.init();
        logger.info('Log viewer initialized');

        networkMonitor.init();
        logger.info('Network monitor initialized');

        await initStorage();
        logger.info('Storage initialized');

        await settingRepository.initDefaults();
        logger.info('Default settings initialized');

        sessionManager.init();
        logger.info('Session manager initialized');

        authService.init();
        logger.info('Auth service initialized');

        await initPWA();
        logger.info('PWA initialized');

        const router = new Router();
        await router.init();
        logger.info('Router initialized');

        if (authService.isLoggedIn()) {
            const user = authService.currentUser();
            logger.info(`User already logged in: ${user?.user_id || user?.username}`);
            eventBus.emit('session:restored', { user: user });
        }

        router.routes['/api-inspector'] = 'api-inspector';

        App.initialized = true;
        logger.info('Application ready!');

        eventBus.emit('app:ready', { version: '1.0.0' });

        return true;

    } catch (error) {
        logger.error('Fatal initialization error:', error);
        errorHandler.handleError(error, {
            type: 'fatal',
            source: 'app:init',
            silent: false
        });
        
        document.body.innerHTML = `
            <div class="flex items-center justify-center min-h-screen p-4 bg-gray-50">
                <div class="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
                    <span class="material-icons text-6xl text-red-500">error_outline</span>
                    <h1 class="text-xl font-bold mt-4">Application Error</h1>
                    <p class="text-gray-600 mt-2">Failed to initialize application. Please try again.</p>
                    <button onclick="location.reload()" class="btn btn-primary mt-4">
                        <span class="material-icons">refresh</span>
                        Reload
                    </button>
                </div>
            </div>
        `;
        
        return false;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

export default App;