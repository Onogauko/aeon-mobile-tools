/**
 * User Repository - Handles user data operations
 * @module repository/UserRepository
 */

import { BaseRepository } from './BaseRepository.js';
import { logger } from '../core/Logger.js';

const log = logger.child('UserRepository');

export class UserRepository extends BaseRepository {
    constructor() {
        super('user_dl', { useCache: true, cacheTTL: 60000 });
    }

    /**
     * Find user by user ID
     */
    async findByUserId(userId) {
        if (!userId) return null;
        
        try {
            const all = await this.findAll();
            const user = all.find(u => 
                u.user_id === userId || 
                u.userId === userId ||
                u.username === userId
            );
            
            log.debug(`Find by user ID: ${userId} -> ${user ? 'found' : 'not found'}`);
            return user || null;
        } catch (error) {
            log.error('Error finding user by ID:', error);
            return null;
        }
    }

    /**
     * Authenticate user (for offline login)
     */
    async authenticate(userId, password) {
        if (!userId || !password) {
            return { success: false, error: 'User ID and password required' };
        }

        try {
            const user = await this.findByUserId(userId);
            
            if (!user) {
                return { success: false, error: 'User not found' };
            }
            
            // TODO: Implement proper password hashing
            // For now, simple comparison
            const isValid = user.password === password || user.pass === password;
            
            if (isValid) {
                log.info(`User authenticated: ${userId}`);
                return { success: true, user: user };
            } else {
                log.warning(`Authentication failed for: ${userId}`);
                return { success: false, error: 'Invalid password' };
            }
        } catch (error) {
            log.error('Authentication error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Save multiple users
     */
    async saveUsers(users) {
        if (!users || !Array.isArray(users) || users.length === 0) {
            log.debug('No users to save');
            return 0;
        }

        log.info(`Saving ${users.length} users...`);
        await this.saveAll(users);
        
        // Emit event
        const { eventBus } = await import('../core/EventBus.js');
        eventBus.emit('repository:users:synced', {
            count: users.length
        });
        
        return users.length;
    }

    /**
     * Get all users
     */
    async getAllUsers() {
        return this.findAll();
    }

    /**
     * Get user count
     */
    async getUserCount() {
        return this.count();
    }

    /**
     * Check if any user exists
     */
    async hasUsers() {
        return this.hasData();
    }

    /**
     * Get user by email
     */
    async findByEmail(email) {
        if (!email) return null;
        
        try {
            const all = await this.findAll();
            const user = all.find(u => 
                u.email?.toLowerCase() === email?.toLowerCase()
            );
            return user || null;
        } catch (error) {
            log.error('Error finding user by email:', error);
            return null;
        }
    }

    /**
     * Get user by role
     */
    async findByRole(role) {
        if (!role) return [];
        
        try {
            const all = await this.findAll();
            return all.filter(u => 
                u.role?.toLowerCase() === role?.toLowerCase()
            );
        } catch (error) {
            log.error('Error finding users by role:', error);
            return [];
        }
    }
}

// Export singleton instance
export const userRepository = new UserRepository();

export default userRepository;