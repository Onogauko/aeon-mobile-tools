/**
 * Favorite Repository - Handles favorite products data operations
 * @module repository/FavoriteRepository
 */

import { BaseRepository } from './BaseRepository.js';
import { logger } from '../core/Logger.js';

const log = logger.child('FavoriteRepository');

export class FavoriteRepository extends BaseRepository {
    constructor() {
        super('favorite', { useCache: true, cacheTTL: 60000 });
        this.cache = new Map();
    }

    /**
     * Add product to favorites
     */
    async addFavorite(product) {
        try {
            // Check if already exists
            const exists = await this.isFavorite(product.barcode || product.sku || product.article_code);
            if (exists) {
                log.debug('Product already in favorites');
                return false;
            }

            const favorite = {
                product_id: product.id || product.article_code || product.sku,
                barcode: product.barcode || '',
                sku: product.sku || product.article_code || '',
                name: product.name || product.item_description || '',
                price: product.normal_price || product.price || 0,
                promo_price: product.promo_price || 0,
                department: product.department || '',
                section: product.section || '',
                supplier: product.supplier || '',
                added_at: new Date().toISOString(),
                synced_at: new Date().toISOString()
            };

            const id = await this.save(favorite);
            this.cache.set(favorite.product_id, favorite);
            
            log.info(`Favorite added: ${favorite.name}`);
            
            // Emit event
            const { eventBus } = await import('../core/EventBus.js');
            eventBus.emit('favorite:added', { favorite });
            
            return true;
        } catch (error) {
            log.error('Error adding favorite:', error);
            return false;
        }
    }

    /**
     * Remove product from favorites
     */
    async removeFavorite(productId) {
        try {
            const all = await this.findAll();
            const favorite = all.find(f => 
                f.product_id === productId || 
                f.barcode === productId || 
                f.sku === productId
            );
            
            if (!favorite) {
                log.debug('Favorite not found');
                return false;
            }

            await this.delete(favorite.id);
            this.cache.delete(favorite.product_id);
            
            log.info(`Favorite removed: ${favorite.name}`);
            
            // Emit event
            const { eventBus } = await import('../core/EventBus.js');
            eventBus.emit('favorite:removed', { favorite });
            
            return true;
        } catch (error) {
            log.error('Error removing favorite:', error);
            return false;
        }
    }

    /**
     * Check if product is favorite
     */
    async isFavorite(productId) {
        try {
            const all = await this.findAll();
            return all.some(f => 
                f.product_id === productId || 
                f.barcode === productId || 
                f.sku === productId
            );
        } catch (error) {
            log.error('Error checking favorite:', error);
            return false;
        }
    }

    /**
     * Get all favorites
     */
    async getAllFavorites() {
        try {
            const all = await this.findAll();
            return all.sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
        } catch (error) {
            log.error('Error getting favorites:', error);
            return [];
        }
    }

    /**
     * Get favorite count
     */
    async getFavoriteCount() {
        try {
            return await this.count();
        } catch (error) {
            log.error('Error getting favorite count:', error);
            return 0;
        }
    }

    /**
     * Search favorites
     */
    async searchFavorites(query) {
        try {
            const all = await this.findAll();
            const term = query.toLowerCase().trim();
            
            return all.filter(f => 
                f.name.toLowerCase().includes(term) ||
                f.barcode.toLowerCase().includes(term) ||
                f.sku.toLowerCase().includes(term)
            );
        } catch (error) {
            log.error('Error searching favorites:', error);
            return [];
        }
    }

    /**
     * Clear all favorites
     */
    async clearAll() {
        await this.clear();
        this.cache.clear();
        log.info('All favorites cleared');
        
        // Emit event
        const { eventBus } = await import('../core/EventBus.js');
        eventBus.emit('favorite:cleared', {});
    }

    /**
     * Export favorites to JSON
     */
    async exportFavorites() {
        try {
            const favorites = await this.getAllFavorites();
            return {
                count: favorites.length,
                exported_at: new Date().toISOString(),
                data: favorites
            };
        } catch (error) {
            log.error('Error exporting favorites:', error);
            return null;
        }
    }
}

// Export singleton instance
export const favoriteRepository = new FavoriteRepository();

export default favoriteRepository;