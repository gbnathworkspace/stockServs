import React, { useState, useEffect, useRef, useCallback } from 'react';
import './SearchAutocomplete.css';

/**
 * Production-ready Search Autocomplete Component
 * 
 * Features:
 * - Debounced search (300ms)
 * - Keyboard navigation (Arrow keys, Enter, Escape)
 * - Click outside to close
 * - Highlight matching text
 * - Accessible (ARIA roles)
 * - Responsive design
 */
export default function SearchAutocomplete({
  placeholder = "Search stocks...",
  onSelect,
  fetchSuggestions,
  minChars = 1,
  debounceMs = 300,
  maxResults = 8
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceTimer = useRef(null);

  // Debounced search
  const performSearch = useCallback(async (searchQuery) => {
    if (searchQuery.length < minChars) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const results = await fetchSuggestions(searchQuery);
      setSuggestions(results.slice(0, maxResults));
      setIsOpen(true);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Search failed:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [fetchSuggestions, minChars, maxResults]);

  // Handle input change with debouncing
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer
    debounceTimer.current = setTimeout(() => {
      performSearch(value);
    }, debounceMs);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
      
      default:
        break;
    }
  };

  // Handle selection
  const handleSelect = (item) => {
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);
    setSuggestions([]);
    onSelect(item);
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !inputRef.current.contains(e.target)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const selectedElement = dropdownRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // Highlight matching text
  const highlightMatch = (text, query) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="highlight">{part}</mark>
      ) : (
        part
      )
    );
  };

  // Format display name for options
  const getDisplayInfo = (item) => {
    const symbol = item.symbol || item.identifier || item.tradingSymbol || '';
    
    // Check if it's an option (contains CE or PE)
    if (/CE|PE/.test(symbol)) {
      // Try multiple parsing patterns
      
      // Pattern 1: NIFTY27JAN2626000CE
      let match = symbol.match(/^([A-Z]+)(\d{2})([A-Z]{3})(\d{2})(\d+)(CE|PE)$/);
      
      // Pattern 2: NIFTY 27 JAN 26 26000 CE (with spaces)
      if (!match) {
        match = symbol.match(/^([A-Z]+)\s+(\d{2})\s+([A-Z]{3})\s+(\d{2})\s+(\d+)\s+(CE|PE)$/);
      }
      
      // Pattern 3: Use display field if available
      if (!match && item.display) {
        return {
          displayName: item.display,
          underlying: item.underlying || symbol.split(/\d/)[0],
          typeLabel: /CE/.test(symbol) ? 'Options CALL' : 'Options PUT',
          isOption: true
        };
      }
      
      if (match) {
        const [, underlying, day, month, year, strike, optionType] = match;
        const fullYear = `20${year}`;
        const displayName = `${underlying} ${day} ${month} ${fullYear} ${optionType} ${strike}`;
        const typeLabel = optionType === 'CE' ? 'Options CALL' : 'Options PUT';
        
        return {
          displayName,
          underlying,
          typeLabel,
          isOption: true
        };
      }
    }
    
    // For regular stocks - check if display field exists
    if (item.display) {
      return {
        displayName: item.display,
        underlying: null,
        typeLabel: null,
        isOption: false
      };
    }
    
    // Fallback to symbol
    return {
      displayName: symbol,
      underlying: null,
      typeLabel: null,
      isOption: false
    };
  };

  return (
    <div className="search-autocomplete">
      <div className="search-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= minChars && setIsOpen(true)}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls="search-suggestions"
          aria-expanded={isOpen}
          aria-activedescendant={
            selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined
          }
        />
        {loading && <div className="search-spinner" />}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          id="search-suggestions"
          className="search-dropdown"
          role="listbox"
        >
          {suggestions.length === 0 ? (
            <div className="no-results">No results found</div>
          ) : (
            suggestions.map((item, index) => {
              const displayInfo = getDisplayInfo(item);
              
              return (
                <div
                  key={`${item.symbol}-${index}`}
                  id={`suggestion-${index}`}
                  className={`suggestion-item ${selectedIndex === index ? 'selected' : ''}`}
                  role="option"
                  aria-selected={selectedIndex === index}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="suggestion-main">
                    <div className="suggestion-symbol">
                      {highlightMatch(displayInfo.displayName, query)}
                    </div>
                    {displayInfo.isOption && (
                      <div className="suggestion-meta">
                        <span className="suggestion-underlying">{displayInfo.underlying}</span>
                        <span className="suggestion-type-label">({displayInfo.typeLabel})</span>
                      </div>
                    )}
                    {!displayInfo.isOption && item.lastPrice > 0 && (
                      <div className={`suggestion-price ${item.pChange >= 0 ? 'positive' : 'negative'}`}>
                        ₹{item.lastPrice?.toFixed(2)}
                      </div>
                    )}
                    {!displayInfo.isOption && item.lastPrice === 0 && (
                      <div className="suggestion-price" style={{opacity: 0.5, fontSize: '0.75rem'}}>
                        Price on selection
                      </div>
                    )}
                  </div>
                  {item.pChange !== 0 && (
                    <div className={`suggestion-change ${item.pChange >= 0 ? 'positive' : 'negative'}`}>
                      {item.pChange >= 0 ? '▲' : '▼'} {Math.abs(item.pChange || 0).toFixed(2)}%
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
