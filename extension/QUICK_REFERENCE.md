# 🚀 Quick Reference: Logging for Cursor

## Super Quick Start (30 seconds)

1. **Build extension:**
   ```bash
   cd extension && npm run build
   ```

2. **Load extension:**
   - Open `chrome://extensions`
   - Enable Developer mode
   - Load unpacked → select `extension/dist`

3. **Open logs viewer:**
   ```
   chrome-extension://YOUR_EXTENSION_ID/logs.html
   ```
   *(Get YOUR_EXTENSION_ID from chrome://extensions)*

4. **Export to Cursor:**
   - Click "💾 Export to File"
   - Save as `EXTENSION_LOGS.txt`
   - Tell Cursor: "Read EXTENSION_LOGS.txt"

---

## Commands Cheat Sheet

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build extension
npm run watch-logs       # Auto-export logs (Node.js)
npm run watch-logs:ps1   # Auto-export logs (PowerShell)

# First time setup
npm install              # Install dependencies
```

---

## Quick Code Examples

```typescript
import { logger } from './lib/logger';

// Basic logging
logger.info('Message here');
logger.debug('Debug details', { data: value });
logger.warn('Warning!', { reason: 'issue' });
logger.error('Error occurred', { error });

// In background script
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  logger.debug('Tab updated', { tabId, url: tab.url });
});

// In React component
useEffect(() => {
  logger.info('Component mounted');
}, []);

// Error handling
try {
  await doSomething();
} catch (error) {
  logger.error('Failed', { error });
}
```

---

## Browser URLs

```
chrome://extensions              # Manage extensions
chrome-extension://ID/logs.html  # Logs viewer
chrome-extension://ID/popup.html # Popup
```

---

## Log Viewer Shortcuts

- **F5** or Click "Refresh" - Reload logs
- **Auto-refresh checkbox** - Updates every 3 seconds
- **Filter dropdowns** - Filter by level/context
- **Search box** - Text search through logs
- **Export button** - Download logs
- **Copy button** - Copy to clipboard
- **Clear button** - Delete all logs

---

## Chrome Debug Mode (for auto-export)

**Windows:**
```powershell
chrome.exe --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-debug"
```

**macOS:**
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="/tmp/chrome-debug"
```

**Brave:**
```powershell
brave.exe --remote-debugging-port=9222 --user-data-dir="%TEMP%\brave-debug"
```

Then run: `npm run watch-logs`

---

## Troubleshooting One-Liners

**Logs not showing?**
→ Check you imported logger: `import { logger } from './lib/logger'`

**Watcher not connecting?**
→ Make sure Chrome started with `--remote-debugging-port=9222`

**Export not working?**
→ Use logs viewer page and manual export instead

**Too many logs?**
→ Click "Clear Logs" in viewer or reduce logging in code

---

## File Locations

```
extension/src/lib/logger.ts           # Logger implementation
extension/public/logs.html            # Logs viewer UI
extension/EXTENSION_LOGS.txt          # Auto-exported logs (Cursor reads this)
extension/CURSOR_LOGGING_SETUP.md    # Full setup guide
```

---

That's it! For detailed setup, see [CURSOR_LOGGING_SETUP.md](./CURSOR_LOGGING_SETUP.md)

