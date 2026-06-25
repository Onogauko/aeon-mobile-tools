/**
 * Article Repository - Handles article/product data operations
 * @module repository/ArticleRepository
 */

import { BaseRepository } from './BaseRepository.js';
import { logger } from '../core/Logger.js';

const log = logger.child('ArticleRepository');

export class ArticleRepository extends BaseRepository {
    constructor() {
        super('article_dl', { useCache: true, cacheTTL: 300000 });
    }

    /**
     * Get product by barcode
     */
    async getByBarcode(barcode) {
        if (!barcode) return null;
        
        try {
            const all = await this.findAll();
            const result = all.find(product => 
                product.barcode === barcode || 
                product.barcode?.toLowerCase() === barcode?.toLowerCase()
            );
            
            log.debug(`Search by barcode: ${barcode} -> ${result ? 'found' : 'not found'}`);
            return result || null;
        } catch (error) {
            log.error('Error searching by barcode:', error);
            return null;
        }
    }

    /**
     * Get product by SKU
     */
    async getBySku(sku) {
        if (!sku) return null;
        
        try {
            const all = await this.findAll();
            const result = all.find(product => 
                product.sku === sku || 
                product.sku?.toLowerCase() === sku?.toLowerCase() ||
                product.article_code === sku ||
                product.article_code?.toLowerCase() === sku?.toLowerCase()
            );
            
            log.debug(`Search by SKU: ${sku} -> ${result ? 'found' : 'not found'}`);
            return result || null;
        } catch (error) {
            log.error('Error searching by SKU:', error);
            return null;
        }
    }

    /**
     * Get product by any identifier (barcode or SKU)
     */
    async getByIdentifier(identifier) {
        if (!identifier) return null;
        
        // Try barcode first
        let result = await this.getByBarcode(identifier);
        if (result) return result;
        
        // Try SKU
        result = await this.getBySku(identifier);
        if (result) return result;
        
        return null;
    }

    /**
     * Search products by description
     */
    async searchByDescription(description) {
        if (!description) return [];
        
        try {
            const all = await this.findAll();
            const searchTerm = description.toLowerCase().trim();
            
            const results = all.filter(product => {
                const name = product.name?.toLowerCase() || '';
                const desc = product.description?.toLowerCase() || '';
                const itemDesc = product.item_description?.toLowerCase() || '';
                
                return name.includes(searchTerm) || 
                       desc.includes(searchTerm) || 
                       itemDesc.includes(searchTerm);
            });
            
            log.debug(`Search by description: ${description} -> ${results.length} results`);
            return results;
        } catch (error) {
            log.error('Error searching by description:', error);
            return [];
        }
    }

    /**
     * Search products (unified search)
     */
    async search(query) {
        if (!query || query.trim() === '') {
            return { type: 'none', data: null };
        }

        const searchTerm = query.trim();
        
        try {
            // Try barcode
            let result = await this.getByBarcode(searchTerm);
            if (result) {
                return { type: 'single', data: result };
            }
            
            // Try SKU
            result = await this.getBySku(searchTerm);
            if (result) {
                return { type: 'single', data: result };
            }
            
            // Try description
            const results = await this.searchByDescription(searchTerm);
            if (results && results.length > 0) {
                return { type: 'multiple', data: results };
            }
            
            return { type: 'none', data: null };
            
        } catch (error) {
            log.error('Error searching products:', error);
            throw error;
        }
    }

    /**
     * Save multiple articles
     */
    async saveArticles(articles) {
        if (!articles || !Array.isArray(articles) || articles.length === 0) {
            log.debug('No articles to save');
            return 0;
        }

        log.info(`Saving ${articles.length} articles...`);
        await this.saveAll(articles);
        
        // Emit event
        const { eventBus } = await import('../core/EventBus.js');
        eventBus.emit('repository:articles:synced', {
            count: articles.length
        });
        
        return articles.length;
    }

    /**
     * Get all products with prices
     */
    async getAllWithPrices() {
        const all = await this.findAll();
        return all.map(product => ({
            ...product,
            normal_price_formatted: this._formatPrice(product.normal_price || product.price),
            promo_price_formatted: this._formatPrice(product.promo_price)
        }));
    }

    /**
     * Format price
     */
    _formatPrice(value) {
        if (!value) return 'Rp 0';
        const num = parseFloat(value);
        if (isNaN(num)) return 'Rp 0';
        return 'Rp ' + num.toLocaleString('id-ID');
    }

    /**
     * Check if any article data exists
     */
    async hasArticles() {
        return this.hasData();
    }

    /**
     * Get article count
     */
    async getArticleCount() {
        return this.count();
    }
}

// Export singleton instance
export const articleRepository = new ArticleRepository();

export default articleRepository;