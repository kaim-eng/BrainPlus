/**
 * Offscreen Document
 * Handles heavy computation: ML embeddings with TensorFlow.js
 */

// Forward all console logs to background for easier debugging
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args) => {
  originalLog(...args);
  chrome.runtime.sendMessage({ type: 'OFFSCREEN_LOG', level: 'log', args: args.map(String) }).catch(() => {});
};

console.warn = (...args) => {
  originalWarn(...args);
  chrome.runtime.sendMessage({ type: 'OFFSCREEN_LOG', level: 'warn', args: args.map(String) }).catch(() => {});
};

console.error = (...args) => {
  originalError(...args);
  chrome.runtime.sendMessage({ type: 'OFFSCREEN_LOG', level: 'error', args: args.map(String) }).catch(() => {});
};

// Import TensorFlow.js worker - it has its own message listeners and handles everything
import './worker-tfjs';

// Import session clustering worker
import './worker-sessions';

console.log('[Offscreen] Document initialized with TensorFlow.js and session clustering workers');
