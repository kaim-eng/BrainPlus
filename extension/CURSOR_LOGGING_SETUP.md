# 🔍 Cursor Logging Setup Guide

This guide shows you how to set up automatic log capturing from your Chrome/Brave extension so that Cursor can read the logs without manual copying.

## 📚 Table of Contents

1. [Quick Start (Recommended)](#quick-start-recommended)
2. [Method 1: Logs Viewer Page (Easiest)](#method-1-logs-viewer-page-easiest)
3. [Method 2: Auto-Export with Node.js (Best for Development)](#method-2-auto-export-with-nodejs-best-for-development)
4. [Method 3: Manual Console Export](#method-3-manual-console-export)
5. [Using the Logger in Your Code](#using-the-logger-in-your-code)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start (Recommended)

The **easiest** way to get started:

1. **Build the extension:**
   ```bash
   cd extension
   npm run build
   ```

2. **Load the extension in Chrome/Brave:**
   - Open `chrome://extensions` (or `brave://extensions`)
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension/dist` folder

3. **Open the Logs Viewer:**
   - Find your extension ID on the extensions page
   - Open: `chrome-extension://YOUR_EXTENSION_ID/logs.html`
   - Bookmark this page for easy access!

4. **Export logs to Cursor:**
   - Click the "💾 Export to File" button
   - Save as `EXTENSION_LOGS.txt` in the `extension` folder
   - Cursor can now read this file!

---

## Method 1: Logs Viewer Page (Easiest)

### Features:
- ✅ Beautiful UI with filtering and search
- ✅ Auto-refresh every 3 seconds
- ✅ Export to file or copy to clipboard
- ✅ Filter by level (debug, info, warn, error)
- ✅ Filter by context (background, content, popup, offscreen)
- ✅ No extra setup required

### Steps:

1. **Get your extension ID:**
   - Open `chrome://extensions`
   - Find "SecondBrain" extension
   - Copy the ID (looks like: `abcdefghijklmnopqrstuvwxyz123456`)

2. **Open the logs viewer:**
   ```
   chrome-extension://YOUR_EXTENSION_ID/logs.html
   ```

3. **Export logs:**
   - Click "💾 Export to File" button
   - Save as `extension/EXTENSION_LOGS.txt`
   - Cursor can now read it!

4. **Or copy directly:**
   - Click "📋 Copy All" button
   - Paste into Cursor chat

---

## Method 2: Auto-Export with Node.js (Best for Development)

This method automatically exports logs to a file that Cursor can read in real-time.

### Prerequisites:
- Chrome/Brave must support remote debugging
- Node.js installed

### Steps:

1. **Install dependencies:**
   ```bash
   cd extension
   npm install
   ```

2. **Start Chrome with remote debugging:**

   **Windows:**
   ```powershell
   chrome.exe --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-debug"
   ```

   **macOS:**
   ```bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="/tmp/chrome-debug"
   ```

   **Linux:**
   ```bash
   google-chrome --remote-debugging-port=9222 --user-data-dir="/tmp/chrome-debug"
   ```

   **For Brave (Windows):**
   ```powershell
   brave.exe --remote-debugging-port=9222 --user-data-dir="%TEMP%\brave-debug"
   ```

3. **Load your extension** in the Chrome instance that just opened

4. **Start the log watcher:**
   ```bash
   npm run watch-logs
   ```

5. **Done!** Logs are now continuously exported to `extension/EXTENSION_LOGS.txt`

   Cursor can read this file and you'll always see the latest logs!

### How it works:
- The watcher connects to Chrome via the Remote Debugging Protocol
- It polls the extension's storage every 2 seconds
- New logs are automatically written to `EXTENSION_LOGS.txt`
- Cursor can read this file directly

---

## Method 3: Manual Console Export

If you prefer the traditional console approach:

### Steps:

1. **Open the extension background page:**
   - Go to `chrome://extensions`
   - Find your extension
   - Click "service worker" or "background page"

2. **Use the logger to export:**
   ```javascript
   // In the console
   chrome.storage.local.get('debug_logs', (result) => {
     console.log(JSON.stringify(result.debug_logs, null, 2));
   });
   ```

3. **Or use the built-in export function:**
   ```javascript
   // In your code, add this function
   logger.exportLogsAsText().then(text => console.log(text));
   ```

4. **Copy and paste** the output into Cursor

---

## Using the Logger in Your Code

The logger is already integrated! Just import and use:

### Basic Usage:

```typescript
import { logger } from './lib/logger';

// Different log levels
logger.debug('Detailed debug information', { variable: value });
logger.info('General information', { status: 'active' });
logger.warn('Warning message', { issue: 'disk space low' });
logger.error('Error occurred', { error: errorObject });
```

### In Background Script:

```typescript
// src/background/index.ts
import { logger } from '../lib/logger';

chrome.runtime.onInstalled.addListener((details) => {
  logger.info('Extension installed', { reason: details.reason });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    logger.debug('Tab loaded', { url: tab.url, tabId });
  }
});
```

### In Content Script:

```typescript
// src/content/index.ts
import { logger } from '../lib/logger';

logger.info('Content script loaded', { url: window.location.href });

// Log user interactions
document.addEventListener('click', (e) => {
  logger.debug('User clicked', { 
    target: (e.target as HTMLElement).tagName,
    x: e.clientX,
    y: e.clientY
  });
});
```

### In React Components:

```typescript
// src/popup/App.tsx
import { logger } from '../lib/logger';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    logger.info('Popup opened');
    return () => logger.info('Popup closed');
  }, []);

  const handleSearch = (query: string) => {
    logger.debug('Search initiated', { query });
    // ... search logic
  };

  return (/* ... */);
}
```

### Error Handling:

```typescript
try {
  const result = await someAsyncOperation();
  logger.info('Operation succeeded', { result });
} catch (error) {
  logger.error('Operation failed', { 
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
}
```

---

## Logger Configuration

You can configure the logger:

```typescript
import { logger } from './lib/logger';

// Disable console logging (only write to storage)
logger.configure({ enableConsole: false });

// Disable storage logging (only write to console)
logger.configure({ enableStorage: false });

// Change max log entries (default: 1000)
logger.configure({ maxLogs: 5000 });

// Multiple options at once
logger.configure({
  enableConsole: true,
  enableStorage: true,
  maxLogs: 2000
});
```

---

## File Structure

After setup, your extension will have these logging files:

```
extension/
├── src/
│   └── lib/
│       └── logger.ts          # Logger implementation
├── public/
│   ├── logs.html              # Logs viewer page
│   └── logs.js                # Logs viewer script
├── scripts/
│   ├── log-watcher.js         # Node.js auto-export script
│   └── log-watcher.ps1        # PowerShell monitor (Windows)
├── EXTENSION_LOGS.txt         # Auto-generated log file (gitignored)
└── CURSOR_LOGGING_SETUP.md    # This guide
```

---

## Troubleshooting

### "Extension not found" in log watcher

**Solution:**
- Make sure the extension is loaded in Chrome
- Verify Chrome is running with `--remote-debugging-port=9222`
- Check that you're using the same Chrome instance
- Try opening `http://localhost:9222/json` in your browser to see available targets

### Logs not appearing in the viewer

**Solution:**
- Make sure you're using the logger in your code: `import { logger } from './lib/logger'`
- Check browser console for any errors
- Verify storage permissions in `manifest.json`:
  ```json
  "permissions": ["storage"]
  ```

### "Cannot connect to Chrome" error

**Solution:**
- Make sure Chrome is running with remote debugging enabled
- Check if port 9222 is available (not used by another process)
- On Windows, try running as administrator
- Firewall might be blocking the connection

### Logs file is empty

**Solution:**
- Make sure you've used the logger in your extension code
- Check that the extension is actually running
- Try opening the logs viewer page to verify logs exist
- Restart the log watcher script

### Too many logs / Performance issues

**Solution:**
- Reduce `maxLogs` in logger configuration
- Use appropriate log levels (avoid `debug` in production)
- Clear old logs: open logs viewer and click "Clear Logs"

---

## Best Practices

1. **Use appropriate log levels:**
   - `debug`: Detailed information for debugging
   - `info`: General informational messages
   - `warn`: Warning messages for potential issues
   - `error`: Error messages for failures

2. **Include context:**
   ```typescript
   // Good
   logger.error('Failed to fetch data', { 
     url, 
     statusCode, 
     error: error.message 
   });

   // Not as helpful
   logger.error('Error occurred');
   ```

3. **Avoid logging sensitive data:**
   - Don't log passwords, tokens, or personal information
   - Be careful with URLs that might contain sensitive params

4. **Clean up logs regularly:**
   - Logs are stored in Chrome storage (limited space)
   - Clear logs periodically via the logs viewer
   - Use the `maxLogs` configuration to auto-limit

5. **Use structured data:**
   ```typescript
   // Good - structured and searchable
   logger.info('User action', {
     action: 'search',
     query: searchTerm,
     resultCount: results.length
   });

   // Less useful - unstructured string
   logger.info(`User searched for ${searchTerm} and got ${results.length} results`);
   ```

---

## Advanced: Integrating with Cursor

### Option 1: Auto-read with Watcher

If using the Node.js watcher:

1. Keep the watcher running in a terminal
2. In Cursor, just ask: "Read the EXTENSION_LOGS.txt file"
3. Cursor will see all your logs automatically!

### Option 2: Periodic Export

Set up a keyboard shortcut or script to automatically export logs:

```javascript
// Add to your extension
chrome.commands.onCommand.addListener((command) => {
  if (command === 'export-logs') {
    logger.exportLogsAsText().then(text => {
      // Copy to clipboard
      navigator.clipboard.writeText(text);
      console.log('Logs copied to clipboard!');
    });
  }
});
```

### Option 3: Real-time Streaming

For advanced users, you could set up a WebSocket server that streams logs directly to Cursor.

---

## Summary

**For quick debugging:** Use the logs viewer page and export manually

**For active development:** Use the Node.js auto-export watcher

**For production:** Reduce log levels and disable verbose logging

The logger is designed to make debugging browser extensions much easier, especially when working with Cursor AI!

---

## Questions?

If you run into issues:
1. Check the [Troubleshooting](#troubleshooting) section
2. Verify your setup matches the steps above
3. Check browser console for error messages
4. Make sure all dependencies are installed: `npm install`

Happy debugging! 🚀

