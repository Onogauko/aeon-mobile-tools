/**
 * History Repository - Handles history data operations
 * @module repository/HistoryRepository
 */

import { BaseRepository } from './BaseRepository.js';
import { logger } from '../core/Logger.js';

const log = logger.child('HistoryRepository');

export class HistoryRepository extends BaseRepository {
    constructor() {
        super('history', { useCache: true, cacheTTL: 60000 });
        this.maxHistorySize = 1000;
    }

    /**
     * Add history entry
     */
    async addEntry(action, data = null, status = 'success', detail = '') {
        try {
            const entry = {
                action: action,
                data: data,
                status: status,
                detail: detail,
                timestamp: new Date().toISOString()
            };
            
            const id = await this.save(entry);
            
            // Trim history if too large
            await this._trimHistory();
            
            log.debug(`History entry added: ${action} (${status})`);
            
            // Emit event
            const { eventBus } = await import('../core/EventBus.js');
            eventBus.emit('history:added', {
                id: id,
                action: action,
                status: status
            });
            
            return id;
        } catch (error) {
            log.error('Error adding history entry:', error);
            return null;
        }
    }

    /**
     * Trim history to max size
     */
    async _trimHistory() {
        try {
            const all = await this.findAll();
            if (all.length > this.maxHistorySize) {
                const toDelete = all.slice(0, all.length - this.maxHistorySize);
                for (const item of toDelete) {
                    await this.delete(item.id);
                }
                log.info(`Trimmed ${toDelete.length} history entries`);
            }
        } catch (error) {
            log.error('Error trimming history:', error);
        }
    }

    /**
     * Get history by action
     */
    async getByAction(action) {
        try {
            const all = await this.findAll();
            return all.filter(entry => entry.action === action);
        } catch (error) {
            log.error('Error getting history by action:', error);
            return [];
        }
    }

    /**
     * Get history by status
     */
    async getByStatus(status) {
        try {
            const all = await this.findAll();
            return all.filter(entry => entry.status === status);
        } catch (error) {
            log.error('Error getting history by status:', error);
            return [];
        }
    }

    /**
     * Get recent history
     */
    async getRecent(limit = 20) {
        try {
            const all = await this.findAll();
            return all
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, limit);
        } catch (error) {
            log.error('Error getting recent history:', error);
            return [];
        }
    }

    /**
     * Get history by date range
     */
    async getByDateRange(startDate, endDate) {
        try {
            const all = await this.findAll();
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            return all.filter(entry => {
                const timestamp = new Date(entry.timestamp);
                return timestamp >= start && timestamp <= end;
            });
        } catch (error) {
            log.error('Error getting history by date range:', error);
            return [];
        }
    }

    /**
     * Get download history
     */
    async getDownloadHistory() {
        return this.getByAction('download');
    }

    /**
     * Get price check history
     */
    async getPriceCheckHistory() {
        return this.getByAction('price_check');
    }

    /**
     * Get login history
     */
    async getLoginHistory() {
        return this.getByAction('login');
    }

    /**
     * Log download event
     */
    async logDownload(detail, status = 'success', data = null) {
        return this.addEntry('download', data, status, detail);
    }

    /**
     * Log price check event
     */
    async logPriceCheck(detail, status = 'success', data = null) {
        return this.addEntry('price_check', data, status, detail);
    }

    /**
     * Log login event
     */
    async logLogin(detail, status = 'success', data = null) {
        return this.addEntry('login', data, status, detail);
    }

    /**
     * Log logout event
     */
    async logLogout(detail = 'User logged out', status = 'success') {
        return this.addEntry('logout', null, status, detail);
    }

    /**
     * Log sync event
     */
    async logSync(detail, status = 'success', data = null) {
        return this.addEntry('sync', data, status, detail);
    }

    /**
     * Clear all history
     */
    async clearAll() {
        await this.clear();
        log.info('All history cleared');
        
        // Emit event
        const { eventBus } = await import('../core/EventBus.js');
        eventBus.emit('history:cleared', {});
    }

    /**
     * Get history count
     */
    async getHistoryCount() {
        return this.count();
    }

    /**
     * Set max history size
     */
    setMaxSize(size) {
        this.maxHistorySize = size;
        log.info(`Max history size set to: ${size}`);
        // Trigger trim
        this._trimHistory();
    }
}

// Export singleton instance
export const historyRepository = new HistoryRepository();

export default historyRepository;