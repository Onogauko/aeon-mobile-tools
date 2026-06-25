/**
 * Price Checker Service - Handles price checking operations
 * @module services/PriceCheckerService
 */

import { articleRepository } from '../repository/ArticleRepository.js';
import { historyRepository } from '../repository/HistoryRepository.js';
import { logger } from '../core/Logger.js';
import { eventBus, Events } from '../core/EventBus.js';

// Create child logger once
const log = logger.child('PriceCheckerService');

// Recent search key
const RECENT_SEARCH_KEY = 'aeon_recent_searches';
const MAX_RECENT_SEARCHES = 10;
const RECENT_SCANS_KEY = 'aeon_recent_scans';
const MAX_RECENT_SCANS = 20;

class PriceCheckerService {
    constructor() {
        // Use existing log, don't create another child
        this.log = log;
        this.isSearching = false;
        this.dataAvailable = false;
    }

    /**
     * Check if data is available
     */
    async checkDataAvailability() {
        try {
            this.dataAvailable = await articleRepository.hasData();
            return this.dataAvailable;
        } catch (error) {
            this.log.error('Error checking data availability:', error);
            return false;
        }
    }

    /**
     * Search product by query
     */
    async search(query) {
        if (!query || query.trim() === '') {
            return { type: 'none', data: null };
        }

        if (this.isSearching) {
            throw new Error('Search is already in progress');
        }

        // Check if data is available
        const hasData = await this.checkDataAvailability();
        if (!hasData) {
            return {
                type: 'none',
                data: null,
                error: 'No product data found. Please download master data first.',
                needDownload: true
            };
        }

        this.isSearching = true;
        const searchTerm = query.trim();

        try {
            eventBus.emit(Events.PRICE_CHECK_START, { query: searchTerm });

            const result = await articleRepository.search(searchTerm);

            if (result.type !== 'none') {
                await historyRepository.logPriceCheck(
                    `Search: "${searchTerm}" -> ${result.type === 'single' ? 'Found' : result.data?.length || 0} results`,
                    'success',
                    { query: searchTerm, type: result.type, count: result.type === 'multiple' ? result.data?.length : 1 }
                );
            } else {
                await historyRepository.logPriceCheck(
                    `Search: "${searchTerm}" -> Not found`,
                    'not_found',
                    { query: searchTerm }
                );
            }

            if (result.type !== 'none') {
                this._saveRecentSearch(searchTerm, result.type === 'single' ? result.data : result.data?.[0]);
            } else {
                this._saveRecentSearch(searchTerm, null);
            }

            if (result.type === 'single') {
                eventBus.emit(Events.PRICE_CHECK_COMPLETE, {
                    query: searchTerm,
                    product: result.data
                });
            } else if (result.type === 'multiple') {
                eventBus.emit(Events.PRICE_CHECK_COMPLETE, {
                    query: searchTerm,
                    products: result.data,
                    count: result.data.length
                });
            } else {
                eventBus.emit(Events.PRICE_CHECK_NOT_FOUND, { query: searchTerm });
            }

            return result;

        } catch (error) {
            this.log.error('Search error:', error);
            eventBus.emit(Events.PRICE_CHECK_ERROR, {
                query: searchTerm,
                error: error.message
            });
            throw error;
        } finally {
            this.isSearching = false;
        }
    }

    /**
     * Get product by barcode
     */
    async getByBarcode(barcode) {
        try {
            // Check data availability
            const hasData = await this.checkDataAvailability();
            if (!hasData) {
                return null;
            }

            const product = await articleRepository.getByBarcode(barcode);
            
            if (product) {
                await historyRepository.logPriceCheck(
                    `Barcode scan: ${barcode}`,
                    'success',
                    { barcode, product }
                );
                this._saveRecentSearch(barcode, product);
                this._addRecentScan(barcode, product);
            } else {
                await historyRepository.logPriceCheck(
                    `Barcode scan: ${barcode} -> Not found`,
                    'not_found',
                    { barcode }
                );
                this._saveRecentSearch(barcode, null);
                this._addRecentScan(barcode, null);
            }
            
            return product;
        } catch (error) {
            this.log.error('Error getting by barcode:', error);
            return null;
        }
    }

    /**
     * Get product by SKU
     */
    async getBySku(sku) {
        try {
            const hasData = await this.checkDataAvailability();
            if (!hasData) {
                return null;
            }

            const product = await articleRepository.getBySku(sku);
            
            if (product) {
                await historyRepository.logPriceCheck(
                    `SKU lookup: ${sku}`,
                    'success',
                    { sku, product }
                );
            }
            
            return product;
        } catch (error) {
            this.log.error('Error getting by SKU:', error);
            return null;
        }
    }

    /**
     * Get recent searches
     */
    getRecentSearches() {
        try {
            const data = localStorage.getItem(RECENT_SEARCH_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            this.log.error('Error getting recent searches:', error);
            return [];
        }
    }

    /**
     * Clear recent searches
     */
    clearRecentSearches() {
        try {
            localStorage.removeItem(RECENT_SEARCH_KEY);
            this.log.info('Recent searches cleared');
        } catch (error) {
            this.log.error('Error clearing recent searches:', error);
        }
    }

    /**
     * Get recent scans
     */
    getRecentScans() {
        try {
            const data = localStorage.getItem(RECENT_SCANS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            this.log.error('Error getting recent scans:', error);
            return [];
        }
    }

    /**
     * Clear recent scans
     */
    clearRecentScans() {
        try {
            localStorage.removeItem(RECENT_SCANS_KEY);
            this.log.info('Recent scans cleared');
        } catch (error) {
            this.log.error('Error clearing recent scans:', error);
        }
    }

    /**
     * Save recent search
     */
    _saveRecentSearch(query, result) {
        try {
            const recent = this.getRecentSearches();
            
            const existingIndex = recent.findIndex(item => item.query === query);
            if (existingIndex !== -1) {
                recent.splice(existingIndex, 1);
            }
            
            recent.unshift({
                query: query,
                result: result ? {
                    sku: result.sku || result.article_code || '',
                    name: result.name || result.item_description || '',
                    barcode: result.barcode || '',
                    price: result.normal_price || result.price || 0
                } : null,
                timestamp: new Date().toISOString()
            });
            
            if (recent.length > MAX_RECENT_SEARCHES) {
                recent.length = MAX_RECENT_SEARCHES;
            }
            
            localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(recent));
        } catch (error) {
            this.log.error('Error saving recent search:', error);
        }
    }

    /**
     * Add recent scan
     */
    _addRecentScan(barcode, product) {
        try {
            const scans = this.getRecentScans();
            
            const existingIndex = scans.findIndex(item => item.barcode === barcode);
            if (existingIndex !== -1) {
                scans.splice(existingIndex, 1);
            }
            
            scans.unshift({
                id: Date.now(),
                barcode: barcode,
                sku: product?.sku || product?.article_code || '-',
                name: product?.name || product?.item_description || 'Unknown',
                timestamp: new Date().toISOString()
            });
            
            if (scans.length > MAX_RECENT_SCANS) {
                scans.length = MAX_RECENT_SCANS;
            }
            
            localStorage.setItem(RECENT_SCANS_KEY, JSON.stringify(scans));
        } catch (error) {
            this.log.error('Error adding recent scan:', error);
        }
    }

    /**
     * Check if product data exists
     */
    async hasProductData() {
        return this.checkDataAvailability();
    }

    /**
     * Get all products
     */
    async getAllProducts() {
        const hasData = await this.checkDataAvailability();
        if (!hasData) {
            return [];
        }
        return articleRepository.findAll();
    }

    /**
     * Get data status
     */
    async getDataStatus() {
        const hasData = await this.checkDataAvailability();
        const count = hasData ? await articleRepository.count() : 0;
        return {
            available: hasData,
            count: count,
            lastUpdate: hasData ? await this._getLastUpdate() : null
        };
    }

    /**
     * Get last update
     */
    async _getLastUpdate() {
        try {
            const all = await articleRepository.findAll();
            if (all.length === 0) return null;
            const latest = all.reduce((a, b) => 
                new Date(a.synced_at || 0) > new Date(b.synced_at || 0) ? a : b
            );
            return latest.synced_at || null;
        } catch (error) {
            return null;
        }
    }
}

// Export singleton instance
export const priceCheckerService = new PriceCheckerService();

export default priceCheckerService;