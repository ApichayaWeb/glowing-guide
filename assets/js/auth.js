/**
 * ระบบสอบย้อนกลับผักอุดร - Authentication JavaScript
 * =================================================
 */

/**
 * Enhanced Authentication API
 */
const AuthAPI = {
    
    /**
     * Login user
     */
    async login(username, password) {
        try {
            const result = await API.makeRequest('login', {
                username: Utils.sanitizeInput(username),
                password: password
            });

            if (result.success) {
                // Store user data
                Storage.set(CONFIG.STORAGE_KEYS.USER_DATA, result.user);
                Storage.set(CONFIG.STORAGE_KEYS.LAST_LOGIN, new Date().toISOString());
                
                // Set session timeout
                this.setSessionTimeout();
                
                return result.user;
            } else {
                throw new Error(result.message || 'ข้อมูลการเข้าสู่ระบบไม่ถูกต้อง');
            }
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    /**
     * Logout user
     */
    logout() {
        // Clear session timeout
        this.clearSessionTimeout();
        
        // Clear stored data
        Storage.remove(CONFIG.STORAGE_KEYS.USER_DATA);
        Storage.remove(CONFIG.STORAGE_KEYS.LAST_LOGIN);
        Storage.remove('remember_login');
        
        // Show logout message
        Utils.showSuccess('ออกจากระบบแล้ว', 'ขอบคุณที่ใช้บริการ');
        
        // Redirect to login page
        setTimeout(() => {
            window.location.href = this.getRelativePath() + 'login.html';
        }, 1500);
    },

    /**
     * Get current user
     */
    getCurrentUser() {
        return Storage.get(CONFIG.STORAGE_KEYS.USER_DATA);
    },

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        const user = this.getCurrentUser();
        const lastLogin = Storage.get(CONFIG.STORAGE_KEYS.LAST_LOGIN);
        
        if (!user || !user.username || !lastLogin) {
            return false;
        }
        
        // Check if session expired (24 hours)
        const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
        const lastLoginTime = new Date(lastLogin).getTime();
        const now = new Date().getTime();
        
        if (now - lastLoginTime > sessionTimeout) {
            this.logout();
            return false;
        }
        
        return true;
    },

    /**
     * Check if user has specific role
     */
    hasRole(role) {
        const user = this.getCurrentUser();
        return user && user.role === role;
    },

    /**
     * Check if user can access specific group
     */
    canAccessGroup(groupId) {
        const user = this.getCurrentUser();
        if (!user) return false;
        
        // Admin can access all groups
        if (user.role === 'admin') return true;
        
        // Group manager can only access their own group
        if (user.role === 'group') {
            return user.groupId === groupId;
        }
        
        // Farmers can only access their own group
        if (user.role === 'farmer') {
            return user.groupId === groupId;
        }
        
        return false;
    },

    /**
     * Change password
     */
    async changePassword(oldPassword, newPassword) {
        const user = this.getCurrentUser();
        if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้');

        if (newPassword.length < 6) {
            throw new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
        }

        const result = await API.makeRequest('changePassword', {
            username: user.username,
            oldPassword: oldPassword,
            newPassword: newPassword
        });

        if (result.success) {
            Utils.showSuccess('เปลี่ยนรหัสผ่านสำเร็จ', 'กรุณาเข้าสู่ระบบใหม่');
            setTimeout(() => {
                this.logout();
            }, 2000);
        }

        return result;
    },

    /**
     * Set session timeout
     */
    setSessionTimeout() {
        // Clear existing timeout
        this.clearSessionTimeout();
        
        // Set 30 minute warning
        this.sessionWarningTimeout = setTimeout(() => {
            this.showSessionWarning();
        }, 23.5 * 60 * 60 * 1000); // 23.5 hours
        
        // Set auto logout after 24 hours
        this.sessionTimeout = setTimeout(() => {
            this.forceLogout();
        }, 24 * 60 * 60 * 1000); // 24 hours
    },

    /**
     * Clear session timeout
     */
    clearSessionTimeout() {
        if (this.sessionTimeout) {
            clearTimeout(this.sessionTimeout);
            this.sessionTimeout = null;
        }
        if (this.sessionWarningTimeout) {
            clearTimeout(this.sessionWarningTimeout);
            this.sessionWarningTimeout = null;
        }
    },

    /**
     * Show session warning
     */
    showSessionWarning() {
        Swal.fire({
            icon: 'warning',
            title: 'เซสชันจะหมดอายุ',
            text: 'เซสชันของคุณจะหมดอายุในอีก 30 นาที กรุณาบันทึกงานของคุณ',
            confirmButtonColor: '#198754',
            confirmButtonText: 'ตกลง',
            timer: 10000,
            timerProgressBar: true
        });
    },

    /**
     * Force logout due to session expiry
     */
    forceLogout() {
        Utils.showWarning(
            'เซสชันหมดอายุ', 
            'เพื่อความปลอดภัย กรุณาเข้าสู่ระบบใหม่อีกครั้ง'
        );
        setTimeout(() => {
            this.logout();
        }, 3000);
    },

    /**
     * Get relative path based on current location
     */
    getRelativePath() {
        const path = window.location.pathname;
        if (path.includes('/admin/') || path.includes('/group/') || path.includes('/farmer/') || path.includes('/public/')) {
            return '../';
        }
        return '';
    },

    /**
     * Redirect to appropriate dashboard
     */
    redirectToDashboard(user = null) {
        if (!user) {
            user = this.getCurrentUser();
        }
        
        if (!user) {
            window.location.href = this.getRelativePath() + 'login.html';
            return;
        }

        const basePath = this.getRelativePath();
        
        switch (user.role) {
            case 'admin':
                window.location.href = basePath + 'admin/dashboard.html';
                break;
            case 'group':
                window.location.href = basePath + 'group/dashboard.html';
                break;
            case 'farmer':
                window.location.href = basePath + 'farmer/dashboard.html';
                break;
            default:
                window.location.href = basePath + 'index.html';
        }
    },

    /**
     * Require authentication
     */
    requireAuth(requiredRole = null) {
        if (!this.isLoggedIn()) {
            Utils.showWarning('กรุณาเข้าสู่ระบบ', 'คุณต้องเข้าสู่ระบบเพื่อเข้าถึงหน้านี้');
            setTimeout(() => {
                window.location.href = this.getRelativePath() + 'login.html';
            }, 2000);
            return false;
        }

        if (requiredRole && !this.hasRole(requiredRole)) {
            Utils.showError('ไม่มีสิทธิ์เข้าถึง', 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
            setTimeout(() => {
                this.redirectToDashboard();
            }, 2000);
            return false;
        }

        return true;
    },

    /**
     * Initialize authentication for page
     */
    initAuth(requiredRole = null) {
        // Set session timeout if logged in
        if (this.isLoggedIn()) {
            this.setSessionTimeout();
            
            // Update last activity
            Storage.set(CONFIG.STORAGE_KEYS.LAST_LOGIN, new Date().toISOString());
        }

        // Check authentication requirements
        return this.requireAuth(requiredRole);
    },

    /**
     * Setup page with user info
     */
    setupPage(options = {}) {
        const user = this.getCurrentUser();
        if (!user) return false;

        // Update user display elements
        const userDisplayElements = document.querySelectorAll('.user-display');
        userDisplayElements.forEach(element => {
            element.textContent = user.username;
        });

        const userRoleElements = document.querySelectorAll('.user-role');
        userRoleElements.forEach(element => {
            element.textContent = this.getRoleDisplayName(user.role);
        });

        const userNameElements = document.querySelectorAll('.user-name');
        userNameElements.forEach(element => {
            element.textContent = user.fullName || user.username;
        });

        // Setup logout buttons
        const logoutButtons = document.querySelectorAll('.logout-btn');
        logoutButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.confirmLogout();
            });
        });

        // Setup role-specific elements
        this.setupRoleSpecificElements(user.role);

        // Setup navigation
        if (options.setupNavigation !== false) {
            this.setupNavigation(user.role);
        }

        return true;
    },

    /**
     * Get role display name
     */
    getRoleDisplayName(role) {
        const roleNames = {
            'admin': 'ผู้ดูแลระบบ',
            'group': 'ผู้จัดการกลุ่ม',
            'farmer': 'เกษตรกร'
        };
        return roleNames[role] || role;
    },

    /**
     * Setup role-specific elements
     */
    setupRoleSpecificElements(role) {
        // Show/hide elements based on role
        const roleElements = document.querySelectorAll('[data-role]');
        roleElements.forEach(element => {
            const allowedRoles = element.dataset.role.split(',');
            if (allowedRoles.includes(role)) {
                element.style.display = '';
            } else {
                element.style.display = 'none';
            }
        });

        // Setup role-specific classes
        document.body.classList.add(`role-${role}`);
    },

    /**
     * Setup navigation
     */
    setupNavigation(role) {
        const nav = document.querySelector('.navbar-nav');
        if (!nav) return;

        const basePath = this.getRelativePath();
        
        // Clear existing navigation
        const authNavItems = nav.querySelectorAll('.auth-nav-item');
        authNavItems.forEach(item => item.remove());

        // Add role-specific navigation
        const navItems = this.getNavigationItems(role, basePath);
        navItems.forEach(item => {
            nav.appendChild(item);
        });
    },

    /**
     * Get navigation items for role
     */
    getNavigationItems(role, basePath) {
        const items = [];

        // Common logout item
        const logoutItem = document.createElement('li');
        logoutItem.className = 'nav-item auth-nav-item';
        logoutItem.innerHTML = `
            <a class="nav-link logout-btn" href="#" style="color: #fff;">
                <i class="fas fa-sign-out-alt me-1"></i>ออกจากระบบ
            </a>
        `;
        
        // Dashboard link
        const dashboardItem = document.createElement('li');
        dashboardItem.className = 'nav-item auth-nav-item';
        
        let dashboardUrl = '';
        let dashboardText = '';
        
        switch (role) {
            case 'admin':
                dashboardUrl = basePath + 'admin/dashboard.html';
                dashboardText = 'แผงควบคุม';
                break;
            case 'group':
                dashboardUrl = basePath + 'group/dashboard.html';
                dashboardText = 'จัดการกลุ่ม';
                break;
            case 'farmer':
                dashboardUrl = basePath + 'farmer/dashboard.html';
                dashboardText = 'ข้อมูลของฉัน';
                break;
        }
        
        if (dashboardUrl) {
            dashboardItem.innerHTML = `
                <a class="nav-link" href="${dashboardUrl}" style="color: #fff;">
                    <i class="fas fa-tachometer-alt me-1"></i>${dashboardText}
                </a>
            `;
            items.push(dashboardItem);
        }
        
        items.push(logoutItem);
        
        return items;
    },

    /**
     * Confirm logout
     */
    async confirmLogout() {
        const result = await Utils.showConfirm(
            'ออกจากระบบ',
            'คุณต้องการออกจากระบบหรือไม่?',
            'ออกจากระบบ',
            'ยกเลิก'
        );

        if (result.isConfirmed) {
            this.logout();
        }
    },

    /**
     * Activity tracker
     */
    trackActivity() {
        let activityTimer;

        const resetActivityTimer = () => {
            clearTimeout(activityTimer);
            activityTimer = setTimeout(() => {
                this.showInactivityWarning();
            }, 30 * 60 * 1000); // 30 minutes
        };

        // Track various user activities
        const activities = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        activities.forEach(activity => {
            document.addEventListener(activity, resetActivityTimer, true);
        });

        // Initial timer
        resetActivityTimer();
    },

    /**
     * Show inactivity warning
     */
    showInactivityWarning() {
        Swal.fire({
            icon: 'warning',
            title: 'ไม่มีการใช้งาน',
            text: 'คุณไม่ได้ใช้งานระบบมาระยะหนึ่งแล้ว ต้องการดำเนินการต่อหรือไม่?',
            showCancelButton: true,
            confirmButtonColor: '#198754',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'ใช้งานต่อ',
            cancelButtonText: 'ออกจากระบบ',
            timer: 60000, // 1 minute to decide
            timerProgressBar: true
        }).then((result) => {
            if (result.isConfirmed) {
                // User wants to continue, restart activity tracking
                this.trackActivity();
                Storage.set(CONFIG.STORAGE_KEYS.LAST_LOGIN, new Date().toISOString());
            } else {
                // Auto logout due to inactivity
                this.logout();
            }
        });
    }
};

/**
 * Page Protection Utilities
 */
const PageProtection = {
    
    /**
     * Protect admin pages
     */
    protectAdminPage() {
        return AuthAPI.initAuth('admin');
    },

    /**
     * Protect group pages
     */
    protectGroupPage() {
        return AuthAPI.initAuth('group');
    },

    /**
     * Protect farmer pages
     */
    protectFarmerPage() {
        return AuthAPI.initAuth('farmer');
    },

    /**
     * Protect any authenticated page
     */
    protectAuthPage() {
        return AuthAPI.initAuth();
    },

    /**
     * Redirect if already logged in (for login page)
     */
    redirectIfLoggedIn() {
        if (AuthAPI.isLoggedIn()) {
            AuthAPI.redirectToDashboard();
            return true;
        }
        return false;
    }
};

/**
 * Auto-initialize on DOM ready
 */
document.addEventListener('DOMContentLoaded', function() {
    const path = window.location.pathname;
    
    // Auto-protect pages based on path
    if (path.includes('/admin/')) {
        if (PageProtection.protectAdminPage()) {
            AuthAPI.setupPage();
        }
    } else if (path.includes('/group/')) {
        if (PageProtection.protectGroupPage()) {
            AuthAPI.setupPage();
        }
    } else if (path.includes('/farmer/')) {
        if (PageProtection.protectFarmerPage()) {
            AuthAPI.setupPage();
        }
    } else if (path.includes('login.html')) {
        PageProtection.redirectIfLoggedIn();
    } else {
        // Public pages - setup auth if logged in
        if (AuthAPI.isLoggedIn()) {
            AuthAPI.setupPage({ setupNavigation: true });
            AuthAPI.trackActivity();
        }
    }
});

// Export for global use
window.AuthAPI = AuthAPI;
window.PageProtection = PageProtection;