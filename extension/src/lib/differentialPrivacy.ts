/**
 * Privacy Utilities (v0.2)
 * REMOVED: Noise injection (not needed for local storage)
 * KEPT: Privacy budget tracking, k-anonymity, PII detection
 */

import { PRIVACY_DEFAULTS } from './constants';
import { isBraveBrowser } from './constants';

// ============================================================================
// REMOVED in v0.2: Laplace Noise Generator
// ============================================================================
// Noise injection removed - v0.2 achieves privacy through:
// 1. Local storage (data never leaves device)
// 2. Aggregation (only keywords sent, not raw data)
// 3. User control (manual signal sending)

// ============================================================================
// Privacy Budget Tracking
// ============================================================================

export interface PrivacyBudget {
  dailyEpsilon: number;
  consumed: number;
  remaining: number;
  lastReset: number;
}

/**
 * Check and update privacy budget
 * @param currentBudget - Current budget state
 * @param epsilonCost - Epsilon to consume
 * @returns Updated budget or null if exceeded
 */
export function consumePrivacyBudget(
  currentBudget: PrivacyBudget,
  epsilonCost: number
): PrivacyBudget | null {
  // Check if we need to reset (new day)
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  const shouldReset = now - currentBudget.lastReset > dayInMs;
  
  if (shouldReset) {
    currentBudget = {
      dailyEpsilon: currentBudget.dailyEpsilon,
      consumed: 0,
      remaining: currentBudget.dailyEpsilon,
      lastReset: now,
    };
  }
  
  // Check if we have enough budget
  if (currentBudget.remaining < epsilonCost) {
    return null; // Budget exceeded
  }
  
  // Consume budget
  return {
    ...currentBudget,
    consumed: currentBudget.consumed + epsilonCost,
    remaining: currentBudget.remaining - epsilonCost,
  };
}

/**
 * Initialize privacy budget
 */
export function initPrivacyBudget(): PrivacyBudget {
  return {
    dailyEpsilon: PRIVACY_DEFAULTS.DAILY_EPSILON,
    consumed: 0,
    remaining: PRIVACY_DEFAULTS.DAILY_EPSILON,
    lastReset: Date.now(),
  };
}

// ============================================================================
// URL Sanitization (KEPT for local storage)
// ============================================================================

/**
 * Sanitize URL by removing tracking parameters
 * @param url - Original URL
 * @returns Sanitized URL (used for URL hashing before IndexedDB storage)
 */
export function sanitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Remove tracking parameters
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'fbclid', 'gclid', 'msclkid', 'mc_eid', 'mc_cid',
      '_ga', '_gl', 'ref', 'source',
    ];
    
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // Remove hash
    urlObj.hash = '';
    
    return urlObj.origin + urlObj.pathname;
  } catch {
    return url; // Return as-is if parsing fails
  }
}

// ============================================================================
// REMOVED in v0.2: Domain hashing for backend upload
// ============================================================================
// hashDomain() removed - not needed since URLs stay local
// generalizeDomain() removed - not needed for local storage
// fuzzTimestamp() removed - exact timestamps OK for local storage

// ============================================================================
// Category Generalization
// ============================================================================

import { CATEGORY_MAP } from './constants';

/**
 * Generalize specific category to broader category
 * @param specificCategory - Specific category
 * @returns General category
 */
export function generalizeCategory(specificCategory: string): string {
  return CATEGORY_MAP[specificCategory.toLowerCase()] || 'general';
}

// ============================================================================
// k-Anonymity Checking
// ============================================================================

/**
 * Check if cohort meets k-anonymity threshold
 * @param cohortSize - Number of users in cohort
 * @returns True if meets threshold
 */
export function meetsKAnonymity(cohortSize: number): boolean {
  const isBrave = isBraveBrowser();
  const threshold = isBrave 
    ? PRIVACY_DEFAULTS.K_ANONYMITY_BRAVE 
    : PRIVACY_DEFAULTS.K_ANONYMITY_THRESHOLD;
  
  return cohortSize >= threshold;
}

/**
 * Suppress category if it's too rare (k-anonymity)
 * @param category - Category to check
 * @param categoryCounts - Map of category → count
 * @returns Category or 'suppressed'
 */
export function suppressRareCategory(
  category: string,
  categoryCounts: Map<string, number>
): string {
  const count = categoryCounts.get(category) || 0;
  
  if (!meetsKAnonymity(count)) {
    return 'suppressed';
  }
  
  return category;
}

// ============================================================================
// PII Detection and Removal
// ============================================================================

const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(\+\d{1,3}[- ]?)?\d{3}[- ]?\d{3}[- ]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
};

/**
 * Detect if text contains PII
 * @param text - Text to check
 * @returns True if PII detected
 */
export function containsPII(text: string): boolean {
  return Object.values(PII_PATTERNS).some(pattern => pattern.test(text));
}

/**
 * Remove PII from text
 * @param text - Original text
 * @returns Sanitized text
 */
export function removePII(text: string): string {
  let sanitized = text;
  
  Object.entries(PII_PATTERNS).forEach(([type, pattern]) => {
    sanitized = sanitized.replace(pattern, `[${type.toUpperCase()}_REDACTED]`);
  });
  
  return sanitized;
}

// ============================================================================
// REMOVED in v0.2: Complete Anonymization Pipeline
// ============================================================================
// anonymizeEvent() removed - v0.2 doesn't upload page data to backend
// Privacy achieved through local storage + aggregated signals

