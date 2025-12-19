/**
 * Offscreen Worker with TensorFlow.js
 * Uses Universal Sentence Encoder for embeddings
 */

import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';
import { removeStopwords } from 'stopword';

// ============================================================================
// Model Configuration
// ============================================================================

const MODEL_NAME = 'universal-sentence-encoder';
const EMBEDDING_DIM = 512; // USE produces 512-dimensional embeddings
const MAX_LENGTH = 256; // Max tokens for USE

// ============================================================================
// Model State
// ============================================================================

let model: use.UniversalSentenceEncoder | null = null;
let modelLoaded = false;
let modelLoading = false;
let loadError: string | null = null;

// ============================================================================
// Query Embedding Cache (LRU)
// ============================================================================

const queryCache = new Map<string, Float32Array>();
const CACHE_SIZE = 10;

/**
 * Get embedding from cache or generate new one
 */
async function embedWithCache(text: string): Promise<Float32Array> {
  // Check cache
  const cached = queryCache.get(text);
  if (cached) {
    return cached;
  }
  
  // Generate new embedding
  const vector = await generateEmbedding(text);
  
  // Add to cache (LRU eviction)
  if (queryCache.size >= CACHE_SIZE) {
    const firstKey = queryCache.keys().next().value;
    queryCache.delete(firstKey!);
  }
  queryCache.set(text, vector);
  
  return vector;
}

// ============================================================================
// Model Loading
// ============================================================================

/**
 * Load Universal Sentence Encoder
 */
async function loadModel(): Promise<void> {
  if (modelLoaded) {
    return;
  }

  if (modelLoading) {
    // Wait for existing load to complete
    while (modelLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }

  modelLoading = true;

  try {
    const startTime = performance.now();

    // Set backend to WebGL (best performance) - only if not already set
    if (tf.getBackend() !== 'webgl') {
      await tf.setBackend('webgl');
    }
    await tf.ready();

    // Load Universal Sentence Encoder
    model = await use.load();

    const loadTime = performance.now() - startTime;
    console.log(`[Worker] Model loaded in ${(loadTime / 1000).toFixed(2)}s`);

    modelLoaded = true;
    loadError = null;
  } catch (error) {
    console.error('[Worker] Model load failed:', error);
    loadError = String(error);
    throw error;
  } finally {
    modelLoading = false;
  }
}

// ============================================================================
// Vector Normalization
// ============================================================================

/**
 * L2 normalize a vector (unit vector)
 * After normalization, dot product = cosine similarity
 */
function l2Normalize(v: Float32Array): Float32Array {
  if (!v || v.length === 0) {
    throw new Error('[L2] Invalid vector: empty or undefined');
  }
  
  // Calculate L2 norm
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    if (!isFinite(v[i])) {
      console.warn('[L2] Non-finite value at index', i, v[i]);
      v[i] = 0; // Sanitize
    }
    sum += v[i] * v[i];
  }
  
  const norm = Math.sqrt(sum);
  if (norm < 1e-10) {
    console.warn('[L2] Near-zero norm, returning zero vector');
    return new Float32Array(v.length);
  }
  
  // Normalize
  const inv = 1 / norm;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) {
    out[i] = v[i] * inv;
  }
  
  return out;
}

/**
 * Verify vector is normalized (for testing)
 */
function verifyNormalized(v: Float32Array): boolean {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i] * v[i];
  }
  const norm = Math.sqrt(sum);
  const isNormalized = Math.abs(norm - 1.0) < 1e-6;
  
  if (!isNormalized) {
    console.warn(`[L2] Norm verification failed: ||v|| = ${norm} (expected 1.0)`);
  }
  
  return isNormalized;
}

// ============================================================================
// Embedding Generation
// ============================================================================

/**
 * Generate embedding for text using Universal Sentence Encoder
 * @param text - Input text
 * @returns 512-dimensional L2-normalized embedding
 */
async function generateEmbedding(text: string): Promise<Float32Array> {
  try {
    if (!modelLoaded) {
      try {
        await loadModel();
      } catch (error) {
        console.warn('[Worker] Model loading failed, using fallback');
        return l2Normalize(generateFallbackEmbedding());
      }
    }

    if (!model) {
      console.warn('[Worker] No model available, using fallback embedding');
      return l2Normalize(generateFallbackEmbedding());
    }

    // Truncate text if too long
    const truncated = text.slice(0, MAX_LENGTH * 6); // Rough: ~6 chars per token

    // Generate embedding
    const embeddings = await model.embed([truncated]);
    
    // Extract as Float32Array
    const embeddingData = await embeddings.data();
    const embedding = new Float32Array(embeddingData);

    // Clean up tensor
    embeddings.dispose();
    
    // Verify dimensions
    if (embedding.length !== EMBEDDING_DIM) {
      console.warn(`[Worker] Unexpected embedding dimensions: ${embedding.length} (expected ${EMBEDDING_DIM})`);
    }

    // L2 normalize for efficient cosine similarity (dot product)
    const normalized = l2Normalize(embedding);
    
    // Verify normalization (in dev mode)
    if (process.env.NODE_ENV === 'development') {
      verifyNormalized(normalized);
    }

    return normalized;
  } catch (error) {
    console.error('[Worker] Embedding generation failed:', error);
    return l2Normalize(generateFallbackEmbedding());
  }
}

/**
 * Generate fallback random embedding
 */
function generateFallbackEmbedding(): Float32Array {
  const fallbackEmbedding = new Float32Array(EMBEDDING_DIM);
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    fallbackEmbedding[i] = Math.random() * 2 - 1;
  }
  console.warn('[Worker] Generated fallback embedding');
  return fallbackEmbedding;
}

// ============================================================================
// Keyword Extraction
// ============================================================================

/**
 * Extract keywords from text using stopword removal and frequency
 */
function extractKeywords(text: string): string[] {
  // Tokenize
  let words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3); // Min 4 chars

  // Remove stopwords
  words = removeStopwords(words);

  // Count frequency
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  // Sort by frequency
  const sorted = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10) // Top 10
    .map(([word]) => word);

  return sorted;
}

// ============================================================================
// Message Handling
// ============================================================================

/**
 * Handle RUN_INFERENCE message from background
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'RUN_INFERENCE') {
    handleInference(message.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: String(error) }));
    
    return true; // Async response
  }

  if (message.type === 'LOAD_MODEL') {
    loadModel()
      .then(() => sendResponse({ success: true, loaded: modelLoaded }))
      .catch(error => sendResponse({ success: false, error: String(error) }));
    
    return true; // Async response
  }

  if (message.type === 'MODEL_STATUS') {
    sendResponse({
      success: true,
      data: {
        loaded: modelLoaded,
        loading: modelLoading,
        error: loadError,
        backend: modelLoaded ? tf.getBackend() : null,
        memory: modelLoaded ? tf.memory() : null,
      },
    });
    return false;
  }

  if (message.type === 'EMBED_QUERY') {
    embedQueryHandler(message.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => {
        console.error('[Offscreen Worker] EMBED_QUERY error:', error);
        sendResponse({ success: false, error: String(error) });
      });
    
    return true; // Async response
  }
});

/**
 * Handle query embedding (with caching)
 */
async function embedQueryHandler(data: any): Promise<any> {
  const { query } = data;

  if (!query || typeof query !== 'string') {
    throw new Error('Invalid input: query required');
  }

  const startTime = performance.now();

  try {
    // Use cache for queries
    const vector = await embedWithCache(query);

    const processingTime = performance.now() - startTime;

    return {
      vector: Array.from(vector),
      metadata: {
        embeddingDim: EMBEDDING_DIM,
        processingTimeMs: processingTime,
        cached: queryCache.has(query),
      },
    };
  } catch (error) {
    console.error('[Worker] Query embedding error:', error);
    throw error;
  }
}

/**
 * Process inference request
 */
async function handleInference(data: any): Promise<any> {
  const { text, features } = data;

  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text required');
  }

  const startTime = performance.now();

  try {
    // Generate embedding
    const vector = await generateEmbedding(text);

    // Extract keywords
    const entities = extractKeywords(text);

    // Calculate intent score (use heuristic as baseline)
    let intentScore = 0.5; // Default medium intent

    // Enhance based on features if provided
    if (features) {
      if (features.hasPrice && features.hasBuyNow) {
        intentScore = 0.9;
      } else if (features.hasPrice) {
        intentScore = 0.7;
      } else if (features.isKnownEcommerce) {
        intentScore = 0.6;
      }
    }

    const processingTime = performance.now() - startTime;

    return {
      vector: Array.from(vector), // Convert to regular array for message passing
      entities,
      intentScore,
      metadata: {
        modelName: MODEL_NAME,
        embeddingDim: EMBEDDING_DIM,
        processingTimeMs: processingTime,
        backend: modelLoaded ? tf.getBackend() : 'fallback',
      },
    };
  } catch (error) {
    console.error('[Worker] Inference error:', error);
    throw error;
  }
}

// ============================================================================
// Initialization
// ============================================================================

// Pre-load model after a short delay
setTimeout(() => {
  loadModel().catch(err => console.error('[Worker] Pre-load failed:', err));
}, 2000); // Wait 2s before loading

