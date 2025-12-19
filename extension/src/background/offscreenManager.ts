/**
 * Offscreen Document Manager - Singleton Pattern
 * Ensures only one offscreen document exists at a time
 * Handles both search embeddings and session clustering
 * 
 * CRITICAL FIX #1: Prevents "document already exists" errors
 * when multiple features (Search + Sessions) use offscreen simultaneously
 */

let offscreenDocumentPromise: Promise<void> | null = null;

/**
 * Ensure offscreen document exists (idempotent)
 * Safe to call multiple times - only creates once
 */
export async function ensureOffscreenDocument(): Promise<void> {
  // If already creating, wait for that promise
  if (offscreenDocumentPromise) {
    console.log('[OffscreenManager] Waiting for document creation in progress');
    return offscreenDocumentPromise;
  }

  // Check if document already exists
  try {
    const hasDocument = await chrome.offscreen.hasDocument();
    if (hasDocument) {
      console.log('[OffscreenManager] Document already exists');
      return;
    }
  } catch (error) {
    console.warn('[OffscreenManager] hasDocument() not supported, trying to create');
  }

  // Create new document
  offscreenDocumentPromise = (async () => {
    try {
      console.log('[OffscreenManager] Creating document...');
      await chrome.offscreen.createDocument({
        url: 'offscreen/index.html',
        reasons: ['DOM_SCRAPING' as chrome.offscreen.Reason],
        justification: 'Run ML inference and vector operations for search and session clustering',
      });
      console.log('[OffscreenManager] Document created successfully');
    } catch (error) {
      // Check if error is "document already exists" (race condition)
      const errorMsg = (error as Error).message || String(error);
      if (errorMsg.includes('already exists') || errorMsg.includes('Only a single offscreen')) {
        console.log('[OffscreenManager] Document created by another caller (race condition - OK)');
        return; // This is OK
      }
      console.error('[OffscreenManager] Failed to create document:', error);
      throw error; // Re-throw other errors
    } finally {
      offscreenDocumentPromise = null; // Reset for next call
    }
  })();

  return offscreenDocumentPromise;
}

/**
 * Close offscreen document
 */
export async function closeOffscreenDocument(): Promise<void> {
  try {
    await chrome.offscreen.closeDocument();
    console.log('[OffscreenManager] Document closed');
  } catch (error) {
    console.error('[OffscreenManager] Failed to close document:', error);
  }
}

/**
 * Send message to offscreen document with retry logic
 */
export async function sendToOffscreen<T>(message: any, timeoutMs: number = 30000): Promise<T> {
  await ensureOffscreenDocument();
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Offscreen message timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

