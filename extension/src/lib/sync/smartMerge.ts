/**
 * Smart Merge Strategy
 * 
 * Replaces naive Last-Write-Wins with field-level merge logic to preserve
 * the "best" data regardless of timestamp.
 * 
 * Design Decision: Field-level merging instead of document-level LWW
 * Rationale: Prevents data degradation when syncing between devices
 * 
 * Example:
 *   Desktop: High intentScore (0.85), Old timestamp
 *   Mobile:  Low intentScore (0.42), New timestamp
 *   Result:  Keep high intentScore (0.85) even though timestamp is older
 */

import type { PageDigest } from '../types';

/**
 * Merge strategy for each field type
 */
export enum MergeStrategy {
  /** Take maximum value */
  MAX = 'MAX',
  
  /** Take minimum value */
  MIN = 'MIN',
  
  /** Take union of arrays/sets */
  UNION = 'UNION',
  
  /** Take last write wins */
  LWW = 'LWW',
  
  /** Custom merge function */
  CUSTOM = 'CUSTOM',
}

/**
 * Merge two PageDigest objects intelligently
 * 
 * @param local - Local version of the page
 * @param remote - Remote version from another device
 * @returns Merged PageDigest with best data from both sources
 */
export function mergePageDigests(
  local: PageDigest,
  remote: PageDigest
): PageDigest {
  // Sanity check: must be same page
  if (local.pageId !== remote.pageId) {
    throw new Error(
      `Cannot merge different pages: ${local.pageId} vs ${remote.pageId}`
    );
  }
  
  // Field-level merge logic
  return {
    // Required schema fields
    schemaVersion: Math.max(local.schemaVersion, remote.schemaVersion),
    urlHash: local.urlHash,
    domainHash: local.domainHash,
    tsFuzzy: Math.min(local.tsFuzzy, remote.tsFuzzy),
    isSynced: local.isSynced || remote.isSynced,
    isPrivate: local.isPrivate || remote.isPrivate,
    autoExpireAt: Math.max(local.autoExpireAt, remote.autoExpireAt),
    
    // Identity fields (immutable)
    pageId: local.pageId,
    url: local.url,
    domain: local.domain,
    
    // Take the longer/better title
    title: mergeBetterString(local.title, remote.title),
    
    // Take the longer/better summary
    summary: mergeBetterString(local.summary, remote.summary),
    
    // Take maximum intentScore (higher = more relevant)
    intentScore: Math.max(local.intentScore || 0, remote.intentScore || 0),
    
    // Take maximum qualityScore (higher = better content)
    qualityScore: Math.max(local.qualityScore || 0, remote.qualityScore || 0),
    
    // Union of entities (combine unique entities from both)
    entities: mergeArrayUnique(local.entities || [], remote.entities || []),
    
    // Union of keywords
    keywords: mergeArrayUnique(local.keywords || [], remote.keywords || []),
    
    // Take maximum lastAccessed (most recent access time)
    lastAccessed: Math.max(local.lastAccessed || 0, remote.lastAccessed || 0),
    
    // Take minimum timestamp (earliest time page was first seen)
    timestamp: Math.min(local.timestamp, remote.timestamp),
    
    // Vector handling: Prefer local vector for consistency
    // Remote vectors will be used only if local doesn't have one
    vectorBuf: local.vectorBuf || remote.vectorBuf,
    
    // Vector metadata: Take from whichever has the vector
    vectorMetadata: local.vectorBuf ? local.vectorMetadata : remote.vectorMetadata,
    
    // Category: Take the more specific category (longer string = more specific)
    category: mergeBetterString(local.category, remote.category),
    
    // Activity context
    activityContext: mergeActivityContext(local.activityContext, remote.activityContext),
    
    // Sync metadata
    syncMetadata: {
      lastSyncedAt: Date.now(),
      sourceDevices: mergeArrayUnique(
        local.syncMetadata?.sourceDevices || [getDeviceId()],
        remote.syncMetadata?.sourceDevices || [getRemoteDeviceId()]
      ),
      mergeCount: (local.syncMetadata?.mergeCount || 0) + (remote.syncMetadata?.mergeCount || 0) + 1,
    },
  };
}

/**
 * Merge two strings, preferring the longer/more descriptive one
 */
function mergeBetterString(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  
  // Prefer longer, more descriptive string
  return a.length >= b.length ? a : b;
}

/**
 * Merge arrays, keeping unique values
 */
function mergeArrayUnique<T>(a: T[], b: T[]): T[] {
  const set = new Set([...a, ...b]);
  return Array.from(set);
}

/**
 * Merge activity context, preferring richer data
 */
function mergeActivityContext(
  local: any,
  remote: any
): any {
  if (!local) return remote;
  if (!remote) return local;
  
  return {
    sessionId: local.sessionId || remote.sessionId,
    tabId: local.tabId || remote.tabId,
    windowId: local.windowId || remote.windowId,
    referrer: local.referrer || remote.referrer,
    duration: Math.max(local.duration || 0, remote.duration || 0),
  };
}

/**
 * Get device ID for sync metadata
 * TODO: Implement proper device ID generation/storage
 */
function getDeviceId(): string {
  // Temporary placeholder
  return 'local-device';
}

/**
 * Get remote device ID
 * TODO: Get from sync context
 */
function getRemoteDeviceId(): string {
  // Temporary placeholder
  return 'remote-device';
}

/**
 * Merge multiple PageDigests (for batch operations)
 * 
 * @param digests - Array of PageDigests for the same page from different devices
 * @returns Single merged PageDigest with best data from all sources
 */
export function mergeMultipleDigests(digests: PageDigest[]): PageDigest {
  if (digests.length === 0) {
    throw new Error('Cannot merge empty array of digests');
  }
  
  if (digests.length === 1) {
    return digests[0];
  }
  
  // Reduce to single digest
  return digests.reduce((merged, current) => mergePageDigests(merged, current));
}

/**
 * Detect if merge is necessary (have data changed?)
 * 
 * @param local - Local version
 * @param remote - Remote version
 * @returns true if remote has newer/better data
 */
export function shouldMerge(local: PageDigest, remote: PageDigest): boolean {
  // If remote has better intentScore, merge
  if ((remote.intentScore || 0) > (local.intentScore || 0)) {
    return true;
  }
  
  // If remote has more keywords, merge
  if ((remote.keywords?.length || 0) > (local.keywords?.length || 0)) {
    return true;
  }
  
  // If remote has more entities, merge
  if ((remote.entities?.length || 0) > (local.entities?.length || 0)) {
    return true;
  }
  
  // If remote has newer lastAccessed, merge
  if ((remote.lastAccessed || 0) > (local.lastAccessed || 0)) {
    return true;
  }
  
  // If remote has vector but local doesn't, merge
  if (remote.vectorBuf && !local.vectorBuf) {
    return true;
  }
  
  return false;
}

/**
 * Generate merge report for debugging
 */
export function generateMergeReport(
  local: PageDigest,
  remote: PageDigest,
  merged: PageDigest
): string {
  const report: string[] = [];
  
  report.push('='.repeat(60));
  report.push('Smart Merge Report');
  report.push('='.repeat(60));
  report.push(`Page: ${merged.title}`);
  report.push(`URL: ${merged.url}`);
  report.push('');
  
  report.push('Field-level decisions:');
  
  // Intent score
  if (local.intentScore !== remote.intentScore) {
    report.push(
      `  intentScore: ${local.intentScore} vs ${remote.intentScore} → ${merged.intentScore} (MAX)`
    );
  }
  
  // Keywords
  const localKwLen = local.keywords?.length || 0;
  const remoteKwLen = remote.keywords?.length || 0;
  const mergedKwLen = merged.keywords?.length || 0;
  if (localKwLen !== remoteKwLen) {
    report.push(
      `  keywords: ${localKwLen} vs ${remoteKwLen} → ${mergedKwLen} (UNION)`
    );
  }
  
  // Entities
  const localEntLen = local.entities?.length || 0;
  const remoteEntLen = remote.entities?.length || 0;
  const mergedEntLen = merged.entities?.length || 0;
  if (localEntLen !== remoteEntLen) {
    report.push(
      `  entities: ${localEntLen} vs ${remoteEntLen} → ${mergedEntLen} (UNION)`
    );
  }
  
  // Last accessed
  if (local.lastAccessed !== remote.lastAccessed) {
    report.push(
      `  lastAccessed: ${new Date(local.lastAccessed || 0).toISOString()} vs ` +
      `${new Date(remote.lastAccessed || 0).toISOString()} → ` +
      `${new Date(merged.lastAccessed || 0).toISOString()} (MAX)`
    );
  }
  
  report.push('');
  report.push(`Merge count: ${merged.syncMetadata?.mergeCount || 1}`);
  report.push(`Source devices: ${merged.syncMetadata?.sourceDevices?.join(', ') || 'unknown'}`);
  report.push('='.repeat(60));
  
  return report.join('\n');
}

