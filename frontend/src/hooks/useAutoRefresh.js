/**
 * Global Auto-Refresh Hook
 * Manages automatic data refresh for all components with market hours awareness
 * Fast mode: 10-20s intervals (Zerodha Kite-style)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { isMarketOpen } from '../utils/marketHours';

// Global state for auto-refresh manager
let globalRefreshManager = null;

class RefreshManager {
  constructor() {
    this.subscriptions = new Map();
    this.timers = new Map();
    this.isPaused = false;
    this.isTabVisible = true;
    this.listeners = new Set();

    // Listen for visibility changes
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.isTabVisible = !document.hidden;
        if (this.isTabVisible && !this.isPaused) {
          this.resumeAll();
        } else {
          this.pauseAll();
        }
      });
    }
  }

  /**
   * Subscribe to auto-refresh
   * @param {string} key - Unique identifier for this subscription
   * @param {Function} callback - Function to call on refresh
   * @param {number} interval - Refresh interval in milliseconds
   * @returns {string} Subscription key
   */
  subscribe(key, callback, interval) {
    // Store subscription
    this.subscriptions.set(key, { callback, interval });

    // Start timer if not paused and market is open
    if (!this.isPaused && this.isTabVisible && isMarketOpen()) {
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

    // Start new timer
    const timerId = setInterval(() => {
      // Check market hours before each refresh
      if (isMarketOpen() && !this.isPaused && this.isTabVisible) {
        try {
          subscription.callback();
        } catch (error) {
          console.error(`Error in auto-refresh callback for ${key}:`, error);
        }
      } else if (!isMarketOpen()) {
        // Market closed, pause this timer
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
    if (!isMarketOpen()) return; // Don't resume if market is closed

    this.subscriptions.forEach((subscription, key) => {
      this.startTimer(key);
    });
  }

  /**
   * Toggle pause state
   */
  togglePause() {
    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      this.pauseAll();
    } else if (this.isTabVisible && isMarketOpen()) {
      this.resumeAll();
    }

    this.notifyListeners();
  }

  /**
   * Set pause state
   * @param {boolean} paused - New pause state
   */
  setPaused(paused) {
    if (this.isPaused === paused) return;
    this.togglePause();
  }

  /**
   * Get current pause state
   * @returns {boolean}
   */
  getPaused() {
    return this.isPaused;
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
    const marketOpen = isMarketOpen();

    if (marketOpen && !this.isPaused && this.isTabVisible) {
      // Market is open, ensure all subscriptions have active timers
      this.subscriptions.forEach((subscription, key) => {
        if (!this.timers.has(key)) {
          this.startTimer(key);
        }
      });
    } else if (!marketOpen) {
      // Market is closed, stop all timers
      this.pauseAll();
    }

    this.notifyListeners();
  }
}

/**
 * Get or create the global refresh manager
 * @returns {RefreshManager}
 */
function getRefreshManager() {
  if (!globalRefreshManager) {
    globalRefreshManager = new RefreshManager();

    // Check market hours every minute
    setInterval(() => {
      globalRefreshManager.checkMarketHours();
    }, 60000); // 1 minute
  }
  return globalRefreshManager;
}

/**
 * Hook for components to use auto-refresh
 * @param {string} key - Unique key for this component's subscription
 * @param {Function} callback - Refresh callback
 * @param {number} interval - Refresh interval in milliseconds
 * @param {boolean} enabled - Whether auto-refresh is enabled
 */
export function useAutoRefresh(key, callback, interval, enabled = true) {
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
    activeCount: manager.getActiveCount(),
    totalCount: manager.getTotalCount()
  });

  useEffect(() => {
    const updateState = () => {
      setState({
        isPaused: manager.getPaused(),
        activeCount: manager.getActiveCount(),
        totalCount: manager.getTotalCount()
      });
    };

    manager.addListener(updateState);
    return () => manager.removeListener(updateState);
  }, []);

  const togglePause = useCallback(() => {
    manager.togglePause();
  }, []);

  const setPaused = useCallback((paused) => {
    manager.setPaused(paused);
  }, []);

  return {
    isPaused: state.isPaused,
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

      if (seconds < 5) {
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

export default useAutoRefresh;
