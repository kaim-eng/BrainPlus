/**
 * IndexedDB Manager for "BrainPlus"
 * Handles local storage of page digests and vector embeddings
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { PageDigest, Passage } from './types';
import { sanitizeUrl } from './differentialPrivacy';
import { sha256 } from './crypto';

// ============================================================================
// Database Configuration
// ============================================================================

const DB_NAME = 'datapay_brain_v1';
const STORE_NAME = 'digests';
const PASSAGES_STORE = 'passages'; // ⭐ NEW v4: Passage store for RAG
const DB_VERSION = 4; // ⭐ Incremented for v4 schema (tsFuzzy + passages)
const CURRENT_SCHEMA_VERSION = 4;

// Storage limits
const MAX_ENTRIES = 5000;
const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

// ============================================================================
// Vector Buffer Utilities
// ============================================================================

/**
 * Convert Float32Array to ArrayBuffer for storage
 */
export function vectorToBuffer(vec: Float32Array): ArrayBuffer {
  // Use slice to get a copy as ArrayBuffer (not SharedArrayBuffer)
  return vec.buffer.slice(0) as ArrayBuffer;
}

/**
 * Convert ArrayBuffer to Float32Array for runtime use
 */
export function bufferToVector(buf: ArrayBuffer): Float32Array {
  return new Float32Array(buf);
}

/**
 * Hydrate a PageDigest by converting vectorBuf to vector
 */
export function hydrateDigest(digest: PageDigest): PageDigest {
  if (digest.vectorBuf && !digest.vector) {
    digest.vector = bufferToVector(digest.vectorBuf);
  }
  return digest;
}

/**
 * Prepare a PageDigest for storage by ensuring vectorBuf exists
 */
export function dehydrateDigest(digest: PageDigest): PageDigest {
  if (digest.vector && !digest.vectorBuf) {
    digest.vectorBuf = vectorToBuffer(digest.vector);
  }
  // Remove runtime vector before storage to save space
  const { vector, ...stored } = digest;
  return stored as PageDigest;
}

// ============================================================================
// Database Singleton
// ============================================================================

class DataPayDB {
  private db: IDBPDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize database (lazy)
   */
  private async ensureDB(): Promise<IDBPDatabase> {
    if (this.db) {
      return this.db;
    }

    if (this.initPromise) {
      await this.initPromise;
      return this.db!;
    }

    this.initPromise = this._init();
    await this.initPromise;
    return this.db!;
  }

  /**
   * Initialize IndexedDB
   */
  private async _init(): Promise<void> {
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        // Create digests store
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'urlHash',
          });

          // Indexes for efficient queries
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('category', 'category');
          store.createIndex('intentScore', 'intentScore');
          store.createIndex('timestamp_intentScore', ['timestamp', 'intentScore']);
          store.createIndex('isSynced', 'isSynced');
          store.createIndex('domainHash', 'domainHash');
          store.createIndex('freshness_intent', ['timestamp', 'intentScore']);
        }

        // Migration from v1 to v2
        if (oldVersion < 2) {
          console.log('[DB] Migrating from v1 to v2 (Float32Array → ArrayBuffer)');
          // Store variable used in upgrade check above
          transaction.objectStore(STORE_NAME);
          
          // Migration will happen lazily on read/write
          // We'll handle it in the saveDigest and getAll methods
        }

        // Migration from v2 to v3
        if (oldVersion < 3) {
          console.log('[DB] Migrating from v2 to v3 (adding URL field)');
          // Migration will happen lazily - new pages will have URL field
          // Old pages without URL will be handled gracefully in resumeSession
        }

        // ⭐ Migration from v3 to v4 (tsFuzzy + passages)
        if (oldVersion < 4) {
          console.log('[DB] Migrating from v3 to v4 (adding tsFuzzy + passages store)');
          
          // Create passages store for RAG
          if (!db.objectStoreNames.contains(PASSAGES_STORE)) {
            const passagesStore = db.createObjectStore(PASSAGES_STORE, {
              keyPath: 'passageId', // Composite: `${urlHash}:${chunkIdx}`
            });

            // Indexes for efficient queries
            passagesStore.createIndex('urlHash', 'urlHash'); // Query by parent page
            passagesStore.createIndex('tsFuzzy', 'tsFuzzy'); // Query by time
            passagesStore.createIndex('category', 'category'); // Filter by category
            passagesStore.createIndex('createdAt', 'createdAt'); // LRU eviction
          }
          
          // Add tsFuzzy to existing digests (lazy migration in migrateDigests)
          console.log('[DB] tsFuzzy field will be added lazily to existing digests');
        }
      },
    });

    console.log('[DB] IndexedDB initialized:', DB_NAME, 'version', DB_VERSION);
    
    // Run migration check
    await this.migrateDigests();
  }

  /**
   * Migrate digests to latest format (lazy migration)
   * Handles: v1→v2 (ArrayBuffer), v2→v3 (URL), v3→v4 (tsFuzzy)
   */
  private async migrateDigests(): Promise<void> {
    try {
      const db = await this.ensureDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      let cursor = await store.openCursor();
      let migratedCount = 0;
      
      while (cursor) {
        const digest = cursor.value as any;
        let needsUpdate = false;
        
        // Check if needs migration
        if (!digest.schemaVersion || digest.schemaVersion < CURRENT_SCHEMA_VERSION) {
          // v1 → v2: Convert Float32Array to ArrayBuffer
          if (digest.vector && !digest.vectorBuf) {
            digest.vectorBuf = vectorToBuffer(digest.vector);
            delete digest.vector; // Remove old field
            needsUpdate = true;
          }
          
          // v3 → v4: Add tsFuzzy (round timestamp to nearest hour)
          if (!digest.tsFuzzy && digest.timestamp) {
            digest.tsFuzzy = this.roundToHour(digest.timestamp);
            needsUpdate = true;
          }
          
          // Update schema version
          if (needsUpdate) {
            digest.schemaVersion = CURRENT_SCHEMA_VERSION;
            await cursor.update(digest);
            migratedCount++;
          }
        }
        
        cursor = await cursor.continue();
      }
      
      await tx.done;
      
      if (migratedCount > 0) {
        console.log(`[DB] Migrated ${migratedCount} digests to schema v${CURRENT_SCHEMA_VERSION}`);
      }
    } catch (error) {
      console.error('[DB] Migration error:', error);
      // Don't throw - allow app to continue
    }
  }
  
  /**
   * Round timestamp to nearest hour (for differential privacy)
   */
  private roundToHour(timestamp: number): number {
    const HOUR_MS = 3600000; // 1 hour in milliseconds
    return Math.floor(timestamp / HOUR_MS) * HOUR_MS;
  }

  /**
   * Save page digest to IndexedDB
   */
  async saveDigest(digest: PageDigest): Promise<void> {
    const db = await this.ensureDB();
    
    // Ensure auto-expiration is set
    if (!digest.autoExpireAt) {
      digest.autoExpireAt = Date.now() + RETENTION_MS;
    }

    // Ensure schema version is set
    if (!digest.schemaVersion) {
      digest.schemaVersion = CURRENT_SCHEMA_VERSION;
    }

    // ⭐ v4: Ensure tsFuzzy is set (round to hour for DP)
    if (!digest.tsFuzzy && digest.timestamp) {
      digest.tsFuzzy = this.roundToHour(digest.timestamp);
    }

    // Dehydrate: Convert vector to ArrayBuffer for storage
    const stored = dehydrateDigest(digest);

    await db.put(STORE_NAME, stored);
    console.log('[DB] Saved digest:', digest.urlHash.slice(0, 8));
  }

  /**
   * Get all digests (with hydration)
   */
  async getAll(): Promise<PageDigest[]> {
    const db = await this.ensureDB();
    const digests = await db.getAll(STORE_NAME);
    
    // Hydrate all digests
    return digests.map(hydrateDigest);
  }

  /**
   * Query recent high-intent pages
   * @param hours - Look back N hours
   * @param minScore - Minimum intent score (0.0-1.0)
   */
  async queryRecentIntent(
    hours: number = 48,
    minScore: number = 0.7
  ): Promise<PageDigest[]> {
    const db = await this.ensureDB();
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;

    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.store.index('timestamp_intentScore');
    
    const results: PageDigest[] = [];
    
    // Get all entries within time range with high intent
    let cursor = await index.openCursor(
      IDBKeyRange.bound([cutoffTime, minScore], [Date.now(), 1.0])
    );

    while (cursor) {
      results.push(hydrateDigest(cursor.value));
      cursor = await cursor.continue();
    }

    await tx.done;
    
    console.log(`[DB] Found ${results.length} high-intent pages (last ${hours}h, score >= ${minScore})`);
    return results;
  }

  /**
   * Search for similar pages using cosine similarity
   * @param queryVector - 512-dim embedding to search for
   * @param limit - Max results to return
   */
  async searchSemantic(
    queryVector: Float32Array,
    limit: number = 10
  ): Promise<PageDigest[]> {
    const db = await this.ensureDB();
    
    // Get all digests
    const allDigests = await db.getAll(STORE_NAME);
    
    // Hydrate and calculate cosine similarity for each
    const scored = allDigests.map(digest => {
      const hydrated = hydrateDigest(digest);
      return {
        digest: hydrated,
        similarity: this.cosineSimilarity(queryVector, hydrated.vector!),
      };
    });

    // Sort by similarity (descending)
    scored.sort((a, b) => b.similarity - a.similarity);

    // Return top N
    const results = scored.slice(0, limit).map(s => s.digest);
    
    console.log(`[DB] Semantic search: found ${results.length} similar pages`);
    return results;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  /**
   * Calculate quality score for eviction (higher = keep, lower = evict)
   * Design Doc: AMA_DESIGN_REVIEW.md, Phase 0 Week 2
   * 
   * Factors:
   * - Recency: Recent pages are more valuable
   * - Intent: High-intent pages are more valuable
   * - Access frequency: Frequently accessed pages are more valuable
   * - Category: Some categories are more valuable (e.g., research > news)
   */
  private calculateQualityScore(digest: PageDigest, now: number): number {
    // Recency score (0.0-1.0, exponential decay)
    const ageMs = now - digest.timestamp;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    const recencyScore = Math.exp(-0.1 * ageDays); // Slower decay than search
    
    // Intent score (0.0-1.0)
    const intentScore = digest.intentScore ?? 0.5;
    
    // Access frequency score (0.0-1.0)
    // More recent access = higher score
    const lastAccessMs = digest.lastAccessed || digest.timestamp;
    const accessAgeMs = now - lastAccessMs;
    const accessAgeDays = accessAgeMs / (1000 * 60 * 60 * 24);
    const accessScore = Math.exp(-0.2 * accessAgeDays);
    
    // Category value (some categories are more valuable)
    const categoryValues: Record<string, number> = {
      'research': 1.0,
      'tech': 0.9,
      'news': 0.7,
      'shopping': 0.6,
      'entertainment': 0.5,
      'social': 0.4,
      'general': 0.5,
    };
    const categoryScore = categoryValues[digest.category] || 0.5;
    
    // Weighted quality score
    const qualityScore = 
      (recencyScore * 0.3) +
      (intentScore * 0.3) +
      (accessScore * 0.3) +
      (categoryScore * 0.1);
    
    return qualityScore;
  }

  /**
   * Prune old entries based on quality-aware retention policy
   * Design Doc: AMA_DESIGN_REVIEW.md, Phase 0 Week 2
   * 
   * Strategy:
   * 1. Delete expired entries (hard expiry)
   * 2. If over limit, evict lowest quality entries
   * 3. Never evict high-quality recent entries
   * 
   * @returns Number of entries deleted
   */
  async pruneOldEntries(): Promise<number> {
    const db = await this.ensureDB();
    const now = Date.now();
    
    // Get all entries
    const allDigests = await db.getAll(STORE_NAME);
    
    let deletedCount = 0;
    
    // 1. Delete expired entries (hard expiry)
    const expired: string[] = [];
    for (const digest of allDigests) {
      if (digest.autoExpireAt && digest.autoExpireAt < now) {
        expired.push(digest.urlHash);
      }
    }
    
    for (const urlHash of expired) {
      await db.delete(STORE_NAME, urlHash);
      // Also delete associated passages
      await this.deletePassagesByPage(urlHash);
      deletedCount++;
    }
    
    // 2. If still over limit, use quality-aware eviction
    const remaining = allDigests.length - deletedCount;
    if (remaining > MAX_ENTRIES) {
      const toEvict = remaining - MAX_ENTRIES;
      
      // Calculate quality scores for all non-expired entries
      const scored = allDigests
        .filter(d => !expired.includes(d.urlHash))
        .map(d => ({
          digest: d,
          qualityScore: this.calculateQualityScore(d, now),
        }));
      
      // Sort by quality (ascending - lowest quality first)
      scored.sort((a, b) => a.qualityScore - b.qualityScore);
      
      // Evict lowest quality entries
      const toDelete = scored.slice(0, toEvict);
      
      for (const item of toDelete) {
        await db.delete(STORE_NAME, item.digest.urlHash);
        // Also delete associated passages
        await this.deletePassagesByPage(item.digest.urlHash);
        deletedCount++;
      }
      
      console.log(`[DB] Quality-aware eviction: removed ${toDelete.length} low-quality entries`);
    }
    
    console.log(`[DB] Pruned ${deletedCount} entries (${expired.length} expired, ${deletedCount - expired.length} quality-evicted)`);
    return deletedCount;
  }

  /**
   * Clear all data (GDPR: Right to Erasure)
   * CRITICAL FIX #5: Also clears pending sessions
   */
  async clearAllData(): Promise<void> {
    const db = await this.ensureDB();
    await db.clear(STORE_NAME);
    
    // Also clear session-related storage
    try {
      const { removeLocal } = await import('./storage');
      await removeLocal('pendingSession');
      await removeLocal('dismissedSessionIds');
      await removeLocal('lastSessionCheckTimestamp');
      
      // Clear badge
      if (typeof chrome !== 'undefined' && chrome.action) {
        await chrome.action.setBadgeText({ text: '' });
      }
    } catch (error) {
      console.error('[DB] Failed to clear session storage:', error);
    }
    
    console.log('[DB] Cleared all data and sessions');
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    entryCount: number;
    estimatedBytes: number;
    quotaUsed: number;
    quotaTotal: number;
  }> {
    const db = await this.ensureDB();
    
    // Get entry count
    const entryCount = await db.count(STORE_NAME);
    
    // Estimate storage size (rough calculation)
    // Each digest: ~100KB (title + summary + vector + metadata)
    const estimatedBytes = entryCount * 100 * 1024;
    
    // Get quota info
    let quotaUsed = 0;
    let quotaTotal = 0;
    
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      quotaUsed = estimate.usage || 0;
      quotaTotal = estimate.quota || 0;
    }
    
    return {
      entryCount,
      estimatedBytes,
      quotaUsed,
      quotaTotal,
    };
  }

  /**
   * Export all data as JSON (GDPR compliance)
   */
  async exportData(): Promise<Blob> {
    const db = await this.ensureDB();
    const allDigests = await db.getAll(STORE_NAME);
    
    // Convert to exportable format (no binary vectors)
    const exportData = {
      exportDate: new Date().toISOString(),
      version: DB_VERSION,
      pageCount: allDigests.length,
      pages: allDigests.map(digest => ({
        title: digest.title,
        summary: digest.summary,
        entities: digest.entities,
        category: digest.category,
        intentScore: digest.intentScore,
        timestamp: new Date(digest.timestamp).toISOString(),
        // Note: Exclude urlHash for privacy
      })),
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    return new Blob([jsonString], { type: 'application/json' });
  }

  /**
   * Update sync status for a digest
   */
  async updateSyncStatus(urlHash: string, synced: boolean): Promise<void> {
    const db = await this.ensureDB();
    const digest = await db.get(STORE_NAME, urlHash);
    
    if (digest) {
      digest.isSynced = synced;
      digest.signalSentAt = synced ? Date.now() : undefined;
      await db.put(STORE_NAME, digest);
    }
  }

  /**
   * Get digest by URL
   */
  async getDigestByUrl(url: string): Promise<PageDigest | null> {
    const sanitized = sanitizeUrl(url);
    const urlHash = await sha256(sanitized);
    
    const db = await this.ensureDB();
    const digest = await db.get(STORE_NAME, urlHash);
    
    return digest ? hydrateDigest(digest) : null;
  }

  /**
   * Get digest by hash
   */
  async getDigest(urlHash: string): Promise<PageDigest | null> {
    const db = await this.ensureDB();
    const digest = await db.get(STORE_NAME, urlHash);
    
    return digest ? hydrateDigest(digest) : null;
  }

  /**
   * Update lastAccessed timestamp (for LRU)
   */
  async touchDigest(urlHash: string): Promise<void> {
    const db = await this.ensureDB();
    const digest = await db.get(STORE_NAME, urlHash);
    
    if (digest) {
      digest.lastAccessed = Date.now();
      await db.put(STORE_NAME, digest);
    }
  }

  /**
   * Delete a digest by urlHash
   * CRITICAL FIX #5: Invalidates related sessions
   */
  async delete(storeName: string, urlHash: string): Promise<void> {
    const db = await this.ensureDB();
    await db.delete(storeName, urlHash);
    console.log('[DB] Deleted digest:', urlHash.slice(0, 8));
    
    // CRITICAL: Check if this page is in a pending session
    await this.invalidateSessionsWithPage(urlHash);
  }

  /**
   * Invalidate sessions containing a deleted page
   * CRITICAL FIX #5: Prevents "ghost sessions" with deleted pages
   */
  private async invalidateSessionsWithPage(urlHash: string): Promise<void> {
    try {
      // Import storage utilities
      const { getLocal, setLocal } = await import('./storage');
      
      // Check pending session
      const pending = await getLocal<any>('pendingSession');
      if (pending && pending.session && pending.session.pageIds.includes(urlHash)) {
        console.log('[DB] Invalidating pending session due to deleted page');
        
        // Remove the page from session
        pending.session.pageIds = pending.session.pageIds.filter(
          (id: string) => id !== urlHash
        );
        pending.session.pageCount = pending.session.pageIds.length;
        
        // If too few pages remain, clear the session entirely
        if (pending.session.pageCount < 3) {
          await setLocal('pendingSession', null);
          // Clear badge
          if (typeof chrome !== 'undefined' && chrome.action) {
            await chrome.action.setBadgeText({ text: '' });
          }
          console.log('[DB] Pending session cleared (too few pages remaining)');
        } else {
          await setLocal('pendingSession', pending);
          console.log('[DB] Pending session updated (removed deleted page)');
        }
      }
    } catch (error) {
      console.error('[DB] Failed to invalidate sessions:', error);
      // Don't throw - deletion is more important than session management
    }
  }

  // ============================================================================
  // Passage Management (v4 - RAG Support)
  // ============================================================================

  /**
   * Save passage to IndexedDB
   */
  async savePassage(passage: Passage): Promise<void> {
    const db = await this.ensureDB();
    
    // Dehydrate: Convert embedding to ArrayBuffer for storage
    const stored = { ...passage };
    if (passage.embedding && !passage.embeddingBuf) {
      stored.embeddingBuf = vectorToBuffer(passage.embedding);
    }
    // Remove runtime embedding before storage
    delete stored.embedding;

    await db.put(PASSAGES_STORE, stored);
    console.log('[DB] Saved passage:', passage.passageId);
  }

  /**
   * Save multiple passages in a transaction (more efficient)
   */
  async savePassages(passages: Passage[]): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction(PASSAGES_STORE, 'readwrite');
    
    for (const passage of passages) {
      const stored = { ...passage };
      if (passage.embedding && !passage.embeddingBuf) {
        stored.embeddingBuf = vectorToBuffer(passage.embedding);
      }
      delete stored.embedding;
      
      await tx.store.put(stored);
    }
    
    await tx.done;
    console.log(`[DB] Saved ${passages.length} passages`);
  }

  /**
   * Get all passages for a page
   */
  async getPassagesByPage(urlHash: string): Promise<Passage[]> {
    const db = await this.ensureDB();
    const tx = db.transaction(PASSAGES_STORE, 'readonly');
    const index = tx.store.index('urlHash');
    
    const passages = await index.getAll(urlHash);
    
    // Hydrate embeddings
    return passages.map(p => {
      if (p.embeddingBuf && !p.embedding) {
        p.embedding = bufferToVector(p.embeddingBuf);
      }
      return p;
    });
  }

  /**
   * Get all passages (for semantic search)
   */
  async getAllPassages(): Promise<Passage[]> {
    const db = await this.ensureDB();
    const passages = await db.getAll(PASSAGES_STORE);
    
    // Hydrate embeddings
    return passages.map(p => {
      if (p.embeddingBuf && !p.embedding) {
        p.embedding = bufferToVector(p.embeddingBuf);
      }
      return p;
    });
  }

  /**
   * Delete all passages for a page
   */
  async deletePassagesByPage(urlHash: string): Promise<void> {
    const db = await this.ensureDB();
    const tx = db.transaction(PASSAGES_STORE, 'readwrite');
    const index = tx.store.index('urlHash');
    
    const passages = await index.getAll(urlHash);
    
    for (const passage of passages) {
      await tx.store.delete(passage.passageId);
    }
    
    await tx.done;
    console.log(`[DB] Deleted ${passages.length} passages for page:`, urlHash.slice(0, 8));
  }

  /**
   * Clean up orphaned passages (passages without parent page)
   */
  async cleanupOrphanPassages(): Promise<number> {
    const db = await this.ensureDB();
    const tx = db.transaction([PASSAGES_STORE, STORE_NAME], 'readwrite');
    const passagesStore = tx.objectStore(PASSAGES_STORE);
    const digestsStore = tx.objectStore(STORE_NAME);
    
    const allPassages = await passagesStore.getAll();
    let deletedCount = 0;
    
    for (const passage of allPassages) {
      // Check if parent page exists
      const pageExists = await digestsStore.get(passage.urlHash);
      if (!pageExists) {
        await passagesStore.delete(passage.passageId);
        deletedCount++;
      }
    }
    
    await tx.done;
    
    if (deletedCount > 0) {
      console.log(`[DB] Cleaned up ${deletedCount} orphaned passages`);
    }
    
    return deletedCount;
  }

  /**
   * Get passage count
   */
  async getPassageCount(): Promise<number> {
    const db = await this.ensureDB();
    return await db.count(PASSAGES_STORE);
  }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const db = new DataPayDB();

// Convenience exports for direct access
export const saveDigest = (digest: PageDigest) => db.saveDigest(digest);
export const getDigestByUrl = (url: string) => db.getDigestByUrl(url);
export const getAllDigests = () => db.getAll();

// ============================================================================
// Utility: Generate URL hash for digest key
// ============================================================================

/**
 * Generate URL hash for use as primary key
 * @param url - Original URL
 * @returns SHA-256 hash
 */
export async function generateUrlHash(url: string): Promise<string> {
  const sanitized = sanitizeUrl(url);
  return await sha256(sanitized);
}

/**
 * Generate domain hash for grouping
 * @param domain - Domain name
 * @returns SHA-256 hash
 */
export async function generateDomainHash(domain: string): Promise<string> {
  return await sha256(domain.toLowerCase());
}

