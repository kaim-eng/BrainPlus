/**
 * QR Scanner Component (for Mobile)
 * 
 * Uses html5-qrcode library to scan QR codes for device pairing.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { parseQRPayload } from '../../lib/sync/qrGenerator';

interface QRScannerProps {
  onScanSuccess: (payload: any) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export default function QRScanner({ onScanSuccess, onError, onCancel }: QRScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(true);
  
  useEffect(() => {
    mountedRef.current = true;
    startScanning();
    
    return () => {
      mountedRef.current = false;
      stopScanning();
    };
  }, []);
  
  async function startScanning() {
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      
      // Request camera permission
      const cameras = await Html5Qrcode.getCameras();
      
      if (cameras.length === 0) {
        setCameraError('No camera found on this device');
        onError('No camera found');
        return;
      }
      
      // Use back camera if available (better for scanning)
      const cameraId = cameras.find((cam: any) => 
        cam.label.toLowerCase().includes('back') || 
        cam.label.toLowerCase().includes('rear')
      )?.id || cameras[0].id;
      
      setScanning(true);
      
      await scanner.start(
        cameraId,
        {
          fps: 10, // Scan 10 times per second
          qrbox: { width: 250, height: 250 }, // Scanning box size
        },
        (decodedText: string) => {
          // QR code successfully scanned
          console.log('QR code scanned:', decodedText);
          
          try {
            const payload = parseQRPayload(decodedText);
            
            // Stop scanning before calling callback
            stopScanning();
            
            if (mountedRef.current) {
              onScanSuccess(payload);
            }
          } catch (error) {
            console.error('Failed to parse QR code:', error);
            if (mountedRef.current) {
              onError(error instanceof Error ? error.message : 'Invalid QR code');
            }
          }
        },
        (_errorMessage: string) => {
          // Scanning error (usually just "No QR code found" which is normal)
          // Don't log these to avoid spamming console
        }
      );
      
    } catch (error) {
      console.error('Failed to start scanner:', error);
      
      let errorMsg = 'Failed to access camera';
      
      if (error instanceof Error) {
        if (error.message.includes('Permission')) {
          errorMsg = 'Camera permission denied. Please allow camera access in your browser settings.';
        } else if (error.message.includes('NotFound')) {
          errorMsg = 'No camera found on this device';
        } else {
          errorMsg = error.message;
        }
      }
      
      setCameraError(errorMsg);
      onError(errorMsg);
    }
  }
  
  function stopScanning() {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        }).catch((err: any) => {
          console.error('Error stopping scanner:', err);
        });
      } catch (error) {
        console.error('Error in stopScanning:', error);
      }
    }
    setScanning(false);
  }
  
  function handleCancel() {
    stopScanning();
    onCancel();
  }
  
  if (cameraError) {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>📷 Camera Error</h3>
        <div style={styles.error}>
          <p>{cameraError}</p>
        </div>
        <div style={styles.instructions}>
          <p><strong>To fix this:</strong></p>
          <ol style={styles.list}>
            <li>Go to your browser settings</li>
            <li>Find "Site Settings" or "Permissions"</li>
            <li>Allow camera access for this extension</li>
            <li>Reload and try again</li>
          </ol>
        </div>
        <button style={styles.button} onClick={handleCancel}>
          Go Back
        </button>
      </div>
    );
  }
  
  return (
    <div style={styles.container}>
      <h3 style={styles.title}>📷 Scan QR Code</h3>
      
      <div style={styles.instructions}>
        <p>Point your camera at the QR code displayed on your desktop.</p>
      </div>
      
      {/* QR Scanner viewport */}
      <div id="qr-reader" style={styles.scanner}></div>
      
      {scanning && (
        <div style={styles.scanningIndicator}>
          <div style={styles.scanLine} />
          <p style={styles.scanText}>Scanning...</p>
        </div>
      )}
      
      <button style={styles.cancelButton} onClick={handleCancel}>
        Cancel
      </button>
    </div>
  );
}

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '20px',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  title: {
    margin: '0 0 15px 0',
    fontSize: '18px',
    fontWeight: 600,
    textAlign: 'center' as const,
  },
  instructions: {
    fontSize: '14px',
    color: '#666',
    textAlign: 'center' as const,
    margin: '0 0 20px 0',
    lineHeight: 1.5,
  },
  scanner: {
    width: '100%',
    maxWidth: '350px',
    border: '2px solid #667eea',
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '20px',
  },
  scanningIndicator: {
    textAlign: 'center' as const,
    marginBottom: '15px',
  },
  scanLine: {
    width: '200px',
    height: '3px',
    background: 'linear-gradient(90deg, transparent, #667eea, transparent)',
    margin: '0 auto 10px',
    animation: 'scan 2s ease-in-out infinite',
  },
  scanText: {
    fontSize: '14px',
    color: '#667eea',
    fontWeight: 600,
    margin: 0,
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
  },
  error: {
    background: '#fee',
    border: '1px solid #fcc',
    borderRadius: '6px',
    padding: '15px',
    margin: '15px 0',
    color: '#c33',
    textAlign: 'center' as const,
  },
  list: {
    textAlign: 'left' as const,
    paddingLeft: '20px',
    margin: '10px 0',
    fontSize: '13px',
    lineHeight: 1.8,
  },
};

// Add CSS animation for scan line
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes scan {
    0%, 100% { transform: translateY(-10px); opacity: 0; }
    50% { transform: translateY(10px); opacity: 1; }
  }
`;
document.head.appendChild(styleSheet);

