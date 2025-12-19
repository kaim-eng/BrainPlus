/**
 * Content Script
 * Extracts features + text content for "Second Brain" indexing
 * ⚠️ SHIELDS-AWARE: No external network calls, pure DOM scraping only
 */

import { extractPageFeatures } from './scraper';
import { isDenylistedDomain } from '@/lib/constants';
import type { AnalyzePageMessage } from '@/lib/types';

// ============================================================================
// Privacy Check
// ============================================================================

/**
 * Check if we should skip indexing (incognito/private/denylisted)
 * 
 * Design Doc: AMA_DESIGN_REVIEW.md, Phase 0 Day 1
 * Priority: P0 - CRITICAL (denylist must be FIRST check)
 */
function shouldSkipIndexing(): boolean {
  // ⚠️ FIRST CHECK: Denylist enforcement (P0 - Critical)
  // Never scrape banking, healthcare, email, government, etc.
  try {
    const url = new URL(window.location.href);
    const domain = url.hostname.toLowerCase().replace(/^www\./, '');
    
    if (isDenylistedDomain(domain)) {
      console.log('[Content] Denylisted domain detected, skipping indexing:', domain);
      return true;
    }
  } catch (error) {
    console.error('[Content] Error checking denylist:', error);
    // If URL parsing fails, skip indexing to be safe
    return true;
  }
  
  // Check incognito mode
  if (chrome.extension?.inIncognitoContext) {
    console.log('[Content] Private window detected, skipping indexing');
    return true;
  }

  return false;
}

// ============================================================================
// Text Extraction
// ============================================================================

/**
 * Extract visible text from page (for embedding)
 */
function extractPageText(): string {
  // Get main content (prioritize article, main, body)
  const mainElement = 
    document.querySelector('article') ||
    document.querySelector('main') ||
    document.querySelector('[role="main"]') ||
    document.body;

  if (!mainElement) {
    return '';
  }

  // Get visible text, remove scripts/styles
  const clone = mainElement.cloneNode(true) as HTMLElement;
  
  // Remove unwanted elements
  const unwanted = clone.querySelectorAll('script, style, noscript, iframe, nav, footer, header, aside');
  unwanted.forEach(el => el.remove());

  // Get text content
  let text = clone.textContent || '';
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  // Limit to reasonable size (max ~10K words for embedding)
  const words = text.split(/\s+/);
  if (words.length > 10000) {
    text = words.slice(0, 10000).join(' ');
  }

  return text;
}

// ============================================================================
// Page Analysis
// ============================================================================

/**
 * Analyze current page and send to background
 */
async function analyzePage(): Promise<void> {
  try {
    // Privacy check
    if (shouldSkipIndexing()) {
      return;
    }

    // Extract features from DOM
    const features = extractPageFeatures();
    
    // Extract text content
    const text = extractPageText();
    
    // Send to background for inference
    const message: AnalyzePageMessage = {
      type: 'ANALYZE_PAGE',
      features,
      url: window.location.href,
      tabId: 0, // Will be set by background
      timestamp: Date.now(),
    };
    
    // Add text content
    (message as any).text = text;
    (message as any).title = document.title;
    
    chrome.runtime.sendMessage(message);
    
    console.log(`[Content] Page analyzed (${text.split(/\s+/).length} words):`, document.title.slice(0, 50));
  } catch (error) {
    console.error('[Content] Error analyzing page:', error);
  }
}

// ============================================================================
// Initialization
// ============================================================================

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(analyzePage, 1000); // Delay to let dynamic content load
  });
} else {
  setTimeout(analyzePage, 1000);
}

// Listen for dynamic page changes (SPAs)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    setTimeout(analyzePage, 2000); // Delay for new content
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

console.log('[Content] Content script initialized');

