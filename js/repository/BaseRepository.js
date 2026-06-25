/**
 * Base Repository - Abstract class for all repositories
 * @module repository/BaseRepository
 */

import { indexedDB } from '../storage.js';
import { logger } from '../core/Logger.js';
import { cacheManager } from '../core/CacheManager.js';
import { eventBus } from '../core/EventBus.js';

export class BaseRepository {
    constructor(storeName, options = {}) {
        if (this.constructor === BaseRepository) {
            throw new Error('BaseRepository is an abstract class');
        }

        this.storeName = storeName;
        this.useCache = options.useCache !== false;
        this.cacheTTL = options.cacheTTL || 300000; // 5 minutes
        this.logger = logger.child(`Repository:${storeName}`);
        
        this.logger.info(`Repository initialized for store: ${storeName}`);
    }

    /**
     * Get all records
     */
    async findAll() {
        const cacheKey = `${this.storeName}:findAll`;
        
        if (this.useCache) {
            const cached = cacheManager.get(cacheKey);
            if (cached !== null) {
                this.logger.debug(`Cache hit for findAll: ${this.storeName}`);
                return cached;
            }
        }

        this.logger.debug(`Fetching all from ${this.storeName}`);
        const data = await indexedDB.getAll(this.storeName);
        
        if (this.useCache) {
            cacheManager.set(cacheKey, data, this.cacheTTL);
        }
        
        return data;
    }

    /**
     * Find one record by ID
     */
    async findById(id) {
        const cacheKey = `${this.storeName}:findById:${id}`;
        
        if (this.useCache) {
            const cached = cacheManager.get(cacheKey);
            if (cached !== null) {
                this.logger.debug(`Cache hit for findById: ${id}`);
                return cached;
            }
        }

        this.logger.debug(`Finding by ID: ${id} from ${this.storeName}`);
        const data = await indexedDB.get(this.storeName, id);
        
        if (this.useCache && data) {
            cacheManager.set(cacheKey, data, this.cacheTTL);
        }
        
        return data;
    }

    /**
     * Find records by index
     */
    async findByIndex(indexName, value) {
        const cacheKey = `${this.storeName}:findByIndex:${indexName}:${JSON.stringify(value)}`;
        
        if (this.useCache) {
            const cached = cacheManager.get(cacheKey);
            if (cached !== null) {
                this.logger.debug(`Cache hit for findByIndex: ${indexName}`);
                return cached;
            }
        }

        this.logger.debug(`Finding by index: ${indexName}=${value} from ${this.storeName}`);
        const data = await indexedDB.getAll(this.storeName, indexName, value);
        
        if (this.useCache) {
            cacheManager.set(cacheKey, data, this.cacheTTL);
        }
        
        return data;
    }

    /**
     * Find one record by index
     */
    async findOneByIndex(indexName, value) {
        const results = await this.findByIndex(indexName, value);
        return results && results.length > 0 ? results[0] : null;
    }

    /**
     * Save a record
     */
    async save(data) {
        this.logger.debug(`Saving to ${this.storeName}`);
        const result = await indexedDB.add(this.storeName, data);
        
        // Invalidate cache
        if (this.useCache) {
            this._invalidateCache();
        }
        
        // Emit event
        eventBus.emit('repository:save', {
            store: this.storeName,
            id: result,
            data: data
        });
        
        return result;
    }

    /**
     * Save multiple records
     */
    async saveAll(dataArray) {
        if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) {
            this.logger.debug('No data to save');
            return [];
        }

        this.logger.debug(`Saving ${dataArray.length} records to ${this.storeName}`);
        
        // Clear existing data first
        await this.clear();
        
        // Save each record
        const results = [];
        for (const data of dataArray) {
            const id = await indexedDB.add(this.storeName, data);
            results.push(id);
        }
        
        // Invalidate cache
        if (this.useCache) {
            this._invalidateCache();
        }
        
        // Emit event
        eventBus.emit('repository:saveAll', {
            store: this.storeName,
            count: dataArray.length,
            ids: results
        });
        
        return results;
    }

    /**
     * Update a record
     */
    async update(data) {
        this.logger.debug(`Updating in ${this.storeName}`);
        const result = await indexedDB.update(this.storeName, data);
        
        // Invalidate cache
        if (this.useCache) {
            this._invalidateCache();
        }
        
        // Emit event
        eventBus.emit('repository:update', {
            store: this.storeName,
            data: data
        });
        
        return result;
    }

    /**
     * Delete a record
     */
    async delete(id) {
        this.logger.debug(`Deleting ID ${id} from ${this.storeName}`);
        const result = await indexedDB.delete(this.storeName, id);
        
        // Invalidate cache
        if (this.useCache) {
            this._invalidateCache();
        }
        
        // Emit event
        eventBus.emit('repository:delete', {
            store: this.storeName,
            id: id
        });
        
        return result;
    }

    /**
     * Clear all records in store
     */
    async clear() {
        this.logger.debug(`Clearing ${this.storeName}`);
        const result = await indexedDB.clear(this.storeName);
        
        // Invalidate cache
        if (this.useCache) {
            this._invalidateCache();
        }
        
        // Emit event
        eventBus.emit('repository:clear', {
            store: this.storeName
        });
        
        return result;
    }

    /**
     * Count records in store
     */
    async count() {
        const cacheKey = `${this.storeName}:count`;
        
        if (this.useCache) {
            const cached = cacheManager.get(cacheKey);
            if (cached !== null) {
                this.logger.debug(`Cache hit for count: ${this.storeName}`);
                return cached;
            }
        }

        const count = await indexedDB.count(this.storeName);
        
        if (this.useCache) {
            cacheManager.set(cacheKey, count, this.cacheTTL);
        }
        
        return count;
    }

    /**
     * Check if store has data
     */
    async hasData() {
        const count = await this.count();
        return count > 0;
    }

    /**
     * Search records by field
     */
    async search(field, searchTerm) {
        this.logger.debug(`Searching ${this.storeName} for ${field}=${searchTerm}`);
        const all = await this.findAll();
        const term = searchTerm.toLowerCase().trim();
        
        return all.filter(record => {
            const value = record[field];
            if (value === undefined || value === null) return false;
            return String(value).toLowerCase().includes(term);
        });
    }

    /**
     * Invalidate cache
     */
    _invalidateCache() {
        // Clear all cache for this store
        const keys = cacheManager.keys();
        const storeKeys = keys.filter(key => key.startsWith(`${this.storeName}:`));
        for (const key of storeKeys) {
            cacheManager.delete(key);
        }
        this.logger.debug(`Cache invalidated for ${this.storeName}`);
    }

    /**
     * Enable cache
     */
    enableCache() {
        this.useCache = true;
        this.logger.info('Cache enabled');
    }

    /**
     * Disable cache
     */
    disableCache() {
        this.useCache = false;
        this.logger.info('Cache disabled');
    }

    /**
     * Set cache TTL
     */
    setCacheTTL(ttl) {
        this.cacheTTL = ttl;
        this.logger.info(`Cache TTL set to ${ttl}ms`);
    }
}

export default BaseRepository;