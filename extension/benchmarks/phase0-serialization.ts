/**
 * Phase 0 Benchmark: Serialization Performance
 * CRITICAL: Run this FIRST on low-end mobile devices
 * 
 * Tests: Float32Array → Base64 conversion performance
 * Target: < 500ms for 100 pages on low-end mobile (iPhone 8, MediaTek Helio G85)
 * 
 * Why this matters: If serialization is too slow, UI will freeze during sync.
 */

interface MockPageDigest {
  vectorBuf: ArrayBuffer;
  title: string;
  summary: string;
  url: string;
  timestamp: number;
}

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate mock PageDigests with realistic vector data
 */
function generateMockPages(count: number): MockPageDigest[] {
  const pages: MockPageDigest[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate 512-dimensional vector (same as USE)
    const vector = new Float32Array(512);
    for (let j = 0; j < 512; j++) {
      vector[j] = Math.random() * 2 - 1; // Random values between -1 and 1
    }
    
    pages.push({
      vectorBuf: vector.buffer.slice(0) as ArrayBuffer,
      title: `Test Page ${i}`,
      summary: `This is a test summary for page ${i}. It contains some sample text to simulate real page data.`,
      url: `https://example.com/page-${i}`,
      timestamp: Date.now() - (i * 1000),
    });
  }
  
  return pages;
}

/**
 * Benchmark serialization performance
 */
export async function benchmarkSerialization(batchSize: number = 100): Promise<{
  serializeTimeMs: number;
  deserializeTimeMs: number;
  totalTimeMs: number;
  batchSize: number;
  verdict: 'PASS' | 'WARNING' | 'FAIL';
  recommendation: string;
}> {
  console.log('='.repeat(60));
  console.log('Phase 0 Benchmark: Serialization Performance');
  console.log('='.repeat(60));
  console.log(`Batch size: ${batchSize} pages`);
  console.log('Vector size: 512 dims × 4 bytes = 2048 bytes per vector');
  console.log(`Total data: ~${(batchSize * 2048 / 1024).toFixed(0)}KB`);
  console.log('');
  
  // Generate mock data
  console.log('Generating mock pages...');
  const mockPages = generateMockPages(batchSize);
  console.log(`✅ Generated ${batchSize} pages`);
  console.log('');
  
  // Benchmark: Serialize (ArrayBuffer → Base64)
  console.log('Starting serialization benchmark...');
  const serializeStart = performance.now();
  
  const serialized = mockPages.map(page => ({
    ...page,
    vectorBuf: arrayBufferToBase64(page.vectorBuf),
  }));
  
  const serializeEnd = performance.now();
  const serializeTimeMs = serializeEnd - serializeStart;
  
  console.log(`✅ Serialization: ${serializeTimeMs.toFixed(2)}ms`);
  console.log('');
  
  // Benchmark: Deserialize (Base64 → ArrayBuffer)
  console.log('Starting deserialization benchmark...');
  const deserializeStart = performance.now();
  
  const deserialized = serialized.map(page => ({
    ...page,
    vectorBuf: base64ToArrayBuffer(page.vectorBuf as any),
  }));
  
  const deserializeEnd = performance.now();
  const deserializeTimeMs = deserializeEnd - deserializeStart;
  
  console.log(`✅ Deserialization: ${deserializeTimeMs.toFixed(2)}ms`);
  console.log('');
  
  // Total round-trip time
  const totalTimeMs = serializeTimeMs + deserializeTimeMs;
  console.log(`📊 Total round-trip: ${totalTimeMs.toFixed(2)}ms`);
  console.log('');
  
  // Determine verdict and recommendation
  let verdict: 'PASS' | 'WARNING' | 'FAIL';
  let recommendation: string;
  
  if (serializeTimeMs > 500) {
    verdict = 'FAIL';
    recommendation = '❌ FAIL: Serialization took > 500ms. UI will freeze! REQUIRED: Move to Web Worker or reduce batch size to 50.';
    console.error(recommendation);
  } else if (serializeTimeMs > 200) {
    verdict = 'WARNING';
    recommendation = '⚠️ WARNING: Serialization took > 200ms. Noticeable lag. RECOMMEND: Use Web Worker for batches > 100 pages.';
    console.warn(recommendation);
  } else {
    verdict = 'PASS';
    recommendation = '✅ PASS: Serialization is acceptable for main thread.';
    console.log(recommendation);
  }
  
  console.log('');
  console.log('='.repeat(60));
  
  return {
    serializeTimeMs,
    deserializeTimeMs,
    totalTimeMs,
    batchSize,
    verdict,
    recommendation,
  };
}

/**
 * Run benchmark with multiple batch sizes
 */
export async function benchmarkMultipleSizes(): Promise<void> {
  const sizes = [50, 100, 200];
  const results = [];
  
  for (const size of sizes) {
    const result = await benchmarkSerialization(size);
    results.push(result);
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log('SUMMARY: Multiple Batch Sizes');
  console.log('='.repeat(60));
  
  for (const result of results) {
    console.log(`Batch ${result.batchSize}: ${result.serializeTimeMs.toFixed(2)}ms - ${result.verdict}`);
  }
  
  console.log('='.repeat(60));
  
  // Overall recommendation
  const allPass = results.every(r => r.verdict === 'PASS');
  const anyFail = results.some(r => r.verdict === 'FAIL');
  
  if (anyFail) {
    console.error('\n❌ OVERALL: FAIL - Reduce batch size or implement Web Worker before Phase 1');
  } else if (allPass) {
    console.log('\n✅ OVERALL: PASS - Serialization performance is acceptable');
  } else {
    console.warn('\n⚠️ OVERALL: WARNING - Monitor performance on low-end devices');
  }
}

// If running directly in browser console or Node.js
if (typeof window !== 'undefined' && (window as any).runBenchmark) {
  (window as any).runSerializationBenchmark = benchmarkSerialization;
  (window as any).runMultipleSizes = benchmarkMultipleSizes;
  console.log('✅ Serialization benchmarks loaded!');
  console.log('Run: runSerializationBenchmark() or runMultipleSizes()');
}

