/**
 * Self Test - Application health checks
 * @module core/SelfTest
 */

import { logger } from './Logger.js';
import { indexedDB } from '../storage.js';
import { scanner } from '../scanner.js';
import { api } from '../api.js';

const log = logger.child('SelfTest');

class SelfTest {
    constructor() {
        this.results = [];
        this.isRunning = false;
    }

    /**
     * Run all tests
     */
    async runAll() {
        if (this.isRunning) {
            return { error: 'Test already running' };
        }

        this.isRunning = true;
        this.results = [];
        log.info('Starting self-test...');

        const tests = [
            this.testIndexedDB.bind(this),
            this.testScanner.bind(this),
            this.testCamera.bind(this),
            this.testStorage.bind(this),
            this.testAPI.bind(this),
            this.testPerformance.bind(this),
            this.testNetwork.bind(this)
        ];

        for (const test of tests) {
            try {
                const result = await test();
                this.results.push(result);
            } catch (error) {
                this.results.push({
                    name: test.name || 'Unknown',
                    passed: false,
                    error: error.message
                });
            }
        }

        this.isRunning = false;
        log.info('Self-test completed');

        return {
            passed: this.results.every(r => r.passed),
            results: this.results,
            summary: {
                total: this.results.length,
                passed: this.results.filter(r => r.passed).length,
                failed: this.results.filter(r => !r.passed).length
            }
        };
    }

    /**
     * Test IndexedDB
     */
    async testIndexedDB() {
        const start = performance.now();
        try {
            const db = await indexedDB.init();
            const testStore = 'test_store';
            
            // Create test store if not exists
            if (!db.objectStoreNames.contains(testStore)) {
                // Can't create store without upgrade
                // Just test existing stores
                const stores = ['settings', 'history', 'user_dl', 'article_dl'];
                const available = stores.filter(s => db.objectStoreNames.contains(s));
                
                return {
                    name: 'IndexedDB',
                    passed: available.length > 0,
                    details: `Available stores: ${available.join(', ') || 'None'}`,
                    duration: performance.now() - start
                };
            }

            return {
                name: 'IndexedDB',
                passed: true,
                details: 'IndexedDB is working',
                duration: performance.now() - start
            };
        } catch (error) {
            return {
                name: 'IndexedDB',
                passed: false,
                error: error.message,
                duration: performance.now() - start
            };
        }
    }

    /**
     * Test Scanner
     */
    async testScanner() {
        const start = performance.now();
        try {
            const loaded = scanner.isLibraryLoaded();
            const support = await scanner.checkCameraSupport();
            
            return {
                name: 'Scanner',
                passed: loaded && support.supported,
                details: `Library loaded: ${loaded}, Cameras: ${support.cameras || 0}`,
                duration: performance.now() - start
            };
        } catch (error) {
            return {
                name: 'Scanner',
                passed: false,
                error: error.message,
                duration: performance.now() - start
            };
        }
    }

    /**
     * Test Camera
     */
    async testCamera() {
        const start = performance.now();
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(device => device.kind === 'videoinput');
            
            // Try to get camera stream
            let stream = null;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'environment' } 
                });
                stream.getTracks().forEach(track => track.stop());
            } catch (e) {
                // Try front camera
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ 
                        video: { facingMode: 'user' } 
                    });
                    stream.getTracks().forEach(track => track.stop());
                } catch (e2) {
                    // No camera
                }
            }
            
            return {
                name: 'Camera',
                passed: cameras.length > 0 || stream !== null,
                details: `Cameras found: ${cameras.length}`,
                duration: performance.now() - start
            };
        } catch (error) {
            return {
                name: 'Camera',
                passed: false,
                error: error.message,
                duration: performance.now() - start
            };
        }
    }

    /**
     * Test Storage
     */
    async testStorage() {
        const start = performance.now();
        try {
            // Test localStorage
            const testKey = '_test_';
            localStorage.setItem(testKey, 'test');
            const value = localStorage.getItem(testKey);
            localStorage.removeItem(testKey);
            
            const localStorageWorks = value === 'test';
            
            // Test sessionStorage
            const testKey2 = '_test2_';
            sessionStorage.setItem(testKey2, 'test');
            const value2 = sessionStorage.getItem(testKey2);
            sessionStorage.removeItem(testKey2);
            
            const sessionStorageWorks = value2 === 'test';
            
            return {
                name: 'Storage',
                passed: localStorageWorks && sessionStorageWorks,
                details: `localStorage: ${localStorageWorks}, sessionStorage: ${sessionStorageWorks}`,
                duration: performance.now() - start
            };
        } catch (error) {
            return {
                name: 'Storage',
                passed: false,
                error: error.message,
                duration: performance.now() - start
            };
        }
    }

    /**
     * Test API
     */
    async testAPI() {
        const start = performance.now();
        try {
            const ip = api.getServerIP();
            if (!ip) {
                return {
                    name: 'API',
                    passed: false,
                    details: 'Server IP not configured',
                    duration: performance.now() - start
                };
            }

            const result = await api.testConnection(ip);
            return {
                name: 'API',
                passed: result.success,
                details: result.success ? 'Connection successful' : result.error,
                duration: performance.now() - start
            };
        } catch (error) {
            return {
                name: 'API',
                passed: false,
                error: error.message,
                duration: performance.now() - start
            };
        }
    }

    /**
     * Test Performance
     */
    async testPerformance() {
        const start = performance.now();
        try {
            // Simple performance test
            const iterations = 1000;
            const arr = new Array(iterations);
            for (let i = 0; i < iterations; i++) {
                arr[i] = i;
            }
            const sum = arr.reduce((a, b) => a + b, 0);
            
            const elapsed = performance.now() - start;
            const opsPerMs = iterations / elapsed;
            
            return {
                name: 'Performance',
                passed: opsPerMs > 0.1, // At least 0.1 ops/ms
                details: `${iterations} operations in ${elapsed.toFixed(2)}ms (${(opsPerMs * 1000).toFixed(0)} ops/sec)`,
                duration: elapsed
            };
        } catch (error) {
            return {
                name: 'Performance',
                passed: false,
                error: error.message,
                duration: performance.now() - start
            };
        }
    }

    /**
     * Test Network
     */
    async testNetwork() {
        const start = performance.now();
        try {
            const isOnline = navigator.onLine;
            const connection = navigator.connection || {};
            
            return {
                name: 'Network',
                passed: true,
                details: `Online: ${isOnline}, Type: ${connection.effectiveType || 'unknown'}`,
                duration: performance.now() - start
            };
        } catch (error) {
            return {
                name: 'Network',
                passed: false,
                error: error.message,
                duration: performance.now() - start
            };
        }
    }

    /**
     * Get test results
     */
    getResults() {
        return this.results;
    }

    /**
     * Get test summary
     */
    getSummary() {
        const total = this.results.length;
        const passed = this.results.filter(r => r.passed).length;
        return {
            total,
            passed,
            failed: total - passed,
            passed: passed === total,
            results: this.results
        };
    }
}

// Singleton instance
export const selfTest = new SelfTest();

export default selfTest;