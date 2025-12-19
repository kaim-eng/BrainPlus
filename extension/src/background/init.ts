/**
 * Extension initialization logic
 */

import { getLocal, setLocal } from '@/lib/storage';
import { STORAGE_KEYS } from '@/lib/constants';
import { generateRandomId } from '@/lib/crypto';
import { initPrivacyBudget } from '@/lib/differentialPrivacy';
import type { UserPreferences, PrivacyConfig } from '@/lib/types';
import { isBraveBrowser, PRIVACY_DEFAULTS } from '@/lib/constants';
import { ensureOffscreenDocument } from './offscreenManager';

/**
 * Initialize extension on first install or browser startup
 */
export async function initializeExtension(): Promise<void> {
  console.log('[Init] Initializing extension...');
  
  // 1. Generate or retrieve anonymous ID
  let anonymousId = await getLocal<string>(STORAGE_KEYS.ANONYMOUS_ID);
  if (!anonymousId) {
    anonymousId = generateRandomId();
    await setLocal(STORAGE_KEYS.ANONYMOUS_ID, anonymousId);
    console.log('[Init] Generated anonymous ID');
  }
  
  // 2. Generate session ID
  const sessionId = generateRandomId();
  await setLocal(STORAGE_KEYS.SESSION_ID, sessionId);
  console.log('[Init] Generated session ID');
  
  // 3. Initialize privacy config
  let privacyConfig = await getLocal<PrivacyConfig>(STORAGE_KEYS.PRIVACY_CONFIG);
  if (!privacyConfig) {
    const budget = initPrivacyBudget();
    privacyConfig = {
      dailyEpsilonBudget: budget.dailyEpsilon,
      epsilonPerEvent: PRIVACY_DEFAULTS.EPSILON_PER_EVENT,
      epsilonConsumed: budget.consumed,
      lastResetTimestamp: budget.lastReset,
      kThreshold: isBraveBrowser() 
        ? PRIVACY_DEFAULTS.K_ANONYMITY_BRAVE 
        : PRIVACY_DEFAULTS.K_ANONYMITY_THRESHOLD,
      suppressRareCategories: true,
      trackingEnabled: true,
      shoppingModeEnabled: false,
      privacyLevel: 'medium',
    };
    await setLocal(STORAGE_KEYS.PRIVACY_CONFIG, privacyConfig);
    console.log('[Init] Initialized privacy config');
  }
  
  // 4. Initialize user preferences
  let preferences = await getLocal<UserPreferences>(STORAGE_KEYS.PREFERENCES);
  if (!preferences) {
    preferences = {
      privacy: privacyConfig,
      theme: 'auto',
      notificationsEnabled: true,
      showDealsOverlay: true,
      preferredCategories: [],
      onboardingCompleted: false,
      isBraveUser: isBraveBrowser(),
    };
    await setLocal(STORAGE_KEYS.PREFERENCES, preferences);
    console.log('[Init] Initialized user preferences');
  }
  
  // 5. v0.2: Event queue removed, using IndexedDB for local storage
  
  // 6. Create offscreen document for ML operations (search)
  try {
    await ensureOffscreenDocument();
    console.log('[Init] Offscreen document ready for ML operations');
  } catch (error) {
    console.error('[Init] Failed to create offscreen document:', error);
    // Don't fail initialization if offscreen creation fails
    // It will be created on-demand when needed
  }
  
  console.log('[Init] Extension initialization complete');
}

