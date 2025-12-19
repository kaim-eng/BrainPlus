/**
 * Private Semantic Search Engine
 * Adaptive hybrid scoring with privacy enforcement
 */

import { db, hydrateDigest } from './db';
import type { 
  PageDigest, 
  Passage,
  SearchOptions, 
  QuerySignals, 
  RankedResult,
  RankedPassage,
  SearchMetrics,
  SearchAudit 
} from './types';
import { getLocal, setLocal } from './storage';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_LIMIT = 20;
const DEFAULT_MIN_SCORE = 0.1;
const MAX_BATCH_SIZE = 500; // For memory management

// ============================================================================
// Query Analysis
// ============================================================================

/**
 * Analyze query to extract signals for adaptive weighting
 */
export function analyzeQuery(q: string): QuerySignals {
  const qLower = q.toLowerCase();
  
  // Recency indicators
  const recencyTerms = /\b(today|recent|latest|new|this week|last week|202[3-5])\b/i;
  const isRecent = recencyTerms.test(qLower);
  
  // Semantic indicators (vs exact match)
  const semanticTerms = /\b(like|similar|about|related|concept)\b/i;
  const isSemantic = semanticTerms.test(qLower) || q.split(' ').length > 4;
  
  // Extract entities (simple noun phrase extraction)
  const entities = extractEntities(q);
  
  return {
    alpha: isRecent ? 0.7 : 0.3,
    semantic: isSemantic,
    entities
  };
}

/**
 * Extract entities from query
 */
function extractEntities(query: string): string[] {
  // Simple tokenization
  const tokens = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
  
  // Filter out common words (basic stopwords)
  const stopwords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but',
    'in', 'with', 'to', 'for', 'of', 'as', 'by', 'from', 'about',
    'show', 'find', 'get', 'like', 'similar', 'related'
  ]);
  
  return tokens.filter(t => !stopwords.has(t));
}

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Calculate freshness score with exponential decay
 */
function calculateFreshness(timestamp: number, now: number): number {
  const ageMs = now - timestamp;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  
  // Exponential decay: 1.0 at 0 days, 0.5 at 7 days, 0.1 at 30 days
  const halfLifeDays = 7;
  return Math.exp(-0.693 * ageDays / halfLifeDays);
}

/**
 * Lexical boost for exact keyword matches
 */
function lexicalBoost(qText: string, page: PageDigest): number {
  const qTokens = new Set(qText.toLowerCase().split(/\W+/).filter(Boolean));
  const titleTokens = new Set(page.title.toLowerCase().split(/\W+/).filter(Boolean));
  
  let overlap = 0;
  for (const t of qTokens) {
    if (titleTokens.has(t)) overlap++;
  }
  
  // Cap boost at 0.15
  return Math.min(0.15, overlap * 0.03);
}

/**
 * Entity boost for matching extracted entities
 */
function entityBoost(qEntities: string[], pEntities: string[]): number {
  if (qEntities.length === 0) return 0;
  
  const qSet = new Set(qEntities.map(e => e.toLowerCase()));
  const pSet = new Set(pEntities.map(e => e.toLowerCase()));
  
  let matches = 0;
  for (const e of qSet) {
    if (pSet.has(e)) matches++;
  }
  
  // Cap boost at 0.2
  return Math.min(0.2, matches * 0.05);
}

/**
 * Dot product for L2-normalized vectors (equals cosine similarity)
 */
export function dotProduct(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  
  // Clamp to [0, 1] range (should be automatic if normalized)
  return Math.max(0, Math.min(1, sum));
}

// ============================================================================
// Ranking Algorithm
// ============================================================================

/**
 * Rank pages using adaptive hybrid scoring
 */
export async function rankPages(
  qVec: Float32Array,
  candidates: PageDigest[],
  now: number,
  qText: string
): Promise<RankedResult[]> {
  
  const signals = analyzeQuery(qText);
  
  // Dynamic weights based on query signals
  const W_SEMANTIC = signals.semantic ? 0.5 : 0.3;
  const W_FRESHNESS = signals.alpha;
  const W_INTENT = 0.15;
  // Note: Lexical and entity boosts are added directly (not multiplied by weight)
  
  const results = candidates.map(p => {
    // Ensure vector is hydrated
    if (!p.vector) {
      p = hydrateDigest(p);
    }
    
    // Calculate individual scores
    const semantic = dotProduct(qVec, p.vector!);
    const freshness = calculateFreshness(p.timestamp, now);
    const intent = p.intentScore ?? 0.5;
    const lexical = lexicalBoost(qText, p);
    const entity = entityBoost(signals.entities, p.entities);
    
    // Weighted final score
    const finalScore = 
      (semantic * W_SEMANTIC) +
      (freshness * W_FRESHNESS) +
      (intent * W_INTENT) +
      lexical +
      entity;
    
    // Build explanation
    const explanation: string[] = [];
    if (semantic > 0.7) explanation.push('Concept Match');
    if (freshness > 0.8) explanation.push('Fresh');
    if (lexical > 0.1) explanation.push('Title Match');
    if (entity > 0.1) explanation.push('Entity Match');
    if (intent > 0.8) explanation.push('High Intent');
    
    return {
      page: p,
      finalScore,
      factors: { semantic, freshness, intent, lexical, entity },
      explanation
    };
  });
  
  // Sort by final score (descending)
  return results
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, DEFAULT_LIMIT);
}

/**
 * Rank large datasets using batched processing
 */
async function rankLargeDataset(
  qVec: Float32Array,
  allCandidates: PageDigest[],
  now: number,
  qText: string
): Promise<RankedResult[]> {
  
  if (allCandidates.length <= MAX_BATCH_SIZE) {
    return rankPages(qVec, allCandidates, now, qText);
  }
  
  // Process in batches to avoid OOM
  const batches: RankedResult[][] = [];
  for (let i = 0; i < allCandidates.length; i += MAX_BATCH_SIZE) {
    const batch = allCandidates.slice(i, i + MAX_BATCH_SIZE);
    const results = await rankPages(qVec, batch, now, qText);
    batches.push(results);
  }
  
  // Merge and re-sort
  const allResults = batches.flat();
  return allResults
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, DEFAULT_LIMIT);
}

// ============================================================================
// Passage Ranking (for AMA/RAG)
// ============================================================================

/**
 * Rank passages using hybrid scoring (similar to rankPages)
 * Design Doc: AMA_DESIGN_REVIEW.md, Phase 1
 * 
 * Key differences from rankPages:
 * 1. Works with passages instead of pages
 * 2. De-duplicates by URL (max N passages per page)
 * 3. Filters near-duplicate passages (cosine > 0.95)
 * 4. Returns top-K passages (default K=12)
 */
export async function rankPassages(
  qVec: Float32Array,
  passages: Passage[],
  pageMap: Map<string, PageDigest>,
  now: number,
  qText: string,
  topK: number = 12
): Promise<RankedPassage[]> {
  
  const signals = analyzeQuery(qText);
  
  // Dynamic weights (same as rankPages)
  const W_SEMANTIC = signals.semantic ? 0.5 : 0.3;
  const W_FRESHNESS = signals.alpha;
  const W_INTENT = 0.15;
  
  // Score each passage
  const scored = passages.map(passage => {
    const page = pageMap.get(passage.urlHash);
    
    if (!page) {
      // Orphaned passage - skip
      return null;
    }
    
    // Ensure passage embedding is hydrated
    if (!passage.embedding && passage.embeddingBuf) {
      passage.embedding = new Float32Array(passage.embeddingBuf);
    }
    
    if (!passage.embedding) {
      return null;
    }
    
    // Calculate individual scores
    const semantic = dotProduct(qVec, passage.embedding);
    const freshness = calculateFreshness(page.timestamp, now);
    const intent = page.intentScore ?? 0.5;
    const lexical = lexicalBoost(qText, page); // Use page title for lexical
    const entity = entityBoost(signals.entities, page.entities);
    
    // Weighted final score
    const finalScore = 
      (semantic * W_SEMANTIC) +
      (freshness * W_FRESHNESS) +
      (intent * W_INTENT) +
      lexical +
      entity;
    
    return {
      passage,
      page,
      finalScore,
      factors: { semantic, freshness, intent, lexical }
    };
  }).filter(Boolean) as RankedPassage[];
  
  // Sort by score (descending)
  scored.sort((a, b) => b.finalScore - a.finalScore);
  
  // De-duplicate by URL (max 3 passages per page)
  const urlCounts = new Map<string, number>();
  const deduplicated: RankedPassage[] = [];
  
  for (const result of scored) {
    const count = urlCounts.get(result.passage.urlHash) || 0;
    
    if (count < 3) {
      deduplicated.push(result);
      urlCounts.set(result.passage.urlHash, count + 1);
    }
  }
  
  // Filter near-duplicates (cosine similarity > 0.95)
  const filtered: RankedPassage[] = [];
  
  for (const candidate of deduplicated) {
    let isDuplicate = false;
    
    for (const existing of filtered) {
      const similarity = dotProduct(
        candidate.passage.embedding!,
        existing.passage.embedding!
      );
      
      if (similarity > 0.95) {
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      filtered.push(candidate);
    }
    
    // Stop when we have enough
    if (filtered.length >= topK) {
      break;
    }
  }
  
  console.log(`[Search] Ranked ${passages.length} passages → ${filtered.length} results`);
  
  return filtered;
}

/**
 * Retrieve passages for AMA query
 * 
 * @param query - User's question
 * @param topK - Number of passages to retrieve (default: 12)
 * @returns Ranked passages with parent page metadata
 */
export async function retrievePassages(
  query: string,
  topK: number = 12
): Promise<RankedPassage[]> {
  const startTime = performance.now();
  const now = Date.now();
  
  try {
    // 1. Get query embedding
    const qVec = await getQueryEmbedding(query);
    
    // 2. Load all passages
    const allPassages = await db.getAllPassages();
    console.log(`[AMA] Loaded ${allPassages.length} passages`);
    
    // 3. Load parent pages (for metadata)
    const allPages = await db.getAll();
    const pageMap = new Map<string, PageDigest>();
    for (const page of allPages) {
      pageMap.set(page.urlHash, page);
    }
    
    // 4. Rank passages
    const ranked = await rankPassages(qVec, allPassages, pageMap, now, query, topK);
    
    const totalTime = performance.now() - startTime;
    console.log(`[AMA] Retrieved ${ranked.length} passages in ${totalTime.toFixed(0)}ms`);
    
    return ranked;
    
  } catch (error) {
    console.error('[AMA] Passage retrieval error:', error);
    throw error;
  }
}

// ============================================================================
// Query Embedding
// ============================================================================

/**
 * Get query embedding from offscreen worker
 */
async function getQueryEmbedding(query: string): Promise<Float32Array> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'EMBED_QUERY',
      data: { query }
    });
    
    if (!response) {
      throw new Error('No response from offscreen worker. Worker may not be running.');
    }
    
    if (!response.success) {
      throw new Error(response.error || 'Query embedding failed');
    }
    
    if (!response.data || !response.data.vector) {
      throw new Error('Invalid response from offscreen worker: missing vector data');
    }
    
    // Convert array back to Float32Array
    return new Float32Array(response.data.vector);
  } catch (error) {
    console.error('[Search] Query embedding error:', error);
    throw new Error(`Failed to generate query embedding: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// Main Search Function
// ============================================================================

/**
 * Perform semantic search with privacy enforcement
 */
export async function performSearch(
  query: string,
  options: SearchOptions = {}
): Promise<RankedResult[]> {
  
  const startTime = performance.now();
  const { includePrivate = false, limit = DEFAULT_LIMIT, minScore = DEFAULT_MIN_SCORE } = options;
  
  // Validate query
  if (!query || query.trim().length < 2) {
    return [];
  }
  
  const now = Date.now();
  const deleteQueue: string[] = [];
  
  try {
    // 1. Load all candidates
    const allDigests = await db.getAll();
    console.log(`[Search] Loaded ${allDigests.length} candidates`);
    
    const embeddingStart = performance.now();
    
    // 2. Generate query embedding
    const qVec = await getQueryEmbedding(query);
    const embeddingTime = performance.now() - embeddingStart;
    
    // 3. Filter with privacy and expiry checks
    const candidates = allDigests.filter(p => {
      // Privacy filter
      if (p.isPrivate && !includePrivate) {
        return false;
      }
      
      // Expiry check (soft delete)
      if (p.autoExpireAt && p.autoExpireAt < now) {
        deleteQueue.push(p.urlHash);
        return false;
      }
      
      return true;
    });
    
    console.log(`[Search] Filtered to ${candidates.length} candidates (privacy + expiry)`);
    
    const rankingStart = performance.now();
    
    // 4. Rank results
    const results = await rankLargeDataset(qVec, candidates, now, query);
    const rankingTime = performance.now() - rankingStart;
    
    // 5. Apply minimum score threshold
    const filtered = results.filter(r => r.finalScore >= minScore);
    
    const totalTime = performance.now() - startTime;
    
    // 6. Track metrics
    const metrics: SearchMetrics = {
      queryLength: query.length,
      candidateCount: candidates.length,
      embeddingTimeMs: embeddingTime,
      rankingTimeMs: rankingTime,
      totalTimeMs: totalTime,
      resultsCount: filtered.length
    };
    await trackSearchMetrics(metrics);
    
    // 7. Log search for user transparency
    await logSearch({
      query,
      timestamp: now,
      resultsCount: filtered.length,
      includePrivate
    });
    
    // 8. Async cleanup (don't block search results)
    if (deleteQueue.length > 0) {
      setTimeout(async () => {
        for (const hash of deleteQueue) {
          await db.delete('digests', hash);
        }
        console.log(`[Search] Pruned ${deleteQueue.length} expired entries`);
      }, 0);
    }
    
    console.log(`[Search] Complete in ${totalTime.toFixed(0)}ms (${filtered.length} results)`);
    
    return filtered.slice(0, limit);
    
  } catch (error) {
    console.error('[Search] Error:', error);
    throw error;
  }
}

// ============================================================================
// Fallback Keyword Search
// ============================================================================

/**
 * Fallback keyword search (when ML fails)
 */
export async function performKeywordSearch(
  query: string,
  options: SearchOptions = {}
): Promise<RankedResult[]> {
  
  const { includePrivate = false, limit = DEFAULT_LIMIT } = options;
  const now = Date.now();
  
  try {
    const allDigests = await db.getAll();
    const qTokens = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
    
    const results = allDigests
      .filter(p => {
        // Privacy filter
        if (p.isPrivate && !includePrivate) return false;
        
        // Expiry filter
        if (p.autoExpireAt && p.autoExpireAt < now) return false;
        
        return true;
      })
      .map(p => {
        // Simple TF-IDF scoring
        const titleTokens = new Set(p.title.toLowerCase().split(/\W+/).filter(Boolean));
        const entityTokens = new Set(p.entities.map(e => e.toLowerCase()));
        
        let score = 0;
        for (const token of qTokens) {
          if (titleTokens.has(token)) score += 2; // Title match worth more
          if (entityTokens.has(token)) score += 1;
        }
        
        return {
          page: p,
          finalScore: score / (qTokens.size * 3), // Normalize
          factors: { semantic: 0, freshness: 0, intent: 0, lexical: score, entity: 0 },
          explanation: ['Keyword Match (Fallback)']
        };
      })
      .filter(r => r.finalScore > 0)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);
    
    console.log(`[Search] Keyword fallback: ${results.length} results`);
    return results;
    
  } catch (error) {
    console.error('[Search] Keyword search error:', error);
    return [];
  }
}

/**
 * Search with automatic fallback
 */
export async function searchWithFallback(
  query: string,
  options: SearchOptions = {}
): Promise<RankedResult[]> {
  try {
    return await performSearch(query, options);
  } catch (error) {
    console.warn('[Search] Semantic search failed, using keyword fallback:', error);
    return await performKeywordSearch(query, options);
  }
}

// ============================================================================
// Telemetry & Logging
// ============================================================================

/**
 * Track search metrics (locally only)
 */
async function trackSearchMetrics(metrics: SearchMetrics): Promise<void> {
  try {
    const history = await getLocal<SearchMetrics[]>('searchMetrics') || [];
    history.push(metrics);
    
    // Keep last 100
    if (history.length > 100) history.shift();
    
    await setLocal('searchMetrics', history);
    
    // Optional: Aggregate stats
    const avg = history.reduce((sum, m) => sum + m.totalTimeMs, 0) / history.length;
    console.log(`[Metrics] Average search time: ${avg.toFixed(0)}ms`);
  } catch (error) {
    console.error('[Metrics] Failed to track:', error);
  }
}

/**
 * Log search for user transparency
 */
async function logSearch(audit: SearchAudit): Promise<void> {
  try {
    const log = await getLocal<SearchAudit[]>('searchAuditLog') || [];
    log.push(audit);
    
    // Keep last 100 searches
    if (log.length > 100) log.shift();
    
    await setLocal('searchAuditLog', log);
  } catch (error) {
    console.error('[Search] Failed to log:', error);
  }
}

/**
 * Get search history (for user transparency)
 */
export async function getSearchHistory(): Promise<SearchAudit[]> {
  return await getLocal<SearchAudit[]>('searchAuditLog') || [];
}

/**
 * Clear search history
 */
export async function clearSearchHistory(): Promise<void> {
  await setLocal('searchAuditLog', []);
}

/**
 * Get search metrics
 */
export async function getSearchMetrics(): Promise<SearchMetrics[]> {
  return await getLocal<SearchMetrics[]>('searchMetrics') || [];
}

