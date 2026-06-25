/**
 * Configuration Module - Application settings
 * @module config
 */

export const Config = {
    app: {
        name: 'AEON Mobile Tools',
        version: '1.0.0',
        description: 'Mobile tools for AEON retail operations',
        author: 'AEON'
    },
    
    api: {
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 2000,
        basePath: '/aeon-panel/Api/'
    },
    
    database: {
        name: 'AEONToolsDB',
        version: 3,
        stores: {
            users: '++id, username, email, created_at',
            products: '++id, code, name, price, category, updated_at',
            history: '++id, action, data, timestamp',
            settings: '++id, key, value, updated_at',
            user_dl: '++id, user_id, name, email, role, synced_at',
            article_dl: '++id, article_code, name, price, category, barcode, sku, normal_price, promo_price, department, section, supplier, item_description, synced_at',
            section_dl: '++id, section_code, name, description, synced_at',
            dept_dl: '++id, dept_code, name, description, synced_at',
            favorite: '++id, product_id, barcode, sku, name, price, promo_price, department, section, supplier, added_at, synced_at'
        }
    },
    
    settings: {
        autoSync: false,
        syncInterval: 3600000,
        maxHistory: 1000,
        theme: 'light',
        language: 'id'
    },
    
    features: {
        offlineMode: true,
        barcodeScanning: true,
        priceChecker: true,
        downloadMaster: true,
        history: true,
        settings: true,
        apiInspector: true
    },
    
    storageKeys: {
        token: 'aeon_auth_token',
        user: 'aeon_user_data',
        settings: 'aeon_settings',
        theme: 'aeon_theme',
        serverIp: 'aeon_server_ip',
        recentSearches: 'aeon_recent_searches',
        debugMode: 'aeon_debug_mode'
    }
};

export default Config;