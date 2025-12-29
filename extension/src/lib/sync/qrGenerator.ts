/**
 * QR Code Generation Service
 * 
 * Generates QR codes for device pairing containing:
 * - Device ID
 * - Signaling server URL
 * - Room ID
 * - ECDH public key
 * - Expiration timestamp
 * 
 * Uses the `qrcode` library for QR generation.
 */

import QRCode from 'qrcode';
import type { QRCodePayload } from './types';
import { exportPublicKey } from './ecdhCrypto';

/**
 * Default signaling server URL
 * TODO: Replace with production server
 */
const DEFAULT_SIGNALING_URL = 'wss://signaling.brainplus.dev';

/**
 * QR code expiration time (5 minutes)
 */
const QR_EXPIRATION_MS = 5 * 60 * 1000;

/**
 * Protocol version for backwards compatibility
 */
const PROTOCOL_VERSION = '1.0.0';

/**
 * Generate QR code payload for device pairing
 * 
 * @param deviceId - Local device ID
 * @param publicKey - ECDH public key
 * @param signalingUrl - WebSocket signaling server URL (optional)
 * @returns QR code payload
 */
export function createQRPayload(
  deviceId: string,
  publicKey: string,
  signalingUrl: string = DEFAULT_SIGNALING_URL
): QRCodePayload {
  const roomId = generateRoomId();
  const expiresAt = Date.now() + QR_EXPIRATION_MS;
  
  return {
    deviceId,
    signalingUrl,
    roomId,
    publicKey,
    expiresAt,
    version: PROTOCOL_VERSION,
  };
}

/**
 * Generate QR code image as Data URL
 * 
 * @param payload - QR code payload
 * @param options - QR code generation options
 * @returns Promise resolving to Data URL (image/png)
 */
export async function generateQRCode(
  payload: QRCodePayload,
  options?: {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }
): Promise<string> {
  try {
    const payloadString = JSON.stringify(payload);
    
    console.log('Generating QR code...');
    console.log(`  Room ID: ${payload.roomId}`);
    console.log(`  Expires at: ${new Date(payload.expiresAt).toLocaleTimeString()}`);
    console.log(`  Payload size: ${payloadString.length} bytes`);
    
    const qrCodeDataUrl = await QRCode.toDataURL(payloadString, {
      width: options?.width || 400,
      margin: options?.margin || 2,
      color: {
        dark: options?.color?.dark || '#000000',
        light: options?.color?.light || '#FFFFFF',
      },
      errorCorrectionLevel: 'M', // Medium error correction (15%)
    });
    
    console.log('✅ QR code generated successfully');
    
    return qrCodeDataUrl;
  } catch (error) {
    console.error('❌ Failed to generate QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Parse QR code payload from scanned data
 * 
 * @param data - Raw data from QR scanner
 * @returns Parsed QR code payload
 * @throws Error if payload is invalid or expired
 */
export function parseQRPayload(data: string): QRCodePayload {
  try {
    const payload = JSON.parse(data) as QRCodePayload;
    
    // Validate required fields
    if (!payload.deviceId || !payload.roomId || !payload.publicKey) {
      throw new Error('Invalid QR code: missing required fields');
    }
    
    // Check protocol version
    if (payload.version !== PROTOCOL_VERSION) {
      console.warn(
        `QR code version mismatch: expected ${PROTOCOL_VERSION}, got ${payload.version}`
      );
    }
    
    // Check expiration
    if (payload.expiresAt < Date.now()) {
      throw new Error('QR code has expired. Please generate a new code.');
    }
    
    console.log('✅ QR code payload parsed successfully');
    console.log(`  Device ID: ${payload.deviceId}`);
    console.log(`  Room ID: ${payload.roomId}`);
    
    return payload;
  } catch (error) {
    console.error('❌ Failed to parse QR code:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Invalid QR code data');
  }
}

/**
 * Validate QR code payload
 * 
 * @param payload - QR code payload to validate
 * @returns true if valid, false otherwise
 */
export function validateQRPayload(payload: QRCodePayload): boolean {
  // Check required fields
  if (!payload.deviceId || !payload.roomId || !payload.publicKey) {
    console.error('❌ Invalid payload: missing required fields');
    return false;
  }
  
  // Check expiration
  if (payload.expiresAt < Date.now()) {
    console.error('❌ Invalid payload: expired');
    return false;
  }
  
  // Check signaling URL format
  try {
    new URL(payload.signalingUrl);
  } catch {
    console.error('❌ Invalid payload: invalid signaling URL');
    return false;
  }
  
  return true;
}

/**
 * Generate QR code for full pairing flow
 * 
 * @param deviceId - Local device ID
 * @param publicKey - CryptoKey (will be exported)
 * @param signalingUrl - WebSocket signaling server URL (optional)
 * @returns Promise resolving to { payload, qrCodeDataUrl }
 */
export async function generatePairingQRCode(
  deviceId: string,
  publicKey: CryptoKey,
  signalingUrl?: string
): Promise<{
  payload: QRCodePayload;
  qrCodeDataUrl: string;
  roomId: string;
  expiresAt: number;
}> {
  console.log('='.repeat(60));
  console.log('Generating Pairing QR Code');
  console.log('='.repeat(60));
  
  // Export public key to Base64
  console.log('Exporting public key...');
  const publicKeyB64 = await exportPublicKey(publicKey);
  
  // Create payload
  const payload = createQRPayload(deviceId, publicKeyB64, signalingUrl);
  
  // Generate QR code
  const qrCodeDataUrl = await generateQRCode(payload);
  
  console.log('✅ Pairing QR code ready!');
  console.log(`  Room ID: ${payload.roomId}`);
  console.log(`  Expires in: ${Math.floor(QR_EXPIRATION_MS / 1000 / 60)} minutes`);
  console.log('='.repeat(60));
  
  return {
    payload,
    qrCodeDataUrl,
    roomId: payload.roomId,
    expiresAt: payload.expiresAt,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate unique room ID for pairing session
 */
function generateRoomId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `room_${timestamp}_${random}`;
}

/**
 * Get time remaining until expiration
 */
export function getTimeRemaining(expiresAt: number): number {
  return Math.max(0, expiresAt - Date.now());
}

/**
 * Format time remaining as human-readable string
 */
export function formatTimeRemaining(expiresAt: number): string {
  const ms = getTimeRemaining(expiresAt);
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

