#!/usr/bin/env node

/**
 * BrainPlus Sync Native Messaging Host
 * 
 * Minimal POC for Phase 0 validation.
 * 
 * Responsibilities:
 * - Generate QR codes (using qrcode library)
 * - Start/stop WebSocket signaling client
 * - Bridge between extension and local network
 * 
 * Protocol: Chrome Native Messaging (stdin/stdout with length-prefixed JSON)
 * 
 * Installation:
 * 1. npm install (in this directory)
 * 2. Register native messaging host manifest with Chrome
 * 
 * Testing:
 * echo '{"type":"ping"}' | node brainplus-sync-host.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');
const QRCode = require('qrcode');

// ============================================================================
// Native Messaging Protocol
// ============================================================================

/**
 * Read message from Chrome extension (stdin)
 */
function readMessage() {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    let buffer = Buffer.alloc(0);
    let messageLength = null;
    
    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      
      // Read length if we don't have it yet
      if (messageLength === null && buffer.length >= 4) {
        messageLength = buffer.readUInt32LE(0);
      }
      
      // Read message if we have enough data
      if (messageLength !== null && buffer.length >= 4 + messageLength) {
        const messageBuffer = buffer.slice(4, 4 + messageLength);
        const message = JSON.parse(messageBuffer.toString('utf-8'));
        
        // Clean up
        stdin.removeListener('data', onData);
        stdin.removeListener('error', onError);
        
        // Reset buffer for next message
        buffer = buffer.slice(4 + messageLength);
        
        resolve(message);
      }
    };
    
    const onError = (error) => {
      stdin.removeListener('data', onData);
      stdin.removeListener('error', onError);
      reject(error);
    };
    
    stdin.on('data', onData);
    stdin.on('error', onError);
  });
}

/**
 * Send message to Chrome extension (stdout)
 */
function sendMessage(message) {
  const messageString = JSON.stringify(message);
  const messageBuffer = Buffer.from(messageString, 'utf-8');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32LE(messageBuffer.length, 0);
  
  process.stdout.write(lengthBuffer);
  process.stdout.write(messageBuffer);
}

/**
 * Log to stderr (stdout is reserved for native messaging)
 */
function log(...args) {
  const timestamp = new Date().toISOString();
  const logPath = path.join(os.tmpdir(), 'brainplus-sync-host.log');
  fs.appendFileSync(
    logPath,
    `[${timestamp}] ${args.join(' ')}\n`
  );
}

// ============================================================================
// Message Handlers
// ============================================================================

/**
 * Handle ping request
 */
function handlePing(message) {
  log('Ping received');
  sendMessage({
    success: true,
    type: 'pong',
    timestamp: Date.now(),
  });
}

/**
 * Handle check_availability request
 */
function handleCheckAvailability(message) {
  log('Check availability');
  sendMessage({
    success: true,
    type: 'availability',
    data: {
      available: true,
      version: '1.0.0',
      features: ['qr_generation', 'signaling', 'history_sync'],
    },
  });
}

/**
 * Handle generate_qr request
 */
async function handleGenerateQR(message) {
  log('Generate QR request:', JSON.stringify(message.payload));
  
  try {
    // Create QR code payload
    const qrPayload = JSON.stringify({
      deviceId: message.payload.deviceId,
      signalingUrl: message.payload.signalingUrl,
      roomId: message.payload.roomId,
      publicKey: message.payload.publicKey,
      expiresAt: message.payload.expiresAt,
    });
    
    log('Generating QR code for payload size:', qrPayload.length, 'bytes');
    
    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 2,
    });
    
    log('QR code generated successfully');
    
    sendMessage({
      success: true,
      type: 'qr_generated',
      data: {
        roomId: message.payload.roomId,
        qrCodeDataUrl: qrCodeDataUrl,
        expiresAt: message.payload.expiresAt,
      },
    });
  } catch (error) {
    log('Error generating QR:', error.message);
    sendMessage({
      success: false,
      type: 'error',
      error: error.message,
    });
  }
}

/**
 * Handle start_signaling request
 */
async function handleStartSignaling(message) {
  log('Start signaling request:', JSON.stringify(message.payload));
  
  try {
    const { signalingUrl, roomId } = message.payload;
    
    // For POC, just simulate connection
    // In production, actually connect to WebSocket server
    log(`Connecting to ${signalingUrl}...`);
    
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    sendMessage({
      success: true,
      type: 'signaling_connected',
      data: {
        roomId,
        connected: true,
      },
    });
    
    // Simulate receiving a connection from mobile device
    setTimeout(() => {
      sendMessage({
        success: true,
        type: 'device_paired',
        data: {
          roomId,
          remoteDeviceId: 'mobile-device-' + Math.random().toString(36).substring(2, 9),
          remoteDeviceType: 'mobile',
        },
      });
    }, 2000);
    
  } catch (error) {
    log('Error starting signaling:', error.message);
    sendMessage({
      success: false,
      type: 'error',
      error: error.message,
    });
  }
}

/**
 * Handle send_batch request
 */
async function handleSendBatch(message) {
  log('Send batch request:', message.payload.batchId);
  
  try {
    // For POC, just acknowledge receipt
    // In production, encrypt and send via WebSocket
    sendMessage({
      success: true,
      type: 'batch_sent',
      data: {
        batchId: message.payload.batchId,
        sequence: message.payload.sequence,
      },
    });
  } catch (error) {
    log('Error sending batch:', error.message);
    sendMessage({
      success: false,
      type: 'error',
      error: error.message,
    });
  }
}

// ============================================================================
// Main Event Loop
// ============================================================================

async function main() {
  log('BrainPlus Sync Native Host started');
  log('Waiting for messages from extension...');
  
  try {
    while (true) {
      const message = await readMessage();
      log('Received message:', JSON.stringify(message));
      
      // Route to appropriate handler
      switch (message.type) {
        case 'ping':
          handlePing(message);
          break;
        
        case 'check_availability':
          handleCheckAvailability(message);
          break;
        
        case 'generate_qr':
          await handleGenerateQR(message);
          break;
        
        case 'start_signaling':
          await handleStartSignaling(message);
          break;
        
        case 'send_batch':
          await handleSendBatch(message);
          break;
        
        default:
          log('Unknown message type:', message.type);
          sendMessage({
            success: false,
            type: 'error',
            error: `Unknown message type: ${message.type}`,
          });
      }
    }
  } catch (error) {
    log('Fatal error:', error.message);
    process.exit(1);
  }
}

// Start the host
main();

