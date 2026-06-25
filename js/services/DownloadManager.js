/**
 * Download Manager - Enhanced download management with pause/resume/cancel
 * @module services/DownloadManager
 */

import { logger } from '../core/Logger.js';
import { eventBus, Events } from '../core/EventBus.js';

const log = logger.child('DownloadManager');

class DownloadManager {
    constructor() {
        this.downloads = new Map();
        this.currentDownload = null;
        this.isPaused = false;
        this.isCancelled = false;
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    /**
     * Start a download
     */
    async startDownload(downloadFn, onProgress, options = {}) {
        const id = Date.now().toString();
        const download = {
            id,
            status: 'pending',
            progress: 0,
            startTime: Date.now(),
            options,
            pausedAt: 0,
            retries: 0
        };

        this.downloads.set(id, download);
        this.currentDownload = id;
        this.isPaused = false;
        this.isCancelled = false;
        this.retryCount = 0;

        log.info(`Download started: ${id}`);

        try {
            download.status = 'running';
            eventBus.emit('download:started', { id });

            const result = await this._executeDownload(downloadFn, (progress) => {
                if (this.isPaused) {
                    // Pause the download
                    throw new Error('PAUSED');
                }
                if (this.isCancelled) {
                    throw new Error('CANCELLED');
                }
                download.progress = progress;
                if (onProgress) onProgress(progress);
                eventBus.emit('download:progress', { id, progress });
            });

            download.status = 'completed';
            download.progress = 100;
            download.endTime = Date.now();
            eventBus.emit('download:completed', { id, result });
            log.info(`Download completed: ${id}`);

            return result;

        } catch (error) {
            if (error.message === 'PAUSED') {
                download.status = 'paused';
                download.pausedAt = Date.now();
                eventBus.emit('download:paused', { id });
                log.info(`Download paused: ${id}`);
                
                // Wait for resume or cancel
                await new Promise((resolve) => {
                    const checkInterval = setInterval(() => {
                        if (this.isCancelled) {
                            clearInterval(checkInterval);
                            resolve('cancelled');
                        } else if (!this.isPaused) {
                            clearInterval(checkInterval);
                            resolve('resumed');
                        }
                    }, 100);
                });

                if (this.isCancelled) {
                    throw new Error('CANCELLED');
                }

                // Resume download
                download.status = 'running';
                eventBus.emit('download:resumed', { id });
                log.info(`Download resumed: ${id}`);

                // Retry from beginning (simplified)
                return this.startDownload(downloadFn, onProgress, options);

            } else if (error.message === 'CANCELLED') {
                download.status = 'cancelled';
                eventBus.emit('download:cancelled', { id });
                log.info(`Download cancelled: ${id}`);
                throw new Error('Download cancelled');

            } else if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                log.warning(`Download failed, retrying (${this.retryCount}/${this.maxRetries})`);
                download.retries = this.retryCount;
                eventBus.emit('download:retry', { id, attempt: this.retryCount });
                
                await new Promise(resolve => setTimeout(resolve, 2000 * this.retryCount));
                return this.startDownload(downloadFn, onProgress, options);

            } else {
                download.status = 'failed';
                download.error = error.message;
                eventBus.emit('download:failed', { id, error: error.message });
                log.error(`Download failed: ${id}`, error);
                throw error;
            }
        }
    }

    /**
     * Execute download with pause support
     */
    async _executeDownload(downloadFn, onProgress) {
        return downloadFn(onProgress);
    }

    /**
     * Pause current download
     */
    pause() {
        if (!this.currentDownload) return false;
        if (this.isPaused) return false;

        this.isPaused = true;
        log.info('Download paused');
        return true;
    }

    /**
     * Resume current download
     */
    resume() {
        if (!this.currentDownload) return false;
        if (!this.isPaused) return false;

        this.isPaused = false;
        log.info('Download resumed');
        return true;
    }

    /**
     * Cancel current download
     */
    cancel() {
        if (!this.currentDownload) return false;

        this.isCancelled = true;
        this.isPaused = false;
        log.info('Download cancelled');
        return true;
    }

    /**
     * Retry failed download
     */
    retry() {
        if (!this.currentDownload) return false;
        const download = this.downloads.get(this.currentDownload);
        if (download.status !== 'failed' && download.status !== 'cancelled') return false;

        this.retryCount = 0;
        this.isCancelled = false;
        this.isPaused = false;
        download.status = 'pending';
        download.retries = 0;
        log.info('Retrying download');
        return true;
    }

    /**
     * Get download status
     */
    getStatus(id) {
        const download = this.downloads.get(id || this.currentDownload);
        if (!download) return null;

        return {
            id: download.id,
            status: download.status,
            progress: download.progress,
            duration: download.startTime ? Date.now() - download.startTime : 0,
            retries: download.retries,
            error: download.error
        };
    }

    /**
     * Get all downloads
     */
    getAllDownloads() {
        return Array.from(this.downloads.values());
    }

    /**
     * Clear completed downloads
     */
    clearCompleted() {
        for (const [id, download] of this.downloads) {
            if (download.status === 'completed' || download.status === 'cancelled' || download.status === 'failed') {
                this.downloads.delete(id);
            }
        }
        log.info('Completed downloads cleared');
    }
}

// Singleton instance
export const downloadManager = new DownloadManager();

export default downloadManager;