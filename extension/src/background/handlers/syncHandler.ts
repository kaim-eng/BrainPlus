/**
 * Cross-Device Sync Handler
 * 
 * Handles sync-related messages from popup UI.
 */

import { getSyncManager } from '@/lib/sync/SyncManager';
import { checkNativeHostAvailability } from '@/lib/sync/nativeHost';
import type { SyncProgress } from '@/lib/sync/types';

/**
 * Check if native host is available
 */
export async function handleCheckNativeHost(): Promise<{
  available: boolean;
  version?: string;
  features?: string[];
  error?: string;
}> {
  try {
    return await checkNativeHostAvailability();
  } catch (error) {
    console.error('Failed to check native host availability:', error);
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Initiate pairing (desktop generates QR code)
 */
export async function handleInitiatePairing(): Promise<{
  success: boolean;
  qrCodeDataUrl?: string;
  roomId?: string;
  expiresAt?: number;
  error?: string;
}> {
  try {
    const syncManager = getSyncManager();
    
    const result = await syncManager.initiatePairing();
    
    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error('Failed to initiate pairing:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle device paired (mobile scanned QR)
 */
export async function handleDevicePaired(data: {
  publicKey: string;
  deviceInfo: any;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const syncManager = getSyncManager();
    
    await syncManager.handleDevicePaired(data.publicKey, data.deviceInfo);
    
    return {
      success: true,
    };
  } catch (error) {
    console.error('Failed to handle device paired:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Cancel sync
 */
export async function handleCancelSync(): Promise<{
  success: boolean;
}> {
  try {
    const syncManager = getSyncManager();
    syncManager.cancelSync();
    
    return {
      success: true,
    };
  } catch (error) {
    console.error('Failed to cancel sync:', error);
    return {
      success: false,
    };
  }
}

/**
 * Get sync status
 */
export async function handleGetSyncStatus(): Promise<{
  success: boolean;
  session?: any;
  error?: string;
}> {
  try {
    const syncManager = getSyncManager();
    const session = syncManager.getSession();
    
    return {
      success: true,
      session,
    };
  } catch (error) {
    console.error('Failed to get sync status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Register progress callback for sync
 * This is called from popup to listen for sync progress updates
 */
export function registerSyncProgressCallback(
  callback: (progress: SyncProgress) => void
): void {
  const syncManager = getSyncManager();
  syncManager.onProgress(callback);
}

