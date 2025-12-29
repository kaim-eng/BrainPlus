# BrainPlus Sync Native Messaging Host

## Overview

The native messaging host enables the BrainPlus browser extension to perform cross-device sync by bridging between the browser and local network services.

**Key Features:**
- QR code generation for device pairing
- WebSocket signaling for device discovery
- Encrypted history batch transfer
- 100% optional (extension works without it)

## Architecture

```
Browser Extension ←→ Native Host ←→ WebSocket Server ←→ Remote Device
     (Chrome)        (Node.js)      (wss://signaling)    (Mobile)
```

## Installation

### Prerequisites

- Node.js 16+ installed
- BrainPlus extension loaded in Chrome
- Extension ID (from chrome://extensions)

### Steps

1. **Install dependencies:**

```bash
cd native-host
npm install
```

2. **Get your extension ID:**

   - Navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Load the BrainPlus extension
   - Copy the Extension ID (e.g., `abcdefghijklmnopqrstuvwxyz012345`)

3. **Install the native messaging host:**

```bash
node install-manifest.js YOUR_EXTENSION_ID_HERE
```

Example:
```bash
node install-manifest.js abcdefghijklmnopqrstuvwxyz012345
```

4. **Verify installation:**

   - Open the BrainPlus popup
   - Look for a "Sync" button or indicator
   - Click it - if the native host is detected, you'll see sync options

## Testing

### Manual Test

Test the host directly:

```bash
echo '{"type":"ping"}' | node brainplus-sync-host.js
```

Expected output:
```
{"success":true,"type":"pong","timestamp":1234567890}
```

### From Extension

1. Open the extension popup
2. Click "Sync" button
3. Check the browser console for logs:
   - `✅ Native host available` = Success
   - `⚠️ Native host not available` = Installation issue

## Troubleshooting

### "Native host not found"

**Solution:**
1. Verify the manifest is installed:
   - **macOS**: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.brainplus.sync_host.json`
   - **Linux**: `~/.config/google-chrome/NativeMessagingHosts/com.brainplus.sync_host.json`
   - **Windows**: Check registry key `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.brainplus.sync_host`

2. Verify the extension ID matches:
   ```bash
   cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.brainplus.sync_host.json
   ```
   The `allowed_origins` must include your extension ID.

3. Verify the host script is executable:
   ```bash
   chmod +x brainplus-sync-host.js
   ```

### "Permission denied"

**macOS/Linux:**
```bash
chmod +x brainplus-sync-host.js
```

**Windows:**
Run the installation script as Administrator.

### Check logs

View native host logs:

```bash
tail -f /tmp/brainplus-sync-host.log
```

## Development

### Project Structure

```
native-host/
├── brainplus-sync-host.js  # Main host script
├── manifest.json            # Native messaging manifest template
├── install-manifest.js      # Installation script
├── package.json             # NPM dependencies
└── README.md                # This file
```

### Message Protocol

The host communicates with the extension via Chrome's Native Messaging protocol (length-prefixed JSON over stdin/stdout).

**Request format:**
```json
{
  "type": "generate_qr",
  "payload": {
    "deviceId": "desktop-abc123",
    "publicKey": "BASE64_ENCODED_KEY",
    "roomId": "room_xyz789"
  }
}
```

**Response format:**
```json
{
  "success": true,
  "type": "qr_generated",
  "data": {
    "qrCodeDataUrl": "data:image/png;base64,...",
    "roomId": "room_xyz789"
  }
}
```

### Supported Message Types

| Type | Description |
|------|-------------|
| `ping` | Health check |
| `check_availability` | Check if host is available |
| `generate_qr` | Generate QR code for pairing |
| `start_signaling` | Connect to WebSocket signaling server |
| `send_batch` | Send encrypted history batch |

## Security

- **End-to-end encryption:** All history data is encrypted with ECDH + AES-GCM before leaving the extension
- **No data storage:** The native host never stores history data
- **Ephemeral keys:** New ECDH key pair generated for each sync session
- **Expiring QR codes:** QR codes expire after 5 minutes

## Progressive Enhancement

The sync feature is 100% optional:

- **Without native host:** Extension works normally (search, AMA, etc.)
- **With native host:** Sync feature is enabled

The extension will gracefully detect whether the native host is available and show/hide sync UI accordingly.

## Phase 0 Validation

Before using in production, run Phase 0 benchmarks:

1. Open `extension/benchmarks/test-runner.html` in Chrome
2. Run serialization benchmark
3. Run vector compatibility test
4. Verify results meet acceptance criteria

## License

MIT

