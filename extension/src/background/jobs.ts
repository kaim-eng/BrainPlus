/**
 * Periodic jobs for syncing
 */

import { apiClient } from '@/lib/api';
import { getLocal, setLocal } from '@/lib/storage';
import { STORAGE_KEYS } from '@/lib/constants';

/**
 * Sync deals from backend
 */
export async function syncDealsJob(): Promise<void> {
  console.log('[Jobs] Syncing deals');
  
  try {
    // TODO: Implement deal syncing
    // For now, deals are fetched on-demand when high intent detected
    
    console.log('[Jobs] Deal sync complete');
  } catch (error) {
    console.error('[Jobs] Deal sync error:', error);
  }
}

/**
 * Sync points balance from backend
 */
export async function syncPointsJob(): Promise<void> {
  console.log('[Jobs] Syncing points');
  
  try {
    // Set anonymous ID for API client
    const anonymousId = await getLocal<string>(STORAGE_KEYS.ANONYMOUS_ID);
    if (!anonymousId) {
      console.warn('[Jobs] No anonymous ID yet, skipping points sync');
      return;
    }
    
    apiClient.setAnonymousId(anonymousId);
    const response = await apiClient.getPointsBalance();
    
    if (response.success && response.data) {
      await setLocal(STORAGE_KEYS.POINTS_CACHE, {
        balance: response.data,
        timestamp: Date.now(),
      });
      console.log('[Jobs] Points synced:', response.data.total);
    } else {
      console.error('[Jobs] Points sync failed:', response.error);
    }
  } catch (error) {
    console.error('[Jobs] Points sync error:', error);
  }
}

