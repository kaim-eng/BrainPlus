/**
 * Application-wide constants
 */

// Re-export STORAGE_KEYS from types
export { STORAGE_KEYS } from './types';

// ============================================================================
// API Configuration
// ============================================================================

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'https://api.datapay.io',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_BACKOFF_MS: 1000, // Exponential backoff base
} as const;

// ============================================================================
// Storage Configuration (Brave-Compatible)
// ============================================================================

export const STORAGE_CONFIG = {
  MAX_QUEUE_SIZE_MB: 10, // 10MB max (no unlimitedStorage permission)
  MAX_QUEUE_EVENTS: 1000, // Maximum events before eviction
  BATCH_SIZE: 50, // Events per upload batch
  UPLOAD_INTERVAL_MINUTES: 15, // chrome.alarms interval
  SYNC_INTERVAL_MINUTES: 60, // Sync points/deals
} as const;

// ============================================================================
// Privacy Configuration
// ============================================================================

export const PRIVACY_DEFAULTS = {
  DAILY_EPSILON: 10.0,
  EPSILON_PER_EVENT: 0.1,
  K_ANONYMITY_THRESHOLD: 5, // Minimum k=5 (7 for Brave-specific cohorts)
  K_ANONYMITY_BRAVE: 7, // Higher threshold for Brave users
  TIMESTAMP_GRANULARITY_MS: 3600000, // 1 hour
  SUPPRESS_RARE_CATEGORIES: true,
} as const;

// ============================================================================
// Intent Scoring Thresholds
// ============================================================================

export const INTENT_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.4,
  LOW: 0.0,
} as const;

// ============================================================================
// Points System
// ============================================================================

export const POINTS_CONFIG = {
  MIN_REDEMPTION: 1000, // Minimum points to redeem
  POINTS_PER_DOLLAR: 100, // Conversion rate
  AFFILIATE_COMMISSION_PERCENT: 5, // Example rate
} as const;

// ============================================================================
// Known E-commerce Domains (for heuristic scoring)
// ============================================================================

export const ECOMMERCE_DOMAINS = [
  'amazon.com',
  'amazon.co.uk',
  'ebay.com',
  'walmart.com',
  'target.com',
  'bestbuy.com',
  'etsy.com',
  'shopify.com',
  'alibaba.com',
  'aliexpress.com',
  'wayfair.com',
  'overstock.com',
  'newegg.com',
  'zappos.com',
  'nordstrom.com',
  'macys.com',
  'homedepot.com',
  'lowes.com',
  'costco.com',
  'samsclub.com',
] as const;

// ============================================================================
// Shopping Keywords (for heuristic scoring)
// ============================================================================

export const SHOPPING_KEYWORDS = {
  HIGH_INTENT: [
    'add to cart',
    'add to bag',
    'buy now',
    'checkout',
    'proceed to checkout',
    'place order',
    'purchase',
    'pay now',
  ],
  MEDIUM_INTENT: [
    'deal',
    'discount',
    'sale',
    'offer',
    'promo',
    'coupon',
    'save',
    'clearance',
    'free shipping',
  ],
  PRODUCT_PAGE: [
    'product',
    'item',
    '/p/',
    '/dp/',
    '/product/',
    '/item/',
  ],
} as const;

// ============================================================================
// Price Detection Patterns
// ============================================================================

export const PRICE_PATTERNS = [
  // US Dollar
  /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,
  // Euro
  /€\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,
  // British Pound
  /£\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,
  // Japanese Yen
  /¥\s*(\d{1,3}(?:,\d{3})*)/,
  // Generic with currency code
  /(?:USD|EUR|GBP|CAD)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/,
] as const;

// ============================================================================
// Category Generalization Map
// ============================================================================

export const CATEGORY_MAP: Record<string, string> = {
  // Electronics
  'smartphones': 'electronics',
  'laptops': 'electronics',
  'tablets': 'electronics',
  'televisions': 'electronics',
  'cameras': 'electronics',
  'headphones': 'electronics',
  
  // Clothing
  'mens-clothing': 'apparel',
  'womens-clothing': 'apparel',
  'shoes': 'apparel',
  'accessories': 'apparel',
  
  // Home
  'furniture': 'home',
  'kitchen': 'home',
  'bedding': 'home',
  'decor': 'home',
  
  // Beauty
  'makeup': 'beauty',
  'skincare': 'beauty',
  'haircare': 'beauty',
  
  // Books & Media
  'books': 'media',
  'movies': 'media',
  'music': 'media',
  'games': 'media',
  
  // Sports
  'fitness': 'sports',
  'outdoor': 'sports',
  'athletic': 'sports',
  
  // Default
  'other': 'general',
};

// ============================================================================
// Privacy: Denylisted Domains (Never Scrape)
// ============================================================================

/**
 * Domains that should NEVER be scraped for privacy/security reasons
 * Includes: banking, healthcare, email, government, legal, dating, etc.
 * 
 * Design Doc Reference: AMA_DESIGN_REVIEW.md, Phase 0 Day 1
 * Priority: P0 - Critical (must be enforced FIRST in scraper)
 */
export const DENYLIST_DOMAINS = [
  // Banking & Financial Services (20)
  'chase.com',
  'bankofamerica.com',
  'wellsfargo.com',
  'citibank.com',
  'capitalone.com',
  'usbank.com',
  'ally.com',
  'schwab.com',
  'fidelity.com',
  'vanguard.com',
  'etrade.com',
  'paypal.com',
  'venmo.com',
  'cashapp.com',
  'stripe.com',
  'plaid.com',
  'mint.com',
  'creditkarma.com',
  'nerdwallet.com',
  'turbotax.com',
  
  // Healthcare & Medical (10)
  'myhealth.va.gov',
  'myhealthevet.va.gov',
  'healthcare.gov',
  'cvs.com',
  'walgreens.com',
  'optum.com',
  'anthem.com',
  'unitedhealthcare.com',
  'aetna.com',
  'bluecrossma.com',
  
  // Email & Messaging (10)
  'gmail.com',
  'mail.google.com',
  'outlook.com',
  'mail.yahoo.com',
  'protonmail.com',
  'mail.com',
  'icloud.com',
  'slack.com',
  'teams.microsoft.com',
  'discord.com',
  
  // Government & Legal (10)
  'irs.gov',
  'ssa.gov',
  'usps.com',
  'dmv.org',
  'usa.gov',
  'state.gov',
  'fbi.gov',
  'dhs.gov',
  'medicare.gov',
  'benefits.gov',
  
  // Dating & Personal (5)
  'tinder.com',
  'bumble.com',
  'match.com',
  'okcupid.com',
  'hinge.co',
  
  // Education & Testing (5)
  'collegeboard.org',
  'act.org',
  'khanacademy.org',
  'canvas.instructure.com',
  'blackboard.com',
  
  // Security & Auth (5)
  'lastpass.com',
  '1password.com',
  'dashlane.com',
  'bitwarden.com',
  'authy.com',
  
  // Private Cloud Storage (5)
  'dropbox.com',
  'onedrive.live.com',
  'drive.google.com',
  'box.com',
  'sync.com',
  
  // HR & Payroll (5)
  'adp.com',
  'paychex.com',
  'gusto.com',
  'workday.com',
  'bamboohr.com',
] as const;

// ============================================================================
// Denylist Helper Functions
// ============================================================================

/**
 * Check if a domain is in the denylist
 * @param domain - Domain to check (e.g., "mail.google.com" or "google.com")
 * @returns true if domain is denylisted (should not be scraped)
 * 
 * Examples:
 * - isDenylistedDomain("mail.google.com") → true (matches "mail.google.com")
 * - isDenylistedDomain("chase.com") → true (matches "chase.com")
 * - isDenylistedDomain("www.chase.com") → true (matches "chase.com")
 * - isDenylistedDomain("subdomain.bankofamerica.com") → true (matches "bankofamerica.com")
 */
export function isDenylistedDomain(domain: string): boolean {
  if (!domain) return false;
  
  // Remove www. prefix for matching
  const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
  
  // Check exact match or subdomain match
  return DENYLIST_DOMAINS.some(denylistedDomain => {
    // Exact match: "chase.com" === "chase.com"
    if (normalizedDomain === denylistedDomain) return true;
    
    // Subdomain match: "login.chase.com" ends with ".chase.com"
    if (normalizedDomain.endsWith(`.${denylistedDomain}`)) return true;
    
    return false;
  });
}

// ============================================================================
// Brave Browser Detection
// ============================================================================

export const isBraveBrowser = (): boolean => {
  // Guard against service worker context where navigator might not be fully available
  if (typeof navigator === 'undefined') {
    return false;
  }
  
  // @ts-expect-error Brave-specific API
  return navigator.brave !== undefined && typeof navigator.brave.isBrave === 'function';
};

// ============================================================================
// Error Messages
// ============================================================================

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  API_ERROR: 'Unable to reach server. Please try again.',
  STORAGE_FULL: 'Local storage is full. Data will be uploaded soon.',
  PRIVACY_BUDGET_EXCEEDED: 'Daily privacy budget exceeded. Tracking paused until tomorrow.',
  INSUFFICIENT_POINTS: 'Insufficient points for redemption.',
  REDEMPTION_FAILED: 'Redemption failed. Please try again or contact support.',
} as const;

