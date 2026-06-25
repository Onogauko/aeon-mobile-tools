/**
 * Storage Module - Handles IndexedDB and localStorage operations
 * @module storage
 */

import Config from './config.js';

// Storage types
export const StorageType = {
    LOCAL: 'local',
    SESSION: 'session',
    INDEXEDDB: 'indexeddb'
};

// IndexedDB Helper
class IndexedDBHelper {
    constructor() {
        this.db = null;
        this.dbName = Config.database.name;
        this.dbVersion = Config.database.version;
        this.initialized = false;
    }

    /**
     * Initialize IndexedDB
     */
    async init() {
        if (this.initialized && this.db) {
            return this.db;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.error('[Storage] IndexedDB error:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                this.initialized = true;
                console.log('[Storage] IndexedDB initialized');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const stores = Config.database.stores;
                
                console.log('[Storage] Upgrading database to version', this.dbVersion);
                
                // Create object stores
                for (const [storeName, schema] of Object.entries(stores)) {
                    if (!db.objectStoreNames.contains(storeName)) {
                        const store = db.createObjectStore(storeName, { 
                            keyPath: 'id', 
                            autoIncrement: true 
                        });
                        
                        // Create indexes from schema
                        const indexes = schema.split(',').map(s => s.trim());
                        for (const index of indexes) {
                            if (index !== '++id' && index !== 'id') {
                                store.createIndex(index, index);
                            }
                        }
                        
                        console.log('[Storage] Created store:', storeName);
                    } else {
                        console.log('[Storage] Store already exists:', storeName);
                    }
                }
            };
        });
    }

    /**
     * Add data to a store
     */
    async add(storeName, data) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get data from a store
     */
    async get(storeName, id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all data from a store
     */
    async getAll(storeName, indexName = null, value = null) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            let request;
            
            if (indexName && value !== null) {
                const index = store.index(indexName);
                request = index.getAll(value);
            } else {
                request = store.getAll();
            }
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update data in a store
     */
    async update(storeName, data) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete data from a store
     */
    async delete(storeName, id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear a store
     */
    async clear(storeName) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get store count
     */
    async count(storeName) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.count();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.initialized = false;
            console.log('[Storage] Database closed');
        }
    }
}

// LocalStorage helper
class LocalStorageHelper {
    /**
     * Set item in localStorage
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('[Storage] localStorage set error:', error);
            return false;
        }
    }

    /**
     * Get item from localStorage
     */
    get(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : defaultValue;
        } catch (error) {
            console.error('[Storage] localStorage get error:', error);
            return defaultValue;
        }
    }

    /**
     * Remove item from localStorage
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('[Storage] localStorage remove error:', error);
            return false;
        }
    }

    /**
     * Clear localStorage
     */
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('[Storage] localStorage clear error:', error);
            return false;
        }
    }

    /**
     * Check if key exists
     */
    has(key) {
        return localStorage.getItem(key) !== null;
    }
}

// Create instances
export const dbHelper = new IndexedDBHelper();
export const localStore = new LocalStorageHelper();

/**
 * Initialize storage
 */
export async function initStorage() {
    try {
        // Initialize IndexedDB
        await dbHelper.init();
        console.log('[Storage] Storage system initialized');
        return true;
    } catch (error) {
        console.error('[Storage] Initialization error:', error);
        return false;
    }
}

// Export default
export default {
    dbHelper,
    localStore,
    initStorage,
    StorageType
};
