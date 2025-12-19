/**
 * Task Session Clustering
 * Groups browsing history into coherent task sessions using time + semantics
 */

import type { PageDigest } from './types';
import { sha256 } from './crypto';

export interface TaskSession {
  id: string;                    // Deterministic session ID
  title: string;                 // Human-readable name
  pageIds: string[];             // urlHashes of pages in session
  pageCount: number;             // Total pages
  coherenceScore: number;        // 0.0-1.0 (avg cosine similarity)
  firstTimestamp: number;        // Session start
  lastTimestamp: number;         // Session end
  category: string;              // Dominant category
  entities: string[];            // Top entities (for title generation)
  centroid?: Float32Array;       // Session centroid (optional)
  createdAt: number;             // When session was detected
  dismissed: boolean;            // User dismissed this session
}

export interface SessionizerConfig {
  maxPages: number;              // How many recent pages to consider (50)
  timeGapMinutes: number;        // Max gap between pages (30)
  minCoherence: number;          // Min cosine similarity (0.6)
  minPagesPerSession: number;    // Min pages to form session (3)
  maxSessionAgeHours: number;    // Max age to suggest (12)
}

const DEFAULT_CONFIG: SessionizerConfig = {
  maxPages: 50,
  timeGapMinutes: 30,
  minCoherence: 0.6,
  minPagesPerSession: 3,
  maxSessionAgeHours: 12,
};

/**
 * Detect task sessions from recent browsing history
 * Algorithm:
 *   1. Fetch last N pages (non-private)
 *   2. Sort by timestamp (oldest first)
 *   3. Split by time gaps > threshold
 *   4. For each chunk, calculate centroid and filter by coherence
 *   5. Generate deterministic session ID
 *   6. Generate human-readable title
 */
export async function detectTaskSessions(
  pages: PageDigest[],
  config: SessionizerConfig = DEFAULT_CONFIG
): Promise<TaskSession[]> {
  // CRITICAL FIX #6: Filter out pages without vectors
  const validPages = pages.filter(p => {
    if (!p.vector) {
      console.warn('[Sessionizer] Skipping page without vector:', p.urlHash.slice(0, 8));
      return false;
    }
    if (p.isPrivate) {
      return false;
    }
    if (p.vector.length !== 512) {
      console.warn('[Sessionizer] Invalid vector dimensions:', p.vector.length);
      return false;
    }
    // Check for NaN values
    if (Array.from(p.vector).some(v => isNaN(v))) {
      console.warn('[Sessionizer] NaN values in vector:', p.urlHash.slice(0, 8));
      return false;
    }
    return true;
  });
  
  if (validPages.length < config.minPagesPerSession) {
    console.log('[Sessionizer] Not enough valid pages:', validPages.length);
    return [];
  }
  
  // Sort by timestamp (oldest first)
  const sorted = validPages
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-config.maxPages);
  
  if (sorted.length < config.minPagesPerSession) {
    return [];
  }
  
  // Step 1: Split by time gaps
  const timeChunks = splitByTimeGaps(sorted, config.timeGapMinutes);
  
  // Step 2: Apply semantic coherence filtering
  const sessions: TaskSession[] = [];
  
  for (const chunk of timeChunks) {
    if (chunk.length < config.minPagesPerSession) {
      continue; // Too small
    }
    
    // Calculate centroid
    const centroid = calculateCentroid(chunk);
    
    // Filter pages by coherence
    const coherentPages = chunk.filter(page => {
      const similarity = cosineSimilarity(page.vector!, centroid);
      return similarity >= config.minCoherence;
    });
    
    if (coherentPages.length < config.minPagesPerSession) {
      continue; // Not coherent enough
    }
    
    // Calculate final coherence score
    const coherenceScore = calculateCoherence(coherentPages, centroid);
    
    // Generate session
    const session = await createSession(coherentPages, centroid, coherenceScore);
    
    // Check if session is too old
    const ageHours = (Date.now() - session.lastTimestamp) / (1000 * 60 * 60);
    if (ageHours > config.maxSessionAgeHours) {
      continue; // Too old
    }
    
    sessions.push(session);
  }
  
  return sessions;
}

/**
 * Split pages into chunks based on time gaps
 */
function splitByTimeGaps(pages: PageDigest[], gapMinutes: number): PageDigest[][] {
  const chunks: PageDigest[][] = [];
  let currentChunk: PageDigest[] = [];
  
  const gapMs = gapMinutes * 60 * 1000;
  
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    
    if (currentChunk.length === 0) {
      currentChunk.push(page);
      continue;
    }
    
    const lastPage = currentChunk[currentChunk.length - 1];
    const gap = page.timestamp - lastPage.timestamp;
    
    if (gap > gapMs) {
      // Gap too large, start new chunk
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
      currentChunk = [page];
    } else {
      currentChunk.push(page);
    }
  }
  
  // Add final chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * Calculate centroid (average) of page vectors
 */
function calculateCentroid(pages: PageDigest[]): Float32Array {
  const dim = pages[0].vector!.length;
  const centroid = new Float32Array(dim);
  
  for (const page of pages) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += page.vector![i];
    }
  }
  
  // Normalize
  for (let i = 0; i < dim; i++) {
    centroid[i] /= pages.length;
  }
  
  return centroid;
}

/**
 * Calculate coherence score (avg cosine similarity to centroid)
 */
function calculateCoherence(pages: PageDigest[], centroid: Float32Array): number {
  const similarities = pages.map(p => cosineSimilarity(p.vector!, centroid));
  return similarities.reduce((a, b) => a + b, 0) / similarities.length;
}

/**
 * Cosine similarity between two vectors
 * CRITICAL FIX #6: Added comprehensive null checks and validation
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  // CRITICAL: Validate inputs
  if (!a || !b) {
    console.error('[Sessionizer] Null vector in cosineSimilarity');
    return 0;
  }
  
  if (a.length !== b.length) {
    console.error('[Sessionizer] Vector dimension mismatch:', a.length, 'vs', b.length);
    return 0;
  }
  
  if (a.length === 0) {
    console.error('[Sessionizer] Empty vectors');
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    // Check for NaN
    if (isNaN(a[i]) || isNaN(b[i])) {
      console.error('[Sessionizer] NaN in vectors at index', i);
      return 0;
    }
    
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  
  if (magnitude === 0) {
    console.warn('[Sessionizer] Zero magnitude vectors');
    return 0;
  }

  const similarity = dotProduct / magnitude;
  
  // Clamp to valid range (floating point errors)
  return Math.max(-1, Math.min(1, similarity));
}

/**
 * Create TaskSession from coherent pages
 */
async function createSession(
  pages: PageDigest[],
  centroid: Float32Array,
  coherenceScore: number
): Promise<TaskSession> {
  const firstPage = pages[0];
  const lastPage = pages[pages.length - 1];
  
  // Generate deterministic session ID
  const sessionId = await generateSessionId(firstPage);
  
  // Extract dominant category
  const categoryFreq = new Map<string, number>();
  for (const page of pages) {
    categoryFreq.set(page.category, (categoryFreq.get(page.category) || 0) + 1);
  }
  const dominantCategory = Array.from(categoryFreq.entries())
    .sort((a, b) => b[1] - a[1])[0][0];
  
  // Extract top entities for title
  const entityFreq = new Map<string, number>();
  for (const page of pages) {
    for (const entity of page.entities) {
      entityFreq.set(entity, (entityFreq.get(entity) || 0) + 1);
    }
  }
  
  const topEntities = Array.from(entityFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(e => e[0]);
  
  // Generate title
  const title = generateSessionTitle(topEntities, dominantCategory, entityFreq);
  
  return {
    id: sessionId,
    title,
    pageIds: pages.map(p => p.urlHash),
    pageCount: pages.length,
    coherenceScore,
    firstTimestamp: firstPage.timestamp,
    lastTimestamp: lastPage.timestamp,
    category: dominantCategory,
    entities: topEntities,
    centroid,
    createdAt: Date.now(),
    dismissed: false,
  };
}

/**
 * Generate deterministic session ID
 * Uses first page URL hash + hour bucket for stability
 */
export async function generateSessionId(firstPage: PageDigest): Promise<string> {
  // Round to nearest hour to keep ID stable
  const hourBucket = Math.floor(firstPage.timestamp / (1000 * 60 * 60));
  const input = `${firstPage.urlHash}-${hourBucket}`;
  return await sha256(input);
}

/**
 * Generate human-readable session title
 * Fallback hierarchy:
 *   1. Top entity (if freq >= 2)
 *   2. Category (e.g., "Shopping")
 *   3. Generic "Browsing Session"
 */
function generateSessionTitle(
  entities: string[],
  category: string,
  entityFreq: Map<string, number>
): string {
  // Try top entity (if appears in multiple pages)
  if (entities.length > 0 && entities[0]) {
    const topEntityFreq = entityFreq.get(entities[0]) || 0;
    if (topEntityFreq >= 2) {
      return `Researching ${entities[0]}`;
    }
  }
  
  // Try category
  if (category && category !== 'general') {
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    return `${categoryName} Session`;
  }
  
  // Fallback to generic
  return 'Browsing Session';
}

