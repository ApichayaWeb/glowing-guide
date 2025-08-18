/**
 * Mobile Auto Logout System
 * Advanced mobile-optimized automatic logout with device state monitoring
 */

class MobileAutoLogout {
    constructor(config = {}) {
        // Configuration with mobile-specific defaults
        this.config = {
            sessionTimeout: config.sessionTimeout || 15 * 60 * 1000, // 15 minutes
            warningTime: config.warningTime || 2 * 60 * 1000, // 2 minutes warning
            idleTimeout: config.idleTimeout || 10 * 60 * 1000, // 10 minutes idle
            extendTime: config.extendTime || 5 * 60 * 1000, // 5 minutes extension
            
            // Mobile-specific settings
            batteryThreshold: config.batteryThreshold || 10, // 10% battery warning
            enableVibration: config.enableVibration !== false,
            enableSound: config.enableSound !== false,
            backgroundSyncEnabled: config.backgroundSyncEnabled !== false,
            
            // Activity thresholds
            touchSensitivity: config.touchSensitivity || 3,
            gestureMinDistance: config.gestureMinDistance || 30,
            orientationDelay: config.orientationDelay || 500,
            
            // Performance settings
            throttleInterval: config.throttleInterval || 100,
            memoryCheckInterval: config.memoryCheckInterval || 30000,
            
            ...config
        };

        // State management
        this.state = {
            isActive: true,
            sessionStartTime: Date.now(),
            lastActivityTime: Date.now(),
            currentWarningType: null,
            isBackground: false,
            deviceState: 'active',
            networkStatus: 'online',
            batteryLevel: 100,
            batteryCharging: true,
            
            // Activity counters
            touchCount: 0,
            gestureCount: 0,
            orientationCount: 0,
            
            // Performance metrics
            memoryUsage: 0,
            activeTimers: new Set(),
            eventListeners: new Map()
        };

        // Mobile-specific properties
        this.touchData = {
            startX: 0,
            startY: 0,
            startTime: 0,
            touches: []
        };

        this.deviceCapabilities = {
            hasVibration: 'vibrate' in navigator,
            hasDeviceOrientation: 'DeviceOrientationEvent' in window,
            hasDeviceMotion: 'DeviceMotionEvent' in window,
            hasBattery: 'getBattery' in navigator,
            hasServiceWorker: 'serviceWorker' in navigator,
            hasVisibilityAPI: 'visibilityState' in document,
            hasWakeLock: 'wakeLock' in navigator,
            hasNetworkInfo: 'connection' in navigator
        };

        // Initialize system
        this.init();
    }

    /**
     * Initialize the mobile auto logout system
     */
    async init() {
        try {
            // Setup device capabilities
            await this.setupDeviceMonitoring();
            
            // Setup activity detection
            this.setupActivityDetection();
            
            // Setup UI elements
            this.setupUI();
            
            // Start monitoring loops
            this.startMonitoring();
            
            // Register service worker for PWA
            if (this.deviceCapabilities.hasServiceWorker) {
                await this.registerServiceWorker();
            }
            
            this.log('Mobile Auto Logout initialized successfully');
            this.showToast('System initialized', 'success');
            
        } catch (error) {
            console.error('Failed to initialize Mobile Auto Logout:', error);
            this.showToast('Initialization failed', 'error');
        }
    }

    /**
     * Setup device state monitoring
     */
    async setupDeviceMonitoring() {
        // Battery API
        if (this.deviceCapabilities.hasBattery) {
            try {
                const battery = await navigator.getBattery();
                
                this.state.batteryLevel = Math.round(battery.level * 100);
                this.state.batteryCharging = battery.charging;
                this.updateBatteryDisplay();
                
                // Battery event listeners
                this.addEventListenerSafe(battery, 'levelchange', () => {
                    this.state.batteryLevel = Math.round(battery.level * 100);
                    this.updateBatteryDisplay();
                    this.checkBatteryWarning();
                });
                
                this.addEventListenerSafe(battery, 'chargingchange', () => {
                    this.state.batteryCharging = battery.charging;
                    this.updateBatteryDisplay();
                });
                
            } catch (error) {
                console.warn('Battery API not supported:', error);
            }
        }

        // Network Information API
        if (this.deviceCapabilities.hasNetworkInfo) {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (connection) {
                this.addEventListenerSafe(connection, 'change', () => {
                    this.handleNetworkChange();
                });
            }
        }

        // Online/Offline events
        this.addEventListenerSafe(window, 'online', () => {
            this.state.networkStatus = 'online';
            this.updateNetworkDisplay();
            this.handleNetworkReconnection();
        });

        this.addEventListenerSafe(window, 'offline', () => {
            this.state.networkStatus = 'offline';
            this.updateNetworkDisplay();
            this.handleNetworkDisconnection();
        });

        // Page Visibility API
        if (this.deviceCapabilities.hasVisibilityAPI) {
            this.addEventListenerSafe(document, 'visibilitychange', () => {
                this.handleVisibilityChange();
            });
        }

        // App lifecycle events (PWA)
        this.addEventListenerSafe(window, 'beforeunload', (e) => {
            this.handleAppClose();
        });

        this.addEventListenerSafe(window, 'pagehide', () => {
            this.handleAppBackground();
        });

        this.addEventListenerSafe(window, 'pageshow', () => {
            this.handleAppForeground();
        });
    }

    /**
     * Setup comprehensive activity detection
     */
    setupActivityDetection() {
        // Touch events with throttling
        const touchEvents = ['touchstart', 'touchmove', 'touchend'];
        touchEvents.forEach(event => {
            this.addEventListenerSafe(document, event, 
                this.throttle((e) => this.handleTouchActivity(e), this.config.throttleInterval),
                { passive: true }
            );
        });

        // Mouse events (for hybrid devices)
        const mouseEvents = ['mousedown', 'mousemove', 'mouseup', 'click'];
        mouseEvents.forEach(event => {
            this.addEventListenerSafe(document, event,
                this.throttle(() => this.handleMouseActivity(), this.config.throttleInterval),
                { passive: true }
            );
        });

        // Keyboard events
        this.addEventListenerSafe(document, 'keydown',
            this.throttle(() => this.handleKeyboardActivity(), this.config.throttleInterval),
            { passive: true }
        );

        // Scroll events
        this.addEventListenerSafe(document, 'scroll',
            this.throttle(() => this.handleScrollActivity(), this.config.throttleInterval),
            { passive: true }
        );

        // Device orientation
        if (this.deviceCapabilities.hasDeviceOrientation) {
            let orientationTimer;
            this.addEventListenerSafe(window, 'orientationchange', () => {
                clearTimeout(orientationTimer);
                orientationTimer = setTimeout(() => {
                    this.handleOrientationChange();
                }, this.config.orientationDelay);
            });
        }

        // Device motion (optional - can be battery intensive)
        if (this.deviceCapabilities.hasDeviceMotion && this.config.enableMotionDetection) {
            this.addEventListenerSafe(window, 'devicemotion',
                this.throttle((e) => this.handleDeviceMotion(e), 1000),
                { passive: true }
            );
        }

        // Focus events
        this.addEventListenerSafe(window, 'focus', () => this.handleWindowFocus());
        this.addEventListenerSafe(window, 'blur', () => this.handleWindowBlur());
    }

    /**
     * Handle touch activity with gesture detection
     */
    handleTouchActivity(event) {
        this.updateActivity('touch');
        this.state.touchCount++;
        this.updateActivityStats();

        // Gesture detection
        switch(event.type) {
            case 'touchstart':
                this.handleTouchStart(event);
                break;
            case 'touchmove':
                this.handleTouchMove(event);
                break;
            case 'touchend':
                this.handleTouchEnd(event);
                break;
        }
    }

    /**
     * Handle touch start for gesture detection
     */
    handleTouchStart(event) {
        const touch = event.touches[0];
        this.touchData.startX = touch.clientX;
        this.touchData.startY = touch.clientY;
        this.touchData.startTime = Date.now();
        this.touchData.touches = Array.from(event.touches);

        // Multi-touch detection
        if (event.touches.length > 1) {
            this.handleMultiTouch(event);
        }
    }

    /**
     * Handle touch move for swipe detection
     */
    handleTouchMove(event) {
        if (this.touchData.startTime === 0) return;

        const touch = event.touches[0];
        const deltaX = touch.clientX - this.touchData.startX;
        const deltaY = touch.clientY - this.touchData.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance > this.config.gestureMinDistance) {
            this.detectSwipeDirection(deltaX, deltaY);
        }
    }

    /**
     * Handle touch end
     */
    handleTouchEnd(event) {
        const duration = Date.now() - this.touchData.startTime;
        
        // Reset touch data
        this.touchData.startTime = 0;
    }

    /**
     * Handle multi-touch gestures
     */
    handleMultiTouch(event) {
        if (event.touches.length === 2) {
            this.log('Pinch/zoom gesture detected');
            this.state.gestureCount++;
            this.updateActivity('gesture');
        }
    }

    /**
     * Detect swipe direction
     */
    detectSwipeDirection(deltaX, deltaY) {
        const threshold = this.config.gestureMinDistance;
        
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (Math.abs(deltaX) > threshold) {
                const direction = deltaX > 0 ? 'right' : 'left';
                this.log(`Swipe ${direction} detected`);
                this.state.gestureCount++;
                this.updateActivity('swipe');
            }
        } else {
            if (Math.abs(deltaY) > threshold) {
                const direction = deltaY > 0 ? 'down' : 'up';
                this.log(`Swipe ${direction} detected`);
                this.state.gestureCount++;
                this.updateActivity('swipe');
            }
        }
    }

    /**
     * Handle mouse activity (for hybrid devices)
     */
    handleMouseActivity() {
        this.updateActivity('mouse');
    }

    /**
     * Handle keyboard activity
     */
    handleKeyboardActivity() {
        this.updateActivity('keyboard');
    }

    /**
     * Handle scroll activity
     */
    handleScrollActivity() {
        this.updateActivity('scroll');
    }

    /**
     * Handle orientation change
     */
    handleOrientationChange() {
        this.state.orientationCount++;
        this.updateActivity('orientation');
        this.updateActivityStats();
        this.log('Device orientation changed');
        
        // Adjust UI for new orientation
        setTimeout(() => this.adjustUIForOrientation(), 100);
    }

    /**
     * Handle device motion (accelerometer/gyroscope)
     */
    handleDeviceMotion(event) {
        const acceleration = event.acceleration || event.accelerationIncludingGravity;
        if (acceleration) {
            const totalAcceleration = Math.abs(acceleration.x) + Math.abs(acceleration.y) + Math.abs(acceleration.z);
            if (totalAcceleration > 10) { // Threshold for significant movement
                this.updateActivity('motion');
            }
        }
    }

    /**
     * Handle window focus
     */
    handleWindowFocus() {
        this.state.isBackground = false;
        this.updateActivity('focus');
        this.log('App gained focus');
    }

    /**
     * Handle window blur
     */
    handleWindowBlur() {
        this.state.isBackground = true;
        this.log('App lost focus');
    }

    /**
     * Handle visibility change (app switch detection)
     */
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            this.handleAppForeground();
        } else {
            this.handleAppBackground();
        }
    }

    /**
     * Handle app going to background
     */
    handleAppBackground() {
        this.state.isBackground = true;
        this.state.deviceState = 'background';
        this.log('App switched to background');
        
        // Store session state for background sync
        if (this.config.backgroundSyncEnabled) {
            this.storeSessionState();
        }
        
        // Reduce activity monitoring frequency
        this.adjustMonitoringFrequency('background');
    }

    /**
     * Handle app coming to foreground
     */
    handleAppForeground() {
        this.state.isBackground = false;
        this.state.deviceState = 'active';
        this.updateActivity('foreground');
        this.log('App switched to foreground');
        
        // Resume normal monitoring
        this.adjustMonitoringFrequency('foreground');
        
        // Check session validity
        this.validateSession();
    }

    /**
     * Handle network disconnection
     */
    handleNetworkDisconnection() {
        this.log('Network disconnected');
        this.showOfflineIndicator();
        this.storeSessionState(); // Store state for offline handling
    }

    /**
     * Handle network reconnection
     */
    handleNetworkReconnection() {
        this.log('Network reconnected');
        this.hideOfflineIndicator();
        
        // Validate session with server
        this.validateSessionWithServer();
    }

    /**
     * Handle app close
     */
    handleAppClose() {
        this.storeSessionState();
        this.cleanup();
    }

    /**
     * Update activity timestamp and reset idle timer
     */
    updateActivity(type) {
        this.state.lastActivityTime = Date.now();
        this.resetIdleTimer();
        
        // Log activity
        this.logActivity(type);
        
        // Cancel any active warnings if user is active
        if (this.state.currentWarningType) {
            this.cancelWarning();
        }
    }

    /**
     * Log activity to UI
     */
    logActivity(type) {
        const logContainer = document.getElementById('activityLog');
        if (!logContainer) return;

        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <div class="activity-icon bg-primary text-white">
                <i class="fas fa-${this.getActivityIcon(type)}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">${this.getActivityTitle(type)}</div>
                <div class="activity-time">${new Date().toLocaleTimeString('th-TH')}</div>
            </div>
        `;

        logContainer.insertBefore(activityItem, logContainer.firstChild);

        // Keep only last 10 activities
        while (logContainer.children.length > 10) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }

    /**
     * Get icon for activity type
     */
    getActivityIcon(type) {
        const icons = {
            touch: 'hand-point-up',
            gesture: 'hand-paper',
            swipe: 'arrows-alt',
            mouse: 'mouse-pointer',
            keyboard: 'keyboard',
            scroll: 'scroll',
            orientation: 'mobile-alt',
            motion: 'running',
            focus: 'eye',
            foreground: 'window-restore'
        };
        return icons[type] || 'circle';
    }

    /**
     * Get title for activity type
     */
    getActivityTitle(type) {
        const titles = {
            touch: 'Touch detected',
            gesture: 'Gesture performed',
            swipe: 'Swipe gesture',
            mouse: 'Mouse activity',
            keyboard: 'Keyboard input',
            scroll: 'Scroll activity',
            orientation: 'Orientation changed',
            motion: 'Device movement',
            focus: 'App focused',
            foreground: 'App foreground'
        };
        return titles[type] || 'Activity detected';
    }

    /**
     * Start monitoring loops
     */
    startMonitoring() {
        // Session timer
        this.startTimer('session', () => {
            this.checkSessionTimeout();
        }, 1000);

        // Idle timer
        this.resetIdleTimer();

        // UI update timer
        this.startTimer('ui', () => {
            this.updateUI();
        }, 1000);

        // Memory monitoring
        this.startTimer('memory', () => {
            this.checkMemoryUsage();
        }, this.config.memoryCheckInterval);

        // Battery monitoring
        this.startTimer('battery', () => {
            this.checkBatteryWarning();
        }, 60000); // Check every minute
    }

    /**
     * Start a named timer
     */
    startTimer(name, callback, interval) {
        this.clearTimer(name);
        const timer = setInterval(callback, interval);
        this.state.activeTimers.set(name, timer);
    }

    /**
     * Clear a named timer
     */
    clearTimer(name) {
        const timer = this.state.activeTimers.get(name);
        if (timer) {
            clearInterval(timer);
            this.state.activeTimers.delete(name);
        }
    }

    /**
     * Reset idle timer
     */
    resetIdleTimer() {
        this.clearTimer('idle');
        this.startTimer('idle', () => {
            this.handleIdleTimeout();
        }, this.config.idleTimeout);
    }

    /**
     * Check session timeout
     */
    checkSessionTimeout() {
        const elapsed = Date.now() - this.state.sessionStartTime;
        const remaining = this.config.sessionTimeout - elapsed;
        
        if (remaining <= 0) {
            this.handleSessionExpired();
        } else if (remaining <= this.config.warningTime && !this.state.currentWarningType) {
            this.showSessionWarning();
        }
    }

    /**
     * Handle idle timeout
     */
    handleIdleTimeout() {
        this.log('Idle timeout detected');
        this.showIdleWarning();
    }

    /**
     * Handle session expired
     */
    handleSessionExpired() {
        this.log('Session expired');
        this.performLogout('session_expired');
    }

    /**
     * Show session warning
     */
    showSessionWarning() {
        this.state.currentWarningType = 'session';
        this.showMobileWarning('session');
    }

    /**
     * Show idle warning
     */
    showIdleWarning() {
        this.state.currentWarningType = 'idle';
        this.showMobileWarning('idle');
    }

    /**
     * Show mobile warning modal
     */
    showMobileWarning(type) {
        const modal = document.getElementById('mobileWarningModal');
        const modalInstance = new bootstrap.Modal(modal, {
            backdrop: 'static',
            keyboard: false
        });

        // Update modal content based on type
        this.updateWarningContent(type);

        // Start countdown
        this.startWarningCountdown();

        // Show modal
        modalInstance.show();

        // Mobile-specific feedback
        this.provideMobileFeedback();
    }

    /**
     * Update warning modal content
     */
    updateWarningContent(type) {
        const title = type === 'session' ? 'Session Timeout Warning' : 'Inactivity Warning';
        const message = type === 'session' ? 
            'Your session will expire soon' : 
            'You will be logged out due to inactivity';

        document.querySelector('#mobileWarningModal h3').textContent = title;
        document.querySelector('#mobileWarningModal p.lead').textContent = message;
    }

    /**
     * Start warning countdown
     */
    startWarningCountdown(seconds = 30) {
        const countdownElement = document.getElementById('countdownText');
        const circleElement = document.getElementById('countdownCircle');
        
        let timeLeft = seconds;
        
        this.clearTimer('countdown');
        this.startTimer('countdown', () => {
            countdownElement.textContent = timeLeft;
            
            // Update circle progress
            const progress = (timeLeft / seconds) * 100;
            const circumference = 2 * Math.PI * 15.9155;
            const strokeDasharray = (progress / 100) * circumference;
            circleElement.style.strokeDasharray = `${strokeDasharray}, ${circumference}`;
            
            if (timeLeft <= 0) {
                this.clearTimer('countdown');
                this.hideWarningModal();
                this.performLogout('timeout');
                return;
            }
            
            // Visual feedback for last 10 seconds
            if (timeLeft <= 10) {
                this.provideCriticalFeedback();
            }
            
            timeLeft--;
        }, 1000);
    }

    /**
     * Provide mobile-specific feedback
     */
    provideMobileFeedback() {
        // Vibration
        if (this.deviceCapabilities.hasVibration && this.config.enableVibration) {
            navigator.vibrate([200, 100, 200, 100, 200]);
        }

        // Sound (if enabled)
        if (this.config.enableSound) {
            this.playWarningSound();
        }

        // Visual feedback
        document.body.classList.add('vibrating');
        setTimeout(() => {
            document.body.classList.remove('vibrating');
        }, 500);
    }

    /**
     * Provide critical feedback for last seconds
     */
    provideCriticalFeedback() {
        if (this.deviceCapabilities.hasVibration && this.config.enableVibration) {
            navigator.vibrate(100);
        }
    }

    /**
     * Play warning sound
     */
    playWarningSound() {
        try {
            // Create audio context for warning sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.warn('Could not play warning sound:', error);
        }
    }

    /**
     * Cancel current warning
     */
    cancelWarning() {
        this.state.currentWarningType = null;
        this.clearTimer('countdown');
        this.hideWarningModal();
    }

    /**
     * Hide warning modal
     */
    hideWarningModal() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('mobileWarningModal'));
        if (modal) {
            modal.hide();
        }
    }

    /**
     * Extend mobile session
     */
    extendMobileSession() {
        this.state.sessionStartTime = Date.now();
        this.updateActivity('extend');
        this.cancelWarning();
        this.showToast('Session extended successfully', 'success');
        this.log('Session extended by user');
    }

    /**
     * Continue session (from idle warning)
     */
    continueMobileSession() {
        this.updateActivity('continue');
        this.cancelWarning();
        this.showToast('Welcome back!', 'success');
        this.log('Session continued by user');
    }

    /**
     * Perform mobile logout
     */
    performMobileLogout(reason = 'user') {
        this.log(`Performing logout: ${reason}`);
        
        // Clear all timers
        this.clearAllTimers();
        
        // Store final session data
        this.storeSessionState();
        
        // Show loading overlay
        this.showLoadingOverlay();
        
        // Hide any open modals
        this.hideAllModals();
        
        setTimeout(() => {
            this.showLogoutSuccess();
        }, 2000);
    }

    /**
     * Show loading overlay
     */
    showLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('d-none');
        }
    }

    /**
     * Hide loading overlay
     */
    hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('d-none');
        }
    }

    /**
     * Show logout success page
     */
    showLogoutSuccess() {
        this.hideLoadingOverlay();
        
        // Hide main content
        document.body.children[0].style.display = 'none';
        
        // Show success page
        const successPage = document.getElementById('mobileLogoutSuccess');
        if (successPage) {
            successPage.classList.remove('d-none');
            this.updateLogoutSummary();
            this.startRedirectCountdown();
        }
    }

    /**
     * Update logout summary
     */
    updateLogoutSummary() {
        const duration = Date.now() - this.state.sessionStartTime;
        const minutes = Math.floor(duration / 60000);
        const totalActivities = this.state.touchCount + this.state.gestureCount + this.state.orientationCount;

        const durationElement = document.getElementById('sessionDurationMobile');
        const activitiesElement = document.getElementById('totalActivitiesMobile');

        if (durationElement) {
            durationElement.textContent = `${minutes} minutes`;
        }

        if (activitiesElement) {
            activitiesElement.textContent = `${totalActivities} actions`;
        }
    }

    /**
     * Start redirect countdown
     */
    startRedirectCountdown(seconds = 5) {
        const countElement = document.getElementById('mobileRedirectCount');
        const progressElement = document.getElementById('redirectProgress');
        
        let timeLeft = seconds;
        
        this.clearTimer('redirect');
        this.startTimer('redirect', () => {
            if (countElement) {
                countElement.textContent = timeLeft;
            }
            
            if (progressElement) {
                const progress = (timeLeft / seconds) * 100;
                progressElement.style.width = progress + '%';
            }
            
            if (timeLeft <= 0) {
                this.clearTimer('redirect');
                this.redirectToLogin();
                return;
            }
            
            timeLeft--;
        }, 1000);
    }

    /**
     * Setup UI elements
     */
    setupUI() {
        this.updateBatteryDisplay();
        this.updateNetworkDisplay();
        this.updateActivityStats();
        this.adjustUIForOrientation();
    }

    /**
     * Update UI elements
     */
    updateUI() {
        this.updateSessionDisplay();
        this.updateProgressCircle();
    }

    /**
     * Update session display
     */
    updateSessionDisplay() {
        const elapsed = Date.now() - this.state.sessionStartTime;
        const remaining = Math.max(0, this.config.sessionTimeout - elapsed);
        
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        const timeElement = document.getElementById('timeRemaining');
        if (timeElement) {
            timeElement.textContent = timeDisplay;
        }

        const statusElement = document.getElementById('sessionStatus');
        if (statusElement) {
            if (remaining < this.config.warningTime) {
                statusElement.className = 'badge bg-warning';
                statusElement.textContent = 'Warning';
            } else if (remaining < 60000) {
                statusElement.className = 'badge bg-danger';
                statusElement.textContent = 'Critical';
            } else {
                statusElement.className = 'badge bg-success';
                statusElement.textContent = 'Active';
            }
        }
    }

    /**
     * Update progress circle
     */
    updateProgressCircle() {
        const elapsed = Date.now() - this.state.sessionStartTime;
        const progress = Math.max(0, 100 - (elapsed / this.config.sessionTimeout) * 100);
        
        const circle = document.getElementById('sessionCircle');
        const percentage = document.getElementById('sessionPercentage');
        
        if (circle && percentage) {
            const circumference = 2 * Math.PI * 15.9155;
            const strokeDasharray = (progress / 100) * circumference;
            circle.style.strokeDasharray = `${strokeDasharray}, ${circumference}`;
            percentage.textContent = `${Math.round(progress)}%`;
        }
    }

    /**
     * Update battery display
     */
    updateBatteryDisplay() {
        const batteryElement = document.getElementById('batteryLevel');
        const batteryIcon = document.getElementById('batteryIndicator').querySelector('i');
        
        if (batteryElement) {
            batteryElement.textContent = `${this.state.batteryLevel}%`;
        }
        
        if (batteryIcon) {
            // Update battery icon based on level
            let iconClass = 'fas ';
            if (this.state.batteryLevel > 75) {
                iconClass += 'fa-battery-full text-success';
            } else if (this.state.batteryLevel > 50) {
                iconClass += 'fa-battery-three-quarters text-success';
            } else if (this.state.batteryLevel > 25) {
                iconClass += 'fa-battery-half text-warning';
            } else if (this.state.batteryLevel > 10) {
                iconClass += 'fa-battery-quarter text-warning';
            } else {
                iconClass += 'fa-battery-empty text-danger';
            }
            
            batteryIcon.className = iconClass;
        }
    }

    /**
     * Update network display
     */
    updateNetworkDisplay() {
        const networkIcon = document.getElementById('networkStatus');
        
        if (networkIcon) {
            if (this.state.networkStatus === 'online') {
                networkIcon.className = 'fas fa-wifi text-success';
            } else {
                networkIcon.className = 'fas fa-wifi-slash text-danger';
            }
        }
    }

    /**
     * Update activity statistics
     */
    updateActivityStats() {
        const touchElement = document.getElementById('touchCount');
        const gestureElement = document.getElementById('gestureCount');
        const orientationElement = document.getElementById('orientationCount');

        if (touchElement) touchElement.textContent = this.state.touchCount;
        if (gestureElement) gestureElement.textContent = this.state.gestureCount;
        if (orientationElement) orientationElement.textContent = this.state.orientationCount;
    }

    /**
     * Adjust UI for orientation
     */
    adjustUIForOrientation() {
        // Add orientation-specific CSS classes or adjustments
        const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
        document.body.className = document.body.className.replace(/(portrait|landscape)/g, '') + ' ' + orientation;
    }

    /**
     * Check battery warning
     */
    checkBatteryWarning() {
        if (this.state.batteryLevel <= this.config.batteryThreshold && !this.state.batteryCharging) {
            this.showToast(`Low battery: ${this.state.batteryLevel}%`, 'warning');
        }
    }

    /**
     * Check memory usage
     */
    checkMemoryUsage() {
        if ('memory' in performance) {
            const memInfo = performance.memory;
            this.state.memoryUsage = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
            
            if (this.state.memoryUsage > 0.9) {
                this.log('High memory usage detected');
                this.optimizeMemoryUsage();
            }
        }
    }

    /**
     * Optimize memory usage
     */
    optimizeMemoryUsage() {
        // Clear old activity logs
        const logContainer = document.getElementById('activityLog');
        if (logContainer && logContainer.children.length > 5) {
            while (logContainer.children.length > 5) {
                logContainer.removeChild(logContainer.lastChild);
            }
        }

        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
    }

    /**
     * Adjust monitoring frequency based on device state
     */
    adjustMonitoringFrequency(state) {
        if (state === 'background') {
            // Reduce frequency when in background
            this.clearTimer('ui');
            this.startTimer('ui', () => this.updateUI(), 5000); // Update every 5 seconds
        } else {
            // Resume normal frequency
            this.clearTimer('ui');
            this.startTimer('ui', () => this.updateUI(), 1000); // Update every second
        }
    }

    /**
     * Show offline indicator
     */
    showOfflineIndicator() {
        const indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            indicator.classList.remove('d-none');
            indicator.classList.add('show');
        }
    }

    /**
     * Hide offline indicator
     */
    hideOfflineIndicator() {
        const indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            indicator.classList.remove('show');
            setTimeout(() => {
                indicator.classList.add('d-none');
            }, 300);
        }
    }

    /**
     * Store session state for offline/background handling
     */
    storeSessionState() {
        try {
            const sessionState = {
                sessionStartTime: this.state.sessionStartTime,
                lastActivityTime: this.state.lastActivityTime,
                touchCount: this.state.touchCount,
                gestureCount: this.state.gestureCount,
                orientationCount: this.state.orientationCount,
                timestamp: Date.now()
            };
            
            localStorage.setItem('mobileAutoLogoutState', JSON.stringify(sessionState));
        } catch (error) {
            console.warn('Could not store session state:', error);
        }
    }

    /**
     * Restore session state
     */
    restoreSessionState() {
        try {
            const stored = localStorage.getItem('mobileAutoLogoutState');
            if (stored) {
                const sessionState = JSON.parse(stored);
                
                // Only restore if not too old
                if (Date.now() - sessionState.timestamp < this.config.sessionTimeout) {
                    this.state.sessionStartTime = sessionState.sessionStartTime;
                    this.state.lastActivityTime = sessionState.lastActivityTime;
                    this.state.touchCount = sessionState.touchCount || 0;
                    this.state.gestureCount = sessionState.gestureCount || 0;
                    this.state.orientationCount = sessionState.orientationCount || 0;
                }
                
                localStorage.removeItem('mobileAutoLogoutState');
            }
        } catch (error) {
            console.warn('Could not restore session state:', error);
        }
    }

    /**
     * Validate session
     */
    validateSession() {
        const elapsed = Date.now() - this.state.sessionStartTime;
        if (elapsed > this.config.sessionTimeout) {
            this.performLogout('session_expired');
        }
    }

    /**
     * Validate session with server
     */
    async validateSessionWithServer() {
        try {
            // This would typically make an API call to validate the session
            // For demo purposes, we'll just log it
            this.log('Validating session with server...');
            
            // Simulate API call
            setTimeout(() => {
                this.log('Session validation completed');
            }, 1000);
        } catch (error) {
            console.error('Session validation failed:', error);
            this.performLogout('validation_failed');
        }
    }

    /**
     * Register service worker for PWA functionality
     */
    async registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('mobile-logout-sw.js');
            this.log('Service worker registered successfully');
            
            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                this.handleServiceWorkerMessage(event.data);
            });
        } catch (error) {
            console.warn('Service worker registration failed:', error);
        }
    }

    /**
     * Handle messages from service worker
     */
    handleServiceWorkerMessage(data) {
        switch (data.type) {
            case 'LOGOUT_REQUIRED':
                this.performLogout('background_timeout');
                break;
            case 'SESSION_WARNING':
                this.showMobileWarning('session');
                break;
            default:
                this.log(`Unknown message from service worker: ${data.type}`);
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const toast = document.getElementById('mobileToast');
        const toastBody = document.getElementById('mobileToastBody');
        
        if (toastBody) {
            toastBody.textContent = message;
        }
        
        // Update toast style based on type
        const toastHeader = toast.querySelector('.toast-header');
        const icon = toastHeader.querySelector('i');
        
        // Remove existing type classes
        toast.className = 'toast mobile-toast';
        
        // Add type-specific styling
        switch (type) {
            case 'success':
                toast.classList.add('border-success');
                icon.className = 'fas fa-check-circle text-success me-2';
                break;
            case 'warning':
                toast.classList.add('border-warning');
                icon.className = 'fas fa-exclamation-triangle text-warning me-2';
                break;
            case 'error':
                toast.classList.add('border-danger');
                icon.className = 'fas fa-exclamation-circle text-danger me-2';
                break;
            default:
                icon.className = 'fas fa-info-circle text-primary me-2';
        }
        
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    }

    /**
     * Hide all modals
     */
    hideAllModals() {
        const modals = ['mobileWarningModal', 'mobileLogoutModal'];
        modals.forEach(modalId => {
            const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
            if (modal) {
                modal.hide();
            }
        });
    }

    /**
     * Clear all timers
     */
    clearAllTimers() {
        this.state.activeTimers.forEach((timer, name) => {
            clearInterval(timer);
        });
        this.state.activeTimers.clear();
    }

    /**
     * Add event listener with tracking for cleanup
     */
    addEventListenerSafe(target, event, handler, options = {}) {
        target.addEventListener(event, handler, options);
        
        // Track for cleanup
        const key = `${target.constructor.name}_${event}`;
        if (!this.state.eventListeners.has(key)) {
            this.state.eventListeners.set(key, []);
        }
        this.state.eventListeners.get(key).push({ target, event, handler, options });
    }

    /**
     * Throttle function calls
     */
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }

    /**
     * Log with timestamp
     */
    log(message) {
        console.log(`[MobileAutoLogout] ${new Date().toISOString()}: ${message}`);
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Clear all timers
        this.clearAllTimers();
        
        // Remove all event listeners
        this.state.eventListeners.forEach((listeners, key) => {
            listeners.forEach(({ target, event, handler, options }) => {
                target.removeEventListener(event, handler, options);
            });
        });
        this.state.eventListeners.clear();
        
        this.log('Mobile Auto Logout cleaned up');
    }

    /**
     * Reset mobile session
     */
    resetMobileSession() {
        this.cleanup();
        
        // Reset state
        this.state.sessionStartTime = Date.now();
        this.state.lastActivityTime = Date.now();
        this.state.touchCount = 0;
        this.state.gestureCount = 0;
        this.state.orientationCount = 0;
        this.state.currentWarningType = null;
        
        // Hide success page if shown
        const successPage = document.getElementById('mobileLogoutSuccess');
        if (successPage && !successPage.classList.contains('d-none')) {
            successPage.classList.add('d-none');
            document.body.children[0].style.display = '';
        }
        
        // Restart monitoring
        this.startMonitoring();
        this.setupActivityDetection();
        
        this.showToast('Session reset successfully', 'success');
        this.log('Mobile session reset');
    }

    /**
     * Redirect to login page
     */
    redirectToLogin() {
        window.location.href = 'login.html';
    }

    /**
     * Go to home page
     */
    goToHome() {
        window.location.href = 'index.html';
    }
}

// Global functions for HTML event handlers
let mobileAutoLogout;

function showMobileLogoutModal() {
    const modal = new bootstrap.Modal(document.getElementById('mobileLogoutModal'));
    modal.show();
}

function performMobileLogout() {
    mobileAutoLogout.performMobileLogout('user');
}

function extendMobileSession() {
    mobileAutoLogout.extendMobileSession();
}

function continueMobileSession() {
    mobileAutoLogout.continueMobileSession();
}

function resetMobileSession() {
    mobileAutoLogout.resetMobileSession();
}

function redirectToMobileLogin() {
    mobileAutoLogout.redirectToLogin();
}

function goToMobileHome() {
    mobileAutoLogout.goToHome();
}

// Simulation functions for testing
function simulateAppSwitch() {
    mobileAutoLogout.handleAppBackground();
    setTimeout(() => mobileAutoLogout.handleAppForeground(), 3000);
    mobileAutoLogout.showToast('App switch simulated', 'info');
}

function simulateDeviceSleep() {
    mobileAutoLogout.handleVisibilityChange();
    mobileAutoLogout.showToast('Device sleep simulated', 'info');
}

function simulateNetworkChange() {
    mobileAutoLogout.handleNetworkDisconnection();
    setTimeout(() => mobileAutoLogout.handleNetworkReconnection(), 2000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Configuration for mobile auto logout
        const config = {
            sessionTimeout: 10 * 60 * 1000, // 10 minutes for demo
            warningTime: 2 * 60 * 1000, // 2 minutes warning
            idleTimeout: 5 * 60 * 1000, // 5 minutes idle
            enableVibration: true,
            enableSound: true,
            backgroundSyncEnabled: true
        };
        
        mobileAutoLogout = new MobileAutoLogout(config);
        
        console.log('Mobile Auto Logout System initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize Mobile Auto Logout:', error);
    }
});

// Handle page unload
window.addEventListener('beforeunload', function() {
    if (mobileAutoLogout) {
        mobileAutoLogout.cleanup();
    }
});