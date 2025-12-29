/**
 * PageDigest Serialization Utilities
 * 
 * Converts PageDigest objects between IndexedDB format (with ArrayBuffer vectors)
 * and network transport format (with Base64 vectors).
 * 
 * Performance Note: Float32Array → Base64 conversion is CPU-intensive.
 * Run Phase 0 benchmarks before deploying to mobile.
 */

import type { PageDigest } from '../types';
import type { SerializedPageDigest, HistoryBatch } from './types';
import { getCurrentVectorMetadata } from './vectorCompatibility';

/**
 * Convert ArrayBuffer to Base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // Process in chunks to avoid call stack size exceeded
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  return bytes.buffer;
}

/**
 * Serialize a single PageDigest for network transport
 * 
 * @param digest - PageDigest from IndexedDB
 * @returns SerializedPageDigest with Base64 vector
 */
export async function serializeDigest(digest: PageDigest): Promise<SerializedPageDigest> {
  // Convert vector ArrayBuffer to Base64
  const vectorBase64 = digest.vectorBuf ? arrayBufferToBase64(digest.vectorBuf) : undefined;
  
  // Get vector metadata if not present
  const vectorMetadata = digest.vectorMetadata || await getCurrentVectorMetadata();
  
  return {
    pageId: digest.pageId || digest.urlHash, // Use urlHash as pageId if not set
    url: digest.url,
    domain: digest.domain || extractDomain(digest.url),
    title: digest.title,
    summary: digest.summary,
    intentScore: digest.intentScore,
    qualityScore: digest.qualityScore,
    entities: digest.entities?.map(e => typeof e === 'string' ? { text: e, type: 'keyword' } : e),
    keywords: digest.keywords || digest.entities,
    category: digest.category,
    timestamp: digest.timestamp,
    lastAccessed: digest.lastAccessed,
    vector: vectorBase64,
    vectorMetadata,
    syncMetadata: digest.syncMetadata,
    activityContext: digest.activityContext,
  };
}

/**
 * Deserialize a PageDigest from network transport format
 * 
 * @param serialized - SerializedPageDigest with Base64 vector
 * @param schemaVersion - Schema version for the IndexedDB digest
 * @returns PageDigest ready for IndexedDB storage
 */
export function deserializeDigest(
  serialized: SerializedPageDigest,
  schemaVersion: number = 5 // v5 adds sync metadata
): PageDigest {
  // Convert Base64 vector back to ArrayBuffer
  const vectorBuf = serialized.vector ? base64ToArrayBuffer(serialized.vector) : new ArrayBuffer(0);
  
  // Generate URL hash and domain hash
  const urlHash = serialized.pageId || hashString(serialized.url);
  const domainHash = hashString(serialized.domain);
  
  return {
    schemaVersion,
    urlHash,
    domainHash,
    url: serialized.url,
    title: serialized.title,
    summary: serialized.summary,
    vectorBuf,
    entities: serialized.entities?.map(e => e.text) || serialized.keywords || [],
    category: serialized.category || 'general',
    intentScore: serialized.intentScore || 0,
    timestamp: serialized.timestamp,
    tsFuzzy: roundToHour(serialized.timestamp),
    lastAccessed: serialized.lastAccessed || Date.now(),
    isSynced: false, // Don't send synced pages to backend
    isPrivate: false,
    autoExpireAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
    
    // Sync metadata
    vectorMetadata: serialized.vectorMetadata,
    syncMetadata: {
      ...serialized.syncMetadata,
      lastSyncedAt: Date.now(),
    },
    pageId: serialized.pageId,
    domain: serialized.domain,
    qualityScore: serialized.qualityScore,
    keywords: serialized.keywords,
    activityContext: serialized.activityContext,
  };
}

/**
 * Serialize a batch of PageDigests
 * 
 * @param digests - Array of PageDigests to serialize
 * @param batchSize - Maximum pages per batch
 * @returns Array of HistoryBatch objects
 */
export async function serializeBatch(
  digests: PageDigest[],
  batchSize: number = 100
): Promise<HistoryBatch[]> {
  const batches: HistoryBatch[] = [];
  const totalBatches = Math.ceil(digests.length / batchSize);
  
  console.log(`Serializing ${digests.length} pages into ${totalBatches} batches...`);
  const startTime = performance.now();
  
  for (let i = 0; i < digests.length; i += batchSize) {
    const chunk = digests.slice(i, i + batchSize);
    const serialized = await Promise.all(chunk.map(d => serializeDigest(d)));
    
    batches.push({
      batchId: generateBatchId(),
      sequence: Math.floor(i / batchSize),
      totalBatches,
      pages: serialized,
      sourceDeviceId: getDeviceId(),
      timestamp: Date.now(),
    });
  }
  
  const endTime = performance.now();
  console.log(`✅ Serialized ${digests.length} pages in ${(endTime - startTime).toFixed(0)}ms`);
  
  return batches;
}

/**
 * Deserialize a batch of PageDigests
 * 
 * @param batch - HistoryBatch to deserialize
 * @returns Array of PageDigests ready for IndexedDB
 */
export function deserializeBatch(batch: HistoryBatch): PageDigest[] {
  console.log(`Deserializing batch ${batch.sequence + 1}/${batch.totalBatches} (${batch.pages.length} pages)...`);
  const startTime = performance.now();
  
  const digests = batch.pages.map(page => deserializeDigest(page));
  
  const endTime = performance.now();
  console.log(`✅ Deserialized ${digests.length} pages in ${(endTime - startTime).toFixed(0)}ms`);
  
  return digests;
}

/**
 * Estimate serialized size of a batch (for performance testing)
 */
export function estimateBatchSize(batch: HistoryBatch): number {
  const json = JSON.stringify(batch);
  return new Blob([json]).size;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

/**
 * Hash a string using SHA-256 (simplified version)
 * For production, use the same hashing as in db.ts
 */
function hashString(str: string): string {
  // Simple hash for now (replace with crypto.subtle.digest in production)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `hash_${Math.abs(hash).toString(36)}`;
}

/**
 * Round timestamp to nearest hour (for differential privacy)
 */
function roundToHour(timestamp: number): number {
  const hour = 60 * 60 * 1000;
  return Math.floor(timestamp / hour) * hour;
}

/**
 * Generate unique batch ID
 */
function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get device ID (TODO: implement proper device ID management)
 */
function getDeviceId(): string {
  // Temporary placeholder - should be stored in chrome.storage.local
  return 'device_' + Math.random().toString(36).substring(2, 11);
}

/**
 * Benchmark serialization performance (for Phase 0 testing)
 */
export async function benchmarkSerializationPerformance(
  digests: PageDigest[]
): Promise<{
  totalPages: number;
  serializeTimeMs: number;
  deserializeTimeMs: number;
  avgTimePerPage: number;
  estimatedSizeKB: number;
}> {
  console.log('='.repeat(60));
  console.log('Serialization Performance Benchmark');
  console.log('='.repeat(60));
  
  // Serialize
  const serializeStart = performance.now();
  const batches = await serializeBatch(digests, 100);
  const serializeEnd = performance.now();
  const serializeTimeMs = serializeEnd - serializeStart;
  
  // Estimate size
  const totalSize = batches.reduce((sum, batch) => sum + estimateBatchSize(batch), 0);
  const estimatedSizeKB = totalSize / 1024;
  
  // Deserialize
  const deserializeStart = performance.now();
  batches.flatMap(batch => deserializeBatch(batch)); // Test deserialization
  const deserializeEnd = performance.now();
  const deserializeTimeMs = deserializeEnd - deserializeStart;
  
  const avgTimePerPage = (serializeTimeMs + deserializeTimeMs) / digests.length;
  
  console.log('');
  console.log('Results:');
  console.log(`  Total pages: ${digests.length}`);
  console.log(`  Serialize time: ${serializeTimeMs.toFixed(0)}ms`);
  console.log(`  Deserialize time: ${deserializeTimeMs.toFixed(0)}ms`);
  console.log(`  Avg time per page: ${avgTimePerPage.toFixed(2)}ms`);
  console.log(`  Estimated size: ${estimatedSizeKB.toFixed(0)}KB`);
  console.log('');
  console.log('='.repeat(60));
  
  return {
    totalPages: digests.length,
    serializeTimeMs,
    deserializeTimeMs,
    avgTimePerPage,
    estimatedSizeKB,
  };
}

