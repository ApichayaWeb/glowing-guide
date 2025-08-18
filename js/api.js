/**
 * ระบบสอบย้อนกลับผักอุดร - API Connection
 * =====================================
 */

/**
 * API Handler Class
 */
class APIHandler {
    constructor() {
        this.baseURL = CONFIG.API_BASE_URL;
        this.timeout = 30000; // 30 seconds
    }

    /**
     * Make API request to Google Apps Script
     */
    async makeRequest(endpoint, data = {}, method = 'POST') {
        try {
            const requestData = {
                action: endpoint,
                ...data,
                timestamp: new Date().toISOString()
            };

            const options = {
                method: method,
                mode: 'cors',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(requestData)
            };

            // Add timeout to the request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            options.signal = controller.signal;

            const response = await fetch(this.baseURL, options);
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }

            return result;

        } catch (error) {
            console.error('API Request Error:', error);
            
            if (error.name === 'AbortError') {
                throw new Error('การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง');
            }
            
            throw new Error(error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง');
        }
    }

    /**
     * Upload file to Google Drive
     */
    async uploadFile(file, folder = 'uploads') {
        try {
            // Convert file to base64
            const base64 = await this.fileToBase64(file);
            
            const data = {
                fileName: file.name,
                fileContent: base64,
                mimeType: file.type,
                folder: folder
            };

            return await this.makeRequest('uploadFile', data);
        } catch (error) {
            console.error('File upload error:', error);
            throw error;
        }
    }

    /**
     * Convert file to base64
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                // Remove data:image/jpeg;base64, prefix
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    }

    /**
     * Upload file to specific folder based on farmer ID and file type
     */
    async uploadFileToSpecificFolder(file, farmerID, fileType, onProgress = null) {
        try {
            // Validate file first
            this.validateFile(file, fileType);
            
            // Compress image if needed
            let processedFile = file;
            if (fileType === 'farm_photo' || fileType === 'product_photo') {
                processedFile = await this.compressImage(file);
            }
            
            // Determine folder based on file type
            const folderMapping = {
                'farm_photo': 'รูปภาพแปลงปลูก',
                'certificate': 'เอกสารการรับรอง',
                'product_photo': 'รูปภาพผลิตภัณฑ์'
            };
            
            const folderName = folderMapping[fileType];
            if (!folderName) {
                throw new Error('ประเภทไฟล์ไม่ถูกต้อง');
            }
            
            // Convert to base64
            const base64 = await this.fileToBase64(processedFile);
            
            const data = {
                fileName: processedFile.name,
                fileContent: base64,
                mimeType: processedFile.type,
                farmerID: farmerID,
                fileType: fileType,
                folderName: folderName
            };

            // Create progress handler if provided
            if (onProgress) {
                onProgress(0); // Start progress
            }

            const result = await this.makeRequest('uploadFileToFarmerFolder', data);
            
            if (onProgress) {
                onProgress(100); // Complete progress
            }
            
            return result;
        } catch (error) {
            console.error('File upload to specific folder error:', error);
            throw error;
        }
    }

    /**
     * Validate file size and type
     */
    validateFile(file, fileType) {
        // Check file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB in bytes
        if (file.size > maxSize) {
            throw new Error('ขนาดไฟล์เกิน 10MB กรุณาเลือกไฟล์ที่มีขนาดเล็กกว่า');
        }
        
        // Check file type based on fileType parameter
        const allowedTypes = {
            'farm_photo': ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
            'certificate': ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
            'product_photo': ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
        };
        
        const allowed = allowedTypes[fileType];
        if (!allowed || !allowed.includes(file.type)) {
            const typeNames = {
                'farm_photo': 'รูปภาพ (JPEG, PNG, WebP)',
                'certificate': 'เอกสาร PDF หรือรูปภาพ (PDF, JPEG, PNG)',
                'product_photo': 'รูปภาพ (JPEG, PNG, WebP)'
            };
            throw new Error(`ประเภทไฟล์ไม่ถูกต้อง กรุณาเลือก${typeNames[fileType]}`);
        }
    }

    /**
     * Compress image before upload
     */
    async compressImage(file, maxWidth = 1920, maxHeight = 1080, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // Calculate new dimensions
                let { width, height } = img;
                
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }
                
                // Set canvas size
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    // Create new File object with compressed data
                    const compressedFile = new File([blob], file.name, {
                        type: file.type,
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, file.type, quality);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }

    /**
     * Create progress indicator for file upload
     */
    createProgressIndicator(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return null;
        
        const progressDiv = document.createElement('div');
        progressDiv.className = 'upload-progress';
        progressDiv.innerHTML = `
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: 0%"></div>
            </div>
            <div class="progress-text">เตรียมอัพโหลด...</div>
        `;
        
        container.appendChild(progressDiv);
        
        return {
            update: (percent, text) => {
                const bar = progressDiv.querySelector('.progress-bar');
                const textEl = progressDiv.querySelector('.progress-text');
                if (bar) bar.style.width = percent + '%';
                if (textEl && text) textEl.textContent = text;
            },
            remove: () => {
                if (progressDiv.parentNode) {
                    progressDiv.parentNode.removeChild(progressDiv);
                }
            }
        };
    }
}

// Create global API instance
const API = new APIHandler();

/**
 * Authentication API Functions
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
        Storage.remove(CONFIG.STORAGE_KEYS.USER_DATA);
        Storage.remove(CONFIG.STORAGE_KEYS.LAST_LOGIN);
        window.location.href = 'login.html';
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
        return user && user.username;
    },

    /**
     * Change password
     */
    async changePassword(oldPassword, newPassword) {
        const user = this.getCurrentUser();
        if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้');

        return await API.makeRequest('changePassword', {
            username: user.username,
            oldPassword: oldPassword,
            newPassword: newPassword
        });
    }
};

/**
 * QR Code API Functions
 */
const QRAPI = {
    
    /**
     * Search by QR Code
     */
    async searchByQRCode(qrCode) {
        try {
            const parsedCode = Utils.parseQRCode(qrCode);
            if (!parsedCode) {
                throw new Error('รูปแบบ QR Code ไม่ถูกต้อง');
            }

            const result = await API.makeRequest('searchQRCode', {
                qrCode: qrCode,
                groupCode: parsedCode.groupCode,
                plotNumber: parsedCode.plotNumber
            });

            return result;
        } catch (error) {
            console.error('QR search error:', error);
            throw error;
        }
    },

    /**
     * Search by deep search code
     */
    async searchByDeepCode(searchCode) {
        try {
            const parsedCode = Utils.parseSearchCode(searchCode);
            if (!parsedCode) {
                throw new Error('รูปแบบรหัสค้นหาไม่ถูกต้อง');
            }

            const result = await API.makeRequest('searchDeepCode', {
                searchCode: searchCode,
                dateCode: parsedCode.dateCode,
                sequenceCode: parsedCode.sequenceCode
            });

            return result;
        } catch (error) {
            console.error('Deep search error:', error);
            throw error;
        }
    },

    /**
     * Generate QR Code for farmer
     */
    async generateQRCode(farmerData) {
        try {
            return await API.makeRequest('generateQRCode', farmerData);
        } catch (error) {
            console.error('QR generation error:', error);
            throw error;
        }
    }
};

/**
 * Admin API Functions
 */
const AdminAPI = {
    
    /**
     * Get all groups
     */
    async getAllGroups() {
        return await API.makeRequest('getAllGroups');
    },

    /**
     * Create new group
     */
    async createGroup(groupData) {
        return await API.makeRequest('createGroup', {
            groupName: Utils.sanitizeInput(groupData.groupName),
            managerName: Utils.sanitizeInput(groupData.managerName),
            managerPhone: Utils.sanitizeInput(groupData.managerPhone)
        });
    },

    /**
     * Update group
     */
    async updateGroup(groupId, groupData) {
        return await API.makeRequest('updateGroup', {
            groupId: groupId,
            ...groupData
        });
    },

    /**
     * Delete group
     */
    async deleteGroup(groupId) {
        return await API.makeRequest('deleteGroup', { groupId: groupId });
    },

    /**
     * Get system statistics
     */
    async getSystemStats() {
        return await API.makeRequest('getSystemStats');
    },

    /**
     * Generate system report
     */
    async generateSystemReport(reportType, dateFrom, dateTo) {
        return await API.makeRequest('generateSystemReport', {
            reportType: reportType,
            dateFrom: dateFrom,
            dateTo: dateTo
        });
    }
};

/**
 * Group API Functions
 */
const GroupAPI = {
    
    /**
     * Get group data
     */
    async getGroupData(groupId) {
        return await API.makeRequest('getGroupData', { groupId: groupId });
    },

    /**
     * Update group profile
     */
    async updateGroupProfile(groupData) {
        return await API.makeRequest('updateGroupProfile', groupData);
    },

    /**
     * Upload group documents
     */
    async uploadGroupDocument(file, documentType) {
        try {
            const uploadResult = await API.uploadFile(file, 'group-documents');
            
            return await API.makeRequest('saveGroupDocument', {
                groupId: groupData.groupId,
                documentType: documentType,
                fileName: file.name,
                fileUrl: uploadResult.fileUrl,
                fileId: uploadResult.fileId
            });
        } catch (error) {
            console.error('Group document upload error:', error);
            throw error;
        }
    },

    /**
     * Get all farmers in group
     */
    async getGroupFarmers(groupId) {
        return await API.makeRequest('getGroupFarmers', { groupId: groupId });
    },

    /**
     * Add new farmer to group
     */
    async addFarmer(farmerData) {
        return await API.makeRequest('addFarmer', {
            groupId: farmerData.groupId,
            fullName: Utils.sanitizeInput(farmerData.fullName),
            phone: Utils.sanitizeInput(farmerData.phone),
            idCard: Utils.sanitizeInput(farmerData.idCard),
            address: Utils.sanitizeInput(farmerData.address)
        });
    },

    /**
     * Update farmer data
     */
    async updateFarmer(farmerId, farmerData) {
        return await API.makeRequest('updateFarmer', {
            farmerId: farmerId,
            ...farmerData
        });
    },

    /**
     * Delete farmer
     */
    async deleteFarmer(farmerId) {
        return await API.makeRequest('deleteFarmer', { farmerId: farmerId });
    },

    /**
     * Get group statistics
     */
    async getGroupStats(groupId) {
        return await API.makeRequest('getGroupStats', { groupId: groupId });
    }
};

/**
 * Farmer API Functions
 */
const FarmerAPI = {
    
    /**
     * Get farmer data
     */
    async getFarmerData(farmerId) {
        return await API.makeRequest('getFarmerData', { farmerId: farmerId });
    },

    /**
     * Save farmer section data
     */
    async saveFarmerSection(farmerId, sectionNumber, sectionData) {
        return await API.makeRequest('saveFarmerSection', {
            farmerId: farmerId,
            sectionNumber: sectionNumber,
            sectionData: JSON.stringify(sectionData)
        });
    },

    /**
     * Upload farmer document
     */
    async uploadFarmerDocument(farmerId, file, documentType) {
        try {
            const uploadResult = await API.uploadFile(file, 'farmer-documents');
            
            return await API.makeRequest('saveFarmerDocument', {
                farmerId: farmerId,
                documentType: documentType,
                fileName: file.name,
                fileUrl: uploadResult.fileUrl,
                fileId: uploadResult.fileId
            });
        } catch (error) {
            console.error('Farmer document upload error:', error);
            throw error;
        }
    },

    /**
     * Get farmer's QR Code
     */
    async getFarmerQRCode(farmerId) {
        return await API.makeRequest('getFarmerQRCode', { farmerId: farmerId });
    },

    /**
     * Generate search code for farmer
     */
    async generateSearchCode(farmerId, shipDate) {
        return await API.makeRequest('generateSearchCode', {
            farmerId: farmerId,
            shipDate: shipDate
        });
    }
};

/**
 * Report API Functions
 */
const ReportAPI = {
    
    /**
     * Generate farmer report
     */
    async generateFarmerReport(farmerId) {
        return await API.makeRequest('generateFarmerReport', { farmerId: farmerId });
    },

    /**
     * Generate group report
     */
    async generateGroupReport(groupId, dateFrom, dateTo) {
        return await API.makeRequest('generateGroupReport', {
            groupId: groupId,
            dateFrom: dateFrom,
            dateTo: dateTo
        });
    },

    /**
     * Export data to Excel
     */
    async exportToExcel(reportType, filters = {}) {
        return await API.makeRequest('exportToExcel', {
            reportType: reportType,
            filters: JSON.stringify(filters)
        });
    }
};

/**
 * Error Handler for API calls
 */
function handleAPIError(error, defaultMessage = 'เกิดข้อผิดพลาด') {
    console.error('API Error:', error);
    
    let message = defaultMessage;
    
    if (error.message) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    }
    
    Utils.hideLoading();
    Utils.showError('เกิดข้อผิดพลาด', message);
}

/**
 * Global API call wrapper with loading
 */
async function apiCall(apiFunction, loadingMessage = 'กำลังโหลด...') {
    try {
        Utils.showLoading(loadingMessage);
        const result = await apiFunction();
        Utils.hideLoading();
        return result;
    } catch (error) {
        Utils.hideLoading();
        handleAPIError(error);
        throw error;
    }
}

// Export API modules
window.API = API;
window.AuthAPI = AuthAPI;
window.QRAPI = QRAPI;
window.AdminAPI = AdminAPI;
window.GroupAPI = GroupAPI;
window.FarmerAPI = FarmerAPI;
window.ReportAPI = ReportAPI;
window.handleAPIError = handleAPIError;
window.apiCall = apiCall;