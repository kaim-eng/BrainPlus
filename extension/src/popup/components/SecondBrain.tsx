/**
 * BrainPlus Tab (v0.2)
 * Shows indexed pages, interests, search, and "I Guess You Need" button
 */

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/db';
import { apiClient } from '@/lib/api';
import { getLocal } from '@/lib/storage';
import { STORAGE_KEYS } from '@/lib/constants';
import { searchWithFallback } from '@/lib/search';
import type { PageDigest, RankedResult } from '@/lib/types';
import { SearchBar } from './SearchBar';
import { ResultsList } from './ResultCard';

interface InterestGroup {
  category: string;
  keywords: string[];
  pageCount: number;
}

export const BrainPlus: React.FC = () => {
  const [stats, setStats] = useState({ entryCount: 0, estimatedBytes: 0 });
  const [interests, setInterests] = useState<InterestGroup[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  
  // Search state
  const [searchResults, setSearchResults] = useState<RankedResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  
  // Backend health state
  const [backendHealthy, setBackendHealthy] = useState<boolean>(true); // Assume healthy initially
  const [healthCheckLoading, setHealthCheckLoading] = useState<boolean>(true);

  // Debug: log deals state changes
  useEffect(() => {
    console.log('[BrainPlus] deals state updated:', deals);
  }, [deals]);

  // Load storage stats
  useEffect(() => {
    loadStats();
  }, []);
  
  // Check backend health on mount and periodically
  useEffect(() => {
    const checkBackendHealth = async () => {
      console.log('[BrainPlus] Checking backend health...');
      const isHealthy = await apiClient.checkHealth();
      console.log('[BrainPlus] Backend health:', isHealthy ? 'healthy' : 'unhealthy');
      setBackendHealthy(isHealthy);
      setHealthCheckLoading(false);
    };
    
    // Initial check
    checkBackendHealth();
    
    // Periodic check every 5 minutes
    const intervalId = setInterval(checkBackendHealth, 5 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  const loadStats = async () => {
    try {
      const storageStats = await db.getStorageStats();
      setStats({
        entryCount: storageStats.entryCount,
        estimatedBytes: storageStats.estimatedBytes,
      });

      // Load interests
      await loadInterests();
    } catch (error) {
      console.error('[BrainPlus] Failed to load stats:', error);
    }
  };

  const loadInterests = async () => {
    try {
      // Query high-intent pages from last 48 hours
      const recentPages = await db.queryRecentIntent(48, 0.7);

      // Group by category and extract keywords
      const grouped = new Map<string, Set<string>>();
      
      for (const page of recentPages) {
        if (!grouped.has(page.category)) {
          grouped.set(page.category, new Set());
        }
        const keywords = grouped.get(page.category)!;
        page.entities.forEach(entity => keywords.add(entity));
      }

      // Convert to array
      const interestGroups: InterestGroup[] = [];
      for (const [category, keywords] of grouped.entries()) {
        const pageCount = recentPages.filter(p => p.category === category).length;
        interestGroups.push({
          category,
          keywords: Array.from(keywords).slice(0, 5), // Top 5 keywords
          pageCount,
        });
      }

      setInterests(interestGroups);
    } catch (error) {
      console.error('[BrainPlus] Failed to load interests:', error);
    }
  };

  const handleGenerateSignal = async () => {
    setLoading(true);
    setDeals([]);
    setPointsEarned(0);

    try {
      // Query recent high-intent pages
      const recentPages = await db.queryRecentIntent(48, 0.7);

      if (recentPages.length === 0) {
        alert('No recent interests found. Browse some pages first!');
        return;
      }

      // Build signals
      const signals: any[] = [];
      const categories = new Map<string, PageDigest[]>();

      // Group by category
      for (const page of recentPages) {
        if (!categories.has(page.category)) {
          categories.set(page.category, []);
        }
        categories.get(page.category)!.push(page);
      }

      // Build signal for each category
      for (const [category, pages] of categories.entries()) {
        const allEntities: string[] = [];
        let totalScore = 0;

        for (const page of pages) {
          allEntities.push(...page.entities);
          totalScore += page.intentScore;
        }

        // Count frequency of entities
        const entityFreq = new Map<string, number>();
        for (const entity of allEntities) {
          entityFreq.set(entity, (entityFreq.get(entity) || 0) + 1);
        }

        // Top entities by frequency
        const topEntities = Array.from(entityFreq.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([entity]) => entity);

        signals.push({
          category,
          entities: topEntities,
          intentScore: totalScore / pages.length,
          pageCount: pages.length,
          timeWindow: '48h',
        });
      }

      // Get anonymous ID and set it on API client
      const anonymousId = await getLocal<string>(STORAGE_KEYS.ANONYMOUS_ID);
      console.log('[BrainPlus] Anonymous ID:', anonymousId);
      if (anonymousId) {
        apiClient.setAnonymousId(anonymousId);
      }

      // Send to backend
      console.log('[BrainPlus] Sending signals:', signals);
      const response = await apiClient.matchDeals(signals);
      console.log('[BrainPlus] API response:', response);
      console.log('[BrainPlus] response.success:', response.success);
      console.log('[BrainPlus] response.data:', response.data);

      if (response.success && response.data) {
        const matches = response.data.matches || [];
        const points = response.data.pointsEarned || 0;
        console.log('[BrainPlus] Setting deals:', matches);
        console.log('[BrainPlus] Setting points:', points);
        setDeals(matches);
        setPointsEarned(points);
        
        // Mark pages as synced
        for (const page of recentPages) {
          await db.updateSyncStatus(page.urlHash, true);
        }
      } else {
        console.error('[BrainPlus] API error:', response);
        alert(`Failed to get deals: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[BrainPlus] Signal generation failed:', error);
      alert('Failed to generate signal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(async (query: string) => {
    // Clear results only when query is completely empty
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    // Don't search for very short queries, but keep existing results
    if (query.trim().length < 2) {
      return;
    }

    // Check if we have any indexed pages first
    if (stats.entryCount === 0) {
      setSearchError('No pages indexed yet. Browse some websites first!');
      setSearchResults([]);
      setSearching(false);
      return;
    }

    // Set loading state (but keep existing results visible)
    setSearching(true);
    setSearchError(null);

    try {
      console.log('[BrainPlus] Starting search for:', query);
      const results = await searchWithFallback(query, {
        includePrivate: false,
        limit: 20,
        minScore: 0.1
      });
      console.log('[BrainPlus] Search results:', results.length);
      
      // Only update results after search completes
      setSearchResults(results);
      
      if (results.length === 0) {
        setSearchError(`No results found for "${query}". Try different keywords or browse more pages.`);
      }
    } catch (error) {
      console.error('[BrainPlus] Search failed:', error);
      setSearchError(`Search error: ${error instanceof Error ? error.message : String(error)}`);
      // Keep previous results on error instead of clearing
    } finally {
      setSearching(false);
    }
  }, [stats.entryCount]); // Only recreate if entryCount changes

  const handleForgetPage = async (urlHash: string) => {
    try {
      await db.delete('digests', urlHash);
      // Remove from search results
      setSearchResults(prev => prev.filter(r => r.page.urlHash !== urlHash));
      await loadStats();
    } catch (error) {
      console.error('[BrainPlus] Failed to forget page:', error);
      alert('Failed to delete page.');
    }
  };

  const handleForgetAll = async () => {
    if (!confirm('Are you sure you want to delete all indexed pages? This cannot be undone.')) {
      return;
    }

    try {
      await db.clearAllData();
      setSearchResults([]);
      await loadStats();
      alert('All data cleared successfully.');
    } catch (error) {
      console.error('[BrainPlus] Failed to clear data:', error);
      alert('Failed to clear data.');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="brain-plus">
      <h2>🧠 BrainPlus</h2>

      {/* Storage Stats */}
      <div className="stats-section">
        <div className="stat-item">
          <span className="stat-label">Pages Indexed:</span>
          <span className="stat-value">{stats.entryCount}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Storage Used:</span>
          <span className="stat-value">{formatBytes(stats.estimatedBytes)}</span>
        </div>
      </div>

      {/* Search Section */}
      <div className="search-section">
        <button 
          className="btn-search-toggle"
          onClick={() => setShowSearch(!showSearch)}
        >
          🔍 {showSearch ? 'Hide Search' : 'Search Your Brain'}
        </button>
        
        {showSearch && (
          <div className="search-container-wrapper">
            <SearchBar
              onSearch={handleSearch}
              loading={searching}
              placeholder="🔍 Search your browsing history..."
            />
            
            {searchError && !searching && (
              <div className="search-error">{searchError}</div>
            )}
            
            {/* Always render container to prevent unmounting */}
            <div 
              className="search-results-wrapper"
              style={{ 
                display: searchResults.length > 0 ? 'block' : 'none',
                willChange: searching ? 'contents' : 'auto'
              }}
            >
              {searchResults.length > 0 && (
                <ResultsList
                  results={searchResults}
                  onForget={handleForgetPage}
                  debugMode={false}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* My Interests */}
      {interests.length > 0 && (
        <div className="interests-section">
          <h3>📊 My Recent Interests (Last 48h)</h3>
          {interests.map((interest, idx) => (
            <div key={idx} className="interest-group">
              <div className="interest-category">
                {interest.category.charAt(0).toUpperCase() + interest.category.slice(1)}
                <span className="interest-count">({interest.pageCount} pages)</span>
              </div>
              <div className="interest-keywords">
                {interest.keywords.map((kw, i) => (
                  <span key={i} className="keyword-tag">{kw}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* I Guess You Need Button */}
      {backendHealthy && (
        <div className="action-section">
          <button
            className="btn-primary btn-large"
            onClick={handleGenerateSignal}
            disabled={loading || stats.entryCount === 0}
          >
            {loading ? 'Analyzing...' : '💡 I Guess You Need...'}
          </button>
          {stats.entryCount === 0 && (
            <p className="hint-text">Browse some pages first to see recommendations!</p>
          )}
        </div>
      )}
      
      {/* Backend unavailable message */}
      {!healthCheckLoading && !backendHealthy && (
        <div className="action-section">
          <p className="hint-text" style={{ color: '#999', textAlign: 'center' }}>
            ⚠️ Recommendation service is currently unavailable
          </p>
        </div>
      )}

      {/* Points Earned */}
      {pointsEarned > 0 && (
        <div className="points-earned">
          ✨ +{pointsEarned} points earned!
        </div>
      )}

      {/* Deal Recommendations */}
      {deals.length > 0 && (
        <div className="deals-section">
          <h3>🎁 Personalized Recommendations</h3>
          {deals.map((deal, idx) => (
            <div key={idx} className="deal-card">
              <div className="deal-header">
                <h4>{deal.title}</h4>
                {deal.discount && <span className="deal-badge">{deal.discount}</span>}
              </div>
              {deal.description && <p className="deal-description">{deal.description}</p>}
              <div className="deal-footer">
                <span className="deal-merchant">{deal.merchant}</span>
                {deal.price && <span className="deal-price">{deal.price}</span>}
              </div>
              <p className="deal-reason">{deal.reason}</p>
              <button className="btn-secondary btn-small">View Deal</button>
            </div>
          ))}
        </div>
      )}

      {/* Privacy Controls */}
      <div className="privacy-section">
        <h3>🔒 Privacy Controls</h3>
        <button className="btn-danger btn-small" onClick={handleForgetAll}>
          Forget All Data
        </button>
        <p className="privacy-note">
          All data is stored locally on your device. We only see aggregate interests when you click "I Guess You Need".
        </p>
      </div>

      <style>{`
        .brain-plus {
          padding: 16px;
        }

        .brain-plus h2 {
          margin: 0 0 16px 0;
          font-size: 20px;
        }

        .brain-plus h3 {
          margin: 16px 0 12px 0;
          font-size: 16px;
          color: #666;
        }

        .stats-section {
          background: #f5f5f5;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
          display: flex;
          gap: 16px;
        }

        .stat-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-label {
          font-size: 12px;
          color: #666;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 600;
          color: #333;
        }

        .interests-section {
          margin-bottom: 16px;
        }

        .interest-group {
          margin-bottom: 12px;
        }

        .interest-category {
          font-weight: 600;
          margin-bottom: 4px;
          color: #333;
        }

        .interest-count {
          font-weight: 400;
          font-size: 12px;
          color: #999;
          margin-left: 4px;
        }

        .interest-keywords {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .keyword-tag {
          background: #e3f2fd;
          color: #1976d2;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
        }

        .action-section {
          text-align: center;
          margin: 20px 0;
        }

        .btn-primary {
          background: #1976d2;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-primary:hover:not(:disabled) {
          background: #1565c0;
        }

        .btn-primary:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .btn-large {
          padding: 14px 32px;
          font-size: 18px;
        }

        .btn-secondary {
          background: #4caf50;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          width: 100%;
          margin-top: 8px;
        }

        .btn-danger {
          background: #f44336;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
        }

        .btn-small {
          padding: 8px 16px;
          font-size: 14px;
        }

        .hint-text {
          margin-top: 8px;
          font-size: 12px;
          color: #999;
        }

        .points-earned {
          background: #4caf50;
          color: white;
          padding: 12px;
          border-radius: 8px;
          text-align: center;
          font-weight: 600;
          margin-bottom: 16px;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .deals-section {
          margin: 20px 0;
        }

        .deal-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
        }

        .deal-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 8px;
        }

        .deal-header h4 {
          margin: 0;
          font-size: 14px;
          flex: 1;
        }

        .deal-badge {
          background: #ff5722;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }

        .deal-description {
          font-size: 12px;
          color: #666;
          margin: 8px 0;
        }

        .deal-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 8px 0;
        }

        .deal-merchant {
          font-size: 12px;
          color: #999;
        }

        .deal-price {
          font-size: 16px;
          font-weight: 600;
          color: #4caf50;
        }

        .deal-reason {
          font-size: 11px;
          color: #999;
          font-style: italic;
          margin: 4px 0 8px 0;
        }

        .privacy-section {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e0e0e0;
        }

        .privacy-note {
          font-size: 11px;
          color: #999;
          margin-top: 8px;
          line-height: 1.4;
        }

        /* Search Section */
        .search-section {
          margin: 16px 0;
        }

        .btn-search-toggle {
          width: 100%;
          background: #673ab7;
          color: white;
          border: none;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-search-toggle:hover {
          background: #5e35b1;
        }

        .search-container-wrapper {
          margin-top: 12px;
          padding: 12px;
          background: #f5f5f5;
          border-radius: 8px;
        }

        .search-error {
          background: #ffebee;
          color: #c62828;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
          margin-top: 8px;
        }

        .search-results-wrapper {
          margin-top: 12px;
          contain: layout style paint; /* CSS containment for performance */
        }

        /* Smooth transitions for result cards */
        .results-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .result-card {
          will-change: auto; /* Let browser optimize */
          backface-visibility: hidden; /* Prevent flashing during transitions */
          transform: translateZ(0); /* Hardware acceleration */
        }

        /* Search Input Styles */
        .search-input-wrapper {
          position: relative;
        }

        .search-input {
          width: 100%;
          padding: 10px 35px 10px 12px;
          border: 2px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        .search-input:focus {
          border-color: #673ab7;
        }

        .search-spinner {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #f3f3f3;
          border-top: 2px solid #673ab7;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .search-clear {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          font-size: 20px;
          color: #999;
          cursor: pointer;
          padding: 0;
          width: 20px;
          height: 20px;
          line-height: 1;
        }

        .search-clear:hover {
          color: #666;
        }

        .search-hint {
          font-size: 11px;
          color: #999;
          margin-top: 4px;
        }

        /* Result Card Styles */
        .results-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .result-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 12px;
          cursor: pointer;
          transition: box-shadow 0.2s;
        }

        .result-card:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 8px;
        }

        .result-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .result-category-emoji {
          font-size: 18px;
        }

        .result-title {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .result-score-badge {
          background: #673ab7;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .result-summary {
          font-size: 12px;
          color: #666;
          margin: 8px 0;
          line-height: 1.4;
        }

        .result-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin: 8px 0;
        }

        .badge {
          background: #e8eaf6;
          color: #5e35b1;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }

        .result-meta {
          display: flex;
          gap: 12px;
          font-size: 11px;
          color: #999;
          margin-top: 8px;
        }

        .result-meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .result-forget-btn {
          margin-top: 8px;
          background: #f44336;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          opacity: 0.7;
          transition: opacity 0.2s;
        }

        .result-forget-btn:hover {
          opacity: 1;
        }

        .no-results {
          text-align: center;
          padding: 20px;
          color: #999;
        }

        .no-results-hint {
          font-size: 12px;
          margin-top: 8px;
        }

        .load-more-btn {
          width: 100%;
          background: white;
          border: 2px solid #673ab7;
          color: #673ab7;
          padding: 10px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .load-more-btn:hover {
          background: #673ab7;
          color: white;
        }
      `}</style>
    </div>
  );
};

