/**
 * Debug Mode - Centralized debug utilities
 * @module core/DebugMode
 */

import { logger } from './Logger.js';

const log = logger.child('DebugMode');

class DebugMode {
    constructor() {
        this.enabled = localStorage.getItem('aeon_debug_mode') === 'true';
        this.initialized = false;
        this.startTime = Date.now();
    }

    init() {
        if (this.initialized) return;
        
        if (this.enabled) {
            this._enableDebug();
        }
        
        this.initialized = true;
        log.info(`Debug mode ${this.enabled ? 'enabled' : 'disabled'}`);
    }

    enable() {
        this.enabled = true;
        localStorage.setItem('aeon_debug_mode', 'true');
        this._enableDebug();
        log.info('Debug mode enabled');
    }

    disable() {
        this.enabled = false;
        localStorage.setItem('aeon_debug_mode', 'false');
        this._disableDebug();
        log.info('Debug mode disabled');
    }

    toggle() {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this.enabled;
    }

    isEnabled() {
        return this.enabled;
    }

    _enableDebug() {
        logger.setLevel(0);

        const style = document.createElement('style');
        style.id = 'debug-style';
        style.textContent = `
            .debug-highlight {
                outline: 2px solid #ff6b6b !important;
                outline-offset: 2px;
            }
            .debug-timestamp {
                color: #868e96;
                font-size: 10px;
                font-family: monospace;
            }
        `;
        document.head.appendChild(style);

        this._addDebugIndicator();

        log.debug('Debug mode enabled');
        log.debug('Application started at:', new Date(this.startTime).toISOString());
        log.debug('User Agent:', navigator.userAgent);
        log.debug('Screen:', `${window.screen.width}x${window.screen.height}`);
    }

    _disableDebug() {
        logger.setLevel(2);

        const style = document.getElementById('debug-style');
        if (style) style.remove();

        const indicator = document.getElementById('debug-indicator');
        if (indicator) indicator.remove();

        log.debug('Debug mode disabled');
    }

    _addDebugIndicator() {
        const existing = document.getElementById('debug-indicator');
        if (existing) return;

        const indicator = document.createElement('div');
        indicator.id = 'debug-indicator';
        indicator.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: #ff6b6b;
            color: white;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 10px;
            font-family: monospace;
            z-index: 9999;
            opacity: 0.8;
            pointer-events: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        indicator.textContent = '🐞 DEBUG';
        document.body.appendChild(indicator);
    }

    log(message, data = null) {
        if (this.enabled) {
            log.debug(message, data);
        }
    }

    measure(fn, label = '') {
        if (!this.enabled) return fn();
        
        const start = performance.now();
        const result = fn();
        const duration = performance.now() - start;
        log.debug(`⏱ ${label}: ${duration.toFixed(2)}ms`);
        return result;
    }

    async measureAsync(fn, label = '') {
        if (!this.enabled) return fn();
        
        const start = performance.now();
        const result = await fn();
        const duration = performance.now() - start;
        log.debug(`⏱ ${label}: ${duration.toFixed(2)}ms`);
        return result;
    }

    inspect(obj, label = '') {
        if (this.enabled) {
            console.group(`🔍 ${label || 'Inspect'}`);
            console.dir(obj);
            console.groupEnd();
        }
        return obj;
    }

    trace(fn, label = '') {
        if (!this.enabled) return fn;
        
        return (...args) => {
            log.debug(`▶ ${label} called with:`, args);
            const result = fn(...args);
            log.debug(`◀ ${label} returned:`, result);
            return result;
        };
    }

    getStats() {
        if (!this.enabled) return null;
        
        return {
            uptime: ((Date.now() - this.startTime) / 1000).toFixed(1) + 's',
            memory: window.performance?.memory ? {
                used: (window.performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
                total: (window.performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
                limit: (window.performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + 'MB'
            } : 'Not available'
        };
    }
}

export const debugMode = new DebugMode();

export default debugMode;