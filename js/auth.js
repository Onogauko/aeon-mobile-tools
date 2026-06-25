/**
 * Authentication Module - Handles user authentication
 * @module auth
 */

import { localStore } from './storage.js';
import Config from './config.js';

// Auth state
let authState = {
    isAuthenticated: false,
    user: null,
    token: null
};

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
    const token = getToken();
    const user = getUser();
    return !!(token && user);
}

/**
 * Get authentication token
 */
export function getToken() {
    return localStore.get(Config.storageKeys.token);
}

/**
 * Get user data
 */
export function getUser() {
    return localStore.get(Config.storageKeys.user);
}

/**
 * Login user
 * @param {string} userId - User ID
 * @param {string} password - User password
 * @param {boolean} remember - Remember me flag
 */
export async function login(userId, password, remember = false) {
    try {
        // TODO: Connect to real API for authentication
        // For now, we accept any credentials
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Create user session
        const userData = {
            userId: userId,
            name: userId, // In real app, get from API
            role: 'user',
            loginTime: new Date().toISOString()
        };
        
        const token = 'temp_token_' + Date.now();
        
        // Store credentials
        if (remember) {
            localStore.set(Config.storageKeys.token, token);
            localStore.set(Config.storageKeys.user, userData);
        } else {
            sessionStorage.setItem(Config.storageKeys.token, token);
            sessionStorage.setItem(Config.storageKeys.user, JSON.stringify(userData));
        }
        
        // Update auth state
        authState = {
            isAuthenticated: true,
            user: userData,
            token: token
        };
        
        console.log('[Auth] User logged in:', userId);
        return { success: true, user: userData };
        
    } catch (error) {
        console.error('[Auth] Login error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Logout user
 */
export function logout() {
    // Clear stored credentials
    localStore.remove(Config.storageKeys.token);
    localStore.remove(Config.storageKeys.user);
    sessionStorage.removeItem(Config.storageKeys.token);
    sessionStorage.removeItem(Config.storageKeys.user);
    
    // Reset auth state
    authState = {
        isAuthenticated: false,
        user: null,
        token: null
    };
    
    console.log('[Auth] User logged out');
    return true;
}

/**
 * Update user data
 */
export function updateUser(userData) {
    const currentUser = getUser();
    if (!currentUser) return false;
    
    const updatedUser = { ...currentUser, ...userData };
    
    if (localStore.has(Config.storageKeys.user)) {
        localStore.set(Config.storageKeys.user, updatedUser);
    } else {
        sessionStorage.setItem(Config.storageKeys.user, JSON.stringify(updatedUser));
    }
    
    authState.user = updatedUser;
    return updatedUser;
}

/**
 * Get current auth state
 */
export function getAuthState() {
    const token = getToken();
    const user = getUser();
    
    authState = {
        isAuthenticated: !!(token && user),
        user: user,
        token: token
    };
    
    return authState;
}

export default {
    login,
    logout,
    isAuthenticated,
    getUser,
    getToken,
    updateUser,
    getAuthState
};