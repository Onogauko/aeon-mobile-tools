/**
 * Barcode Scanner Module - Handles barcode scanning using html5-qrcode
 * @module scanner
 * Enhanced with auto-stop, better camera selection
 * NOTE: Scanner only emits events, does not call services directly
 */

import { logger } from './core/Logger.js';
import { eventBus, Events } from './core/EventBus.js';
import { settingsService } from './services/SettingsService.js';

// ✅ BENAR - Hanya satu child logger, tidak ada double nesting
const log = logger.child('Scanner');

class BarcodeScanner {
    constructor() {
        // ✅ BENAR - Tidak ada this.log = log.child(...)
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

    // ... (semua method lainnya tetap sama)
}

export const scanner = new BarcodeScanner();

export default scanner;