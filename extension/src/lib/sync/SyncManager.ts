/**
 * Sync Manager
 * 
 * Orchestrates the entire cross-device sync flow:
 * 1. Generate QR code on desktop
 * 2. Wait for mobile to scan and connect
 * 3. Perform ECDH key exchange
 * 4. Validate vector compatibility
 * 5. Serialize and encrypt history batches
 * 6. Send/receive batches
 * 7. Smart merge with conflict resolution
 * 8. Store merged history
 * 
 * Design Principles:
 * - Progressive enhancement (optional native host)
 * - Hard fail on vector incompatibility
 * - Smart merge for data quality
 * - E2E encryption (backend never sees plaintext)
 */

import type { PairingSession, SyncProgress, DeviceInfo, HistoryBatch, SyncConfig } from './types';
import { generateECDHKeyPair, exportPublicKey, importPublicKey, deriveSharedSecret, encryptData, decryptData } from './ecdhCrypto';
import { createQRPayload } from './qrGenerator';
import { checkNativeHostAvailability, generateQRCodeViaHost } from './nativeHost';
import { getCurrentVectorMetadata, validateVectorMetadata, logCompatibilityCheck } from './vectorCompatibility';
import { serializeBatch, deserializeBatch } from './serialization';
import { mergePageDigests, shouldMerge } from './smartMerge';
import { SignalingClient } from './SignalingClient';
import { getAllDigests, getDigestByUrl, saveDigest } from '../db';

/**
 * Default sync configuration
 */
const DEFAULT_CONFIG: SyncConfig = {
  batchSize: 100,
  maxPages: 1000,
  pairingTimeout: 5 * 60 * 1000, // 5 minutes
  syncTimeout: 30 * 60 * 1000, // 30 minutes
  signalingServerUrl: 'ws://localhost:8080', // Use localhost for testing (change to wss:// for production)
  debugMode: true, // Enable debug mode for testing
};

/**
 * Sync Manager Class
 */
export class SyncManager {
  private config: SyncConfig;
  private currentSession: PairingSession | null = null;
  private progressCallbacks: Array<(progress: SyncProgress) => void> = [];
  private signalingClient: SignalingClient | null = null;
  private receivedBatches: Map<string, HistoryBatch> = new Map();
  private remoteSyncComplete: boolean = false;
  
  constructor(config?: Partial<SyncConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Check if sync is available (native host installed)
   */
  async checkAvailability(): Promise<boolean> {
    const result = await checkNativeHostAvailability();
    return result.available;
  }
  
  /**
   * Initiate pairing (desktop side - generates QR code)
   */
  async initiatePairing(): Promise<{
    qrCodeDataUrl: string;
    roomId: string;
    expiresAt: number;
  }> {
    console.log('='.repeat(60));
    console.log('Initiating Cross-Device Pairing');
    console.log('='.repeat(60));
    
    // Check native host availability
    const available = await this.checkAvailability();
    if (!available) {
      throw new Error('Native host not available. Please install the sync companion.');
    }
    
    this.updateProgress({
      state: 'pairing',
      progress: 10,
      operation: 'Generating encryption keys...',
      pagesSent: 0,
      pagesReceived: 0,
      pagesMerged: 0,
      totalPages: 0,
    });
    
    // Generate ECDH key pair
    console.log('Generating ECDH key pair...');
    const keyPair = await generateECDHKeyPair();
    
    // Get device info
    const deviceId = await this.getDeviceId();
    const deviceInfo = await this.getDeviceInfo();
    
    // Generate QR code via native host
    console.log('Generating QR code...');
    
    // Export public key
    const publicKeyB64 = await exportPublicKey(keyPair.publicKey);
    
    // Create QR payload
    const qrPayload = createQRPayload(deviceId, publicKeyB64, this.config.signalingServerUrl);
    
    // Use native host to generate QR code
    const qrCodeDataUrl = await generateQRCodeViaHost({
      deviceId: qrPayload.deviceId,
      signalingUrl: qrPayload.signalingUrl,
      roomId: qrPayload.roomId,
      publicKey: qrPayload.publicKey,
      expiresAt: qrPayload.expiresAt,
    });
    
    const { roomId, expiresAt } = qrPayload;
    
    // Create pairing session
    this.currentSession = {
      roomId,
      localDevice: deviceInfo,
      keyPair,
      state: 'waiting',
      createdAt: Date.now(),
      expiresAt,
    };
    
    this.updateProgress({
      state: 'pairing',
      progress: 20,
      operation: 'Waiting for mobile device to scan QR code...',
      pagesSent: 0,
      pagesReceived: 0,
      pagesMerged: 0,
      totalPages: 0,
    });
    
    console.log('✅ QR code ready! Waiting for mobile device...');
    console.log(`Room ID: ${roomId}`);
    console.log(`Expires at: ${new Date(expiresAt).toLocaleTimeString()}`);
    console.log('='.repeat(60));
    
    // Create and connect signaling client
    this.signalingClient = new SignalingClient(
      this.config.signalingServerUrl,
      roomId,
      deviceId
    );
    
    // Setup event handlers
    this.setupSignalingHandlers();
    
    try {
      await this.signalingClient.connect();
      console.log('✅ Connected to signaling server');
    } catch (error) {
      console.error('❌ Failed to connect to signaling server:', error);
      throw new Error('Failed to connect to signaling server');
    }
    
    return {
      qrCodeDataUrl,
      roomId,
      expiresAt,
    };
  }
  
  /**
   * Setup signaling client event handlers
   */
  private setupSignalingHandlers(): void {
    if (!this.signalingClient) return;
    
    // Handle device joined
    this.signalingClient.on('device_joined', async (event) => {
      console.log('Device joined room:', event.data.deviceId);
    });
    
    // Handle key exchange
    this.signalingClient.on('key_exchange', async (event) => {
      console.log('Received key exchange from remote device');
      const { publicKey, deviceInfo } = event.data;
      
      // Send our public key back
      if (this.currentSession) {
        const ourPublicKey = await exportPublicKey(this.currentSession.keyPair.publicKey);
        const ourDeviceInfo = await this.getDeviceInfo();
        this.signalingClient!.sendPublicKey(ourPublicKey, ourDeviceInfo);
      }
      
      // Handle pairing
      await this.handleDevicePaired(publicKey, deviceInfo);
    });
    
    // Handle batch received
    this.signalingClient.on('batch_received', async (event) => {
      const { encryptedBatch, batchId, sequence, totalBatches } = event.data;
      console.log(`Received batch ${sequence + 1}/${totalBatches}`);
      
      if (!this.currentSession || !this.currentSession.sharedSecret) {
        console.error('Cannot decrypt batch: no active session');
        return;
      }
      
      try {
        // Decrypt batch
        const batch: HistoryBatch = await decryptData(
          encryptedBatch,
          this.currentSession.sharedSecret,
          true
        );
        
        // Store batch
        this.receivedBatches.set(batchId, batch);
        
        // Update progress
        const received = this.receivedBatches.size * this.config.batchSize;
        this.updateProgress({
          state: 'syncing',
          progress: 70 + (20 * this.receivedBatches.size / totalBatches),
          operation: `Receiving batch ${sequence + 1}/${totalBatches}...`,
          pagesSent: this.currentSession.state === 'syncing' ? this.config.maxPages : 0,
          pagesReceived: received,
          pagesMerged: 0,
          totalPages: this.config.maxPages,
        });
        
        // If this was the last batch, trigger merge
        if (this.receivedBatches.size === totalBatches) {
          console.log('✅ All batches received! Starting merge...');
          await this.mergeReceivedHistory();
        }
      } catch (error) {
        console.error('Failed to decrypt/process batch:', error);
        this.updateProgress({
          state: 'error',
          progress: 0,
          operation: 'Sync failed',
          error: 'Failed to decrypt batch',
          pagesSent: 0,
          pagesReceived: 0,
          pagesMerged: 0,
          totalPages: 0,
        });
      }
    });
    
    // Handle sync complete from remote
    this.signalingClient.on('sync_complete', () => {
      console.log('Remote device finished sending');
      this.remoteSyncComplete = true;
      
      // If we're also done sending, complete the sync
      if (this.currentSession?.state === 'syncing') {
        this.checkSyncCompletion();
      }
    });
    
    // Handle errors
    this.signalingClient.on('error', (event) => {
      console.error('Signaling error:', event.error);
      this.updateProgress({
        state: 'error',
        progress: 0,
        operation: 'Sync failed',
        error: event.error,
        pagesSent: 0,
        pagesReceived: 0,
        pagesMerged: 0,
        totalPages: 0,
      });
    });
    
    // Handle disconnection
    this.signalingClient.on('disconnected', () => {
      console.log('Signaling disconnected');
      if (this.currentSession?.state === 'syncing') {
        // Don't treat as error if sync was already complete
        if (!this.remoteSyncComplete) {
          this.updateProgress({
            state: 'error',
            progress: 0,
            operation: 'Connection lost',
            error: 'Disconnected from signaling server',
            pagesSent: 0,
            pagesReceived: 0,
            pagesMerged: 0,
            totalPages: 0,
          });
        }
      }
    });
  }
  
  /**
   * Handle device paired event (called when mobile connects)
   */
  async handleDevicePaired(remotePublicKeyB64: string, remoteDeviceInfo: DeviceInfo): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active pairing session');
    }
    
    console.log('='.repeat(60));
    console.log('Device Paired!');
    console.log('='.repeat(60));
    console.log(`Remote device: ${remoteDeviceInfo.deviceName}`);
    console.log(`Type: ${remoteDeviceInfo.deviceType}`);
    console.log(`Platform: ${remoteDeviceInfo.platform}`);
    console.log('');
    
    this.updateProgress({
      state: 'exchanging-keys',
      progress: 30,
      operation: 'Exchanging encryption keys...',
      pagesSent: 0,
      pagesReceived: 0,
      pagesMerged: 0,
      totalPages: 0,
    });
    
    // Import remote public key
    const remotePublicKey = await importPublicKey(remotePublicKeyB64);
    
    // Derive shared secret
    const sharedSecret = await deriveSharedSecret(
      this.currentSession.keyPair.privateKey,
      remotePublicKey
    );
    
    // Update session
    this.currentSession.remoteDevice = remoteDeviceInfo;
    this.currentSession.sharedSecret = sharedSecret;
    this.currentSession.state = 'connected';
    
    // Validate vector compatibility BEFORE syncing
    console.log('');
    console.log('Validating vector compatibility...');
    const localMeta = await getCurrentVectorMetadata();
    const remoteMeta = remoteDeviceInfo.vectorMetadata;
    
    logCompatibilityCheck(localMeta, remoteMeta);
    
    try {
      validateVectorMetadata(remoteMeta);
      console.log('✅ Vector compatibility validated!');
    } catch (error) {
      console.error('❌ Vector incompatibility detected!');
      this.currentSession.state = 'failed';
      this.currentSession.error = error instanceof Error ? error.message : 'Vector incompatibility';
      this.updateProgress({
        state: 'error',
        progress: 0,
        operation: 'Sync failed',
        error: this.currentSession.error,
        pagesSent: 0,
        pagesReceived: 0,
        pagesMerged: 0,
        totalPages: 0,
      });
      throw error;
    }
    
    console.log('');
    console.log('✅ Pairing complete! Starting sync...');
    console.log('='.repeat(60));
    
    // Start sync
    await this.performSync();
  }
  
  /**
   * Perform bidirectional history sync
   */
  private async performSync(): Promise<void> {
    if (!this.currentSession || !this.currentSession.sharedSecret) {
      throw new Error('No active session or shared secret');
    }
    
    console.log('='.repeat(60));
    console.log('Starting Bidirectional Sync');
    console.log('='.repeat(60));
    
    this.currentSession.state = 'syncing';
    
    try {
      // 1. Get local history
      console.log('\n1. Loading local history...');
      const localDigests = await getAllDigests();
      console.log(`Found ${localDigests.length} local pages`);
      
      const totalPages = Math.min(localDigests.length, this.config.maxPages);
      const digests = localDigests.slice(0, totalPages);
      
      this.updateProgress({
        state: 'syncing',
        progress: 40,
        operation: `Serializing ${totalPages} pages...`,
        pagesSent: 0,
        pagesReceived: 0,
        pagesMerged: 0,
        totalPages,
      });
      
      // 2. Serialize and encrypt batches
      console.log('\n2. Serializing history...');
      const batches = await serializeBatch(digests, this.config.batchSize);
      console.log(`Created ${batches.length} batches`);
      
      // 3. Send batches via WebSocket
      console.log('\n3. Sending batches to remote device...');
      
      if (!this.signalingClient || !this.signalingClient.isConnected()) {
        throw new Error('Signaling client not connected');
      }
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`Sending batch ${i + 1}/${batches.length}...`);
        
        // Encrypt batch
        const encrypted = await encryptData(batch, this.currentSession.sharedSecret);
        
        // Send via WebSocket
        this.signalingClient.sendBatch(
          encrypted,
          batch.batchId,
          batch.sequence,
          batches.length
        );
        
        // Small delay to avoid overwhelming the connection
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const progress = 40 + (30 * (i + 1) / batches.length);
        this.updateProgress({
          state: 'syncing',
          progress,
          operation: `Sending batch ${i + 1}/${batches.length}...`,
          pagesSent: Math.min((i + 1) * this.config.batchSize, totalPages),
          pagesReceived: 0,
          pagesMerged: 0,
          totalPages,
        });
      }
      
      console.log('✅ All batches sent!');
      
      // Signal that we're done sending
      this.signalingClient.sendSyncComplete();
      
      // 4. Wait for remote batches (handled by SignalingClient event handlers)
      console.log('\n4. Waiting for remote device to send batches...');
      
      this.updateProgress({
        state: 'syncing',
        progress: 70,
        operation: 'Waiting for remote batches...',
        pagesSent: totalPages,
        pagesReceived: 0,
        pagesMerged: 0,
        totalPages,
      });
      
      // Check if sync is complete (will be called when remote signals complete)
      this.checkSyncCompletion();
      
    } catch (error) {
      console.error('❌ Sync failed:', error);
      this.currentSession.state = 'failed';
      this.currentSession.error = error instanceof Error ? error.message : 'Unknown error';
      this.updateProgress({
        state: 'error',
        progress: 0,
        operation: 'Sync failed',
        error: this.currentSession.error,
        pagesSent: 0,
        pagesReceived: 0,
        pagesMerged: 0,
        totalPages: 0,
      });
      throw error;
    }
  }
  
  /**
   * Register progress callback
   */
  onProgress(callback: (progress: SyncProgress) => void): void {
    this.progressCallbacks.push(callback);
  }
  
  /**
   * Update progress and notify callbacks
   */
  private updateProgress(progress: SyncProgress): void {
    this.progressCallbacks.forEach(callback => callback(progress));
  }
  
  /**
   * Get current device ID
   */
  private async getDeviceId(): Promise<string> {
    // TODO: Generate and store device ID in chrome.storage.local
    return 'desktop-' + Math.random().toString(36).substring(2, 11);
  }
  
  /**
   * Get current device info
   */
  private async getDeviceInfo(): Promise<DeviceInfo> {
    const deviceId = await this.getDeviceId();
    const vectorMetadata = await getCurrentVectorMetadata();
    
    return {
      deviceId,
      deviceName: 'Desktop', // TODO: Get from user preferences
      deviceType: 'desktop',
      platform: this.getPlatform(),
      browser: this.getBrowser(),
      extensionVersion: '1.0.0', // TODO: Get from manifest
      vectorMetadata,
      lastSeen: Date.now(),
      pairedAt: Date.now(),
    };
  }
  
  /**
   * Get current platform
   */
  private getPlatform(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac')) return 'macOS';
    if (ua.includes('Linux')) return 'Linux';
    return 'Unknown';
  }
  
  /**
   * Get current browser
   */
  private getBrowser(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Edg')) return 'Edge';
    if (ua.includes('Firefox')) return 'Firefox';
    return 'Unknown';
  }
  
  /**
   * Merge received history with local history
   */
  private async mergeReceivedHistory(): Promise<void> {
    if (!this.currentSession) return;
    
    console.log('='.repeat(60));
    console.log('Merging Received History');
    console.log('='.repeat(60));
    
    let mergedCount = 0;
    let newCount = 0;
    let skippedCount = 0;
    
    // Process all received batches
    for (const batch of this.receivedBatches.values()) {
      console.log(`Processing batch ${batch.sequence + 1}/${batch.totalBatches}...`);
      
      // Deserialize batch
      const remoteDigests = deserializeBatch(batch);
      
      // For each remote digest, check if we have it locally
      for (const remoteDigest of remoteDigests) {
        try {
          const localDigest = await getDigestByUrl(remoteDigest.url);
          
          if (localDigest) {
            // We have this page - check if merge is needed
            if (shouldMerge(localDigest, remoteDigest)) {
              // Merge and save
              const merged = mergePageDigests(localDigest, remoteDigest);
              await saveDigest(merged);
              mergedCount++;
              console.log(`✅ Merged: ${remoteDigest.title}`);
            } else {
              skippedCount++;
            }
          } else {
            // New page - just save it
            await saveDigest(remoteDigest);
            newCount++;
            console.log(`✨ New: ${remoteDigest.title}`);
          }
        } catch (error) {
          console.error(`Failed to process page ${remoteDigest.url}:`, error);
        }
      }
      
      // Update progress
      const progress = 80 + (15 * (batch.sequence + 1) / batch.totalBatches);
      this.updateProgress({
        state: 'syncing',
        progress,
        operation: `Merging batch ${batch.sequence + 1}/${batch.totalBatches}...`,
        pagesSent: this.config.maxPages,
        pagesReceived: this.receivedBatches.size * this.config.batchSize,
        pagesMerged: mergedCount + newCount,
        totalPages: this.config.maxPages,
      });
    }
    
    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Merge Complete!');
    console.log(`  New pages: ${newCount}`);
    console.log(`  Merged pages: ${mergedCount}`);
    console.log(`  Skipped (no change): ${skippedCount}`);
    console.log('='.repeat(60));
    
    // Check if we can complete the sync
    this.checkSyncCompletion();
  }
  
  /**
   * Check if both sides have completed and finalize sync
   */
  private checkSyncCompletion(): void {
    if (!this.currentSession) return;
    
    // Both we and remote must signal complete
    const weAreDone = this.currentSession.state === 'syncing';
    const theyAreDone = this.remoteSyncComplete;
    const allBatchesReceived = this.receivedBatches.size > 0; // At least some batches
    
    if (weAreDone && theyAreDone && allBatchesReceived) {
      this.completeSyncSession();
    }
  }
  
  /**
   * Complete the sync session
   */
  private completeSyncSession(): void {
    if (!this.currentSession) return;
    
    this.currentSession.state = 'complete';
    
    const totalReceived = this.receivedBatches.size * this.config.batchSize;
    
    this.updateProgress({
      state: 'complete',
      progress: 100,
      operation: 'Sync complete!',
      pagesSent: this.config.maxPages,
      pagesReceived: totalReceived,
      pagesMerged: totalReceived, // Approximate
      totalPages: this.config.maxPages,
    });
    
    console.log('');
    console.log('='.repeat(60));
    console.log('🎉 SYNC SESSION COMPLETE!');
    console.log('='.repeat(60));
    
    // Disconnect signaling
    if (this.signalingClient) {
      this.signalingClient.disconnect();
      this.signalingClient = null;
    }
    
    // Clear received batches
    this.receivedBatches.clear();
    this.remoteSyncComplete = false;
  }
  
  /**
   * Cancel current sync session
   */
  cancelSync(): void {
    // Disconnect signaling
    if (this.signalingClient) {
      this.signalingClient.disconnect();
      this.signalingClient = null;
    }
    
    if (this.currentSession) {
      this.currentSession.state = 'failed';
      this.currentSession.error = 'Cancelled by user';
      this.currentSession = null;
      
      this.updateProgress({
        state: 'idle',
        progress: 0,
        operation: 'Sync cancelled',
        pagesSent: 0,
        pagesReceived: 0,
        pagesMerged: 0,
        totalPages: 0,
      });
    }
    
    // Clear state
    this.receivedBatches.clear();
    this.remoteSyncComplete = false;
  }
  
  /**
   * Get current session state
   */
  getSession(): PairingSession | null {
    return this.currentSession;
  }
}

// Singleton instance
let syncManager: SyncManager | null = null;

/**
 * Get singleton SyncManager instance
 */
export function getSyncManager(): SyncManager {
  if (!syncManager) {
    syncManager = new SyncManager();
  }
  return syncManager;
}

