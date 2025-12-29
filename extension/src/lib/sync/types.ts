/**
 * Type definitions for Cross-Device Sync feature
 */

import type { VectorMetadata } from './vectorCompatibility';

/**
 * Sync message types for inter-component communication
 */
export enum SyncMessageType {
  // Pairing flow
  INITIATE_PAIRING = 'sync:initiatePairing',
  PAIRING_STARTED = 'sync:pairingStarted',
  PAIRING_SUCCESS = 'sync:pairingSuccess',
  PAIRING_FAILED = 'sync:pairingFailed',
  
  // History sync
  REQUEST_HISTORY = 'sync:requestHistory',
  SEND_HISTORY_BATCH = 'sync:sendHistoryBatch',
  RECEIVE_HISTORY_BATCH = 'sync:receiveHistoryBatch',
  SYNC_COMPLETE = 'sync:syncComplete',
  SYNC_PROGRESS = 'sync:syncProgress',
  
  // Device management
  GET_PAIRED_DEVICES = 'sync:getPairedDevices',
  REMOVE_DEVICE = 'sync:removeDevice',
  
  // Status
  GET_SYNC_STATUS = 'sync:getSyncStatus',
  CHECK_NATIVE_HOST = 'sync:checkNativeHost',
}

/**
 * QR Code payload for device pairing
 */
export interface QRCodePayload {
  /** Device ID of the desktop (QR generator) */
  deviceId: string;
  
  /** WebSocket signaling server URL */
  signalingUrl: string;
  
  /** Room ID for this pairing session */
  roomId: string;
  
  /** Public key for ECDH key exchange (Base64) */
  publicKey: string;
  
  /** Expiration timestamp (for security) */
  expiresAt: number;
  
  /** Protocol version for backwards compatibility */
  version: string;
}

/**
 * Device information
 */
export interface DeviceInfo {
  /** Unique device ID */
  deviceId: string;
  
  /** Device name (e.g., "John's iPhone") */
  deviceName: string;
  
  /** Device type */
  deviceType: 'desktop' | 'mobile';
  
  /** Platform (Windows, macOS, iOS, Android) */
  platform: string;
  
  /** Browser (Chrome, Safari, Brave, Edge) */
  browser: string;
  
  /** Extension version */
  extensionVersion: string;
  
  /** Vector metadata for compatibility checking */
  vectorMetadata: VectorMetadata;
  
  /** Last seen timestamp */
  lastSeen: number;
  
  /** Paired at timestamp */
  pairedAt: number;
}

/**
 * Pairing session state
 */
export interface PairingSession {
  /** Room ID */
  roomId: string;
  
  /** Local device info */
  localDevice: DeviceInfo;
  
  /** Remote device info (after pairing) */
  remoteDevice?: DeviceInfo;
  
  /** ECDH key pair */
  keyPair: {
    publicKey: CryptoKey;
    privateKey: CryptoKey;
  };
  
  /** Shared secret (after key exchange) */
  sharedSecret?: CryptoKey;
  
  /** Session state */
  state: 'initiating' | 'waiting' | 'connected' | 'syncing' | 'complete' | 'failed';
  
  /** Error message if failed */
  error?: string;
  
  /** Created at timestamp */
  createdAt: number;
  
  /** Expires at timestamp */
  expiresAt: number;
}

/**
 * History batch for sync
 */
export interface HistoryBatch {
  /** Batch ID for tracking */
  batchId: string;
  
  /** Batch sequence number */
  sequence: number;
  
  /** Total number of batches */
  totalBatches: number;
  
  /** Serialized PageDigests (with vectors as Base64) */
  pages: SerializedPageDigest[];
  
  /** Device that sent this batch */
  sourceDeviceId: string;
  
  /** Timestamp when batch was created */
  timestamp: number;
}

/**
 * Serialized PageDigest for network transport
 * (vectors converted from ArrayBuffer to Base64)
 */
export interface SerializedPageDigest {
  pageId: string;
  url: string;
  domain: string;
  title: string;
  summary: string;
  intentScore?: number;
  qualityScore?: number;
  entities?: Array<{ text: string; type: string }>;
  keywords?: string[];
  category?: string;
  timestamp: number;
  lastAccessed?: number;
  
  /** Vector as Base64 string (converted from ArrayBuffer) */
  vector?: string;
  
  /** Vector metadata for compatibility checking */
  vectorMetadata?: VectorMetadata;
  
  /** Sync metadata */
  syncMetadata?: SyncMetadata;
  
  /** Activity context */
  activityContext?: any;
}

/**
 * Sync metadata attached to PageDigest
 */
export interface SyncMetadata {
  /** When this page was last synced */
  lastSyncedAt?: number;
  
  /** Source device IDs (for tracking merge history) */
  sourceDevices?: string[];
  
  /** Number of times this page has been merged */
  mergeCount?: number;
}

/**
 * Sync progress for UI
 */
export interface SyncProgress {
  /** Current state */
  state: 'idle' | 'pairing' | 'exchanging-keys' | 'syncing' | 'complete' | 'error';
  
  /** Progress percentage (0-100) */
  progress: number;
  
  /** Number of pages sent */
  pagesSent: number;
  
  /** Number of pages received */
  pagesReceived: number;
  
  /** Number of pages merged */
  pagesMerged: number;
  
  /** Total pages to sync */
  totalPages: number;
  
  /** Current operation description */
  operation: string;
  
  /** Error message if in error state */
  error?: string;
}

/**
 * Sync configuration
 */
export interface SyncConfig {
  /** Batch size for history sync */
  batchSize: number;
  
  /** Maximum pages to sync per session */
  maxPages: number;
  
  /** Timeout for pairing (ms) */
  pairingTimeout: number;
  
  /** Timeout for sync operations (ms) */
  syncTimeout: number;
  
  /** WebSocket signaling server URL */
  signalingServerUrl: string;
  
  /** Enable debug logging */
  debugMode: boolean;
}

/**
 * Native messaging request
 */
export interface NativeMessageRequest {
  /** Request type */
  type: 'check_availability' | 'generate_qr' | 'start_signaling' | 'send_batch' | 'get_status';
  
  /** Request payload */
  payload: any;
}

/**
 * Native messaging response
 */
export interface NativeMessageResponse {
  /** Success flag */
  success: boolean;
  
  /** Response data */
  data?: any;
  
  /** Error message if failed */
  error?: string;
}

/**
 * WebSocket message types
 */
export enum WSMessageType {
  /** Join a room */
  JOIN = 'join',
  
  /** Offer for WebRTC-like pairing */
  OFFER = 'offer',
  
  /** Answer for WebRTC-like pairing */
  ANSWER = 'answer',
  
  /** Exchange public keys for ECDH */
  KEY_EXCHANGE = 'key_exchange',
  
  /** Send encrypted history batch */
  HISTORY_BATCH = 'history_batch',
  
  /** Acknowledge batch received */
  BATCH_ACK = 'batch_ack',
  
  /** Sync complete */
  SYNC_DONE = 'sync_done',
  
  /** Error occurred */
  ERROR = 'error',
  
  /** Heartbeat */
  PING = 'ping',
  PONG = 'pong',
}

/**
 * WebSocket message
 */
export interface WSMessage {
  /** Message type */
  type: WSMessageType;
  
  /** Room ID */
  roomId: string;
  
  /** Sender device ID */
  from: string;
  
  /** Recipient device ID (optional) */
  to?: string;
  
  /** Message payload */
  payload: any;
  
  /** Timestamp */
  timestamp: number;
}

