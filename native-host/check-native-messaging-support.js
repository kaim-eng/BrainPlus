/**
 * Check if native messaging is supported in this Chrome instance
 * 
 * Run this in the service worker console:
 * chrome://extensions → BrainPlus → Inspect views: service worker
 */

console.log('=== Native Messaging Support Check ===');
console.log('');

// Check if connectNative exists
console.log('chrome.runtime.connectNative exists:', typeof chrome.runtime.connectNative);

// Check platform
console.log('Platform:', navigator.platform);
console.log('User Agent:', navigator.userAgent);

// Try to check if API is available
if (typeof chrome.runtime.connectNative === 'undefined') {
  console.error('❌ chrome.runtime.connectNative is NOT available');
  console.log('');
  console.log('This means native messaging is not supported in this Chrome instance.');
  console.log('');
  console.log('Common reasons:');
  console.log('1. Chrome OS/Chromebook may restrict native messaging');
  console.log('2. Running in kiosk mode');
  console.log('3. Enterprise policy disabled it');
  console.log('4. Chrome version too old');
} else {
  console.log('✅ chrome.runtime.connectNative is available');
  console.log('Native messaging should work (if host is installed)');
}

console.log('');
console.log('=== End Check ===');


