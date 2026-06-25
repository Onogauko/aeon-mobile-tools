/**
 * Performance Monitor - Tracks and optimizes application performance
 * @module core/PerformanceMonitor
 */

import { logger } from './Logger.js';
import { eventBus } from './EventBus.js';

const log = logger.child('PerformanceMonitor');

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            memory: [],
            cpu: [],
            network: [],
            render: []
        };
        this.maxMetrics = 100;
        this.isMonitoring = false;
        this.startTime = Date.now();
        this.initialized = false;
    }

    /**
     * Initialize performance monitoring
     */
    init() {
        if (this.initialized) return;

        this.isMonitoring = true;
        this._startMonitoring();
        this.initialized = true;
        log.info('PerformanceMonitor initialized');
    }

    /**
     * Start monitoring
     */
    _startMonitoring() {
        // Memory monitoring
        if (window.performance?.memory) {
            setInterval(() => {
                this._recordMemory();
            }, 30000);
        }

        // Render monitoring (requestAnimationFrame)
        let lastFrameTime = performance.now();
        let frameCount = 0;

        function monitorFrames() {
            if (!this.isMonitoring) return;
            
            frameCount++;
            const now = performance.now();
            
            if (now - lastFrameTime > 1000) {
                const fps = frameCount;
                this.metrics.render.push({
                    timestamp: new Date().toISOString(),
                    fps: fps,
                    frameTime: 1000 / fps
                });
                
                if (this.metrics.render.length > this.maxMetrics) {
                    this.metrics.render.shift();
                }
                
                frameCount = 0;
                lastFrameTime = now;
            }
            
            requestAnimationFrame(monitorFrames.bind(this));
        }

        requestAnimationFrame(monitorFrames.bind(this));

        // Network monitoring
        if ('connection' in navigator) {
            const connection = navigator.connection;
            connection.addEventListener('change', () => {
                this.metrics.network.push({
                    timestamp: new Date().toISOString(),
                    type: connection.effectiveType,
                    downlink: connection.downlink,
                    rtt: connection.rtt
                });
            });
        }
    }

    /**
     * Record memory usage
     */
    _recordMemory() {
        try {
            const memory = window.performance.memory;
            this.metrics.memory.push({
                timestamp: new Date().toISOString(),
                totalJSHeapSize: memory.totalJSHeapSize,
                usedJSHeapSize: memory.usedJSHeapSize,
                jsHeapSizeLimit: memory.jsHeapSizeLimit
            });

            if (this.metrics.memory.length > this.maxMetrics) {
                this.metrics.memory.shift();
            }
        } catch (error) {
            log.debug('Memory API not available');
        }
    }

    /**
     * Get performance stats
     */
    getStats() {
        const now = Date.now();
        const uptime = (now - this.startTime) / 1000;

        // Average FPS
        const fpsValues = this.metrics.render.map(r => r.fps);
        const avgFps = fpsValues.length > 0 
            ? fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length 
            : 0;

        // Memory usage
        const lastMemory = this.metrics.memory[this.metrics.memory.length - 1];
        const memoryUsage = lastMemory 
            ? (lastMemory.usedJSHeapSize / lastMemory.jsHeapSizeLimit) * 100 
            : 0;

        return {
            uptime: uptime,
            avgFps: Math.round(avgFps),
            memoryUsage: Math.round(memoryUsage),
            totalMetrics: {
                memory: this.metrics.memory.length,
                render: this.metrics.render.length,
                network: this.metrics.network.length
            },
            lastMemory: lastMemory,
            currentMetrics: {
                memory: memoryUsage,
                fps: avgFps
            }
        };
    }

    /**
     * Get memory usage in MB
     */
    getMemoryUsage() {
        try {
            const memory = window.performance?.memory;
            if (!memory) return null;
            
            return {
                used: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
                total: (memory.totalJSHeapSize / 1024 / 1024).toFixed(2),
                limit: (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2),
                percent: ((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(1)
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Get render performance
     */
    getRenderStats() {
        const recent = this.metrics.render.slice(-10);
        return {
            avgFps: recent.length > 0 
                ? Math.round(recent.reduce((a, b) => a + b.fps, 0) / recent.length) 
                : 0,
            minFps: recent.length > 0 
                ? Math.min(...recent.map(r => r.fps)) 
                : 0,
            maxFps: recent.length > 0 
                ? Math.max(...recent.map(r => r.fps)) 
                : 0,
            samples: recent.length
        };
    }

    /**
     * Measure function execution time
     */
    measure(fn, label = '') {
        const start = performance.now();
        const result = fn();
        const duration = performance.now() - start;
        
        log.debug(`Performance: ${label} took ${duration.toFixed(2)}ms`);
        eventBus.emit('performance:measured', { label, duration });
        
        return result;
    }

    /**
     * Measure async function execution time
     */
    async measureAsync(fn, label = '') {
        const start = performance.now();
        const result = await fn();
        const duration = performance.now() - start;
        
        log.debug(`Performance: ${label} took ${duration.toFixed(2)}ms`);
        eventBus.emit('performance:measured', { label, duration });
        
        return result;
    }

    /**
     * Check if app is performing well
     */
    isHealthy() {
        const stats = this.getStats();
        return stats.avgFps > 20 && stats.memoryUsage < 80;
    }

    /**
     * Get performance recommendations
     */
    getRecommendations() {
        const stats = this.getStats();
        const recommendations = [];

        if (stats.avgFps < 20) {
            recommendations.push('Low FPS detected. Consider reducing animations or rendering load.');
        }
        if (stats.memoryUsage > 70) {
            recommendations.push('High memory usage. Consider clearing cache or optimizing data structures.');
        }
        if (stats.uptime > 3600 && stats.memoryUsage > 50) {
            recommendations.push('App running for over 1 hour. Consider memory cleanup.');
        }

        return recommendations;
    }

    /**
     * Stop monitoring
     */
    stop() {
        this.isMonitoring = false;
        log.info('Performance monitoring stopped');
    }

    /**
     * Clear metrics
     */
    clearMetrics() {
        this.metrics = {
            memory: [],
            cpu: [],
            network: [],
            render: []
        };
        log.info('Metrics cleared');
    }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;