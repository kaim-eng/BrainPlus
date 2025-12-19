/**
 * Offscreen Document
 * Handles heavy computation: ML embeddings with TensorFlow.js
 */

// Forward only errors to background for debugging
const originalError = console.error;

console.error = (...args) => {
  originalError(...args);
  chrome.runtime.sendMessage({ type: 'OFFSCREEN_LOG', level: 'error', args: args.map(String) }).catch(() => {});
};

// Import TensorFlow.js worker - it has its own message listeners and handles everything
import './worker-tfjs';

// Import session clustering worker
import './worker-sessions';
