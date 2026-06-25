/**
 * IndexedDB Database Helper
 * @module database/indexeddb
 */

import Config from '../js/config.js';

class Database {
    constructor() {
        this.db = null;
        this.dbName = Config.database.name;
        this.dbVersion = Config.database.version;
        this.stores = Config.database.stores;
        this.initialized = false;
    }

    /**
     * Open or create database
     */
    async open() {
        if (this.initialized && this.db) {
            return this.db;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.error('[Database] Open error:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                this.initialized = true;
                console.log('[Database] Opened successfully');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this._createStores(db);
                console.log('[Database] Upgrade complete');
            };
        });
    }

    /**
     * Create object stores
     */
    _createStores(db) {
        for (const [storeName, schema] of Object.entries(this.stores)) {
            if (!db.objectStoreNames.contains(storeName)) {
                const options = { keyPath: 'id', autoIncrement: true };
                const store = db.createObjectStore(storeName, options);
                
                // Create indexes
                const indexes = schema.split(',').map(s => s.trim());
                for (const index of indexes) {
                    if (index !== '++id' && index !== 'id') {
                        store.createIndex(index, index);
                    }
                }
                
                console.log('[Database] Created store:', storeName);
            }
        }
    }

    /**
     * Get store
     */
    _getStore(storeName, mode = 'readonly') {
        if (!this.db) {
            throw new Error('Database not open');
        }
        const transaction = this.db.transaction(storeName, mode);
        return transaction.objectStore(storeName);
    }

    /**
     * Add record
     */
    async add(storeName, data) {
        await this.open();
        return new Promise((resolve, reject) => {
            const store = this._getStore(storeName, 'readwrite');
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get record by ID
     */
    async get(storeName, id) {
        await this.open();
        return new Promise((resolve, reject) => {
            const store = this._getStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all records
     */
    async getAll(storeName) {
        await this.open();
        return new Promise((resolve, reject) => {
            const store = this._getStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get records by index
     */
    async getByIndex(storeName, indexName, value) {
        await this.open();
        return new Promise((resolve, reject) => {
            const store = this._getStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update record
     */
    async update(storeName, data) {
        await this.open();
        return new Promise((resolve, reject) => {
            const store = this._getStore(storeName, 'readwrite');
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete record
     */
    async delete(storeName, id) {
        await this.open();
        return new Promise((resolve, reject) => {
            const store = this._getStore(storeName, 'readwrite');
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear store
     */
    async clear(storeName) {
        await this.open();
        return new Promise((resolve, reject) => {
            const store = this._getStore(storeName, 'readwrite');
            const request = store.clear();
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Count records
     */
    async count(storeName) {
        await this.open();
        return new Promise((resolve, reject) => {
            const store = this._getStore(storeName);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Search records
     */
    async search(storeName, searchField, searchTerm) {
        await this.open();
        const records = await this.getAll(storeName);
        return records.filter(record => {
            const value = record[searchField];
            if (typeof value === 'string') {
                return value.toLowerCase().includes(searchTerm.toLowerCase());
            }
            return String(value).includes(searchTerm);
        });
    }

    /**
     * Close database
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.initialized = false;
            console.log('[Database] Closed');
        }
    }

    /**
     * Delete database
     */
    async deleteDatabase() {
        this.close();
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(this.dbName);
            request.onsuccess = () => {
                console.log('[Database] Deleted');
                resolve(true);
            };
            request.onerror = () => reject(request.error);
        });
    }
}

// Create singleton instance
export const db = new Database();

// Export default
export default db;