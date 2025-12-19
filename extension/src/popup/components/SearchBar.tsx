/**
 * Search Bar Component
 * Omnibox-style search with debouncing
 */

import { useState, useEffect, useMemo, useRef } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  loading?: boolean;
  placeholder?: string;
}

/**
 * Debounce utility with cancel function
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;
  
  const debounced = (...args: Parameters<T>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      timeout = null;
      func(...args);
    }, wait);
  };
  
  debounced.cancel = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  
  return debounced;
}

export function SearchBar({ onSearch, loading = false, placeholder = "🔍 Find that thing..." }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const lastSearchedQuery = useRef<string>('');

  // Debounced search function
  const debouncedSearch = useMemo(
    () => debounce((q: string) => {
      // Prevent duplicate searches for the same query
      if (q === lastSearchedQuery.current) {
        console.log('[SearchBar] Skipping duplicate search for:', q);
        return;
      }
      
      // Only trigger search for valid queries or to clear
      if (q.length >= 2 || q.length === 0) {
        console.log('[SearchBar] Triggering search for:', q);
        lastSearchedQuery.current = q;
        onSearch(q);
      }
      // Don't trigger for 1 character (prevents unnecessary calls)
    }, 300), // 300ms debounce
    [onSearch]
  );

  // Trigger search when query changes
  useEffect(() => {
    debouncedSearch(query);
    
    // Cleanup: cancel pending debounced calls when component unmounts or query changes
    return () => {
      debouncedSearch.cancel();
    };
  }, [query, debouncedSearch]);

  return (
    <div className="search-container">
      <div className="search-input-wrapper">
        <input
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={loading}
        />
        {loading && (
          <div className="search-spinner">
            <div className="spinner"></div>
          </div>
        )}
        {query && !loading && (
          <button
            className="search-clear"
            onClick={() => setQuery('')}
            title="Clear search"
          >
            ×
          </button>
        )}
      </div>
      {query.length > 0 && query.length < 2 && (
        <div className="search-hint">
          Type at least 2 characters to search
        </div>
      )}
    </div>
  );
}

