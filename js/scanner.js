/**
 * Barcode Scanner Module - Handles barcode scanning using html5-qrcode
 * @module scanner
 * Enhanced with auto-stop, better camera selection
 * NOTE: Scanner only emits events, does not call services directly
 */

import { logger } from './core/Logger.js';
import { eventBus, Events } from './core/EventBus.js';
import { settingsService } from './services/SettingsService.js';

const log = logger.child('Scanner');

class BarcodeScanner {
    constructor() {
        this.html5QrCode = null;
        this.isScanning = false;
        this.isPaused = false;
        this.currentCamera = 'environment';
        this.torchEnabled = false;
        this.scanCount = 0;
        this.successCount = 0;
        this.errorCount = 0;
        this.lastResult = null;
        this.continuousMode = false;
        this.scanTimeout = null;
        this.isContinuousPaused = false;
        this.autoStopAfterScan = false;
        this.cameras = [];
        this.currentCameraIndex = 0;
        this.config = {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            formatsToSupport: [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.CODE_93,
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.DATA_MATRIX
            ]
        };
        this.callbacks = {
            onScanSuccess: null,
            onScanError: null,
            onScanProgress: null
        };
        this.settings = {
            sound: true,
            vibration: true,
            continuousScan: false,
            autoFocus: true,
            torchDefault: false,
            autoStop: false
        };
    }

    async init(elementId = 'scanner-container') {
        try {
            if (!window.Html5Qrcode) {
                throw new Error('html5-qrcode library not loaded');
            }

            await this._loadSettings();
            this.html5QrCode = new Html5Qrcode(elementId);
            await this._enumerateCameras();
            
            log.info('Scanner initialized');
            return true;
        } catch (error) {
            log.error('Failed to initialize scanner:', error);
            throw error;
        }
    }

    async _enumerateCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.cameras = devices.filter(device => device.kind === 'videoinput');
            log.info(`Found ${this.cameras.length} cameras`);
            
            const rearIndex = this.cameras.findIndex(c => 
                c.label.toLowerCase().includes('back') || 
                c.label.toLowerCase().includes('environment') ||
                c.label.toLowerCase().includes('rear')
            );
            
            if (rearIndex !== -1) {
                this.currentCameraIndex = rearIndex;
                this.currentCamera = 'environment';
            }
        } catch (error) {
            log.warning('Could not enumerate cameras:', error);
        }
    }

    getCameras() {
        return this.cameras.map((camera, index) => ({
            id: camera.deviceId,
            label: camera.label || `Camera ${index + 1}`,
            isRear: camera.label.toLowerCase().includes('back') || 
                    camera.label.toLowerCase().includes('environment'),
            isFront: camera.label.toLowerCase().includes('front') || 
                     camera.label.toLowerCase().includes('user'),
            isCurrent: index === this.currentCameraIndex
        }));
    }

    async switchToCamera(index) {
        if (index < 0 || index >= this.cameras.length) {
            throw new Error('Invalid camera index');
        }

        const wasScanning = this.isScanning;
        if (wasScanning) {
            await this.stop();
        }

        this.currentCameraIndex = index;
        this.currentCamera = this.cameras[index].deviceId;

        if (wasScanning) {
            await this.start();
        }

        log.info(`Switched to camera ${index}`);
        return this.getCameras()[index];
    }

    async _loadSettings() {
        try {
            this.settings.sound = await settingsService.getScannerSound() !== false;
            this.settings.vibration = await settingsService.getScannerVibration() !== false;
            this.settings.continuousScan = await settingsService.getContinuousScan() === true;
            this.settings.autoFocus = await settingsService.getAutoFocus() !== false;
            this.settings.torchDefault = await settingsService.getTorchDefault() === true;
            this.settings.autoStop = await settingsService.get('auto_stop', false);
            
            if (this.settings.torchDefault) {
                this.torchEnabled = true;
            }
            
            log.debug('Scanner settings loaded:', this.settings);
        } catch (error) {
            log.warning('Error loading scanner settings, using defaults');
        }
    }

    async start(options = {}) {
        if (this.isScanning) {
            log.warning('Scanner already running');
            return;
        }

        try {
            await this._loadSettings();

            this.continuousMode = options.continuousMode !== undefined 
                ? options.continuousMode 
                : this.settings.continuousScan;
            this.autoStopAfterScan = options.autoStop !== undefined 
                ? options.autoStop 
                : this.settings.autoStop;

            const config = {
                fps: options.fps || this.config.fps,
                qrbox: options.qrbox || this.config.qrbox,
                aspectRatio: options.aspectRatio || this.config.aspectRatio,
                formatsToSupport: options.formatsToSupport || this.config.formatsToSupport,
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                }
            };

            const cameraId = options.cameraId || this.currentCamera;

            log.info('Starting scanner with camera:', cameraId);

            await this.html5QrCode.start(
                { facingMode: cameraId },
                config,
                (decodedText, decodedResult) => {
                    this._onScanSuccess(decodedText, decodedResult);
                },
                (errorMessage) => {
                    this._onScanError(errorMessage);
                }
            );

            this.isScanning = true;
            this.isPaused = false;
            this.isContinuousPaused = false;

            if (this.settings.autoFocus) {
                this._enableAutoFocus();
            }

            if (this.settings.torchDefault) {
                await this.toggleTorch();
            }

            const torchBtn = document.getElementById('scanner-torch-btn');
            if (torchBtn) {
                torchBtn.innerHTML = this.torchEnabled 
                    ? '<span class="material-icons text-sm">flashlight_on</span> Torch'
                    : '<span class="material-icons text-sm">flashlight_off</span> Torch';
            }

            eventBus.emit(Events.SCAN_START, {
                camera: cameraId,
                config: config,
                continuousMode: this.continuousMode,
                autoStop: this.autoStopAfterScan
            });

            log.info(`Scanner started successfully (continuous: ${this.continuousMode}, autoStop: ${this.autoStopAfterScan})`);

            if (this.settings.sound) {
                this._beep();
            }

        } catch (error) {
            log.error('Failed to start scanner:', error);
            throw error;
        }
    }

    _enableAutoFocus() {
        try {
            const video = document.querySelector('#scanner-view video');
            if (video && video.srcObject) {
                const track = video.srcObject.getVideoTracks()[0];
                if (track && track.getCapabilities && track.getCapabilities().focusMode) {
                    track.applyConstraints({
                        advanced: [{ focusMode: 'continuous' }]
                    }).catch(() => {});
                }
            }
        } catch (error) {
            log.debug('Auto focus not supported');
        }
    }

    async stop() {
        if (!this.isScanning) {
            log.warning('Scanner not running');
            return;
        }

        try {
            await this.html5QrCode.stop();
            this.isScanning = false;
            this.isPaused = false;
            this.isContinuousPaused = false;
            
            if (this.scanTimeout) {
                clearTimeout(this.scanTimeout);
                this.scanTimeout = null;
            }

            log.info('Scanner stopped');

            eventBus.emit(Events.SCAN_CANCEL, {
                scans: this.scanCount,
                success: this.successCount,
                errors: this.errorCount
            });

        } catch (error) {
            log.error('Failed to stop scanner:', error);
            throw error;
        }
    }

    pause() {
        if (!this.isScanning || this.isPaused) {
            return;
        }

        this.isPaused = true;
        log.info('Scanner paused');
    }

    resume() {
        if (!this.isScanning || !this.isPaused) {
            return;
        }

        this.isPaused = false;
        log.info('Scanner resumed');
    }

    async toggleTorch() {
        if (!this.isScanning) {
            log.warning('Scanner not running');
            return false;
        }

        try {
            this.torchEnabled = !this.torchEnabled;
            await this.html5QrCode.toggleTorch(this.torchEnabled);
            log.info(`Torch ${this.torchEnabled ? 'enabled' : 'disabled'}`);
            return this.torchEnabled;
        } catch (error) {
            log.error('Failed to toggle torch:', error);
            return false;
        }
    }

    async switchCamera() {
        if (!this.isScanning) {
            log.warning('Scanner not running');
            return;
        }

        try {
            await this.html5QrCode.stop();
            
            this.currentCamera = this.currentCamera === 'environment' ? 'user' : 'environment';
            
            const config = {
                fps: this.config.fps,
                qrbox: this.config.qrbox,
                aspectRatio: this.config.aspectRatio,
                formatsToSupport: this.config.formatsToSupport
            };

            await this.html5QrCode.start(
                { facingMode: this.currentCamera },
                config,
                (decodedText, decodedResult) => {
                    this._onScanSuccess(decodedText, decodedResult);
                },
                (errorMessage) => {
                    this._onScanError(errorMessage);
                }
            );

            log.info(`Switched to ${this.currentCamera} camera`);
            return this.currentCamera;

        } catch (error) {
            log.error('Failed to switch camera:', error);
            throw error;
        }
    }

    async setZoom(level) {
        try {
            const video = document.querySelector('#scanner-view video');
            if (video && video.srcObject) {
                const track = video.srcObject.getVideoTracks()[0];
                if (track && track.getCapabilities && track.getCapabilities().zoom) {
                    const capabilities = track.getCapabilities();
                    const min = capabilities.zoom.min || 1;
                    const max = capabilities.zoom.max || 4;
                    const zoomValue = min + (max - min) * (level / 100);
                    
                    await track.applyConstraints({
                        advanced: [{ zoom: zoomValue }]
                    });
                    
                    log.debug(`Zoom set to ${level}%`);
                    return true;
                }
            }
            log.debug('Zoom not supported');
            return false;
        } catch (error) {
            log.debug('Zoom not supported');
            return false;
        }
    }

    onScanSuccess(callback) {
        this.callbacks.onScanSuccess = callback;
    }

    onScanError(callback) {
        this.callbacks.onScanError = callback;
    }

    onScanProgress(callback) {
        this.callbacks.onScanProgress = callback;
    }

    getStatus() {
        return {
            isScanning: this.isScanning,
            isPaused: this.isPaused,
            currentCamera: this.currentCamera,
            torchEnabled: this.torchEnabled,
            scanCount: this.scanCount,
            successCount: this.successCount,
            errorCount: this.errorCount,
            lastResult: this.lastResult,
            continuousMode: this.continuousMode,
            autoStop: this.autoStopAfterScan,
            settings: this.settings,
            cameras: this.getCameras()
        };
    }

    async checkCameraSupport() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(device => device.kind === 'videoinput');
            return {
                supported: true,
                cameras: cameras.length,
                hasFront: cameras.some(c => c.label.toLowerCase().includes('front')),
                hasRear: cameras.some(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('environment'))
            };
        } catch (error) {
            log.error('Camera support check failed:', error);
            return {
                supported: false,
                error: error.message
            };
        }
    }

    _onScanSuccess(decodedText, decodedResult) {
        if (this.isPaused || this.isContinuousPaused) return;

        this.scanCount++;
        this.successCount++;
        this.lastResult = {
            text: decodedText,
            result: decodedResult,
            timestamp: new Date().toISOString()
        };

        log.info(`Scan successful: ${decodedText}`);

        if (this.settings.sound) {
            this._beep();
        }
        if (this.settings.vibration) {
            this._vibrate();
        }

        // Scanner only emits event - does NOT call PriceCheckerService directly
        eventBus.emit(Events.SCAN_SUCCESS, {
            barcode: decodedText,
            result: decodedResult,
            continuousMode: this.continuousMode
        });

        if (this.callbacks.onScanSuccess) {
            this.callbacks.onScanSuccess(decodedText, decodedResult);
        }

        if (this.autoStopAfterScan) {
            log.info('Auto-stopping scanner after successful scan');
            setTimeout(() => {
                this.stop();
                eventBus.emit('scan:autostopped', { barcode: decodedText });
            }, 500);
            return;
        }

        if (this.continuousMode) {
            this.isContinuousPaused = true;
            
            if (this.scanTimeout) {
                clearTimeout(this.scanTimeout);
            }
            
            this.scanTimeout = setTimeout(() => {
                this.isContinuousPaused = false;
                this.scanTimeout = null;
                log.debug('Continuous scan resumed');
                eventBus.emit('scan:continuous:resume', {});
            }, 3000);
        } else {
            this.pause();
            setTimeout(() => {
                this.resume();
            }, 1000);
        }
    }

    _onScanError(errorMessage) {
        this.errorCount++;
        log.debug(`Scan error: ${errorMessage}`);

        eventBus.emit(Events.SCAN_ERROR, {
            error: errorMessage
        });

        if (this.callbacks.onScanError) {
            this.callbacks.onScanError(errorMessage);
        }
    }

    _beep() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 880;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;
            
            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
                audioContext.close();
            }, 200);
        } catch (error) {
            log.debug('Beep not available');
        }
    }

    _vibrate() {
        try {
            if (navigator.vibrate) {
                navigator.vibrate(200);
                log.debug('Vibration triggered');
            }
        } catch (error) {
            log.debug('Vibration not available');
        }
    }

    async destroy() {
        try {
            if (this.isScanning) {
                await this.stop();
            }
            if (this.html5QrCode) {
                this.html5QrCode.clear();
                this.html5QrCode = null;
            }
            if (this.scanTimeout) {
                clearTimeout(this.scanTimeout);
                this.scanTimeout = null;
            }
            log.info('Scanner destroyed');
        } catch (error) {
            log.error('Error destroying scanner:', error);
        }
    }

    isLibraryLoaded() {
        return typeof Html5Qrcode !== 'undefined';
    }

    setContinuousMode(enabled) {
        this.continuousMode = enabled;
        log.info(`Continuous mode set to: ${enabled}`);
    }

    toggleContinuousMode() {
        this.continuousMode = !this.continuousMode;
        log.info(`Continuous mode toggled to: ${this.continuousMode}`);
        return this.continuousMode;
    }

    setAutoStop(enabled) {
        this.autoStopAfterScan = enabled;
        log.info(`Auto stop set to: ${enabled}`);
    }

    toggleAutoStop() {
        this.autoStopAfterScan = !this.autoStopAfterScan;
        log.info(`Auto stop toggled to: ${this.autoStopAfterScan}`);
        return this.autoStopAfterScan;
    }
}

export const scanner = new BarcodeScanner();

export default scanner;