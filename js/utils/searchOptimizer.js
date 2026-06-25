/**
 * Search Optimizer - Optimized search utilities
 * @module utils/searchOptimizer
 */

import { logger } from '../core/Logger.js';
import { performanceMonitor } from '../core/PerformanceMonitor.js';

const log = logger.child('SearchOptimizer');

class SearchOptimizer {
    constructor() {
        this.cache = new Map();
        this.maxCacheSize = 100;
        this.debounceTimers = new Map();
        this.indexes = new Map();
    }

    /**
     * Search with caching
     */
    async searchWithCache(data, searchFn, key) {
        // Check cache
        const cacheKey = `${key}:${JSON.stringify(data)}`;
        if (this.cache.has(cacheKey)) {
            log.debug(`Cache hit for: ${key}`);
            return this.cache.get(cacheKey);
        }

        // Execute search
        const result = await performanceMonitor.measureAsync(
            () => searchFn(data),
            `Search: ${key}`
        );

        // Cache result
        if (this.cache.size >= this.maxCacheSize) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(cacheKey, result);

        return result;
    }

    /**
     * Debounce search
     */
    debounce(id, fn, delay = 300) {
        if (this.debounceTimers.has(id)) {
            clearTimeout(this.debounceTimers.get(id));
        }

        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.debounceTimers.delete(id);
                resolve(fn());
            }, delay);
            this.debounceTimers.set(id, timer);
        });
    }

    /**
     * Build search index
     */
    buildIndex(data, fields) {
        const index = new Map();
        
        for (const item of data) {
            for (const field of fields) {
                const value = item[field];
                if (value) {
                    const key = String(value).toLowerCase();
                    if (!index.has(key)) {
                        index.set(key, []);
                    }
                    index.get(key).push(item);
                }
            }
        }

        return index;
    }

    /**
     * Search with index
     */
    searchWithIndex(query, index, fields) {
        const results = [];
        const terms = query.toLowerCase().trim().split(/\s+/);

        for (const term of terms) {
            if (index.has(term)) {
                results.push(...index.get(term));
            }
        }

        // Remove duplicates
        const unique = new Set();
        const filtered = results.filter(item => {
            const key = JSON.stringify(item);
            if (unique.has(key)) return false;
            unique.add(key);
            return true;
        });

        return this.rankResults(filtered, query, fields);
    }

    /**
     * Rank search results
     */
    rankResults(results, query, fields) {
        const queryLower = query.toLowerCase().trim();
        const queryWords = queryLower.split(/\s+/);

        return results.map(item => {
            let score = 0;
            const itemStr = JSON.stringify(item).toLowerCase();

            // Exact match bonus
            for (const field of fields) {
                const value = String(item[field] || '').toLowerCase();
                if (value === queryLower) {
                    score += 100;
                }
            }

            // Word match
            for (const word of queryWords) {
                if (itemStr.includes(word)) {
                    score += 10;
                }
            }

            // Field match
            for (const field of fields) {
                const value = String(item[field] || '').toLowerCase();
                if (value.includes(queryLower)) {
                    score += 20;
                }
            }

            return { item, score };
        })
        .sort((a, b) => b.score - a.score)
        .map(result => result.item);
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        log.info('Search cache cleared');
    }

    /**
     * Get cache stats
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            keys: Array.from(this.cache.keys())
        };
    }

    /**
     * Preload index
     */
    async preloadIndex(data, fields) {
        log.info(`Building index for ${data.length} items...`);
        const start = performance.now();
        this.indexes.set(fields.join(','), this.buildIndex(data, fields));
        const duration = performance.now() - start;
        log.info(`Index built in ${duration.toFixed(2)}ms`);
    }

    /**
     * Get index
     */
    getIndex(fields) {
        const key = fields.join(',');
        return this.indexes.get(key) || null;
    }
}

// Singleton instance
export const searchOptimizer = new SearchOptimizer();

export default searchOptimizer;