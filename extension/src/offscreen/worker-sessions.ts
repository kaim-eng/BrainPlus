/**
 * Session clustering worker (runs in offscreen document)
 * Handles heavy vector computations off main thread
 */

import type { PageDigest } from '@/lib/types';
import type { TaskSession, SessionizerConfig } from '@/lib/sessionizer';
import { detectTaskSessions } from '@/lib/sessionizer';

export interface ClusterRequest {
  type: 'CLUSTER_SESSIONS';
  pages: any[]; // Serialized PageDigest (vectors as arrays)
  config?: SessionizerConfig;
  requestId: string;
}

export interface ClusterResponse {
  type: 'CLUSTER_RESULT';
  sessions: TaskSession[];
  requestId: string;
  processingTimeMs: number;
}

// Handle clustering requests from background script
chrome.runtime.onMessage.addListener((request: ClusterRequest) => {
  if (request.type !== 'CLUSTER_SESSIONS') {
    return false;
  }
  
  console.log('[SessionWorker] Clustering request received:', request.requestId);
  const startTime = performance.now();
  
  (async () => {
    try {
      // Hydrate pages: Convert vector arrays back to Float32Array
      const pages: PageDigest[] = request.pages.map(p => ({
        ...p,
        vector: p.vector ? new Float32Array(p.vector) : undefined,
        vectorBuf: p.vectorBuf || new ArrayBuffer(0),
      }));
      
      // Run clustering algorithm
      const sessions = await detectTaskSessions(pages, request.config);
      
      const processingTimeMs = performance.now() - startTime;
      console.log('[SessionWorker] Clustering complete:', sessions.length, 'sessions in', processingTimeMs.toFixed(1), 'ms');
      
      const response: ClusterResponse = {
        type: 'CLUSTER_RESULT',
        sessions,
        requestId: request.requestId,
        processingTimeMs,
      };
      
      // Send back to background via chrome.runtime.sendMessage
      chrome.runtime.sendMessage(response);
    } catch (error) {
      console.error('[SessionWorker] Clustering failed:', error);
      chrome.runtime.sendMessage({
        type: 'CLUSTER_ERROR',
        error: error instanceof Error ? error.message : String(error),
        requestId: request.requestId,
      });
    }
  })();
  
  return false; // We don't use sendResponse, we use chrome.runtime.sendMessage instead
});

// Export for import detection
export {};

