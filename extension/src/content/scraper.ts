/**
 * DOM feature extraction for intent scoring
 * ⚠️ SHIELDS-AWARE: Pure on-page scraping, no external calls
 */

import type { PageFeatures } from '@/lib/types';
import { ECOMMERCE_DOMAINS, SHOPPING_KEYWORDS, PRICE_PATTERNS } from '@/lib/constants';

// ============================================================================
// Text Extraction for Semantic Search
// ============================================================================

/**
 * Truncate text to approximate token count
 * Rough approximation: 1 token ≈ 4 characters
 */
export function truncateToTokens(text: string, maxTokens: number = 512): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  
  // Truncate at word boundary
  const truncated = text.slice(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
}

/**
 * Extract main text content for embedding
 * Combines title, meta description, and main headings
 */
export function extractEmbeddingText(): string {
  const title = document.title || '';
  const description = getMetaContent('description') || '';
  
  // Extract H1 and H2 headings
  const h1Elements = Array.from(document.querySelectorAll('h1'));
  const h2Elements = Array.from(document.querySelectorAll('h2'));
  const headings = [...h1Elements, ...h2Elements]
    .map(h => h.textContent?.trim())
    .filter(Boolean)
    .slice(0, 5) // Max 5 headings
    .join('. ');
  
  // Combine and truncate
  const combined = `${title}. ${description}. ${headings}`;
  return truncateToTokens(combined, 512);
}

/**
 * Extract full page text (optional, for hybrid search)
 */
export function extractFullText(): string {
  // Get main content, avoiding nav/footer/ads
  const mainSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.main-content',
    '#main-content',
    '#content',
  ];
  
  let mainContent: Element | null = null;
  for (const selector of mainSelectors) {
    mainContent = document.querySelector(selector);
    if (mainContent) break;
  }
  
  // Fall back to body if no main content found
  const source = mainContent || document.body;
  
  // Extract text, filtering out nav/footer/script
  const text = source.textContent || '';
  
  // Clean up whitespace
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 10000); // Max 10k chars
}

/**
 * Extract all features from current page
 */
export function extractPageFeatures(): PageFeatures {
  const domain = extractDomain();
  
  return {
    // Meta information
    title: document.title || '',
    description: getMetaContent('description'),
    keywords: getMetaContent('keywords')?.split(',').map(k => k.trim()),
    ogType: getMetaContent('og:type'),
    
    // Commerce signals
    hasPrice: detectPrice().found,
    priceValue: detectPrice().value,
    currency: detectPrice().currency,
    
    // Shopping indicators
    hasCartButton: hasShoppingButton('cart'),
    hasBuyNow: hasShoppingButton('buy'),
    hasCheckout: hasShoppingButton('checkout'),
    hasProductSchema: hasProductStructuredData(),
    
    // Page structure
    hasSizeSelector: hasSizeOrQuantity('size'),
    hasQuantitySelector: hasSizeOrQuantity('quantity'),
    hasReviews: hasReviewElements(),
    
    // URL patterns
    urlPatterns: {
      isProduct: isProductPage(),
      isCategory: isCategoryPage(),
      isCheckout: isCheckoutPage(),
    },
    
    // Domain info
    domain,
    isKnownEcommerce: isKnownEcommerceDomain(domain),
  };
}

// ============================================================================
// Meta Tag Extraction
// ============================================================================

function getMetaContent(name: string): string | undefined {
  // Try name attribute
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (meta) return meta.getAttribute('content') || undefined;
  
  // Try property attribute (Open Graph)
  meta = document.querySelector(`meta[property="${name}"]`);
  if (meta) return meta.getAttribute('content') || undefined;
  
  return undefined;
}

// ============================================================================
// Domain Extraction
// ============================================================================

function extractDomain(): string {
  try {
    const url = new URL(window.location.href);
    return url.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function isKnownEcommerceDomain(domain: string): boolean {
  return ECOMMERCE_DOMAINS.some(ecom => 
    domain.includes(ecom) || ecom.includes(domain)
  );
}

// ============================================================================
// Price Detection
// ============================================================================

interface PriceDetection {
  found: boolean;
  value?: number;
  currency?: string;
}

function detectPrice(): PriceDetection {
  const bodyText = document.body.innerText;
  
  for (const pattern of PRICE_PATTERNS) {
    const match = bodyText.match(pattern);
    if (match && match[1]) {
      const priceString = match[1].replace(/,/g, '');
      const value = parseFloat(priceString);
      
      if (!isNaN(value) && value > 0) {
        // Detect currency from pattern
        let currency = 'USD'; // Default
        if (match[0].includes('€')) currency = 'EUR';
        else if (match[0].includes('£')) currency = 'GBP';
        else if (match[0].includes('¥')) currency = 'JPY';
        
        return { found: true, value, currency };
      }
    }
  }
  
  return { found: false };
}

// ============================================================================
// Shopping Button Detection
// ============================================================================

function hasShoppingButton(type: 'cart' | 'buy' | 'checkout'): boolean {
  const keywords = type === 'cart' 
    ? ['add to cart', 'add to bag', 'cart']
    : type === 'buy'
    ? ['buy now', 'purchase', 'buy']
    : ['checkout', 'proceed to checkout', 'place order'];
  
  // Check buttons
  const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));
  
  for (const button of buttons) {
    const text = button.textContent?.toLowerCase() || '';
    const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
    
    if (keywords.some(kw => text.includes(kw) || ariaLabel.includes(kw))) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// Structured Data Detection
// ============================================================================

function hasProductStructuredData(): boolean {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent || '{}');
      if (data['@type'] === 'Product' || data['@type']?.includes('Product')) {
        return true;
      }
    } catch {
      // Ignore parse errors
    }
  }
  
  return false;
}

// ============================================================================
// Form Element Detection
// ============================================================================

function hasSizeOrQuantity(type: 'size' | 'quantity'): boolean {
  const selectors = type === 'size'
    ? ['select[name*="size"]', 'select[id*="size"]', '[class*="size-selector"]']
    : ['select[name*="quantity"]', 'select[id*="quantity"]', 'input[type="number"][name*="qty"]'];
  
  return selectors.some(selector => document.querySelector(selector) !== null);
}

function hasReviewElements(): boolean {
  const selectors = [
    '[class*="review"]',
    '[class*="rating"]',
    '[data-review]',
    '[itemprop="review"]',
    '[itemprop="aggregateRating"]',
  ];
  
  return selectors.some(selector => document.querySelector(selector) !== null);
}

// ============================================================================
// URL Pattern Detection
// ============================================================================

function isProductPage(): boolean {
  const path = window.location.pathname.toLowerCase();
  return SHOPPING_KEYWORDS.PRODUCT_PAGE.some(pattern => path.includes(pattern));
}

function isCategoryPage(): boolean {
  const path = window.location.pathname.toLowerCase();
  return path.includes('category') || path.includes('collection') || path.includes('shop');
}

function isCheckoutPage(): boolean {
  const path = window.location.pathname.toLowerCase();
  return path.includes('checkout') || path.includes('cart') || path.includes('basket');
}

