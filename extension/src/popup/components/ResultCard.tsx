/**
 * Result Card Component
 * Displays search result with score breakdown and explanations
 */

import { useState, memo, useEffect } from 'react';
import type { RankedResult } from '@/lib/types';

interface ResultCardProps {
  result: RankedResult;
  onForget?: (urlHash: string) => void;
  debugMode?: boolean;
}

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

/**
 * Format score as percentage
 */
function formatScore(score: number): string {
  return `${(score * 100).toFixed(0)}%`;
}

/**
 * Get category emoji
 */
function getCategoryEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    electronics: '📱',
    fitness: '🏃',
    shopping: '🛒',
    tech: '💻',
    news: '📰',
    education: '📚',
    entertainment: '🎬',
    health: '🏥',
    food: '🍕',
    travel: '✈️',
    finance: '💰'
  };
  return emojiMap[category.toLowerCase()] || '📄';
}

const ResultCardComponent = ({ result, onForget, debugMode = false }: ResultCardProps) => {
  const { page, finalScore, factors, explanation } = result;

  const handleClick = () => {
    // Update lastAccessed timestamp
    chrome.runtime.sendMessage({
      type: 'UPDATE_LAST_ACCESSED',
      data: { urlHash: page.urlHash }
    });
  };

  const handleForget = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onForget) {
      onForget(page.urlHash);
    }
  };

  return (
    <div className="result-card" onClick={handleClick}>
      <div className="result-header">
        <div className="result-title-row">
          <span className="result-category-emoji">
            {getCategoryEmoji(page.category)}
          </span>
          <h3 className="result-title">{page.title}</h3>
        </div>
        <div className="result-score-badge" title="Relevance score">
          {formatScore(finalScore)}
        </div>
      </div>

      <p className="result-summary">
        {page.summary.slice(0, 150)}
        {page.summary.length > 150 && '...'}
      </p>

      <div className="result-badges">
        {explanation.map((badge) => (
          <span key={badge} className="badge">
            {badge}
          </span>
        ))}
      </div>

      <div className="result-meta">
        <span className="result-meta-item" title="Last visited">
          🗓️ {formatRelativeTime(page.timestamp)}
        </span>
        {page.intentScore !== undefined && (
          <span className="result-meta-item" title="Purchase intent score">
            📊 Intent: {formatScore(page.intentScore)}
          </span>
        )}
        <span className="result-meta-item" title="Category">
          {page.category}
        </span>
      </div>

      {debugMode && (
        <details className="result-debug">
          <summary>Score Breakdown</summary>
          <div className="debug-scores">
            <div className="debug-score-row">
              <span className="debug-label">Semantic:</span>
              <span className="debug-value">{factors.semantic.toFixed(3)}</span>
              <div 
                className="debug-bar" 
                style={{ width: `${factors.semantic * 100}%` }}
              />
            </div>
            <div className="debug-score-row">
              <span className="debug-label">Freshness:</span>
              <span className="debug-value">{factors.freshness.toFixed(3)}</span>
              <div 
                className="debug-bar" 
                style={{ width: `${factors.freshness * 100}%` }}
              />
            </div>
            <div className="debug-score-row">
              <span className="debug-label">Intent:</span>
              <span className="debug-value">{factors.intent.toFixed(3)}</span>
              <div 
                className="debug-bar" 
                style={{ width: `${factors.intent * 100}%` }}
              />
            </div>
            <div className="debug-score-row">
              <span className="debug-label">Lexical:</span>
              <span className="debug-value">{factors.lexical.toFixed(3)}</span>
              <div 
                className="debug-bar" 
                style={{ width: `${factors.lexical * 100}%` }}
              />
            </div>
            <div className="debug-score-row">
              <span className="debug-label">Entity:</span>
              <span className="debug-value">{factors.entity.toFixed(3)}</span>
              <div 
                className="debug-bar" 
                style={{ width: `${factors.entity * 100}%` }}
              />
            </div>
          </div>
          <div className="debug-info">
            <p><strong>URL Hash:</strong> {page.urlHash.slice(0, 16)}...</p>
            <p><strong>Entities:</strong> {page.entities.slice(0, 5).join(', ')}</p>
          </div>
        </details>
      )}

      {onForget && (
        <button
          className="result-forget-btn"
          onClick={handleForget}
          title="Remove from history"
        >
          🗑️ Forget
        </button>
      )}
    </div>
  );
};

// Memoize to prevent unnecessary re-renders
export const ResultCard = memo(ResultCardComponent, (prevProps, nextProps) => {
  // Only re-render if result.page.urlHash or result.finalScore changes
  return (
    prevProps.result.page.urlHash === nextProps.result.page.urlHash &&
    prevProps.result.finalScore === nextProps.result.finalScore &&
    prevProps.debugMode === nextProps.debugMode
  );
});

/**
 * Results List Component with lazy loading
 */
interface ResultsListProps {
  results: RankedResult[];
  onForget?: (urlHash: string) => void;
  debugMode?: boolean;
}

const ResultsListComponent = ({ results, onForget, debugMode = false }: ResultsListProps) => {
  const [displayCount, setDisplayCount] = useState(10);

  // Reset displayCount when results array changes (new search)
  useEffect(() => {
    // Only reset if we have fewer results than we're trying to display
    if (displayCount > results.length && results.length > 0) {
      setDisplayCount(Math.min(10, results.length));
    }
  }, [results.length]); // Only depend on length, not the array itself

  if (results.length === 0) {
    return (
      <div className="no-results">
        <p>No results found</p>
        <p className="no-results-hint">Try different keywords or check your filters</p>
      </div>
    );
  }

  return (
    <div className="results-list">
      {results.slice(0, displayCount).map((result) => (
        <ResultCard
          key={result.page.urlHash}
          result={result}
          onForget={onForget}
          debugMode={debugMode}
        />
      ))}
      
      {displayCount < results.length && (
        <button
          className="load-more-btn"
          onClick={() => setDisplayCount((c) => c + 10)}
        >
          Load More ({results.length - displayCount} remaining)
        </button>
      )}
    </div>
  );
};

// Memoize to prevent unnecessary re-renders
export const ResultsList = memo(ResultsListComponent);

