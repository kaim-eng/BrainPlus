/**
 * Service Worker (Background Script)
 * Orchestrates extension functionality and manages persistent storage
 */

// Polyfill for window (some packages check for window existence)
// @ts-ignore
if (typeof window === 'undefined') {
  // @ts-ignore
  globalThis.window = globalThis;
}

import { handleMessage } from './msgHandler';
import { syncDealsJob, syncPointsJob } from './jobs';
import { initializeExtension } from './init';
import { STORAGE_CONFIG } from '@/lib/constants';
import { checkForResumableSessions } from './handlers/sessionHandler';
import { handleAMAQuery } from './handlers/amaHandler';

// ============================================================================
// Service Worker Lifecycle
// ============================================================================

// Initialize on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Background] Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    await initializeExtension();
  } else if (details.reason === 'update') {
    console.log('[Background] Extension updated from', details.previousVersion);
    // TODO: Handle migration if needed
  }
});

// Initialize on startup (browser launch)
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Background] Browser started, initializing extension');
  await initializeExtension();
  // Also check for resumable sessions
  await checkForResumableSessions();
});

// ============================================================================
// Message Handling
// ============================================================================

// Listen for messages from content scripts, popup, offscreen
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle message asynchronously
  handleMessage(message, sender)
    .then(response => sendResponse(response))
    .catch(error => {
      console.error('[Background] Message handling error:', error);
      sendResponse({ success: false, error: String(error) });
    });
  
  // Return true to indicate async response
  return true;
});

// ============================================================================
// Port Connections (for AMA streaming)
// ============================================================================

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'ama-stream') {
    // Handle AMA streaming connection
    port.onMessage.addListener(async (message) => {
      if (message.type === 'AMA_QUERY') {
        try {
          await handleAMAQuery(message, port);
        } catch (error) {
          console.error('[Background] AMA error:', error);
          // Send error to frontend
          port.postMessage({
            type: 'AMA_ERROR',
            error: error instanceof Error ? error.message : String(error),
            requestId: `ama-${Date.now()}`,
            timestamp: Date.now(),
          });
        }
      }
    });
  }
});

// ============================================================================
// Alarms (Periodic Tasks)
// ============================================================================

// Setup alarms on service worker start
(async () => {
  // Sync deals alarm (every hour)
  const dealsAlarm = await chrome.alarms.get('syncDeals');
  if (!dealsAlarm) {
    chrome.alarms.create('syncDeals', {
      periodInMinutes: STORAGE_CONFIG.SYNC_INTERVAL_MINUTES,
    });
    console.log('[Background] Created syncDeals alarm');
  }
  
  // Sync points alarm (every hour)
  const pointsAlarm = await chrome.alarms.get('syncPoints');
  if (!pointsAlarm) {
    chrome.alarms.create('syncPoints', {
      periodInMinutes: STORAGE_CONFIG.SYNC_INTERVAL_MINUTES,
    });
    console.log('[Background] Created syncPoints alarm');
  }
})();

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('[Background] Alarm triggered:', alarm.name);
  
  try {
    switch (alarm.name) {
      case 'syncDeals':
        await syncDealsJob();
        break;
      case 'syncPoints':
        await syncPointsJob();
        break;
      default:
        console.warn('[Background] Unknown alarm:', alarm.name);
    }
  } catch (error) {
    console.error(`[Background] Alarm ${alarm.name} failed:`, error);
  }
});

// ============================================================================
// Tab Management (for context tracking)
// ============================================================================

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only process when page fully loaded
  if (changeInfo.status === 'complete' && tab.url) {
    console.log('[Background] Tab loaded:', tabId, tab.url);
    // Content script will handle page analysis
  }
});

// ============================================================================
// Idle State Detection (for Task Continuation)
// ============================================================================

// Set idle detection interval
chrome.idle.setDetectionInterval(60); // Check every 60 seconds

// Handle idle state changes
chrome.idle.onStateChanged.addListener(async (newState) => {
  console.log('[Background] Idle state changed:', newState);
  
  if (newState === 'active') {
    // User returned to computer - check for resumable sessions
    await checkForResumableSessions();
  }
});

// ============================================================================
// Keep Service Worker Alive (Best Effort)
// ============================================================================

// Note: Service workers WILL terminate after 30s of inactivity
// This is intentional MV3 behavior - we rely on persistent storage
console.log('[Background] Service worker started');

