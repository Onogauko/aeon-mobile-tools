/**
 * Global Error Handler - Centralized error management
 * @module core/ErrorHandler
 */

import { logger } from './Logger.js';
import { eventBus } from './EventBus.js';

const log = logger.child('ErrorHandler');

class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 100;
        this.isHandling = false;
        this.errorCallbacks = [];
        this.initialized = false;
    }

    /**
     * Initialize global error handler
     */
    init() {
        if (this.initialized) return;

        // Global error handlers
        window.addEventListener('error', (event) => {
            this.handleError(event.error || event.message, {
                type: 'uncaught',
                source: 'window',
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason, {
                type: 'unhandledrejection',
                source: 'promise'
            });
        });

        this.initialized = true;
        log.info('ErrorHandler initialized');
    }

    /**
     * Handle error
     */
    handleError(error, context = {}) {
        if (this.isHandling) return;
        this.isHandling = true;

        try {
            const errorEntry = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                message: error?.message || String(error),
                stack: error?.stack,
                context: context,
                handled: false
            };

            // Store error
            this.errors.push(errorEntry);
            if (this.errors.length > this.maxErrors) {
                this.errors.shift();
            }

            // Log error
            console.error(`[${context.type || 'error'}] ${errorEntry.message}`, {
                context,
                stack: error?.stack
            });

            // Emit error event
            eventBus.emit('error:occurred', errorEntry);

            // Call error callbacks
            for (const callback of this.errorCallbacks) {
                try {
                    callback(errorEntry);
                } catch (cbError) {
                    console.error('Error in error callback:', cbError);
                }
            }

            // Show user-friendly error if not handled
            if (!context.silent) {
                this._showUserError(errorEntry);
            }

            errorEntry.handled = true;
            return errorEntry;

        } catch (handlerError) {
            console.error('Error in error handler:', handlerError);
        } finally {
            this.isHandling = false;
        }
    }

    /**
     * Show user-friendly error message
     */
    _showUserError(errorEntry) {
        const message = this._getUserFriendlyMessage(errorEntry);
        
        // Check if error dialog already exists
        const existing = document.querySelector('.error-dialog');
        if (existing) return;

        const dialog = document.createElement('div');
        dialog.className = 'error-dialog fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
        dialog.innerHTML = `
            <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                <div class="flex items-center gap-3 mb-4">
                    <span class="material-icons text-red-500 text-3xl">error_outline</span>
                    <h3 class="text-lg font-bold text-gray-800">Something went wrong</h3>
                </div>
                <p class="text-gray-600 text-sm mb-4">${message}</p>
                <div class="flex gap-2">
                    <button onclick="this.closest('.error-dialog').remove()" 
                            class="btn btn-primary flex-1">Close</button>
                    <button onclick="location.reload()" 
                            class="btn btn-secondary">Reload</button>
                </div>
                <details class="mt-3 text-xs text-gray-400">
                    <summary>Error Details</summary>
                    <pre class="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-32">${errorEntry.stack || errorEntry.message}</pre>
                </details>
            </div>
        `;

        document.body.appendChild(dialog);

        // Auto close after 10 seconds
        setTimeout(() => {
            if (dialog.parentNode) {
                dialog.remove();
            }
        }, 10000);
    }

    /**
     * Get user-friendly error message
     */
    _getUserFriendlyMessage(errorEntry) {
        const message = errorEntry.message?.toLowerCase() || '';

        if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
            return 'Network connection issue. Please check your internet connection.';
        }
        if (message.includes('camera') || message.includes('media')) {
            return 'Camera access denied. Please allow camera permissions.';
        }
        if (message.includes('indexeddb') || message.includes('database')) {
            return 'Database error. Please try clearing cache or restarting the app.';
        }
        if (message.includes('timeout')) {
            return 'Request timeout. Please try again.';
        }
        if (message.includes('permission')) {
            return 'Permission denied. Please grant necessary permissions.';
        }

        return 'An unexpected error occurred. Please try again or contact support.';
    }

    /**
     * Register error callback
     */
    onError(callback) {
        this.errorCallbacks.push(callback);
    }

    /**
     * Get all errors
     */
    getErrors() {
        return [...this.errors];
    }

    /**
     * Clear errors
     */
    clearErrors() {
        this.errors = [];
        log.info('Errors cleared');
    }

    /**
     * Get error stats
     */
    getStats() {
        const total = this.errors.length;
        const unhandled = this.errors.filter(e => !e.handled).length;
        const byType = {};
        
        for (const error of this.errors) {
            const type = error.context?.type || 'unknown';
            byType[type] = (byType[type] || 0) + 1;
        }

        return {
            total,
            unhandled,
            byType,
            lastError: this.errors[this.errors.length - 1] || null
        };
    }

    /**
     * Wrap async function with error handling
     */
    async wrap(fn, context = {}) {
        try {
            return await fn();
        } catch (error) {
            this.handleError(error, context);
            throw error;
        }
    }

    /**
     * Create error boundary for component
     */
    createBoundary(componentName) {
        return {
            wrap: (fn) => {
                return async (...args) => {
                    try {
                        return await fn(...args);
                    } catch (error) {
                        this.handleError(error, {
                            type: 'component',
                            component: componentName,
                            args: args
                        });
                        throw error;
                    }
                };
            },
            safe: (fn, fallback) => {
                return (...args) => {
                    try {
                        return fn(...args);
                    } catch (error) {
                        this.handleError(error, {
                            type: 'component',
                            component: componentName,
                            args: args
                        });
                        return fallback;
                    }
                };
            }
        };
    }
}

// Singleton instance
export const errorHandler = new ErrorHandler();

export default errorHandler;
