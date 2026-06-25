/**
 * Session Manager - Handles user session management
 * @module core/SessionManager
 */

import { logger } from './Logger.js';
import { eventBus, Events } from './EventBus.js';

const log = logger.child('SessionManager');

class SessionManager {
    constructor() {
        this.session = null;
        this.isInitialized = false;
        this.sessionKey = 'aeon_session';
        this.maxSessionAge = 86400000; // 24 hours
    }

    /**
     * Initialize session manager
     */
    init() {
        if (this.isInitialized) return;
        
        // Try to restore session
        this.restoreSession();
        this.isInitialized = true;
        log.info('SessionManager initialized');
    }

    /**
     * Login user
     * @param {Object} user - User data
     * @param {boolean} remember - Remember me flag
     */
    login(user, remember = false) {
        this.session = {
            user: user,
            loggedInAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + this.maxSessionAge).toISOString(),
            remember: remember
        };

        // Save session
        this._saveSession();

        log.info(`User logged in: ${user.user_id || user.userId || user.username}`);
        
        // Emit event
        eventBus.emit(Events.AUTH_LOGIN, { user: user });

        return this.session;
    }

    /**
     * Logout user
     */
    logout() {
        const user = this.session?.user;
        this.session = null;
        
        // Clear session storage
        this._clearSession();

        log.info(`User logged out: ${user?.user_id || user?.userId || user?.username || 'unknown'}`);
        
        // Emit event
        eventBus.emit(Events.AUTH_LOGOUT, { user: user });

        return true;
    }

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        if (!this.session) {
            // Try to restore
            this.restoreSession();
        }

        if (!this.session) return false;

        // Check if session expired
        const now = Date.now();
        const expiresAt = new Date(this.session.expiresAt).getTime();
        
        if (now > expiresAt) {
            log.warning('Session expired');
            this.logout();
            return false;
        }

        return true;
    }

    /**
     * Get current user
     */
    currentUser() {
        if (!this.isLoggedIn()) return null;
        return this.session.user;
    }

    /**
     * Get session data
     */
    getSession() {
        if (!this.isLoggedIn()) return null;
        return { ...this.session };
    }

    /**
     * Save session to storage
     */
    _saveSession() {
        try {
            const data = JSON.stringify(this.session);
            
            if (this.session.remember) {
                localStorage.setItem(this.sessionKey, data);
            } else {
                sessionStorage.setItem(this.sessionKey, data);
            }
            
            log.debug('Session saved');
        } catch (error) {
            log.error('Failed to save session:', error);
        }
    }

    /**
     * Restore session from storage
     */
    restoreSession() {
        try {
            // Try sessionStorage first
            let data = sessionStorage.getItem(this.sessionKey);
            
            // Try localStorage if not found
            if (!data) {
                data = localStorage.getItem(this.sessionKey);
            }

            if (data) {
                this.session = JSON.parse(data);
                
                // Check if session expired
                const now = Date.now();
                const expiresAt = new Date(this.session.expiresAt).getTime();
                
                if (now > expiresAt) {
                    log.warning('Stored session expired');
                    this._clearSession();
                    this.session = null;
                    return false;
                }

                log.info(`Session restored for user: ${this.session.user?.user_id || this.session.user?.username || 'unknown'}`);
                
                // Emit event
                eventBus.emit('session:restored', { user: this.session.user });
                
                return true;
            }
        } catch (error) {
            log.error('Failed to restore session:', error);
            this.session = null;
        }

        return false;
    }

    /**
     * Clear session from storage
     */
    _clearSession() {
        try {
            localStorage.removeItem(this.sessionKey);
            sessionStorage.removeItem(this.sessionKey);
            log.debug('Session cleared from storage');
        } catch (error) {
            log.error('Failed to clear session:', error);
        }
    }

    /**
     * Refresh session (extend expiry)
     */
    refresh() {
        if (!this.session) return false;

        this.session.expiresAt = new Date(Date.now() + this.maxSessionAge).toISOString();
        this._saveSession();
        log.debug('Session refreshed');
        
        return true;
    }

    /**
     * Set max session age
     */
    setMaxSessionAge(age) {
        this.maxSessionAge = age;
        log.info(`Max session age set to ${age}ms`);
    }

    /**
     * Get session status
     */
    getStatus() {
        return {
            isLoggedIn: this.isLoggedIn(),
            user: this.currentUser(),
            sessionAge: this.session ? Date.now() - new Date(this.session.loggedInAt).getTime() : 0,
            expiresIn: this.session ? new Date(this.session.expiresAt).getTime() - Date.now() : 0
        };
    }
}

// Singleton instance
export const sessionManager = new SessionManager();

// Export default
export default sessionManager;