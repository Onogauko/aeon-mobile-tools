/**
 * Cache Manager Module - In-memory cache system
 * @module core/CacheManager
 */

import { logger } from './Logger.js';

// Create child logger
const log = logger.child('CacheManager');

class CacheManager {
    constructor() {
        this.cache = new Map();
        this.ttl = new Map();
        this.defaultTTL = 300000; // 5 minutes
        this.maxSize = 100;
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Set cache item
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds
     */
    set(key, value, ttl = null) {
        // Check size limit
        if (this.cache.size >= this.maxSize) {
            this._evictOldest();
        }

        const ttlValue = ttl || this.defaultTTL;
        this.cache.set(key, value);
        this.ttl.set(key, Date.now() + ttlValue);
        
        log.debug(`Cache set: ${key} (TTL: ${ttlValue}ms)`);
    }

    /**
     * Get cache item
     * @param {string} key - Cache key
     * @returns {*} Cached value or null
     */
    get(key) {
        // Check if expired
        if (this.ttl.has(key) && this.ttl.get(key) < Date.now()) {
            this.delete(key);
            log.debug(`Cache expired: ${key}`);
            this.misses++;
            return null;
        }

        if (this.cache.has(key)) {
            this.hits++;
            log.debug(`Cache hit: ${key}`);
            return this.cache.get(key);
        }

        this.misses++;
        log.debug(`Cache miss: ${key}`);
        return null;
    }

    /**
     * Get cache item or compute if not exists
     * @param {string} key - Cache key
     * @param {Function} fn - Function to compute value
     * @param {number} ttl - Time to live in milliseconds
     * @returns {*} Cached or computed value
     */
    async getOrCompute(key, fn, ttl = null) {
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }

        const value = await fn();
        this.set(key, value, ttl);
        return value;
    }

    /**
     * Check if key exists and not expired
     */
    has(key) {
        if (!this.cache.has(key)) return false;
        if (this.ttl.has(key) && this.ttl.get(key) < Date.now()) {
            this.delete(key);
            return false;
        }
        return true;
    }

    /**
     * Delete cache item
     */
    delete(key) {
        this.cache.delete(key);
        this.ttl.delete(key);
        log.debug(`Cache deleted: ${key}`);
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
        this.ttl.clear();
        this.hits = 0;
        this.misses = 0;
        log.info('Cache cleared');
    }

    /**
     * Get cache stats
     */
    getStats() {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? (this.hits / total * 100).toFixed(2) + '%' : '0%',
            keys: Array.from(this.cache.keys())
        };
    }

    /**
     * Set max cache size
     */
    setMaxSize(size) {
        this.maxSize = size;
        while (this.cache.size > this.maxSize) {
            this._evictOldest();
        }
        log.info(`Cache max size set to: ${size}`);
    }

    /**
     * Set default TTL
     */
    setDefaultTTL(ttl) {
        this.defaultTTL = ttl;
        log.info(`Default TTL set to: ${ttl}ms`);
    }

    /**
     * Evict oldest cache item
     */
    _evictOldest() {
        let oldestKey = null;
        let oldestTime = Infinity;

        for (const [key, time] of this.ttl) {
            if (time < oldestTime) {
                oldestTime = time;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.delete(oldestKey);
            log.debug(`Evicted oldest: ${oldestKey}`);
        }
    }

    /**
     * Refresh TTL for a key
     */
    refresh(key, ttl = null) {
        if (this.cache.has(key)) {
            const ttlValue = ttl || this.defaultTTL;
            this.ttl.set(key, Date.now() + ttlValue);
            log.debug(`TTL refreshed: ${key}`);
            return true;
        }
        return false;
    }

    /**
     * Get all keys
     */
    keys() {
        return Array.from(this.cache.keys());
    }

    /**
     * Get all values
     */
    values() {
        return Array.from(this.cache.values());
    }

    /**
     * Get all entries
     */
    entries() {
        return Array.from(this.cache.entries());
    }
}

// Singleton instance
export const cacheManager = new CacheManager();

// Export default
export default cacheManager;