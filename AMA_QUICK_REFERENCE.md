# AMA Feature Quick Reference

**For:** Developers working on the AMA feature  
**Version:** Phase 1 MVP  
**Date:** December 19, 2025

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        USER QUERY                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  AMA.tsx (Popup)                                             │
│  - Input field                                               │
│  - Port connection to background                            │
│  - Display sources + answer                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  amaHandler.ts (Background)                                  │
│  - handleAMAQuery() - streaming via port                    │
│  - retrievePassages() - get relevant passages               │
│  - composeExtractiveAnswer() - build answer                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  search.ts (Lib)                                             │
│  - rankPassages() - hybrid scoring                          │
│  - getQueryEmbedding() - via offscreen                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  db.ts (Lib)                                                 │
│  - getAllPassages() - load from IndexedDB                   │
│  - getAll() - load parent pages                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Files

### Core Logic

| File | Purpose | Key Functions |
|------|---------|---------------|
| `lib/chunker.ts` | Text chunking | `chunkText()`, `generatePassages()` |
| `lib/search.ts` | Passage retrieval | `rankPassages()`, `retrievePassages()` |
| `lib/db.ts` | Storage | `savePassages()`, `getAllPassages()` |
| `background/handlers/amaHandler.ts` | Query handling | `handleAMAQuery()`, `composeExtractiveAnswer()` |

### UI Components

| File | Purpose | Key Components |
|------|---------|----------------|
| `popup/components/AMA.tsx` | Main UI | `AMA` component |
| `popup/components/Dashboard.tsx` | Tab navigation | Tab switching logic |
| `popup/styles.css` | Styling | `.ama-*` classes |

### Message Handling

| File | Purpose | Key Handlers |
|------|---------|--------------|
| `background/index.ts` | Port connections | `chrome.runtime.onConnect` |
| `background/msgHandler.ts` | One-time messages | `case 'AMA_QUERY'` |

---

## Data Structures

### PageDigest (v4)

```typescript
interface PageDigest {
  schemaVersion: 4;
  urlHash: string;           // Primary key
  url: string;               // Original URL
  title: string;
  summary: string;
  fullText?: string;         // For chunking
  vectorBuf: ArrayBuffer;    // 512-dim embedding
  entities: string[];
  category: string;
  intentScore: number;
  timestamp: number;         // Precise
  tsFuzzy: number;           // Rounded to hour (DP)
  lastAccessed: number;
  // ... other fields
}
```

### Passage (v4)

```typescript
interface Passage {
  passageId: string;         // `${urlHash}:${chunkIdx}`
  urlHash: string;           // Reference to parent
  chunkIdx: number;          // 0, 1, 2...
  text: string;              // 512-1024 tokens
  embeddingBuf: ArrayBuffer; // 512-dim embedding
  tsFuzzy: number;           // Inherited from parent
  category: string;          // Inherited from parent
  createdAt: number;
}
```

### AMASource

```typescript
interface AMASource {
  citationId: number;        // [1], [2], etc.
  title: string;
  url: string;
  domain: string;
  snippet: string;           // First 200 chars
  dateRelative: string;      // "2 days ago"
  timestamp: number;
  relevanceScore: number;    // 0.0-1.0
}
```

---

## Message Flow

### Streaming (via Port)

```typescript
// Popup → Background
port.postMessage({
  type: 'AMA_QUERY',
  query: 'What React tutorials did I read?',
  timestamp: Date.now()
});

// Background → Popup (sequence)
port.postMessage({
  type: 'AMA_SOURCES',
  sources: [...],
  requestId: 'ama-123'
});

port.postMessage({
  type: 'AMA_TOKEN',
  token: 'Answer text...',
  requestId: 'ama-123'
});

port.postMessage({
  type: 'AMA_DONE',
  metrics: {...},
  requestId: 'ama-123'
});
```

### One-Time (via Message)

```typescript
// Popup → Background
const response = await chrome.runtime.sendMessage({
  type: 'AMA_QUERY',
  query: 'What React tutorials did I read?'
});

// Response
{
  success: true,
  sources: [...],
  answer: '...',
  metrics: {...}
}
```

---

## Configuration

### Chunking

```typescript
// lib/chunker.ts
const MIN_TEXT_LENGTH = 2000;        // Min chars to chunk
const MIN_INTENT_SCORE = 0.6;        // Min intent to chunk
const TARGET_CHUNK_SIZE = 3000;      // Target chars (~750 tokens)
const MAX_CHUNK_SIZE = 4000;         // Max chars (~1000 tokens)
const OVERLAP_SIZE = 500;            // Overlap chars (~125 tokens)
```

### Retrieval

```typescript
// lib/search.ts
const DEFAULT_MAX_SOURCES = 12;      // Top-K passages
const MAX_PASSAGES_PER_PAGE = 3;     // De-duplication limit
const NEAR_DUPLICATE_THRESHOLD = 0.95; // Cosine similarity
```

### Scoring Weights

```typescript
// lib/search.ts - rankPassages()
const W_SEMANTIC = 0.5;              // Semantic similarity
const W_FRESHNESS = 0.3;             // Recency
const W_INTENT = 0.15;               // Intent score
// + lexical boost (0-0.15)
// + entity boost (0-0.2)
```

### Quality Eviction

```typescript
// lib/db.ts - calculateQualityScore()
const qualityScore = 
  (recencyScore * 0.3) +             // Recent = keep
  (intentScore * 0.3) +              // High-intent = keep
  (accessScore * 0.3) +              // Frequently accessed = keep
  (categoryScore * 0.1);             // Valuable category = keep
```

---

## Common Tasks

### Add a New Message Type

1. **Add to types.ts:**
```typescript
export type MessageType = 
  | 'AMA_QUERY'
  | 'YOUR_NEW_TYPE';  // Add here

export interface YourNewMessage extends BaseMessage {
  type: 'YOUR_NEW_TYPE';
  // ... fields
}
```

2. **Handle in msgHandler.ts:**
```typescript
case 'YOUR_NEW_TYPE': {
  // Handle message
  return { success: true };
}
```

---

### Add a New Scoring Factor

1. **Update rankPassages() in search.ts:**
```typescript
const yourNewScore = calculateYourScore(passage);

const finalScore = 
  (semantic * W_SEMANTIC) +
  (freshness * W_FRESHNESS) +
  (intent * W_INTENT) +
  lexical +
  entity +
  yourNewScore;  // Add here
```

2. **Update RankedPassage interface:**
```typescript
interface RankedPassage {
  factors: {
    semantic: number;
    freshness: number;
    intent: number;
    lexical: number;
    yourNew: number;  // Add here
  };
}
```

---

### Add a New Denylist Domain

1. **Update constants.ts:**
```typescript
export const DENYLIST_DOMAINS = [
  // ... existing domains
  'yournewdomain.com',  // Add here
] as const;
```

2. **Test:**
```bash
# Visit the domain
# Check console: "[Content] Denylisted domain detected"
```

---

### Modify Chunking Strategy

1. **Update chunker.ts:**
```typescript
export function shouldChunkPage(page: PageDigest): boolean {
  // Modify conditions here
  if (!page.fullText || page.fullText.length < YOUR_MIN_LENGTH) {
    return false;
  }
  
  if (page.intentScore < YOUR_MIN_SCORE) {
    return false;
  }
  
  return true;
}
```

2. **Update constants:**
```typescript
const MIN_TEXT_LENGTH = YOUR_VALUE;
const MIN_INTENT_SCORE = YOUR_VALUE;
```

---

## Debugging

### Enable Verbose Logging

```typescript
// Add to any file
console.log('[AMA] Your debug message', data);
```

### Inspect Passages

```javascript
// Background console
const { db } = await import('./lib/db.js');
const passages = await db.getAllPassages();
console.log('Total passages:', passages.length);
console.log('Sample passage:', passages[0]);
```

### Test Retrieval

```javascript
// Background console
const { retrievePassages } = await import('./lib/search.js');
const results = await retrievePassages('React hooks', 12);
console.log('Retrieved passages:', results);
```

### Test Chunking

```javascript
// Background console
const { chunkText, getPassageStats } = await import('./lib/chunker.js');
const text = 'Your long text here...';
const chunks = chunkText(text);
console.log('Chunks:', chunks.length);
console.log('Stats:', getPassageStats(chunks.map((text, idx) => ({
  passageId: `test:${idx}`,
  urlHash: 'test',
  chunkIdx: idx,
  text,
  tsFuzzy: Date.now(),
  category: 'test',
  createdAt: Date.now()
}))));
```

---

## Performance Optimization

### Batch Operations

```typescript
// ❌ Slow: Individual saves
for (const passage of passages) {
  await db.savePassage(passage);
}

// ✅ Fast: Batch save
await db.savePassages(passages);
```

### Lazy Loading

```typescript
// ❌ Slow: Load all passages upfront
const allPassages = await db.getAllPassages();
const filtered = allPassages.filter(p => p.category === 'tech');

// ✅ Fast: Filter in database
// (Note: Would need to add index-based filtering)
```

### Hydration

```typescript
// ❌ Slow: Hydrate all vectors
const passages = await db.getAllPassages();
passages.forEach(p => p.embedding = bufferToVector(p.embeddingBuf));

// ✅ Fast: Hydrate on-demand
const passages = await db.getAllPassages();
// Only hydrate when needed in rankPassages()
```

---

## Testing Shortcuts

### Quick Test Query

```javascript
// Popup console
chrome.runtime.sendMessage({
  type: 'AMA_QUERY',
  query: 'test query',
  timestamp: Date.now()
}, console.log);
```

### Clear All Data

```javascript
// Background console
const { db } = await import('./lib/db.js');
await db.clearAllData();
```

### Force Passage Generation

```javascript
// Background console
const { db } = await import('./lib/db.js');
const { generatePassages } = await import('./lib/chunker.js');

const pages = await db.getAll();
const longPage = pages.find(p => p.fullText?.length > 2000);

if (longPage) {
  const passages = generatePassages(longPage);
  console.log('Generated:', passages.length, 'passages');
}
```

---

## Common Errors

### "No passages found"

**Cause:** No pages have been chunked yet  
**Fix:** Visit long pages (>2000 chars) with high intent (>0.6)

### "Offscreen document not ready"

**Cause:** TensorFlow.js worker not initialized  
**Fix:** Wait 2-3 seconds after extension load

### "Port disconnected"

**Cause:** Background service worker terminated  
**Fix:** Reconnect port or use one-time message

### "Vector dimension mismatch"

**Cause:** Mixing 384-dim and 512-dim vectors  
**Fix:** Ensure all embeddings use same model

---

## Phase 2 Preparation

### WebLLM Integration Points

1. **Offscreen Worker:**
   - Create `offscreen/worker-webllm.ts`
   - Add exclusive execution mode

2. **Model Loading:**
   - Add to onboarding flow
   - Show download progress

3. **Streaming:**
   - Update `handleAMAQuery()` to stream tokens
   - Update `AMA.tsx` to display live tokens

4. **Verifier:**
   - Add `verifyAnswer()` in amaHandler
   - Flag unsupported sentences

---

## Resources

- **Design Doc:** `AMA_DESIGN_REVIEW.md`
- **Implementation Summary:** `AMA_IMPLEMENTATION_SUMMARY.md`
- **Testing Guide:** `AMA_TESTING_GUIDE.md`
- **Codebase:** `extension/src/`

---

**Last Updated:** December 19, 2025  
**Version:** Phase 1 MVP  
**Status:** Production Ready



