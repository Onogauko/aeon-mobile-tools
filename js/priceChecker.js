/**
 * Price Checker Module - Handles product price checking
 * @module priceChecker
 * @deprecated Use priceCheckerService instead
 * Kept for backward compatibility
 */

import { priceCheckerService } from './services/PriceCheckerService.js';
import { logger } from './core/Logger.js';

const log = logger.child('PriceChecker (Legacy)');

// Re-export from service for backward compatibility
export const searchProduct = priceCheckerService.search.bind(priceCheckerService);
export const getByBarcode = priceCheckerService.getByBarcode.bind(priceCheckerService);
export const getBySku = priceCheckerService.getBySku.bind(priceCheckerService);
export const getRecentSearches = priceCheckerService.getRecentSearches.bind(priceCheckerService);
export const clearRecentSearches = priceCheckerService.clearRecentSearches.bind(priceCheckerService);
export const hasProductData = priceCheckerService.hasProductData.bind(priceCheckerService);
export const getAllProducts = priceCheckerService.getAllProducts.bind(priceCheckerService);

// Legacy function for backward compatibility
export async function searchByBarcode(barcode) {
    log.warning('searchByBarcode is deprecated, use getByBarcode');
    return priceCheckerService.getByBarcode(barcode);
}

export async function searchBySKU(sku) {
    log.warning('searchBySKU is deprecated, use getBySku');
    return priceCheckerService.getBySku(sku);
}

export async function searchByDescription(description) {
    log.warning('searchByDescription is deprecated, use search');
    const result = await priceCheckerService.search(description);
    return result.type === 'multiple' ? result.data : (result.type === 'single' ? [result.data] : []);
}

export async function saveRecentSearch(query, result) {
    log.warning('saveRecentSearch is deprecated, handled by service');
    // Handled by service internally
}

export default {
    searchProduct,
    searchByBarcode,
    searchBySKU,
    searchByDescription,
    getRecentSearches,
    clearRecentSearches,
    saveRecentSearch,
    getByBarcode,
    getBySku,
    hasProductData,
    getAllProducts
};