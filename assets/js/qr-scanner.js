/**
 * ระบบสอบย้อนกลับผักอุดร - QR Code Scanner
 * ======================================
 */

/**
 * QR Scanner Class
 */
class QRScanner {
    constructor() {
        this.scanner = null;
        this.isScanning = false;
        this.videoElement = null;
        this.scannerArea = null;
        this.startButton = null;
        this.stopButton = null;
        this.demoSection = null;
        
        this.init();
    }

    /**
     * Initialize scanner
     */
    init() {
        // Get DOM elements
        this.videoElement = document.getElementById('qrVideo');
        this.scannerArea = document.getElementById('scannerArea');
        this.startButton = document.getElementById('startScanBtn');
        this.stopButton = document.getElementById('stopScanBtn');
        this.demoSection = document.getElementById('demoSection');

        // Bind event listeners
        this.bindEvents();

        // Check camera support
        this.checkCameraSupport();
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        if (this.startButton) {
            this.startButton.addEventListener('click', () => this.startScanning());
        }

        if (this.stopButton) {
            this.stopButton.addEventListener('click', () => this.stopScanning());
        }

        // Handle manual search form
        const manualSearchForm = document.getElementById('manualSearchForm');
        if (manualSearchForm) {
            manualSearchForm.addEventListener('submit', (e) => this.handleManualSearch(e));
        }
    }

    /**
     * Check camera support
     */
    checkCameraSupport() {
        if (!Utils.hasCameraSupport()) {
            if (this.startButton) {
                this.startButton.disabled = true;
                this.startButton.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i>ไม่รองรับกล้อง';
                this.startButton.title = 'เบราว์เซอร์นี้ไม่รองรับการใช้งานกล้อง';
            }
        }
    }

    /**
     * Start QR scanning
     */
    async startScanning() {
        try {
            if (this.isScanning) return;

            // Check if QrScanner is available
            if (typeof QrScanner === 'undefined') {
                throw new Error('QR Scanner library ไม่พร้อมใช้งาน');
            }

            // Hide demo section and show scanner
            if (this.demoSection) this.demoSection.style.display = 'none';
            if (this.scannerArea) this.scannerArea.style.display = 'block';

            // Initialize scanner
            this.scanner = new QrScanner(
                this.videoElement,
                result => this.onScanSuccess(result.data),
                {
                    onDecodeError: error => this.onScanError(error),
                    highlightScanRegion: true,
                    highlightCodeOutline: true,
                    preferredCamera: 'environment' // Use back camera on mobile
                }
            );

            // Start scanning
            await this.scanner.start();
            this.isScanning = true;

            // Update UI
            if (this.startButton) {
                this.startButton.style.display = 'none';
            }
            
            // Add scanning animation
            this.addScanningAnimation();

            Utils.showSuccess('เริ่มสแกน', 'กล้องพร้อมสแกน QR Code แล้ว');

        } catch (error) {
            console.error('Error starting scanner:', error);
            this.handleScannerError(error);
        }
    }

    /**
     * Stop QR scanning
     */
    stopScanning() {
        try {
            if (this.scanner && this.isScanning) {
                this.scanner.stop();
                this.scanner.destroy();
                this.scanner = null;
                this.isScanning = false;
            }

            // Update UI
            if (this.scannerArea) this.scannerArea.style.display = 'none';
            if (this.demoSection) this.demoSection.style.display = 'block';
            if (this.startButton) {
                this.startButton.style.display = 'inline-block';
            }

            // Remove scanning animation
            this.removeScanningAnimation();

        } catch (error) {
            console.error('Error stopping scanner:', error);
        }
    }

    /**
     * Handle successful QR scan
     */
    onScanSuccess(qrData) {
        try {
            console.log('QR Code detected:', qrData);
            
            // Stop scanning
            this.stopScanning();
            
            // Vibrate on mobile (if supported)
            if (navigator.vibrate) {
                navigator.vibrate(200);
            }

            // Process QR code
            this.processQRCode(qrData);

        } catch (error) {
            console.error('Error processing QR result:', error);
            Utils.showError('เกิดข้อผิดพลาด', 'ไม่สามารถประมวลผล QR Code ได้');
        }
    }

    /**
     * Handle scan error
     */
    onScanError(error) {
        // Don't show errors for normal scanning process
        if (error.name !== 'NotFoundException') {
            console.warn('QR Scan error:', error);
        }
    }

    /**
     * Handle scanner initialization error
     */
    handleScannerError(error) {
        let message = 'ไม่สามารถเปิดกล้องได้';
        
        if (error.name === 'NotAllowedError') {
            message = 'กรุณาอนุญาตให้เข้าถึงกล้อง';
        } else if (error.name === 'NotFoundError') {
            message = 'ไม่พบกล้องในอุปกรณ์นี้';
        } else if (error.name === 'NotSupportedError') {
            message = 'เบราว์เซอร์ไม่รองรับการใช้งานกล้อง';
        } else if (error.name === 'NotReadableError') {
            message = 'กล้องถูกใช้งานโดยแอพอื่น';
        }

        Utils.showError('ไม่สามารถเปิดกล้องได้', message);
        
        // Reset UI
        this.stopScanning();
    }

    /**
     * Process QR Code data
     */
    async processQRCode(qrData) {
        try {
            // Validate QR Code format
            if (!Utils.validateQRCode(qrData)) {
                Utils.showWarning(
                    'รูปแบบ QR Code ไม่ถูกต้อง', 
                    'QR Code นี้ไม่ใช่รหัสผลิตภัณฑ์ในระบบ'
                );
                return;
            }

            // Show loading
            Utils.showLoading('กำลังค้นหาข้อมูล...');

            // Search for product data
            const result = await QRAPI.searchByQRCode(qrData);

            if (result.success) {
                // Navigate to result page
                const params = new URLSearchParams({
                    code: qrData,
                    type: 'qr'
                });
                window.location.href = `public/qr-result.html?${params.toString()}`;
            } else {
                Utils.hideLoading();
                Utils.showWarning('ไม่พบข้อมูล', 'ไม่พบข้อมูลสำหรับ QR Code นี้');
            }

        } catch (error) {
            Utils.hideLoading();
            handleAPIError(error, 'ไม่สามารถค้นหาข้อมูลได้');
        }
    }

    /**
     * Handle manual search form
     */
    async handleManualSearch(event) {
        event.preventDefault();
        
        const searchCode = document.getElementById('searchCode').value.trim();
        
        if (!searchCode) {
            Utils.showWarning('กรุณาใส่รหัส', 'กรุณาใส่รหัสที่ต้องการค้นหา');
            return;
        }

        // Hide modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('manualSearchModal'));
        if (modal) modal.hide();

        // Process the code
        await this.processQRCode(searchCode);
    }

    /**
     * Add scanning animation
     */
    addScanningAnimation() {
        const scannerBox = document.querySelector('.scanner-box');
        if (scannerBox) {
            scannerBox.classList.add('scanning');
            
            // Add CSS for scanning animation if not exists
            if (!document.getElementById('scanningStyle')) {
                const style = document.createElement('style');
                style.id = 'scanningStyle';
                style.textContent = `
                    .scanner-box.scanning {
                        animation: scanningPulse 2s infinite;
                    }
                    
                    @keyframes scanningPulse {
                        0%, 100% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.05); opacity: 0.8; }
                    }
                    
                    .scanner-box.scanning::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 2px;
                        background: linear-gradient(90deg, transparent, #fff, transparent);
                        animation: scanningLine 2s infinite;
                    }
                    
                    @keyframes scanningLine {
                        0% { transform: translateY(0); }
                        100% { transform: translateY(196px); }
                    }
                `;
                document.head.appendChild(style);
            }
        }
    }

    /**
     * Remove scanning animation
     */
    removeScanningAnimation() {
        const scannerBox = document.querySelector('.scanner-box');
        if (scannerBox) {
            scannerBox.classList.remove('scanning');
        }
    }

    /**
     * Get available cameras
     */
    async getAvailableCameras() {
        try {
            if (typeof QrScanner !== 'undefined') {
                return await QrScanner.listCameras();
            }
            return [];
        } catch (error) {
            console.error('Error getting cameras:', error);
            return [];
        }
    }

    /**
     * Switch camera (front/back)
     */
    async switchCamera() {
        try {
            if (this.scanner && this.isScanning) {
                const cameras = await this.getAvailableCameras();
                if (cameras.length > 1) {
                    // Switch to next camera
                    const currentCamera = this.scanner.getCamera();
                    const currentIndex = cameras.findIndex(cam => cam.id === currentCamera?.id);
                    const nextIndex = (currentIndex + 1) % cameras.length;
                    await this.scanner.setCamera(cameras[nextIndex].id);
                }
            }
        } catch (error) {
            console.error('Error switching camera:', error);
        }
    }
}

/**
 * Global function to process QR Code (for testing)
 */
async function processQRCode(qrData) {
    if (window.qrScannerInstance) {
        await window.qrScannerInstance.processQRCode(qrData);
    } else {
        // Create temporary instance
        const tempScanner = new QRScanner();
        await tempScanner.processQRCode(qrData);
    }
}

/**
 * Initialize QR Scanner when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize on pages with QR scanner elements
    if (document.getElementById('qrVideo')) {
        window.qrScannerInstance = new QRScanner();
    }
});

// Export for global use
window.QRScanner = QRScanner;
window.processQRCode = processQRCode;