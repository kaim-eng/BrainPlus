/**
 * Sync View Component
 * 
 * UI for cross-device sync feature.
 * 
 * States:
 * - Not available (native host not installed)
 * - Idle (ready to sync)
 * - Pairing (waiting for QR scan)
 * - Syncing (in progress)
 * - Complete (sync finished)
 * - Error (sync failed)
 */

import React, { useState, useEffect } from 'react';
import type { SyncProgress } from '../../lib/sync/types';
import QRScanner from './QRScanner';

export default function SyncView() {
  const [nativeHostAvailable, setNativeHostAvailable] = useState<boolean | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    state: 'idle',
    progress: 0,
    operation: 'Ready to sync',
    pagesSent: 0,
    pagesReceived: 0,
    pagesMerged: 0,
    totalPages: 0,
  });
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  
  // Check native host availability and detect mobile on mount
  useEffect(() => {
    checkAvailability();
    detectMobile();
  }, []);
  
  function detectMobile() {
    const ua = navigator.userAgent;
    const mobile = /Android|iPhone|iPad|iPod/i.test(ua);
    setIsMobile(mobile);
  }
  
  // Update time remaining for QR code
  useEffect(() => {
    if (!expiresAt) return;
    
    const interval = setInterval(() => {
      const ms = Math.max(0, expiresAt - Date.now());
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      
      if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${remainingSeconds}s`);
      } else {
        setTimeRemaining(`${remainingSeconds}s`);
      }
      
      if (ms === 0) {
        clearInterval(interval);
        handleQRExpired();
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [expiresAt]);
  
  async function checkAvailability() {
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Check timeout')), 3000)
      );
      
      const checkPromise = chrome.runtime.sendMessage({
        type: 'sync:checkNativeHost',
      });
      
      const response = await Promise.race([checkPromise, timeoutPromise]) as any;
      
      setNativeHostAvailable(response.available);
    } catch (error) {
      console.error('Failed to check native host availability:', error);
      setNativeHostAvailable(false);
    }
  }
  
  async function handleStartSync() {
    try {
      setSyncProgress({
        state: 'pairing',
        progress: 0,
        operation: 'Starting sync...',
        pagesSent: 0,
        pagesReceived: 0,
        pagesMerged: 0,
        totalPages: 0,
      });
      
      const response = await chrome.runtime.sendMessage({
        type: 'sync:initiatePairing',
      });
      
      if (response.success) {
        setQrCodeDataUrl(response.qrCodeDataUrl);
        setExpiresAt(response.expiresAt);
        
        setSyncProgress({
          state: 'pairing',
          progress: 20,
          operation: 'Scan QR code from your mobile device',
          pagesSent: 0,
          pagesReceived: 0,
          pagesMerged: 0,
          totalPages: 0,
        });
      } else {
        throw new Error(response.error || 'Failed to initiate pairing');
      }
    } catch (error) {
      console.error('Failed to start sync:', error);
      setSyncProgress({
        state: 'error',
        progress: 0,
        operation: 'Sync failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        pagesSent: 0,
        pagesReceived: 0,
        pagesMerged: 0,
        totalPages: 0,
      });
    }
  }
  
  function handleQRExpired() {
    setSyncProgress({
      state: 'error',
      progress: 0,
      operation: 'QR code expired',
      error: 'Please try again',
      pagesSent: 0,
      pagesReceived: 0,
      pagesMerged: 0,
      totalPages: 0,
    });
    setQrCodeDataUrl(null);
    setExpiresAt(null);
  }
  
  function handleCancel() {
    chrome.runtime.sendMessage({ type: 'sync:cancelSync' });
    setQrCodeDataUrl(null);
    setExpiresAt(null);
    setShowScanner(false);
    setSyncProgress({
      state: 'idle',
      progress: 0,
      operation: 'Ready to sync',
      pagesSent: 0,
      pagesReceived: 0,
      pagesMerged: 0,
      totalPages: 0,
    });
  }
  
  async function handleScanQR() {
    setShowScanner(true);
  }
  
  async function handleQRScanSuccess(payload: any) {
    console.log('QR code scanned successfully:', payload);
    setShowScanner(false);
    
    // Send device paired message with our public key
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'sync:devicePaired',
        data: {
          publicKey: payload.publicKey,
          deviceInfo: {
            // This will be populated with actual device info
            deviceId: payload.deviceId,
            platform: navigator.platform,
            browser: navigator.userAgent,
          },
        },
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to pair devices');
      }
      
      setSyncProgress({
        state: 'syncing',
        progress: 30,
        operation: 'Pairing successful! Starting sync...',
        pagesSent: 0,
        pagesReceived: 0,
        pagesMerged: 0,
        totalPages: 0,
      });
    } catch (error) {
      console.error('Failed to pair devices:', error);
      setSyncProgress({
        state: 'error',
        progress: 0,
        operation: 'Pairing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        pagesSent: 0,
        pagesReceived: 0,
        pagesMerged: 0,
        totalPages: 0,
      });
    }
  }
  
  function handleQRScanError(error: string) {
    console.error('QR scan error:', error);
    setShowScanner(false);
    setSyncProgress({
      state: 'error',
      progress: 0,
      operation: 'Scan failed',
      error,
      pagesSent: 0,
      pagesReceived: 0,
      pagesMerged: 0,
      totalPages: 0,
    });
  }
  
  // Render: Loading state
  if (nativeHostAvailable === null) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Checking sync availability...</div>
      </div>
    );
  }
  
  // Render: Native host not available
  if (!nativeHostAvailable) {
    return (
      <div style={styles.container}>
        <div style={styles.notAvailable}>
          <h3 style={styles.title}>📱 Cross-Device Sync</h3>
          <p style={styles.description}>
            Sync your browsing history between desktop and mobile devices with end-to-end encryption.
          </p>
          <div style={styles.warning}>
            <strong>⚠️ Sync Companion Required</strong>
            <p>To enable sync, install the BrainPlus Sync Companion:</p>
            <ol style={styles.steps}>
              <li>Download from <a href="https://brainplus.dev/sync" target="_blank">brainplus.dev/sync</a></li>
              <li>Run the installer</li>
              <li>Restart your browser</li>
            </ol>
          </div>
          <button style={styles.retryButton} onClick={checkAvailability}>
            Check Again
          </button>
        </div>
      </div>
    );
  }
  
  // Render: Error state
  if (syncProgress.state === 'error') {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>❌ Sync Failed</h3>
        <div style={styles.error}>
          <p><strong>{syncProgress.operation}</strong></p>
          {syncProgress.error && <p>{syncProgress.error}</p>}
        </div>
        <button style={styles.button} onClick={handleStartSync}>
          Try Again
        </button>
      </div>
    );
  }
  
  // Render: Complete state
  if (syncProgress.state === 'complete') {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>✅ Sync Complete!</h3>
        <div style={styles.stats}>
          <div style={styles.stat}>
            <div style={styles.statValue}>{syncProgress.pagesSent}</div>
            <div style={styles.statLabel}>Pages Sent</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statValue}>{syncProgress.pagesReceived}</div>
            <div style={styles.statLabel}>Pages Received</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statValue}>{syncProgress.pagesMerged}</div>
            <div style={styles.statLabel}>Merged</div>
          </div>
        </div>
        <button style={styles.button} onClick={handleCancel}>
          Done
        </button>
      </div>
    );
  }
  
  // Render: Pairing state (showing QR code)
  if (syncProgress.state === 'pairing' && qrCodeDataUrl) {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>📱 Scan QR Code</h3>
        <p style={styles.instruction}>
          Open BrainPlus on your mobile device and scan this code:
        </p>
        <div style={styles.qrContainer}>
          <img src={qrCodeDataUrl} alt="Pairing QR Code" style={styles.qrCode} />
          {timeRemaining && (
            <div style={styles.timer}>Expires in: {timeRemaining}</div>
          )}
        </div>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${syncProgress.progress}%` }} />
        </div>
        <p style={styles.status}>{syncProgress.operation}</p>
        <button style={styles.cancelButton} onClick={handleCancel}>
          Cancel
        </button>
      </div>
    );
  }
  
  // Render: Syncing state
  if (syncProgress.state === 'syncing' || syncProgress.state === 'exchanging-keys') {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>🔄 Syncing...</h3>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${syncProgress.progress}%` }} />
        </div>
        <p style={styles.status}>{syncProgress.operation}</p>
        <div style={styles.stats}>
          <div style={styles.miniStat}>
            <strong>{syncProgress.pagesSent}</strong> sent
          </div>
          <div style={styles.miniStat}>
            <strong>{syncProgress.pagesReceived}</strong> received
          </div>
        </div>
        <button style={styles.cancelButton} onClick={handleCancel}>
          Cancel
        </button>
      </div>
    );
  }
  
  // Render: QR Scanner (mobile)
  if (showScanner) {
    return (
      <QRScanner
        onScanSuccess={handleQRScanSuccess}
        onError={handleQRScanError}
        onCancel={() => setShowScanner(false)}
      />
    );
  }
  
  // Render: Idle state (ready to sync)
  return (
    <div style={styles.container}>
      <h3 style={styles.title}>📱 Cross-Device Sync</h3>
      <p style={styles.description}>
        Securely sync your browsing history between desktop and mobile devices.
        All data is end-to-end encrypted.
      </p>
      <div style={styles.features}>
        <div style={styles.feature}>🔒 End-to-end encrypted</div>
        <div style={styles.feature}>🚫 No cloud storage</div>
        <div style={styles.feature}>⚡ Fast & seamless</div>
      </div>
      
      {/* Desktop: Generate QR */}
      {!isMobile && (
        <button style={styles.button} onClick={handleStartSync}>
          Generate QR Code
        </button>
      )}
      
      {/* Mobile: Scan QR */}
      {isMobile && (
        <button style={styles.button} onClick={handleScanQR}>
          Scan QR Code
        </button>
      )}
      
      <p style={styles.helpText}>
        {isMobile
          ? 'Scan the QR code displayed on your desktop'
          : 'Your mobile device will scan this QR code'}
      </p>
    </div>
  );
}

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '20px',
    maxWidth: '400px',
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: '18px',
    fontWeight: 600,
  },
  description: {
    margin: '0 0 15px 0',
    fontSize: '14px',
    color: '#666',
    lineHeight: 1.5,
  },
  features: {
    margin: '15px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  feature: {
    fontSize: '13px',
    color: '#333',
    padding: '8px 12px',
    background: '#f5f5f5',
    borderRadius: '6px',
  },
  button: {
    width: '100%',
    padding: '12px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  cancelButton: {
    width: '100%',
    padding: '10px',
    background: '#f5f5f5',
    color: '#666',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '10px',
  },
  retryButton: {
    padding: '10px 20px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  qrContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: '20px 0',
  },
  qrCode: {
    width: '300px',
    height: '300px',
    border: '2px solid #eee',
    borderRadius: '8px',
  },
  timer: {
    marginTop: '10px',
    fontSize: '14px',
    color: '#666',
  },
  instruction: {
    fontSize: '14px',
    color: '#666',
    textAlign: 'center' as const,
    margin: '10px 0',
  },
  progressBar: {
    width: '100%',
    height: '8px',
    background: '#f0f0f0',
    borderRadius: '4px',
    overflow: 'hidden',
    margin: '15px 0',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
    transition: 'width 0.3s ease',
  },
  status: {
    fontSize: '14px',
    color: '#666',
    textAlign: 'center' as const,
    margin: '10px 0',
  },
  stats: {
    display: 'flex',
    justifyContent: 'space-around',
    margin: '20px 0',
  },
  stat: {
    textAlign: 'center' as const,
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#667eea',
  },
  statLabel: {
    fontSize: '12px',
    color: '#999',
    marginTop: '4px',
  },
  miniStat: {
    fontSize: '14px',
    color: '#666',
  },
  error: {
    background: '#fee',
    border: '1px solid #fcc',
    borderRadius: '6px',
    padding: '15px',
    margin: '15px 0',
    color: '#c33',
  },
  warning: {
    background: '#fff3cd',
    border: '1px solid #ffc107',
    borderRadius: '6px',
    padding: '15px',
    margin: '15px 0',
  },
  steps: {
    marginTop: '10px',
    paddingLeft: '20px',
    fontSize: '13px',
    lineHeight: 1.8,
  },
  notAvailable: {
    //
  },
  loading: {
    textAlign: 'center' as const,
    padding: '40px 20px',
    color: '#666',
  },
  helpText: {
    fontSize: '12px',
    color: '#999',
    textAlign: 'center' as const,
    marginTop: '10px',
  },
};

