/**
 * Backend API client with retry logic and error handling
 */

import { API_CONFIG } from './constants';
import type { 
  ApiResponse, 
  DealsResponse,
  PointsBalance,
  RedemptionOption,
  RedemptionRequest
} from './types';

// ============================================================================
// HTTP Client with Retry Logic
// ============================================================================

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  attempts: number = API_CONFIG.RETRY_ATTEMPTS
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
      
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on abort or certain errors
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      // Exponential backoff
      if (i < attempts - 1) {
        const backoffMs = API_CONFIG.RETRY_BACKOFF_MS * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }
  
  throw lastError || new Error('Request failed after retries');
}

// ============================================================================
// API Client
// ============================================================================

export class ApiClient {
  private baseUrl: string;
  private anonymousId: string | null = null;
  
  constructor(baseUrl: string = API_CONFIG.BASE_URL) {
    this.baseUrl = baseUrl;
  }
  
  /**
   * Set anonymous ID for requests
   */
  setAnonymousId(id: string): void {
    this.anonymousId = id;
  }
  
  /**
   * Get headers for API requests
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (this.anonymousId) {
      headers['X-Anonymous-ID'] = this.anonymousId;
    }
    
    return headers;
  }
  
  // ==========================================================================
  // Health Check
  // ==========================================================================
  
  /**
   * Check if backend API is healthy
   * Returns true if backend is reachable, false otherwise
   */
  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for health check
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Consider 200-299 as healthy
      return response.ok;
    } catch (error) {
      console.warn('[ApiClient] Health check failed:', error);
      return false;
    }
  }
  
  // ==========================================================================
  // Deal API (Signal-Based Matching)
  // ==========================================================================
  
  /**
   * Match deals based on user signals
   */
  async matchDeals(signals: any[]): Promise<ApiResponse<any>> {
    try {
      const response = await fetchWithRetry<ApiResponse<any>>(
        `${this.baseUrl}/api/v1/deals/match`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            anonymousId: this.anonymousId || 'unknown',
            signals,
            timestamp: Date.now(),
          }),
        }
      );
      
      return response;
    } catch (error) {
      return {
        success: false,
        error: String(error),
        timestamp: Date.now(),
      };
    }
  }
  
  /**
   * Fetch deals for current page
   */
  async fetchDeals(
    domain: string,
    category: string,
    intentScore: number
  ): Promise<ApiResponse<DealsResponse>> {
    try {
      const params = new URLSearchParams({
        domain,
        category,
        intent_score: intentScore.toString(),
      });
      
      const response = await fetchWithRetry<ApiResponse<DealsResponse>>(
        `${this.baseUrl}/api/v1/deals?${params}`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );
      
      return response;
    } catch (error) {
      return {
        success: false,
        error: String(error),
        timestamp: Date.now(),
      };
    }
  }
  
  /**
   * Record deal click (for attribution)
   */
  async recordDealClick(dealId: string): Promise<ApiResponse<{ shortId: string }>> {
    try {
      const response = await fetchWithRetry<ApiResponse<{ shortId: string }>>(
        `${this.baseUrl}/api/v1/deals/${dealId}/click`,
        {
          method: 'POST',
          headers: this.getHeaders(),
        }
      );
      
      return response;
    } catch (error) {
      return {
        success: false,
        error: String(error),
        timestamp: Date.now(),
      };
    }
  }
  
  // ==========================================================================
  // Points API
  // ==========================================================================
  
  /**
   * Get user's points balance
   */
  async getPointsBalance(): Promise<ApiResponse<PointsBalance>> {
    try {
      const response = await fetchWithRetry<ApiResponse<PointsBalance>>(
        `${this.baseUrl}/api/v1/points/balance`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );
      
      return response;
    } catch (error) {
      return {
        success: false,
        error: String(error),
        timestamp: Date.now(),
      };
    }
  }
  
  // ==========================================================================
  // Redemption API
  // ==========================================================================
  
  /**
   * Get available redemption options
   */
  async getRedemptionOptions(): Promise<ApiResponse<RedemptionOption[]>> {
    try {
      const response = await fetchWithRetry<ApiResponse<RedemptionOption[]>>(
        `${this.baseUrl}/api/v1/redemptions/options`,
        {
          method: 'GET',
          headers: this.getHeaders(),
        }
      );
      
      return response;
    } catch (error) {
      return {
        success: false,
        error: String(error),
        timestamp: Date.now(),
      };
    }
  }
  
  /**
   * Redeem points
   */
  async redeemPoints(request: RedemptionRequest): Promise<ApiResponse<{ redemptionId: string }>> {
    try {
      const response = await fetchWithRetry<ApiResponse<{ redemptionId: string }>>(
        `${this.baseUrl}/api/v1/redemptions/redeem`,
        {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(request),
        }
      );
      
      return response;
    } catch (error) {
      return {
        success: false,
        error: String(error),
        timestamp: Date.now(),
      };
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

