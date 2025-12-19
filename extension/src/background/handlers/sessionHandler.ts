/**
 * Task Session Detection & Management
 * Detects when to offer session resumption
 * 
 * Includes CRITICAL FIXES:
 * - #2: Legacy data handling (graceful degradation)
 * - #3: Idle debouncing (30min cooldown)
 */

import { db } from '@/lib/db';
import { getLocal, setLocal } from '@/lib/storage';
import type { TaskSession } from '@/lib/sessionizer';
import type { PageDigest } from '@/lib/types';
import { ensureOffscreenDocument } from '../offscreenManager';

const STORAGE_KEY_PENDING = 'pendingSession';
const STORAGE_KEY_DISMISSED = 'dismissedSessionIds';
const STORAGE_KEY_LAST_CHECK = 'lastSessionCheckTimestamp';
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_FRESHNESS_HOURS = 12;
const MAX_TABS = 20; // Hard cap for safety

export interface PendingSession {
  session: TaskSession;
  detectedAt: number;
}

export interface ResumeResult {
  success: boolean;
  openedCount: number;
  skippedCount: number;
  message?: string;
}

/**
 * Check for resumable sessions on idle state change
 * CRITICAL FIX #3: Added 30-minute cooldown to prevent spam
 */
export async function checkForResumableSessions(): Promise<void> {
  console.log('[SessionHandler] Idle state changed to active');
  
  // CRITICAL: Check cooldown to prevent spam
  const lastCheck = await getLocal<number>(STORAGE_KEY_LAST_CHECK);
  if (lastCheck && (Date.now() - lastCheck < COOLDOWN_MS)) {
    const minutesRemaining = Math.ceil((COOLDOWN_MS - (Date.now() - lastCheck)) / 60000);
    console.log(`[SessionHandler] Cooldown active (${minutesRemaining}m remaining), skipping check`);
    return;
  }
  
  // Update last check timestamp FIRST (prevent race conditions)
  await setLocal(STORAGE_KEY_LAST_CHECK, Date.now());
  
  try {
    console.log('[SessionHandler] Checking for resumable sessions');
    
    // Get last 50 pages (non-private, with vectors)
    console.log('[SessionHandler] Fetching pages from IndexedDB...');
    const allPages = await db.getAll();
    console.log('[SessionHandler] Fetched', allPages.length, 'pages');
    
    const recentPages = allPages
      .filter(p => !p.isPrivate)
      .filter(p => p.vector) // CRITICAL FIX #6: Skip pages without vectors
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50);
    
    console.log('[SessionHandler] Filtered to', recentPages.length, 'valid pages (non-private, with vectors)');
    
    if (recentPages.length < 3) {
      console.log('[SessionHandler] Not enough pages for session detection (need 3, have', recentPages.length, ')');
      return;
    }
    
    // Run clustering via offscreen worker
    console.log('[SessionHandler] Starting clustering of', recentPages.length, 'pages');
    const sessions = await clusterSessionsViaOffscreen(recentPages);
    console.log('[SessionHandler] Clustering returned', sessions.length, 'sessions');
    
    if (sessions.length === 0) {
      console.log('[SessionHandler] No coherent sessions found');
      return;
    }
    
    // Get most recent session
    const latestSession = sessions[sessions.length - 1];
    
    // Check if session is fresh enough
    const ageHours = (Date.now() - latestSession.lastTimestamp) / (1000 * 60 * 60);
    if (ageHours > SESSION_FRESHNESS_HOURS) {
      console.log('[SessionHandler] Latest session too old:', ageHours.toFixed(1), 'hours');
      return;
    }
    
    // Check if already dismissed
    const dismissed = await getLocal<string[]>(STORAGE_KEY_DISMISSED) || [];
    if (dismissed.includes(latestSession.id)) {
      console.log('[SessionHandler] Session already dismissed');
      return;
    }
    
    // Check if already pending
    const existing = await getLocal<PendingSession>(STORAGE_KEY_PENDING);
    if (existing && existing.session.id === latestSession.id) {
      console.log('[SessionHandler] Session already pending');
      return;
    }
    
    // Store as pending
    await setLocal<PendingSession>(STORAGE_KEY_PENDING, {
      session: latestSession,
      detectedAt: Date.now(),
    });
    
    // Set badge to indicate pending session
    await chrome.action.setBadgeText({ text: '1' });
    await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    
    console.log('[SessionHandler] Pending session stored:', latestSession.title);
  } catch (error) {
    console.error('[SessionHandler] Session detection failed:', error);
    // Reset cooldown on error (allow retry)
    await setLocal(STORAGE_KEY_LAST_CHECK, Date.now() - COOLDOWN_MS);
  }
}

/**
 * Cluster sessions via offscreen worker
 * CRITICAL FIX #1: Uses singleton manager to prevent contention
 */
async function clusterSessionsViaOffscreen(pages: PageDigest[]): Promise<TaskSession[]> {
  // Ensure offscreen document exists (singleton - safe even if search is using it)
  await ensureOffscreenDocument();
  
  const requestId = crypto.randomUUID();
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Clustering timeout'));
    }, 30000); // 30s timeout
    
    const listener = (message: any) => {
      if (message.requestId !== requestId) return;
      
      clearTimeout(timeout);
      chrome.runtime.onMessage.removeListener(listener);
      
      if (message.type === 'CLUSTER_RESULT') {
        console.log('[SessionHandler] Clustering complete:', message.processingTimeMs, 'ms');
        resolve(message.sessions);
      } else {
        reject(new Error(message.error || 'Clustering failed'));
      }
    };
    
    chrome.runtime.onMessage.addListener(listener);
    
    // Send clustering request to offscreen
    chrome.runtime.sendMessage({
      type: 'CLUSTER_SESSIONS',
      pages: pages.map(p => ({
        ...p,
        vector: p.vector ? Array.from(p.vector) : undefined, // Convert to array for JSON
      })),
      requestId,
    });
  });
}

/**
 * Get pending session (for popup)
 */
export async function getPendingSession(): Promise<PendingSession | null> {
  return await getLocal<PendingSession>(STORAGE_KEY_PENDING);
}

/**
 * Dismiss session
 */
export async function dismissSession(sessionId: string): Promise<void> {
  // Add to dismissed list
  const dismissed = await getLocal<string[]>(STORAGE_KEY_DISMISSED) || [];
  dismissed.push(sessionId);
  await setLocal(STORAGE_KEY_DISMISSED, dismissed);
  
  // Clear pending
  await setLocal(STORAGE_KEY_PENDING, null);
  
  // Clear badge
  await chrome.action.setBadgeText({ text: '' });
  
  console.log('[SessionHandler] Session dismissed:', sessionId);
}

/**
 * Resume session (open tabs)
 * CRITICAL FIX #2: Handles legacy data gracefully
 * CRITICAL FIX #4: Implements tab cap with user control
 */
export async function resumeSession(
  session: TaskSession,
  limitCount?: number
): Promise<ResumeResult> {
  console.log('[SessionHandler] Resuming session:', session.title);
  
  // Get existing tabs for deduplication
  const existingTabs = await chrome.tabs.query({});
  const openUrls = new Set(existingTabs.map(t => normalizeUrl(t.url || '')));
  
  // Load pages from IndexedDB
  const pages = await Promise.all(
    session.pageIds.map(id => db.getDigest(id))
  );
  
  // CRITICAL FIX #2: Filter out legacy pages without URLs
  const validPages = pages.filter(page => {
    if (!page) {
      console.warn('[SessionHandler] Page not found in DB');
      return false;
    }
    if (!page.url) {
      console.warn('[SessionHandler] Legacy page without URL:', page.urlHash.slice(0, 8));
      return false;
    }
    if (!page.url.startsWith('http://') && !page.url.startsWith('https://')) {
      console.warn('[SessionHandler] Invalid URL scheme:', page.url);
      return false;
    }
    return true;
  });
  
  const skippedCount = pages.length - validPages.length;
  
  // Check if any valid pages exist
  if (validPages.length === 0) {
    console.error('[SessionHandler] No valid pages to resume');
    return {
      success: false,
      openedCount: 0,
      skippedCount,
      message: 'This session is too old to resume. Pages were created before URL storage was added.',
    };
  }
  
  // CRITICAL FIX #4: Apply tab cap (user-requested limit OR system max)
  const maxTabs = limitCount || MAX_TABS;
  const pagesToOpen = validPages.slice(0, maxTabs);
  const cappedCount = validPages.length - pagesToOpen.length;
  
  // Deduplicate and open tabs
  let openedCount = 0;
  for (const page of pagesToOpen) {
    if (!page || !page.url) continue; // Skip null/invalid pages
    
    const normalizedUrl = normalizeUrl(page.url);
    
    if (!openUrls.has(normalizedUrl)) {
      try {
        await chrome.tabs.create({
          url: page.url,
          active: false,
        });
        openedCount++;
        openUrls.add(normalizedUrl); // Prevent duplicates in this batch
      } catch (error) {
        console.error('[SessionHandler] Failed to open tab:', page.url, error);
      }
    } else {
      console.log('[SessionHandler] Tab already open, skipping:', page.url);
    }
  }
  
  // Clear pending session
  await setLocal(STORAGE_KEY_PENDING, null);
  await chrome.action.setBadgeText({ text: '' });
  
  // Build success message
  let message = `Opened ${openedCount} tabs`;
  if (skippedCount > 0) {
    message += ` (${skippedCount} older pages couldn't be restored)`;
  }
  if (cappedCount > 0) {
    message += ` (${cappedCount} tabs not opened due to limit)`;
  }
  
  console.log('[SessionHandler]', message);
  
  return {
    success: true,
    openedCount,
    skippedCount,
    message,
  };
}

/**
 * Normalize URL for comparison
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove trailing slash, fragments, common params
    let normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    normalized = normalized.replace(/\/$/, '');
    return normalized.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Clean up dismissed sessions daily
 */
export async function cleanupDismissedSessions(): Promise<void> {
  await setLocal(STORAGE_KEY_DISMISSED, []);
  console.log('[SessionHandler] Cleared dismissed sessions');
}

