/**
 * Event Bus Module - Pub/Sub system for decoupled communication
 * @module core/EventBus
 */

import { logger } from './Logger.js';

const log = logger.child('EventBus');

// ============================================
// EVENT NAMES - DI EKSPOR SEBAGAI OBJECT
// ============================================

export const Events = {
    // Download events
    DOWNLOAD_STARTED: 'download:started',
    DOWNLOAD_PROGRESS: 'download:progress',
    DOWNLOAD_COMPLETED: 'download:completed',
    DOWNLOAD_FAILED: 'download:failed',
    
    // Price Checker events
    PRICE_CHECK_START: 'price:check:start',
    PRICE_CHECK_COMPLETE: 'price:check:complete',
    PRICE_CHECK_NOT_FOUND: 'price:check:notfound',
    PRICE_CHECK_ERROR: 'price:check:error',
    
    // Scanner events
    SCAN_START: 'scan:start',
    SCAN_SUCCESS: 'scan:success',
    SCAN_ERROR: 'scan:error',
    SCAN_CANCEL: 'scan:cancel',
    SCAN_CONTINUOUS_RESUME: 'scan:continuous:resume',
    SCAN_RECORDED: 'scan:recorded',
    SCAN_AUTOSTOPPED: 'scan:autostopped',
    
    // Auth events
    AUTH_LOGIN: 'auth:login',
    AUTH_LOGOUT: 'auth:logout',
    AUTH_ERROR: 'auth:error',
    
    // Settings events
    SETTINGS_CHANGED: 'settings:changed',
    SERVER_IP_CHANGED: 'settings:server:changed',
    
    // Data events
    DATA_SYNCED: 'data:synced',
    DATA_CLEARED: 'data:cleared',
    
    // Favorite events
    FAVORITE_ADDED: 'favorite:added',
    FAVORITE_REMOVED: 'favorite:removed',
    FAVORITE_CLEARED: 'favorite:cleared',
    
    // History events
    HISTORY_ADDED: 'history:added',
    HISTORY_CLEARED: 'history:cleared',
    
    // Network events
    NETWORK_CHANGED: 'network:changed',
    NETWORK_STATUS: 'network:status',
    NETWORK_SERVER: 'network:server',
    
    // App events
    APP_READY: 'app:ready',
    SESSION_RESTORED: 'session:restored'
};

class EventBus {
    constructor() {
        this.events = new Map();
        this.onceEvents = new Map();
        this.maxListeners = 50;
    }

    /**
     * Register an event listener
     */
    on(event, callback, context = null) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const listeners = this.events.get(event);
        
        if (listeners.length >= this.maxListeners) {
            log.warning(`Max listeners reached for event: ${event}`);
            return;
        }

        listeners.push({ callback, context });
        log.debug(`Listener added for event: ${event}`);
    }

    /**
     * Register a one-time event listener
     */
    once(event, callback, context = null) {
        if (!this.onceEvents.has(event)) {
            this.onceEvents.set(event, []);
        }

        this.onceEvents.get(event).push({ callback, context });
        log.debug(`Once listener added for event: ${event}`);
    }

    /**
     * Remove an event listener
     */
    off(event, callback = null) {
        if (!callback) {
            this.events.delete(event);
            this.onceEvents.delete(event);
            log.debug(`All listeners removed for event: ${event}`);
            return;
        }

        if (this.events.has(event)) {
            const listeners = this.events.get(event);
            const filtered = listeners.filter(l => l.callback !== callback);
            if (filtered.length > 0) {
                this.events.set(event, filtered);
            } else {
                this.events.delete(event);
            }
        }

        if (this.onceEvents.has(event)) {
            const listeners = this.onceEvents.get(event);
            const filtered = listeners.filter(l => l.callback !== callback);
            if (filtered.length > 0) {
                this.onceEvents.set(event, filtered);
            } else {
                this.onceEvents.delete(event);
            }
        }

        log.debug(`Listener removed for event: ${event}`);
    }

    /**
     * Emit an event
     */
    emit(event, data = null) {
        if (this.events.has(event)) {
            const listeners = this.events.get(event);
            for (const listener of listeners) {
                try {
                    listener.callback.call(listener.context, data);
                } catch (error) {
                    log.error(`Error in event listener for ${event}:`, error);
                }
            }
        }

        if (this.onceEvents.has(event)) {
            const listeners = this.onceEvents.get(event);
            for (const listener of listeners) {
                try {
                    listener.callback.call(listener.context, data);
                } catch (error) {
                    log.error(`Error in once listener for ${event}:`, error);
                }
            }
            this.onceEvents.delete(event);
        }
    }

    /**
     * Emit event asynchronously
     */
    async emitAsync(event, data = null) {
        const promises = [];

        if (this.events.has(event)) {
            const listeners = this.events.get(event);
            for (const listener of listeners) {
                promises.push(Promise.resolve()
                    .then(() => listener.callback.call(listener.context, data))
                    .catch(error => log.error(`Error in async event listener for ${event}:`, error))
                );
            }
        }

        if (this.onceEvents.has(event)) {
            const listeners = this.onceEvents.get(event);
            for (const listener of listeners) {
                promises.push(Promise.resolve()
                    .then(() => listener.callback.call(listener.context, data))
                    .catch(error => log.error(`Error in async once listener for ${event}:`, error))
                );
            }
            this.onceEvents.delete(event);
        }

        await Promise.allSettled(promises);
    }

    /**
     * Get all registered event names
     */
    getEvents() {
        const allEvents = new Set();
        for (const key of this.events.keys()) {
            allEvents.add(key);
        }
        for (const key of this.onceEvents.keys()) {
            allEvents.add(key);
        }
        return Array.from(allEvents);
    }

    /**
     * Get listener count for an event
     */
    listenerCount(event) {
        let count = 0;
        if (this.events.has(event)) {
            count += this.events.get(event).length;
        }
        if (this.onceEvents.has(event)) {
            count += this.onceEvents.get(event).length;
        }
        return count;
    }

    /**
     * Remove all listeners
     */
    removeAllListeners() {
        this.events.clear();
        this.onceEvents.clear();
        log.info('All listeners removed');
    }

    /**
     * Set max listeners per event
     */
    setMaxListeners(max) {
        this.maxListeners = max;
        log.info(`Max listeners set to: ${max}`);
    }

    /**
     * Wait for an event (returns promise)
     */
    waitFor(event, timeout = null) {
        return new Promise((resolve) => {
            let timer = null;
            
            const handler = (data) => {
                if (timer) {
                    clearTimeout(timer);
                }
                this.off(event, handler);
                resolve(data);
            };

            this.once(event, handler);

            if (timeout) {
                timer = setTimeout(() => {
                    this.off(event, handler);
                    resolve(null);
                }, timeout);
            }
        });
    }
}

// Singleton instance
export const eventBus = new EventBus();

// Export default
export default eventBus;
