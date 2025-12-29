/**
 * ECDH Cryptography for Cross-Device Sync
 * 
 * Implements Elliptic Curve Diffie-Hellman (ECDH) key exchange
 * and AES-GCM encryption/decryption for end-to-end encrypted sync.
 * 
 * Security Design:
 * - ECDH P-256 for key exchange (NIST recommended)
 * - AES-256-GCM for data transport (authenticated encryption)
 * - Ephemeral keys (new key pair per sync session)
 * - No server-side key storage (backend never sees plaintext)
 */

/**
 * Generate ECDH key pair for pairing
 * 
 * @returns Promise resolving to CryptoKeyPair (public + private keys)
 */
export async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256', // NIST P-256 curve (secp256r1)
      },
      true, // Extractable (need to export public key)
      ['deriveKey', 'deriveBits']
    );
    
    console.log('✅ Generated ECDH key pair (P-256)');
    return keyPair;
  } catch (error) {
    console.error('❌ Failed to generate ECDH key pair:', error);
    throw new Error('Failed to generate encryption keys');
  }
}

/**
 * Export public key to Base64 string (for QR code / WebSocket transport)
 * 
 * @param publicKey - CryptoKey to export
 * @returns Base64-encoded public key
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  try {
    const exported = await window.crypto.subtle.exportKey('spki', publicKey);
    const exportedAsString = ab2str(exported);
    const exportedAsBase64 = btoa(exportedAsString);
    
    console.log(`✅ Exported public key (${exportedAsBase64.length} chars)`);
    return exportedAsBase64;
  } catch (error) {
    console.error('❌ Failed to export public key:', error);
    throw new Error('Failed to export public key');
  }
}

/**
 * Import public key from Base64 string
 * 
 * @param base64Key - Base64-encoded public key
 * @returns CryptoKey
 */
export async function importPublicKey(base64Key: string): Promise<CryptoKey> {
  try {
    const binaryDerString = atob(base64Key);
    const binaryDer = str2ab(binaryDerString);
    
    const publicKey = await window.crypto.subtle.importKey(
      'spki',
      binaryDer,
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      []
    );
    
    console.log('✅ Imported remote public key');
    return publicKey;
  } catch (error) {
    console.error('❌ Failed to import public key:', error);
    throw new Error('Failed to import public key');
  }
}

/**
 * Derive shared secret from local private key and remote public key
 * 
 * @param privateKey - Local private key
 * @param publicKey - Remote public key
 * @returns Derived AES-GCM key for encryption/decryption
 */
export async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> {
  try {
    const sharedSecret = await window.crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: publicKey,
      },
      privateKey,
      {
        name: 'AES-GCM',
        length: 256, // AES-256
      },
      true, // Extractable (for debugging/testing)
      ['encrypt', 'decrypt']
    );
    
    console.log('✅ Derived shared secret (AES-256-GCM)');
    return sharedSecret;
  } catch (error) {
    console.error('❌ Failed to derive shared secret:', error);
    throw new Error('Failed to derive shared secret');
  }
}

/**
 * Encrypt data using AES-GCM with shared secret
 * 
 * @param data - Data to encrypt (string or object)
 * @param sharedSecret - AES-GCM key from ECDH
 * @returns Base64-encoded ciphertext with IV prepended
 */
export async function encryptData(
  data: string | object,
  sharedSecret: CryptoKey
): Promise<string> {
  try {
    // Convert data to string if needed
    const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);
    
    // Generate random IV (12 bytes for GCM)
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt
    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128, // 128-bit authentication tag
      },
      sharedSecret,
      plaintextBytes
    );
    
    // Prepend IV to ciphertext (first 12 bytes = IV, rest = ciphertext)
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.length);
    
    // Convert to Base64 for transport
    const combinedAsString = ab2str(combined.buffer);
    const encrypted = btoa(combinedAsString);
    
    console.log(`✅ Encrypted data (${plaintext.length} → ${encrypted.length} bytes)`);
    return encrypted;
  } catch (error) {
    console.error('❌ Encryption failed:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt data using AES-GCM with shared secret
 * 
 * @param encryptedData - Base64-encoded ciphertext with IV prepended
 * @param sharedSecret - AES-GCM key from ECDH
 * @param parseJSON - If true, parse decrypted data as JSON
 * @returns Decrypted data (string or parsed object)
 */
export async function decryptData<T = string>(
  encryptedData: string,
  sharedSecret: CryptoKey,
  parseJSON: boolean = false
): Promise<T> {
  try {
    // Decode Base64
    const combinedAsString = atob(encryptedData);
    const combined = str2ab(combinedAsString);
    
    // Extract IV (first 12 bytes) and ciphertext (rest)
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    
    // Decrypt
    const plaintextBytes = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      sharedSecret,
      ciphertext
    );
    
    // Convert to string
    const decoder = new TextDecoder();
    const plaintext = decoder.decode(plaintextBytes);
    
    console.log(`✅ Decrypted data (${encryptedData.length} → ${plaintext.length} bytes)`);
    
    // Parse JSON if requested
    if (parseJSON) {
      return JSON.parse(plaintext) as T;
    }
    
    return plaintext as unknown as T;
  } catch (error) {
    console.error('❌ Decryption failed:', error);
    throw new Error('Decryption failed - possible key mismatch or corrupted data');
  }
}

/**
 * Full ECDH pairing flow (for testing)
 */
export async function testECDHPairing(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Testing ECDH Pairing Flow');
  console.log('='.repeat(60));
  
  // 1. Alice generates key pair
  console.log('\n1. Alice generates key pair...');
  const aliceKeyPair = await generateECDHKeyPair();
  const alicePublicKeyB64 = await exportPublicKey(aliceKeyPair.publicKey);
  
  // 2. Bob generates key pair
  console.log('\n2. Bob generates key pair...');
  const bobKeyPair = await generateECDHKeyPair();
  const bobPublicKeyB64 = await exportPublicKey(bobKeyPair.publicKey);
  
  // 3. Exchange public keys (simulated)
  console.log('\n3. Exchanging public keys...');
  const aliceReceivedBobPublicKey = await importPublicKey(bobPublicKeyB64);
  const bobReceivedAlicePublicKey = await importPublicKey(alicePublicKeyB64);
  
  // 4. Both derive shared secret
  console.log('\n4. Deriving shared secrets...');
  const aliceSharedSecret = await deriveSharedSecret(
    aliceKeyPair.privateKey,
    aliceReceivedBobPublicKey
  );
  const bobSharedSecret = await deriveSharedSecret(
    bobKeyPair.privateKey,
    bobReceivedAlicePublicKey
  );
  
  // 5. Alice encrypts message
  console.log('\n5. Alice encrypts message...');
  const message = { 
    greeting: 'Hello Bob!',
    timestamp: Date.now(),
    pages: ['page1', 'page2', 'page3']
  };
  const encrypted = await encryptData(message, aliceSharedSecret);
  console.log(`Encrypted: ${encrypted.substring(0, 50)}...`);
  
  // 6. Bob decrypts message
  console.log('\n6. Bob decrypts message...');
  const decrypted = await decryptData<typeof message>(encrypted, bobSharedSecret, true);
  console.log('Decrypted:', decrypted);
  
  // 7. Verify
  console.log('\n7. Verification:');
  const success = JSON.stringify(message) === JSON.stringify(decrypted);
  if (success) {
    console.log('✅ SUCCESS: Message integrity verified!');
  } else {
    console.error('❌ FAILURE: Messages do not match!');
  }
  
  console.log('='.repeat(60));
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert ArrayBuffer to string
 */
function ab2str(buf: ArrayBuffer): string {
  return String.fromCharCode.apply(null, Array.from(new Uint8Array(buf)));
}

/**
 * Convert string to ArrayBuffer
 */
function str2ab(str: string): ArrayBuffer {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

// Expose test function to window for console testing
if (typeof window !== 'undefined') {
  (window as any).testECDHPairing = testECDHPairing;
}

