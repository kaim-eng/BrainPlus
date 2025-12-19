# 🎯 Logging Setup Summary for Cursor

## What Was Created

I've set up a comprehensive logging system for your browser extension that allows Cursor to read console logs without manual copying. Here's what was added:

### 📁 New Files Created

1. **`extension/src/lib/logger.ts`**
   - Core logging system that writes to both console AND Chrome storage
   - Automatically captures logs from all contexts (background, content, popup, offscreen)
   - Serializes data safely (handles circular references)
   - Configurable log levels and storage limits

2. **`extension/public/logs.html`** + **`logs.js`**
   - Beautiful logs viewer with dark theme
   - Real-time auto-refresh every 3 seconds
   - Advanced filtering (by level, context, search text)
   - Export to file or copy to clipboard
   - Statistics dashboard

3. **`extension/scripts/log-watcher.js`**
   - Node.js script that auto-exports logs to a file
   - Connects via Chrome Remote Debugging Protocol
   - Polls every 2 seconds and writes to `EXTENSION_LOGS.txt`
   - Cursor can read this file directly!

4. **`extension/scripts/log-watcher.ps1`**
   - PowerShell alternative for Windows
   - Monitors Chrome status
   - Provides setup instructions

5. **`extension/scripts/start-chrome-debug.ps1`** (Windows) + **`.sh`** (Mac/Linux)
   - Easy launcher scripts for Chrome with debugging enabled
   - Automatically configures the correct flags
   - Supports Chrome, Brave, and Edge

6. **Documentation:**
   - `extension/CURSOR_LOGGING_SETUP.md` - Complete setup guide
   - `extension/QUICK_REFERENCE.md` - Quick commands cheat sheet
   - `extension/.gitignore` - Excludes auto-generated log files

---

## 🚀 Quick Start (Choose Your Method)

### Method 1: Logs Viewer Page (Easiest - Recommended for You!)

**Perfect for: Quick debugging, no extra setup required**

1. Build and load your extension:
   ```bash
   cd extension
   npm run build
   ```
   Then load `extension/dist` in `chrome://extensions`

2. Get your extension ID from `chrome://extensions`

3. Open the logs viewer:
   ```
   chrome-extension://YOUR_EXTENSION_ID/logs.html
   ```
   *(Bookmark this page!)*

4. When you need to show Cursor your logs:
   - Click "💾 Export to File"
   - Save as `extension/EXTENSION_LOGS.txt`
   - Tell Cursor: "Read the EXTENSION_LOGS.txt file"

**That's it!** You can keep the logs viewer open in a tab and it auto-refreshes.

---

### Method 2: Auto-Export Watcher (Best for Active Development)

**Perfect for: Continuous development, real-time debugging**

1. Install dependencies:
   ```bash
   cd extension
   npm install
   ```

2. Start Chrome with debugging:
   ```powershell
   # Windows (PowerShell)
   .\scripts\start-chrome-debug.ps1

   # Or manually:
   chrome.exe --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-debug"
   ```

3. Load your extension in the Chrome window that opened

4. Start the log watcher in a new terminal:
   ```bash
   npm run watch-logs
   ```

5. **Done!** Logs now auto-export to `extension/EXTENSION_LOGS.txt` every 2 seconds
   
   Cursor can read this file anytime and always see fresh logs!

---

## 💻 How to Use in Your Code

### Replace `console.log` with `logger`

**Before:**
```typescript
console.log('User clicked button', data);
console.error('Failed to fetch', error);
```

**After:**
```typescript
import { logger } from './lib/logger';

logger.info('User clicked button', data);
logger.error('Failed to fetch', error);
```

### Full Example - Background Script

```typescript
// src/background/index.ts
import { logger } from '../lib/logger';

// Extension lifecycle
chrome.runtime.onInstalled.addListener((details) => {
  logger.info('Extension installed', { 
    reason: details.reason,
    version: chrome.runtime.getManifest().version 
  });
});

// Tab events
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    logger.debug('Tab loaded', { 
      tabId, 
      url: tab.url,
      title: tab.title 
    });
  }
});

// Error handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    logger.debug('Message received', { 
      type: message.type,
      from: sender.tab?.id 
    });
    
    // Handle message...
    sendResponse({ success: true });
  } catch (error) {
    logger.error('Message handling failed', { 
      error: error instanceof Error ? error.message : String(error),
      message: message.type 
    });
    sendResponse({ success: false, error: 'Failed to process' });
  }
});
```

### Example - Content Script

```typescript
// src/content/index.ts
import { logger } from '../lib/logger';

logger.info('Content script injected', { 
  url: window.location.href,
  title: document.title 
});

// Monitor page interactions
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  logger.debug('User interaction', {
    element: target.tagName,
    id: target.id,
    classes: target.className
  });
});
```

### Example - React Component

```typescript
// src/popup/components/SearchBar.tsx
import { logger } from '../../lib/logger';
import { useState } from 'react';

export function SearchBar() {
  const [query, setQuery] = useState('');

  const handleSearch = async (searchQuery: string) => {
    logger.info('Search initiated', { query: searchQuery });
    
    try {
      const results = await performSearch(searchQuery);
      logger.info('Search completed', { 
        query: searchQuery,
        resultCount: results.length,
        duration: performance.now() - startTime
      });
      return results;
    } catch (error) {
      logger.error('Search failed', { 
        query: searchQuery,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  };

  return (/* ... */);
}
```

---

## 🎨 Log Levels Guide

| Level | When to Use | Example |
|-------|-------------|---------|
| `logger.debug()` | Detailed diagnostic information | "Function called with params", "Loop iteration 5/10" |
| `logger.info()` | General informational messages | "Extension started", "User logged in", "Search completed" |
| `logger.warn()` | Warning messages, potential issues | "Rate limit approaching", "Deprecated API used" |
| `logger.error()` | Error messages, failures | "API request failed", "Database connection lost" |

---

## 📊 Benefits of This Setup

### For You:
✅ **No more copying** - Logs automatically available to Cursor
✅ **Better debugging** - See logs from all extension contexts in one place
✅ **Time-stamped** - Every log has precise timestamps
✅ **Searchable** - Filter and search through logs easily
✅ **Persistent** - Logs survive page reloads
✅ **Production-ready** - Can configure for different environments

### For Cursor:
✅ **Structured data** - Logs are well-formatted and parseable
✅ **Context-aware** - Knows which part of extension logged (background/content/popup)
✅ **Error traces** - Full stack traces included for errors
✅ **Easy access** - Just read one file (EXTENSION_LOGS.txt)

---

## 🔧 Configuration Options

You can customize the logger:

```typescript
import { logger } from './lib/logger';

// Disable console logging (storage only)
logger.configure({ enableConsole: false });

// Increase max stored logs
logger.configure({ maxLogs: 5000 });

// Development vs Production
if (process.env.NODE_ENV === 'production') {
  logger.configure({ 
    enableConsole: false,  // Don't pollute user console
    maxLogs: 1000          // Limit storage usage
  });
}
```

---

## 🛠️ Troubleshooting

### "Where are my logs?"

1. Make sure you're using `logger` instead of `console.log`
2. Open the logs viewer: `chrome-extension://YOUR_ID/logs.html`
3. If empty, check browser console for errors
4. Verify extension has `"storage"` permission in manifest.json

### "Watcher not connecting"

1. Make sure Chrome started with: `--remote-debugging-port=9222`
2. Check port 9222 is not blocked by firewall
3. Try opening `http://localhost:9222/json` in browser
4. Restart Chrome and watcher

### "Too many logs / Performance issues"

1. Use appropriate log levels (avoid excessive `debug` logs)
2. Configure: `logger.configure({ maxLogs: 500 })`
3. Clear old logs via logs viewer
4. In production, disable debug logging

---

## 📋 Next Steps

1. **Try it out:**
   - Use Method 1 (Logs Viewer) for your next debugging session
   - Add `logger` calls to your existing code
   - Export logs and paste into Cursor

2. **Set up auto-export (optional):**
   - Follow Method 2 setup
   - Keep watcher running while coding
   - Cursor always has fresh logs

3. **Integrate into your workflow:**
   - Replace existing `console.log` calls with `logger`
   - Add structured logging to error handlers
   - Use logs viewer for debugging

4. **Share with your team:**
   - The setup works for everyone
   - Logs viewer URL is shareable (within same extension)
   - Everyone can use the same workflow

---

## 📚 Documentation Files

- **`extension/CURSOR_LOGGING_SETUP.md`** - Complete setup guide (detailed)
- **`extension/QUICK_REFERENCE.md`** - Quick commands and examples
- **This file** - Overview and summary

---

## 🎉 Summary

You now have a **professional-grade logging system** that:
- ✅ Captures all extension console logs automatically
- ✅ Provides a beautiful UI for viewing/filtering logs
- ✅ Can auto-export logs to a file Cursor can read
- ✅ Works across all extension contexts
- ✅ Handles errors gracefully with full stack traces
- ✅ Is production-ready with configuration options

**No more copying console output manually!**

Just tell Cursor: *"Read the EXTENSION_LOGS.txt file"* and you're done! 🚀

---

## Questions?

Refer to:
1. `extension/CURSOR_LOGGING_SETUP.md` for detailed setup
2. `extension/QUICK_REFERENCE.md` for command cheatsheet
3. The troubleshooting sections above

Happy debugging! 🔍✨

