/**
 * Download Module - Handles master data download
 * @module download
 * @deprecated Use downloadService instead
 * Kept for backward compatibility
 */

import { downloadService } from './services/DownloadService.js';
import { logger } from './core/Logger.js';

const log = logger.child('Download (Legacy)');

// Re-export from service for backward compatibility
export const downloadMasterData = downloadService.downloadMasterData.bind(downloadService);
export const getDownloadStatus = downloadService.getStatus.bind(downloadService);
export const resetDownloadState = downloadService.reset.bind(downloadService);
export const hasData = downloadService.hasData.bind(downloadService);

// Legacy exports
export const DOWNLOAD_STEPS = [
    {
        id: 'user_dl',
        name: 'User Data',
        table: 'user_dl',
        icon: 'people'
    },
    {
        id: 'article_dl',
        name: 'Article Data',
        table: 'article_dl',
        icon: 'inventory_2'
    },
    {
        id: 'section_dl',
        name: 'Section Data',
        table: 'section_dl',
        icon: 'category'
    },
    {
        id: 'dept_dl',
        name: 'Department Data',
        table: 'dept_dl',
        icon: 'business'
    }
];

// Legacy function
export async function getTableData(tableName) {
    log.warning('getTableData is deprecated, use repository directly');
    const { articleRepository } = await import('./repository/ArticleRepository.js');
    const { userRepository } = await import('./repository/UserRepository.js');
    
    const repositories = {
        'article_dl': articleRepository,
        'user_dl': userRepository
    };
    
    const repo = repositories[tableName];
    if (repo) {
        return repo.findAll();
    }
    return [];
}

export default {
    downloadMasterData,
    getDownloadStatus,
    resetDownloadState,
    hasData,
    getTableData,
    DOWNLOAD_STEPS
};