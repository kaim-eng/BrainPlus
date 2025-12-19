/**
 * Handlers for deal-related messages
 */

import { apiClient } from '@/lib/api';
import { setLocal } from '@/lib/storage';
import { STORAGE_KEYS } from '@/lib/constants';

/**
 * Handle FETCH_DEALS request
 */
export async function handleFetchDeals(message: any): Promise<any> {
  console.log('[Deals] Fetching deals');
  
  try {
    const { domain, category, intentScore } = message;
    
    const response = await apiClient.fetchDeals(domain, category, intentScore);
    
    if (response.success && response.data) {
      // Cache deals
      await setLocal(STORAGE_KEYS.DEALS_CACHE, {
        deals: response.data.deals,
        timestamp: Date.now(),
      });
      
      return {
        success: true,
        deals: response.data.deals,
      };
    }
    
    return {
      success: false,
      error: response.error || 'Failed to fetch deals',
    };
  } catch (error) {
    console.error('[Deals] Error:', error);
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Handle DEAL_CLICK event
 */
export async function handleDealClick(message: any): Promise<any> {
  console.log('[Deals] Deal clicked:', message.dealId);
  
  try {
    const { dealId } = message;
    
    // Record click with backend (gets server-side attribution URL)
    const response = await apiClient.recordDealClick(dealId);
    
    if (response.success && response.data) {
      // Open redirect URL in new tab
      const redirectUrl = `${apiClient['baseUrl']}/r/${response.data.shortId}`;
      await chrome.tabs.create({ url: redirectUrl });
      
      return { success: true };
    }
    
    return {
      success: false,
      error: response.error || 'Failed to record click',
    };
  } catch (error) {
    console.error('[Deals] Error:', error);
    return {
      success: false,
      error: String(error),
    };
  }
}

