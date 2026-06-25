/**
 * Log Viewer - View and filter application logs
 * @module core/LogViewer
 */

import { logger, LogLevel } from './Logger.js';
import { eventBus } from './EventBus.js';

const log = logger.child('LogViewer');

class LogViewer {
    constructor() {
        this.filterLevel = LogLevel.INFO;
        this.filterModule = null;
        this.filterSearch = '';
        this.maxDisplay = 100;
        this.logs = [];
        this.initialized = false;
    }

    /**
     * Initialize log viewer
     */
    init() {
        if (this.initialized) return;

        // Listen to log events
        eventBus.on('log:added', (entry) => {
            this.logs.push(entry);
            if (this.logs.length > this.maxDisplay * 2) {
                this.logs.shift();
            }
        });

        this.initialized = true;
    }

    /**
     * Get filtered logs
     */
    getLogs(filters = {}) {
        let filtered = [...this.logs];

        // Filter by level
        if (filters.level !== undefined) {
            const levelMap = {
                'DEBUG': 0,
                'INFO': 1,
                'WARNING': 2,
                'ERROR': 3
            };
            const minLevel = levelMap[filters.level.toUpperCase()] || 0;
            filtered = filtered.filter(log => {
                const logLevel = levelMap[log.level] || 0;
                return logLevel >= minLevel;
            });
        }

        // Filter by module
        if (filters.module) {
            filtered = filtered.filter(log => 
                log.module?.toLowerCase().includes(filters.module.toLowerCase())
            );
        }

        // Filter by search
        if (filters.search) {
            const search = filters.search.toLowerCase();
            filtered = filtered.filter(log => 
                log.message?.toLowerCase().includes(search) ||
                log.module?.toLowerCase().includes(search)
            );
        }

        // Sort by timestamp (newest first)
        filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Limit
        if (filters.limit) {
            filtered = filtered.slice(0, filters.limit);
        }

        return filtered;
    }

    /**
     * Get logs by type
     */
    getByType(type) {
        return this.getLogs({ level: type });
    }

    /**
     * Get logs by module
     */
    getByModule(module) {
        return this.getLogs({ module });
    }

    /**
     * Get download logs
     */
    getDownloadLogs() {
        return this.getLogs({ module: 'DownloadService' });
    }

    /**
     * Get scanner logs
     */
    getScannerLogs() {
        return this.getLogs({ module: 'Scanner' });
    }

    /**
     * Get error logs
     */
    getErrorLogs() {
        return this.getLogs({ level: 'ERROR' });
    }

    /**
     * Get log statistics
     */
    getStats() {
        const stats = {
            total: this.logs.length,
            byLevel: {},
            byModule: {},
            timeRange: {
                start: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : null,
                end: this.logs.length > 0 ? this.logs[0].timestamp : null
            }
        };

        for (const log of this.logs) {
            stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
            if (log.module) {
                stats.byModule[log.module] = (stats.byModule[log.module] || 0) + 1;
            }
        }

        return stats;
    }

    /**
     * Clear logs
     */
    clear() {
        this.logs = [];
        log.info('Logs cleared');
    }

    /**
     * Export logs
     */
    exportLogs(format = 'json') {
        const data = {
            exported_at: new Date().toISOString(),
            count: this.logs.length,
            logs: this.logs
        };

        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        } else if (format === 'csv') {
            const headers = ['timestamp', 'level', 'module', 'message', 'data'];
            const rows = this.logs.map(log => [
                log.timestamp,
                log.level,
                log.module || '',
                log.message,
                JSON.stringify(log.data || '')
            ]);
            return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        }

        return JSON.stringify(data);
    }

    /**
     * Download logs as file
     */
    downloadLogs(format = 'json') {
        const content = this.exportLogs(format);
        const blob = new Blob([content], { 
            type: format === 'json' ? 'application/json' : 'text/csv' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs_${new Date().toISOString().slice(0,10)}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        log.info(`Logs downloaded as ${format}`);
    }
}

// Singleton instance
export const logViewer = new LogViewer();

export default logViewer;
