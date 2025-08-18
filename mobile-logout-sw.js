/**
 * Mobile Auto Logout Service Worker
 * Handles offline logout functionality and background session management for PWA
 */

// Service Worker version for cache management
const CACHE_VERSION = 'mobile-logout-v1.0.0';
const CACHE_NAME = `mobile-auto-logout-${CACHE_VERSION}`;

// Files to cache for offline functionality
const CACHED_FILES = [
    'mobile-auto-logout.html',
    'mobile-logout-styles.css',
    'mobile-auto-logout.js',
    'manifest.json',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Background sync tags
const SYNC_TAGS = {
    LOGOUT: 'logout-sync',
    SESSION_UPDATE: 'session-update-sync',
    ACTIVITY_LOG: 'activity-log-sync'
};

// Session management constants
const SESSION_CONFIG = {
    MAX_BACKGROUND_TIME: 10 * 60 * 1000, // 10 minutes
    WARNING_TIME: 2 * 60 * 1000, // 2 minutes
    HEARTBEAT_INTERVAL: 30 * 1000, // 30 seconds
    MAX_OFFLINE_TIME: 5 * 60 * 1000 // 5 minutes
};

// Global state
let backgroundStartTime = null;
let lastHeartbeat = Date.now();
let sessionData = null;
let offlineStartTime = null;

/**
 * Service Worker Installation
 */
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Mobile Auto Logout Service Worker');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app shell files');
                return cache.addAll(CACHED_FILES);
            })
            .then(() => {
                console.log('[SW] All files cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Failed to cache files:', error);
            })
    );
});

/**
 * Service Worker Activation
 */
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Mobile Auto Logout Service Worker');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] Service worker activated');
                return self.clients.claim();
            })
    );
    
    // Start background monitoring
    startBackgroundMonitoring();
});

/**
 * Fetch Event Handler
 */
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version or fetch from network
                return response || fetch(event.request)
                    .then((fetchResponse) => {
                        // Cache successful responses
                        if (fetchResponse.status === 200) {
                            const responseClone = fetchResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseClone);
                                });
                        }
                        return fetchResponse;
                    })
                    .catch((error) => {
                        console.log('[SW] Fetch failed, serving offline page:', error);
                        
                        // Handle offline scenarios
                        if (event.request.destination === 'document') {
                            return caches.match('mobile-auto-logout.html');
                        }
                        
                        throw error;
                    });
            })
    );
});

/**
 * Background Sync Event Handler
 */
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync triggered:', event.tag);
    
    switch (event.tag) {
        case SYNC_TAGS.LOGOUT:
            event.waitUntil(handleLogoutSync());
            break;
        case SYNC_TAGS.SESSION_UPDATE:
            event.waitUntil(handleSessionUpdateSync());
            break;
        case SYNC_TAGS.ACTIVITY_LOG:
            event.waitUntil(handleActivityLogSync());
            break;
        default:
            console.log('[SW] Unknown sync tag:', event.tag);
    }
});

/**
 * Message Handler for communication with main thread
 */
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);
    
    const { type, data } = event.data;
    
    switch (type) {
        case 'SESSION_START':
            handleSessionStart(data);
            break;
        case 'ACTIVITY_UPDATE':
            handleActivityUpdate(data);
            break;
        case 'SESSION_END':
            handleSessionEnd(data);
            break;
        case 'HEARTBEAT':
            handleHeartbeat(data);
            break;
        case 'GO_BACKGROUND':
            handleGoBackground();
            break;
        case 'GO_FOREGROUND':
            handleGoForeground();
            break;
        case 'NETWORK_STATUS':
            handleNetworkStatus(data);
            break;
        default:
            console.log('[SW] Unknown message type:', type);
    }
});

/**
 * Push Event Handler (for future push notification support)
 */
self.addEventListener('push', (event) => {
    console.log('[SW] Push event received:', event);
    
    if (event.data) {
        const data = event.data.json();
        
        if (data.type === 'logout_warning') {
            event.waitUntil(
                showLogoutWarningNotification(data)
            );
        }
    }
});

/**
 * Notification Click Handler
 */
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event);
    
    event.notification.close();
    
    if (event.action === 'extend_session') {
        event.waitUntil(
            sendMessageToClient({
                type: 'EXTEND_SESSION'
            })
        );
    } else if (event.action === 'logout_now') {
        event.waitUntil(
            sendMessageToClient({
                type: 'LOGOUT_REQUIRED',
                reason: 'notification_click'
            })
        );
    }
});

/**
 * Start background monitoring
 */
function startBackgroundMonitoring() {
    // Set up periodic check for session timeout
    setInterval(() => {
        checkSessionTimeout();
    }, SESSION_CONFIG.HEARTBEAT_INTERVAL);
    
    console.log('[SW] Background monitoring started');
}

/**
 * Handle session start
 */
function handleSessionStart(data) {
    sessionData = {
        startTime: data.startTime || Date.now(),
        maxDuration: data.maxDuration || SESSION_CONFIG.MAX_BACKGROUND_TIME,
        lastActivity: Date.now(),
        ...data
    };
    
    lastHeartbeat = Date.now();
    
    console.log('[SW] Session started:', sessionData);
    
    // Store session data for persistence
    storeSessionData();
}

/**
 * Handle activity update
 */
function handleActivityUpdate(data) {
    if (sessionData) {
        sessionData.lastActivity = Date.now();
        lastHeartbeat = Date.now();
        
        // Update activity counters if provided
        if (data.touchCount) sessionData.touchCount = data.touchCount;
        if (data.gestureCount) sessionData.gestureCount = data.gestureCount;
        if (data.orientationCount) sessionData.orientationCount = data.orientationCount;
        
        storeSessionData();
        
        console.log('[SW] Activity updated:', data);
    }
}

/**
 * Handle session end
 */
function handleSessionEnd(data) {
    console.log('[SW] Session ended:', data);
    
    // Clear session data
    sessionData = null;
    backgroundStartTime = null;
    
    // Clear stored data
    clearStoredData();
    
    // Register background sync for logout cleanup
    registerBackgroundSync(SYNC_TAGS.LOGOUT);
}

/**
 * Handle heartbeat from main thread
 */
function handleHeartbeat(data) {
    lastHeartbeat = Date.now();
    
    if (sessionData) {
        sessionData.lastActivity = data.lastActivity || Date.now();
        storeSessionData();
    }
}

/**
 * Handle app going to background
 */
function handleGoBackground() {
    backgroundStartTime = Date.now();
    
    console.log('[SW] App went to background');
    
    // Start aggressive session monitoring
    if (sessionData) {
        sessionData.backgroundStartTime = backgroundStartTime;
        storeSessionData();
    }
}

/**
 * Handle app coming to foreground
 */
function handleGoForeground() {
    console.log('[SW] App came to foreground');
    
    if (backgroundStartTime) {
        const backgroundDuration = Date.now() - backgroundStartTime;
        console.log(`[SW] App was in background for ${backgroundDuration}ms`);
        
        // Check if session should be terminated due to long background time
        if (backgroundDuration > SESSION_CONFIG.MAX_BACKGROUND_TIME) {
            sendMessageToClient({
                type: 'LOGOUT_REQUIRED',
                reason: 'background_timeout',
                backgroundDuration
            });
        } else if (backgroundDuration > SESSION_CONFIG.MAX_BACKGROUND_TIME - SESSION_CONFIG.WARNING_TIME) {
            sendMessageToClient({
                type: 'SESSION_WARNING',
                reason: 'background_warning',
                timeRemaining: SESSION_CONFIG.MAX_BACKGROUND_TIME - backgroundDuration
            });
        }
        
        backgroundStartTime = null;
        
        if (sessionData) {
            delete sessionData.backgroundStartTime;
            storeSessionData();
        }
    }
}

/**
 * Handle network status change
 */
function handleNetworkStatus(data) {
    console.log('[SW] Network status changed:', data);
    
    if (data.status === 'offline') {
        offlineStartTime = Date.now();
    } else if (data.status === 'online' && offlineStartTime) {
        const offlineDuration = Date.now() - offlineStartTime;
        
        // Check if offline duration exceeded limit
        if (offlineDuration > SESSION_CONFIG.MAX_OFFLINE_TIME) {
            sendMessageToClient({
                type: 'LOGOUT_REQUIRED',
                reason: 'offline_timeout',
                offlineDuration
            });
        }
        
        offlineStartTime = null;
        
        // Sync any pending data
        registerBackgroundSync(SYNC_TAGS.SESSION_UPDATE);
    }
}

/**
 * Check session timeout
 */
function checkSessionTimeout() {
    if (!sessionData) return;
    
    const now = Date.now();
    const sessionAge = now - sessionData.startTime;
    const timeSinceLastActivity = now - sessionData.lastActivity;
    const timeSinceHeartbeat = now - lastHeartbeat;
    
    // Check if session exceeded maximum duration
    if (sessionAge > sessionData.maxDuration) {
        console.log('[SW] Session expired due to max duration');
        sendMessageToClient({
            type: 'LOGOUT_REQUIRED',
            reason: 'session_expired',
            sessionAge
        });
        return;
    }
    
    // Check if no heartbeat received (app might be dead)
    if (timeSinceHeartbeat > SESSION_CONFIG.HEARTBEAT_INTERVAL * 3) {
        console.log('[SW] No heartbeat received, session might be dead');
        sendMessageToClient({
            type: 'LOGOUT_REQUIRED',
            reason: 'no_heartbeat',
            timeSinceHeartbeat
        });
        return;
    }
    
    // Check if in background for too long
    if (backgroundStartTime) {
        const backgroundDuration = now - backgroundStartTime;
        
        if (backgroundDuration > SESSION_CONFIG.MAX_BACKGROUND_TIME) {
            console.log('[SW] Background timeout exceeded');
            sendMessageToClient({
                type: 'LOGOUT_REQUIRED',
                reason: 'background_timeout',
                backgroundDuration
            });
            return;
        }
        
        // Send warning if approaching timeout
        const timeRemaining = SESSION_CONFIG.MAX_BACKGROUND_TIME - backgroundDuration;
        if (timeRemaining <= SESSION_CONFIG.WARNING_TIME && timeRemaining > SESSION_CONFIG.WARNING_TIME - SESSION_CONFIG.HEARTBEAT_INTERVAL) {
            sendMessageToClient({
                type: 'SESSION_WARNING',
                reason: 'background_warning',
                timeRemaining
            });
        }
    }
    
    console.log('[SW] Session check completed - all good');
}

/**
 * Handle logout sync
 */
async function handleLogoutSync() {
    console.log('[SW] Handling logout sync');
    
    try {
        // Clear all caches except essential files
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames.map(cacheName => {
                if (cacheName !== CACHE_NAME) {
                    return caches.delete(cacheName);
                }
            })
        );
        
        // Clear stored session data
        clearStoredData();
        
        // Attempt to notify server if online
        if (navigator.onLine) {
            try {
                await fetch('/api/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        reason: 'background_logout',
                        timestamp: Date.now()
                    })
                });
                
                console.log('[SW] Server logout notification sent');
            } catch (error) {
                console.warn('[SW] Failed to notify server:', error);
            }
        }
        
        console.log('[SW] Logout sync completed');
    } catch (error) {
        console.error('[SW] Logout sync failed:', error);
        throw error;
    }
}

/**
 * Handle session update sync
 */
async function handleSessionUpdateSync() {
    console.log('[SW] Handling session update sync');
    
    try {
        const storedData = await getStoredData();
        
        if (storedData && navigator.onLine) {
            // Sync session data with server
            try {
                await fetch('/api/session/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(storedData)
                });
                
                console.log('[SW] Session update sync completed');
            } catch (error) {
                console.warn('[SW] Failed to sync session data:', error);
                throw error;
            }
        }
    } catch (error) {
        console.error('[SW] Session update sync failed:', error);
        throw error;
    }
}

/**
 * Handle activity log sync
 */
async function handleActivityLogSync() {
    console.log('[SW] Handling activity log sync');
    
    try {
        const activityLog = await getActivityLog();
        
        if (activityLog && activityLog.length > 0 && navigator.onLine) {
            try {
                await fetch('/api/activity/log', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        activities: activityLog,
                        timestamp: Date.now()
                    })
                });
                
                // Clear synced activity log
                await clearActivityLog();
                
                console.log('[SW] Activity log sync completed');
            } catch (error) {
                console.warn('[SW] Failed to sync activity log:', error);
                throw error;
            }
        }
    } catch (error) {
        console.error('[SW] Activity log sync failed:', error);
        throw error;
    }
}

/**
 * Show logout warning notification
 */
async function showLogoutWarningNotification(data) {
    const notificationOptions = {
        title: 'Session Timeout Warning',
        body: data.message || 'Your session will expire soon due to inactivity.',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: 'logout-warning',
        requireInteraction: true,
        actions: [
            {
                action: 'extend_session',
                title: 'Extend Session',
                icon: '/icon-extend.png'
            },
            {
                action: 'logout_now',
                title: 'Logout Now',
                icon: '/icon-logout.png'
            }
        ],
        data: {
            type: 'logout_warning',
            timestamp: Date.now()
        }
    };
    
    try {
        await self.registration.showNotification(
            notificationOptions.title,
            notificationOptions
        );
        
        console.log('[SW] Logout warning notification shown');
    } catch (error) {
        console.error('[SW] Failed to show notification:', error);
    }
}

/**
 * Send message to client
 */
async function sendMessageToClient(message) {
    const clients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: 'window'
    });
    
    if (clients.length > 0) {
        clients.forEach(client => {
            client.postMessage(message);
        });
        console.log(`[SW] Message sent to ${clients.length} client(s):`, message);
    } else {
        console.log('[SW] No clients found to send message to');
        
        // If no clients, try to open the app
        if (message.type === 'LOGOUT_REQUIRED' || message.type === 'SESSION_WARNING') {
            try {
                await self.clients.openWindow('mobile-auto-logout.html');
                console.log('[SW] App window opened');
            } catch (error) {
                console.warn('[SW] Failed to open app window:', error);
            }
        }
    }
}

/**
 * Register background sync
 */
function registerBackgroundSync(tag) {
    if ('sync' in self.registration) {
        self.registration.sync.register(tag)
            .then(() => {
                console.log(`[SW] Background sync registered: ${tag}`);
            })
            .catch((error) => {
                console.error(`[SW] Failed to register background sync: ${tag}`, error);
            });
    }
}

/**
 * Store session data
 */
async function storeSessionData() {
    if (sessionData) {
        try {
            const cache = await caches.open('session-data');
            const response = new Response(JSON.stringify(sessionData));
            await cache.put('session', response);
        } catch (error) {
            console.warn('[SW] Failed to store session data:', error);
        }
    }
}

/**
 * Get stored session data
 */
async function getStoredData() {
    try {
        const cache = await caches.open('session-data');
        const response = await cache.match('session');
        if (response) {
            return await response.json();
        }
    } catch (error) {
        console.warn('[SW] Failed to get stored data:', error);
    }
    return null;
}

/**
 * Clear stored session data
 */
async function clearStoredData() {
    try {
        const cache = await caches.open('session-data');
        await cache.delete('session');
        await cache.delete('activity-log');
    } catch (error) {
        console.warn('[SW] Failed to clear stored data:', error);
    }
}

/**
 * Store activity log entry
 */
async function storeActivityLog(activity) {
    try {
        const cache = await caches.open('session-data');
        const existingResponse = await cache.match('activity-log');
        let activityLog = [];
        
        if (existingResponse) {
            activityLog = await existingResponse.json();
        }
        
        activityLog.push({
            ...activity,
            timestamp: Date.now()
        });
        
        // Keep only last 100 activities
        if (activityLog.length > 100) {
            activityLog = activityLog.slice(-100);
        }
        
        const response = new Response(JSON.stringify(activityLog));
        await cache.put('activity-log', response);
    } catch (error) {
        console.warn('[SW] Failed to store activity log:', error);
    }
}

/**
 * Get activity log
 */
async function getActivityLog() {
    try {
        const cache = await caches.open('session-data');
        const response = await cache.match('activity-log');
        if (response) {
            return await response.json();
        }
    } catch (error) {
        console.warn('[SW] Failed to get activity log:', error);
    }
    return [];
}

/**
 * Clear activity log
 */
async function clearActivityLog() {
    try {
        const cache = await caches.open('session-data');
        await cache.delete('activity-log');
    } catch (error) {
        console.warn('[SW] Failed to clear activity log:', error);
    }
}

console.log('[SW] Mobile Auto Logout Service Worker loaded');