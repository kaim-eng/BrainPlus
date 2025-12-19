/**
 * Text Chunking for RAG (Passage Generation)
 * Design Doc: AMA_DESIGN_REVIEW.md, Phase 0 Week 2
 * 
 * Purpose: Split long pages into passages (512-1024 tokens each)
 * Strategy: Sentence-aware chunking with overlap for context continuity
 * 
 * Conditional Generation:
 * - Only chunk pages with:
 *   1. fullText > 2000 chars (~500 tokens)
 *   2. intentScore > 0.6 (high-intent pages)
 */

import type { PageDigest, Passage } from './types';

// ============================================================================
// Configuration
// ============================================================================

const MIN_TEXT_LENGTH = 2000;        // Min chars to chunk (otherwise use page-level)
const MIN_INTENT_SCORE = 0.5;        // Min intent score to chunk (matches fullText storage threshold)
const TARGET_CHUNK_SIZE = 3000;      // Target chars per chunk (~750 tokens)
const MAX_CHUNK_SIZE = 4000;         // Max chars per chunk (~1000 tokens)
const OVERLAP_SIZE = 500;            // Overlap chars (~125 tokens)

// ============================================================================
// Sentence Tokenization
// ============================================================================

/**
 * Split text into sentences (simple regex-based)
 * Handles common abbreviations and edge cases
 */
function splitIntoSentences(text: string): string[] {
  // Clean up text
  text = text.trim().replace(/\s+/g, ' ');
  
  // Split on sentence boundaries
  // Handles: . ! ? followed by space and capital letter
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
  
  return sentences.filter(s => s.length > 10); // Filter out very short fragments
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 chars)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ============================================================================
// Chunking Logic
// ============================================================================

/**
 * Check if page should be chunked into passages
 */
export function shouldChunkPage(page: PageDigest): boolean {
  // Must have fullText
  if (!page.fullText || page.fullText.length < MIN_TEXT_LENGTH) {
    return false;
  }
  
  // Must be high-intent (important content)
  if (page.intentScore < MIN_INTENT_SCORE) {
    return false;
  }
  
  return true;
}

/**
 * Chunk text into passages with sentence-aware boundaries
 * 
 * Algorithm:
 * 1. Split text into sentences
 * 2. Group sentences into chunks (target size: 512-1024 tokens)
 * 3. Add overlap between chunks (128 tokens) for context
 * 4. Return array of passage texts
 */
export function chunkText(text: string): string[] {
  const sentences = splitIntoSentences(text);
  
  if (sentences.length === 0) {
    return [];
  }
  
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceLength = sentence.length;
    
    // Check if adding this sentence would exceed max chunk size
    if (currentLength + sentenceLength > MAX_CHUNK_SIZE && currentChunk.length > 0) {
      // Finalize current chunk
      chunks.push(currentChunk.join(' '));
      
      // Start new chunk with overlap
      // Include last 1-2 sentences from previous chunk for context
      const overlapSentences = currentChunk.slice(-2); // Last 2 sentences
      const overlapText = overlapSentences.join(' ');
      
      if (overlapText.length <= OVERLAP_SIZE) {
        currentChunk = overlapSentences;
        currentLength = overlapText.length;
      } else {
        // If last 2 sentences are too long, just use last sentence
        currentChunk = [currentChunk[currentChunk.length - 1]];
        currentLength = currentChunk[0].length;
      }
    }
    
    // Add sentence to current chunk
    currentChunk.push(sentence);
    currentLength += sentenceLength + 1; // +1 for space
    
    // If current chunk is at target size, finalize it
    if (currentLength >= TARGET_CHUNK_SIZE) {
      chunks.push(currentChunk.join(' '));
      
      // Start new chunk with overlap
      const overlapSentences = currentChunk.slice(-2);
      const overlapText = overlapSentences.join(' ');
      
      if (overlapText.length <= OVERLAP_SIZE) {
        currentChunk = overlapSentences;
        currentLength = overlapText.length;
      } else {
        currentChunk = [currentChunk[currentChunk.length - 1]];
        currentLength = currentChunk[0].length;
      }
    }
  }
  
  // Add final chunk if not empty
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  
  return chunks;
}

/**
 * Generate passages from a page digest
 * 
 * @param page - PageDigest with fullText
 * @returns Array of Passage objects (without embeddings - embeddings generated separately)
 */
export function generatePassages(
  page: PageDigest
): Omit<Passage, 'embedding' | 'embeddingBuf'>[] {
  // Check if should chunk
  if (!shouldChunkPage(page)) {
    return [];
  }
  
  // Chunk text
  const chunks = chunkText(page.fullText!);
  
  if (chunks.length === 0) {
    return [];
  }
  
  // Generate passage objects
  const passages: Omit<Passage, 'embedding' | 'embeddingBuf'>[] = chunks.map((text, idx) => ({
    passageId: `${page.urlHash}:${idx}`,
    urlHash: page.urlHash,
    chunkIdx: idx,
    text,
    tsFuzzy: page.tsFuzzy,
    category: page.category,
    createdAt: Date.now(),
  }));
  
  return passages;
}

/**
 * Get passage statistics (for debugging/monitoring)
 */
export function getPassageStats(passages: Omit<Passage, 'embedding' | 'embeddingBuf'>[]): {
  count: number;
  avgLength: number;
  minLength: number;
  maxLength: number;
  avgTokens: number;
} {
  if (passages.length === 0) {
    return {
      count: 0,
      avgLength: 0,
      minLength: 0,
      maxLength: 0,
      avgTokens: 0,
    };
  }
  
  const lengths = passages.map(p => p.text.length);
  const totalLength = lengths.reduce((sum, len) => sum + len, 0);
  
  return {
    count: passages.length,
    avgLength: Math.round(totalLength / passages.length),
    minLength: Math.min(...lengths),
    maxLength: Math.max(...lengths),
    avgTokens: Math.round(estimateTokens(passages[0].text)),
  };
}

/**
 * Truncate text to approximate token count
 * Useful for limiting passage size
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  
  // Truncate at sentence boundary if possible
  const truncated = text.slice(0, maxChars);
  const sentences = splitIntoSentences(truncated);
  
  if (sentences.length > 0) {
    return sentences.join(' ');
  }
  
  // Fall back to word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
}

