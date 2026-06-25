/**
 * Setting Repository - Handles settings data operations
 * @module repository/SettingRepository
 */

import { BaseRepository } from './BaseRepository.js';
import { logger } from '../core/Logger.js';

const log = logger.child('SettingRepository');

export class SettingRepository extends BaseRepository {
    constructor() {
        super('settings', { useCache: true, cacheTTL: 60000 });
        this.cache = new Map();
    }

    // ... (semua method yang sudah ada tetap sama) ...

    /**
     * Get database size
     */
    async getDatabaseSize() {
        return this.get('database_size', '0.00');
    }

    /**
     * Save database size
     */
    async saveDatabaseSize(size) {
        await this.set('database_size', size);
    }

    /**
     * Get total records
     */
    async getTotalRecords() {
        return this.get('total_records', 0);
    }

    /**
     * Save total records
     */
    async saveTotalRecords(count) {
        await this.set('total_records', count);
    }

    /**
     * Get database version
     */
    async getDatabaseVersion() {
        return this.get('database_version', '1.0.0');
    }

    /**
     * Save database version
     */
    async saveDatabaseVersion(version) {
        await this.set('database_version', version);
    }

    /**
     * Get download stats lengkap
     */
    async getDownloadStats() {
        return {
            lastDownload: await this.getLastDownload(),
            downloadCount: await this.getDownloadCount(),
            databaseVersion: await this.getDatabaseVersion(),
            isToday: await this.isDownloadedToday(),
            databaseSize: await this.getDatabaseSize(),
            totalRecords: await this.getTotalRecords(),
            storeCode: await this.getStoreCode(),
            storeName: await this.getStoreName()
        };
    }

    // ... (method lain tetap sama) ...
}

// Export singleton instance
export const settingRepository = new SettingRepository();

export default settingRepository;