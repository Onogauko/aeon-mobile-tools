/**
 * API Module - Handles API communication with AEON HHT endpoints
 * @module api
 * @version 2.0.0 - Real Integration
 */

import Config from './config.js';
import { getToken } from './auth.js';
import { logger } from './core/Logger.js';

const log = logger.child('API');

// API client
class APIClient {
    constructor() {
        this.timeout = Config.api.timeout || 30000;
        this.retryAttempts = Config.api.retryAttempts || 3;
        this.retryDelay = Config.api.retryDelay || 2000;
        this.serverIP = localStorage.getItem(Config.storageKeys.serverIp) || '';
        this.basePath = '/aeon-panel/Api/';
        this.debugMode = localStorage.getItem('aeon_debug_mode') === 'true';
        this.requestLog = [];
        this.maxRequestLog = 100;
    }

    /**
     * Get server base URL
     */
    getServerBaseURL() {
        const ip = localStorage.getItem(Config.storageKeys.serverIp) || '';
        if (!ip) {
            throw new Error('Server IP not configured');
        }
        return `http://${ip}`;
    }

    /**
     * Get full URL for endpoint
     */
    getURL(endpoint) {
        const baseURL = this.getServerBaseURL();
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${baseURL}${cleanEndpoint}`;
    }

    /**
     * Get endpoint with base path
     */
    getEndpoint(endpoint) {
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        return `${this.basePath}${cleanEndpoint}`;
    }

    /**
     * Make an API request with logging and retry
     */
    async request(endpoint, options = {}) {
        const fullEndpoint = this.getEndpoint(endpoint);
        const url = this.getURL(fullEndpoint);
        const startTime = Date.now();
        let attempt = 0;
        let lastError = null;

        if (this.debugMode) {
            log.debug(`[API Request] ${options.method || 'GET'} ${url}`, { options });
        }

        while (attempt < this.retryAttempts) {
            attempt++;
            try {
                const response = await this._fetchWithTimeout(url, options);
                const duration = Date.now() - startTime;
                
                this._logRequest({
                    endpoint,
                    url,
                    method: options.method || 'GET',
                    status: response.status,
                    duration,
                    attempt
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} - ${response.statusText}`);
                }

                const data = await response.json();
                
                if (this.debugMode) {
                    log.debug(`[API Response] ${url} (${duration}ms)`, data);
                }

                return data;

            } catch (error) {
                lastError = error;
                const duration = Date.now() - startTime;
                
                this._logRequest({
                    endpoint,
                    url,
                    method: options.method || 'GET',
                    status: 'error',
                    duration,
                    attempt,
                    error: error.message
                });

                log.warning(`Request failed (attempt ${attempt}/${this.retryAttempts}): ${error.message}`);

                if (attempt < this.retryAttempts) {
                    await this._delay(this.retryDelay * attempt);
                }
            }
        }

        log.error(`Request failed after ${this.retryAttempts} attempts: ${lastError?.message}`);
        throw lastError || new Error('Request failed');
    }

    /**
     * Fetch with timeout
     */
    async _fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers
        };
        
        try {
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers,
                ...(options.body && { body: JSON.stringify(options.body) }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.timeout}ms`);
            }
            throw error;
        }
    }

    /**
     * Delay helper
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Log request
     */
    _logRequest(entry) {
        this.requestLog.push({
            ...entry,
            timestamp: new Date().toISOString()
        });
        if (this.requestLog.length > this.maxRequestLog) {
            this.requestLog.shift();
        }
    }

    /**
     * Get request log
     */
    getRequestLog() {
        return [...this.requestLog];
    }

    /**
     * Clear request log
     */
    clearRequestLog() {
        this.requestLog = [];
    }

    // ============================================
    // AEON HHT ENDPOINTS
    // ============================================

    /**
     * Get store detail
     * Endpoint: /aeon-panel/Api/store_detail
     */
    async getStoreDetail() {
        log.info('Fetching store detail...');
        return this.request('store_detail');
    }

    /**
     * Download table data
     * Endpoint: /aeon-panel/Api/download?table_name={table_name}
     */
    async downloadTable(tableName) {
        log.info(`Downloading table: ${tableName}`);
        return this.request(`download?table_name=${tableName}`);
    }

    /**
     * Download user data
     */
    async downloadUsers() {
        return this.downloadTable('user_dl');
    }

    /**
     * Download article data
     */
    async downloadArticles() {
        return this.downloadTable('article_dl');
    }

    /**
     * Download section data
     */
    async downloadSections() {
        return this.downloadTable('section_dl');
    }

    /**
     * Download department data
     */
    async downloadDepts() {
        return this.downloadTable('dept_dl');
    }

    /**
     * Test connection to server
     */
    async testConnection(ip) {
        try {
            const url = `http://${ip}/aeon-panel/Api/store_detail`;
            log.info(`Testing connection to: ${url}`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(10000)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status} - ${response.statusText}`);
            }
            
            const data = await response.json();
            log.info('Connection test successful');
            
            return {
                success: true,
                data: data,
                status: response.status
            };
        } catch (error) {
            log.error('Connection test failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check server availability
     */
    async checkServerAvailability() {
        try {
            const ip = localStorage.getItem(Config.storageKeys.serverIp) || '';
            if (!ip) {
                return { available: false, error: 'Server IP not configured' };
            }
            
            const result = await this.testConnection(ip);
            return {
                available: result.success,
                data: result.data,
                error: result.error
            };
        } catch (error) {
            log.error('Server availability check failed:', error);
            return { available: false, error: error.message };
        }
    }

    /**
     * Get API inspector data
     */
    async getInspectorData() {
        const ip = this.getServerIP();
        const startTime = Date.now();
        let storeDetail = null;
        let status = 'unknown';
        let responseTime = 0;

        try {
            if (ip) {
                const result = await this.testConnection(ip);
                status = result.success ? 'online' : 'offline';
                responseTime = Date.now() - startTime;
                if (result.success) {
                    storeDetail = result.data;
                }
            } else {
                status = 'not_configured';
            }
        } catch (error) {
            status = 'error';
            responseTime = Date.now() - startTime;
        }

        return {
            server: {
                ip: ip || 'Not configured',
                status: status,
                responseTime: responseTime,
                basePath: this.basePath
            },
            store: storeDetail,
            endpoints: {
                storeDetail: '/aeon-panel/Api/store_detail',
                download: '/aeon-panel/Api/download?table_name={table_name}',
                userDl: '/aeon-panel/Api/download?table_name=user_dl',
                articleDl: '/aeon-panel/Api/download?table_name=article_dl',
                sectionDl: '/aeon-panel/Api/download?table_name=section_dl',
                deptDl: '/aeon-panel/Api/download?table_name=dept_dl'
            },
            debugMode: this.debugMode,
            requestLog: this.requestLog.slice(-10)
        };
    }

    /**
     * Update server IP
     */
    setServerIP(ip) {
        localStorage.setItem(Config.storageKeys.serverIp, ip);
        this.serverIP = ip;
        log.info(`Server IP updated to: ${ip}`);
    }

    /**
     * Get server IP
     */
    getServerIP() {
        return localStorage.getItem(Config.storageKeys.serverIp) || '';
    }

    /**
     * Toggle debug mode
     */
    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        localStorage.setItem('aeon_debug_mode', String(this.debugMode));
        log.info(`Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`);
        return this.debugMode;
    }

    /**
     * Get debug mode status
     */
    isDebugMode() {
        return this.debugMode;
    }
}

// Create API client instance
export const api = new APIClient();

export default api;