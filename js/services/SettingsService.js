/**
 * Settings Service - Handles settings operations
 * @module services/SettingsService
 */

import { settingRepository } from '../repository/SettingRepository.js';
import { logger } from '../core/Logger.js';
import { eventBus, Events } from '../core/EventBus.js';

const log = logger.child('SettingsService');

class SettingsService {
    constructor() {
        this.log = log.child('SettingsService');
        this.cachedSettings = null;
    }

    /**
     * Get server IP
     */
    async getServerIP() {
        return settingRepository.getServerIP();
    }

    /**
     * Save server IP
     */
    async saveServerIP(ip) {
        await settingRepository.saveServerIP(ip);
        eventBus.emit(Events.SERVER_IP_CHANGED, { ip });
        log.info(`Server IP updated: ${ip}`);
    }

    /**
     * Get store code
     */
    async getStoreCode() {
        return settingRepository.getStoreCode();
    }

    /**
     * Get store name
     */
    async getStoreName() {
        return settingRepository.getStoreName();
    }

    /**
     * Get last download
     */
    async getLastDownload() {
        return settingRepository.getLastDownload();
    }

    /**
     * Get download count
     */
    async getDownloadCount() {
        return settingRepository.getDownloadCount();
    }

    /**
     * Get download stats
     */
    async getDownloadStats() {
        return settingRepository.getDownloadStats();
    }

    /**
     * Check if downloaded today
     */
    async isDownloadedToday() {
        return settingRepository.isDownloadedToday();
    }

    /**
     * Get auto sync setting
     */
    async getAutoSync() {
        return settingRepository.getAutoSync();
    }

    /**
     * Set auto sync
     */
    async setAutoSync(enabled) {
        await settingRepository.set('auto_sync', enabled);
        eventBus.emit(Events.SETTINGS_CHANGED, { key: 'auto_sync', value: enabled });
        log.info(`Auto sync set to: ${enabled}`);
    }

    /**
     * Get sync interval
     */
    async getSyncInterval() {
        return settingRepository.getSyncInterval();
    }

    /**
     * Set sync interval
     */
    async setSyncInterval(interval) {
        await settingRepository.set('sync_interval', interval);
        eventBus.emit(Events.SETTINGS_CHANGED, { key: 'sync_interval', value: interval });
        log.info(`Sync interval set to: ${interval}ms`);
    }

    /**
     * Get notification preference
     */
    async getNotifications() {
        return settingRepository.get('notifications', true);
    }

    /**
     * Set notification preference
     */
    async setNotifications(enabled) {
        await settingRepository.set('notifications', enabled);
        eventBus.emit(Events.SETTINGS_CHANGED, { key: 'notifications', value: enabled });
        log.info(`Notifications set to: ${enabled}`);
    }

    /**
     * Get theme preference
     */
    async getTheme() {
        return settingRepository.get('theme', 'light');
    }

    /**
     * Set theme preference
     */
    async setTheme(theme) {
        await settingRepository.set('theme', theme);
        eventBus.emit(Events.SETTINGS_CHANGED, { key: 'theme', value: theme });
        log.info(`Theme set to: ${theme}`);
    }

    /**
     * Get database size
     */
    async getDatabaseSize() {
        return settingRepository.getDatabaseSize();
    }

    /**
     * Save database size
     */
    async saveDatabaseSize(size) {
        await settingRepository.saveDatabaseSize(size);
        log.info(`Database size updated: ${size} MB`);
    }

    /**
     * Get total records
     */
    async getTotalRecords() {
        return settingRepository.getTotalRecords();
    }

    /**
     * Save total records
     */
    async saveTotalRecords(count) {
        await settingRepository.saveTotalRecords(count);
        log.info(`Total records updated: ${count}`);
    }

    /**
     * Get database version
     */
    async getDatabaseVersion() {
        return settingRepository.getDatabaseVersion();
    }

    /**
     * Update database version
     */
    async updateDatabaseVersion(version) {
        await settingRepository.saveDatabaseVersion(version);
        log.info(`Database version updated to: ${version}`);
    }

    /**
     * Get all settings
     */
    async getAllSettings() {
        if (this.cachedSettings) {
            return this.cachedSettings;
        }
        
        const settings = await settingRepository.getAllSettings();
        this.cachedSettings = settings;
        return settings;
    }

    /**
     * Test server connection
     */
    async testConnection(ip) {
        const { api } = await import('../api.js');
        return api.testConnection(ip);
    }

    /**
     * Check server availability
     */
    async checkServerAvailability() {
        const { api } = await import('../api.js');
        return api.checkServerAvailability();
    }

    /**
     * Validate settings
     */
    validateSettings(settings) {
        const errors = [];
        
        if (settings.server_ip && !this._isValidIP(settings.server_ip)) {
            errors.push('Invalid server IP address');
        }
        
        if (settings.sync_interval && settings.sync_interval < 60000) {
            errors.push('Sync interval must be at least 1 minute');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate IP address
     */
    _isValidIP(ip) {
        if (!ip) return false;
        const regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!regex.test(ip)) return false;
        
        const octets = ip.split('.');
        for (const octet of octets) {
            const num = parseInt(octet);
            if (num < 0 || num > 255) return false;
        }
        return true;
    }

    /**
     * Clear all settings
     */
    async clearAll() {
        await settingRepository.clearAll();
        this.cachedSettings = null;
        log.info('All settings cleared');
    }

    /**
     * Reset to defaults
     */
    async resetToDefaults() {
        const defaults = {
            server_ip: '',
            store_code: '',
            store_name: '',
            last_download: null,
            database_version: '1.0.0',
            download_count: 0,
            database_size: '0.00',
            total_records: 0,
            auto_sync: false,
            sync_interval: 3600000,
            notifications: true,
            theme: 'light',
            scanner_sound: true,
            scanner_vibration: true,
            continuous_scan: false,
            auto_focus: true,
            torch_default: false
        };
        
        await settingRepository.saveAllSettings(defaults);
        this.cachedSettings = defaults;
        log.info('Settings reset to defaults');
        
        return defaults;
    }

    /**
     * Reload cached settings
     */
    async reload() {
        this.cachedSettings = null;
        return this.getAllSettings();
    }

    /**
     * Get all metadata
     */
    async getMetadata() {
        return {
            databaseSize: await this.getDatabaseSize(),
            totalRecords: await this.getTotalRecords(),
            databaseVersion: await this.getDatabaseVersion(),
            lastDownload: await this.getLastDownload(),
            downloadCount: await this.getDownloadCount(),
            storeCode: await this.getStoreCode(),
            storeName: await this.getStoreName(),
            serverIP: await this.getServerIP()
        };
    }

    /**
     * Update metadata from download result
     */
    async updateMetadataFromDownload(stats) {
        if (stats.databaseSize) {
            await this.saveDatabaseSize(stats.databaseSize);
        }
        if (stats.totalRecords) {
            await this.saveTotalRecords(stats.totalRecords);
        }
        if (stats.databaseVersion) {
            await this.updateDatabaseVersion(stats.databaseVersion);
        }
        log.info('Metadata updated from download');
    }

    // ============================================
    // SCANNER SETTINGS
    // ============================================

    /**
     * Get scanner sound setting
     */
    async getScannerSound() {
        return settingRepository.get('scanner_sound', true);
    }

    /**
     * Set scanner sound
     */
    async setScannerSound(enabled) {
        await settingRepository.set('scanner_sound', enabled);
        eventBus.emit(Events.SETTINGS_CHANGED, { key: 'scanner_sound', value: enabled });
        log.info(`Scanner sound set to: ${enabled}`);
    }

    /**
     * Get scanner vibration setting
     */
    async getScannerVibration() {
        return settingRepository.get('scanner_vibration', true);
    }

    /**
     * Set scanner vibration
     */
    async setScannerVibration(enabled) {
        await settingRepository.set('scanner_vibration', enabled);
        eventBus.emit(Events.SETTINGS_CHANGED, { key: 'scanner_vibration', value: enabled });
        log.info(`Scanner vibration set to: ${enabled}`);
    }

    /**
     * Get continuous scan setting
     */
    async getContinuousScan() {
        return settingRepository.get('continuous_scan', false);
    }

    /**
     * Set continuous scan
     */
    async setContinuousScan(enabled) {
        await settingRepository.set('continuous_scan', enabled);
        eventBus.emit(Events.SETTINGS_CHANGED, { key: 'continuous_scan', value: enabled });
        log.info(`Continuous scan set to: ${enabled}`);
    }

    /**
     * Get auto focus setting
     */
    async getAutoFocus() {
        return settingRepository.get('auto_focus', true);
    }

    /**
     * Set auto focus
     */
    async setAutoFocus(enabled) {
        await settingRepository.set('auto_focus', enabled);
        eventBus.emit(Events.SETTINGS_CHANGED, { key: 'auto_focus', value: enabled });
        log.info(`Auto focus set to: ${enabled}`);
    }

    /**
     * Get torch default setting
     */
    async getTorchDefault() {
        return settingRepository.get('torch_default', false);
    }

    /**
     * Set torch default
     */
    async setTorchDefault(enabled) {
        await settingRepository.set('torch_default', enabled);
        eventBus.emit(Events.SETTINGS_CHANGED, { key: 'torch_default', value: enabled });
        log.info(`Torch default set to: ${enabled}`);
    }
}

// Export singleton instance
export const settingsService = new SettingsService();

export default settingsService;