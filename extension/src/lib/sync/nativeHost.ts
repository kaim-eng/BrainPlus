/**
 * Native Messaging Host Client
 * 
 * Wrapper for communicating with the native messaging host.
 * 
 * Progressive Enhancement Design:
 * - Extension works 100% without native host
 * - Gracefully detects availability
 * - Shows clear installation prompts if needed
 */

import type { NativeMessageRequest, NativeMessageResponse } from './types';

/**
 * Native messaging host name (must match manifest)
 */
const NATIVE_HOST_NAME = 'com.brainplus.sync_host';

/**
 * Timeout for native messaging calls (ms)
 */
const NATIVE_MESSAGE_TIMEOUT = 30000;

/**
 * Check if native messaging host is available
 * 
 * @returns Promise resolving to availability status
 */
export async function checkNativeHostAvailability(): Promise<{
  available: boolean;
  version?: string;
  features?: string[];
  error?: string;
}> {
  try {
    // Use shorter timeout for availability check (2 seconds)
    const response = await sendNativeMessage({
      type: 'check_availability',
      payload: {},
    }, 2000);
    
    if (response.success) {
      console.log('✅ Native host available:', response.data);
      return {
        available: true,
        version: response.data?.version,
        features: response.data?.features,
      };
    } else {
      console.warn('⚠️ Native host responded but not available:', response.error);
      return {
        available: false,
        error: response.error,
      };
    }
  } catch (error) {
    console.warn('⚠️ Native host not available:', error instanceof Error ? error.message : String(error));
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Native host not installed',
    };
  }
}

/**
 * Send message to native messaging host
 * 
 * @param request - Request message
 * @param timeout - Timeout in milliseconds (default: 30s)
 * @returns Promise resolving to response message
 */
export async function sendNativeMessage(
  request: NativeMessageRequest,
  timeout: number = NATIVE_MESSAGE_TIMEOUT
): Promise<NativeMessageResponse> {
  return new Promise((resolve, reject) => {
    let port: chrome.runtime.Port | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      // Connect to native messaging host
      port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
      
      // Set up timeout
      timeoutId = setTimeout(() => {
        if (port) {
          port.disconnect();
        }
        reject(new Error('Native messaging timeout'));
      }, timeout);
      
      // Listen for response
      port.onMessage.addListener((response: NativeMessageResponse) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (port) {
          port.disconnect();
        }
        resolve(response);
      });
      
      // Listen for disconnect
      port.onDisconnect.addListener(() => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(`Native host disconnected: ${error.message}`));
        } else {
          reject(new Error('Native host disconnected unexpectedly'));
        }
      });
      
      // Send request
      port.postMessage(request);
      
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (port) {
        port.disconnect();
      }
      reject(error);
    }
  });
}

/**
 * Generate QR code via native host
 * 
 * @param payload - QR code payload
 * @returns Promise resolving to QR code data URL
 */
export async function generateQRCodeViaHost(payload: {
  deviceId: string;
  signalingUrl: string;
  roomId: string;
  publicKey: string;
  expiresAt: number;
}): Promise<string> {
  const response = await sendNativeMessage({
    type: 'generate_qr',
    payload,
  });
  
  if (!response.success) {
    throw new Error(`Failed to generate QR code: ${response.error}`);
  }
  
  return response.data.qrCodeDataUrl;
}

/**
 * Start signaling via native host
 * 
 * @param signalingUrl - WebSocket signaling server URL
 * @param roomId - Room ID for pairing
 * @returns Promise resolving when connected
 */
export async function startSignalingViaHost(
  signalingUrl: string,
  roomId: string
): Promise<void> {
  const response = await sendNativeMessage({
    type: 'start_signaling',
    payload: {
      signalingUrl,
      roomId,
    },
  });
  
  if (!response.success) {
    throw new Error(`Failed to start signaling: ${response.error}`);
  }
  
  console.log('✅ Signaling started via native host');
}

/**
 * Send history batch via native host
 * 
 * @param batch - History batch to send
 * @returns Promise resolving when batch is sent
 */
export async function sendBatchViaHost(batch: any): Promise<void> {
  const response = await sendNativeMessage({
    type: 'send_batch',
    payload: batch,
  }, 60000); // Longer timeout for large batches
  
  if (!response.success) {
    throw new Error(`Failed to send batch: ${response.error}`);
  }
  
  console.log(`✅ Batch ${batch.batchId} sent via native host`);
}

/**
 * Get installation instructions for native host
 */
export function getInstallationInstructions(): {
  title: string;
  steps: string[];
  downloadUrl?: string;
} {
  const platform = navigator.platform.toLowerCase();
  
  if (platform.includes('win')) {
    return {
      title: 'Install BrainPlus Sync Companion (Windows)',
      steps: [
        '1. Download the installer from brainplus.dev/sync',
        '2. Run the installer (may require Administrator)',
        '3. Restart your browser',
        '4. Try syncing again',
      ],
      downloadUrl: 'https://brainplus.dev/sync/windows',
    };
  } else if (platform.includes('mac')) {
    return {
      title: 'Install BrainPlus Sync Companion (macOS)',
      steps: [
        '1. Download the installer from brainplus.dev/sync',
        '2. Open the .dmg file and drag to Applications',
        '3. Right-click and select "Open" (for first-time security)',
        '4. Restart your browser',
        '5. Try syncing again',
      ],
      downloadUrl: 'https://brainplus.dev/sync/macos',
    };
  } else {
    return {
      title: 'Install BrainPlus Sync Companion (Linux)',
      steps: [
        '1. Download and extract the archive from brainplus.dev/sync',
        '2. Run: cd brainplus-sync && npm install',
        '3. Run: node install-manifest.js YOUR_EXTENSION_ID',
        '4. Restart your browser',
        '5. Try syncing again',
      ],
      downloadUrl: 'https://brainplus.dev/sync/linux',
    };
  }
}

