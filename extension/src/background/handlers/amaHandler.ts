/**
 * AMA (Ask Me Anything) Handler
 * Design Doc: AMA_DESIGN_REVIEW.md, Phase 1
 * 
 * Phase 1: Extractive MVP (no LLM)
 * - Retrieves relevant passages
 * - Composes extractive answer from passages
 * - Returns sources with citations
 * 
 * Phase 2: LLM-powered (future)
 * - Integrates WebLLM for natural language generation
 * - Adds streaming tokens
 * - Adds post-compose verifier
 */

import { retrievePassages } from '@/lib/search';
import type { 
  AMAQueryMessage, 
  AMASourcesMessage, 
  AMADoneMessage,
  AMAErrorMessage,
  AMASource,
  AMAMetrics,
  RankedPassage 
} from '@/lib/types';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_MAX_SOURCES = 12;
const MAX_ANSWER_SENTENCES = 5; // For extractive answer

// ============================================================================
// Extractive Answer Composition (Phase 1 MVP)
// ============================================================================

/**
 * Compose extractive answer from top passages
 * 
 * Strategy:
 * 1. Take top N passages
 * 2. Extract most relevant sentences
 * 3. Add inline citations [1], [2], etc.
 * 4. Return concatenated answer
 * 
 * This is a simple MVP - Phase 2 will use LLM for better synthesis
 */
function composeExtractiveAnswer(
  rankedPassages: RankedPassage[],
  maxSentences: number = MAX_ANSWER_SENTENCES
): string {
  if (rankedPassages.length === 0) {
    return "I don't find that in your local history.";
  }
  
  const sentences: string[] = [];
  
  // Extract sentences from top passages
  for (let i = 0; i < Math.min(rankedPassages.length, maxSentences); i++) {
    const passage = rankedPassages[i];
    const citationId = i + 1;
    
    // Split passage into sentences
    const passageSentences = passage.passage.text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20); // Filter short fragments
    
    if (passageSentences.length > 0) {
      // Take first sentence (most relevant)
      const sentence = passageSentences[0];
      sentences.push(`${sentence}. [${citationId}]`);
    }
  }
  
  if (sentences.length === 0) {
    return "I don't find that in your local history.";
  }
  
  return sentences.join(' ');
}

/**
 * Format relative date (e.g., "2 days ago")
 */
function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

/**
 * Convert ranked passages to AMA sources
 */
function buildSources(rankedPassages: RankedPassage[]): AMASource[] {
  return rankedPassages.map((rp, idx) => ({
    citationId: idx + 1,
    title: rp.page.title,
    url: rp.page.url,
    domain: extractDomain(rp.page.url),
    snippet: rp.passage.text.slice(0, 200) + '...', // First 200 chars
    dateRelative: formatRelativeDate(rp.page.timestamp),
    timestamp: rp.page.timestamp,
    relevanceScore: rp.finalScore,
  }));
}

// ============================================================================
// Main AMA Handler
// ============================================================================

/**
 * Handle AMA query
 * 
 * Phase 1: Extractive answer (no LLM)
 * Phase 2: Will add LLM streaming
 */
export async function handleAMAQuery(
  message: AMAQueryMessage,
  port?: chrome.runtime.Port
): Promise<void> {
  
  const startTime = performance.now();
  const requestId = `ama-${Date.now()}`;
  
  try {
    console.log('[AMA] Processing query:', message.query);
    
    const maxSources = message.maxSources || DEFAULT_MAX_SOURCES;
    
    // 1. Retrieve relevant passages
    const retrievalStart = performance.now();
    const rankedPassages = await retrievePassages(message.query, maxSources);
    const retrievalTime = performance.now() - retrievalStart;
    
    if (rankedPassages.length === 0) {
      // No results found
      const errorMsg: AMAErrorMessage = {
        type: 'AMA_ERROR',
        error: "I don't find that in your local history.",
        requestId,
        timestamp: Date.now(),
      };
      
      if (port) {
        port.postMessage(errorMsg);
      }
      
      return;
    }
    
    // 2. Build sources
    const sources = buildSources(rankedPassages);
    
    // Send sources immediately (before answer)
    const sourcesMsg: AMASourcesMessage = {
      type: 'AMA_SOURCES',
      sources,
      requestId,
      timestamp: Date.now(),
    };
    
    if (port) {
      port.postMessage(sourcesMsg);
    }
    
    // 3. Compose extractive answer (Phase 1 MVP)
    const answer = composeExtractiveAnswer(rankedPassages);
    
    // Send answer as single token (Phase 2 will stream)
    if (port) {
      port.postMessage({
        type: 'AMA_TOKEN',
        token: answer,
        requestId,
        timestamp: Date.now(),
      });
    }
    
    // 4. Send completion
    const totalTime = performance.now() - startTime;
    
    const metrics: AMAMetrics = {
      retrievalTimeMs: retrievalTime,
      embeddingTimeMs: 0, // Included in retrievalTime
      rankingTimeMs: 0,   // Included in retrievalTime
      totalTimeMs: totalTime,
      sourcesCount: sources.length,
    };
    
    const doneMsg: AMADoneMessage = {
      type: 'AMA_DONE',
      requestId,
      metrics,
      timestamp: Date.now(),
    };
    
    if (port) {
      port.postMessage(doneMsg);
    }
    
    console.log(`[AMA] Query complete in ${totalTime.toFixed(0)}ms (${sources.length} sources)`);
    
  } catch (error) {
    console.error('[AMA] Error processing query:', error);
    
    const errorMsg: AMAErrorMessage = {
      type: 'AMA_ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      timestamp: Date.now(),
    };
    
    if (port) {
      port.postMessage(errorMsg);
    }
  }
}

/**
 * Handle AMA query from one-time message (non-streaming)
 * Used when port connection is not available
 */
export async function handleAMAQueryOneTime(
  message: AMAQueryMessage
): Promise<{
  success: boolean;
  sources?: AMASource[];
  answer?: string;
  metrics?: AMAMetrics;
  error?: string;
}> {
  
  const startTime = performance.now();
  
  try {
    console.log('[AMA] Processing one-time query:', message.query);
    
    const maxSources = message.maxSources || DEFAULT_MAX_SOURCES;
    
    // 1. Retrieve relevant passages
    const retrievalStart = performance.now();
    const rankedPassages = await retrievePassages(message.query, maxSources);
    const retrievalTime = performance.now() - retrievalStart;
    
    if (rankedPassages.length === 0) {
      return {
        success: false,
        error: "I don't find that in your local history.",
      };
    }
    
    // 2. Build sources
    const sources = buildSources(rankedPassages);
    
    // 3. Compose extractive answer
    const answer = composeExtractiveAnswer(rankedPassages);
    
    // 4. Return result
    const totalTime = performance.now() - startTime;
    
    const metrics: AMAMetrics = {
      retrievalTimeMs: retrievalTime,
      embeddingTimeMs: 0,
      rankingTimeMs: 0,
      totalTimeMs: totalTime,
      sourcesCount: sources.length,
    };
    
    return {
      success: true,
      sources,
      answer,
      metrics,
    };
    
  } catch (error) {
    console.error('[AMA] Error processing one-time query:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}



