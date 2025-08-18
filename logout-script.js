// JavaScript สำหรับระบบ Logout และ Auto Logout UI/UX

class LogoutManager {
    constructor() {
        this.sessionData = {
            loginTime: new Date(),
            sessionDuration: 30 * 60 * 1000, // 30 minutes
            warningTime: 5 * 60 * 1000, // 5 minutes before expiry
            idleTimeout: 15 * 60 * 1000, // 15 minutes idle timeout
            lastActivity: new Date()
        };
        
        this.timers = {
            sessionTimer: null,
            idleTimer: null,
            warningTimer: null,
            countdownTimer: null
        };
        
        this.init();
    }

    init() {
        this.updateSessionDisplay();
        this.setupActivityListeners();
        this.startSessionTimer();
        this.startIdleTimer();
        
        // Update session time display every second
        setInterval(() => this.updateSessionDisplay(), 1000);
    }

    // กำหนดการฟังเหตุการณ์การใช้งาน
    setupActivityListeners() {
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        events.forEach(event => {
            document.addEventListener(event, () => {
                this.updateLastActivity();
            }, true);
        });
    }

    // อัพเดทเวลากิจกรรมล่าสุด
    updateLastActivity() {
        this.sessionData.lastActivity = new Date();
        this.resetIdleTimer();
    }

    // แสดงข้อมูลเซสชัน
    updateSessionDisplay() {
        const now = new Date();
        const elapsed = now - this.sessionData.loginTime;
        const remaining = Math.max(0, this.sessionData.sessionDuration - elapsed);
        
        // แสดงเวลาที่เหลือ
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        const sessionTimeElement = document.getElementById('sessionTime');
        if (sessionTimeElement) {
            sessionTimeElement.textContent = timeDisplay;
            
            // เปลี่ยนสีเมื่อเหลือเวลาน้อย
            if (remaining < this.sessionData.warningTime) {
                sessionTimeElement.className = 'text-warning fw-bold';
            } else if (remaining < 60000) {
                sessionTimeElement.className = 'text-danger fw-bold';
            } else {
                sessionTimeElement.className = 'text-success fw-bold';
            }
        }

        // อัพเดท progress circle
        const progressPercentage = (remaining / this.sessionData.sessionDuration) * 100;
        this.updateCircularProgress(progressPercentage);
        
        // แสดงเวลาล็อกอิน
        const loginTimeElement = document.getElementById('loginTime');
        if (loginTimeElement) {
            loginTimeElement.textContent = this.sessionData.loginTime.toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    // อัพเดท circular progress
    updateCircularProgress(percentage) {
        const circles = document.querySelectorAll('.circular-chart .circle');
        circles.forEach(circle => {
            const circumference = 2 * Math.PI * 15.9155;
            const strokeDasharray = (percentage / 100) * circumference;
            circle.style.strokeDasharray = `${strokeDasharray}, ${circumference}`;
        });

        const percentageText = document.querySelectorAll('.circular-chart .percentage');
        percentageText.forEach(text => {
            text.textContent = `${Math.round(percentage)}%`;
        });
    }

    // เริ่มตัวจับเวลาเซสชัน
    startSessionTimer() {
        this.timers.sessionTimer = setTimeout(() => {
            this.showSessionExpiry(60); // 60 วินาทีเตือน
        }, this.sessionData.sessionDuration - this.sessionData.warningTime);
    }

    // เริ่มตัวจับเวลา idle
    startIdleTimer() {
        this.resetIdleTimer();
    }

    // รีเซ็ตตัวจับเวลา idle
    resetIdleTimer() {
        if (this.timers.idleTimer) {
            clearTimeout(this.timers.idleTimer);
        }

        this.timers.idleTimer = setTimeout(() => {
            this.showIdleWarning();
        }, this.sessionData.idleTimeout);
    }

    // แสดง modal เตือนเซสชันหมดอายุ
    showSessionExpiry(countdown = 60) {
        const modal = new bootstrap.Modal(document.getElementById('sessionExpiryModal'));
        const countdownElement = document.getElementById('expiryCountdown');
        const progressElement = document.getElementById('expiryProgress');
        
        let timeLeft = countdown;
        
        const updateCountdown = () => {
            countdownElement.textContent = timeLeft;
            const progressPercentage = (timeLeft / countdown) * 100;
            progressElement.style.width = progressPercentage + '%';
            
            if (timeLeft <= 0) {
                modal.hide();
                this.performLogout();
                return;
            }
            
            timeLeft--;
        };

        // อัพเดททันที
        updateCountdown();
        
        // อัพเดททุกวินาที
        this.timers.countdownTimer = setInterval(updateCountdown, 1000);
        
        modal.show();
        
        // ล้าง timer เมื่อปิด modal
        document.getElementById('sessionExpiryModal').addEventListener('hidden.bs.modal', () => {
            if (this.timers.countdownTimer) {
                clearInterval(this.timers.countdownTimer);
            }
        });
    }

    // แสดง modal เตือน idle
    showIdleWarning(countdown = 30) {
        const modal = new bootstrap.Modal(document.getElementById('idleWarningModal'));
        const countdownElement = document.getElementById('idleCountdown');
        const circleElement = document.getElementById('idleCircle');
        const percentageElement = document.getElementById('idlePercentage');
        
        let timeLeft = countdown;
        
        const updateCountdown = () => {
            countdownElement.textContent = timeLeft;
            const progressPercentage = (timeLeft / countdown) * 100;
            
            // อัพเดท circular progress
            const circumference = 2 * Math.PI * 15.9155;
            const strokeDasharray = (progressPercentage / 100) * circumference;
            circleElement.style.strokeDasharray = `${strokeDasharray}, ${circumference}`;
            percentageElement.textContent = `${Math.round(progressPercentage)}%`;
            
            if (timeLeft <= 0) {
                modal.hide();
                this.performLogout();
                return;
            }
            
            timeLeft--;
        };

        updateCountdown();
        this.timers.countdownTimer = setInterval(updateCountdown, 1000);
        
        modal.show();
        
        document.getElementById('idleWarningModal').addEventListener('hidden.bs.modal', () => {
            if (this.timers.countdownTimer) {
                clearInterval(this.timers.countdownTimer);
            }
        });
    }

    // ขยายเซสชัน
    extendSession() {
        // เพิ่มเวลาเซสชัน 30 นาที
        this.sessionData.sessionDuration += 30 * 60 * 1000;
        
        // ปิด modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('sessionExpiryModal'));
        if (modal) modal.hide();
        
        // แสดง toast notification
        this.showToast('sessionToast', 'เซสชันถูกขยายเวลาแล้ว 30 นาที');
        
        // เริ่มตัวจับเวลาใหม่
        this.clearTimers();
        this.startSessionTimer();
    }

    // ใช้งานต่อ (จาก idle warning)
    continueSession() {
        this.updateLastActivity();
        
        const modal = bootstrap.Modal.getInstance(document.getElementById('idleWarningModal'));
        if (modal) modal.hide();
        
        this.showToast('sessionToast', 'กลับมาใช้งานแล้ว');
    }

    // ล้าง timers ทั้งหมด
    clearTimers() {
        Object.values(this.timers).forEach(timer => {
            if (timer) clearTimeout(timer);
        });
    }

    // แสดง Toast notification
    showToast(toastId, message) {
        const toastElement = document.getElementById(toastId);
        const toastBody = toastElement.querySelector('.toast-body') || 
                         document.getElementById('sessionToastBody');
        
        if (toastBody) {
            toastBody.textContent = message;
        }
        
        const toast = new bootstrap.Toast(toastElement);
        toast.show();
    }

    // ออกจากระบบ
    performLogout() {
        // ล้าง timers ทั้งหมด
        this.clearTimers();
        
        // ปิด modals ทั้งหมด
        const modals = ['logoutModal', 'sessionExpiryModal', 'idleWarningModal'];
        modals.forEach(modalId => {
            const modalElement = document.getElementById(modalId);
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
        });
        
        // แสดงหน้า logout success
        this.showLogoutSuccessPage();
    }

    // แสดงหน้า logout success
    showLogoutSuccessPage() {
        const mainContent = document.body.children[0];
        const successPage = document.getElementById('logoutSuccessPage');
        
        // ซ่อนเนื้อหาหลัก
        Array.from(document.body.children).forEach(child => {
            if (child.id !== 'logoutSuccessPage') {
                child.style.display = 'none';
            }
        });
        
        // แสดงหน้า success
        successPage.classList.remove('d-none');
        
        // อัพเดทข้อมูลสรุป
        this.updateLogoutSummary();
        
        // เริ่ม countdown สำหรับ redirect
        this.startRedirectCountdown();
    }

    // อัพเดทข้อมูลสรุปการออกจากระบบ
    updateLogoutSummary() {
        const now = new Date();
        const duration = now - this.sessionData.loginTime;
        
        // เวลาล็อกอิน
        const loginTimeElement = document.getElementById('summaryLoginTime');
        if (loginTimeElement) {
            loginTimeElement.textContent = this.sessionData.loginTime.toLocaleTimeString('th-TH');
        }
        
        // เวลาออกจากระบบ
        const logoutTimeElement = document.getElementById('summaryLogoutTime');
        if (logoutTimeElement) {
            logoutTimeElement.textContent = now.toLocaleTimeString('th-TH');
        }
        
        // ระยะเวลาใช้งาน
        const durationElement = document.getElementById('summaryDuration');
        if (durationElement) {
            const hours = Math.floor(duration / 3600000);
            const minutes = Math.floor((duration % 3600000) / 60000);
            durationElement.textContent = `${hours} ชั่วโมง ${minutes} นาที`;
        }
    }

    // เริ่ม countdown สำหรับ redirect
    startRedirectCountdown(seconds = 5) {
        const countdownElement = document.getElementById('redirectCountdown');
        let timeLeft = seconds;
        
        const updateCountdown = () => {
            if (countdownElement) {
                countdownElement.textContent = timeLeft;
            }
            
            if (timeLeft <= 0) {
                this.redirectToLogin();
                return;
            }
            
            timeLeft--;
        };
        
        updateCountdown();
        setInterval(updateCountdown, 1000);
    }

    // Redirect ไปหน้า login
    redirectToLogin() {
        window.location.href = 'login.html';
    }

    // ไปหน้าหลัก
    goToHomepage() {
        window.location.href = 'index.html';
    }

    // รีเซ็ตเซสชัน
    resetSession() {
        this.clearTimers();
        this.sessionData.loginTime = new Date();
        this.sessionData.sessionDuration = 30 * 60 * 1000;
        this.sessionData.lastActivity = new Date();
        
        // ซ่อนหน้า success ถ้าแสดงอยู่
        const successPage = document.getElementById('logoutSuccessPage');
        if (!successPage.classList.contains('d-none')) {
            successPage.classList.add('d-none');
            Array.from(document.body.children).forEach(child => {
                if (child.id !== 'logoutSuccessPage') {
                    child.style.display = '';
                }
            });
        }
        
        // ปิด modals ทั้งหมด
        const modals = ['logoutModal', 'sessionExpiryModal', 'idleWarningModal', 'emergencyLogoutModal'];
        modals.forEach(modalId => {
            const modalElement = document.getElementById(modalId);
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
        });
        
        this.init();
        this.showToast('sessionToast', 'เซสชันถูกรีเซ็ตแล้ว');
    }
}

// Emergency Logout Handler
function showEmergencyLogout() {
    const modal = new bootstrap.Modal(document.getElementById('emergencyLogoutModal'));
    const progressElement = document.getElementById('emergencyProgress');
    
    modal.show();
    
    let progress = 0;
    const interval = setInterval(() => {
        progress += 20;
        progressElement.style.width = progress + '%';
        
        if (progress >= 100) {
            clearInterval(interval);
            setTimeout(() => {
                modal.hide();
                logoutManager.performLogout();
            }, 500);
        }
    }, 200);
}

// Global Functions for HTML onclick events
function showLogoutModal() {
    const modal = new bootstrap.Modal(document.getElementById('logoutModal'));
    modal.show();
}

function performLogout() {
    logoutManager.performLogout();
}

function extendSession() {
    logoutManager.extendSession();
}

function continueSession() {
    logoutManager.continueSession();
}

function startIdleTimer(seconds) {
    logoutManager.showIdleWarning(seconds);
}

function showSessionExpiry(seconds) {
    logoutManager.showSessionExpiry(seconds);
}

function resetSession() {
    logoutManager.resetSession();
}

function redirectToLogin() {
    logoutManager.redirectToLogin();
}

function goToHomepage() {
    logoutManager.goToHomepage();
}

// Initialize Logout Manager when DOM is loaded
let logoutManager;

document.addEventListener('DOMContentLoaded', function() {
    logoutManager = new LogoutManager();
    
    // Add loading states to buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            if (this.onclick && this.onclick.toString().includes('performLogout')) {
                this.classList.add('loading');
                setTimeout(() => {
                    this.classList.remove('loading');
                }, 2000);
            }
        });
    });
    
    // Add ripple effect to buttons
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 600ms linear;
                background-color: rgba(255, 255, 255, 0.7);
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                pointer-events: none;
            `;
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
    
    // Add CSS for ripple animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
});

// Prevent accidental page refresh/close
window.addEventListener('beforeunload', function(e) {
    const confirmationMessage = 'คุณแน่ใจว่าต้องการออกจากหน้านี้? ข้อมูลที่ยังไม่ได้บันทึกอาจสูญหาย';
    e.returnValue = confirmationMessage;
    return confirmationMessage;
});

// Handle visibility change (tab switching)
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && logoutManager) {
        logoutManager.updateLastActivity();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl+Alt+L for logout
    if (e.ctrlKey && e.altKey && e.key === 'l') {
        e.preventDefault();
        showLogoutModal();
    }
    
    // Escape to close modals
    if (e.key === 'Escape') {
        const openModals = document.querySelectorAll('.modal.show');
        openModals.forEach(modal => {
            const bsModal = bootstrap.Modal.getInstance(modal);
            if (bsModal) bsModal.hide();
        });
    }
});

// Service Worker for offline detection
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
}

// Network status monitoring
window.addEventListener('online', function() {
    logoutManager.showToast('sessionToast', 'เชื่อมต่ออินเทอร์เน็ตแล้ว');
});

window.addEventListener('offline', function() {
    logoutManager.showToast('sessionToast', 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต - ระบบจะออกจากระบบอัตโนมัติเมื่อกลับมาออนไลน์');
});