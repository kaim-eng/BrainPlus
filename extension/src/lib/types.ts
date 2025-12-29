/**
 * Core type definitions for DataPay Assist extension
 */

// ============================================================================
// Message Types (Chrome Runtime Communication)
// ============================================================================

export type MessageType =
  | 'ANALYZE_PAGE'
  | 'RUN_INFERENCE'
  | 'INFERENCE_RESULT'
  | 'GENERATE_SIGNAL'
  | 'FETCH_DEALS'
  | 'DEAL_CLICK'
  | 'GET_POINTS'
  | 'REDEEM_POINTS'
  | 'OFFSCREEN_LOG' // Debug: Forward offscreen console to background
  | 'EMBED_QUERY' // Generate embedding for search query
  | 'UPDATE_LAST_ACCESSED' // Update last accessed timestamp for a page
  | 'CLUSTER_SESSIONS' // Cluster pages into task sessions
  | 'CLUSTER_RESULT' // Clustering result from offscreen
  | 'GET_PENDING_SESSION' // Get pending session for popup
  | 'RESUME_SESSION' // Resume session tabs
  | 'DISMISS_SESSION' // Dismiss session
  | 'AMA_QUERY' // Ask Me Anything query
  | 'AMA_TOKEN' // Streaming token from LLM
  | 'AMA_SOURCES' // Sources for answer
  | 'AMA_DONE' // Answer complete
  | 'AMA_ERROR' // Error during AMA
  | 'sync:checkNativeHost' // Check if native host is available
  | 'sync:initiatePairing' // Start pairing (generate QR)
  | 'sync:devicePaired' // Device paired successfully
  | 'sync:cancelSync' // Cancel sync
  | 'sync:getSyncStatus'; // Get sync status

export interface BaseMessage {
  type: MessageType;
  timestamp: number;
}

export interface AnalyzePageMessage extends BaseMessage {
  type: 'ANALYZE_PAGE';
  features: PageFeatures;
  url: string;
  tabId: number;
}

export interface RunInferenceMessage extends BaseMessage {
  type: 'RUN_INFERENCE';
  features: PageFeatures;
  requestId: string;
}

export interface InferenceResultMessage extends BaseMessage {
  type: 'INFERENCE_RESULT';
  requestId: string;
  intentScore: number;
  category: string;
}

// ============================================================================
// Page Features (Content Script → Background)
// ============================================================================

export interface PageFeatures {
  // Meta information
  title: string;
  description?: string;
  keywords?: string[];
  ogType?: string;
  
  // Commerce signals
  hasPrice: boolean;
  priceValue?: number;
  currency?: string;
  
  // Shopping indicators
  hasCartButton: boolean;
  hasBuyNow: boolean;
  hasCheckout: boolean;
  hasProductSchema: boolean;
  
  // Page structure
  hasSizeSelector: boolean;
  hasQuantitySelector: boolean;
  hasReviews: boolean;
  
  // URL patterns
  urlPatterns: {
    isProduct: boolean;
    isCategory: boolean;
    isCheckout: boolean;
  };
  
  // Domain info
  domain: string;
  isKnownEcommerce: boolean;
}

// ============================================================================
// Intent Scoring
// ============================================================================

export interface IntentScore {
  score: number; // 0.0 - 1.0
  confidence: number; // 0.0 - 1.0
  category: string;
  signals: {
    hasPrice: boolean;
    hasShoppingButtons: boolean;
    isEcommerceDomain: boolean;
    hasProductSchema: boolean;
  };
  timestamp: number;
}

// ============================================================================
// Page Digest (IndexedDB Storage)
// ============================================================================

export interface PageDigest {
  // Schema version for migration
  schemaVersion: number;     // Current: 4 (v4 adds tsFuzzy + passages support)
  
  // Indexing
  urlHash: string;           // SHA-256 of URL (primary key)
  domainHash: string;        // SHA-256 of domain
  url: string;               // ⭐ v3: Original URL (for tab restoration)
  
  // Content (STORED LOCALLY ONLY - never sent to backend)
  title: string;             // Page title (max 200 chars)
  summary: string;           // First 500 words or meta description
  fullText?: string;         // Optional: Full page text (for search)
  
  // Embeddings (v2: ArrayBuffer for efficient storage)
  vectorBuf: ArrayBuffer;    // 512-dim embedding stored as ArrayBuffer
  vector?: Float32Array;     // Runtime only (hydrated from vectorBuf)
  
  // Metadata
  entities: string[];        // Top 5-10 keywords/phrases
  category: string;          // "shopping", "news", "tech", etc.
  intentScore: number;       // 0.0-1.0 (purchase/conversion intent)
  
  // Timestamps
  timestamp: number;         // Visit timestamp (ms) - precise
  tsFuzzy: number;           // ⭐ v4: Fuzzy timestamp (rounded to hour) for DP
  lastAccessed: number;      // Last time queried (for LRU eviction)
  
  // Sync Status
  isSynced: boolean;         // Has signal been sent to backend?
  signalSentAt?: number;     // Timestamp of last signal
  
  // Privacy
  isPrivate: boolean;        // User manually marked as private
  autoExpireAt: number;      // Auto-delete timestamp (30 days default)
  
  // Cross-Device Sync (v5: optional for backwards compatibility)
  vectorMetadata?: {         // Vector generation metadata for compatibility checking
    tfVersion: string;       // TensorFlow.js version (e.g., "4.22.0")
    useVersion: string;      // USE model version (e.g., "1.3.3")
    backend: string;         // TF backend used (webgl, cpu, wasm)
    dimensions: number;      // Vector dimensions (512 for USE)
    generatedAt: number;     // When vector was generated
  };
  syncMetadata?: {           // Sync tracking metadata
    lastSyncedAt?: number;   // When this page was last synced
    sourceDevices?: string[]; // Device IDs that contributed to this page
    mergeCount?: number;     // Number of times this page has been merged
  };
  pageId?: string;           // Stable page identifier (for sync deduplication)
  domain?: string;           // Domain name (for easier filtering)
  qualityScore?: number;     // Page quality score (0.0-1.0)
  keywords?: string[];       // Additional keywords
  activityContext?: {        // Activity tracking context
    sessionId?: string;
    tabId?: number;
    windowId?: number;
    referrer?: string;
    duration?: number;
  };
}

// Legacy schema for migration
export interface PageDigestV1 {
  urlHash: string;
  domainHash: string;
  title: string;
  summary: string;
  fullText?: string;
  vector: Float32Array;      // Old: stored directly
  entities: string[];
  category: string;
  intentScore: number;
  timestamp: number;
  lastAccessed: number;
  isSynced: boolean;
  signalSentAt?: number;
  isPrivate: boolean;
  autoExpireAt: number;
}

// ============================================================================
// Passage (RAG Chunking for AMA Feature)
// ============================================================================

/**
 * Passage: A chunk of text from a page with its own embedding
 * Design Doc: AMA_DESIGN_REVIEW.md, Section 3.1
 * 
 * Purpose: Enable passage-level retrieval for RAG (vs page-level)
 * Storage: New 'passages' IndexedDB store (added in v4)
 * 
 * Generation Strategy (Conditional):
 * - Only generate passages for:
 *   1. Long pages (fullText > 2000 chars)
 *   2. High-intent pages (intentScore > 0.6)
 * - Chunk size: 512-1024 tokens (~2000-4000 chars)
 * - Overlap: 128 tokens (~500 chars) for context continuity
 */
export interface Passage {
  // Indexing
  passageId: string;         // Composite key: `${urlHash}:${chunkIdx}`
  urlHash: string;           // Reference to parent PageDigest
  chunkIdx: number;          // 0, 1, 2... (order matters for context)
  
  // Content
  text: string;              // Chunk text (512-1024 tokens, DP-redacted)
  
  // Embedding (ArrayBuffer for efficient storage)
  embeddingBuf: ArrayBuffer; // 512-dim embedding stored as ArrayBuffer
  embedding?: Float32Array;  // Runtime only (hydrated from embeddingBuf)
  
  // Metadata (inherited from parent page)
  tsFuzzy: number;           // Fuzzy timestamp (inherited from PageDigest)
  category: string;          // Inherited category (for filtering)
  
  // Storage
  createdAt: number;         // When passage was created (ms)
}

// ============================================================================
// Signal Payload (Sent to Backend)
// ============================================================================

export interface SignalPayload {
  anonymousId: string;
  signals: Signal[];
  timestamp: number;
}

export interface Signal {
  category: string;          // "electronics", "fitness", etc.
  entities: string[];        // Keywords (NOT page titles)
  intentScore: number;       // 0.0-1.0 (aggregate score)
  pageCount: number;         // Number of pages (NOT which pages)
  timeWindow: string;        // "48h", "7d", etc.
}

// ============================================================================
// Deal System
// ============================================================================

export interface Deal {
  id: string;
  merchantName: string;
  merchantDomain: string;
  title: string;
  description: string;
  discountPercent?: number;
  discountAmount?: number;
  category: string;
  thumbnailUrl?: string;
  
  // Server-side attribution (Brave-compatible)
  redirectUrl: string; // e.g., https://api.datapay.io/r/abc123
  
  // Deal metadata
  expiresAt?: number;
  minIntentScore: number;
  pointsReward: number;
  
  // Quality score
  dealScore: number;
}

// ============================================================================
// Points & Redemption (NOT real money)
// ============================================================================

export interface PointsBalance {
  total: number;
  available: number; // Total minus pending redemptions
  pending: number;
  lifetime: number; // Lifetime earnings
  
  breakdown: {
    signals: number;         // From sending signals (10pts each)
    clicks: number;          // From clicking deals (5pts each)
    purchases: number;
    bonuses: number;
  };
  
  history: PointsTransaction[];
}

export interface PointsTransaction {
  id: string;
  type: 'signal_sent' | 'deal_clicked' | 'purchase' | 'bonus' | 'redemption';
  points: number;
  description: string;
  timestamp: number;
  status?: 'pending' | 'confirmed' | 'failed';
}

export interface RedemptionOption {
  id: string;
  type: 'gift_card' | 'paypal' | 'bank_transfer' | 'crypto';
  provider: string; // e.g., "Amazon", "PayPal"
  minPoints: number;
  conversionRate: number; // Points per dollar
  iconUrl?: string;
}

export interface RedemptionRequest {
  optionId: string;
  pointsAmount: number;
  recipientInfo: Record<string, string>; // Email, address, etc.
}

// ============================================================================
// Privacy Configuration
// ============================================================================

export interface PrivacyConfig {
  // Differential privacy
  dailyEpsilonBudget: number; // e.g., 10.0
  epsilonPerEvent: number; // e.g., 0.1
  epsilonConsumed: number;
  lastResetTimestamp: number;
  
  // k-anonymity
  kThreshold: number; // Minimum k=5
  suppressRareCategories: boolean;
  
  // User preferences
  trackingEnabled: boolean;
  shoppingModeEnabled: boolean;
  privacyLevel: 'low' | 'medium' | 'high';
}

// ============================================================================
// User Preferences
// ============================================================================

export interface UserPreferences {
  // Privacy settings
  privacy: PrivacyConfig;
  
  // UI preferences
  theme: 'light' | 'dark' | 'auto';
  notificationsEnabled: boolean;
  showDealsOverlay: boolean;
  
  // Categories of interest
  preferredCategories: string[];
  
  // Onboarding
  onboardingCompleted: boolean;
  isBraveUser: boolean;
}

// ============================================================================
// Storage Keys
// ============================================================================

export const STORAGE_KEYS = {
  PREFERENCES: 'userPreferences',
  PRIVACY_CONFIG: 'privacyConfig',
  POINTS_CACHE: 'pointsCache',
  DEALS_CACHE: 'dealsCache',
  ANONYMOUS_ID: 'anonymousId',
  SESSION_ID: 'sessionId',
  ENCRYPTION_KEY: 'encryptionKey',
  LAST_SYNC: 'lastSyncTimestamp',
  INDEXEDDB_STATS: 'indexedDbStats', // For tracking storage usage
  MODEL_LOADED: 'modelLoaded', // WASM model load status
} as const;

// ============================================================================
// Search Types
// ============================================================================

export interface SearchOptions {
  includePrivate?: boolean;  // Include private pages (default: false)
  limit?: number;            // Max results (default: 20)
  minScore?: number;         // Minimum score threshold (default: 0.1)
}

export interface QuerySignals {
  alpha: number;             // Recency weight (0.0-1.0)
  semantic: boolean;         // True if semantic intent detected
  entities: string[];        // Extracted entities from query
}

export interface RankedResult {
  page: PageDigest;
  finalScore: number;
  factors: {
    semantic: number;
    freshness: number;
    intent: number;
    lexical: number;
    entity: number;
  };
  explanation: string[];
}

export interface SearchMetrics {
  queryLength: number;
  candidateCount: number;
  embeddingTimeMs: number;
  rankingTimeMs: number;
  totalTimeMs: number;
  resultsCount: number;
}

export interface SearchAudit {
  query: string;
  timestamp: number;
  resultsCount: number;
  includePrivate: boolean;
}

// ============================================================================
// Fraud Detection (Client-side signals)
// ============================================================================

export interface BehavioralSignals {
  // Mouse/interaction entropy
  mouseMovements: number; // Count of movements
  mouseEntropyScore: number; // 0.0 - 1.0
  
  // Scroll behavior
  scrollEvents: number;
  scrollDepthPercent: number;
  scrollSpeed: number; // px/sec average
  
  // Timing patterns
  timeOnPage: number; // milliseconds
  interactionTimestamps: number[];
  
  // Navigation patterns
  navigationSequence: string[]; // Last N domains
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface DealsResponse {
  deals: Deal[];
  totalCount: number;
  matchedCategories: string[];
}

export interface DealMatchResponse {
  success: boolean;
  matches: Deal[];
  pointsEarned: number; // Points for sending signal
  timestamp: number;
}

// ============================================================================
// AMA (Ask Me Anything) Types
// ============================================================================

/**
 * AMA Query Message (Popup → Background)
 */
export interface AMAQueryMessage extends BaseMessage {
  type: 'AMA_QUERY';
  query: string;             // User's question
  includePrivate?: boolean;  // Include private pages (default: false)
  maxSources?: number;       // Max sources to retrieve (default: 12)
}

/**
 * AMA Token Message (Background → Popup, streaming)
 */
export interface AMATokenMessage extends BaseMessage {
  type: 'AMA_TOKEN';
  token: string;             // Single token from LLM
  requestId: string;         // Match request
}

/**
 * AMA Sources Message (Background → Popup)
 */
export interface AMASourcesMessage extends BaseMessage {
  type: 'AMA_SOURCES';
  sources: AMASource[];      // Retrieved sources
  requestId: string;
}

/**
 * AMA Done Message (Background → Popup)
 */
export interface AMADoneMessage extends BaseMessage {
  type: 'AMA_DONE';
  requestId: string;
  metrics: AMAMetrics;
}

/**
 * AMA Error Message (Background → Popup)
 */
export interface AMAErrorMessage extends BaseMessage {
  type: 'AMA_ERROR';
  error: string;
  requestId: string;
}

/**
 * AMA Source (passage or page with citation)
 */
export interface AMASource {
  citationId: number;        // [1], [2], etc.
  title: string;             // Page title
  url: string;               // Page URL
  domain: string;            // Domain for display
  snippet: string;           // Text snippet (passage or summary)
  dateRelative: string;      // "2 days ago", "1 week ago"
  timestamp: number;         // Original timestamp
  relevanceScore: number;    // 0.0-1.0 (hybrid score)
}

/**
 * AMA Metrics (for performance monitoring)
 */
export interface AMAMetrics {
  retrievalTimeMs: number;   // Time to retrieve passages
  embeddingTimeMs: number;   // Time to generate query embedding
  rankingTimeMs: number;     // Time to rank passages
  llmTimeMs?: number;        // Time for LLM inference (if used)
  totalTimeMs: number;       // Total time
  sourcesCount: number;      // Number of sources retrieved
  tokensGenerated?: number;  // Tokens generated by LLM
}

/**
 * Ranked Passage (internal, for retrieval)
 */
export interface RankedPassage {
  passage: Passage;
  page: PageDigest;          // Parent page (for metadata)
  finalScore: number;        // Hybrid score
  factors: {
    semantic: number;        // Cosine similarity
    freshness: number;       // Recency score
    intent: number;          // Intent score
    lexical: number;         // Keyword match
  };
}

