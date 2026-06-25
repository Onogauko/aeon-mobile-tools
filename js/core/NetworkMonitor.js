/**
 * Network Monitor - Monitors network connectivity and server reachability
 * @module core/NetworkMonitor
 */

import { logger } from './Logger.js';
import { eventBus } from './EventBus.js';
import { api } from '../api.js';

const log = logger.child('NetworkMonitor');

class NetworkMonitor {
    constructor() {
        this.isOnline = navigator.onLine;
        this.isServerReachable = false;
        this.lastCheck = null;
        this.checkInterval = null;
        this.listeners = [];
        this.initialized = false;
        this.status = {
            online: navigator.onLine,
            serverReachable: false,
            lastPing: null,
            responseTime: null,
            error: null
        };
    }

    init() {
        if (this.initialized) return;

        window.addEventListener('online', () => {
            this._updateOnlineStatus(true);
        });

        window.addEventListener('offline', () => {
            this._updateOnlineStatus(false);
        });

        this.checkInterval = setInterval(() => {
            this.checkServerReachability();
        }, 30000);

        this.checkServerReachability();

        this.initialized = true;
        log.info('NetworkMonitor initialized');
        
        eventBus.emit('network:status', this.getStatus());
    }

    _updateOnlineStatus(isOnline) {
        this.isOnline = isOnline;
        this.status.online = isOnline;
        
        log.info(`Network ${isOnline ? 'online' : 'offline'}`);
        eventBus.emit('network:changed', { online: isOnline });
        eventBus.emit('network:status', this.getStatus());
        
        if (isOnline) {
            this.checkServerReachability();
        }
    }

    async checkServerReachability() {
        if (!this.isOnline) {
            this.isServerReachable = false;
            this.status.serverReachable = false;
            this.status.error = 'Device offline';
            eventBus.emit('network:status', this.getStatus());
            return;
        }

        try {
            const startTime = Date.now();
            const result = await api.checkServerAvailability();
            const responseTime = Date.now() - startTime;

            this.isServerReachable = result.available;
            this.lastCheck = new Date().toISOString();
            this.status.serverReachable = result.available;
            this.status.responseTime = responseTime;
            this.status.lastPing = this.lastCheck;
            this.status.error = result.error || null;

            log.debug(`Server reachable: ${result.available} (${responseTime}ms)`);
            
            eventBus.emit('network:server', { 
                reachable: result.available, 
                responseTime,
                data: result.data 
            });
            eventBus.emit('network:status', this.getStatus());

        } catch (error) {
            this.isServerReachable = false;
            this.status.serverReachable = false;
            this.status.error = error.message;
            this.status.lastPing = new Date().toISOString();
            
            log.warning('Server unreachable:', error.message);
            eventBus.emit('network:status', this.getStatus());
        }
    }

    getStatus() {
        return {
            online: this.isOnline,
            serverReachable: this.isServerReachable,
            lastPing: this.lastCheck,
            responseTime: this.status.responseTime,
            error: this.status.error,
            isConnected: this.isOnline && this.isServerReachable
        };
    }

    getConnectionQuality() {
        if (!this.isOnline) return 'offline';
        if (!this.isServerReachable) return 'no_server';
        
        const responseTime = this.status.responseTime || 0;
        if (responseTime < 200) return 'excellent';
        if (responseTime < 500) return 'good';
        if (responseTime < 1000) return 'fair';
        return 'poor';
    }

    getConnectionInfo() {
        const info = {
            online: this.isOnline,
            serverReachable: this.isServerReachable,
            quality: this.getConnectionQuality()
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

    onNetworkChange(callback) {
        this.listeners.push(callback);
        callback(this.getStatus());
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.initialized = false;
        log.info('NetworkMonitor stopped');
    }

    async forceCheck() {
        await this.checkServerReachability();
        return this.getStatus();
    }
}

export const networkMonitor = new NetworkMonitor();

export default networkMonitor;