/**
 * Page Analysis Handler
 * Implements "spawn-process-close" batching pattern for memory efficiency
 */

import type { PageFeatures, PageDigest, InferenceResultMessage } from '@/lib/types';
import { db, generateUrlHash, generateDomainHash } from '@/lib/db';

// ============================================================================
// Batching Configuration
// ============================================================================

const BATCH_SIZE = 5; // Process 5 pages before closing offscreen
const BATCH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max wait
const PAGE_MIN_WORDS = 100; // Only process pages with >100 words

// ============================================================================
// Analysis Queue
// ============================================================================

interface QueuedPage {
  url: string;
  title: string;
  features: PageFeatures;
  text: string;
  timestamp: number;
}

let analysisQueue: QueuedPage[] = [];
let offscreenOpen = false;
let batchTimer: number | null = null;

// ============================================================================
// Queue Management
// ============================================================================

/**
 * Add page to analysis queue
 * @param url - Page URL
 * @param title - Page title
 * @param features - Extracted features
 * @param text - Page text content
 */
export async function queuePageForAnalysis(
  url: string,
  title: string,
  features: PageFeatures,
  text: string
): Promise<void> {
  // Quality filter: Skip if text is too short
  const wordCount = text.split(/\s+/).length;
  if (wordCount < PAGE_MIN_WORDS) {
    console.log('[PageAnalysis] Skipping page (too short):', wordCount, 'words');
    return;
  }

  // Add to queue
  analysisQueue.push({
    url,
    title,
    features,
    text,
    timestamp: Date.now(),
  });

  console.log(`[PageAnalysis] Queued page (${analysisQueue.length}/${BATCH_SIZE}):`, title.slice(0, 50));

  // Process if batch is full
  if (analysisQueue.length >= BATCH_SIZE) {
    await processBatch();
  } else {
    // Set timer for batch timeout
    if (batchTimer === null) {
      batchTimer = setTimeout(() => {
        console.log('[PageAnalysis] Batch timeout reached, processing...');
        processBatch();
      }, BATCH_TIMEOUT_MS) as unknown as number;
    }
  }
}

/**
 * Process queued pages (spawn-process-close pattern)
 */
async function processBatch(): Promise<void> {
  if (analysisQueue.length === 0) {
    return;
  }

  // Clear batch timer
  if (batchTimer !== null) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }

  // Get batch to process
  const batch = analysisQueue.splice(0, BATCH_SIZE);
  console.log(`[PageAnalysis] Processing batch of ${batch.length} pages`);

  try {
    // 1. Open offscreen document
    await openOffscreenIfNeeded();

    // 2. Process each page
    for (const page of batch) {
      try {
        await processPage(page);
      } catch (error) {
        console.error('[PageAnalysis] Failed to process page:', error);
        // Continue with other pages
      }
    }

    // 3. Close offscreen document (free ~100MB RAM)
    await closeOffscreen();

    console.log('[PageAnalysis] Batch complete');
  } catch (error) {
    console.error('[PageAnalysis] Batch processing failed:', error);
  }
}

// ============================================================================
// Offscreen Management
// ============================================================================

/**
 * Open offscreen document if not already open
 */
async function openOffscreenIfNeeded(): Promise<void> {
  if (offscreenOpen) {
    return;
  }

  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen/index.html',
      reasons: ['DOM_SCRAPING' as chrome.offscreen.Reason],
      justification: 'Run ML embedding model for page analysis',
    });

    offscreenOpen = true;
    console.log('[PageAnalysis] Offscreen document opened');
  } catch (error) {
    // Document might already exist
    console.warn('[PageAnalysis] Offscreen open warning:', error);
    offscreenOpen = true; // Assume it exists
  }
}

/**
 * Close offscreen document
 */
async function closeOffscreen(): Promise<void> {
  if (!offscreenOpen) {
    return;
  }

  try {
    await chrome.offscreen.closeDocument();
    offscreenOpen = false;
    console.log('[PageAnalysis] Offscreen document closed');
  } catch (error) {
    console.warn('[PageAnalysis] Offscreen close warning:', error);
  }
}

// ============================================================================
// Page Processing
// ============================================================================

/**
 * Process a single page (generate embedding + save to IndexedDB)
 */
async function processPage(page: QueuedPage): Promise<void> {
  console.log('[PageAnalysis] Processing:', page.title.slice(0, 50));
  const startTime = performance.now();

  try {
    // Generate embedding using offscreen worker
    const result = await chrome.runtime.sendMessage({
      type: 'RUN_INFERENCE',
      data: {
        text: page.text,
        features: page.features,
      },
    });

    if (!result.success) {
      throw new Error(result.error || 'Inference failed');
    }

    const { vector, entities, intentScore } = result.data;

    // Generate hashes
    const urlHash = await generateUrlHash(page.url);
    const domainHash = await generateDomainHash(page.features.domain);

    // Extract summary (first 500 words)
    const words = page.text.split(/\s+/);
    const summary = words.slice(0, 500).join(' ');

    // Create PageDigest
    const vectorArray = new Float32Array(vector);
    const now = Date.now();
    const HOUR_MS = 3600000; // 1 hour in milliseconds
    
    const digest: PageDigest = {
      schemaVersion: 4, // Current schema version (v4: adds tsFuzzy + passages)
      urlHash,
      domainHash,
      url: page.url, // ⭐ v3: Store URL for session resumption
      title: page.title.slice(0, 200), // Max 200 chars
      summary,
      fullText: page.text.length > 10000 ? undefined : page.text, // Only store if <10K chars
      vectorBuf: vectorArray.buffer.slice(0) as ArrayBuffer, // Store as ArrayBuffer
      vector: vectorArray, // Runtime use
      entities,
      category: page.features.isKnownEcommerce ? 'shopping' : 'general',
      intentScore,
      timestamp: page.timestamp,
      tsFuzzy: Math.floor(page.timestamp / HOUR_MS) * HOUR_MS, // ⭐ v4: Fuzzy timestamp (rounded to hour)
      lastAccessed: now,
      isSynced: false,
      isPrivate: false,
      autoExpireAt: now + 30 * 24 * 60 * 60 * 1000, // 30 days
    };

    // Save to IndexedDB
    await db.saveDigest(digest);

    const processingTime = performance.now() - startTime;
    console.log(`[PageAnalysis] Saved digest in ${processingTime.toFixed(0)}ms:`, digest.urlHash.slice(0, 8));
  } catch (error) {
    console.error('[PageAnalysis] Process page error:', error);
    throw error;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get queue status (for debugging/UI)
 */
export function getQueueStatus(): {
  queueLength: number;
  offscreenOpen: boolean;
} {
  return {
    queueLength: analysisQueue.length,
    offscreenOpen,
  };
}

/**
 * Force process current queue (for testing)
 */
export async function forceProcessQueue(): Promise<void> {
  await processBatch();
}

// ============================================================================
// Periodic Batch Processing (Safety Net)
// ============================================================================

// Process any remaining items every 10 minutes
setInterval(() => {
  if (analysisQueue.length > 0) {
    console.log('[PageAnalysis] Periodic batch trigger:', analysisQueue.length, 'items');
    processBatch();
  }
}, 10 * 60 * 1000); // 10 minutes

/**
 * Process inference result message (called from offscreen worker)
 */
export async function processInferenceResult(_message: InferenceResultMessage): Promise<{ success: boolean }> {
  console.log('[PageAnalysis] Processing inference result');
  // Results are handled inline in processPage, this is for direct messages
  return { success: true };
}

