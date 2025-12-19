/**
 * Cryptographic utilities for local data encryption
 * Uses Web Crypto API for AES-GCM encryption
 */

import { getLocal, setLocal } from './storage';
import { STORAGE_KEYS } from './constants';

// ============================================================================
// Key Management
// ============================================================================

/**
 * Generate a new encryption key
 */
async function generateKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Export key to raw format for storage
 */
async function exportKey(key: CryptoKey): Promise<ArrayBuffer> {
  return await crypto.subtle.exportKey('raw', key);
}

/**
 * Import key from raw format
 */
async function importKey(keyData: ArrayBuffer): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Get or create encryption key
 */
export async function getEncryptionKey(): Promise<CryptoKey> {
  // Try to load existing key from storage
  const storedKey = await getLocal<string>(STORAGE_KEYS.ENCRYPTION_KEY);
  
  if (storedKey) {
    // Convert base64 to ArrayBuffer
    const keyData = Uint8Array.from(atob(storedKey), c => c.charCodeAt(0));
    return await importKey(keyData.buffer);
  }
  
  // Generate new key
  const key = await generateKey();
  const keyData = await exportKey(key);
  
  // Store as base64
  const base64Key = btoa(String.fromCharCode(...new Uint8Array(keyData)));
  await setLocal(STORAGE_KEYS.ENCRYPTION_KEY, base64Key);
  
  return key;
}

// ============================================================================
// Encryption/Decryption
// ============================================================================

/**
 * Encrypt data using AES-GCM
 */
export async function encrypt(data: string, key: CryptoKey): Promise<string> {
  // Generate random IV (Initialization Vector)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encode plaintext
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(data);
  
  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    plaintext
  );
  
  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data using AES-GCM
 */
export async function decrypt(encryptedData: string, key: CryptoKey): Promise<string> {
  // Convert from base64
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  
  // Extract IV and ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    ciphertext
  );
  
  // Decode plaintext
  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

// ============================================================================
// Secure Storage Wrappers
// ============================================================================

/**
 * Store encrypted data
 */
export async function setSecure<T>(key: string, value: T): Promise<void> {
  const encryptionKey = await getEncryptionKey();
  const plaintext = JSON.stringify(value);
  const encrypted = await encrypt(plaintext, encryptionKey);
  await setLocal(`secure_${key}`, encrypted);
}

/**
 * Retrieve encrypted data
 */
export async function getSecure<T>(key: string): Promise<T | null> {
  const encrypted = await getLocal<string>(`secure_${key}`);
  
  if (!encrypted) {
    return null;
  }
  
  try {
    const encryptionKey = await getEncryptionKey();
    const plaintext = await decrypt(encrypted, encryptionKey);
    return JSON.parse(plaintext) as T;
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

// ============================================================================
// Key Derivation (for future PIN support)
// ============================================================================

/**
 * Derive key from PIN using PBKDF2
 * @param pin - User PIN
 * @param salt - Salt (store this with derived key)
 * @param iterations - PBKDF2 iterations (default: 100000)
 */
export async function deriveKeyFromPIN(
  pin: string,
  salt: Uint8Array,
  iterations: number = 100000
): Promise<CryptoKey> {
  // Import PIN as key material
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin);
  
  const baseKey = await crypto.subtle.importKey(
    'raw',
    pinData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive AES key
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt).buffer as ArrayBuffer,
      iterations: iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate random salt for key derivation
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

// ============================================================================
// Hashing Utilities
// ============================================================================

/**
 * Generate SHA-256 hash of data
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate random ID
 */
export function generateRandomId(length: number = 32): string {
  const array = crypto.getRandomValues(new Uint8Array(length / 2));
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

