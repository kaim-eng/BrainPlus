/**
 * WebSocket Signaling Client
 * 
 * Handles device-to-device communication via WebSocket signaling server.
 * 
 * Protocol:
 * - JOIN room → Server assigns to room
 * - KEY_EXCHANGE → Exchange ECDH public keys
 * - HISTORY_BATCH → Send encrypted history batches
 * - BATCH_ACK → Acknowledge batch received
 * - SYNC_DONE → Signal completion
 * 
 * Security:
 * - All history data is encrypted before sending
 * - Server only routes messages, never decrypts
 * - Ephemeral connections (close after sync)
 */

import type { WSMessage, DeviceInfo } from './types';
import { WSMessageType } from './types';

export type SignalingEventType = 
  | 'connected'
  | 'disconnected'
  | 'device_joined'
  | 'key_exchange'
  | 'batch_received'
  | 'batch_ack'
  | 'sync_complete'
  | 'error';

export interface SignalingEvent {
  type: SignalingEventType;
  data?: any;
  error?: string;
}

/**
 * WebSocket Signaling Client
 */
export class SignalingClient {
  private ws: WebSocket | null = null;
  private url: string;
  private roomId: string;
  private deviceId: string;
  private eventHandlers: Map<SignalingEventType, Array<(event: SignalingEvent) => void>>;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // Start at 1 second
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isIntentionallyClosed: boolean = false;
  
  constructor(url: string, roomId: string, deviceId: string) {
    this.url = url;
    this.roomId = roomId;
    this.deviceId = deviceId;
    this.eventHandlers = new Map();
  }
  
  /**
   * Connect to signaling server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Connecting to signaling server: ${this.url}`);
        console.log(`Room ID: ${this.roomId}`);
        console.log(`Device ID: ${this.deviceId}`);
        
        this.isIntentionallyClosed = false;
        this.ws = new WebSocket(this.url);
        
        // Connection opened
        this.ws.onopen = () => {
          console.log('✅ WebSocket connected');
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          
          // Join room immediately after connection
          this.joinRoom();
          
          // Start heartbeat
          this.startHeartbeat();
          
          this.emit({ type: 'connected' });
          resolve();
        };
        
        // Listen for messages
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        
        // Connection closed
        this.ws.onclose = (event) => {
          console.log(`WebSocket closed: ${event.code} ${event.reason}`);
          this.stopHeartbeat();
          
          this.emit({ 
            type: 'disconnected',
            data: { code: event.code, reason: event.reason }
          });
          
          // Attempt reconnection if not intentionally closed
          if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          }
        };
        
        // Connection error
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit({ 
            type: 'error', 
            error: 'WebSocket connection error'
          });
          reject(new Error('Failed to connect to signaling server'));
        };
        
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Disconnect from signaling server
   */
  disconnect(): void {
    console.log('Disconnecting from signaling server...');
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }
  
  /**
   * Join a room
   */
  private joinRoom(): void {
    console.log(`Joining room: ${this.roomId}`);
    this.send({
      type: WSMessageType.JOIN,
      roomId: this.roomId,
      from: this.deviceId,
      payload: {
        deviceId: this.deviceId,
      },
      timestamp: Date.now(),
    });
  }
  
  /**
   * Send ECDH public key to remote device
   */
  sendPublicKey(publicKeyB64: string, deviceInfo: DeviceInfo): void {
    console.log('Sending public key to remote device...');
    this.send({
      type: WSMessageType.KEY_EXCHANGE,
      roomId: this.roomId,
      from: this.deviceId,
      payload: {
        publicKey: publicKeyB64,
        deviceInfo,
      },
      timestamp: Date.now(),
    });
  }
  
  /**
   * Send encrypted history batch
   */
  sendBatch(encryptedBatch: string, batchId: string, sequence: number, totalBatches: number): void {
    console.log(`Sending batch ${sequence + 1}/${totalBatches}...`);
    this.send({
      type: WSMessageType.HISTORY_BATCH,
      roomId: this.roomId,
      from: this.deviceId,
      payload: {
        encryptedBatch,
        batchId,
        sequence,
        totalBatches,
      },
      timestamp: Date.now(),
    });
  }
  
  /**
   * Acknowledge batch received
   */
  sendBatchAck(batchId: string, sequence: number): void {
    this.send({
      type: WSMessageType.BATCH_ACK,
      roomId: this.roomId,
      from: this.deviceId,
      payload: {
        batchId,
        sequence,
      },
      timestamp: Date.now(),
    });
  }
  
  /**
   * Signal sync completion
   */
  sendSyncComplete(): void {
    console.log('Sending sync complete signal...');
    this.send({
      type: WSMessageType.SYNC_DONE,
      roomId: this.roomId,
      from: this.deviceId,
      payload: {},
      timestamp: Date.now(),
    });
  }
  
  /**
   * Send a message through WebSocket
   */
  private send(message: Partial<WSMessage>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('Cannot send message: WebSocket not open');
      this.emit({ 
        type: 'error', 
        error: 'WebSocket not connected' 
      });
      return;
    }
    
    const fullMessage: WSMessage = {
      type: message.type as WSMessageType,
      roomId: this.roomId,
      from: this.deviceId,
      to: message.to,
      payload: message.payload || {},
      timestamp: Date.now(),
    };
    
    this.ws.send(JSON.stringify(fullMessage));
  }
  
  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message: WSMessage = JSON.parse(data);
      
      // Ignore messages from self
      if (message.from === this.deviceId) {
        return;
      }
      
      console.log(`Received message: ${message.type}`);
      
      switch (message.type) {
        case WSMessageType.JOIN:
          // Another device joined the room
          this.emit({
            type: 'device_joined',
            data: {
              deviceId: message.from,
              deviceInfo: message.payload.deviceInfo,
            },
          });
          break;
        
        case WSMessageType.KEY_EXCHANGE:
          // Received remote device's public key
          this.emit({
            type: 'key_exchange',
            data: {
              publicKey: message.payload.publicKey,
              deviceInfo: message.payload.deviceInfo,
              from: message.from,
            },
          });
          break;
        
        case WSMessageType.HISTORY_BATCH:
          // Received encrypted history batch
          this.emit({
            type: 'batch_received',
            data: {
              encryptedBatch: message.payload.encryptedBatch,
              batchId: message.payload.batchId,
              sequence: message.payload.sequence,
              totalBatches: message.payload.totalBatches,
              from: message.from,
            },
          });
          
          // Auto-acknowledge
          this.sendBatchAck(message.payload.batchId, message.payload.sequence);
          break;
        
        case WSMessageType.BATCH_ACK:
          // Remote device acknowledged our batch
          this.emit({
            type: 'batch_ack',
            data: {
              batchId: message.payload.batchId,
              sequence: message.payload.sequence,
              from: message.from,
            },
          });
          break;
        
        case WSMessageType.SYNC_DONE:
          // Remote device finished sending
          this.emit({
            type: 'sync_complete',
            data: {
              from: message.from,
            },
          });
          break;
        
        case WSMessageType.PONG:
          // Heartbeat response
          // No action needed
          break;
        
        case WSMessageType.ERROR:
          console.error('Server error:', message.payload);
          this.emit({
            type: 'error',
            error: message.payload.error || 'Unknown server error',
          });
          break;
        
        default:
          console.warn('Unknown message type:', message.type);
      }
      
    } catch (error) {
      console.error('Failed to parse message:', error);
      this.emit({
        type: 'error',
        error: 'Failed to parse message',
      });
    }
  }
  
  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    // Send PING every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: WSMessageType.PING,
          roomId: this.roomId,
          from: this.deviceId,
          payload: {},
          timestamp: Date.now(),
        });
      }
    }, 30000);
  }
  
  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    this.reconnectAttempts++;
    
    console.log(
      `Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} ` +
      `in ${this.reconnectDelay}ms...`
    );
    
    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, this.reconnectDelay);
    
    // Exponential backoff (1s, 2s, 4s, 8s, 16s)
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 16000);
  }
  
  /**
   * Register event handler
   */
  on(eventType: SignalingEventType, handler: (event: SignalingEvent) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }
  
  /**
   * Unregister event handler
   */
  off(eventType: SignalingEventType, handler: (event: SignalingEvent) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }
  
  /**
   * Emit event to all registered handlers
   */
  private emit(event: SignalingEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${event.type}:`, error);
        }
      });
    }
  }
  
  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
  
  /**
   * Get connection state
   */
  getState(): 'connecting' | 'open' | 'closing' | 'closed' {
    if (!this.ws) return 'closed';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'open';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'closed';
    }
  }
}

