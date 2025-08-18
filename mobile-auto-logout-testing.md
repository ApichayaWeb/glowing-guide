# Mobile Auto Logout System - Testing Guide

## การทดสอบระบบ Auto Logout สำหรับ Mobile Device

### 📋 Overview
คู่มือการทดสอบสำหรับระบบ Mobile Auto Logout ที่ครอบคลุมทุกฟีเจอร์และสถานการณ์การใช้งาน

---

## 🎯 Testing Categories

### 1. **Device State Testing**

#### 1.1 App Switching Detection
```javascript
// Test app switching
function testAppSwitch() {
  // วิธีการทดสอบ:
  // 1. เปิดแอป Mobile Auto Logout
  // 2. กดปุ่ม Home หรือสลับไปแอปอื่น
  // 3. รอ 3 วินาที แล้วกลับมาแอป
  // 4. ตรวจสอบว่าระบบตรวจจับได้
  
  // Expected Results:
  // - Activity log แสดง "App switched to background"
  // - Activity log แสดง "App switched to foreground"
  // - Session timer ยังคงทำงาน
}
```

#### 1.2 Device Sleep/Wake Detection
```javascript
// Test device sleep
function testDeviceSleep() {
  // วิธีการทดสอบ:
  // 1. เปิดแอป Mobile Auto Logout
  // 2. กดปุ่ม Power เพื่อปิดหน้าจอ
  // 3. รอ 30 วินาที
  // 4. เปิดหน้าจอและ unlock device
  
  // Expected Results:
  // - ระบบตรวจจับ visibility change
  // - Session validation เมื่อกลับมา
  // - แสดงเวลาที่อยู่ใน background
}
```

#### 1.3 Battery Level Monitoring
```javascript
// Test battery monitoring
function testBatteryMonitoring() {
  // วิธีการทดสอบ (จำลอง):
  // 1. เปิด Developer Tools
  // 2. ไปที่ Sensors tab
  // 3. เปลี่ยน Battery level เป็น 5%
  // 4. เปลี่ยน Charging status เป็น false
  
  // Expected Results:
  // - Battery indicator เปลี่ยนเป็นสีแดง
  // - แสดง warning toast เมื่อแบตเตอรี่ต่ำ
  // - Icon แบตเตอรี่เปลี่ยนตามระดับ
}
```

#### 1.4 Network Connectivity Testing
```javascript
// Test network changes
function testNetworkChanges() {
  // วิธีการทดสอบ:
  // 1. เปิดแอป Mobile Auto Logout
  // 2. ปิด WiFi และ Mobile Data
  // 3. รอ 5 วินาที
  // 4. เปิด WiFi หรือ Mobile Data
  
  // Expected Results:
  // - Network icon เปลี่ยนเป็นสีแดงเมื่อ offline
  // - แสดง offline indicator
  // - Network icon เปลี่ยนเป็นสีเขียวเมื่อ online
  // - ซ่อน offline indicator
}
```

### 2. **Touch Activity Testing**

#### 2.1 Touch Events Detection
```javascript
// Test touch detection
function testTouchDetection() {
  // วิธีการทดสอบ:
  // 1. แตะหน้าจอในตำแหน่งต่างๆ
  // 2. ตรวจสอบ Touch counter
  // 3. ดู Activity log
  
  // Expected Results:
  // - Touch counter เพิ่มขึ้นทุกครั้งที่แตะ
  // - Activity log แสดง "Touch detected"
  // - Session timer รีเซ็ตทุกครั้งที่มี activity
}
```

#### 2.2 Gesture Recognition
```javascript
// Test swipe gestures
function testSwipeGestures() {
  // วิธีการทดสอบ:
  // 1. ทำ swipe ในทิศทางต่างๆ (ขึ้น, ลง, ซ้าย, ขว)
  // 2. ทำ pinch/zoom gesture
  // 3. ตรวจสอบ Gesture counter
  
  // Expected Results:
  // - Gesture counter เพิ่มขึ้นเมื่อตรวจจับ gesture
  // - Activity log แสดงประเภท gesture
  // - Session timer รีเซ็ต
}
```

#### 2.3 Multi-touch Detection
```javascript
// Test multi-touch
function testMultiTouch() {
  // วิธีการทดสอบ:
  // 1. ใช้สองนิ้วแตะหน้าจอพร้อมกัน
  // 2. ทำ two-finger scroll
  // 3. ทำ pinch gesture
  
  // Expected Results:
  // - ระบบตรวจจับ multi-touch
  // - Gesture counter เพิ่มขึ้น
  // - Activity log แสดง gesture type
}
```

#### 2.4 Orientation Change Detection
```javascript
// Test orientation changes
function testOrientationChange() {
  // วิธีการทดสอบ:
  // 1. หมุนอุปกรณ์จาก Portrait เป็น Landscape
  // 2. หมุนกลับเป็น Portrait
  // 3. ตรวจสอบ Orientation counter
  
  // Expected Results:
  // - Orientation counter เพิ่มขึ้น
  // - Activity log แสดง "Orientation changed"
  // - UI ปรับตัวตามการหมุน
}
```

### 3. **Session Management Testing**

#### 3.1 Session Timeout Testing
```javascript
// Test session timeout
function testSessionTimeout() {
  // วิธีการทดสอบ:
  // 1. เปิดแอป Mobile Auto Logout
  // 2. ไม่มี activity ใดๆ
  // 3. รอให้ session หมดเวลา (10 นาทีในโหมด demo)
  
  // Expected Results:
  // - แสดง warning modal เมื่อเหลือเวลา 2 นาที
  // - Countdown timer นับถอยหลัง
  // - Auto logout เมื่อเวลาหมด
}
```

#### 3.2 Idle Timeout Testing
```javascript
// Test idle timeout
function testIdleTimeout() {
  // วิธีการทดสอบ:
  // 1. เปิดแอป Mobile Auto Logout
  // 2. ไม่มี user activity เป็นเวลา 5 นาที
  // 3. ตรวจสอบ idle warning
  
  // Expected Results:
  // - แสดง idle warning modal
  // - มี vibration feedback (ถ้าสนับสนุน)
  // - Countdown 30 วินาที
  // - Auto logout ถ้าไม่มี response
}
```

#### 3.3 Session Extension Testing
```javascript
// Test session extension
function testSessionExtension() {
  // วิธีการทดสอบ:
  // 1. รอจน warning modal แสดงขึ้น
  // 2. กดปุ่ม "Continue Session"
  // 3. ตรวจสอบการขยายเวลา
  
  // Expected Results:
  // - Modal ปิด
  // - Session timer รีเซ็ต
  // - แสดง success toast
}
```

### 4. **Warning Interface Testing**

#### 4.1 Full-screen Warning Modal
```javascript
// Test warning modal
function testWarningModal() {
  // วิธีการทดสอบ:
  // 1. จำลอง idle timeout
  // 2. ตรวจสอบ modal design
  // 3. ทดสอบ responsive design
  
  // Expected Results:
  // - Modal แสดงแบบ full-screen
  // - Countdown circle animation
  // - ปุ่ม Continue/Logout ทำงานถูกต้อง
}
```

#### 4.2 Vibration Notifications
```javascript
// Test vibration
function testVibration() {
  // วิธีการทดสอบ:
  // 1. ตรวจสอบว่าอุปกรณ์สนับสนุน vibration
  // 2. จำลอง warning
  // 3. ตรวจสอบ vibration pattern
  
  // Expected Results:
  // - อุปกรณ์สั่นตาม pattern [200, 100, 200, 100, 200]
  // - Vibration ทำงานเฉพาะเมื่อ enabled
}
```

#### 4.3 Sound Alerts
```javascript
// Test sound alerts
function testSoundAlerts() {
  // วิธีการทดสอบ:
  // 1. เปิด sound alerts
  // 2. จำลอง warning
  // 3. ฟังเสียงแจ้งเตือน
  
  // Expected Results:
  // - เล่นเสียง warning tone
  // - เสียงไม่รบกวนเกินไป
  // - ทำงานเฉพาะเมื่อ enabled
}
```

### 5. **PWA Functionality Testing**

#### 5.1 Service Worker Registration
```javascript
// Test service worker
function testServiceWorker() {
  // วิธีการทดสอบ:
  // 1. เปิด Developer Tools
  // 2. ไปที่ Application > Service Workers
  // 3. ตรวจสอบ registration status
  
  // Expected Results:
  // - Service worker registered successfully
  // - Status: "Activated and running"
  // - No errors in console
}
```

#### 5.2 Offline Functionality
```javascript
// Test offline capability
function testOfflineCapability() {
  // วิธีการทดสอบ:
  // 1. Load แอป online
  // 2. ปิด network connection
  // 3. Refresh หน้าเว็บ
  // 4. ทดสอบ basic functionality
  
  // Expected Results:
  // - แอปยังใช้งานได้ offline
  // - แสดง offline indicator
  // - Session data ถูก cache
}
```

#### 5.3 Background Sync
```javascript
// Test background sync
function testBackgroundSync() {
  // วิธีการทดสอบ:
  // 1. ใช้งานแอป offline
  // 2. เชื่อมต่อ network กลับมา
  // 3. ตรวจสอบการ sync ข้อมูล
  
  // Expected Results:
  // - ข้อมูล session sync เมื่อ online
  // - Activity log sync
  // - No data loss
}
```

#### 5.4 App Installation
```javascript
// Test PWA installation
function testPWAInstallation() {
  // วิธีการทดสอบ:
  // 1. เปิดแอปใน mobile browser
  // 2. ดู install prompt
  // 3. กด "Add to Home Screen"
  // 4. เปิดแอปจาก home screen
  
  // Expected Results:
  // - แสดง install prompt
  // - Icon ปรากฏใน home screen
  // - แอปเปิดแบบ standalone
}
```

### 6. **Cross-platform Testing**

#### 6.1 iOS Safari Testing
```javascript
// iOS Safari specific tests
const iosTests = {
  // Test touch events
  touchEvents: true,
  
  // Test device orientation
  orientation: true,
  
  // Test safe area insets
  safeArea: true,
  
  // Test PWA capabilities
  pwa: 'limited', // iOS has PWA limitations
  
  // Test vibration
  vibration: false // iOS doesn't support vibration API
};
```

#### 6.2 Android Chrome Testing
```javascript
// Android Chrome specific tests
const androidTests = {
  // Test all touch events
  touchEvents: true,
  
  // Test device APIs
  batteryAPI: true,
  networkInfo: true,
  
  // Test PWA features
  pwa: 'full',
  
  // Test vibration
  vibration: true,
  
  // Test background sync
  backgroundSync: true
};
```

### 7. **Performance Testing**

#### 7.1 Memory Usage Testing
```javascript
// Test memory usage
function testMemoryUsage() {
  // วิธีการทดสอบ:
  // 1. เปิด Developer Tools
  // 2. ไปที่ Memory tab
  // 3. ใช้งานแอปเป็นเวลานาน
  // 4. ตรวจสอบ memory leaks
  
  // Expected Results:
  // - Memory usage คงที่
  // - ไม่มี memory leaks
  // - Garbage collection ทำงาน
}
```

#### 7.2 Battery Usage Testing
```javascript
// Test battery optimization
function testBatteryOptimization() {
  // วิธีการทดสอบ:
  // 1. ใช้งานแอปเป็นเวลา 1 ชั่วโมง
  // 2. ตรวจสอบ battery usage ใน settings
  // 3. เปรียบเทียบกับแอปอื่น
  
  // Expected Results:
  // - Battery usage ไม่สูงเกินไป
  // - Background activity optimized
  // - Event throttling ทำงาน
}
```

#### 7.3 Event Handling Performance
```javascript
// Test event performance
function testEventPerformance() {
  // วิธีการทดสอบ:
  // 1. ทำ rapid touch events
  // 2. ตรวจสอบ response time
  // 3. ดู throttling behavior
  
  // Expected Results:
  // - Events ถูก throttle ที่ 100ms
  // - UI ไม่ lag
  // - Smooth performance
}
```

---

## 🧪 Testing Checklist

### Pre-testing Setup
- [ ] อุปกรณ์ที่รองรับ (iOS 14+, Android 8+)
- [ ] Browser ที่รองรับ (Safari, Chrome, Edge)
- [ ] Network connection สำหรับทดสอบ
- [ ] Developer tools พร้อมใช้งาน

### Core Functionality Tests
- [ ] Touch activity detection
- [ ] Gesture recognition
- [ ] Device orientation changes
- [ ] Battery level monitoring
- [ ] Network status changes
- [ ] App switching detection
- [ ] Session timeout warnings
- [ ] Auto logout functionality
- [ ] Session extension
- [ ] Mobile UI responsiveness

### Advanced Features Tests
- [ ] PWA installation
- [ ] Service worker functionality
- [ ] Offline capabilities
- [ ] Background sync
- [ ] Push notifications (ถ้ามี)
- [ ] Vibration feedback
- [ ] Sound alerts
- [ ] Memory optimization
- [ ] Battery optimization

### Cross-platform Compatibility
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] iOS Chrome
- [ ] Android Firefox
- [ ] Edge Mobile
- [ ] Samsung Internet

### Performance Tests
- [ ] Memory usage monitoring
- [ ] Battery usage optimization
- [ ] Event handling performance
- [ ] Network usage optimization
- [ ] Cache efficiency

---

## 🐛 Common Issues & Solutions

### Issue 1: Touch Events Not Detected
**Symptoms:** Touch counter ไม่เพิ่มขึ้น
**Solution:** 
```javascript
// ตรวจสอบ event listener registration
// ตรวจสอบ throttling settings
// ทดสอบกับ passive events
```

### Issue 2: PWA Not Installing
**Symptoms:** ไม่มี install prompt
**Solution:**
```javascript
// ตรวจสอบ manifest.json
// ตรวจสอบ service worker registration
// ตรวจสอบ HTTPS requirement
```

### Issue 3: Battery API Not Working
**Symptoms:** Battery level แสดง 100% เสมอ
**Solution:**
```javascript
// Battery API ไม่รองรับใน iOS
// ใช้ fallback mechanism
// ทดสอบใน Android Chrome
```

### Issue 4: Vibration Not Working
**Symptoms:** ไม่มี vibration feedback
**Solution:**
```javascript
// iOS Safari ไม่รองรับ Vibration API
// ตรวจสอบ user gesture requirement
// ทดสอบใน Android
```

---

## 📊 Testing Results Template

### Test Report Format
```markdown
## Test Report: Mobile Auto Logout System

**Date:** [Date]
**Tester:** [Name]
**Device:** [Device Model]
**OS:** [OS Version]
**Browser:** [Browser Version]

### Test Results Summary
- **Total Tests:** X
- **Passed:** X
- **Failed:** X
- **Skipped:** X

### Failed Tests
1. **Test Name:** [Name]
   - **Issue:** [Description]
   - **Expected:** [Expected Result]
   - **Actual:** [Actual Result]
   - **Solution:** [Proposed Solution]

### Performance Metrics
- **Memory Usage:** X MB
- **Battery Impact:** Low/Medium/High
- **Load Time:** X seconds
- **Response Time:** X milliseconds

### Recommendations
- [Recommendation 1]
- [Recommendation 2]
- [Recommendation 3]
```

---

## 🚀 Automated Testing Scripts

### Basic Test Runner
```javascript
// automated-tests.js
class MobileAutoLogoutTestRunner {
  constructor() {
    this.tests = [];
    this.results = [];
  }
  
  addTest(name, testFn) {
    this.tests.push({ name, testFn });
  }
  
  async runAll() {
    for (const test of this.tests) {
      try {
        await test.testFn();
        this.results.push({ name: test.name, status: 'PASS' });
      } catch (error) {
        this.results.push({ name: test.name, status: 'FAIL', error: error.message });
      }
    }
    
    this.generateReport();
  }
  
  generateReport() {
    console.table(this.results);
  }
}

// Usage example
const testRunner = new MobileAutoLogoutTestRunner();

testRunner.addTest('Touch Detection', async () => {
  // Simulate touch event
  const event = new TouchEvent('touchstart', {
    touches: [{ clientX: 100, clientY: 100 }]
  });
  document.dispatchEvent(event);
  
  // Check if touch was detected
  const touchCount = document.getElementById('touchCount').textContent;
  if (touchCount === '0') {
    throw new Error('Touch event not detected');
  }
});

// Run tests
testRunner.runAll();
```

คู่มือการทดสอบนี้ครอบคลุมทุกแง่มุมของระบบ Mobile Auto Logout และสามารถใช้เป็นแนวทางในการทดสอบอย่างเป็นระบบ