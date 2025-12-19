# Test Pages for SecondBrain Extension

This directory contains HTML test pages for manual testing of extension features.

## 📂 Directory Structure

```
test-pages/
├── README.md                          # This file
├── task-continuation/                 # Task Continuation feature tests
│   ├── 01-react-usestate.html        # React useState tutorial (coherent)
│   ├── 02-react-useeffect.html       # React useEffect tutorial (coherent)
│   ├── 03-react-context.html         # React Context API (coherent)
│   └── 04-noise-cooking.html         # Cooking recipe (noise - should be filtered)
└── general/                           # General feature tests
    └── sample-page.html               # Basic test page
```

## 🧪 Task Continuation Tests

### Quick Test (2 minutes)

**Purpose:** Verify the Task Continuation feature detects coherent browsing sessions.

**Steps:**
1. **Open test pages** (in this order):
   - `task-continuation/01-react-usestate.html`
   - `task-continuation/02-react-useeffect.html`
   - `task-continuation/03-react-context.html`

2. **Wait 2 minutes** for page analysis (extension processes in background)

3. **Close all tabs**

4. **Lock computer** (Windows Key + L) for 1 minute

5. **Unlock and click extension icon**

6. **Expected Result:**
   - ✅ Purple gradient Resume Card appears
   - ✅ Shows "Researching React" or similar title
   - ✅ Badge "1" on extension icon
   - ✅ Shows 3 pages with coherence indicator (green = focused)
   - ✅ Click "Resume" → All 3 tabs reopen (no duplicates)

### Noise Filtering Test

**Purpose:** Verify the feature filters out unrelated pages.

**Steps:**
1. **Open pages in mixed order:**
   - `01-react-usestate.html`
   - `02-react-useeffect.html`
   - `04-noise-cooking.html` ← Unrelated content
   - `03-react-context.html`

2. **Follow same steps as Quick Test above**

3. **Expected Result:**
   - ✅ Resume Card shows only 3 React pages
   - ✅ Cooking page is filtered out (semantic clustering excludes low-coherence pages)
   - ✅ Page count shows "3 pages" not "4 pages"

### Large Session Test

**Purpose:** Verify tab cap warning for large sessions.

**Steps:**
1. **Open 15+ tabs** on similar topics (duplicate the React test pages)

2. **Follow Quick Test steps**

3. **Expected Result:**
   - ✅ Warning: "Large session (15 tabs)"
   - ✅ Two buttons visible:
     - "Resume Top 10" (opens most relevant 10)
     - "Resume All (15)" (opens all with confirmation)

## 📝 Creating Custom Test Pages

### Template for Coherent Session

```html
<!DOCTYPE html>
<html>
<head>
    <title>Your Topic Here</title>
    <meta name="description" content="Description with keywords repeated for better semantic matching">
</head>
<body>
    <h1>Main Topic Here</h1>
    <h2>Subtopic 1</h2>
    <p>Content with repeated keywords about [your topic]...</p>
    <p>More content with semantic similarity to [your topic]...</p>
    
    <!-- Need 100+ words for proper analysis -->
</body>
</html>
```

**Tips for Good Test Pages:**
- **Rich content:** >100 words
- **Repeated keywords:** Include topic words 3-5 times
- **Semantic similarity:** Related concepts and terminology
- **Clear entities:** Specific product names, technologies, brands

## 🔍 Debugging

### Check Analysis Logs

Open browser console (F12) and filter by:
- `[PageAnalysis]` - Page processing logs
- `[SessionHandler]` - Session detection logs
- `[SessionWorker]` - Clustering logs

### Verify Page Analysis

```javascript
// In browser console after visiting test page
chrome.storage.local.get('lastDigest', data => {
  console.log('Last analyzed page:', data);
});
```

### Check Pending Session

```javascript
// After idle state triggers session detection
chrome.storage.local.get('pendingSession', data => {
  console.log('Pending session:', data);
});
```

## ⚙️ Test Configuration

### Adjust Session Detection Settings

Edit `extension/src/lib/sessionizer.ts` to tune behavior:

```typescript
const DEFAULT_CONFIG: SessionizerConfig = {
  maxPages: 50,              // Max pages to analyze
  timeGapMinutes: 30,        // Gap between sessions
  minCoherence: 0.6,         // Semantic similarity threshold (0.0-1.0)
  minPagesPerSession: 3,     // Min pages to form session
  maxSessionAgeHours: 12,    // Max age to suggest
};
```

## 📚 Related Documentation

- **Task Continuation Overview:** See `ONBOARDING_DESIGN_DOC.md` → Section 3.2
- **Full Test Guide:** See `ONBOARDING_DESIGN_DOC.md` → Section 10.2
- **Implementation Details:** `extension/src/lib/sessionizer.ts`

## 🐛 Troubleshooting

### Resume Card Doesn't Appear

**Possible Causes:**
- Pages not analyzed yet (wait 2-3 minutes)
- Less than 3 pages in session
- Session older than 12 hours
- Pages missing vectors (check console warnings)
- Cooldown active (30min between checks)

**Solutions:**
1. Check console for `[SessionHandler]` logs
2. Verify pages have >100 words
3. Wait longer for analysis
4. Try with fresh browser session

### Wrong Pages in Session

**Possible Causes:**
- Pages too similar semantically
- Coherence threshold too low

**Solutions:**
1. Increase `minCoherence` in config (try 0.7)
2. Make test pages more distinct
3. Check console logs for coherence scores

---

**Last Updated:** December 18, 2025  
**Maintainer:** Engineering Team

