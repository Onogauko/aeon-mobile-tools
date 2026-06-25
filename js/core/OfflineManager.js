/**
 * Offline Manager - Manages offline mode and connectivity
 * @module core/OfflineManager
 */

import { logger } from './Logger.js';
import { eventBus } from './EventBus.js';

const log = logger.child('OfflineManager');

class OfflineManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.wasOnline = navigator.onLine;
        this.offlineQueue = [];
        this.initialized = false;
        this.listeners = [];
    }

    /**
     * Initialize offline manager
     */
    init() {
        if (this.initialized) return;

        // Online/Offline events
        window.addEventListener('online', () => {
            this._handleOnline();
        });

        window.addEventListener('offline', () => {
            this._handleOffline();
        });

        // Listen to connection changes
        if ('connection' in navigator) {
            navigator.connection.addEventListener('change', () => {
                this._handleConnectionChange();
            });
        }

        this.initialized = true;
        log.info(`OfflineManager initialized (online: ${this.isOnline})`);
        
        // Emit initial status
        eventBus.emit('connection:changed', { isOnline: this.isOnline });
    }

    /**
     * Handle online event
     */
    _handleOnline() {
        this.wasOnline = this.isOnline;
        this.isOnline = true;
        log.info('Device online');
        eventBus.emit('connection:online', {});
        eventBus.emit('connection:changed', { isOnline: true });
        
        // Process offline queue
        this._processQueue();
    }

    /**
     * Handle offline event
     */
    _handleOffline() {
        this.wasOnline = this.isOnline;
        this.isOnline = false;
        log.warning('Device offline');
        eventBus.emit('connection:offline', {});
        eventBus.emit('connection:changed', { isOnline: false });
        
        // Show notification
        this._showOfflineNotification();
    }

    /**
     * Handle connection change
     */
    _handleConnectionChange() {
        const connection = navigator.connection;
        log.debug(`Connection changed: ${connection.effectiveType}, ${connection.downlink}Mbps`);
        eventBus.emit('connection:type', {
            type: connection.effectiveType,
            speed: connection.downlink,
            rtt: connection.rtt
        });
    }

    /**
     * Show offline notification
     */
    _showOfflineNotification() {
        const existing = document.querySelector('.offline-banner');
        if (existing) return;

        const banner = document.createElement('div');
        banner.className = 'offline-banner fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-2 px-4 text-sm z-50';
        banner.id = 'offline-banner';
        banner.innerHTML = `
            <div class="flex items-center justify-center gap-2">
                <span class="material-icons text-sm">wifi_off</span>
                <span>You are offline. Some features may be limited.</span>
            </div>
        `;
        document.body.prepend(banner);
    }

    /**
     * Hide offline notification
     */
    _hideOfflineNotification() {
        const banner = document.getElementById('offline-banner');
        if (banner) {
            banner.remove();
        }
    }

    /**
     * Process offline queue
     */
    async _processQueue() {
        if (this.offlineQueue.length === 0) return;
        
        log.info(`Processing ${this.offlineQueue.length} queued operations`);
        eventBus.emit('queue:processing', { count: this.offlineQueue.length });

        for (const item of this.offlineQueue) {
            try {
                await item.execute();
                log.debug(`Queued operation completed: ${item.label}`);
            } catch (error) {
                log.error(`Queued operation failed: ${item.label}`, error);
            }
        }

        this.offlineQueue = [];
        eventBus.emit('queue:processed', {});
    }

    /**
     * Queue operation for when online
     */
    queueOperation(execute, label = '') {
        this.offlineQueue.push({
            execute,
            label,
            timestamp: new Date().toISOString()
        });
        log.debug(`Operation queued: ${label}`);
        eventBus.emit('queue:added', { label, queueSize: this.offlineQueue.length });
    }

    /**
     * Check if online
     */
    isOnline() {
        return this.isOnline;
    }

    /**
     * Check if offline
     */
    isOffline() {
        return !this.isOnline;
    }

    /**
     * Get queue status
     */
    getQueueStatus() {
        return {
            size: this.offlineQueue.length,
            items: this.offlineQueue.map(item => ({
                label: item.label,
                timestamp: item.timestamp
            }))
        };
    }

    /**
     * Clear queue
     */
    clearQueue() {
        this.offlineQueue = [];
        log.info('Queue cleared');
        eventBus.emit('queue:cleared', {});
    }

    /**
     * Get connection info
     */
    getConnectionInfo() {
        const info = {
            isOnline: this.isOnline,
            wasOnline: this.wasOnline
        };

        if ('connection' in navigator) {
            const connection = navigator.connection;
            info.type = connection.effectiveType;
            info.downlink = connection.downlink;
            info.rtt = connection.rtt;
            info.saveData = connection.saveData;
        }

        return info;
    }

    /**
     * Register offline availability
     */
    registerOfflineFeature(feature) {
        this.listeners.push(feature);
        log.debug(`Offline feature registered: ${feature}`);
    }

    /**
     * Check if feature is available offline
     */
    isFeatureAvailable(feature) {
        return this.listeners.includes(feature);
    }
}

// Singleton instance
export const offlineManager = new OfflineManager();

export default offlineManager;