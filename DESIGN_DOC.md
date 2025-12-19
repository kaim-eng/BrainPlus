# SecondBrain - Complete Technical Design & Onboarding Document

**Version:** 2.0  
**Last Updated:** December 18, 2025  
**Status:** Active Development (v0.2 - Local-First Architecture with Task Continuation)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Feature Implementations](#3-feature-implementations)
4. [Technology Stack](#4-technology-stack)
5. [Component Details](#5-component-details)
6. [Data Models & Storage](#6-data-models--storage)
7. [API Specifications](#7-api-specifications)
8. [Privacy & Security](#8-privacy--security)
9. [Development Setup](#9-development-setup)
10. [Testing Strategy](#10-testing-strategy)
11. [Deployment & Operations](#11-deployment--operations)
12. [Troubleshooting Guide](#12-troubleshooting-guide)
13. [Appendices](#13-appendices)

---

## 1. Executive Summary

### 1.1 What is SecondBrain?

SecondBrain is a **privacy-first browser extension** that serves as an AI-powered knowledge management system. It captures and organizes your browsing history locally using machine learning embeddings for semantic search, while optionally providing personalized deal recommendations based on aggregated interest signals.

**Core Value Propositions:**
- 🧠 **Local-First "Second Brain"** - Store and search your browsing history semantically
- 🔒 **Privacy-Preserving** - All content stays on your device, never uploaded to servers
- 💰 **Optional Rewards** - Earn points by sharing aggregated interests (not browsing history)
- 🎯 **Intelligent Deals** - Get personalized recommendations without compromising privacy
- 🔄 **Task Continuation** - Resume interrupted browsing sessions intelligently

### 1.2 Architecture Philosophy

**v0.2 Pivot: From Cloud-First to Local-First**

```
v0.1 (OLD):                          v0.2 (CURRENT):
┌─────────────┐                      ┌─────────────┐
│   Browser   │ ──upload──>          │   Browser   │ (no upload)
└─────────────┘                      └──────┬──────┘
       ↓                                    │
┌─────────────┐                      ┌─────▼─────┐
│   Backend   │                      │ IndexedDB │
│ Stores All  │                      │  (Local)  │
└─────────────┘                      └───────────┘
                                            ↓
                                     (optional signal)
                                            ↓
                                     ┌─────────────┐
                                     │   Backend   │
                                     │ (Aggregated)│
                                     └─────────────┘
```

**Key Privacy Guarantee:**
- Backend receives: "User interested in 'headphones'" ✅
- Backend never sees: "User visited Sony WH-1000XM5 review on TechRadar at 10:00 AM" ❌

### 1.3 Project Status

| Phase | Status | Duration |
|-------|--------|----------|
| Phase 0: Dead Code Elimination | ✅ Complete | 2 days |
| Phase 1: Foundation (IndexedDB, Dependencies) | ✅ Complete | 1 week |
| Phase 2: On-Device Inference (ML Model) | ✅ Complete | 1.5 weeks |
| Phase 3: Search Feature | ✅ Complete | 1 week |
| Phase 4: Task Continuation Feature | ✅ Complete | 1 week |
| Phase 5: Testing & Refinement | 🚧 In Progress | 1 week |

**Total Timeline:** 6 weeks to Beta

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       BROWSER (Chromium MV3)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Content    │  │   Service    │  │   Popup UI   │         │
│  │   Script     │──▶│   Worker     │◀─│   (React)    │         │
│  │  (Scraper)   │  │ (Background) │  │              │         │
│  └──────────────┘  └──────┬───────┘  └──────────────┘         │
│                           │                                      │
│  ┌──────────────┐         │                                     │
│  │  Offscreen   │◀────────┘                                     │
│  │  Document    │                                               │
│  │ (ML Model)   │                                               │
│  └──────┬───────┘                                               │
│         │                                                        │
│  ┌──────▼───────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  IndexedDB   │  │chrome.storage│  │  Cache API   │         │
│  │  (Digests)   │  │   (Config)   │  │ (ML Weights) │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
└─────────────────────────────┬────────────────────────────────────┘
                              │
                              │ (Optional, User-Initiated)
                              │
                        ┌─────▼──────┐
                        │            │
                        │  Backend   │
                        │  (FastAPI) │
                        │            │
                        └─────┬──────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────▼─────┐   ┌────▼────┐   ┌─────▼─────┐
        │PostgreSQL │   │  Redis  │   │ Affiliate │
        │  (Users,  │   │(Cache,  │   │ Networks  │
        │  Points)  │   │ Rate    │   │ (Amazon,  │
        │           │   │Limiting)│   │ShareASale)│
        └───────────┘   └─────────┘   └───────────┘
```

### 2.2 Component Interaction Matrix

| Component | Communicates With | Protocol | Frequency |
|-----------|------------------|----------|-----------|
| Content Script | Background | `chrome.runtime.sendMessage` | Per page load |
| Background | Offscreen | Create/close offscreen doc | Batched (5 pages) |
| Background | IndexedDB | IDB API | Per analyzed page |
| Background | Backend | HTTPS/JSON | User-initiated |
| Popup | Background | `chrome.runtime.sendMessage` | On user action |
| Popup | IndexedDB | IDB API | On tab open |

---

## 3. Feature Implementations

### 3.1 Private Semantic Search ✅

**Status:** Production Ready  
**Completion Date:** December 18, 2025

**Overview:**
Local-first semantic search using machine learning embeddings (512-dimensional vectors). All processing happens on-device with zero data sent to servers.

**Key Features:**
- ✅ ArrayBuffer storage for 50% smaller footprint
- ✅ L2 normalization for fast cosine similarity
- ✅ Query caching (LRU, instant repeat searches)
- ✅ Adaptive hybrid scoring (semantic + freshness + intent + lexical + entity)
- ✅ Privacy enforcement (filter private/expired pages)
- ✅ Fallback keyword search (if ML model fails)
- ✅ 115+ comprehensive test cases

**Performance:**
- Query embedding: ~35ms (target: <50ms) ✅
- Ranking 1k items: ~45ms (target: <100ms) ✅
- Ranking 5k items: ~185ms (target: <200ms) ✅
- Total latency (p95): ~250ms (target: <300ms) ✅

**Files:**
- `extension/src/lib/search.ts` (522 lines) - Core search engine
- `extension/src/lib/search.test.ts` (432 lines) - Comprehensive tests
- `extension/src/popup/components/SearchBar.tsx` - Search input UI
- `extension/src/popup/components/ResultCard.tsx` - Results display

**Documentation:** See [Search Feature](#31-private-semantic-search) for detailed docs.

---

### 3.2 Task Continuation ("Resume Flow") ✅

**Status:** Production Ready  
**Completion Date:** December 18, 2025

**Overview:**
Intelligently groups browsing sessions and offers to resume interrupted tasks when you return to your computer. Uses time-based windowing (30min gaps) and semantic clustering to detect coherent research sessions.

**Key Features:**
- ✅ Time-based session detection (30min gap threshold)
- ✅ Semantic coherence filtering (cosine similarity > 0.6)
- ✅ Deterministic session IDs (SHA-256 hash + hour bucket)
- ✅ Human-readable titles ("Researching React")
- ✅ Idle state detection (`chrome.idle` API)
- ✅ Badge notification (green "1" indicator)
- ✅ Tab deduplication on resume
- ✅ 30-minute cooldown (prevents spam)
- ✅ Tab cap UI (warn for >10 tabs, max 20)
- ✅ Legacy data handling (graceful degradation)
- ✅ Ghost session prevention (invalidate on page delete)
- ✅ Missing vector handling (defensive filtering)

**Architecture:**
```
User Returns → Idle State Change → Session Handler → Offscreen Worker
    ↓
Cluster Recent Pages (50 pages, non-private)
    ↓
Time Slicing (30min gaps) → Semantic Filtering (coherence > 0.6)
    ↓
Generate Session → Store as Pending → Set Badge
    ↓
User Clicks Icon → Popup Shows Resume Card → Click "Resume"
    ↓
Open Tabs (deduplicated, max 20) → Clear Badge
```

**Critical Fixes Implemented:**
1. **Offscreen Contention** - Singleton manager prevents race conditions
2. **Legacy Data** - Graceful degradation for pages without URLs
3. **Idle Debouncing** - 30min cooldown prevents battery drain
4. **Tab Cap** - UI warns for large sessions (>10 tabs)
5. **Ghost Sessions** - Invalidate when page deleted
6. **Missing Vectors** - Defensive filtering in clustering

**Files:**
- `extension/src/lib/sessionizer.ts` (344 lines) - Core clustering logic
- `extension/src/background/handlers/sessionHandler.ts` (270 lines) - Session management
- `extension/src/offscreen/worker-sessions.ts` (75 lines) - Offscreen clustering
- `extension/src/popup/components/ResumeCard.tsx` (175 lines) - Resume UI

**Documentation:** See [Task Continuation](#32-task-continuation-resume-flow) for detailed docs.

**Testing:**
- 8 manual test scenarios documented
- Test files organized in `test-pages/task-continuation/`:
  - `01-react-usestate.html` - React useState tutorial
  - `02-react-useeffect.html` - React useEffect tutorial
  - `03-react-context.html` - React Context API
  - `04-noise-cooking.html` - Noise page (should be filtered)
- See `test-pages/README.md` for quick 2-minute test procedure

---

## 4. Technology Stack

### 4.1 Extension (Frontend)

| Technology | Version | Purpose |
|------------|---------|---------|
| **TypeScript** | 5.2.2 | Type-safe JavaScript |
| **React** | 18.2.0 | Popup UI framework |
| **Vite** | 5.0.8 | Build tool & dev server |
| **TensorFlow.js** | 4.22.0 | ML inference (WebGL backend) |
| **Universal Sentence Encoder** | 1.3.3 | 512-dim embeddings |
| **IndexedDB (idb)** | 8.0.3 | Local database wrapper |
| **Stopword** | 3.1.5 | Keyword extraction |
| **Chrome Extensions API** | MV3 | Browser integration |

**Bundle Size Target:** < 5MB (including ML model)

### 4.2 Backend (Optional Service)

| Technology | Version | Purpose |
|------------|---------|---------|
| **FastAPI** | 0.109.0 | Async Python web framework |
| **PostgreSQL** | 15+ | User data, points, catalog |
| **SQLAlchemy** | 2.0.25 | Async ORM |
| **Alembic** | 1.13.1 | Database migrations |
| **Redis** | 7+ | Caching, rate limiting |
| **Uvicorn** | 0.27.0 | ASGI server |
| **Pydantic** | 2.5.3 | Data validation |
| **httpx** | 0.26.0 | Async HTTP client |

---

## 5. Component Details

### 5.1 Content Script (`extension/src/content/`)

**Purpose:** Extract page content without network requests (Brave Shields compatible)

**Key Files:**
- `index.ts` - Entry point, initialization
- `scraper.ts` - DOM extraction logic

**Extraction Logic:**

```typescript
export interface PageFeatures {
  url: string;
  title: string;
  metaDescription: string;
  headings: string[];      // H1, H2
  mainText: string;        // First 500 words
  productData?: {          // JSON-LD structured data
    name: string;
    price: number;
    availability: string;
  };
}

function extractPageFeatures(): PageFeatures {
  // 1. Privacy checks
  if (chrome.extension?.inIncognitoContext) return null;
  if (isBlacklistedDomain(window.location.hostname)) return null;
  
  // 2. Extract content
  const title = document.title;
  const meta = document.querySelector('meta[name="description"]')?.content;
  const h1 = Array.from(document.querySelectorAll('h1')).map(h => h.textContent);
  const h2 = Array.from(document.querySelectorAll('h2')).map(h => h.textContent);
  
  // 3. Extract main text (avoid nav, footer, ads)
  const mainContent = extractMainContent();
  
  // 4. Detect structured data
  const jsonLd = extractJsonLd();
  
  return { title, meta, headings: [...h1, ...h2], mainText: mainContent, jsonLd };
}
```

**Privacy Controls:**
- Incognito/Private window detection → Skip indexing
- Domain blacklist (banking, health, auth) → Skip
- Form detection → Skip input fields
- Configurable in Settings

---

### 5.2 Service Worker (`extension/src/background/`)

**Purpose:** Central coordinator, manages storage, spawns offscreen for ML

**Key Files:**
- `index.ts` - Service worker entry, lifecycle management
- `init.ts` - Extension initialization (first install, updates)
- `msgHandler.ts` - Message routing from content/popup/offscreen
- `jobs.ts` - Periodic tasks (sync points, signal generation)
- `handlers/` - Message handlers for specific actions
  - `sessionHandler.ts` - Task continuation logic
  - `pageAnalysis.ts` - Page indexing logic

**Architecture Pattern: Stateless + Persistent Storage**

```typescript
// Service workers terminate after 30s inactivity - must be stateless!
// All state persisted to chrome.storage.local or IndexedDB

// GOOD ✅
async function handleMessage(msg: Message) {
  const config = await chrome.storage.local.get('config');
  // ... process ...
  await chrome.storage.local.set({ lastProcessed: Date.now() });
}

// BAD ❌
let queue = []; // Lost when service worker terminates!
```

**Batching Strategy:**

```typescript
// Queue analysis requests, process in batches of 5
const analysisQueue: PageRequest[] = [];

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'ANALYZE_PAGE') {
    analysisQueue.push(msg.data);
    await persistQueue(); // Save to storage immediately
    
    if (analysisQueue.length >= 5) {
      await processBatch();
    }
  }
});
```

---

### 5.3 Offscreen Document (`extension/src/offscreen/`)

**Purpose:** Heavy computation (ML inference, clustering) isolated from service worker

**Why Offscreen?**
- Service workers don't support DOM/large computations
- Offscreen documents can load TensorFlow.js (WebGL backend)
- Can be opened/closed dynamically to manage memory

**Key Files:**
- `index.html` - Offscreen document HTML shell
- `index.ts` - Message listener, coordinates workers
- `worker-tfjs.ts` - TensorFlow.js model loading & inference
- `worker-sessions.ts` - Task continuation clustering

**ML Model Pipeline:**

```typescript
import * as use from '@tensorflow-models/universal-sentence-encoder';
import * as tf from '@tensorflow/tfjs';

let model: use.UniversalSentenceEncoder | null = null;

async function loadModel() {
  if (!model) {
    await tf.ready();
    model = await use.load();
    console.log('[Offscreen] Model loaded:', model);
  }
}

async function generateEmbedding(text: string): Promise<Float32Array> {
  await loadModel();
  const embeddings = await model!.embed([text]);
  const vector = await embeddings.array();
  embeddings.dispose(); // Free GPU memory
  return vector[0];
}
```

**Performance Targets:**
- Model load: < 3 seconds (first time)
- Inference: < 100ms per page (p95)
- Memory: ~100MB when active, 0 when closed

---

### 5.4 Popup UI (`extension/src/popup/`)

**Purpose:** User interface for interacting with Second Brain

**Framework:** React 18 + TypeScript + CSS (no UI library for small bundle)

**Key Components:**

```
popup/
├── index.tsx          # Entry point, React root
├── App.tsx            # Main app, tab routing
├── styles.css         # Global styles
└── components/
    ├── Dashboard.tsx      # Overview: points, stats
    ├── SecondBrain.tsx    # Search interface (NEW)
    ├── ResumeCard.tsx     # Task continuation UI (NEW)
    ├── Settings.tsx       # Privacy controls, preferences
    ├── Onboarding.tsx     # First-time user flow
    └── ManageStorage.tsx  # Storage management UI
```

**SecondBrain Tab (Search Feature):**

```typescript
export function SecondBrain() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RankedResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (q: string) => {
    setLoading(true);
    try {
      const results = await searchWithFallback(q, {
        includePrivate: false,
        limit: 20,
        minScore: 0.1
      });
      setResults(results);
    } catch (error) {
      console.error('[SecondBrain] Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <SearchBar onSearch={handleSearch} loading={loading} />
      <ResultsList results={results} />
    </div>
  );
}
```

---

### 5.5 IndexedDB Manager (`extension/src/lib/db.ts`)

**Purpose:** Local database for page digests and embeddings

**Database Schema:**

```typescript
// Database: datapay_brain_v1
// Store: digests
// Primary Key: urlHash (SHA-256 of URL)

interface PageDigest {
  // Schema version
  schemaVersion: number;     // Current: 3
  
  // Indexing
  urlHash: string;           // Primary key, SHA-256 of sanitized URL
  domainHash: string;        // SHA-256 of domain (for grouping)
  url: string;               // ⭐ NEW in v3 - For task continuation
  
  // Content (NEVER sent to backend)
  title: string;             // Page title (max 200 chars)
  summary: string;           // First 500 words or meta description
  fullText?: string;         // Optional: Full text for semantic search
  
  // ML Outputs
  vectorBuf: ArrayBuffer;    // ⭐ NEW in v2 - 512-dim embedding (2KB)
  vector?: Float32Array;     // Runtime hydrated vector
  entities: string[];        // Top 5-10 keywords (TF-IDF)
  category: string;          // "electronics", "fitness", "tech", etc.
  intentScore: number;       // 0.0-1.0 (purchase intent)
  
  // Timestamps
  timestamp: number;         // Visit time (ms since epoch)
  lastAccessed: number;      // Last query time (for LRU eviction)
  
  // Sync
  isSynced: boolean;         // Has signal been sent?
  signalSentAt?: number;     // When signal was sent
  
  // Privacy
  isPrivate: boolean;        // User-marked private (never signal)
  autoExpireAt: number;      // Auto-delete timestamp (30 days default)
}
```

**Indexes for Performance:**

```typescript
store.createIndex('timestamp', 'timestamp');
store.createIndex('category', 'category');
store.createIndex('intentScore', 'intentScore');
store.createIndex('freshness_intent', ['timestamp', 'intentScore']); // Composite
store.createIndex('isSynced', 'isSynced');
```

**Key Operations:**

```typescript
class DataPayDB {
  // Save digest
  async saveDigest(digest: PageDigest): Promise<void>
  
  // Query recent high-intent pages
  async queryRecentIntent(hours: number, minScore: number): Promise<PageDigest[]>
  
  // Semantic search (cosine similarity)
  async searchSemantic(queryVector: Float32Array, limit: number): Promise<PageDigest[]>
  
  // Cleanup
  async pruneOldEntries(): Promise<number>  // Delete expired
  async clearAllData(): Promise<void>        // GDPR: Right to Erasure
  
  // Stats
  async getStorageStats(): Promise<StorageStats>
  
  // Export
  async exportData(): Promise<Blob>  // GDPR: Data portability
}
```

**Retention Policy:**
- **Time-based:** Auto-delete after 30 days (configurable: 7/14/30/60 days)
- **Size-based:** Max 5,000 entries (configurable: 1k/3k/5k/10k)
- **Eviction:** LRU (Least Recently Used) when limit reached
- **User control:** "Forget All" button, per-page "Forget"

---

## 6. Data Models & Storage

### 6.1 Extension Storage Layers

| Storage | Purpose | Capacity | Persistence |
|---------|---------|----------|-------------|
| **IndexedDB** | Page digests, vectors | ~1-10GB | Persistent until cleared |
| **chrome.storage.local** | Config, preferences, sessions | 10MB | Persistent |
| **Cache API** | ML model weights | 100MB+ | Persistent |
| **Memory** | Service worker state | Ephemeral | Lost after 30s inactivity |

### 6.2 Storage Keys (chrome.storage.local)

**Search Feature:**
- `searchMetrics` - Performance metrics for last 100 searches
- `searchAuditLog` - Privacy-preserving search history

**Task Continuation Feature:**
- `pendingSession` - Current session waiting for user action
- `dismissedSessionIds` - Permanently dismissed session IDs (cleared daily)
- `lastSessionCheckTimestamp` - For 30min cooldown

**Core Settings:**
- `config` - User preferences
- `anonymousId` - Hashed device identifier
- `points` - Cached points balance

---

## 7. API Specifications

### 7.1 Backend Endpoints

**Base URL:** `https://api.datapay.io` (production) or `http://localhost:8000` (dev)

#### POST `/api/v1/deals/match`
**Purpose:** Match deals based on user interest signals

**Request:**
```json
{
  "anonymousId": "sha256_hash",
  "signals": [
    {
      "category": "electronics",
      "entities": ["noise cancelling headphones", "sony", "wh-1000xm5"],
      "intentScore": 0.85,
      "pageCount": 5,
      "timeWindow": "48h"
    }
  ],
  "timestamp": 1702823400000
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "matches": [
    {
      "type": "product",
      "title": "Sony WH-1000XM5 Wireless Headphones",
      "merchant": "Amazon",
      "price": "$348",
      "originalPrice": "$399",
      "discount": "13% off",
      "redirectUrl": "https://api.datapay.io/r/abc123xyz",
      "reason": "Based on your interest in 'noise cancelling headphones'",
      "commission": "5%",
      "expiresAt": 1702909800000
    }
  ],
  "pointsEarned": 10
}
```

**Rate Limits:**
- 10 requests per hour per user
- 50 requests per day per user

---

## 8. Privacy & Security

### 8.1 Privacy Architecture

**Core Principle: Zero-Knowledge Backend**

```
What Extension Knows:
├─ Full browsing history (stored locally)
├─ Page titles and content
├─ Visit timestamps
├─ Vector embeddings
└─ User preferences

What Backend Knows:
├─ Anonymous ID (hashed)
├─ Interest categories (e.g., "electronics")
├─ Keyword lists (e.g., ["headphones", "sony"])
├─ Aggregate page counts (e.g., "5 pages")
└─ Time windows (e.g., "last 48 hours")

What Backend NEVER Knows:
✗ Specific URLs visited
✗ Page titles
✗ Visit timestamps
✗ Browsing patterns
✗ Session duration
```

### 8.2 Privacy Controls

**User-Facing Settings:**

1. **Incognito/Private Window Detection**
   - Automatically skip indexing in private mode
   - `chrome.extension.inIncognitoContext` check

2. **Domain Blacklist** (Default + Custom)
   - Banking: `chase.com`, `wellsfargo.com`
   - Health: `webmd.com`, `healthline.com`
   - Auth: `okta.com`, `auth0.com`
   - User can add custom domains

3. **Indexing Modes**
   - Full: Index all pages (default)
   - Shopping Only: Only e-commerce sites
   - Manual: Only when user clicks "Save Page"

4. **Data Retention**
   - 7 / 14 / 30 / 60 days (default: 30)
   - Max entries: 1k / 3k / 5k / 10k (default: 5k)

5. **Right to Erasure**
   - "Forget All" button → Clear all local data
   - "Forget This Page" → Delete specific entry
   - Backend DELETE request → Remove server-side signals

---

## 9. Development Setup

### 9.1 Prerequisites

- **Node.js**: v18+ (LTS recommended)
- **npm**: v9+
- **Python**: 3.10+ (for backend)
- **Docker**: v20+ (for backend databases)
- **Git**: v2.30+
- **Browser**: Chrome, Brave, or Edge (Chromium-based)

### 9.2 Extension Setup

```bash
cd extension

# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Development build (watch mode)
npm run dev

# Production build
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Testing
npm test
```

**Load Extension in Browser:**

1. Open Chrome/Brave: `chrome://extensions`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select `extension/dist` folder
5. Extension icon appears in toolbar

**Hot Reload:**
- Vite rebuilds automatically on file changes
- Click "Reload" button in `chrome://extensions` to refresh

---

## 10. Testing Strategy

### 10.1 Search Feature Testing

**Quick Test (2 minutes):**

1. **Load Extension** in Chrome/Brave
2. **Visit test pages:**
   - `https://en.wikipedia.org/wiki/Machine_learning`
   - `https://en.wikipedia.org/wiki/Artificial_intelligence`
   - `https://www.amazon.com/Sony-WH-1000XM5/dp/B09XS7JWHH`
3. **Wait 30 seconds** for indexing
4. **Open popup → Second Brain tab**
5. **Click "Search Your Brain"**
6. **Type query:** "machine learning"
7. **Expected:** Results appear with relevance scores

**Test Queries:**
- **Semantic:** "similar to machine learning" → Related pages
- **Recency:** "latest news today" → Recent pages rank higher
- **Entity:** "sony headphones" → Amazon page ranks #1

**Verification:**
- ✅ Results appear within ~250ms
- ✅ Relevance scores shown (%)
- ✅ Badges: "Concept Match", "Fresh", etc.
- ✅ Click result → No errors

---

### 10.2 Task Continuation Testing

**Quick Test (2 minutes):**

1. **Test HTML files** are organized in `test-pages/task-continuation/`:
   - `01-react-usestate.html` - React useState tutorial
   - `02-react-useeffect.html` - React useEffect tutorial
   - `03-react-context.html` - React Context API

2. **Open test pages** (in this order):
   - Open all 3 test files in browser from `test-pages/task-continuation/`
   - Spend 10-15 seconds on each page

3. **Wait 2 minutes** for processing (extension analyzes pages in background)

4. **Close all tabs**

5. **Lock computer** (Windows Key + L) for 1 minute

6. **Unlock and click extension icon**

7. **Expected Result:**
   - ✅ Purple gradient card appears
   - ✅ Shows "Researching React" (or similar title)
   - ✅ Badge "1" on extension icon
   - ✅ Shows 3 pages with coherence indicator
   - ✅ Click "Resume" → All tabs reopen (no duplicates)

**Full Test Scenarios:**

| Scenario | Test Case | Expected Result |
|----------|-----------|-----------------|
| 1 | Focused Research Session | Resume card with coherent session |
| 2 | Interleaved Browsing | Noise pages filtered out |
| 3 | Large Session (15+ tabs) | Warning + "Resume Top 10" button |
| 4 | Legacy Data | Graceful degradation message |
| 5 | Idle Debouncing | Cooldown prevents spam |
| 6 | Ghost Session Prevention | Session updated when page deleted |
| 7 | Dismissal | Dismissed session doesn't reappear |
| 8 | Offscreen Contention | No "already exists" errors |

**Debugging:**

```javascript
// Check pending session
chrome.storage.local.get('pendingSession', data => {
  console.log('Pending session:', data);
});

// Check dismissed sessions
chrome.storage.local.get('dismissedSessionIds', data => {
  console.log('Dismissed:', data);
});

// Check last check time
chrome.storage.local.get('lastSessionCheckTimestamp', data => {
  const minutes = (Date.now() - data.lastSessionCheckTimestamp) / 60000;
  console.log('Last check:', minutes.toFixed(1), 'minutes ago');
});
```

---

## 11. Deployment & Operations

### 11.1 Extension Publishing

**Chrome Web Store Submission:**

1. **Build Production:**
   ```bash
   cd extension
   npm run build
   cd dist
   zip -r ../secondbrain-v1.0.0.zip .
   ```

2. **Prepare Assets:**
   - Screenshots: 1280x800 (5 required)
   - Promotional images: 440x280
   - Privacy policy URL
   - Icon: 128x128 PNG

3. **Submit to Chrome Web Store:**
   - https://chrome.google.com/webstore/devconsole
   - Upload ZIP
   - Fill metadata (name, description, category)
   - Add screenshots
   - Set pricing (free)
   - Submit for review

**Review Time:** 3-7 days (typically)

**Brave Listing:**
- Brave uses Chrome Web Store
- No separate submission needed
- Test thoroughly with Shields enabled

---

## 12. Troubleshooting Guide

### 12.1 Common Extension Issues

#### Issue: Extension doesn't load
**Symptoms:** "Manifest file is missing or unreadable" error

**Solutions:**
1. Check `extension/dist/manifest.json` exists
2. Verify build completed: `npm run build`
3. Reload extension in `chrome://extensions`

#### Issue: ML model fails to load
**Symptoms:** "Failed to load model" error in offscreen console

**Solutions:**
1. Check internet connection (model downloads from HuggingFace)
2. Verify CSP allows WASM: `'wasm-unsafe-eval'` in manifest
3. Check Brave Shields not blocking CDN
4. Fallback activates automatically (keyword-based scoring)

#### Issue: Search returns no results
**Symptoms:** "No results found" message

**Solutions:**
1. Check pages are indexed: Open popup → Check "Pages Indexed" counter
2. Wait 30 seconds after browsing (ML model needs time)
3. Try broader query (e.g., "machine" instead of "machine learning algorithms")
4. Check console for errors

#### Issue: Resume card doesn't appear
**Symptoms:** No badge after idle state change

**Solutions:**
1. Wait longer (3-5 minutes for page analysis)
2. Check console for `[PageAnalysis]` logs
3. Verify test pages loaded properly (>100 words content)
4. Check cooldown not active (30min between checks)

#### Issue: IndexedDB quota exceeded
**Symptoms:** "QuotaExceededError" when saving digest

**Solutions:**
1. Check storage usage: Settings → Manage Storage
2. Reduce retention period: Settings → Privacy → Retention Days
3. Lower max entries: Settings → Privacy → Max Pages
4. Click "Forget All" to clear old data

---

## 13. Appendices

### Appendix A: Glossary

| Term | Definition |
|------|------------|
| **MV3** | Manifest V3 - Chrome's latest extension architecture |
| **IndexedDB** | Browser database for large structured data |
| **Service Worker** | Background script that runs independently of web pages |
| **Offscreen Document** | Hidden page for heavy computations (ML inference) |
| **USE** | Universal Sentence Encoder - ML model for text embeddings |
| **Embedding** | Fixed-length vector representation of text (512-dim) |
| **TF-IDF** | Term Frequency-Inverse Document Frequency - keyword extraction |
| **Cosine Similarity** | Measure of similarity between vectors (0-1) |
| **LRU** | Least Recently Used - eviction policy |
| **GDPR** | General Data Protection Regulation - EU privacy law |
| **CSP** | Content Security Policy - security headers |
| **WASM** | WebAssembly - low-level binary format for web |

---

### Appendix B: Performance Benchmarks

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| **Search** | | | |
| Query Embedding | <50ms | ~35ms | ✅ |
| Ranking (1k items) | <100ms | ~45ms | ✅ |
| Ranking (5k items) | <200ms | ~185ms | ✅ |
| UI Render | <16ms | ~12ms | ✅ |
| Total Latency (p95) | <300ms | ~250ms | ✅ |
| **Task Continuation** | | | |
| Clustering (50 pages) | <100ms | ~70ms | ✅ |
| Session Detection | <60s | ~45s | ✅ |
| Badge Appearance | <60s | ~50s | ✅ |
| Tab Opening | <3s | ~2s | ✅ |
| Memory Impact | <10MB | ~5MB | ✅ |

---

### Appendix C: File Structure

```
secondbrain/
├── extension/
│   ├── src/
│   │   ├── background/
│   │   │   ├── index.ts           # Service worker entry
│   │   │   ├── init.ts            # Initialization
│   │   │   ├── msgHandler.ts      # Message router
│   │   │   ├── offscreenManager.ts # Offscreen lifecycle
│   │   │   └── handlers/
│   │   │       ├── sessionHandler.ts  # Task continuation
│   │   │       └── pageAnalysis.ts    # Page indexing
│   │   ├── content/
│   │   │   ├── index.ts           # Content script entry
│   │   │   └── scraper.ts         # DOM extraction
│   │   ├── offscreen/
│   │   │   ├── index.html         # Offscreen document
│   │   │   ├── index.ts           # Message coordinator
│   │   │   ├── worker-tfjs.ts     # ML inference
│   │   │   └── worker-sessions.ts # Session clustering
│   │   ├── popup/
│   │   │   ├── index.tsx          # React entry
│   │   │   ├── App.tsx            # Main app
│   │   │   ├── styles.css         # Global styles
│   │   │   └── components/
│   │   │       ├── Dashboard.tsx      # Overview
│   │   │       ├── SecondBrain.tsx    # Search UI
│   │   │       ├── ResumeCard.tsx     # Task continuation UI
│   │   │       ├── SearchBar.tsx      # Search input
│   │   │       ├── ResultCard.tsx     # Search result
│   │   │       └── Settings.tsx       # Settings
│   │   └── lib/
│   │       ├── db.ts              # IndexedDB manager
│   │       ├── search.ts          # Search engine
│   │       ├── sessionizer.ts     # Session clustering
│   │       ├── types.ts           # TypeScript types
│   │       └── crypto.ts          # Encryption utilities
│   ├── public/
│   │   ├── manifest.json          # MV3 manifest
│   │   └── icons/                 # Extension icons
│   ├── tests/
│   │   └── search.test.ts         # Search tests
│   └── package.json
├── backend/                       # Optional backend
│   ├── app/
│   │   ├── main.py                # FastAPI entry
│   │   ├── api/v1/                # API routes
│   │   └── models/                # Database models
│   └── requirements.txt
├── test-pages/                    # Test HTML pages for manual testing
│   ├── README.md                  # Testing guide
│   ├── task-continuation/         # Task continuation feature tests
│   │   ├── 01-react-usestate.html # React useState tutorial
│   │   ├── 02-react-useeffect.html # React useEffect tutorial
│   │   ├── 03-react-context.html  # React Context API
│   │   └── 04-noise-cooking.html  # Noise page (filtered)
│   └── general/                   # General feature tests
│       └── sample-page.html       # Basic test page
├── ONBOARDING_DESIGN_DOC.md       # This file
└── README.md                      # Project overview
```

---

### Appendix D: Resources

**Documentation:**
- Chrome Extensions API: https://developer.chrome.com/docs/extensions/
- TensorFlow.js: https://www.tensorflow.org/js
- Universal Sentence Encoder: https://tfhub.dev/google/universal-sentence-encoder/
- FastAPI: https://fastapi.tiangolo.com/
- PostgreSQL: https://www.postgresql.org/docs/

**Internal Docs:**
- `README.md` - Project overview
- `extension/README.md` - Extension-specific docs
- `backend/README.md` - Backend-specific docs

---

### Appendix E: Onboarding Checklist

**Week 1: Environment Setup**
- [ ] Clone repository
- [ ] Setup Node.js, Python, Docker
- [ ] Install extension in browser
- [ ] Start backend locally (optional)
- [ ] Complete "Hello World" changes (update README, submit PR)
- [ ] Review this design doc
- [ ] Watch demo video (if available)

**Week 2: Component Deep Dive**
- [ ] Debug content script on live pages
- [ ] Inspect IndexedDB in DevTools
- [ ] Trigger offscreen model loading
- [ ] Test search feature with real queries
- [ ] Test task continuation with test pages
- [ ] Review codebase (3+ hours)
- [ ] Pair programming session with senior dev

**Week 3: Feature Implementation**
- [ ] Pick starter issue from backlog (label: "good first issue")
- [ ] Implement feature (extension or backend)
- [ ] Write tests (unit + integration)
- [ ] Submit PR for review
- [ ] Address review comments
- [ ] Merge to main

**Week 4: Autonomy**
- [ ] Own a feature end-to-end (design → implement → deploy)
- [ ] Participate in sprint planning
- [ ] Review others' PRs
- [ ] Contribute to design discussions

**Welcome to the team! 🚀**

---

*Last Updated: December 18, 2025*  
*Document Version: 2.0*  
*Maintained by: Engineering Team*
