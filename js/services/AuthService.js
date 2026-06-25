/**
 * Auth Service - Handles authentication operations
 * @module services/AuthService
 */

import { userRepository } from '../repository/UserRepository.js';
import { historyRepository } from '../repository/HistoryRepository.js';
import { sessionManager } from '../core/SessionManager.js';
import { logger } from '../core/Logger.js';
import { eventBus, Events } from '../core/EventBus.js';

const log = logger.child('AuthService');

class AuthService {
    constructor() {
        this.log = log.child('AuthService');
        this.isInitialized = false;
    }

    /**
     * Initialize auth service
     */
    init() {
        if (this.isInitialized) return;
        sessionManager.init();
        this.isInitialized = true;
        log.info('AuthService initialized');
    }

    /**
     * Login user (offline)
     */
    async login(userId, password, remember = false) {
        if (!userId || !password) {
            return { success: false, error: 'User ID and password required' };
        }

        try {
            // Check if user data exists
            const hasUsers = await userRepository.hasData();
            if (!hasUsers) {
                log.warning('No user data found. Please download master data first.');
                return { 
                    success: false, 
                    error: 'No user data found. Please download master data first.' 
                };
            }

            // Authenticate via repository
            const result = await userRepository.authenticate(userId, password);

            if (result.success) {
                // Create session
                sessionManager.login(result.user, remember);
                
                // Log to history
                await historyRepository.logLogin(
                    `User ${userId} logged in successfully`,
                    'success',
                    { userId, user: result.user }
                );

                log.info(`User logged in: ${userId}`);
                
                // Emit event
                eventBus.emit(Events.AUTH_LOGIN, { user: result.user });

                return { success: true, user: result.user };
            } else {
                // Log failed attempt
                await historyRepository.logLogin(
                    `Failed login attempt for: ${userId}`,
                    'failed',
                    { userId, error: result.error }
                );

                log.warning(`Failed login attempt: ${userId}`);
                
                return { success: false, error: result.error || 'Wrong User ID or Password' };
            }

        } catch (error) {
            log.error('Login error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Logout user
     */
    logout() {
        const user = sessionManager.currentUser();
        sessionManager.logout();
        
        // Log to history
        historyRepository.logLogout(`User ${user?.userId || 'unknown'} logged out`);
        
        log.info('User logged out');
        
        // Emit event
        eventBus.emit(Events.AUTH_LOGOUT, { user: user });

        return { success: true };
    }

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return sessionManager.isLoggedIn();
    }

    /**
     * Get current user
     */
    currentUser() {
        return sessionManager.currentUser();
    }

    /**
     * Get session status
     */
    getSessionStatus() {
        return sessionManager.getStatus();
    }

    /**
     * Check if user data exists
     */
    async hasUserData() {
        try {
            return await userRepository.hasData();
        } catch (error) {
            log.error('Error checking user data:', error);
            return false;
        }
    }

    /**
     * Get user count
     */
    async getUserCount() {
        try {
            return await userRepository.count();
        } catch (error) {
            log.error('Error getting user count:', error);
            return 0;
        }
    }

    /**
     * Refresh session
     */
    refreshSession() {
        return sessionManager.refresh();
    }

    /**
     * Validate password strength
     */
    validatePassword(password) {
        const errors = [];
        
        if (password.length < 4) {
            errors.push('Password must be at least 4 characters');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}

// Singleton instance
export const authService = new AuthService();

export default authService;