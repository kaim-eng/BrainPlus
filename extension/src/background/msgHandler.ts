/**
 * Message handler for inter-component communication
 */

import type { BaseMessage } from '@/lib/types';
import { queuePageForAnalysis, processInferenceResult } from './handlers/pageAnalysis';
import { handleFetchDeals, handleDealClick } from './handlers/deals';
import { handleGetPoints, handleRedeemPoints } from './handlers/points';
import { ensureOffscreenDocument } from './offscreenManager';

/**
 * Route message to appropriate handler
 */
export async function handleMessage(
  message: BaseMessage,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  console.log('[MsgHandler] Received message:', message.type, 'from:', sender.tab?.id || 'popup');
  
  switch (message.type) {
    // Page analysis
    case 'ANALYZE_PAGE': {
      const msg = message as any;
      await queuePageForAnalysis(msg.url, msg.title, msg.features, msg.text);
      return { success: true, queued: true };
    }
    case 'RUN_INFERENCE':
      // Handled directly by offscreen document
      return { success: true };
    case 'INFERENCE_RESULT':
      return await processInferenceResult(message as any);
    
    // Search query embedding (ensure offscreen exists)
    case 'EMBED_QUERY': {
      console.log('[MsgHandler] EMBED_QUERY received, ensuring offscreen document exists');
      try {
        // Ensure offscreen document is created
        await ensureOffscreenDocument();
        
        // The message will be handled by the offscreen worker's listener
        // Just return success to indicate we've ensured the offscreen exists
        return { 
          success: true, 
          note: 'Offscreen document ready - please retry message' 
        };
      } catch (error) {
        console.error('[MsgHandler] Failed to ensure offscreen:', error);
        return { 
          success: false, 
          error: `Failed to create offscreen document: ${error instanceof Error ? error.message : String(error)}` 
        };
      }
    }
    
    // Update last accessed timestamp
    case 'UPDATE_LAST_ACCESSED': {
      const { urlHash } = (message as any).data;
      // Import db here to avoid circular dependency
      const { db } = await import('@/lib/db');
      await db.touchDigest(urlHash);
      return { success: true };
    }
    
    // Deals
    case 'FETCH_DEALS':
      return await handleFetchDeals(message as any);
    case 'DEAL_CLICK':
      return await handleDealClick(message as any);
    
    // Points
    case 'GET_POINTS':
      return await handleGetPoints();
    case 'REDEEM_POINTS':
      return await handleRedeemPoints(message as any);
    
    // Task Continuation (Session Management)
    case 'GET_PENDING_SESSION': {
      const { getPendingSession } = await import('./handlers/sessionHandler');
      return await getPendingSession();
    }
    
    case 'RESUME_SESSION': {
      const { sessionId, limitCount } = (message as any);
      const { getPendingSession, resumeSession } = await import('./handlers/sessionHandler');
      const pending = await getPendingSession();
      if (pending && pending.session.id === sessionId) {
        return await resumeSession(pending.session, limitCount);
      }
      return { success: false, error: 'Session not found or expired' };
    }
    
    case 'DISMISS_SESSION': {
      const { sessionId } = (message as any);
      const { dismissSession } = await import('./handlers/sessionHandler');
      await dismissSession(sessionId);
      return { success: true };
    }
    
    // AMA (Ask Me Anything) - One-time query (non-streaming)
    case 'AMA_QUERY': {
      const { handleAMAQueryOneTime } = await import('./handlers/amaHandler');
      return await handleAMAQueryOneTime(message as any);
    }
    
    // Debug: Forward offscreen logs
    case 'OFFSCREEN_LOG': {
      const logMsg = message as any;
      const prefix = `[Offscreen->${logMsg.level}]`;
      if (logMsg.level === 'error') {
        console.error(prefix, ...logMsg.args);
      } else if (logMsg.level === 'warn') {
        console.warn(prefix, ...logMsg.args);
      } else {
        console.log(prefix, ...logMsg.args);
      }
      return { success: true };
    }
    
    default:
      console.warn('[MsgHandler] Unknown message type:', message.type);
      return { success: false, error: 'Unknown message type' };
  }
}

