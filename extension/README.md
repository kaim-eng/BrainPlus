# BrainPlus Extension

Your AI-powered BrainPlus - Chromium MV3 extension for local-first knowledge management with ML embeddings.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` to set your API URL.

### 3. Development Build

```bash
npm run dev
```

### 4. Load Extension in Browser

#### Chrome/Brave:
1. Open `chrome://extensions` (or `brave://extensions`)
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder

#### Watch Mode:
```bash
npm run dev
```
Rebuilds automatically on file changes. Reload extension in browser to see updates.

### 5. Production Build

```bash
npm run build
```

## 📦 Project Structure

```
extension/
├── public/
│   ├── manifest.json          # Extension manifest
│   └── icons/                 # Extension icons
├── src/
│   ├── background/            # Service worker
│   │   ├── index.ts           # Main background script
│   │   ├── init.ts            # Initialization logic
│   │   ├── msgHandler.ts      # Message router
│   │   ├── jobs.ts            # Periodic tasks
│   │   └── handlers/          # Message handlers
│   ├── content/               # Content scripts
│   │   ├── index.ts           # Content script entry
│   │   └── scraper.ts         # DOM feature extraction
│   ├── offscreen/             # Heavy computation (ML)
│   │   ├── index.html
│   │   ├── index.ts
│   │   └── worker-tfjs.ts     # TensorFlow.js embeddings
│   ├── popup/                 # Extension UI
│   │   ├── index.html
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   ├── styles.css
│   │   └── components/
│   └── lib/                   # Shared libraries
│       ├── types.ts           # Type definitions
│       ├── constants.ts       # Constants
│       ├── db.ts              # IndexedDB manager
│       ├── differentialPrivacy.ts
│       ├── crypto.ts          # Encryption
│       ├── storage.ts         # Storage abstraction
│       └── api.ts             # API client
```

## 🔑 Key Features

### Service Worker (MV3-Compatible)
- Persistent storage with `chrome.storage.local`
- Survives worker termination (writes immediately)
- `chrome.alarms` for periodic tasks
- No in-memory state dependencies

### Content Script (Shields-Aware)
- Pure DOM scraping (no external calls)
- No beacons or tracking pixels
- Works with Brave Shields enabled

### Offscreen Document
- TensorFlow.js with Universal Sentence Encoder
- 512-dimensional embeddings for semantic search
- WebGL backend (GPU-accelerated)
- Keyword extraction with stopword removal

### Popup UI
- Dark theme by default (WCAG AA contrast)
- BrainPlus search interface
- Page digest browser
- Points dashboard (optional)
- Settings panel

### Privacy Implementation
- **Local-First**: All page content stored in IndexedDB on your device
- **No Cloud Sync**: Your data never leaves your browser
- **Differential Privacy**: Aggregated signals use Laplace noise
- **AES-GCM Encryption**: Sensitive data encrypted locally
- **Optional Backend**: Deals and points are opt-in features

## 🛡️ Brave Compatibility

This extension is fully compatible with Brave browser:

✅ **Server-side attribution** - Survives parameter stripping  
✅ **Shields-aware scraping** - No blocked requests  
✅ **Behavioral fraud detection** - Not fingerprint-dependent  
✅ **Battery Saver resilient** - Persistent storage tested  
✅ **Dark theme** - WCAG AA contrast  

See `BRAVE_QUICK_REFERENCE.md` for details.

## 🧪 Testing

### Unit Tests
```bash
npm test
```

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

## 📊 Monitoring

Check extension stats in the popup:
- **Events Queued** - Pending upload
- **Points Balance** - Total earned
- **Privacy Budget** - Remaining epsilon
- **Tracking Status** - On/Off

## 🐛 Debugging

### Service Worker Console
1. Open `chrome://extensions`
2. Find "BrainPlus"
3. Click "Inspect views: service worker"

### Content Script Console
1. Open any webpage
2. Open DevTools (F12)
3. Check console for `[Content]` logs

### Storage Inspector
```javascript
// In service worker console
chrome.storage.local.get(null, (items) => console.log(items));
```

## 🚢 Chrome Web Store Submission

### Prepare for Submission

1. **Build production version**:
   ```bash
   npm run build
   ```

2. **Create ZIP**:
   ```bash
   cd dist
   zip -r ../brainplus-v1.0.0.zip .
   ```

3. **Required files in ZIP**:
   - manifest.json
   - All scripts and HTML files
   - Icons (16x16, 48x48, 128x128)
   - No source maps in production build

### Store Listing Requirements

- **Screenshots**: 1280x800 or 640x400
- **Promotional images**: 440x280
- **Privacy policy**: Required (link to your policy)
- **Permissions justification**: Explain storage, alarms
- **Description**: Emphasize privacy-preserving design

### Review Tips

- Minimal permissions (no `unlimitedStorage`)
- Clear privacy policy
- No third-party trackers
- Works as described
- No obfuscated code

## 📄 License

MIT License - Open Source

## 🤝 Support

For issues or questions, open an issue on GitHub or contribute to the project!

