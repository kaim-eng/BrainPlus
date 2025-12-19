/**
 * AMA (Ask Me Anything) Component
 * Design Doc: AMA_DESIGN_REVIEW.md, Phase 1
 * 
 * Phase 1: Extractive answers with citations
 * Phase 2: LLM-powered streaming answers
 */

import React, { useState, useEffect, useRef } from 'react';
import type { AMASource, AMAMetrics } from '@/lib/types';

interface Props {
  onClose?: () => void;
}

type AMAState = 'idle' | 'loading' | 'streaming' | 'done' | 'error';

export const AMA: React.FC<Props> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<AMAState>('idle');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<AMASource[]>([]);
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState<AMAMetrics | null>(null);
  
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cleanup port on unmount
  useEffect(() => {
    return () => {
      if (portRef.current) {
        portRef.current.disconnect();
        portRef.current = null;
      }
    };
  }, []);

  const handleAsk = async () => {
    if (!query.trim()) return;
    
    // Reset state
    setState('loading');
    setAnswer('');
    setSources([]);
    setError('');
    setMetrics(null);
    
    try {
      // Connect to background via port (for streaming)
      const port = chrome.runtime.connect({ name: 'ama-stream' });
      portRef.current = port;
      
      // Listen for messages
      port.onMessage.addListener((msg) => {
        console.log('[AMA] Received message:', msg.type);
        
        if (msg.type === 'AMA_SOURCES') {
          setSources(msg.sources);
          setState('streaming');
        } else if (msg.type === 'AMA_TOKEN') {
          // Phase 1: Single token (full answer)
          // Phase 2: Will stream individual tokens
          setAnswer(prev => prev + msg.token);
        } else if (msg.type === 'AMA_DONE') {
          setState('done');
          setMetrics(msg.metrics);
          port.disconnect();
          portRef.current = null;
        } else if (msg.type === 'AMA_ERROR') {
          setState('error');
          setError(msg.error);
          port.disconnect();
          portRef.current = null;
        }
      });
      
      // Send query
      port.postMessage({
        type: 'AMA_QUERY',
        query,
        timestamp: Date.now(),
      });
      
    } catch (err) {
      console.error('[AMA] Error:', err);
      setState('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const handleClear = () => {
    setQuery('');
    setAnswer('');
    setSources([]);
    setError('');
    setMetrics(null);
    setState('idle');
    inputRef.current?.focus();
  };

  return (
    <div className="ama-container">
      <div className="ama-header">
        <h2>🤖 Ask Me Anything</h2>
        {onClose && (
          <button className="close-btn" onClick={onClose}>×</button>
        )}
      </div>

      <div className="ama-input-section">
        <input
          ref={inputRef}
          type="text"
          className="ama-input"
          placeholder="Ask about your browsing history..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={state === 'loading' || state === 'streaming'}
        />
        <div className="ama-actions">
          <button
            className="primary"
            onClick={handleAsk}
            disabled={!query.trim() || state === 'loading' || state === 'streaming'}
          >
            {state === 'loading' ? 'Searching...' : 'Ask'}
          </button>
          {(answer || error) && (
            <button
              className="secondary"
              onClick={handleClear}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {state === 'loading' && (
        <div className="ama-loading">
          <div className="spinner"></div>
          <p>Searching your local history...</p>
        </div>
      )}

      {/* Error State */}
      {state === 'error' && (
        <div className="ama-error">
          <p>❌ {error}</p>
        </div>
      )}

      {/* Sources (shown first) */}
      {sources.length > 0 && (
        <div className="ama-sources">
          <h3>📚 Sources ({sources.length})</h3>
          <div className="sources-carousel">
            {sources.map((source) => (
              <div key={source.citationId} className="source-card">
                <div className="source-header">
                  <span className="citation-badge">[{source.citationId}]</span>
                  <span className="source-domain">{source.domain}</span>
                </div>
                <h4 className="source-title">{source.title}</h4>
                <p className="source-snippet">{source.snippet}</p>
                <div className="source-footer">
                  <span className="source-date">{source.dateRelative}</span>
                  <a 
                    href={source.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="source-link"
                  >
                    Open →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Answer */}
      {answer && (
        <div className="ama-answer">
          <h3>💡 Answer</h3>
          <div className="answer-content">
            <p>{answer}</p>
          </div>
        </div>
      )}

      {/* Metrics (debug) */}
      {metrics && (
        <div className="ama-metrics">
          <small>
            ⚡ Retrieved in {metrics.totalTimeMs.toFixed(0)}ms 
            ({metrics.sourcesCount} sources)
          </small>
        </div>
      )}

      {/* Example Queries */}
      {state === 'idle' && !answer && (
        <div className="ama-examples">
          <h4>Try asking:</h4>
          <ul>
            <li onClick={() => setQuery('What React tutorials did I read?')}>
              "What React tutorials did I read?"
            </li>
            <li onClick={() => setQuery('Show me articles about TypeScript')}>
              "Show me articles about TypeScript"
            </li>
            <li onClick={() => setQuery('What products did I look at recently?')}>
              "What products did I look at recently?"
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};



