/**
 * Handlers for points and redemption
 */

import { apiClient } from '@/lib/api';
import { getLocal, setLocal } from '@/lib/storage';
import { STORAGE_KEYS } from '@/lib/constants';

/**
 * Handle GET_POINTS request
 */
export async function handleGetPoints(): Promise<any> {
  console.log('[Points] Getting balance');
  
  try {
    // Set anonymous ID for API client
    const anonymousId = await getLocal<string>(STORAGE_KEYS.ANONYMOUS_ID);
    if (!anonymousId) {
      console.warn('[Points] No anonymous ID yet');
      return {
        success: false,
        error: 'Not initialized yet',
      };
    }
    
    apiClient.setAnonymousId(anonymousId);
    const response = await apiClient.getPointsBalance();
    
    if (response.success && response.data) {
      // Cache points
      await setLocal(STORAGE_KEYS.POINTS_CACHE, {
        balance: response.data,
        timestamp: Date.now(),
      });
      
      return {
        success: true,
        balance: response.data,
      };
    }
    
    return {
      success: false,
      error: response.error || 'Failed to get points',
    };
  } catch (error) {
    console.error('[Points] Error:', error);
    
    // Try to return cached balance
    const cached = await getLocal<{ balance: any; timestamp: number }>(STORAGE_KEYS.POINTS_CACHE);
    if (cached) {
      return {
        success: true,
        balance: cached.balance,
        cached: true,
      };
    }
    
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Handle REDEEM_POINTS request
 */
export async function handleRedeemPoints(message: any): Promise<any> {
  console.log('[Points] Redeeming points:', message.request);
  
  try {
    // Set anonymous ID for API client
    const anonymousId = await getLocal<string>(STORAGE_KEYS.ANONYMOUS_ID);
    if (anonymousId) {
      apiClient.setAnonymousId(anonymousId);
    }
    
    const { request } = message;
    
    const response = await apiClient.redeemPoints(request);
    
    if (response.success && response.data) {
      // Invalidate cached points (will be refreshed)
      await setLocal(STORAGE_KEYS.POINTS_CACHE, null);
      
      return {
        success: true,
        redemptionId: response.data.redemptionId,
      };
    }
    
    return {
      success: false,
      error: response.error || 'Redemption failed',
    };
  } catch (error) {
    console.error('[Points] Error:', error);
    return {
      success: false,
      error: String(error),
    };
  }
}

