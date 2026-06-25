/**
 * Favorite Service - Handles favorite operations
 * @module services/FavoriteService
 */

import { favoriteRepository } from '../repository/FavoriteRepository.js';
import { logger } from '../core/Logger.js';
import { eventBus } from '../core/EventBus.js';

const log = logger.child('FavoriteService');

class FavoriteService {
    constructor() {
        this.log = log.child('FavoriteService');
    }

    /**
     * Add product to favorites
     */
    async addFavorite(product) {
        return favoriteRepository.addFavorite(product);
    }

    /**
     * Remove product from favorites
     */
    async removeFavorite(productId) {
        return favoriteRepository.removeFavorite(productId);
    }

    /**
     * Check if product is favorite
     */
    async isFavorite(productId) {
        return favoriteRepository.isFavorite(productId);
    }

    /**
     * Get all favorites
     */
    async getAllFavorites() {
        return favoriteRepository.getAllFavorites();
    }

    /**
     * Get favorite count
     */
    async getFavoriteCount() {
        return favoriteRepository.getFavoriteCount();
    }

    /**
     * Search favorites
     */
    async searchFavorites(query) {
        return favoriteRepository.searchFavorites(query);
    }

    /**
     * Clear all favorites
     */
    async clearAll() {
        return favoriteRepository.clearAll();
    }

    /**
     * Export favorites
     */
    async exportFavorites() {
        return favoriteRepository.exportFavorites();
    }

    /**
     * Toggle favorite status
     */
    async toggleFavorite(product) {
        const id = product.barcode || product.sku || product.article_code;
        const isFav = await this.isFavorite(id);
        if (isFav) {
            await this.removeFavorite(id);
            return { action: 'removed', isFavorite: false };
        } else {
            await this.addFavorite(product);
            return { action: 'added', isFavorite: true };
        }
    }
}

// Export singleton instance
export const favoriteService = new FavoriteService();

export default favoriteService;