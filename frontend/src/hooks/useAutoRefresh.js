/**
 * Global Auto-Refresh Hook
 * Manages automatic data refresh for all components with market hours awareness
 * Only refreshes during market hours (9:15 AM - 3:30 PM IST, Mon-Fri)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { isMarketOpen } from '../utils/marketHours';

// Global state for auto-refresh manager
let globalRefreshManager = null;

class RefreshManager {
  constructor() {
    this.subscriptions = new Map();
    this.timers = new Map();
    this.inFlight = new Map();  // Track pending requests to prevent cascade
    this.isPaused = false;
    this.isTabVisible = true;
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.listeners = new Set();

    // Listen for visibility changes
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.isTabVisible = !document.hidden;
        this.handleStateChange();
      });
    }

    // Listen for online/offline
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.handleStateChange();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.handleStateChange();
      });
    }
  }

  /**
   * Handle state changes (visibility, online status, market hours)
   */
  handleStateChange() {
    if (this.shouldRefresh()) {
      this.resumeAll();
    } else {
      this.pauseAll();
    }
    this.notifyListeners();
  }

  /**
   * Check if refreshing should be active
   * Only refresh when: not paused, tab visible, online, AND market is open
   */
  shouldRefresh() {
    return !this.isPaused && this.isTabVisible && this.isOnline && isMarketOpen();
  }

  /**
   * Check if market is currently open
   * @returns {boolean}
   */
  isMarketOpen() {
    return isMarketOpen();
  }

  /**
   * Subscribe to auto-refresh
   * @param {string} key - Unique identifier for this subscription
   * @param {Function} callback - Function to call on refresh
   * @param {number} interval - Refresh interval in milliseconds (default 1000ms = 1 second)
   * @returns {string} Subscription key
   */
  subscribe(key, callback, interval = 1000) {
    // Store subscription
    this.subscriptions.set(key, { callback, interval });

    // Start timer if conditions are met
    if (this.shouldRefresh()) {
      this.startTimer(key);
    }

    this.notifyListeners();
    return key;
  }

  /**
   * Unsubscribe from auto-refresh
   * @param {string} key - Subscription key to remove
   */
  unsubscribe(key) {
    this.stopTimer(key);
    this.subscriptions.delete(key);
    this.notifyListeners();
  }

  /**
   * Start timer for a specific subscription
   * @param {string} key - Subscription key
   */
  startTimer(key) {
    const subscription = this.subscriptions.get(key);
    if (!subscription) return;

    // Clear existing timer if any
    this.stopTimer(key);

    // Start new timer with request deduplication
    const timerId = setInterval(async () => {
      // Skip if previous request still in flight (prevents cascade)
      if (this.inFlight.get(key)) {
        return;
      }

      // Check conditions before each refresh
      if (this.shouldRefresh()) {
        try {
          this.inFlight.set(key, true);
          await subscription.callback();
        } catch (error) {
          console.error(`Error in auto-refresh callback for ${key}:`, error);
        } finally {
          this.inFlight.delete(key);
        }
      } else {
        // Conditions no longer met, stop this timer
        this.stopTimer(key);
      }
    }, subscription.interval);

    this.timers.set(key, timerId);
  }

  /**
   * Stop timer for a specific subscription
   * @param {string} key - Subscription key
   */
  stopTimer(key) {
    const timerId = this.timers.get(key);
    if (timerId) {
      clearInterval(timerId);
      this.timers.delete(key);
    }
  }

  /**
   * Pause all auto-refresh timers
   */
  pauseAll() {
    this.timers.forEach((timerId, key) => {
      clearInterval(timerId);
    });
    this.timers.clear();
  }

  /**
   * Resume all auto-refresh timers
   */
  resumeAll() {
    if (!this.shouldRefresh()) return;

    this.subscriptions.forEach((subscription, key) => {
      if (!this.timers.has(key)) {
        this.startTimer(key);
      }
    });
  }

  /**
   * Toggle pause state
   */
  togglePause() {
    this.isPaused = !this.isPaused;
    this.handleStateChange();
  }

  /**
   * Set pause state
   * @param {boolean} paused - New pause state
   */
  setPaused(paused) {
    if (this.isPaused === paused) return;
    this.isPaused = paused;
    this.handleStateChange();
  }

  /**
   * Get current pause state
   * @returns {boolean}
   */
  getPaused() {
    return this.isPaused;
  }

  /**
   * Get online status
   * @returns {boolean}
   */
  getOnline() {
    return this.isOnline;
  }

  /**
   * Get active subscriptions count
   * @returns {number}
   */
  getActiveCount() {
    return this.timers.size;
  }

  /**
   * Get total subscriptions count
   * @returns {number}
   */
  getTotalCount() {
    return this.subscriptions.size;
  }

  /**
   * Add state change listener
   * @param {Function} callback
   */
  addListener(callback) {
    this.listeners.add(callback);
  }

  /**
   * Remove state change listener
   * @param {Function} callback
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of state change
   */
  notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in refresh manager listener:', error);
      }
    });
  }

  /**
   * Check market hours and update timers
   * Should be called periodically to handle market open/close
   */
  checkMarketHours() {
    this.handleStateChange();
  }
}

/**
 * Get or create the global refresh manager
 * @returns {RefreshManager}
 */
function getRefreshManager() {
  if (!globalRefreshManager) {
    globalRefreshManager = new RefreshManager();

    // Check market hours every 30 seconds (faster for 1-second refresh mode)
    setInterval(() => {
      globalRefreshManager.checkMarketHours();
    }, 30000);
  }
  return globalRefreshManager;
}

/**
 * Hook for components to use auto-refresh
 * @param {string} key - Unique key for this component's subscription
 * @param {Function} callback - Refresh callback
 * @param {number} interval - Refresh interval in milliseconds (default 1000ms)
 * @param {boolean} enabled - Whether auto-refresh is enabled
 */
export function useAutoRefresh(key, callback, interval = 1000, enabled = true) {
  const manager = getRefreshManager();
  const callbackRef = useRef(callback);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Subscribe/unsubscribe effect
  useEffect(() => {
    if (!enabled) return;

    const wrappedCallback = () => {
      callbackRef.current();
      setLastUpdate(Date.now());
    };

    manager.subscribe(key, wrappedCallback, interval);

    return () => {
      manager.unsubscribe(key);
    };
  }, [key, interval, enabled]);

  return { lastUpdate };
}

/**
 * Hook for accessing global refresh controls
 */
export function useRefreshControl() {
  const manager = getRefreshManager();
  const [state, setState] = useState({
    isPaused: manager.getPaused(),
    isOnline: manager.getOnline(),
    isMarketOpen: manager.isMarketOpen(),
    activeCount: manager.getActiveCount(),
    totalCount: manager.getTotalCount()
  });

  useEffect(() => {
    const updateState = () => {
      setState({
        isPaused: manager.getPaused(),
        isOnline: manager.getOnline(),
        isMarketOpen: manager.isMarketOpen(),
        activeCount: manager.getActiveCount(),
        totalCount: manager.getTotalCount()
      });
    };

    manager.addListener(updateState);

    // Also check market status every minute
    const marketCheckInterval = setInterval(updateState, 60000);

    return () => {
      manager.removeListener(updateState);
      clearInterval(marketCheckInterval);
    };
  }, []);

  const togglePause = useCallback(() => {
    manager.togglePause();
  }, []);

  const setPaused = useCallback((paused) => {
    manager.setPaused(paused);
  }, []);

  return {
    isPaused: state.isPaused,
    isOnline: state.isOnline,
    isMarketOpen: state.isMarketOpen,
    activeCount: state.activeCount,
    totalCount: state.totalCount,
    togglePause,
    setPaused
  };
}

/**
 * Utility hook for formatting "last updated" timestamp
 * @param {number} timestamp - Last update timestamp
 * @returns {string} Formatted relative time
 */
export function useRelativeTime(timestamp) {
  const [relativeTime, setRelativeTime] = useState('');

  useEffect(() => {
    const updateRelativeTime = () => {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);

      if (seconds < 2) {
        setRelativeTime('Just now');
      } else if (seconds < 60) {
        setRelativeTime(`${seconds}s ago`);
      } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        setRelativeTime(`${minutes}m ago`);
      } else {
        const hours = Math.floor(seconds / 3600);
        setRelativeTime(`${hours}h ago`);
      }
    };

    updateRelativeTime();
    const interval = setInterval(updateRelativeTime, 1000);

    return () => clearInterval(interval);
  }, [timestamp]);

  return relativeTime;
}

/**
 * Hook to track price changes for flash animations
 * @param {number} currentPrice - Current price value
 * @param {string} key - Unique key for this price tracker
 * @returns {string} CSS class for flash animation ('price-flash-up', 'price-flash-down', or '')
 */
export function usePriceFlash(currentPrice, key) {
  const prevPriceRef = useRef(currentPrice);
  const [flashClass, setFlashClass] = useState('');

  useEffect(() => {
    if (prevPriceRef.current !== currentPrice && currentPrice != null) {
      if (currentPrice > prevPriceRef.current) {
        setFlashClass('price-flash-up');
      } else if (currentPrice < prevPriceRef.current) {
        setFlashClass('price-flash-down');
      }

      prevPriceRef.current = currentPrice;

      // Clear flash after animation
      const timer = setTimeout(() => setFlashClass(''), 600);
      return () => clearTimeout(timer);
    }
  }, [currentPrice, key]);

  return flashClass;
}

export default useAutoRefresh;
