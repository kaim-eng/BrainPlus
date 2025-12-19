/**
 * Storage abstraction layer for chrome.storage.local and chrome.storage.sync
 * Implements persistent storage with encryption and rolling buffer
 */

// ============================================================================
// Storage Helpers
// ============================================================================

/**
 * Get item from chrome.storage.local
 */
export async function getLocal<T>(key: string): Promise<T | null> {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? null;
}

/**
 * Set item in chrome.storage.local
 */
export async function setLocal<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

/**
 * Remove item from chrome.storage.local
 */
export async function removeLocal(key: string): Promise<void> {
  await chrome.storage.local.remove(key);
}

/**
 * Get item from chrome.storage.sync
 */
export async function getSync<T>(key: string): Promise<T | null> {
  const result = await chrome.storage.sync.get(key);
  return result[key] ?? null;
}

/**
 * Set item in chrome.storage.sync
 */
export async function setSync<T>(key: string, value: T): Promise<void> {
  await chrome.storage.sync.set({ [key]: value });
}

// ============================================================================
// REMOVED in v0.2: Event Queue Management
// ============================================================================
// Event queue logic removed - v0.2 uses IndexedDB for page storage
// No longer queuing events for batch upload to backend

// ============================================================================
// Storage Migration (for schema updates)
// ============================================================================

export interface MigrationResult {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  errors?: string[];
}

/**
 * Migrate storage schema to new version
 */
export async function migrateStorage(
  currentVersion: number,
  targetVersion: number
): Promise<MigrationResult> {
  const errors: string[] = [];
  
  try {
    // Add migration logic as needed
    // Example: if (currentVersion < 2) { /* migrate v1 → v2 */ }
    
    return {
      success: true,
      fromVersion: currentVersion,
      toVersion: targetVersion,
    };
  } catch (error) {
    errors.push(String(error));
    return {
      success: false,
      fromVersion: currentVersion,
      toVersion: targetVersion,
      errors,
    };
  }
}

// ============================================================================
// Storage Stats (for debugging)
// ============================================================================

export interface StorageStats {
  totalItems: number;
  estimatedTotalBytes: number;
}

/**
 * Get storage statistics (v0.2: simplified, no queue)
 */
export async function getStorageStats(): Promise<StorageStats> {
  // Get all storage items
  const allItems = await chrome.storage.local.get(null);
  const totalItems = Object.keys(allItems).length;
  
  // Estimate total size
  const serialized = JSON.stringify(allItems);
  const estimatedTotalBytes = new Blob([serialized]).size;
  
  return {
    totalItems,
    estimatedTotalBytes,
  };
}

