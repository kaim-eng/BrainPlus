# AMA Feature Testing Guide

**Purpose:** Quick reference for testing the Local AMA implementation  
**Status:** Phase 1 MVP Ready  
**Date:** December 19, 2025

---

## Quick Start

### 1. Build the Extension

```bash
cd extension
npm install
npm run build
```

### 2. Load in Chrome

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `extension/dist` folder

### 3. Verify Installation

- Extension icon should appear in toolbar
- Click icon → Should see onboarding (first run)
- Complete onboarding → Should see Dashboard

---

## Testing Phase 0: Privacy & Storage

### Test 1: Denylist Enforcement

**Objective:** Verify sensitive domains are blocked

**Steps:**
1. Open browser console (F12)
2. Navigate to denylisted domains:
   - `https://chase.com`
   - `https://mail.google.com`
   - `https://healthcare.gov`
3. Check console logs

**Expected:**
```
[Content] Denylisted domain detected, skipping indexing: chase.com
```

**Result:** ✅ Pass / ❌ Fail

---

### Test 2: Database Migration

**Objective:** Verify v3 → v4 migration works

**Steps:**
1. Open extension popup
2. Open browser DevTools → Application → IndexedDB
3. Find `datapay_brain_v1` database
4. Verify stores exist:
   - `digests` (existing)
   - `passages` (new)

**Expected:**
- Both stores present
- No errors in console
- Existing digests have `tsFuzzy` field

**Result:** ✅ Pass / ❌ Fail

---

### Test 3: Passage Generation

**Objective:** Verify passages are created for long pages

**Steps:**
1. Navigate to a long article (e.g., Wikipedia page)
2. Wait 2 seconds for indexing
3. Open DevTools → Console
4. Run:
```javascript
chrome.storage.local.get(null, console.log)
```
5. Check IndexedDB → `passages` store

**Expected:**
- Passages created for long pages (>2000 chars)
- Each passage has `passageId`, `text`, `embeddingBuf`
- Chunk sizes between 2000-4000 chars

**Result:** ✅ Pass / ❌ Fail

---

## Testing Phase 1: AMA Feature

### Test 4: AMA UI

**Objective:** Verify AMA tab appears and works

**Steps:**
1. Click extension icon
2. Click "🤖 Ask Me Anything" tab
3. Verify UI elements:
   - Input field
   - "Ask" button
   - Example queries

**Expected:**
- Tab switches smoothly
- Input field is focused
- Example queries are clickable

**Result:** ✅ Pass / ❌ Fail

---

### Test 5: Simple Query

**Objective:** Test basic AMA query

**Prerequisites:**
- Visit 3-5 pages about React (e.g., React docs, tutorials)
- Wait 2 seconds after each page load

**Steps:**
1. Open extension popup
2. Go to AMA tab
3. Type: "What React tutorials did I read?"
4. Click "Ask"

**Expected:**
- Loading spinner appears
- Sources appear first (with citation badges [1], [2], etc.)
- Answer appears with inline citations
- Metrics show retrieval time (<700ms)

**Result:** ✅ Pass / ❌ Fail

---

### Test 6: No Results

**Objective:** Test query with no matching pages

**Steps:**
1. Open AMA tab
2. Type: "What did I learn about quantum physics?"
3. Click "Ask"

**Expected:**
- Error message: "I don't find that in your local history."
- No sources displayed

**Result:** ✅ Pass / ❌ Fail

---

### Test 7: Citation Links

**Objective:** Verify source links work

**Steps:**
1. Run a query that returns results
2. Click "Open →" link on a source card

**Expected:**
- Opens page in new tab
- Correct URL

**Result:** ✅ Pass / ❌ Fail

---

### Test 8: Example Queries

**Objective:** Test clickable example queries

**Steps:**
1. Open AMA tab (should be idle with no previous query)
2. Click an example query

**Expected:**
- Query text fills input field
- Can immediately click "Ask"

**Result:** ✅ Pass / ❌ Fail

---

## Testing Edge Cases

### Test 9: Empty Query

**Steps:**
1. Leave input field empty
2. Click "Ask"

**Expected:**
- Button is disabled
- No request sent

**Result:** ✅ Pass / ❌ Fail

---

### Test 10: Long Query

**Steps:**
1. Type a very long query (200+ characters)
2. Click "Ask"

**Expected:**
- Query processes normally
- No UI overflow

**Result:** ✅ Pass / ❌ Fail

---

### Test 11: Rapid Queries

**Steps:**
1. Type a query and click "Ask"
2. Immediately type another query and click "Ask"

**Expected:**
- First query is cancelled
- Second query processes
- No errors in console

**Result:** ✅ Pass / ❌ Fail

---

### Test 12: Quality-Aware Eviction

**Objective:** Verify low-quality pages are evicted first

**Prerequisites:**
- Have 5000+ pages indexed (may need to disable MAX_ENTRIES limit for testing)

**Steps:**
1. Open DevTools → Console
2. Run:
```javascript
// Check digest count
chrome.runtime.sendMessage({type: 'GET_STORAGE_STATS'}, console.log)
```
3. Trigger eviction (visit many new pages)
4. Check which pages were evicted

**Expected:**
- Low-quality pages evicted first (old, low-intent, infrequent access)
- High-quality pages retained (recent, high-intent, frequent access)

**Result:** ✅ Pass / ❌ Fail

---

## Performance Testing

### Test 13: Retrieval Latency

**Objective:** Verify p95 latency ≤ 700ms

**Steps:**
1. Run 20 different queries
2. Record metrics from each query
3. Calculate p95 latency

**Expected:**
- p95 ≤ 700ms
- Most queries < 500ms

**Result:** ✅ Pass / ❌ Fail

---

### Test 14: Large Dataset

**Objective:** Test with 1000+ pages

**Steps:**
1. Index 1000+ pages (may need automation script)
2. Run AMA query
3. Check performance

**Expected:**
- Query still completes in <700ms
- No memory issues
- No UI freezing

**Result:** ✅ Pass / ❌ Fail

---

## Privacy Testing

### Test 15: Denylist Coverage

**Objective:** Verify all 75 denylisted domains work

**Steps:**
1. Create test script to visit all denylisted domains
2. Check console logs for each
3. Verify IndexedDB has no entries for denylisted domains

**Expected:**
- All 75 domains blocked
- No digests created for denylisted domains

**Result:** ✅ Pass / ❌ Fail

---

### Test 16: Incognito Mode

**Objective:** Verify no indexing in incognito

**Steps:**
1. Open incognito window
2. Visit any page
3. Check console logs

**Expected:**
```
[Content] Private window detected, skipping indexing
```

**Result:** ✅ Pass / ❌ Fail

---

## Debugging Tips

### Check Logs

**Background logs:**
```javascript
// Open extension service worker console
chrome://extensions/ → "Inspect views: service worker"
```

**Content script logs:**
```javascript
// Open page console (F12)
// Look for [Content] prefix
```

**Offscreen logs:**
```javascript
// Open extension service worker console
// Look for [Offscreen] prefix
```

---

### Inspect Storage

**IndexedDB:**
```javascript
// DevTools → Application → IndexedDB → datapay_brain_v1
// Check digests and passages stores
```

**Chrome Storage:**
```javascript
chrome.storage.local.get(null, console.log)
```

---

### Force Passage Generation

**Manually trigger chunking:**
```javascript
// In background console
const { db } = await import('./lib/db.js');
const { generatePassages } = await import('./lib/chunker.js');

const digests = await db.getAll();
const longPage = digests.find(d => d.fullText && d.fullText.length > 2000);

if (longPage) {
  const passages = generatePassages(longPage);
  console.log('Generated passages:', passages);
}
```

---

### Clear All Data

**Reset for clean testing:**
```javascript
// In background console
const { db } = await import('./lib/db.js');
await db.clearAllData();
console.log('All data cleared');
```

---

## Known Issues (Phase 1)

1. **Extractive Answers May Be Choppy**
   - Expected: Sentences are concatenated, not synthesized
   - Workaround: Phase 2 will add LLM for fluent answers

2. **No Streaming Yet**
   - Expected: Answer appears all at once
   - Workaround: Phase 2 will add token streaming

3. **Limited to Popup**
   - Expected: No global keyboard shortcut yet
   - Workaround: Phase 2 will add Ctrl+Shift+Space shortcut

---

## Success Criteria Summary

### Must Pass (Critical)

- ✅ Test 1: Denylist enforcement
- ✅ Test 2: Database migration
- ✅ Test 4: AMA UI
- ✅ Test 5: Simple query
- ✅ Test 13: Retrieval latency
- ✅ Test 15: Denylist coverage
- ✅ Test 16: Incognito mode

### Should Pass (Important)

- ✅ Test 3: Passage generation
- ✅ Test 6: No results
- ✅ Test 7: Citation links
- ✅ Test 9: Empty query
- ✅ Test 12: Quality-aware eviction

### Nice to Have (Optional)

- ✅ Test 8: Example queries
- ✅ Test 10: Long query
- ✅ Test 11: Rapid queries
- ✅ Test 14: Large dataset

---

## Reporting Issues

When reporting issues, include:

1. **Test number** (e.g., Test 5)
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **Console logs** (background + content script)
6. **Screenshots** (if UI issue)
7. **Browser version**
8. **Extension version**

---

## Next Steps After Testing

1. **If all tests pass:** Ready for Phase 2 (LLM integration)
2. **If tests fail:** Debug and fix issues
3. **If performance issues:** Optimize retrieval or ranking
4. **If UI issues:** Refine CSS or component logic

---

**Testing Status:** 🔄 Ready for Testing  
**Last Updated:** December 19, 2025  
**Version:** Phase 1 MVP



