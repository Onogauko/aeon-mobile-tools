/**
 * Download Service - Handles download operations using AEON HHT API
 * @module services/DownloadService
 */

import { api } from '../api.js';
import { logger } from '../core/Logger.js';
import { eventBus, Events } from '../core/EventBus.js';
import { articleRepository } from '../repository/ArticleRepository.js';
import { userRepository } from '../repository/UserRepository.js';
import { historyRepository } from '../repository/HistoryRepository.js';
import { settingRepository } from '../repository/SettingRepository.js';

const log = logger.child('DownloadService');

export const DOWNLOAD_STEPS = [
    {
        id: 'user_dl',
        name: 'User Data',
        table: 'user_dl',
        apiMethod: api.downloadUsers.bind(api),
        repository: userRepository,
        icon: 'people'
    },
    {
        id: 'article_dl',
        name: 'Article Data',
        table: 'article_dl',
        apiMethod: api.downloadArticles.bind(api),
        repository: articleRepository,
        icon: 'inventory_2'
    },
    {
        id: 'section_dl',
        name: 'Section Data',
        table: 'section_dl',
        apiMethod: api.downloadSections.bind(api),
        repository: null,
        icon: 'category'
    },
    {
        id: 'dept_dl',
        name: 'Department Data',
        table: 'dept_dl',
        apiMethod: api.downloadDepts.bind(api),
        repository: null,
        icon: 'business'
    }
];

class DownloadService {
    constructor() {
        this.isRunning = false;
        this.currentStep = 0;
        this.progress = 0;
        this.status = 'idle';
        this.results = {};
        this.startTime = null;
        this.endTime = null;
        this.retryCount = 0;
        this.log = log.child('DownloadService');
    }

    async isDownloadNeeded() {
        try {
            const isToday = await settingRepository.isDownloadedToday();
            const hasData = await this.hasData();
            
            if (isToday && hasData) {
                return { needed: false, reason: 'Already downloaded today' };
            }
            
            if (!hasData) {
                return { needed: true, reason: 'No data found' };
            }
            
            const lastDownload = await settingRepository.getLastDownload();
            if (lastDownload) {
                const daysSince = (Date.now() - new Date(lastDownload).getTime()) / (1000 * 60 * 60 * 24);
                if (daysSince >= 1) {
                    return { needed: true, reason: `Last download was ${Math.floor(daysSince)} days ago` };
                }
            }
            
            return { needed: false, reason: 'Data is up to date' };
        } catch (error) {
            log.error('Error checking download need:', error);
            return { needed: true, reason: 'Error checking, forcing download' };
        }
    }

    async downloadMasterData(onProgress, force = false) {
        if (this.isRunning) {
            throw new Error('Download is already in progress');
        }

        if (!force) {
            const needCheck = await this.isDownloadNeeded();
            if (!needCheck.needed) {
                log.info(`Download not needed: ${needCheck.reason}`);
                return {
                    success: true,
                    skipped: true,
                    reason: needCheck.reason
                };
            }
        }

        this.isRunning = true;
        this.currentStep = 0;
        this.progress = 0;
        this.status = 'running';
        this.results = {};
        this.startTime = Date.now();
        this.endTime = null;
        this.retryCount = 0;

        eventBus.emit(Events.DOWNLOAD_STARTED, { force });
        log.info(`Download started${force ? ' (force)' : ''}`);

        try {
            const serverIP = await settingRepository.getServerIP();
            if (!serverIP) {
                throw new Error('Server IP not configured. Please set Server IP in Settings.');
            }

            if (onProgress) {
                onProgress({
                    ...this._getState(),
                    message: 'Connecting to AEON Server...',
                    progress: 0
                });
            }

            let storeData = null;
            let connectionError = null;
            
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const connectionTest = await api.testConnection(serverIP);
                    if (connectionTest.success) {
                        storeData = connectionTest.data;
                        connectionError = null;
                        break;
                    } else {
                        connectionError = connectionTest.error;
                        log.warning(`Connection attempt ${attempt} failed: ${connectionError}`);
                        if (attempt < 3) {
                            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                        }
                    }
                } catch (error) {
                    connectionError = error.message;
                    log.warning(`Connection attempt ${attempt} error: ${connectionError}`);
                    if (attempt < 3) {
                        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                    }
                }
            }

            if (!storeData) {
                throw new Error(`Cannot connect to AEON Server: ${connectionError || 'Unknown error'}`);
            }

            if (storeData) {
                if (storeData.store_code) {
                    await settingRepository.saveStoreCode(storeData.store_code);
                }
                if (storeData.store_name) {
                    await settingRepository.saveStoreName(storeData.store_name);
                }
                log.info(`Store: ${storeData.store_name || 'Unknown'} (${storeData.store_code || 'N/A'})`);
            }

            log.info('Connection to AEON Server successful');

            const totalSteps = DOWNLOAD_STEPS.length;
            let totalRecords = 0;
            let successCount = 0;

            for (let i = 0; i < DOWNLOAD_STEPS.length; i++) {
                const step = DOWNLOAD_STEPS[i];
                this.currentStep = i;

                const stepProgress = (i / totalSteps) * 100;
                this.progress = stepProgress;

                if (onProgress) {
                    onProgress({
                        ...this._getState(),
                        step: step,
                        progress: stepProgress,
                        message: `Downloading ${step.name}...`
                    });
                }

                let data = null;
                let downloadError = null;
                let stepRetryCount = 0;
                const stepStartTime = Date.now();

                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        this.retryCount++;
                        const result = await step.apiMethod();
                        data = result;
                        downloadError = null;
                        break;
                    } catch (error) {
                        downloadError = error;
                        stepRetryCount++;
                        log.warning(`Retry ${attempt}/3 for ${step.id}: ${error.message}`);
                        if (attempt < 3) {
                            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                        }
                    }
                }

                const stepDuration = Date.now() - stepStartTime;

                if (!data && downloadError) {
                    throw new Error(`Failed to download ${step.name} after 3 retries: ${downloadError.message}`);
                }

                try {
                    let count = 0;
                    if (step.repository && step.repository.saveArticles) {
                        count = await step.repository.saveArticles(data);
                    } else if (step.repository && step.repository.saveAll) {
                        count = await step.repository.saveAll(data);
                    } else if (step.repository) {
                        await step.repository.saveAll(data);
                        count = Array.isArray(data) ? data.length : 1;
                    }

                    const speed = count > 0 ? Math.round(count / (stepDuration / 1000)) : 0;
                    
                    this.results[step.id] = {
                        success: true,
                        count: count || (Array.isArray(data) ? data.length : 1),
                        table: step.table,
                        duration: stepDuration,
                        speed: speed,
                        retries: stepRetryCount
                    };

                    totalRecords += this.results[step.id].count;
                    successCount++;

                    const afterStepProgress = ((i + 1) / totalSteps) * 100;
                    this.progress = afterStepProgress;

                    if (onProgress) {
                        onProgress({
                            ...this._getState(),
                            step: step,
                            progress: afterStepProgress,
                            message: `✓ Completed ${step.name} (${this.results[step.id].count} records)`
                        });
                    }

                    eventBus.emit(Events.DOWNLOAD_PROGRESS, {
                        step: step.id,
                        progress: afterStepProgress,
                        count: this.results[step.id].count,
                        speed: speed,
                        duration: stepDuration
                    });

                    log.info(`✓ Completed ${step.id}: ${this.results[step.id].count} records`);

                } catch (error) {
                    log.error(`Error saving ${step.id}:`, error);
                    this.results[step.id] = {
                        success: false,
                        error: error.message,
                        table: step.table,
                        duration: stepDuration,
                        retries: stepRetryCount
                    };

                    if (onProgress) {
                        onProgress({
                            ...this._getState(),
                            step: step,
                            error: error.message,
                            message: `✗ Failed: ${step.name}`
                        });
                    }
                }
            }

            this.status = 'completed';
            this.progress = 100;
            this.endTime = Date.now();
            const totalDuration = this.endTime - this.startTime;

            await settingRepository.saveLastDownload(new Date().toISOString());
            await settingRepository.incrementDownloadCount();

            const dbSize = await this._calculateDatabaseSize();

            await historyRepository.logDownload(
                `Downloaded ${totalRecords} records (${successCount}/${totalSteps} steps)`,
                successCount === totalSteps ? 'success' : 'partial',
                {
                    results: this.results,
                    duration: totalDuration,
                    records: totalRecords,
                    steps: successCount
                }
            );

            eventBus.emit(Events.DOWNLOAD_COMPLETED, {
                results: this.results,
                totalRecords,
                successCount,
                duration: totalDuration
            });

            eventBus.emit(Events.DATA_SYNCED, {
                records: totalRecords,
                timestamp: new Date().toISOString()
            });

            log.info(`Download complete: ${totalRecords} records`);

            if (onProgress) {
                onProgress({
                    ...this._getState(),
                    message: `✅ Download complete! ${totalRecords} records`,
                    summary: {
                        totalRecords,
                        successCount,
                        failedCount: totalSteps - successCount,
                        totalSteps,
                        duration: totalDuration
                    }
                });
            }

            return {
                success: true,
                results: this.results,
                summary: {
                    totalRecords,
                    successCount,
                    failedCount: totalSteps - successCount,
                    totalSteps,
                    duration: totalDuration
                }
            };

        } catch (error) {
            this.status = 'error';
            this.error = error.message;
            this.endTime = Date.now();

            log.error('Download error:', error);

            eventBus.emit(Events.DOWNLOAD_FAILED, {
                error: error.message
            });

            await historyRepository.logDownload(
                `Download failed: ${error.message}`,
                'failed',
                { error: error.message }
            );

            throw error;

        } finally {
            this.isRunning = false;
        }
    }

    async _calculateDatabaseSize() {
        try {
            const userCount = await userRepository.count();
            const articleCount = await articleRepository.count();
            const total = userCount + articleCount;
            return (total * 0.1).toFixed(2);
        } catch (error) {
            return '0.00';
        }
    }

    _getState() {
        return {
            isRunning: this.isRunning,
            currentStep: this.currentStep,
            progress: this.progress,
            status: this.status,
            results: this.results,
            startTime: this.startTime,
            endTime: this.endTime,
            retryCount: this.retryCount
        };
    }

    getStatus() {
        return this._getState();
    }

    reset() {
        this.isRunning = false;
        this.currentStep = 0;
        this.progress = 0;
        this.status = 'idle';
        this.results = {};
        this.error = null;
        this.startTime = null;
        this.endTime = null;
        this.retryCount = 0;
        log.info('Download state reset');
    }

    async hasData() {
        try {
            const articleCount = await articleRepository.count();
            const userCount = await userRepository.count();
            return articleCount > 0 || userCount > 0;
        } catch (error) {
            log.error('Error checking data:', error);
            return false;
        }
    }

    async getDownloadStats() {
        try {
            const stats = await settingRepository.getDownloadStats();
            const articleCount = await articleRepository.count();
            const userCount = await userRepository.count();
            const storeCode = await settingRepository.getStoreCode();
            const storeName = await settingRepository.getStoreName();
            const dbSize = await this._calculateDatabaseSize();
            
            return {
                ...stats,
                articleCount,
                userCount,
                totalRecords: articleCount + userCount,
                storeCode,
                storeName,
                databaseSize: dbSize,
                isOnline: navigator.onLine
            };
        } catch (error) {
            log.error('Error getting download stats:', error);
            return null;
        }
    }

    async checkServerConnection() {
        try {
            const ip = await settingRepository.getServerIP();
            if (!ip) {
                return { connected: false, error: 'Server IP not configured' };
            }
            const result = await api.testConnection(ip);
            return {
                connected: result.success,
                data: result.data,
                error: result.error
            };
        } catch (error) {
            log.error('Error checking server connection:', error);
            return { connected: false, error: error.message };
        }
    }
}

export const downloadService = new DownloadService();

export default downloadService;