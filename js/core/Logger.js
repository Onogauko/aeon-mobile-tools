/**
 * Logger Module - Centralized logging system
 * @module core/Logger
 */

// Log levels
export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARNING: 2,
    ERROR: 3,
    NONE: 4
};

// Log level names
const LEVEL_NAMES = {
    [LogLevel.DEBUG]: '🐛 DEBUG',
    [LogLevel.INFO]: 'ℹ️ INFO',
    [LogLevel.WARNING]: '⚠️ WARNING',
    [LogLevel.ERROR]: '❌ ERROR'
};

// Log level colors
const LEVEL_COLORS = {
    [LogLevel.DEBUG]: '#6c757d',
    [LogLevel.INFO]: '#0d6efd',
    [LogLevel.WARNING]: '#ffc107',
    [LogLevel.ERROR]: '#dc3545'
};

class Logger {
    constructor() {
        this.level = LogLevel.INFO;
        this.enabled = true;
        this.history = [];
        this.maxHistory = 1000;
        this.loggers = new Map();
    }

    /**
     * Set log level
     */
    setLevel(level) {
        if (Object.values(LogLevel).includes(level)) {
            this.level = level;
            this.info(`Log level set to ${LEVEL_NAMES[level]}`);
        }
    }

    /**
     * Enable/disable logging
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }

    /**
     * Get log history
     */
    getHistory(level = null) {
        if (level !== null) {
            return this.history.filter(log => log.level === level);
        }
        return [...this.history];
    }

    /**
     * Clear log history
     */
    clearHistory() {
        this.history = [];
    }

    /**
     * Get log statistics
     */
    getStats() {
        const stats = {
            total: this.history.length,
            byLevel: {},
            byModule: {}
        };
        
        for (const entry of this.history) {
            stats.byLevel[entry.levelName] = (stats.byLevel[entry.levelName] || 0) + 1;
            if (entry.module) {
                stats.byModule[entry.module] = (stats.byModule[entry.module] || 0) + 1;
            }
        }
        
        return stats;
    }

    /**
     * Format log message
     */
    _formatMessage(level, message, data = null, module = null) {
        const timestamp = new Date().toISOString();
        const levelName = LEVEL_NAMES[level] || 'UNKNOWN';
        const prefix = `[${timestamp}] ${levelName}`;
        const modulePrefix = module ? `[${module}]` : '';
        
        let formatted = `${prefix} ${modulePrefix}`;
        if (message) {
            formatted += `: ${message}`;
        }
        if (data) {
            formatted += `\n${JSON.stringify(data, null, 2)}`;
        }
        
        return {
            timestamp,
            level,
            levelName,
            message,
            data,
            module,
            formatted
        };
    }

    /**
     * Log message with level
     */
    _log(level, message, data = null, module = null) {
        if (!this.enabled) return;
        if (level < this.level) return;

        const logEntry = this._formatMessage(level, message, data, module);
        
        // Store in history
        this.history.push(logEntry);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        // Console output with color
        const color = LEVEL_COLORS[level] || '#000000';
        const style = `color: ${color}; font-weight: bold;`;
        
        switch (level) {
            case LogLevel.DEBUG:
                console.debug(`%c${logEntry.formatted}`, style);
                break;
            case LogLevel.INFO:
                console.info(`%c${logEntry.formatted}`, style);
                break;
            case LogLevel.WARNING:
                console.warn(`%c${logEntry.formatted}`, style);
                break;
            case LogLevel.ERROR:
                console.error(`%c${logEntry.formatted}`, style);
                break;
            default:
                console.log(`%c${logEntry.formatted}`, style);
        }
    }

    /**
     * Debug level log
     */
    debug(message, data = null, module = null) {
        this._log(LogLevel.DEBUG, message, data, module);
    }

    /**
     * Info level log
     */
    info(message, data = null, module = null) {
        this._log(LogLevel.INFO, message, data, module);
    }

    /**
     * Warning level log
     */
    warning(message, data = null, module = null) {
        this._log(LogLevel.WARNING, message, data, module);
    }

    /**
     * Error level log
     */
    error(message, data = null, module = null) {
        this._log(LogLevel.ERROR, message, data, module);
    }

    /**
     * Create a child logger with prefix
     */
    child(prefix) {
        if (this.loggers.has(prefix)) {
            return this.loggers.get(prefix);
        }

        const childLogger = {
            debug: (message, data) => this.debug(message, data, prefix),
            info: (message, data) => this.info(message, data, prefix),
            warning: (message, data) => this.warning(message, data, prefix),
            error: (message, data) => this.error(message, data, prefix),
            getHistory: () => this.getHistory(),
            setLevel: (level) => this.setLevel(level),
            getStats: () => this.getStats()
        };

        this.loggers.set(prefix, childLogger);
        return childLogger;
    }

    /**
     * Get log levels
     */
    getLogLevels() {
        return LogLevel;
    }
}

// Singleton instance
export const logger = new Logger();

// Export default
export default logger;