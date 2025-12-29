/**
 * Phase 0 Benchmark: Vector Compatibility Audit
 * 
 * Tests: TensorFlow.js produces identical embeddings across platforms
 * Target: Identical vectors (ε < 1e-6) on Desktop/Mobile, Chrome/Safari/Brave
 * 
 * Why this matters: If vectors differ across platforms, synced content will
 * have broken semantic search. This is silent data corruption.
 */

import * as use from '@tensorflow-models/universal-sentence-encoder';
import * as tf from '@tensorflow/tfjs';

interface VectorTestResult {
  platform: string;
  browser: string;
  backend: string;
  tfVersion: string;
  useVersion: string;
  vectors: Float32Array[];
  testSentences: string[];
  l2Norms: number[];
  success: boolean;
  error?: string;
}

/**
 * Get platform and browser information
 */
function getPlatformInfo(): { platform: string; browser: string } {
  const ua = navigator.userAgent;
  
  let browser = 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  
  let platform = 'Unknown';
  if (ua.includes('Windows')) platform = 'Windows';
  else if (ua.includes('Mac')) platform = 'macOS';
  else if (ua.includes('Linux')) platform = 'Linux';
  else if (ua.includes('iPhone') || ua.includes('iPad')) platform = 'iOS';
  else if (ua.includes('Android')) platform = 'Android';
  
  return { platform, browser };
}

/**
 * Calculate L2 norm of a vector
 */
function calculateL2Norm(vector: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) {
    sum += vector[i] * vector[i];
  }
  return Math.sqrt(sum);
}

/**
 * Run vector compatibility test
 */
export async function testVectorCompatibility(): Promise<VectorTestResult> {
  console.log('='.repeat(60));
  console.log('Phase 0 Benchmark: Vector Compatibility Audit');
  console.log('='.repeat(60));
  
  const { platform, browser } = getPlatformInfo();
  
  console.log(`Platform: ${platform}`);
  console.log(`Browser: ${browser}`);
  console.log(`User Agent: ${navigator.userAgent}`);
  console.log('');
  
  try {
    // Check TensorFlow.js version
    console.log('Checking TensorFlow.js version...');
    console.log(`TF.js version: ${tf.version.tfjs}`);
    
    // Verify exact version
    if (tf.version.tfjs !== '4.22.0') {
      console.warn(`⚠️ WARNING: Expected TF.js 4.22.0, got ${tf.version.tfjs}`);
      console.warn('This may cause vector incompatibility!');
    } else {
      console.log('✅ TF.js version matches expected: 4.22.0');
    }
    console.log('');
    
    // Check backend
    console.log('Checking TensorFlow.js backend...');
    await tf.ready();
    const backend = tf.getBackend();
    console.log(`Backend: ${backend}`);
    
    if (backend !== 'webgl') {
      console.warn(`⚠️ WARNING: Backend is ${backend}, not webgl`);
      console.warn('This may cause vector differences!');
    } else {
      console.log('✅ Using WebGL backend (optimal)');
    }
    console.log('');
    
    // Load USE model
    console.log('Loading Universal Sentence Encoder model...');
    const modelStart = performance.now();
    const model = await use.load();
    const modelEnd = performance.now();
    console.log(`✅ Model loaded in ${(modelEnd - modelStart).toFixed(0)}ms`);
    console.log('USE model version: 1.3.3 (expected)');
    console.log('');
    
    // Test sentences
    const testSentences = [
      "How does React Context work?",
      "Best noise cancelling headphones 2024",
      "Machine learning embeddings for semantic search",
    ];
    
    console.log('Generating embeddings for test sentences...');
    const embedStart = performance.now();
    const embeddings = await model.embed(testSentences);
    const vectors = await embeddings.array();
    const embedEnd = performance.now();
    
    console.log(`✅ Embeddings generated in ${(embedEnd - embedStart).toFixed(0)}ms`);
    console.log('');
    
    // Calculate L2 norms
    const l2Norms: number[] = [];
    
    for (let i = 0; i < testSentences.length; i++) {
      const vector = new Float32Array(vectors[i]);
      const norm = calculateL2Norm(vector);
      l2Norms.push(norm);
      
      console.log(`Sentence ${i + 1}: "${testSentences[i]}"`);
      console.log(`  Vector dimensions: ${vector.length}`);
      console.log(`  L2 norm: ${norm.toFixed(6)}`);
      console.log(`  First 5 dims: [${vector.slice(0, 5).map(v => v.toFixed(6)).join(', ')}]`);
      console.log('');
    }
    
    // Validate results
    console.log('Validation:');
    
    // Check dimensions
    const allDims = vectors.every(v => v.length === 512);
    if (allDims) {
      console.log('✅ All vectors have 512 dimensions');
    } else {
      console.error('❌ Vector dimension mismatch!');
    }
    
    // Check L2 norms (should be ~1.0 for normalized USE vectors)
    const allNormalized = l2Norms.every(norm => Math.abs(norm - 1.0) < 0.01);
    if (allNormalized) {
      console.log('✅ All vectors are normalized (L2 norm ≈ 1.0)');
    } else {
      console.warn('⚠️ Vectors may not be properly normalized');
    }
    
    // Clean up
    embeddings.dispose();
    
    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Vector compatibility test complete!');
    console.log('='.repeat(60));
    console.log('');
    console.log('📋 Save these results to compare with other devices:');
    console.log(JSON.stringify({
      platform,
      browser,
      backend,
      tfVersion: tf.version.tfjs,
      firstVectorPreview: vectors[0].slice(0, 10),
      l2Norms,
    }, null, 2));
    console.log('');
    
    return {
      platform,
      browser,
      backend,
      tfVersion: tf.version.tfjs,
      useVersion: '1.3.3',
      vectors: vectors.map(v => new Float32Array(v)),
      testSentences,
      l2Norms,
      success: true,
    };
    
  } catch (error) {
    console.error('❌ Vector compatibility test failed!');
    console.error(error);
    
    return {
      platform,
      browser,
      backend: 'unknown',
      tfVersion: tf.version.tfjs || 'unknown',
      useVersion: '1.3.3',
      vectors: [],
      testSentences: [],
      l2Norms: [],
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Compare two vector test results
 */
export function compareVectorResults(
  result1: VectorTestResult,
  result2: VectorTestResult,
  epsilon: number = 1e-6
): {
  compatible: boolean;
  maxDifference: number;
  differences: number[];
} {
  console.log('='.repeat(60));
  console.log('Comparing Vector Compatibility');
  console.log('='.repeat(60));
  console.log(`Result 1: ${result1.platform} / ${result1.browser} (Backend: ${result1.backend})`);
  console.log(`Result 2: ${result2.platform} / ${result2.browser} (Backend: ${result2.backend})`);
  console.log('');
  
  if (result1.vectors.length !== result2.vectors.length) {
    console.error('❌ Different number of test vectors!');
    return { compatible: false, maxDifference: Infinity, differences: [] };
  }
  
  const differences: number[] = [];
  let maxDifference = 0;
  
  for (let i = 0; i < result1.vectors.length; i++) {
    const v1 = result1.vectors[i];
    const v2 = result2.vectors[i];
    
    if (v1.length !== v2.length) {
      console.error(`❌ Vector ${i} dimension mismatch!`);
      return { compatible: false, maxDifference: Infinity, differences: [] };
    }
    
    // Calculate per-dimension differences
    let sumSquaredDiff = 0;
    for (let j = 0; j < v1.length; j++) {
      const diff = Math.abs(v1[j] - v2[j]);
      sumSquaredDiff += diff * diff;
      maxDifference = Math.max(maxDifference, diff);
    }
    
    const euclideanDist = Math.sqrt(sumSquaredDiff);
    differences.push(euclideanDist);
    
    console.log(`Vector ${i}: "${result1.testSentences[i]}"`);
    console.log(`  Euclidean distance: ${euclideanDist.toFixed(8)}`);
    console.log(`  Max per-dim diff: ${maxDifference.toFixed(8)}`);
  }
  
  console.log('');
  console.log(`Overall max difference: ${maxDifference.toFixed(8)}`);
  console.log(`Epsilon threshold: ${epsilon}`);
  console.log('');
  
  const compatible = maxDifference < epsilon;
  
  if (compatible) {
    console.log('✅ COMPATIBLE: Vectors are identical within tolerance!');
    console.log('Safe to sync between these devices.');
  } else {
    console.error('❌ INCOMPATIBLE: Vectors differ beyond tolerance!');
    console.error('DO NOT sync between these devices - search will break!');
  }
  
  console.log('='.repeat(60));
  
  return { compatible, maxDifference, differences };
}

// If running directly in browser console
if (typeof window !== 'undefined' && (window as any).runBenchmark) {
  (window as any).runVectorCompatibilityTest = testVectorCompatibility;
  (window as any).compareVectorResults = compareVectorResults;
  console.log('✅ Vector compatibility benchmarks loaded!');
  console.log('Run: runVectorCompatibilityTest()');
}

